import React from 'react';

export const WhatIfPage: React.FC<{
  baselineRiskRemoved?: number;
  simulatedRiskRemoved?: number;
  greedyRiskRemoved?: number;
}> = ({ baselineRiskRemoved = 18.4, simulatedRiskRemoved = 22.6, greedyRiskRemoved = 18.4 }) => (
  <section aria-labelledby="what-if-heading">
    <h1 id="what-if-heading">What-If Constrained Plan Simulation</h1>
    <table aria-label="Side-by-Side Plan Trade-Off Comparison">
      <thead>
        <tr>
          <th>Plan Variant</th>
          <th>Weighted Exposure Removed</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Baseline CP-SAT Plan</td>
          <td>{baselineRiskRemoved.toFixed(1)}</td>
        </tr>
        <tr>
          <td>Simulated What-If CP-SAT Plan</td>
          <td>{simulatedRiskRemoved.toFixed(1)}</td>
        </tr>
        <tr>
          <td>Greedy Risk-per-Hour Baseline</td>
          <td>{greedyRiskRemoved.toFixed(1)}</td>
        </tr>
      </tbody>
    </table>
  </section>
);
export default WhatIfPage;
