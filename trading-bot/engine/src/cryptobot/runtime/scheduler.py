"""Programador: ciclo cada 20 min (:00:05, :20:05, :40:05 UTC), vigilante, comandos y resumen."""

from __future__ import annotations

import fcntl
import os
import signal
import threading
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from cryptobot.logging_setup import get_logger
from cryptobot.runtime.app import BotApp

log = get_logger(__name__)


class InstanceLock:
    """Evita que dos copias del bot operen a la vez sobre la misma cuenta."""

    def __init__(self, path: Path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._fh = None

    def acquire(self) -> None:
        self._fh = open(self.path, "w")  # noqa: SIM115 - se mantiene abierto mientras viva el proceso
        try:
            fcntl.flock(self._fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as exc:
            raise RuntimeError(f"Ya hay otro bot corriendo (lock: {self.path})") from exc
        self._fh.write(str(os.getpid()))
        self._fh.flush()

    def release(self) -> None:
        if self._fh:
            fcntl.flock(self._fh, fcntl.LOCK_UN)
            self._fh.close()
            self._fh = None


def build_scheduler(app: BotApp, fast_seconds: int | None = None) -> BackgroundScheduler:
    s = app.settings
    sched = BackgroundScheduler(timezone="UTC")
    cycle_trigger = (
        IntervalTrigger(seconds=fast_seconds)
        if fast_seconds
        else CronTrigger(minute="0,20,40", second=5, timezone="UTC")
    )
    sched.add_job(
        app.safe_cycle,
        cycle_trigger,
        id="cycle",
        max_instances=1,
        coalesce=True,
        misfire_grace_time=300,
    )
    sched.add_job(
        app.safe_watch,
        IntervalTrigger(seconds=s.watcher_interval_s),
        id="watcher",
        max_instances=1,
        coalesce=True,
    )
    sched.add_job(
        app.process_commands,
        IntervalTrigger(seconds=s.command_poll_s),
        id="commands",
        max_instances=1,
        coalesce=True,
    )
    sched.add_job(
        app.daily_summary,
        CronTrigger(hour=app.cfg.summary_hour_utc, minute=2, timezone="UTC"),
        id="summary",
        max_instances=1,
    )
    return sched


def run_forever(
    app: BotApp, lock_path: Path, telegram_bot=None, fast_seconds: int | None = None
) -> None:
    lock = InstanceLock(lock_path)
    lock.acquire()
    stop = threading.Event()

    def _shutdown(*_: object) -> None:
        stop.set()

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)
    sched = build_scheduler(app, fast_seconds)
    sched.start()
    tg_thread = None
    if telegram_bot is not None:
        tg_thread = threading.Thread(target=telegram_bot.run_forever, name="telegram", daemon=True)
        tg_thread.start()
    app.notifier.notify(
        f"🤖 Bot iniciado en modo {app.cfg.mode} · vigilando {', '.join(app.cfg.watchlist)}"
    )
    log.info("bot iniciado", extra={"data": {"mode": app.cfg.mode, "watchlist": app.cfg.watchlist}})
    app.safe_cycle()  # un ciclo al arrancar (idempotente)
    try:
        while not stop.is_set():
            stop.wait(5)
            app.repo.heartbeat("scheduler", {"jobs": [j.id for j in sched.get_jobs()]})
    finally:
        sched.shutdown(wait=False)
        if telegram_bot is not None:
            telegram_bot.stop()
        lock.release()
        log.info("bot detenido")
