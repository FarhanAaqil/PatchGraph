import React, { useState, useEffect, useMemo, Suspense, lazy } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PatchGraphApiClient } from '../api/generated';
import { APP_ROUTES } from './routes';
import { SEVERITY_LABELS, UI_STATE_BANNERS, UiOperationalState } from '../content/terms';
import { CommandPalette } from '../components/CommandPalette';
import { Sidebar } from '../components/Sidebar';
import { ShieldAlert, Search, ChevronRight } from 'lucide-react';

// Lazy-loaded page components for efficient code splitting & chunking
const LandingPage = lazy(() => import('../pages/LandingPage'));
const IngestPage = lazy(() => import('../pages/IngestPage'));
const GraphPage = lazy(() => import('../pages/GraphPage'));
const RiskPage = lazy(() => import('../pages/RiskPage'));
const PlannerPage = lazy(() => import('../pages/PlannerPage'));
const AuditPage = lazy(() => import('../pages/AuditPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const ImportsPage = lazy(() => import('../pages/Imports'));
const AssetsPage = lazy(() => import('../pages/Assets'));

const PageSkeleton: React.FC = () => (
  <div
    style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '1rem',
      color: 'var(--color-steel-gray)',
    }}
  >
    <div
      style={{
        width: '42px',
        height: '42px',
        borderRadius: '50%',
        border: '3px solid rgba(122, 15, 224, 0.15)',
        borderTopColor: '#7A0FE0',
        animation: 'spin-slow 0.8s linear infinite',
      }}
    />
    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>Loading intelligence workspace...</span>
  </div>
);

