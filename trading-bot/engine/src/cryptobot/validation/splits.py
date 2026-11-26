"""Particiones temporales sin fuga de información.

- Walk-forward: se entrena con el pasado y se prueba en la ventana siguiente.
- Purga: se excluyen del entrenamiento las etiquetas cuyo resultado se conoce DESPUÉS del inicio
  del tramo de prueba (sus barreras se solapan con el futuro).
- Embargo: además se deja un margen tras el tramo de prueba (para k-fold purgado).
Referencia: López de Prado (2018), cap. 7.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class Window:
    test_start: pd.Timestamp
    test_end: pd.Timestamp  # exclusivo


def walk_forward_windows(
    start: pd.Timestamp, end: pd.Timestamp, test_days: int = 90, min_train_days: int = 365
) -> list[Window]:
    windows = []
    t = start + pd.Timedelta(days=min_train_days)
    while t < end:
        t_end = min(t + pd.Timedelta(days=test_days), end)
        windows.append(Window(t, t_end))
        t = t_end
    return windows


def purged_train_mask(
    t_end: pd.Series | np.ndarray, test_start: pd.Timestamp, embargo: pd.Timedelta | None = None
) -> np.ndarray:
    """Eventos cuyo resultado se conoció antes de `test_start - embargo` (solo pasado)."""
    t_end = pd.DatetimeIndex(t_end)
    return np.asarray(t_end < (test_start - (embargo or pd.Timedelta(0))))


def purged_kfold(
    t_event: pd.Series, t_end: pd.Series, n_splits: int = 5, embargo_frac: float = 0.01
) -> Iterator[tuple[np.ndarray, np.ndarray]]:
    """K-fold purgado con embargo (para ajustar hiperparámetros sin fuga)."""
    t_event = pd.DatetimeIndex(t_event)
    t_end = pd.DatetimeIndex(t_end)
    order = np.argsort(t_event.asi8)
    folds = np.array_split(order, n_splits)
    span = t_event.max() - t_event.min()
    embargo = span * embargo_frac
    for test_idx in folds:
        if len(test_idx) == 0:
            continue
        t0 = t_event[test_idx].min()
        t1 = t_end[test_idx].max()
        overlap = (t_end >= t0) & (t_event <= t1 + embargo)
        train_mask = ~overlap
        train_mask[test_idx] = False
        yield np.where(train_mask)[0], np.sort(test_idx)
