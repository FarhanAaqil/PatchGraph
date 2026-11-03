import React from 'react';
import { VEX_STATUS_LABELS, VexStatus } from '../content/terms';

export const VexImportsPage: React.FC<{ statements?: Array<{ cve: string; service: string; status: VexStatus; justification: string }> }> = ({
  statements = [{ cve: 'CVE-2026-1001', service: 'analytics-worker', status: 'not_affected', justification: 'vulnerable_code_not_in_execute_path' }],
}) => (
  <section aria-labelledby="vex-heading">
    <h1 id="vex-heading">VEX Statements & Applicability Qualification</h1>
    <p>VEX never deletes an advisory match; it updates applicability status while preserving justification.</p>
    <table aria-label="VEX Statements Table">
      <thead>
        <tr><th>CVE</th><th>Service</th><th>VEX Status</th><th>Justification</th></tr>
      </thead>
      <tbody>
        {statements.map((s, i) => (
          <tr key={i}>
            <td><code>{s.cve}</code></td>
            <td>{s.service}</td>
            <td>{VEX_STATUS_LABELS[s.status].label}</td>
            <td><code>{s.justification}</code></td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);
export default VexImportsPage;
