import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GraphNode } from '../api/generated';
import { ArrowRight } from 'lucide-react';

interface Props {
  onStageSelect?: (stage: number) => void;
  onNodeClick?: (nodeId: string) => void;
  graphNodes?: GraphNode[];
  activeStage?: number;
}

export interface GraphNodeMeta {
  id: string;
  name: string;
  layer: 'Package' | 'Application' | 'Service' | 'Environment';
  type: 'obsidian' | 'purple' | 'silver';
  pos: [number, number, number];
  radius: number;
  hasHalo?: boolean;
  haloRadius?: number;
  isVuln?: boolean;
  cvss?: number;
  probPct?: number;
  statusText?: string;
  details: string;
}

export const ThreeHeroScene: React.FC<Props> = ({
  onStageSelect: _onStageSelect,
  onNodeClick,
  graphNodes,
  activeStage = 1,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  // Keep the latest click handler without rebuilding the whole scene when the parent re-renders.
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);
  const [hoveredNode, setHoveredNode] = useState<GraphNodeMeta | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const tweenTargetRef = useRef<{ cam: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const currentStageRef = useRef<number>(activeStage);

  // Keep currentStageRef in sync
  useEffect(() => {
    currentStageRef.current = activeStage;
  }, [activeStage]);

  // Handle stage camera tweening
  const setCameraForStage = useCallback((stage: number) => {
    if (stage === 1) {
      // Stage 1: Blast Radius overview
      tweenTargetRef.current = {
        cam: new THREE.Vector3(25, 12, 175),
        target: new THREE.Vector3(25, 0, 0),
      };
    } else if (stage === 2) {
      // Stage 2: Exploit risk focus
      tweenTargetRef.current = {
        cam: new THREE.Vector3(40, 20, 150),
        target: new THREE.Vector3(45, 10, 0),
      };
    } else if (stage === 3) {
      // Stage 3: CP-SAT Remediation optimization
      tweenTargetRef.current = {
        cam: new THREE.Vector3(70, -5, 160),
        target: new THREE.Vector3(60, -10, 5),
      };
    }
  }, []);

  useEffect(() => {
    setCameraForStage(activeStage);
  }, [activeStage, setCameraForStage]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const width = container.clientWidth || 960;
    const height = container.clientHeight || 640;

    // 1. Scene with clean platinum/silver background & depth fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xeaedf2, 0.0016);

    // 2. Camera setup framing right 60% for graph, left 40% for hero text
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2500);
    camera.position.set(25, 12, 175);
    camera.lookAt(25, 0, 0);
    cameraRef.current = camera;

    // 3. Renderer with high pixel ratio and smooth antialiasing
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0xeaedf2, 0);
    container.appendChild(renderer.domElement);

    // 4. OrbitControls with soft damping and constrained angles
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 260;
    controls.minDistance = 90;
    controls.maxPolarAngle = Math.PI / 1.75;
    controls.minPolarAngle = Math.PI / 3.5;
    controls.target.set(25, 0, 0);
    controlsRef.current = controls;

    // 5. Lighting matching the screenshot
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.25);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(120, 160, 140);
    scene.add(dirLight);

    const pointPurple = new THREE.PointLight(0x9333ea, 4.5, 350);
    pointPurple.position.set(70, 15, 60);
    scene.add(pointPurple);

    const pointSecondary = new THREE.PointLight(0x7a0fe0, 3.2, 280);
    pointSecondary.position.set(-35, -25, 45);
    scene.add(pointSecondary);

    const fillBlue = new THREE.PointLight(0x3b82f6, 1.5, 300);
    fillBlue.position.set(140, -40, 70);
    scene.add(fillBlue);

    // Root graph group for mouse parallax
    const graphRoot = new THREE.Group();
    scene.add(graphRoot);

    // 6. Define Nodes matching the exact constellation layout in user screenshot
    const defaultNodes: GraphNodeMeta[] = [
      // Left entrypoint & blast radius nodes
      {
        id: 'node-l-top-purple',
        name: 'edge-router:ingress',
        layer: 'Environment',
        type: 'purple',
        pos: [-50, 48, 10],
        radius: 9,
        hasHalo: true,
        haloRadius: 21,
        cvss: 7.5,
        probPct: 64,
        statusText: 'PUBLIC INGRESS GATEWAY',
        details: 'External HTTPS Traffic Controller • Exposes downstream cluster',
      },
      {
        id: 'node-l-mid-purple-1',
        name: 'gateway-proxy@3.2.0',
        layer: 'Service',
        type: 'purple',
        pos: [-38, 30, 20],
        radius: 7.5,
        hasHalo: false,
        cvss: 5.4,
        probPct: 42,
        statusText: 'MICROSERVICE ROUTE',
        details: 'Reverse proxy dispatch to checkout & billing services',
      },
      {
        id: 'node-l-mid-purple-2',
        name: 'auth-session-mgr@1.9.4',
        layer: 'Application',
        type: 'purple',
        pos: [-44, 12, 15],
        radius: 8,
        hasHalo: true,
        haloRadius: 18,
        cvss: 6.8,
        probPct: 58,
        statusText: 'INTERMEDIATE APP',
        details: 'JWT session validation & token issuance layer',
      },
      {
        id: 'node-l-conduit-start',
        name: 'example-lib@1.4.0',
        layer: 'Package',
        type: 'purple',
        pos: [-48, -12, 15],
        radius: 8.5,
        hasHalo: true,
        haloRadius: 20,
        isVuln: true,
        cvss: 8.8,
        probPct: 86.4,
        statusText: 'CRITICAL (CISA KEV)',
        details: 'Transitive CVE-2026-1001 • Remote Code Execution • In KEV',
      },
      // Lower-left cluster nodes
      {
        id: 'node-ll-silver',
        name: 'pydantic@2.6.1',
        layer: 'Package',
        type: 'silver',
        pos: [-62, -28, 5],
        radius: 6,
        statusText: 'CLEAN LIBRARY',
        details: 'Data validation and schema parsing • Up to date',
      },
      {
        id: 'node-ll-dark-1',
        name: 'redis-client@4.5.0',
        layer: 'Package',
        type: 'obsidian',
        pos: [-50, -38, 20],
        radius: 8.5,
        statusText: 'CACHE ACCESSORY',
        details: 'Shared in-memory cache driver • Low severity baseline',
      },
      {
        id: 'node-ll-dark-2',
        name: 'async-worker@0.8.2',
        layer: 'Application',
        type: 'obsidian',
        pos: [-58, -48, 10],
        radius: 7,
        statusText: 'BACKGROUND TASK',
        details: 'Consumes queue messages for non-blocking notifications',
      },
      {
        id: 'node-ll-purple',
        name: 'audit-relay@1.0.1',
        layer: 'Service',
        type: 'purple',
        pos: [-35, -42, 15],
        radius: 7,
        hasHalo: false,
        statusText: 'TELEMETRY AGENT',
        details: 'Internal audit log shipping container',
      },

      // Center silver/pearl cluster (healthy microservice network)
      {
        id: 'node-c-silver-top',
        name: 'urllib3@1.26.5',
        layer: 'Package',
        type: 'silver',
        pos: [-8, 45, -15],
        radius: 6.5,
        statusText: 'CLEAN PACKAGE',
        details: 'HTTP client baseline • Transitive dependency',
      },
      {
        id: 'node-c-silver-1',
        name: 'certifi@2024.2.2',
        layer: 'Package',
        type: 'silver',
        pos: [5, 25, -10],
        radius: 7,
        statusText: 'CLEAN PACKAGE',
        details: 'Root CA certificate bundle',
      },
      {
        id: 'node-c-silver-2',
        name: 'charset-normalizer@3.3.2',
        layer: 'Package',
        type: 'silver',
        pos: [-12, 18, -5],
        radius: 6,
        statusText: 'CLEAN PACKAGE',
        details: 'Character encoding detection helper',
      },
      {
        id: 'node-c-silver-3',
        name: 'idna@3.6',
        layer: 'Package',
        type: 'silver',
        pos: [0, -2, 0],
        radius: 7.5,
        statusText: 'CLEAN PACKAGE',
        details: 'Internationalized Domain Names parser',
      },
      {
        id: 'node-c-silver-4',
        name: 'requests@2.31.0',
        layer: 'Package',
        type: 'silver',
        pos: [15, -8, 5],
        radius: 8,
        statusText: 'CLEAN PACKAGE',
        details: 'Standard Python HTTP transport',
      },
      {
        id: 'node-c-silver-5',
        name: 'cryptography@42.0.5',
        layer: 'Package',
        type: 'silver',
        pos: [-5, -18, 10],
        radius: 7,
        statusText: 'CLEAN PACKAGE',
        details: 'Cryptographic recipes & primitives',
      },
      {
        id: 'node-c-silver-6',
        name: 'pyjwt@2.8.0',
        layer: 'Package',
        type: 'silver',
        pos: [12, -22, 12],
        radius: 7.5,
        statusText: 'CLEAN PACKAGE',
        details: 'JSON Web Token encoding & decoding',
      },
      {
        id: 'node-c-silver-7',
        name: 'fastapi@0.110.0',
        layer: 'Application',
        type: 'silver',
        pos: [-10, -42, 18],
        radius: 6.5,
        statusText: 'CLEAN FRAMEWORK',
        details: 'Core async REST API framework',
      },
      {
        id: 'node-c-silver-8',
        name: 'uvicorn@0.28.0',
        layer: 'Application',
        type: 'silver',
        pos: [15, -45, 15],
        radius: 7.5,
        statusText: 'CLEAN RUNTIME',
        details: 'Lightning-fast ASGI server implementation',
      },

      // Center-Right Obsidian and Purple Nodes
      {
        id: 'node-cr-purple-top',
        name: 'payment-svc@2.4.0',
        layer: 'Service',
        type: 'purple',
        pos: [48, 25, -10],
        radius: 8.5,
        hasHalo: false,
        cvss: 7.2,
        probPct: 68,
        statusText: 'PCI COMPLIANCE BOUND',
        details: 'Stripe & banking payment processing interface',
      },
      {
        id: 'node-cr-obsidian-top',
        name: 'vault-connector@1.2.0',
        layer: 'Application',
        type: 'obsidian',
        pos: [70, 32, -5],
        radius: 7.5,
        statusText: 'SECRET STORAGE',
        details: 'HashiCorp Vault secret injection daemon',
      },
      {
        id: 'node-cr-obsidian-2',
        name: 'sql-pool@3.1.1',
        layer: 'Package',
        type: 'obsidian',
        pos: [85, 20, 10],
        radius: 8.5,
        statusText: 'DATABASE POOL',
        details: 'PostgreSQL connection multiplexer',
      },
      {
        id: 'node-cr-purple-mid',
        name: 'service:checkout',
        layer: 'Service',
        type: 'purple',
        pos: [65, 8, 10],
        radius: 9,
        hasHalo: true,
        haloRadius: 20,
        cvss: 8.8,
        probPct: 86.4,
        statusText: 'EXPOSED PRODUCTION SERVICE',
        details: 'Core e-commerce checkout service • Blast radius target',
      },
      {
        id: 'node-cr-purple-pair-1',
        name: 'order-dispatch@2.0.1',
        layer: 'Service',
        type: 'purple',
        pos: [60, -18, 25],
        radius: 11,
        hasHalo: false,
        cvss: 7.8,
        probPct: 74,
        statusText: 'ORDER SERVICE',
        details: 'Order state machine & inventory lock coordinator',
      },
      {
        id: 'node-cr-purple-pair-2',
        name: 'fulfillment-hub@1.8.0',
        layer: 'Service',
        type: 'purple',
        pos: [78, -20, 20],
        radius: 12.5,
        hasHalo: true,
        haloRadius: 25,
        cvss: 8.1,
        probPct: 79,
        statusText: 'FULFILLMENT DISPATCH',
        details: 'Automated warehouse & shipping carrier router',
      },
      {
        id: 'node-cr-purple-low',
        name: 'notification-mgr@1.1.0',
        layer: 'Service',
        type: 'purple',
        pos: [50, -32, 25],
        radius: 7,
        hasHalo: false,
        statusText: 'EVENT CONSUMER',
        details: 'Email, SMS, and webhook delivery manager',
      },

      // Prominent Right Perimeter Nodes (Matching the big spheres in screenshot)
      {
        id: 'node-r-big-black-top',
        name: 'cloud-security-sentinel',
        layer: 'Environment',
        type: 'obsidian',
        pos: [115, 42, 5],
        radius: 12,
        statusText: 'SECURITY ENCLAVE',
        details: 'Cluster threat detection & automated intrusion monitor',
      },
      {
        id: 'node-r-conduit-end',
        name: 'prod-cluster-ap-south-1',
        layer: 'Environment',
        type: 'purple',
        pos: [142, 28, -5],
        radius: 10,
        hasHalo: true,
        haloRadius: 24,
        cvss: 8.8,
        probPct: 86.4,
        statusText: 'BLAST RADIUS TERMINUS',
        details: 'Critical production Kubernetes cluster reaching 14 microservices',
      },
      {
        id: 'node-r-black-mid',
        name: 'customer-data-lake',
        layer: 'Environment',
        type: 'obsidian',
        pos: [155, 25, 20],
        radius: 10,
        statusText: 'DATA PRIVACY BOUNDARY',
        details: 'GDPR / HIPAA isolated customer analytic store',
      },
      {
        id: 'node-r-big-black-low',
        name: 'cold-backup-archive',
        layer: 'Environment',
        type: 'obsidian',
        pos: [160, -30, 40],
        radius: 14,
        statusText: 'OFFLINE RECOVERY',
        details: 'Immutable cryptographic point-in-time snapshot archive',
      },
      {
        id: 'node-r-silver-low',
        name: 'monitoring-prometheus',
        layer: 'Application',
        type: 'silver',
        pos: [110, -48, 10],
        radius: 7.5,
        statusText: 'METRICS COLLECTOR',
        details: 'Cluster telemetry, memory limits, and node health exporter',
      },
    ];

    // Combine with real backend graph nodes if present
    const nodes = [...defaultNodes];
    if (graphNodes && graphNodes.length > 0) {
      const vulnNode = graphNodes.find((n) => (n.cvss && n.cvss >= 7) || n.in_kev);
      if (vulnNode) {
        nodes[3].name = vulnNode.label;
        nodes[3].details = `Live Backend Finding: ${vulnNode.label} • CVSS: ${vulnNode.cvss || 8.8} • Reachability: ${vulnNode.reachability || 'Direct'}`;
      }
    }

    // 7. Materials for the 3 Node Types
    const obsidianMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x160b28,
      roughness: 0.08,
      metalness: 0.35,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      reflectivity: 0.95,
    });

    const purpleMaterial = new THREE.MeshStandardMaterial({
      color: 0x7a0fe0,
      emissive: 0x9333ea,
      emissiveIntensity: 0.8,
      roughness: 0.18,
      metalness: 0.35,
    });

    const silverMaterial = new THREE.MeshStandardMaterial({
      color: 0xdce3ec,
      roughness: 0.22,
      metalness: 0.82,
    });

    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    });

    // 8. Create Meshes for Nodes and Halos
    const nodeMeshes: { mesh: THREE.Mesh; meta: GraphNodeMeta; initialY: number; phase: number }[] = [];
    const haloMeshes: { mesh: THREE.Mesh; parentMesh: THREE.Mesh; baseScale: number }[] = [];

    nodes.forEach((node, idx) => {
      const geom = new THREE.SphereGeometry(node.radius, 32, 32);
      let mat = silverMaterial;
      if (node.type === 'obsidian') mat = obsidianMaterial;
      else if (node.type === 'purple') mat = purpleMaterial;

      const mesh = new THREE.Mesh(geom, mat.clone());
      mesh.position.set(node.pos[0], node.pos[1], node.pos[2]);
      (mesh as any).nodeMeta = node;
      graphRoot.add(mesh);

      nodeMeshes.push({
        mesh,
        meta: node,
        initialY: node.pos[1],
        phase: idx * 0.45,
      });

      // Add camera-facing pulsating halo disc if node.hasHalo
      if (node.hasHalo) {
        const hRadius = node.haloRadius || node.radius * 2.2;
        const hGeom = new THREE.RingGeometry(node.radius * 1.35, hRadius, 48);
        const hMesh = new THREE.Mesh(hGeom, haloMaterial.clone());
        hMesh.position.set(node.pos[0], node.pos[1], node.pos[2]);
        graphRoot.add(hMesh);
        haloMeshes.push({ mesh: hMesh, parentMesh: mesh, baseScale: 1 });
      }
    });

    // 9. Sweeping Curved Purple Conduit (Spline Tube)
    const conduitPoints = [
      new THREE.Vector3(-48, -12, 15),
      new THREE.Vector3(-25, -28, 22),
      new THREE.Vector3(5, -45, 28),
      new THREE.Vector3(38, -42, 22),
      new THREE.Vector3(68, -10, 15),
      new THREE.Vector3(98, 12, 8),
      new THREE.Vector3(142, 28, -5),
    ];
    const conduitCurve = new THREE.CatmullRomCurve3(conduitPoints);
    const conduitGeom = new THREE.TubeGeometry(conduitCurve, 120, 1.6, 24, false);
    const conduitMat = new THREE.MeshStandardMaterial({
      color: 0x9333ea,
      emissive: 0x7a0fe0,
      emissiveIntensity: 0.9,
      roughness: 0.15,
      metalness: 0.15,
    });
    const conduitMesh = new THREE.Mesh(conduitGeom, conduitMat);
    graphRoot.add(conduitMesh);

    // 10. 3D Orbital Elliptical Wire Rings
    const orbitalGroup = new THREE.Group();
    graphRoot.add(orbitalGroup);

    const createOrbitalRing = (
      rx: number,
      ry: number,
      rotX: number,
      rotY: number,
      rotZ: number,
      center: THREE.Vector3,
    ) => {
      const curve = new THREE.EllipseCurve(0, 0, rx, ry, 0, 2 * Math.PI, false, 0);
      const pts = curve.getPoints(128).map((p) => new THREE.Vector3(p.x, p.y, 0));
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.45,
      });
      const ring = new THREE.LineLoop(geom, mat);
      ring.position.copy(center);
      ring.rotation.set(rotX, rotY, rotZ);
      return ring;
    };

    const ring1 = createOrbitalRing(115, 48, 0.45, 0.2, -0.2, new THREE.Vector3(45, 0, 5));
    const ring2 = createOrbitalRing(100, 55, -0.3, 0.5, 0.6, new THREE.Vector3(55, 5, 0));
    const ring3 = createOrbitalRing(140, 75, 0.2, -0.4, 0.35, new THREE.Vector3(35, -5, 10));

    orbitalGroup.add(ring1);
    orbitalGroup.add(ring2);
    orbitalGroup.add(ring3);

    // 11. Connecting Network Edges
    const edgeCoords: number[] = [];
    const connectNodes = (idxA: number, idxB: number) => {
      const a = nodes[idxA].pos;
      const b = nodes[idxB].pos;
      edgeCoords.push(a[0], a[1], a[2], b[0], b[1], b[2]);
    };

    // Connections between nearby logical components
    connectNodes(0, 1);
    connectNodes(1, 2);
    connectNodes(2, 3);
    connectNodes(3, 4);
    connectNodes(4, 5);
    connectNodes(5, 6);
    connectNodes(6, 7);
    connectNodes(2, 8);
    connectNodes(8, 9);
    connectNodes(9, 10);
    connectNodes(10, 11);
    connectNodes(11, 12);
    connectNodes(12, 13);
    connectNodes(13, 14);
    connectNodes(14, 15);
    connectNodes(15, 16);
    connectNodes(16, 17);
    connectNodes(10, 17);
    connectNodes(17, 18);
    connectNodes(18, 19);
    connectNodes(19, 20);
    connectNodes(20, 21);
    connectNodes(21, 22);
    connectNodes(22, 23);
    connectNodes(19, 24);
    connectNodes(24, 25);
    connectNodes(25, 26);
    connectNodes(26, 27);
    connectNodes(27, 28);

    const edgeGeom = new THREE.BufferGeometry();
    edgeGeom.setAttribute('position', new THREE.Float32BufferAttribute(edgeCoords, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.32,
    });
    const edgeLines = new THREE.LineSegments(edgeGeom, edgeMat);
    graphRoot.add(edgeLines);

    // 12. Floating Ambient Dust Particles
    const dustCount = 200;
    const dustGeom = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 500 + 40;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 350;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 400;
    }
    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x7a0fe0,
      size: 2.0,
      transparent: true,
      opacity: 0.35,
    });
    const dust = new THREE.Points(dustGeom, dustMat);
    scene.add(dust);

    // 13. Interactive Raycasting
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);
    let targetParallaxX = 0;
    let targetParallaxY = 0;

    const handlePointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouse.x = x;
      mouse.y = y;

      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });

      // Parallax target
      targetParallaxX = x * 6;
      targetParallaxY = y * 4;
    };

    const handleClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes.map((n) => n.mesh));
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const meta = (hitMesh as any).nodeMeta as GraphNodeMeta;
        if (meta && onNodeClickRef.current) {
          onNodeClickRef.current(meta.id);
        }
      }
    };

    container.addEventListener('pointermove', handlePointerMove);
    container.addEventListener('click', handleClick);

    // 14. Animation Loop with Harmonic Floating, Ring Rotation & Parallax
    const clock = new THREE.Clock();

    const animate = () => {
      const elapsedTime = clock.getElapsedTime();

      // Continuous gentle harmonic floating
      if (!prefersReducedMotion) {
        nodeMeshes.forEach((item) => {
          const dy = Math.sin(elapsedTime * 1.4 + item.phase) * 1.5;
          item.mesh.position.y = item.initialY + dy;
        });

        // Rotate orbital rings
        ring1.rotation.z += 0.0006;
        ring2.rotation.z -= 0.0008;
        ring3.rotation.y += 0.0005;

        // Pulse conduit glow
        conduitMat.emissiveIntensity = 0.8 + Math.sin(elapsedTime * 2.5) * 0.25;

        // Halo pulsating scale and camera orientation
        haloMeshes.forEach((h, i) => {
          h.mesh.position.copy(h.parentMesh.position);
          h.mesh.quaternion.copy(camera.quaternion);
          const pScale = 1 + Math.sin(elapsedTime * 2.2 + i * 0.8) * 0.08;
          h.mesh.scale.set(pScale, pScale, pScale);
        });

        // Slow dust drift
        const dPos = dustGeom.attributes.position.array as Float32Array;
        for (let i = 0; i < dustCount; i++) {
          dPos[i * 3 + 1] -= 0.12;
          if (dPos[i * 3 + 1] < -180) dPos[i * 3 + 1] = 180;
        }
        dustGeom.attributes.position.needsUpdate = true;

        // Smooth camera tween for stage transitions
        if (tweenTargetRef.current) {
          camera.position.lerp(tweenTargetRef.current.cam, 0.04);
          controls.target.lerp(tweenTargetRef.current.target, 0.04);
          if (camera.position.distanceTo(tweenTargetRef.current.cam) < 0.2) {
            tweenTargetRef.current = null;
          }
        } else {
          // Subtle mouse parallax
          graphRoot.rotation.y += (targetParallaxX * 0.015 - graphRoot.rotation.y) * 0.04;
          graphRoot.rotation.x += (-targetParallaxY * 0.015 - graphRoot.rotation.x) * 0.04;
        }
      }

      controls.update();

      // Raycast check for hover state
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes.map((n) => n.mesh));

      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const meta = (hitMesh as any).nodeMeta as GraphNodeMeta;
        setHoveredNode(meta);
        container.style.cursor = 'pointer';
        hitMesh.scale.lerp(new THREE.Vector3(1.18, 1.18, 1.18), 0.2);
      } else {
        setHoveredNode(null);
        container.style.cursor = 'default';
        nodeMeshes.forEach((n) => {
          n.mesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.15);
        });
      }

      renderer.render(scene, camera);
      animFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // 15. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        const newHeight = entry.contentRect.height;
        if (newWidth > 0 && newHeight > 0) {
          camera.aspect = newWidth / newHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(newWidth, newHeight);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('click', handleClick);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [graphNodes]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* Interactive Raycasted HUD Tooltip */}
      {hoveredNode && (
        <div
          style={{
            position: 'absolute',
            left: `${tooltipPos.x + 16}px`,
            top: `${tooltipPos.y - 12}px`,
            zIndex: 100,
            pointerEvents: 'none',
            background: 'rgba(255, 255, 255, 0.94)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(122, 15, 224, 0.3)',
            borderRadius: '12px',
            padding: '0.85rem 1.15rem',
            boxShadow: '0 12px 32px rgba(122, 15, 224, 0.18)',
            maxWidth: '300px',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
            <span
              style={{
                fontSize: '0.68rem',
                fontFamily: 'var(--font-mono)',
                textTransform: 'uppercase',
                fontWeight: 700,
                color: hoveredNode.type === 'purple' ? '#7A0FE0' : '#475569',
                background: hoveredNode.type === 'purple' ? 'rgba(122, 15, 224, 0.1)' : '#F1F5F9',
                padding: '0.15rem 0.45rem',
                borderRadius: '4px',
              }}
            >
              {hoveredNode.layer}
            </span>
            {hoveredNode.isVuln && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: '#DC2626',
                  background: 'rgba(239, 68, 68, 0.1)',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                }}
              >
                CRITICAL KEV
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.92rem', color: '#0F172A' }}>
            {hoveredNode.name}
          </div>
          <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '0.25rem', lineHeight: 1.4 }}>
            {hoveredNode.details}
          </div>
          {hoveredNode.cvss && (
            <div
              style={{
                display: 'flex',
                gap: '0.75rem',
                marginTop: '0.5rem',
                borderTop: '1px solid #E2E8F0',
                paddingTop: '0.45rem',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-mono)',
              }}
            >
              <div>
                CVSS: <strong style={{ color: '#DC2626' }}>{hoveredNode.cvss}</strong>
              </div>
              <div>
                Exploit P: <strong style={{ color: '#7A0FE0' }}>{hoveredNode.probPct}%</strong>
              </div>
            </div>
          )}
          <div
            style={{
              fontSize: '0.7rem',
              color: '#7A0FE0',
              fontWeight: 600,
              marginTop: '0.45rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <span>Click node to inspect</span>
            <ArrowRight size={11} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeHeroScene;
