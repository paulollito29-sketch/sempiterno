"""Integraciones con clientes simulados: Telegram, Supabase (REST), exchange vía ccxt, track record."""

from __future__ import annotations

import json

import httpx
import numpy as np
import pandas as pd
import pytest

from cryptobot.config import COST_PROFILES, Action, Settings
from cryptobot.execution.ccxt_broker import CcxtBroker, LiveApiDisabled
from cryptobot.notify.formatter import buttons_for, format_recommendation
from cryptobot.notify.telegram import TelegramBot, TelegramClient
from cryptobot.persistence.base import Repo
from cryptobot.persistence.sqlite_store import SQLiteStore
from cryptobot.persistence.supabase_store import SupabaseStore
from cryptobot.recommend.models import Recommendation, RecStatus
from cryptobot.recommend.tracker import track_record, update_outcomes


# ---------------------------------------------------------------- Telegram
class _TG:
    def __init__(self):
        self.calls: list[tuple[str, dict]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        method = request.url.path.rsplit("/", 1)[-1]
        body = json.loads(request.content or b"{}")
        self.calls.append((method, body))
        result = {"message_id": 7} if method == "sendMessage" else True
        return httpx.Response(200, json={"ok": True, "result": result})


def test_telegram_buttons_and_chat_restriction():
    tg = _TG()
    client = TelegramClient(
        "TOKEN", "123", client=httpx.Client(transport=httpx.MockTransport(tg.handler))
    )
    done: list[str] = []
    bot = TelegramBot(
        client, {"mark_executed": lambda rid: done.append(rid) or "ok", "status": lambda: "estado"}
    )
    cb = {
        "callback_query": {
            "id": "c1",
            "data": "exec:abc",
            "message": {"message_id": 7, "chat": {"id": 123}},
        }
    }
    assert bot.handle(cb) == "ok" and done == ["abc"]
    assert [m for m, _ in tg.calls] == ["answerCallbackQuery", "editMessageReplyMarkup"]
    intruder = {
        "callback_query": {"id": "c2", "data": "exec:zzz", "message": {"chat": {"id": 999}}}
    }
    assert bot.handle(intruder) is None and done == ["abc"]  # otro chat: se ignora
    assert bot.handle({"message": {"chat": {"id": 123}, "text": "/estado"}}) == "estado"
    assert "Comandos" in bot.handle({"message": {"chat": {"id": 123}, "text": "/ayuda"}})
    client.send("hola", [[("✅", "exec:1")]])
    method, body = tg.calls[-1]
    assert (
        method == "sendMessage"
        and body["reply_markup"]["inline_keyboard"][0][0]["callback_data"] == "exec:1"
    )


# ---------------------------------------------------------------- Supabase
def test_supabase_store_builds_postgrest_requests():
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return (
            httpx.Response(200, json=[{"id": "r1"}])
            if request.method == "GET"
            else httpx.Response(201)
        )

    st = SupabaseStore(
        "https://x.supabase.co",
        "SERVICE",
        client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    st.upsert("recommendations", [{"id": "r1", "status": "pendiente"}])
    rows = st.select(
        "recommendations",
        {"status": "pendiente", "approved_model": False},
        order_by="created_at",
        desc=True,
        limit=5,
    )
    st.delete("holdings", {"symbol": "BTCUSDT"})
    post, get, delete = seen
    assert post.url.path == "/rest/v1/recommendations" and post.url.params["on_conflict"] == "id"
    assert "merge-duplicates" in post.headers["prefer"] and post.headers["apikey"] == "SERVICE"
    assert (
        get.url.params["status"] == "eq.pendiente"
        and get.url.params["approved_model"] == "eq.false"
    )
    assert get.url.params["order"] == "created_at.desc" and get.url.params["limit"] == "5"
    assert delete.url.params["symbol"] == "eq.BTCUSDT" and rows == [{"id": "r1"}]


def test_sqlite_store_merge_filter_order():
    st = SQLiteStore(":memory:")
    st.upsert("recommendations", [{"id": "a", "created_at": "2025-01-02", "status": "pendiente"}])
    st.upsert("recommendations", [{"id": "b", "created_at": "2025-01-01", "status": "vencida"}])
    st.upsert("recommendations", [{"id": "a", "status": "ejecutada"}])  # merge parcial
    assert st.select("recommendations", {"id": "a"})[0] == {
        "id": "a",
        "created_at": "2025-01-02",
        "status": "ejecutada",
    }
    assert [r["id"] for r in st.select("recommendations", order_by="created_at")] == ["b", "a"]
    st.delete("recommendations", {"status": "vencida"})
    assert [r["id"] for r in st.select("recommendations")] == ["a"]


# ---------------------------------------------------------------- ccxt
class FakeExchange:
    def __init__(self):
        self.orders: dict[str, dict] = {}
        self.client_ids: set[str] = set()

    def load_markets(self):
        return {"BTC/USDT": {"limits": {"amount": {"min": 0.0001}, "cost": {"min": 5.0}}}}

    def amount_to_precision(self, symbol, qty):
        return f"{np.floor(qty * 1e5) / 1e5:.5f}"

    def price_to_precision(self, symbol, px):
        return f"{round(px, 2):.2f}"

    def fetch_order_book(self, symbol, limit):
        return {"bids": [[100.0, 1]], "asks": [[100.1, 1]]}

    def create_order(self, symbol, type_, side, qty, price, params):
        cid = params.get("clientOrderId")
        if cid in self.client_ids:
            raise RuntimeError("duplicate clientOrderId")
        self.client_ids.add(cid)
        oid = str(len(self.orders) + 1)
        self.orders[oid] = {
            "id": oid,
            "status": "closed",
            "filled": qty,
            "average": price or 100.05,
            "type": type_,
            "side": side,
        }
        return self.orders[oid]

    def fetch_order(self, oid, symbol):
        return self.orders[oid]

    def cancel_order(self, oid, symbol):
        self.orders[oid]["status"] = "canceled"

    def fetch_balance(self):
        return {"total": {"BTC": 0.5}}


def _rec(**kw) -> Recommendation:
    base = dict(
        symbol="BTCUSDT",
        action=Action.BUY.value,
        cycle_ts="2025-01-01T00:00:00+00:00",
        ref_price=100.0,
        size_usd=50.0,
        stop_pct=-0.05,
        target_pct=0.1,
    )
    base.update(kw)
    return Recommendation(**base)


def test_ccxt_broker_disabled_by_default():
    with pytest.raises(LiveApiDisabled):
        CcxtBroker(Repo(SQLiteStore(":memory:")), COST_PROFILES["binance"], 1000.0, Settings())


def test_ccxt_broker_executes_with_limits_and_idempotency():
    repo = Repo(SQLiteStore(":memory:"))
    ex = FakeExchange()
    broker = CcxtBroker(
        repo, COST_PROFILES["binance"], 1000.0, Settings(), exchange=ex, maker_wait_s=0
    )
    rec = _rec()
    repo.save_recommendation(rec)
    done = broker.execute(rec)
    assert done is not None and done.status == RecStatus.EXECUTED
    h = repo.holdings()["BTCUSDT"]
    assert h.qty == 0.49999 or np.isclose(h.qty, 0.5, atol=1e-4)
    assert any(o["type"] == "stop_loss_limit" for o in ex.orders.values())  # stop en el exchange
    # Reintentar la misma recomendación no duplica la orden
    assert broker.execute(repo.get_recommendation(rec.id)) is None
    tiny = _rec(size_usd=1.0)
    repo.save_recommendation(tiny)
    with pytest.raises(ValueError, match="mínimo"):
        broker.execute(tiny)
    assert broker.reconcile() == {}


# ---------------------------------------------------------------- formato y track record
def test_message_format_and_buttons():
    rec = _rec(
        probability=0.45,
        threshold=0.38,
        size_frac=0.12,
        entry_max_price=100.5,
        stop_price=95,
        target_price=110,
        horizon_end="2025-01-15T00:00:00+00:00",
        reasons=["tendencia 7d y 30d positiva"],
        expires_at="2025-01-01T01:00:00+00:00",
    )
    text = format_recommendation(rec)
    assert text.startswith("🟢 COMPRAR BTC")
    assert "45%" in text and "38%" in text and "-5.0%" in text and "+10.0%" in text
    assert "NO aprobado" in text  # el modelo no pasó la puerta: se advierte
    assert buttons_for(rec, "manual")[0][0][1] == f"exec:{rec.id}"
    assert buttons_for(rec, "semi_auto_api")[0][0][1] == f"api:{rec.id}"
    assert buttons_for(rec, "paper") is None


def test_track_record_stop_and_target():
    repo = Repo(SQLiteStore(":memory:"))
    idx = pd.date_range("2025-01-01", periods=10, freq="20min", tz="UTC")
    bars = pd.DataFrame({"open": 100.0, "high": 101.0, "low": 99.0, "close": 100.0}, index=idx)
    bars.iloc[4, bars.columns.get_loc("low")] = 94.0  # toca el stop (-5%)
    loser = _rec(
        cycle_ts=str(idx[0]),
        created_at=str(idx[0]),
        horizon_end=str(idx[-1] + pd.Timedelta(days=5)),
        size_frac=0.1,
    )
    up = bars.copy()
    up.iloc[3, up.columns.get_loc("high")] = 112.0  # toca el objetivo (+10%)
    winner = _rec(
        symbol="ETHUSDT",
        cycle_ts=str(idx[0]),
        created_at=str(idx[0]),
        horizon_end=str(idx[-1] + pd.Timedelta(days=5)),
        size_frac=0.1,
    )
    for r in (loser, winner):
        repo.save_recommendation(r)
    now = idx[-1] + pd.Timedelta(minutes=30)
    assert update_outcomes(repo, {"BTCUSDT": bars, "ETHUSDT": up}, COST_PROFILES["lemon"], now) == 2
    lo, wi = repo.get_recommendation(loser.id), repo.get_recommendation(winner.id)
    assert (
        lo.outcome_status == "cerrada" and lo.outcome_reason == "stop" and lo.outcome_return < -0.05
    )
    assert wi.outcome_reason == "objetivo" and wi.outcome_return > 0.08
    stats = track_record(repo.recommendations())
    assert stats["cerradas"] == 2 and stats["aciertos"] == 0.5
