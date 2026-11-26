"""Comandos de operación para la CLI: run, cycle, status, mark, demo."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from cryptobot.config import Settings


def cmd_run(args: argparse.Namespace, settings: Settings) -> int:
    from cryptobot.runtime.factory import make_app
    from cryptobot.runtime.scheduler import run_forever

    app, bot = make_app(settings)
    run_forever(app, settings.data_dir / "cryptobot.lock", bot, fast_seconds=args.fast)
    return 0


def cmd_cycle(args: argparse.Namespace, settings: Settings) -> int:
    from cryptobot.runtime.factory import make_app

    app, _ = make_app(settings)
    row = app.run_cycle()
    print(
        json.dumps(
            {
                k: row.get(k)
                for k in (
                    "id",
                    "status",
                    "equity",
                    "ranking",
                    "new_recommendations",
                    "warnings",
                    "skipped",
                )
            },
            ensure_ascii=False,
            indent=1,
            default=str,
        )
    )
    for rec in app.repo.pending():
        print("\n" + rec.message)
    return 0


def cmd_status(args: argparse.Namespace, settings: Settings) -> int:
    from cryptobot.models.registry import ModelRegistry
    from cryptobot.recommend.tracker import track_record
    from cryptobot.runtime.factory import make_app

    app, _ = make_app(settings)
    champ = ModelRegistry(settings.models_dir).load_champion(app.cfg.cost_profile)
    if champ:
        card = champ[0]
        print(
            f"Modelo campeón: {card.version} · meta-modelo={'sí' if card.uses_meta else 'no'} · puerta={'APROBADA' if card.gate.get('passed') else 'NO aprobada'}"
        )
    else:
        print("Sin modelo entrenado: se usa la regla de tendencia. Corre `cryptobot research`.")
    print(app.status_text())
    print(
        json.dumps(
            track_record(app.repo.recommendations()), ensure_ascii=False, indent=1, default=str
        )
    )
    return 0


def cmd_mark(args: argparse.Namespace, settings: Settings) -> int:
    from cryptobot.runtime.factory import make_app

    app, _ = make_app(settings)
    if args.skip:
        print(app.mark_skipped(args.rec_id))
    else:
        print(app.mark_executed(args.rec_id, args.price, args.qty))
    return 0


def cmd_demo(args: argparse.Namespace, settings: Settings) -> int:
    from cryptobot.runtime.demo import build_demo

    out = build_demo(Path(args.out), days=args.days, seed=args.seed)
    print(f"Datos de demostración guardados en {out}")
    return 0


def register(sub: argparse._SubParsersAction) -> None:
    p = sub.add_parser("run", help="inicia el bot (ciclo cada 20 min)")
    p.add_argument("--fast", type=int, help="ciclo cada N segundos (solo para pruebas)")
    p.set_defaults(func=cmd_run)

    p = sub.add_parser("cycle", help="corre un ciclo ahora")
    p.set_defaults(func=cmd_cycle)

    p = sub.add_parser("status", help="estado del bot")
    p.set_defaults(func=cmd_status)

    p = sub.add_parser("mark", help="marcar una recomendación como ejecutada (o --skip)")
    p.add_argument("rec_id")
    p.add_argument("--price", type=float)
    p.add_argument("--qty", type=float)
    p.add_argument("--skip", action="store_true")
    p.set_defaults(func=cmd_mark)

    p = sub.add_parser("demo", help="genera datos de demostración para el panel")
    p.add_argument("--out", default="../dashboard/public/demo-data.json")
    p.add_argument("--days", type=int, default=45)
    p.add_argument("--seed", type=int, default=21)
    p.set_defaults(func=cmd_demo)
