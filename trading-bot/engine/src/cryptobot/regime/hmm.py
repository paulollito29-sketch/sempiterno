"""Detección de régimen de mercado con un HMM gaussiano de 3 estados.

Observaciones diarias: retorno logarítmico y log de la volatilidad realizada intradía.
Estados etiquetados automáticamente:
  - estrés  = el de mayor volatilidad media
  - alcista = entre los otros dos, el de mayor retorno medio
  - lateral = el restante

Para NO mirar el futuro se usan probabilidades FILTRADAS (algoritmo forward), nunca las
suavizadas ni Viterbi, y los parámetros se re-estiman solo con datos pasados (walk-forward).
Referencias: Hamilton (1989); Ardia, Bluteau & Rüede (2019) para cambios de régimen en BTC.
"""

from __future__ import annotations

import warnings
from dataclasses import dataclass

import numpy as np
import pandas as pd

from cryptobot.config import BAR_MINUTES, Regime

STATE_COLUMNS = ["p_bull", "p_range", "p_stress"]


def daily_observations(bars_20m: pd.DataFrame) -> pd.DataFrame:
    """Retorno diario y log-vol realizada (de retornos de 20m) por día UTC completo."""
    logret = np.log(bars_20m["close"]).diff()
    day = bars_20m.index.floor("1D")
    g = pd.DataFrame({"r": logret.to_numpy(), "day": day}).groupby("day")
    ret = g["r"].sum(min_count=36)
    rv = g["r"].apply(
        lambda x: np.sqrt(np.nansum(x.to_numpy() ** 2)) if x.notna().sum() >= 36 else np.nan
    )
    obs = pd.DataFrame({"ret": ret, "logvol": np.log(rv.clip(lower=1e-6))}).dropna()
    obs.index = (
        pd.DatetimeIndex(obs.index, tz="UTC", name="ts") if obs.index.tz is None else obs.index
    )
    return obs


@dataclass
class HMMRegimeModel:
    means: np.ndarray  # (k, d)
    variances: np.ndarray  # (k, d)
    startprob: np.ndarray  # (k,)
    transmat: np.ndarray  # (k, k)
    order: list[Regime]  # régimen de cada estado
    mu: np.ndarray  # estandarización
    sd: np.ndarray
    fitted_until: pd.Timestamp | None = None

    def _loglik(self, X: np.ndarray) -> np.ndarray:
        Z = (X - self.mu) / self.sd
        var = self.variances
        ll = -0.5 * (
            np.log(2 * np.pi * var).sum(axis=1)[None, :]
            + (((Z[:, None, :] - self.means[None, :, :]) ** 2) / var[None, :, :]).sum(axis=2)
        )
        return ll

    def filter(self, X: np.ndarray) -> np.ndarray:
        """Probabilidades filtradas P(estado_t | obs_1..t) — causal."""
        n = len(X)
        k = len(self.startprob)
        ll = self._loglik(X)
        alpha = np.empty((n, k))
        prev = self.startprob
        for t in range(n):
            pred = prev if t == 0 else prev @ self.transmat
            lik = np.exp(ll[t] - ll[t].max())
            a = pred * lik
            s = a.sum()
            a = a / s if s > 0 and np.isfinite(s) else np.full(k, 1.0 / k)
            alpha[t] = a
            prev = a
        return alpha

    def regime_probs(self, X: np.ndarray) -> np.ndarray:
        """Columnas en orden [alcista, lateral, estrés]."""
        alpha = self.filter(X)
        out = np.zeros((len(X), 3))
        for state, regime in enumerate(self.order):
            col = {Regime.BULL: 0, Regime.RANGE: 1, Regime.STRESS: 2}[regime]
            out[:, col] += alpha[:, state]
        return out


def _label_states(means_raw: np.ndarray) -> list[Regime]:
    """means_raw en escala original: columna 0 = retorno, columna 1 = log-vol."""
    k = len(means_raw)
    stress = int(np.argmax(means_raw[:, 1]))
    rest = [s for s in range(k) if s != stress]
    bull = max(rest, key=lambda s: means_raw[s, 0])
    order = [Regime.RANGE] * k
    order[stress] = Regime.STRESS
    order[bull] = Regime.BULL
    return order


