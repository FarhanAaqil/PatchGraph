"""CycloneDX (1.4-1.6) and SPDX (2.3) SBOM validation and normalization (Day 8).

Validates schema versions, canonicalizes package coordinates, verifies dependency
references are resolvable, collapses duplicate dependency edges while preserving
provenance, and returns location-specific field errors.
"""
from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Set, Tuple

from backend.app.catalog.packages import (
    NormalizedPackageCoord,
    normalize_ecosystem,
    normalize_package_name,
    normalize_version_string,
    parse_and_normalize_purl,
)

PARSER_VERSION = "1.2.0"
MAX_SBOM_NODES = 100_000
MAX_JSON_DEPTH = 64


@dataclass(frozen=True)
class NormalizedDependencyEdge:
    parent_ref: str
    child_ref: str
    scope: str = "runtime"
    optional: bool = False


@dataclass
class ValidatedSbomDocument:
    kind: str
    spec_version: str
    content_sha256: str
    parser_version: str
    application_name: str
    components: Dict[str, NormalizedPackageCoord] = field(default_factory=dict)
    edges: List[NormalizedDependencyEdge] = field(default_factory=list)
    collapsed_duplicate_edges: int = 0
    errors: List[Dict[str, str]] = field(default_factory=list)


def _check_depth(obj: Any, depth: int = 0) -> int:
    if depth > MAX_JSON_DEPTH:
        return depth
    if isinstance(obj, dict):
        return max((_check_depth(v, depth + 1) for v in obj.values()), default=depth + 1)
    if isinstance(obj, list):
        return max((_check_depth(v, depth + 1) for v in obj), default=depth + 1)
    return depth


def validate_and_parse_sbom(kind: str, document: Dict[str, Any]) -> ValidatedSbomDocument:
    canonical_bytes = json.dumps(document, sort_keys=True).encode("utf-8")
    sha256_hex = hashlib.sha256(canonical_bytes).hexdigest()
    errors: List[Dict[str, str]] = []

    depth = _check_depth(document)
    if depth > MAX_JSON_DEPTH:
        errors.append(
            {
                "field": "document",
                "issue": f"JSON nesting depth {depth} exceeds limit {MAX_JSON_DEPTH}",
                "location": "$",
            }
        )
        return ValidatedSbomDocument(
            kind=kind,
            spec_version="unknown",
            content_sha256=sha256_hex,
            parser_version=PARSER_VERSION,
            application_name="unknown",
            errors=errors,
        )

    if kind == "cyclonedx":
        return _parse_cyclonedx(document, sha256_hex)
    if kind == "spdx":
        return _parse_spdx(document, sha256_hex)

    return ValidatedSbomDocument(
        kind=kind,
        spec_version="unknown",
        content_sha256=sha256_hex,
        parser_version=PARSER_VERSION,
        application_name="unknown",
        errors=[{"field": "kind", "issue": f"Unsupported SBOM kind '{kind}'", "location": "$.kind"}],
    )


def _parse_cyclonedx(doc: Dict[str, Any], sha256_hex: str) -> ValidatedSbomDocument:
    errors: List[Dict[str, str]] = []
    bom_format = doc.get("bomFormat")
    spec_version = str(doc.get("specVersion", ""))
    if bom_format != "CycloneDX" or spec_version not in ("1.4", "1.5", "1.6"):
        errors.append(
            {
                "field": "specVersion",
                "issue": "CycloneDX requires bomFormat='CycloneDX' and specVersion in 1.4-1.6",
                "location": "$.specVersion",
            }
        )

    meta_comp = (doc.get("metadata") or {}).get("component") or {}
    app_name = meta_comp.get("name", "default-application")
    root_ref = meta_comp.get("bom-ref")

    raw_components = doc.get("components") or []
    if len(raw_components) > MAX_SBOM_NODES:
        errors.append(
            {
                "field": "components",
                "issue": f"Component count {len(raw_components)} exceeds {MAX_SBOM_NODES}",
                "location": "$.components",
            }
        )

    components: Dict[str, NormalizedPackageCoord] = {}
    for idx, comp in enumerate(raw_components):
        loc = f"$.components[{idx}]"
        bom_ref = comp.get("bom-ref") or comp.get("purl")
        name = comp.get("name")
        version = comp.get("version")
        purl = comp.get("purl")
        if not name:
            errors.append({"field": "name", "issue": "Component missing required name", "location": f"{loc}.name"})
            continue
        if not version:
            errors.append({"field": "version", "issue": "Component missing required version", "location": f"{loc}.version"})
            continue
        try:
            if purl:
                coord = parse_and_normalize_purl(purl)
            else:
                norm_name = normalize_package_name("generic", name)
                norm_ver = normalize_version_string(version)
                coord = NormalizedPackageCoord(
                    ecosystem="generic",
                    normalized_name=norm_name,
                    version=version,
                    normalized_version=norm_ver,
                    purl=f"pkg:generic/{norm_name}@{norm_ver}",
                )
            ref_key = bom_ref or coord.purl
            components[ref_key] = coord
        except ValueError as exc:
            errors.append({"field": "purl", "issue": str(exc), "location": f"{loc}.purl"})

    known_refs: Set[str] = set(components.keys())
    if root_ref:
        known_refs.add(root_ref)

    seen_edges: Set[Tuple[str, str, str]] = set()
    edges: List[NormalizedDependencyEdge] = []
    collapsed_duplicates = 0

    for idx, dep_entry in enumerate(doc.get("dependencies") or []):
        loc = f"$.dependencies[{idx}]"
        parent_ref = dep_entry.get("ref")
        if not parent_ref or parent_ref not in known_refs:
            errors.append(
                {
                    "field": "ref",
                    "issue": f"Unresolvable dependency parent ref '{parent_ref}'",
                    "location": f"{loc}.ref",
                }
            )
            continue
        for c_idx, child_ref in enumerate(dep_entry.get("dependsOn") or []):
            if child_ref not in known_refs:
                errors.append(
                    {
                        "field": "dependsOn",
                        "issue": f"Unresolvable dependency target '{child_ref}'",
                        "location": f"{loc}.dependsOn[{c_idx}]",
                    }
                )
                continue
            if parent_ref == root_ref:
                # Root application to direct component link; component edges stored between package versions
                continue
            edge_key = (parent_ref, child_ref, "runtime")
            if edge_key in seen_edges:
                collapsed_duplicates += 1
                continue
            seen_edges.add(edge_key)
            edges.append(NormalizedDependencyEdge(parent_ref=parent_ref, child_ref=child_ref, scope="runtime"))

    return ValidatedSbomDocument(
        kind="cyclonedx",
        spec_version=spec_version,
        content_sha256=sha256_hex,
        parser_version=PARSER_VERSION,
        application_name=app_name,
        components=components,
        edges=edges,
        collapsed_duplicate_edges=collapsed_duplicates,
        errors=errors,
    )


