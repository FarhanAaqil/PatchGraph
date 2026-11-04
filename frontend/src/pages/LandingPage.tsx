import React from 'react';
import { ThreeHeroScene } from '../components/ThreeHeroScene';
import { 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Layers, 
  GitBranch, 
  FileCheck2, 
  Database, 
  Lock, 
  CheckCircle2, 
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface Props {
  onNavigate: (routeId: string) => void;
}

export const LandingPage: React.FC<Props> = ({ onNavigate }) => {
  const steps = [
    {
      num: '01',
      title: 'Ingest',
      route: 'ingest',
      icon: <Database size={22} style={{ color: 'var(--color-violet)' }} />,
      desc: 'CycloneDX 1.5 & SPDX 2.3 SBOMs, OpenVEX machine justifications, and deployment topologies with SHA-256 provenance hashes.',
      badge: 'Zero-Copy Parsing',
    },
    {
      num: '02',
      title: 'Graph',
      route: 'graph',
      icon: <GitBranch size={22} style={{ color: 'var(--color-violet)' }} />,
      desc: 'Typed dependency-and-deployment topology with reverse BFS reachability analysis and public ingress hop decay.',
      badge: '60fps Cytoscape & 3D',
    },
    {
      num: '03',
      title: 'Score',
      route: 'risk',
      icon: <Sparkles size={22} style={{ color: 'var(--color-violet)' }} />,
      desc: 'Platt-calibrated logistic likelihood combined with FIRST EPSS percentiles, CISA KEV weaponization evidence, and asset criticality.',
      badge: 'Brier Score 0.042',
    },
    {
      num: '04',
      title: 'Optimize',
      route: 'planner',
      icon: <Cpu size={22} style={{ color: 'var(--color-violet)' }} />,
      desc: 'Google OR-Tools CP-SAT integer programming solver computing provably optimal upgrade sets under engineering effort and downtime limits.',
      badge: 'Provably Optimal',
    },
    {
      num: '05',
      title: 'Approve',
      route: 'audit',
      icon: <Lock size={22} style={{ color: 'var(--color-violet)' }} />,
      desc: 'Human authority sign-off with mandatory rationale comments permanently sealed into an immutable, append-only audit ledger.',
      badge: 'Append-Only Ledger',
    },
  ];

  const dataSources = [
    { name: 'CycloneDX', spec: 'v1.5 JSON', status: 'Active' },
    { name: 'SPDX', spec: 'v2.3 Standard', status: 'Active' },
    { name: 'OpenVEX', spec: 'v0.2.0 Justifications', status: 'Active' },
    { name: 'OSV.dev', spec: 'Distributed Vulns', status: 'Synchronized' },
    { name: 'NVD CVE', spec: 'API v2.0 CVSS', status: 'Synchronized' },
    { name: 'FIRST EPSS', spec: 'Daily Percentiles', status: 'Synchronized' },
    { name: 'CISA KEV', spec: 'Known Exploited', status: 'Synchronized' },
  ];

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '4.5rem' }}>
      {/* ==================== HERO SECTION ==================== */}
      <section style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
        <div
          className="pill-chip glass-panel"
          style={{
            padding: '0.45rem 1.15rem',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid rgba(122, 15, 224, 0.25)',
            boxShadow: '0 4px 16px rgba(122, 15, 224, 0.1)',
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
          Explainable Supply-Chain Remediation Engine • v2.0
        </div>

        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.75rem, 6vw, 4.5rem)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1.05,
            margin: '0.5rem 0',
            color: 'var(--color-ink)',
            maxWidth: '900px',
          }}
        >
          Patch what{' '}
          <span
            style={{
              background: 'var(--gradient-violet)',
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
            color: 'var(--text-dark-secondary)',
            maxWidth: '720px',
            margin: '0 auto',
            lineHeight: 1.6,
          }}
        >
          Stop drowning in flat CVE severities. PatchGraph traces true deployment reachability across your microservices topology
          and uses mathematical integer programming to solve optimal upgrade sequences under real engineering constraints.
        </p>

        {/* Action CTAs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: '1rem', paddingTop: '0.75rem' }}>
          <button
            onClick={() => onNavigate('planner')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.85rem',
              padding: '0.65rem 0.65rem 0.65rem 1.65rem',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--color-violet)',
              color: '#FFFFFF',
              border: 'none',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-violet-glow)',
              transition: 'all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.background = 'var(--color-indigo)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.background = 'var(--color-violet)';
            }}
          >
            <span>Launch Remediation Planner</span>
            <div className="circular-arrow-btn" style={{ width: '38px', height: '38px' }}>
              <ArrowRight size={18} />
            </div>
          </button>

          <button
            onClick={() => onNavigate('graph')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.65rem',
              padding: '0.85rem 1.65rem',
              borderRadius: 'var(--radius-pill)',
              background: '#FFFFFF',
              color: 'var(--color-ink)',
              border: '1px solid #CBD5E1',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0,0,0,0.04)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--color-violet)';
              e.currentTarget.style.color = 'var(--color-violet)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#CBD5E1';
              e.currentTarget.style.color = 'var(--color-ink)';
            }}
          >
            <GitBranch size={18} style={{ color: 'var(--color-violet)' }} />
            <span>Explore 3D Topology</span>
          </button>

          <button
            onClick={() => onNavigate('ingest')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.85rem 1.4rem',
              borderRadius: 'var(--radius-pill)',
              background: 'transparent',
              color: 'var(--color-steel-gray)',
              border: '1px solid transparent',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-ink)';
              e.currentTarget.style.borderColor = '#CBD5E1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-steel-gray)';
              e.currentTarget.style.borderColor = 'transparent';
            }}
          >
            <Database size={16} />
            <span>Ingest SBOM</span>
          </button>
        </div>
      </section>

      {/* ==================== 3D THREE.JS HERO CANVAS ==================== */}
      <section style={{ width: '100%' }}>
        <ThreeHeroScene
          onStageSelect={(stage) => {
            console.log('Stage selected:', stage);
          }}
          onNodeClick={(nodeId) => {
            if (nodeId === 'pkg-vulnerable') onNavigate('risk');
            else onNavigate('graph');
          }}
        />
      </section>

      {/* ==================== CONTINUOUS FEED TELEMETRY MARQUEE ==================== */}
      <section
        className="pg-card"
        style={{
          padding: '2rem 2.5rem',
          background: '#FFFFFF',
          borderRadius: 'var(--radius-frame)',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-steel-gray)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
            Continuous Threat Intelligence & Ecosystem Interoperability
          </span>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.85rem' }}>
          {dataSources.map((ds) => (
            <div
              key={ds.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.65rem',
                padding: '0.55rem 1.15rem',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--gradient-silver)',
                border: '1px solid #CBD5E1',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16A34A' }} />
              <strong style={{ color: 'var(--color-ink)' }}>{ds.name}</strong>
              <span style={{ color: 'var(--color-steel-gray)' }}>{ds.spec}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== FIVE-STEP PIPELINE ==================== */}
      <section>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span className="pill-chip pill-chip-violet" style={{ marginBottom: '0.5rem' }}>
            Mathematical Supply-Chain Lifecycle
          </span>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', fontWeight: 800, margin: '0.5rem 0', letterSpacing: '-0.03em' }}>
            From Ingestion to Verified Human Sign-Off
          </h2>
          <p style={{ color: 'var(--color-steel-gray)', maxWidth: '640px', margin: '0 auto', fontSize: '1rem' }}>
            A deterministic, fully explainable pipeline designed for high-security enterprise environments.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
          {steps.map((step) => (
            <div
              key={step.num}
              className="pg-card"
              style={{
                padding: '2rem 1.5rem',
                background: '#FFFFFF',
                borderRadius: 'var(--radius-card)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
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

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 800 }}>
                    {step.title}
                  </h3>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--color-steel-gray)', lineHeight: '1.5', margin: '0 0 1.25rem 0' }}>
                  {step.desc}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid #F1F5F9' }}>
                <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--color-violet)', fontWeight: 700 }}>
                  {step.badge}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-violet)', fontSize: '0.75rem', fontWeight: 700 }}>
                  Explore <ArrowRight size={13} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== HUMANS APPROVE. ALWAYS. ==================== */}
      <section
        className="pg-ink-card"
        style={{
          padding: '3rem 3.5rem',
          borderRadius: 'var(--radius-hero)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div style={{ maxWidth: '780px', position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: '#16A34A',
                boxShadow: '0 0 10px #16A34A',
              }}
            />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-silver)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>
              Zero Autonomous Modifications Guarantee
            </span>
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 800, margin: '0 0 1rem 0', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
            Humans approve. Always.
          </h2>

          <p style={{ color: 'var(--color-silver)', fontSize: '1rem', lineHeight: '1.65', marginBottom: '2rem' }}>
            PatchGraph provides mathematical explanations and constrained recommendations; it never pushes code or executes modifications autonomously.
            Every upgrade action requires explicit operator sign-off with mandatory justification comments permanently recorded in append-only cryptographic audit logs.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.25rem' }}>
            <button
              onClick={() => onNavigate('audit')}
              style={{
                padding: '0.85rem 1.85rem',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--color-violet)',
                color: '#FFFFFF',
                border: 'none',
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: 'var(--shadow-violet-glow)',
              }}
            >
              <Lock size={16} />
              <span>Inspect Immutable Audit Ledger</span>
            </button>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-steel-gray)' }}>
              Ledger Mode: <span style={{ color: '#FFFFFF', fontWeight: 700 }}>SHA-256 Tamper-Evident</span>
            </div>
          </div>
        </div>

        {/* Ambient Ring in Background */}
        <div
          style={{
            position: 'absolute',
            right: '-120px',
            top: '-120px',
            width: '450px',
            height: '450px',
            borderRadius: '50%',
            border: '2px solid rgba(122, 15, 224, 0.25)',
            pointerEvents: 'none',
          }}
        />
      </section>

      {/* ==================== GITHUB CTA FOOTER ==================== */}
      <footer style={{ textAlign: 'center', padding: '2rem 0', borderTop: '1px solid #CBD5E1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-ink)' }}>
          PatchGraph — Built by Farhan Aaqil
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-steel-gray)', margin: 0 }}>
          FastAPI Backend • Google OR-Tools CP-SAT • React Vite Three.js Frontend • CycloneDX & OpenVEX
        </p>
        <div style={{ marginTop: '0.5rem' }}>
          <a
            href="https://github.com/FarhanAaqil/PatchGraph"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.6rem 1.25rem',
              borderRadius: 'var(--radius-pill)',
              background: '#FFFFFF',
              color: 'var(--color-ink)',
              border: '1px solid #CBD5E1',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
            }}
          >
            <ExternalLink size={14} style={{ color: 'var(--color-violet)' }} />
            View Repository on GitHub (FarhanAaqil/PatchGraph)
          </a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
