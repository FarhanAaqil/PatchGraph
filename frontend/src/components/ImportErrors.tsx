import React from 'react';
import { FieldError } from '../api/generated';

export const ImportErrors: React.FC<{ errors: FieldError[]; requestId: string }> = ({ errors, requestId }) => {
  if (!errors.length) return null;
  return (
    <div role="alert" aria-label="SBOM Field Validation Errors" data-testid="import-errors-panel">
      <h3>
        Validation Failed (Request ID: <code>{requestId}</code>)
      </h3>
      <ul>
        {errors.map((err, i) => (
          <li key={i}>
            <strong>
              Location <code>{err.location ?? err.field}</code>:
            </strong>{' '}
            {err.issue}
          </li>
        ))}
      </ul>
    </div>
  );
};
export default ImportErrors;
