import React from 'react';

export interface SourceBadgeProps {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  contentSha256: string;
  stale: boolean;
}

export const SourceBadge: React.FC<SourceBadgeProps> = ({
  source,
  sourceUrl,
  fetchedAt,
  contentSha256,
  stale,
}) => (
  <span className={`pg-source-badge ${stale ? 'pg-stale' : 'pg-fresh'}`} data-testid={`source-badge-${source}`}>
    <strong>{source.toUpperCase()}</strong> ({stale ? '[STALE FALLBACK]' : '[FRESH]'}) · Fetched: {fetchedAt} · SHA-256:{' '}
    <code>{contentSha256.slice(0, 12)}...</code> · <a href={sourceUrl}>Source</a>
  </span>
);
export default SourceBadge;
