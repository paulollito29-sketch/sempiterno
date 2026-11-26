"""La aplicación en vivo: ciclo de 20 minutos, vigilante de precios, comandos y avisos."""

from __future__ import annotations

from dataclasses import asdict, dataclass, replace
from typing import Any

import pandas as pd

from cryptobot.config import (
    COST_PROFILES,
    STRATEGY_PRESETS,
    Action,
    Mode,
    Regime,
    RiskLimits,
    Settings,
    StrategyParams,
    base_asset,
    dataclass_from_dict,
)
from cryptobot.execution.broker import LedgerBroker, ManualBroker, PaperBroker
from cryptobot.logging_setup import get_logger
from cryptobot.models.meta import MetaModel, PayoffStats
from cryptobot.models.ranking import trend_score
from cryptobot.models.registry import ModelRegistry
from cryptobot.notify.formatter import buttons_for, format_recommendation
from cryptobot.notify.telegram import LogNotifier, Notifier
from cryptobot.persistence.base import Repo
from cryptobot.recommend.engine import RecommendationEngine, RecSettings
from cryptobot.recommend.models import Recommendation, RecStatus
from cryptobot.recommend.tracker import track_record, update_outcomes
from cryptobot.runtime.market import MarketSource
from cryptobot.strategy.decision import DecisionEngine, PortfolioView
from cryptobot.strategy.risk import RiskState
from cryptobot.timeutils import BAR, floor_bar, iso, last_closed_bar_open, to_utc, utcnow

log = get_logger(__name__)

RISK_BOUNDS = {
    "risk_per_trade": (0.001, 0.03),
    "max_position": (0.01, 0.5),
    "max_total_exposure": (0.05, 1.0),
    "vol_target_annual": (0.05, 1.5),
    "kelly_fraction": (0.05, 1.0),
    "max_trades_per_week": (1, 20),
    "daily_loss_limit": (0.005, 0.2),
    "max_drawdown": (0.02, 0.5),
    "min_trade_usd": (1.0, 10_000.0),
}
API_CONFIRMATION = "ACEPTO EL RIESGO"
REGIME_CONFIRM_CYCLES = (
    9  # un cambio de régimen se avisa si persiste ~3 horas (evita avisos por ruido)
)


def confirm_regimes(
    confirmed: dict[str, str],
    candidates: dict[str, dict],
    observed: dict[str, str],
    need: int = REGIME_CONFIRM_CYCLES,
) -> tuple[dict[str, str], dict[str, dict], dict[str, tuple[str, str]]]:
    """Histéresis de régimen: devuelve (confirmados, candidatos, cambios a avisar)."""
    confirmed, candidates = dict(confirmed), dict(candidates)
    changes: dict[str, tuple[str, str]] = {}
    for sym, r in observed.items():
        cur = confirmed.get(sym)
        if cur is None:
            confirmed[sym] = r
        elif r == cur:
            candidates.pop(sym, None)
        else:
            cand = candidates.get(sym)
            count = cand["count"] + 1 if cand and cand.get("regime") == r else 1
            if count >= need:
                changes[sym] = (cur, r)
                confirmed[sym] = r
                candidates.pop(sym, None)
            else:
                candidates[sym] = {"regime": r, "count": count}
    return confirmed, candidates, changes


@dataclass
class LiveConfig:
    watchlist: list[str]
    mode: str
    cost_profile: str
    capital_usd: float
    limits: RiskLimits
    summary_hour_utc: int
    paused: bool

    def to_row(self) -> dict[str, Any]:
        return {
            "watchlist": self.watchlist,
            "mode": self.mode,
            "cost_profile": self.cost_profile,
            "capital_usd": self.capital_usd,
            "risk": asdict(self.limits),
            "summary_hour_utc": self.summary_hour_utc,
            "paused": self.paused,
        }


@dataclass
class ModelBundle:
    version: str | None
    params: StrategyParams
    payoff: PayoffStats | None
    model: MetaModel | None
    approved: bool

    @property
    def has_model(self) -> bool:
        return self.model is not None and self.params.use_meta_model


