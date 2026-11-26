"""Avisos por Telegram (cliente HTTP mínimo con httpx, long polling: el servidor no abre puertos).

El bot SOLO responde al chat_id configurado (tu chat). Crea el bot con @BotFather y obtén tu
chat_id escribiéndole a tu bot y consultando https://api.telegram.org/bot<TOKEN>/getUpdates.
"""

from __future__ import annotations

import json
import threading
from collections.abc import Callable
from typing import Any, Protocol

import httpx

from cryptobot.logging_setup import get_logger

log = get_logger(__name__)

Buttons = list[list[tuple[str, str]]] | None


class Notifier(Protocol):
    def notify(self, text: str, buttons: Buttons = None) -> None: ...


class LogNotifier:
    def notify(self, text: str, buttons: Buttons = None) -> None:
        log.info("aviso", extra={"data": {"text": text, "buttons": buttons}})


class MemoryNotifier:
    def __init__(self) -> None:
        self.messages: list[tuple[str, Buttons]] = []

    def notify(self, text: str, buttons: Buttons = None) -> None:
        self.messages.append((text, buttons))


class TelegramClient:
    def __init__(
        self,
        token: str,
        chat_id: str,
        client: httpx.Client | None = None,
        base: str = "https://api.telegram.org",
    ):
        self.url = f"{base}/bot{token}"
        self.chat_id = str(chat_id)
        self.client = client or httpx.Client(timeout=60.0)

    def _call(self, method: str, payload: dict[str, Any]) -> Any:
        resp = self.client.post(f"{self.url}/{method}", json=payload)
        resp.raise_for_status()
        data = resp.json()
        if not data.get("ok"):
            raise RuntimeError(f"Telegram {method}: {data}")
        return data.get("result")

    def send(self, text: str, buttons: Buttons = None) -> int | None:
        payload: dict[str, Any] = {
            "chat_id": self.chat_id,
            "text": text[:4000],
            "disable_web_page_preview": True,
        }
        if buttons:
            payload["reply_markup"] = {
                "inline_keyboard": [
                    [{"text": t, "callback_data": d} for t, d in row] for row in buttons
                ]
            }
        res = self._call("sendMessage", payload)
        return res.get("message_id") if isinstance(res, dict) else None

    def answer_callback(self, callback_id: str, text: str) -> None:
        self._call("answerCallbackQuery", {"callback_query_id": callback_id, "text": text[:190]})

    def clear_buttons(self, message_id: int) -> None:
        self._call(
            "editMessageReplyMarkup",
            {
                "chat_id": self.chat_id,
                "message_id": message_id,
                "reply_markup": {"inline_keyboard": []},
            },
        )

    def get_updates(self, offset: int | None, timeout: int = 50) -> list[dict[str, Any]]:
        payload: dict[str, Any] = {
            "timeout": timeout,
            "allowed_updates": json.dumps(["message", "callback_query"]),
        }
        if offset is not None:
            payload["offset"] = offset
        return self._call("getUpdates", payload) or []


class TelegramNotifier:
    def __init__(self, client: TelegramClient):
        self.client = client

    def notify(self, text: str, buttons: Buttons = None) -> None:
        try:
            self.client.send(text, buttons)
        except Exception as exc:  # nunca frenar el ciclo por un aviso
            log.error("no se pudo enviar a Telegram", extra={"data": {"err": str(exc)}})


HELP = (
    "Comandos:\n"
    "/estado — régimen de mercado, cartera y recomendaciones pendientes\n"
    "/cartera — lo que tienes y su resultado\n"
    "/precio <id> <precio> [cantidad] — corrige el precio real de una ejecución\n"
    "/capital <USD> — capital que dedicas al bot\n"
    "/pausa · /reanudar — detener o retomar las compras nuevas\n"
    "/ayuda — este mensaje"
)


class TelegramBot:
    """Procesa botones y comandos. `handlers` los provee la app (runtime.app.BotApp)."""

    def __init__(self, client: TelegramClient, handlers: dict[str, Callable[..., str]]):
        self.client = client
        self.handlers = handlers
        self.offset: int | None = None
        self._stop = threading.Event()

    def _allowed(self, chat_id: Any) -> bool:
        return str(chat_id) == self.client.chat_id

    def handle(self, update: dict[str, Any]) -> str | None:
        if "callback_query" in update:
            cq = update["callback_query"]
            if not self._allowed(cq.get("message", {}).get("chat", {}).get("id")):
                return None
            action, _, rec_id = (cq.get("data") or "").partition(":")
            fn = {"exec": "mark_executed", "skip": "mark_skipped", "api": "api_execute"}.get(action)
            reply = (
                self.handlers[fn](rec_id) if fn and fn in self.handlers else "Acción desconocida"
            )
            try:
                self.client.answer_callback(cq["id"], reply)
                msg_id = cq.get("message", {}).get("message_id")
                if msg_id:
                    self.client.clear_buttons(msg_id)
            except Exception:
                pass
            return reply
        msg = update.get("message") or {}
        if not self._allowed(msg.get("chat", {}).get("id")):
            return None
        text = (msg.get("text") or "").strip()
        if not text.startswith("/"):
            return None
        cmd, *args = text.split()
        cmd = cmd.split("@")[0].lower()
        routes = {
            "/estado": "status",
            "/cartera": "holdings",
            "/pausa": "pause",
            "/reanudar": "resume",
            "/precio": "set_price",
            "/capital": "set_capital",
        }
        if cmd in ("/ayuda", "/start", "/help"):
            reply = HELP
        elif cmd in routes and routes[cmd] in self.handlers:
            try:
                reply = self.handlers[routes[cmd]](*args)
            except TypeError:
                reply = "Faltan datos. " + HELP
        else:
            reply = "No entendí. " + HELP
        self.client.send(reply)
        return reply

    def poll_once(self, timeout: int = 50) -> int:
        updates = self.client.get_updates(self.offset, timeout)
        for u in updates:
            self.offset = int(u["update_id"]) + 1
            try:
                self.handle(u)
            except Exception as exc:
                log.error("error procesando Telegram", extra={"data": {"err": str(exc)}})
        return len(updates)

    def run_forever(self) -> None:
        while not self._stop.is_set():
            try:
                self.poll_once()
            except Exception as exc:
                log.warning("Telegram sin conexión, reintento", extra={"data": {"err": str(exc)}})
                self._stop.wait(10)

    def stop(self) -> None:
        self._stop.set()
