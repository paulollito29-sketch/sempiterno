"""Reglas de ejecución compartidas por el etiquetado (triple barrera) y el backtester.

Convenciones (barras de 20m, decisión al CIERRE de la barra i):
- Compra/venta por decisión: se ejecuta en la barra i + 1 + demora. En modo "worst_open"
  (manual, Lemon) se toma la PEOR apertura de esa ventana; en "next_open", la siguiente apertura.
- Stop/objetivo con órdenes en el exchange: se ejecuta en el nivel (o en la apertura si hubo gap).
- Stop/objetivo SIN órdenes en el exchange (Lemon): el vigilante avisa al tocarse (barra j) y vendes a
  mano; se ejecuta en la apertura de la barra j + alert_delay (>= 1; puede ser peor que el stop).
- Si en una misma barra se tocan stop y objetivo, se asume el PEOR caso (stop).
- Precio efectivo = precio * (1 ± costo por lado).
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from cryptobot.config import CostProfile


@dataclass(frozen=True)
class Fill:
    bar: int  # índice de barra en que la operación queda ejecutada
    raw_price: float  # precio de mercado
    price: float  # precio efectivo con costos


def decision_fill(
    opens: np.ndarray, decision_bar: int, costs: CostProfile, side: int
) -> Fill | None:
    """Ejecución de una orden decidida al cierre de `decision_bar` (side +1 compra, -1 venta)."""
    first = decision_bar + 1
    last = first + costs.exec_delay_bars
    if last >= len(opens):
        return None
    window = opens[first : last + 1]
    valid = window[np.isfinite(window)]
    if costs.exec_price_mode == "worst_open":
        if not len(valid):
            return None  # hueco de datos: no se puede ejecutar
        raw = float(valid.max() if side > 0 else valid.min())
    else:
        raw = float(opens[first])
    if not np.isfinite(raw):
        return None
    eff = raw * (1 + costs.per_side) if side > 0 else raw * (1 - costs.per_side)
    return Fill(bar=last, raw_price=raw, price=eff)


def stop_fill(opens: np.ndarray, bar: int, stop: float, costs: CostProfile) -> Fill | None:
    if costs.stops_on_exchange:
        raw = min(float(opens[bar]), stop) if np.isfinite(opens[bar]) else stop
        return Fill(bar=bar, raw_price=raw, price=raw * (1 - costs.per_side - costs.stop_slippage))
    exec_bar = bar + max(1, costs.alert_delay_bars)  # el vigilante avisa al instante; tú reaccionas
    if exec_bar >= len(opens) or not np.isfinite(opens[exec_bar]):
        return None
    raw = float(opens[exec_bar])
    return Fill(bar=exec_bar, raw_price=raw, price=raw * (1 - costs.per_side - costs.stop_slippage))


def target_fill(opens: np.ndarray, bar: int, target: float, costs: CostProfile) -> Fill | None:
    if costs.stops_on_exchange:
        raw = max(float(opens[bar]), target) if np.isfinite(opens[bar]) else target
        return Fill(bar=bar, raw_price=raw, price=raw * (1 - costs.per_side))
    exec_bar = bar + max(1, costs.alert_delay_bars)  # el vigilante avisa al instante; tú reaccionas
    if exec_bar >= len(opens) or not np.isfinite(opens[exec_bar]):
        return None
    raw = float(opens[exec_bar])
    return Fill(bar=exec_bar, raw_price=raw, price=raw * (1 - costs.per_side))


def first_barrier_touch(
    highs: np.ndarray, lows: np.ndarray, start: int, end: int, stop: float, target: float
) -> tuple[int, str] | None:
    """Primera barra en [start, end] que toca stop u objetivo. Empate => stop (peor caso)."""
    if start > end:
        return None
    lo = lows[start : end + 1]
    hi = highs[start : end + 1]
    hit_sl = lo <= stop
    hit_tp = hi >= target
    any_hit = hit_sl | hit_tp
    if not any_hit.any():
        return None
    k = int(np.argmax(any_hit))
    return start + k, ("sl" if hit_sl[k] else "tp")
