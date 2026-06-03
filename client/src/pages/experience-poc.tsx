// client/src/pages/experience-poc.tsx
//
// PROOF OF CONCEPT — immersive 3D scroll journey showcasing the studio.
// v4 (2026-06-02, Kevin's call): drop the rendered-UI / 3D-phone entirely.
// Work with SCREENSHOTS — real studio step shots as crisp framed panels that
// you fly past on scroll, landing on the finished card. Screenshots are
// pixel-exact and deterministic to size (no Html-scale guessing).
//
// Mechanic: panels are offset to alternating sides + angled, so the camera
// swoops down the middle PAST them (no clip-through), gallery-style, then
// arrives at the centred card.
//
// PLACEHOLDER ART: using existing repo images until real step screenshots are
// dropped in at client/src/assets/experience/step-N.png. Swap the imports +
// the PANELS list. Isolated /experience, not linked.

import { Suspense } from 'react';
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
// TODO(Kevin): replace these placeholders with real step screenshots.
import shotA from '@/assets/studio-dashboard-poster.png';
import shotB from '@/assets/sample-card.jpeg';
import shotC from '@/assets/hero-card-inside.png';
import heroFront from '@/assets/hero-card-front.png';

const CARD_Z = -15;

// Each station: a screenshot, offset to a side + angled, along the path.
const PANELS: { src: string; position: [number, number, number]; rotationY: number }[] = [
  { src: shotA, position: [-2.6, 0.2, 2], rotationY: 0.5 },
  { src: shotB, position: [2.7, -0.1, -3], rotationY: -0.5 },
  { src: shotC, position: [-2.7, 0.1, -8], rotationY: 0.5 },
];

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
        camera={{ position: [0, 0.3, 9], fov: 48 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ScrollControls pages={3} damping={0.3}>
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
    const o = scroll.offset; // 0..1
    state.camera.position.z = THREE.MathUtils.lerp(9, CARD_Z + 4, o);
    state.camera.position.y = 0.3 + Math.sin(o * Math.PI) * 0.25;
    state.camera.position.x = Math.sin(o * Math.PI * 1.4) * 0.35;
    state.camera.lookAt(0, 0, state.camera.position.z - 6);
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

      {PANELS.map((p, i) => (
        <ScreenshotPanel key={i} {...p} />
      ))}

      {/* Landing card — centred destination. */}
      <Float speed={1.1} rotationIntensity={0.1} floatIntensity={0.35}>
        <group position={[0, 0, CARD_Z]} rotation={[0.02, 0.12, 0]}>
          <mesh position={[0, 0, -0.25]}>
            <planeGeometry args={[5.2, 5.2]} />
            <meshBasicMaterial color="#ffe6cf" transparent opacity={0.32} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <CardPlane src={heroFront} size={4} />
        </group>
      </Float>

      <ContactShadows position={[0, -2.7, 0]} opacity={0.28} scale={26} blur={2.6} far={6} resolution={512} color="#3a2f55" />
    </>
  );
}

function ScreenshotPanel({
  src,
  position,
  rotationY,
}: {
  src: string;
  position: [number, number, number];
  rotationY: number;
}) {
  const tex = useTexture(src);
  tex.colorSpace = THREE.SRGBColorSpace;
  const img = tex.image as HTMLImageElement | undefined;
  const aspect = img && img.height ? img.width / img.height : 0.62;
  const H = 3.6;
  const W = H * aspect;

  return (
    <Float speed={1} rotationIntensity={0.05} floatIntensity={0.3}>
      <group position={position} rotation={[0, rotationY, 0]}>
        {/* White frame backing (catches the env → premium card). */}
        <RoundedBox args={[W + 0.16, H + 0.16, 0.06]} radius={0.12} smoothness={5} position={[0, 0, -0.035]}>
          <meshStandardMaterial color="#ffffff" roughness={0.4} envMapIntensity={1.1} />
        </RoundedBox>
        {/* The screenshot itself — crisp, unlit. */}
        <mesh>
          <planeGeometry args={[W, H]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
      </group>
    </Float>
  );
}

function CardPlane({ src, size }: { src: string; size: number }) {
  const tex = useTexture(src);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}
