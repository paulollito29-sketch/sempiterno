"""SymbolFrame: todo lo que el motor necesita de una cripto (features, régimen, eventos, probas).

Se construye igual para el backtest y para el ciclo en vivo (misma función), lo que garantiza
que ambos vean exactamente la misma información.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from cryptobot.config import Regime, StrategyParams
from cryptobot.features.pipeline import build_features
from cryptobot.models.primary import detect_events
from cryptobot.regime.hmm import walk_forward_regimes
from cryptobot.regime.rules import combine_regimes, overlays
from cryptobot.strategy.decision import MarketView

REQUIRED = ("close", "sigma_d", "trend_vote", "mom_z_30d")


@dataclass
class SymbolFrame:
    symbol: str
    bars: pd.DataFrame
    features: pd.DataFrame
    regimes: pd.DataFrame
    overlays: pd.DataFrame
    event_side: np.ndarray  # 0 = sin evento; ±1 = evento CUSUM (subida/retroceso)
    probs: np.ndarray = field(default=None)  # probabilidad del meta-modelo (NaN si no aplica)
    contributions: dict[int, list[tuple[str, float]]] = field(default_factory=dict)

    def __post_init__(self) -> None:
        n = len(self.features)
        if self.probs is None:
            self.probs = np.full(n, np.nan)
        f = self.features
        self._close = f["close"].to_numpy(dtype="float64")
        self._sigma = f["sigma_d"].to_numpy(dtype="float64")
        self._vote = f["trend_vote"].to_numpy(dtype="float64")
        self._ok = np.all(np.isfinite(f[list(REQUIRED)].to_numpy(dtype="float64")), axis=1) & (
            self._sigma > 0
        )
        self._regime = self.regimes["regime"].to_numpy(dtype="object")
        self._p_stress = self.regimes["p_stress"].to_numpy(dtype="float64")
        self._euph = self.overlays["euphoria"].to_numpy(dtype=bool)
        self._macro = self.overlays["macro_event"].to_numpy(dtype=bool)

    @property
    def n(self) -> int:
        return len(self.features)

    @property
    def index(self) -> pd.DatetimeIndex:
        return self.features.index

    def event_bars(self) -> np.ndarray:
        return np.flatnonzero(self.event_side != 0)

    def feature_row(self, i: int) -> dict:
        row = self.features.iloc[i].to_dict()
        row["event_side"] = float(self.event_side[i])
        return row

    def view(self, i: int) -> MarketView:
        reg = self._regime[i]
        regime = Regime(reg) if isinstance(reg, str) and reg else None
        prob = self.probs[i]
        return MarketView(
            symbol=self.symbol,
            time=self.index[i],
            close=float(self._close[i]),
            sigma_d=float(self._sigma[i]),
            trend_vote=float(self._vote[i]),
            row=self.feature_row(i),
            regime=regime,
            p_stress=float(np.nan_to_num(self._p_stress[i])),
            euphoria=bool(self._euph[i]),
            macro_event=bool(self._macro[i]),
            is_event=bool(self.event_side[i] != 0),
            event_side=int(self.event_side[i]),
            prob=None if not np.isfinite(prob) else float(prob),
            contributions=self.contributions.get(i, []),
            data_ok=bool(self._ok[i]),
        )

    def model_matrix(self, bars_idx: np.ndarray) -> pd.DataFrame:
        X = self.features.iloc[bars_idx].copy()
        X["event_side"] = self.event_side[bars_idx].astype(float)
        return X


def build_symbol_frame(
    symbol: str,
    bars_20m: pd.DataFrame,
    params: StrategyParams,
    funding: pd.DataFrame | None = None,
    fng: pd.DataFrame | None = None,
    regime_probs: pd.DataFrame | None = None,
    use_hmm: bool = True,
    macro_events: pd.DatetimeIndex | None = None,
) -> SymbolFrame:
    feats = build_features(bars_20m, funding, fng)
    if regime_probs is None and use_hmm:
        regime_probs = walk_forward_regimes(bars_20m)
    regimes = combine_regimes(regime_probs, feats)
    ov = overlays(feats, params, macro_events)
    ev = detect_events(feats, params)
    side = np.zeros(len(feats), dtype=np.int64)
    if not ev.empty:
        side[ev["bar"].to_numpy()] = ev["side"].to_numpy()
    return SymbolFrame(symbol, bars_20m, feats, regimes, ov, side)
