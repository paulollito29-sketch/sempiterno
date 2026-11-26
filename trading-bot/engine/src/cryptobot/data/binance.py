"""Cliente de datos PÚBLICOS de Binance (sin claves).

- REST de mercado: data-api.binance.vision (espejo público solo de datos; configurable).
- Futuros USDT-M (funding, open interest): fapi.binance.com.
- Archivos históricos masivos: data.binance.vision (zips mensuales/diarios de velas y funding).

Las velas de Binance incluyen el volumen comprado por agresores ("taker buy"), útil como
proxy del flujo de órdenes. Desde 2025 los archivos spot usan timestamps en microsegundos.
"""

from __future__ import annotations

import io
import time
import zipfile
from datetime import date

import httpx
import numpy as np
import pandas as pd

from cryptobot.data.schema import normalize_bars
from cryptobot.logging_setup import get_logger

log = get_logger(__name__)

KLINE_FIELDS = [
    "open_time",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "close_time",
    "quote_volume",
    "trades",
    "taker_buy_base",
    "taker_buy_quote",
    "ignore",
]
INTERVAL_MS = {"1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000, "1d": 86_400_000}


def _to_ms(values: np.ndarray) -> np.ndarray:
    """Normaliza timestamps a milisegundos (los archivos nuevos vienen en microsegundos)."""
    v = values.astype("float64")
    return np.where(v > 1e14, v / 1000.0, v).astype("int64")


def parse_kline_rows(rows: list[list]) -> pd.DataFrame:
    if not rows:
        return normalize_bars(None)
    arr = pd.DataFrame(rows, columns=KLINE_FIELDS[: len(rows[0])])
    ts = pd.to_datetime(_to_ms(arr["open_time"].to_numpy()), unit="ms", utc=True)
    df = pd.DataFrame(
        {c: pd.to_numeric(arr[c], errors="coerce") for c in KLINE_FIELDS[1:11] if c != "close_time"},
    )
    df.index = ts
    return normalize_bars(df)


def parse_kline_csv(raw: bytes) -> pd.DataFrame:
    text = raw.decode("utf-8", errors="replace")
    first = text.split("\n", 1)[0]
    has_header = not first.split(",")[0].strip().lstrip("-").isdigit()
    df = pd.read_csv(io.StringIO(text), header=0 if has_header else None)
    df = df.iloc[:, :12]
    df.columns = KLINE_FIELDS[: df.shape[1]]
    return parse_kline_rows(df.to_numpy().tolist())


def _unzip_first_csv(content: bytes) -> bytes:
    with zipfile.ZipFile(io.BytesIO(content)) as zf:
        name = next(n for n in zf.namelist() if n.endswith(".csv"))
        return zf.read(name)


class BinancePublic:
    def __init__(
        self,
        data_url: str = "https://data-api.binance.vision",
        futures_url: str = "https://fapi.binance.com",
        vision_url: str = "https://data.binance.vision",
        client: httpx.Client | None = None,
        timeout: float = 30.0,
        max_retries: int = 4,
    ):
        self.data_url = data_url.rstrip("/")
        self.futures_url = futures_url.rstrip("/")
        self.vision_url = vision_url.rstrip("/")
        self.client = client or httpx.Client(timeout=timeout, follow_redirects=True)
        self.max_retries = max_retries

    # ---------- HTTP con reintentos ----------
    def _get(self, url: str, params: dict | None = None, allow_404: bool = False) -> httpx.Response | None:
        delay = 1.0
        for attempt in range(self.max_retries + 1):
            try:
                resp = self.client.get(url, params=params)
            except httpx.HTTPError as exc:
                if attempt == self.max_retries:
                    raise
                log.warning("error de red, reintentando", extra={"data": {"url": url, "err": str(exc)}})
                time.sleep(delay)
                delay *= 2
                continue
            if resp.status_code == 404 and allow_404:
                return None
            if resp.status_code in (418, 429) or resp.status_code >= 500:
                if attempt == self.max_retries:
                    resp.raise_for_status()
                wait = float(resp.headers.get("Retry-After", delay))
                log.warning("límite de tasa o error del servidor", extra={"data": {"status": resp.status_code}})
                time.sleep(min(wait, 60.0))
                delay *= 2
                continue
            resp.raise_for_status()
            return resp
        return None

    # ---------- velas ----------
    def klines(
        self,
        symbol: str,
        interval: str = "5m",
        start_ms: int | None = None,
        end_ms: int | None = None,
        limit: int = 1000,
    ) -> pd.DataFrame:
        params: dict = {"symbol": symbol.upper(), "interval": interval, "limit": limit}
        if start_ms is not None:
            params["startTime"] = int(start_ms)
        if end_ms is not None:
            params["endTime"] = int(end_ms)
        resp = self._get(f"{self.data_url}/api/v3/klines", params)
        return parse_kline_rows(resp.json() if resp is not None else [])

    def klines_range(
        self, symbol: str, interval: str, start: pd.Timestamp, end: pd.Timestamp | None = None
    ) -> pd.DataFrame:
        """Pagina /klines desde `start` hasta `end` (o ahora)."""
        step = INTERVAL_MS[interval]
        cur = int(start.timestamp() * 1000)
        end_ms = int((end or pd.Timestamp.now(tz="UTC")).timestamp() * 1000)
        frames = []
        while cur <= end_ms:
            df = self.klines(symbol, interval, start_ms=cur, end_ms=end_ms, limit=1000)
            if df.empty:
                break
            frames.append(df)
            last = int(df.index[-1].timestamp() * 1000)
            if last + step <= cur:
                break
            cur = last + step
            if len(df) < 1000:
                break
        if not frames:
            return normalize_bars(None)
        return normalize_bars(pd.concat(frames))

    def ticker_prices(self, symbols: list[str]) -> dict[str, float]:
        resp = self._get(f"{self.data_url}/api/v3/ticker/price")
        data = resp.json() if resp is not None else []
        wanted = {s.upper() for s in symbols}
        return {d["symbol"]: float(d["price"]) for d in data if d["symbol"] in wanted}

    def depth(self, symbol: str, limit: int = 20) -> dict:
        resp = self._get(f"{self.data_url}/api/v3/depth", {"symbol": symbol.upper(), "limit": limit})
        return resp.json() if resp is not None else {}

    # ---------- futuros (funding / open interest) ----------
    def funding_history(self, symbol: str, start_ms: int | None = None, end_ms: int | None = None) -> pd.DataFrame:
        rows: list[dict] = []
        cur = start_ms
        while True:
            params: dict = {"symbol": symbol.upper(), "limit": 1000}
            if cur is not None:
                params["startTime"] = cur
            if end_ms is not None:
                params["endTime"] = end_ms
            resp = self._get(f"{self.futures_url}/fapi/v1/fundingRate", params, allow_404=True)
            batch = resp.json() if resp is not None else []
            if not batch:
                break
            rows.extend(batch)
            if len(batch) < 1000:
                break
            cur = int(batch[-1]["fundingTime"]) + 1
        if not rows:
            return pd.DataFrame(columns=["funding_rate"], index=pd.DatetimeIndex([], tz="UTC", name="ts"))
        df = pd.DataFrame(rows)
        out = pd.DataFrame(
            {"funding_rate": pd.to_numeric(df["fundingRate"], errors="coerce").to_numpy()},
            index=pd.to_datetime(df["fundingTime"].astype("int64"), unit="ms", utc=True),
        )
        out.index.name = "ts"
        return out[~out.index.duplicated(keep="last")].sort_index()

    def open_interest(self, symbol: str) -> float | None:
        resp = self._get(f"{self.futures_url}/fapi/v1/openInterest", {"symbol": symbol.upper()}, allow_404=True)
        if resp is None:
            return None
        return float(resp.json()["openInterest"])

    # ---------- archivos masivos (data.binance.vision) ----------
    def vision_monthly_klines(self, symbol: str, interval: str, year: int, month: int) -> pd.DataFrame | None:
        sym = symbol.upper()
        name = f"{sym}-{interval}-{year:04d}-{month:02d}.zip"
        url = f"{self.vision_url}/data/spot/monthly/klines/{sym}/{interval}/{name}"
        resp = self._get(url, allow_404=True)
        if resp is None:
            return None
        return parse_kline_csv(_unzip_first_csv(resp.content))

    def vision_daily_klines(self, symbol: str, interval: str, day: date) -> pd.DataFrame | None:
        sym = symbol.upper()
        name = f"{sym}-{interval}-{day.isoformat()}.zip"
        url = f"{self.vision_url}/data/spot/daily/klines/{sym}/{interval}/{name}"
        resp = self._get(url, allow_404=True)
        if resp is None:
            return None
        return parse_kline_csv(_unzip_first_csv(resp.content))

    def vision_monthly_funding(self, symbol: str, year: int, month: int) -> pd.DataFrame | None:
        sym = symbol.upper()
        name = f"{sym}-fundingRate-{year:04d}-{month:02d}.zip"
        url = f"{self.vision_url}/data/futures/um/monthly/fundingRate/{sym}/{name}"
        resp = self._get(url, allow_404=True)
        if resp is None:
            return None
        raw = _unzip_first_csv(resp.content).decode("utf-8", errors="replace")
        df = pd.read_csv(io.StringIO(raw))
        time_col = next(c for c in df.columns if "time" in c.lower())
        rate_col = next(c for c in df.columns if "rate" in c.lower())
        idx = pd.to_datetime(_to_ms(df[time_col].to_numpy()), unit="ms", utc=True)
        out = pd.DataFrame({"funding_rate": pd.to_numeric(df[rate_col], errors="coerce").to_numpy()}, index=idx)
        out.index.name = "ts"
        return out
