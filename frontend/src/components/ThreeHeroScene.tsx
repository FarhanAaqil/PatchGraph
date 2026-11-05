import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GraphNode } from '../api/generated';

interface Props {
  onStageSelect?: (stage: number) => void;
  onNodeClick?: (nodeId: string) => void;
  graphNodes?: GraphNode[];
}

interface GraphNodeMeta {
  id: string;
  name: string;
  layer: string;
  color: number;
  pos: [number, number, number];
  isVuln?: boolean;
  cvss?: number;
  statusText?: string;
  details: string;
}

export const ThreeHeroScene: React.FC<Props> = ({ onStageSelect, onNodeClick, graphNodes }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState<number>(2);
  const [hoveredNode, setHoveredNode] = useState<GraphNodeMeta | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const animFrameRef = useRef<number | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const tweenTargetRef = useRef<{ cam: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const width = container.clientWidth || 900;
    const height = container.clientHeight || 560;

    // 1. Scene setup with depth fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xE6E9EE, 0.0012);

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(46, width / height, 1, 3000);
    camera.position.set(0, 35, 260);
    cameraRef.current = camera;

    // 3. Renderer with antialiasing and high pixel ratio
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // 4. Smooth OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxDistance = 450;
    controls.minDistance = 90;
    controls.maxPolarAngle = Math.PI / 1.85;
    controls.minPolarAngle = Math.PI / 4.5;
    controlsRef.current = controls;

    // 5. Rich Multi-Point Lighting System
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 1.1);
    scene.add(ambientLight);

    const keyVioletLight = new THREE.PointLight(0x7A0FE0, 4.5, 450);
    keyVioletLight.position.set(0, 20, 80);
    scene.add(keyVioletLight);

    const fillIndigoLight = new THREE.PointLight(0x4B0F9E, 2.5, 600);
    fillIndigoLight.position.set(-140, 100, -60);
    scene.add(fillIndigoLight);

    const rimSilverLight = new THREE.PointLight(0xFFFFFF, 1.8, 500);
    rimSilverLight.position.set(160, -50, 90);
    scene.add(rimSilverLight);

    // 6. Holographic Platform Layers
    const platformGroup = new THREE.Group();
    scene.add(platformGroup);

    const layersData = [
      { y: -65, label: 'L0 · VULNERABLE PACKAGES', radius: 105 },
      { y: -20, label: 'L1 · INTERNAL SDKS', radius: 95 },
      { y: +25, label: 'L2 · PRODUCTION MICROSERVICES', radius: 100 },
      { y: +70, label: 'L3 · CLOUD RUNTIME ENVS', radius: 90 },
    ];

    layersData.forEach((layer) => {
      // Thin ring
      const ringGeom = new THREE.RingGeometry(layer.radius - 0.7, layer.radius + 0.7, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x8A929C,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.22,
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.y = layer.y;
      ring.rotation.x = Math.PI / 2;
      platformGroup.add(ring);

      // Inner faint radial grid disk
      const diskGeom = new THREE.CircleGeometry(layer.radius, 32);
      const diskMat = new THREE.MeshBasicMaterial({
        color: 0x7A0FE0,
        transparent: true,
        opacity: 0.02,
        side: THREE.DoubleSide,
      });
      const disk = new THREE.Mesh(diskGeom, diskMat);
      disk.position.y = layer.y;
      disk.rotation.x = Math.PI / 2;
      platformGroup.add(disk);
    });

    // 7. Ambient Shimmering Particles (500 count)
    const particleCount = 500;
    const particleGeom = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 650;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 450;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 550;
    }
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x7A0FE0,
      size: 2.2,
      transparent: true,
      opacity: 0.4,
    });
    const particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);

    // 8. 3D Supply-Chain Topology Nodes
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    const defaultNodes: GraphNodeMeta[] = [
      {
        id: 'pkg-vulnerable',
        name: 'example-lib@1.4.0',
        layer: 'Package',
        color: 0x7A0FE0,
        pos: [0, -65, 30],
        isVuln: true,
        cvss: 8.8,
        statusText: 'CRITICAL (CISA KEV)',
        details: 'Transitive CVE-2026-1001 • Platt Exploit P: 86.4% • In KEV',
      },
      {
        id: 'pkg-safe',
        name: 'urllib3@1.26.5',
        layer: 'Package',
        color: 0x8A929C,
        pos: [-65, -65, -20],
        cvss: 0,
        statusText: 'CLEAN',
        details: 'Deterministic baseline verify • No known vulnerabilities',
      },
      {
        id: 'app-sdk',
        name: 'checkout-sdk@2.1.0',
        layer: 'Application',
        color: 0x4B0F9E,
        pos: [25, -20, 15],
        statusText: 'EXPOSED DEPENDENCY',
        details: 'Consumes example-lib@1.4.0 via direct requirement specification',
      },
      {
        id: 'svc-checkout',
        name: 'service:checkout',
        layer: 'Service',
        color: 0x7A0FE0,
        pos: [45, 25, 0],
        cvss: 8.8,
        statusText: 'PRODUCTION HIGH-RISK',
        details: 'PCI-DSS Production Gateway • Criticality: 5 • SLA: 30m Downtime',
      },
      {
        id: 'svc-worker',
        name: 'service:analytics',
        layer: 'Service',
        color: 0x8A929C,
        pos: [-55, 25, -15],
        statusText: 'VEX QUALIFIED (NOT AFFECTED)',
        details: 'OpenVEX Justification: vulnerable code path not invoked',
      },
      {
        id: 'env-prod',
        name: 'prod-cluster-ap-south-1',
        layer: 'Environment',
        color: 0x1A1220,
        pos: [55, 70, -10],
        statusText: 'PUBLIC INGRESS REACHABLE',
        details: 'Production Kubernetes Cluster • Blast Radius: 14 downstream assets',
      },
    ];

    let nodes: GraphNodeMeta[] = [];
    if (graphNodes && graphNodes.length > 0) {
      const packages = graphNodes.filter((n) => n.kind === 'package_version');
      const apps = graphNodes.filter((n) => n.kind === 'application');
      const services = graphNodes.filter((n) => n.kind === 'service');
      const envs = graphNodes.filter((n) => n.kind === 'environment');

      const placeLayer = (items: GraphNode[], y: number, layerName: string, radius: number) => {
        const slice = items.slice(0, 6);
        slice.forEach((item, idx) => {
          const total = slice.length;
          const angle = (idx / total) * Math.PI * 2;
          const x = Math.cos(angle) * (radius * 0.6);
          const z = Math.sin(angle) * (radius * 0.6);
          const isVuln = Boolean((item.cvss && item.cvss >= 7) || item.in_kev);
          nodes.push({
            id: item.id,
            name: item.label,
            layer: layerName,
            color: isVuln ? 0x7A0FE0 : item.kind === 'service' ? 0x4B0F9E : 0x8A929C,
            pos: [x, y, z],
            isVuln,
            cvss: item.cvss,
            statusText: isVuln ? 'CRITICAL (CVSS / KEV)' : item.reachability || 'ACTIVE',
            details: `Kind: ${item.kind} • Reachability: ${item.reachability || 'Standard'} • Owner: ${item.owner || 'Platform Team'}`,
          });
        });
      };

      placeLayer(packages, -65, 'Package', 105);
      placeLayer(apps, -20, 'Application', 95);
      placeLayer(services, 25, 'Service', 100);
      placeLayer(envs, 70, 'Environment', 90);
    }

    if (nodes.length === 0) {
      nodes = defaultNodes;
    }

    const nodeMeshes: { mesh: THREE.Mesh; meta: GraphNodeMeta }[] = [];
    const wireShields: THREE.Mesh[] = [];

    nodes.forEach((node) => {
      const geom = node.isVuln
        ? new THREE.IcosahedronGeometry(12, 1)
        : node.layer === 'Environment'
        ? new THREE.OctahedronGeometry(10, 0)
        : new THREE.SphereGeometry(8, 24, 24);

      const mat = new THREE.MeshStandardMaterial({
        color: node.color,
        emissive: node.color,
        emissiveIntensity: node.isVuln ? 0.95 : 0.35,
        roughness: 0.15,
        metalness: 0.8,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(node.pos[0], node.pos[1], node.pos[2]);
      (mesh as any).nodeMeta = node;
      graphGroup.add(mesh);
      nodeMeshes.push({ mesh, meta: node });

      // Pulsing wireframe shield for vulnerable node
      if (node.isVuln) {
        const wireGeom = new THREE.IcosahedronGeometry(18, 1);
        const wireMat = new THREE.MeshBasicMaterial({
          color: 0x7A0FE0,
          wireframe: true,
          transparent: true,
          opacity: 0.55,
        });
        const wire = new THREE.Mesh(wireGeom, wireMat);
        mesh.add(wire);
        wireShields.push(wire);
      }
    });

    // 9. Standard Edge Connectors
    const edgeCoords: [[number, number, number], [number, number, number]][] = [
      [[-65, -65, -20], [-55, 25, -15]],
      [[25, -20, 15], [-55, 25, -15]],
    ];

    edgeCoords.forEach(([p1, p2]) => {
      const lineGeom = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...p1),
        new THREE.Vector3(...p2),
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x8A929C,
        transparent: true,
        opacity: 0.35,
      });
      const line = new THREE.Line(lineGeom, lineMat);
      graphGroup.add(line);
    });

    // 10. Glowing Patch Path Spline (Packages -> SDK -> Service -> Prod Cluster)
    const patchPathPoints = [
      new THREE.Vector3(0, -65, 30),
      new THREE.Vector3(25, -20, 15),
      new THREE.Vector3(45, 25, 0),
      new THREE.Vector3(55, 70, -10),
    ];
    const patchCurve = new THREE.CatmullRomCurve3(patchPathPoints);
    const tubeGeom = new THREE.TubeGeometry(patchCurve, 50, 2.2, 10, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x7A0FE0,
      emissive: 0x7A0FE0,
      emissiveIntensity: 0.9,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
    });
    const patchTube = new THREE.Mesh(tubeGeom, tubeMat);
    graphGroup.add(patchTube);

    // Multiple traveling light photons along the patch path
    const photonCount = 3;
    const photons: { mesh: THREE.Mesh; offset: number }[] = [];
    for (let i = 0; i < photonCount; i++) {
      const pGeom = new THREE.SphereGeometry(3.5, 16, 16);
      const pMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
      const pMesh = new THREE.Mesh(pGeom, pMat);
      graphGroup.add(pMesh);
      photons.push({ mesh: pMesh, offset: i / photonCount });
    }

    // 11. Raycasting for Interactive Hover and Click
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;
      mouse.x = (clientX / width) * 2 - 1;
      mouse.y = -(clientY / height) * 2 + 1;
      setMousePos({ x: clientX, y: clientY });

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes.map((n) => n.mesh));

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const meta = (hit as any).nodeMeta as GraphNodeMeta;
        if (meta) {
          setHoveredNode(meta);
          container.style.cursor = 'pointer';
          hit.scale.set(1.2, 1.2, 1.2);
        }
      } else {
        setHoveredNode(null);
        container.style.cursor = 'grab';
        nodeMeshes.forEach((n) => n.mesh.scale.set(1, 1, 1));
      }
    };

    const handlePointerClick = () => {
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(nodeMeshes.map((n) => n.mesh));

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        const meta = (hit as any).nodeMeta as GraphNodeMeta;
        if (meta) {
          if (onNodeClick) onNodeClick(meta.id);
          // Animate camera to focus on clicked node
          tweenTargetRef.current = {
            cam: new THREE.Vector3(meta.pos[0] + 30, meta.pos[1] + 25, meta.pos[2] + 120),
            target: new THREE.Vector3(...meta.pos),
          };
        }
      }
    };

    container.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('click', handlePointerClick);

    // 12. Stage Camera Targets
    const stageTargets = [
      {
        cam: new THREE.Vector3(15, -45, 140),
        target: new THREE.Vector3(0, -65, 30),
      }, // 01 Root Cause (Vulnerable package)
      {
        cam: new THREE.Vector3(0, 35, 260),
        target: new THREE.Vector3(0, 0, 0),
      }, // 02 Full Architecture Overview
      {
        cam: new THREE.Vector3(65, 80, 160),
        target: new THREE.Vector3(50, 45, -5),
      }, // 03 Blast Radius (Prod Reachability)
    ];

    // Visibility Observer
    let isVisible = true;
    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
    }, { threshold: 0.1 });
    observer.observe(container);

    let progress = 0;
    const clock = new THREE.Clock();

    // 13. Render Loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (!isVisible) return;

      const delta = clock.getDelta();
      controls.update();

      // Camera tweening
      if (tweenTargetRef.current) {
        camera.position.lerp(tweenTargetRef.current.cam, 0.08);
        controls.target.lerp(tweenTargetRef.current.target, 0.08);
        if (camera.position.distanceTo(tweenTargetRef.current.cam) < 1.5) {
          tweenTargetRef.current = null;
        }
      }

      if (!prefersReducedMotion) {
        progress = (progress + delta * 0.35) % 1;

        // Move traveling light photons along curve
        photons.forEach((photon) => {
          const t = (progress + photon.offset) % 1;
          const pt = patchCurve.getPoint(t);
          photon.mesh.position.copy(pt);
        });

        // Rotate wire shields & particles
        wireShields.forEach((shield) => {
          shield.rotation.x += 0.02;
          shield.rotation.y += 0.025;
        });

        particles.rotation.y += 0.0004;
        platformGroup.rotation.y += 0.0008;
      }

      renderer.render(scene, camera);
    };

    animate();

    // 14. Responsive Window Resize
    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      container.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('click', handlePointerClick);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [graphNodes]);

  const handleSelectStage = (stage: number) => {
    setActiveStage(stage);
    if (onStageSelect) onStageSelect(stage);

    const stageTargets = [
      {
        cam: new THREE.Vector3(15, -45, 140),
        target: new THREE.Vector3(0, -65, 30),
      }, // 01 Root Cause
      {
        cam: new THREE.Vector3(0, 35, 260),
        target: new THREE.Vector3(0, 0, 0),
      }, // 02 Overview
      {
        cam: new THREE.Vector3(65, 80, 160),
        target: new THREE.Vector3(50, 45, -5),
      }, // 03 Blast Radius
    ];

    if (stageTargets[stage - 1]) {
      tweenTargetRef.current = stageTargets[stage - 1];
    }
  };

  return (
    <div
      ref={containerRef}
      className="pg-hero-card"
      style={{
        width: '100%',
        height: '560px',
        position: 'relative',
        cursor: 'grab',
        userSelect: 'none',
      }}
    >
      {/* Floating HUD Header Badge */}
      <div
        style={{
          position: 'absolute',
          top: '1.5rem',
          left: '1.75rem',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          pointerEvents: 'none',
        }}
      >
        <span
          className="pill-chip glass-panel"
          style={{
            padding: '0.4rem 1rem',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.75rem',
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            color: 'var(--color-ink)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: 'var(--color-violet)',
              boxShadow: '0 0 10px var(--color-violet)',
              animation: 'pulse-violet 2s infinite',
            }}
          />
          LIVE 3D TOPOLOGY HUD
        </span>

        <span
          className="pill-chip glass-panel"
          style={{
            padding: '0.4rem 0.85rem',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.7rem',
            fontFamily: 'var(--font-mono)',
            color: 'var(--color-steel-gray)',
          }}
        >
          OR-Tools CP-SAT Ready
        </span>
      </div>

      {/* Floating Camera Stage Buttons (01, 02, 03) */}
      <div
        style={{
          position: 'absolute',
          top: '1.5rem',
          right: '1.75rem',
          zIndex: 10,
          display: 'flex',
          gap: '0.5rem',
        }}
      >
        {[
          { num: 1, label: '01', desc: 'Root Cause' },
          { num: 2, label: '02', desc: 'Topology' },
          { num: 3, label: '03', desc: 'Blast Radius' },
        ].map((s) => (
          <button
            key={s.num}
            type="button"
            onClick={() => handleSelectStage(s.num)}
            title={`Stage ${s.label}: ${s.desc}`}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              border: activeStage === s.num ? '2px solid var(--color-violet)' : '1px solid rgba(203, 213, 225, 0.7)',
              background: activeStage === s.num ? 'var(--color-violet)' : 'rgba(255, 255, 255, 0.85)',
              color: activeStage === s.num ? '#FFFFFF' : 'var(--color-ink)',
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              boxShadow: activeStage === s.num ? 'var(--shadow-violet-glow)' : '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Interactive 3D Raycast Tooltip */}
      {hoveredNode && (
        <div
          style={{
            position: 'absolute',
            left: `${mousePos.x + 16}px`,
            top: `${mousePos.y - 48}px`,
            zIndex: 30,
            pointerEvents: 'none',
            background: 'var(--gradient-ink-card)',
            color: '#FFFFFF',
            padding: '0.85rem 1.25rem',
            borderRadius: '16px',
            border: '1px solid rgba(122, 15, 224, 0.45)',
            boxShadow: 'var(--shadow-ink-depth)',
            maxWidth: '300px',
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--color-steel-gray)', fontWeight: 700, letterSpacing: '0.05em' }}>
              {hoveredNode.layer}
            </span>
            {hoveredNode.isVuln && (
              <span style={{ fontSize: '0.65rem', background: '#DC2626', color: '#FFF', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 700 }}>
                CRITICAL
              </span>
            )}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.9rem', color: '#FFFFFF' }}>
            {hoveredNode.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-silver)', marginTop: '0.35rem', lineHeight: '1.4' }}>
            {hoveredNode.details}
          </div>
          <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', color: 'var(--color-violet)', fontWeight: 700 }}>
            Click to focus camera in 3D ➔
          </div>
        </div>
      )}

      {/* Bottom Floating Navigation Helper Pill */}
      <div
        style={{
          position: 'absolute',
          bottom: '1.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <span
          className="pill-chip glass-panel"
          style={{
            padding: '0.45rem 1.25rem',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.75rem',
            color: 'var(--color-steel-gray)',
            fontFamily: 'var(--font-mono)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ color: 'var(--color-violet)' }}>✦</span>
          Drag to orbit 360° • Scroll to zoom • Click any node to focus
        </span>
      </div>
    </div>
  );
};

export default ThreeHeroScene;
