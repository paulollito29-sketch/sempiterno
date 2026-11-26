from __future__ import annotations

import pandas as pd
from hypothesis import given, settings
from hypothesis import strategies as st

from cryptobot.config import COST_PROFILES, Action, Regime, RiskLimits, StrategyParams
from cryptobot.models.meta import PayoffStats
from cryptobot.strategy.decision import DecisionEngine, MarketView, PortfolioView, PositionView
from cryptobot.strategy.risk import RiskState
from cryptobot.strategy.sizing import position_fraction

LEMON = COST_PROFILES["lemon"]
PAYOFF = PayoffStats(base_rate=0.4, avg_win=0.12, avg_loss=0.06, n=500)
T0 = pd.Timestamp("2025-01-01 12:00", tz="UTC")


def mv(**kw) -> MarketView:
    base = dict(
        symbol="ETHUSDT",
        time=T0,
        close=2000.0,
        sigma_d=0.035,
        trend_vote=1.0,
        row={"mom_z_7d": 1.0, "mom_z_30d": 1.2, "funding_z_30d": 0.1, "fng": 55},
        regime=Regime.BULL,
        p_stress=0.05,
        is_event=True,
        event_side=-1,
        prob=0.6,
    )
    base.update(kw)
    return MarketView(**base)


def engine(**params) -> DecisionEngine:
    return DecisionEngine(StrategyParams(**params), RiskLimits(), LEMON, PAYOFF, has_model=True)


PF = PortfolioView(equity=1000.0)


def test_buy_with_levels_and_reasons():
    d = engine().decide(mv(), None, PF)
    assert d.action == Action.BUY
    assert d.stop < 2000 < d.target
    assert 0 < d.size_frac <= RiskLimits().max_position
    assert d.horizon_end == T0 + pd.Timedelta(minutes=20) + pd.Timedelta(days=14)
    assert any("retroceso" in r for r in d.reasons)
    # riesgo: si toca el stop pierdes ~1% del capital
    stop_frac = 1 - d.stop / 2000
    loss = d.size_frac * (stop_frac + LEMON.round_trip + LEMON.stop_slippage)
    assert loss <= RiskLimits().risk_per_trade + 1e-9


def test_entry_filters():
    e = engine()
    assert e.decide(mv(regime=Regime.STRESS), None, PF).action == Action.STAY_CASH
    assert e.decide(mv(is_event=False), None, PF).reason_code == "no_event"
    assert e.decide(mv(trend_vote=0.0), None, PF).reason_code == "no_trend"
    assert e.decide(mv(euphoria=True), None, PF).reason_code == "euphoria"
    assert e.decide(mv(macro_event=True), None, PF).reason_code == "macro"
    assert e.decide(mv(prob=0.2), None, PF).reason_code == "low_prob"
    assert e.decide(mv(prob=None), None, PF).reason_code == "no_model"
    assert e.decide(mv(data_ok=False), None, PF).reason_code == "data"
    defensive = PortfolioView(1000.0, defensive_reason="modo defensivo")
    assert e.decide(mv(), None, defensive).reason_code == "defensive"
    weekly = PortfolioView(1000.0, trades_last_7d=4)
    assert e.decide(mv(), None, weekly).reason_code == "weekly_limit"
    full = PortfolioView(1000.0, exposure_value=800.0)
    assert e.decide(mv(), None, full).reason_code == "size"


def test_range_regime_requires_more_probability():
    e = engine()
    thr_bull = e.threshold_for(Regime.BULL)
    thr_range = e.threshold_for(Regime.RANGE)
    assert thr_range == thr_bull + StrategyParams().range_threshold_bump
    p = (thr_bull + thr_range) / 2
    assert e.decide(mv(prob=p, regime=Regime.BULL), None, PF).action == Action.BUY
    assert e.decide(mv(prob=p, regime=Regime.RANGE), None, PF).reason_code == "low_prob"


def _pos(**kw) -> PositionView:
    base = dict(
        symbol="ETHUSDT",
        qty=0.1,
        entry_price=1900.0,
        entry_time=T0 - pd.Timedelta(days=2),
        stop=1800.0,
        target=2300.0,
        horizon_end=T0 + pd.Timedelta(days=5),
    )
    base.update(kw)
    return PositionView(**base)


def test_exit_rules():
    e = engine(exit_vote=-0.5)
    assert e.decide(mv(), _pos(), PF).action == Action.HOLD
    assert e.decide(mv(), _pos(horizon_end=T0), PF).reason_code == "time"
    assert e.decide(mv(regime=Regime.STRESS, p_stress=0.9), _pos(), PF).reason_code == "stress"
    assert e.decide(mv(trend_vote=-0.5), _pos(), PF).reason_code == "trend_reversal"
    red = e.decide(mv(euphoria=True), _pos(), PF)
    assert red.action == Action.REDUCE and red.reduce_frac == 0.5
    assert e.decide(mv(euphoria=True), _pos(reduced=True), PF).action == Action.HOLD


def test_rule_only_engine_ignores_probability():
    e = DecisionEngine(
        StrategyParams(use_meta_model=False), RiskLimits(), LEMON, PAYOFF, has_model=False
    )
    assert e.decide(mv(prob=None), None, PF).action == Action.BUY


@settings(max_examples=200, deadline=None)
@given(
    prob=st.floats(0.0, 1.0),
    sigma=st.floats(0.005, 0.2),
    stop=st.floats(0.005, 0.5),
    exposure=st.floats(0.0, 1.2),
)
def test_sizing_never_breaks_limits(prob, sigma, stop, exposure):
    lim = RiskLimits()
    s = position_fraction(prob, 0.4, stop, sigma, PAYOFF, lim, LEMON, has_model=True)
    assert 0.0 <= s.fraction <= lim.max_position + 1e-12
    loss = s.fraction * (stop + LEMON.round_trip + LEMON.stop_slippage)
    assert loss <= lim.risk_per_trade + 1e-9
    d = engine().decide(
        mv(prob=max(prob, 0.0), sigma_d=sigma),
        None,
        PortfolioView(1000.0, exposure_value=1000.0 * exposure),
    )
    if d.action == Action.BUY:
        assert d.size_frac <= max(0.0, lim.max_total_exposure - exposure) + 1e-12


def test_risk_state_defensive_mode():
    rs = RiskState()
    rs.update(1000.0, T0)
    rs.update(1100.0, T0 + pd.Timedelta(hours=1))
    assert rs.defensive_reason(1050.0, RiskLimits()) is None
    assert "caída" in rs.defensive_reason(930.0, RiskLimits())
    rs2 = RiskState()
    rs2.update(1000.0, T0)
    assert "diaria" in rs2.defensive_reason(965.0, RiskLimits())
    rs2.paused = True
    assert rs2.defensive_reason(1000.0, RiskLimits()) == "bot en pausa"
    assert RiskState.from_dict(rs.to_dict()).peak_equity == 1100.0
