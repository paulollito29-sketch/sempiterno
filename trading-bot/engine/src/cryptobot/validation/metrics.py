"""Métricas de desempeño y estadística anti-sobreajuste.

- Sharpe, Sortino, Calmar, drawdown máximo, métricas por operación.
- PSR (Probabilistic Sharpe Ratio) y DSR (Deflated Sharpe Ratio): Bailey & López de Prado (2012, 2014).
- PBO (Probability of Backtest Overfitting) con CSCV: Bailey, Borwein, López de Prado & Zhu (2017).
- Bootstrap de operaciones para la distribución del drawdown.
- Calibración de probabilidades (¿el 45% es 45%?) y puntaje de Brier.
"""

from __future__ import annotations

from itertools import combinations, pairwise
from math import e, sqrt

import numpy as np
import pandas as pd
from scipy.stats import kurtosis, norm, skew

EULER_GAMMA = 0.5772156649015329
PERIODS_PER_YEAR = 365  # retornos diarios, mercado 24/7


def max_drawdown(equity: pd.Series | np.ndarray) -> float:
    eq = np.asarray(equity, dtype="float64")
    if len(eq) == 0:
        return 0.0
    peak = np.maximum.accumulate(eq)
    return float(np.min(eq / peak - 1.0))


def sharpe(returns: np.ndarray, periods: int = PERIODS_PER_YEAR) -> float:
    r = np.asarray(returns, dtype="float64")
    r = r[np.isfinite(r)]
    if len(r) < 2 or r.std(ddof=1) == 0:
        return 0.0
    return float(r.mean() / r.std(ddof=1) * sqrt(periods))


def probabilistic_sharpe_ratio(returns: np.ndarray, sr_benchmark: float = 0.0) -> float:
    """PSR: probabilidad de que el Sharpe verdadero supere `sr_benchmark` (por período)."""
    r = np.asarray(returns, dtype="float64")
    r = r[np.isfinite(r)]
    n = len(r)
    if n < 3 or r.std(ddof=1) == 0:
        return 0.0
    sr = r.mean() / r.std(ddof=1)
    g3 = skew(r)
    g4 = kurtosis(r, fisher=False)
    denom = 1 - g3 * sr + (g4 - 1) / 4 * sr**2
    if denom <= 0:
        return 0.0
    return float(norm.cdf((sr - sr_benchmark) * sqrt(n - 1) / sqrt(denom)))


def expected_max_sharpe(trial_sharpes: np.ndarray) -> float:
    """Sharpe máximo esperado por azar entre N pruebas (por período)."""
    srs = np.asarray(trial_sharpes, dtype="float64")
    srs = srs[np.isfinite(srs)]
    n = len(srs)
    if n < 2:
        return 0.0
    var = srs.var(ddof=1)
    return float(
        sqrt(var)
        * ((1 - EULER_GAMMA) * norm.ppf(1 - 1 / n) + EULER_GAMMA * norm.ppf(1 - 1 / (n * e)))
    )


def deflated_sharpe_ratio(returns: np.ndarray, trial_sharpes: np.ndarray) -> float:
    """DSR: PSR contra el Sharpe que se esperaría por azar dado el número de pruebas."""
    return probabilistic_sharpe_ratio(returns, expected_max_sharpe(trial_sharpes))


def per_period_sharpe(returns: np.ndarray) -> float:
    r = np.asarray(returns, dtype="float64")
    r = r[np.isfinite(r)]
    if len(r) < 2 or r.std(ddof=1) == 0:
        return 0.0
    return float(r.mean() / r.std(ddof=1))


