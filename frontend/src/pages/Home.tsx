import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Flame,
  ListChecks,
  Rocket,
  ShieldAlert,
  UploadCloud,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../lib/errors';
import { isKnownExploited } from '../lib/explain';
import { formatNumber, humanizeAction, plural, timeAgo } from '../lib/format';
import { useAudit, useFindings, useJourney, useLoadSample } from '../lib/hooks';
import { scoreBand } from '../lib/severity';
import { Badge, Button, Card, CardHead, EmptyState, PageHead, SeverityBadge, Skeleton, Stat } from '../ui/primitives';
import { useToast } from '../ui/Toast';

const STEPS = [
  { key: 'import', path: '/import', title: 'Import', text: 'Bring in your software inventory', icon: UploadCloud },
  { key: 'risks', path: '/risks', title: 'Review risks', text: 'See what matters most and why', icon: ShieldAlert },
  { key: 'plan', path: '/plan', title: 'Make a plan', text: 'Pick fixes that fit your budget', icon: ListChecks },
  { key: 'review', path: '/review', title: 'Approve', text: 'Sign off with a recorded reason', icon: ClipboardCheck },
] as const;

function nextAction(step: ReturnType<typeof useJourney>['step']) {
  switch (step) {
    case 'import':
      return {
        title: 'Start by importing your software',
        text: 'Upload a software bill of materials (SBOM), or load the built-in sample to look around first.',
        cta: 'Import software',
        to: '/import',
      };
    case 'plan':
      return {
        title: 'Turn the risks into a plan',
        text: 'Tell PatchGraph how many hours and how much downtime you have, and it picks the fixes that remove the most risk.',
        cta: 'Make a plan',
        to: '/plan',
      };
    case 'review':
      return {
        title: 'A plan is waiting for your decision',
        text: 'Read the recommended fixes, then approve or send the plan back. Your reason is saved permanently.',
        cta: 'Review the plan',
        to: '/review',
      };
    default:
      return {
        title: 'You are all caught up',
        text: 'Every plan has a decision. Import new software or revisit the risks whenever things change.',
        cta: 'See the risks',
        to: '/risks',
      };
  }
}

