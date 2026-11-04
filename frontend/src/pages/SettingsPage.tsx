import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PatchGraphApiClient } from '../api/generated';
import {
  Settings,
  Database,
  Globe,
  Sun,
  Moon,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Eye
} from 'lucide-react';

interface SettingsPageProps {
  apiBaseUrl?: string;
  onUpdateApiBaseUrl?: (url: string) => void;
  motionEnabled?: boolean;
  onToggleMotion?: (enabled: boolean) => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  apiBaseUrl = '',
  onUpdateApiBaseUrl,
  motionEnabled = true,
  onToggleMotion,
}) => {
  const [urlInput, setUrlInput] = useState(apiBaseUrl);
  const [isSaved, setIsSaved] = useState(false);
  const [themeMode, setThemeMode] = useState<'silver' | 'ink'>('silver');

  const client = new PatchGraphApiClient({ baseUrl: apiBaseUrl });

  const { data: sourcesData, isLoading: isLoadingSources, refetch } = useQuery({
    queryKey: ['sourcesStatus'],
    queryFn: () => client.getSourcesStatus(),
  });

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateApiBaseUrl) {
      onUpdateApiBaseUrl(urlInput.trim());
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    }
  };

  const sources = sourcesData?.sources || {};

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1200px', margin: '0 auto', color: 'var(--pg-ink)' }}>
      {/* Header */}
      <div style={{ marginBottom: '2.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <span className="pill-chip" style={{ background: 'rgba(122, 15, 224, 0.1)', color: 'var(--pg-violet)', border: '1px solid rgba(122, 15, 224, 0.25)' }}>
            <Settings size={14} style={{ marginRight: '0.35rem' }} /> System Configuration
          </span>
          <span className="pill-chip" style={{ background: '#FFF', color: 'var(--pg-steel)', border: '1px solid #CBD5E1' }}>
            Demo data
          </span>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', letterSpacing: '-0.03em', margin: 0, fontWeight: 800 }}>
          Environment & Connector Settings
        </h1>
        <p style={{ color: 'var(--pg-steel)', marginTop: '0.5rem', fontSize: '1rem', maxWidth: '640px' }}>
          Inspect upstream threat intelligence connectors, adjust runtime connectivity, and customize display rendering and motion preferences.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {/* Connector Feeds Status */}
        <div
          className="pg-card"
          style={{
            padding: '2rem',
            background: '#FFF',
            border: '1px solid #E2E8F0',
            borderRadius: 'var(--radius-frame)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Database size={20} style={{ color: 'var(--pg-violet)' }} />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Data Source Connectors</h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--pg-steel)' }}>
                  Freshness and parser integrity for vulnerability catalogs and exploit probability models
                </div>
              </div>
            </div>

            <button
              onClick={() => refetch()}
              style={{
                background: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: 'var(--radius-pill)',
                padding: '0.45rem 0.95rem',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                color: 'var(--pg-ink)',
              }}
            >
              <RefreshCw size={13} /> Refresh Status
            </button>
          </div>

          {isLoadingSources ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--pg-steel)' }}>
              Checking connector health...
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {Object.entries(sources).map(([key, item]) => {
                const isHealthy = item.status === 'operational' || item.status === 'ok';

                return (
                  <div
                    key={key}
                    style={{
                      padding: '1.25rem',
                      background: 'var(--gradient-silver)',
                      borderRadius: 'var(--radius-card)',
                      border: '1px solid #CBD5E1',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      minHeight: '120px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '1rem', textTransform: 'uppercase', color: 'var(--pg-ink)' }}>
                        {key}
                      </div>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.5rem',
                          borderRadius: 'var(--radius-pill)',
                          background: isHealthy ? 'rgba(22, 163, 74, 0.12)' : 'rgba(245, 158, 11, 0.12)',
                          color: isHealthy ? '#16A34A' : '#D97706',
                          border: `1px solid ${isHealthy ? 'rgba(22, 163, 74, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.status}
                      </span>
                    </div>

                    <div style={{ marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--pg-steel)', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                      <div>Records indexed: <strong style={{ color: 'var(--pg-ink)', fontFamily: 'var(--font-mono)' }}>{item.records}</strong></div>
                      <div>Parser version: <span style={{ fontFamily: 'var(--font-mono)' }}>{item.parser_version}</span></div>
                      <div>Last sync: {new Date(item.last_sync).toLocaleTimeString()}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sourcesData?.snapshot_sha256 && (
            <div style={{ marginTop: '1.5rem', padding: '0.85rem 1.25rem', background: '#F8FAFC', borderRadius: 'var(--radius-card)', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
              <div style={{ color: 'var(--pg-steel)' }}>
                Evidence Snapshot Content Hash: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--pg-ink)', fontWeight: 600 }}>{sourcesData.snapshot_sha256}</span>
              </div>
              <div style={{ color: 'var(--pg-violet)', fontWeight: 600 }}>
                {sourcesData.offline_demo_mode ? 'Deterministic Offline Mode Active' : 'Online Streaming Mode'}
              </div>
            </div>
          )}
        </div>

        {/* API Base URL Configuration */}
        <div
          className="pg-card"
          style={{
            padding: '2rem',
            background: '#FFF',
            border: '1px solid #E2E8F0',
            borderRadius: 'var(--radius-frame)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Globe size={20} style={{ color: 'var(--pg-violet)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>API Gateway Endpoint</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--pg-steel)' }}>
                Base URL for communicating with the PatchGraph FastAPI backend
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveUrl} style={{ display: 'flex', gap: '1rem', alignItems: 'center', maxWidth: '640px' }}>
            <input
              type="text"
              placeholder="e.g. http://localhost:5000"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              style={{
                flex: 1,
                padding: '0.75rem 1.25rem',
                borderRadius: 'var(--radius-pill)',
                border: '1px solid #CBD5E1',
                fontSize: '0.9rem',
                fontFamily: 'var(--font-mono)',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: 'var(--radius-pill)',
                background: 'var(--pg-violet)',
                color: '#FFF',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Update Base URL
            </button>
          </form>

          {isSaved && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#16A34A', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <CheckCircle size={14} /> Base URL updated successfully.
            </div>
          )}
        </div>

        {/* Presentation & Accessibility Preferences */}
        <div
          className="pg-card"
          style={{
            padding: '2rem',
            background: '#FFF',
            border: '1px solid #E2E8F0',
            borderRadius: 'var(--radius-frame)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Eye size={20} style={{ color: 'var(--pg-violet)' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Accessibility & Motion</h3>
              <div style={{ fontSize: '0.8rem', color: 'var(--pg-steel)' }}>
                Manage motion sensitivity, 3D hardware rendering, and palette themes
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '640px' }}>
            {/* Motion Sensitivity Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#F8FAFC', borderRadius: 'var(--radius-card)', border: '1px solid #E2E8F0' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Three.js 3D & Ambient Particle Motion</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--pg-steel)' }}>
                  Disables rotating 3D graph and floating dust for users sensitive to motion (prefers-reduced-motion)
                </div>
              </div>
              <button
                type="button"
                onClick={() => onToggleMotion && onToggleMotion(!motionEnabled)}
                style={{
                  padding: '0.5rem 1.25rem',
                  borderRadius: 'var(--radius-pill)',
                  border: motionEnabled ? '2px solid var(--pg-violet)' : '1px solid #CBD5E1',
                  background: motionEnabled ? 'rgba(122, 15, 224, 0.1)' : '#FFF',
                  color: motionEnabled ? 'var(--pg-violet)' : 'var(--pg-steel)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                {motionEnabled ? 'Enabled' : 'Reduced Motion'}
              </button>
            </div>

            {/* Surface Theme */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#F8FAFC', borderRadius: 'var(--radius-card)', border: '1px solid #E2E8F0' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Color Palette Theme</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--pg-steel)' }}>
                  Silver metallic light mode or dark ink workbench
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setThemeMode('silver')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: 'var(--radius-pill)',
                    border: themeMode === 'silver' ? '2px solid var(--pg-violet)' : '1px solid #CBD5E1',
                    background: themeMode === 'silver' ? 'rgba(122, 15, 224, 0.1)' : '#FFF',
                    color: themeMode === 'silver' ? 'var(--pg-violet)' : 'var(--pg-steel)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Sun size={13} /> Silver
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('ink')}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: 'var(--radius-pill)',
                    border: themeMode === 'ink' ? '2px solid var(--pg-violet)' : '1px solid #CBD5E1',
                    background: themeMode === 'ink' ? 'rgba(122, 15, 224, 0.1)' : '#FFF',
                    color: themeMode === 'ink' ? 'var(--pg-violet)' : 'var(--pg-steel)',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Moon size={13} /> Ink
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

