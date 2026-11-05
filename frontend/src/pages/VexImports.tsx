import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PatchGraphApiClient } from '../api/generated';
import { VEX_STATUS_LABELS, VexStatus } from '../content/terms';

const client = new PatchGraphApiClient();

export const VexImportsPage: React.FC<{ statements?: Array<{ cve: string; service: string; status: VexStatus; justification: string }> }> = ({
  statements: propStatements,
}) => {
  const { data: vexData } = useQuery({
    queryKey: ['vexStatements'],
    queryFn: () => client.listVexStatements(),
    enabled: !propStatements || propStatements.length === 0,
  });

  const rawItems = propStatements && propStatements.length > 0 ? propStatements : (vexData?.items || []);
  const statements = rawItems.map((s: any) => ({
    cve: s.cve,
    service: s.service,
    status: (s.status in VEX_STATUS_LABELS ? s.status : 'not_affected') as VexStatus,
    justification: s.justification,
  }));

  return (
    <section aria-labelledby="vex-heading" style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 id="vex-heading" style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: '0.5rem' }}>
        VEX Statements & Applicability Qualification
      </h1>
      <p style={{ color: '#64748B', marginBottom: '1.5rem' }}>
        VEX never deletes an advisory match; it updates applicability status while preserving justification.
      </p>
      <table aria-label="VEX Statements Table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#FFF', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <thead>
          <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', textTransform: 'uppercase', fontSize: '0.75rem', color: '#64748B' }}>
            <th style={{ padding: '0.85rem 1rem' }}>CVE</th>
            <th style={{ padding: '0.85rem 1rem' }}>Service</th>
            <th style={{ padding: '0.85rem 1rem' }}>VEX Status</th>
            <th style={{ padding: '0.85rem 1rem' }}>Justification</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((s, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{s.cve}</td>
              <td style={{ padding: '0.85rem 1rem' }}>{s.service}</td>
              <td style={{ padding: '0.85rem 1rem' }}>
                <span className="pill-chip" style={{ background: 'rgba(122, 15, 224, 0.08)', color: '#7A0FE0' }}>
                  {VEX_STATUS_LABELS[s.status]?.label || s.status}
                </span>
              </td>
              <td style={{ padding: '0.85rem 1rem', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#64748B' }}>{s.justification}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
};
export default VexImportsPage;
