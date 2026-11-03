import React, { useEffect, useState } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (routeId: string) => void;
}

export const CommandPalette: React.FC<Props> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');

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
    { id: 'landing', label: 'Overview & 3D Hero Scene', category: 'Navigation', icon: 'view_carousel' },
    { id: 'ingest', label: 'Ingest SBOM, VEX & Deployment Topology', category: 'Navigation', icon: 'upload_file' },
    { id: 'graph', label: 'Interactive Dependency & Deployment Graph', category: 'Navigation', icon: 'account_tree' },
    { id: 'risk', label: 'Risk Prioritization & Explainability Drawer', category: 'Navigation', icon: 'insights' },
    { id: 'planner', label: 'CP-SAT Remediation Planner & Sensitivity Sliders', category: 'Navigation', icon: 'memory' },
    { id: 'audit', label: 'Cryptographic Human Approval & Immutable Audit Log', category: 'Navigation', icon: 'verified' },
    { id: 'settings', label: 'Threat Intelligence Feeds & Platform Settings', category: 'Navigation', icon: 'settings' },
    { id: 'cve-1001', label: 'CVE-2026-1001 (example-lib @ 1.4.0 — CVSS 8.8 / Score 10.57)', category: 'Vulnerabilities', icon: 'warning' },
    { id: 'cve-1002', label: 'CVE-2026-1002 (checkout-sdk @ 2.1.0 — CVSS 6.5 / VEX Not Affected)', category: 'Vulnerabilities', icon: 'verified_user' },
    { id: 'svc-checkout', label: 'service:checkout (prod-cluster, PCI-DSS SLA 30m)', category: 'Services', icon: 'dns' },
  ];

  const filtered = query.trim()
    ? actions.filter((a) => a.label.toLowerCase().includes(query.toLowerCase()) || a.category.toLowerCase().includes(query.toLowerCase()))
    : actions;

  const handleSelect = (actionId: string) => {
    if (['cve-1001', 'cve-1002'].includes(actionId)) {
      onNavigate('risk');
    } else if (actionId === 'svc-checkout') {
      onNavigate('graph');
    } else {
      onNavigate(actionId);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-[#1A1220]/60 backdrop-blur-md p-4 animate-in fade-in">
      <div className="w-full max-w-xl rounded-[32px] bg-white border border-[#E6E9EE] shadow-2xl overflow-hidden flex flex-col">
        {/* Search Input */}
        <div className="flex items-center px-6 py-4 border-b border-[#E6E9EE] gap-3">
          <span className="material-symbols-outlined text-[#7A0FE0] text-2xl">search</span>
          <input
            type="text"
            placeholder="Type a command, CVE, package, or service..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full text-base font-sans text-[#1A1220] placeholder-[#8A929C] focus:outline-none"
          />
          <kbd className="px-2 py-0.5 rounded bg-[#E6E9EE] text-xs font-mono text-[#8A929C]">ESC</kbd>
        </div>

        {/* Action Items List */}
        <div className="max-h-80 overflow-y-auto p-3 space-y-1">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-sm font-mono text-[#8A929C]">No matching actions or assets found.</div>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className="w-full flex items-center justify-between p-3 rounded-2xl hover:bg-[#E6E9EE]/50 transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-[#7A0FE0]/10 text-[#7A0FE0] flex items-center justify-center material-symbols-outlined text-sm">
                    {item.icon}
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-[#1A1220] group-hover:text-[#7A0FE0] transition-colors">
                      {item.label}
                    </div>
                    <div className="text-[11px] font-mono text-[#8A929C] uppercase">{item.category}</div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-[#8A929C] text-sm group-hover:text-[#7A0FE0]">
                  chevron_right
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
