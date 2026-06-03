// client/src/pages/experience-poc.tsx
//
// PROOF OF CONCEPT — one beat of the immersive 3D scroll-journey landing.
// Scroll → fly through clouds → pass a "Choose your celebration" block →
// land on the card. Isolated route (/experience), NOT linked anywhere — it's
// a feel-it-out prototype, not production. See
// next_landing_3d_immersive_scroll.md.
//
// Tech: drei <ScrollControls> + useScroll drive a camera dolly along -z
// through a drei <Clouds> field; the block is a floating 3D <Text> panel; the
// landing card is a textured plane. Native scroll (no scroll-jacking — the
// lesson from the reverted imagine-section). Mobile is unoptimised for now
// (POC only).

import { Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  ScrollControls,
  useScroll,
  Clouds,
  Cloud,
  Text,
  Float,
  useTexture,
} from '@react-three/drei';
import * as THREE from 'three';
import heroFront from '@/assets/hero-card-front.png';

const SKY = '#dfe8f7';

export default function ExperiencePocPage() {
  return (
    <div
      className="fixed inset-0"
      style={{
        background:
          'linear-gradient(180deg, #b9d0ef 0%, #dfe8f7 45%, #f7efe6 100%)',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <ScrollControls pages={3} damping={0.3}>
            <Scene />
          </ScrollControls>
        </Suspense>
      </Canvas>

      {/* DOM overlays (outside the canvas) */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="pt-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/80 font-semibold drop-shadow">
            Celebrait · experience POC
          </p>
        </div>
        <div className="mt-auto pb-8 text-center">
          <p className="text-sm text-white/85 drop-shadow animate-pulse">
            Scroll ↓
          </p>
        </div>
      </div>
    </div>
  );
}

function Scene() {
  const scroll = useScroll();

  useFrame((state) => {
    const o = scroll.offset; // 0..1 across the scroll length
    // Fly forward along -z, with a gentle vertical drift so it breathes.
    state.camera.position.z = THREE.MathUtils.lerp(8, -14, o);
    state.camera.position.y = Math.sin(o * Math.PI) * 0.5;
    state.camera.lookAt(0, 0, state.camera.position.z - 6);
  });

  return (
    <>
      <fog attach="fog" args={[SKY, 5, 30]} />
      <ambientLight intensity={1.6} />
      <directionalLight position={[6, 8, 6]} intensity={1.3} />
      <directionalLight position={[-6, -4, 2]} intensity={0.5} color="#ffe9d6" />

      {/* Clouds scattered along the flight path (z: +5 → -12) so you fly
          through them on the way to the card. */}
      <Clouds material={THREE.MeshLambertMaterial} limit={300}>
        <Cloud position={[-4, 1.5, 5]} seed={1} segments={20} bounds={[6, 1.5, 1.5]} volume={6} color="#ffffff" opacity={0.65} speed={0.1} growth={4} />
        <Cloud position={[5, -1, 1]} seed={2} segments={18} bounds={[6, 1.5, 1.5]} volume={6} color="#eef2fb" opacity={0.55} speed={0.1} growth={4} />
        <Cloud position={[-3.5, -2, -4]} seed={3} segments={18} bounds={[5, 1.5, 1.5]} volume={5} color="#ffffff" opacity={0.6} speed={0.1} growth={4} />
        <Cloud position={[4.5, 2.2, -8]} seed={4} segments={18} bounds={[5, 1.5, 1.5]} volume={5} color="#f3eefb" opacity={0.55} speed={0.1} growth={4} />
        <Cloud position={[-1.5, -2.5, -12]} seed={5} segments={18} bounds={[6, 1.5, 1.5]} volume={6} color="#ffffff" opacity={0.6} speed={0.1} growth={4} />
      </Clouds>

      {/* Block — "Choose your celebration", floating ~mid-path (z ≈ 0). */}
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.5}>
        <group position={[0, 0.2, 0]}>
          <mesh position={[0, 0, -0.05]}>
            <planeGeometry args={[5.6, 1.8]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.45} />
          </mesh>
          <Text
            fontSize={0.5}
            color="#3b2e58"
            anchorX="center"
            anchorY="middle"
            maxWidth={5}
            textAlign="center"
          >
            Choose your celebration
          </Text>
        </group>
      </Float>

      {/* Landing card — the destination at the end of the flight. */}
      <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.4}>
        <CardPlane position={[0, 0, -18]} />
      </Float>
    </>
  );
}

function CardPlane({ position }: { position: [number, number, number] }) {
  const tex = useTexture(heroFront);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={position}>
      <planeGeometry args={[4.2, 4.2]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}
