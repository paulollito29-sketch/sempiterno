"""Arma la aplicación según la configuración (.env)."""

from __future__ import annotations

from cryptobot.config import STRATEGY_PRESETS, Settings
from cryptobot.data.binance import BinancePublic
from cryptobot.data.collector import Collector
from cryptobot.data.sentiment import FearGreedClient
from cryptobot.data.store import ParquetStore
from cryptobot.models.registry import ModelRegistry
from cryptobot.notify.telegram import LogNotifier, TelegramBot, TelegramClient, TelegramNotifier
from cryptobot.persistence.base import Repo
from cryptobot.runtime.app import BotApp, load_config


def make_repo(settings: Settings) -> Repo:
    if settings.store == "supabase":
        if not (settings.supabase_url and settings.supabase_service_key):
            raise ValueError("Faltan CRYPTOBOT_SUPABASE_URL y CRYPTOBOT_SUPABASE_SERVICE_KEY")
        from cryptobot.persistence.supabase_store import SupabaseStore

        return Repo(SupabaseStore(settings.supabase_url, settings.supabase_service_key))
    from cryptobot.persistence.sqlite_store import SQLiteStore

    return Repo(SQLiteStore(settings.sqlite_path))


def make_app(settings: Settings) -> tuple[BotApp, TelegramBot | None]:
    from cryptobot.runtime.market import LiveMarket

    repo = make_repo(settings)
    cfg = load_config(repo, settings)
    store = ParquetStore(settings.data_dir / "market")
    client = BinancePublic(
        settings.binance_data_url, settings.binance_futures_url, settings.binance_vision_url
    )
    collector = Collector(store, client, FearGreedClient(settings.fng_url))
    market = LiveMarket(settings, store, collector, STRATEGY_PRESETS.get(cfg.cost_profile))
    tg_client = None
    if settings.telegram_bot_token and settings.telegram_chat_id:
        tg_client = TelegramClient(settings.telegram_bot_token, settings.telegram_chat_id)
    notifier = TelegramNotifier(tg_client) if tg_client else LogNotifier()
    app = BotApp(
        settings, repo, market, notifier=notifier, registry=ModelRegistry(settings.models_dir)
    )
    bot = TelegramBot(tg_client, app.telegram_handlers()) if tg_client else None
    return app, bot
