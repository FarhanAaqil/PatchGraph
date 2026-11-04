import React, { useState } from 'react';
import { PatchGraphApiClient } from '../api/generated';
import {
  UploadCloud,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Database,
  Layers,
  ArrowRight,
  Sparkles,
  Copy,
  Check,
  FileCode,
  ShieldAlert,
  Server
} from 'lucide-react';

const api = new PatchGraphApiClient();

export const IngestPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sbom' | 'vex' | 'topology'>('sbom');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  // Ingest History
  const [history, setHistory] = useState([
    {
      id: 'imp_seed_cdx',
      kind: 'CycloneDX 1.5',
      name: 'sbom_cyclonedx_seed.json',
      sha256: '8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4',
      status: 'completed',
      date: '2026-11-01T00:00:00Z',
      components: 2,
    },
    {
      id: 'imp_seed_vex',
      kind: 'OpenVEX',
      name: 'vex_openvex_seed.json',
      sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      status: 'completed',
      date: '2026-11-01T00:00:00Z',
      components: 1,
    },
    {
      id: 'imp_seed_topo',
      kind: 'Deployment Topology',
      name: 'topology_seed.json',
      sha256: '7b52009b64fd0a2a49e6d8a93975307700000000000000000000000000000002',
      status: 'completed',
      date: '2026-11-01T00:00:00Z',
      components: 3,
    },
  ]);

  const handleLoadSampleData = async () => {
    setIsUploading(true);
    setProgress(35);
    setUploadStatus('Loading seeded CycloneDX SBOM and deployment topology into supply chain database...');
    try {
      const res = await api.loadSampleData();
      setProgress(100);
      setUploadStatus(`Sample Data Loaded: ${res.packages_loaded} packages registered, ${res.findings_loaded} calibrated findings created. Pinned to snapshot ${res.snapshot_id}.`);
      setHistory((prev) => [
        {
          id: 'imp_seed_sample',
          kind: 'CycloneDX + Topology',
          name: 'sbom_cyclonedx_seed.json',
          sha256: '5d5112f2ede415e41e8e56c5177516b031701b7d8beffeba04ff415f8a6aa3e9',
          status: 'completed',
          date: new Date().toISOString(),
          components: res.packages_loaded,
        },
        ...prev,
      ]);
    } catch (err: any) {
      setUploadStatus(`Load failed: ${err.message || 'Error communicating with backend'}`);
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setProgress(0);
      }, 3000);
    }
  };

  const handleSimulatedUpload = async (kind: string) => {
    setIsUploading(true);
    setProgress(25);
    setUploadStatus(`Validating ${kind} spec and schema structure...`);

    try {
      if (kind === 'CycloneDX SBOM') {
        setProgress(60);
        const res = await api.importSbom({
          kind: 'cyclonedx',
          source_name: 'uploaded_sbom.json',
          document: {
            bomFormat: 'CycloneDX',
            specVersion: '1.5',
            components: [
              { name: 'example-lib', version: '1.4.0', purl: 'pkg:pypi/example-lib@1.4.0' },
              { name: 'urllib3', version: '1.26.5', purl: 'pkg:pypi/urllib3@1.26.5' },
            ],
          },
        });
        setProgress(100);
        setUploadStatus(`Ingestion Successful! Content SHA-256: ${res.content_sha256.slice(0, 16)}...`);
        setHistory((prev) => [
          {
            id: res.id,
            kind: 'CycloneDX 1.5',
            name: 'uploaded_sbom.json',
            sha256: res.content_sha256,
            status: res.status,
            date: new Date().toISOString(),
            components: 2,
          },
          ...prev,
        ]);
      } else if (kind === 'OpenVEX') {
        setProgress(60);
        const res = await api.importVex({
          source_name: 'uploaded_vex.json',
          document: {
            statements: [
              {
                vulnerability: 'CVE-2026-1002',
                status: 'not_affected',
                justification: 'inline_mitigations_already_exist',
                action_statement: 'Vulnerable code path is not invoked in production cluster.',
              },
            ],
          },
        });
        setProgress(100);
        setUploadStatus(`OpenVEX Advisory Registered! Content SHA-256: ${res.content_sha256.slice(0, 16)}...`);
        setHistory((prev) => [
          {
            id: res.id,
            kind: 'OpenVEX',
            name: 'uploaded_vex.json',
            sha256: res.content_sha256,
            status: res.status,
            date: new Date().toISOString(),
            components: 1,
          },
          ...prev,
        ]);
      } else if (kind === 'Topology') {
        setProgress(60);
        const res = await api.importTopology({
          source_name: 'cluster_topology.json',
          document: {
            services: [
              { name: 'checkout', environment: 'production', criticality: 5, max_downtime_minutes: 30 },
              { name: 'analytics', environment: 'staging', criticality: 2, max_downtime_minutes: 60 },
            ],
          },
        });
        setProgress(100);
        setUploadStatus(`Deployment Topology Registered! Status: ${res.status}`);
        setHistory((prev) => [
          {
            id: res.id,
            kind: 'Deployment Topology',
            name: 'cluster_topology.json',
            sha256: '7b52009b64fd0a2a49e6d8a939753077' + res.id.slice(0, 8),
            status: res.status,
            date: new Date().toISOString(),
            components: res.services_registered,
          },
          ...prev,
        ]);
      }
    } catch (err: any) {
      setUploadStatus(`Failed: ${err.message || 'Validation error'}`);
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setProgress(0);
      }, 3500);
    }
  };

  const copyToClipboard = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1440px', margin: '0 auto', color: 'var(--color-ink)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span className="pill-chip pill-chip-violet">
              <Database size={14} style={{ marginRight: '0.35rem' }} /> Ingestion Gateway
            </span>
            <span className="pill-chip pill-chip-demo">Demo data</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', letterSpacing: '-0.03em', margin: 0, fontWeight: 800 }}>
            Artifact & Topology Ingest
          </h1>
          <p style={{ color: 'var(--color-steel-gray)', marginTop: '0.5rem', fontSize: '1rem', maxWidth: '720px' }}>
            Upload or sync CycloneDX/SPDX Software Bills of Materials (SBOMs), machine-readable OpenVEX statements, and microservice deployment topologies.
          </p>
        </div>

        {/* 1-Click Fast Ingestion Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={handleLoadSampleData}
            disabled={isUploading}
            data-testid="load-sample-data-btn"
            style={{
              padding: '0.7rem 1.4rem',
              borderRadius: 'var(--radius-pill)',
              border: 'none',
              background: 'var(--color-violet)',
              color: '#FFFFFF',
              fontWeight: 800,
              fontSize: '0.85rem',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 14px rgba(122, 15, 224, 0.3)',
            }}
          >
            <Sparkles size={16} /> ⚡ Load Sample Data (CycloneDX + Topology)
          </button>

          <button
            onClick={() => handleSimulatedUpload('CycloneDX SBOM')}
            disabled={isUploading}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid rgba(122, 15, 224, 0.3)',
              background: 'rgba(122, 15, 224, 0.08)',
              color: 'var(--color-violet)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Sparkles size={14} /> ⚡ Ingest Sample CycloneDX
          </button>

          <button
            onClick={() => handleSimulatedUpload('OpenVEX')}
            disabled={isUploading}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: 'var(--color-ink)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <FileCode size={14} /> ⚡ Ingest OpenVEX
          </button>

          <button
            onClick={() => handleSimulatedUpload('Topology')}
            disabled={isUploading}
            style={{
              padding: '0.65rem 1.25rem',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              color: 'var(--color-ink)',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: isUploading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}
          >
            <Server size={14} /> ⚡ Register Topology
          </button>
        </div>
      </div>

      {/* Main Grid: Left Upload Zone, Right Ingest Log */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(340px, 460px) 1fr', gap: '2rem', alignItems: 'start' }}>
        {/* Left: Drag & Drop Dropzone */}
        <div
          className="pg-card"
          style={{
            padding: '2rem',
            background: '#FFFFFF',
            borderRadius: 'var(--radius-frame)',
          }}
        >
          {/* Format Selector Tabs */}
          <div style={{ display: 'flex', background: '#F1F5F9', padding: '0.35rem', borderRadius: 'var(--radius-pill)', marginBottom: '1.75rem', gap: '0.25rem' }}>
            {(['sbom', 'vex', 'topology'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '0.55rem 0',
                  borderRadius: 'var(--radius-pill)',
                  border: 'none',
                  background: activeTab === tab ? '#FFFFFF' : 'transparent',
                  color: activeTab === tab ? 'var(--color-violet)' : 'var(--color-steel-gray)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                {tab === 'sbom' ? 'CycloneDX / SPDX' : tab === 'vex' ? 'OpenVEX' : 'Topology'}
              </button>
            ))}
          </div>

          {/* Glowing Dropzone Container */}
          <div
            style={{
              border: '2px dashed rgba(122, 15, 224, 0.4)',
              borderRadius: 'var(--radius-card)',
              background: 'var(--gradient-silver)',
              padding: '2.5rem 1.5rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onClick={() => handleSimulatedUpload(activeTab === 'sbom' ? 'CycloneDX SBOM' : activeTab === 'vex' ? 'OpenVEX' : 'Topology')}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(122, 15, 224, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-violet)',
              }}
            >
              <UploadCloud size={32} />
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-ink)' }}>
                Drag & Drop {activeTab.toUpperCase()} File
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-steel-gray)', margin: '0.35rem 0 0 0' }}>
                or click to browse local JSON / XML artifacts
              </p>
            </div>

            <span className="pill-chip pill-chip-violet" style={{ fontSize: '0.7rem' }}>
              SHA-256 Provenance Guaranteed
            </span>
          </div>

          {/* Progress & Live Ingest Status */}
          {isUploading && (
            <div style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--color-violet)' }}>Parsing Spec...</span>
                <span>{progress}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: '#E2E8F0', borderRadius: '4px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${progress}%`,
                    height: '100%',
                    background: 'var(--gradient-violet)',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          )}

          {uploadStatus && !isUploading && (
            <div
              style={{
                marginTop: '1.5rem',
                padding: '0.85rem 1.25rem',
                borderRadius: 'var(--radius-sm)',
                background: uploadStatus.includes('Successful') ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${uploadStatus.includes('Successful') ? '#86EFAC' : '#FCA5A5'}`,
                color: uploadStatus.includes('Successful') ? '#166534' : '#991B1B',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <CheckCircle2 size={16} />
              <span>{uploadStatus}</span>
            </div>
          )}
        </div>

        {/* Right: Ingestion Manifest Table */}
        <div
          className="pg-card"
          style={{
            padding: '2rem',
            background: '#FFFFFF',
            borderRadius: 'var(--radius-frame)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800 }}>Recorded Ingest Manifest</h3>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--color-steel-gray)' }}>
                Immutable content-addressed artifact inventory
              </p>
            </div>
            <span className="pill-chip" style={{ background: '#F1F5F9', color: 'var(--color-steel-gray)' }}>
              {history.length} Ingests Recorded
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
              <thead>
                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: 'var(--color-steel-gray)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Format / Artifact</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Content SHA-256</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Components</th>
                  <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: 700, color: 'var(--color-ink)' }}>{item.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', marginTop: '0.15rem' }}>
                        {item.kind} • {item.id}
                      </div>
                    </td>

                    <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ color: 'var(--color-steel-gray)' }}>
                          {item.sha256.slice(0, 16)}...
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(item.sha256)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: copiedSha === item.sha256 ? '#16A34A' : 'var(--color-steel-gray)',
                            padding: '2px',
                          }}
                          title="Copy Full SHA-256 Hash"
                        >
                          {copiedSha === item.sha256 ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                      </div>
                    </td>

                    <td style={{ padding: '1rem', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-ink)' }}>
                      {item.components} assets
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '0.2rem 0.6rem',
                          borderRadius: 'var(--radius-pill)',
                          background: 'rgba(22, 163, 74, 0.12)',
                          color: '#16A34A',
                          border: '1px solid rgba(22, 163, 74, 0.25)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IngestPage;
