import { useMutation } from '@tanstack/react-query';
import { ArrowRight, Clock, ListChecks, Scale, Timer, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PlanActionItem, PlanResponse, PlanSimulateResponse } from '../api/generated';
import { errorMessage } from '../lib/errors';
import { formatNumber, plural, timeAgo } from '../lib/format';
import { api, useCreatePlan, useLatestRiskRun, usePlans } from '../lib/hooks';
import { Badge, Button, Card, CardHead, EmptyState, Notice, PageHead, Skeleton, Stat } from '../ui/primitives';
import { useToast } from '../ui/Toast';

type Objective = 'weighted_exposure' | 'greedy_risk_per_hour';

const OBJECTIVES: Array<{ value: Objective; title: string; text: string }> = [
  {
    value: 'weighted_exposure',
    title: 'Remove the most risk',
    text: 'Finds the combination of fixes that cuts the most overall risk within your limits.',
  },
  {
    value: 'greedy_risk_per_hour',
    title: 'Best return per hour',
    text: 'Favours quick wins that remove the most risk for each hour spent.',
  },
];

function totals(actions: PlanActionItem[]) {
  return {
    hours: actions.reduce((sum, a) => sum + (a.hours ?? 0), 0),
    downtime: actions.reduce((sum, a) => sum + (a.downtime_minutes ?? 0), 0),
  };
}

