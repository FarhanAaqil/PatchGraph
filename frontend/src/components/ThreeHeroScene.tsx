import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

interface Props {
  onStageSelect?: (stage: number) => void;
}

export const ThreeHeroScene: React.FC<Props> = ({ onStageSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeStage, setActiveStage] = useState<number>(1);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    // 1. Scene & Depth Fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xE6E9EE, 0.0015);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(50, width / height, 1, 2000);
    camera.position.set(0, 40, 220);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.9);
    scene.add(ambientLight);

    const violetLight = new THREE.PointLight(0x7A0FE0, 3.5, 400);
    violetLight.position.set(0, 10, 50);
    scene.add(violetLight);

    const indigoLight = new THREE.PointLight(0x4B0F9E, 2.0, 500);
    indigoLight.position.set(-120, 80, -40);
    scene.add(indigoLight);

    // 5. Ambient Dust Particles
    const dustCount = 450;
    const dustGeom = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 600;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 400;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 500;
    }
    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      color: 0x7A0FE0,
      size: 2.4,
      transparent: true,
      opacity: 0.45,
    });
    const dust = new THREE.Points(dustGeom, dustMat);
    scene.add(dust);

    // 6. Slow Orbital Rings
    const ringGeom = new THREE.RingGeometry(110, 112, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8A929C, side: THREE.DoubleSide, transparent: true, opacity: 0.25 });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2.3;
    scene.add(ring);

    // 7. Layered 3D Graph Hierarchy
    // Layer 0: Packages (Y = -60)
    // Layer 1: Apps (Y = -20)
    // Layer 2: Services (Y = +20)
    // Layer 3: Environments (Y = +60)
    const graphGroup = new THREE.Group();
    scene.add(graphGroup);

    const nodeData = [
      { id: 'pkg-vulnerable', label: 'example-lib@1.4.0', pos: [0, -60, 30], color: 0x7A0FE0, isVuln: true },
      { id: 'pkg-safe', label: 'urllib3@1.26.5', pos: [-60, -60, -20], color: 0x8A929C, isVuln: false },
      { id: 'app-sdk', label: 'checkout-sdk@2.1.0', pos: [20, -20, 10], color: 0x4B0F9E, isVuln: false },
      { id: 'svc-checkout', label: 'service:checkout', pos: [40, 20, 0], color: 0x7A0FE0, isVuln: false },
      { id: 'svc-worker', label: 'service:analytics', pos: [-50, 20, -10], color: 0x8A929C, isVuln: false },
      { id: 'env-prod', label: 'prod-cluster-ap-south-1', pos: [50, 60, -10], color: 0x4B0F9E, isVuln: false },
    ];

    const meshes: THREE.Mesh[] = [];
    const wireCoronas: THREE.Mesh[] = [];

    nodeData.forEach((node) => {
      const geom = node.isVuln
        ? new THREE.IcosahedronGeometry(11, 1)
        : new THREE.SphereGeometry(7, 16, 16);

      const mat = new THREE.MeshStandardMaterial({
        color: node.color,
        emissive: node.color,
        emissiveIntensity: node.isVuln ? 0.7 : 0.2,
        roughness: 0.2,
        metalness: 0.7,
      });

      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(node.pos[0], node.pos[1], node.pos[2]);
      graphGroup.add(mesh);
      meshes.push(mesh);

      if (node.isVuln) {
        // Pulsing wireframe corona
        const wireGeom = new THREE.IcosahedronGeometry(16, 1);
        const wireMat = new THREE.MeshBasicMaterial({ color: 0x7A0FE0, wireframe: true, transparent: true, opacity: 0.5 });
        const wire = new THREE.Mesh(wireGeom, wireMat);
        mesh.add(wire);
        wireCoronas.push(wire);
      }
    });

    // 8. Highlighted Patch Path (Curve connecting vulnerable package -> SDK -> checkout service -> prod env)
    const pathPoints = [
      new THREE.Vector3(0, -60, 30),
      new THREE.Vector3(20, -20, 10),
      new THREE.Vector3(40, 20, 0),
      new THREE.Vector3(50, 60, -10),
    ];
    const curve = new THREE.CatmullRomCurve3(pathPoints);
    const tubeGeom = new THREE.TubeGeometry(curve, 40, 1.8, 8, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x7A0FE0,
      emissive: 0x7A0FE0,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.85,
    });
    const patchPathTube = new THREE.Mesh(tubeGeom, tubeMat);
    graphGroup.add(patchPathTube);

    // Light packet travelling along patch path
    const packetGeom = new THREE.SphereGeometry(3.5, 16, 16);
    const packetMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const packet = new THREE.Mesh(packetGeom, packetMat);
    graphGroup.add(packet);

    // Mouse parallax
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / width - 0.5) * 2;
      mouseY = ((e.clientY - rect.top) / height - 0.5) * 2;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Stage targets
    const stageCameras = [
      { x: 0, y: 40, z: 220, targetY: 0 },
      { x: 60, y: -10, z: 180, targetY: -20 },
      { x: -50, y: 80, z: 200, targetY: 30 },
    ];

    // Visibility Observer to pause when off-screen
    let isVisible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.1 }
    );
    observer.observe(container);

    let progress = 0;
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (!isVisible || prefersReducedMotion) return;

      const delta = clock.getDelta();
      progress = (progress + delta * 0.4) % 1;

      // Move packet along curve
      const p = curve.getPoint(progress);
      packet.position.copy(p);

      // Rotate coronas and rings
      wireCoronas.forEach((wire) => {
        wire.rotation.x += 0.015;
        wire.rotation.y += 0.02;
      });
      ring.rotation.z += 0.002;
      dust.rotation.y += 0.0005;

      // Smooth camera parallax
      const targetX = (stageCameras[activeStage - 1] || stageCameras[0]).x + mouseX * 25;
      const targetY = (stageCameras[activeStage - 1] || stageCameras[0]).y - mouseY * 15;
      camera.position.x += (targetX - camera.position.x) * 0.05;
      camera.position.y += (targetY - camera.position.y) * 0.05;
      camera.lookAt(0, (stageCameras[activeStage - 1] || stageCameras[0]).targetY, 0);

      renderer.render(scene, camera);
    };

    if (!prefersReducedMotion) {
      animate();
    } else {
      renderer.render(scene, camera);
    }

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [activeStage]);

  const selectStage = (stage: number) => {
    setActiveStage(stage);
    if (onStageSelect) onStageSelect(stage);
  };

  return (
    <div className="relative w-full h-[520px] rounded-[44px] overflow-hidden bg-gradient-to-b from-[#FFFFFF] to-[#E6E9EE] shadow-silver-card border border-white">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Layer Stage Switcher (01 / 02 / 03) */}
      <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-[#1A1220]/80 backdrop-blur-md p-1.5 rounded-full border border-white/20">
        <span className="text-[11px] font-mono text-[#8A929C] px-3 font-semibold">STAGE CAM:</span>
        {[1, 2, 3].map((stage) => (
          <button
            key={stage}
            onClick={() => selectStage(stage)}
            className={`w-8 h-8 rounded-full font-display text-xs font-bold transition-all ${
              activeStage === stage
                ? 'bg-[#7A0FE0] text-white shadow-violet'
                : 'text-[#8A929C] hover:text-white hover:bg-white/10'
            }`}
            aria-label={`Switch 3D Camera Stage 0${stage}`}
          >
            0{stage}
          </button>
        ))}
      </div>

      {/* Legend Badge */}
      <div className="absolute top-6 right-6 hidden sm:flex items-center gap-3 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full border border-[#E6E9EE] shadow-sm text-xs font-mono">
        <span className="flex items-center gap-1.5 text-[#7A0FE0] font-bold">
          <span className="w-2.5 h-2.5 rounded-full bg-[#7A0FE0] animate-pulse"></span>
          Patch Path Active
        </span>
        <span className="text-[#8A929C]">|</span>
        <span className="text-[#1A1220]">4 Layer Hierarchy</span>
      </div>
    </div>
  );
};
