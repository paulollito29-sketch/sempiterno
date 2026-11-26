"""Estado de riesgo del portafolio: drawdown, pérdida diaria, frecuencia de operaciones, pausa."""

from __future__ import annotations

from dataclasses import dataclass, field

import pandas as pd

from cryptobot.config import RiskLimits


@dataclass
class RiskState:
    peak_equity: float = 0.0
    day: str | None = None
    day_start_equity: float = 0.0
    entry_times: list[pd.Timestamp] = field(default_factory=list)
    paused: bool = False

    def update(self, equity: float, now: pd.Timestamp) -> None:
        d = now.strftime("%Y-%m-%d")
        if d != self.day:
            self.day = d
            self.day_start_equity = equity
        self.peak_equity = max(self.peak_equity, equity)

    def drawdown(self, equity: float) -> float:
        return equity / self.peak_equity - 1.0 if self.peak_equity > 0 else 0.0

    def daily_pnl(self, equity: float) -> float:
        return equity / self.day_start_equity - 1.0 if self.day_start_equity > 0 else 0.0

    def trades_last_7d(self, now: pd.Timestamp) -> int:
        cutoff = now - pd.Timedelta(days=7)
        self.entry_times = [t for t in self.entry_times if t > cutoff]
        return len(self.entry_times)

    def register_entry(self, now: pd.Timestamp) -> None:
        self.entry_times.append(now)

    def defensive_reason(self, equity: float, limits: RiskLimits) -> str | None:
        if self.paused:
            return "bot en pausa"
        if self.drawdown(equity) <= -limits.max_drawdown:
            return f"modo defensivo: caída de {self.drawdown(equity):.1%} desde el máximo"
        if self.daily_pnl(equity) <= -limits.daily_loss_limit:
            return f"modo defensivo: pérdida diaria de {self.daily_pnl(equity):.1%}"
        return None

    def to_dict(self) -> dict:
        return {
            "peak_equity": self.peak_equity,
            "day": self.day,
            "day_start_equity": self.day_start_equity,
            "entry_times": [t.isoformat() for t in self.entry_times],
            "paused": self.paused,
        }

    @staticmethod
    def from_dict(d: dict | None) -> RiskState:
        if not d:
            return RiskState()
        return RiskState(
            peak_equity=float(d.get("peak_equity", 0.0)),
            day=d.get("day"),
            day_start_equity=float(d.get("day_start_equity", 0.0)),
            entry_times=[pd.Timestamp(t) for t in d.get("entry_times", [])],
            paused=bool(d.get("paused", False)),
        )
