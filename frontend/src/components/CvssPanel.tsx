import React from 'react';
import { SEVERITY_LABELS } from '../content/terms';

export const CvssPanel: React.FC<{
  cveId: string;
  score: number | null;
  vector: string | null;
  cwe: string | null;
  fetchedAt: string;
}> = ({ cveId, score, vector, cwe, fetchedAt }) => {
  const band =
    score === null
      ? SEVERITY_LABELS.UNKNOWN
      : score >= 9.0
      ? SEVERITY_LABELS.CRITICAL
      : score >= 7.0
      ? SEVERITY_LABELS.HIGH
      : score >= 4.0
      ? SEVERITY_LABELS.MEDIUM
      : SEVERITY_LABELS.LOW;

  return (
    <div aria-label={`CVSS Enrichment for ${cveId}`} data-testid="cvss-panel">
      <h4>{cveId} — {band.badgeText}</h4>
      <p>Base Score: {score !== null ? score.toFixed(1) : 'Unknown (Uncertainty Penalty Active)'}</p>
      <p>Vector: <code>{vector ?? 'Unavailable'}</code> · CWE: <code>{cwe ?? 'Unclassified'}</code></p>
      <small>NVD Snapshot Cutoff: {fetchedAt}</small>
    </div>
  );
};
export default CvssPanel;
