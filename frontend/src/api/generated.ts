/**
 * Typed TypeScript API Client and Fixture Contract for PatchGraph (/api/v1)
 * Generated against backend/openapi.yaml (07_API_PatchGraph.md)
 * Owner: Member 2 (Day 4 Deliverable)
 */

export interface FieldError {
  field: string;
  issue: string;
  location?: string;
}

export interface ApiErrorEnvelope {
  code: string;
  message: string;
  field_errors: FieldError[];
  request_id: string;
}

export interface ImportStatusResponse {
  id: string;
  project_id: string;
  kind: 'cyclonedx' | 'spdx' | 'vex';
  status: 'queued' | 'completed' | 'failed' | 'duplicate';
  source_name: string;
  content_sha256: string;
  object_key: string;
  parser_version: string;
  errors: FieldError[];
  created_at: string;
  request_id: string;
}

export interface AssetItem {
  id: string;
  project_id: string;
  external_key: string;
  kind: string;
  criticality: number;
  environment: string;
  production: boolean;
  max_downtime_minutes: number;
  services: string[];
  owner_email: string;
  metadata: Record<string, unknown>;
}

export interface AssetListResponse {
  items: AssetItem[];
  total: number;
  request_id: string;
}

export interface FactorBreakdown {
  severity: number;
  exploit_probability: number;
  criticality: number;
  reachability: number;
  kev_bonus: number;
  uncertainty_penalty: number;
  weights?: Record<string, number>;
}

export interface FindingSummary {
  id: string;
  vulnerability_id: string;
  canonical_id: string;
  package_name: string;
  package_version: string;
  ecosystem: string;
  service_name: string;
  environment: string;
  owner_email: string;
  applicability: string;
  status: string;
  vex_status?: string;
  baseline_score: number;
  final_score: number;
  probability: number;
  uncertainty: number;
  factors: FactorBreakdown;
  source_freshness: Record<string, { fetched_at: string; stale: boolean; sha256: string }>;
}

export interface FindingListResponse {
  items: FindingSummary[];
  total: number;
  evidence_snapshot: string;
  request_id: string;
}

export interface FindingDetailResponse extends FindingSummary {
  summary: string;
  advisories: Array<{
    source: string;
    external_id: string;
    source_url: string;
    fetched_at: string;
    content_sha256: string;
  }>;
  vex_statements: Array<{
    status: string;
    justification: string;
    action_statement: string;
  }>;
  affected_paths: Array<{
    hops: string[];
    service: string;
    environment: string;
    reachability_state: string;
  }>;
  candidate_actions: PlanActionItem[];
  request_id: string;
}

export interface GraphPathsResponse {
  root_id: string;
  depth: number;
  paths: Array<{
    path_nodes: string[];
    service: string;
    environment: string;
    owner_email: string;
    decay_factor: number;
  }>;
  affected_services: string[];
  nodes: Array<{ id: string; kind: string; label: string; metadata?: Record<string, unknown> }>;
  edges: Array<{ source: string; target: string; kind: string; scope?: string }>;
  request_id: string;
}

export interface RiskRunRequest {
  project_id?: string;
  snapshot_id?: string;
  model_version?: string;
  config?: Record<string, number>;
}

export interface RiskRunResponse {
  id: string;
  project_id: string;
  snapshot_id: string;
  manifest_sha256: string;
  model_version: string;
  scored_findings: number;
  created_at: string;
  request_id: string;
}

export interface PlanRequest {
  risk_run_id: string;
  budget_hours: number;
  max_downtime_minutes: number;
  environments: string[];
  objective: 'weighted_exposure' | 'greedy_risk_per_hour' | 'greedy_risk_desc';
}

export interface PlanActionItem {
  package: string;
  from: string;
  to: string;
  services: string[];
  hours: number;
  downtime_minutes?: number;
  compatibility_risk?: number;
  risk_removed?: number;
  rationale?: Record<string, unknown>;
}

export interface PlanResponse {
  id: string;
  status: 'optimal' | 'feasible' | 'infeasible';
  actions: PlanActionItem[];
  rejected_actions?: PlanActionItem[];
  binding_constraints?: string[];
  risk_removed: number;
  warnings: string[];
  evidence_snapshot: string;
  objective_value?: number;
  best_bound?: number;
  runtime_ms?: number;
  approval_state?: string;
  request_id?: string;
}

export interface PlanSimulateRequest {
  budget_hours: number;
  max_downtime_minutes: number;
  environments: string[];
  objective?: string;
}

export interface PlanSimulateResponse {
  baseline_plan: PlanResponse;
  simulated_plan: PlanResponse;
  greedy_comparison: {
    strategy: string;
    risk_removed: number;
    hours_used: number;
    downtime_used: number;
  };
  deltas: {
    risk_removed_delta: number;
    hours_delta: number;
    downtime_delta: number;
  };
  request_id: string;
}

