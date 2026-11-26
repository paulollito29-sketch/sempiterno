from __future__ import annotations

import io
import zipfile

import numpy as np
import pandas as pd

from cryptobot.data.binance import BinancePublic, parse_kline_csv, parse_kline_rows
from cryptobot.data.candles import fill_small_gaps, resample_bars, to_daily
from cryptobot.data.quality import check_bars, repair_bars
from cryptobot.data.schema import normalize_bars
from cryptobot.data.sentiment import parse_fng
from cryptobot.data.store import ParquetStore


def _row(ts_ms, o, h, low, c, v=1.0, tb=0.5):
    return [
        ts_ms,
        str(o),
        str(h),
        str(low),
        str(c),
        str(v),
        ts_ms + 299_999,
        str(v * c),
        10,
        str(tb),
        str(tb * c),
        "0",
    ]


def test_parse_kline_rows_ms_and_us():
    t = 1_704_067_200_000  # 2024-01-01 00:00 UTC
    ms = parse_kline_rows([_row(t, 1, 2, 0.5, 1.5)])
    us = parse_kline_rows([_row(t * 1000, 1, 2, 0.5, 1.5)])
    assert ms.index[0] == pd.Timestamp("2024-01-01", tz="UTC")
    assert us.index[0] == ms.index[0]
    assert ms["taker_buy_base"].iloc[0] == 0.5
    assert list(ms.columns)[:4] == ["open", "high", "low", "close"]


def test_parse_kline_csv_with_and_without_header():
    t = 1_704_067_200_000
    rows = [_row(t + i * 300_000, 1, 2, 0.5, 1.5) for i in range(3)]
    body = "\n".join(",".join(str(x) for x in r) for r in rows)
    header = "open_time,open,high,low,close,volume,close_time,quote_volume,count,taker_buy_volume,taker_buy_quote_volume,ignore\n"
    a = parse_kline_csv(body.encode())
    b = parse_kline_csv((header + body).encode())
    assert len(a) == len(b) == 3
    pd.testing.assert_frame_equal(a, b)


def test_vision_monthly_klines_unzips(tmp_path):
    import httpx

    t = 1_704_067_200_000
    csv = "\n".join(
        ",".join(str(x) for x in _row(t + i * 300_000, 1, 2, 0.5, 1.5)) for i in range(5)
    )
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("BTCUSDT-5m-2024-01.csv", csv)

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("2024-01.zip"):
            return httpx.Response(200, content=buf.getvalue())
        return httpx.Response(404)

    client = BinancePublic(client=httpx.Client(transport=httpx.MockTransport(handler)))
    df = client.vision_monthly_klines("BTCUSDT", "5m", 2024, 1)
    assert len(df) == 5
    assert client.vision_monthly_klines("BTCUSDT", "5m", 2024, 2) is None


def test_resample_drops_incomplete_and_aggregates():
    idx = pd.date_range("2024-01-01 00:00", periods=9, freq="5min", tz="UTC")
    df = pd.DataFrame(
        {
            "open": np.arange(9) + 1.0,
            "high": np.arange(9) + 2.0,
            "low": np.arange(9) + 0.5,
            "close": np.arange(9) + 1.5,
            "volume": np.ones(9),
            "taker_buy_base": np.full(9, 0.25),
        },
        index=idx,
    )
    out = resample_bars(df, 20, 5)
    assert len(out) == 2  # la tercera barra (1 sola vela) está incompleta
    first = out.iloc[0]
    assert first["open"] == 1.0 and first["close"] == 4.5
    assert first["high"] == 5.0 and first["low"] == 0.5
    assert first["volume"] == 4.0 and first["taker_buy_base"] == 1.0
    assert out.index[1] == pd.Timestamp("2024-01-01 00:20", tz="UTC")


def test_fill_small_gaps():
    idx = pd.date_range("2024-01-01", periods=30, freq="20min", tz="UTC")
    df = normalize_bars(
        pd.DataFrame(
            {"open": 1.0, "high": 1.0, "low": 1.0, "close": np.arange(30) + 1.0, "volume": 1.0},
            index=idx,
        )
    )
    holes = df.drop(df.index[[3, 4]]).drop(df.index[10:20])
    out = fill_small_gaps(holes, 20, max_gap_bars=6)
    assert len(out) == 30
    assert out["close"].iloc[3] == out["close"].iloc[2] and out["volume"].iloc[3] == 0
    assert out["close"].iloc[10:20].isna().all()


def test_quality_detects_problems():
    idx = pd.date_range("2024-01-01", periods=100, freq="20min", tz="UTC")
    df = normalize_bars(
        pd.DataFrame(
            {"open": 10.0, "high": 11.0, "low": 9.0, "close": 10.0, "volume": 1.0}, index=idx
        )
    )
    assert check_bars(df, 20).ok
    bad = df.copy()
    bad.iloc[5, bad.columns.get_loc("low")] = 12.0  # low > open/close
    gapped = bad.drop(bad.index[20:40])
    rep = check_bars(gapped, 20, now=idx[-1] + pd.Timedelta(hours=5), max_stale_minutes=30)
    assert rep.ohlc_violations == 1
    assert rep.missing_bars == 20
    assert not rep.ok
    assert any("viejos" in i for i in rep.issues)
    assert len(repair_bars(pd.concat([df, df.iloc[:3]]))) == len(df)


def test_parquet_store_roundtrip_and_upsert(tmp_path):
    store = ParquetStore(tmp_path)
    idx = pd.date_range("2024-01-01", periods=10, freq="5min", tz="UTC")
    df = normalize_bars(
        pd.DataFrame(
            {"open": 1.0, "high": 2.0, "low": 0.5, "close": np.arange(10.0), "volume": 1.0},
            index=idx,
        )
    )
    store.write_bars("BTCUSDT", "5m", df.iloc[:6])
    store.write_bars("BTCUSDT", "5m", df.iloc[4:])  # se solapa: upsert
    back = store.read_bars("BTCUSDT", "5m")
    assert len(back) == 10
    assert back["close"].tolist() == list(np.arange(10.0))
    assert store.last_bar_time("BTCUSDT", "5m") == idx[-1]
    assert store.symbols() == ["BTCUSDT"]


def test_parse_fng():
    payload = {
        "data": [
            {"value": "40", "timestamp": "1704067200"},
            {"value": "60", "timestamp": "1704153600"},
        ]
    }
    df = parse_fng(payload)
    assert df["fng"].tolist() == [40.0, 60.0]
    assert df.index[0] == pd.Timestamp("2024-01-01", tz="UTC")


def test_synthetic_market_shapes(market, bars20):
    assert len(market.bars_5m) == 420 * 288
    assert len(bars20) == 420 * 72
    assert check_bars(bars20, 20).ok
    daily = to_daily(bars20)
    assert len(daily) == 420
