import { CheckCircle2, ClipboardCheck, Download, MessageSquareWarning, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../lib/errors';
import { formatDateTime, formatNumber, humanizeAction } from '../lib/format';
import { api, useAudit, useDecidePlan, usePlans } from '../lib/hooks';
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
  Skeleton,
  TableSkeleton,
} from '../ui/primitives';
import { useToast } from '../ui/Toast';

const PAGE_SIZE = 10;
const MIN_REASON = 3;

const STATE_LABEL: Record<string, string> = {
  pending_human_approval: 'Waiting for a decision',
  approved: 'Approved',
  rejected: 'Rejected',
  needs_changes: 'Changes requested',
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function detailsOf(after: Record<string, unknown> | null | undefined): string {
  if (!after) return '';
  if (typeof after.reason === 'string') return `“${after.reason}”`;
  if (typeof after.source_name === 'string') return String(after.source_name);
  if (typeof after.findings === 'number') return `Sample data: ${after.findings} findings`;
  return '';
}

export default function Review() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const plans = usePlans();
  const decide = useDecidePlan();
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState('');
  const [exporting, setExporting] = useState<string | null>(null);
  const audit = useAudit({ action: filter || undefined, limit: PAGE_SIZE, offset });

  const items = plans.data?.items ?? [];
  const wanted = params.get('plan');
  const selected = items.find((p) => p.id === wanted) ?? items[0];

  useEffect(() => {
    if (selected && wanted !== selected.id) setParams({ plan: selected.id }, { replace: true });
  }, [selected, wanted, setParams]);

  const reasonOk = reason.trim().length >= MIN_REASON;
  const state = selected?.approval_state ?? 'pending_human_approval';

  const submit = (decision: 'approved' | 'rejected' | 'needs_changes') => {
    setTouched(true);
    if (!selected || !reasonOk) return;
    decide.mutate(
      { id: selected.id, payload: { decision, reason: reason.trim() } },
      {
        onSuccess: (res) => {
          toast.success(`Decision saved as audit entry #${res.audit_log_id}.`);
          setReason('');
          setTouched(false);
          setOffset(0);
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const exportAudit = async (format: 'json' | 'csv') => {
    setExporting(format);
    try {
      download(
        await api.exportAuditLogs(format),
        `patchgraph-audit-${new Date().toISOString().slice(0, 10)}.${format}`,
      );
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(null);
    }
  };

  return (
    <>
      <PageHead
        title="Review and approve"
        lead="PatchGraph recommends, people decide. Every decision needs a reason, and it is saved permanently in the audit log."
        actions={
          <>
            <Button icon={Download} busy={exporting === 'csv'} onClick={() => exportAudit('csv')}>
              Export CSV
            </Button>
            <Button icon={Download} busy={exporting === 'json'} onClick={() => exportAudit('json')}>
              Export JSON
            </Button>
          </>
        }
      />

      {plans.isLoading ? (
        <Card aria-busy="true" style={{ minHeight: 330 }}>
          <Skeleton width="30%" height={20} />
          <div style={{ height: 12 }} />
          <Skeleton height={220} radius={14} />
        </Card>
      ) : plans.isError ? (
        <Card>
          <ErrorState message={errorMessage(plans.error)} onRetry={() => plans.refetch()} />
        </Card>
      ) : !selected ? (
        <Card>
          <EmptyState
            icon={ClipboardCheck}
            title="No plans to review"
            actions={
              <Button variant="primary" onClick={() => navigate('/plan')}>
                Make a plan
              </Button>
            }
          >
            Create a plan first. It will appear here for a decision.
          </EmptyState>
        </Card>
      ) : (
        <Card data-testid="decision-card">
          <CardHead
            title="Decision"
            hint="Choose a plan, read it, then record your decision."
            action={
              <Badge tone={state === 'approved' ? 'done' : state === 'pending_human_approval' ? 'neutral' : 'alert'}>
                {STATE_LABEL[state] ?? state}
              </Badge>
            }
          />
          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <div className="stack">
              <div className="field">
                <label htmlFor="plan-select">Plan</label>
                <select
                  id="plan-select"
                  className="select"
                  value={selected.id}
                  onChange={(e) => setParams({ plan: e.target.value }, { replace: true })}
                >
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} · {STATE_LABEL[p.approval_state ?? 'pending_human_approval'] ?? p.approval_state}
                    </option>
                  ))}
                </select>
              </div>
              <dl className="facts">
                <div>
                  <dt>Risk removed</dt>
                  <dd>+{formatNumber(selected.risk_removed, 1)}</dd>
                </div>
                <div>
                  <dt>Solver result</dt>
                  <dd>{selected.status === 'optimal' ? 'Best possible' : selected.status}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{formatDateTime(selected.created_at)}</dd>
                </div>
              </dl>
            </div>
            <div className="stack">
              <div className="field">
                <label htmlFor="reason">Your reason (required)</label>
                <textarea
                  id="reason"
                  className="textarea"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onBlur={() => setTouched(true)}
                  aria-invalid={touched && !reasonOk}
                  aria-describedby="reason-hint"
                  placeholder="For example: Checked compatibility in staging; approved for Thursday's maintenance window."
                  data-testid="reason"
                />
                <span id="reason-hint" className="field-hint" data-error={touched && !reasonOk}>
                  {touched && !reasonOk
                    ? `Please write at least ${MIN_REASON} characters so the decision can be understood later.`
                    : 'This is stored forever and shown in the audit log.'}
                </span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <Button
                  variant="primary"
                  icon={CheckCircle2}
                  busy={decide.isPending}
                  onClick={() => submit('approved')}
                  data-testid="approve"
                >
                  Approve
                </Button>
                <Button icon={MessageSquareWarning} disabled={decide.isPending} onClick={() => submit('needs_changes')}>
                  Request changes
                </Button>
                <Button variant="danger" icon={XCircle} disabled={decide.isPending} onClick={() => submit('rejected')}>
                  Reject
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card flush>
        <div style={{ padding: '20px 24px 0' }}>
          <CardHead
            title="Audit log"
            hint="An append-only record of imports, plans and decisions. Entries cannot be edited or removed."
            action={
              <select
                className="select"
                style={{ width: 'auto' }}
                aria-label="Filter the log"
                value={filter}
                onChange={(e) => {
                  setFilter(e.target.value);
                  setOffset(0);
                }}
              >
                <option value="">Everything</option>
                <option value="plan_decision">Decisions</option>
                <option value="import">Imports</option>
                <option value="upload">Uploads</option>
              </select>
            }
          />
        </div>
        {audit.isLoading ? (
          <TableSkeleton rows={PAGE_SIZE} columns={4} />
        ) : audit.isError ? (
          <ErrorState message={errorMessage(audit.error)} onRetry={() => audit.refetch()} />
        ) : (audit.data?.items.length ?? 0) === 0 ? (
          <EmptyState icon={ClipboardCheck} title="Nothing recorded yet">
            Actions will be listed here as they happen.
          </EmptyState>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table" data-testid="audit-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>What happened</th>
                    <th className="hide-sm">Who</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.data?.items.map((entry) => (
                    <tr key={entry.id}>
                      <td className="mono">{entry.id}</td>
                      <td>
                        <span className="cell-strong">{humanizeAction(entry.action)}</span>
                        <span className="cell-sub">{detailsOf(entry.after_state) || entry.entity_type}</span>
                      </td>
                      <td className="hide-sm">{entry.actor_email ?? entry.actor_id}</td>
                      <td>{formatDateTime(entry.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={audit.data?.total ?? 0}
              limit={PAGE_SIZE}
              offset={offset}
              onChange={setOffset}
              noun="entries"
            />
          </>
        )}
      </Card>

      <Notice>
        Nothing here changes your code or systems. Approving records a decision; people carry out the upgrades.
      </Notice>
    </>
  );
}
