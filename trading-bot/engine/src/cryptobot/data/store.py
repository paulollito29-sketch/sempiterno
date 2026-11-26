"""Almacenamiento local de datos de mercado en Parquet (escritura atómica, upsert por fecha)."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pandas as pd

from cryptobot.data.schema import normalize_bars


class ParquetStore:
    def __init__(self, root: Path | str):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    # ---------- rutas ----------
    def _bars_path(self, symbol: str, timeframe: str) -> Path:
        return self.root / "candles" / symbol.upper() / f"{timeframe}.parquet"

    def _series_path(self, name: str, symbol: str | None = None) -> Path:
        return self.root / name / f"{symbol.upper()}.parquet" if symbol else self.root / f"{name}.parquet"

    # ---------- utilidades ----------
    @staticmethod
    def _atomic_write(df: pd.DataFrame, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
        os.close(fd)
        try:
            df.to_parquet(tmp)
            os.replace(tmp, path)
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)

    @staticmethod
    def _read(path: Path) -> pd.DataFrame | None:
        if not path.exists():
            return None
        df = pd.read_parquet(path)
        if isinstance(df.index, pd.DatetimeIndex) and df.index.tz is None:
            df.index = df.index.tz_localize("UTC")
        return df

    @staticmethod
    def _upsert(old: pd.DataFrame | None, new: pd.DataFrame) -> pd.DataFrame:
        if old is None or old.empty:
            merged = new
        else:
            merged = pd.concat([old, new])
        merged = merged[~merged.index.duplicated(keep="last")].sort_index()
        return merged

    # ---------- velas ----------
    def write_bars(self, symbol: str, timeframe: str, df: pd.DataFrame) -> int:
        if df is None or df.empty:
            return 0
        path = self._bars_path(symbol, timeframe)
        merged = self._upsert(self._read(path), normalize_bars(df))
        self._atomic_write(merged, path)
        return len(merged)

    def read_bars(
        self,
        symbol: str,
        timeframe: str,
        start: pd.Timestamp | None = None,
        end: pd.Timestamp | None = None,
    ) -> pd.DataFrame:
        df = self._read(self._bars_path(symbol, timeframe))
        if df is None:
            return normalize_bars(None)
        if start is not None:
            df = df[df.index >= start]
        if end is not None:
            df = df[df.index <= end]
        return df

    def last_bar_time(self, symbol: str, timeframe: str) -> pd.Timestamp | None:
        df = self._read(self._bars_path(symbol, timeframe))
        if df is None or df.empty:
            return None
        return df.index[-1]

    def symbols(self, timeframe: str = "5m") -> list[str]:
        base = self.root / "candles"
        if not base.exists():
            return []
        return sorted(p.name for p in base.iterdir() if (p / f"{timeframe}.parquet").exists())

    # ---------- series auxiliares (funding, OI, Fear & Greed, libro) ----------
    def write_series(self, name: str, df: pd.DataFrame, symbol: str | None = None) -> int:
        if df is None or df.empty:
            return 0
        path = self._series_path(name, symbol)
        new = df.copy()
        if new.index.tz is None:
            new.index = new.index.tz_localize("UTC")
        new.index.name = "ts"
        merged = self._upsert(self._read(path), new)
        self._atomic_write(merged, path)
        return len(merged)

    def read_series(self, name: str, symbol: str | None = None) -> pd.DataFrame | None:
        return self._read(self._series_path(name, symbol))
