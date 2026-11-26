"""Índice Fear & Greed (alternative.me): sentimiento diario 0-100, historia desde 2018."""

from __future__ import annotations

import httpx
import pandas as pd


def parse_fng(payload: dict) -> pd.DataFrame:
    rows = payload.get("data", [])
    if not rows:
        return pd.DataFrame(columns=["fng"], index=pd.DatetimeIndex([], tz="UTC", name="ts"))
    df = pd.DataFrame(rows)
    out = pd.DataFrame(
        {"fng": pd.to_numeric(df["value"], errors="coerce").to_numpy()},
        index=pd.to_datetime(pd.to_numeric(df["timestamp"]), unit="s", utc=True),
    )
    out.index.name = "ts"
    return out[~out.index.duplicated(keep="last")].sort_index()


class FearGreedClient:
    def __init__(
        self, url: str = "https://api.alternative.me/fng/", client: httpx.Client | None = None
    ):
        self.url = url
        self.client = client or httpx.Client(timeout=30.0, follow_redirects=True)

    def history(self, limit: int = 0) -> pd.DataFrame:
        resp = self.client.get(self.url, params={"limit": limit, "format": "json"})
        resp.raise_for_status()
        return parse_fng(resp.json())
