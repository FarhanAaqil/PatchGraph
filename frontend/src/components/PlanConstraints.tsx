import React from 'react';

export const PlanConstraints: React.FC<{
  budgetHours: number;
  maxDowntimeMinutes: number;
  environments: string[];
}> = ({ budgetHours, maxDowntimeMinutes, environments }) => (
  <div aria-label="Optimization Constraints Summary" data-testid="plan-constraints">
    <h4>Active CP-SAT Constraints</h4>
    <p>Budget Hours &lt;= {budgetHours}h · Max Service Downtime &lt;= {maxDowntimeMinutes}m · Environments: {environments.join(', ')}</p>
  </div>
);
export default PlanConstraints;
