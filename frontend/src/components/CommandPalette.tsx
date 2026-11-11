import React, { useEffect, useState } from 'react';
import {
  Search,
  ChevronRight,
  ShieldAlert,
  Layers,
  GitBranch,
  FileCheck2,
  Cpu,
  Lock,
  Settings,
  Server,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (routeId: string) => void;
}

export const CommandPalette: React.FC<Props> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      } else if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    { id: 'landing', label: 'Overview & 3D Topology HUD', category: 'Navigation', icon: <Layers size={16} /> },
    {
      id: 'ingest',
      label: 'Ingest SBOM, VEX & Deployment Topology',
      category: 'Navigation',
      icon: <FileCheck2 size={16} />,
    },
    {
      id: 'graph',
      label: 'Interactive Dependency & Deployment Graph',
      category: 'Navigation',
      icon: <GitBranch size={16} />,
    },
    {
      id: 'risk',
      label: 'Prioritized Risk Register & Explainability',
      category: 'Navigation',
      icon: <ShieldAlert size={16} />,
    },
    { id: 'planner', label: 'CP-SAT Remediation Planner & Sliders', category: 'Navigation', icon: <Cpu size={16} /> },
    { id: 'audit', label: 'Human Review Gate & Append-Only Audit', category: 'Navigation', icon: <Lock size={16} /> },
    {
      id: 'settings',
      label: 'Connector Freshness & Platform Settings',
      category: 'Navigation',
      icon: <Settings size={16} />,
    },
    {
      id: 'cve-1001',
      label: 'CVE-2026-1001 (example-lib @ 1.4.0 — Score 10.57)',
      category: 'Vulnerabilities',
      icon: <ShieldAlert size={16} style={{ color: '#DC2626' }} />,
    },
    {
      id: 'svc-checkout',
      label: 'service:checkout (PCI-DSS prod-cluster SLA 30m)',
      category: 'Services',
      icon: <Server size={16} style={{ color: 'var(--color-violet)' }} />,
    },
  ];

  const filtered = query.trim()
    ? actions.filter(
        (a) =>
          a.label.toLowerCase().includes(query.toLowerCase()) || a.category.toLowerCase().includes(query.toLowerCase()),
      )
    : actions;

  const handleSelect = (actionId: string) => {
    if (['cve-1001'].includes(actionId)) {
      onNavigate('risk');
    } else if (actionId === 'svc-checkout') {
      onNavigate('graph');
    } else {
      onNavigate(actionId);
    }
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(26, 18, 32, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '6rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '620px',
          borderRadius: '28px',
          background: '#FFFFFF',
          border: '1px solid #CBD5E1',
          boxShadow: '0 32px 72px -12px rgba(26, 18, 32, 0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            borderBottom: '1px solid #E2E8F0',
            gap: '0.75rem',
          }}
        >
          <Search size={20} style={{ color: 'var(--color-violet)' }} />
          <input
            type="text"
            placeholder="Search commands, CVEs, packages, services..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              fontSize: '1rem',
              fontFamily: 'var(--font-body)',
              color: 'var(--color-ink)',
              border: 'none',
              outline: 'none',
              background: 'transparent',
            }}
          />
          <kbd
            style={{
              padding: '0.2rem 0.5rem',
              borderRadius: '6px',
              background: '#F1F5F9',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-steel-gray)',
              border: '1px solid #CBD5E1',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '380px', overflowY: 'auto', padding: '0.5rem' }}>
          {filtered.length === 0 ? (
            <div
              style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-steel-gray)', fontSize: '0.85rem' }}
            >
              No matching assets or actions found.
            </div>
          ) : (
            filtered.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: '16px',
                  border: 'none',
                  background: selectedIndex === idx ? 'rgba(122, 15, 224, 0.08)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '10px',
                      background: 'rgba(122, 15, 224, 0.1)',
                      color: 'var(--color-violet)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-ink)' }}>{item.label}</div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--color-steel-gray)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.category}
                    </div>
                  </div>
                </div>

                <ChevronRight size={16} style={{ color: 'var(--color-steel-gray)' }} />
              </button>
            ))
          )}
        </div>

        {/* Footer shortcuts */}
        <div
          style={{
            padding: '0.65rem 1.25rem',
            background: '#F8FAFC',
            borderTop: '1px solid #E2E8F0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: 'var(--color-steel-gray)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span>Navigate with arrows or click to select</span>
          <span>PatchGraph v2.0</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
