import { FileJson, FileUp, Layers, Rocket, ShieldQuestion } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../lib/errors';
import { formatNumber, shortHash, timeAgo } from '../lib/format';
import { api, useImportMutation, useImports, useLoadSample } from '../lib/hooks';
import {
  Badge,
  Button,
  Card,
  CardHead,
  EmptyState,
  ErrorState,
  Notice,
  PageHead,
  Pagination,
  TableSkeleton,
} from '../ui/primitives';
import { useToast } from '../ui/Toast';

const PAGE_SIZE = 8;

function readJson(file: File): Promise<Record<string, unknown>> {
  return file.text().then((text) => {
    const parsed = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new Error('The file must contain a JSON object.');
    return parsed as Record<string, unknown>;
  });
}

function Dropzone({
  id,
  title,
  hint,
  busy,
  onFile,
  testId,
}: {
  id: string;
  title: string;
  hint: string;
  busy: boolean;
  onFile: (file: File) => void;
  testId: string;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className="dropzone"
      data-over={over}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <FileUp size={28} aria-hidden="true" />
      <strong>{title}</strong>
      <span>{hint}</span>
      <input
        ref={input}
        id={id}
        className="sr-only"
        type="file"
        aria-label={title}
        accept=".json,application/json"
        data-testid={testId}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <Button variant="primary" busy={busy} onClick={() => input.current?.click()}>
        Choose a file
      </Button>
    </div>
  );
}

