"""Where experiment outputs are written.

The committed reports and model bundles are regenerated on purpose with the experiment scripts. Tests and CI
point `PATCHGRAPH_OUTPUT_DIR` at a scratch directory so running them never rewrites tracked files.
"""

from __future__ import annotations

import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def output_root() -> Path:
    override = os.environ.get("PATCHGRAPH_OUTPUT_DIR", "").strip()
    return Path(override) if override else REPO_ROOT


def reports_dir() -> Path:
    path = output_root() / "reports"
    path.mkdir(parents=True, exist_ok=True)
    return path


def model_fixtures_dir() -> Path:
    path = output_root() / "data" / "fixtures"
    path.mkdir(parents=True, exist_ok=True)
    return path
