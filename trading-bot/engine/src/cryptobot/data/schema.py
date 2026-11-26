"""Esquema común de velas (OHLCV + flujo comprador-agresor)."""

from __future__ import annotations

import numpy as np
import pandas as pd

PRICE_COLUMNS = ["open", "high", "low", "close"]
OHLCV_COLUMNS = [
    "open",
    "high",
    "low",
    "close",
    "volume",
    "quote_volume",
    "trades",
    "taker_buy_base",
    "taker_buy_quote",
]
OPTIONAL_COLUMNS = ["quote_volume", "trades", "taker_buy_base", "taker_buy_quote"]


def empty_bars() -> pd.DataFrame:
    idx = pd.DatetimeIndex([], tz="UTC", name="ts")
    return pd.DataFrame({c: pd.Series(dtype="float64") for c in OHLCV_COLUMNS}, index=idx)


def normalize_bars(df: pd.DataFrame) -> pd.DataFrame:
    """Índice UTC ordenado y único llamado `ts`, columnas float64 en orden estándar."""
    if df is None or len(df) == 0:
        return empty_bars()
    out = df.copy()
    if not isinstance(out.index, pd.DatetimeIndex):
        if "ts" in out.columns:
            out = out.set_index("ts")
        out.index = pd.to_datetime(out.index, utc=True)
    if out.index.tz is None:
        out.index = out.index.tz_localize("UTC")
    else:
        out.index = out.index.tz_convert("UTC")
    out.index.name = "ts"
    for c in OHLCV_COLUMNS:
        if c not in out.columns:
            out[c] = np.nan
    out = out[OHLCV_COLUMNS].astype("float64")
    out = out[~out.index.duplicated(keep="last")].sort_index()
    return out