def _parse_spdx(doc: Dict[str, Any], sha256_hex: str) -> ValidatedSbomDocument:
    errors: List[Dict[str, str]] = []
    spdx_version = str(doc.get("spdxVersion", ""))
    if spdx_version != "SPDX-2.3":
        errors.append(
            {
                "field": "spdxVersion",
                "issue": "SPDX document requires spdxVersion='SPDX-2.3'",
                "location": "$.spdxVersion",
            }
        )

    app_name = doc.get("name", "spdx-application")
    components: Dict[str, NormalizedPackageCoord] = {}

    for idx, pkg in enumerate(doc.get("packages") or []):
        loc = f"$.packages[{idx}]"
        spdx_id = pkg.get("SPDXID")
        name = pkg.get("name")
        version = pkg.get("versionInfo")
        if not spdx_id or not name or not version:
            errors.append(
                {
                    "field": "package",
                    "issue": "SPDX package requires SPDXID, name, and versionInfo",
                    "location": loc,
                }
            )
            continue
        purl = None
        for ext in pkg.get("externalRefs") or []:
            if ext.get("referenceType") == "purl":
                purl = ext.get("referenceLocator")
                break
        try:
            if purl:
                coord = parse_and_normalize_purl(purl)
            else:
                norm_name = normalize_package_name("generic", name)
                norm_ver = normalize_version_string(version)
                coord = NormalizedPackageCoord(
                    ecosystem="generic",
                    normalized_name=norm_name,
                    version=version,
                    normalized_version=norm_ver,
                    purl=f"pkg:generic/{norm_name}@{norm_ver}",
                )
            components[spdx_id] = coord
        except ValueError as exc:
            errors.append({"field": "externalRefs", "issue": str(exc), "location": f"{loc}.externalRefs"})

    seen_edges: Set[Tuple[str, str, str]] = set()
    edges: List[NormalizedDependencyEdge] = []
    collapsed_duplicates = 0

    for idx, rel in enumerate(doc.get("relationships") or []):
        if rel.get("relationshipType") != "DEPENDS_ON":
            continue
        loc = f"$.relationships[{idx}]"
        parent_id = rel.get("spdxElementId")
        child_id = rel.get("relatedSpdxElement")
        if parent_id not in components or child_id not in components:
            errors.append(
                {
                    "field": "relationship",
                    "issue": f"Unresolvable SPDX relationship {parent_id} -> {child_id}",
                    "location": loc,
                }
            )
            continue
        edge_key = (parent_id, child_id, "runtime")
        if edge_key in seen_edges:
            collapsed_duplicates += 1
            continue
        seen_edges.add(edge_key)
        edges.append(NormalizedDependencyEdge(parent_ref=parent_id, child_ref=child_id, scope="runtime"))

    return ValidatedSbomDocument(
        kind="spdx",
        spec_version=spdx_version,
        content_sha256=sha256_hex,
        parser_version=PARSER_VERSION,
        application_name=app_name,
        components=components,
        edges=edges,
        collapsed_duplicate_edges=collapsed_duplicates,
        errors=errors,
    )