def load_config(repo: Repo, settings: Settings) -> LiveConfig:
    row = repo.get_config()
    if not row:
        cfg = LiveConfig(
            watchlist=settings.watchlist_symbols,
            mode=settings.mode.value,
            cost_profile=settings.cost_profile,
            capital_usd=settings.capital_usd,
            limits=RiskLimits(),
            summary_hour_utc=settings.summary_hour_utc,
            paused=False,
        )
        repo.save_config(cfg.to_row())
        return cfg
    return LiveConfig(
        watchlist=[s.upper() for s in row.get("watchlist") or settings.watchlist_symbols],
        mode=row.get("mode") or settings.mode.value,
        cost_profile=row.get("cost_profile") or settings.cost_profile,
        capital_usd=float(row.get("capital_usd") or settings.capital_usd),
        limits=dataclass_from_dict(RiskLimits, row.get("risk")),
        summary_hour_utc=int(row.get("summary_hour_utc", settings.summary_hour_utc)),
        paused=bool(row.get("paused", False)),
    )


def load_bundle(registry: ModelRegistry | None, cost_profile: str) -> ModelBundle:
    preset = STRATEGY_PRESETS.get(cost_profile, StrategyParams())
    champ = registry.load_champion(cost_profile) if registry is not None else None
    if champ is None:
        return ModelBundle(None, replace(preset, use_meta_model=False), None, None, False)
    card, art = champ
    params = dataclass_from_dict(StrategyParams, card.params, base=preset)
    return ModelBundle(
        card.version,
        params,
        art.get("payoff"),
        art.get("meta_model"),
        bool(card.gate.get("passed", False)),
    )


