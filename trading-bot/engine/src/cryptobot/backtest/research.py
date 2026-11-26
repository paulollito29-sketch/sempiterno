"""Pipeline de investigación: walk-forward + backtests + baselines + DSR/PBO + puerta de calidad.

Pasos:
1. Features, régimen (HMM re-estimado solo con el pasado) y eventos para cada cripto.
2. Etiquetas de triple barrera (netas de costos y demoras) para las candidatas de la regla primaria.
3. Walk-forward trimestral con purga: el meta-modelo se entrena SOLO con etiquetas cuyo resultado
   se conoció antes del tramo de prueba, y predice el tramo siguiente (fuera de muestra).
4. Backtest de cada variante (con y sin meta-modelo, y perturbaciones de parámetros) en el período
   fuera de muestra, con el mismo motor de decisión del bot en vivo.
5. Baselines netas de costos, Deflated Sharpe (por número de pruebas), PBO (CSCV) y bootstrap.
6. Puerta de calidad: si no se cumple, el sistema NO debe pasar a dinero real.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, replace
from typing import Any

import numpy as np
import pandas as pd

from cryptobot.backtest.baselines import all_baselines
from cryptobot.backtest.engine import BacktestResult, combine_equal_weight, run_symbol_backtest
from cryptobot.config import (
    COST_PROFILES,
    STRATEGY_PRESETS,
    CostProfile,
    Regime,
    RiskLimits,
    StrategyParams,
)
from cryptobot.features.pipeline import FEATURE_COLUMNS
from cryptobot.labeling.triple_barrier import label_events
from cryptobot.logging_setup import get_logger
from cryptobot.models.meta import MetaModel, PayoffStats
from cryptobot.models.primary import detect_events
from cryptobot.strategy.decision import DecisionEngine
from cryptobot.strategy.frame import SymbolFrame
from cryptobot.validation.metrics import (
    bootstrap_max_drawdown,
    brier_score,
    calibration_table,
    deflated_sharpe_ratio,
    equity_metrics,
    pbo_cscv,
    per_period_sharpe,
)
from cryptobot.validation.splits import purged_train_mask, walk_forward_windows

log = get_logger(__name__)


@dataclass
class ResearchConfig:
    cost_profile: str = "lemon"
    params: StrategyParams | None = None
    limits: RiskLimits = field(default_factory=RiskLimits)
    test_days: int = 90
    min_train_days: int = 365
    min_train_events: int = 150
    seed: int = 0
    grid: list[dict[str, Any]] | None = None  # variantes para DSR/PBO

    @property
    def costs(self) -> CostProfile:
        return COST_PROFILES[self.cost_profile]

    @property
    def base_params(self) -> StrategyParams:
        return self.params or STRATEGY_PRESETS.get(self.cost_profile, StrategyParams())

    def variants(self) -> dict[str, StrategyParams]:
        base = self.base_params
        grid = self.grid
        if grid is None:
            grid = []
            for k in sorted(
                {base.cusum_k, round(base.cusum_k * 0.75, 3), round(base.cusum_k * 1.25, 3)}
            ):
                for sl, tp in sorted(
                    {(base.sl_mult, base.tp_mult), (base.sl_mult * 1.25, base.tp_mult * 1.25)}
                ):
                    for meta in (True, False):
                        grid.append(
                            {"cusum_k": k, "sl_mult": sl, "tp_mult": tp, "use_meta_model": meta}
                        )
        out = {}
        for g in grid:
            p = replace(base, **g)
            name = f"k{p.cusum_k:g}_sl{p.sl_mult:g}_tp{p.tp_mult:g}_{'meta' if p.use_meta_model else 'regla'}"
            out[name] = p
        return out

    def selected_names(self) -> tuple[str, str]:
        b = self.base_params
        stem = f"k{b.cusum_k:g}_sl{b.sl_mult:g}_tp{b.tp_mult:g}"
        return f"{stem}_meta", f"{stem}_regla"


# ----------------------------------------------------------------- etiquetas
def with_events(frame: SymbolFrame, params: StrategyParams) -> SymbolFrame:
    ev = detect_events(frame.features, params)
    side = np.zeros(frame.n, dtype=np.int64)
    if not ev.empty:
        side[ev["bar"].to_numpy()] = ev["side"].to_numpy()
    return SymbolFrame(
        frame.symbol, frame.bars, frame.features, frame.regimes, frame.overlays, side
    )


def candidate_bars(frame: SymbolFrame, params: StrategyParams) -> np.ndarray:
    """Barras donde el motor consultaría al meta-modelo (mismas reglas que DecisionEngine._entry)."""
    ev = frame.event_side != 0
    vote_ok = np.nan_to_num(frame._vote, nan=-9) >= params.entry_vote
    not_stress = frame._regime != Regime.STRESS.value
    mask = ev & vote_ok & not_stress & ~frame._euph & ~frame._macro & frame._ok
    return np.flatnonzero(mask)


def label_frame(frame: SymbolFrame, params: StrategyParams, costs: CostProfile) -> pd.DataFrame:
    bars_idx = candidate_bars(frame, params)
    lab = label_events(frame.bars.reindex(frame.index), frame._sigma, bars_idx, params, costs)
    if lab.empty:
        return lab
    X = frame.model_matrix(lab["event_bar"].to_numpy())
    X = X[FEATURE_COLUMNS].reset_index(drop=True)
    lab = pd.concat([lab.reset_index(drop=True), X], axis=1)
    lab["symbol"] = frame.symbol
    return lab


# ---------------------------------------------------------------- walk-forward
@dataclass
class WalkForwardOutput:
    oos: pd.DataFrame  # predicciones fuera de muestra (todas las criptos)
    schedule: list[tuple[pd.Timestamp, PayoffStats]]
    folds: list[dict]
    oos_start: pd.Timestamp | None


def walk_forward(
    labels: pd.DataFrame,
    start: pd.Timestamp,
    end: pd.Timestamp,
    cfg: ResearchConfig,
    params: StrategyParams,
) -> WalkForwardOutput:
    use_meta = params.use_meta_model
    windows = walk_forward_windows(start, end, cfg.test_days, cfg.min_train_days)
    oos_parts, schedule, folds = [], [], []
    if labels.empty:
        return WalkForwardOutput(pd.DataFrame(), [], [], windows[0].test_start if windows else None)
    t_event = pd.DatetimeIndex(labels["t_event"])
    for w in windows:
        train = labels[purged_train_mask(labels["t_end"], w.test_start)]
        test_mask = (t_event >= w.test_start) & (t_event < w.test_end)
        test = labels[np.asarray(test_mask)]
        payoff = PayoffStats.from_returns(train["net_ret"].to_numpy())
        info = {
            "test_start": str(w.test_start),
            "test_end": str(w.test_end),
            "n_train": len(train),
            "n_test": len(test),
        }
        if len(train) < cfg.min_train_events or train["label"].nunique() < 2:
            info["skipped"] = True
            folds.append(info)
            continue
        schedule.append((w.test_start, payoff))
        if use_meta and len(test):
            model = MetaModel(seed=cfg.seed).fit(
                train[FEATURE_COLUMNS],
                train["label"].to_numpy(),
                train["net_ret"].to_numpy(),
                train["t_event"].to_numpy(),
            )
            p = model.predict_proba(test[FEATURE_COLUMNS])
            part = test[["symbol", "event_bar", "t_event", "label", "net_ret"]].copy()
            part["prob"] = p
            part["threshold"] = payoff.threshold(params.min_edge)
            oos_parts.append(part)
            info["threshold"] = part["threshold"].iloc[0]
        info["base_rate"] = payoff.base_rate
        folds.append(info)
    oos = pd.concat(oos_parts, ignore_index=True) if oos_parts else pd.DataFrame()
    return WalkForwardOutput(oos, schedule, folds, schedule[0][0] if schedule else None)


# ------------------------------------------------------------------ variantes
@dataclass
class VariantResult:
    name: str
    params: StrategyParams
    results: list[BacktestResult]
    daily: pd.Series
    metrics: dict
    wf: WalkForwardOutput
    labels: pd.DataFrame


def evaluate_variant(
    name: str,
    frames: dict[str, SymbolFrame],
    params: StrategyParams,
    cfg: ResearchConfig,
    start: pd.Timestamp,
    end: pd.Timestamp,
) -> VariantResult:
    costs = cfg.costs
    vframes = {s: with_events(f, params) for s, f in frames.items()}
    labels = pd.concat([label_frame(f, params, costs) for f in vframes.values()], ignore_index=True)
    wf = walk_forward(labels, start, end, cfg, params)
    results = []
    if wf.oos_start is not None:
        for sym, f in vframes.items():
            if params.use_meta_model and not wf.oos.empty:
                sub = wf.oos[wf.oos["symbol"] == sym]
                f.probs[sub["event_bar"].to_numpy()] = sub["prob"].to_numpy()
            engine = DecisionEngine(
                params, cfg.limits, costs, payoff=None, has_model=params.use_meta_model
            )
            res = run_symbol_backtest(
                f, engine, start=wf.oos_start, end=end, payoff_schedule=wf.schedule
            )
            results.append(res)
    daily = combine_equal_weight(results)
    trades = concat_trades(results)
    exposure = float(np.mean([r.exposure for r in results])) if results else 0.0
    metrics = (
        equity_metrics(daily, trades if len(trades) else None, exposure) if len(daily) > 1 else {}
    )
    return VariantResult(name, params, results, daily, metrics, wf, labels)


def concat_trades(results: list[BacktestResult]) -> pd.DataFrame:
    parts = [r.trades for r in results if len(r.trades)]
    return pd.concat(parts, ignore_index=True) if parts else pd.DataFrame()


# --------------------------------------------------------------- orquestación
@dataclass
class ResearchReport:
    config: dict
    period: dict
    variants: dict[str, dict]
    selected: dict
    baselines: dict[str, dict]
    per_symbol: dict[str, dict]
    statistics: dict
    gate: dict
    champion: str
    curves: dict[str, list]  # curvas diarias (para el panel)
    folds: list[dict]
    calibration: list[dict]
    feature_importance: dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def run_research(
    frames: dict[str, SymbolFrame], cfg: ResearchConfig
) -> tuple[ResearchReport, dict[str, VariantResult]]:
    start = min(f.index[0] for f in frames.values())
    end = max(f.index[-1] for f in frames.values())
    variant_results: dict[str, VariantResult] = {}
    for name, params in cfg.variants().items():
        log.info("evaluando variante", extra={"data": {"variant": name}})
        variant_results[name] = evaluate_variant(name, frames, params, cfg, start, end)

    meta_name, rule_name = cfg.selected_names()
    meta_v = variant_results.get(meta_name)
    rule_v = variant_results.get(rule_name)
    oos_start = (meta_v or rule_v).wf.oos_start if (meta_v or rule_v) else None

    # Baselines en el mismo período fuera de muestra
    baseline_curves: dict[str, list[pd.Series]] = {}
    for f in frames.values():
        for bname, curve in all_baselines(f.bars, cfg.costs, oos_start, end).items():
            baseline_curves.setdefault(bname, []).append(curve / curve.iloc[0])
    baselines = {}
    curves: dict[str, list] = {}
    for bname, cs in baseline_curves.items():
        port = pd.concat(cs, axis=1).ffill().dropna().mean(axis=1)
        baselines[bname] = equity_metrics(port)
        curves[bname] = _curve(port)

    # Estadística sobre el conjunto de pruebas
    daily_returns = {
        n: v.daily.pct_change().dropna() for n, v in variant_results.items() if len(v.daily) > 2
    }
    trial_srs = np.array([per_period_sharpe(r.to_numpy()) for r in daily_returns.values()])
    stats: dict[str, Any] = {"n_trials": len(trial_srs)}
    if daily_returns:
        aligned = pd.concat(daily_returns, axis=1).fillna(0.0)
        stats["pbo"] = pbo_cscv(aligned.to_numpy(), n_splits=16)
    for label, v in (("meta", meta_v), ("regla", rule_v)):
        if v is None or len(v.daily) < 3:
            continue
        r = v.daily.pct_change().dropna().to_numpy()
        stats[f"dsr_{label}"] = deflated_sharpe_ratio(r, trial_srs)
        trades = concat_trades(v.results)
        if len(trades):
            stats[f"bootstrap_dd_{label}"] = bootstrap_max_drawdown(
                (trades["net_ret"] * trades["size_frac"]).to_numpy(), seed=cfg.seed
            )
        curves[f"bot_{label}"] = _curve(v.daily)
    variant_sharpes = {n: v.metrics.get("sharpe", 0.0) for n, v in variant_results.items()}
    stats["variant_sharpe_median"] = (
        float(np.median(list(variant_sharpes.values()))) if variant_sharpes else 0.0
    )

    calib, brier = [], None
    if meta_v is not None and not meta_v.wf.oos.empty:
        calib = calibration_table(
            meta_v.wf.oos["prob"].to_numpy(), meta_v.wf.oos["label"].to_numpy()
        )
        brier = brier_score(meta_v.wf.oos["prob"].to_numpy(), meta_v.wf.oos["label"].to_numpy())
        stats["brier"] = brier
        stats["oos_events"] = len(meta_v.wf.oos)

    gate_meta = _gate(meta_v, baselines, stats, "meta")
    gate_rule = _gate(rule_v, baselines, stats, "regla")
    beats = (
        meta_v is not None
        and rule_v is not None
        and meta_v.metrics.get("sharpe", -9) > rule_v.metrics.get("sharpe", -9)
    )
    if gate_meta["passed"] and beats:
        champion = "meta"
    elif gate_rule["passed"]:
        champion = "regla"
    elif gate_meta["passed"]:
        champion = "meta"
    else:
        champion = "ninguno"

    per_symbol = {}
    chosen = meta_v if champion in ("meta", "ninguno") and meta_v is not None else rule_v
    if chosen is not None:
        for r in chosen.results:
            per_symbol[r.symbol] = r.metrics

    report = ResearchReport(
        config={
            "cost_profile": cfg.cost_profile,
            "costs": asdict(cfg.costs),
            "params": asdict(cfg.base_params),
            "limits": asdict(cfg.limits),
            "test_days": cfg.test_days,
            "min_train_days": cfg.min_train_days,
            "symbols": sorted(frames),
        },
        period={
            "data_start": str(start),
            "data_end": str(end),
            "oos_start": str(oos_start) if oos_start is not None else None,
        },
        variants={n: v.metrics for n, v in variant_results.items()},
        selected={
            "meta": meta_v.metrics if meta_v else {},
            "regla": rule_v.metrics if rule_v else {},
        },
        baselines=baselines,
        per_symbol=per_symbol,
        statistics=stats,
        gate={"meta": gate_meta, "regla": gate_rule},
        champion=champion,
        curves=curves,
        folds=(meta_v or rule_v).wf.folds if (meta_v or rule_v) else [],
        calibration=calib,
    )
    return report, variant_results


def _gate(v: VariantResult | None, baselines: dict[str, dict], stats: dict, label: str) -> dict:
    """Criterios para pasar a dinero real (sección 5 del plan)."""
    if v is None or not v.metrics:
        return {"passed": False, "checks": [], "note": "sin resultados"}
    m = v.metrics
    bh = baselines.get("comprar_y_mantener", {})
    best_base_sharpe = max((b.get("sharpe", -9) for b in baselines.values()), default=-9)
    pbo = stats.get("pbo", {}).get("pbo", float("nan"))
    checks = [
        (
            "Deflated Sharpe >= 0.95",
            stats.get(f"dsr_{label}", 0.0),
            stats.get(f"dsr_{label}", 0.0) >= 0.95,
        ),
        ("PBO <= 0.20", pbo, bool(np.isfinite(pbo) and pbo <= 0.20)),
        ("t-stat >= 3 (Harvey, Liu & Zhu)", m.get("t_stat", 0.0), m.get("t_stat", 0.0) >= 3.0),
        (
            "Sharpe > comprar y mantener",
            m.get("sharpe", 0.0),
            m.get("sharpe", 0.0) > bh.get("sharpe", 9),
        ),
        (
            "Sharpe > todas las baselines",
            m.get("sharpe", 0.0),
            m.get("sharpe", 0.0) > best_base_sharpe,
        ),
        (
            "Caída máx. menor que comprar y mantener",
            m.get("max_drawdown", -1.0),
            m.get("max_drawdown", -1.0) > bh.get("max_drawdown", 0.0),
        ),
        (
            "Robusto: mediana de variantes con Sharpe > 0",
            stats.get("variant_sharpe_median", 0.0),
            stats.get("variant_sharpe_median", 0.0) > 0,
        ),
        ("Al menos 30 operaciones", m.get("n_trades", 0), m.get("n_trades", 0) >= 30),
    ]
    return {
        "passed": all(c[2] for c in checks),
        "checks": [{"check": c[0], "value": _num(c[1]), "ok": bool(c[2])} for c in checks],
    }


def _num(x: Any) -> Any:
    try:
        f = float(x)
        return f if np.isfinite(f) else None
    except (TypeError, ValueError):
        return x


def _curve(s: pd.Series, max_points: int = 400) -> list:
    s = s.dropna()
    if len(s) > max_points:
        step = int(np.ceil(len(s) / max_points))
        s = pd.concat([s.iloc[::step], s.iloc[[-1]]])
        s = s[~s.index.duplicated(keep="last")]
    base = s.iloc[0] if len(s) else 1.0
    return [[t.strftime("%Y-%m-%d"), round(float(v / base), 5)] for t, v in s.items()]


def train_final_model(
    frames: dict[str, SymbolFrame], params: StrategyParams, cfg: ResearchConfig
) -> tuple[MetaModel | None, PayoffStats, pd.DataFrame]:
    """Modelo para operar: entrenado con TODAS las etiquetas disponibles de la configuración elegida."""
    vframes = {s: with_events(f, params) for s, f in frames.items()}
    labels = pd.concat(
        [label_frame(f, params, cfg.costs) for f in vframes.values()], ignore_index=True
    )
    payoff = PayoffStats.from_returns(labels["net_ret"].to_numpy() if len(labels) else np.array([]))
    if len(labels) < cfg.min_train_events or labels["label"].nunique() < 2:
        return None, payoff, labels
    model = MetaModel(seed=cfg.seed).fit(
        labels[FEATURE_COLUMNS],
        labels["label"].to_numpy(),
        labels["net_ret"].to_numpy(),
        labels["t_event"].to_numpy(),
    )
    return model, payoff, labels
