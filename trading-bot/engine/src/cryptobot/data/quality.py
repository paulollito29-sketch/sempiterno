"""Control de calidad de datos: nunca decidir con datos rotos o viejos."""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd


@dataclass
class QualityReport:
    rows: int = 0
    start: str | None = None
    end: str | None = None
    duplicates: int = 0
    non_monotonic: bool = False
    gaps: list[tuple[str, str, int]] = field(default_factory=list)
    missing_bars: int = 0
    ohlc_violations: int = 0
    negative_values: int = 0
    nan_prices: int = 0
    outliers: int = 0
    stale_minutes: float | None = None
    issues: list[str] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.issues


def check_bars(
    df: pd.DataFrame,
    timeframe_minutes: int,
    now: pd.Timestamp | None = None,
    max_stale_minutes: float | None = None,
    outlier_mad: float = 15.0,
    max_missing_ratio: float = 0.02,
) -> QualityReport:
    rep = QualityReport(rows=len(df))
    if df.empty:
        rep.issues.append("sin datos")
        return rep
    idx = df.index
    rep.start, rep.end = str(idx[0]), str(idx[-1])
    rep.duplicates = int(idx.duplicated().sum())
    rep.non_monotonic = not idx.is_monotonic_increasing
    if rep.duplicates:
        rep.issues.append(f"{rep.duplicates} timestamps duplicados")
    if rep.non_monotonic:
        rep.issues.append("timestamps desordenados")

    step = pd.Timedelta(minutes=timeframe_minutes)
    diffs = pd.Series(idx[1:] - idx[:-1], index=idx[1:])
    gap_mask = diffs > step
    for ts, d in diffs[gap_mask].items():
        missing = int(d / step) - 1
        rep.missing_bars += missing
        if len(rep.gaps) < 50:
            rep.gaps.append((str(ts - d), str(ts), missing))
    expected = int((idx[-1] - idx[0]) / step) + 1
    if expected > 0 and rep.missing_bars / expected > max_missing_ratio:
        rep.issues.append(f"faltan {rep.missing_bars} velas ({rep.missing_bars / expected:.1%})")

    prices = df[["open", "high", "low", "close"]]
    rep.nan_prices = int(prices.isna().any(axis=1).sum())
    valid = prices.dropna()
    viol = (
        (valid["low"] > valid[["open", "close"]].min(axis=1) + 1e-12)
        | (valid["high"] < valid[["open", "close"]].max(axis=1) - 1e-12)
        | (valid["low"] <= 0)
    )
    rep.ohlc_violations = int(viol.sum())
    if rep.ohlc_violations:
        rep.issues.append(f"{rep.ohlc_violations} velas con OHLC inconsistente")
    rep.negative_values = int((df[["volume"]].dropna() < 0).sum().sum())
    if rep.negative_values:
        rep.issues.append("volumen negativo")

    logret = np.log(valid["close"]).diff().dropna()
    if len(logret) > 50:
        med = logret.median()
        mad = (logret - med).abs().median() * 1.4826
        if mad > 0:
            rep.outliers = int(((logret - med).abs() > outlier_mad * mad).sum())

    if now is not None:
        last_close = idx[-1] + step
        rep.stale_minutes = float((now - last_close) / pd.Timedelta(minutes=1))
        if max_stale_minutes is not None and rep.stale_minutes > max_stale_minutes:
            rep.issues.append(f"datos viejos: última vela cerró hace {rep.stale_minutes:.0f} min")
    return rep


def repair_bars(df: pd.DataFrame) -> pd.DataFrame:
    """Ordena, elimina duplicados y velas con OHLC imposible."""
    if df.empty:
        return df
    out = df[~df.index.duplicated(keep="last")].sort_index()
    p = out[["open", "high", "low", "close"]]
    bad = (p["low"] <= 0) | (p["high"] < p["low"])
    return out[~bad]
