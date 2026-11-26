"""Régimen por reglas (respaldo del HMM) y alertas superpuestas (euforia, eventos macro)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd

from cryptobot.config import Regime, StrategyParams
from cryptobot.regime.hmm import STATE_COLUMNS, regime_label

MACRO_EVENTS_FILE = Path(__file__).with_name("macro_events.csv")


def rule_regime_probs(features: pd.DataFrame) -> pd.DataFrame:
    """Régimen determinista (sin ajuste) a partir de tendencia y volatilidad."""
    mom30 = features["mom_z_30d"]
    mom7 = features["mom_z_7d"]
    volz = features["vol_z_1y"].fillna(0.0)
    stress = ((volz > 1.5) & (mom7 < 0)) | (mom30 < -1.0)
    bull = (~stress) & (mom30 > 0.5) & (features["px_sma_30d"] > 0)
    out = pd.DataFrame(0.0, index=features.index, columns=STATE_COLUMNS)
    out.loc[bull, "p_bull"] = 1.0
    out.loc[stress, "p_stress"] = 1.0
    out.loc[~bull & ~stress, "p_range"] = 1.0
    out.loc[mom30.isna()] = np.nan
    return out


def combine_regimes(hmm_probs: pd.DataFrame | None, features: pd.DataFrame) -> pd.DataFrame:
    """Usa el HMM cuando hay probabilidades; si no, las reglas."""
    rules = rule_regime_probs(features)
    if hmm_probs is None or hmm_probs.empty:
        probs = rules
    else:
        probs = hmm_probs.reindex(features.index)
        missing = probs.isna().any(axis=1)
        probs.loc[missing] = rules.loc[missing]
    labels = [
        regime_label(b, r, s) if not np.isnan([b, r, s]).any() else None
        for b, r, s in probs[STATE_COLUMNS].to_numpy()
    ]
    probs = probs.copy()
    probs["regime"] = pd.Series(
        [lb.value if lb else None for lb in labels], index=probs.index, dtype="object"
    )
    return probs


def load_macro_events(path: Path | None = None) -> pd.DatetimeIndex:
    path = path or MACRO_EVENTS_FILE
    if not path.exists():
        return pd.DatetimeIndex([], tz="UTC")
    df = pd.read_csv(path, comment="#")
    if df.empty:
        return pd.DatetimeIndex([], tz="UTC")
    return pd.DatetimeIndex(pd.to_datetime(df["datetime_utc"], utc=True)).sort_values()


def macro_event_mask(
    index: pd.DatetimeIndex, events: pd.DatetimeIndex, before_h: float = 12, after_h: float = 6
) -> np.ndarray:
    """True si la barra cae dentro de [evento - before_h, evento + after_h]."""
    if len(events) == 0 or len(index) == 0:
        return np.zeros(len(index), dtype=bool)
    ev = events.as_unit("ns").asi8
    t = index.as_unit("ns").asi8
    pos = np.searchsorted(ev, t)
    before = int(before_h * 3600 * 1e9)
    after = int(after_h * 3600 * 1e9)
    has_next = pos < len(ev)
    has_prev = pos > 0
    nxt = ev[np.clip(pos, 0, len(ev) - 1)]
    prv = ev[np.clip(pos - 1, 0, len(ev) - 1)]
    near_next = has_next & ((nxt - t) <= before)
    near_prev = has_prev & ((t - prv) <= after)
    return near_next | near_prev


def overlays(
    features: pd.DataFrame, params: StrategyParams, events: pd.DatetimeIndex | None = None
) -> pd.DataFrame:
    fz = features.get("funding_z_30d")
    fng = features.get("fng")
    euphoria = np.zeros(len(features), dtype=bool)
    if fz is not None:
        euphoria |= (fz > params.euphoria_funding_z).fillna(False).to_numpy()
    if fng is not None:
        euphoria |= (fng >= params.euphoria_fng).fillna(False).to_numpy()
    macro = macro_event_mask(features.index, events if events is not None else load_macro_events())
    return pd.DataFrame({"euphoria": euphoria, "macro_event": macro}, index=features.index)


def regime_from_row(row: pd.Series) -> Regime | None:
    val = row.get("regime")
    return Regime(val) if isinstance(val, str) and val else None
