import React, { useState } from 'react';
import {
  ImportStatusResponse,
  FieldError,
  ApiErrorEnvelope,
} from '../api/generated';
import { UI_STATE_BANNERS, UiOperationalState } from '../content/terms';

export interface ImportsPageProps {
  initialState?: UiOperationalState;
  seededImports?: ImportStatusResponse[];
  onSubmitImport?: (payload: {
    kind: 'cyclonedx' | 'spdx' | 'vex';
    source_name: string;
    document: Record<string, unknown>;
  }) => Promise<ImportStatusResponse>;
}

const DEFAULT_SEEDED_IMPORTS: ImportStatusResponse[] = [
  {
    id: 'imp_seed_sbom_01',
    project_id: '00000000-0000-0000-0000-000000000001',
    kind: 'cyclonedx',
    status: 'completed',
    source_name: 'sbom_cyclonedx_seed.json',
    content_sha256: '4a7d1ed414474e4033ac29ccb8653d9b00000000000000000000000000000001',
    object_key: 'sha256/4a/4a7d1ed414474e4033ac29ccb8653d9b00000000000000000000000000000001.json',
    parser_version: '1.0.0',
    errors: [],
    created_at: '2026-11-01T00:05:00Z',
    request_id: 'req_seed_imp_01',
  },
  {
    id: 'imp_seed_vex_01',
    project_id: '00000000-0000-0000-0000-000000000001',
    kind: 'vex',
    status: 'completed',
    source_name: 'vex_openvex_seed.json',
    content_sha256: '7b52009b64fd0a2a49e6d8a93975307700000000000000000000000000000002',
    object_key: 'sha256/7b/7b52009b64fd0a2a49e6d8a93975307700000000000000000000000000000002.json',
    parser_version: '1.0.0',
    errors: [],
    created_at: '2026-11-01T00:06:00Z',
    request_id: 'req_seed_imp_02',
  },
];

/**
 * SBOM and VEX Imports View & Fixture Viewer
 * Owner: Member 2 (Day 6 Deliverable)
 * Handles loading, empty, stale, partial, unauthorized, failed, and offline-demo states.
 */
export const ImportsPage: React.FC<ImportsPageProps> = ({
  initialState = 'offline-demo',
  seededImports = DEFAULT_SEEDED_IMPORTS,
  onSubmitImport,
}) => {
  const [uiState, setUiState] = useState<UiOperationalState>(initialState);
  const [imports, setImports] = useState<ImportStatusResponse[]>(seededImports);
  const [selectedKind, setSelectedKind] = useState<'cyclonedx' | 'spdx' | 'vex'>('cyclonedx');
  const [sourceName, setSourceName] = useState<string>('sbom_cyclonedx_seed.json');
  const [rawJson, setRawJson] = useState<string>(
    JSON.stringify(
      {
        bomFormat: 'CycloneDX',
        specVersion: '1.5',
        components: [{ name: 'example-lib', version: '1.4.0', purl: 'pkg:pypi/example-lib@1.4.0' }],
      },
      null,
      2
    )
  );
  const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]);
  const [lastRequestId, setLastRequestId] = useState<string>('req_seed_imp_01');

  const banner = UI_STATE_BANNERS[uiState];

  const handleValidateAndImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uiState === 'unauthorized') {
      return;
    }
    try {
      const parsed = JSON.parse(rawJson);
      if (onSubmitImport) {
        setUiState('loading');
        const created = await onSubmitImport({
          kind: selectedKind,
          source_name: sourceName,
          document: parsed,
        });
        setImports([created, ...imports]);
        setFieldErrors(created.errors);
        setLastRequestId(created.request_id);
        setUiState(created.status === 'failed' ? 'failed' : 'offline-demo');
      }
    } catch (err) {
      const apiErr = err as ApiErrorEnvelope;
      setUiState('failed');
      setFieldErrors(
        apiErr?.field_errors ?? [
          {
            field: 'document',
            issue: err instanceof Error ? err.message : 'Invalid JSON payload',
            location: 'line 1',
          },
        ]
      );
      if (apiErr?.request_id) {
        setLastRequestId(apiErr.request_id);
      }
    }
  };

  return (
    <section aria-labelledby="imports-heading" className="pg-page-section">
      <header className="pg-page-header">
        <h1 id="imports-heading">SBOM and VEX Imports</h1>
        <p>
          Validate CycloneDX (1.4-1.6), SPDX (2.3), and OpenVEX documents with content-addressed SHA-256 provenance.
        </p>
      </header>

      <div role="status" aria-live="polite" className={`pg-state-banner pg-state-${uiState}`}>
        <strong>[{uiState.toUpperCase()}] {banner.title}:</strong> {banner.guidance}
      </div>

      <form onSubmit={handleValidateAndImport} aria-label="Upload or Validate SBOM/VEX Fixture">
        <div>
          <label htmlFor="import-kind">Document Format</label>
          <select
            id="import-kind"
            value={selectedKind}
            onChange={(e) => setSelectedKind(e.target.value as 'cyclonedx' | 'spdx' | 'vex')}
            disabled={uiState === 'unauthorized'}
          >
            <option value="cyclonedx">CycloneDX JSON (1.4 - 1.6)</option>
            <option value="spdx">SPDX JSON (2.3)</option>
            <option value="vex">OpenVEX / CycloneDX VEX</option>
          </select>
        </div>

        <div>
          <label htmlFor="source-name">Source Filename</label>
          <input
            id="source-name"
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            disabled={uiState === 'unauthorized'}
          />
        </div>

        <div>
          <label htmlFor="raw-json">Document Payload (25 MB max, non-executing parser)</label>
          <textarea
            id="raw-json"
            rows={8}
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            disabled={uiState === 'unauthorized'}
          />
        </div>

        <button type="submit" disabled={uiState === 'unauthorized' || uiState === 'loading'}>
          Validate and Ingest Document
        </button>
      </form>

      {fieldErrors.length > 0 && (
        <div role="alert" aria-label="Validation Errors by Location" className="pg-error-box">
          <h2>Structured Validation Errors (Request ID: {lastRequestId})</h2>
          <ul>
            {fieldErrors.map((fe, idx) => (
              <li key={idx}>
                <code>{fe.location ?? fe.field}</code> ({fe.field}): {fe.issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2>Content-Addressed Import Ledger</h2>
      {imports.length === 0 ? (
        <p data-testid="empty-imports">No imports recorded yet. Load the seeded fixture scenario above.</p>
      ) : (
        <table aria-label="Recorded SBOM and VEX Imports">
          <thead>
            <tr>
              <th>Import ID</th>
              <th>Kind</th>
              <th>Source Name</th>
              <th>Status</th>
              <th>Content SHA-256</th>
              <th>Parser Version</th>
              <th>Created At</th>
            </tr>
          </thead>
          <tbody>
            {imports.map((imp) => (
              <tr key={imp.id}>
                <td><code>{imp.id}</code></td>
                <td>{imp.kind.toUpperCase()}</td>
                <td>{imp.source_name}</td>
                <td>[{imp.status.toUpperCase()}]</td>
                <td><code>{imp.content_sha256.slice(0, 16)}...</code></td>
                <td>{imp.parser_version}</td>
                <td>{imp.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

export default ImportsPage;
