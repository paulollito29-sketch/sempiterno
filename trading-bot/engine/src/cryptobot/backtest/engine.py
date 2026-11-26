"""Backtester por cripto ("sleeve"), con el MISMO motor de decisión que el bot en vivo.

En vez de recorrer barra por barra (lento), salta entre momentos relevantes: eventos CUSUM
cuando está fuera del mercado, y — estando dentro — la primera barra que toca stop/objetivo,
la primera señal de salida (estrés, giro de tendencia, euforia) o el horizonte. Cada uno de
esos momentos se confirma llamando a `DecisionEngine.decide`, igual que en vivo.

Convenciones de ejecución: ver `backtest/fills.py` (demora manual de Lemon, peor precio,
stops ejecutados a mano tras la alerta, peor caso si stop y objetivo caen en la misma barra).
"""

from __future__ import annotations

from bisect import bisect_right
from collections.abc import Callable
from dataclasses import dataclass, field, replace

import numpy as np
import pandas as pd

from cryptobot.backtest.fills import (
    Fill,
    decision_fill,
    first_barrier_touch,
    stop_fill,
    target_fill,
)
from cryptobot.config import Action
from cryptobot.labeling.triple_barrier import barrier_levels
from cryptobot.models.meta import PayoffStats
from cryptobot.strategy.decision import (
    DecisionEngine,
    PortfolioView,
    PositionView,
    exit_signal_mask,
)
from cryptobot.strategy.frame import SymbolFrame
from cryptobot.strategy.risk import RiskState
from cryptobot.timeutils import BAR
from cryptobot.validation.metrics import equity_metrics

INF = 1 << 62


@dataclass
class BacktestResult:
    symbol: str
    equity: pd.Series  # por barra
    daily: pd.Series  # diaria (último valor del día)
    trades: pd.DataFrame
    decisions: list[dict] = field(default_factory=list)
    exposure: float = 0.0
    metrics: dict = field(default_factory=dict)


@dataclass
class _OpenTrade:
    pos: PositionView
    entry_eff: float  # precio efectivo de entrada (con costos)
    entry_time: pd.Timestamp
    prob: float | None
    size_frac: float
    q0: float  # cantidad original (para operaciones parciales)


PayoffSchedule = list[tuple[pd.Timestamp, PayoffStats]]


def _payoff_at(schedule: PayoffSchedule | None, t: pd.Timestamp) -> PayoffStats | None:
    if not schedule:
        return None
    starts = [s for s, _ in schedule]
    k = bisect_right(starts, t) - 1
    return schedule[k][1] if k >= 0 else None


