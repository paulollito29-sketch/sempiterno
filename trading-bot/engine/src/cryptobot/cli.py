"""Línea de comandos: `cryptobot <comando>`.

download   Descarga el histórico público (velas 5m, funding, Fear & Greed).
research   Walk-forward + backtests + baselines + DSR/PBO + puerta de calidad; entrena el modelo.
cycle      Corre UN ciclo de análisis ahora (útil para probar).
run        Inicia el bot: ciclo cada 20 min, vigilante de precios, Telegram, comandos.
demo       Genera datos de demostración para el panel (sin conexión).
status     Muestra el estado: datos, modelo campeón, cartera, recomendaciones pendientes.
"""

from __future__ import annotations

import argparse
import sys
import time
from dataclasses import asdict, replace
from pathlib import Path

import pandas as pd

from cryptobot.config import STRATEGY_PRESETS, RiskLimits, Settings
from cryptobot.logging_setup import get_logger, setup_logging

log = get_logger("cryptobot.cli")


def _print(msg: str) -> None:
    print(msg, flush=True)


# --------------------------------------------------------------------- download
def cmd_download(args: argparse.Namespace, settings: Settings) -> int:
    from cryptobot.data.binance import BinancePublic
    from cryptobot.data.collector import Collector
    from cryptobot.data.quality import check_bars
    from cryptobot.data.sentiment import FearGreedClient
    from cryptobot.data.store import ParquetStore

    store = ParquetStore(settings.data_dir / "market")
    client = BinancePublic(
        settings.binance_data_url, settings.binance_futures_url, settings.binance_vision_url
    )
    col = Collector(store, client, FearGreedClient(settings.fng_url))
    symbols = args.symbols.split(",") if args.symbols else settings.universe_symbols
    start = pd.Timestamp(args.start or settings.history_start, tz="UTC")
    t0 = time.time()
    for sym in symbols:
        _print(f"== {sym}: velas 5m desde {start.date()}")
        col.backfill_symbol(sym, start, progress=_print if args.verbose else None)
        n = col.backfill_funding_vision(sym, start)
        df = store.read_bars(sym, "5m")
        rep = check_bars(df, 5)
        _print(
            f"   {len(df):,} velas ({rep.start[:10] if rep.start else '—'} → {rep.end[:16] if rep.end else '—'}), "
            f"faltantes {rep.missing_bars}, funding {n} registros, {'OK' if rep.ok else rep.issues}"
        )
    _print(f"== Fear & Greed: {col.sync_fng()} días")
    _print(f"Listo en {time.time() - t0:.0f} s. Datos en {store.root}")
    return 0


# --------------------------------------------------------------------- research
def build_frames(
    settings: Settings, symbols: list[str], params, start: pd.Timestamp | None, use_hmm: bool = True
):
    from cryptobot.data.loader import load_inputs
    from cryptobot.data.store import ParquetStore
    from cryptobot.strategy.frame import build_symbol_frame

    store = ParquetStore(settings.data_dir / "market")
    frames = {}
    for sym in symbols:
        inp = load_inputs(store, sym, start=start)
        if len(inp.bars_20m) < 400 * 72:
            _print(f"   {sym}: muy pocos datos ({len(inp.bars_20m)} barras), se omite")
            continue
        t = time.time()
        frames[sym] = build_symbol_frame(
            sym, inp.bars_20m, params, inp.funding, inp.fng, use_hmm=use_hmm
        )
        _print(
            f"   {sym}: {frames[sym].n:,} barras de 20m, {int((frames[sym].event_side != 0).sum())} eventos ({time.time() - t:.0f} s)"
        )
    return frames