export interface PlanDecisionRequest {
  decision: 'approved' | 'rejected' | 'needs_changes';
  reason: string;
}

export interface PlanDecisionResponse {
  id: string;
  planning_run_id: string;
  user_id: string;
  decision: 'approved' | 'rejected' | 'needs_changes';
  reason: string;
  audit_log_id: number;
  created_at: string;
  request_id: string;
}

export interface DataHealthSource {
  source: string;
  source_url: string;
  last_fetched_at: string;
  content_sha256: string;
  parser_version: string;
  stale: boolean;
  status: 'healthy' | 'stale' | 'degraded';
  error_count: number;
}

export interface DataHealthResponse {
  overall_status: 'healthy' | 'stale' | 'degraded';
  offline_demo_mode: boolean;
  active_snapshot: string;
  manifest_sha256: string;
  sources: DataHealthSource[];
  recent_import_errors: Array<Record<string, unknown>>;
  request_id: string;
}

export interface PatchGraphClientOptions {
  baseUrl?: string;
  projectId?: string;
  userId?: string;
  userRole?: 'viewer' | 'analyst' | 'approver' | 'admin';
}


export interface AuditLogEntry {
  id: number;
  project_id: string;
  actor_id: string;
  actor_email?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  request_id?: string;
  before_state?: Record<string, unknown> | null;
  after_state?: Record<string, unknown> | null;
  created_at: string;
  is_demo?: boolean;
}

export interface AuditListResponse {
  items: AuditLogEntry[];
  total: number;
  limit: number;
  offset: number;
  request_id: string;
}

export interface FindingExplainResponse {
  finding_id: string;
  canonical_id: string;
  baseline_score: number;
  final_score: number;
  probability: number;
  uncertainty: number;
  factors: FactorBreakdown & {
    raw_inputs?: Record<string, unknown>;
    weights?: Record<string, number>;
  };
  formula: string;
  calibration_notes: string;
  request_id: string;
  is_demo?: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: 'package_version' | 'service' | 'application' | 'environment';
  cvss?: number;
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  color?: string;
  in_kev?: boolean;
  reachability?: string;
  owner?: string;
  environment?: string;
  pos_3d?: [number, number, number];
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: string;
  scope: string;
  is_patch_path?: boolean;
}

export interface FullGraphResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: {
    total_nodes: number;
    total_edges: number;
    vulnerable_nodes: number;
  };
  request_id: string;
  is_demo?: boolean;
}

export interface GraphNodeDetailResponse {
  id: string;
  label: string;
  kind: string;
  cvss: number;
  severity: string;
  reachability: string;
  in_kev: boolean;
  epss_percentile: number;
  owner: string;
  affected_services: string[];
  blast_radius_score: number;
  upstream_callers: string[];
  downstream_dependencies: string[];
  vex_statement?: {
    status: string;
    justification: string;
    statement_time: string;
  };
  request_id: string;
  is_demo?: boolean;
}

export interface SourcesStatusResponse {
  sources: Record<string, {
    status: string;
    last_sync: string;
    stale: boolean;
    records: number;
    parser_version: string;
  }>;
  snapshot_sha256: string;
  data_freshness?: string;
  snapshot_id?: string;
  offline_demo_mode?: boolean;
  request_id: string;
}

export interface SystemHealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}

