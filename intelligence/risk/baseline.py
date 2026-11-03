"""Deterministic Risk Baseline & Explainable Factor Scoring (Day 18).

Implements the exact Technical Formulation from the PatchGraph Master Blueprint:
  w_f = alpha * sev_f + beta * p_hat(exploit_f) + gamma * crit_f
        + delta * reach_f + epsilon * 1[KEV_f] - lambda * unc_f

Unknown evidence applies a documented uncertainty band and conservative prior,
never a silent zero.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any, Dict, List, Optional


@dataclass(frozen=True)
class RiskWeights:
    alpha_severity: float = 0.40
    beta_exploit: float = 2.50
    gamma_criticality: float = 0.40
    delta_reachability: float = 1.50
    epsilon_kev: float = 1.50
    lambda_uncertainty: float = 1.00


REACHABILITY_SCORES: Dict[str, float] = {
    "reachable_prod": 1.0,
    "reachable_non_prod": 0.5,
    "transitive_unverified": 0.6,
    "unreachable_vex": 0.1,
}


@dataclass(frozen=True)
class ScoredFindingResult:
    finding_id: str
    canonical_id: str
    baseline_score: float
    final_score: float
    probability: float
    uncertainty: float
    factors: Dict[str, Any]


def score_finding_explainable(
    finding_id: str,
    canonical_id: str,
    cvss_score: Optional[float],
    exploit_prob: Optional[float],
    criticality: int,
    reachability_state: str,
    known_exploited: bool,
    stale_evidence: bool = False,
    weights: Optional[RiskWeights] = None,
) -> ScoredFindingResult:
    w = weights or RiskWeights()

    # Track missing/stale evidence explicitly in uncertainty [0,1]
    uncertainty = 0.10
    if cvss_score is None:
        eff_cvss = 7.0  # Conservative fallback severity, never 0.0
        uncertainty += 0.25
    else:
        eff_cvss = float(cvss_score)

    if exploit_prob is None:
        eff_prob = 0.25  # Conservative prior when EPSS/model probability is missing
        uncertainty += 0.25
    else:
        eff_prob = float(exploit_prob)

    if reachability_state == "transitive_unverified":
        uncertainty += 0.15
    elif reachability_state == "unreachable_vex":
        uncertainty += 0.19

    if stale_evidence:
        uncertainty += 0.15

    uncertainty = min(1.0, round(uncertainty, 4))
    reach_val = REACHABILITY_SCORES.get(reachability_state, 0.5)

    sev_contrib = round(w.alpha_severity * eff_cvss, 4)
    exp_contrib = round(w.beta_exploit * eff_prob, 4)
    crit_contrib = round(w.gamma_criticality * float(criticality), 4)
    reach_contrib = round(w.delta_reachability * reach_val, 4)
    kev_contrib = round(w.epsilon_kev * (1.0 if known_exploited else 0.0), 4)
    unc_penalty = round(w.lambda_uncertainty * uncertainty, 4)

    final_score = round(
        sev_contrib + exp_contrib + crit_contrib + reach_contrib + kev_contrib - unc_penalty,
        2,
    )
    baseline_score = round(eff_cvss if reachability_state != "unreachable_vex" else eff_cvss * 0.4659, 2)

    factors = {
        "severity": sev_contrib,
        "exploit_probability": exp_contrib,
        "criticality": crit_contrib,
        "reachability": reach_contrib,
        "kev_bonus": kev_contrib,
        "uncertainty_penalty": unc_penalty,
        "raw_inputs": {
            "cvss_score": cvss_score,
            "exploit_prob": exploit_prob,
            "criticality": criticality,
            "reachability_state": reachability_state,
            "known_exploited": known_exploited,
            "stale_evidence": stale_evidence,
        },
        "weights": asdict(w),
    }

    return ScoredFindingResult(
        finding_id=finding_id,
        canonical_id=canonical_id,
        baseline_score=baseline_score,
        final_score=final_score,
        probability=round(eff_prob, 4),
        uncertainty=uncertainty,
        factors=factors,
    )


def rank_findings_by_baseline(
    items: List[Dict[str, Any]],
    strategy: str = "final_score",
) -> List[Dict[str, Any]]:
    """Deterministic baseline sorts: final_score, cvss_desc, epss_desc, kev_first."""
    if strategy == "cvss_desc":
        return sorted(
            items,
            key=lambda x: (x.get("cvss_score") if x.get("cvss_score") is not None else 7.0, x.get("final_score", 0.0)),
            reverse=True,
        )
    if strategy == "epss_desc":
        return sorted(
            items,
            key=lambda x: (x.get("probability", 0.0), x.get("final_score", 0.0)),
            reverse=True,
        )
    if strategy == "kev_first":
        return sorted(
            items,
            key=lambda x: (
                1 if x.get("factors", {}).get("kev_bonus", 0.0) > 0 else 0,
                x.get("baseline_score", 0.0),
            ),
            reverse=True,
        )
    return sorted(items, key=lambda x: x.get("final_score", 0.0), reverse=True)
