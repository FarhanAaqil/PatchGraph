"""Calibrated Exploit-Likelihood Model with Temporal and Package-Family Leakage Controls (Days 19-20).

Implements:
- Time-based disclosure split (published_at <= cutoff_date) and package-family grouping
  so no package family spans both train and test sets and no post-cutoff label leaks into training.
- L2-regularized Logistic Regression + Gradient Boosted Tree comparator
- Platt sigmoid calibration + reliability bin evaluation (Brier score, ECE, PR-AUC, ROC-AUC)
- Factor-level log-odds contribution breakdown for explainability.
"""
from __future__ import annotations

import hashlib
import json
import math
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np


FEATURE_NAMES = [
    "cvss_norm",
    "epss",
    "age_log_norm",
    "is_remote_vector",
    "is_deserialization_or_rce_cwe",
    "reference_density",
]


@dataclass(frozen=True)
class VulnerabilityFeatureRow:
    cve_id: str
    package_family: str
    ecosystem: str
    published_date: str  # YYYY-MM-DD
    as_of_date: str      # YYYY-MM-DD (must be >= published_date)
    cvss_score: Optional[float]
    epss: Optional[float]
    age_days: int
    is_remote_vector: bool
    is_deserialization_or_rce_cwe: bool
    reference_count: int
    exploited_within_horizon: int  # 0 or 1 ground-truth label observed before cutoff


def verify_no_temporal_or_family_leakage(
    train_rows: List[VulnerabilityFeatureRow],
    test_rows: List[VulnerabilityFeatureRow],
    cutoff_date: str,
) -> Dict[str, Any]:
    """Enforce zero temporal leakage and zero package-family overlap between train and test."""
    for r in train_rows:
        if r.published_date > cutoff_date or r.as_of_date > cutoff_date:
            raise ValueError(
                f"Temporal leakage detected in training row {r.cve_id}: "
                f"published={r.published_date}, as_of={r.as_of_date} > cutoff={cutoff_date}"
            )
    for r in test_rows:
        if r.published_date <= cutoff_date:
            raise ValueError(
                f"Temporal split violation in test row {r.cve_id}: "
                f"published={r.published_date} <= cutoff={cutoff_date}"
            )

    train_families = {r.package_family for r in train_rows}
    test_families = {r.package_family for r in test_rows}
    overlap = train_families.intersection(test_families)
    if overlap:
        raise ValueError(f"Package-family leakage detected between train and test: {sorted(overlap)}")

    return {
        "cutoff_date": cutoff_date,
        "train_count": len(train_rows),
        "test_count": len(test_rows),
        "family_overlap_count": len(overlap),
        "leakage_check_passed": True,
    }


def extract_feature_vector(row: VulnerabilityFeatureRow) -> np.ndarray:
    cvss_norm = (float(row.cvss_score) if row.cvss_score is not None else 7.0) / 10.0
    epss_val = float(row.epss) if row.epss is not None else 0.20
    age_log_norm = min(1.0, math.log1p(max(0, row.age_days)) / math.log1p(365.0))
    ref_density = min(1.0, float(row.reference_count) / 10.0)
    return np.array(
        [
            cvss_norm,
            epss_val,
            age_log_norm,
            1.0 if row.is_remote_vector else 0.0,
            1.0 if row.is_deserialization_or_rce_cwe else 0.0,
            ref_density,
        ],
        dtype=np.float64,
    )


def _sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30.0, 30.0)))


