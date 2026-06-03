// client/src/pages/experience-poc.tsx
//
// PROOF OF CONCEPT — immersive scroll journey showcasing the studio.
// v5 (2026-06-02, Kevin's call): ONE mobile container, rendered STEP BY STEP.
// A single premium framed device sits in view; as you scroll, its screen
// crossfades through the studio steps (step 1 → 2 → …). No flying panels.
//
// Each step is just a screenshot (mobile, same container). Drop them into
// client/src/assets/experience/ and add to STEPS — the panel auto-sizes to
// the first image's aspect and the crossfade spreads over the scroll.
//
// PLACEHOLDER: one existing image stands in until step-1.png is added.
// Isolated /experience, not linked.

import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  ScrollControls,
  useScroll,
  Environment,
  Lightformer,
  ContactShadows,
  RoundedBox,
  Float,
  useTexture,
} from '@react-three/drei';
import * as THREE from 'three';
// TODO(Kevin): replace with real step screenshots, in order.
// import step1 from '@/assets/experience/step-1.png';
import placeholder from '@/assets/studio-dashboard-poster.png';

// Steps render in this order as you scroll. Add step-2, step-3, … here.
const STEPS: string[] = [placeholder];

const PANEL_H = 4.6; // world height of the device

export default function ExperiencePocPage() {
  return (
    <div
      className="fixed inset-0"
      style={{
        background:
          'linear-gradient(160deg, #eef0fa 0%, #e7eefb 55%, #f6eef0 100%)',
      }}
    >
      <Canvas
        camera={{ position: [0.4, 0.2, 8], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ScrollControls pages={Math.max(2, STEPS.length)} damping={0.3}>
            <Scene />
          </ScrollControls>
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="pt-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-ink-soft/60 font-semibold">
            Celebrait · experience POC
          </p>
        </div>
        <div className="mt-auto pb-8 text-center">
          <p className="text-sm text-ink-soft/60 animate-pulse">Scroll ↓</p>
        </div>
      </div>
    </div>
  );
}

function Scene() {
  const scroll = useScroll();

  useFrame((state) => {
    const o = scroll.offset;
    // Gentle continuous push-in + drift so it breathes (not a fly-through).
    state.camera.position.z = THREE.MathUtils.lerp(8, 6.4, o);
    state.camera.position.x = THREE.MathUtils.lerp(0.4, -0.4, o);
    state.camera.position.y = 0.2 + Math.sin(o * Math.PI) * 0.12;
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.2} position={[0, 4, 3]} scale={[12, 8, 1]} color="#ffffff" />
        <Lightformer intensity={1.1} position={[-6, 1, 2]} scale={[5, 6, 1]} color="#e6ecff" />
        <Lightformer intensity={1.0} position={[6, -1, 2]} scale={[5, 6, 1]} color="#fff2e6" />
      </Environment>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 5]} intensity={0.8} color="#fff6ea" />

      <Float speed={1} rotationIntensity={0.05} floatIntensity={0.3}>
        <group rotation={[0.01, -0.14, 0]}>
          <StepDevice />
        </group>
      </Float>

      <ContactShadows position={[0, -2.7, 0]} opacity={0.3} scale={22} blur={2.6} far={6} resolution={512} color="#3a2f55" />
    </>
  );
}

function StepDevice() {
  const scroll = useScroll();
  const textures = useTexture(STEPS) as unknown as THREE.Texture[];
  const list = Array.isArray(textures) ? textures : [textures];
  list.forEach((t) => (t.colorSpace = THREE.SRGBColorSpace));

  // Size from the first screenshot's aspect (all steps share the container).
  const img0 = list[0]?.image as HTMLImageElement | undefined;
  const aspect = img0 && img0.height ? img0.width / img0.height : 0.78;
  const W = PANEL_H * aspect;

  const matRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  useFrame(() => {
    const o = scroll.offset;
    // Position along the steps: 0 → N-1.
    const span = Math.max(1, list.length - 1);
    const pos = o * span;
    list.forEach((_, i) => {
      const op =
        list.length === 1
          ? 1
          : THREE.MathUtils.clamp(1 - Math.abs(pos - i), 0, 1);
      const m = matRefs.current[i];
      if (m) m.opacity = op;
    });
  });

  return (
    <group>
      {/* Device frame — premium soft-white, catches the env. */}
      <RoundedBox args={[W + 0.18, PANEL_H + 0.18, 0.12]} radius={0.16} smoothness={6} position={[0, 0, -0.07]}>
        <meshStandardMaterial color="#ffffff" roughness={0.35} metalness={0.04} envMapIntensity={1.1} />
      </RoundedBox>

      {/* Stacked step screens, crossfaded by scroll (only one visible at a time). */}
      {list.map((tex, i) => (
        <mesh key={i} position={[0, 0, 0.001 * i]} renderOrder={i}>
          <planeGeometry args={[W, PANEL_H]} />
          <meshBasicMaterial
            ref={(r) => (matRefs.current[i] = r)}
            map={tex}
            toneMapped={false}
            transparent
            opacity={i === 0 ? 1 : 0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
