import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { PatchGraphApiClient, GraphNode, GraphEdge } from '../api/generated';
import { ThreeHeroScene } from '../components/ThreeHeroScene';
import {
  GitBranch,
  Filter,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ShieldAlert,
  ChevronRight,
  Info,
  Server,
  Package,
  Activity,
  ArrowRight
} from 'lucide-react';

const api = new PatchGraphApiClient();

interface GraphPageProps {
  onNavigateToPlanner?: () => void;
}

export const GraphPage: React.FC<GraphPageProps> = ({ onNavigateToPlanner }) => {
  const cyContainerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [envFilter, setEnvFilter] = useState<string>('all');
  const [kevOnly, setKevOnly] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [nodeCount, setNodeCount] = useState<number>(0);
  const [edgeCount, setEdgeCount] = useState<number>(0);

  useEffect(() => {
    if (viewMode !== '2d' || !cyContainerRef.current) return;

    // Load graph data from real API
    api.getFullGraph({
      environment: envFilter !== 'all' ? envFilter : undefined,
      in_kev: kevOnly ? true : undefined,
    }).then((res) => {
      setNodeCount(res.nodes.length);
      setEdgeCount(res.edges.length);

      const cyElements: any[] = [];

      res.nodes.forEach((n: GraphNode) => {
        let bgColor = '#8A929C';
        let shape: cytoscape.Css.NodeShape = 'ellipse';

        if (n.severity === 'critical') {
          bgColor = '#7A0FE0'; // Violet
          shape = 'diamond';
        } else if (n.kind === 'service') {
          bgColor = '#4B0F9E'; // Indigo
          shape = 'round-rectangle';
        } else if (n.kind === 'application') {
          bgColor = '#1A1220'; // Ink
          shape = 'hexagon';
        }

        cyElements.push({
          data: {
            id: n.id,
            label: n.label,
            kind: n.kind,
            severity: n.severity || 'safe',
            cvss: n.cvss || 0,
            reachability: n.reachability || 'normal',
            in_kev: n.in_kev || false,
            color: bgColor,
            shape: shape,
          },
        });
      });

      res.edges.forEach((e: GraphEdge, idx: number) => {
        cyElements.push({
          data: {
            id: `edge_${idx}`,
            source: e.source,
            target: e.target,
            is_patch_path: e.is_patch_path || false,
            lineColor: e.is_patch_path ? '#7A0FE0' : '#8A929C',
          },
        });
      });

      if (cyRef.current) {
        cyRef.current.destroy();
      }

      const cy = cytoscape({
        container: cyContainerRef.current,
        elements: cyElements,
        style: [
          {
            selector: 'node',
            style: {
              'background-color': 'data(color)',
              label: 'data(label)',
              'font-family': 'DM Sans, sans-serif',
              'font-size': '11px',
              'font-weight': 700,
              color: '#1A1220',
              'text-valign': 'bottom',
              'text-margin-y': 7,
              shape: 'data(shape)' as any,
              width: 40,
              height: 40,
              'border-width': 2.5,
              'border-color': '#FFFFFF',
            },
          },
          {
            selector: 'edge',
            style: {
              width: 2.5,
              'line-color': 'data(lineColor)',
              'target-arrow-color': 'data(lineColor)',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              opacity: 0.85,
            },
          },
          {
            selector: 'node:selected',
            style: {
              'border-width': 4,
              'border-color': '#7A0FE0',
            },
          },
        ],
        layout: {
          name: 'breadthfirst',
          directed: true,
          padding: 40,
          spacingFactor: 1.35,
        },
      });

      cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        const data = node.data();
        api.getGraphNode(data.id).then((detail) => {
          setSelectedNode(detail);
        });
      });

      cyRef.current = cy;
    });

    return () => {
      if (cyRef.current) cyRef.current.destroy();
    };
  }, [envFilter, kevOnly, viewMode]);

  const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
  const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
  const handleFit = () => cyRef.current?.fit(undefined, 30);

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1440px', margin: '0 auto', color: 'var(--color-ink)' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span className="pill-chip pill-chip-violet">
              <GitBranch size={14} style={{ marginRight: '0.35rem' }} /> Topology Analysis
            </span>
            <span className="pill-chip pill-chip-demo">Demo data</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', letterSpacing: '-0.03em', margin: 0, fontWeight: 800 }}>
            Dependency & Deployment Graph
          </h1>
          <p style={{ color: 'var(--color-steel-gray)', marginTop: '0.5rem', fontSize: '1rem', maxWidth: '680px' }}>
            Bounded reverse traversal with reachability hop decay across packages, services, runtime clusters, and asset owners.
          </p>
        </div>

        {/* View Mode & Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* 2D / 3D Toggle */}
          <div style={{ display: 'flex', background: '#FFFFFF', padding: '0.3rem', borderRadius: 'var(--radius-pill)', border: '1px solid #CBD5E1' }}>
            <button
              type="button"
              onClick={() => setViewMode('2d')}
              style={{
                padding: '0.45rem 1.15rem',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: viewMode === '2d' ? 'var(--color-violet)' : 'transparent',
                color: viewMode === '2d' ? '#FFFFFF' : 'var(--color-steel-gray)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              2D Cytoscape
            </button>
            <button
              type="button"
              onClick={() => setViewMode('3d')}
              style={{
                padding: '0.45rem 1.15rem',
                borderRadius: 'var(--radius-pill)',
                border: 'none',
                background: viewMode === '3d' ? 'var(--color-violet)' : 'transparent',
                color: viewMode === '3d' ? '#FFFFFF' : 'var(--color-steel-gray)',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              3D Universe
            </button>
          </div>

          {/* Environment Filter */}
          <select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: 'var(--radius-pill)',
              border: '1px solid #CBD5E1',
              background: '#FFFFFF',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-body)',
              fontWeight: 600,
            }}
          >
            <option value="all">All Environments</option>
            <option value="production">Production Only</option>
            <option value="staging">Staging Only</option>
          </select>

          {/* KEV Toggle */}
          <button
            type="button"
            onClick={() => setKevOnly(!kevOnly)}
            style={{
              padding: '0.55rem 1.25rem',
              borderRadius: 'var(--radius-pill)',
              border: kevOnly ? '2px solid #DC2626' : '1px solid #CBD5E1',
              background: kevOnly ? '#FEE2E2' : '#FFFFFF',
              color: kevOnly ? '#DC2626' : 'var(--color-ink)',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {kevOnly ? '● CISA KEV Filter Active' : 'Filter KEV'}
          </button>
        </div>
      </div>

      {/* Main Graph Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedNode ? '1fr 360px' : '1fr', gap: '1.5rem' }}>
        {/* Graph Canvas Container */}
        <div
          className="pg-card"
          style={{
            position: 'relative',
            height: '620px',
            background: '#FFFFFF',
            borderRadius: 'var(--radius-frame)',
            overflow: 'hidden',
          }}
        >
          {viewMode === '2d' ? (
            <>
              {/* Cytoscape Canvas */}
              <div ref={cyContainerRef} style={{ width: '100%', height: '100%' }} />

              {/* Floating Canvas Controls */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '1.5rem',
                  right: '1.5rem',
                  display: 'flex',
                  gap: '0.5rem',
                  background: 'rgba(255, 255, 255, 0.9)',
                  padding: '0.4rem',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid #CBD5E1',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                }}
              >
                <button
                  type="button"
                  onClick={handleZoomIn}
                  style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleFit}
                  style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Fit to Canvas"
                >
                  <Maximize2 size={16} />
                </button>
              </div>

              {/* Top-left Graph Legend */}
              <div
                style={{
                  position: 'absolute',
                  top: '1.5rem',
                  left: '1.5rem',
                  background: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(8px)',
                  padding: '0.75rem 1.25rem',
                  borderRadius: '16px',
                  border: '1px solid #CBD5E1',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--color-ink)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                  Topology Legend
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '10px', height: '10px', transform: 'rotate(45deg)', background: 'var(--color-violet)' }} />
                  <span>Critical Vulnerability</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--color-indigo)' }} />
                  <span>Production Microservice</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-steel-gray)' }} />
                  <span>Upstream Package</span>
                </div>
              </div>
            </>
          ) : (
            <ThreeHeroScene
              onNodeClick={(id) => {
                api.getGraphNode(id).then((detail) => setSelectedNode(detail));
              }}
            />
          )}
        </div>

        {/* Side Node Inspector Panel */}
        {selectedNode && (
          <div
            className="pg-card"
            style={{
              padding: '2rem',
              background: '#FFFFFF',
              borderRadius: 'var(--radius-frame)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              maxHeight: '620px',
              overflowY: 'auto',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span className="pill-chip pill-chip-violet">Node Inspector</span>
                <button
                  type="button"
                  onClick={() => setSelectedNode(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--color-steel-gray)' }}
                >
                  ✕
                </button>
              </div>

              <h3 style={{ margin: '0 0 0.25rem 0', fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 800 }}>
                {selectedNode.label}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', marginBottom: '1.5rem' }}>
                ID: {selectedNode.id} • Kind: {selectedNode.kind}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.85rem' }}>
                <div style={{ padding: '0.85rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', textTransform: 'uppercase', fontWeight: 600 }}>Reachability State</div>
                  <div style={{ fontWeight: 700, color: 'var(--color-ink)', marginTop: '0.2rem' }}>
                    {selectedNode.reachability || 'Public Ingress Reachable (1 hop)'}
                  </div>
                </div>

                <div style={{ padding: '0.85rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', textTransform: 'uppercase', fontWeight: 600 }}>Blast Radius</div>
                  <div style={{ fontWeight: 700, color: 'var(--color-violet)', marginTop: '0.2rem' }}>
                    {selectedNode.blast_radius ? `${selectedNode.blast_radius} assets exposed` : '2 services, 1 prod cluster'}
                  </div>
                </div>

                <div style={{ padding: '0.85rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', textTransform: 'uppercase', fontWeight: 600 }}>Associated Findings</div>
                  <div style={{ fontWeight: 700, color: '#DC2626', marginTop: '0.2rem' }}>
                    {selectedNode.vulnerabilities?.length || 1} active finding (CVE-2026-1001)
                  </div>
                </div>
              </div>
            </div>

            {onNavigateToPlanner && (
              <button
                type="button"
                onClick={onNavigateToPlanner}
                style={{
                  marginTop: '1.5rem',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-violet)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>Plan Upgrade Sequence</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphPage;
