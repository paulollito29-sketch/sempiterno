"""Mensajes en español para Telegram y el panel."""

from __future__ import annotations

from cryptobot.config import Action, base_asset
from cryptobot.recommend.models import Recommendation, RecStatus

ICON = {
    Action.BUY.value: "🟢",
    Action.SELL.value: "🔴",
    Action.REDUCE.value: "🟡",
    Action.HOLD.value: "⚪",
    Action.STAY_CASH.value: "💵",
}
LABEL = {
    Action.BUY.value: "COMPRAR",
    Action.SELL.value: "VENDER",
    Action.REDUCE.value: "REDUCIR",
    Action.HOLD.value: "MANTENER",
    Action.STAY_CASH.value: "QUÉDATE EN USDT",
}
REASON_TITLE = {
    "stop": "tocó tu stop",
    "target": "tocó tu objetivo",
    "time": "se cumplió el horizonte",
    "stress": "el mercado entró en estrés",
    "trend_reversal": "la tendencia se dio vuelta",
    "euphoria": "euforia en el mercado",
}


def _usd(x: float | None) -> str:
    if x is None:
        return "—"
    return f"{x:,.2f} USD" if x < 1000 else f"{x:,.0f} USD"


def _px(x: float | None) -> str:
    if x is None:
        return "—"
    if x >= 100:
        return f"{x:,.2f}"
    if x >= 1:
        return f"{x:,.4f}"
    return f"{x:.6f}"


def _pct(x: float | None, signed: bool = True) -> str:
    if x is None:
        return "—"
    return f"{x * 100:+.1f}%" if signed else f"{x * 100:.0f}%"


def format_recommendation(rec: Recommendation, venue: str = "Lemon") -> str:
    coin = base_asset(rec.symbol)
    icon = ICON.get(rec.action, "•")
    title = LABEL.get(rec.action, rec.action)
    lines: list[str] = []
    if rec.status == RecStatus.INFO:
        lines.append(f"{icon} {coin}: {title}")
        lines += [f"• {r}" for r in rec.reasons]
        return "\n".join(lines)

    if rec.action == Action.BUY.value:
        lines.append(f"{icon} {title} {coin}")
        if rec.probability is not None and rec.threshold is not None:
            lines.append(
                f"Prob. de ganar tras costos: {_pct(rec.probability, False)} (mínimo exigido: {_pct(rec.threshold, False)})"
            )
        if rec.size_frac is not None:
            lines.append(
                f"Tamaño: {_pct(rec.size_frac, False)} de tu capital (≈ {_usd(rec.size_usd)})"
            )
        lines.append(
            f"Entrada: hasta {_px(rec.entry_max_price)} · Stop: {_px(rec.stop_price)} ({_pct(rec.stop_pct)}) · "
            f"Objetivo: {_px(rec.target_price)} ({_pct(rec.target_pct)})"
        )
        if rec.horizon_end:
            lines.append(f"Horizonte: hasta {rec.horizon_end[:10]} · Régimen: {rec.regime or '—'}")
    else:
        why = REASON_TITLE.get(rec.reason_code, "")
        lines.append(f"{icon} {title} {coin}" + (f" — {why}" if why else ""))
        if rec.qty:
            lines.append(
                f"Cantidad: {rec.qty:.6g} {coin} (precio de referencia {_px(rec.ref_price)})"
            )
    if rec.reasons:
        lines.append("Por qué: " + " · ".join(rec.reasons[:5]))
    if rec.expires_at and rec.status == RecStatus.PENDING:
        lines.append(f"Válida hasta: {rec.expires_at[11:16]} UTC (ejecútala en {venue} y confirma)")
    if not rec.approved_model:
        lines.append(
            "⚠️ Modelo NO aprobado por la puerta de calidad: tómalo como práctica, no como señal real."
        )
    return "\n".join(lines)


def buttons_for(rec: Recommendation, mode: str) -> list[list[tuple[str, str]]] | None:
    if rec.status != RecStatus.PENDING or rec.action not in (
        Action.BUY.value,
        Action.SELL.value,
        Action.REDUCE.value,
    ):
        return None
    if mode == "semi_auto_api":
        return [[("⚡ Ejecutar", f"api:{rec.id}"), ("❌ Ignorar", f"skip:{rec.id}")]]
    if mode == "manual":
        return [[("✅ La ejecuté", f"exec:{rec.id}"), ("❌ No la ejecuté", f"skip:{rec.id}")]]
    return None


def format_alert(symbol: str, kind: str, price: float, level: float) -> str:
    coin = base_asset(symbol)
    if kind == "stop":
        return f"⚠️ {coin} tocó tu STOP ({_px(level)}). Precio: {_px(price)}. Vende en Lemon para limitar la pérdida."
    return f"🎯 {coin} tocó tu OBJETIVO ({_px(level)}). Precio: {_px(price)}. Vende en Lemon para asegurar la ganancia."
