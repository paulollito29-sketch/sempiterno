"""Ranking de oportunidades: qué cripto de tu lista tiene la tendencia más sólida ahora.

Se basa en el momentum de 7 y 30 días normalizado por volatilidad (Liu, Tsyvinski & Wu 2022;
Fieberg et al. 2025) y se penaliza el régimen de estrés.
"""

from __future__ import annotations

import math

from cryptobot.config import Regime


def trend_score(row: dict, regime: Regime | None) -> float | None:
    vals = [row.get("mom_z_7d"), row.get("mom_z_30d"), row.get("px_sma_30d")]
    try:
        m7, m30, px = (float(v) for v in vals)
    except (TypeError, ValueError):
        return None
    if any(math.isnan(v) for v in (m7, m30, px)):
        return None
    score = 0.4 * m7 + 0.4 * m30 + 0.2 * math.tanh(px / 3)
    if regime == Regime.STRESS:
        score -= 1.0
    return round(score, 3)
