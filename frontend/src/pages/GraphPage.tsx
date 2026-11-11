import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { PatchGraphApiClient, GraphNode, GraphEdge } from '../api/generated';
import { ThreeHeroScene } from '../components/ThreeHeroScene';
import {
  GitBranch,
  
  
  ZoomIn,
  ZoomOut,
  Maximize2,
  ShieldAlert,
  
  
  
  
  
  ArrowRight,
  
  RotateCcw,
  User,
  
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
  const [, setIsLoadingNode] = useState<boolean>(false);
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
        let bgColor = '#8A929C'; // Steel Gray
        let shape: cytoscape.Css.NodeShape = 'ellipse';
        let borderColor = '#CBD5E1';
        let borderWidth = 2;

        if (n.severity === 'critical' || (n.cvss && n.cvss >= 8.0) || n.in_kev) {
          bgColor = '#7A0FE0'; // Violet
          shape = 'diamond';
          borderColor = '#E6E9EE';
          borderWidth = 3;
        } else if (n.kind === 'service') {
          bgColor = '#4B0F9E'; // Indigo
          shape = 'round-rectangle';
          borderColor = '#93C5FD';
          borderWidth = 2.5;
        } else if (n.kind === 'application') {
          bgColor = '#1A1220'; // Ink
          shape = 'hexagon';
          borderColor = '#E6E9EE';
          borderWidth = 2.5;
        }

        cyElements.push({
          data: {
            id: n.id,
            label: n.label,
            kind: n.kind,
            severity: n.severity || 'safe',
            cvss: n.cvss || 0,
            reachability: n.reachability || 'reachable_prod',
            in_kev: n.in_kev || false,
            color: bgColor,
            shape: shape,
            borderColor: borderColor,
            borderWidth: borderWidth,
          },
        });
      });

      res.edges.forEach((e: GraphEdge, idx: number) => {
        const isPatchPath = e.is_patch_path || false;
        cyElements.push({
          data: {
            id: `edge_${idx}`,
            source: e.source,
            target: e.target,
            is_patch_path: isPatchPath,
            lineColor: isPatchPath ? '#7A0FE0' : 'rgba(138, 146, 156, 0.45)',
            lineWidth: isPatchPath ? 3.5 : 2,
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
              color: '#FFFFFF',
              'text-valign': 'bottom',
              'text-margin-y': 8,
              'text-background-color': '#1A1220',
              'text-background-opacity': 0.85,
              'text-background-padding': '3px',
              'text-background-shape': 'roundrectangle',
              shape: 'data(shape)' as any,
              width: 44,
              height: 44,
              'border-width': 'data(borderWidth)',
              'border-color': 'data(borderColor)',
              'transition-property': 'background-color, border-color, width, height, opacity',
              'transition-duration': 0.2,
            },
          },
          {
            selector: 'edge',
            style: {
              width: 'data(lineWidth)',
              'line-color': 'data(lineColor)',
              'target-arrow-color': 'data(lineColor)',
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              opacity: 0.85,
              'arrow-scale': 1.2,
              'transition-property': 'line-color, opacity, width',
              'transition-duration': 0.2,
            },
          },
          {
            selector: 'node.highlighted',
            style: {
              'border-width': 4,
              'border-color': '#FFFFFF',
              'background-color': '#7A0FE0',
              width: 52,
              height: 52,
              opacity: 1,
              'z-index': 100,
            },
          },
          {
            selector: 'edge.highlighted',
            style: {
              width: 4.5,
              'line-color': '#7A0FE0',
              'target-arrow-color': '#7A0FE0',
              opacity: 1,
              'z-index': 90,
            },
          },
          {
            selector: '.faded',
            style: {
              opacity: 0.15,
            },
          },
        ],
        layout: {
          name: 'breadthfirst',
          directed: true,
          padding: 50,
          spacingFactor: 1.4,
        },
      });

      // Interactive node tap handler with path highlighting
      cy.on('tap', 'node', (evt) => {
        const node = evt.target;
        const data = node.data();

        // Highlight neighborhood
        const neighborhood = node.neighborhood().add(node);
        cy.elements().removeClass('highlighted faded');
        cy.elements().difference(neighborhood).addClass('faded');
        neighborhood.addClass('highlighted');

        setIsLoadingNode(true);
        api.getGraphNode(data.id)
          .then((detail) => {
            setSelectedNode(detail);
          })
          .catch((err) => {
            console.error('Failed to load node detail', err);
            setSelectedNode(data);
          })
          .finally(() => {
            setIsLoadingNode(false);
          });
      });

      // Background tap clears selection
      cy.on('tap', (evt) => {
        if (evt.target === cy) {
          cy.elements().removeClass('highlighted faded');
          setSelectedNode(null);
        }
      });

      cyRef.current = cy;
    });

    return () => {
      if (cyRef.current) cyRef.current.destroy();
    };
  }, [envFilter, kevOnly, viewMode]);

  const handleZoomIn = () => {
    if (!cyRef.current) return;
    cyRef.current.animate({
      zoom: cyRef.current.zoom() * 1.3,
      duration: 200,
    });
  };

  const handleZoomOut = () => {
    if (!cyRef.current) return;
    cyRef.current.animate({
      zoom: cyRef.current.zoom() * 0.75,
      duration: 200,
    });
  };

  const handleFit = () => {
    if (!cyRef.current) return;
    cyRef.current.animate({
      fit: { eles: cyRef.current.elements(), padding: 40 },
      duration: 300,
    });
  };

  const handleReset = () => {
    if (!cyRef.current) return;
    cyRef.current.elements().removeClass('highlighted faded');
    setSelectedNode(null);
    cyRef.current.layout({
      name: 'breadthfirst',
      directed: true,
      padding: 50,
      spacingFactor: 1.4,
    }).run();
    handleFit();
  };

  const focusNodeById = (nodeId: string) => {
    if (!cyRef.current) return;
    const target = cyRef.current.$id(nodeId);
    if (target && target.length > 0) {
      const neighborhood = target.neighborhood().add(target);
      cyRef.current.elements().removeClass('highlighted faded');
      cyRef.current.elements().difference(neighborhood).addClass('faded');
      neighborhood.addClass('highlighted');
      cyRef.current.animate({
        center: { eles: target },
        zoom: 1.5,
        duration: 350,
      });
      api.getGraphNode(nodeId).then((res) => setSelectedNode(res));
    }
  };

  return (
    <div style={{ padding: '2.5rem', maxWidth: '1440px', margin: '0 auto', color: 'var(--color-ink)' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span className="pill-chip" style={{ background: 'rgba(122, 15, 224, 0.1)', color: 'var(--color-violet)', border: '1px solid rgba(122, 15, 224, 0.25)' }}>
              <GitBranch size={14} style={{ marginRight: '0.35rem' }} /> Topology Analysis
            </span>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-steel-gray)' }}>
              {nodeCount} Nodes • {edgeCount} Ingress Edges
            </span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.25rem', letterSpacing: '-0.03em', margin: 0, fontWeight: 800 }}>
            Dependency & Deployment Graph
          </h1>
          <p style={{ color: 'var(--color-steel-gray)', marginTop: '0.5rem', fontSize: '1rem', maxWidth: '700px' }}>
            Bounded reverse traversal with reachability hop decay across packages, services, runtime clusters, and asset owners. Click any node to inspect blast radius and exploit reachability.
          </p>
        </div>

        {/* View Mode & Filter Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* 2D / 3D Toggle */}
          <div style={{ display: 'flex', background: '#FFFFFF', padding: '0.25rem', borderRadius: 'var(--radius-pill)', border: '1px solid #CBD5E1' }}>
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
                transition: 'all 0.15s ease',
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
                transition: 'all 0.15s ease',
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
              cursor: 'pointer',
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
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              transition: 'all 0.15s ease',
            }}
          >
            <ShieldAlert size={14} />
            <span>CISA KEV Only</span>
          </button>
        </div>
      </div>

      {/* Main Graph Grid with Side Inspector */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: selectedNode ? 'minmax(0, 1fr) 380px' : '1fr',
          gap: '1.5rem',
          alignItems: 'start',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Cytoscape / 3D Canvas Box */}
        <div
          style={{
            position: 'relative',
            height: '660px',
            background: '#150D1D',
            borderRadius: 'var(--radius-frame)',
            border: '1px solid rgba(138, 146, 156, 0.25)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.45)',
            overflow: 'hidden',
          }}
        >
          {viewMode === '2d' ? (
            <>
              {/* Cytoscape DOM container */}
              <div
                data-testid="cytoscape-graph-container"
                ref={cyContainerRef}
                style={{
                  width: '100%',
                  height: '100%',
                  background: 'radial-gradient(circle at 50% 50%, #20132C 0%, #150D1D 100%)',
                }}
              />

              {/* Floating Graph HUD Controls */}
              <div
                style={{
                  position: 'absolute',
                  top: '1.5rem',
                  right: '1.5rem',
                  display: 'flex',
                  gap: '0.5rem',
                  background: 'rgba(26, 18, 32, 0.85)',
                  backdropFilter: 'blur(12px)',
                  padding: '0.35rem 0.5rem',
                  borderRadius: 'var(--radius-pill)',
                  border: '1px solid rgba(138, 146, 156, 0.3)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                  zIndex: 20,
                }}
              >
                <button
                  type="button"
                  onClick={handleZoomIn}
                  style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: 'rgba(255, 255, 255, 0.08)', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Zoom In"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: 'rgba(255, 255, 255, 0.08)', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Zoom Out"
                >
                  <ZoomOut size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleFit}
                  style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: 'rgba(255, 255, 255, 0.08)', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Fit to Canvas"
                >
                  <Maximize2 size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  style={{ width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: 'rgba(255, 255, 255, 0.08)', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Reset Layout & Highlights"
                >
                  <RotateCcw size={16} />
                </button>
              </div>

              {/* Top-left Graph Legend */}
              <div
                style={{
                  position: 'absolute',
                  top: '1.5rem',
                  left: '1.5rem',
                  background: 'rgba(26, 18, 32, 0.88)',
                  backdropFilter: 'blur(12px)',
                  padding: '0.85rem 1.25rem',
                  borderRadius: '16px',
                  border: '1px solid rgba(138, 146, 156, 0.25)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                  fontSize: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.45rem',
                  color: '#E6E9EE',
                  zIndex: 20,
                }}
              >
                <div style={{ fontWeight: 800, color: 'var(--color-silver)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>
                  Topology Legend
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '10px', height: '10px', transform: 'rotate(45deg)', background: 'var(--color-violet)', boxShadow: '0 0 8px var(--color-violet)' }} />
                  <span>Critical Vulnerability Node</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--color-indigo)' }} />
                  <span>Production Microservice</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-steel-gray)' }} />
                  <span>Upstream Dependency</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.2rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(138, 146, 156, 0.2)' }}>
                  <span style={{ width: '16px', height: '3px', background: '#7A0FE0' }} />
                  <span>Remediation Patch Path</span>
                </div>
              </div>

              {/* Bottom Instructions Pill */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '1.25rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 20,
                  pointerEvents: 'none',
                }}
              >
                <span
                  style={{
                    background: 'rgba(26, 18, 32, 0.85)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(138, 146, 156, 0.25)',
                    padding: '0.4rem 1.25rem',
                    borderRadius: 'var(--radius-pill)',
                    fontSize: '0.75rem',
                    color: '#8A929C',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  Click any node to isolate reachability path • Drag canvas to pan
                </span>
              </div>
            </>
          ) : (
            <ThreeHeroScene
              onNodeClick={(id) => {
                focusNodeById(id);
              }}
            />
          )}
        </div>

        {/* Side Node Blast Radius & Path Inspector Panel */}
        {selectedNode && (
          <div
            className="pg-card"
            style={{
              padding: '2rem',
              background: '#FFFFFF',
              borderRadius: 'var(--radius-frame)',
              border: '2px solid rgba(122, 15, 224, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              maxHeight: '660px',
              overflowY: 'auto',
              boxShadow: '0 16px 40px rgba(0, 0, 0, 0.08)',
            }}
          >
            <div>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <span className="pill-chip" style={{ background: 'rgba(122, 15, 224, 0.1)', color: 'var(--color-violet)', fontWeight: 700 }}>
                  Node Inspector
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNode(null);
                    if (cyRef.current) cyRef.current.elements().removeClass('highlighted faded');
                  }}
                  style={{
                    background: '#F1F5F9',
                    border: 'none',
                    borderRadius: '50%',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: 'var(--color-steel-gray)',
                  }}
                  title="Close inspector"
                >
                  ✕
                </button>
              </div>

              <h3 style={{ margin: '0 0 0.25rem 0', fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 800 }}>
                {selectedNode.label || selectedNode.id}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', marginBottom: '1.5rem', fontFamily: 'var(--font-mono)' }}>
                ID: {selectedNode.id} • Kind: {selectedNode.kind || 'package_version'}
              </div>

              {/* Metric & Diagnostics Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Reachability & Why Affected */}
                <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>
                    Reachability State
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--color-ink)', fontSize: '0.9rem' }}>
                    {selectedNode.reachability === 'reachable_prod' ? 'Public Ingress Reachable (1 hop)' : (selectedNode.reachability || 'Active in Staging')}
                  </div>
                  <p style={{ margin: '0.4rem 0 0 0', fontSize: '0.8rem', color: 'var(--color-steel-gray)', lineHeight: '1.4' }}>
                    {selectedNode.vex_statement?.justification || 'Transitive requirement of service:checkout reachable via public API gateway.'}
                  </p>
                </div>

                {/* Blast Radius Score */}
                <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Blast Radius Score
                    </div>
                    <div style={{ fontSize: '1.25rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--color-violet)', marginTop: '0.2rem' }}>
                      {selectedNode.blast_radius_score || selectedNode.blast_radius || '14.2'} pts
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--color-steel-gray)' }}>
                    <div><strong>2</strong> Services</div>
                    <div><strong>1</strong> Prod Cluster</div>
                  </div>
                </div>

                {/* Upstream Callers */}
                {selectedNode.upstream_callers && selectedNode.upstream_callers.length > 0 && (
                  <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-steel-gray)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.4rem' }}>
                      Upstream Ingress Callers
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {selectedNode.upstream_callers.map((caller: string) => (
                        <span
                          key={caller}
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.75rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: 'var(--radius-pill)',
                            background: '#FFF',
                            border: '1px solid #CBD5E1',
                            color: 'var(--color-ink)',
                          }}
                        >
                          {caller}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Asset Owner Team */}
                <div style={{ padding: '1rem', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <User size={16} style={{ color: 'var(--color-violet)' }} />
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-steel-gray)', textTransform: 'uppercase', fontWeight: 700 }}>
                      Asset Owner
                    </div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-ink)', fontFamily: 'var(--font-mono)' }}>
                      {selectedNode.owner || 'payments-team@patchgraph.local'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action CTA to Planner */}
            {onNavigateToPlanner && (
              <button
                type="button"
                onClick={onNavigateToPlanner}
                style={{
                  marginTop: '1.5rem',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 'var(--radius-pill)',
                  background: 'var(--color-violet)',
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(122, 15, 224, 0.35)',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>Plan Remediation Sequence</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphPage;
