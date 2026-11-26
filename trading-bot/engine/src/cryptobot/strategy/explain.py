"""Explicaciones en español: el 'por qué' de cada recomendación."""

from __future__ import annotations

from collections.abc import Mapping

import numpy as np

from cryptobot.config import Regime

FEATURE_LABELS: dict[str, str] = {
    "mom_z_4h": "impulso de 4 horas",
    "mom_z_1d": "tendencia de 1 día",
    "mom_z_3d": "tendencia de 3 días",
    "mom_z_7d": "tendencia de 7 días",
    "mom_z_30d": "tendencia de 30 días",
    "trend_vote": "acuerdo entre horizontes de tendencia",
    "px_sma_7d": "precio vs. media de 7 días",
    "px_sma_30d": "precio vs. media de 30 días",
    "ema_slope_7d": "pendiente de la media de 7 días",
    "donchian_7d": "posición en el rango de 7 días",
    "dist_high_30d": "distancia al máximo de 30 días",
    "vol_ann": "nivel de volatilidad",
    "vol_ratio_1d_7d": "volatilidad de hoy vs. la semana",
    "vol_ratio_7d_30d": "volatilidad semanal vs. mensual",
    "vol_z_1y": "volatilidad vs. el último año",
    "park_ratio_1d": "rango intradía vs. volatilidad",
    "taker_imb_4h": "compras agresivas (4 h)",
    "taker_imb_1d": "compras agresivas (1 día)",
    "rel_volume_1d": "volumen relativo",
    "vwap_dev_1d": "precio vs. precio medio ponderado",
    "funding_rate": "funding de futuros",
    "funding_z_30d": "apalancamiento (funding) vs. lo normal",
    "fng_level": "sentimiento (Fear & Greed)",
    "fng_chg_7d": "cambio de sentimiento en 7 días",
    "hour_sin": "hora del día",
    "hour_cos": "hora del día",
    "dow_sin": "día de la semana",
    "dow_cos": "día de la semana",
    "event_side": "tipo de movimiento (subida o retroceso)",
}

REGIME_TEXT = {
    Regime.BULL: "alcista",
    Regime.RANGE: "lateral",
    Regime.STRESS: "estrés / bajista",
}


def _get(row: Mapping, key: str) -> float:
    v = row.get(key)
    try:
        f = float(v)
    except (TypeError, ValueError):
        return float("nan")
    return f


def describe_market(row: Mapping, regime: Regime | None) -> list[str]:
    """Frases cortas sobre el estado del mercado de una cripto."""
    out: list[str] = []
    m7, m30 = _get(row, "mom_z_7d"), _get(row, "mom_z_30d")
    if np.isfinite(m7) and np.isfinite(m30):
        if m7 > 0 and m30 > 0:
            out.append("tendencia 7d y 30d positiva")
        elif m7 < 0 and m30 < 0:
            out.append("tendencia 7d y 30d negativa")
        else:
            out.append("tendencias mixtas (7d vs. 30d)")
    if regime is not None:
        out.append(f"régimen {REGIME_TEXT[regime]}")
    fz = _get(row, "funding_z_30d")
    if np.isfinite(fz):
        out.append(
            "funding alto (mucho apalancamiento)"
            if fz > 1.5
            else ("funding bajo" if fz < -1.5 else "funding normal")
        )
    tb = _get(row, "taker_imb_1d")
    if np.isfinite(tb):
        if tb > 0.02:
            out.append("compras agresivas altas")
        elif tb < -0.02:
            out.append("ventas agresivas altas")
    vz = _get(row, "vol_z_1y")
    if np.isfinite(vz):
        out.append(
            "volatilidad alta"
            if vz > 1.0
            else ("volatilidad baja" if vz < -1.0 else "volatilidad normal")
        )
    fng = _get(row, "fng")
    if np.isfinite(fng):
        label = (
            "miedo extremo"
            if fng < 25
            else "miedo"
            if fng < 45
            else "neutral"
            if fng <= 55
            else "codicia"
            if fng < 75
            else "codicia extrema"
        )
        out.append(f"sentimiento: {label} ({fng:.0f})")
    return out


def describe_contributions(contribs: list[tuple[str, float]], top: int = 3) -> list[str]:
    """Convierte contribuciones SHAP en frases 'a favor' / 'en contra'."""
    pos = [FEATURE_LABELS.get(f, f) for f, v in contribs if v > 0][:top]
    neg = [FEATURE_LABELS.get(f, f) for f, v in contribs if v < 0][:top]
    out = []
    if pos:
        out.append("a favor: " + ", ".join(dict.fromkeys(pos)))
    if neg:
        out.append("en contra: " + ", ".join(dict.fromkeys(neg)))
    return out
