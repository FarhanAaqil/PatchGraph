import React from 'react';
import { PlanActionItem } from '../api/generated';

export const PatchCandidates: React.FC<{ actions: PlanActionItem[] }> = ({ actions }) => (
  <div aria-label="Available Patch Upgrade Candidates" data-testid="patch-candidates">
    <h3>Available Upgrade & Mitigation Candidates</h3>
    <ul>
      {actions.map((a, idx) => (
        <li key={idx}>
          <code>{a.package}</code>: <code>{a.from} -&gt; {a.to}</code> · Effort: {a.hours}h · Services: {a.services.join(', ')}
        </li>
      ))}
    </ul>
  </div>
);
export default PatchCandidates;
