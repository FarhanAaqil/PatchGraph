import React, { useState } from 'react';

export interface GraphEdgeRow {
  source: string;
  target: string;
  kind: string;
  scope?: string;
}

export const DependencyGraphPage: React.FC<{ edges?: GraphEdgeRow[] }> = ({ edges = [] }) => {
  const [viewMode, setViewMode] = useState<'canvas' | 'table'>('canvas');
  return (
    <section aria-labelledby="dep-graph-heading">
      <h1 id="dep-graph-heading">Typed Dependency & Deployment Graph</h1>
      <div>
        <button type="button" onClick={() => setViewMode('canvas')}>Cytoscape Graph View</button>
        <button type="button" onClick={() => setViewMode('table')}>Accessible Table Alternative</button>
      </div>
      {viewMode === 'canvas' && (
        <div role="region" aria-label="Interactive Cytoscape Topology Container" data-testid="cytoscape-container">
          <p>Cytoscape.js Canvas ({edges.length} typed edges loaded; keyboard table fallback available).</p>
        </div>
      )}
      <table aria-label="Accessible Dependency Graph Edges Table">
        <thead>
          <tr>
            <th>Source Node</th>
            <th>Relationship Type</th>
            <th>Target Node</th>
            <th>Scope</th>
          </tr>
        </thead>
        <tbody>
          {edges.map((e, idx) => (
            <tr key={idx}>
              <td><code>{e.source}</code></td>
              <td>{e.kind}</td>
              <td><code>{e.target}</code></td>
              <td>{e.scope ?? 'runtime'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
export default DependencyGraphPage;
