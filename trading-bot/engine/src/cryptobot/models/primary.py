"""Señal primaria interpretable: momentum de series de tiempo + eventos CUSUM.

Candidata a compra = evento CUSUM (movimiento significativo, al alza o retroceso) cuando el
voto de tendencia multi-horizonte (signo de retornos 1d/3d/7d/30d) es >= entry_vote.
Referencias: Moskowitz, Ooi & Pedersen (2012); Liu & Tsyvinski (2021).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from cryptobot.config import StrategyParams
from cryptobot.labeling.cusum import cusum_events


def detect_events(features: pd.DataFrame, params: StrategyParams) -> pd.DataFrame:
    """Eventos CUSUM con su lado (+1 subida / -1 retroceso)."""
    logret = features["logret"].to_numpy()
    threshold = params.cusum_k * features["sigma_d"].to_numpy()
    idx, side = cusum_events(logret, threshold)
    return pd.DataFrame({"bar": idx, "side": side}, index=features.index[idx] if len(idx) else None)


def candidate_mask(features: pd.DataFrame, params: StrategyParams) -> np.ndarray:
    vote = features["trend_vote"].to_numpy()
    return np.nan_to_num(vote, nan=-9.0) >= params.entry_vote


def long_candidates(features: pd.DataFrame, params: StrategyParams) -> pd.DataFrame:
    """Eventos donde la señal primaria dice 'comprar'. Agrega `event_side` a las features."""
    ev = detect_events(features, params)
    if ev.empty:
        return ev
    ok = candidate_mask(features, params)[ev["bar"].to_numpy()]
    return ev[ok]
