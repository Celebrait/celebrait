// client/src/pages/experience-poc.tsx
//
// PROOF OF CONCEPT — one beat of the immersive 3D scroll-journey landing,
// pushed toward ~8/10 with all-in-engine tricks (no external assets):
//   • drei <Clouds> field, color-graded, flown through on scroll
//   • dawn palette: gradient sky + fog for depth ("in the clouds")
//   • warm key + cool fill + rim lighting (the biggest premium lever)
//   • drei <Sparkles> dust motes for atmosphere
//   • bloom + vignette via @react-three/postprocessing (dreamy glow)
//   • a glowing "Choose your celebration" glass block, landing on the card
//
// Isolated route (/experience), NOT linked. Native scroll (no scroll-jack).
// Tunable palette/positions up top. See next_landing_3d_immersive_scroll.md.

import { Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  ScrollControls,
  useScroll,
  Clouds,
  Cloud,
  Sparkles,
  Text,
  Float,
  useTexture,
} from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import heroFront from '@/assets/hero-card-front.png';

// ── Palette (dawn in the clouds) — tweak here ───────────────────────────
const FOG = '#ecdff0';
const KEY_LIGHT = '#ffd9a8'; // warm golden key
const FILL_LIGHT = '#cfd9ff'; // cool fill
const CARD_Z = -20;

export default function ExperiencePocPage() {
  return (
    <div
      className="fixed inset-0"
      style={{
        background:
          'linear-gradient(180deg, #cfe0f5 0%, #e7d9ee 46%, #f9e6d3 100%)',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ScrollControls pages={3} damping={0.3}>
            <Scene />
          </ScrollControls>
          <EffectComposer>
            <Bloom
              intensity={0.9}
              luminanceThreshold={0.55}
              luminanceSmoothing={0.3}
              mipmapBlur
              radius={0.7}
            />
            <Vignette eskil={false} offset={0.25} darkness={0.55} />
          </EffectComposer>
        </Suspense>
      </Canvas>

      {/* DOM overlays */}
      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="pt-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-white/80 font-semibold drop-shadow">
            Celebrait · experience POC
          </p>
        </div>
        <div className="mt-auto pb-8 text-center">
          <p className="text-sm text-white/90 drop-shadow animate-pulse">
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
    const o = scroll.offset; // 0..1
    // Fly forward along -z with a gentle weave + vertical breathe.
    state.camera.position.z = THREE.MathUtils.lerp(8, CARD_Z + 4, o);
    state.camera.position.x = Math.sin(o * Math.PI * 1.6) * 0.7;
    state.camera.position.y = Math.sin(o * Math.PI) * 0.6;
    state.camera.lookAt(0, 0, state.camera.position.z - 6);
  });

  return (
    <>
      <fog attach="fog" args={[FOG, 6, 34]} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[7, 9, 6]} intensity={1.6} color={KEY_LIGHT} />
      <directionalLight position={[-7, -3, 2]} intensity={0.6} color={FILL_LIGHT} />
      {/* rim from behind to halo the clouds */}
      <directionalLight position={[0, 2, -14]} intensity={1.1} color="#ffffff" />

      {/* Sparkles / dust motes drifting through the whole path. They bloom,
          which reads as floating light. */}
      <Sparkles
        count={70}
        scale={[14, 8, 30]}
        position={[0, 0, -6]}
        size={3}
        speed={0.25}
        opacity={0.7}
        color="#fff6e6"
      />

      {/* Clouds along the flight path (z: +6 → -16). */}
      <Clouds material={THREE.MeshLambertMaterial} limit={400}>
        <Cloud position={[-4.5, 1.6, 6]} seed={1} segments={22} bounds={[7, 1.6, 1.6]} volume={7} color="#ffffff" opacity={0.7} speed={0.08} growth={4} />
        <Cloud position={[5, -1.2, 2]} seed={2} segments={20} bounds={[7, 1.6, 1.6]} volume={7} color="#fbeede" opacity={0.6} speed={0.08} growth={4} />
        <Cloud position={[-3.5, -2.2, -3]} seed={3} segments={20} bounds={[6, 1.6, 1.6]} volume={6} color="#ffffff" opacity={0.62} speed={0.08} growth={4} />
        <Cloud position={[4.6, 2.4, -7]} seed={4} segments={20} bounds={[6, 1.6, 1.6]} volume={6} color="#efe7fb" opacity={0.58} speed={0.08} growth={4} />
        <Cloud position={[-1.6, -2.6, -11]} seed={5} segments={20} bounds={[7, 1.6, 1.6]} volume={7} color="#ffffff" opacity={0.62} speed={0.08} growth={4} />
        <Cloud position={[3.2, 1.4, -14]} seed={6} segments={18} bounds={[6, 1.4, 1.4]} volume={6} color="#fdeede" opacity={0.55} speed={0.08} growth={4} />
        <Cloud position={[-4, 0.4, -16]} seed={7} segments={18} bounds={[6, 1.4, 1.4]} volume={6} color="#ffffff" opacity={0.55} speed={0.08} growth={4} />
      </Clouds>

      {/* Block — "Choose your celebration", a glowing glass panel ~mid-path. */}
      <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.5}>
        <group position={[0, 0.2, 0]}>
          <mesh position={[0, 0, -0.06]}>
            <planeGeometry args={[5.8, 1.9]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#fff2e0"
              emissiveIntensity={0.4}
              transparent
              opacity={0.5}
              roughness={0.4}
            />
          </mesh>
          <Text
            fontSize={0.52}
            color="#43356a"
            anchorX="center"
            anchorY="middle"
            maxWidth={5.2}
            textAlign="center"
            letterSpacing={0.02}
          >
            Choose your celebration
          </Text>
        </group>
      </Float>

      {/* Landing card with a warm glow halo behind it (blooms on arrival). */}
      <Float speed={1.3} rotationIntensity={0.18} floatIntensity={0.45}>
        <group position={[0, 0, CARD_Z]}>
          <mesh position={[0, 0, -0.3]}>
            <planeGeometry args={[6.2, 6.2]} />
            <meshBasicMaterial
              color="#ffe6c4"
              transparent
              opacity={0.5}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <CardPlane />
        </group>
      </Float>
    </>
  );
}

function CardPlane() {
  const tex = useTexture(heroFront);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh>
      <planeGeometry args={[4.2, 4.2]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}
