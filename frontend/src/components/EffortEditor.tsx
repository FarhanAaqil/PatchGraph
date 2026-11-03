import React from 'react';

export const EffortEditor: React.FC<{
  hours: number;
  downtimeMinutes: number;
  provenance: string;
}> = ({ hours, downtimeMinutes, provenance }) => (
  <div aria-label="Remediation Effort Estimate" data-testid="effort-editor">
    <p>Estimated Engineering Effort: <strong>{hours}h</strong> · Estimated Downtime: <strong>{downtimeMinutes}m</strong></p>
    <small>Provenance: {provenance}</small>
  </div>
);
export default EffortEditor;
