import React from 'react';

export const SystemHealthPage: React.FC<{ p95Ms?: number; errorCount?: number }> = ({
  p95Ms = 14.2,
  errorCount = 0,
}) => (
  <section aria-labelledby="sys-health-heading">
    <h1 id="sys-health-heading">System Observability & Latency Telemetry</h1>
    <p>
      Query Latency p95: <strong>{p95Ms.toFixed(1)} ms</strong> (Target &lt; 2,000 ms) · Error Count: {errorCount}
    </p>
  </section>
);
export default SystemHealthPage;
