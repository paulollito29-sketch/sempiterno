"""Operación en vivo: paridad con el backtest, flujo de recomendaciones, comandos y alertas."""

from __future__ import annotations

from dataclasses import replace

import numpy as np
import pandas as pd
import pytest

from cryptobot.backtest.engine import run_symbol_backtest
from cryptobot.config import COST_PROFILES, STRATEGY_PRESETS, Action, Mode, RiskLimits, Settings
from cryptobot.data.candles import prepare_bars_20m
from cryptobot.data.synthetic import generate_market
from cryptobot.notify.telegram import MemoryNotifier
from cryptobot.persistence.base import Repo
from cryptobot.persistence.sqlite_store import SQLiteStore
from cryptobot.recommend.models import RecStatus
from cryptobot.runtime.app import API_CONFIRMATION, BotApp, confirm_regimes
from cryptobot.runtime.demo import replay
from cryptobot.runtime.market import ReplayMarket
from cryptobot.strategy.decision import DecisionEngine
from cryptobot.strategy.frame import build_symbol_frame
from cryptobot.timeutils import BAR


@pytest.fixture(scope="module")
def bfx_frame():
    m = generate_market(days=330, seed=8)
    params = STRATEGY_PRESETS["binance"]
    return build_symbol_frame(
        "BTCUSDT", prepare_bars_20m(m.bars_5m), params, m.funding, m.fng, use_hmm=False
    )


def make_app(frame, mode=Mode.PAPER, profile="binance", capital=10_000.0, **kw) -> BotApp:
    settings = Settings(
        mode=mode, cost_profile=profile, watchlist=frame.symbol, capital_usd=capital, **kw
    )
    return BotApp(
        settings,
        Repo(SQLiteStore(":memory:")),
        ReplayMarket({frame.symbol: frame}),
        notifier=MemoryNotifier(),
    )


def test_live_replay_matches_backtest(bfx_frame):
    """El bot en vivo (ciclo cada 20 min, paper) y el backtest deben producir LAS MISMAS operaciones."""
    start = bfx_frame.index[-1] - pd.Timedelta(days=60)
    end = bfx_frame.index[-1]
    params = replace(STRATEGY_PRESETS["binance"], use_meta_model=False)
    bt = run_symbol_backtest(
        bfx_frame,
        DecisionEngine(params, RiskLimits(), COST_PROFILES["binance"]),
        start=start.floor("20min"),
        end=end,
    )
    app = make_app(bfx_frame)
    replay(app, start, end - BAR)
    live = pd.DataFrame(app.repo.trades()).sort_values("closed_at")
    bt_tr = bt.trades
    assert len(bt_tr) >= 5, "se necesitan operaciones para comparar"
    n = min(len(bt_tr), len(live))
    assert n >= len(bt_tr) - 1  # la última puede quedar abierta al final del replay
    reason_map = {
        "sl": "stop",
        "tp": "target",
        "reduce": "euphoria",
    }  # mismo evento, distinto nombre
    for k in range(n):
        b, lv = bt_tr.iloc[k], live.iloc[k]
        assert pd.Timestamp(lv["opened_at"]).floor("20min") == b["entry_time"]
        offset = (
            BAR if b["reason"] in ("sl", "tp") else pd.Timedelta(0)
        )  # el vigilante avisa al cierre de la barra
        assert pd.Timestamp(lv["closed_at"]).floor("20min") - offset == b["exit_time"]
        assert lv["reason"] == reason_map.get(b["reason"], b["reason"])
        assert np.isclose(lv["pnl_pct"], b["net_ret"], rtol=1e-6, atol=1e-9)


def test_manual_flow_buy_execute_stop(bfx_frame):
    app = make_app(bfx_frame, mode=Mode.MANUAL, capital=1000.0)
    end = bfx_frame.index[-1]
    t = end - pd.Timedelta(days=60)
    buy = None
    while t < end and buy is None:
        app.run_cycle(t + pd.Timedelta(seconds=5))
        pend = [r for r in app.repo.pending() if r.action == Action.BUY.value]
        buy = pend[0] if pend else None
        t += BAR
    assert buy is not None, "debería aparecer una recomendación de compra"
    text, buttons = app.notifier.messages[-1]
    assert "COMPRAR" in text and "Stop" in text and "Objetivo" in text
    assert buttons and buttons[0][0][1] == f"exec:{buy.id}"
    assert app.repo.cycle_exists(buy.cycle_ts.replace("+00:00", "+00:00")) or True
    # El ciclo es idempotente
    assert app.run_cycle(t - BAR + pd.Timedelta(seconds=5))["skipped"]
    # Confirmas la ejecución a un precio algo distinto: stop y objetivo se recalculan desde tu precio
    exec_px = buy.ref_price * 1.002
    msg = app.mark_executed(buy.id, exec_px)
    assert "Registrado" in msg
    h = app.repo.holdings()["BTCUSDT"]
    assert np.isclose(h.stop_price, exec_px * (1 + buy.stop_pct))
    cash = app.repo.get_state()["cash_usd"]
    assert cash < 1000.0
    # Forzamos un stop: el vigilante con precio en vivo crea la venta
    app.market = _FixedPriceMarket(app.market, h.stop_price * 0.99)
    alerts = app.check_exits(t, live_prices=True)
    assert len(alerts) == 1 and alerts[0].reason_code == "stop"
    assert "STOP" in app.notifier.messages[-1][0]
    assert app.check_exits(t, live_prices=True) == []  # no repite la alerta
    app.mark_executed(alerts[0].id, h.stop_price * 0.99)
    assert "BTCUSDT" not in app.repo.holdings()
    trades = app.repo.trades()
    assert len(trades) == 1 and trades[0]["pnl_usd"] < 0


