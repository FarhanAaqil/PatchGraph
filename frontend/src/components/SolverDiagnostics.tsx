import React from 'react';
import { PlanActionItem } from '../api/generated';

export const SolverDiagnostics: React.FC<{
  status: string;
  bindingConstraints: string[];
  rejectedActions: PlanActionItem[];
}> = ({ status, bindingConstraints, rejectedActions }) => (
  <div aria-label="CP-SAT Solver Diagnostics" data-testid="solver-diagnostics">
    <h4>Solver Status: [{status.toUpperCase()}]</h4>
    <p><strong>Binding Constraints:</strong> {bindingConstraints.join('; ') || 'None'}</p>
    <h5>Rejected High-Risk Alternatives ({rejectedActions.length})</h5>
    <ul>
      {rejectedActions.map((r, i) => (
        <li key={i}>
          <code>{r.package} {r.from} -&gt; {r.to}</code> ({r.hours}h, {r.downtime_minutes}m downtime)
        </li>
      ))}
    </ul>
  </div>
);
export default SolverDiagnostics;
