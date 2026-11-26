"""Utilidades de tiempo. Todo el sistema trabaja en UTC."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pandas as pd

from cryptobot.config import BAR_MINUTES

BAR = pd.Timedelta(minutes=BAR_MINUTES)
CYCLE_OFFSET_SECONDS = 5  # el ciclo corre 5 s después del cierre de la vela


def utcnow() -> pd.Timestamp:
    return pd.Timestamp(datetime.now(UTC))


def to_utc(ts: datetime | pd.Timestamp | str | int | float) -> pd.Timestamp:
    """Convierte a Timestamp con zona UTC (enteros/flotantes = milisegundos epoch)."""
    if isinstance(ts, int | float):
        return pd.Timestamp(int(ts), unit="ms", tz="UTC")
    t = pd.Timestamp(ts)
    return t.tz_localize("UTC") if t.tzinfo is None else t.tz_convert("UTC")


def floor_bar(ts: pd.Timestamp, minutes: int = BAR_MINUTES) -> pd.Timestamp:
    return to_utc(ts).floor(f"{minutes}min")


def last_closed_bar_open(now: pd.Timestamp, minutes: int = BAR_MINUTES) -> pd.Timestamp:
    """Apertura de la última barra cerrada a la hora `now`.

    Una barra con apertura 12:00 cubre [12:00, 12:20) y está cerrada a partir de las 12:20.
    """
    return floor_bar(now, minutes) - pd.Timedelta(minutes=minutes)


def next_cycle_time(now: pd.Timestamp) -> pd.Timestamp:
    """Próxima ejecución del ciclo (:00:05, :20:05, :40:05 UTC)."""
    now = to_utc(now)
    candidate = floor_bar(now) + pd.Timedelta(seconds=CYCLE_OFFSET_SECONDS)
    if candidate <= now:
        candidate += BAR
    return candidate


def iso(ts: pd.Timestamp | datetime | None) -> str | None:
    if ts is None:
        return None
    return to_utc(ts).isoformat()


def days(n: float) -> timedelta:
    return timedelta(days=n)
