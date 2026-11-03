import React from 'react';
import { ThreeHeroScene } from '../components/ThreeHeroScene';

interface Props {
  onNavigate: (routeId: string) => void;
}

export const LandingPage: React.FC<Props> = ({ onNavigate }) => {
  const steps = [
    {
      num: '01',
      title: 'Ingest',
      desc: 'CycloneDX 1.5 & SPDX 2.3 SBOMs, OpenVEX statements, and deployment topology with content SHA-256 provenance.',
    },
    {
      num: '02',
      title: 'Graph',
      desc: 'Typed dependency-and-deployment topology with reverse BFS traversal and reachability hop decay.',
    },
    {
      num: '03',
      title: 'Score',
      desc: 'Platt-calibrated logistic likelihood combined with EPSS, CISA KEV, asset criticality, and reachability.',
    },
    {
      num: '04',
      title: 'Optimize',
      desc: 'Google OR-Tools CP-SAT mathematical solver jointly selecting minimal patches under effort and downtime limits.',
    },
    {
      num: '05',
      title: 'Approve',
      desc: 'Human authority sign-off with mandatory justification comments permanently recorded in immutable audit logs.',
    },
  ];

  const dataSources = [
    { name: 'CycloneDX', label: 'v1.5 JSON' },
    { name: 'SPDX', label: 'v2.3 Standard' },
    { name: 'OpenVEX', label: 'v0.2.0 Justifications' },
    { name: 'OSV.dev', label: 'Distributed Vulns' },
    { name: 'NVD CVE', label: 'API v2.0 CVSS' },
    { name: 'FIRST EPSS', label: 'Daily Percentiles' },
    { name: 'CISA KEV', label: 'Known Exploited' },
  ];

  return (
    <div className="space-y-16 py-6 max-w-6xl mx-auto px-4 sm:px-6">
      {/* ==================== HERO SECTION ==================== */}
      <section className="text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-[#E6E9EE] shadow-sm text-xs font-mono text-[#7A0FE0] font-semibold">
          <span className="w-2 h-2 rounded-full bg-[#7A0FE0] animate-pulse"></span>
          Explainable Supply-Chain Remediation • v2.0
        </div>

        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#1A1220] leading-[1.05]">
          Patch what <span className="bg-gradient-to-r from-[#7A0FE0] to-[#4B0F9E] bg-clip-text text-transparent">matters.</span>
        </h1>

        <p className="max-w-2xl mx-auto text-base sm:text-lg text-[#4A515C] font-normal leading-relaxed">
          Stop drowning in flat CVE severities. PatchGraph traces real reachability across your deployment topology and computes mathematically optimal patch plans under engineering constraints.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <button
            onClick={() => onNavigate('planner')}
            className="flex items-center gap-3 px-6 py-3.5 rounded-full bg-[#7A0FE0] hover:bg-[#4B0F9E] text-white font-medium text-sm transition-all shadow-violet group"
          >
            <span>Launch Remediation Planner</span>
            <div className="circular-arrow-btn w-7 h-7 border border-white/80">
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </button>

          <button
            onClick={() => onNavigate('graph')}
            className="flex items-center gap-2 px-6 py-3.5 rounded-full bg-white hover:bg-[#E6E9EE] text-[#1A1220] border border-[#E6E9EE] font-medium text-sm transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-base text-[#7A0FE0]">account_tree</span>
            <span>Explore 3D Topology</span>
          </button>
        </div>
      </section>

      {/* ==================== 3D THREE.JS HERO CANVAS ==================== */}
      <section>
        <ThreeHeroScene onStageSelect={(stage) => console.log('Camera stage:', stage)} />
      </section>

      {/* ==================== DATA-SOURCE MARQUEE ==================== */}
      <section className="rounded-3xl bg-white border border-[#E6E9EE] p-6 shadow-sm overflow-hidden">
        <div className="text-center text-xs font-mono text-[#8A929C] uppercase tracking-wider mb-4">
          Continuous Feed Provenance & Threat Telemetry
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6">
          {dataSources.map((ds) => (
            <div
              key={ds.name}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-[#E6E9EE]/40 border border-[#E6E9EE] text-xs font-mono text-[#1A1220]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#7A0FE0]"></span>
              <strong className="font-semibold">{ds.name}</strong>
              <span className="text-[#8A929C] text-[10px]">({ds.label})</span>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== 5-STEP PIPELINE ==================== */}
      <section className="space-y-8">
        <div className="text-center space-y-2">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#1A1220]">
            The Five-Stage Remediation Engine
          </h2>
          <p className="text-sm text-[#8A929C] font-mono">From raw SBOM ingestion to verified human sign-off</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {steps.map((s) => (
            <div
              key={s.num}
              className="rounded-[32px] bg-white border border-[#E6E9EE] p-6 shadow-silver-card flex flex-col justify-between space-y-4 hover:border-[#7A0FE0]/50 transition-all group"
            >
              <div className="huge-numeral group-hover:scale-105 transition-transform">{s.num}</div>
              <div>
                <h3 className="font-display text-lg font-bold text-[#1A1220] group-hover:text-[#7A0FE0] transition-colors">
                  {s.title}
                </h3>
                <p className="text-xs text-[#4A515C] leading-relaxed mt-2">{s.desc}</p>
              </div>
              <div className="pt-2 border-t border-[#E6E9EE]/60 flex items-center justify-between text-[11px] font-mono text-[#7A0FE0]">
                <span>Stage Ready</span>
                <span className="material-symbols-outlined text-sm">check_circle</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ==================== HUMANS APPROVE. ALWAYS. ==================== */}
      <section className="rounded-[44px] bg-ink-panel border border-[#8A929C]/30 p-8 sm:p-12 text-white shadow-ink-depth relative overflow-hidden">
        <div className="max-w-2xl space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#7A0FE0]/30 border border-[#7A0FE0] text-xs font-mono text-white font-semibold">
            <span className="material-symbols-outlined text-sm text-[#7A0FE0]">verified_user</span>
            CORE GOVERNANCE GUARANTEE
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white leading-tight">
            Humans approve. Always.
          </h2>
          <p className="text-sm text-[#E6E9EE] leading-relaxed font-sans">
            PatchGraph provides mathematical explanations and constrained recommendations; it never pushes code or executes modifications autonomously. Every upgrade action requires explicit operator sign-off with mandatory justification comments permanently recorded in append-only cryptographic audit logs.
          </p>

          <div className="pt-4 flex flex-wrap items-center gap-4">
            <button
              onClick={() => onNavigate('audit')}
              className="flex items-center gap-3 px-6 py-3 rounded-full bg-[#7A0FE0] hover:bg-[#4B0F9E] text-white font-medium text-xs font-mono transition-all"
            >
              <span>Inspect Immutable Audit Ledger</span>
              <span className="material-symbols-outlined text-sm">history_edu</span>
            </button>
            <div className="text-xs font-mono text-[#8A929C]">
              Digest: <span className="text-[#E6E9EE]">SHA-256 Verified</span>
            </div>
          </div>
        </div>

        {/* Decorative Ring in Background */}
        <div className="absolute right-[-40px] top-[-40px] w-96 h-96 rounded-full border border-[#7A0FE0]/20 pointer-events-none"></div>
      </section>

      {/* ==================== GITHUB CTA FOOTER ==================== */}
      <section className="text-center py-8 border-t border-[#E6E9EE] space-y-3">
        <div className="font-display text-lg font-bold text-[#1A1220]">
          PatchGraph — Built by Farhan Aaqil
        </div>
        <p className="text-xs text-[#8A929C] font-mono">
          FastAPI Backend • Google OR-Tools CP-SAT • React Vite Three.js Frontend • CycloneDX & OpenVEX
        </p>
        <div className="pt-2">
          <a
            href="https://github.com/FarhanAaqil/PatchGraph"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-[#E6E9EE] text-[#1A1220] border border-[#E6E9EE] text-xs font-mono font-semibold transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-sm">code</span>
            <span>View on GitHub (FarhanAaqil/PatchGraph)</span>
          </a>
        </div>
      </section>
    </div>
  );
};
