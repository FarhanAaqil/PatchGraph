"""Defensive Static AST Source Scanner & Call-Graph Reachability Analyzer (`backend/app/ingest/static_scanner.py`).

Inspects uploaded Python source files using `ast` (without executing code!) to:
1. Detect unknown/zero-day dangerous sink patterns (`pickle.loads`, `yaml.load`, `eval`, `exec`, `subprocess` with `shell=True`).
2. Verify call-graph reachability (whether a service actually imports and calls a vulnerable library symbol).
"""
from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Any, Dict, List, Set


DANGEROUS_SINKS = {
    ("pickle", "loads"): ("CWE-502", "HIGH", "Untrusted deserialization via pickle.loads"),
    ("pickle", "load"): ("CWE-502", "HIGH", "Untrusted deserialization via pickle.load"),
    ("yaml", "load"): ("CWE-502", "HIGH", "Unsafe YAML deserialization without SafeLoader"),
    ("builtins", "eval"): ("CWE-95", "CRITICAL", "Dynamic code evaluation via eval()"),
    ("builtins", "exec"): ("CWE-95", "CRITICAL", "Dynamic code execution via exec()"),
    ("marshal", "loads"): ("CWE-502", "HIGH", "Untrusted bytecode deserialization via marshal.loads"),
}


@dataclass(frozen=True)
class StaticCodeFinding:
    rule_id: str
    cwe: str
    severity: str
    line: int
    symbol: str
    description: str


@dataclass(frozen=True)
class ReachabilityScanResult:
    imported_modules: List[str]
    called_symbols: List[str]
    heuristic_findings: List[StaticCodeFinding]
    package_reachable: Dict[str, bool]


def scan_python_source_ast(
    source_code: str,
    filename: str = "service_entrypoint.py",
    watched_packages: List[str] | None = None,
) -> ReachabilityScanResult:
    """Parse Python source into an AST without executing it and extract imports, calls, and sink findings."""
    tree = ast.parse(source_code, filename=filename)
    imported_modules: Set[str] = set()
    alias_map: Dict[str, str] = {}
    called_symbols: Set[str] = set()
    findings: List[StaticCodeFinding] = []

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for name in node.names:
                root_mod = name.name.split(".")[0].replace("_", "-")
                imported_modules.add(root_mod)
                alias_map[name.asname or name.name] = name.name
        elif isinstance(node, ast.ImportFrom):
            if node.module:
                root_mod = node.module.split(".")[0].replace("_", "-")
                imported_modules.add(root_mod)
                for name in node.names:
                    alias_map[name.asname or name.name] = f"{node.module}.{name.name}"
        elif isinstance(node, ast.Call):
            lineno = getattr(node, "lineno", 1)
            if isinstance(node.func, ast.Name):
                fn_name = node.func.id
                resolved = alias_map.get(fn_name, f"builtins.{fn_name}")
                called_symbols.add(resolved)
                parts = resolved.split(".")
                key = (parts[0], parts[-1])
                if key in DANGEROUS_SINKS:
                    cwe, sev, desc = DANGEROUS_SINKS[key]
                    findings.append(StaticCodeFinding(f"AST-{cwe}", cwe, sev, lineno, resolved, desc))
            elif isinstance(node.func, ast.Attribute) and isinstance(node.func.value, ast.Name):
                base = alias_map.get(node.func.value.id, node.func.value.id)
                attr = node.func.attr
                resolved = f"{base}.{attr}"
                called_symbols.add(resolved)
                key = (base.split(".")[0], attr)
                if key in DANGEROUS_SINKS:
                    cwe, sev, desc = DANGEROUS_SINKS[key]
                    findings.append(StaticCodeFinding(f"AST-{cwe}", cwe, sev, lineno, resolved, desc))
                if base.split(".")[0] == "subprocess":
                    for kw in node.keywords:
                        if kw.arg == "shell" and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                            findings.append(
                                StaticCodeFinding(
                                    "AST-CWE-78",
                                    "CWE-78",
                                    "HIGH",
                                    lineno,
                                    resolved,
                                    "Subprocess invoked with shell=True",
                                )
                            )

    watched = watched_packages or ["example-lib", "urllib3"]
    pkg_reach: Dict[str, bool] = {}
    for pkg in watched:
        norm = pkg.lower().replace("_", "-")
        pkg_reach[pkg] = norm in imported_modules or any(
            s.lower().replace("_", "-").startswith(norm) for s in called_symbols
        )

    return ReachabilityScanResult(
        imported_modules=sorted(imported_modules),
        called_symbols=sorted(called_symbols),
        heuristic_findings=findings,
        package_reachable=pkg_reach,
    )
