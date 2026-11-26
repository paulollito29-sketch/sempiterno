"""Pruebas de cordura del backtester: si fallan, cualquier resultado sería sospechoso."""

from __future__ import annotations

from dataclasses import replace

import numpy as np
import pytest

from cryptobot.backtest.baselines import buy_and_hold, dca, sma_crossover, vol_target
from cryptobot.backtest.engine import run_symbol_backtest
from cryptobot.backtest.research import ResearchConfig, run_research
from cryptobot.config import COST_PROFILES, STRATEGY_PRESETS, RiskLimits
from cryptobot.data.candles import prepare_bars_20m
from cryptobot.data.synthetic import RANDOM_WALK, generate_market
from cryptobot.strategy.decision import DecisionEngine
from cryptobot.strategy.frame import build_symbol_frame

LEMON = COST_PROFILES["lemon"]


def test_baselines_net_of_costs(bars20):
    close = bars20["close"].resample("1D").last().dropna()
    bh = buy_and_hold(close, LEMON)
    expected = close.iloc[-1] / close.iloc[0] * (1 - LEMON.per_side) / (1 + LEMON.per_side)
    assert np.isclose(bh.iloc[-1], expected)
    for curve in (vol_target(close, LEMON), sma_crossover(close, LEMON), dca(close, LEMON)):
        assert len(curve) == len(close) and np.isfinite(curve).all() and (curve > 0).all()


def test_backtest_runs_and_respects_limits(frame, lemon_params):
    eng = DecisionEngine(replace(lemon_params, use_meta_model=False), RiskLimits(), LEMON)
    res = run_symbol_backtest(frame, eng, record_decisions=True)
    assert len(res.trades) > 5
    assert (res.trades["size_frac"] <= RiskLimits().max_position + 1e-9).all()
    assert (res.trades["exit_time"] > res.trades["entry_time"]).all()
    # nunca dos posiciones a la vez en la misma cripto
    t = res.trades[res.trades["reason"] != "reduce"].sort_values("entry_time")
    assert (t["entry_time"].iloc[1:].to_numpy() >= t["exit_time"].iloc[:-1].to_numpy()).all()
    # el capital nunca se va a negativo ni se crea de la nada
    assert (res.equity > 0).all()
    assert res.equity.iloc[0] == 10_000.0


def test_random_walk_loses_about_the_costs():
    """En un paseo aleatorio no hay ventaja: tras costos, el retorno medio por operación ≈ -costos."""
    m = generate_market(days=500, seed=5, regimes=RANDOM_WALK, jumps=False)
    bars = prepare_bars_20m(m.bars_5m)
    params = replace(STRATEGY_PRESETS["binance"], use_meta_model=False, exit_on_stress=False)
    f = build_symbol_frame("RWUSDT", bars, params, None, None, use_hmm=False)
    costs = COST_PROFILES["binance"]
    res = run_symbol_backtest(f, DecisionEngine(params, RiskLimits(max_trades_per_week=100), costs))
    tr = res.trades
    assert len(tr) > 40
    gross = tr["gross_ret"].to_numpy()
    t_stat = gross.mean() / (gross.std(ddof=1) / np.sqrt(len(gross)))
    assert abs(t_stat) < 3.0  # sin ventaja significativa antes de costos
    assert tr["net_ret"].mean() < tr["gross_ret"].mean()


@pytest.mark.slow
def test_research_pipeline_smoke():
    from cryptobot.data.synthetic import generate_universe

    uni = generate_universe(["AAAUSDT", "BBBUSDT"], days=560, seed=9)
    params = STRATEGY_PRESETS["lemon"]
    frames = {
        s: build_symbol_frame(
            s, prepare_bars_20m(m.bars_5m), params, m.funding, m.fng, use_hmm=False
        )
        for s, m in uni.items()
    }
    cfg = ResearchConfig(
        cost_profile="lemon",
        min_train_days=240,
        test_days=90,
        min_train_events=30,
        grid=[{"use_meta_model": True}, {"use_meta_model": False}],
    )
    report, _ = run_research(frames, cfg)
    d = report.to_dict()
    assert set(d["gate"]) == {"meta", "regla"}
    assert d["champion"] in {"meta", "regla", "ninguno"}
    assert "comprar_y_mantener" in d["baselines"]
    assert len(d["curves"]) >= 4
    assert all(len(c["checks"]) == 8 for c in d["gate"].values())
