import React from 'react';

export const ModelCard: React.FC<{
  modelVersion?: string;
  bundleSha256?: string;
  cutoffDate?: string;
  brierScore?: number;
  ece?: number;
}> = ({
  modelVersion = 'calibrated-logreg-v1',
  bundleSha256 = 'pinned',
  cutoffDate = '2026-06-30',
  brierScore = 0.041,
  ece = 0.082,
}) => (
  <aside aria-label="Exploit Model Metadata Card" data-testid="model-card">
    <h3>Model One: Calibrated Exploit Likelihood ({modelVersion})</h3>
    <p>
      Bundle SHA-256: <code>{bundleSha256.slice(0, 16)}...</code>
    </p>
    <p>
      Leakage Control: Disclosure cutoff <code>{cutoffDate}</code> + disjoint package-family split.
    </p>
    <p>
      Calibration: Brier Score = {brierScore.toFixed(4)} · ECE = {ece.toFixed(4)}
    </p>
    <p>
      <em>Deterministic Policy Boundary:</em> Matching, graph traversal, VEX, RBAC, and CP-SAT constraints never use ML.
    </p>
  </aside>
);
export default ModelCard;
