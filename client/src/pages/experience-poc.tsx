// client/src/pages/experience-poc.tsx
//
// PROOF OF CONCEPT — immersive scroll journey showcasing the studio.
// v7 (2026-06-02): screenshots-only, rendered STEP BY STEP. A real studio
// step screenshot floats at a gentle angle with a soft shadow; scroll
// crossfades through the steps. The screenshot already IS the studio's
// rounded card, so no extra frame — just present it cleanly.
//
// TO USE YOUR REAL SHOTS: replace client/src/assets/experience/step-1.png
// with your screenshot (same filename), reload. Add more steps by dropping
// step-2.png … and extending STEPS below. The plane auto-sizes to the first
// image's aspect (portrait, landscape, whatever). Isolated /experience.

import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  ScrollControls,
  useScroll,
  ContactShadows,
  Float,
  useTexture,
} from '@react-three/drei';
import * as THREE from 'three';
import step1 from '@/assets/experience/step-1.png';
// import step2 from '@/assets/experience/step-2.png';

const STEPS: string[] = [step1];
const PANEL_H = 4.9; // world height of the screenshot

export default function ExperiencePocPage() {
  return (
    <div
      className="fixed inset-0"
      style={{
        background:
          'linear-gradient(160deg, #f1f1fb 0%, #eaf0fb 55%, #f7f1f1 100%)',
      }}
    >
      <Canvas
        camera={{ position: [0.2, 0.2, 7.5], fov: 42 }}
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
    // Gentle push-in + drift — clean, not a fly-through.
    state.camera.position.z = THREE.MathUtils.lerp(7.5, 6.2, o);
    state.camera.position.x = THREE.MathUtils.lerp(0.2, -0.2, o);
    state.camera.position.y = 0.2 + Math.sin(o * Math.PI) * 0.08;
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={1} />
      <Float speed={1} rotationIntensity={0.04} floatIntensity={0.25}>
        <group rotation={[0.01, -0.1, 0]}>
          <StepCard />
        </group>
      </Float>
      <ContactShadows position={[0, -2.7, 0]} opacity={0.24} scale={20} blur={3} far={5.5} resolution={512} color="#3a2f55" />
    </>
  );
}

function StepCard() {
  const scroll = useScroll();
  const textures = useTexture(STEPS) as unknown as THREE.Texture[];
  const list = Array.isArray(textures) ? textures : [textures];
  list.forEach((t) => (t.colorSpace = THREE.SRGBColorSpace));

  const img0 = list[0]?.image as HTMLImageElement | undefined;
  const aspect = img0 && img0.height ? img0.width / img0.height : 0.78;
  const W = PANEL_H * aspect;

  const matRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  useFrame(() => {
    const o = scroll.offset;
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
