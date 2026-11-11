import type { FactorBreakdown, FindingSummary } from '../api/generated';
import { formatPercent } from './format';
import { reachabilityLabel } from './severity';

export interface FactorRow {
  key: keyof FactorBreakdown;
  label: string;
  help: string;
  value: number;
  /** Largest value this factor can add, used to size the bar. */
  max: number;
  /** Penalties pull the score down. */
  isPenalty?: boolean;
}

const FACTOR_META: Array<Omit<FactorRow, 'value'>> = [
  { key: 'severity', label: 'How severe it is', help: 'The technical severity (CVSS) of the flaw.', max: 4 },
  {
    key: 'exploit_probability',
    label: 'Chance it is exploited',
    help: 'Calibrated likelihood that attackers use it in the wild.',
    max: 2.5,
  },
  {
    key: 'criticality',
    label: 'How important the system is',
    help: 'Business importance of the service it runs in.',
    max: 2,
  },
  {
    key: 'reachability',
    label: 'How exposed it is',
    help: 'Whether an attacker can actually reach the vulnerable code.',
    max: 1.5,
  },
  {
    key: 'kev_bonus',
    label: 'Known to be attacked',
    help: 'Listed in the CISA Known Exploited Vulnerabilities catalogue.',
    max: 1.5,
  },
  {
    key: 'uncertainty_penalty',
    label: 'Missing or old evidence',
    help: 'Lowers confidence when data is missing or stale.',
    max: 1,
    isPenalty: true,
  },
];

export function factorRows(factors: FactorBreakdown | undefined): FactorRow[] {
  if (!factors) return [];
  return FACTOR_META.map((meta) => ({ ...meta, value: Number(factors[meta.key] ?? 0) }));
}

type RawInputs = {
  cvss_score?: number;
  exploit_prob?: number;
  known_exploited?: boolean;
  reachability_state?: string;
  stale_evidence?: boolean;
};

export function rawInputs(finding: Pick<FindingSummary, 'factors'>): RawInputs {
  return ((finding.factors as unknown as { raw_inputs?: RawInputs })?.raw_inputs ?? {}) as RawInputs;
}

export function isKnownExploited(finding: Pick<FindingSummary, 'factors'>): boolean {
  return Boolean(rawInputs(finding).known_exploited);
}

/** One short paragraph, in plain words, on why this finding sits where it does in the queue. */
export function whyItMatters(finding: FindingSummary): string {
  const raw = rawInputs(finding);
  const parts: string[] = [];
  if (raw.known_exploited) parts.push('attackers are already using it (it is on the CISA exploited list)');
  else if (finding.probability >= 0.5)
    parts.push(`there is a ${formatPercent(finding.probability)} chance it will be exploited`);
  if (raw.reachability_state) parts.push(`it is ${reachabilityLabel(raw.reachability_state).toLowerCase()}`);
  if (finding.service_name)
    parts.push(`it affects the ${finding.service_name} service in ${finding.environment || 'an unknown environment'}`);
  if (raw.stale_evidence) parts.push('some of the evidence is out of date, so treat the score with care');
  if (!parts.length) return 'There is no strong signal that this needs urgent attention.';
  const [first, ...rest] = parts;
  return `${first.charAt(0).toUpperCase()}${first.slice(1)}${rest.length ? `; ${rest.join('; ')}` : ''}.`;
}
