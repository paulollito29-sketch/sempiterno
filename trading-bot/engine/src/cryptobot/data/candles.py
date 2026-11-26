"""Construcción de barras de 20 minutos (y diarias) a partir de velas de 5 minutos.

Binance no ofrece velas de 20m: se arman agregando 4 velas de 5m alineadas a :00/:20/:40 UTC.
Solo se usan barras COMPLETAS y CERRADAS para evitar mirar el futuro.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from cryptobot.config import BAR_MINUTES
from cryptobot.data.schema import OHLCV_COLUMNS, normalize_bars
from cryptobot.timeutils import last_closed_bar_open

_AGG = {
    "open": "first",
    "high": "max",
    "low": "min",
    "close": "last",
    "volume": "sum",
    "quote_volume": "sum",
    "trades": "sum",
    "taker_buy_base": "sum",
    "taker_buy_quote": "sum",
}


def resample_bars(
    bars: pd.DataFrame,
    minutes: int = BAR_MINUTES,
    base_minutes: int = 5,
    require_complete: bool = True,
) -> pd.DataFrame:
    """Agrega velas de `base_minutes` a barras de `minutes` (etiqueta = apertura)."""
    bars = normalize_bars(bars)
    if bars.empty:
        return bars
    rule = f"{minutes}min"
    rs = bars.resample(rule, label="left", closed="left")
    out = rs.agg(_AGG)
    counts = rs["close"].count()
    # Columnas de flujo: si no hay ningún dato, NaN (no 0).
    for col in ("taker_buy_base", "taker_buy_quote", "quote_volume", "trades"):
        n_valid = rs[col].count()
        out.loc[n_valid == 0, col] = np.nan
    expected = max(1, minutes // base_minutes)
    mask = counts == expected if require_complete else counts > 0
    out = out[mask]
    return out[OHLCV_COLUMNS].astype("float64")


def closed_bars(bars: pd.DataFrame, now: pd.Timestamp, minutes: int = BAR_MINUTES) -> pd.DataFrame:
    """Solo barras ya cerradas a la hora `now`."""
    if bars.empty:
        return bars
    return bars[bars.index <= last_closed_bar_open(now, minutes)]


def fill_small_gaps(
    bars: pd.DataFrame, minutes: int = BAR_MINUTES, max_gap_bars: int = 6
) -> pd.DataFrame:
    """Reindexa a una grilla completa y rellena huecos cortos con barras planas (volumen 0).

    Huecos mayores a `max_gap_bars` quedan como NaN: las features que los cubran serán NaN
    y el sistema no emitirá señales con datos incompletos.
    """
    if bars.empty:
        return bars
    grid = pd.date_range(bars.index[0], bars.index[-1], freq=f"{minutes}min", tz="UTC", name="ts")
    out = bars.reindex(grid)
    missing = out["close"].isna()
    if not missing.any():
        return out
    # Largo de cada racha de faltantes
    run_id = (~missing).cumsum()
    run_len = missing.groupby(run_id).transform("sum")
    fillable = missing & (run_len <= max_gap_bars)
    prev_close = out["close"].ffill()
    for col in ("open", "high", "low", "close"):
        out.loc[fillable, col] = prev_close[fillable]
    for col in ("volume", "quote_volume", "trades", "taker_buy_base", "taker_buy_quote"):
        out.loc[fillable, col] = 0.0
    return out


def to_daily(bars: pd.DataFrame) -> pd.DataFrame:
    """Barras diarias (00:00 UTC) a partir de barras intradía; solo días con datos."""
    if bars.empty:
        return bars
    rs = bars.resample("1D", label="left", closed="left")
    out = rs.agg(_AGG)
    out = out[rs["close"].count() > 0]
    return out[OHLCV_COLUMNS].astype("float64")


def prepare_bars_20m(bars_5m: pd.DataFrame) -> pd.DataFrame:
    """Pipeline estándar: 5m -> 20m completas -> grilla con huecos cortos rellenados."""
    return fill_small_gaps(resample_bars(bars_5m, BAR_MINUTES, base_minutes=5))
