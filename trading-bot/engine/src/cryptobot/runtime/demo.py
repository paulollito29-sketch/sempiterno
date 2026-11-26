"""Datos de demostración para el panel: reproduce N días en modo práctica (paper) con reloj simulado.

Usa los datos reales descargados si existen (recomendaciones simuladas sobre precios reales);
si no, un mercado sintético. Nunca representa operaciones reales.
"""

from __future__ import annotations

import json
from dataclasses import replace
from pathlib import Path

import pandas as pd

from cryptobot.config import STRATEGY_PRESETS, Mode, Settings
from cryptobot.data.candles import prepare_bars_20m
from cryptobot.data.store import ParquetStore
from cryptobot.notify.telegram import MemoryNotifier
from cryptobot.persistence.base import Repo
from cryptobot.persistence.sqlite_store import SQLiteStore
from cryptobot.runtime.app import BotApp
from cryptobot.runtime.market import ReplayMarket
from cryptobot.strategy.frame import build_symbol_frame
from cryptobot.timeutils import BAR, iso

DEMO_SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]


def replay(app: BotApp, start: pd.Timestamp, end: pd.Timestamp) -> int:
    t = start.floor("20min") + BAR
    n = 0
    while t <= end:
        app.run_cycle(t + pd.Timedelta(seconds=5))
        t += BAR
        n += 1
    return n


def _frames(settings: Settings, days: int, seed: int) -> tuple[dict, str]:
    params = STRATEGY_PRESETS["lemon"]
    store = ParquetStore(settings.data_dir / "market")
    if all(s in store.symbols() for s in DEMO_SYMBOLS):
        frames = {}
        fng = store.read_series("fng")
        for s in DEMO_SYMBOLS:
            raw = store.read_bars(s, "5m")
            raw = raw[raw.index >= raw.index[-1] - pd.Timedelta(days=days + 420)]
            frames[s] = build_symbol_frame(
                s, prepare_bars_20m(raw), params, store.read_series("funding", s), fng, use_hmm=True
            )
        return frames, "precios reales de Binance; recomendaciones simuladas en modo práctica"
    from cryptobot.data.synthetic import generate_universe

    uni = generate_universe(DEMO_SYMBOLS, days=days + 420, seed=seed)
    frames = {
        s: build_symbol_frame(
            s, prepare_bars_20m(m.bars_5m), params, m.funding, m.fng, use_hmm=True
        )
        for s, m in uni.items()
    }
    return frames, "mercado sintético; recomendaciones simuladas en modo práctica"


def build_demo(
    out: Path,
    days: int = 45,
    seed: int = 21,
    settings: Settings | None = None,
    report_path: Path | None = None,
) -> Path:
    settings = settings or Settings()
    frames, note = _frames(settings, days, seed)
    store = SQLiteStore(":memory:")
    repo = Repo(store)
    demo_settings = replace_settings(settings)
    market = ReplayMarket(frames)
    end = min(f.index[-1] for f in frames.values()) + BAR
    start = end - pd.Timedelta(days=days)
    bundle = _oos_bundle(frames, start)
    app = BotApp(
        demo_settings, repo, market, notifier=MemoryNotifier(), registry=None, bundle=bundle
    )
    replay(app, start, end)
    tables = store.dump()
    tables["cycles"] = sorted(tables.get("cycles", []), key=lambda r: r["id"])[-150:]
    eq = sorted(tables.get("equity_snapshots", []), key=lambda r: r["ts"])
    tables["equity_snapshots"] = eq[::3] + eq[-1:]  # una por hora
    bars = tables.get("market_bars", [])
    cutoff = iso(end - pd.Timedelta(days=7))
    tables["market_bars"] = [b for b in bars if b["ts"] >= cutoff]
    report = _latest_report(settings, report_path)
    if report:
        tables["backtests"] = [report]
    tables["models"] = _model_rows(settings)
    payload = {"generated_at": iso(pd.Timestamp.now(tz="UTC")), "note": note, "tables": tables}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, default=str))
    return out


def _oos_bundle(frames: dict, start: pd.Timestamp):
    """Meta-modelo entrenado SOLO con datos anteriores a la demo (fuera de muestra para la demo)."""
    from cryptobot.backtest.research import ResearchConfig, train_final_model
    from cryptobot.runtime.app import ModelBundle
    from cryptobot.strategy.frame import SymbolFrame

    params = replace(STRATEGY_PRESETS["lemon"], use_meta_model=True)
    cut = {}
    for s, f in frames.items():
        k = int(f.index.searchsorted(start))
        cut[s] = SymbolFrame(
            s,
            f.bars.iloc[:k],
            f.features.iloc[:k],
            f.regimes.iloc[:k],
            f.overlays.iloc[:k],
            f.event_side[:k],
        )
    model, payoff, _ = train_final_model(cut, params, ResearchConfig(cost_profile="lemon"))
    if model is None:
        return None
    return ModelBundle("demo-fuera-de-muestra", params, payoff, model, approved=False)


def _model_rows(settings: Settings) -> list[dict]:
    from cryptobot.models.registry import ModelRegistry

    if not settings.models_dir.exists():
        return []
    rows = []
    for c in ModelRegistry(settings.models_dir).list_cards():
        rows.append(
            {
                "version": c.version,
                "created_at": c.created_at,
                "status": c.status,
                "uses_meta": c.uses_meta,
                "cost_profile": c.cost_profile,
                "gate": c.gate,
                "oos_metrics": c.oos_metrics,
                "feature_importance": c.feature_importance,
                "notes": c.notes,
            }
        )
    return rows


def replace_settings(settings: Settings) -> Settings:
    return settings.model_copy(
        update={
            "mode": Mode.PAPER,
            "cost_profile": "lemon",
            "watchlist": ",".join(DEMO_SYMBOLS),
            "capital_usd": 1000.0,
        }
    )


def _latest_report(settings: Settings, report_path: Path | None) -> dict | None:
    path = report_path
    if path is None:
        candidates = sorted(Path("reports").glob("*/reporte.json"))
        path = candidates[-1] if candidates else None
    if path is None or not path.exists():
        return None
    d = json.loads(path.read_text())
    return {
        "id": path.parent.name,
        "created_at": iso(pd.Timestamp.now(tz="UTC")),
        "profile": d["config"]["cost_profile"],
        "period": d["period"],
        "selected": d["selected"],
        "baselines": d["baselines"],
        "statistics": d["statistics"],
        "gate": d["gate"],
        "champion": d["champion"],
        "curves": d["curves"],
        "calibration": d["calibration"],
        "symbols": d["config"]["symbols"],
    }


__all__ = ["build_demo", "replace", "replay"]
