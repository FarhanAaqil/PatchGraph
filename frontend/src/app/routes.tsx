
export interface AppRoute {
  path: string;
  id: string;
  title: string;
  navGroup: 'Overview' | 'Inventory & Graph' | 'Intelligence' | 'Remediation' | 'Governance';
  description: string;
  minRole: 'viewer' | 'analyst' | 'approver' | 'admin';
}

/**
 * Canonical 14-screen route map defined in 05_UI_UX_PatchGraph.md and docs/user_flow.md.
 * Owner: Member 2 (Day 3 Deliverable)
 */
export const APP_ROUTES: AppRoute[] = [
  {
    path: '/',
    id: 'dashboard',
    title: 'Dashboard',
    navGroup: 'Overview',
    description: 'Urgent exposed production services, open KEV count, and stale evidence indicators.',
    minRole: 'viewer',
  },
  {
    path: '/assets',
    id: 'assets',
    title: 'Assets',
    navGroup: 'Inventory & Graph',
    description: 'Filtered inventory of applications, services, runtime assets, environments, and owners.',
    minRole: 'viewer',
  },
  {
    path: '/graph',
    id: 'dependency-graph',
    title: 'Dependency Graph',
    navGroup: 'Inventory & Graph',
    description: 'Interactive Cytoscape.js typed dependency-and-deployment topology with accessible table view.',
    minRole: 'viewer',
  },
  {
    path: '/vulnerabilities',
    id: 'vulnerabilities',
    title: 'Vulnerabilities',
    navGroup: 'Inventory & Graph',
    description: 'Normalized OSV, NVD, EPSS, and CISA KEV vulnerability records with content hashes.',
    minRole: 'viewer',
  },
  {
    path: '/prioritization',
    id: 'prioritization',
    title: 'Prioritization',
    navGroup: 'Intelligence',
    description: 'Ranked findings queue comparing deterministic baseline and calibrated exploit-likelihood scores.',
    minRole: 'viewer',
  },
  {
    path: '/findings/:id',
    id: 'finding-detail',
    title: 'Finding Detail',
    navGroup: 'Intelligence',
    description: 'Source provenance, version-range match logic, reachability state, owners, and factor contributions.',
    minRole: 'viewer',
  },
  {
    path: '/explainability',
    id: 'explainability',
    title: 'Explainability',
    navGroup: 'Intelligence',
    description: 'Risk formula weights, model factor contributions, calibration reliability, and uncertainty bands.',
    minRole: 'viewer',
  },
  {
    path: '/blast-radius',
    id: 'blast-radius',
    title: 'Blast Radius',
    navGroup: 'Intelligence',
    description: 'Bounded graph traversal (depth 1-12) showing affected services, environments, and owners.',
    minRole: 'viewer',
  },
  {
    path: '/planner',
    id: 'remediation-planner',
    title: 'Remediation Planner',
    navGroup: 'Remediation',
    description: 'OR-Tools CP-SAT constrained optimizer for selecting upgrades under budget and downtime limits.',
    minRole: 'analyst',
  },
  {
    path: '/what-if',
    id: 'what-if',
    title: 'What If',
    navGroup: 'Remediation',
    description: 'Side-by-side simulation comparing constrained CP-SAT plans against greedy baselines.',
    minRole: 'analyst',
  },
  {
    path: '/imports',
    id: 'imports',
    title: 'SBOM and VEX Imports',
    navGroup: 'Governance',
    description: 'Validate and ingest CycloneDX, SPDX, and VEX files with field-level error reporting.',
    minRole: 'analyst',
  },
  {
    path: '/runs',
    id: 'runs',
    title: 'Runs',
    navGroup: 'Governance',
    description: 'Immutable evidence snapshots, risk runs, and planning run manifests for reproducibility.',
    minRole: 'viewer',
  },
  {
    path: '/audit',
    id: 'audit',
    title: 'Audit',
    navGroup: 'Governance',
    description: 'Append-only governance log of imports, scoring runs, and human plan decisions.',
    minRole: 'viewer',
  },
  {
    path: '/health',
    id: 'data-health',
    title: 'Data Health',
    navGroup: 'Governance',
    description: 'External feed freshness, snapshot cutoffs, parser versions, and degraded-mode indicators.',
    minRole: 'viewer',
  },
];

export function findRouteByPath(pathname: string): AppRoute {
  if (pathname.startsWith('/findings/')) {
    return APP_ROUTES.find((r) => r.id === 'finding-detail')!;
  }
  return APP_ROUTES.find((r) => r.path === pathname) || APP_ROUTES[0];
}
