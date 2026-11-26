from __future__ import annotations

import pytest

from cryptobot.config import STRATEGY_PRESETS
from cryptobot.data.candles import prepare_bars_20m
from cryptobot.data.synthetic import generate_market
from cryptobot.strategy.frame import build_symbol_frame


@pytest.fixture(scope="session")
def market():
    return generate_market(days=420, seed=11)


@pytest.fixture(scope="session")
def bars20(market):
    return prepare_bars_20m(market.bars_5m)


@pytest.fixture(scope="session")
def lemon_params():
    return STRATEGY_PRESETS["lemon"]


@pytest.fixture(scope="session")
def frame(market, bars20, lemon_params):
    return build_symbol_frame(
        "BTCUSDT", bars20, lemon_params, market.funding, market.fng, use_hmm=False
    )
