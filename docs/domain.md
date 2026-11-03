# PatchGraph Domain Glossary and Data Invariants

## 1. Core Domain Entities

| Entity | Table | Identity & Canonical Key | Semantics |
|---|---|---|---|
| **Project** | `projects` | `id` (UUID) | Tenant boundary owning applications, environments, assets, imports, findings, runs, and audit logs. |
| **User & Membership** | `users`, `memberships` | `(project_id, user_id)` | Role-based access assignment (`viewer`, `analyst`, `approver`, `admin`). |
| **Application** | `applications` | `(project_id, name)` | Logical software system with business `criticality` in `[1..5]`. |
| **Service** | `services` | `(application_id, name)` | Deployable microservice or worker owned by `owner_email`. |
| **Environment** | `environments` | `(project_id, name)` | Runtime tier (e.g., `prod`, `staging`) with `production` boolean and `max_downtime_minutes >= 0`. |
| **Asset** | `assets` | `(project_id, external_key)` | Compute/runtime target (container, VM, function) deployed in an environment with `criticality` in `[1..5]`. |
| **Package** | `packages` | `(ecosystem, normalized_name)` | Canonical software package identity with optional Package URL (`purl`). |
| **Package Version** | `package_versions` | `(package_id, version)` | Immutable release version of a package (`version` and `normalized_version`). |
| **Import** | `imports` | `(project_id, content_sha256, kind)` | Validated ingestion record for `cyclonedx`, `spdx`, or `vex` with `content_sha256`, `object_key`, `parser_version`, and structured `errors` JSONB. |
| **Dependency Edge** | `dependencies` | `(import_id, parent_version_id, child_version_id, scope)` | Directed dependency relationship from parent package version to child package version within an import. |
| **Service Component** | `service_components` | `(service_id, environment_id, package_version_id, import_id)` | Binds a package version (`direct` or transitive) to a deployed service in an environment. |
| **Deployment** | `deployments` | `(service_id, asset_id, release_ref)` | Connects a service release to a concrete infrastructure asset. |
| **Vulnerability** | `vulnerabilities` | `canonical_id` | Canonical vulnerability identifier (e.g., `CVE-2024-3094`, `GHSA-...`) with publication/modification timestamps and summary. |
| **Advisory** | `advisories` | `(source, external_id, content_sha256)` | External vulnerability record from OSV, NVD, or GitHub retaining `source_url`, `fetched_at`, `content_sha256`, `raw_object_key`, and raw JSONB `payload`. |
| **Affected Range** | `affected_ranges` | `id` (bigserial) | Version applicability rule (`SEMVER`, `ECOSYSTEM`, `GIT`) specifying `introduced`, `fixed`, and `last_affected` bounds. |
| **Exploit Evidence** | `exploit_evidence` | `(vulnerability_id, observed_on, source)` | Time-indexed exploitation intelligence: EPSS probability `[0,1]`, EPSS percentile `[0,1]`, and CISA KEV `known_exploited` boolean. |
| **VEX Statement** | `vex_statements` | `(import_id, vulnerability_id, package_version_id)` | Exploitability status assertion (`affected`, `not_affected`, `fixed`, `under_investigation`) with `justification` and `action_statement`. |
| **Evidence Snapshot** | `evidence_snapshots` | `manifest_sha256` | Immutable freeze of all external evidence hashes and `source_cutoffs` used by a risk run. |
| **Finding** | `findings` | `(project_id, vulnerability_id, package_version_id, service_id, environment_id)` | Materialized vulnerability match on a specific package version within a service and environment (`applicability`, `status`). |
| **Risk Run** | `risk_runs` | `id` (UUID) | Immutable scoring execution pinned to one `snapshot_id`, `model_version`, and weight `config`. |
| **Finding Score** | `finding_scores` | `(risk_run_id, finding_id)` | Output of a risk run storing `probability` `[0,1]`, `baseline_score`, `final_score`, `uncertainty` `[0,1]`, and `factors` JSONB. |
| **Planning Run** | `planning_runs` | `id` (UUID) | Constrained optimization run referencing one `risk_run_id`, solver `status`, `objective_value`, `best_bound`, `runtime_ms`, and `constraints` JSONB. |
| **Remediation Action** | `remediation_actions` | `id` (UUID) | Candidate upgrade or mitigation action in a planning run (`selected`, `effort_hours >= 0`, `downtime_minutes >= 0`, `compatibility_risk` `[0,1]`, `risk_removed`, `rationale` JSONB). |
| **Plan Decision** | `plan_decisions` | `id` (UUID) | Human governance record (`approved`, `rejected`, `needs_changes`) with `user_id` and mandatory `reason`. |
| **Audit Log** | `audit_logs` | `id` (bigserial) | Append-only event record capturing `actor_id`, `action`, `entity_type`, `entity_id`, `request_id`, `before_state`, and `after_state`. |

## 2. Binding Data Invariants

1. **Content-Addressed Provenance**: Every imported SBOM/VEX document and every external advisory record stores a SHA-256 digest (`content_sha256` / `manifest_sha256`).
2. **Idempotent Ingestion**: Re-uploading the identical `(project_id, content_sha256, kind)` returns the existing import record without duplicating dependency edges.
3. **Non-Destructive VEX**: A VEX statement never deletes a `finding` row; it updates or qualifies applicability/status while preserving the underlying advisory match and justification.
4. **Explicit Unknowns**: Missing CVSS, EPSS, or reachability data is represented explicitly as `null` / `unknown` and incurs a documented uncertainty penalty (`uncertainty` in `[0,1]`), never a silent `0.0`.
5. **Immutable Run Lineage**: Every `plan_decision` traces to a `planning_run`, which traces to a `risk_run`, which traces to an `evidence_snapshot` (`manifest_sha256`).
6. **Append-Only Governance**: Rows in `plan_decisions` and `audit_logs` are never updated or deleted by application code.
