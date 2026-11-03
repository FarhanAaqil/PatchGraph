# PatchGraph Query Needs and Sample Database States

## 1. Core Query Patterns and Index Alignment

| Query Need | Tables Joined | Supporting Index | Target Latency (100k edges) |
|---|---|---|---|
| Filtered asset inventory by project and environment | `assets`, `environments`, `deployments`, `services` | `idx_assets_project_environment` | < 100 ms |
| Forward/backward bounded dependency traversal (depth 1–12) | `dependencies`, `package_versions`, `packages` | `idx_dependencies_parent`, `idx_dependencies_child` | < 2,000 ms |
| Blast-radius resolution from `package_version_id` to services | `service_components`, `services`, `applications`, `environments` | `idx_service_components_version` | < 250 ms |
| Ranked findings queue for a project and risk run | `findings`, `finding_scores`, `vulnerabilities`, `package_versions` | `idx_findings_project_status`, `idx_scores_run_rank` | < 200 ms |
| Advisory provenance lookup by vulnerability and source | `advisories`, `affected_ranges`, `exploit_evidence` | `idx_advisories_vulnerability_source`, `idx_advisories_payload_gin` | < 150 ms |
| Append-only audit log timeline for a project | `audit_logs`, `users` | `idx_audit_project_created` | < 100 ms |

## 2. Canonical Sample States & JSONB Payloads

### 2.1 `evidence_snapshots.source_cutoffs`
```json
{
  "osv": {
    "fetched_at": "2026-11-01T00:00:00Z",
    "content_sha256": "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
    "source_url": "https://api.osv.dev/v1/querybatch",
    "stale": false
  },
  "nvd": {
    "fetched_at": "2026-11-01T00:00:00Z",
    "content_sha256": "2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    "source_url": "https://services.nvd.nist.gov/rest/json/cves/2.0",
    "stale": false
  },
  "epss": {
    "fetched_at": "2026-11-01T00:00:00Z",
    "content_sha256": "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
    "source_url": "https://api.first.org/data/v1/epss",
    "stale": false
  },
  "kev": {
    "fetched_at": "2026-11-01T00:00:00Z",
    "content_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    "source_url": "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
    "stale": false
  }
}
```

### 2.2 `finding_scores.factors`
```json
{
  "severity": 3.52,
  "exploit_probability": 2.15,
  "criticality": 2.00,
  "reachability": 1.50,
  "kev_bonus": 1.50,
  "uncertainty_penalty": 0.10,
  "weights": {
    "alpha_severity": 0.40,
    "beta_exploit": 2.50,
    "gamma_criticality": 0.40,
    "delta_reachability": 1.50,
    "epsilon_kev": 1.50,
    "lambda_uncertainty": 1.00
  }
}
```

### 2.3 `planning_runs.constraints` and `remediation_actions.rationale`
```json
{
  "budget_hours": 40,
  "max_downtime_minutes": 30,
  "environments": ["prod"],
  "objective": "weighted_exposure",
  "solver_seed": 42,
  "max_time_seconds": 10
}
```
```json
{
  "resolved_findings": ["finding_seed_01", "finding_seed_02"],
  "services": ["checkout", "payments-worker"],
  "version_jump": "patch",
  "binding_constraints": ["max_downtime_minutes <= 30"],
  "rejected_alternative": {
    "to_version": "2.0.0",
    "reason": "Exceeds compatibility_risk threshold (0.65 > 0.35) and requires 45m downtime"
  }
}
```