def run_symbol_backtest(
    frame: SymbolFrame,
    engine: DecisionEngine,
    start: pd.Timestamp | None = None,
    end: pd.Timestamp | None = None,
    capital: float = 10_000.0,
    payoff_schedule: PayoffSchedule | None = None,
    record_decisions: bool = False,
    on_decision: Callable[[dict], None] | None = None,
) -> BacktestResult:
    params, costs, limits = engine.params, engine.costs, engine.limits
    bars = frame.bars.reindex(frame.index)
    opens = bars["open"].to_numpy(dtype="float64")
    highs = bars["high"].to_numpy(dtype="float64")
    lows = bars["low"].to_numpy(dtype="float64")
    closes = pd.Series(bars["close"].to_numpy(dtype="float64")).ffill().to_numpy()
    times = frame.index
    n = frame.n
    i0 = 0 if start is None else int(times.searchsorted(start))
    i1 = n if end is None else int(times.searchsorted(end))
    H = params.horizon_bars
    rt = costs.round_trip

    events = frame.event_bars()
    events = events[(events >= i0) & (events < i1)]
    exit_idx = np.flatnonzero(exit_signal_mask(frame._vote, frame._regime, frame._p_stress, params))
    euph_idx = np.flatnonzero(frame._euph)

    cp_bar: list[int] = [i0]
    cp_cash: list[float] = [capital]
    cp_qty: list[float] = [0.0]
    risk = RiskState(peak_equity=capital)
    trades: list[dict] = []
    decisions: list[dict] = []
    engines: dict[int, DecisionEngine] = {}

    def engine_at(t: pd.Timestamp) -> DecisionEngine:
        if payoff_schedule is None:
            return engine
        po = _payoff_at(payoff_schedule, t)
        key = id(po)
        if key not in engines:
            engines[key] = DecisionEngine(
                engine.params, engine.limits, engine.costs, po, engine.has_model and po is not None
            )
        return engines[key]

    def equity_at(bar: int) -> float:
        k = bisect_right(cp_bar, bar) - 1
        return cp_cash[k] + cp_qty[k] * closes[bar]

    def set_state(bar: int, cash: float, qty: float) -> None:
        # Actualiza el pico con el tramo que termina (estado anterior constante).
        prev_bar, prev_cash, prev_qty = cp_bar[-1], cp_cash[-1], cp_qty[-1]
        if bar > prev_bar:
            seg = closes[prev_bar:bar]
            seg_max = (
                prev_cash + prev_qty * float(np.nanmax(seg))
                if prev_qty > 0 and len(seg)
                else prev_cash
            )
            risk.peak_equity = max(risk.peak_equity, seg_max)
        if bar == cp_bar[-1]:
            cp_cash[-1], cp_qty[-1] = cash, qty
        else:
            cp_bar.append(bar)
            cp_cash.append(cash)
            cp_qty.append(qty)

    def refresh_risk(bar: int) -> float:
        """Pico y capital al inicio del día a la hora de decidir en `bar` (como en vivo)."""
        t_dec = times[bar] + BAR
        day = t_dec.strftime("%Y-%m-%d")
        if day != risk.day:
            day_start_bar = max(i0, int(times.searchsorted(t_dec.floor("1D") - BAR)))
            day_start_bar = min(day_start_bar, bar)
            risk.day = day
            risk.day_start_equity = equity_at(day_start_bar)
        eq = equity_at(bar)
        last_b = cp_bar[-1]
        if cp_qty[-1] > 0 and bar >= last_b:
            seg_max = cp_cash[-1] + cp_qty[-1] * float(np.nanmax(closes[last_b : bar + 1]))
            risk.peak_equity = max(risk.peak_equity, seg_max)
        risk.peak_equity = max(risk.peak_equity, eq)
        return eq

    def log_decision(bar: int, d, eq: float) -> None:
        rec = {
            "bar": bar,
            "time": times[bar] + BAR,
            "action": d.action.value,
            "reason": d.reason_code,
            "prob": d.prob,
            "size_frac": d.size_frac,
            "equity": eq,
        }
        if record_decisions:
            decisions.append(rec)
        if on_decision is not None:
            on_decision(rec)

    def close_trade(t: _OpenTrade, fill: Fill, reason: str, q_sell: float) -> None:
        nonlocal cash, qty
        cash += q_sell * fill.price
        trades.append(
            {
                "symbol": frame.symbol,
                "entry_time": t.entry_time,
                "exit_time": times[fill.bar],
                "entry_raw": t.pos.entry_price,
                "exit_raw": fill.raw_price,
                "net_ret": fill.price / t.entry_eff - 1.0,
                "gross_ret": fill.raw_price / t.pos.entry_price - 1.0,
                "qty": q_sell,
                "pnl": q_sell * (fill.price - t.entry_eff),
                "size_frac": t.size_frac * (q_sell / t.q0),
                "reason": reason,
                "prob": t.prob,
                "hold_days": (times[fill.bar] - t.entry_time) / pd.Timedelta(days=1),
            }
        )
        qty -= q_sell
        if qty < 1e-15:
            qty = 0.0
        set_state(fill.bar, cash, qty)

    cash, qty = capital, 0.0
    ev_ptr = 0
    cur = i0
    while True:
        while ev_ptr < len(events) and events[ev_ptr] < cur:
            ev_ptr += 1
        if ev_ptr >= len(events):
            break
        e = int(events[ev_ptr])
        ev_ptr += 1
        eq = refresh_risk(e)
        mv = frame.view(e)
        eng = engine_at(mv.decision_time)
        pf = PortfolioView(
            equity=eq,
            exposure_value=0.0,
            defensive_reason=risk.defensive_reason(eq, limits),
            trades_last_7d=risk.trades_last_7d(mv.decision_time),
        )
        d = eng.decide(mv, None, pf)
        if d.action == Action.BUY or record_decisions:
            log_decision(e, d, eq)
        if d.action != Action.BUY:
            cur = e + 1
            continue
        entry = decision_fill(opens, e, costs, +1)
        if entry is None or entry.bar >= i1:
            break
        notional = d.size_frac * eq
        q = notional / entry.price
        cash -= notional
        qty = q
        set_state(entry.bar, cash, qty)
        risk.register_entry(mv.decision_time)
        stop, target = barrier_levels(entry.raw_price, frame._sigma[e], params)
        vertical = entry.bar + H
        pos = PositionView(
            symbol=frame.symbol,
            qty=q,
            entry_price=entry.raw_price,
            entry_time=times[entry.bar],
            stop=stop,
            target=target,
            horizon_end=times[min(vertical, n - 1)] + BAR,
        )
        trade = _OpenTrade(
            pos=pos,
            entry_eff=entry.price,
            entry_time=times[entry.bar],
            prob=d.prob,
            size_frac=d.size_frac,
            q0=q,
        )
        j0 = entry.bar
        exit_bar = None

        while qty > 0:
            last = min(vertical, i1 - 1)
            touch = first_barrier_touch(highs, lows, j0, last, stop, target)
            tj = touch[0] if touch else INF
            k = int(np.searchsorted(exit_idx, j0))
            sj = int(exit_idx[k]) if k < len(exit_idx) and exit_idx[k] <= last else INF
            rj = INF
            if not pos.reduced:
                k2 = int(np.searchsorted(euph_idx, j0))
                cand = euph_idx[k2:]
                cand = cand[cand <= last]
                if len(cand):
                    ok = closes[cand] >= pos.entry_price * (1 + 2 * rt)
                    if ok.any():
                        rj = int(cand[np.argmax(ok)])
            vj = vertical if vertical <= i1 - 1 else INF
            nxt = min(tj, sj, rj, vj)
            if nxt >= INF:
                break  # se terminan los datos con la posición abierta
            if tj == nxt:
                kind = touch[1]
                fill = (
                    stop_fill(opens, tj, stop, costs)
                    if kind == "sl"
                    else target_fill(opens, tj, target, costs)
                )
                if fill is None or fill.bar >= i1:
                    break
                close_trade(trade, fill, kind, qty)
                exit_bar = fill.bar
                break
            eq_n = refresh_risk(nxt)
            mv = frame.view(nxt)
            pf = PortfolioView(
                eq_n,
                qty * closes[nxt],
                risk.defensive_reason(eq_n, limits),
                risk.trades_last_7d(mv.decision_time),
            )
            pos.qty = qty
            dd = engine_at(mv.decision_time).decide(mv, pos, pf)
            if dd.action in (Action.SELL, Action.REDUCE):
                log_decision(nxt, dd, eq_n)
            if dd.action == Action.SELL:
                fill = decision_fill(opens, nxt, costs, -1)
                if fill is None or fill.bar >= i1:
                    break
                close_trade(trade, fill, dd.reason_code, qty)
                exit_bar = fill.bar
                break
            if dd.action == Action.REDUCE:
                fill = decision_fill(opens, nxt, costs, -1)
                if fill is None or fill.bar >= i1:
                    break
                close_trade(trade, fill, "reduce", qty * dd.reduce_frac)
                pos.reduced = True
                j0 = fill.bar
                continue
            j0 = nxt + 1
        if qty > 0 and exit_bar is None:
            break  # quedó abierta al final de los datos
        cur = exit_bar if exit_bar is not None else cur + 1

    # Curva de capital por barra
    span = np.arange(i0, i1)
    k = np.searchsorted(np.asarray(cp_bar), span, side="right") - 1
    eq_arr = np.asarray(cp_cash)[k] + np.asarray(cp_qty)[k] * closes[span]
    equity = pd.Series(eq_arr, index=times[i0:i1], name=frame.symbol)
    daily = equity.resample("1D").last().dropna()
    exposure = float((np.asarray(cp_qty)[k] > 0).mean()) if len(span) else 0.0
    trades_df = pd.DataFrame(trades)
    metrics = equity_metrics(daily, trades_df if len(trades_df) else None, exposure)
    return BacktestResult(frame.symbol, equity, daily, trades_df, decisions, exposure, metrics)


def combine_equal_weight(results: list[BacktestResult]) -> pd.Series:
    """Portafolio con 1/N del capital en cada cripto (sleeves independientes)."""
    if not results:
        return pd.Series(dtype="float64")
    curves = [r.daily / r.daily.iloc[0] for r in results if len(r.daily)]
    df = pd.concat(curves, axis=1).ffill().dropna()
    return df.mean(axis=1)


def with_params(engine: DecisionEngine, **overrides) -> DecisionEngine:
    return DecisionEngine(
        replace(engine.params, **overrides),
        engine.limits,
        engine.costs,
        engine.payoff,
        engine.has_model,
    )