class CalibratedExploitModel:
    """L2-regularized logistic regression with Platt calibration and per-feature explanations."""

    def __init__(self, l2_reg: float = 0.25, seed: int = 42) -> None:
        self.l2_reg = l2_reg
        self.seed = seed
        self.weights = np.zeros(len(FEATURE_NAMES), dtype=np.float64)
        self.bias = 0.0
        self.platt_a = 1.0
        self.platt_b = 0.0
        self.model_version = "calibrated-logreg-v1"

    def fit(self, rows: List[VulnerabilityFeatureRow]) -> "CalibratedExploitModel":
        X = np.vstack([extract_feature_vector(r) for r in rows])
        y = np.array([float(r.exploited_within_horizon) for r in rows], dtype=np.float64)

        w = np.zeros(X.shape[1], dtype=np.float64)
        b = 0.0
        lr = 0.35
        n = float(len(rows))
        for _ in range(400):
            logits = X @ w + b
            preds = _sigmoid(logits)
            err = preds - y
            grad_w = (X.T @ err) / n + self.l2_reg * w
            grad_b = float(np.mean(err))
            w -= lr * grad_w
            b -= lr * grad_b

        self.weights = w
        self.bias = b

        # Platt scaling calibration step on raw logits
        raw_logits = X @ self.weights + self.bias
        a, c = 1.0, 0.0
        for _ in range(200):
            p = _sigmoid(a * raw_logits + c)
            diff = p - y
            a -= 0.1 * float(np.mean(diff * raw_logits))
            c -= 0.1 * float(np.mean(diff))
        self.platt_a = a
        self.platt_b = c
        return self

    def predict_proba_one(self, row: VulnerabilityFeatureRow) -> Dict[str, Any]:
        x = extract_feature_vector(row)
        raw_logit = float(np.dot(self.weights, x) + self.bias)
        calibrated_logit = self.platt_a * raw_logit + self.platt_b
        prob = float(_sigmoid(np.array([calibrated_logit]))[0])

        contributions = {
            FEATURE_NAMES[i]: round(float(self.weights[i] * x[i] * self.platt_a), 4)
            for i in range(len(FEATURE_NAMES))
        }
        return {
            "cve_id": row.cve_id,
            "probability": round(prob, 4),
            "raw_logit": round(raw_logit, 4),
            "calibrated_logit": round(calibrated_logit, 4),
            "feature_contributions": contributions,
            "model_version": self.model_version,
        }

    def predict_proba(self, rows: List[VulnerabilityFeatureRow]) -> np.ndarray:
        X = np.vstack([extract_feature_vector(r) for r in rows])
        logits = self.platt_a * (X @ self.weights + self.bias) + self.platt_b
        return _sigmoid(logits)

    def to_bundle_dict(self) -> Dict[str, Any]:
        payload = {
            "model_version": self.model_version,
            "feature_names": FEATURE_NAMES,
            "weights": [round(float(v), 6) for v in self.weights],
            "bias": round(float(self.bias), 6),
            "platt_a": round(float(self.platt_a), 6),
            "platt_b": round(float(self.platt_b), 6),
            "l2_reg": self.l2_reg,
            "seed": self.seed,
        }
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
        payload["bundle_sha256"] = digest
        return payload

    @classmethod
    def from_bundle_dict(cls, data: Dict[str, Any]) -> "CalibratedExploitModel":
        m = cls(l2_reg=float(data.get("l2_reg", 0.25)), seed=int(data.get("seed", 42)))
        m.weights = np.array(data["weights"], dtype=np.float64)
        m.bias = float(data["bias"])
        m.platt_a = float(data["platt_a"])
        m.platt_b = float(data["platt_b"])
        m.model_version = data.get("model_version", "calibrated-logreg-v1")
        return m


class CalibratedGradientBoostingComparator:
    """Gradient Boosted decision tree ensemble comparator with Platt calibration."""

    def __init__(self, n_estimators: int = 40, max_depth: int = 3, learning_rate: float = 0.08, seed: int = 42) -> None:
        self.n_estimators = n_estimators
        self.max_depth = max_depth
        self.learning_rate = learning_rate
        self.seed = seed
        self.model_version = "calibrated-gb-v1"
        self._clf: Any = None
        self.feature_importances_: List[float] = []

    def fit(self, rows: List[VulnerabilityFeatureRow]) -> "CalibratedGradientBoostingComparator":
        from sklearn.ensemble import GradientBoostingClassifier
        from sklearn.calibration import CalibratedClassifierCV
        X = np.vstack([extract_feature_vector(r) for r in rows])
        y = np.array([float(r.exploited_within_horizon) for r in rows], dtype=np.float64)

        base = GradientBoostingClassifier(
            n_estimators=self.n_estimators,
            max_depth=self.max_depth,
            learning_rate=self.learning_rate,
            random_state=self.seed,
        )
        base.fit(X, y)
        self.feature_importances_ = [round(float(v), 4) for v in base.feature_importances_]

        self._clf = CalibratedClassifierCV(estimator=base, method="sigmoid", cv=3)
        self._clf.fit(X, y)
        return self

    def predict_proba(self, rows: List[VulnerabilityFeatureRow]) -> np.ndarray:
        if self._clf is None:
            raise RuntimeError("Model is not fitted.")
        X = np.vstack([extract_feature_vector(r) for r in rows])
        return self._clf.predict_proba(X)[:, 1]

    def to_bundle_dict(self) -> Dict[str, Any]:
        return {
            "model_version": self.model_version,
            "feature_names": FEATURE_NAMES,
            "feature_importances": self.feature_importances_,
            "n_estimators": self.n_estimators,
            "max_depth": self.max_depth,
            "learning_rate": self.learning_rate,
            "seed": self.seed,
        }


@dataclass(frozen=True)
class EffortEstimate:
    action_type: str
    hours: float
    downtime_minutes: int
    is_baseline_model: bool = True
    methodology: str = "Empirical fixed-hours maintenance baseline"


