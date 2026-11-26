"""Fuentes de mercado para el ciclo en vivo.

- LiveMarket: sincroniza datos públicos y arma el SymbolFrame con la historia guardada.
- ReplayMarket: reproduce datos ya calculados con un reloj simulado (pruebas, demo, "reloj rápido").
  Es válido precalcular el frame completo porque todas las features son causales (test anti
  look-ahead): el valor en la barra t es idéntico al que se obtiene con datos cortados en t.
"""

from __future__ import annotations

from typing import Protocol

import pandas as pd

from cryptobot.config import Settings, StrategyParams
from cryptobot.data.candles import closed_bars, prepare_bars_20m
from cryptobot.data.collector import Collector
from cryptobot.data.store import ParquetStore
from cryptobot.logging_setup import get_logger
from cryptobot.regime.hmm import current_regime_model, live_regime_probs
from cryptobot.strategy.frame import SymbolFrame, build_symbol_frame
from cryptobot.timeutils import last_closed_bar_open

log = get_logger(__name__)


class MarketSource(Protocol):
    def refresh(self, symbols: list[str], now: pd.Timestamp) -> dict[str, int]: ...

    def view(self, symbol: str, now: pd.Timestamp) -> tuple[SymbolFrame, int] | None: ...

    def last_price(self, symbol: str, now: pd.Timestamp) -> float | None: ...

    def bars_between(self, symbol: str, after: pd.Timestamp, now: pd.Timestamp) -> pd.DataFrame: ...

    def recent_bars(self, symbol: str, now: pd.Timestamp, days: float = 30) -> pd.DataFrame: ...


class ReplayMarket:
    def __init__(self, frames: dict[str, SymbolFrame]):
        self.frames = frames

    def refresh(self, symbols: list[str], now: pd.Timestamp) -> dict[str, int]:
        return {}

    def view(self, symbol: str, now: pd.Timestamp) -> tuple[SymbolFrame, int] | None:
        f = self.frames.get(symbol)
        if f is None:
            return None
        i = int(f.index.searchsorted(last_closed_bar_open(now), side="right")) - 1
        return (f, i) if i >= 0 else None

    def last_price(self, symbol: str, now: pd.Timestamp) -> float | None:
        v = self.view(symbol, now)
        return float(v[0]._close[v[1]]) if v else None

    def bars_between(self, symbol: str, after: pd.Timestamp, now: pd.Timestamp) -> pd.DataFrame:
        b = self.frames[symbol].bars
        return b[(b.index > after) & (b.index <= last_closed_bar_open(now))]

    def recent_bars(self, symbol: str, now: pd.Timestamp, days: float = 30) -> pd.DataFrame:
        b = self.frames[symbol].bars
        last = last_closed_bar_open(now)
        return b[(b.index > last - pd.Timedelta(days=days)) & (b.index <= last)]


class LiveMarket:
    def __init__(
        self,
        settings: Settings,
        store: ParquetStore,
        collector: Collector,
        params: StrategyParams,
        lookback_days: int = 600,
        use_hmm: bool = True,
    ):
        self.settings = settings
        self.store = store
        self.collector = collector
        self.params = params
        self.lookback_days = lookback_days
        self.use_hmm = use_hmm
        self._hmm: dict[str, tuple[str, object]] = {}
        self._daily_sync: str | None = None
        self._bars: dict[str, pd.DataFrame] = {}

    def refresh(self, symbols: list[str], now: pd.Timestamp) -> dict[str, int]:
        res = self.collector.sync_all(symbols, now)
        day = now.strftime("%Y-%m-%d")
        if self._daily_sync != day:  # una vez por día: sentimiento y funding
            self.collector.sync_fng()
            for sym in symbols:
                try:
                    self.collector.backfill_funding_vision(sym, now - pd.Timedelta(days=40), now)
                except Exception as exc:
                    log.warning(
                        "funding no disponible", extra={"data": {"symbol": sym, "err": str(exc)}}
                    )
            self._daily_sync = day
        # Datos sin historial gratuito: se guardan desde ya (mejor esfuerzo)
        try:
            self.collector.snapshot_open_interest(symbols, now)
            self.collector.snapshot_book(symbols, now)
        except Exception:
            pass
        self._bars.clear()
        return res

    def _bars20(self, symbol: str, now: pd.Timestamp) -> pd.DataFrame:
        if symbol not in self._bars:
            raw = self.store.read_bars(
                symbol, "5m", start=now - pd.Timedelta(days=self.lookback_days)
            )
            self._bars[symbol] = closed_bars(prepare_bars_20m(raw), now)
        return self._bars[symbol]

    def _regimes(self, symbol: str, bars: pd.DataFrame, now: pd.Timestamp) -> pd.DataFrame | None:
        if not self.use_hmm or len(bars) < 200 * 72:
            return None
        day = now.strftime("%Y-%m-%d")
        cached = self._hmm.get(symbol)
        if cached is None or cached[0] != day:
            model = current_regime_model(bars[bars.index < now.floor("1D")])
            self._hmm[symbol] = (day, model)
        model = self._hmm[symbol][1]
        return live_regime_probs(model, bars) if model is not None else None

    def view(self, symbol: str, now: pd.Timestamp) -> tuple[SymbolFrame, int] | None:
        bars = self._bars20(symbol, now)
        if len(bars) < 40 * 72:
            return None
        funding = self.store.read_series("funding", symbol)
        fng = self.store.read_series("fng")
        regimes = self._regimes(symbol, bars, now)
        frame = build_symbol_frame(
            symbol, bars, self.params, funding, fng, regime_probs=regimes, use_hmm=False
        )
        return frame, frame.n - 1

    def last_price(self, symbol: str, now: pd.Timestamp) -> float | None:
        try:
            return self.collector.client.ticker_prices([symbol]).get(symbol)
        except Exception:
            bars = self._bars20(symbol, now)
            return float(bars["close"].iloc[-1]) if len(bars) else None

    def bars_between(self, symbol: str, after: pd.Timestamp, now: pd.Timestamp) -> pd.DataFrame:
        b = self._bars20(symbol, now)
        return b[b.index > after]

    def recent_bars(self, symbol: str, now: pd.Timestamp, days: float = 30) -> pd.DataFrame:
        b = self._bars20(symbol, now)
        return b[b.index > last_closed_bar_open(now) - pd.Timedelta(days=days)]
