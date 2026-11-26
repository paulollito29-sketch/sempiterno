"""Interfaz de persistencia genérica + repositorio con operaciones de negocio.

Las tablas (y sus claves) coinciden con supabase/schema.sql, que lee el panel web.
"""

from __future__ import annotations

from typing import Any, Protocol

import pandas as pd

from cryptobot.recommend.models import ClosedTrade, Holding, Recommendation, RecStatus
from cryptobot.timeutils import iso

# tabla -> columna(s) clave
TABLE_KEYS: dict[str, str] = {
    "bot_config": "id",
    "bot_state": "id",
    "bot_commands": "id",
    "cycles": "id",
    "recommendations": "id",
    "holdings": "symbol",
    "trades": "id",
    "equity_snapshots": "ts",
    "market_bars": "id",
    "events": "id",
    "heartbeats": "component",
    "backtests": "id",
    "models": "version",
}


class Store(Protocol):
    def upsert(self, table: str, rows: list[dict[str, Any]]) -> None: ...

    def select(
        self,
        table: str,
        where: dict[str, Any] | None = None,
        order_by: str | None = None,
        desc: bool = False,
        limit: int | None = None,
    ) -> list[dict[str, Any]]: ...

    def delete(self, table: str, where: dict[str, Any]) -> None: ...


class Repo:
    """Operaciones de alto nivel sobre cualquier Store (SQLite o Supabase)."""

    def __init__(self, store: Store):
        self.store = store

    # ---------------- configuración y estado
    def get_config(self) -> dict[str, Any]:
        rows = self.store.select("bot_config", {"id": 1})
        return rows[0] if rows else {}

    def save_config(self, cfg: dict[str, Any]) -> None:
        self.store.upsert(
            "bot_config", [{**cfg, "id": 1, "updated_at": iso(pd.Timestamp.now(tz="UTC"))}]
        )

    def get_state(self) -> dict[str, Any]:
        """Estado interno del bot (saldo, riesgo, regímenes...) en una sola columna JSON."""
        rows = self.store.select("bot_state", {"id": 1})
        return dict(rows[0].get("data") or {}) if rows else {}

    def save_state(self, state: dict[str, Any]) -> None:
        self.store.upsert(
            "bot_state", [{"id": 1, "data": state, "updated_at": iso(pd.Timestamp.now(tz="UTC"))}]
        )

    # ---------------- investigación (para el panel)
    def save_backtest(self, row: dict[str, Any]) -> None:
        self.store.upsert("backtests", [row])

    def save_model(self, row: dict[str, Any]) -> None:
        self.store.upsert("models", [row])

    # ---------------- ciclos
    def cycle_exists(self, cycle_id: str) -> bool:
        return bool(self.store.select("cycles", {"id": cycle_id}))

    def save_cycle(self, row: dict[str, Any]) -> None:
        self.store.upsert("cycles", [row])

    def last_cycles(self, n: int = 1) -> list[dict[str, Any]]:
        return self.store.select("cycles", order_by="id", desc=True, limit=n)

    # ---------------- recomendaciones
    def save_recommendation(self, rec: Recommendation) -> None:
        self.store.upsert("recommendations", [rec.to_row()])

    def get_recommendation(self, rec_id: str) -> Recommendation | None:
        rows = self.store.select("recommendations", {"id": rec_id})
        return Recommendation.from_row(rows[0]) if rows else None

    def recommendations(
        self, status: str | None = None, symbol: str | None = None, limit: int | None = None
    ) -> list[Recommendation]:
        where: dict[str, Any] = {}
        if status:
            where["status"] = status
        if symbol:
            where["symbol"] = symbol
        rows = self.store.select(
            "recommendations", where or None, order_by="created_at", desc=True, limit=limit
        )
        return [Recommendation.from_row(r) for r in rows]

    def pending(self) -> list[Recommendation]:
        return self.recommendations(status=RecStatus.PENDING)

    # ---------------- cartera
    def holdings(self) -> dict[str, Holding]:
        return {
            r["symbol"]: Holding.from_row(r)
            for r in self.store.select("holdings")
            if r.get("qty", 0) > 0
        }

    def save_holding(self, h: Holding) -> None:
        h.updated_at = iso(pd.Timestamp.now(tz="UTC"))
        self.store.upsert("holdings", [h.to_row()])

    def remove_holding(self, symbol: str) -> None:
        self.store.delete("holdings", {"symbol": symbol})

    def save_trade(self, t: ClosedTrade) -> None:
        self.store.upsert("trades", [t.to_row()])

    def trades(self) -> list[dict[str, Any]]:
        return self.store.select("trades", order_by="closed_at", desc=True)

    # ---------------- otros
    def save_equity(
        self,
        ts: pd.Timestamp,
        equity: float,
        cash: float,
        exposure: float,
        drawdown: float,
        mode: str,
    ) -> None:
        self.store.upsert(
            "equity_snapshots",
            [
                {
                    "ts": iso(ts),
                    "equity": equity,
                    "cash": cash,
                    "exposure": exposure,
                    "drawdown": drawdown,
                    "mode": mode,
                }
            ],
        )

    def log_event(
        self,
        level: str,
        kind: str,
        message: str,
        symbol: str | None = None,
        data: dict | None = None,
    ) -> None:
        from cryptobot.recommend.models import new_id

        self.store.upsert(
            "events",
            [
                {
                    "id": new_id(),
                    "ts": iso(pd.Timestamp.now(tz="UTC")),
                    "level": level,
                    "kind": kind,
                    "symbol": symbol,
                    "message": message,
                    "data": data or {},
                }
            ],
        )

    def heartbeat(self, component: str, info: dict | None = None) -> None:
        self.store.upsert(
            "heartbeats",
            [{"component": component, "ts": iso(pd.Timestamp.now(tz="UTC")), "info": info or {}}],
        )

    def pending_commands(self) -> list[dict[str, Any]]:
        rows = self.store.select("bot_commands", {"status": "pending"}, order_by="created_at")
        return rows

    def finish_command(self, row: dict[str, Any], status: str, result: str = "") -> None:
        self.store.upsert(
            "bot_commands",
            [
                {
                    **row,
                    "status": status,
                    "result": result,
                    "processed_at": iso(pd.Timestamp.now(tz="UTC")),
                }
            ],
        )

    def add_command(self, command: str, payload: dict | None = None) -> str:
        from cryptobot.recommend.models import new_id

        cid = new_id()
        self.store.upsert(
            "bot_commands",
            [
                {
                    "id": cid,
                    "created_at": iso(pd.Timestamp.now(tz="UTC")),
                    "command": command,
                    "payload": payload or {},
                    "status": "pending",
                }
            ],
        )
        return cid

    def save_market_bars(self, symbol: str, rows: list[dict[str, Any]]) -> None:
        for r in rows:
            r["id"] = f"{symbol}|{r['ts']}"
            r["symbol"] = symbol
        if rows:
            self.store.upsert("market_bars", rows)
