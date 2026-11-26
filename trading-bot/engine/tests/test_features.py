"""La prueba más importante: ninguna feature puede usar información del futuro."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from cryptobot.features.pipeline import FEATURE_COLUMNS, build_features
from cryptobot.regime.hmm import daily_observations, daily_to_bars, fit_hmm


def test_no_lookahead(market, bars20):
    full = build_features(bars20, market.funding, market.fng)
    n = len(bars20)
    for cut in (int(n * 0.55), int(n * 0.8), n - 37):
        t = bars20.index[cut]
        trunc_bars = bars20.iloc[: cut + 1]
        # funding y F&G también se cortan: solo existe lo publicado hasta el cierre de la barra
        close_t = t + pd.Timedelta(minutes=20)
        f = market.funding[market.funding.index <= close_t]
        g = market.fng[market.fng.index <= close_t]
        part = build_features(trunc_bars, f, g)
        a = full.loc[t, FEATURE_COLUMNS].astype(float)
        b = part.loc[t, FEATURE_COLUMNS].astype(float)
        pd.testing.assert_series_equal(a, b, check_names=False, rtol=1e-9, atol=1e-12)


def test_feature_values_are_sane(market, bars20):
    f = build_features(bars20, market.funding, market.fng)
    late = f.iloc[-5000:]
    assert set(np.unique(late["trend_vote"].dropna())) <= {-1.0, -0.5, 0.0, 0.5, 1.0}
    assert late["donchian_7d"].between(0, 1).all()
    assert (late["vol_ann"] > 0.1).all() and (late["vol_ann"] < 3).all()
    assert late["taker_imb_1d"].abs().max() < 0.5
    assert late[FEATURE_COLUMNS].notna().mean().min() > 0.9


@pytest.mark.slow
def test_hmm_filtered_probs_are_causal(bars20):
    obs = daily_observations(bars20)
    model = fit_hmm(obs.iloc[:300], seed=0)
    assert model is not None
    full = model.regime_probs(obs[["ret", "logvol"]].to_numpy())
    part = model.regime_probs(obs[["ret", "logvol"]].to_numpy()[:350])
    np.testing.assert_allclose(full[:350], part, atol=1e-12)
    assert np.allclose(full.sum(axis=1), 1.0)
    # la probabilidad del día D se aplica recién a las barras del día D+1
    daily = pd.DataFrame(full, index=obs.index, columns=["p_bull", "p_range", "p_stress"])
    per_bar = daily_to_bars(daily, bars20.index)
    day = obs.index[100]
    bars_next_day = per_bar[per_bar.index.floor("1D") == day + pd.Timedelta(days=1)]
    np.testing.assert_allclose(bars_next_day.iloc[0].to_numpy(), full[100])
