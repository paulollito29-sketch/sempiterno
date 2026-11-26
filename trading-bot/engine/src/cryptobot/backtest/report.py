"""Reporte de investigación en español (Markdown + JSON para el panel)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from cryptobot.backtest.research import ResearchReport

NAMES = {
    "bot_meta": "Bot (regla + meta-modelo)",
    "bot_regla": "Bot (solo regla de tendencia)",
    "comprar_y_mantener": "Comprar y mantener",
    "vol_targeting": "Comprar y mantener con vol targeting",
    "cruce_medias_20_100": "Cruce de medias 20/100",
    "dca_semanal": "DCA semanal",
}


def _pct(x: Any) -> str:
    try:
        return f"{float(x) * 100:.1f}%"
    except (TypeError, ValueError):
        return "—"


def _num(x: Any, nd: int = 2) -> str:
    try:
        return f"{float(x):.{nd}f}"
    except (TypeError, ValueError):
        return "—"


def _row(name: str, m: dict) -> str:
    return (
        f"| {name} | {_pct(m.get('total_return'))} | {_pct(m.get('cagr'))} | {_num(m.get('sharpe'))} | "
        f"{_pct(m.get('max_drawdown'))} | {m.get('n_trades', '—')} | {_pct(m.get('win_rate')) if 'win_rate' in m else '—'} |"
    )


def to_markdown(report: ResearchReport, title: str = "Reporte de investigación") -> str:
    d = report.to_dict()
    cfg, per = d["config"], d["period"]
    stats = d["statistics"]
    lines = [
        f"# {title}",
        "",
        f"- Perfil de costos: **{cfg['cost_profile']}** (costo por lado {_pct(cfg['costs']['fee'] + cfg['costs']['half_spread'] + cfg['costs']['slippage'])})",
        f"- Criptos: {', '.join(cfg['symbols'])}",
        f"- Datos: {per['data_start'][:10]} → {per['data_end'][:10]} · fuera de muestra desde **{(per['oos_start'] or '—')[:10]}**",
        f"- Walk-forward: ventanas de {cfg['test_days']} días, mínimo {cfg['min_train_days']} días de entrenamiento, con purga",
        "",
        "## Resultado (fuera de muestra, neto de costos)",
        "",
        "| Estrategia | Retorno total | Anual (CAGR) | Sharpe | Caída máx. | Operaciones | % aciertos |",
        "|---|---|---|---|---|---|---|",
        _row(NAMES["bot_meta"], d["selected"].get("meta", {})),
        _row(NAMES["bot_regla"], d["selected"].get("regla", {})),
    ]
    for k, m in d["baselines"].items():
        lines.append(_row(NAMES.get(k, k), m))
    pbo = stats.get("pbo", {}).get("pbo")
    lines += [
        "",
        "## Estadística anti-sobreajuste",
        "",
        f"- Configuraciones probadas: **{stats.get('n_trials', 0)}** (todas cuentan para deflactar el Sharpe)",
        f"- Deflated Sharpe (meta / regla): **{_num(stats.get('dsr_meta'))} / {_num(stats.get('dsr_regla'))}** (se exige ≥ 0.95)",
        f"- PBO (probabilidad de sobreajuste): **{_num(pbo)}** (se exige ≤ 0.20)",
        f"- Sharpe mediano entre variantes: {_num(stats.get('variant_sharpe_median'))}",
    ]
    if "brier" in stats:
        lines.append(
            f"- Brier del meta-modelo: {_num(stats['brier'], 3)} sobre {stats.get('oos_events', 0)} eventos fuera de muestra"
        )
    if d["calibration"]:
        lines += [
            "",
            "### Calibración (¿la probabilidad dice la verdad?)",
            "",
            "| Prob. media | Aciertos reales | Eventos |",
            "|---|---|---|",
        ]
        lines += [
            f"| {_pct(r['p_mean'])} | {_pct(r['hit_rate'])} | {r['n']} |" for r in d["calibration"]
        ]
    lines += ["", "## Puerta de calidad", ""]
    for label, g in d["gate"].items():
        lines.append(f"**{label}: {'APROBADA ✅' if g['passed'] else 'NO aprobada ❌'}**")
        lines.append("")
        for c in g.get("checks", []):
            lines.append(f"- {'✅' if c['ok'] else '❌'} {c['check']} (valor: {_num(c['value'])})")
        lines.append("")
    champ = d["champion"]
    verdict = {
        "meta": "Se usa la regla + meta-modelo.",
        "regla": "Se usa solo la regla de tendencia (el ML no aportó lo suficiente).",
        "ninguno": "Ninguna variante pasó la puerta: el bot queda en **modo práctica (paper)**; NO operar con dinero real.",
    }[champ]
    lines += ["## Veredicto", "", verdict, ""]
    if d["per_symbol"]:
        lines += [
            "## Por cripto (variante elegida)",
            "",
            "| Cripto | Retorno | Sharpe | Caída máx. | Operaciones |",
            "|---|---|---|---|---|",
        ]
        for s, m in d["per_symbol"].items():
            lines.append(
                f"| {s} | {_pct(m.get('total_return'))} | {_num(m.get('sharpe'))} | {_pct(m.get('max_drawdown'))} | {m.get('n_trades', 0)} |"
            )
    lines += [
        "",
        "> Resultados pasados no garantizan resultados futuros. Esto no es asesoría financiera.",
    ]
    return "\n".join(lines) + "\n"


def save_report(
    report: ResearchReport, out_dir: Path, title: str = "Reporte de investigación"
) -> dict[str, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    md = out_dir / "reporte.md"
    js = out_dir / "reporte.json"
    md.write_text(to_markdown(report, title), encoding="utf-8")
    js.write_text(
        json.dumps(report.to_dict(), ensure_ascii=False, indent=1, default=str), encoding="utf-8"
    )
    return {"markdown": md, "json": js}
