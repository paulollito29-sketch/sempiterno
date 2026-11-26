"""Conector por API con cualquier exchange de ccxt (Fase 5). DESACTIVADO por defecto.

Para habilitarlo se requieren, a la vez:
  CRYPTOBOT_ENABLE_LIVE_API=true, modo semi_auto_api/auto_api, y claves de API con permisos de
  lectura + trading spot y RETIROS DESACTIVADOS (idealmente en una subcuenta y con lista blanca de IP).
Empieza SIEMPRE con la testnet (CRYPTOBOT_API_SANDBOX=true).

Buenas prácticas implementadas:
- clientOrderId = id de la recomendación (idempotencia: no duplica órdenes al reintentar).
- Cantidades y precios redondeados a los filtros del mercado; respeta el mínimo nocional.
- Orden límite "post-only" (maker, más barata) y, si no se llena, orden de mercado acotada.
- Stop-loss en el exchange cuando el exchange lo soporta (si el bot se cae, el stop sigue vivo).
"""

from __future__ import annotations

import time
from typing import Any

import pandas as pd

from cryptobot.config import Action, CostProfile, Settings, base_asset, quote_asset
from cryptobot.execution.broker import LedgerBroker
from cryptobot.logging_setup import get_logger
from cryptobot.persistence.base import Repo
from cryptobot.recommend.models import Recommendation, RecStatus
from cryptobot.timeutils import iso

log = get_logger(__name__)


class LiveApiDisabled(RuntimeError):
    pass


def ccxt_symbol(symbol: str) -> str:
    return f"{base_asset(symbol)}/{quote_asset(symbol)}"


class CcxtBroker(LedgerBroker):
    mode = "api"

    def __init__(
        self,
        repo: Repo,
        costs: CostProfile,
        capital_usd: float,
        settings: Settings,
        exchange: Any | None = None,
        auto: bool = False,
        maker_wait_s: float = 20.0,
    ):
        if exchange is None:
            if not settings.enable_live_api:
                raise LiveApiDisabled(
                    "El conector API está desactivado (CRYPTOBOT_ENABLE_LIVE_API=false)."
                )
            import ccxt

            klass = getattr(ccxt, settings.api_exchange)
            exchange = klass(
                {"apiKey": settings.api_key, "secret": settings.api_secret, "enableRateLimit": True}
            )
            if settings.api_sandbox:
                exchange.set_sandbox_mode(True)
        super().__init__(repo, costs, capital_usd)
        self.exchange = exchange
        self.auto = auto
        self.maker_wait_s = maker_wait_s
        self.markets = exchange.load_markets()

    # ---------------- utilidades
    def _amount(self, symbol: str, qty: float) -> float:
        return float(self.exchange.amount_to_precision(symbol, qty))

    def _price(self, symbol: str, price: float) -> float:
        return float(self.exchange.price_to_precision(symbol, price))

    def _min_ok(self, symbol: str, qty: float, price: float) -> bool:
        lim = self.markets[symbol].get("limits", {})
        min_amt = (lim.get("amount") or {}).get("min") or 0
        min_cost = (lim.get("cost") or {}).get("min") or 0
        return qty >= min_amt and qty * price >= min_cost

    def _place(self, rec: Recommendation, side: str, qty: float, ref: float) -> dict:
        sym = ccxt_symbol(rec.symbol)
        qty = self._amount(sym, qty)
        if not self._min_ok(sym, qty, ref):
            raise ValueError(f"orden por debajo del mínimo del exchange ({qty} {sym})")
        # 1) Límite post-only al mejor precio (maker)
        book = self.exchange.fetch_order_book(sym, 5)
        px = book["bids"][0][0] if side == "buy" else book["asks"][0][0]
        params = {"clientOrderId": rec.id[:32], "postOnly": True}
        try:
            order = self.exchange.create_order(
                sym, "limit", side, qty, self._price(sym, px), params
            )
            deadline = time.time() + self.maker_wait_s
            while time.time() < deadline:
                order = self.exchange.fetch_order(order["id"], sym)
                if order.get("status") == "closed":
                    return order
                time.sleep(2)
            self.exchange.cancel_order(order["id"], sym)
            filled = float(order.get("filled") or 0)
            qty = self._amount(sym, qty - filled)
        except Exception as exc:  # post-only rechazada, etc.
            log.warning(
                "orden maker no ejecutada, paso a mercado", extra={"data": {"err": str(exc)}}
            )
        # 2) Mercado por el resto
        if qty > 0 and self._min_ok(sym, qty, ref):
            return self.exchange.create_order(
                sym, "market", side, qty, None, {"clientOrderId": (rec.id + "m")[:32]}
            )
        return order

    def execute(
        self, rec: Recommendation, when: pd.Timestamp | None = None
    ) -> Recommendation | None:
        when = when or pd.Timestamp.now(tz="UTC")
        if rec.status != RecStatus.PENDING:
            return None
        if rec.action == Action.BUY.value:
            qty = (rec.size_usd or 0.0) / rec.ref_price
            order = self._place(rec, "buy", qty, rec.ref_price)
        elif rec.action in (Action.SELL.value, Action.REDUCE.value):
            h = self.repo.holdings().get(rec.symbol)
            if h is None:
                return None
            order = self._place(rec, "sell", rec.qty or h.qty, rec.ref_price)
        else:
            return None
        avg = float(order.get("average") or order.get("price") or rec.ref_price)
        filled = float(order.get("filled") or 0) or None
        done = self.mark_executed(rec.id, price=avg, qty=filled, when=when)
        if done and rec.action == Action.BUY.value and rec.stop_pct is not None:
            self._place_stop(rec.symbol, avg * (1 + rec.stop_pct))
        return done

    def _place_stop(self, symbol: str, stop: float) -> None:
        sym = ccxt_symbol(symbol)
        h = self.repo.holdings().get(symbol)
        if h is None:
            return
        try:
            self.exchange.create_order(
                sym,
                "stop_loss_limit",
                "sell",
                self._amount(sym, h.qty),
                self._price(sym, stop * 0.995),
                {"stopPrice": self._price(sym, stop)},
            )
        except Exception as exc:
            log.warning(
                "el exchange no aceptó el stop; queda el vigilante de precios",
                extra={"data": {"err": str(exc)}},
            )

    def on_recommendation(self, rec: Recommendation, when: pd.Timestamp) -> None:
        if self.auto:
            self.execute(rec, when)

    def reconcile(self) -> dict[str, float]:
        """Compara saldos del exchange con la cartera registrada (devuelve diferencias)."""
        bal = self.exchange.fetch_balance()
        diffs = {}
        for sym, h in self.repo.holdings().items():
            real = float((bal.get("total") or {}).get(base_asset(sym), 0.0))
            if abs(real - h.qty) > max(1e-8, 0.01 * h.qty):
                diffs[sym] = real - h.qty
        if diffs:
            self.repo.log_event(
                "warning",
                "reconcile",
                f"diferencias con el exchange: {diffs}",
                data={"diffs": diffs, "ts": iso(pd.Timestamp.now(tz="UTC"))},
            )
        return diffs
