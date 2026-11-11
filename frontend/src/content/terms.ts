/**
 * PatchGraph UI Vocabulary, Severity Labels, and Accessible Status Definitions
 * Owner: Member 2 (Day 2 Deliverable)
 *
 * All severity, reachability, VEX, and solver states pair visual tokens with
 * explicit text labels so meaning is never conveyed by color alone.
 */

export type SeverityBand = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export interface SeverityDescriptor {
  band: SeverityBand;
  label: string;
  minScore: number;
  maxScore: number;
  badgeText: string;
  ariaLabel: string;
}

export const SEVERITY_LABELS: Record<SeverityBand, SeverityDescriptor> = {
  CRITICAL: {
    band: 'CRITICAL',
    label: 'Critical Severity',
    minScore: 9.0,
    maxScore: 10.0,
    badgeText: '[CRIT 9.0-10.0]',
    ariaLabel: 'Critical severity (score 9.0 to 10.0)',
  },
  HIGH: {
    band: 'HIGH',
    label: 'High Severity',
    minScore: 7.0,
    maxScore: 8.9,
    badgeText: '[HIGH 7.0-8.9]',
    ariaLabel: 'High severity (score 7.0 to 8.9)',
  },
  MEDIUM: {
    band: 'MEDIUM',
    label: 'Medium Severity',
    minScore: 4.0,
    maxScore: 6.9,
    badgeText: '[MED 4.0-6.9]',
    ariaLabel: 'Medium severity (score 4.0 to 6.9)',
  },
  LOW: {
    band: 'LOW',
    label: 'Low Severity',
    minScore: 0.1,
    maxScore: 3.9,
    badgeText: '[LOW 0.1-3.9]',
    ariaLabel: 'Low severity (score 0.1 to 3.9)',
  },
  UNKNOWN: {
    band: 'UNKNOWN',
    label: 'Unknown Severity (Unverified)',
    minScore: 0.0,
    maxScore: 0.0,
    badgeText: '[UNKNOWN - PENALTY APPLIED]',
    ariaLabel: 'Unknown severity — uncertainty penalty applied, never treated as safe',
  },
};

export type VexStatus = 'affected' | 'not_affected' | 'fixed' | 'under_investigation';

export const VEX_STATUS_LABELS: Record<VexStatus, { label: string; description: string }> = {
  affected: {
    label: 'Affected (Confirmed)',
    description: 'Vulnerability is confirmed exploitable or reachable in the deployed service.',
  },
  not_affected: {
    label: 'Not Affected (VEX Qualified)',
    description:
      'Match preserved in inventory, but VEX justification indicates vulnerable code is not present or reachable.',
  },
  fixed: {
    label: 'Fixed',
    description: 'Deployed package version contains the upstream fix.',
  },
  under_investigation: {
    label: 'Under Investigation',
    description: 'Triage in progress; treated conservatively with uncertainty band active.',
  },
};

export type ReachabilityState = 'reachable_prod' | 'reachable_non_prod' | 'transitive_unverified' | 'unreachable_vex';

export const REACHABILITY_LABELS: Record<ReachabilityState, { label: string; weightHint: number }> = {
  reachable_prod: {
    label: 'Reachable in Production Service',
    weightHint: 1.0,
  },
  reachable_non_prod: {
    label: 'Reachable in Non-Production Service',
    weightHint: 0.6,
  },
  transitive_unverified: {
    label: 'Transitive Dependency (Reachability Unknown)',
    weightHint: 0.5,
  },
  unreachable_vex: {
    label: 'Qualified Not Reachable via VEX',
    weightHint: 0.1,
  },
};

export type UiOperationalState =
  'healthy' | 'loading' | 'empty' | 'stale' | 'partial' | 'unauthorized' | 'failed' | 'offline-demo';

export const UI_STATE_BANNERS: Record<UiOperationalState, { title: string; guidance: string }> = {
  healthy: {
    title: 'Operational Telemetry Synchronized',
    guidance:
      'All upstream security feeds, graph topology mappings, and ML scoring pipelines are operational and synchronized.',
  },
  loading: {
    title: 'Loading Evidence Snapshot',
    guidance: 'Fetching project inventory, graph paths, and pinned snapshot metadata.',
  },
  empty: {
    title: 'No SBOM Imported Yet',
    guidance: 'Upload a CycloneDX 1.4-1.6 or SPDX 2.3 JSON document, or load the seeded fixture scenario.',
  },
  stale: {
    title: 'Stale External Evidence Warning',
    guidance:
      'One or more public feeds exceeded freshness targets. Showing pinned fallback snapshot with explicit cutoff timestamps.',
  },
  partial: {
    title: 'Partial Evidence — Uncertainty Penalty Active',
    guidance:
      'Some findings have missing NVD or EPSS records. Unknown values are penalized and never treated as zero risk.',
  },
  unauthorized: {
    title: 'Read-Only Role Active',
    guidance:
      'Your current project membership role cannot execute this mutation. Plan approval requires Approver or Admin role.',
  },
  failed: {
    title: 'Operation Failed',
    guidance: 'Inspect the structured field errors and request ID below before retrying.',
  },
  'offline-demo': {
    title: 'Offline Reproducible Demo Mode',
    guidance:
      'Pinned to content-addressed snapshot snap_seed_01. All scores and plans are deterministic without network access.',
  },
};

export const DOMAIN_GLOSSARY_TERMS: Record<string, string> = {
  SBOM: 'Software Bill of Materials (CycloneDX 1.4-1.6 or SPDX 2.3 JSON inventory of package components and dependency edges).',
  VEX: 'Vulnerability Exploitability eXchange statement qualifying whether a matched CVE affects a deployed product.',
  EPSS: 'Exploit Prediction Scoring System probability [0,1] estimating exploitation likelihood within 30 days.',
  KEV: 'CISA Known Exploited Vulnerabilities catalog confirming real-world exploitation.',
  'Blast Radius':
    'Bounded graph traversal (depth <= 12) resolving which services, assets, environments, and owners depend on a vulnerable package version.',
  'Weighted Exposure Removed':
    'Objective metric measuring total risk score eliminated by selected remediation actions under budget and downtime constraints.',
  'Binding Constraint':
    'A resource or compatibility constraint (e.g., max downtime minutes or budget hours) that prevented additional high-risk upgrades from being selected.',
};
