-- Secondary indexes for the list, filter and join paths the UI uses most.
-- The SQLite loader adds IF NOT EXISTS, so re-running is safe there.
CREATE INDEX idx_findings_project_env ON findings(project_id,environment_id);
CREATE INDEX idx_findings_service ON findings(service_id);
CREATE INDEX idx_findings_package_version ON findings(package_version_id);
CREATE INDEX idx_scores_finding ON finding_scores(finding_id);
CREATE INDEX idx_imports_project_created ON imports(project_id,created_at DESC);
CREATE INDEX idx_planning_runs_project_created ON planning_runs(project_id,created_at DESC);
CREATE INDEX idx_plan_decisions_run ON plan_decisions(planning_run_id,created_at DESC);
CREATE INDEX idx_remediation_actions_run ON remediation_actions(planning_run_id);
CREATE INDEX idx_deployments_service ON deployments(service_id);
CREATE INDEX idx_deployments_asset ON deployments(asset_id);
CREATE INDEX idx_vex_project_vulnerability ON vex_statements(project_id,vulnerability_id);
CREATE INDEX idx_snapshots_project_created ON evidence_snapshots(project_id,created_at DESC);