export default function ImportPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0);
  const imports = useImports({ limit: PAGE_SIZE, offset });
  const loadSample = useLoadSample();
  const [problem, setProblem] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteKind, setPasteKind] = useState<'cyclonedx' | 'spdx'>('cyclonedx');
  const [pasteText, setPasteText] = useState('');

  const upload = useImportMutation((file: File) => api.uploadSbomFile(file));
  const vex = useImportMutation(({ name, document }: { name: string; document: Record<string, unknown> }) =>
    api.importVex({ source_name: name, document }),
  );
  const paste = useImportMutation((payload: { kind: 'cyclonedx' | 'spdx'; document: Record<string, unknown> }) =>
    api.importSbom({ kind: payload.kind, source_name: `pasted-${payload.kind}.json`, document: payload.document }),
  );
  const topology = useImportMutation(() => api.importTopology({ source_name: 'sample-topology.csv' }));

  const fail = (error: unknown) => {
    const message = errorMessage(error);
    setProblem(message);
    toast.error(message);
  };

  const onSbomFile = (file: File) => {
    setProblem(null);
    upload.mutate(file, {
      onSuccess: (res: { components_discovered?: number; source_name?: string }) => {
        setOffset(0);
        toast.success(`${res.source_name ?? file.name}: ${formatNumber(res.components_discovered)} components found.`);
      },
      onError: fail,
    });
  };

  const onVexFile = async (file: File) => {
    setProblem(null);
    try {
      const document = await readJson(file);
      vex.mutate(
        { name: file.name, document },
        { onSuccess: () => toast.success(`${file.name} imported.`), onError: fail },
      );
    } catch (e) {
      fail(e);
    }
  };

  const onPaste = () => {
    setProblem(null);
    try {
      const document = JSON.parse(pasteText);
      paste.mutate(
        { kind: pasteKind, document },
        {
          onSuccess: () => {
            toast.success('Pasted document imported.');
            setPasteText('');
          },
          onError: fail,
        },
      );
    } catch {
      fail(new Error('That text is not valid JSON. Check for a missing bracket or quote.'));
    }
  };

  const startSample = () =>
    loadSample.mutate(undefined, {
      onSuccess: () => {
        toast.success('Sample data loaded.');
        navigate('/risks');
      },
      onError: fail,
    });

  return (
    <>
      <PageHead
        title="Import your software"
        lead="PatchGraph needs to know what software you run. Upload a software bill of materials (SBOM) and, optionally, vendor statements about which flaws do not apply to you."
      />

      {problem ? <Notice tone="alert">{problem}</Notice> : null}

      <Card tint>
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ maxWidth: '60ch' }}>
            <h2>New here? Try the sample project</h2>
            <p style={{ color: 'var(--text-2)', marginTop: 4 }}>
              Loads an example shop with a vulnerable library, so you can explore risks, plans and approvals straight
              away. It replaces any current demo data.
            </p>
          </div>
          <Button
            variant="primary"
            icon={Rocket}
            busy={loadSample.isPending}
            onClick={startSample}
            data-testid="load-sample"
          >
            Load sample data
          </Button>
        </div>
      </Card>

      <div className="grid grid-2">
        <Card>
          <CardHead
            title="Software inventory (SBOM)"
            hint="CycloneDX 1.4–1.6 or SPDX 2.3, as a JSON file up to 25 MB."
          />
          <Dropzone
            id="sbom-file"
            title="Drop your SBOM here"
            hint="or pick it from your computer"
            busy={upload.isPending}
            onFile={onSbomFile}
            testId="sbom-input"
          />
          <button
            type="button"
            className="link-button"
            aria-expanded={pasteOpen}
            onClick={() => setPasteOpen((o) => !o)}
          >
            {pasteOpen ? 'Hide' : 'Or paste the JSON instead'}
          </button>
          {pasteOpen ? (
            <div className="stack" style={{ marginTop: 12 }}>
              <div className="field">
                <label htmlFor="paste-kind">Format</label>
                <select
                  id="paste-kind"
                  className="select"
                  value={pasteKind}
                  onChange={(e) => setPasteKind(e.target.value as 'cyclonedx' | 'spdx')}
                >
                  <option value="cyclonedx">CycloneDX</option>
                  <option value="spdx">SPDX</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="paste-text">Document</label>
                <textarea
                  id="paste-text"
                  className="textarea mono"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder='{"bomFormat": "CycloneDX", …}'
                />
              </div>
              <Button variant="primary" busy={paste.isPending} disabled={!pasteText.trim()} onClick={onPaste}>
                Import pasted JSON
              </Button>
            </div>
          ) : null}
        </Card>

        <div className="stack">
          <Card>
            <CardHead
              title="Vendor statements (VEX)"
              hint="Optional. Says which known flaws do not actually affect your product."
            />
            <Dropzone
              id="vex-file"
              title="Drop an OpenVEX file"
              hint="JSON with a “statements” list"
              busy={vex.isPending}
              onFile={onVexFile}
              testId="vex-input"
            />
          </Card>
          <Card>
            <CardHead
              title="Where it runs (topology)"
              hint="Preview: the request is recorded, but the file is not analysed yet."
            />
            <Button
              icon={Layers}
              busy={topology.isPending}
              onClick={() =>
                topology.mutate(undefined, {
                  onSuccess: () => toast.info('Sample topology registered (preview).'),
                  onError: fail,
                })
              }
            >
              Register sample topology
            </Button>
          </Card>
        </div>
      </div>

      <Card flush>
        <div style={{ padding: '20px 24px 0' }}>
          <CardHead
            title="Import history"
            hint="Every file is fingerprinted with a SHA-256 hash, so you can prove exactly what was analysed."
          />
        </div>
        {imports.isLoading ? (
          <TableSkeleton rows={PAGE_SIZE} columns={4} />
        ) : imports.isError ? (
          <ErrorState message={errorMessage(imports.error)} onRetry={() => imports.refetch()} />
        ) : (imports.data?.items.length ?? 0) === 0 ? (
          <EmptyState icon={FileJson} title="No imports yet">
            Your imported files will be listed here.
          </EmptyState>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table" data-testid="import-history">
                <thead>
                  <tr>
                    <th>File</th>
                    <th>Type</th>
                    <th className="hide-sm">Fingerprint</th>
                    <th>Status</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {imports.data?.items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className="cell-strong">{row.source_name}</span>
                        <span className="cell-sub mono">{row.id}</span>
                      </td>
                      <td>
                        <Badge>{row.kind === 'vex' ? 'VEX' : row.kind.toUpperCase()}</Badge>
                      </td>
                      <td className="mono hide-sm" title={row.content_sha256}>
                        {shortHash(row.content_sha256, 12)}
                      </td>
                      <td>
                        <Badge tone={row.status === 'completed' ? 'done' : 'alert'}>{row.status}</Badge>
                      </td>
                      <td>{timeAgo(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={imports.data?.total ?? 0}
              limit={PAGE_SIZE}
              offset={offset}
              onChange={setOffset}
              noun="imports"
            />
          </>
        )}
      </Card>

      <Notice icon={ShieldQuestion}>
        Files are checked before use: size and nesting limits apply, nothing in them is ever executed, and secrets are
        redacted from logs.
      </Notice>
    </>
  );
}
