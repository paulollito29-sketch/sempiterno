"""Motor de decisión ÚNICO, compartido por el backtest y la operación en vivo.

Recibe la "vista" del mercado de una cripto al cierre de una barra, la posición (si existe) y
el estado del portafolio, y devuelve una decisión con su explicación en español.

Reglas de entrada (en orden): datos completos → sin modo defensivo → régimen no-estrés →
evento CUSUM → tendencia multi-horizonte a favor → sin euforia ni evento macro → límite semanal →
probabilidad del meta-modelo >= umbral por valor esperado → tamaño > mínimo.

Reglas de salida (las de stop/objetivo las vigila el precio en tiempo real):
horizonte cumplido · régimen de estrés · tendencia que se da vuelta (histéresis) ·
euforia con ganancia → REDUCIR (asegurar parte de la ganancia).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from math import exp, isfinite, sqrt

import numpy as np
import pandas as pd

from cryptobot.config import Action, CostProfile, Regime, RiskLimits, StrategyParams
from cryptobot.models.meta import PayoffStats
from cryptobot.strategy.explain import describe_contributions, describe_market
from cryptobot.strategy.sizing import position_fraction
from cryptobot.timeutils import BAR


@dataclass
class MarketView:
    symbol: str
    time: pd.Timestamp  # apertura de la barra; la decisión ocurre al cierre
    close: float
    sigma_d: float
    trend_vote: float
    row: dict
    regime: Regime | None
    p_stress: float = 0.0
    euphoria: bool = False
    macro_event: bool = False
    is_event: bool = False
    event_side: int = 0
    prob: float | None = None
    contributions: list[tuple[str, float]] = field(default_factory=list)
    data_ok: bool = True

    @property
    def decision_time(self) -> pd.Timestamp:
        return self.time + BAR


@dataclass
class PositionView:
    symbol: str
    qty: float
    entry_price: float  # precio de mercado de la entrada (sin costos)
    entry_time: pd.Timestamp
    stop: float
    target: float
    horizon_end: pd.Timestamp
    reduced: bool = False


@dataclass
class PortfolioView:
    equity: float
    exposure_value: float = 0.0
    defensive_reason: str | None = None
    trades_last_7d: int = 0


@dataclass
class Decision:
    symbol: str
    action: Action
    time: pd.Timestamp
    ref_price: float
    size_frac: float = 0.0  # COMPRAR: fracción del capital
    reduce_frac: float = 0.0  # REDUCIR: fracción de la posición a vender
    stop: float | None = None
    target: float | None = None
    horizon_end: pd.Timestamp | None = None
    prob: float | None = None
    threshold: float | None = None
    base_rate: float | None = None
    expected_return: float | None = None
    regime: Regime | None = None
    sigma_d: float | None = None
    reason_code: str = ""
    reasons: list[str] = field(default_factory=list)
    sizing: dict[str, float] = field(default_factory=dict)


class DecisionEngine:
    def __init__(
        self,
        params: StrategyParams,
        limits: RiskLimits,
        costs: CostProfile,
        payoff: PayoffStats | None = None,
        has_model: bool = False,
    ):
        self.params = params
        self.limits = limits
        self.costs = costs
        self.payoff = payoff
        self.has_model = has_model

    @property
    def uses_meta(self) -> bool:
        return self.params.use_meta_model and self.has_model

    def threshold_for(self, regime: Regime | None) -> float | None:
        if not self.uses_meta or self.payoff is None:
            return None
        thr = self.payoff.threshold(self.params.min_edge)
        if regime == Regime.RANGE:
            thr += self.params.range_threshold_bump
        return min(thr, 0.99)

    def levels(self, price: float, sigma_d: float) -> tuple[float, float]:
        sig_h = sigma_d * sqrt(self.params.horizon_days)
        return price * exp(-self.params.sl_mult * sig_h), price * exp(self.params.tp_mult * sig_h)

    def decide(self, mv: MarketView, pos: PositionView | None, pf: PortfolioView) -> Decision:
        if pos is not None and pos.qty > 0:
            return self._manage(mv, pos)
        return self._entry(mv, pf)

    # ------------------------------------------------------------------ salida
    def _manage(self, mv: MarketView, pos: PositionView) -> Decision:
        p = self.params
        d = Decision(
            mv.symbol, Action.HOLD, mv.decision_time, mv.close, regime=mv.regime, sigma_d=mv.sigma_d
        )
        if mv.decision_time >= pos.horizon_end:
            d.action, d.reason_code = Action.SELL, "time"
            d.reasons = ["se cumplió el horizonte máximo de la operación"]
            return d
        if not mv.data_ok:
            d.reason_code, d.reasons = "data", ["datos incompletos: se mantiene la posición"]
            return d
        if p.exit_on_stress and mv.regime == Regime.STRESS and mv.p_stress >= p.stress_prob_exit:
            d.action, d.reason_code = Action.SELL, "stress"
            d.reasons = ["el mercado entró en régimen de estrés: proteger el capital"]
            return d
        if mv.trend_vote <= p.exit_vote:
            d.action, d.reason_code = Action.SELL, "trend_reversal"
            d.reasons = ["la tendencia se dio vuelta (mayoría de horizontes en contra)"]
            return d
        if (
            mv.euphoria
            and not pos.reduced
            and mv.close >= pos.entry_price * (1 + 2 * self.costs.round_trip)
        ):
            d.action, d.reason_code = Action.REDUCE, "euphoria"
            d.reduce_frac = p.reduce_fraction
            d.reasons = ["euforia / apalancamiento extremo con ganancia: asegurar una parte"]
            return d
        d.reason_code = "hold"
        d.reasons = describe_market(mv.row, mv.regime)
        return d

    # ----------------------------------------------------------------- entrada
    def _entry(self, mv: MarketView, pf: PortfolioView) -> Decision:
        p, lim = self.params, self.limits
        d = Decision(
            mv.symbol, Action.NONE, mv.decision_time, mv.close, regime=mv.regime, sigma_d=mv.sigma_d
        )

        def no(code: str, reason: str, action: Action = Action.NONE) -> Decision:
            d.action, d.reason_code, d.reasons = action, code, [reason]
            return d

        if not mv.data_ok or not isfinite(mv.sigma_d) or mv.sigma_d <= 0:
            return no("data", "datos incompletos o desactualizados")
        if pf.defensive_reason:
            return no("defensive", pf.defensive_reason)
        if mv.regime == Regime.STRESS:
            return no("stress", "mercado en estrés: mejor quedarse en USDT", Action.STAY_CASH)
        if not mv.is_event:
            return no("no_event", "sin movimiento significativo")
        if not (mv.trend_vote >= p.entry_vote):
            return no("no_trend", "sin tendencia alcista clara")
        if mv.euphoria:
            return no("euphoria", "euforia / apalancamiento extremo: no perseguir el precio")
        if mv.macro_event:
            return no("macro", "evento macro cercano (FOMC/CPI): esperar")
        if pf.trades_last_7d >= lim.max_trades_per_week:
            return no("weekly_limit", "límite semanal de compras alcanzado")

        threshold = self.threshold_for(mv.regime)
        if self.uses_meta:
            if mv.prob is None or not isfinite(mv.prob):
                return no("no_model", "el modelo aún no tiene datos suficientes")
            prob = float(mv.prob)
            if threshold is not None and prob < threshold:
                d.prob, d.threshold = prob, threshold
                return no("low_prob", f"probabilidad {prob:.0%} menor al mínimo {threshold:.0%}")
        else:
            prob = self.payoff.base_rate if self.payoff else 0.5

        stop, target = self.levels(mv.close, mv.sigma_d)
        stop_frac = 1 - stop / mv.close
        sizing = position_fraction(
            prob,
            threshold if threshold is not None else prob,
            stop_frac,
            mv.sigma_d,
            self.payoff if self.uses_meta else None,
            lim,
            self.costs,
            has_model=self.uses_meta,
        )
        capacity = (
            max(0.0, lim.max_total_exposure - pf.exposure_value / pf.equity)
            if pf.equity > 0
            else 0.0
        )
        frac = min(sizing.fraction, capacity)
        if frac * pf.equity < lim.min_trade_usd or frac <= 0:
            reason = (
                "sin capacidad: exposición máxima alcanzada"
                if capacity <= 0
                else "el tamaño resultante es demasiado chico"
            )
            return no("size", reason)

        d.action, d.reason_code = Action.BUY, "entry"
        d.size_frac = frac
        d.stop, d.target = stop, target
        d.horizon_end = mv.decision_time + pd.Timedelta(days=p.horizon_days)
        d.prob, d.threshold = prob, threshold
        d.base_rate = self.payoff.base_rate if self.payoff else None
        d.expected_return = self.payoff.expected_return(prob) if self.payoff else None
        d.sizing = sizing.components
        d.reasons = describe_market(mv.row, mv.regime) + describe_contributions(mv.contributions)
        if mv.event_side < 0:
            d.reasons.insert(0, "retroceso dentro de una tendencia alcista")
        elif mv.event_side > 0:
            d.reasons.insert(0, "impulso alcista significativo")
        return d


# ---------------------------------------------------------------- vectorizado
def exit_signal_mask(
    trend_vote: np.ndarray, regime: np.ndarray, p_stress: np.ndarray, params: StrategyParams
) -> np.ndarray:
    """Versión vectorizada de las salidas por estrés o giro de tendencia (para el backtest)."""
    vote = np.nan_to_num(trend_vote, nan=0.0)
    stress = np.zeros(len(vote), dtype=bool)
    if params.exit_on_stress:
        ps = np.nan_to_num(p_stress, nan=0.0)
        stress = (regime == Regime.STRESS.value) & (ps >= params.stress_prob_exit)
    return stress | (vote <= params.exit_vote)