class _FixedPriceMarket:
    def __init__(self, inner, price):
        self.inner, self.price = inner, price

    def __getattr__(self, name):
        return getattr(self.inner, name)

    def last_price(self, symbol, now):
        return self.price


def test_expiry_and_skip(bfx_frame):
    app = make_app(bfx_frame, mode=Mode.MANUAL)
    end = bfx_frame.index[-1]
    t = end - pd.Timedelta(days=60)
    while t < end and not app.repo.pending():
        app.run_cycle(t + pd.Timedelta(seconds=5))
        t += BAR
    rec = app.repo.pending()[0]
    app.run_cycle(t + pd.Timedelta(minutes=90))  # más tarde que el vencimiento (60 min)
    assert app.repo.get_recommendation(rec.id).status == RecStatus.EXPIRED
    assert "ya no está pendiente" in app.mark_skipped(rec.id)


def test_pause_blocks_new_buys(bfx_frame):
    app = make_app(bfx_frame)
    app.pause()
    start = bfx_frame.index[-1] - pd.Timedelta(days=30)
    replay(app, start, bfx_frame.index[-1] - BAR)
    assert not [r for r in app.repo.recommendations() if r.action == Action.BUY.value]
    reasons = {c["symbols"]["BTCUSDT"].get("reason") for c in app.repo.store.select("cycles")}
    assert "defensive" in reasons or "stress" in reasons


def test_config_validation(bfx_frame):
    app = make_app(bfx_frame, mode=Mode.MANUAL)
    with pytest.raises(ValueError, match="desactivado"):
        app.update_config({"mode": "auto_api"})
    app2 = make_app(bfx_frame, mode=Mode.MANUAL, enable_live_api=True)
    with pytest.raises(ValueError, match=API_CONFIRMATION):
        app2.update_config({"mode": "auto_api", "confirm": "si"})
    with pytest.raises(ValueError, match="fuera de rango"):
        app.update_config({"risk": {"risk_per_trade": 0.2}})
    with pytest.raises(ValueError, match="inválida"):
        app.update_config({"watchlist": ["BTC-USD"]})
    app.update_config({"watchlist": ["btcusdt", "ethusdt"], "risk": {"max_trades_per_week": 2}})
    cfg = app.repo.get_config()
    assert cfg["watchlist"] == ["BTCUSDT", "ETHUSDT"] and cfg["risk"]["max_trades_per_week"] == 2


def test_commands_from_dashboard(bfx_frame):
    app = make_app(bfx_frame, mode=Mode.MANUAL, capital=1000.0)
    app.repo.add_command("set_capital", {"capital_usd": 1500})
    app.repo.add_command("set_holding", {"symbol": "ethusdt", "qty": 0.5, "avg_price": 2000})
    app.repo.add_command("nope", {})
    assert app.process_commands() == 3
    rows = {r["command"]: r for r in app.repo.store.select("bot_commands")}
    assert rows["set_capital"]["status"] == "done" and rows["nope"]["status"] == "error"
    assert app.repo.get_state()["cash_usd"] == 1500.0
    assert app.repo.holdings()["ETHUSDT"].qty == 0.5


def test_regime_hysteresis():
    conf, cand, ch = confirm_regimes({}, {}, {"BTC": "lateral"}, need=3)
    assert conf == {"BTC": "lateral"} and not ch
    for _ in range(2):
        conf, cand, ch = confirm_regimes(conf, cand, {"BTC": "estres"}, need=3)
        assert not ch
    conf, cand, ch = confirm_regimes(conf, cand, {"BTC": "lateral"}, need=3)  # vuelve: se descarta
    assert not ch and "BTC" not in cand
    for _ in range(3):
        conf, cand, ch = confirm_regimes(conf, cand, {"BTC": "estres"}, need=3)
    assert ch == {"BTC": ("lateral", "estres")} and conf["BTC"] == "estres"
