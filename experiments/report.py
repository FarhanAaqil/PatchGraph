"""Markdown table formatter and claim-verification helper for evaluation reports (Day 43)."""

from __future__ import annotations

from typing import Dict


def format_ci(metric_dict: Dict[str, float]) -> str:
    return f"{metric_dict['point']:.3f} [{metric_dict['ci_low']:.3f}, {metric_dict['ci_high']:.3f}]"
