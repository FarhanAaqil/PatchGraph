import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PatchGraphApiClient, AssetItem } from '../api/generated';

const client = new PatchGraphApiClient();

export const AssetsPage: React.FC<{ items?: AssetItem[] }> = ({ items: propItems }) => {
  const [envFilter, setEnvFilter] = useState<string>('all');

  const { data: assetsData } = useQuery({
    queryKey: ['assets'],
    queryFn: () => client.listAssets(),
    enabled: !propItems || propItems.length === 0,
  });

  const items = propItems && propItems.length > 0 ? propItems : assetsData?.items || [];
  const filtered = envFilter === 'all' ? items : items.filter((a) => a.environment === envFilter);

  return (
    <section aria-labelledby="assets-heading" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 id="assets-heading" style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '1rem' }}>
        Deployment Context & Asset Inventory
      </h1>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <label htmlFor="env-filter" style={{ fontWeight: 600 }}>
          Environment Filter:
        </label>
        <select
          id="env-filter"
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #CBD5E1' }}
        >
          <option value="all">All Environments</option>
          <option value="prod">Production (prod)</option>
          <option value="staging">Staging (staging)</option>
        </select>
        <span style={{ fontSize: '0.85rem', color: '#64748B' }}>{filtered.length} Assets Registered</span>
      </div>
      <table
        aria-label="Filtered Assets Table"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          textAlign: 'left',
          background: '#FFF',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}
      >
        <thead>
          <tr
            style={{
              background: '#F8FAFC',
              borderBottom: '1px solid #E2E8F0',
              textTransform: 'uppercase',
              fontSize: '0.75rem',
              color: '#64748B',
            }}
          >
            <th style={{ padding: '0.85rem 1rem' }}>Asset Key</th>
            <th style={{ padding: '0.85rem 1rem' }}>Environment</th>
            <th style={{ padding: '0.85rem 1rem' }}>Criticality</th>
            <th style={{ padding: '0.85rem 1rem' }}>Max Downtime</th>
            <th style={{ padding: '0.85rem 1rem' }}>Services</th>
            <th style={{ padding: '0.85rem 1rem' }}>Owner</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {a.external_key}
              </td>
              <td style={{ padding: '0.85rem 1rem' }}>
                {a.environment} {a.production ? '[PROD]' : '[NON-PROD]'}
              </td>
              <td style={{ padding: '0.85rem 1rem' }}>{a.criticality} / 5</td>
              <td style={{ padding: '0.85rem 1rem' }}>{a.max_downtime_minutes}m</td>
              <td style={{ padding: '0.85rem 1rem' }}>{a.services.join(', ')}</td>
              <td style={{ padding: '0.85rem 1rem', color: '#64748B' }}>{a.owner_email}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
export default AssetsPage;
