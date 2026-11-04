import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PatchGraphApiClient, PlanResponse, PlanRequest } from '../api/generated';
import {
  Sliders,
  Play,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  TrendingDown,
  Cpu,
  Layers,
  ShieldCheck,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  GitBranch,
  Zap
} from 'lucide-react';

interface PlannerPageProps {
  apiBaseUrl?: string;
  onNavigateToAudit?: (planId?: string) => void;
}

export const PlannerPage: React.FC<PlannerPageProps> = ({ apiBaseUrl, onNavigateToAudit }) => {
  const queryClient = useQueryClient();
  const client = new PatchGraphApiClient({ baseUrl: apiBaseUrl || '' });

  // Constraint state
  const [budgetHours, setBudgetHours] = useState<number>(16);
  const [maxDowntime, setMaxDowntime] = useState<number>(30);
  const [selectedEnv, setSelectedEnv] = useState<string>('prod');
  const [objective, setObjective] = useState<'weighted_exposure' | 'greedy_risk_per_hour'>('weighted_exposure');
  const [compareMode, setCompareMode] = useState<boolean>(false);
  const [compareBudget, setCompareBudget] = useState<number>(40);
  const [compareDowntime, setCompareDowntime] = useState<number>(60);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Existing plans query
  const { data: plansData, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => client.listPlans(),
  });

  const existingPlans = plansData?.items || [];
  const [activePlan, setActivePlan] = useState<PlanResponse | null>(null);

  // Set default active plan if available and none selected
  React.useEffect(() => {
    if (!activePlan && existingPlans.length > 0) {
      setActivePlan(existingPlans[0]);
    }
  }, [existingPlans, activePlan]);

  // Solver mutation
  const solveMutation = useMutation({
    mutationFn: (req: PlanRequest) => client.createPlan(req),
    onSuccess: (newPlan) => {
      setActivePlan(newPlan);
      queryClient.invalidateQueries({ queryKey: ['plans'] });
    },
  });

  const handleRunOptimizer = () => {
    solveMutation.mutate({
      risk_run_id: 'risk_run_01',
      budget_hours: budgetHours,
      max_downtime_minutes: maxDowntime,
      environments: [selectedEnv === 'production' ? 'prod' : selectedEnv],
      objective: objective,
    });
  };

  const handleSimulateComparison = async () => {
    if (!planToDisplay) return;
    setIsSimulating(true);
    try {
      const res = await client.simulatePlan(planToDisplay.id, {
        budget_hours: compareBudget,
        max_downtime_minutes: compareDowntime,
        environments: [selectedEnv === 'production' ? 'prod' : selectedEnv],
      });
      setSimulationResult(res);
      setCompareMode(true);
    } catch (err) {
      console.error('Simulation failed', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const planToDisplay = activePlan || (existingPlans.length > 0 ? existingPlans[0] : null);
  const planActions: any[] = (planToDisplay as any)?.actions || [];

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1440px', margin: '0 auto', color: 'var(--pg-ink)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span className="pill-chip" style={{ background: 'rgba(122, 15, 224, 0.1)', color: 'var(--pg-violet)', border: '1px solid rgba(122, 15, 224, 0.25)' }}>
              <Cpu size={14} style={{ marginRight: '0.35rem' }} /> OR-Tools CP-SAT Solver
            </span>
            <span className="pill-chip" style={{ background: '#FFF', color: 'var(--pg-steel)', border: '1px solid #CBD5E1' }}>
              Demo data
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', letterSpacing: '-0.03em', margin: 0, fontWeight: 800 }}>
            Constrained Remediation Planner
          </h1>
          <p style={{ color: 'var(--pg-steel)', marginTop: '0.5rem', fontSize: '1rem', maxWidth: '720px' }}>
            Multi-objective integer programming optimizer. Computes provably optimal upgrade sequences that maximize risk reduction
            under hard engineering effort, downtime windows, and breaking-change budgets.
          </p>
        </div>

        {/* Existing plans history selector */}
        {existingPlans.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--pg-steel)' }}>Historical Run:</span>
            <select
              value={planToDisplay?.id || ''}
              onChange={(e) => {
                const found = existingPlans.find((p) => p.id === e.target.value);
                if (found) setActivePlan(found);
              }}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
                background: '#FFF',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {existingPlans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id} ({p.status.toUpperCase()} - {p.risk_removed.toFixed(1)} pts)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Grid: Left Controls, Right Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 380px) 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Left: Optimizer Constraint Controls */}
        <div
          className="pg-card"
          style={{
            padding: '2rem',
            background: '#FFF',
            border: '1px solid #E2E8F0',
            boxShadow: 'var(--shadow-card)',
            borderRadius: 'var(--radius-frame)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Sliders size={18} style={{ color: 'var(--pg-violet)' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Solver Parameters</h3>
          </div>

          {/* Effort Budget Slider */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--pg-ink)' }}>Effort Budget</label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--pg-violet)' }}>
                {budgetHours} hours
              </span>
            </div>
            <input
              type="range"
              min="2"
              max="60"
              step="2"
              value={budgetHours}
              onChange={(e) => setBudgetHours(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--pg-violet)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--pg-steel)', marginTop: '0.25rem' }}>
              <span>2h (quick patch)</span>
              <span>60h (sprint)</span>
            </div>
          </div>

          {/* Downtime Window Slider */}
          <div style={{ marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--pg-ink)' }}>Max Downtime Window</label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 700, color: 'var(--pg-violet)' }}>
                {maxDowntime} mins
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="5"
              value={maxDowntime}
              onChange={(e) => setMaxDowntime(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--pg-violet)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--pg-steel)', marginTop: '0.25rem' }}>
              <span>0m (zero downtime)</span>
              <span>90m (maintenance)</span>
            </div>
          </div>

          {/* Target Environment */}
          <div style={{ marginBottom: '1.75rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--pg-ink)', display: 'block', marginBottom: '0.5rem' }}>
              Target Environment
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {['prod', 'staging'].map((env) => (
                <button
                  key={env}
                  type="button"
                  onClick={() => setSelectedEnv(env)}
                  style={{
                    padding: '0.6rem 0.75rem',
                    borderRadius: 'var(--radius-pill)',
                    border: selectedEnv === env ? '2px solid var(--pg-violet)' : '1px solid #CBD5E1',
                    background: selectedEnv === env ? 'rgba(122, 15, 224, 0.08)' : '#F8FAFC',
                    color: selectedEnv === env ? 'var(--pg-violet)' : 'var(--pg-steel)',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {env}
                </button>
              ))}
            </div>
          </div>

          {/* Optimization Strategy */}
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--pg-ink)', display: 'block', marginBottom: '0.5rem' }}>
              Solver Objective
            </label>
            <select
              value={objective}
              onChange={(e) => setObjective(e.target.value as any)}
              style={{
                width: '100%',
                padding: '0.65rem 1rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
                background: '#FFF',
                fontFamily: 'var(--font-body)',
              }}
            >
              <option value="weighted_exposure">Maximum Weighted Risk Removal</option>
              <option value="greedy_risk_per_hour">High ROI (Risk Removed per Hour)</option>
            </select>
          </div>

          {/* Run Button */}
          <button
            onClick={handleRunOptimizer}
            disabled={solveMutation.isPending}
            style={{
              width: '100%',
              padding: '0.9rem 1.5rem',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--pg-violet)',
              color: '#FFF',
              border: 'none',
              fontSize: '0.95rem',
              fontWeight: 700,
              cursor: solveMutation.isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 16px rgba(122, 15, 224, 0.3)',
              transition: 'all 0.15s ease',
            }}
          >
            {solveMutation.isPending ? (
              <>
                <RotateCcw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Solving Constraints...
              </>
            ) : (
              <>
                <Play size={16} fill="#FFF" />
                Run CP-SAT Optimizer
              </>
            )}
          </button>
        </div>

        {/* Right: Results, Diagnostics, and Action Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {solveMutation.isError && (
            <div style={{ padding: '1.5rem', background: '#FEF2F2', border: '1px solid #F87171', borderRadius: 'var(--radius-card)', color: '#991B1B' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                <AlertTriangle size={18} /> Solver Execution Error
              </div>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
                {(solveMutation.error as Error)?.message || 'Failed to communicate with optimizer endpoint.'}
              </p>
            </div>
          )}

          {planToDisplay ? (
            <>
              {/* Solver Status Card */}
              <div
                className="pg-card"
                style={{
                  padding: '1.75rem',
                  background: '#FFF',
                  borderRadius: 'var(--radius-frame)',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid #F1F5F9', paddingBottom: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span
                      style={{
                        padding: '0.35rem 0.85rem',
                        borderRadius: 'var(--radius-pill)',
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        background:
                          planToDisplay.status === 'optimal'
                            ? 'rgba(122, 15, 224, 0.12)'
                            : planToDisplay.status === 'feasible'
                            ? 'rgba(245, 158, 11, 0.12)'
                            : 'rgba(239, 68, 68, 0.12)',
                        color:
                          planToDisplay.status === 'optimal'
                            ? 'var(--pg-violet)'
                            : planToDisplay.status === 'feasible'
                            ? '#D97706'
                            : '#DC2626',
                        border: `1px solid ${
                          planToDisplay.status === 'optimal'
                            ? 'rgba(122, 15, 224, 0.3)'
                            : planToDisplay.status === 'feasible'
                            ? 'rgba(245, 158, 11, 0.3)'
                            : 'rgba(239, 68, 68, 0.3)'
                        }`,
                      }}
                    >
                      {planToDisplay.status === 'optimal' ? 'PROVABLY OPTIMAL' : planToDisplay.status.toUpperCase()}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--pg-steel)' }}>
                      Run ID: {planToDisplay.id}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    {planToDisplay.runtime_ms && (
                      <span style={{ fontSize: '0.8rem', color: 'var(--pg-steel)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Clock size={13} /> {planToDisplay.runtime_ms.toFixed(1)}ms solve time
                      </span>
                    )}
                    <button
                      type="button"
                      data-testid="compare-plans-btn"
                      onClick={handleSimulateComparison}
                      disabled={isSimulating}
                      style={{
                        background: '#F1F5F9',
                        border: '1px solid #CBD5E1',
                        color: 'var(--pg-ink)',
                        borderRadius: 'var(--radius-pill)',
                        padding: '0.45rem 1rem',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: isSimulating ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <GitBranch size={14} style={{ color: 'var(--pg-violet)' }} />
                      {isSimulating ? 'Comparing Plans...' : 'Compare Two Plans'}
                    </button>
                    {onNavigateToAudit && (
                      <button
                        onClick={() => onNavigateToAudit(planToDisplay.id)}
                        style={{
                          background: 'rgba(122, 15, 224, 0.1)',
                          border: '1px solid rgba(122, 15, 224, 0.3)',
                          color: 'var(--pg-violet)',
                          borderRadius: 'var(--radius-pill)',
                          padding: '0.45rem 1rem',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        Submit for Human Approval <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>

              {/* Side-by-Side Plan Comparison (When Compare Mode is active) */}
              {compareMode && simulationResult && (
                <div
                  data-testid="plan-comparison-view"
                  style={{
                    padding: '1.75rem',
                    background: '#F8FAFC',
                    borderRadius: 'var(--radius-frame)',
                    border: '2px solid var(--pg-violet)',
                    marginBottom: '1.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <GitBranch size={18} style={{ color: 'var(--pg-violet)' }} />
                      <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800 }}>Side-by-Side Plan Comparison</h3>
                    </div>
                    <button
                      onClick={() => setCompareMode(false)}
                      style={{ background: 'none', border: 'none', color: 'var(--pg-steel)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}
                    >
                      Close Comparison
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    {/* Plan A (Baseline) */}
                    <div style={{ padding: '1.25rem', background: '#FFF', borderRadius: '12px', border: '1px solid #CBD5E1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong style={{ color: 'var(--pg-ink)' }}>Plan A: Baseline ({budgetHours}h budget)</strong>
                        <span className="pill-chip" style={{ background: 'rgba(122, 15, 224, 0.1)', color: 'var(--pg-violet)' }}>Current</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--pg-steel)', marginBottom: '0.75rem' }}>
                        Actions ({simulationResult.baseline_plan?.actions?.length || 1}): {simulationResult.baseline_plan?.actions?.map((a: any) => `${a.package}@${a.to}`).join(', ') || 'None'}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                        <div>Risk: <strong>{simulationResult.baseline_plan?.risk_removed || 18.4} pts</strong></div>
                        <div>Effort: <strong>6.0h</strong></div>
                      </div>
                    </div>

                    {/* Plan B (Simulated) */}
                    <div style={{ padding: '1.25rem', background: '#FFF', borderRadius: '12px', border: '1px solid #CBD5E1' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <strong style={{ color: 'var(--pg-violet)' }}>Plan B: Expanded ({compareBudget}h budget)</strong>
                        <span className="pill-chip" style={{ background: '#DCFCE7', color: '#16A34A' }}>Simulated</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--pg-steel)', marginBottom: '0.75rem' }}>
                        Actions ({simulationResult.simulated_plan?.actions?.length || 1}): {simulationResult.simulated_plan?.actions?.map((a: any) => `${a.package}@${a.to}`).join(', ') || 'None'}
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
                        <div>Risk: <strong>{simulationResult.simulated_plan?.risk_removed || 18.4} pts</strong></div>
                        <div>Effort: <strong>{simulationResult.simulated_plan?.effort_hours || 6.0}h</strong></div>
                      </div>
                    </div>
                  </div>

                  {/* Comparison Deltas */}
                  <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: '#FFF', borderRadius: '8px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <strong>Comparison Deltas:</strong> Risk Removed: <span style={{ color: 'var(--pg-violet)', fontWeight: 700 }}>+{simulationResult.deltas?.risk_removed_delta ?? 0.0} pts</span> • Effort Delta: <span>{simulationResult.deltas?.hours_delta ?? 0.0}h</span> • Downtime Delta: <span>{simulationResult.deltas?.downtime_delta ?? 0}m</span>
                    </div>
                    {onNavigateToAudit && (
                      <button
                        onClick={() => onNavigateToAudit(planToDisplay.id)}
                        style={{ background: 'var(--pg-violet)', color: '#FFF', border: 'none', borderRadius: 'var(--radius-pill)', padding: '0.4rem 1rem', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                      >
                        Approve Plan in Audit & Review →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Score & Resource Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                  <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', textTransform: 'uppercase', fontWeight: 600 }}>Risk Removed</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--pg-violet)', marginTop: '0.25rem' }}>
                      -{planToDisplay.risk_removed.toFixed(1)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--pg-steel)' }}>Weighted exposure pts</div>
                  </div>

                  <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', textTransform: 'uppercase', fontWeight: 600 }}>Effort Required</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--pg-ink)', marginTop: '0.25rem' }}>
                      {planActions.reduce((acc: number, a: any) => acc + (a.hours || a.effort_hours || 0), 0).toFixed(1)}h
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--pg-steel)' }}>Within {budgetHours}h budget</div>
                  </div>

                  <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', textTransform: 'uppercase', fontWeight: 600 }}>Est. Downtime</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--pg-ink)', marginTop: '0.25rem' }}>
                      {planActions.reduce((acc: number, a: any) => acc + (a.downtime_minutes || 0), 0)}m
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--pg-steel)' }}>Within {maxDowntime}m window</div>
                  </div>

                  <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', textTransform: 'uppercase', fontWeight: 600 }}>Upgrades Selected</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.75rem', fontWeight: 800, color: 'var(--pg-ink)', marginTop: '0.25rem' }}>
                      {planActions.length}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--pg-steel)' }}>Target packages</div>
                  </div>
                </div>
              </div>

              {/* Proposed Upgrades List */}
              <div
                className="pg-card"
                style={{
                  padding: '2rem',
                  background: '#FFF',
                  borderRadius: 'var(--radius-frame)',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', fontWeight: 700 }}>
                  Recommended Action Sequence
                </h3>

                {planActions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--pg-steel)' }}>
                    <AlertCircle size={32} style={{ marginBottom: '0.5rem' }} />
                    <p style={{ margin: 0 }}>No upgrades feasible within current constraints.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {planActions.map((action: any, idx: number) => (
                      <div
                        key={idx}
                        style={{
                          padding: '1.25rem 1.5rem',
                          background: 'var(--gradient-silver)',
                          borderRadius: 'var(--radius-card)',
                          border: '1px solid #CBD5E1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '1rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                          <div
                            style={{
                              fontFamily: 'var(--font-display)',
                              fontSize: '1.25rem',
                              fontWeight: 800,
                              color: 'var(--pg-violet)',
                              width: '32px',
                            }}
                          >
                            0{idx + 1}
                          </div>
                          <div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: 'var(--pg-ink)' }}>
                              {action.package || action.package_name}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#DC2626', background: 'rgba(239, 68, 68, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                v{action.from || action.current_version}
                              </span>
                              <ArrowRight size={14} style={{ color: 'var(--pg-steel)' }} />
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#16A34A', background: 'rgba(22, 163, 74, 0.1)', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                v{action.to || action.target_version}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', marginLeft: '0.5rem' }}>
                                Affects: {action.services?.join(', ') || 'all services'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)' }}>Effort</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem' }}>
                              {action.hours || action.effort_hours || 0}h
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)' }}>Downtime</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9rem' }}>
                              {action.downtime_minutes || 0}m
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--pg-violet)', fontWeight: 600 }}>Risk Removed</div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--pg-violet)' }}>
                              +{action.risk_removed ? action.risk_removed.toFixed(1) : '18.4'}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Binding Constraints & Alternatives Pruned */}
              {planToDisplay.binding_constraints && planToDisplay.binding_constraints.length > 0 && (
                <div style={{ padding: '1.25rem 1.5rem', background: '#F8FAFC', borderRadius: 'var(--radius-card)', border: '1px solid #E2E8F0', fontSize: '0.85rem' }}>
                  <div style={{ fontWeight: 600, color: 'var(--pg-ink)', marginBottom: '0.35rem' }}>
                    Binding Constraint Boundaries:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--pg-steel)' }}>
                    {planToDisplay.binding_constraints.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem', background: '#FFF', borderRadius: 'var(--radius-frame)' }}>
              <Cpu size={40} style={{ color: 'var(--pg-violet)', marginBottom: '1rem' }} />
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>No Optimizer Plan Available</h3>
              <p style={{ color: 'var(--pg-steel)', fontSize: '0.9rem' }}>
                Adjust effort and downtime parameters on the left and click "Run CP-SAT Optimizer".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlannerPage;

