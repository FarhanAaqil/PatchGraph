import React, { useState } from 'react';
import { APP_ROUTES, AppRoute } from './routes';
import { SEVERITY_LABELS, UI_STATE_BANNERS, UiOperationalState } from '../content/terms';
import ImportsPage from '../pages/Imports';

export const App: React.FC = () => {
  const [activeRoute, setActiveRoute] = useState<AppRoute>(APP_ROUTES[0]);
  const [uiState, setUiState] = useState<UiOperationalState>('offline-demo');
  const [role, setRole] = useState<'viewer' | 'analyst' | 'approver' | 'admin'>('approver');

  const banner = UI_STATE_BANNERS[uiState];

  return (
    <div className="pg-shell">
      <header className="pg-topbar" role="banner">
        <div>
          <strong>PatchGraph</strong> — Explainable, Constrained Supply-Chain Remediation
        </div>
        <div aria-label="Session Controls">
          <span data-testid="active-snapshot-badge">Snapshot: snap_01 (9f86d081...)</span>
          <label htmlFor="role-switcher" style={{ marginLeft: '1rem' }}>
            Active Role:
            <select
              id="role-switcher"
              value={role}
              onChange={(e) => setRole(e.target.value as 'viewer' | 'analyst' | 'approver' | 'admin')}
            >
              <option value="viewer">Viewer</option>
              <option value="analyst">Analyst</option>
              <option value="approver">Approver</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label htmlFor="state-switcher" style={{ marginLeft: '1rem' }}>
            UI State:
            <select
              id="state-switcher"
              value={uiState}
              onChange={(e) => setUiState(e.target.value as UiOperationalState)}
            >
              <option value="offline-demo">offline-demo</option>
              <option value="loading">loading</option>
              <option value="empty">empty</option>
              <option value="stale">stale</option>
              <option value="partial">partial</option>
              <option value="unauthorized">unauthorized</option>
              <option value="failed">failed</option>
            </select>
          </label>
        </div>
      </header>

      <div role="status" aria-live="polite" data-testid="global-state-banner">
        <strong>[{uiState.toUpperCase()}] {banner.title}:</strong> {banner.guidance}
      </div>

      <div className="pg-layout">
        <nav aria-label="Primary Analyst Navigation" className="pg-sidebar">
          <ul>
            {APP_ROUTES.map((route) => (
              <li key={route.id}>
                <button
                  type="button"
                  onClick={() => setActiveRoute(route)}
                  aria-current={activeRoute.id === route.id ? 'page' : undefined}
                  data-testid={`nav-${route.id}`}
                >
                  {route.title} <small>({route.minRole})</small>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <main role="main" className="pg-main" aria-labelledby="active-screen-heading">
          {activeRoute.id === 'imports' ? (
            <ImportsPage initialState={uiState} />
          ) : (
            <section>
              <h1 id="active-screen-heading">{activeRoute.title}</h1>
              <p>{activeRoute.description}</p>
              <div data-testid="seeded-scenario-summary">
                <h2>Seeded Architecture Skeleton Scenario (Gate 1)</h2>
                <ul>
                  <li>
                    <strong>Vulnerable Transitive Package:</strong> <code>example-lib@1.4.0</code> via{' '}
                    <code>checkout-sdk@2.1.0</code> ({SEVERITY_LABELS.HIGH.badgeText} CVSS 8.8, EPSS 0.86, CISA KEV=true)
                  </li>
                  <li>
                    <strong>Affected Production Service:</strong> <code>checkout</code> (Criticality 5, max downtime 30m, final score 10.57)
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
            </section>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
