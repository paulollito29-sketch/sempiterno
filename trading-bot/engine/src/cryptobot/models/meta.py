"""Meta-modelo (meta-labeling, López de Prado 2018): ¿vale la pena tomar esta compra?

LightGBM estima P(retorno neto > 0 | features) para cada candidata de la señal primaria.
La probabilidad se calibra (isotónica o Platt) con el tramo más reciente del entrenamiento,
porque el umbral de decisión depende de que "45%" signifique realmente 45%.

Umbral por valor esperado: se opera solo si
    p * ganancia_media - (1 - p) * pérdida_media >= min_edge
=>  p >= (pérdida_media + min_edge) / (ganancia_media + pérdida_media)
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from cryptobot.features.pipeline import FEATURE_COLUMNS

DEFAULT_LGBM_PARAMS = {
    "n_estimators": 250,
    "learning_rate": 0.03,
    "num_leaves": 8,
    "max_depth": 4,
    "min_child_samples": 40,
    "subsample": 0.8,
    "subsample_freq": 1,
    "colsample_bytree": 0.8,
    "reg_lambda": 5.0,
    "verbose": -1,
    "deterministic": True,
    "force_row_wise": True,
    "n_jobs": 2,
}


@dataclass
class PayoffStats:
    base_rate: float  # % de candidatas con retorno neto > 0
    avg_win: float  # ganancia neta media de las ganadoras (positiva)
    avg_loss: float  # pérdida neta media de las perdedoras (positiva)
    n: int

    def threshold(self, min_edge: float) -> float:
        denom = self.avg_win + self.avg_loss
        if denom <= 0:
            return 1.0
        return float(np.clip((self.avg_loss + min_edge) / denom, 0.0, 1.0))

    def expected_return(self, p: float) -> float:
        return p * self.avg_win - (1 - p) * self.avg_loss

    @staticmethod
    def from_returns(net_ret: np.ndarray) -> PayoffStats:
        r = np.asarray(net_ret, dtype="float64")
        r = r[np.isfinite(r)]
        if len(r) == 0:
            return PayoffStats(0.0, 0.0, 0.0, 0)
        wins, losses = r[r > 0], r[r <= 0]
        return PayoffStats(
            base_rate=float((r > 0).mean()),
            avg_win=float(wins.mean()) if len(wins) else 0.0,
            avg_loss=float(-losses.mean()) if len(losses) else 0.0,
            n=len(r),
        )


@dataclass
class MetaModel:
    feature_names: list[str] = field(default_factory=lambda: list(FEATURE_COLUMNS))
    lgbm_params: dict = field(default_factory=lambda: dict(DEFAULT_LGBM_PARAMS))
    calib_frac: float = 0.25
    seed: int = 0
    model: object | None = None
    calibrator: object | None = None
    calib_kind: str = "none"
    payoff: PayoffStats | None = None
    n_train: int = 0

    def fit(self, X: pd.DataFrame, y: np.ndarray, net_ret: np.ndarray, times: np.ndarray) -> MetaModel:
        from lightgbm import LGBMClassifier
        from sklearn.isotonic import IsotonicRegression
        from sklearn.linear_model import LogisticRegression

        order = np.argsort(np.asarray(times))
        X = X[self.feature_names].iloc[order].reset_index(drop=True)
        y = np.asarray(y)[order].astype(int)
        net_ret = np.asarray(net_ret)[order]
        self.payoff = PayoffStats.from_returns(net_ret)
        self.n_train = len(y)
        n_cal = int(len(y) * self.calib_frac)
        n_fit = len(y) - n_cal
        params = dict(self.lgbm_params, random_state=self.seed)
        model = LGBMClassifier(**params)
        if len(np.unique(y[:n_fit])) < 2:
            self.model = None
            return self
        model.fit(X.iloc[:n_fit], y[:n_fit])
        self.model = model
        self.calibrator, self.calib_kind = None, "none"
        if n_cal >= 30 and len(np.unique(y[n_fit:])) == 2:
            raw = model.predict_proba(X.iloc[n_fit:])[:, 1]
            if n_cal >= 150:
                iso = IsotonicRegression(out_of_bounds="clip", y_min=0.01, y_max=0.99)
                iso.fit(raw, y[n_fit:])
                self.calibrator, self.calib_kind = iso, "isotonic"
            else:
                lr = LogisticRegression()
                lr.fit(_logit(raw).reshape(-1, 1), y[n_fit:])
                self.calibrator, self.calib_kind = lr, "platt"
        return self

    def predict_proba(self, X: pd.DataFrame) -> np.ndarray:
        if self.model is None:
            base = self.payoff.base_rate if self.payoff else 0.5
            return np.full(len(X), base)
        raw = self.model.predict_proba(X[self.feature_names])[:, 1]
        if self.calibrator is None:
            return raw
        if self.calib_kind == "isotonic":
            return np.asarray(self.calibrator.predict(raw))
        return self.calibrator.predict_proba(_logit(raw).reshape(-1, 1))[:, 1]

    def explain(self, X: pd.DataFrame, top: int = 5) -> list[list[tuple[str, float]]]:
        """Contribuciones SHAP (TreeSHAP nativo de LightGBM) en log-odds, por fila."""
        if self.model is None:
            return [[] for _ in range(len(X))]
        contrib = self.model.booster_.predict(X[self.feature_names], pred_contrib=True)
        out = []
        for row in contrib:
            vals = row[:-1]  # el último es el sesgo
            order = np.argsort(-np.abs(vals))[:top]
            out.append([(self.feature_names[i], float(vals[i])) for i in order if vals[i] != 0])
        return out

    def feature_importance(self) -> dict[str, float]:
        if self.model is None:
            return {}
        gains = self.model.booster_.feature_importance(importance_type="gain")
        total = gains.sum() or 1.0
        return {f: float(g / total) for f, g in zip(self.feature_names, gains, strict=True)}


def _logit(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, 1e-6, 1 - 1e-6)
    return np.log(p / (1 - p))
