"""Configuración central: perfiles de costos, parámetros de estrategia y límites de riesgo.

Todos los porcentajes se expresan como fracción (0.01 = 1%).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, fields, replace
from enum import StrEnum
from pathlib import Path
from typing import Any

from pydantic_settings import BaseSettings, SettingsConfigDict

BAR_MINUTES = 20
BARS_PER_DAY = 24 * 60 // BAR_MINUTES  # 72 barras de 20 minutos por día
BASE_TIMEFRAME = "5m"  # velas que se descargan; las de 20m se arman a partir de estas
DAYS_PER_YEAR = 365  # cripto opera 24/7


class Mode(StrEnum):
    """Cómo se ejecutan las recomendaciones."""

    MANUAL = "manual"  # Lemon: el bot recomienda y tú ejecutas en la app
    PAPER = "paper"  # simula seguir cada recomendación (sin dinero real)
    SEMI_AUTO_API = "semi_auto_api"  # recomienda con botón [Ejecutar] vía API
    AUTO_API = "auto_api"  # ejecuta solo vía API (requiere habilitación explícita)


class Action(StrEnum):
    BUY = "COMPRAR"
    SELL = "VENDER"
    REDUCE = "REDUCIR"
    HOLD = "MANTENER"
    STAY_CASH = "QUEDATE_EN_USDT"
    NONE = "SIN_CAMBIOS"


class Regime(StrEnum):
    BULL = "alcista"
    RANGE = "lateral"
    STRESS = "estres"


@dataclass(frozen=True)
class CostProfile:
    """Costos y fricciones de ejecución de un lugar de operación."""

    name: str
    fee: float  # comisión por lado
    half_spread: float  # medio spread por lado
    slippage: float  # deslizamiento por lado
    exec_delay_bars: int  # barras de 20m entre la decisión y la ejecución
    exec_price_mode: str  # "next_open" | "worst_open" (peor apertura dentro de la demora)
    stops_on_exchange: bool  # True: el stop vive en el exchange; False: alerta + ejecución manual
    alert_delay_bars: int  # barras entre una alerta (stop/objetivo) y tu ejecución
    stop_slippage: float  # deslizamiento extra al salir por stop

    @property
    def per_side(self) -> float:
        return self.fee + self.half_spread + self.slippage

    @property
    def round_trip(self) -> float:
        return 2.0 * self.per_side


COST_PROFILES: dict[str, CostProfile] = {
    # Lemon: ~0.5% por compra/venta (no oficial; mídelo con la calculadora del panel),
    # spread adicional supuesto, ejecución manual con demora y sin stops automáticos.
    "lemon": CostProfile(
        name="lemon",
        fee=0.005,
        half_spread=0.001,
        slippage=0.0005,
        exec_delay_bars=2,
        exec_price_mode="worst_open",
        stops_on_exchange=False,
        alert_delay_bars=1,
        stop_slippage=0.002,
    ),
    # Binance spot vía API (taker 0.1%).
    "binance": CostProfile(
        name="binance",
        fee=0.001,
        half_spread=0.0001,
        slippage=0.0002,
        exec_delay_bars=0,
        exec_price_mode="next_open",
        stops_on_exchange=True,
        alert_delay_bars=0,
        stop_slippage=0.0005,
    ),
    # Binance pagando comisiones con BNB (0.075%).
    "binance_bnb": CostProfile(
        name="binance_bnb",
        fee=0.00075,
        half_spread=0.0001,
        slippage=0.0002,
        exec_delay_bars=0,
        exec_price_mode="next_open",
        stops_on_exchange=True,
        alert_delay_bars=0,
        stop_slippage=0.0005,
    ),
}


@dataclass(frozen=True)
class StrategyParams:
    """Parámetros de la estrategia (se validan en walk-forward, no se optimizan a ciegas)."""

    horizon_days: float = 14.0  # barrera vertical (tiempo máximo de la operación)
    tp_mult: float = 1.6  # objetivo = tp_mult * vol del horizonte
    sl_mult: float = 0.8  # stop = sl_mult * vol del horizonte
    cusum_k: float = 1.5  # umbral del filtro CUSUM en múltiplos de la vol diaria
    entry_vote: float = 0.5  # voto de tendencia mínimo para comprar
    exit_vote: float = -0.5  # voto de tendencia que dispara la venta (histéresis)
    min_edge: float = 0.002  # ventaja neta esperada mínima por operación
    range_threshold_bump: float = 0.05  # exigencia extra de probabilidad en régimen lateral
    exit_on_stress: bool = True  # vender si el régimen pasa a estrés
    stress_prob_exit: float = 0.6
    euphoria_funding_z: float = 2.0  # funding muy por encima de lo normal => euforia
    euphoria_fng: float = 80.0  # Fear & Greed >= 80 => codicia extrema
    reduce_fraction: float = 0.5  # cuánto vender en una recomendación REDUCIR
    use_meta_model: bool = True  # False => solo la regla de tendencia (baseline)

    @property
    def horizon_bars(self) -> int:
        from math import ceil

        return ceil(self.horizon_days * BARS_PER_DAY)


STRATEGY_PRESETS: dict[str, StrategyParams] = {
    # Costos altos => operaciones de semanas, pocas y bien elegidas.
    # Salida por tendencia solo si TODOS los horizontes se dan vuelta (evita pagar ~1.2% por ruido).
    "lemon": StrategyParams(
        horizon_days=14.0, tp_mult=1.6, sl_mult=0.8, cusum_k=1.5, exit_vote=-1.0
    ),
    # Costos bajos => horizonte de días.
    "binance": StrategyParams(horizon_days=3.0, tp_mult=2.0, sl_mult=1.0, cusum_k=1.0),
    "binance_bnb": StrategyParams(horizon_days=3.0, tp_mult=2.0, sl_mult=1.0, cusum_k=1.0),
}


@dataclass(frozen=True)
class RiskLimits:
    """Reglas duras: el modelo nunca puede saltárselas."""

    risk_per_trade: float = 0.01  # pérdida máxima por operación si toca el stop
    max_position: float = 0.25  # máximo por cripto (fracción del capital)
    max_total_exposure: float = 0.80  # máximo invertido; el resto queda en USDT
    vol_target_annual: float = 0.40  # tope por volatilidad: posición <= objetivo / vol del activo
    kelly_fraction: float = 0.5  # nunca más de medio Kelly
    max_trades_per_week: int = 4  # nuevas compras por semana (control de costos)
    daily_loss_limit: float = 0.03  # pérdida diaria que activa el modo defensivo
    max_drawdown: float = 0.15  # caída desde el máximo que activa el modo defensivo
    min_trade_usd: float = 10.0  # no recomendar operaciones más chicas


def dataclass_from_dict(cls: type, data: dict[str, Any] | None, base: Any | None = None) -> Any:
    """Construye un dataclass ignorando claves desconocidas (útil para configs guardadas)."""
    base = base if base is not None else cls()
    if not data:
        return base
    valid = {f.name for f in fields(cls)}
    return replace(base, **{k: v for k, v in data.items() if k in valid})


def to_dict(obj: Any) -> dict[str, Any]:
    return asdict(obj)


class Settings(BaseSettings):
    """Variables de entorno (prefijo CRYPTOBOT_). Ver .env.example."""

    model_config = SettingsConfigDict(env_prefix="CRYPTOBOT_", env_file=".env", extra="ignore")

    data_dir: Path = Path("data")
    models_dir: Path = Path("models")
    # Criptos que el bot vigila y recomienda (las que operas en Lemon).
    watchlist: str = "BTCUSDT,ETHUSDT,SOLUSDT"
    # Universo para entrenar el modelo global (criptos líquidas).
    universe: str = (
        "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT,XRPUSDT,ADAUSDT,DOGEUSDT,AVAXUSDT,LINKUSDT,DOTUSDT"
    )
    mode: Mode = Mode.MANUAL
    cost_profile: str = "lemon"
    capital_usd: float = 1000.0
    history_start: str = "2020-01-01"

    # Fuentes de datos públicas (sin claves).
    binance_data_url: str = "https://data-api.binance.vision"
    binance_futures_url: str = "https://fapi.binance.com"
    binance_vision_url: str = "https://data.binance.vision"
    fng_url: str = "https://api.alternative.me/fng/"

    # Persistencia: "sqlite" (local) o "supabase" (panel web).
    store: str = "sqlite"
    sqlite_path: Path = Path("data/cryptobot.db")
    supabase_url: str | None = None
    supabase_service_key: str | None = None

    # Telegram (avisos al celular).
    telegram_bot_token: str | None = None
    telegram_chat_id: str | None = None

    summary_hour_utc: int = 12
    rec_expiry_minutes: int = 60
    watcher_interval_s: int = 15
    command_poll_s: int = 10

    # Conector API (Fase 5). Desactivado por defecto.
    enable_live_api: bool = False
    api_exchange: str = "binance"
    api_key: str | None = None
    api_secret: str | None = None
    api_sandbox: bool = True

    log_level: str = "INFO"

    @property
    def watchlist_symbols(self) -> list[str]:
        return [s.strip().upper() for s in self.watchlist.split(",") if s.strip()]

    @property
    def universe_symbols(self) -> list[str]:
        syms = [s.strip().upper() for s in self.universe.split(",") if s.strip()]
        for s in self.watchlist_symbols:  # la watchlist siempre forma parte del universo
            if s not in syms:
                syms.append(s)
        return syms

    def costs(self) -> CostProfile:
        return COST_PROFILES[self.cost_profile]

    def strategy(self) -> StrategyParams:
        return STRATEGY_PRESETS.get(self.cost_profile, StrategyParams())


def quote_asset(symbol: str) -> str:
    for q in ("USDT", "USDC", "FDUSD", "BUSD", "USD"):
        if symbol.endswith(q):
            return q
    return symbol[-4:]


def base_asset(symbol: str) -> str:
    return symbol[: -len(quote_asset(symbol))]
