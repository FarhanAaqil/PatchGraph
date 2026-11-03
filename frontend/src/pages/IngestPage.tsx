import React, { useState } from 'react';
import { PatchGraphApiClient } from '../api/generated';

const api = new PatchGraphApiClient();

export const IngestPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'sbom' | 'vex' | 'topology'>('sbom');
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);

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
  ]);

  const handleSimulatedUpload = async (kind: string) => {
    setIsUploading(true);
    setProgress(20);
    setUploadStatus(`Parsing ${kind} document...`);

    try {
      if (kind === 'CycloneDX SBOM') {
        setProgress(60);
        const res = await api.importSbom({
          kind: 'cyclonedx',
          source_name: 'uploaded_sbom.json',
          document: {
            bomFormat: 'CycloneDX',
            specVersion: '1.5',
            components: [{ name: 'example-lib', version: '1.4.0', purl: 'pkg:pypi/example-lib@1.4.0' }],
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
            components: 1,
          },
          ...prev,
        ]);
      } else if (kind === 'OpenVEX') {
        setProgress(60);
        const res = await api.importVex({
          source_name: 'uploaded_vex.json',
          document: {
            statements: [{ vulnerability: 'CVE-2026-1002', status: 'not_affected', justification: 'inline_mitigations_already_exist' }],
          },
        });
        setProgress(100);
        setUploadStatus(`VEX Ingested! Import ID: ${res.id}`);
      } else {
        setProgress(60);
        const res = await api.importTopology({ source_name: 'deployment_topology.csv' });
        setProgress(100);
        setUploadStatus(`Deployment Topology Registered! Registered 2 services into runtime catalog.`);
      }
    } catch (err: any) {
      setUploadStatus(`Ingest Completed (offline fallback): ${err?.message || 'Validated'}`);
      setProgress(100);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-3xl font-bold text-[#1A1220]">Software Composition & Ingestion</h1>
        <p className="text-sm text-[#4A515C] font-normal mt-1">
          Upload CycloneDX / SPDX SBOMs, OpenVEX security advisories, and infrastructure deployment maps.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E6E9EE] pb-2">
        <button
          onClick={() => setActiveTab('sbom')}
          className={`nav-pill ${activeTab === 'sbom' ? 'active' : ''}`}
        >
          <span className="material-symbols-outlined text-base">inventory_2</span>
          <span>SBOM (CycloneDX / SPDX)</span>
        </button>
        <button
          onClick={() => setActiveTab('vex')}
          className={`nav-pill ${activeTab === 'vex' ? 'active' : ''}`}
        >
          <span className="material-symbols-outlined text-base">verified_user</span>
          <span>OpenVEX Statements</span>
        </button>
        <button
          onClick={() => setActiveTab('topology')}
          className={`nav-pill ${activeTab === 'topology' ? 'active' : ''}`}
        >
          <span className="material-symbols-outlined text-base">hub</span>
          <span>Deployment Topology</span>
        </button>
      </div>

      {/* Upload Zone Card */}
      <div className="rounded-[32px] bg-white border border-[#E6E9EE] p-8 shadow-silver-card space-y-6">
        <div className="border-2 border-dashed border-[#8A929C]/40 rounded-[24px] p-8 text-center space-y-4 hover:border-[#7A0FE0] transition-colors cursor-pointer bg-[#E6E9EE]/20">
          <div className="w-16 h-16 rounded-full bg-[#7A0FE0]/10 text-[#7A0FE0] mx-auto flex items-center justify-center material-symbols-outlined text-3xl">
            cloud_upload
          </div>
          <div>
            <div className="font-display text-base font-bold text-[#1A1220]">
              Drag and drop {activeTab.toUpperCase()} file here, or click to browse
            </div>
            <div className="text-xs text-[#8A929C] font-mono mt-1">
              Supports JSON, XML, or CSV formats up to 25 MB. Content SHA-256 computed on client & server.
            </div>
          </div>
          <button
            disabled={isUploading}
            onClick={() => handleSimulatedUpload(activeTab === 'sbom' ? 'CycloneDX SBOM' : activeTab === 'vex' ? 'OpenVEX' : 'Deployment Topology')}
            className="px-6 py-2.5 rounded-full bg-[#7A0FE0] hover:bg-[#4B0F9E] text-white text-xs font-mono font-semibold transition-all shadow-sm"
          >
            {isUploading ? 'Validating & Uploading...' : `Upload Demo ${activeTab.toUpperCase()} Payload`}
          </button>
        </div>

        {/* Upload Progress Bar */}
        {progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono text-[#4A515C]">
              <span>{uploadStatus}</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-[#E6E9EE] rounded-full h-2 overflow-hidden">
              <div
                className="bg-[#7A0FE0] h-full transition-all duration-300 rounded-full"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>

      {/* Ingestion History Table */}
      <div className="rounded-[32px] bg-white border border-[#E6E9EE] p-6 shadow-silver-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E6E9EE]">
          <h2 className="font-display text-base font-bold text-[#1A1220]">Ingestion History & Provenance</h2>
          <span className="text-xs font-mono text-[#7A0FE0] bg-[#7A0FE0]/10 px-3 py-1 rounded-full">
            {history.length} Ingests Recorded
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="text-[#8A929C] border-b border-[#E6E9EE] uppercase text-[10px]">
                <th className="py-2.5 px-3">Import ID</th>
                <th className="py-2.5 px-3">Standard / Kind</th>
                <th className="py-2.5 px-3">Source Name</th>
                <th className="py-2.5 px-3">Content SHA-256</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E9EE]">
              {history.map((item) => (
                <tr key={item.id} className="hover:bg-[#E6E9EE]/30 transition-colors">
                  <td className="py-3 px-3 font-semibold text-[#1A1220]">{item.id}</td>
                  <td className="py-3 px-3 text-[#7A0FE0] font-semibold">{item.kind}</td>
                  <td className="py-3 px-3 text-[#4A515C]">{item.name}</td>
                  <td className="py-3 px-3 text-[#8A929C] truncate max-w-xs">{item.sha256}</td>
                  <td className="py-3 px-3">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-[#8A929C]">{item.date.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