function ActionTable({ actions }: { actions: PlanActionItem[] }) {
  if (actions.length === 0) return <p style={{ color: 'var(--text-2)' }}>No fixes were selected.</p>;
  return (
    <div className="table-wrap">
      <table className="table" data-testid="plan-actions">
        <thead>
          <tr>
            <th>Upgrade</th>
            <th>Affects</th>
            <th className="num">Effort</th>
            <th className="num">Downtime</th>
            <th className="num">Risk removed</th>
          </tr>
        </thead>
        <tbody>
          {actions.map((action, index) => (
            <tr key={`${action.package}-${index}`}>
              <td>
                <span className="cell-strong">{action.package}</span>
                <span className="cell-sub mono">
                  {action.from} → {action.to}
                </span>
              </td>
              <td>{action.services?.join(', ') || 'all services'}</td>
              <td className="num">{formatNumber(action.hours, 1)} h</td>
              <td className="num">{formatNumber(action.downtime_minutes ?? 0)} min</td>
              <td className="num cell-strong">
                {action.risk_removed !== undefined ? `+${formatNumber(action.risk_removed, 1)}` : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Plan() {
  const navigate = useNavigate();
  const toast = useToast();
  const riskRun = useLatestRiskRun();
  const plans = usePlans();
  const createPlan = useCreatePlan();

  const [budget, setBudget] = useState(16);
  const [downtime, setDowntime] = useState(30);
  const [environments, setEnvironments] = useState<string[]>(['prod']);
  const [objective, setObjective] = useState<Objective>('weighted_exposure');
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [whatIfBudget, setWhatIfBudget] = useState(40);

  const simulate = useMutation({
    mutationFn: (): Promise<PlanSimulateResponse> =>
      api.simulatePlan((plan as PlanResponse).id, {
        budget_hours: whatIfBudget,
        max_downtime_minutes: downtime,
        environments,
        objective,
      }),
  });

  const toggleEnvironment = (env: string) =>
    setEnvironments((current) => (current.includes(env) ? current.filter((e) => e !== env) : [...current, env]));

  const run = () => {
    setProblem(null);
    simulate.reset();
    createPlan.mutate(
      {
        risk_run_id: riskRun.data?.id ?? 'rr_01',
        budget_hours: budget,
        max_downtime_minutes: downtime,
        environments,
        objective,
      },
      {
        onSuccess: (result) => {
          setPlan(result);
          toast.success(`Plan ready: ${plural(result.actions.length, 'fix', 'fixes')} selected.`);
        },
        onError: (error) => {
          const code = (error as { code?: string }).code;
          setPlan(null);
          setProblem(
            code === 'INFEASIBLE_PLAN'
              ? `No fixes fit inside ${budget} hours and ${downtime} minutes of downtime. Try a bigger budget or a longer downtime window.`
              : errorMessage(error),
          );
        },
      },
    );
  };

  if (riskRun.isError && !plan) {
    return (
      <>
        <PageHead
          title="Plan the fixes"
          lead="Tell PatchGraph how much time you have, and it picks the fixes that remove the most risk."
        />
        <Card>
          <EmptyState
            icon={ListChecks}
            title="Import software first"
            actions={
              <Button variant="primary" onClick={() => navigate('/import')}>
                Import software
              </Button>
            }
          >
            There is nothing to plan until your software has been scored. Load the sample project or import your own.
          </EmptyState>
        </Card>
      </>
    );
  }

  const sums = plan ? totals(plan.actions) : null;
  const previous = (plans.data?.items ?? []).filter((p) => p.id !== plan?.id).slice(0, 5);

  return (
    <>
      <PageHead
        title="Plan the fixes"
        lead="Tell PatchGraph how much time you have. It picks the combination of upgrades that removes the most risk, and shows its reasoning."
      />

      <div className="grid grid-main-side plan-layout">
        <Card>
          <CardHead title="Your limits" hint="The plan will never go beyond these." />
          <div className="stack">
            <div className="field">
              <label htmlFor="budget">
                Engineering time: <strong>{budget} hours</strong>
              </label>
              <input
                id="budget"
                className="range"
                type="range"
                min={2}
                max={60}
                step={1}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                data-testid="budget"
              />
              <div className="range-row">
                <span>2 h (quick patch)</span>
                <span>60 h (a sprint)</span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="downtime">
                Allowed downtime: <strong>{downtime} minutes</strong>
              </label>
              <input
                id="downtime"
                className="range"
                type="range"
                min={0}
                max={90}
                step={5}
                value={downtime}
                onChange={(e) => setDowntime(Number(e.target.value))}
                data-testid="downtime"
              />
              <div className="range-row">
                <span>0 (no downtime)</span>
                <span>90 min</span>
              </div>
            </div>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="field-label">Where to apply fixes</legend>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  ['prod', 'Production'],
                  ['staging', 'Staging'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="chip-toggle"
                    aria-pressed={environments.includes(value)}
                    onClick={() => toggleEnvironment(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="field-label">What matters most</legend>
              <div className="stack" style={{ gap: 8 }}>
                {OBJECTIVES.map((o) => (
                  <label key={o.value} className="choice" data-checked={objective === o.value}>
                    <input
                      type="radio"
                      name="objective"
                      checked={objective === o.value}
                      onChange={() => setObjective(o.value)}
                    />
                    <span>
                      <strong>{o.title}</strong>
                      <span className="cell-sub">{o.text}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button
              variant="primary"
              block
              busy={createPlan.isPending}
              disabled={environments.length === 0 || riskRun.isLoading}
              onClick={run}
              data-testid="create-plan"
            >
              Create plan
            </Button>
            {environments.length === 0 ? <span className="field-hint">Pick at least one environment.</span> : null}
          </div>
        </Card>

        <div className="stack">
          {problem ? <Notice tone="alert">{problem}</Notice> : null}

          {createPlan.isPending ? (
            <Card aria-busy="true">
              <Skeleton width="40%" height={22} />
              <div style={{ height: 14 }} />
              <Skeleton height={120} radius={14} />
            </Card>
          ) : plan ? (
            <>
              <Card data-testid="plan-result">
                <CardHead
                  title="Recommended plan"
                  hint={`Plan ${plan.id} · found in ${formatNumber(plan.runtime_ms ?? 0)} ms`}
                  action={
                    <Badge tone={plan.status === 'optimal' ? 'done' : 'medium'}>
                      {plan.status === 'optimal' ? 'Best possible' : plan.status}
                    </Badge>
                  }
                />
                <div className="grid grid-4" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <Stat
                    label="Risk removed"
                    icon={TrendingDown}
                    value={`+${formatNumber(plan.risk_removed, 1)}`}
                    hint="Weighted exposure points"
                  />
                  <Stat
                    label="Effort"
                    icon={Clock}
                    value={`${formatNumber(sums?.hours, 1)} h`}
                    hint={`of ${budget} h available`}
                  />
                  <Stat
                    label="Downtime"
                    icon={Timer}
                    value={`${formatNumber(sums?.downtime)} min`}
                    hint={`of ${downtime} min allowed`}
                  />
                  <Stat
                    label="Fixes"
                    icon={ListChecks}
                    value={formatNumber(plan.actions.length)}
                    hint="Upgrades selected"
                  />
                </div>
              </Card>

              <Card flush>
                <div style={{ padding: '20px 24px 0' }}>
                  <CardHead title="What to do" hint="Do these upgrades, in this order." />
                </div>
                <ActionTable actions={plan.actions} />
                <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="primary"
                    onClick={() => navigate(`/review?plan=${encodeURIComponent(plan.id)}`)}
                    data-testid="send-to-review"
                  >
                    Send for review <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                </div>
              </Card>

              {plan.rejected_actions?.length || plan.binding_constraints?.length ? (
                <Card>
                  <details className="advanced" open>
                    <summary>Why not more?</summary>
                    {plan.binding_constraints?.length ? (
                      <p style={{ marginTop: 10 }}>
                        Limits that held the plan back: <strong>{plan.binding_constraints.join(', ')}</strong>.
                      </p>
                    ) : null}
                    {plan.rejected_actions?.map((a, i) => (
                      <p key={i} style={{ marginTop: 8, color: 'var(--text-2)' }}>
                        <strong>
                          {a.package} {a.from} → {a.to}
                        </strong>{' '}
                        was left out:{' '}
                        {String(
                          (a.rationale as { rejected_reason?: string } | undefined)?.rejected_reason ??
                            'it does not fit your limits',
                        )}
                      </p>
                    ))}
                  </details>
                </Card>
              ) : null}

              <Card>
                <CardHead
                  title="What if you had more time?"
                  hint="Compare this plan against a bigger budget without committing to anything."
                />
                <div className="field">
                  <label htmlFor="whatif">
                    Compare with <strong>{whatIfBudget} hours</strong>
                  </label>
                  <input
                    id="whatif"
                    className="range"
                    type="range"
                    min={4}
                    max={80}
                    step={2}
                    value={whatIfBudget}
                    onChange={(e) => setWhatIfBudget(Number(e.target.value))}
                  />
                </div>
                <div style={{ marginTop: 12 }}>
                  <Button
                    icon={Scale}
                    busy={simulate.isPending}
                    onClick={() => simulate.mutate()}
                    data-testid="compare-plans"
                  >
                    Compare plans
                  </Button>
                </div>
                {simulate.isError ? <p style={{ marginTop: 10 }}>{errorMessage(simulate.error)}</p> : null}
                {simulate.data ? (
                  <div className="compare" data-testid="comparison">
                    <div>
                      <Badge>Your plan · {budget} h</Badge>
                      <p className="score" style={{ fontSize: '1.6rem', marginTop: 8 }}>
                        +{formatNumber(simulate.data.baseline_plan.risk_removed, 1)}
                      </p>
                      <span className="cell-sub">
                        {plural(simulate.data.baseline_plan.actions.length, 'fix', 'fixes')}
                      </span>
                    </div>
                    <div>
                      <Badge tone="high">Bigger budget · {whatIfBudget} h</Badge>
                      <p className="score" style={{ fontSize: '1.6rem', marginTop: 8 }}>
                        +{formatNumber(simulate.data.simulated_plan.risk_removed, 1)}
                      </p>
                      <span className="cell-sub">
                        {plural(simulate.data.simulated_plan.actions.length, 'fix', 'fixes')}
                      </span>
                    </div>
                    <p style={{ gridColumn: '1 / -1', color: 'var(--text-2)' }}>
                      {simulate.data.deltas.risk_removed_delta > 0
                        ? `More time would remove ${formatNumber(simulate.data.deltas.risk_removed_delta, 1)} more risk points.`
                        : 'More time would not remove any additional risk: your plan already covers everything worthwhile.'}
                    </p>
                  </div>
                ) : null}
              </Card>
            </>
          ) : (
            <Card>
              <EmptyState icon={ListChecks} title="No plan yet">
                Set your limits and choose <strong>Create plan</strong>. You will see exactly which upgrades to do, how
                long they take and why.
              </EmptyState>
            </Card>
          )}

          {previous.length ? (
            <Card flush>
              <div style={{ padding: '20px 24px 0' }}>
                <CardHead title="Earlier plans" hint="Open one in Review to see its decision." />
              </div>
              <ul className="list">
                {previous.map((p) => (
                  <li key={p.id}>
                    <Link to={`/review?plan=${encodeURIComponent(p.id)}`} className="list-link">
                      <span>
                        <strong>{p.id}</strong>
                        <span className="cell-sub">{timeAgo(p.created_at)}</span>
                      </span>
                      <Badge tone={p.approval_state === 'approved' ? 'done' : 'neutral'}>
                        {String(p.approval_state ?? 'pending').replace(/_/g, ' ')}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