EFFORT_BASELINE_CATALOG: Dict[str, EffortEstimate] = {
    "upgrade": EffortEstimate(action_type="upgrade", hours=6.0, downtime_minutes=10),
    "minor_upgrade": EffortEstimate(action_type="minor_upgrade", hours=6.0, downtime_minutes=10),
    "major_upgrade": EffortEstimate(action_type="major_upgrade", hours=16.0, downtime_minutes=45),
    "config_change": EffortEstimate(action_type="config_change", hours=3.0, downtime_minutes=5),
}


def get_effort_estimate(action_type: str = "upgrade") -> EffortEstimate:
    return EFFORT_BASELINE_CATALOG.get(action_type, EFFORT_BASELINE_CATALOG["upgrade"])


def compute_binary_classification_metrics(y_true: np.ndarray, y_prob: np.ndarray, n_bins: int = 5) -> Dict[str, Any]:
    """Compute Brier score, Expected Calibration Error (ECE), ROC-AUC, and PR-AUC."""
    brier = float(np.mean((y_prob - y_true) ** 2))

    # Reliability bins & ECE
    bins = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    reliability_bins = []
    n = float(len(y_true))
    for i in range(n_bins):
        lo, hi = bins[i], bins[i + 1]
        if i == n_bins - 1:
            mask = (y_prob >= lo) & (y_prob <= hi)
        else:
            mask = (y_prob >= lo) & (y_prob < hi)
        count = int(np.sum(mask))
        if count > 0:
            mean_pred = float(np.mean(y_prob[mask]))
            frac_pos = float(np.mean(y_true[mask]))
            ece += (count / n) * abs(mean_pred - frac_pos)
            reliability_bins.append(
                {
                    "bin": f"[{lo:.2f}, {hi:.2f}]",
                    "count": count,
                    "mean_predicted_prob": round(mean_pred, 4),
                    "observed_positive_rate": round(frac_pos, 4),
                }
            )

    # ROC-AUC via Mann-Whitney U
    pos = y_prob[y_true == 1]
    neg = y_prob[y_true == 0]
    if len(pos) > 0 and len(neg) > 0:
        u_stat = 0.0
        for p in pos:
            u_stat += float(np.sum(p > neg)) + 0.5 * float(np.sum(p == neg))
        roc_auc = u_stat / float(len(pos) * len(neg))
    else:
        roc_auc = 0.5

    # PR-AUC via precision-recall trapezoidal integration
    order = np.argsort(-y_prob)
    y_sorted = y_true[order]
    tp = np.cumsum(y_sorted == 1)
    fp = np.cumsum(y_sorted == 0)
    total_pos = max(1.0, float(np.sum(y_true == 1)))
    recalls = tp / total_pos
    precisions = tp / np.maximum(1.0, tp + fp)
    pr_auc = 0.0
    prev_r = 0.0
    for r_val, p_val in zip(recalls, precisions):
        pr_auc += float(p_val) * float(r_val - prev_r)
        prev_r = float(r_val)

    return {
        "brier_score": round(brier, 4),
        "ece": round(ece, 4),
        "roc_auc": round(roc_auc, 4),
        "pr_auc": round(pr_auc, 4),
        "reliability_bins": reliability_bins,
    }


DEFAULT_EXPLOIT_BUNDLE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "fixtures" / "model_exploit_v1.json"
_CACHED_EXPLOIT_MODEL: Optional[CalibratedExploitModel] = None


def load_pretrained_exploit_model(bundle_path: Optional[Path] = None) -> CalibratedExploitModel:
    global _CACHED_EXPLOIT_MODEL
    target = bundle_path or DEFAULT_EXPLOIT_BUNDLE_PATH
    if _CACHED_EXPLOIT_MODEL is None or bundle_path is not None:
        data = json.loads(target.read_text(encoding="utf-8"))
        model = CalibratedExploitModel.from_bundle_dict(data)
        if bundle_path is None:
            _CACHED_EXPLOIT_MODEL = model
        return model
    return _CACHED_EXPLOIT_MODEL


def predict_vulnerability_exploit_risk(
    cve_id: str,
    cvss_score: Optional[float] = None,
    epss: Optional[float] = None,
    age_days: int = 30,
    is_remote_vector: bool = True,
    is_deserialization_or_rce_cwe: bool = False,
    reference_count: int = 5,
    model: Optional[CalibratedExploitModel] = None,
) -> Dict[str, Any]:
    active_model = model or load_pretrained_exploit_model()
    row = VulnerabilityFeatureRow(
        cve_id=cve_id,
        package_family="production_runtime",
        ecosystem="generic",
        published_date="2026-01-01",
        as_of_date="2026-01-01",
        cvss_score=cvss_score,
        epss=epss,
        age_days=age_days,
        is_remote_vector=is_remote_vector,
        is_deserialization_or_rce_cwe=is_deserialization_or_rce_cwe,
        reference_count=reference_count,
        exploited_within_horizon=0,
    )
    return active_model.predict_proba_one(row)
