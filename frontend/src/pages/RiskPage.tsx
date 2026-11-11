import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PatchGraphApiClient } from '../api/generated';
import {
  ShieldAlert,
  Search,
  Filter,
  ChevronRight,
  X,
  Sparkles,
  AlertTriangle,
  Activity,
  Info,
  ArrowUpDown,
} from 'lucide-react';

export const RiskPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [envFilter, setEnvFilter] = useState('all');
  const [kevFilter, setKevFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'final_score' | 'probability' | 'severity'>('final_score');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedFindingId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const client = new PatchGraphApiClient();

  const {
    data: findingsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['findings'],
    queryFn: () => client.listFindings(),
  });

  const { data: explainData, isLoading: isExplaining } = useQuery({
    queryKey: ['explain', selectedFindingId],
    queryFn: () => (selectedFindingId ? client.explainFinding(selectedFindingId) : null),
    enabled: Boolean(selectedFindingId),
  });

  const { data: modelCardData } = useQuery({
    queryKey: ['modelCard'],
    queryFn: () => client.getModelCard(),
  });

  const items = findingsData?.items || [];

  // Filter and sort items
  const filteredItems = items
    .filter((f) => {
      const matchesSearch =
        f.canonical_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.package_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.service_name.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesEnv =
        envFilter === 'all' ||
        f.environment.toLowerCase() === envFilter.toLowerCase() ||
        (envFilter === 'production' && f.environment.toLowerCase() === 'prod') ||
        (envFilter === 'prod' && f.environment.toLowerCase() === 'production');
      const matchesKev = kevFilter === 'all' || (kevFilter === 'kev' ? (f.factors?.kev_bonus ?? 0) > 0 : true);

      return matchesSearch && matchesEnv && matchesKev;
    })
    .sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortBy === 'final_score') {
        valA = a.final_score;
        valB = b.final_score;
      } else if (sortBy === 'probability') {
        valA = a.probability;
        valB = b.probability;
      } else if (sortBy === 'severity') {
        valA = a.factors?.severity ?? a.baseline_score;
        valB = b.factors?.severity ?? b.baseline_score;
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });

  const selectedFinding = items.find((f) => f.id === selectedFindingId);

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1440px', margin: '0 auto', color: 'var(--pg-ink)' }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1.5rem',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span
              className="pill-chip"
              style={{
                background: 'rgba(122, 15, 224, 0.1)',
                color: 'var(--pg-violet)',
                border: '1px solid rgba(122, 15, 224, 0.25)',
              }}
            >
              <ShieldAlert size={14} style={{ marginRight: '0.35rem' }} /> Calibrated Exploit Intelligence
            </span>
            {modelCardData && (
              <span
                className="pill-chip"
                style={{
                  background: 'rgba(122, 15, 224, 0.08)',
                  color: 'var(--pg-violet)',
                  border: '1px solid rgba(122, 15, 224, 0.25)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                }}
              >
                PR-AUC: {modelCardData.pr_auc.toFixed(4)} • Brier: {modelCardData.brier_score.toFixed(4)} • ECE:{' '}
                {modelCardData.ece.toFixed(4)}
              </span>
            )}
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.25rem',
              letterSpacing: '-0.03em',
              margin: 0,
              fontWeight: 800,
            }}
          >
            Prioritized Risk Register
          </h1>
          <p style={{ color: 'var(--pg-steel)', marginTop: '0.5rem', fontSize: '1rem', maxWidth: '680px' }}>
            Empirically calibrated risk scores combining CVSS 3.1 base vectors, EPSS exploit likelihood, CISA KEV
            weaponization evidence, and deployment runtime reachability.
          </p>
        </div>

        {/* Global Summary Stats */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div
            className="pg-card"
            style={{ padding: '1rem 1.5rem', background: '#FFF', textAlign: 'center', minWidth: '130px' }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', textTransform: 'uppercase', fontWeight: 600 }}>
              Total Ranked
            </div>
            <div
              style={{
                fontSize: '1.75rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--pg-ink)',
                marginTop: '0.25rem',
              }}
            >
              {items.length}
            </div>
          </div>
          <div
            className="pg-card"
            style={{ padding: '1rem 1.5rem', background: '#FFF', textAlign: 'center', minWidth: '130px' }}
          >
            <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', textTransform: 'uppercase', fontWeight: 600 }}>
              KEV Exploited
            </div>
            <div
              style={{
                fontSize: '1.75rem',
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--pg-violet)',
                marginTop: '0.25rem',
              }}
            >
              {items.filter((f) => (f.factors?.kev_bonus ?? 0) > 0).length}
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div
        className="pg-card"
        style={{
          padding: '1.25rem 1.75rem',
          background: '#FFF',
          marginBottom: '2rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '1rem', flex: '1 1 320px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--pg-steel)',
              }}
            />
            <input
              type="text"
              placeholder="Search CVE, package or service..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '0.65rem 1rem 0.65rem 2.5rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid #CBD5E1',
                fontSize: '0.875rem',
                fontFamily: 'var(--font-body)',
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={15} style={{ color: 'var(--pg-steel)' }} />
            <select
              data-testid="risk-env-filter"
              value={envFilter}
              onChange={(e) => setEnvFilter(e.target.value)}
              style={{
                padding: '0.65rem 1.25rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid #CBD5E1',
                fontSize: '0.85rem',
                background: '#FFF',
                fontFamily: 'var(--font-body)',
              }}
            >
              <option value="all">All Environments</option>
              <option value="prod">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
          </div>

          <select
            data-testid="risk-kev-filter"
            value={kevFilter}
            onChange={(e) => setKevFilter(e.target.value)}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
              background: '#FFF',
              fontFamily: 'var(--font-body)',
            }}
          >
            <option value="all">All KEV States</option>
            <option value="kev">CISA KEV Only</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--pg-steel)' }}>Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid #CBD5E1',
              fontSize: '0.85rem',
              background: '#FFF',
              fontFamily: 'var(--font-body)',
            }}
          >
            <option value="final_score">Final Risk Score</option>
            <option value="probability">Calibrated Exploit Prob</option>
            <option value="severity">Base Severity</option>
          </select>
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            style={{
              background: '#F1F5F9',
              border: '1px solid #CBD5E1',
              borderRadius: 'var(--radius-pill)',
              padding: '0.65rem 0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Toggle sort direction"
          >
            <ArrowUpDown size={14} />
          </button>
        </div>
      </div>

      {/* Main Table / Card View */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: '#FFF', borderRadius: 'var(--radius-frame)' }}>
          <div style={{ color: 'var(--pg-violet)', fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem' }}>
            Loading ranked findings...
          </div>
          <p style={{ color: 'var(--pg-steel)', fontSize: '0.9rem' }}>
            Collecting risk factors and baseline score distributions.
          </p>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '2rem',
            background: '#FEF2F2',
            border: '1px solid #F87171',
            borderRadius: 'var(--radius-frame)',
            color: '#991B1B',
          }}
        >
          <h3 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={18} /> Findings could not be loaded
          </h3>
          <p style={{ margin: 0, fontSize: '0.9rem' }}>Please check that PatchGraph is running and try again.</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', background: '#FFF', borderRadius: 'var(--radius-frame)' }}>
          <ShieldAlert size={40} style={{ color: 'var(--pg-steel)', marginBottom: '1rem' }} />
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>No findings match your filters</h3>
          <p style={{ color: 'var(--pg-steel)', fontSize: '0.9rem' }}>
            Try clearing the search query or adjusting your environment selection.
          </p>
        </div>
      ) : (
        <div
          style={{
            background: '#FFF',
            borderRadius: 'var(--radius-frame)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-card)',
            border: '1px solid #E2E8F0',
          }}
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr
                  style={{
                    background: '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                    color: 'var(--pg-steel)',
                    textTransform: 'uppercase',
                    fontSize: '0.75rem',
                    letterSpacing: '0.05em',
                  }}
                >
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600 }}>Vulnerability / CVE</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Package</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Service & Env</th>
                  <th style={{ padding: '1rem 1rem', fontWeight: 600, textAlign: 'center' }}>Base CVSS</th>
                  <th style={{ padding: '1rem 1.25rem', fontWeight: 600 }}>Calibrated Exploit P</th>
                  <th style={{ padding: '1rem 1rem', fontWeight: 600, textAlign: 'center' }}>Reachability</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600, textAlign: 'right' }}>Final Score</th>
                  <th style={{ padding: '1rem 1.5rem', fontWeight: 600, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((finding) => {
                  const isKev = (finding.factors?.kev_bonus ?? 0) > 0;
                  const probPct = Math.round(finding.probability * 100);
                  const isReachable = (finding.factors?.reachability ?? 0) > 0.5;

                  return (
                    <tr
                      key={finding.id}
                      style={{
                        borderBottom: '1px solid #F1F5F9',
                        transition: 'background 0.15s ease',
                        background: selectedFindingId === finding.id ? 'rgba(122, 15, 224, 0.04)' : 'transparent',
                      }}
                    >
                      {/* Vulnerability / CVE */}
                      <td style={{ padding: '1.25rem 1.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              color: 'var(--pg-ink)',
                              fontSize: '0.9rem',
                            }}
                          >
                            {finding.canonical_id}
                          </span>
                          {isKev && (
                            <span
                              style={{
                                background: '#FEE2E2',
                                color: '#DC2626',
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                padding: '0.15rem 0.45rem',
                                borderRadius: '4px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                              }}
                            >
                              CISA KEV
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', marginTop: '0.2rem' }}>
                          ID: {finding.id}
                        </div>
                      </td>

                      {/* Package */}
                      <td style={{ padding: '1.25rem 1.25rem' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--pg-ink)' }}>
                          {finding.package_name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)' }}>
                          v{finding.package_version} •{' '}
                          <span style={{ textTransform: 'uppercase' }}>{finding.ecosystem}</span>
                        </div>
                      </td>

                      {/* Service & Env */}
                      <td style={{ padding: '1.25rem 1.25rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--pg-ink)' }}>{finding.service_name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              background: finding.environment === 'production' ? '#EF4444' : '#3B82F6',
                            }}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--pg-steel)', textTransform: 'capitalize' }}>
                            {finding.environment}
                          </span>
                        </div>
                      </td>

                      {/* Base CVSS */}
                      <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            padding: '0.25rem 0.6rem',
                            borderRadius: 'var(--radius-pill)',
                            background:
                              finding.baseline_score >= 8.0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                            color: finding.baseline_score >= 8.0 ? '#DC2626' : '#D97706',
                          }}
                        >
                          {finding.baseline_score.toFixed(1)}
                        </span>
                      </td>

                      {/* Calibrated Exploit Prob */}
                      <td style={{ padding: '1.25rem 1.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div
                            style={{
                              width: '70px',
                              height: '6px',
                              background: '#E2E8F0',
                              borderRadius: '3px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${probPct}%`,
                                height: '100%',
                                background: probPct > 70 ? 'var(--pg-violet)' : '#4B0F9E',
                                borderRadius: '3px',
                              }}
                            />
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '0.85rem' }}>
                            {probPct}%
                          </span>
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--pg-steel)', marginTop: '0.2rem' }}>
                          EPSS calibrated
                        </div>
                      </td>

                      {/* Reachability */}
                      <td style={{ padding: '1.25rem 1rem', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            padding: '0.2rem 0.6rem',
                            borderRadius: 'var(--radius-pill)',
                            background: isReachable ? 'rgba(122, 15, 224, 0.1)' : '#F1F5F9',
                            color: isReachable ? 'var(--pg-violet)' : 'var(--pg-steel)',
                          }}
                        >
                          {isReachable ? 'Reachable' : 'Guarded'}
                        </span>
                      </td>

                      {/* Final Score */}
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            fontSize: '1.15rem',
                            color: finding.final_score > 9 ? 'var(--pg-violet)' : 'var(--pg-ink)',
                          }}
                        >
                          {finding.final_score.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--pg-steel)' }}>
                          ±{finding.uncertainty.toFixed(2)} band
                        </div>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                        <button
                          onClick={() => setSelectedFindingId(finding.id)}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(122, 15, 224, 0.3)',
                            color: 'var(--pg-violet)',
                            borderRadius: 'var(--radius-pill)',
                            padding: '0.45rem 0.9rem',
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'var(--pg-violet)';
                            e.currentTarget.style.color = '#FFF';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'var(--pg-violet)';
                          }}
                        >
                          <Sparkles size={12} /> Explain
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-over Explain Drawer */}
      {selectedFindingId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(26, 18, 32, 0.4)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setSelectedFindingId(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              height: '100%',
              background: '#FFF',
              boxShadow: '-8px 0 32px rgba(0, 0, 0, 0.15)',
              padding: '2.5rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.5rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span
                  className="pill-chip"
                  style={{ background: 'rgba(122, 15, 224, 0.1)', color: 'var(--pg-violet)', marginBottom: '0.5rem' }}
                >
                  Risk Factor Breakdown
                </span>
                <h2
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '1.75rem',
                    margin: '0.5rem 0 0.25rem 0',
                    fontWeight: 800,
                  }}
                >
                  {explainData?.canonical_id || selectedFinding?.canonical_id}
                </h2>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--pg-steel)' }}>
                  Finding Ref: {selectedFindingId}
                </div>
              </div>
              <button
                onClick={() => setSelectedFindingId(null)}
                aria-label="Close explain drawer"
                data-testid="close-explain-drawer"
                style={{
                  background: '#F1F5F9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--pg-steel)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {isExplaining ? (
              <div style={{ padding: '3rem 0', textAlign: 'center', color: 'var(--pg-steel)' }}>
                <Activity size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--pg-violet)' }} />
                <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>Decomposing Platt calibration model weights...</p>
              </div>
            ) : explainData ? (
              <>
                {/* Score Comparison Hero Card */}
                <div
                  style={{
                    background: 'var(--gradient-silver)',
                    border: '1px solid #CBD5E1',
                    borderRadius: 'var(--radius-card)',
                    padding: '1.5rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--pg-steel)',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}
                    >
                      Baseline CVSS
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: 'var(--pg-steel)',
                        marginTop: '0.25rem',
                      }}
                    >
                      {explainData.baseline_score.toFixed(1)}
                    </div>
                  </div>
                  <ChevronRight size={24} style={{ color: 'var(--pg-steel)' }} />
                  <div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--pg-violet)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                      }}
                    >
                      Calibrated Final Score
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '2.25rem',
                        fontWeight: 800,
                        color: 'var(--pg-violet)',
                        marginTop: '0.25rem',
                      }}
                    >
                      {explainData.final_score.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--pg-steel)',
                        textTransform: 'uppercase',
                        fontWeight: 600,
                      }}
                    >
                      Uncertainty
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '1rem',
                        fontWeight: 600,
                        color: 'var(--pg-ink)',
                        marginTop: '0.25rem',
                      }}
                    >
                      ±{explainData.uncertainty.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Executive Summary in Plain English */}
                <div
                  style={{
                    background: 'rgba(122, 15, 224, 0.05)',
                    border: '1px solid rgba(122, 15, 224, 0.2)',
                    borderRadius: 'var(--radius-card)',
                    padding: '1.25rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: 'var(--pg-violet)',
                      marginBottom: '0.35rem',
                    }}
                  >
                    <Sparkles size={15} /> Executive Risk Synthesis
                  </div>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--pg-ink)', lineHeight: '1.55' }}>
                    Even though baseline CVSS is <strong>{explainData.baseline_score.toFixed(1)}</strong>, this finding
                    is prioritized with a final score of <strong>{explainData.final_score.toFixed(2)}</strong> because
                    it is actively weaponized (CISA KEV), exhibits a calibrated{' '}
                    <strong>{Math.round(explainData.probability * 100)}%</strong> exploit likelihood, and is exposed on
                    service <strong>{selectedFinding?.service_name || 'checkout'}</strong> reachable from public
                    ingress.
                  </p>
                </div>

                {/* Mathematical Weighting Formula */}
                <div>
                  <h4
                    style={{
                      margin: '0 0 0.5rem 0',
                      fontSize: '0.9rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--pg-steel)',
                    }}
                  >
                    Calibration Formula
                  </h4>
                  <div
                    style={{
                      background: 'var(--pg-ink)',
                      color: 'var(--pg-silver)',
                      borderRadius: 'var(--radius-card)',
                      padding: '1rem 1.25rem',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.8rem',
                      lineHeight: '1.6',
                    }}
                  >
                    {explainData.formula}
                  </div>
                </div>

                {/* Factor Contribution Tiles */}
                <div>
                  <h4
                    style={{
                      margin: '0 0 0.75rem 0',
                      fontSize: '0.9rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: 'var(--pg-steel)',
                    }}
                  >
                    Factor Contributions
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div
                      style={{
                        padding: '1rem',
                        background: '#F8FAFC',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)' }}>Severity Contribution</div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: 'var(--pg-ink)',
                          marginTop: '0.25rem',
                        }}
                      >
                        {explainData.factors.severity.toFixed(2)}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '1rem',
                        background: '#F8FAFC',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)' }}>Exploit Probability</div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: 'var(--pg-violet)',
                          marginTop: '0.25rem',
                        }}
                      >
                        {(explainData.factors.exploit_probability * 100).toFixed(1)}%
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '1rem',
                        background: '#F8FAFC',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)' }}>Asset Criticality</div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: 'var(--pg-ink)',
                          marginTop: '0.25rem',
                        }}
                      >
                        {explainData.factors.criticality.toFixed(1)} / 5.0
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '1rem',
                        background: '#F8FAFC',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)' }}>Reachability Multiplier</div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: 'var(--pg-ink)',
                          marginTop: '0.25rem',
                        }}
                      >
                        {explainData.factors.reachability.toFixed(2)}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '1rem',
                        background: '#F8FAFC',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)' }}>CISA KEV Bonus</div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: explainData.factors.kev_bonus > 0 ? '#DC2626' : 'var(--pg-steel)',
                          marginTop: '0.25rem',
                        }}
                      >
                        +{explainData.factors.kev_bonus.toFixed(1)}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: '1rem',
                        background: '#F8FAFC',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <div style={{ fontSize: '0.75rem', color: 'var(--pg-steel)' }}>Uncertainty Penalty</div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: 'var(--pg-ink)',
                          marginTop: '0.25rem',
                        }}
                      >
                        {explainData.factors.uncertainty_penalty.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ML Log-Odds Feature Contributions */}
                {explainData.ml_exploit_factors && (
                  <div>
                    <h4
                      style={{
                        margin: '0 0 0.75rem 0',
                        fontSize: '0.9rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--pg-steel)',
                      }}
                    >
                      Log-Odds Feature Contributions (Platt-Calibrated)
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                      {Object.entries(explainData.ml_exploit_factors).map(([feat, weight]) => (
                        <div
                          key={feat}
                          style={{
                            padding: '0.75rem 1rem',
                            background: '#F1F5F9',
                            borderRadius: '8px',
                            border: '1px solid #E2E8F0',
                          }}
                        >
                          <div style={{ fontSize: '0.7rem', color: '#64748B', fontFamily: 'var(--font-mono)' }}>
                            {feat}
                          </div>
                          <div
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontSize: '1rem',
                              fontWeight: 700,
                              color: (weight as number) >= 0 ? '#16A34A' : '#DC2626',
                              marginTop: '0.2rem',
                            }}
                          >
                            {(weight as number) >= 0
                              ? `+${(weight as number).toFixed(4)}`
                              : (weight as number).toFixed(4)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Model Reliability & Notes */}
                <div
                  style={{
                    background: '#F8FAFC',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    border: '1px solid #E2E8F0',
                    fontSize: '0.85rem',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      color: 'var(--pg-ink)',
                      marginBottom: '0.35rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <Info size={15} style={{ color: 'var(--pg-violet)' }} /> Calibration Model Details
                  </div>
                  <div style={{ color: 'var(--pg-steel)', lineHeight: '1.5' }}>{explainData.calibration_notes}</div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default RiskPage;
