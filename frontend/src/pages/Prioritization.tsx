import React from 'react';
import { FindingSummary } from '../api/generated';

export const PrioritizationPage: React.FC<{ items?: FindingSummary[] }> = ({ items = [] }) => (
  <section aria-labelledby="prioritization-heading">
    <h1 id="prioritization-heading">Prioritized Findings Queue</h1>
    <p>Sorted by deployment-aware final score with factor contributions and uncertainty bands.</p>
    <p>Total Ranked Findings: {items.length}</p>
  </section>
);
export default PrioritizationPage;
