import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Flame, Rocket, Search, ShieldCheck, Wrench } from 'lucide-react';
import { memo, useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../lib/errors';
import { factorRows, isKnownExploited, rawInputs, whyItMatters } from '../lib/explain';
import { formatNumber, formatPercent } from '../lib/format';
import { api, useExplain, useFindings, useLoadSample } from '../lib/hooks';
import { reachabilityLabel, scoreBand } from '../lib/severity';
import { useDebounce } from '../lib/useDebounce';
import type { FindingSummary } from '../api/generated';
import { Drawer } from '../ui/Drawer';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Meter,
  Notice,
  PageHead,
  Pagination,
  SeverityBadge,
  Skeleton,
  TableSkeleton,
} from '../ui/primitives';
import { useToast } from '../ui/Toast';

const PAGE_SIZE = 10;

const Row = memo(function Row({ finding, onOpen }: { finding: FindingSummary; onOpen: (id: string) => void }) {
  const band = scoreBand(finding.final_score);
  const raw = rawInputs(finding);
  return (
    <tr data-clickable="true" onClick={() => onOpen(finding.id)} data-testid="finding-row">
      <td>
        <button
          type="button"
          className="row-button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(finding.id);
          }}
          aria-label={`Explain ${finding.canonical_id} in ${finding.package_name}`}
        >
          <span className="cell-strong">{finding.canonical_id}</span>
        </button>
        <span className="cell-sub">
          {finding.package_name} {finding.package_version}
        </span>
        {isKnownExploited(finding) ? (
          <Badge tone="alert">
            <Flame size={12} aria-hidden="true" /> Actively exploited
          </Badge>
        ) : null}
      </td>
      <td>
        <span className="cell-strong">{finding.service_name || '–'}</span>
        <span className="cell-sub">{finding.environment}</span>
      </td>
      <td>
        <SeverityBadge band={band.band} label={band.label} />
        <span className="cell-sub">Score {finding.final_score.toFixed(1)}</span>
      </td>
      <td className="hide-sm" style={{ minWidth: 150 }}>
        <span className="cell-strong">{formatPercent(finding.probability)}</span>
        <Meter value={finding.probability} max={1} label="Exploit chance" />
      </td>
      <td className="hide-sm">{reachabilityLabel(raw.reachability_state)}</td>
      <td>
        <ChevronRight size={18} aria-hidden="true" style={{ color: 'var(--text-3)' }} />
      </td>
    </tr>
  );
});

function FindingPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const detail = useQuery({ queryKey: ['finding', id], queryFn: () => api.getFinding(id), staleTime: 60_000 });
  const explain = useExplain(id);
  const finding = detail.data;
  const band = scoreBand(finding?.final_score);
  const rows = factorRows(explain.data?.factors ?? finding?.factors);

  return (
    <Drawer
      open
      onClose={onClose}
      testId="explain-drawer"
      title={finding?.canonical_id ?? 'Loading…'}
      subtitle={
        finding
          ? `${finding.package_name} ${finding.package_version} · ${finding.service_name} (${finding.environment})`
          : undefined
      }
    >
      {detail.isError ? (
        <ErrorState message={errorMessage(detail.error)} onRetry={() => detail.refetch()} />
      ) : !finding ? (
        <div aria-busy="true" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Skeleton height={86} radius={14} />
          <Skeleton height={120} radius={14} />
        </div>
      ) : (
        <>
          <section aria-labelledby="why">
            <h3 id="why">Why this matters</h3>
            <div className="callout">
              <div className="score" style={{ fontSize: '2.2rem' }}>
                {finding.final_score.toFixed(1)} <small>risk score</small>
              </div>
              <SeverityBadge band={band.band} label={band.label} />
            </div>
            <p style={{ marginTop: 12 }}>{whyItMatters(finding)}</p>
            <p style={{ color: 'var(--text-2)', marginTop: 6, fontSize: '0.88rem' }}>{band.meaning}</p>
          </section>

          <section aria-labelledby="how">
            <h3 id="how">How the score is built</h3>
            <ul className="factor-list">
              {rows.map((row) => (
                <li key={row.key}>
                  <div className="factor-head">
                    <span>{row.label}</span>
                    <span className="mono">
                      {row.isPenalty ? '−' : '+'}
                      {row.value.toFixed(2)}
                    </span>
                  </div>
                  <Meter value={row.value} max={row.max} label={row.label} />
                  <span className="cell-sub">{row.help}</span>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="do">
            <h3 id="do">What you can do</h3>
            {finding.candidate_actions?.length ? (
              <ul className="list" style={{ margin: '8px 0 0' }}>
                {finding.candidate_actions.map((a, i) => (
                  <li key={i}>
                    <div>
                      <strong>
                        <Wrench size={14} aria-hidden="true" /> Upgrade {a.package} {a.from} → {a.to}
                      </strong>
                      <span className="cell-sub">About {formatNumber(a.hours)} hours of work</span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: 'var(--text-2)' }}>
                No upgrade is available yet. Consider a mitigation or a vendor statement.
              </p>
            )}
            <div style={{ marginTop: 12 }}>
              <Link className="btn btn-primary" to="/plan">
                Include in a plan
              </Link>
            </div>
          </section>

          <details className="advanced">
            <summary>Advanced: the formula and model</summary>
            {explain.isLoading ? (
              <Skeleton height={60} />
            ) : (
              <>
                <p className="mono" style={{ marginTop: 10 }}>
                  {explain.data?.formula}
                </p>
                <p style={{ color: 'var(--text-2)', marginTop: 8, fontSize: '0.88rem' }}>
                  {explain.data?.calibration_notes}
                </p>
                {explain.data?.ml_model_version ? (
                  <p style={{ color: 'var(--text-2)', marginTop: 8, fontSize: '0.88rem' }}>
                    Model: {explain.data.ml_model_version}
                  </p>
                ) : null}
              </>
            )}
          </details>
        </>
      )}
    </Drawer>
  );
}

export default function Risks() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const loadSample = useLoadSample();

  const environment = params.get('env') ?? '';
  const kevOnly = params.get('kev') === '1';
  const sort = params.get('sort') ?? 'final_score';
  const offset = Number(params.get('offset') ?? 0) || 0;
  const open = params.get('open');

  const [search, setSearch] = useState(params.get('q') ?? '');
  const q = useDebounce(search.trim(), 300);

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === '') next.delete(key);
            else next.set(key, value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // Typing waits 300 ms, then resets to the first page.
  useEffect(() => {
    if (q !== (params.get('q') ?? '')) update({ q, offset: null });
  }, [q, params, update]);

  const findings = useFindings({
    q: q || undefined,
    environment: environment || undefined,
    kev_only: kevOnly,
    sort,
    limit: PAGE_SIZE,
    offset,
  });
  const total = findings.data?.total ?? 0;
  const filtered = Boolean(q || environment || kevOnly);

  const onOpen = useCallback((id: string) => update({ open: id }), [update]);
  const onClose = useCallback(() => update({ open: null }), [update]);

  const startSample = () =>
    loadSample.mutate(undefined, {
      onSuccess: () => toast.success('Sample data loaded.'),
      onError: (e) => toast.error(errorMessage(e)),
    });

  return (
    <>
      <PageHead
        title="What matters most"
        lead="Findings ranked by real-world risk, not just severity. Open any row to see why it ranks where it does."
        actions={
          <Button variant="primary" onClick={() => navigate('/plan')}>
            Plan the fixes
          </Button>
        }
      />

      <Card flush>
        <div className="toolbar">
          <div className="search">
            <Search size={16} aria-hidden="true" />
            <input
              className="input"
              type="search"
              placeholder="Search by CVE, package or service"
              aria-label="Search findings"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="risk-search"
            />
          </div>
          <select
            className="select"
            aria-label="Environment"
            value={environment}
            onChange={(e) => update({ env: e.target.value, offset: null })}
          >
            <option value="">All environments</option>
            <option value="prod">Production</option>
            <option value="staging">Staging</option>
          </select>
          <select
            className="select"
            aria-label="Sort by"
            value={sort}
            onChange={(e) => update({ sort: e.target.value === 'final_score' ? null : e.target.value, offset: null })}
          >
            <option value="final_score">Highest risk first</option>
            <option value="epss">Most likely exploited</option>
            <option value="baseline_score">Most severe</option>
          </select>
          <button
            type="button"
            className="chip-toggle"
            aria-pressed={kevOnly}
            onClick={() => update({ kev: kevOnly ? null : '1', offset: null })}
            data-testid="kev-toggle"
          >
            <Flame size={15} aria-hidden="true" /> Actively exploited only
          </button>
        </div>

        {findings.isLoading ? (
          <TableSkeleton rows={PAGE_SIZE} columns={6} />
        ) : findings.isError ? (
          <ErrorState message={errorMessage(findings.error)} onRetry={() => findings.refetch()} />
        ) : total === 0 ? (
          filtered ? (
            <EmptyState
              icon={Search}
              title="No findings match"
              actions={
                <Button
                  onClick={() => {
                    setSearch('');
                    update({ q: null, env: null, kev: null, offset: null });
                  }}
                >
                  Clear filters
                </Button>
              }
            >
              Try a different search or remove a filter.
            </EmptyState>
          ) : (
            <EmptyState
              icon={ShieldCheck}
              title="No findings yet"
              actions={
                <>
                  <Button variant="primary" icon={Rocket} busy={loadSample.isPending} onClick={startSample}>
                    Load sample data
                  </Button>
                  <Button onClick={() => navigate('/import')}>Import software</Button>
                </>
              }
            >
              Import your software, and the vulnerabilities that affect it will be ranked here.
            </EmptyState>
          )
        ) : (
          <>
            <div className="table-wrap" aria-busy={findings.isFetching}>
              <table className="table" data-testid="risk-table">
                <thead>
                  <tr>
                    <th>Vulnerability</th>
                    <th>Where</th>
                    <th>Risk</th>
                    <th className="hide-sm">Exploit chance</th>
                    <th className="hide-sm">Exposure</th>
                    <th>
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {findings.data?.items.map((finding) => (
                    <Row key={finding.id} finding={finding} onOpen={onOpen} />
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={total}
              limit={PAGE_SIZE}
              offset={offset}
              onChange={(o) => update({ offset: o ? String(o) : null })}
              noun="findings"
            />
          </>
        )}
      </Card>

      <Notice>
        Risk blends severity, the calibrated chance of exploitation, how exposed the code is, how important the service
        is and whether attackers are already using it.
      </Notice>

      {open ? <FindingPanel id={open} onClose={onClose} /> : null}
    </>
  );
}
