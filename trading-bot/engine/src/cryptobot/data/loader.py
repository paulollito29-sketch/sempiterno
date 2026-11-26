"""Carga de datos guardados listos para el motor (barras de 20m + funding + Fear & Greed)."""

from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

from cryptobot.data.candles import prepare_bars_20m
from cryptobot.data.store import ParquetStore


@dataclass
class SymbolInputs:
    symbol: str
    bars_20m: pd.DataFrame
    funding: pd.DataFrame | None
    fng: pd.DataFrame | None


def load_inputs(
    store: ParquetStore,
    symbol: str,
    start: pd.Timestamp | None = None,
    end: pd.Timestamp | None = None,
) -> SymbolInputs:
    bars_5m = store.read_bars(symbol, "5m", start=start, end=end)
    bars_20m = prepare_bars_20m(bars_5m)
    funding = store.read_series("funding", symbol)
    fng = store.read_series("fng")
    return SymbolInputs(symbol, bars_20m, funding, fng)
