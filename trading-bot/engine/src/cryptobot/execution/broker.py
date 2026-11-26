"""Brokers: cómo se ejecutan las recomendaciones.

- ManualBroker (Lemon): el bot recomienda; tú ejecutas en la app y confirmas con "La ejecuté".
- PaperBroker: ejecuta en simulación al recibir la recomendación (para medir el track record).
- CcxtBroker (execution/ccxt_broker.py): ejecuta vía API en un exchange (desactivado por defecto).

ManualBroker y PaperBroker comparten la contabilidad (saldo en USD + cartera).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from cryptobot.config import Action, CostProfile
from cryptobot.persistence.base import Repo
from cryptobot.recommend.models import ClosedTrade, Holding, Recommendation, RecStatus
from cryptobot.strategy.decision import PositionView
from cryptobot.timeutils import iso, to_utc


@dataclass
class PortfolioSnapshot:
    equity: float
    cash: float
    positions: dict[str, PositionView] = field(default_factory=dict)
    exposure_value: float = 0.0
    values: dict[str, float] = field(default_factory=dict)


class LedgerBroker:
    """Contabilidad local: saldo en USD (en bot_state) + holdings."""

    mode = "manual"

    def __init__(self, repo: Repo, costs: CostProfile, capital_usd: float):
        self.repo = repo
        self.costs = costs
        state = repo.get_state()
        if "cash_usd" not in state:
            repo.save_state({**state, "cash_usd": capital_usd, "capital_usd": capital_usd})

    # ---------------- saldo
    @property
    def cash(self) -> float:
        return float(self.repo.get_state().get("cash_usd", 0.0))

    def _set_cash(self, value: float) -> None:
        state = self.repo.get_state()
        self.repo.save_state({**state, "cash_usd": value})

    def set_capital(self, capital_usd: float) -> None:
        """Cambia el capital dedicado al bot (ajusta el saldo libre por la diferencia)."""
        state = self.repo.get_state()
        delta = capital_usd - float(state.get("capital_usd", capital_usd))
        self.repo.save_state(
            {
                **state,
                "capital_usd": capital_usd,
                "cash_usd": float(state.get("cash_usd", 0.0)) + delta,
            }
        )

    def portfolio(self, prices: dict[str, float]) -> PortfolioSnapshot:
        holdings = self.repo.holdings()
        cash = self.cash
        positions, values = {}, {}
        for sym, h in holdings.items():
            px = prices.get(sym, h.avg_price)
            values[sym] = h.qty * px
            positions[sym] = PositionView(
                symbol=sym,
                qty=h.qty,
                entry_price=h.avg_price,
                entry_time=to_utc(h.opened_at),
                stop=h.stop_price or 0.0,
                target=h.target_price or float("inf"),
                horizon_end=to_utc(h.horizon_end)
                if h.horizon_end
                else to_utc(h.opened_at) + pd.Timedelta(days=3650),
                reduced=h.reduced,
            )
        exposure = sum(values.values())
        return PortfolioSnapshot(cash + exposure, cash, positions, exposure, values)

    # ---------------- ejecuciones
    def cost_frac(self, rec: Recommendation, side: int) -> float:
        """Costo por lado aplicado al precio que informas. En Lemon el precio que ves ya
        incluye su spread: solo se descuenta la comisión explícita."""
        return self.costs.fee

    def _buy(
        self, rec: Recommendation, raw_price: float, qty: float | None, when: pd.Timestamp
    ) -> Holding:
        fee = self.cost_frac(rec, +1)
        if qty is None:
            qty = (rec.size_usd or 0.0) / (raw_price * (1 + fee))
        cost = qty * raw_price * (1 + fee)
        stop = raw_price * (1 + rec.stop_pct) if rec.stop_pct is not None else rec.stop_price
        target = (
            raw_price * (1 + rec.target_pct) if rec.target_pct is not None else rec.target_price
        )
        existing = self.repo.holdings().get(rec.symbol)
        if existing:  # promedia si ya tenías
            total = existing.qty + qty
            existing.avg_price = (existing.avg_price * existing.qty + raw_price * qty) / total
            existing.qty = total
            existing.cost_usd += cost
            h = existing
        else:
            h = Holding(
                symbol=rec.symbol,
                qty=qty,
                avg_price=raw_price,
                cost_usd=cost,
                opened_at=iso(when),
                stop_price=stop,
                target_price=target,
                horizon_end=rec.horizon_end,
                rec_id=rec.id,
                source=self.mode,
            )
        self.repo.save_holding(h)
        self._set_cash(self.cash - cost)
        return h

    def _sell(
        self,
        rec: Recommendation,
        raw_price: float,
        qty: float | None,
        when: pd.Timestamp,
        stop_exit: bool = False,
    ) -> ClosedTrade | None:
        h = self.repo.holdings().get(rec.symbol)
        if h is None:
            return None
        qty = min(qty if qty is not None else (rec.qty or h.qty), h.qty)
        proceeds = qty * raw_price * (1 - self.cost_frac(rec, -1))
        cost_part = h.cost_usd * (qty / h.qty)
        trade = ClosedTrade(
            symbol=rec.symbol,
            opened_at=h.opened_at,
            closed_at=iso(when),
            qty=qty,
            entry_price=h.avg_price,
            exit_price=raw_price,
            pnl_usd=proceeds - cost_part,
            pnl_pct=proceeds / cost_part - 1 if cost_part > 0 else 0.0,
            reason=rec.reason_code,
            mode=self.mode,
            rec_open=h.rec_id,
            rec_close=rec.id,
        )
        self.repo.save_trade(trade)
        remaining = h.qty - qty
        if remaining <= h.qty * 1e-9:
            self.repo.remove_holding(rec.symbol)
        else:
            h.qty = remaining
            h.cost_usd -= cost_part
            if rec.action == Action.REDUCE.value:
                h.reduced = True
            self.repo.save_holding(h)
        self._set_cash(self.cash + proceeds)
        return trade

    def mark_executed(
        self,
        rec_id: str,
        price: float | None = None,
        qty: float | None = None,
        when: pd.Timestamp | None = None,
    ) -> Recommendation | None:
        rec = self.repo.get_recommendation(rec_id)
        if rec is None or rec.status not in (RecStatus.PENDING, RecStatus.EXPIRED):
            return None
        when = when or pd.Timestamp.now(tz="UTC")
        raw = float(price) if price else rec.ref_price
        if rec.action == Action.BUY.value:
            h = self._buy(rec, raw, qty, when)
            rec.executed_qty = h.qty if qty is None else qty
        elif rec.action in (Action.SELL.value, Action.REDUCE.value):
            t = self._sell(rec, raw, qty, when)
            rec.executed_qty = t.qty if t else 0.0
        rec.status = RecStatus.EXECUTED
        rec.executed_at = iso(when)
        rec.executed_price = raw
        self.repo.save_recommendation(rec)
        return rec

    def mark_skipped(self, rec_id: str) -> Recommendation | None:
        rec = self.repo.get_recommendation(rec_id)
        if rec is None or rec.status != RecStatus.PENDING:
            return None
        rec.status = RecStatus.SKIPPED
        self.repo.save_recommendation(rec)
        return rec

    def on_recommendation(self, rec: Recommendation, when: pd.Timestamp) -> None:
        """Manual: no hace nada (espera tu confirmación)."""


class ManualBroker(LedgerBroker):
    mode = "manual"


class PaperBroker(LedgerBroker):
    """Simulación: ejecuta cada recomendación al precio de referencia con los mismos costos que
    el backtest (comisión + spread + deslizamiento por lado; deslizamiento extra en stops)."""

    mode = "paper"

    def cost_frac(self, rec: Recommendation, side: int) -> float:
        extra = self.costs.stop_slippage if (side < 0 and rec.reason_code == "stop") else 0.0
        return self.costs.per_side + extra

    def on_recommendation(self, rec: Recommendation, when: pd.Timestamp) -> None:
        if rec.action not in (Action.BUY.value, Action.SELL.value, Action.REDUCE.value):
            return
        self.mark_executed(rec.id, price=rec.ref_price, when=when)