def pbo_cscv(perf: np.ndarray, n_splits: int = 16) -> dict[str, float]:
    """PBO por validación cruzada combinatoria simétrica.

    perf: matriz T x N (retornos por período de N configuraciones probadas).
    Devuelve la probabilidad de que la mejor configuración dentro de muestra quede por
    debajo de la mediana fuera de muestra.
    """
    M = np.asarray(perf, dtype="float64")
    T, N = M.shape
    if N < 2 or n_splits * 2 > T:
        return {"pbo": float("nan"), "n_combinations": 0}
    S = n_splits - (n_splits % 2)
    size = T // S
    M = M[: size * S]
    blocks = M.reshape(S, size, N)
    sums = np.nansum(blocks, axis=1)
    sqs = np.nansum(blocks**2, axis=1)
    counts = np.sum(np.isfinite(blocks), axis=1)
    combos = list(combinations(range(S), S // 2))
    member = np.zeros((len(combos), S))
    for c, combo in enumerate(combos):
        member[c, list(combo)] = 1.0

    def _sharpe(mem: np.ndarray) -> np.ndarray:
        s, q, k = mem @ sums, mem @ sqs, mem @ counts
        mean = s / np.maximum(k, 1)
        var = q / np.maximum(k, 1) - mean**2
        return mean / np.sqrt(np.maximum(var, 1e-18))

    sr_is = _sharpe(member)
    sr_oos = _sharpe(1.0 - member)
    best = np.argmax(sr_is, axis=1)
    # Rango relativo de la mejor IS dentro de OOS (1 = peor ... N = mejor)
    ranks = sr_oos.argsort(axis=1).argsort(axis=1) + 1
    w = ranks[np.arange(len(combos)), best] / (N + 1)
    lam = np.log(w / (1 - w))
    return {
        "pbo": float(np.mean(lam <= 0)),
        "n_combinations": len(combos),
        "median_logit": float(np.median(lam)),
    }


def bootstrap_max_drawdown(
    trade_returns: np.ndarray, n_boot: int = 2000, seed: int = 0
) -> dict[str, float]:
    r = np.asarray(trade_returns, dtype="float64")
    r = r[np.isfinite(r)]
    if len(r) < 5:
        return {"p05": float("nan"), "p50": float("nan"), "p95": float("nan")}
    rng = np.random.default_rng(seed)
    samples = rng.choice(r, size=(n_boot, len(r)), replace=True)
    eq = np.cumprod(1 + samples, axis=1)
    peak = np.maximum.accumulate(eq, axis=1)
    dd = (eq / peak - 1).min(axis=1)
    return {
        "p05": float(np.percentile(dd, 5)),
        "p50": float(np.percentile(dd, 50)),
        "p95": float(np.percentile(dd, 95)),
    }


def calibration_table(p: np.ndarray, y: np.ndarray, bins: int = 5) -> list[dict[str, float]]:
    p = np.asarray(p, dtype="float64")
    y = np.asarray(y, dtype="float64")
    ok = np.isfinite(p) & np.isfinite(y)
    p, y = p[ok], y[ok]
    if len(p) == 0:
        return []
    edges = np.unique(np.quantile(p, np.linspace(0, 1, bins + 1)))
    rows = []
    for lo, hi in pairwise(edges):
        m = (p >= lo) & ((p < hi) | (hi == edges[-1]))
        if m.sum() == 0:
            continue
        rows.append(
            {
                "p_min": float(lo),
                "p_max": float(hi),
                "p_mean": float(p[m].mean()),
                "hit_rate": float(y[m].mean()),
                "n": int(m.sum()),
            }
        )
    return rows


def brier_score(p: np.ndarray, y: np.ndarray) -> float:
    p = np.asarray(p, dtype="float64")
    y = np.asarray(y, dtype="float64")
    ok = np.isfinite(p) & np.isfinite(y)
    return float(np.mean((p[ok] - y[ok]) ** 2)) if ok.any() else float("nan")


def equity_metrics(
    equity: pd.Series, trades: pd.DataFrame | None = None, exposure: float | None = None
) -> dict[str, float]:
    """Métricas sobre una curva de capital DIARIA."""
    eq = equity.dropna()
    out: dict[str, float] = {}
    if len(eq) < 2:
        return {"total_return": 0.0, "cagr": 0.0, "sharpe": 0.0, "max_drawdown": 0.0, "n_trades": 0}
    r = eq.pct_change().dropna().to_numpy()
    years = max((eq.index[-1] - eq.index[0]).days / 365.0, 1e-9)
    total = float(eq.iloc[-1] / eq.iloc[0] - 1)
    out["total_return"] = total
    out["cagr"] = float((1 + total) ** (1 / years) - 1) if total > -1 else -1.0
    out["ann_vol"] = float(r.std(ddof=1) * sqrt(PERIODS_PER_YEAR))
    out["sharpe"] = sharpe(r)
    downside = np.sqrt(np.mean(np.minimum(r, 0) ** 2))
    out["sortino"] = float(r.mean() / downside * sqrt(PERIODS_PER_YEAR)) if downside > 0 else 0.0
    out["max_drawdown"] = max_drawdown(eq.to_numpy())
    out["calmar"] = (
        float(out["cagr"] / abs(out["max_drawdown"])) if out["max_drawdown"] < 0 else 0.0
    )
    out["psr"] = probabilistic_sharpe_ratio(r)
    out["t_stat"] = float(per_period_sharpe(r) * sqrt(len(r)))
    out["years"] = years
    if exposure is not None:
        out["exposure"] = float(exposure)
    if trades is not None and len(trades) > 0:
        tr = trades["net_ret"].to_numpy(dtype="float64")
        wins, losses = tr[tr > 0], tr[tr <= 0]
        out["n_trades"] = len(tr)
        out["trades_per_month"] = float(len(tr) / (years * 12))
        out["win_rate"] = float((tr > 0).mean())
        out["avg_win"] = float(wins.mean()) if len(wins) else 0.0
        out["avg_loss"] = float(losses.mean()) if len(losses) else 0.0
        out["profit_factor"] = (
            float(wins.sum() / -losses.sum()) if losses.sum() < 0 else float("inf")
        )
        if "hold_days" in trades:
            out["avg_hold_days"] = float(trades["hold_days"].mean())
    else:
        out["n_trades"] = 0
    return out
