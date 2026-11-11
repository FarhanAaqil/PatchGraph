import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PatchGraphApiClient, type PlanDecisionRequest, type PlanRequest } from '../api/generated';

/** One shared client: the API layer, not each screen, decides base URL and identity. */
export const api = new PatchGraphApiClient();

// Reads are revalidated by the server with ETags (cheap 304s), so a short staleTime only avoids duplicate requests.
const STALE = 20_000;

export const keys = {
  findings: (params: object) => ['findings', params] as const,
  explain: (id: string) => ['explain', id] as const,
  imports: (params: object) => ['imports', params] as const,
  plans: ['plans'] as const,
  audit: (params: object) => ['audit', params] as const,
  sources: ['sources'] as const,
  graph: (params: object) => ['graph', params] as const,
  node: (id: string) => ['node', id] as const,
  riskRun: ['riskRun'] as const,
};

export function useFindings(params: Parameters<typeof api.listFindings>[0]) {
  return useQuery({
    queryKey: keys.findings(params ?? {}),
    queryFn: () => api.listFindings(params),
    staleTime: STALE,
    placeholderData: keepPreviousData,
  });
}

export function useExplain(id: string | null) {
  return useQuery({
    queryKey: keys.explain(id ?? ''),
    queryFn: () => api.explainFinding(id as string),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useImports(params: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: keys.imports(params),
    queryFn: () => api.listImports(params),
    staleTime: STALE,
    placeholderData: keepPreviousData,
  });
}

export function usePlans() {
  return useQuery({ queryKey: keys.plans, queryFn: () => api.listPlans(), staleTime: STALE });
}

export function useAudit(params: { action?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: keys.audit(params),
    queryFn: () => api.listAuditLogs(params),
    staleTime: STALE,
    placeholderData: keepPreviousData,
  });
}

export function useSources() {
  return useQuery({ queryKey: keys.sources, queryFn: () => api.getSourcesStatus(), staleTime: 60_000 });
}

export function useGraph(params: { environment?: string; in_kev?: boolean }) {
  return useQuery({ queryKey: keys.graph(params), queryFn: () => api.getFullGraph(params), staleTime: 60_000 });
}

export function useNodeDetail(id: string | null) {
  return useQuery({
    queryKey: keys.node(id ?? ''),
    queryFn: () => api.getGraphNode(id as string),
    enabled: Boolean(id),
    staleTime: 60_000,
  });
}

export function useLatestRiskRun() {
  return useQuery({ queryKey: keys.riskRun, queryFn: () => api.getLatestRiskRun(), staleTime: STALE, retry: false });
}

/** Any write can change what every list shows, so refetch the lot instead of tracking which one. */
export function useRefreshAll() {
  const client = useQueryClient();
  return () => client.invalidateQueries();
}

export function useLoadSample() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: () => api.loadSampleData(), onSuccess: refresh });
}

export function useCreatePlan() {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: (payload: PlanRequest) => api.createPlan(payload), onSuccess: refresh });
}

export function useDecidePlan() {
  const refresh = useRefreshAll();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: PlanDecisionRequest }) => api.decidePlan(id, payload),
    onSuccess: refresh,
  });
}

export function useImportMutation<TPayload, TResult>(fn: (payload: TPayload) => Promise<TResult>) {
  const refresh = useRefreshAll();
  return useMutation({ mutationFn: fn, onSuccess: refresh });
}

export type JourneyStep = 'import' | 'plan' | 'review' | 'done';

/** Where the person is in the import → risks → plan → review journey, derived from real data. */
export function useJourney() {
  const findings = useFindings({ limit: 1 });
  const plans = usePlans();
  const total = findings.data?.total ?? 0;
  const planItems = plans.data?.items ?? [];
  const approved = planItems.filter((p) => p.approval_state === 'approved').length;
  const pending = planItems.filter((p) => !p.approval_state || p.approval_state === 'pending_human_approval').length;
  const loading = findings.isLoading || plans.isLoading;
  const step: JourneyStep = total === 0 ? 'import' : planItems.length === 0 ? 'plan' : pending > 0 ? 'review' : 'done';
  return { loading, total, plans: planItems.length, approved, pending, step };
}
