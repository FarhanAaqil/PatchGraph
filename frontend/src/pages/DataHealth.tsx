import React from 'react';
import { DataHealthSource } from '../api/generated';

export const DataHealthPage: React.FC<{ sources?: DataHealthSource[] }> = ({ sources = [] }) => (
  <section aria-labelledby="data-health-heading">
    <h1 id="data-health-heading">External Feed Freshness & Data Health</h1>
    <table aria-label="External Evidence Sources Health">
      <thead>
        <tr>
          <th>Source</th>
          <th>Status</th>
          <th>Last Fetched</th>
          <th>SHA-256</th>
        </tr>
      </thead>
      <tbody>
        {sources.map((s) => (
          <tr key={s.source}>
            <td>{s.source.toUpperCase()}</td>
            <td>[{s.status.toUpperCase()}]</td>
            <td>{s.last_fetched_at}</td>
            <td>
              <code>{s.content_sha256.slice(0, 16)}...</code>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);
export default DataHealthPage;
