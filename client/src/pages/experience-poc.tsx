// client/src/pages/experience-poc.tsx
//
// PROOF OF CONCEPT — immersive 3D scroll journey that SHOWCASES THE STUDIO.
// New direction (2026-06-02): the studio steps become floating 3D product
// panels in the studio's own visual language (rounded card + brand chips),
// stylized for speed. Each step plays a signature animation as you reach it.
//
// This beat = step 1, "Choose your celebration": fly toward a 3D panel whose
// occasion chips cycle and LAND on one, the panel dissolves, and you fly on
// to the finished card. Clean premium space (no clouds) — restrained, so the
// product is the hero. Isolated route /experience, not linked.
// See next_landing_3d_immersive_scroll.md.

import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  ScrollControls,
  useScroll,
  RoundedBox,
  Text,
  Sparkles,
  Float,
  useTexture,
} from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import heroFront from '@/assets/hero-card-front.png';

const BRAND = '#7a76e8';
const INK = '#2c2540';
const CHIP_BG = '#f1f0f7';
const CARD_Z = -16;

const OCCASIONS = [
  'Birthday',
  'Anniversary',
  'Wedding',
  'New baby',
  "Father's Day",
  'Thank you',
];
const FINAL = 0; // lands on Birthday

export default function ExperiencePocPage() {
  return (
    <div
      className="fixed inset-0"
      style={{
        background:
          'linear-gradient(180deg, #f4f2fb 0%, #eef3fb 58%, #f8f1ec 100%)',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 55 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ScrollControls pages={3} damping={0.3}>
            <Scene />
          </ScrollControls>
          {/* Subtle bloom only — just enough to lift the selected chip + card. */}
          <EffectComposer>
            <Bloom
              intensity={0.35}
              luminanceThreshold={0.75}
              luminanceSmoothing={0.3}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="pt-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-ink-soft/70 font-semibold">
            Celebrait · experience POC
          </p>
        </div>
        <div className="mt-auto pb-8 text-center">
          <p className="text-sm text-ink-soft/70 animate-pulse">Scroll ↓</p>
        </div>
      </div>
    </div>
  );
}

function Scene() {
  const scroll = useScroll();
  const [selected, setSelected] = useState(0);
  const lastIdx = useRef(-1);
  const panelRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const o = scroll.offset; // 0..1
    state.camera.position.z = THREE.MathUtils.lerp(8, CARD_Z + 4, o);
    state.camera.position.x = Math.sin(o * Math.PI * 1.2) * 0.4;
    state.camera.position.y = Math.sin(o * Math.PI) * 0.25;
    state.camera.lookAt(0, 0, state.camera.position.z - 6);

    // Chip cycle while approaching the panel (z ≈ 0, reached at o ≈ 0.4).
    // Cycle fast through the occasions, then settle on FINAL.
    const p = THREE.MathUtils.clamp((o - 0.08) / (0.28 - 0.08), 0, 1);
    let idx = 0;
    if (p > 0 && p < 0.82) {
      idx = Math.floor((p / 0.82) * OCCASIONS.length * 2.6) % OCCASIONS.length;
    } else if (p >= 0.82) {
      idx = FINAL;
    }
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      setSelected(idx);
    }

    // Dissolve the panel (scale down) just before the camera flies through it.
    if (panelRef.current) {
      const s = 1 - THREE.MathUtils.smoothstep(o, 0.3, 0.4);
      panelRef.current.scale.setScalar(Math.max(0.0001, s));
    }
  });

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 6, 6]} intensity={1.1} color="#fff4e6" />
      <directionalLight position={[-5, -2, 3]} intensity={0.4} color="#dfe6ff" />

      <Sparkles
        count={40}
        scale={[12, 7, 26]}
        position={[0, 0, -5]}
        size={2}
        speed={0.2}
        opacity={0.5}
        color={BRAND}
      />

      {/* Step 1 panel — Choose your celebration */}
      <Float speed={1} rotationIntensity={0.06} floatIntensity={0.35}>
        <group ref={panelRef}>
          <ChoosePanel selected={selected} />
        </group>
      </Float>

      {/* Landing card — the payoff */}
      <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.4}>
        <group position={[0, 0, CARD_Z]}>
          <mesh position={[0, 0, -0.25]}>
            <planeGeometry args={[5.6, 5.6]} />
            <meshBasicMaterial
              color="#ffe9cf"
              transparent
              opacity={0.4}
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

function ChoosePanel({ selected }: { selected: number }) {
  return (
    <group>
      {/* Card backing — rounded, with real depth. */}
      <RoundedBox args={[3.6, 4.6, 0.18]} radius={0.18} smoothness={4}>
        <meshStandardMaterial color="#ffffff" roughness={0.65} />
      </RoundedBox>

      {/* Title */}
      <Text
        position={[0, 1.78, 0.11]}
        fontSize={0.26}
        color={INK}
        anchorX="center"
        anchorY="middle"
        maxWidth={3.1}
        textAlign="center"
        lineHeight={1.15}
      >
        Choose your{'\n'}celebration
      </Text>

      {/* Occasion chips — 2 cols × 3 rows */}
      {OCCASIONS.map((label, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col === 0 ? -0.86 : 0.86;
        const y = 0.7 - row * 0.92;
        return (
          <Chip
            key={label}
            label={label}
            position={[x, y, 0.11]}
            active={i === selected}
          />
        );
      })}
    </group>
  );
}

function Chip({
  label,
  position,
  active,
}: {
  label: string;
  position: [number, number, number];
  active: boolean;
}) {
  return (
    <group position={position}>
      <RoundedBox args={[1.52, 0.66, 0.07]} radius={0.13} smoothness={4}>
        <meshStandardMaterial
          color={active ? BRAND : CHIP_BG}
          emissive={active ? BRAND : '#000000'}
          emissiveIntensity={active ? 0.55 : 0}
          roughness={0.5}
        />
      </RoundedBox>
      <Text
        position={[0, 0, 0.06]}
        fontSize={0.17}
        color={active ? '#ffffff' : INK}
        anchorX="center"
        anchorY="middle"
        maxWidth={1.4}
        textAlign="center"
      >
        {label}
      </Text>
    </group>
  );
}

function CardPlane() {
  const tex = useTexture(heroFront);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh>
      <planeGeometry args={[4, 4]} />
      <meshBasicMaterial map={tex} toneMapped={false} />
    </mesh>
  );
}
