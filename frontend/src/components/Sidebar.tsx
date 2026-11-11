import React from 'react';
import {
  ShieldAlert,
  GitBranch,
  Sliders,
  Settings,
  Database,
  Search,
  Activity,
  PanelLeftClose,
  PanelLeftOpen,
  Lock,
} from 'lucide-react';
import { UiOperationalState } from '../content/terms';

export interface SidebarProps {
  activeTab: string;
  onNavigate: (routeId: string) => void;
  uiState: UiOperationalState;
  onStateChange: (state: UiOperationalState) => void;
  role: 'viewer' | 'analyst' | 'approver' | 'admin';
  onRoleChange: (role: 'viewer' | 'analyst' | 'approver' | 'admin') => void;
  onOpenCommandPalette: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onNavigate,
  uiState,
  onStateChange,
  role,
  onRoleChange,
  onOpenCommandPalette,
  isCollapsed,
  onToggleCollapse,
}) => {
  const navItems = [
    {
      id: 'landing',
      label: 'Overview',
      routeId: 'dashboard',
      icon: <Activity size={18} />,
      tag: '01',
    },
    {
      id: 'ingest',
      label: 'Ingest',
      routeId: 'imports',
      icon: <Database size={18} />,
      tag: '02',
    },
    {
      id: 'graph',
      label: 'Graph',
      routeId: 'dependency-graph',
      icon: <GitBranch size={18} />,
      tag: '03',
    },
    {
      id: 'risk',
      label: 'Risk',
      routeId: 'prioritization',
      icon: <ShieldAlert size={18} />,
      tag: '04',
    },
    {
      id: 'planner',
      label: 'Planner',
      routeId: 'remediation-planner',
      icon: <Sliders size={18} />,
      tag: '05',
    },
    {
      id: 'audit',
      label: 'Audit & Review',
      routeId: 'audit',
      icon: <Lock size={18} />,
      tag: '06',
    },
    {
      id: 'settings',
      label: 'Settings',
      routeId: 'data-health',
      icon: <Settings size={18} />,
      tag: '07',
    },
  ];

  return (
    <aside
      data-testid="collapsible-sidebar"
      aria-label="Primary Left Sidebar Navigation"
      style={{
        width: isCollapsed ? '76px' : '260px',
        minWidth: isCollapsed ? '76px' : '260px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
        zIndex: 90,
        background: '#1A1220',
        borderRight: '1px solid rgba(138, 146, 156, 0.18)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        transition: 'width 0.24s cubic-bezier(0.16, 1, 0.3, 1), min-width 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
        overflowX: 'hidden',
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.3)',
      }}
    >
      {/* Top Header & Brand */}
      <div>
        <div
          style={{
            padding: isCollapsed ? '1.25rem 0.75rem' : '1.25rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            borderBottom: '1px solid rgba(138, 146, 156, 0.14)',
          }}
        >
          <button
            type="button"
            onClick={() => onNavigate('landing')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: 0,
              color: '#FFFFFF',
            }}
            title="PatchGraph Overview"
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #7A0FE0 0%, #4B0F9E 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 900,
                fontFamily: 'var(--font-display)',
                fontSize: '1.2rem',
                boxShadow: '0 0 16px rgba(122, 15, 224, 0.5)',
                flexShrink: 0,
              }}
            >
              P
            </div>
            {!isCollapsed && (
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 800,
                  fontSize: '1.15rem',
                  letterSpacing: '-0.04em',
                  color: '#E6E9EE',
                  whiteSpace: 'nowrap',
                }}
              >
                PatchGraph
              </span>
            )}
          </button>

          {!isCollapsed && (
            <button
              type="button"
              data-testid="toggle-sidebar"
              aria-label="Toggle navigation sidebar"
              onClick={onToggleCollapse}
              style={{
                background: 'rgba(138, 146, 156, 0.12)',
                border: '1px solid rgba(138, 146, 156, 0.2)',
                borderRadius: '8px',
                color: '#8A929C',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Collapse sidebar"
            >
              <PanelLeftClose size={15} />
            </button>
          )}
        </div>

        {/* Primary Route Navigation Items */}
        <nav
          style={{
            padding: '1rem 0.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-testid={`nav-${item.routeId}`}
                onClick={() => onNavigate(item.id)}
                title={isCollapsed ? item.label : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.85rem',
                  padding: isCollapsed ? '0.75rem 0' : '0.7rem 0.95rem',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  borderRadius: '12px',
                  border: isActive ? '1px solid rgba(122, 15, 224, 0.5)' : '1px solid transparent',
                  background: isActive ? 'rgba(122, 15, 224, 0.18)' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#8A929C',
                  cursor: 'pointer',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.875rem',
                  transition: 'all 0.15s ease',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '18%',
                      bottom: '18%',
                      width: '3px',
                      borderRadius: '0 4px 4px 0',
                      background: '#7A0FE0',
                      boxShadow: '0 0 10px #7A0FE0',
                    }}
                  />
                )}
                <span
                  style={{
                    color: isActive ? '#7A0FE0' : '#8A929C',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    filter: isActive ? 'drop-shadow(0 0 6px rgba(122, 15, 224, 0.6))' : 'none',
                  }}
                >
                  {item.icon}
                </span>

                {!isCollapsed && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ color: isActive ? '#E6E9EE' : '#8A929C' }}>{item.label}</span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.65rem',
                        color: isActive ? '#7A0FE0' : 'rgba(138, 146, 156, 0.5)',
                        fontWeight: 700,
                      }}
                    >
                      {item.tag}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Session & Controls Section */}
      <div
        style={{
          padding: isCollapsed ? '1rem 0.5rem' : '1rem 1rem',
          borderTop: '1px solid rgba(138, 146, 156, 0.14)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {/* Quick Search Button */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'space-between',
            padding: '0.55rem 0.75rem',
            background: 'rgba(230, 233, 238, 0.05)',
            border: '1px solid rgba(138, 146, 156, 0.2)',
            borderRadius: '10px',
            color: '#8A929C',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
          title="Search Command Palette (Ctrl/Cmd+K)"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={14} />
            {!isCollapsed && <span>Quick Search</span>}
          </div>
          {!isCollapsed && (
            <kbd
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                padding: '0.1rem 0.35rem',
                borderRadius: '4px',
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                color: '#E6E9EE',
              }}
            >
              ⌘K
            </kbd>
          )}
        </button>

        {/* Evidence Snapshot Badge */}
        <div
          data-testid="active-snapshot-badge"
          style={{
            fontSize: '0.7rem',
            fontFamily: 'var(--font-mono)',
            color: '#E6E9EE',
            background: 'rgba(122, 15, 224, 0.12)',
            border: '1px solid rgba(122, 15, 224, 0.3)',
            borderRadius: '8px',
            padding: '0.4rem 0.6rem',
            textAlign: isCollapsed ? 'center' : 'left',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            whiteSpace: 'nowrap',
          }}
          title="Pinned Snapshot: snap_01 (9f86d081...)"
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#7A0FE0',
              boxShadow: '0 0 6px #7A0FE0',
              flexShrink: 0,
            }}
          />
          {!isCollapsed ? <span>Snapshot: snap_01</span> : <span style={{ fontSize: '0.65rem' }}>snap_01</span>}
        </div>

        {/* Role Selector */}
        {!isCollapsed ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
            <label htmlFor="role-switcher" style={{ color: '#8A929C', fontSize: '0.7rem' }}>
              Role:
            </label>
            <select
              id="role-switcher"
              value={role}
              onChange={(e) => onRoleChange(e.target.value as any)}
              style={{
                background: '#130B19',
                color: '#E6E9EE',
                border: '1px solid rgba(138, 146, 156, 0.3)',
                borderRadius: '6px',
                padding: '0.25rem 0.5rem',
                fontSize: '0.7rem',
                cursor: 'pointer',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <option value="viewer">Viewer</option>
              <option value="analyst">Analyst</option>
              <option value="approver">Approver</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <span
              style={{
                fontSize: '0.65rem',
                fontFamily: 'var(--font-mono)',
                color: '#7A0FE0',
                textTransform: 'uppercase',
                fontWeight: 700,
              }}
              title={`Role: ${role}`}
            >
              {role.slice(0, 3)}
            </span>
          </div>
        )}

        {/* State Switcher (Operational / Diagnostic simulation) */}
        <select
          id="state-switcher"
          value={uiState}
          onChange={(e) => onStateChange(e.target.value as UiOperationalState)}
          style={{
            display: isCollapsed ? 'none' : 'block',
            width: '100%',
            background: 'rgba(255, 255, 255, 0.04)',
            color: '#8A929C',
            border: '1px solid rgba(138, 146, 156, 0.2)',
            borderRadius: '6px',
            padding: '0.25rem 0.5rem',
            fontSize: '0.65rem',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
          }}
          title="Operational State"
        >
          <option value="healthy">State: Synchronized</option>
          <option value="stale">State: Stale Warning</option>
          <option value="unauthorized">State: Read-Only</option>
        </select>

        {/* Sidebar Toggle for Collapsed State */}
        {isCollapsed && (
          <button
            type="button"
            data-testid="toggle-sidebar"
            aria-label="Toggle navigation sidebar"
            onClick={onToggleCollapse}
            style={{
              width: '100%',
              background: 'rgba(138, 146, 156, 0.1)',
              border: '1px solid rgba(138, 146, 156, 0.2)',
              borderRadius: '8px',
              color: '#8A929C',
              padding: '0.45rem 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Expand sidebar"
          >
            <PanelLeftOpen size={16} />
          </button>
        )}
      </div>
    </aside>
  );
};
