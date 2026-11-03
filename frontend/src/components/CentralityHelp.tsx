import React from 'react';

export const CentralityHelp: React.FC<{ centralityScore: number; reachedServices: number }> = ({
  centralityScore,
  reachedServices,
}) => (
  <div aria-label="Graph Centrality Explanation" data-testid="centrality-help">
    <p>Bounded Graph Centrality Score: <strong>{centralityScore.toFixed(2)}</strong> (Reaches {reachedServices} services within depth &lt;= 12).</p>
  </div>
);
export default CentralityHelp;