def fit_hmm(
    obs: pd.DataFrame, n_states: int = 3, seed: int = 0, n_restarts: int = 4
) -> HMMRegimeModel | None:
    """Ajusta el HMM (hmmlearn) con varios reinicios y se queda con la mejor verosimilitud."""
    from hmmlearn.hmm import GaussianHMM

    X = obs[["ret", "logvol"]].to_numpy(dtype="float64")
    if len(X) < 120:
        return None
    mu, sd = X.mean(axis=0), X.std(axis=0) + 1e-12
    Z = (X - mu) / sd
    best, best_ll = None, -np.inf
    for r in range(n_restarts):
        model = GaussianHMM(
            n_components=n_states,
            covariance_type="diag",
            n_iter=200,
            tol=1e-4,
            random_state=seed + r,
            min_covar=1e-3,
        )
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                model.fit(Z)
                ll = model.score(Z)
            except Exception:
                continue
        if np.isfinite(ll) and ll > best_ll:
            best, best_ll = model, ll
    if best is None:
        return None
    covars = np.asarray(best.covars_)
    variances = np.array([np.diag(c) for c in covars]) if covars.ndim == 3 else covars
    means_raw = best.means_ * sd + mu
    return HMMRegimeModel(
        means=np.asarray(best.means_),
        variances=variances,
        startprob=np.asarray(best.startprob_),
        transmat=np.asarray(best.transmat_),
        order=_label_states(means_raw),
        mu=mu,
        sd=sd,
        fitted_until=obs.index[-1],
    )


def walk_forward_regimes(
    bars_20m: pd.DataFrame,
    refit_every_days: int = 30,
    min_train_days: int = 365,
    train_window_days: int = 1460,
    seed: int = 0,
) -> pd.DataFrame:
    """Probabilidades de régimen por barra de 20m, re-estimando el HMM cada mes solo con el pasado.

    La probabilidad del día D (que se conoce al cerrar D) se aplica a las barras del día D+1.
    """
    obs = daily_observations(bars_20m)
    daily = pd.DataFrame(np.nan, index=obs.index, columns=STATE_COLUMNS)
    if len(obs) > min_train_days:
        days = obs.index
        refit_points = list(range(min_train_days, len(days), refit_every_days))
        for j, start_pos in enumerate(refit_points):
            end_pos = refit_points[j + 1] if j + 1 < len(refit_points) else len(days)
            train = obs.iloc[max(0, start_pos - train_window_days) : start_pos]
            model = fit_hmm(train, seed=seed)
            if model is None:
                continue
            # Filtra desde el inicio de la ventana de entrenamiento hasta el fin del bloque.
            window = obs.iloc[max(0, start_pos - train_window_days) : end_pos]
            probs = model.regime_probs(window[["ret", "logvol"]].to_numpy())
            block = probs[-(end_pos - start_pos) :]
            daily.iloc[start_pos:end_pos] = block
    return daily_to_bars(daily, bars_20m.index)


def daily_to_bars(daily: pd.DataFrame, bar_index: pd.DatetimeIndex) -> pd.DataFrame:
    """Aplica la probabilidad del día D a las barras del día D+1 (sin mirar el futuro)."""
    shifted = daily.copy()
    shifted.index = shifted.index + pd.Timedelta(days=1)
    bar_day = bar_index.floor("1D")
    pos = shifted.index.searchsorted(bar_day, side="right") - 1
    arr = shifted.to_numpy()[np.clip(pos, 0, None)]
    arr[pos < 0] = np.nan
    out = pd.DataFrame(arr, index=bar_index, columns=STATE_COLUMNS)
    # Solo válido si el día aplicado es exactamente el anterior (no arrastrar días viejos).
    valid_day = shifted.index[np.clip(pos, 0, None)] == bar_day
    out.loc[~valid_day | (pos < 0)] = np.nan
    return out


def regime_label(p_bull: float, p_range: float, p_stress: float) -> Regime | None:
    vals = np.array([p_bull, p_range, p_stress], dtype="float64")
    if np.isnan(vals).any():
        return None
    return [Regime.BULL, Regime.RANGE, Regime.STRESS][int(np.argmax(vals))]


def current_regime_model(
    bars_20m: pd.DataFrame, train_window_days: int = 1460, seed: int = 0
) -> HMMRegimeModel | None:
    """Modelo para operar en vivo: ajustado con todos los días completos disponibles."""
    obs = daily_observations(bars_20m)
    if obs.empty:
        return None
    return fit_hmm(obs.iloc[-train_window_days:], seed=seed)


def live_regime_probs(
    model: HMMRegimeModel, bars_20m: pd.DataFrame, train_window_days: int = 1460
) -> pd.DataFrame:
    obs = daily_observations(bars_20m).iloc[-train_window_days:]
    probs = model.regime_probs(obs[["ret", "logvol"]].to_numpy())
    daily = pd.DataFrame(probs, index=obs.index, columns=STATE_COLUMNS)
    return daily_to_bars(daily, bars_20m.index)


BAR_TD = pd.Timedelta(minutes=BAR_MINUTES)
