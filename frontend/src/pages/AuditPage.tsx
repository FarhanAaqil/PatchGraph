import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PatchGraphApiClient, } from '../api/generated';
import {
  FileText,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Download,
  Search,
  
  
  User,
  ArrowRight,
  AlertCircle,
  
  
  Lock
} from 'lucide-react';

interface AuditPageProps {
  apiBaseUrl?: string;
  initialPlanId?: string;
}

export const AuditPage: React.FC<AuditPageProps> = ({ apiBaseUrl, initialPlanId }) => {
  const queryClient = useQueryClient();
  const client = new PatchGraphApiClient({ baseUrl: apiBaseUrl || '' });

  // Decision state
  const [decisionComment, setDecisionComment] = useState('');
  const [decisionSuccessMsg, setDecisionSuccessMsg] = useState<string | null>(null);
  const [decisionErrorMsg, setDecisionErrorMsg] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(initialPlanId || '');

  // Filter state for audit logs
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  // Query plans
  const { data: plansData } = useQuery({
    queryKey: ['plans'],
    queryFn: () => client.listPlans(),
  });

  // Query audit logs
  const { data: auditData, isLoading: isLoadingAudit } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => client.listAuditLogs(),
    refetchInterval: 5000,
  });

  const plans = React.useMemo(() => plansData?.items ?? [], [plansData]);
  const currentPlan = (selectedPlanId && plans.find((p) => p.id === selectedPlanId)) || (plans.length > 0 ? plans[0] : null);

  React.useEffect(() => {
    if (!selectedPlanId && plans.length > 0) {
      setSelectedPlanId(plans[0].id);
    }
  }, [plans, selectedPlanId]);

  // Mutation for deciding plan
  const decideMutation = useMutation({
    mutationFn: ({ planId, decision, reason }: { planId: string; decision: 'approved' | 'rejected'; reason: string }) =>
      client.decidePlan(planId, { decision, reason }),
    onSuccess: (data) => {
      setDecisionSuccessMsg(`Decision '${data.decision.toUpperCase()}' committed to immutable audit entry #${data.audit_log_id}`);
      setDecisionErrorMsg(null);
      setDecisionComment('');
      queryClient.invalidateQueries({ queryKey: ['auditLogs'] });
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
    onError: (err: Error) => {
      setDecisionErrorMsg(err.message || 'Failed to record decision');
      setDecisionSuccessMsg(null);
    },
  });

  const handleDecision = (decision: 'approved' | 'rejected') => {
    if (!decisionComment.trim()) {
      setDecisionErrorMsg('A human review comment/justification is required before approving or rejecting a plan.');
      return;
    }
    if (!currentPlan) return;

    decideMutation.mutate({
      planId: currentPlan.id,
      decision,
      reason: decisionComment.trim(),
    });
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const res = await fetch(`${apiBaseUrl || ''}/api/v1/audit/export?format=${format}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patchgraph_audit_log_${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export audit logs', err);
    }
  };

  const auditItems = auditData?.items || [];

  const filteredAudit = auditItems.filter((entry) => {
    const matchesSearch =
      entry.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.entity_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.actor_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || entry.action.toLowerCase().includes(actionFilter.toLowerCase());

    return matchesSearch && matchesAction;
  });

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1440px', margin: '0 auto', color: 'var(--pg-ink)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span className="pill-chip" style={{ background: 'rgba(122, 15, 224, 0.1)', color: 'var(--pg-violet)', border: '1px solid rgba(122, 15, 224, 0.25)' }}>
              <Lock size={14} style={{ marginRight: '0.35rem' }} /> Append-Only Governance Log
            </span>
            <span className="pill-chip" style={{ background: '#FFF', color: 'var(--pg-steel)', border: '1px solid #CBD5E1' }}>
              Demo data
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', letterSpacing: '-0.03em', margin: 0, fontWeight: 800 }}>
            Human Review & Immutable Audit
          </h1>
          <p style={{ color: 'var(--pg-steel)', marginTop: '0.5rem', fontSize: '1rem', maxWidth: '720px' }}>
            PatchGraph explains and recommends — it never patches code automatically.
            Every remediation plan requires human sign-off with mandatory rationale, sealed permanently into the tamper-evident audit ledger.
          </p>
        </div>

        {/* Export Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => handleExport('json')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid #CBD5E1',
              background: '#FFF',
              color: 'var(--pg-ink)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Download size={14} /> Export JSON
          </button>
          <button
            onClick={() => handleExport('csv')}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid #CBD5E1',
              background: '#FFF',
              color: 'var(--pg-ink)',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Grid: Top = Plan Review Gate, Bottom = Audit Timeline */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
        {/* Human Approval Workbench Card */}
        <div
          className="pg-card"
          style={{
            padding: '2rem 2.5rem',
            background: '#FFF',
            border: '2px solid rgba(122, 15, 224, 0.2)',
            borderRadius: 'var(--radius-frame)',
            boxShadow: '0 8px 32px rgba(122, 15, 224, 0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(122, 15, 224, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pg-violet)' }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Human Decision Gate</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--pg-steel)' }}>
                  Approve or request revisions for proposed upgrade batches
                </div>
              </div>
            </div>

            {plans.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--pg-steel)' }}>Target Plan:</span>
                <select
                  value={selectedPlanId}
                  onChange={(e) => setSelectedPlanId(e.target.value)}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.85rem',
                    background: '#FFF',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.id} ({p.status.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {currentPlan ? (
            <div>
              {/* Proposed Plan Highlights Banner */}
              <div
                style={{
                  background: 'var(--gradient-silver)',
                  border: '1px solid #CBD5E1',
                  borderRadius: 'var(--radius-card)',
                  padding: '1.25rem 1.75rem',
                  marginBottom: '1.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', textTransform: 'uppercase', fontWeight: 600 }}>
                    Proposed Upgrade Action
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.35rem' }}>
                    {((currentPlan as any).actions || []).map((act: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem' }}>
                          {act.package || act.package_name}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#DC2626' }}>v{act.from || act.current_version}</span>
                        <ArrowRight size={13} style={{ color: 'var(--pg-steel)' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#16A34A', fontWeight: 700 }}>v{act.to || act.target_version}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', textTransform: 'uppercase', fontWeight: 600 }}>Risk Removed</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--pg-violet)' }}>
                      -{currentPlan.risk_removed.toFixed(1)} pts
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', textTransform: 'uppercase', fontWeight: 600 }}>Effort</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 700 }}>
                      {((currentPlan as any).actions || []).reduce((a: number, b: any) => a + (b.hours || b.effort_hours || 0), 0).toFixed(1)}h
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', textTransform: 'uppercase', fontWeight: 600 }}>Current Status</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, textTransform: 'uppercase', color: currentPlan.approval_state === 'approved' ? '#16A34A' : 'var(--pg-violet)' }}>
                      {currentPlan.approval_state || 'PENDING REVIEW'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mandatory Reviewer Justification Textarea */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--pg-ink)', display: 'block', marginBottom: '0.5rem' }}>
                  Reviewer Justification & Maintenance Window Notes <span style={{ color: '#DC2626' }}>* (Required)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Enter required justification (e.g. Verified compatibility with staging CI suite. Approved for deployment)."
                  value={decisionComment}
                  onChange={(e) => setDecisionComment(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.85rem 1.25rem',
                    borderRadius: 'var(--radius-card)',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.9rem',
                    fontFamily: 'var(--font-body)',
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Feedback messages */}
              {decisionSuccessMsg && (
                <div style={{ padding: '1rem', background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 'var(--radius-card)', color: '#166534', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} /> {decisionSuccessMsg}
                </div>
              )}
              {decisionErrorMsg && (
                <div style={{ padding: '1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 'var(--radius-card)', color: '#991B1B', marginBottom: '1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <AlertCircle size={16} /> {decisionErrorMsg}
                </div>
              )}

              {/* Decision Action Buttons */}
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => handleDecision('rejected')}
                  disabled={decideMutation.isPending}
                  style={{
                    padding: '0.75rem 1.75rem',
                    borderRadius: 'var(--radius-pill)',
                    background: '#FFF',
                    border: '1px solid #CBD5E1',
                    color: 'var(--pg-ink)',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: decideMutation.isPending ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                  }}
                >
                  <XCircle size={16} style={{ color: '#DC2626' }} /> Send Back / Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleDecision('approved')}
                  disabled={decideMutation.isPending}
                  style={{
                    padding: '0.75rem 2rem',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--pg-violet)',
                    border: 'none',
                    color: '#FFF',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    cursor: decideMutation.isPending ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 4px 16px rgba(122, 15, 224, 0.3)',
                  }}
                >
                  <CheckCircle2 size={16} /> Approve Plan
                </button>
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--pg-steel)' }}>
              No active planning runs available for review.
            </div>
          )}
        </div>

        {/* Immutable Audit Log Timeline */}
        <div
          className="pg-card"
          style={{
            padding: '2rem 2.5rem',
            background: '#FFF',
            border: '1px solid #E2E8F0',
            borderRadius: 'var(--radius-frame)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          {/* Timeline Title & Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Immutable Audit Ledger</h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--pg-steel)' }}>
                Append-only record of all imports, vulnerability queries, solver runs, and human decisions.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--pg-steel)' }} />
                <input
                  type="text"
                  placeholder="Filter audit log..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.5rem 0.75rem 0.5rem 2.25rem',
                    borderRadius: 'var(--radius-pill)',
                    border: '1px solid #CBD5E1',
                    fontSize: '0.8rem',
                    outline: 'none',
                  }}
                />
              </div>

              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid #CBD5E1',
                  fontSize: '0.8rem',
                  background: '#FFF',
                }}
              >
                <option value="all">All Actions</option>
                <option value="decision">Plan Decisions</option>
                <option value="import">Imports (SBOM/VEX)</option>
                <option value="plan">Planning Runs</option>
              </select>
            </div>
          </div>

          {/* Timeline Table */}
          {isLoadingAudit ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--pg-steel)' }}>
              Loading verifiable audit history...
            </div>
          ) : filteredAudit.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--pg-steel)' }}>
              <FileText size={36} style={{ marginBottom: '0.5rem' }} />
              <p style={{ margin: 0 }}>No audit records match the selected filters.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: 'var(--pg-steel)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Entry #</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Timestamp</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Action</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Actor</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Target Entity</th>
                    <th style={{ padding: '0.85rem 1.5rem', fontWeight: 600 }}>Details & Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.map((log) => {
                    const isDecision = log.action.includes('DECISION');
                    const reason = (log.after_state as any)?.reason || (log.after_state as any)?.comment || null;

                    return (
                      <tr key={log.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--pg-violet)' }}>
                          #{log.id}
                        </td>
                        <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--pg-steel)' }}>
                          {log.created_at ? new Date(log.created_at).toLocaleString() : 'Recent'}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.55rem',
                              borderRadius: '4px',
                              background: isDecision ? 'rgba(122, 15, 224, 0.1)' : '#F1F5F9',
                              color: isDecision ? 'var(--pg-violet)' : 'var(--pg-ink)',
                              border: isDecision ? '1px solid rgba(122, 15, 224, 0.25)' : '1px solid #E2E8F0',
                            }}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--pg-ink)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <User size={13} style={{ color: 'var(--pg-steel)' }} />
                            <span>{log.actor_email || log.actor_id}</span>
                          </div>
                        </td>
                        <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)', color: 'var(--pg-steel)' }}>
                          {log.entity_type}:{log.entity_id}
                        </td>
                        <td style={{ padding: '1rem 1.5rem', color: 'var(--pg-ink)' }}>
                          {reason ? (
                            <div style={{ fontStyle: 'italic', color: '#166534', background: '#F0FDF4', padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid #BBF7D0' }}>
                              "{reason}"
                            </div>
                          ) : (
                            <span style={{ color: 'var(--pg-steel)', fontSize: '0.8rem' }}>
                              Action registered with request ID {log.request_id || 'n/a'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuditPage;