export class PatchGraphApiClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(options: PatchGraphClientOptions = {}) {
    this.baseUrl = options.baseUrl ? (options.baseUrl.endsWith('/api/v1') ? options.baseUrl : `${options.baseUrl}/api/v1`) : '/api/v1';
    this.headers = {
      'Content-Type': 'application/json',
      'X-Project-Id': options.projectId ?? '00000000-0000-0000-0000-000000000001',
      'X-User-Id': options.userId ?? '00000000-0000-0000-0000-000000000010',
      'X-User-Role': options.userRole ?? 'approver',
    };
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers,
        ...(init?.headers ?? {}),
      },
    });
    const body = await res.json();
    if (!res.ok) {
      throw body as ApiErrorEnvelope;
    }
    return body as T;
  }

  importSbom(payload: { kind: 'cyclonedx' | 'spdx'; source_name: string; document: Record<string, unknown> }) {
    return this.request<ImportStatusResponse>('/imports/sbom', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  importVex(payload: { source_name: string; document: Record<string, unknown> }) {
    return this.request<ImportStatusResponse>('/imports/vex', {
      method: 'POST',
      body: JSON.stringify({ kind: 'vex', ...payload }),
    });
  }

  getImport(id: string) {
    return this.request<ImportStatusResponse>(`/imports/${encodeURIComponent(id)}`);
  }

  listAssets(params?: { environment?: string; service?: string }) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<AssetListResponse>(`/assets${qs ? `?${qs}` : ''}`);
  }

  listFindings(params?: { sort?: string; environment?: string; status?: string }) {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return this.request<FindingListResponse>(`/findings${qs ? `?${qs}` : ''}`);
  }

  getFinding(id: string) {
    return this.request<FindingDetailResponse>(`/findings/${encodeURIComponent(id)}`);
  }

  getGraphPaths(params: { package_version_id?: string; depth?: number; limit?: number }) {
    const qs = new URLSearchParams(
      Object.entries(params).reduce<Record<string, string>>((acc, [k, v]) => {
        if (v !== undefined) acc[k] = String(v);
        return acc;
      }, {})
    ).toString();
    return this.request<GraphPathsResponse>(`/graph/paths${qs ? `?${qs}` : ''}`);
  }

  createRiskRun(payload: RiskRunRequest) {
    return this.request<RiskRunResponse>('/risk-runs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  createPlan(payload: PlanRequest) {
    return this.request<PlanResponse>('/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  simulatePlan(id: string, payload: PlanSimulateRequest) {
    return this.request<PlanSimulateResponse>(`/plans/${encodeURIComponent(id)}/simulate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  decidePlan(id: string, payload: PlanDecisionRequest) {
    return this.request<PlanDecisionResponse>(`/plans/${encodeURIComponent(id)}/decision`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getDataHealth() {
    return this.request<DataHealthResponse>('/health/data');
  }

  listAuditLogs(params?: { action?: string; entity_type?: string; limit?: number; offset?: number }) {
    const qs = new URLSearchParams(
      Object.entries(params || {}).reduce<Record<string, string>>((acc, [k, v]) => {
        if (v !== undefined) acc[k] = String(v);
        return acc;
      }, {})
    ).toString();
    return this.request<AuditListResponse>(`/audit${qs ? `?${qs}` : ''}`);
  }

  exportAuditLogs(format: 'json' | 'csv' = 'json') {
    return this.request<Blob>(`/audit/export?format=${format}`);
  }

  explainFinding(id: string) {
    return this.request<FindingExplainResponse>(`/findings/${encodeURIComponent(id)}/explain`);
  }

  listPlans() {
    return this.request<{ items: PlanResponse[]; total: number; request_id: string }>('/plans');
  }

  getPlan(id: string) {
    return this.request<PlanResponse>(`/plans/${encodeURIComponent(id)}`);
  }

  getFullGraph(params?: { environment?: string; owner?: string; in_kev?: boolean }) {
    const qs = new URLSearchParams(
      Object.entries(params || {}).reduce<Record<string, string>>((acc, [k, v]) => {
        if (v !== undefined) acc[k] = String(v);
        return acc;
      }, {})
    ).toString();
    return this.request<FullGraphResponse>(`/graph${qs ? `?${qs}` : ''}`);
  }

  getGraphNode(id: string) {
    return this.request<GraphNodeDetailResponse>(`/graph/nodes/${encodeURIComponent(id)}`);
  }

  importTopology(payload: Record<string, unknown>) {
    return this.request<{ id: string; status: string; source_name: string; services_registered: number }>('/imports/topology', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  getJobStatus(id: string) {
    return this.request<{ id: string; status: string; progress: number; stage: string }>('/jobs/' + encodeURIComponent(id));
  }

  getSourcesStatus() {
    return this.request<SourcesStatusResponse>('/sources/status');
  }

  getHealth() {
    return this.request<SystemHealthResponse>('/health');
  }

  loadSampleData() {
    return this.request<{
      status: string;
      message: string;
      snapshot_id: string;
      packages_loaded: number;
      findings_loaded: number;
      is_demo: boolean;
    }>('/demo/load-sample', {
      method: 'POST',
    });
  }

  listImports() {
    return this.request<{ items: ImportStatusResponse[]; total: number; request_id: string }>('/imports');
  }

  getLatestRiskRun() {
    return this.request<{
      id: string;
      project_id: string;
      snapshot_id: string;
      model_version: string;
      config: Record<string, unknown>;
      created_at: string;
      findings_count: number;
      request_id: string;
    }>('/risk-runs/latest');
  }

  listVexStatements() {
    return this.request<{
      items: Array<{
        cve: string;
        service: string;
        status: string;
        justification: string;
        action_statement: string;
      }>;
      total: number;
      request_id: string;
    }>('/vex-statements');
  }

  getModelCard() {
    return this.request<{
      model_name: string;
      version: string;
      brier_score: number;
      ece: number;
      pr_auc: number;
      roc_auc: number;
      temporal_cutoff: string;
      training_samples: number;
      test_samples: number;
      features: string[];
      request_id: string;
    }>('/model-card');
  }

}
