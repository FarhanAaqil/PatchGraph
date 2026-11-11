import type { Core } from 'cytoscape';
import { Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { GraphEdge, GraphNode } from '../api/generated';

function token(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Interactive diagram. Cytoscape is large, so this whole file is loaded only when the Map screen opens. */
export default function GraphCanvas({
  nodes,
  edges,
  selectedId,
  onSelect,
  theme,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  theme: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cytoscape = (await import('cytoscape')).default;
      if (cancelled || !container.current) return;

      const ink = token('--text', '#1A1220');
      const muted = token('--text-2', '#5a5160');
      const violet = token('--violet', '#7A0FE0');
      const indigo = token('--indigo', '#4B0F9E');
      const steel = token('--steel', '#8A929C');
      const surface = token('--surface', '#ffffff');

      cy.current?.destroy();
      cy.current = cytoscape({
        container: container.current,
        elements: [
          ...nodes.map((n) => ({
            data: {
              id: n.id,
              label: n.label,
              kind: n.kind,
              kev: n.in_kev ? 1 : 0,
              vulnerable: n.severity && n.severity !== 'safe' ? 1 : 0,
            },
          })),
          ...edges.map((e, i) => ({
            data: { id: `e${i}`, source: e.source, target: e.target, patch: e.is_patch_path ? 1 : 0 },
          })),
        ],
        layout: { name: 'breadthfirst', directed: true, padding: 24, spacingFactor: 1.15, animate: false },
        wheelSensitivity: 0.25,
        minZoom: 0.3,
        maxZoom: 2.5,
        style: [
          {
            selector: 'node',
            style: {
              label: 'data(label)',
              'font-size': 11,
              'font-family': 'DM Sans, system-ui, sans-serif',
              color: ink,
              'text-valign': 'bottom',
              'text-margin-y': 6,
              'text-wrap': 'ellipsis',
              'text-max-width': '110px',
              'background-color': steel,
              'border-width': 2,
              'border-color': surface,
              width: 34,
              height: 34,
            },
          },
          { selector: 'node[kind = "service"]', style: { shape: 'round-rectangle', 'background-color': indigo } },
          {
            selector: 'node[kind = "application"]',
            style: { shape: 'round-rectangle', 'background-color': indigo, width: 40, height: 40 },
          },
          { selector: 'node[kind = "environment"]', style: { shape: 'ellipse', 'background-color': steel } },
          {
            selector: 'node[kind = "package_version"]',
            style: { shape: 'ellipse', 'background-color': muted },
          },
          {
            selector: 'node[vulnerable = 1]',
            style: { shape: 'diamond', 'background-color': violet, width: 44, height: 44, 'border-color': ink },
          },
          { selector: 'node[kev = 1]', style: { 'border-width': 4, 'border-style': 'double', 'border-color': ink } },
          {
            selector: 'edge',
            style: {
              width: 1.6,
              'line-color': steel,
              'target-arrow-color': steel,
              'target-arrow-shape': 'triangle',
              'curve-style': 'bezier',
              opacity: 0.8,
            },
          },
          {
            selector: 'edge[patch = 1]',
            style: { 'line-color': violet, 'target-arrow-color': violet, width: 3, 'line-style': 'dashed' },
          },
          { selector: ':selected', style: { 'overlay-color': violet, 'overlay-opacity': 0.18, 'overlay-padding': 8 } },
        ],
      });

      cy.current.on('tap', 'node', (event) => onSelectRef.current(event.target.id()));
      cy.current.on('tap', (event) => {
        if (event.target === cy.current) onSelectRef.current(null);
      });
    })();
    return () => {
      cancelled = true;
      cy.current?.destroy();
      cy.current = null;
    };
    // Rebuild when the data or theme changes; selection is handled separately below.
  }, [nodes, edges, theme]);

  useEffect(() => {
    const instance = cy.current;
    if (!instance) return;
    instance.nodes().unselect();
    if (selectedId) instance.getElementById(selectedId).select();
  }, [selectedId, nodes, edges, theme]);

  return (
    <div className="graph-wrap">
      <div
        ref={container}
        className="graph-canvas"
        role="img"
        aria-label="Diagram of how packages, services and environments connect. A table view is available for screen readers."
        data-testid="graph-canvas"
      />
      <div className="graph-controls">
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Zoom in"
          onClick={() =>
            cy.current?.zoom({ level: (cy.current.zoom() ?? 1) * 1.25, renderedPosition: { x: 200, y: 200 } })
          }
        >
          <ZoomIn size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Zoom out"
          onClick={() =>
            cy.current?.zoom({ level: (cy.current.zoom() ?? 1) / 1.25, renderedPosition: { x: 200, y: 200 } })
          }
        >
          <ZoomOut size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-icon"
          aria-label="Fit diagram to view"
          onClick={() => cy.current?.fit(undefined, 32)}
        >
          <Maximize2 size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
