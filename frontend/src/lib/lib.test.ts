import { describe, expect, it } from 'vitest';
import type { FindingSummary } from '../api/generated';
import { errorMessage } from './errors';
import { factorRows, isKnownExploited, whyItMatters } from './explain';
import { formatNumber, formatPercent, humanizeAction, plural, shortHash, timeAgo } from './format';
import { reachabilityLabel, scoreBand } from './severity';

describe('format', () => {
  it('formats numbers and percentages, with a dash for missing values', () => {
    expect(formatNumber(1234.5, 1)).toMatch(/1.234.5|1,234.5|1 234,5/);
    expect(formatNumber(undefined)).toBe('–');
    expect(formatPercent(0.864)).toBe('86%');
    expect(formatPercent(null)).toBe('–');
  });

  it('shortens hashes only when needed', () => {
    expect(shortHash('abcdef1234567890', 8)).toBe('abcdef12…');
    expect(shortHash('abc', 8)).toBe('abc');
    expect(shortHash(null)).toBe('–');
  });

  it('describes time in plain words', () => {
    const now = Date.parse('2026-11-11T12:00:00Z');
    expect(timeAgo('2026-11-11T11:59:50Z', now)).toBe('just now');
    expect(timeAgo('2026-11-11T11:30:00Z', now)).toBe('30 minutes ago');
    expect(timeAgo('2026-11-11T11:00:00Z', now)).toBe('1 hour ago');
    expect(timeAgo('2026-11-08T12:00:00Z', now)).toBe('3 days ago');
    expect(timeAgo(null, now)).toBe('–');
  });

  it('pluralises and humanises', () => {
    expect(plural(1, 'fix', 'fixes')).toBe('1 fix');
    expect(plural(3, 'fix', 'fixes')).toBe('3 fixes');
    expect(humanizeAction('plan_decision_approved')).toBe('Plan decision approved');
  });
});

describe('severity', () => {
  it('bands scores from critical down to low', () => {
    expect(scoreBand(10.6).band).toBe('critical');
    expect(scoreBand(9).band).toBe('critical');
    expect(scoreBand(7.8).band).toBe('high');
    expect(scoreBand(4.2).band).toBe('medium');
    expect(scoreBand(1).band).toBe('low');
    expect(scoreBand(undefined).band).toBe('low');
  });

  it('always gives each band a text label so colour is never the only signal', () => {
    for (const score of [0, 5, 8, 10]) expect(scoreBand(score).label.length).toBeGreaterThan(0);
  });

  it('translates reachability codes', () => {
    expect(reachabilityLabel('reachable_prod')).toBe('Reachable in production');
    expect(reachabilityLabel('something_new')).toBe('something new');
    expect(reachabilityLabel(undefined)).toBe('Unknown');
  });
});

const finding = {
  id: 'f1',
  canonical_id: 'CVE-1',
  package_name: 'lib',
  package_version: '1.0',
  service_name: 'checkout',
  environment: 'prod',
  probability: 0.9,
  final_score: 10,
  factors: {
    severity: 3.5,
    exploit_probability: 2.4,
    criticality: 2,
    reachability: 1.5,
    kev_bonus: 1.5,
    uncertainty_penalty: 0.1,
    raw_inputs: { known_exploited: true, reachability_state: 'reachable_prod' },
  },
} as unknown as FindingSummary;

describe('explain', () => {
  it('lists every factor with a plain label and its value', () => {
    const rows = factorRows(finding.factors);
    expect(rows).toHaveLength(6);
    expect(rows.find((r) => r.key === 'kev_bonus')?.value).toBe(1.5);
    expect(rows.find((r) => r.key === 'uncertainty_penalty')?.isPenalty).toBe(true);
  });

  it('writes a plain-language reason', () => {
    expect(isKnownExploited(finding)).toBe(true);
    const text = whyItMatters(finding);
    expect(text).toMatch(/already using it/);
    expect(text).toMatch(/checkout/);
  });

  it('does not invent urgency when there is no signal', () => {
    const quiet = {
      ...finding,
      probability: 0.05,
      service_name: '',
      factors: { ...finding.factors, raw_inputs: {} },
    } as FindingSummary;
    expect(whyItMatters(quiet)).toMatch(/no strong signal/i);
  });
});

describe('errorMessage', () => {
  it('understands the API error envelope, strings and Errors', () => {
    expect(errorMessage({ code: 'X', message: 'Nope', field_errors: [{ issue: 'too small' }] })).toBe('Nope too small');
    expect(errorMessage('plain')).toBe('plain');
    expect(errorMessage(new Error('boom'))).toBe('boom');
    expect(errorMessage(undefined)).toMatch(/something went wrong/i);
  });
});
