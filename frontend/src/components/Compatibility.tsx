import React from 'react';

export const Compatibility: React.FC<{
  packageName: string;
  fromVersion: string;
  toVersion: string;
  jumpKind: string;
  compatibilityRisk: number;
}> = ({ packageName, fromVersion, toVersion, jumpKind, compatibilityRisk }) => (
  <div aria-label="Version Jump Compatibility Evidence" data-testid="compatibility-panel">
    <strong>
      {packageName} ({fromVersion} -&gt; {toVersion})
    </strong>
    : [{jumpKind.toUpperCase()} JUMP] · Compatibility Risk: {(compatibilityRisk * 100).toFixed(0)}%
  </div>
);
export default Compatibility;
