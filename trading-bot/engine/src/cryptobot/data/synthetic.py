"""Mercado sintético para pruebas y desarrollo sin conexión.

IMPORTANTE: los resultados sobre datos sintéticos NO son evidencia de que una estrategia
funcione en el mercado real. Sirven para probar el código (y para detectar fugas de
información: en un paseo aleatorio puro ninguna estrategia debería ganar tras costos).

Modelo: cadena de Markov de regímenes (alcista / lateral / bajista) a nivel diario, volatilidad
estocástica (log-AR(1)), shocks t-Student, estacionalidad intradía, saltos raros, y series de
funding y Fear & Greed coherentes con el precio.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd
from scipy.signal import lfilter

from cryptobot.data.schema import normalize_bars

BARS_5M_PER_DAY = 288
YEAR_5M = 365 * BARS_5M_PER_DAY


@dataclass(frozen=True)
class RegimeSpec:
    name: str
    mu_annual: float
    vol_annual: float
    mean_days: float


DEFAULT_REGIMES = (
    RegimeSpec("alcista", 0.60, 0.50, 90.0),
    RegimeSpec("lateral", 0.00, 0.40, 60.0),
    RegimeSpec("bajista", -0.60, 0.75, 45.0),
)
RANDOM_WALK = (RegimeSpec("ruido", 0.0, 0.55, 1e9),)


@dataclass
class SyntheticMarket:
    bars_5m: pd.DataFrame
    funding: pd.DataFrame  # índice ts (cada 8 h), columna funding_rate
    fng: pd.DataFrame  # índice ts (diario), columna fng
    regimes: pd.Series  # régimen verdadero por día (para evaluar el detector)


def generate_market(
    start: str = "2021-01-01",
    days: int = 730,
    seed: int = 7,
    start_price: float = 30_000.0,
    regimes: tuple[RegimeSpec, ...] = DEFAULT_REGIMES,
    jumps: bool = True,
) -> SyntheticMarket:
    rng = np.random.default_rng(seed)
    n = days * BARS_5M_PER_DAY
    index = pd.date_range(pd.Timestamp(start, tz="UTC"), periods=n, freq="5min", name="ts")

    # 1) Régimen diario (cadena de Markov con duración media por régimen)
    k = len(regimes)
    state = 0
    daily_state = np.empty(days, dtype=int)
    for d in range(days):
        daily_state[d] = state
        p_leave = 1.0 / regimes[state].mean_days
        if k > 1 and rng.random() < p_leave:
            state = int(rng.choice([s for s in range(k) if s != state]))
    state_5m = np.repeat(daily_state, BARS_5M_PER_DAY)
    mu = np.array([r.mu_annual for r in regimes])[state_5m] / YEAR_5M
    base_vol = np.array([r.vol_annual for r in regimes])[state_5m] / np.sqrt(YEAR_5M)

    # 2) Volatilidad estocástica: log h ~ AR(1) con vida media ~2 días
    phi = 1.0 - 1.0 / (2 * BARS_5M_PER_DAY)
    sd_x = 0.45
    eta = rng.standard_normal(n) * sd_x * np.sqrt(1 - phi**2)
    x = lfilter([1.0], [1.0, -phi], eta)
    h = np.exp(x - 0.5 * sd_x**2)

    # 3) Estacionalidad intradía (más volatilidad en horario de EE. UU.)
    hours = index.hour.to_numpy() + index.minute.to_numpy() / 60.0
    season = 1.0 + 0.25 * np.sin(2 * np.pi * (hours - 9.0) / 24.0)

    sigma = base_vol * np.sqrt(h) * season
    df_t = 4.0
    shocks = rng.standard_t(df_t, size=n) / np.sqrt(df_t / (df_t - 2.0))
    r = mu - 0.5 * sigma**2 + sigma * shocks

    if jumps:
        jump_mask = rng.random(n) < 1.0 / (BARS_5M_PER_DAY * 60)
        jump_size = np.where(rng.random(n) < 0.6, rng.uniform(-0.10, -0.04, n), rng.uniform(0.03, 0.07, n))
        r = r + jump_mask * jump_size

    # 4) Camino de precios y OHLC con 5 sub-pasos por vela
    close = start_price * np.exp(np.cumsum(r))
    open_ = np.concatenate([[start_price], close[:-1]])
    sub = rng.standard_normal((n, 4)) * (sigma[:, None] / np.sqrt(5))
    sub_path = open_[:, None] * np.exp(np.cumsum(sub, axis=1))
    # Fuerza el último punto a ser el cierre (puente): escala intermedia
    high = np.maximum.reduce([open_, close, sub_path.max(axis=1)])
    low = np.minimum.reduce([open_, close, sub_path.min(axis=1)])

    # 5) Volumen y flujo comprador-agresor (solo correlación contemporánea, sin poder predictivo)
    vol_season = 1.0 + 0.4 * np.sin(2 * np.pi * (hours - 9.0) / 24.0)
    volume = 50.0 * np.sqrt(h) * vol_season * rng.lognormal(0.0, 0.35, n) * (1 + 3 * np.abs(shocks) * 0.1)
    z = np.clip(r / np.maximum(sigma, 1e-12), -4, 4)
    taker_ratio = np.clip(0.5 + 0.08 * z + 0.03 * rng.standard_normal(n), 0.05, 0.95)
    taker_buy_base = volume * taker_ratio
    quote_volume = volume * close
    bars = pd.DataFrame(
        {
            "open": open_,
            "high": high,
            "low": low,
            "close": close,
            "volume": volume,
            "quote_volume": quote_volume,
            "trades": np.round(volume * 20.0),
            "taker_buy_base": taker_buy_base,
            "taker_buy_quote": taker_buy_base * close,
        },
        index=index,
    )
    bars = normalize_bars(bars)

    # 6) Funding cada 8 h: sube con la tendencia reciente (apalancamiento que persigue precio)
    close_s = pd.Series(close, index=index)
    f_index = pd.date_range(index[0], index[-1], freq="8h", tz="UTC", name="ts")
    px = close_s.reindex(f_index, method="ffill")
    ret7 = np.log(px / px.shift(21)).fillna(0.0)
    funding = 0.0001 + 0.0006 * np.tanh(ret7 / 0.15) + 0.00005 * rng.standard_normal(len(f_index))
    funding_df = pd.DataFrame({"funding_rate": funding.to_numpy()}, index=f_index)

    # 7) Fear & Greed diario (0-100), coherente con retorno de 30 días
    d_index = pd.date_range(index[0].normalize(), periods=days, freq="1D", tz="UTC", name="ts")
    dpx = close_s.resample("1D").last().reindex(d_index).ffill()
    ret30 = np.log(dpx / dpx.shift(30)).fillna(0.0)
    fng = np.clip(50 + 38 * np.tanh(ret30 / 0.25) + 6 * rng.standard_normal(days), 1, 99).round()
    fng_df = pd.DataFrame({"fng": fng.to_numpy()}, index=d_index)

    regime_names = pd.Series([regimes[s].name for s in daily_state], index=d_index, name="regime")
    return SyntheticMarket(bars_5m=bars, funding=funding_df, fng=fng_df, regimes=regime_names)


def generate_universe(
    symbols: list[str], start: str = "2021-01-01", days: int = 730, seed: int = 7, random_walk: bool = False
) -> dict[str, SyntheticMarket]:
    """Varias criptos sintéticas (independientes) con distintas semillas y precios."""
    prices = [30_000.0, 2_000.0, 40.0, 300.0, 0.6, 0.5, 0.08, 20.0, 10.0, 6.0]
    out: dict[str, SyntheticMarket] = {}
    for i, sym in enumerate(symbols):
        out[sym] = generate_market(
            start=start,
            days=days,
            seed=seed + 101 * i,
            start_price=prices[i % len(prices)],
            regimes=RANDOM_WALK if random_walk else DEFAULT_REGIMES,
            jumps=not random_walk,
        )
    return out
