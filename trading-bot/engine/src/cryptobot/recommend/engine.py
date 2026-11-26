"""De decisiones a recomendaciones: sin repetir, sin "parpadear" y con vencimiento."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from cryptobot.config import Action, Regime
from cryptobot.notify.formatter import format_alert, format_recommendation
from cryptobot.persistence.base import Repo
from cryptobot.recommend.models import Holding, Recommendation, RecStatus
from cryptobot.strategy.decision import Decision
from cryptobot.strategy.explain import REGIME_TEXT
from cryptobot.timeutils import iso, to_utc

ACTIONABLE = (Action.BUY.value, Action.SELL.value, Action.REDUCE.value)


@dataclass
class RecSettings:
    expiry_minutes: int = 60
    entry_tolerance: float = 0.005  # comprar solo si el precio no subió más de 0.5%
    repeat_after_hours: float = 4.0  # recordar una venta no ejecutada como máximo cada 4 h


class RecommendationEngine:
    def __init__(
        self,
        repo: Repo,
        mode: str,
        model_version: str | None,
        approved: bool,
        settings: RecSettings | None = None,
        venue: str = "Lemon",
    ):
        self.repo = repo
        self.mode = mode
        self.model_version = model_version
        self.approved = approved
        self.s = settings or RecSettings()
        self.venue = venue

    # ------------------------------------------------------------ vencimiento
    def expire(self, now: pd.Timestamp) -> list[Recommendation]:
        out = []
        for rec in self.repo.pending():
            if rec.expires_at and to_utc(rec.expires_at) <= now:
                rec.status = RecStatus.EXPIRED
                self.repo.save_recommendation(rec)
                out.append(rec)
        return out

    # ------------------------------------------------------------ creación
    def _base(self, d: Decision, now: pd.Timestamp) -> Recommendation:
        return Recommendation(
            symbol=d.symbol,
            action=d.action.value,
            cycle_ts=iso(d.time),
            ref_price=d.ref_price,
            created_at=iso(now),
            mode=self.mode,
            probability=d.prob,
            threshold=d.threshold,
            base_rate=d.base_rate,
            expected_return=d.expected_return,
            sigma_d=d.sigma_d,
            regime=d.regime.value if d.regime else None,
            reason_code=d.reason_code,
            reasons=list(d.reasons),
            expires_at=iso(now + pd.Timedelta(minutes=self.s.expiry_minutes)),
            model_version=self.model_version,
            approved_model=self.approved,
        )

    def _recent_exit_rec(self, symbol: str, now: pd.Timestamp) -> bool:
        for rec in self.repo.recommendations(symbol=symbol, limit=20):
            if rec.action in (Action.SELL.value, Action.REDUCE.value):
                if rec.status == RecStatus.PENDING:
                    return True
                if (
                    to_utc(rec.created_at) > now - pd.Timedelta(hours=self.s.repeat_after_hours)
                    and rec.status != RecStatus.EXECUTED
                ):
                    return True
        return False

    def from_decisions(
        self,
        decisions: list[Decision],
        holdings: dict[str, Holding],
        equity: float,
        now: pd.Timestamp,
        regime_changes: dict[str, tuple[str, str]] | None = None,
    ) -> list[Recommendation]:
        """`regime_changes`: {cripto: (régimen anterior, régimen nuevo)} ya confirmados por la app."""
        regime_changes = regime_changes or {}
        pending = self.repo.pending()
        new: list[Recommendation] = []
        for d in decisions:
            sym = d.symbol
            if d.action == Action.BUY:
                if sym in holdings or any(
                    p.symbol == sym and p.action == Action.BUY.value for p in pending
                ):
                    continue
                rec = self._base(d, now)
                rec.size_frac = d.size_frac
                rec.size_usd = d.size_frac * equity
                rec.entry_max_price = d.ref_price * (1 + self.s.entry_tolerance)
                rec.stop_price, rec.target_price = d.stop, d.target
                rec.stop_pct = d.stop / d.ref_price - 1 if d.stop else None
                rec.target_pct = d.target / d.ref_price - 1 if d.target else None
                rec.horizon_end = iso(d.horizon_end) if d.horizon_end is not None else None
                new.append(rec)
            elif d.action in (Action.SELL, Action.REDUCE):
                h = holdings.get(sym)
                if h is None or self._recent_exit_rec(sym, now):
                    continue
                rec = self._base(d, now)
                rec.qty = h.qty * (d.reduce_frac if d.action == Action.REDUCE else 1.0)
                new.append(rec)
            # Cambio de régimen confirmado: aviso informativo ("según cómo esté el mercado")
            if sym in regime_changes:
                regime_prev, regime_now = regime_changes[sym]
                info = self._base(d, now)
                info.status = RecStatus.INFO
                info.expires_at = None
                stress = regime_now == Regime.STRESS.value
                info.action = (
                    Action.STAY_CASH.value if stress and sym not in holdings else Action.HOLD.value
                )
                prev_txt = REGIME_TEXT.get(Regime(regime_prev), regime_prev)
                now_txt = REGIME_TEXT.get(Regime(regime_now), regime_now)
                info.reasons = [f"el régimen cambió de {prev_txt} a {now_txt}"]
                if stress:
                    info.reasons.append(
                        "prioridad: proteger el capital; no se abren compras nuevas"
                    )
                elif regime_prev == Regime.STRESS.value:
                    info.reasons.append(
                        "el mercado salió del estrés: el bot vuelve a buscar oportunidades"
                    )
                info.reason_code = "regime_change"
                new.append(info)
        for rec in new:
            rec.message = format_recommendation(rec, self.venue)
            self.repo.save_recommendation(rec)
        return new

    # ------------------------------------------------------------ alertas
    def alert_exit(self, h: Holding, kind: str, price: float, now: pd.Timestamp) -> Recommendation:
        """Stop u objetivo tocado: recomendación de venta inmediata."""
        level = h.stop_price if kind == "stop" else h.target_price
        rec = Recommendation(
            symbol=h.symbol,
            action=Action.SELL.value,
            cycle_ts=iso(now),
            ref_price=price,
            created_at=iso(now),
            mode=self.mode,
            qty=h.qty,
            reason_code=kind,
            reasons=[format_alert(h.symbol, kind, price, level or price)],
            expires_at=iso(now + pd.Timedelta(minutes=self.s.expiry_minutes)),
            model_version=self.model_version,
            approved_model=self.approved,
        )
        rec.message = format_recommendation(rec, self.venue)
        self.repo.save_recommendation(rec)
        return rec
