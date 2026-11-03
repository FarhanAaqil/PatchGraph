import React, { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import { PatchGraphApiClient, GraphNode, GraphEdge } from '../api/generated';

const api = new PatchGraphApiClient();

export const GraphPage: React.FC = () => {
  const cyContainerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);

  const [envFilter, setEnvFilter] = useState<string>('all');
  const [kevOnly, setKevOnly] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');

  useEffect(() => {
    if (!cyContainerRef.current) return;

    // Load graph data from real API
    api.getFullGraph({
      environment: envFilter !== 'all' ? envFilter : undefined,
      in_kev: kevOnly ? true : undefined,
    }).then((res) => {
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
              'font-weight': 600,
              color: '#1A1220',
              'text-valign': 'bottom',
              'text-margin-y': 6,
              shape: 'data(shape)' as any,
              width: 38,
              height: 38,
              'border-width': 2,
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
              opacity: 0.8,
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
          padding: 30,
          spacingFactor: 1.25,
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
  }, [envFilter, kevOnly]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E6E9EE]">
        <div>
          <h1 className="font-display text-3xl font-bold text-[#1A1220]">Typed Dependency & Deployment Graph</h1>
          <p className="text-sm text-[#4A515C] font-normal">
            Bounded reverse traversal with reachability hop decay across packages, services, and environments.
          </p>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={envFilter}
            onChange={(e) => setEnvFilter(e.target.value)}
            className="px-3 py-1.5 rounded-full bg-white border border-[#E6E9EE] text-xs font-mono text-[#1A1220] focus:outline-none focus:border-[#7A0FE0]"
          >
            <option value="all">All Environments</option>
            <option value="prod">Prod Only</option>
            <option value="staging">Staging Only</option>
          </select>

          <button
            onClick={() => setKevOnly(!kevOnly)}
            className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all ${
              kevOnly
                ? 'bg-[#7A0FE0] text-white shadow-violet'
                : 'bg-white border border-[#E6E9EE] text-[#4A515C] hover:bg-[#E6E9EE]'
            }`}
          >
            {kevOnly ? 'KEV Filter: ACTIVE' : 'Filter KEV Only'}
          </button>

          <button
            onClick={() => setViewMode(viewMode === '2d' ? '3d' : '2d')}
            className="px-3.5 py-1.5 rounded-full bg-white border border-[#E6E9EE] text-xs font-mono font-semibold text-[#7A0FE0] hover:bg-[#E6E9EE]"
          >
            {viewMode === '2d' ? 'Switch to 3D Orbit' : 'Switch to 2D Canvas'}
          </button>
        </div>
      </div>

      {/* Main Grid: Cytoscape Viewport (8 col) + Node Details Side Panel (4 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-[32px] bg-white border border-[#E6E9EE] p-4 shadow-silver-card h-[540px] relative overflow-hidden">
          <div ref={cyContainerRef} className="w-full h-full" />
          <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-[#E6E9EE] text-[11px] font-mono text-[#8A929C] pointer-events-none">
            Click any node to inspect blast radius & reachability
          </div>
        </div>

        {/* Node Side Panel */}
        <div className="lg:col-span-4 rounded-[32px] bg-white border border-[#E6E9EE] p-6 shadow-silver-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#E6E9EE]">
              <span className="font-display text-sm font-bold text-[#1A1220]">Node Inspector</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#7A0FE0]/10 text-[#7A0FE0] font-semibold">
                {selectedNode ? selectedNode.kind.toUpperCase() : 'SELECT A NODE'}
              </span>
            </div>

            {selectedNode ? (
              <div className="mt-4 space-y-4 font-mono text-xs">
                <div>
                  <div className="text-[10px] text-[#8A929C] uppercase">Package / Identifier</div>
                  <div className="text-base font-bold text-[#1A1220] font-sans mt-0.5">{selectedNode.label}</div>
                  <div className="text-[11px] text-[#7A0FE0] font-semibold">
                    {selectedNode.in_kev ? 'Active CISA KEV Catalog Match' : 'Normal Dependency'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-2xl bg-[#E6E9EE]/40 border border-[#E6E9EE]">
                    <div className="text-[10px] text-[#8A929C]">CVSS Severity</div>
                    <div className="text-base font-bold text-[#7A0FE0]">{selectedNode.cvss} / 10.0</div>
                  </div>
                  <div className="p-2.5 rounded-2xl bg-[#E6E9EE]/40 border border-[#E6E9EE]">
                    <div className="text-[10px] text-[#8A929C]">Blast Radius</div>
                    <div className="text-base font-bold text-[#1A1220]">{selectedNode.blast_radius_score} pts</div>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-[#E6E9EE]/30 border border-[#E6E9EE] space-y-1">
                  <div className="text-[10px] text-[#8A929C] uppercase font-bold">Affected Deployments</div>
                  <div className="text-xs text-[#1A1220] font-semibold">
                    {selectedNode.affected_services.join(', ')}
                  </div>
                  <div className="text-[10px] text-[#8A929C]">Owner: {selectedNode.owner}</div>
                </div>

                {selectedNode.vex_statement && (
                  <div className="p-3 rounded-2xl bg-violet-50 border border-violet-200 text-[#4B0F9E] text-[11px] space-y-1">
                    <div className="font-bold uppercase text-[10px]">OpenVEX Justification:</div>
                    <div>{selectedNode.vex_statement.justification}</div>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-24 text-center text-xs font-mono text-[#8A929C]">
                Tap any node on the graph canvas to view its full blast radius, reachability hops, and VEX justification.
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#E6E9EE] mt-4">
            <button
              disabled={!selectedNode}
              className="w-full py-2.5 rounded-full bg-[#7A0FE0] hover:bg-[#4B0F9E] text-white text-xs font-mono font-semibold transition-all disabled:opacity-50"
            >
              Analyze in Planner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