export default function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const journey = useJourney();
  const top = useFindings({ limit: 3 });
  const exploited = useFindings({ kev_only: true, limit: 1 });
  const activity = useAudit({ limit: 5 });
  const loadSample = useLoadSample();

  const startSample = () =>
    loadSample.mutate(undefined, {
      onSuccess: () => toast.success('Sample data loaded. Take a look at the risks.'),
      onError: (e) => toast.error(errorMessage(e)),
    });

  const stepIndex = { import: 0, plan: 2, review: 3, done: 4 }[journey.step];
  const next = nextAction(journey.step);

  if (!journey.loading && journey.total === 0) {
    return (
      <>
        <PageHead
          title="Welcome to PatchGraph"
          lead="Software ships with thousands of vulnerabilities. PatchGraph finds the few that matter and plans the fixes your team can actually deliver."
        />
        <Card>
          <EmptyState
            icon={Rocket}
            title="Nothing here yet"
            actions={
              <>
                <Button
                  variant="primary"
                  icon={Rocket}
                  busy={loadSample.isPending}
                  onClick={startSample}
                  data-testid="load-sample"
                >
                  Load sample data
                </Button>
                <Button icon={UploadCloud} onClick={() => navigate('/import')}>
                  Import my own software
                </Button>
              </>
            }
          >
            Load the sample project to explore every screen in about a minute, or import your own software bill of
            materials.
          </EmptyState>
        </Card>
        <div className="grid grid-4" aria-label="How it works">
          {STEPS.map((step, index) => (
            <Card key={step.key}>
              <step.icon size={22} aria-hidden="true" style={{ color: 'var(--accent-text)' }} />
              <h3 style={{ marginTop: 12 }}>
                {index + 1}. {step.title}
              </h3>
              <p style={{ color: 'var(--text-2)', fontSize: '0.88rem', marginTop: 4 }}>{step.text}</p>
            </Card>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <PageHead title="Where things stand" lead="A quick read on your software risk, and the next thing worth doing." />

      <Card tint data-testid="next-step">
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}
        >
          <div style={{ maxWidth: '60ch' }}>
            <Badge tone="high">Next step</Badge>
            <h2 style={{ marginTop: 10, fontSize: '1.3rem' }}>{next.title}</h2>
            <p style={{ color: 'var(--text-2)', marginTop: 4 }}>{next.text}</p>
          </div>
          <Button variant="primary" onClick={() => navigate(next.to)}>
            {next.cta} <ArrowRight size={16} aria-hidden="true" />
          </Button>
        </div>
        <ol className="journey" aria-label="Progress">
          {STEPS.map((step, index) => {
            const state = index < stepIndex ? 'done' : index === stepIndex ? 'current' : 'todo';
            return (
              <li key={step.key} data-state={state}>
                <span className="journey-dot">
                  {state === 'done' ? <CheckCircle2 size={16} aria-hidden="true" /> : index + 1}
                </span>
                <Link to={step.path}>{step.title}</Link>
              </li>
            );
          })}
        </ol>
      </Card>

      <div className="grid grid-4">
        <Stat
          label="Open findings"
          icon={ShieldAlert}
          value={formatNumber(journey.total)}
          hint="Vulnerabilities affecting your software"
          loading={journey.loading}
        />
        <Stat
          label="Actively exploited"
          icon={Flame}
          value={formatNumber(exploited.data?.total)}
          hint="Attackers are using these today"
          loading={exploited.isLoading}
        />
        <Stat
          label="Plans waiting"
          icon={ListChecks}
          value={formatNumber(journey.pending)}
          hint="Need a human decision"
          loading={journey.loading}
        />
        <Stat
          label="Plans approved"
          icon={CheckCircle2}
          value={formatNumber(journey.approved)}
          hint="Signed off and recorded"
          loading={journey.loading}
        />
      </div>

      <div className="grid grid-main-side">
        <Card flush>
          <div style={{ padding: '20px 24px 0' }}>
            <CardHead
              title="Fix these first"
              hint="The highest-risk findings right now."
              action={<Link to="/risks">See all</Link>}
            />
          </div>
          <ul className="list">
            {top.isLoading
              ? Array.from({ length: 3 }, (_, i) => (
                  <li key={i}>
                    <Skeleton width="55%" height={18} />
                  </li>
                ))
              : (top.data?.items ?? []).map((f) => {
                  const band = scoreBand(f.final_score);
                  return (
                    <li key={f.id}>
                      <Link to={`/risks?open=${encodeURIComponent(f.id)}`} className="list-link">
                        <span>
                          <strong>{f.canonical_id}</strong>
                          <span className="cell-sub">
                            {f.package_name} {f.package_version} · {f.service_name} ({f.environment})
                          </span>
                        </span>
                        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          {isKnownExploited(f) ? <Badge tone="alert">Exploited</Badge> : null}
                          <SeverityBadge band={band.band} label={band.label} />
                        </span>
                      </Link>
                    </li>
                  );
                })}
          </ul>
        </Card>

        <Card flush>
          <div style={{ padding: '20px 24px 0' }}>
            <CardHead
              title="Recent activity"
              hint="Everything is recorded."
              action={<Link to="/review">Audit log</Link>}
            />
          </div>
          <ul className="list">
            {activity.isLoading
              ? Array.from({ length: 4 }, (_, i) => (
                  <li key={i}>
                    <Skeleton width="70%" height={16} />
                  </li>
                ))
              : (activity.data?.items ?? []).map((entry) => (
                  <li key={entry.id}>
                    <div>
                      <strong>{humanizeAction(entry.action)}</strong>
                      <span className="cell-sub">
                        {entry.actor_email ?? 'someone'} · {timeAgo(entry.created_at)}
                      </span>
                    </div>
                  </li>
                ))}
          </ul>
        </Card>
      </div>
      <p style={{ color: 'var(--text-3)', fontSize: '0.84rem' }}>
        {plural(journey.total, 'finding')} across your software · scores combine severity, exploit likelihood, how
        exposed the code is and how important the service is.
      </p>
    </>
  );
}
