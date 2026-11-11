import React from 'react';
import PathExplorer, { PathRecordView } from '../components/PathExplorer';

export const BlastRadiusPage: React.FC<{
  packageVersionId?: string;
  productionServices?: string[];
  nonProductionServices?: string[];
  owners?: string[];
  paths?: PathRecordView[];
}> = ({
  packageVersionId = 'pv_example_lib_1_4_0',
  productionServices = ['checkout'],
  nonProductionServices = [],
  owners = ['payments-team@patchgraph.local'],
  paths = [],
}) => (
  <section aria-labelledby="blast-radius-heading">
    <h1 id="blast-radius-heading">Blast Radius Impact Summary</h1>
    <p>
      Root Component: <code>{packageVersionId}</code>
    </p>
    <ul>
      <li>
        <strong>Production Services Affected ({productionServices.length}):</strong>{' '}
        {productionServices.join(', ') || 'None'}
      </li>
      <li>
        <strong>Non-Production Services Affected ({nonProductionServices.length}):</strong>{' '}
        {nonProductionServices.join(', ') || 'None'}
      </li>
      <li>
        <strong>Routed Service Owners:</strong> {owners.join(', ')}
      </li>
    </ul>
    <PathExplorer paths={paths} />
  </section>
);
export default BlastRadiusPage;
