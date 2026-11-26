"""Filtro CUSUM simétrico (López de Prado 2018, cap. 2).

Genera "eventos" solo cuando el movimiento acumulado supera un umbral (aquí, un múltiplo
de la volatilidad diaria). Así el sistema evalúa oportunidades ante movimientos
significativos y no en cada barra, lo que reduce la sobre-operación.
"""

from __future__ import annotations

import numpy as np


def cusum_events(logret: np.ndarray, threshold: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Devuelve (índices de evento, lado): lado +1 = subida acumulada, -1 = bajada.

    `threshold[i]` es el umbral vigente en la barra i (debe ser causal).
    """
    r = np.asarray(logret, dtype="float64")
    h = np.asarray(threshold, dtype="float64")
    s_pos = 0.0
    s_neg = 0.0
    idx: list[int] = []
    side: list[int] = []
    for i in range(len(r)):
        ri, hi = r[i], h[i]
        if not (np.isfinite(ri) and np.isfinite(hi)) or hi <= 0:
            continue
        s_pos = max(0.0, s_pos + ri)
        s_neg = min(0.0, s_neg + ri)
        if s_pos > hi:
            s_pos = 0.0
            idx.append(i)
            side.append(1)
        elif s_neg < -hi:
            s_neg = 0.0
            idx.append(i)
            side.append(-1)
    return np.asarray(idx, dtype=np.int64), np.asarray(side, dtype=np.int64)
