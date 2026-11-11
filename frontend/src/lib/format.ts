export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '–';
  return value.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(probability: number | null | undefined, digits = 0): string {
  if (probability === null || probability === undefined || Number.isNaN(probability)) return '–';
  return `${(probability * 100).toFixed(digits)}%`;
}

export function shortHash(hash: string | null | undefined, length = 10): string {
  if (!hash) return '–';
  return hash.length > length ? `${hash.slice(0, length)}…` : hash;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '–';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

/** "3 minutes ago", "2 days ago", or an absolute date once it is older than a month. */
export function timeAgo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '–';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 45) return 'just now';
  const units: Array<[number, string]> = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
  ];
  if (seconds < 86400 * 30) {
    let label = 'minute';
    let size = 60;
    for (const [limit, name] of units) {
      if (seconds >= limit) {
        label = name;
        size = limit;
      }
    }
    const count = Math.max(1, Math.round(seconds / size));
    return `${count} ${label}${count === 1 ? '' : 's'} ago`;
  }
  return formatDateTime(iso);
}

export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : pluralForm}`;
}

/** Turns "plan_decision_approved" into "Plan decision approved". */
export function humanizeAction(action: string): string {
  const text = action.replace(/_/g, ' ').trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
