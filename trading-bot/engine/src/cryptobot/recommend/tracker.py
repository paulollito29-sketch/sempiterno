"""Track record honesto: ¿qué habría pasado si seguías cada recomendación de compra?

Para cada COMPRAR se simula: entrada al precio de referencia con costos; salida por stop u
objetivo (primer toque; empate = stop), por la siguiente recomendación de VENDER de esa cripto,
o al cumplirse el horizonte. Se mide aunque no la hayas ejecutado.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from cryptobot.config import Action, CostProfile
from cryptobot.persistence.base import Repo
from cryptobot.recommend.models import Recommendation, RecStatus
from cryptobot.timeutils import BAR, iso, to_utc
from cryptobot.validation.metrics import calibration_table

EXIT_TEXT = {
    "time": "horizonte",
    "stress": "estrés",
    "trend_reversal": "giro de tendencia",
    "euphoria": "euforia",
    "kill": "emergencia",
}


def _evaluate(
    rec: Recommendation,
    bars: pd.DataFrame,
    exits: list[Recommendation],
    costs: CostProfile,
    now: pd.Timestamp,
) -> None:
    entry = rec.ref_price * (1 + costs.per_side)
    stop = rec.ref_price * (1 + rec.stop_pct) if rec.stop_pct is not None else None
    target = rec.ref_price * (1 + rec.target_pct) if rec.target_pct is not None else None
    start = to_utc(rec.cycle_ts)  # las barras desde la decisión
    horizon = to_utc(rec.horizon_end) if rec.horizon_end else start + pd.Timedelta(days=14)
    b = bars[(bars.index >= start) & (bars.index + BAR <= min(now, horizon + BAR))]
    exit_time, exit_price, reason = None, None, None
    if len(b) and stop is not None and target is not None:
        hit_sl = (b["low"] <= stop).to_numpy()
        hit_tp = (b["high"] >= target).to_numpy()
        hit = hit_sl | hit_tp
        if hit.any():
            k = int(np.argmax(hit))
            exit_time = b.index[k] + BAR
            if hit_sl[k]:
                exit_price, reason = stop * (1 - costs.per_side - costs.stop_slippage), "stop"
            else:
                exit_price, reason = target * (1 - costs.per_side), "objetivo"
    for ex in exits:
        t = to_utc(ex.created_at)
        if (
            t > to_utc(rec.created_at)
            and (exit_time is None or t < exit_time)
            and ex.reason_code not in ("stop", "target")
        ):
            exit_time, exit_price, reason = (
                t,
                ex.ref_price * (1 - costs.per_side),
                f"venta: {ex.reason_code}",
            )
            break
    if exit_time is None and now >= horizon and len(b):
        exit_time, exit_price, reason = (
            b.index[-1] + BAR,
            float(b["close"].iloc[-1]) * (1 - costs.per_side),
            "horizonte",
        )
    if exit_time is not None:
        rec.outcome_status = "cerrada"
        rec.outcome_return = exit_price / entry - 1
        rec.outcome_reason = reason
        rec.closed_at = iso(exit_time)
    elif len(b):
        rec.outcome_status = "abierta"
        rec.outcome_return = float(b["close"].iloc[-1]) * (1 - costs.per_side) / entry - 1
        rec.outcome_reason = "en curso"


def update_outcomes(
    repo: Repo, bars_by_symbol: dict[str, pd.DataFrame], costs: CostProfile, now: pd.Timestamp
) -> int:
    recs = repo.recommendations()
    n = 0
    for rec in recs:
        if (
            rec.action != Action.BUY.value
            or rec.status == RecStatus.INFO
            or rec.outcome_status == "cerrada"
        ):
            continue
        bars = bars_by_symbol.get(rec.symbol)
        if bars is None or bars.empty:
            continue
        exits = sorted(
            (r for r in recs if r.symbol == rec.symbol and r.action in (Action.SELL.value,)),
            key=lambda r: r.created_at,
        )
        _evaluate(rec, bars, exits, costs, now)
        repo.save_recommendation(rec)
        n += 1
    return n


def track_record(recs: list[Recommendation]) -> dict:
    buys = [r for r in recs if r.action == Action.BUY.value and r.status != RecStatus.INFO]
    closed = [r for r in buys if r.outcome_status == "cerrada" and r.outcome_return is not None]
    rets = np.array([r.outcome_return for r in closed], dtype=float)
    out: dict = {
        "recomendaciones_compra": len(buys),
        "cerradas": len(closed),
        "abiertas": len(buys) - len(closed),
    }
    if len(rets):
        wins, losses = rets[rets > 0], rets[rets <= 0]
        out.update(
            {
                "aciertos": float((rets > 0).mean()),
                "ganancia_media": float(wins.mean()) if len(wins) else 0.0,
                "perdida_media": float(losses.mean()) if len(losses) else 0.0,
                "factor_beneficio": float(wins.sum() / -losses.sum()) if losses.sum() < 0 else None,
                "retorno_seguido": float(
                    np.prod([1 + (r.size_frac or 0) * r.outcome_return for r in closed]) - 1
                ),
            }
        )
        probs = [r.probability for r in closed if r.probability is not None]
        if len(probs) >= 10:
            ys = [int(r.outcome_return > 0) for r in closed if r.probability is not None]
            out["calibracion"] = calibration_table(np.array(probs), np.array(ys), bins=4)
    return out