class BotApp:
    def __init__(
        self,
        settings: Settings,
        repo: Repo,
        market: MarketSource,
        broker: LedgerBroker | None = None,
        notifier: Notifier | None = None,
        registry: ModelRegistry | None = None,
        venue: str = "Lemon",
        bundle: ModelBundle | None = None,
    ):
        self.settings = settings
        self.repo = repo
        self.market = market
        self.notifier = notifier or LogNotifier()
        self.registry = registry
        self.venue = venue
        self.cfg = load_config(repo, settings)
        self.costs = COST_PROFILES[self.cfg.cost_profile]
        self.bundle = bundle or load_bundle(registry, self.cfg.cost_profile)
        self.broker = broker or self._make_broker()

    # ------------------------------------------------------------ armado
    def _make_broker(self) -> LedgerBroker:
        mode = self.cfg.mode
        if mode == Mode.PAPER.value:
            return PaperBroker(self.repo, self.costs, self.cfg.capital_usd)
        if mode in (Mode.SEMI_AUTO_API.value, Mode.AUTO_API.value):
            from cryptobot.execution.ccxt_broker import CcxtBroker

            return CcxtBroker(
                self.repo,
                self.costs,
                self.cfg.capital_usd,
                self.settings,
                auto=mode == Mode.AUTO_API.value,
            )
        return ManualBroker(self.repo, self.costs, self.cfg.capital_usd)

    def _rec_engine(self) -> RecommendationEngine:
        return RecommendationEngine(
            self.repo,
            self.cfg.mode,
            self.bundle.version,
            self.bundle.approved,
            RecSettings(expiry_minutes=self.settings.rec_expiry_minutes),
            self.venue,
        )

    def _emit(self, rec: Recommendation) -> None:
        self.notifier.notify(
            rec.message or format_recommendation(rec, self.venue), buttons_for(rec, self.cfg.mode)
        )

    # ------------------------------------------------------------ vigilante
    def check_exits(
        self, now: pd.Timestamp | None = None, live_prices: bool = False
    ) -> list[Recommendation]:
        """Stop/objetivo tocados → recomendación de venta inmediata (y ejecución en paper/API)."""
        now = now or utcnow()
        state = self.repo.get_state()
        checked = dict(state.get("watch_checked", {}))
        recs: list[Recommendation] = []
        engine = self._rec_engine()
        for sym, h in self.repo.holdings().items():
            trigger: tuple[str, float] | None = None
            if live_prices:
                px = self.market.last_price(sym, now)
                if px is not None:
                    if h.stop_price and px <= h.stop_price and not h.stop_alerted:
                        trigger = ("stop", px)
                    elif h.target_price and px >= h.target_price and not h.target_alerted:
                        trigger = ("target", px)
            else:
                # Nunca mirar barras anteriores a la apertura de ESTA posición.
                opened_bar = floor_bar(to_utc(h.opened_at)) - BAR
                last = checked.get(sym)
                after = max(to_utc(last), opened_bar) if last else opened_bar
                bars = self.market.bars_between(sym, after, now)
                for _, b in bars.iterrows():
                    if h.stop_price and b["low"] <= h.stop_price and not h.stop_alerted:
                        trigger = ("stop", min(float(b["open"]), h.stop_price))
                        break
                    if h.target_price and b["high"] >= h.target_price and not h.target_alerted:
                        trigger = ("target", max(float(b["open"]), h.target_price))
                        break
                if len(bars):
                    checked[sym] = iso(bars.index[-1])
            if trigger is None:
                continue
            kind, price = trigger
            if kind == "stop":
                h.stop_alerted = True
            else:
                h.target_alerted = True
            self.repo.save_holding(h)
            rec = engine.alert_exit(h, kind, price, now)
            self.broker.on_recommendation(rec, now)
            self._emit(rec)
            recs.append(rec)
        self.repo.save_state({**self.repo.get_state(), "watch_checked": checked})
        return recs

    # ------------------------------------------------------------ ciclo
    def run_cycle(self, now: pd.Timestamp | None = None) -> dict[str, Any]:
        now = now or utcnow()
        bar_t = last_closed_bar_open(now)
        cid = iso(bar_t)
        if self.repo.cycle_exists(cid):
            return {"id": cid, "skipped": True}
        started = utcnow()
        self.cfg = load_config(self.repo, self.settings)
        self.process_commands(now)
        engine_recs = self._rec_engine()
        engine_recs.expire(now)
        symbols = list(dict.fromkeys(self.cfg.watchlist + list(self.repo.holdings())))
        warnings: list[str] = []
        try:
            self.market.refresh(symbols, now)
        except Exception as exc:
            warnings.append(f"no se pudieron actualizar los datos: {exc}")
        new_recs = self.check_exits(now)

        views = {s: self.market.view(s, now) for s in symbols}
        closes = {s: float(v[0]._close[v[1]]) for s, v in views.items() if v is not None}
        snap = self.broker.portfolio(closes)
        state = self.repo.get_state()
        risk = RiskState.from_dict(state.get("risk"))
        risk.paused = self.cfg.paused
        decision_time = bar_t + BAR
        risk.update(snap.equity, decision_time)

        b = self.bundle
        engine = DecisionEngine(b.params, self.cfg.limits, self.costs, b.payoff, b.has_model)
        summary: dict[str, dict] = {}
        decisions = []
        scored = []
        for sym in symbols:
            v = views.get(sym)
            if v is None:
                summary[sym] = {"error": "sin datos suficientes"}
                warnings.append(f"{sym}: sin datos")
                continue
            frame, i = v
            mv = frame.view(i)
            if frame.index[i] < bar_t:
                mv.data_ok = False
                warnings.append(f"{sym}: datos desactualizados ({frame.index[i]})")
            if b.has_model and mv.is_event and mv.data_ok:
                X = frame.model_matrix([i])
                mv.prob = float(b.model.predict_proba(X)[0])
                mv.contributions = b.model.explain(X)[0]
            scored.append((trend_score(mv.row, mv.regime) or -99, sym, mv))
        for score, sym, mv in sorted(scored, key=lambda x: -x[0]):  # mejores oportunidades primero
            pf = PortfolioView(
                equity=snap.equity,
                exposure_value=snap.exposure_value,
                defensive_reason=risk.defensive_reason(snap.equity, self.cfg.limits),
                trades_last_7d=risk.trades_last_7d(decision_time),
            )
            d = engine.decide(mv, snap.positions.get(sym), pf)
            if d.action == Action.BUY:
                snap.exposure_value += d.size_frac * snap.equity
                risk.register_entry(decision_time)
            decisions.append(d)
            summary[sym] = {
                "close": mv.close,
                "regime": mv.regime.value if mv.regime else None,
                "p_stress": mv.p_stress,
                "trend_vote": mv.trend_vote,
                "event": mv.event_side,
                "prob": mv.prob,
                "score": score if score > -99 else None,
                "action": d.action.value,
                "reason": d.reason_code,
                "reasons": d.reasons,
                "euphoria": mv.euphoria,
                "fng": mv.row.get("fng"),
                "funding_z": mv.row.get("funding_z_30d"),
            }
        observed = {s: d["regime"] for s, d in summary.items() if d.get("regime")}
        regimes, candidates, changes = confirm_regimes(
            state.get("regimes", {}), state.get("regime_candidates", {}), observed
        )
        holdings = self.repo.holdings()
        created = engine_recs.from_decisions(decisions, holdings, snap.equity, now, changes)
        for rec in created:
            self.broker.on_recommendation(rec, now)
            self._emit(rec)
        new_recs += created

        # Persistencia
        snap2 = self.broker.portfolio(closes)
        risk.update(snap2.equity, decision_time)
        self.repo.save_state(
            {
                **self.repo.get_state(),
                "risk": risk.to_dict(),
                "regimes": regimes,
                "regime_candidates": candidates,
                "last_cycle": cid,
            }
        )
        self.repo.save_equity(
            decision_time,
            snap2.equity,
            snap2.cash,
            snap2.exposure_value,
            risk.drawdown(snap2.equity),
            self.cfg.mode,
        )
        ranking = [
            {
                "symbol": s,
                "score": summary[s].get("score"),
                "regime": summary[s].get("regime"),
                "action": summary[s].get("action"),
            }
            for _, s, _ in sorted(scored, key=lambda x: -x[0])
        ]
        row = {
            "id": cid,
            "ts": cid,
            "decision_time": iso(decision_time),
            "started_at": iso(started),
            "finished_at": iso(utcnow()),
            "status": "ok" if not warnings else "warning",
            "mode": self.cfg.mode,
            "equity": snap2.equity,
            "symbols": summary,
            "ranking": ranking,
            "new_recommendations": [r.id for r in new_recs],
            "model_version": b.version,
            "approved_model": b.approved,
            "defensive": risk.defensive_reason(snap2.equity, self.cfg.limits),
            "warnings": warnings,
        }
        self.repo.save_cycle(row)
        self._save_market_bars(symbols, now, state)
        try:
            bars = {s: self.market.recent_bars(s, now, 30) for s in symbols}
            update_outcomes(self.repo, bars, self.costs, now)
        except Exception as exc:
            log.warning("no se pudo actualizar el track record", extra={"data": {"err": str(exc)}})
        self.repo.heartbeat("engine", {"cycle": cid, "mode": self.cfg.mode, "equity": snap2.equity})
        return row

    def _save_market_bars(self, symbols: list[str], now: pd.Timestamp, state: dict) -> None:
        saved = dict(state.get("bars_saved", {}))
        for sym in symbols:
            v = self.market.view(sym, now)
            if v is None:
                continue
            frame, i = v
            last = saved.get(sym)
            start = to_utc(last) if last else frame.index[i] - pd.Timedelta(days=7)
            sel = (frame.index > start) & (frame.index <= frame.index[i])
            idx = sel.nonzero()[0]
            rows = []
            for j in idx:
                bar = frame.bars.iloc[j]
                rows.append(
                    {
                        "ts": iso(frame.index[j]),
                        "open": float(bar["open"]),
                        "high": float(bar["high"]),
                        "low": float(bar["low"]),
                        "close": float(bar["close"]),
                        "volume": float(bar["volume"]),
                        "regime": frame._regime[j],
                        "p_stress": float(frame._p_stress[j])
                        if frame._p_stress[j] == frame._p_stress[j]
                        else None,
                        "trend_vote": float(frame._vote[j])
                        if frame._vote[j] == frame._vote[j]
                        else None,
                    }
                )
            self.repo.save_market_bars(sym, rows)
            if len(idx):
                saved[sym] = iso(frame.index[idx[-1]])
        self.repo.save_state({**self.repo.get_state(), "bars_saved": saved})

    def safe_cycle(self) -> None:
        try:
            self.run_cycle()
        except Exception as exc:
            log.exception("el ciclo falló")
            self.repo.log_event("error", "cycle", f"el ciclo falló: {exc}")
            self.notifier.notify(f"❗ El ciclo falló: {exc}")

    def safe_watch(self) -> None:
        try:
            self.check_exits(live_prices=True)
        except Exception as exc:
            log.warning("vigilante con error", extra={"data": {"err": str(exc)}})

    # ------------------------------------------------------------ comandos (panel y Telegram)
    def process_commands(self, now: pd.Timestamp | None = None) -> int:
        n = 0
        for row in self.repo.pending_commands():
            try:
                result = self.apply_command(row.get("command", ""), row.get("payload") or {})
                self.repo.finish_command(row, "done", result)
            except Exception as exc:
                self.repo.finish_command(row, "error", str(exc))
            n += 1
        return n

    def apply_command(self, command: str, payload: dict[str, Any]) -> str:
        if command == "pause":
            return self.pause()
        if command == "resume":
            return self.resume()
        if command == "kill":
            return self.kill()
        if command == "mark_executed":
            return self.mark_executed(payload["rec_id"], payload.get("price"), payload.get("qty"))
        if command == "mark_skipped":
            return self.mark_skipped(payload["rec_id"])
        if command == "set_capital":
            return self.set_capital(payload["capital_usd"])
        if command == "set_holding":
            return self.set_holding(payload)
        if command == "remove_holding":
            self.repo.remove_holding(payload["symbol"].upper())
            return f"Se quitó {payload['symbol']} de tu cartera"
        if command == "update_config":
            return self.update_config(payload)
        if command == "run_cycle":
            return str(self.run_cycle().get("id"))
        raise ValueError(f"comando desconocido: {command}")

    def _save_cfg(self) -> None:
        self.repo.save_config(self.cfg.to_row())

    def pause(self, *_: Any) -> str:
        self.cfg = load_config(self.repo, self.settings)
        self.cfg.paused = True
        self._save_cfg()
        self.repo.log_event("warning", "pause", "bot en pausa: no habrá compras nuevas")
        return "⏸️ Bot en pausa: no recomendará compras nuevas (sí seguirá vigilando tus stops)."

    def resume(self, *_: Any) -> str:
        self.cfg = load_config(self.repo, self.settings)
        self.cfg.paused = False
        self._save_cfg()
        return "▶️ Bot reanudado."

    def kill(self) -> str:
        """Pausa y recomienda vender todo (en modo API automático, vende)."""
        msg = self.pause()
        now = utcnow()
        for sym, h in self.repo.holdings().items():
            px = self.market.last_price(sym, now) or h.avg_price
            rec = Recommendation(
                symbol=sym,
                action=Action.SELL.value,
                cycle_ts=iso(now),
                ref_price=px,
                qty=h.qty,
                mode=self.cfg.mode,
                reason_code="kill",
                reasons=["botón de emergencia: cerrar todas las posiciones"],
                expires_at=iso(now + pd.Timedelta(hours=6)),
                model_version=self.bundle.version,
                approved_model=self.bundle.approved,
            )
            rec.message = format_recommendation(rec, self.venue)
            self.repo.save_recommendation(rec)
            self.broker.on_recommendation(rec, now)
            self._emit(rec)
        return msg + " Se recomendó vender todas las posiciones."

    def _find_rec(self, rec_id: str) -> Recommendation | None:
        rec = self.repo.get_recommendation(rec_id)
        if rec is None and len(rec_id) >= 4:
            matches = [r for r in self.repo.recommendations(limit=200) if r.id.startswith(rec_id)]
            rec = matches[0] if len(matches) == 1 else None
        return rec

    def mark_executed(self, rec_id: str, price: Any = None, qty: Any = None) -> str:
        rec = self._find_rec(rec_id)
        if rec is None:
            return "No encontré esa recomendación."
        done = self.broker.mark_executed(
            rec.id, float(price) if price else None, float(qty) if qty else None
        )
        if done is None:
            return "Esa recomendación ya no está pendiente."
        coin = base_asset(done.symbol)
        return (
            f"✅ Registrado: {done.action} {coin} a {done.executed_price:,.6g}. "
            f"Si el precio real fue otro, envía /precio {done.id[:6]} <precio>."
        )

    def mark_skipped(self, rec_id: str) -> str:
        rec = self._find_rec(rec_id)
        if rec is None or self.broker.mark_skipped(rec.id) is None:
            return "Esa recomendación ya no está pendiente."
        return "Anotado: no la ejecutaste (igual se medirá en el track record)."

    def set_price(self, rec_id: str, price: str, qty: str | None = None) -> str:
        rec = self._find_rec(rec_id)
        if rec is None:
            return "No encontré esa recomendación."
        if rec.status == RecStatus.PENDING:
            return self.mark_executed(rec.id, price, qty)
        if rec.status == RecStatus.EXECUTED and rec.action == Action.BUY.value:
            h = self.repo.holdings().get(rec.symbol)
            if h is None:
                return "Ya no tienes esa posición."
            new_px = float(price)
            new_qty = float(qty) if qty else h.qty
            fee = self.broker.cost_frac(rec, +1)
            new_cost = new_qty * new_px * (1 + fee)
            state = self.repo.get_state()
            self.repo.save_state(
                {**state, "cash_usd": float(state.get("cash_usd", 0)) + h.cost_usd - new_cost}
            )
            ratio = new_px / h.avg_price
            h.avg_price, h.qty, h.cost_usd = new_px, new_qty, new_cost
            h.stop_price = h.stop_price * ratio if h.stop_price else None
            h.target_price = h.target_price * ratio if h.target_price else None
            self.repo.save_holding(h)
            rec.executed_price, rec.executed_qty = new_px, new_qty
            self.repo.save_recommendation(rec)
            return f"✅ Corregido: {base_asset(rec.symbol)} a {new_px:,.6g} (stop y objetivo ajustados)."
        return "Solo se puede corregir una compra ejecutada o una recomendación pendiente."

    def set_capital(self, capital: Any) -> str:
        value = float(capital)
        if not 1 <= value <= 10_000_000:
            return "Capital inválido."
        self.broker.set_capital(value)
        self.cfg = load_config(self.repo, self.settings)
        self.cfg.capital_usd = value
        self._save_cfg()
        return f"Capital actualizado a {value:,.2f} USD."

    def set_holding(self, payload: dict[str, Any]) -> str:
        from cryptobot.recommend.models import Holding

        sym = payload["symbol"].upper()
        qty, px = float(payload["qty"]), float(payload["avg_price"])
        old = self.repo.holdings().get(sym)
        sig = self.bundle.params
        h = Holding(
            symbol=sym,
            qty=qty,
            avg_price=px,
            cost_usd=qty * px,
            opened_at=payload.get("opened_at") or iso(utcnow()),
            stop_price=payload.get("stop_price") or (old.stop_price if old else None),
            target_price=payload.get("target_price") or (old.target_price if old else None),
            horizon_end=old.horizon_end
            if old
            else iso(utcnow() + pd.Timedelta(days=sig.horizon_days)),
            source="manual",
        )
        self.repo.save_holding(h)
        return f"Cartera actualizada: {qty:g} {base_asset(sym)} a {px:,.6g}."

    def update_config(self, payload: dict[str, Any]) -> str:
        cfg = load_config(self.repo, self.settings)
        if "watchlist" in payload:
            wl = [s.strip().upper() for s in payload["watchlist"] if s.strip()]
            if not wl or not all(s.isalnum() and s.endswith(("USDT", "USDC")) for s in wl):
                raise ValueError("lista de criptos inválida (ej.: BTCUSDT, ETHUSDT)")
            cfg.watchlist = wl[:20]
        if "cost_profile" in payload:
            if payload["cost_profile"] not in COST_PROFILES:
                raise ValueError("perfil de costos inválido")
            cfg.cost_profile = payload["cost_profile"]
        if "mode" in payload:
            mode = payload["mode"]
            if mode not in [m.value for m in Mode]:
                raise ValueError("modo inválido")
            if mode in (Mode.SEMI_AUTO_API.value, Mode.AUTO_API.value):
                if not self.settings.enable_live_api:
                    raise ValueError(
                        "el modo API está desactivado en el servidor (CRYPTOBOT_ENABLE_LIVE_API)"
                    )
                if payload.get("confirm") != API_CONFIRMATION:
                    raise ValueError(
                        f"para activar el modo API escribe exactamente: {API_CONFIRMATION}"
                    )
            cfg.mode = mode
        if "risk" in payload:
            changes = {}
            for k, v in payload["risk"].items():
                if k in RISK_BOUNDS:
                    lo, hi = RISK_BOUNDS[k]
                    if not lo <= float(v) <= hi:
                        raise ValueError(f"{k} fuera de rango [{lo}, {hi}]")
                    changes[k] = int(v) if k == "max_trades_per_week" else float(v)
            cfg.limits = replace(cfg.limits, **changes)
        if "summary_hour_utc" in payload:
            cfg.summary_hour_utc = int(payload["summary_hour_utc"]) % 24
        self.repo.save_config(cfg.to_row())
        self.repo.log_event("info", "config", "configuración actualizada", data=payload)
        self.cfg = cfg
        return "Configuración actualizada (se aplica en el próximo ciclo)."

    # ------------------------------------------------------------ resúmenes
    def status_text(self, *_: Any) -> str:
        last = self.repo.last_cycles(1)
        lines = []
        if last:
            c = last[0]
            lines.append(f"Último ciclo: {c['id'][:16]} UTC · modo {c.get('mode')}")
            for sym, s in (c.get("symbols") or {}).items():
                if "error" in s:
                    lines.append(f"• {base_asset(sym)}: {s['error']}")
                    continue
                lines.append(
                    f"• {base_asset(sym)}: {s.get('close', 0):,.6g} · régimen {s.get('regime')} · {s.get('action')}"
                )
            if c.get("defensive"):
                lines.append(f"⚠️ {c['defensive']}")
        pend = self.repo.pending()
        lines.append(f"Recomendaciones pendientes: {len(pend)}")
        lines += [f"  - {r.action} {base_asset(r.symbol)} (id {r.id[:6]})" for r in pend[:5]]
        lines.append(self.holdings_text())
        return "\n".join(lines)

    def holdings_text(self, *_: Any) -> str:
        holds = self.repo.holdings()
        state = self.repo.get_state()
        if not holds:
            return f"Cartera: todo en USDT ({float(state.get('cash_usd', 0)):,.2f} USD)."
        lines = ["Cartera:"]
        now = utcnow()
        for sym, h in holds.items():
            px = self.market.last_price(sym, now) or h.avg_price
            pnl = px / h.avg_price - 1
            lines.append(
                f"• {h.qty:.6g} {base_asset(sym)} a {h.avg_price:,.6g} → {px:,.6g} ({pnl:+.1%}) · stop {h.stop_price or 0:,.6g}"
            )
        lines.append(f"USDT libre: {float(state.get('cash_usd', 0)):,.2f}")
        return "\n".join(lines)

    def daily_summary(self) -> str:
        stats = track_record(self.repo.recommendations())
        text = "📊 Resumen diario\n" + self.status_text()
        if stats.get("cerradas"):
            text += (
                f"\nTrack record: {stats['cerradas']} cerradas · aciertos {stats['aciertos']:.0%} · "
                f"si las seguías: {stats['retorno_seguido']:+.1%}"
            )
        if not self.bundle.approved:
            text += "\n⚠️ Modelo no aprobado por la puerta de calidad: modo práctica."
        self.notifier.notify(text)
        return text

    def telegram_handlers(self) -> dict[str, Any]:
        def api_execute(rec_id: str) -> str:
            from cryptobot.execution.ccxt_broker import CcxtBroker

            if not isinstance(self.broker, CcxtBroker):
                return "El modo API no está activo."
            rec = self._find_rec(rec_id)
            if rec is None:
                return "No encontré esa recomendación."
            done = self.broker.execute(rec)
            return "⚡ Ejecutada vía API." if done else "No se pudo ejecutar."

        return {
            "mark_executed": self.mark_executed,
            "mark_skipped": self.mark_skipped,
            "api_execute": api_execute,
            "status": self.status_text,
            "holdings": self.holdings_text,
            "pause": self.pause,
            "resume": self.resume,
            "set_price": self.set_price,
            "set_capital": self.set_capital,
            "kill": lambda *_: self.kill(),
        }


def regime_label(value: str | None) -> str:
    return {
        Regime.BULL.value: "alcista",
        Regime.RANGE.value: "lateral",
        Regime.STRESS.value: "estrés",
    }.get(value or "", "—")
