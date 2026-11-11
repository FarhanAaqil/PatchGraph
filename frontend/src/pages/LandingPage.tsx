import React, { useState } from 'react';
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
  Activity,
  CheckCircle2,
  Search,
} from 'lucide-react';

interface Props {
  onNavigate: (routeId: string) => void;
  onToggleSidebar?: () => void;
  onOpenCommandPalette?: () => void;
}

export const LandingPage: React.FC<Props> = ({ onNavigate, onToggleSidebar, onOpenCommandPalette }) => {
  const [activeStage, setActiveStage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
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

  const stageCallouts = [
    {
      num: '01',
      title: 'Map the blast radius',
      desc: 'SBOMs, VEX and deployment topology fused into one trace from ingress to core packages.',
      route: 'graph',
    },
    {
      num: '02',
      title: 'Calibrate exploit likelihood',
      desc: 'Platt-calibrated logistic regression fusing CISA KEV weaponization with EPSS percentiles.',
      route: 'risk',
    },
    {
      num: '03',
      title: 'Solve provable remediation',
      desc: 'Google OR-Tools CP-SAT optimizer computing minimal-risk upgrade sets under downtime limits.',
      route: 'planner',
    },
  ];

  const currentCallout = stageCallouts[activeStage - 1] || stageCallouts[0];

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onOpenCommandPalette) {
      onOpenCommandPalette();
    } else {
      onNavigate('risk');
    }
  };

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#ECEEF2', color: '#0F172A' }}>
      {/* ========================================================== */}
      {/* FULL-BLEED 3D HERO DASHBOARD (EXACT SCREENSHOT REPLICA)     */}
      {/* ========================================================== */}
      <section
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '1.75rem 2.5rem',
          boxSizing: 'border-box',
          overflow: 'hidden',
          background: 'radial-gradient(ellipse at 70% 45%, #F4F6F9 0%, #EAEDF2 70%, #E3E7EE 100%)',
        }}
      >
        {/* 3D WebGL Three.js Scene Background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 1,
            pointerEvents: 'auto',
          }}
        >
          <ThreeHeroScene
            graphNodes={graphData?.nodes}
            activeStage={activeStage}
            onStageSelect={(s) => setActiveStage(s)}
            onNodeClick={(nodeId) => {
              if (nodeId.includes('vuln') || nodeId.includes('conduit-start')) {
                onNavigate('risk');
              } else {
                onNavigate('graph');
              }
            }}
          />
        </div>

        {/* ----------------- TOP FLOATING PILL NAV BAR ----------------- */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            width: '100%',
            pointerEvents: 'none',
          }}
        >
          {/* Top Left: Logo & Hamburger Pill */}
          <div
            style={{
              pointerEvents: 'auto',
              background: '#FFFFFF',
              borderRadius: '9999px',
              padding: '0.45rem 0.55rem 0.45rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
            }}
          >
            <span
              onClick={() => onNavigate('dashboard')}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: '1.15rem',
                letterSpacing: '-0.03em',
                color: '#0F172A',
                cursor: 'pointer',
              }}
            >
              patchgraph.
            </span>
            <button
              onClick={() => onToggleSidebar && onToggleSidebar()}
              title="Toggle Navigation Menu"
              data-testid="landing-hamburger-btn"
              style={{
                background: '#7A0FE0',
                border: 'none',
                width: '32px',
                height: '24px',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ width: '13px', height: '2px', background: '#FFFFFF', borderRadius: '1px' }} />
              <div style={{ width: '13px', height: '2px', background: '#FFFFFF', borderRadius: '1px' }} />
            </button>
          </div>

          {/* Top Center: View Mode Pills */}
          <div
            style={{
              pointerEvents: 'auto',
              background: '#FFFFFF',
              borderRadius: '9999px',
              padding: '0.5rem 1.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '2rem',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
            }}
          >
            <button
              onClick={() => onNavigate('ingest')}
              style={{
                background: 'none',
                border: 'none',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: '#0F172A',
                cursor: 'pointer',
                padding: 0,
                transition: 'color 0.15s ease',
              }}
            >
              Pipeline
            </button>
            <button
              onClick={() => onNavigate('graph')}
              style={{
                background: 'none',
                border: 'none',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: '#0F172A',
                cursor: 'pointer',
                padding: 0,
                transition: 'color 0.15s ease',
              }}
            >
              Workbench
            </button>
            <button
              onClick={() => onNavigate('audit')}
              style={{
                background: 'none',
                border: 'none',
                fontFamily: 'var(--font-body)',
                fontWeight: 600,
                fontSize: '0.9rem',
                color: '#0F172A',
                cursor: 'pointer',
                padding: 0,
                transition: 'color 0.15s ease',
              }}
            >
              Audit
            </button>
          </div>

          {/* Top Right: Search Pill */}
          <form
            onSubmit={handleSearchSubmit}
            style={{
              pointerEvents: 'auto',
              background: '#FFFFFF',
              borderRadius: '9999px',
              padding: '0.35rem 0.45rem 0.35rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
            }}
          >
            <input
              type="text"
              placeholder="Search CVE, package..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => onOpenCommandPalette && onOpenCommandPalette()}
              style={{
                border: 'none',
                outline: 'none',
                background: 'transparent',
                fontSize: '0.85rem',
                color: '#0F172A',
                width: '150px',
                fontFamily: 'var(--font-body)',
              }}
            />
            <button
              type="submit"
              title="Search"
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#7A0FE0',
                border: 'none',
                color: '#FFFFFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                boxShadow: '0 2px 8px rgba(122, 15, 224, 0.3)',
              }}
            >
              <Search size={15} />
            </button>
          </form>
        </div>

        {/* ----------------- HERO CONTENT & STEPPER ----------------- */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '2.5rem',
            margin: 'auto 0',
            maxWidth: '650px',
            pointerEvents: 'none',
          }}
        >
          {/* Vertical Stepper Rail on the Left */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
              pointerEvents: 'auto',
            }}
          >
            {[1, 2, 3].map((stepNum) => {
              const isActive = activeStage === stepNum;
              return (
                <button
                  key={stepNum}
                  onClick={() => setActiveStage(stepNum)}
                  title={`Stage 0${stepNum}`}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: isActive ? '#7A0FE0' : '#FFFFFF',
                    color: isActive ? '#FFFFFF' : '#0F172A',
                    border: isActive ? 'none' : '1.5px solid #CBD5E1',
                    boxShadow: isActive ? '0 4px 14px rgba(122, 15, 224, 0.45)' : '0 2px 6px rgba(0, 0, 0, 0.04)',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-mono)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                >
                  0{stepNum}
                </button>
              );
            })}
          </div>

          {/* Hero Main Typography */}
          <div style={{ pointerEvents: 'auto' }}>
            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.78rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: '#6366F1',
                textTransform: 'uppercase',
                marginBottom: '0.85rem',
              }}
            >
              SOFTWARE SUPPLY-CHAIN INTELLIGENCE
            </div>

            <h1
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(3.2rem, 5.8vw, 5.25rem)',
                fontWeight: 900,
                letterSpacing: '-0.045em',
                lineHeight: 0.98,
                margin: 0,
                color: '#0F172A',
              }}
            >
              Patch what matters.
            </h1>

            <p
              style={{
                fontSize: '1.1rem',
                color: '#475569',
                lineHeight: 1.55,
                marginTop: '1.25rem',
                maxWidth: '440px',
                fontWeight: 450,
              }}
            >
              Explainable, constrained remediation planning across your dependency and deployment graph. Humans approve
              every step.
            </p>
          </div>
        </div>

        {/* ----------------- BOTTOM BAR (CALLOUT & ACTION BUTTON) ----------------- */}
        <div
          style={{
            position: 'relative',
            zIndex: 10,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            width: '100%',
            pointerEvents: 'none',
          }}
        >
          {/* Bottom Left: Huge Number & Section Callout */}
          <div
            onClick={() => onNavigate(currentCallout.route)}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'baseline',
              gap: '1.75rem',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(5rem, 8vw, 7.5rem)',
                fontWeight: 900,
                lineHeight: 0.8,
                letterSpacing: '-0.05em',
                color: '#7A0FE0',
                userSelect: 'none',
              }}
            >
              {currentCallout.num}
            </div>
            <div>
              <h2
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 'clamp(1.25rem, 2vw, 1.65rem)',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  margin: 0,
                  color: '#0F172A',
                }}
              >
                {currentCallout.title}
              </h2>
              <p
                style={{
                  fontSize: '0.92rem',
                  color: '#64748B',
                  margin: '0.4rem 0 0 0',
                  maxWidth: '380px',
                  lineHeight: 1.45,
                }}
              >
                {currentCallout.desc}
              </p>
            </div>
          </div>

          {/* Bottom Right: Circular Floating Action Button */}
          <button
            onClick={() => onNavigate('ingest')}
            title="Launch Triage Pipeline"
            style={{
              pointerEvents: 'auto',
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: '#7A0FE0',
              border: 'none',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 28px rgba(122, 15, 224, 0.45)',
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <ArrowRight size={28} />
          </button>
        </div>
      </section>

      {/* ========================================================== */}
      {/* SECONDARY WORKING PRODUCT TELEMETRY & 5-STAGE PIPELINE RAIL */}
      {/* ========================================================== */}
      <div
        style={{
          maxWidth: '1360px',
          margin: '0 auto',
          padding: '3.5rem 2rem 5rem 2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '3.5rem',
        }}
      >
        {/* Security Posture Telemetry Grid */}
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
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(122, 15, 224, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-violet)',
              }}
            >
              <Activity size={20} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-steel-gray)',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Pipeline Runtime
              </div>
              <div
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {syncedFeedsCount} Threat Feeds Active
              </div>
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
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
              }}
            >
              <ShieldCheck size={20} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-steel-gray)',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Vulnerability Index
              </div>
              <div
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {totalFindings} Prioritized Findings
              </div>
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
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(59, 130, 246, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3B82F6',
              }}
            >
              <Layers size={20} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-steel-gray)',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Supply-Chain Graph
              </div>
              <div
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {totalAssets} Deployment Assets
              </div>
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
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                background: 'rgba(16, 185, 129, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#10B981',
              }}
            >
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--color-steel-gray)',
                  textTransform: 'uppercase',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                Audit Ledger
              </div>
              <div
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  color: 'var(--color-ink)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                {totalAudit} Audit Events
              </div>
            </div>
          </div>
        </section>

        {/* Five-Stage Remediation Architecture */}
        <section data-testid="interactive-pipeline-rail">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <span
              className="pill-chip"
              style={{ background: 'rgba(122, 15, 224, 0.08)', color: 'var(--color-violet)', marginBottom: '0.5rem' }}
            >
              Remediation Pipeline
            </span>
            <h2
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2rem',
                fontWeight: 800,
                margin: '0.5rem 0',
                letterSpacing: '-0.03em',
              }}
            >
              Five-Stage Remediation Architecture
            </h2>
            <p style={{ color: 'var(--color-steel-gray)', maxWidth: '620px', margin: '0 auto', fontSize: '0.95rem' }}>
              Each phase provides explicit mathematical diagnostics and explainable justifications before moving to
              execution.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem' }}>
            {pipelineSteps.map((step) => (
              <div
                key={step.num}
                className="pg-card"
                onClick={() => onNavigate(step.route)}
                style={{
                  padding: '1.75rem 1.5rem',
                  background: '#FFFFFF',
                  borderRadius: 'var(--radius-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  border: '1px solid #E2E8F0',
                  boxShadow: 'var(--shadow-card)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        background: 'rgba(122, 15, 224, 0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {step.icon}
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: 'var(--color-steel-gray)',
                      }}
                    >
                      {step.num}
                    </span>
                  </div>
                  <h3
                    style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '1.15rem',
                      fontWeight: 700,
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {step.title}
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-steel-gray)', lineHeight: 1.5 }}>
                    {step.desc}
                  </p>
                </div>

                <div
                  style={{
                    marginTop: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    className="pill-chip"
                    style={{
                      fontSize: '0.7rem',
                      background: '#F8FAFC',
                      color: 'var(--color-ink)',
                      border: '1px solid #E2E8F0',
                    }}
                  >
                    {step.badge}
                  </span>
                  <ArrowRight size={14} style={{ color: 'var(--color-violet)' }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default LandingPage;
