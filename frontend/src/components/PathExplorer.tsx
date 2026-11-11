import React from 'react';

export interface PathRecordView {
  service: string;
  environment: string;
  owner_email: string;
  decay_factor: number;
  path_nodes: string[];
}

export const PathExplorer: React.FC<{ paths: PathRecordView[] }> = ({ paths }) => (
  <div aria-label="Bounded Graph Path Explorer" data-testid="path-explorer">
    <h3>Affected Dependency-to-Service Paths (Bounded Depth &lt;= 12)</h3>
    <table aria-label="Affected Paths Fallback Table">
      <thead>
        <tr>
          <th>Service</th>
          <th>Environment</th>
          <th>Hop Decay</th>
          <th>Owner</th>
          <th>Typed Path Chain</th>
        </tr>
      </thead>
      <tbody>
        {paths.map((p, idx) => (
          <tr key={idx}>
            <td>
              <strong>{p.service}</strong>
            </td>
            <td>{p.environment}</td>
            <td>{p.decay_factor.toFixed(2)}</td>
            <td>{p.owner_email}</td>
            <td>
              <code>{p.path_nodes.join(' -> ')}</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);
export default PathExplorer;
