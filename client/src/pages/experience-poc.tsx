// client/src/pages/experience-poc.tsx
//
// PROOF OF CONCEPT — immersive 3D scroll journey showcasing the studio.
// v6 (2026-06-02, Kevin's call): use the rendered "Choose your celebration"
// card, but CLEAN — smooth soft edges + matte WHITE (drop the grey/metallic
// container look). The earlier grey was insufficient light + metalness; the
// harshness was embossed bevels. Fixed here: matte white, no metalness,
// generous corner radius + high smoothness, flat (un-embossed) chips, and
// even soft environment light so white reads white.
//
// Chips cycle and land on Birthday as you scroll. Isolated /experience.

import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  ScrollControls,
  useScroll,
  Environment,
  Lightformer,
  ContactShadows,
  RoundedBox,
  Text,
  Float,
} from '@react-three/drei';
import * as THREE from 'three';

const BRAND = '#7a76e8';
const INK = '#2c2540';
const CHIP_BG = '#f3f2f9';

const OCCASIONS = [
  'Birthday',
  'Anniversary',
  'Wedding',
  'New baby',
  "Father's Day",
  'Thank you',
];
const FINAL = 0;

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
        camera={{ position: [0.3, 0.2, 7], fov: 45 }}
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
  const [selected, setSelected] = useState(0);
  const lastIdx = useRef(-1);

  useFrame((state) => {
    const o = scroll.offset;
    // Gentle push-in + drift — clean presentation, not a fly-through.
    state.camera.position.z = THREE.MathUtils.lerp(7, 5.8, o);
    state.camera.position.x = THREE.MathUtils.lerp(0.3, -0.3, o);
    state.camera.position.y = 0.2 + Math.sin(o * Math.PI) * 0.1;
    state.camera.lookAt(0, 0, 0);

    // Chips cycle, then land on Birthday.
    const p = THREE.MathUtils.clamp((o - 0.1) / (0.55 - 0.1), 0, 1);
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
  });

  return (
    <>
      {/* Even, soft, bright environment so white reads as white. */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.6} position={[0, 4, 4]} scale={[14, 10, 1]} color="#ffffff" />
        <Lightformer intensity={1.4} position={[-6, 0, 3]} scale={[6, 8, 1]} color="#eef2ff" />
        <Lightformer intensity={1.4} position={[6, 0, 3]} scale={[6, 8, 1]} color="#fff6ee" />
      </Environment>
      <ambientLight intensity={1.0} />
      <directionalLight position={[2, 5, 6]} intensity={0.5} color="#ffffff" />

      <Float speed={1} rotationIntensity={0.04} floatIntensity={0.25}>
        <group rotation={[0.01, -0.1, 0]}>
          <ChoosePanel selected={selected} />
        </group>
      </Float>

      <ContactShadows position={[0, -2.6, 0]} opacity={0.22} scale={20} blur={3} far={5.5} resolution={512} color="#3a2f55" />
    </>
  );
}

function ChoosePanel({ selected }: { selected: number }) {
  return (
    <group>
      {/* Card — matte white, generous radius + high smoothness, NO metal. */}
      <RoundedBox args={[3.7, 4.6, 0.14]} radius={0.3} smoothness={10}>
        <meshStandardMaterial color="#ffffff" roughness={0.85} metalness={0} envMapIntensity={0.7} />
      </RoundedBox>

      <Text
        position={[0, 1.78, 0.085]}
        fontSize={0.26}
        color={INK}
        anchorX="center"
        anchorY="middle"
        maxWidth={3.1}
        textAlign="center"
        lineHeight={1.12}
      >
        Choose your{'\n'}celebration
      </Text>

      {OCCASIONS.map((label, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col === 0 ? -0.86 : 0.86;
        const y = 0.72 - row * 0.84;
        return <Chip key={label} label={label} position={[x, y, 0.085]} active={i === selected} />;
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
      {/* Flat, smooth chip — thin, big radius, matte (no emboss). */}
      <RoundedBox args={[1.56, 0.66, 0.04]} radius={0.2} smoothness={8}>
        <meshStandardMaterial
          color={active ? BRAND : CHIP_BG}
          emissive={active ? BRAND : '#000000'}
          emissiveIntensity={active ? 0.3 : 0}
          roughness={0.8}
          metalness={0}
        />
      </RoundedBox>
      <Text
        position={[0, 0, 0.035]}
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