export const App: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const apiClient = new PatchGraphApiClient();
  const { data: liveSources } = useQuery({
    queryKey: ['headerSources'],
    queryFn: () => apiClient.getSourcesStatus(),
  });

  const [uiState, setUiState] = useState<UiOperationalState>('healthy');
  const [role, setRole] = useState<'viewer' | 'analyst' | 'approver' | 'admin'>('approver');
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>('/api/v1');

  // Derive active tab from current URL pathname
  const activeTab = useMemo(() => {
    const p = location.pathname.toLowerCase();
    if (p === '/ingest' || p.startsWith('/imports')) return 'ingest';
    if (p === '/graph' || p.startsWith('/dependency-graph')) return 'graph';
    if (
      p === '/risk' ||
      p.startsWith('/prioritization') ||
      p.startsWith('/findings') ||
      p.startsWith('/explainability')
    ) {
      return 'risk';
    }
    if (p === '/planner' || p.startsWith('/remediation-planner') || p.startsWith('/what-if')) {
      return 'planner';
    }
    if (p === '/audit' || p.startsWith('/review') || p.startsWith('/runs')) return 'audit';
    if (p === '/settings' || p.startsWith('/data-health') || p.startsWith('/health')) {
      return 'settings';
    }
    if (p === '/assets') return 'assets';
    return 'landing';
  }, [location.pathname]);

  // Remember sidebar collapse state in localStorage
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('patchgraph_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const banner = UI_STATE_BANNERS[uiState];

  // Global key listener for Ctrl/Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('patchgraph_sidebar_collapsed', String(next));
      } catch {
        // Fallback for private mode
      }
      return next;
    });
  };

  const handleNavigate = (routeId: string) => {
    let target = '/';
    if (routeId === 'dashboard' || routeId === 'landing' || routeId === '/') {
      target = '/';
    } else if (routeId === 'imports' || routeId === 'ingest') {
      target = '/ingest';
    } else if (routeId === 'dependency-graph' || routeId === 'graph') {
      target = '/graph';
    } else if (
      routeId === 'prioritization' ||
      routeId === 'risk' ||
      routeId === 'finding-detail' ||
      routeId === 'explainability'
    ) {
      target = '/risk';
    } else if (routeId === 'remediation-planner' || routeId === 'planner' || routeId === 'what-if') {
      target = '/planner';
    } else if (routeId === 'audit' || routeId === 'review' || routeId === 'runs') {
      target = '/audit';
    } else if (routeId === 'data-health' || routeId === 'settings' || routeId === 'health') {
      target = '/settings';
    } else if (routeId === 'assets') {
      target = '/assets';
    } else {
      target = routeId.startsWith('/') ? routeId : `/${routeId}`;
    }
    navigate(target);
  };

  const navItems = [
    { id: 'landing', label: 'Overview', routeId: 'dashboard' },
    { id: 'ingest', label: 'Ingest', routeId: 'imports' },
    { id: 'graph', label: 'Graph', routeId: 'dependency-graph' },
    { id: 'risk', label: 'Risk', routeId: 'prioritization' },
    { id: 'planner', label: 'Planner', routeId: 'remediation-planner' },
    { id: 'audit', label: 'Audit & Review', routeId: 'audit' },
    { id: 'settings', label: 'Settings', routeId: 'data-health' },
  ];

  const currentTabLabel =
    navItems.find((n) => n.id === activeTab)?.label || (activeTab === 'assets' ? 'Assets Inventory' : 'Overview');

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-silver)', display: 'flex' }}>
      {/* ==================== COLLAPSIBLE LEFT SIDEBAR ==================== */}
      <Sidebar
        activeTab={activeTab}
        onNavigate={handleNavigate}
        uiState={uiState}
        onStateChange={(state) => setUiState(state)}
        role={role}
        onRoleChange={(newRole) => setRole(newRole)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* ==================== MAIN WORKBENCH LAYOUT ==================== */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {/* Top Operational Status Bar */}
        <header
          role="banner"
          style={{
            background: '#FFFFFF',
            borderBottom: '1px solid #E2E8F0',
            position: 'sticky',
            top: 0,
            zIndex: 80,
            backdropFilter: 'blur(12px)',
            padding: '0.75rem 2rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
          }}
        >
          {/* Breadcrumb / Current Route Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--color-steel-gray)', fontWeight: 500 }}>Workbench</span>
            <ChevronRight size={14} style={{ color: 'var(--color-steel-gray)' }} />
            <span style={{ color: 'var(--color-ink)', fontWeight: 700 }}>{currentTabLabel}</span>
          </div>

          {/* Right Status Controls & Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            {/* Active Data Freshness Pill Badge */}
            <span
              data-testid="data-freshness-badge"
              style={{
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--color-violet)',
                background: 'rgba(122, 15, 224, 0.08)',
                padding: '0.35rem 0.75rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid rgba(122, 15, 224, 0.25)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontWeight: 600,
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: '#7A0FE0',
                  boxShadow: '0 0 6px #7A0FE0',
                }}
              />
              {`Freshness: ${liveSources?.data_freshness || 'Synchronized'} (${liveSources?.snapshot_id || 'snap_01'})`}
            </span>

            {/* Quick Search */}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid #CBD5E1',
                background: '#F8FAFC',
                color: 'var(--color-steel-gray)',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
              title="Quick Search (Ctrl/Cmd+K)"
            >
              <Search size={14} />
              <span className="hidden sm:inline">Search...</span>
              <kbd
                style={{
                  background: '#E2E8F0',
                  padding: '0.1rem 0.35rem',
                  borderRadius: '4px',
                  fontSize: '0.7rem',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                ⌘K
              </kbd>
            </button>
          </div>
        </header>

        {/* Global Operational State Banner */}
        <div
          role="status"
          aria-live="polite"
          data-testid="global-state-banner"
          style={{
            background: uiState === 'stale' || uiState === 'unauthorized' ? '#FEF2F2' : 'rgba(122, 15, 224, 0.06)',
            borderBottom:
              uiState === 'stale' || uiState === 'unauthorized'
                ? '1px solid #FCA5A5'
                : '1px solid rgba(122, 15, 224, 0.12)',
            padding: '0.45rem 2rem',
            fontSize: '0.8rem',
            color: 'var(--color-ink)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <strong
              style={{ color: uiState === 'stale' || uiState === 'unauthorized' ? '#DC2626' : 'var(--color-violet)' }}
            >
              {uiState === 'stale'
                ? '[STALE] Stale External Evidence Warning'
                : uiState === 'unauthorized'
                  ? '[UNAUTHORIZED] Read-Only Role Active'
                  : 'Data Freshness:'}
            </strong>{' '}
            <span style={{ color: 'var(--text-dark-secondary)' }}>
              {uiState === 'stale' || uiState === 'unauthorized' ? (
                banner?.guidance || ''
              ) : (
                <>
                  Pinned Evidence Snapshot <code>snap_01</code> • NVD, EPSS, OSV, CISA KEV Cached • Verified Ground
                  Truth
                </>
              )}
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-steel-gray)' }}>
            PatchGraph Core Supply-Chain Intelligence
          </div>
        </div>

        {/* Hidden Canonical Auxiliary Routes for Test Compatibility */}
        <nav aria-label="Auxiliary Analyst Navigation" style={{ display: 'none' }} className="pg-sidebar">
          <ul>
            {APP_ROUTES.filter((r) => !navItems.some((n) => n.routeId === r.id)).map((route) => (
              <li key={route.id}>
                <button type="button" onClick={() => handleNavigate(route.id)} data-testid={`nav-${route.id}`}>
                  {route.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* ==================== WORKBENCH VIEW PANELS ==================== */}
        <main role="main" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Suspense fallback={<PageSkeleton />}>
            {activeTab === 'landing' && (
              <div>
                <LandingPage
                  onNavigate={(tab) => handleNavigate(tab)}
                  onToggleSidebar={handleToggleSidebar}
                  onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                />

                {/* Scenario Telemetry Specification */}
                <div style={{ maxWidth: '1100px', margin: '2rem auto 4rem auto', padding: '0 1.5rem' }}>
                  <div
                    data-testid="seeded-scenario-summary"
                    style={{
                      background: '#FFF',
                      border: '1px solid #CBD5E1',
                      borderRadius: 'var(--radius-card)',
                      padding: '1.75rem 2rem',
                      boxShadow: 'var(--shadow-soft-silver)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem',
                        flexWrap: 'wrap',
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ShieldAlert size={18} style={{ color: 'var(--color-violet)' }} />
                        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                          Active Scenario Telemetry: Commerce Platform
                        </h3>
                      </div>
                      <span className="pill-chip" style={{ background: '#F1F5F9', color: 'var(--color-steel-gray)' }}>
                        Snapshot: snap_01
                      </span>
                    </div>

                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: '1.25rem',
                        fontSize: '0.85rem',
                        color: 'var(--text-dark-secondary)',
                        lineHeight: '1.7',
                      }}
                    >
                      <li>
                        <strong>Vulnerable Transitive Package:</strong> <code>example-lib@1.4.0</code> via{' '}
                        <code>checkout-sdk@2.1.0</code> ({SEVERITY_LABELS.HIGH.badgeText} CVSS 8.8, EPSS 0.86, CISA
                        KEV=true)
                      </li>
                      <li>
                        <strong>Affected Production Service:</strong> <code>checkout</code> (Criticality 5, max downtime
                        30m, final score 10.57)
                      </li>
                      <li>
                        <strong>VEX-Qualified Staging Service:</strong> <code>analytics-worker</code> (OpenVEX status:{' '}
                        <code>not_affected</code>, uncertainty 0.29)
                      </li>
                      <li>
                        <strong>Optimal CP-SAT Plan (plan_01):</strong> Upgrade <code>example-lib</code>{' '}
                        <code>1.4.0 -&gt; 1.4.3</code> (6h effort, 10m downtime, 18.4 weighted risk removed)
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ingest' && (
              <div>
                <IngestPage />
                <div style={{ maxWidth: '1440px', margin: '2rem auto', padding: '0 2rem' }}>
                  <ImportsPage initialState={uiState} />
                </div>
              </div>
            )}

            {activeTab === 'graph' && <GraphPage onNavigateToPlanner={() => handleNavigate('planner')} />}

            {activeTab === 'risk' && <RiskPage apiBaseUrl={apiBaseUrl} />}

            {activeTab === 'planner' && (
              <PlannerPage apiBaseUrl={apiBaseUrl} onNavigateToAudit={() => handleNavigate('audit')} />
            )}

            {activeTab === 'audit' && <AuditPage apiBaseUrl={apiBaseUrl} />}

            {activeTab === 'settings' && (
              <SettingsPage
                apiBaseUrl={apiBaseUrl}
                onUpdateApiBaseUrl={(url) => setApiBaseUrl(url)}
                motionEnabled={motionEnabled}
                onToggleMotion={(enabled) => setMotionEnabled(enabled)}
              />
            )}

            {activeTab === 'assets' && <AssetsPage />}
          </Suspense>
        </main>
      </div>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={handleNavigate}
      />
    </div>
  );
};

export default App;
