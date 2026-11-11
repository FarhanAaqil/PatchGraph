import { Flame, Network } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import type { GraphNode } from '../api/generated';
import { errorMessage } from '../lib/errors';
import { formatNumber } from '../lib/format';
import { useGraph, useNodeDetail } from '../lib/hooks';
import { reachabilityLabel } from '../lib/severity';
import { useResolvedTheme } from '../lib/theme';
import {
  Badge,
  Button,
  Card,
  CardHead,
  EmptyState,
  ErrorState,
  Meter,
  PageHead,
  Skeleton,
  TableSkeleton,
} from '../ui/primitives';

const GraphCanvas = lazy(() => import('./GraphCanvas'));

const KIND_LABEL: Record<string, string> = {
  package_version: 'Software package',
  service: 'Service',
  application: 'Application',
  environment: 'Environment',
};

function NodePanel({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  const detail = useNodeDetail(node.kind === 'package_version' ? node.id : null);
  const d = detail.data;
  return (
    <Card data-testid="node-panel">
      <CardHead
        title={node.label}
        hint={KIND_LABEL[node.kind] ?? node.kind}
        action={
          <Button size="small" variant="quiet" onClick={onClose}>
            Close
          </Button>
        }
      />
      {node.kind !== 'package_version' ? (
        <p style={{ color: 'var(--text-2)' }}>
          {node.kind === 'environment' ? 'Where services run.' : 'A part of your running software.'} Select a software
          package (a diamond) to see how far a flaw could spread.
        </p>
      ) : detail.isLoading ? (
        <Skeleton height={120} radius={14} />
      ) : detail.isError ? (
        <ErrorState message={errorMessage(detail.error)} onRetry={() => detail.refetch()} />
      ) : d ? (
        <div className="stack">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {d.in_kev ? (
              <Badge tone="alert">
                <Flame size={12} aria-hidden="true" /> Actively exploited
              </Badge>
            ) : null}
            <Badge tone={d.severity === 'critical' ? 'critical' : d.severity === 'high' ? 'high' : 'medium'}>
              {d.severity} severity
            </Badge>
          </div>
          <dl className="facts">
            <div>
              <dt>Exposure</dt>
              <dd>{reachabilityLabel(d.reachability)}</dd>
            </div>
            <div>
              <dt>Spread (blast radius)</dt>
              <dd>{formatNumber(d.blast_radius_score, 1)} points</dd>
            </div>
            <div>
              <dt>Owner</dt>
              <dd>{d.owner}</dd>
            </div>
          </dl>
          <div>
            <span className="field-label">Chance it is exploited</span>
            <Meter value={d.epss_percentile} max={1} label="Exploit likelihood percentile" />
          </div>
          <div>
            <span className="field-label">Services affected</span>
            <p>{d.affected_services.join(', ') || 'None'}</p>
          </div>
          {d.upstream_callers.length ? (
            <div>
              <span className="field-label">Reached through</span>
              <p>{d.upstream_callers.join(', ')}</p>
            </div>
          ) : null}
          <Link className="btn btn-primary" to="/plan">
            Plan a fix
          </Link>
        </div>
      ) : null}
    </Card>
  );
}

export default function MapPage() {
  const [environment, setEnvironment] = useState('');
  const [kevOnly, setKevOnly] = useState(false);
  const [view, setView] = useState<'diagram' | 'list'>('diagram');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const graph = useGraph({ environment: environment || undefined, in_kev: kevOnly || undefined });

  const nodes = graph.data?.nodes ?? [];
  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const theme = useResolvedTheme();

  return (
    <>
      <PageHead
        title="How it all connects"
        lead="Packages, the services that use them and where they run. Follow the lines to see how far one vulnerable library could reach."
      />

      <Card flush>
        <div className="toolbar">
          <div className="segmented" role="group" aria-label="View">
            <button type="button" aria-pressed={view === 'diagram'} onClick={() => setView('diagram')}>
              Diagram
            </button>
            <button
              type="button"
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
              data-testid="list-view"
            >
              List
            </button>
          </div>
          <select
            className="select"
            aria-label="Environment"
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
          >
            <option value="">All environments</option>
            <option value="prod">Production</option>
            <option value="staging">Staging</option>
          </select>
          <button type="button" className="chip-toggle" aria-pressed={kevOnly} onClick={() => setKevOnly((v) => !v)}>
            <Flame size={15} aria-hidden="true" /> Actively exploited only
          </button>
          <span style={{ marginLeft: 'auto', color: 'var(--text-2)', fontSize: '0.86rem' }}>
            {graph.data
              ? `${formatNumber(graph.data.stats.total_nodes)} items · ${formatNumber(graph.data.stats.total_edges)} connections`
              : ''}
          </span>
        </div>

        {graph.isLoading ? (
          <div style={{ padding: 24 }}>
            <Skeleton height={420} radius={14} />
          </div>
        ) : graph.isError ? (
          <ErrorState message={errorMessage(graph.error)} onRetry={() => graph.refetch()} />
        ) : nodes.length === 0 ? (
          <EmptyState icon={Network} title="Nothing to show yet">
            Import software and a deployment layout, and the connections will be drawn here.
          </EmptyState>
        ) : view === 'diagram' ? (
          <div className="map-layout">
            <Suspense fallback={<Skeleton height={460} radius={0} />}>
              <GraphCanvas
                nodes={nodes}
                edges={graph.data?.edges ?? []}
                selectedId={selectedId}
                onSelect={setSelectedId}
                theme={theme}
              />
            </Suspense>
            <div className="legend" aria-label="Legend">
              <span>
                <i className="dot dot-diamond" /> Vulnerable package
              </span>
              <span>
                <i className="dot dot-square" /> Service
              </span>
              <span>
                <i className="dot dot-circle" /> Environment or dependency
              </span>
              <span>
                <i className="dot dot-patch" /> Fix path
              </span>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table" data-testid="node-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Kind</th>
                  <th>Status</th>
                  <th>Exposure</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr key={n.id} data-clickable="true" onClick={() => setSelectedId(n.id)}>
                    <td className="cell-strong">{n.label}</td>
                    <td>{KIND_LABEL[n.kind] ?? n.kind}</td>
                    <td>
                      {n.in_kev ? (
                        <Badge tone="alert">Actively exploited</Badge>
                      ) : n.severity && n.severity !== 'safe' ? (
                        <Badge tone="high">{n.severity}</Badge>
                      ) : (
                        <Badge>OK</Badge>
                      )}
                    </td>
                    <td>{n.reachability ? reachabilityLabel(n.reachability) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {graph.isLoading ? <TableSkeleton rows={1} columns={3} /> : null}
      {selected ? (
        <NodePanel node={selected} onClose={() => setSelectedId(null)} />
      ) : nodes.length ? (
        <p style={{ color: 'var(--text-3)' }}>Select any item to see its details.</p>
      ) : null}
    </>
  );
}
