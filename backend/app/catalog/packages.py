"""Package ecosystem, name, version, and Package URL (purl) normalization (Day 9).

Implements deterministic canonicalization per 03_TRD_PatchGraph.md and 20_Data_Specification_PatchGraph.md.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional, Tuple

ALLOWED_ECOSYSTEMS = {"pypi", "npm", "maven", "golang", "cargo", "nuget", "generic"}
PURL_RE = re.compile(r"^pkg:([a-zA-Z0-9._-]+)/(?:([^/@]+)/)?([^/@]+)@([^?#]+)")


@dataclass(frozen=True)
class NormalizedPackageCoord:
    ecosystem: str
    normalized_name: str
    version: str
    normalized_version: str
    purl: str


def normalize_ecosystem(ecosystem: str) -> str:
    eco = (ecosystem or "").strip().lower()
    if eco in ("pip", "python"):
        eco = "pypi"
    elif eco in ("node", "nodejs"):
        eco = "npm"
    elif eco in ("go",):
        eco = "golang"
    if eco not in ALLOWED_ECOSYSTEMS:
        raise ValueError(f"Unsupported package ecosystem: '{ecosystem}'")
    return eco


def normalize_package_name(ecosystem: str, name: str) -> str:
    raw = (name or "").strip()
    if not raw:
        raise ValueError("Package name cannot be empty")
    eco = normalize_ecosystem(ecosystem)
    if eco == "pypi":
        # PEP 503 canonicalization: lowercase and collapse runs of [-_.] to a single '-'
        return re.sub(r"[-_.]+", "-", raw).lower()
    return raw.lower()


def normalize_version_string(version: str) -> str:
    raw = (version or "").strip()
    if not raw:
        raise ValueError("Package version cannot be empty")
    if raw.startswith("v") and len(raw) > 1 and raw[1].isdigit():
        raw = raw[1:]
    return raw


def parse_version_tuple(version: str) -> Optional[Tuple[int, ...]]:
    """Parse standard semantic version into integer tuple for deterministic range comparison."""
    try:
        clean = normalize_version_string(version).split("-")[0].split("+")[0]
        parts = tuple(int(p) for p in clean.split("."))
        return parts
    except Exception:
        return None


def version_in_range(
    version: str,
    introduced: Optional[str] = None,
    fixed: Optional[str] = None,
    last_affected: Optional[str] = None,
) -> Optional[bool]:
    """Deterministic version-range check. Returns None if version string is unparseable (unknown)."""
    v_tup = parse_version_tuple(version)
    if v_tup is None:
        return None
    if introduced:
        intro_tup = parse_version_tuple(introduced)
        if intro_tup is None:
            return None
        if v_tup < intro_tup:
            return False
    if fixed:
        fix_tup = parse_version_tuple(fixed)
        if fix_tup is None:
            return None
        if v_tup >= fix_tup:
            return False
    if last_affected:
        last_tup = parse_version_tuple(last_affected)
        if last_tup is None:
            return None
        if v_tup > last_tup:
            return False
    return True


def parse_and_normalize_purl(purl: str) -> NormalizedPackageCoord:
    match = PURL_RE.match((purl or "").strip())
    if not match:
        raise ValueError(f"Invalid Package URL (purl): '{purl}'")
    raw_eco, namespace, name, ver = match.groups()
    eco = normalize_ecosystem(raw_eco)
    full_name = f"{namespace}/{name}" if namespace else name
    norm_name = normalize_package_name(eco, full_name)
    norm_ver = normalize_version_string(ver)
    canonical_purl = f"pkg:{eco}/{norm_name}@{norm_ver}"
    return NormalizedPackageCoord(
        ecosystem=eco,
        normalized_name=norm_name,
        version=ver,
        normalized_version=norm_ver,
        purl=canonical_purl,
    )
