"""Registro de modelos versionados (champion / challenger)."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import joblib


@dataclass
class ModelCard:
    version: str
    created_at: str
    cost_profile: str
    params: dict[str, Any]
    train_start: str | None
    train_end: str | None
    n_events: int
    uses_meta: bool
    oos_metrics: dict[str, Any] = field(default_factory=dict)
    gate: dict[str, Any] = field(default_factory=dict)
    feature_importance: dict[str, float] = field(default_factory=dict)
    status: str = "challenger"
    notes: str = ""


class ModelRegistry:
    def __init__(self, root: Path | str):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _dir(self, version: str) -> Path:
        return self.root / version

    @staticmethod
    def new_version() -> str:
        return datetime.now(UTC).strftime("v%Y%m%d-%H%M%S")

    def save(self, card: ModelCard, artifacts: dict[str, Any]) -> Path:
        d = self._dir(card.version)
        d.mkdir(parents=True, exist_ok=True)
        for name, obj in artifacts.items():
            joblib.dump(obj, d / f"{name}.joblib")
        (d / "card.json").write_text(json.dumps(asdict(card), indent=2, ensure_ascii=False, default=str))
        return d

    def load(self, version: str) -> tuple[ModelCard, dict[str, Any]]:
        d = self._dir(version)
        card = ModelCard(**json.loads((d / "card.json").read_text()))
        artifacts = {p.stem: joblib.load(p) for p in d.glob("*.joblib")}
        return card, artifacts

    def list_cards(self) -> list[ModelCard]:
        cards = []
        for d in sorted(self.root.iterdir()):
            f = d / "card.json"
            if d.is_dir() and f.exists():
                cards.append(ModelCard(**json.loads(f.read_text())))
        return cards

    def champion_version(self) -> str | None:
        f = self.root / "CHAMPION"
        return f.read_text().strip() if f.exists() else None

    def promote(self, version: str) -> None:
        prev = self.champion_version()
        if prev and prev != version and (self._dir(prev) / "card.json").exists():
            self._set_status(prev, "retired")
        self._set_status(version, "champion")
        (self.root / "CHAMPION").write_text(version)

    def _set_status(self, version: str, status: str) -> None:
        f = self._dir(version) / "card.json"
        data = json.loads(f.read_text())
        data["status"] = status
        f.write_text(json.dumps(data, indent=2, ensure_ascii=False, default=str))

    def load_champion(self) -> tuple[ModelCard, dict[str, Any]] | None:
        v = self.champion_version()
        if not v or not (self._dir(v) / "card.json").exists():
            return None
        return self.load(v)
