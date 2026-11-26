"""Modelos de datos de la operación en vivo (se guardan igual en SQLite y en Supabase)."""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field, fields
from typing import Any

import pandas as pd

from cryptobot.timeutils import iso


class RecStatus:
    PENDING = "pendiente"  # esperando que la ejecutes
    EXECUTED = "ejecutada"
    SKIPPED = "no_ejecutada"
    EXPIRED = "vencida"
    INFO = "informativa"  # mensaje de mercado (sin acción concreta)


def new_id() -> str:
    return uuid.uuid4().hex


@dataclass
class Recommendation:
    symbol: str
    action: str  # valores de config.Action
    cycle_ts: str
    ref_price: float
    id: str = field(default_factory=new_id)
    created_at: str = field(default_factory=lambda: iso(pd.Timestamp.now(tz="UTC")))
    status: str = RecStatus.PENDING
    mode: str = "manual"
    entry_max_price: float | None = None
    size_frac: float | None = None
    size_usd: float | None = None
    qty: float | None = None
    stop_price: float | None = None
    target_price: float | None = None
    stop_pct: float | None = None
    target_pct: float | None = None
    horizon_end: str | None = None
    probability: float | None = None
    threshold: float | None = None
    base_rate: float | None = None
    expected_return: float | None = None
    sigma_d: float | None = None
    regime: str | None = None
    reason_code: str = ""
    reasons: list[str] = field(default_factory=list)
    expires_at: str | None = None
    executed_at: str | None = None
    executed_price: float | None = None
    executed_qty: float | None = None
    outcome_status: str | None = None  # abierta | cerrada (seguimiento "si la hubieras seguido")
    outcome_return: float | None = None
    outcome_reason: str | None = None
    closed_at: str | None = None
    model_version: str | None = None
    approved_model: bool = False
    message: str = ""

    def to_row(self) -> dict[str, Any]:
        return asdict(self)

    @staticmethod
    def from_row(row: dict[str, Any]) -> Recommendation:
        valid = {f.name for f in fields(Recommendation)}
        return Recommendation(**{k: v for k, v in row.items() if k in valid})


@dataclass
class Holding:
    symbol: str
    qty: float
    avg_price: float  # precio de ejecución (sin comisiones)
    cost_usd: float  # dinero que salió de tu saldo (con comisiones)
    opened_at: str
    stop_price: float | None = None
    target_price: float | None = None
    horizon_end: str | None = None
    rec_id: str | None = None
    reduced: bool = False
    stop_alerted: bool = False
    target_alerted: bool = False
    source: str = "manual"
    updated_at: str = field(default_factory=lambda: iso(pd.Timestamp.now(tz="UTC")))

    def to_row(self) -> dict[str, Any]:
        return asdict(self)

    @staticmethod
    def from_row(row: dict[str, Any]) -> Holding:
        valid = {f.name for f in fields(Holding)}
        return Holding(**{k: v for k, v in row.items() if k in valid})


@dataclass
class ClosedTrade:
    symbol: str
    opened_at: str
    closed_at: str
    qty: float
    entry_price: float
    exit_price: float
    pnl_usd: float
    pnl_pct: float
    reason: str
    mode: str
    rec_open: str | None = None
    rec_close: str | None = None
    id: str = field(default_factory=new_id)

    def to_row(self) -> dict[str, Any]:
        return asdict(self)
