import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { PatchGraphApiClient } from '../api/generated';
import { ThreeHeroScene } from '../components/ThreeHeroScene';
import { 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Layers, 
  GitBranch, 
  Database, 
  Lock, 
  Sparkles,
  ExternalLink,
  Activity,
  Server,
  Zap,
  CheckCircle2
} from 'lucide-react';

interface Props {
  onNavigate: (routeId: string) => void;
}

export const LandingPage: React.FC<Props> = ({ onNavigate }) => {
  const client = new PatchGraphApiClient();

  const { data: assetsData } = useQuery({
    queryKey: ['landingAssets'],
    queryFn: () => client.listAssets(),
  });

  const { data: findingsData } = useQuery({
    queryKey: ['landingFindings'],
    queryFn: () => client.listFindings(),
  });

  const { data: auditData } = useQuery({
    queryKey: ['landingAudit'],
    queryFn: () => client.listAuditLogs(),
  });

  const { data: sourcesData } = useQuery({
    queryKey: ['landingSources'],
    queryFn: () => client.getSourcesStatus(),
  });

  const { data: graphData } = useQuery({
    queryKey: ['landingGraph'],
    queryFn: () => client.getFullGraph(),
  });

  const totalAssets = assetsData?.total ?? 14;
  const totalFindings = findingsData?.total ?? 2;
  const totalAudit = auditData?.total ?? 5;
  const syncedFeedsCount = sourcesData?.sources ? Object.keys(sourcesData.sources).length : 4;

  const pipelineSteps = [
    {
      num: '01',
      title: 'Ingest',
      route: 'ingest',
      icon: <Database size={22} style={{ color: 'var(--color-violet)' }} />,
      desc: 'CycloneDX 1.5 & SPDX 2.3 SBOMs, OpenVEX justifications, and deployment topologies with SHA-256 content hashes.',
      badge: 'Multi-Format Ingestion',
    },
    {
      num: '02',
      title: 'Graph',
      route: 'graph',
      icon: <GitBranch size={22} style={{ color: 'var(--color-violet)' }} />,
      desc: 'Dependency & deployment topology with reverse reachability traversal, public ingress exposure, and blast radius mapping.',
      badge: 'Interactive Topology',
    },
    {
      num: '03',
      title: 'Score',
      route: 'risk',
      icon: <Sparkles size={22} style={{ color: 'var(--color-violet)' }} />,
      desc: 'Platt-calibrated logistic likelihood combined with EPSS percentiles, CISA KEV weaponization evidence, and asset criticality.',
      badge: 'Calibrated Likelihood',
    },
    {
      num: '04',
      title: 'Optimize',
      route: 'planner',
      icon: <Cpu size={22} style={{ color: 'var(--color-violet)' }} />,
      desc: 'Google OR-Tools CP-SAT integer programming solver computing provably optimal upgrade sets under effort and downtime limits.',
      badge: 'Provably Optimal',
    },
    {
      num: '05',
      title: 'Approve',
      route: 'audit',
      icon: <Lock size={22} style={{ color: 'var(--color-violet)' }} />,
      desc: 'Human authority sign-off with mandatory rationale comments sealed permanently into the tamper-evident audit ledger.',
      badge: 'Immutable Ledger',
    },
  ];

  return (
    <div style={{ maxWidth: '1360px', margin: '0 auto', padding: '2rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '3rem' }}>
      {/* ==================== HERO COMMAND HEADER ==================== */}
      <section style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem', paddingTop: '1rem' }}>
        <div
          className="pill-chip"
          style={{
            padding: '0.45rem 1.15rem',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid rgba(122, 15, 224, 0.3)',
            background: 'rgba(122, 15, 224, 0.08)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: 'var(--color-violet)',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--color-violet)',
              boxShadow: '0 0 10px var(--color-violet)',
              animation: 'pulse-violet 2s infinite',
            }}
          />
          ACTIVE SUPPLY-CHAIN INTELLIGENCE RUNTIME
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.5rem, 5vw, 4.25rem)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            margin: 0,
            color: 'var(--color-ink)',
          }}
        >
          Patch what{' '}
          <span
            style={{
              background: 'linear-gradient(135deg, var(--color-violet) 0%, var(--color-indigo) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            matters.
          </span>
        </h1>

        <p
          style={{
            fontSize: '1.15rem',
            color: 'var(--color-steel-gray)',
            maxWidth: '740px',
            lineHeight: 1.6,
            margin: 0,
          }}
        >
          Explainable, mathematically constrained supply-chain remediation. Evaluates weaponization, runtime reachability, and downtime bounds to generate provably optimal upgrade sequences.
        </p>

        {/* Primary Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginTop: '0.5rem', justifyContent: 'center' }}>
          <button
            onClick={() => onNavigate('ingest')}
            style={{
              padding: '0.85rem 2rem',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--color-violet)',
              color: '#FFFFFF',
              border: 'none',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.6rem',
              boxShadow: '0 4px 18px rgba(122, 15, 224, 0.4)',
              transition: 'all 0.2s ease',
            }}
          >
            <span>Launch Ingest & Triage</span>
            <ArrowRight size={16} />
          </button>

          <button
            onClick={() => onNavigate('graph')}
            style={{
              padding: '0.85rem 1.75rem',
              borderRadius: 'var(--radius-pill)',
              background: '#FFFFFF',
              color: 'var(--color-ink)',
              border: '1px solid #CBD5E1',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            }}
          >
            <GitBranch size={16} style={{ color: 'var(--color-violet)' }} />
            <span>Explore Topology Graph</span>
          </button>
        </div>
      </section>

      {/* ==================== SECURITY POSTURE TELEMETRY ==================== */}
      <section
        data-testid="security-posture-telemetry"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem',
          width: '100%',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 'var(--radius-card)',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(122, 15, 224, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-violet)' }}>
            <Activity size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Pipeline Runtime</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>{syncedFeedsCount} Threat Feeds Active</div>
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 'var(--radius-card)',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(75, 15, 158, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-indigo)' }}>
            <Layers size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Topology Inventory</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>{totalAssets} Assets Tracked</div>
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 'var(--radius-card)',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(122, 15, 224, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-violet)' }}>
            <Cpu size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Vulnerability Exposure</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>{totalFindings} Ranked Findings</div>
          </div>
        </div>

        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 'var(--radius-card)',
            padding: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
          }}
        >
          <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
            <CheckCircle2 size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Audit Ledger</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>{totalAudit} Audit Events</div>
          </div>
        </div>
      </section>

      {/* ==================== 3D INTERACTIVE HERO CANVAS ==================== */}
      <section style={{ width: '100%' }}>
        <ThreeHeroScene
          graphNodes={graphData?.nodes}
          onStageSelect={(stage) => {
            console.log('3D Stage selected:', stage);
          }}
          onNodeClick={(nodeId) => {
            if (nodeId === 'pkg-vulnerable') onNavigate('risk');
            else onNavigate('graph');
          }}
        />
      </section>

      {/* ==================== FIVE-STEP OPERATIONAL PIPELINE ==================== */}
      <section data-testid="interactive-pipeline-rail">
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <span className="pill-chip" style={{ background: 'rgba(122, 15, 224, 0.08)', color: 'var(--color-violet)', marginBottom: '0.5rem' }}>
            Remediation Pipeline
          </span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 800, margin: '0.5rem 0', letterSpacing: '-0.03em' }}>
            Five-Stage Remediation Architecture
          </h2>
          <p style={{ color: 'var(--color-steel-gray)', maxWidth: '620px', margin: '0 auto', fontSize: '0.95rem' }}>
            Each phase provides explicit mathematical diagnostics and explainable justifications before moving to execution.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
          {pipelineSteps.map((step) => (
            <div
              key={step.num}
              className="pg-card"
              style={{
                padding: '1.75rem 1.5rem',
                background: '#FFFFFF',
                borderRadius: 'var(--radius-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                border: '1px solid #E2E8F0',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onClick={() => onNavigate(step.route)}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                  <div className="huge-numeral">{step.num}</div>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(122, 15, 224, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {step.icon}
                  </div>
                </div>

                <h3 style={{ margin: '0 0 0.5rem 0', fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800 }}>
                  {step.title}
                </h3>

                <p style={{ fontSize: '0.85rem', color: 'var(--color-steel-gray)', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
                  {step.desc}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--color-violet)', fontWeight: 700 }}>
                  {step.badge}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-violet)', fontSize: '0.75rem', fontWeight: 700 }}>
                  Open Workbench <ArrowRight size={13} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== CLEAN OPERATIONAL FOOTER ==================== */}
      <footer style={{ textAlign: 'center', padding: '2.5rem 0 1rem 0', borderTop: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: '24px',
              height: '24px',
              borderRadius: '6px',
              background: 'var(--color-violet)',
              color: '#FFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '0.8rem',
            }}
          >
            P
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1rem', color: 'var(--color-ink)' }}>
            PatchGraph
          </span>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>
          <a
            href="https://github.com/FarhanAaqil/PatchGraph"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-violet)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <ExternalLink size={13} /> Source Repository
          </a>
          <button
            onClick={() => onNavigate('settings')}
            style={{ background: 'none', border: 'none', color: 'var(--color-steel-gray)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
          >
            System Status & Diagnostics
          </button>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
