import React, { useState } from 'react';
import { AssetItem } from '../api/generated';

export const AssetsPage: React.FC<{ items?: AssetItem[] }> = ({ items = [] }) => {
  const [envFilter, setEnvFilter] = useState<string>('all');
  const filtered = envFilter === 'all' ? items : items.filter((a) => a.environment === envFilter);
  return (
    <section aria-labelledby="assets-heading">
      <h1 id="assets-heading">Deployment Context & Asset Inventory</h1>
      <label htmlFor="env-filter">
        Environment Filter:
        <select id="env-filter" value={envFilter} onChange={(e) => setEnvFilter(e.target.value)}>
          <option value="all">All Environments</option>
          <option value="prod">Production (prod)</option>
          <option value="staging">Staging (staging)</option>
        </select>
      </label>
      <table aria-label="Filtered Assets Table">
        <thead>
          <tr>
            <th>Asset Key</th>
            <th>Environment</th>
            <th>Criticality (1-5)</th>
            <th>Max Downtime (min)</th>
            <th>Services</th>
            <th>Owner</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => (
            <tr key={a.id}>
              <td><code>{a.external_key}</code></td>
              <td>{a.environment} {a.production ? '[PROD]' : '[NON-PROD]'}</td>
              <td>{a.criticality}</td>
              <td>{a.max_downtime_minutes}m</td>
              <td>{a.services.join(', ')}</td>
              <td>{a.owner_email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
export default AssetsPage;
