import React from 'react';
import { FactorBreakdown } from '../api/generated';

export const RiskFactors: React.FC<{
  findingId: string;
  finalScore: number;
  baselineScore: number;
  uncertainty: number;
  factors: FactorBreakdown;
}> = ({ findingId, finalScore, baselineScore, uncertainty, factors }) => (
  <div aria-label={`Risk Factor Contributions for ${findingId}`} data-testid="risk-factors-panel">
    <h4>Explainable Score Breakdown — Final: {finalScore.toFixed(2)} (Baseline: {baselineScore.toFixed(2)})</h4>
    <p><strong>Uncertainty Band:</strong> {(uncertainty * 100).toFixed(0)}% (Explicit penalty -{factors.uncertainty_penalty.toFixed(2)})</p>
    <ul>
      <li>Severity Contribution (+): {factors.severity.toFixed(2)}</li>
      <li>Calibrated Exploit Likelihood (+): {factors.exploit_probability.toFixed(2)}</li>
      <li>Asset Criticality (+): {factors.criticality.toFixed(2)}</li>
      <li>Graph Reachability (+): {factors.reachability.toFixed(2)}</li>
      <li>CISA KEV Bonus (+): {factors.kev_bonus.toFixed(2)}</li>
      <li>Uncertainty Penalty (-): -{factors.uncertainty_penalty.toFixed(2)}</li>
    </ul>
  </div>
);
export default RiskFactors;
