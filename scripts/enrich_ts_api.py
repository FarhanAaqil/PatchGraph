"""Insert interfaces before class PatchGraphApiClient."""

from __future__ import annotations

from pathlib import Path

API_FILE = Path("frontend/src/api/generated.ts")
content = API_FILE.read_text(encoding="utf-8")

INTERFACES = """
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
  offline_demo_mode: boolean;
  request_id: string;
}

export interface SystemHealthResponse {
  status: string;
  service: string;
  version: string;
  timestamp: string;
}
"""

if "interface AuditListResponse" not in content:
    idx = content.find("export class PatchGraphApiClient {")
    if idx != -1:
        content = content[:idx] + INTERFACES + "\n" + content[idx:]
        API_FILE.write_text(content, encoding="utf-8")
        print("Inserted interfaces before class PatchGraphApiClient")
    else:
        print("Could not find class PatchGraphApiClient")
else:
    print("Interfaces already present")
