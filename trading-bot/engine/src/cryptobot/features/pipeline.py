"""Features sobre barras de 20 minutos, SIN mirar el futuro.

Cada valor en la barra t usa solo información disponible al cierre de t (t + 20 min).
Las features están normalizadas por la volatilidad del propio activo para que un único
modelo sirva para cualquier cripto (BTC, ETH, SOL, ...).

Grupos (ver docs/investigacion.md):
- Tendencia/momentum (Liu & Tsyvinski 2021; Detzel et al. 2021; Fieberg et al. 2025)
- Volatilidad (HAR: Corsi 2009) y rango intrabarra (Parkinson)
- Flujo comprador-agresor y volumen relativo (proxy de flujo de órdenes)
- Contexto: funding (apalancamiento), Fear & Greed (sentimiento), calendario
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from cryptobot.config import BAR_MINUTES, BARS_PER_DAY

D = BARS_PER_DAY
BAR_TD = pd.Timedelta(minutes=BAR_MINUTES)

MOMENTUM_HORIZONS_DAYS = {"4h": 1 / 6, "1d": 1.0, "3d": 3.0, "7d": 7.0, "30d": 30.0}
VOTE_HORIZONS = ("1d", "3d", "7d", "30d")

FEATURE_COLUMNS: list[str] = [
    # tendencia
    "mom_z_4h",
    "mom_z_1d",
    "mom_z_3d",
    "mom_z_7d",
    "mom_z_30d",
    "trend_vote",
    "px_sma_7d",
    "px_sma_30d",
    "ema_slope_7d",
    "donchian_7d",
    "dist_high_30d",
    # volatilidad
    "vol_ann",
    "vol_ratio_1d_7d",
    "vol_ratio_7d_30d",
    "vol_z_1y",
    "park_ratio_1d",
    # flujo / volumen
    "taker_imb_4h",
    "taker_imb_1d",
    "rel_volume_1d",
    "vwap_dev_1d",
    # contexto
    "funding_rate",
    "funding_z_30d",
    "fng_level",
    "fng_chg_7d",
    "hour_sin",
    "hour_cos",
    "dow_sin",
    "dow_cos",
    # evento (se completa al detectar eventos CUSUM)
    "event_side",
]


def _rolling_sum(s: pd.Series, n: int, min_frac: float = 0.8) -> pd.Series:
    return s.rolling(n, min_periods=max(1, int(n * min_frac))).sum()


def daily_vol_forecast(logret: pd.Series) -> pd.DataFrame:
    """Volatilidad diaria (desvío de retornos diarios) estimada con retornos de 20m.

    Pronóstico tipo HAR con pesos fijos (0.4 diario, 0.35 semanal, 0.25 mensual): la
    volatilidad es persistente y mucho más predecible que la dirección del precio.
    """
    v1 = logret.rolling(D, min_periods=D // 2).std() * np.sqrt(D)
    v7 = logret.rolling(7 * D, min_periods=3 * D).std() * np.sqrt(D)
    v30 = logret.rolling(30 * D, min_periods=10 * D).std() * np.sqrt(D)
    v7f = v7.fillna(v1)
    v30f = v30.fillna(v7f)
    sigma = 0.4 * v1 + 0.35 * v7f + 0.25 * v30f
    return pd.DataFrame({"vol_1d": v1, "vol_7d": v7, "vol_30d": v30, "sigma_d": sigma})


def _asof(
    values: pd.DataFrame | None, target_times: pd.DatetimeIndex, lag: pd.Timedelta
) -> pd.DataFrame:
    """Último valor conocido a cada `target_time` (valor publicado en ts es usable desde ts+lag)."""
    if values is None or values.empty:
        return pd.DataFrame(index=target_times)
    v = values.copy()
    v.index = v.index + lag
    v = v[~v.index.duplicated(keep="last")].sort_index()
    pos = v.index.searchsorted(target_times, side="right") - 1  # último ts <= t
    arr = v.to_numpy(dtype="float64")[np.clip(pos, 0, None)]
    arr[pos < 0] = np.nan
    return pd.DataFrame(arr, index=target_times, columns=v.columns)


def build_features(
    bars: pd.DataFrame,
    funding: pd.DataFrame | None = None,
    fng: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Devuelve un DataFrame con FEATURE_COLUMNS + columnas auxiliares (close, sigma_d, logret...)."""
    close = bars["close"]
    high, low, volume = bars["high"], bars["low"], bars["volume"]
    logc = np.log(close)
    logret = logc.diff()
    out = pd.DataFrame(index=bars.index)
    out["close"] = close
    out["logret"] = logret

    vols = daily_vol_forecast(logret)
    sigma = vols["sigma_d"]
    out["sigma_d"] = sigma

    # ---- Tendencia / momentum (retornos normalizados por la vol del horizonte)
    for name, h_days in MOMENTUM_HORIZONS_DAYS.items():
        n = max(1, round(h_days * D))
        ret = logc - logc.shift(n)
        out[f"ret_{name}"] = ret
        out[f"mom_z_{name}"] = ret / (sigma * np.sqrt(h_days))
    votes = np.sign(out[[f"ret_{h}" for h in VOTE_HORIZONS]])
    out["trend_vote"] = votes.mean(axis=1, skipna=False)

    sma7 = close.rolling(7 * D, min_periods=5 * D).mean()
    sma30 = close.rolling(30 * D, min_periods=20 * D).mean()
    out["px_sma_7d"] = np.log(close / sma7) / sigma
    out["px_sma_30d"] = np.log(close / sma30) / sigma
    ema7 = close.ewm(span=7 * D, adjust=False, min_periods=3 * D).mean()
    out["ema_slope_7d"] = np.log(ema7 / ema7.shift(D)) / sigma
    hi7 = high.rolling(7 * D, min_periods=5 * D).max()
    lo7 = low.rolling(7 * D, min_periods=5 * D).min()
    out["donchian_7d"] = (close - lo7) / (hi7 - lo7)
    hi30 = high.rolling(30 * D, min_periods=20 * D).max()
    out["dist_high_30d"] = np.log(close / hi30) / sigma

    # ---- Volatilidad
    out["vol_ann"] = sigma * np.sqrt(365)
    out["vol_ratio_1d_7d"] = vols["vol_1d"] / vols["vol_7d"]
    out["vol_ratio_7d_30d"] = vols["vol_7d"] / vols["vol_30d"]
    lv = np.log(vols["vol_7d"])
    lv_mean = lv.rolling(365 * D, min_periods=90 * D).mean()
    lv_std = lv.rolling(365 * D, min_periods=90 * D).std()
    out["vol_z_1y"] = (lv - lv_mean) / lv_std
    park_var = (np.log(high / low) ** 2) / (4 * np.log(2))
    park_1d = np.sqrt(park_var.rolling(D, min_periods=D // 2).mean() * D)
    out["park_ratio_1d"] = park_1d / vols["vol_1d"]

    # ---- Flujo comprador-agresor y volumen relativo
    tb = bars["taker_buy_base"]
    out["taker_imb_4h"] = _rolling_sum(tb, 12) / _rolling_sum(volume, 12) - 0.5
    out["taker_imb_1d"] = _rolling_sum(tb, D) / _rolling_sum(volume, D) - 0.5
    vol_1d_sum = _rolling_sum(volume, D)
    vol_30d_avg = _rolling_sum(volume, 30 * D, 0.6) / 30.0
    out["rel_volume_1d"] = np.log((vol_1d_sum + 1e-12) / (vol_30d_avg + 1e-12))
    typical = (high + low + close) / 3.0
    vwap = _rolling_sum(typical * volume, D) / _rolling_sum(volume, D)
    out["vwap_dev_1d"] = np.log(close / vwap) / sigma

    # ---- Contexto: funding y sentimiento (merge "as-of" al cierre de la barra)
    close_times = bars.index + BAR_TD
    if funding is not None and not funding.empty:
        f = funding[["funding_rate"]].astype("float64").sort_index()
        f_mean = f["funding_rate"].rolling(90, min_periods=30).mean()
        f_std = f["funding_rate"].rolling(90, min_periods=30).std()
        f = f.assign(funding_z_30d=(f["funding_rate"] - f_mean) / f_std)
        fa = _asof(f, close_times, pd.Timedelta(0))
        out["funding_rate"] = fa["funding_rate"].to_numpy() * 1e4  # en puntos básicos
        out["funding_z_30d"] = fa["funding_z_30d"].to_numpy()
    else:
        out["funding_rate"] = np.nan
        out["funding_z_30d"] = np.nan
    if fng is not None and not fng.empty:
        g = fng[["fng"]].astype("float64").sort_index()
        g = g.assign(fng_chg_7d=g["fng"] - g["fng"].shift(7))
        # El valor del día D se usa recién desde D+1 (conservador).
        ga = _asof(g, close_times, pd.Timedelta(days=1))
        out["fng"] = ga["fng"].to_numpy()
        out["fng_level"] = (ga["fng"].to_numpy() - 50.0) / 50.0
        out["fng_chg_7d"] = ga["fng_chg_7d"].to_numpy() / 50.0
    else:
        out["fng"] = np.nan
        out["fng_level"] = np.nan
        out["fng_chg_7d"] = np.nan

    # ---- Calendario (hora y día del cierre de la barra)
    hour = close_times.hour.to_numpy() + close_times.minute.to_numpy() / 60.0
    dow = close_times.day_of_week.to_numpy()
    out["hour_sin"] = np.sin(2 * np.pi * hour / 24)
    out["hour_cos"] = np.cos(2 * np.pi * hour / 24)
    out["dow_sin"] = np.sin(2 * np.pi * dow / 7)
    out["dow_cos"] = np.cos(2 * np.pi * dow / 7)

    out["event_side"] = 0.0
    out = out.replace([np.inf, -np.inf], np.nan)
    return out


def data_ok(row: pd.Series) -> bool:
    """¿La barra tiene lo mínimo para decidir? (precio, vol y tendencia completos)."""
    needed = ("close", "sigma_d", "trend_vote", "mom_z_30d")
    return all(pd.notna(row.get(c)) for c in needed) and row["sigma_d"] > 0
