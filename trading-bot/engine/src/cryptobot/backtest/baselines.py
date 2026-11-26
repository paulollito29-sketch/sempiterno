"""Estrategias de referencia (todas netas de los mismos costos que el bot).

Si el bot no les gana en retorno ajustado por riesgo, no vale la pena usarlo.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from cryptobot.config import CostProfile


def _daily_close(bars_20m: pd.DataFrame) -> pd.Series:
    return bars_20m["close"].resample("1D").last().dropna()


def buy_and_hold(close: pd.Series, costs: CostProfile) -> pd.Series:
    """Comprar el primer día y mantener (costo de entrada y de salida al final)."""
    eq = close / close.iloc[0] / (1 + costs.per_side)
    eq.iloc[-1] *= 1 - costs.per_side
    return eq


def vol_target(
    close: pd.Series,
    costs: CostProfile,
    target_vol: float = 0.40,
    lookback: int = 30,
    rebalance_days: int = 7,
    band: float = 0.10,
) -> pd.Series:
    """Comprar y mantener con exposición = min(1, vol objetivo / vol realizada), rebalanceo semanal."""
    r = close.pct_change().fillna(0.0)
    vol = r.rolling(lookback, min_periods=10).std() * np.sqrt(365)
    eq = np.empty(len(close))
    w = 0.0
    value = 1.0
    for i in range(len(close)):
        if i > 0:
            value *= 1 + w * r.iloc[i]
        if i % rebalance_days == 0 and np.isfinite(vol.iloc[i]) and vol.iloc[i] > 0:
            target = min(1.0, target_vol / vol.iloc[i])
            if abs(target - w) > band:
                value *= 1 - abs(target - w) * costs.per_side
                w = target
        eq[i] = value
    return pd.Series(eq, index=close.index)


def sma_crossover(
    close: pd.Series, costs: CostProfile, fast: int = 20, slow: int = 100
) -> pd.Series:
    """Comprado si la media de 20 días > media de 100 días (señal del día anterior)."""
    r = close.pct_change().fillna(0.0)
    signal = (
        (close.rolling(fast).mean() > close.rolling(slow).mean()).astype(float).shift(1).fillna(0.0)
    )
    turnover = signal.diff().abs().fillna(signal.iloc[0])
    daily = (1 + signal * r) * (1 - turnover * costs.per_side)
    return daily.cumprod()


def dca(
    close: pd.Series, costs: CostProfile, every_days: int = 7, installments: int | None = None
) -> pd.Series:
    """Compra periódica: el capital se invierte en partes iguales cada `every_days` días."""
    n_buys = installments or max(1, len(close) // every_days)
    amount = 1.0 / n_buys
    cash, units = 1.0, 0.0
    eq = np.empty(len(close))
    buys = 0
    for i, px in enumerate(close.to_numpy()):
        if i % every_days == 0 and buys < n_buys and cash > 1e-12:
            spend = min(amount, cash)
            units += spend / (px * (1 + costs.per_side))
            cash -= spend
            buys += 1
        eq[i] = cash + units * px
    return pd.Series(eq, index=close.index)


def all_baselines(
    bars_20m: pd.DataFrame,
    costs: CostProfile,
    start: pd.Timestamp | None = None,
    end: pd.Timestamp | None = None,
) -> dict[str, pd.Series]:
    close = _daily_close(bars_20m)
    if start is not None:
        close = close[close.index >= start.floor("1D")]
    if end is not None:
        close = close[close.index < end]
    if len(close) < 2:
        return {}
    return {
        "comprar_y_mantener": buy_and_hold(close, costs),
        "vol_targeting": vol_target(close, costs),
        "cruce_medias_20_100": sma_crossover(close, costs),
        "dca_semanal": dca(close, costs),
    }
