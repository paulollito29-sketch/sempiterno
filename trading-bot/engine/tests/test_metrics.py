from __future__ import annotations

import itertools

import numpy as np
import pandas as pd

from cryptobot.validation.metrics import (
    bootstrap_max_drawdown,
    calibration_table,
    deflated_sharpe_ratio,
    equity_metrics,
    expected_max_sharpe,
    max_drawdown,
    pbo_cscv,
    probabilistic_sharpe_ratio,
    sharpe,
)
from cryptobot.validation.splits import purged_kfold, purged_train_mask, walk_forward_windows


def test_max_drawdown_and_sharpe():
    assert max_drawdown([100, 120, 90, 130]) == 90 / 120 - 1
    rng = np.random.default_rng(0)
    r = rng.normal(0.001, 0.01, 2000)
    assert abs(sharpe(r) - 0.1 * np.sqrt(365)) < 0.6


def test_psr_and_dsr():
    rng = np.random.default_rng(1)
    good = rng.normal(0.002, 0.01, 1500)
    noise = rng.normal(0.0, 0.01, 1500)
    assert probabilistic_sharpe_ratio(good) > 0.99
    assert (
        0.05 < probabilistic_sharpe_ratio(noise) < 0.95 or probabilistic_sharpe_ratio(noise) < 0.99
    )
    trials = rng.normal(0, 0.03, 50)
    assert expected_max_sharpe(trials) > 0
    assert deflated_sharpe_ratio(good, trials) <= probabilistic_sharpe_ratio(good)


def test_pbo_noise_vs_real_signal():
    rng = np.random.default_rng(2)
    noise = rng.normal(0, 0.01, (1600, 10))
    res_noise = pbo_cscv(noise, n_splits=10)
    assert 0.25 < res_noise["pbo"] < 0.75  # sin habilidad, la mejor IS es azar fuera de muestra
    signal = noise.copy()
    signal[:, 0] += 0.004  # una configuración con ventaja real y persistente
    res_sig = pbo_cscv(signal, n_splits=10)
    assert res_sig["pbo"] < 0.05


def test_bootstrap_and_calibration():
    rng = np.random.default_rng(3)
    dd = bootstrap_max_drawdown(rng.normal(0.0, 0.02, 200), n_boot=300)
    assert dd["p05"] <= dd["p50"] <= dd["p95"] <= 0
    p = rng.uniform(0, 1, 1000)
    y = (rng.uniform(0, 1, 1000) < p).astype(int)
    table = calibration_table(p, y, bins=5)
    assert sum(r["n"] for r in table) == 1000
    for r in table:
        assert abs(r["p_mean"] - r["hit_rate"]) < 0.12


def test_equity_metrics():
    idx = pd.date_range("2024-01-01", periods=366, freq="1D", tz="UTC")
    eq = pd.Series(np.linspace(100, 150, 366), index=idx)
    m = equity_metrics(eq)
    assert abs(m["total_return"] - 0.5) < 1e-9
    assert abs(m["cagr"] - 0.5) < 0.01
    assert m["max_drawdown"] == 0


def test_walk_forward_and_purging():
    start = pd.Timestamp("2021-01-01", tz="UTC")
    end = pd.Timestamp("2023-01-01", tz="UTC")
    w = walk_forward_windows(start, end, test_days=90, min_train_days=365)
    assert w[0].test_start == start + pd.Timedelta(days=365)
    assert all(a.test_end == b.test_start for a, b in itertools.pairwise(w))
    t_end = pd.Series(pd.to_datetime(["2021-12-20", "2022-01-05"], utc=True))
    mask = purged_train_mask(t_end, pd.Timestamp("2022-01-01", tz="UTC"))
    assert mask.tolist() == [True, False]  # la etiqueta que termina después del corte se purga


def test_purged_kfold_no_overlap():
    t0 = pd.Series(pd.date_range("2022-01-01", periods=200, freq="1D", tz="UTC"))
    t1 = t0 + pd.Timedelta(days=5)
    for train, test in purged_kfold(t0, t1, n_splits=5):
        test_start, test_end = t0.iloc[test].min(), t1.iloc[test].max()
        tr_t0, tr_t1 = t0.iloc[train], t1.iloc[train]
        overlap = (tr_t1 >= test_start) & (tr_t0 <= test_end)
        assert not overlap.any()
