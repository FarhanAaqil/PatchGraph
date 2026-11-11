export type Band = 'critical' | 'high' | 'medium' | 'low';

export interface BandInfo {
  band: Band;
  label: string;
  /** Plain-language meaning, shown in tooltips and the legend. */
  meaning: string;
}

/** Bands for PatchGraph's final risk score (CVSS-style 0-10 base plus exploit, exposure and KEV adjustments). */
export function scoreBand(score: number | null | undefined): BandInfo {
  const value = score ?? 0;
  if (value >= 9)
    return { band: 'critical', label: 'Critical', meaning: 'Fix first: likely to be exploited and exposed.' };
  if (value >= 7) return { band: 'high', label: 'High', meaning: 'Plan this fix soon.' };
  if (value >= 4) return { band: 'medium', label: 'Medium', meaning: 'Fix when convenient.' };
  return { band: 'low', label: 'Low', meaning: 'Low urgency.' };
}

export const REACHABILITY_LABELS: Record<string, string> = {
  reachable_prod: 'Reachable in production',
  reachable_non_prod: 'Reachable outside production',
  transitive_unverified: 'Indirect, not confirmed',
  unreachable_vex: 'Not reachable (vendor statement)',
};

export function reachabilityLabel(state: unknown): string {
  return typeof state === 'string' ? (REACHABILITY_LABELS[state] ?? state.replace(/_/g, ' ')) : 'Unknown';
}
