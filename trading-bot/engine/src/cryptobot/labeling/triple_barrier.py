"""Etiquetas de triple barrera (López de Prado 2018, cap. 3) con costos y demoras reales.

Para cada evento (compra candidata al cierre de la barra i):
  entrada  = ejecución realista (demora manual en Lemon, peor precio de la ventana)
  objetivo = entrada * exp(+tp_mult * σ_h)      σ_h = vol diaria * sqrt(horizonte en días)
  stop     = entrada * exp(-sl_mult * σ_h)
  tiempo   = horizonte máximo
La etiqueta es 1 si el retorno NETO de costos fue positivo.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from cryptobot.backtest.fills import decision_fill, first_barrier_touch, stop_fill, target_fill
from cryptobot.config import CostProfile, StrategyParams


def barrier_levels(entry_raw: float, sigma_d: float, params: StrategyParams) -> tuple[float, float]:
    sig_h = sigma_d * np.sqrt(params.horizon_days)
    return entry_raw * np.exp(-params.sl_mult * sig_h), entry_raw * np.exp(params.tp_mult * sig_h)


def label_events(
    bars: pd.DataFrame,
    sigma_d: np.ndarray,
    event_idx: np.ndarray,
    params: StrategyParams,
    costs: CostProfile,
) -> pd.DataFrame:
    opens = bars["open"].to_numpy(dtype="float64")
    highs = bars["high"].to_numpy(dtype="float64")
    lows = bars["low"].to_numpy(dtype="float64")
    n = len(bars)
    H = params.horizon_bars
    rows = []
    for i in event_idx:
        s = sigma_d[i]
        if not np.isfinite(s) or s <= 0:
            continue
        entry = decision_fill(opens, int(i), costs, side=+1)
        if entry is None:
            continue
        stop, target = barrier_levels(entry.raw_price, s, params)
        vertical = entry.bar + H
        if vertical >= n:
            continue  # no resuelto: no se usa para entrenar
        touch = first_barrier_touch(highs, lows, entry.bar, vertical, stop, target)
        if touch is not None:
            j, kind = touch
            exit_fill = (
                stop_fill(opens, j, stop, costs)
                if kind == "sl"
                else target_fill(opens, j, target, costs)
            )
            reason = kind
        else:
            exit_fill = decision_fill(opens, vertical, costs, side=-1)
            reason = "time"
        if exit_fill is None:
            continue
        net = exit_fill.price / entry.price - 1.0
        gross = exit_fill.raw_price / entry.raw_price - 1.0
        rows.append(
            {
                "event_bar": int(i),
                "entry_bar": entry.bar,
                "exit_bar": exit_fill.bar,
                "entry_raw": entry.raw_price,
                "exit_raw": exit_fill.raw_price,
                "stop": stop,
                "target": target,
                "reason": reason,
                "gross_ret": gross,
                "net_ret": net,
                "label": int(net > 0),
            }
        )
    out = pd.DataFrame(rows)
    if out.empty:
        return pd.DataFrame(
            columns=[
                "event_bar",
                "entry_bar",
                "exit_bar",
                "entry_raw",
                "exit_raw",
                "stop",
                "target",
                "reason",
                "gross_ret",
                "net_ret",
                "label",
                "t_event",
                "t_end",
            ]
        )
    out["t_event"] = bars.index[out["event_bar"].to_numpy()]
    out["t_end"] = bars.index[out["exit_bar"].to_numpy()]
    return out