def cmd_research(args: argparse.Namespace, settings: Settings) -> int:
    from cryptobot.backtest.report import save_report, to_markdown
    from cryptobot.backtest.research import ResearchConfig, run_research, train_final_model
    from cryptobot.models.registry import ModelCard, ModelRegistry

    profile = args.profile or settings.cost_profile
    params = STRATEGY_PRESETS[profile]
    symbols = args.symbols.split(",") if args.symbols else settings.universe_symbols
    start = pd.Timestamp(args.start, tz="UTC") if args.start else None
    _print(f"== Construyendo features y regímenes ({len(symbols)} criptos, perfil {profile})")
    frames = build_frames(settings, symbols, params, start, use_hmm=not args.no_hmm)
    if not frames:
        _print("No hay datos. Corre primero: cryptobot download")
        return 1
    grid = [{"use_meta_model": True}, {"use_meta_model": False}] if args.quick else None
    cfg = ResearchConfig(cost_profile=profile, limits=RiskLimits(), grid=grid, seed=args.seed)
    _print(f"== Walk-forward y backtests de {len(cfg.variants())} variantes")
    t = time.time()
    report, _variants = run_research(frames, cfg)
    _print(f"   listo en {time.time() - t:.0f} s")
    out = Path(
        args.out or (Path("reports") / f"{profile}-{pd.Timestamp.now(tz='UTC'):%Y%m%d-%H%M}")
    )
    paths = save_report(report, out, f"Reporte de investigación — perfil {profile}")
    _print(to_markdown(report))
    _print(f"Reporte guardado en {paths['markdown']}")

    # Modelo para operar (entrenado con todos los datos de la configuración base)
    model, payoff, labels = train_final_model(frames, params, cfg)
    d = report.to_dict()
    sel = d["selected"]
    uses_meta = model is not None and (
        d["champion"] == "meta"
        or (
            d["champion"] == "ninguno"
            and sel["meta"].get("sharpe", -9) >= sel["regla"].get("sharpe", -9)
        )
    )
    registry = ModelRegistry(settings.models_dir)
    gate = d["gate"]["meta" if uses_meta else "regla"]
    card = ModelCard(
        version=ModelRegistry.new_version(),
        created_at=pd.Timestamp.now(tz="UTC").isoformat(),
        cost_profile=profile,
        params=asdict(replace(params, use_meta_model=uses_meta)),
        train_start=str(labels["t_event"].min()) if len(labels) else None,
        train_end=str(labels["t_end"].max()) if len(labels) else None,
        n_events=len(labels),
        uses_meta=uses_meta,
        oos_metrics=sel["meta" if uses_meta else "regla"],
        gate=gate,
        feature_importance=model.feature_importance() if model is not None else {},
        notes=f"campeón de la investigación: {d['champion']}",
    )
    registry.save(card, {"meta_model": model, "payoff": payoff, "report": d})
    current = registry.load_champion()
    if (
        current is None
        or (gate["passed"] and not current[0].gate.get("passed", False))
        or args.promote
    ):
        registry.promote(card.version)
        _print(
            f"Modelo {card.version} promovido a campeón (puerta {'aprobada' if gate['passed'] else 'NO aprobada: solo práctica'})."
        )
    else:
        _print(f"Modelo {card.version} guardado como challenger (el campeón actual se mantiene).")
    return 0


# --------------------------------------------------------------------- main
def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="cryptobot", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("download", help="descarga el histórico público")
    p.add_argument("--symbols", help="lista separada por comas (por defecto, el universo)")
    p.add_argument("--start", help="fecha inicial (YYYY-MM-DD)")
    p.add_argument("--verbose", action="store_true")
    p.set_defaults(func=cmd_download)

    p = sub.add_parser("research", help="investigación walk-forward y entrenamiento")
    p.add_argument(
        "--profile", choices=sorted(STRATEGY_PRESETS), help="perfil de costos (lemon, binance...)"
    )
    p.add_argument("--symbols")
    p.add_argument("--start")
    p.add_argument("--out")
    p.add_argument("--quick", action="store_true", help="solo 2 variantes (más rápido)")
    p.add_argument("--no-hmm", action="store_true", help="régimen solo por reglas (más rápido)")
    p.add_argument("--seed", type=int, default=0)
    p.add_argument(
        "--promote", action="store_true", help="forzar que el nuevo modelo sea el campeón"
    )
    p.set_defaults(func=cmd_research)

    try:  # comandos de operación (Fase 3)
        from cryptobot.runtime import commands_cli

        commands_cli.register(sub)
    except ImportError:
        pass

    args = parser.parse_args(argv)
    settings = Settings()
    setup_logging(settings.log_level)
    return int(args.func(args, settings) or 0)


if __name__ == "__main__":
    sys.exit(main())
