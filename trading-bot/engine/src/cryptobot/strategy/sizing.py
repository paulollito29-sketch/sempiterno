"""Tamaño de posición: riesgo fijo por operación, con topes por volatilidad y medio Kelly.

1. Riesgo fijo: si toca el stop pierdes `risk_per_trade` del capital (incluye costos).
2. Confianza: la probabilidad del modelo escala el riesgo entre 50% y 100%.
3. Medio Kelly (Kelly 1956; MacLean, Thorp & Ziemba 2010): nunca más que kelly_fraction * f*.
4. Volatilidad objetivo (Moreira & Muir 2017): posición <= objetivo / volatilidad anual del activo.
5. Máximo por cripto.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from math import sqrt

from cryptobot.config import CostProfile, RiskLimits
from cryptobot.models.meta import PayoffStats


@dataclass
class SizingResult:
    fraction: float
    components: dict[str, float] = field(default_factory=dict)


def position_fraction(
    prob: float,
    threshold: float,
    stop_frac: float,
    sigma_d: float,
    payoff: PayoffStats | None,
    limits: RiskLimits,
    costs: CostProfile,
    has_model: bool,
) -> SizingResult:
    loss_if_stop = (
        stop_frac + costs.round_trip + (0.0 if costs.stops_on_exchange else costs.stop_slippage)
    )
    comp: dict[str, float] = {"loss_if_stop": loss_if_stop}
    if loss_if_stop <= 0 or sigma_d <= 0:
        return SizingResult(0.0, comp)
    f_risk = limits.risk_per_trade / loss_if_stop
    scale = min(1.0, max(0.5, 0.5 + (prob - threshold) / 0.2)) if has_model else 0.75
    comp["risk_based"] = f_risk * scale

    kelly_pos = limits.max_position
    if payoff is not None and payoff.avg_loss > 0 and payoff.avg_win > 0:
        b = payoff.avg_win / payoff.avg_loss
        f_star = prob - (1 - prob) / b
        kelly_pos = limits.kelly_fraction * max(f_star, 0.0) / payoff.avg_loss
    comp["kelly_cap"] = kelly_pos

    vol_cap = limits.vol_target_annual / (sigma_d * sqrt(365))
    comp["vol_cap"] = vol_cap
    comp["max_position"] = limits.max_position
    frac = max(0.0, min(comp["risk_based"], kelly_pos, vol_cap, limits.max_position))
    return SizingResult(frac, comp)
