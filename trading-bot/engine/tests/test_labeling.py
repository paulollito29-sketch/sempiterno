from __future__ import annotations

from dataclasses import replace

import numpy as np
import pandas as pd

from cryptobot.backtest.fills import decision_fill, first_barrier_touch, stop_fill
from cryptobot.config import COST_PROFILES, StrategyParams
from cryptobot.labeling.cusum import cusum_events
from cryptobot.labeling.triple_barrier import label_events

LEMON = COST_PROFILES["lemon"]
BINANCE = COST_PROFILES["binance"]


def _bars(closes, highs=None, lows=None):
    closes = np.asarray(closes, dtype=float)
    idx = pd.date_range("2024-01-01", periods=len(closes), freq="20min", tz="UTC")
    opens = np.concatenate([[closes[0]], closes[:-1]])
    return pd.DataFrame(
        {
            "open": opens,
            "high": highs if highs is not None else np.maximum(opens, closes),
            "low": lows if lows is not None else np.minimum(opens, closes),
            "close": closes,
        },
        index=idx,
    )


def test_cusum_triggers_and_resets():
    r = np.array([0.4, 0.4, 0.4, -0.2, -0.9, 0.1])
    idx, side = cusum_events(r, np.full(len(r), 1.0))
    assert idx.tolist() == [2, 4]
    assert side.tolist() == [1, -1]


def test_cusum_ignores_nan():
    r = np.array([np.nan, 0.6, 0.6, np.nan])
    idx, _ = cusum_events(r, np.array([1.0, 1.0, 1.0, np.nan]))
    assert idx.tolist() == [2]


def test_worst_open_for_manual_execution():
    opens = np.array([100, 101, 105, 99, 100.0])
    buy = decision_fill(opens, 0, LEMON, +1)  # demora 2 barras: ventana opens[1..3]
    assert buy.bar == 3 and buy.raw_price == 105
    assert buy.price > 105
    sell = decision_fill(opens, 0, LEMON, -1)
    assert sell.raw_price == 99 and sell.price < 99
    fast = decision_fill(opens, 0, BINANCE, +1)
    assert fast.bar == 1 and fast.raw_price == 101


def test_manual_stop_executes_after_alert_delay():
    opens = np.array([100, 100, 90, 85, 80.0])
    f = stop_fill(opens, 2, stop=95, costs=LEMON)  # Lemon: vende en la apertura siguiente
    assert f.bar == 3 and f.raw_price == 85
    g = stop_fill(
        opens, 2, stop=95, costs=BINANCE
    )  # stop en el exchange con gap: ejecuta en la apertura
    assert g.bar == 2 and g.raw_price == 90


def test_same_bar_touch_is_worst_case():
    highs = np.array([101, 120.0])
    lows = np.array([99, 80.0])
    assert first_barrier_touch(highs, lows, 0, 1, stop=90, target=110) == (1, "sl")


def _params(**kw):
    base = StrategyParams(horizon_days=1.0, tp_mult=1.0, sl_mult=1.0)
    return replace(base, **kw)


def test_triple_barrier_target_stop_and_time():
    p = _params()
    n = 300
    sigma = np.full(n, 0.05)  # σ_h = 5% (horizonte 1 día)
    up = _bars(np.concatenate([[100.0] * 5, np.linspace(100, 115, 50), [115.0] * (n - 55)]))
    down = _bars(np.concatenate([[100.0] * 5, np.linspace(100, 85, 50), [85.0] * (n - 55)]))
    flat = _bars(np.full(n, 100.0))
    lu = label_events(up, sigma, np.array([2]), p, BINANCE)
    ld = label_events(down, sigma, np.array([2]), p, BINANCE)
    lf = label_events(flat, sigma, np.array([2]), p, BINANCE)
    assert lu["reason"].iloc[0] == "tp" and lu["label"].iloc[0] == 1
    assert ld["reason"].iloc[0] == "sl" and ld["label"].iloc[0] == 0
    assert lf["reason"].iloc[0] == "time" and lf["label"].iloc[0] == 0  # plano: pierde los costos
    assert np.isclose(lf["net_ret"].iloc[0], (1 - BINANCE.per_side) / (1 + BINANCE.per_side) - 1)


def test_unresolved_events_are_dropped():
    p = _params(horizon_days=10.0)
    lab = label_events(_bars(np.full(100, 100.0)), np.full(100, 0.05), np.array([10]), p, BINANCE)
    assert lab.empty
