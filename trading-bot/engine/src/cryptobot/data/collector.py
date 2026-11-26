"""Recolector de datos: descarga histórica masiva + sincronización incremental.

Datos sin historial gratuito (open interest, libro de órdenes) se guardan como snapshots
desde el primer día para poder usarlos en el futuro.
"""

from __future__ import annotations

from collections.abc import Callable

import numpy as np
import pandas as pd

from cryptobot.data.binance import BinancePublic
from cryptobot.data.quality import QualityReport, check_bars, repair_bars
from cryptobot.data.sentiment import FearGreedClient
from cryptobot.data.store import ParquetStore
from cryptobot.logging_setup import get_logger

log = get_logger(__name__)


def _month_range(start: pd.Timestamp, end: pd.Timestamp) -> list[tuple[int, int]]:
    months = []
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        months.append((y, m))
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return months


class Collector:
    def __init__(
        self,
        store: ParquetStore,
        client: BinancePublic,
        fng_client: FearGreedClient | None = None,
        timeframe: str = "5m",
    ):
        self.store = store
        self.client = client
        self.fng_client = fng_client
        self.timeframe = timeframe

    # ---------- histórico ----------
    def backfill_symbol(
        self,
        symbol: str,
        start: pd.Timestamp,
        end: pd.Timestamp | None = None,
        progress: Callable[[str], None] | None = None,
    ) -> int:
        """Descarga meses completos desde data.binance.vision y completa con REST."""
        end = end or pd.Timestamp.now(tz="UTC")
        last = self.store.last_bar_time(symbol, self.timeframe)
        if last is not None and last >= start:
            start = last
        this_month = (end.year, end.month)
        for y, m in _month_range(start, end):
            if (y, m) == this_month:
                break
            df = self.client.vision_monthly_klines(symbol, self.timeframe, y, m)
            if df is not None and not df.empty:
                self.store.write_bars(symbol, self.timeframe, df)
                if progress:
                    progress(f"{symbol} {y}-{m:02d}: {len(df)} velas")
        # Días del mes en curso (archivos diarios) y luego REST para lo más reciente.
        cur = self.store.last_bar_time(symbol, self.timeframe) or start
        day = (cur + pd.Timedelta(days=1)).normalize()
        while day.date() < end.date():
            df = self.client.vision_daily_klines(symbol, self.timeframe, day.date())
            if df is not None and not df.empty:
                self.store.write_bars(symbol, self.timeframe, df)
            day += pd.Timedelta(days=1)
        return self.sync_symbol(symbol, end)

    def sync_symbol(self, symbol: str, now: pd.Timestamp | None = None) -> int:
        """Trae por REST las velas nuevas desde la última guardada."""
        now = now or pd.Timestamp.now(tz="UTC")
        last = self.store.last_bar_time(symbol, self.timeframe)
        start = last if last is not None else now - pd.Timedelta(days=3)
        df = self.client.klines_range(symbol, self.timeframe, start, now)
        if df.empty:
            return 0
        # Descarta la vela en formación (aún no cerrada).
        step = pd.Timedelta(self.timeframe.replace("m", "min"))
        df = df[df.index + step <= now]
        df = repair_bars(df)
        return self.store.write_bars(symbol, self.timeframe, df)

    def quality(self, symbol: str, now: pd.Timestamp | None = None) -> QualityReport:
        df = self.store.read_bars(symbol, self.timeframe)
        return check_bars(df, 5, now=now, max_stale_minutes=30 if now is not None else None)

    # ---------- funding / sentimiento / snapshots ----------
    def sync_funding(self, symbol: str, start: pd.Timestamp | None = None) -> int:
        existing = self.store.read_series("funding", symbol)
        if existing is not None and not existing.empty:
            start_ms = int(existing.index[-1].timestamp() * 1000) + 1
        else:
            start_ms = int((start or pd.Timestamp("2019-09-01", tz="UTC")).timestamp() * 1000)
        try:
            df = self.client.funding_history(symbol, start_ms=start_ms)
        except Exception as exc:  # símbolo sin perpetuo, bloqueo regional, etc.
            log.warning(
                "no se pudo bajar funding", extra={"data": {"symbol": symbol, "err": str(exc)}}
            )
            return 0
        return self.store.write_series("funding", df, symbol)

    def backfill_funding_vision(
        self, symbol: str, start: pd.Timestamp, end: pd.Timestamp | None = None
    ) -> int:
        """Funding histórico desde los zips mensuales de data.binance.vision (sin API de futuros)."""
        end = end or pd.Timestamp.now(tz="UTC")
        existing = self.store.read_series("funding", symbol)
        if existing is not None and not existing.empty:
            start = max(start, existing.index[-1].normalize().replace(day=1))
        total = 0
        for y, m in _month_range(start, end):
            try:
                df = self.client.vision_monthly_funding(symbol, y, m)
            except Exception as exc:
                log.warning(
                    "funding mensual falló", extra={"data": {"symbol": symbol, "err": str(exc)}}
                )
                continue
            if df is not None and not df.empty:
                total = self.store.write_series("funding", df, symbol)
        return total

    def sync_fng(self) -> int:
        if self.fng_client is None:
            return 0
        try:
            df = self.fng_client.history(limit=0)
        except Exception as exc:
            log.warning("no se pudo bajar Fear & Greed", extra={"data": {"err": str(exc)}})
            return 0
        return self.store.write_series("fng", df)

    def snapshot_open_interest(self, symbols: list[str], now: pd.Timestamp | None = None) -> int:
        now = (now or pd.Timestamp.now(tz="UTC")).floor("min")
        n = 0
        for sym in symbols:
            try:
                oi = self.client.open_interest(sym)
            except Exception:
                oi = None
            if oi is None:
                continue
            df = pd.DataFrame({"open_interest": [oi]}, index=pd.DatetimeIndex([now], name="ts"))
            n += self.store.write_series("open_interest", df, sym) > 0
        return n

    def snapshot_book(
        self, symbols: list[str], now: pd.Timestamp | None = None, levels: int = 20
    ) -> int:
        """Guarda desequilibrio y spread del libro (no hay historial gratis)."""
        now = (now or pd.Timestamp.now(tz="UTC")).floor("min")
        n = 0
        for sym in symbols:
            try:
                book = self.client.depth(sym, levels)
            except Exception:
                continue
            bids = np.array(book.get("bids", []), dtype=float)
            asks = np.array(book.get("asks", []), dtype=float)
            if len(bids) == 0 or len(asks) == 0:
                continue
            bid_vol, ask_vol = bids[:, 1].sum(), asks[:, 1].sum()
            mid = (bids[0, 0] + asks[0, 0]) / 2
            row = {
                "imbalance": (bid_vol - ask_vol) / (bid_vol + ask_vol),
                "spread_bps": (asks[0, 0] - bids[0, 0]) / mid * 1e4,
                "mid": mid,
            }
            df = pd.DataFrame([row], index=pd.DatetimeIndex([now], name="ts"))
            n += self.store.write_series("book", df, sym) > 0
        return n

    def sync_all(self, symbols: list[str], now: pd.Timestamp | None = None) -> dict[str, int]:
        now = now or pd.Timestamp.now(tz="UTC")
        result = {}
        for sym in symbols:
            try:
                result[sym] = self.sync_symbol(sym, now)
            except Exception as exc:
                log.error(
                    "fallo al sincronizar velas", extra={"data": {"symbol": sym, "err": str(exc)}}
                )
                result[sym] = -1
        return result
