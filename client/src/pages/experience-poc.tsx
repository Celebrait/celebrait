// client/src/pages/experience-poc.tsx
//
// PROOF OF CONCEPT — immersive 3D scroll journey showcasing the studio.
// v2 (senior rebuild, 2026-06-02): the grey/flat first pass missed the
// fundamentals of a premium render. Fixed here:
//   • Environment (Lightformers) → image-based lighting/reflections, so the
//     white card reads WHITE + premium, not grey. (the #1 unlock)
//   • ContactShadows → objects sit with weight, not floating toys.
//   • Cinematic ANGLE — the panel/card presented at a 3/4, with perspective.
//   • Studio's real language: white card + occasion ROWS with pink icon
//     tiles (matches the actual recipient step) instead of grey buttons.
//   • A satisfying selection "land" (lift + violet glow).
//
// Honest ceiling: this is roughly the best REAL-TIME WebGL gets, iterated
// blind. True "3D-movie" quality = pre-rendered sequence scrubbed on scroll
// (needs a 3D artist). See next_landing_3d_immersive_scroll.md.

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
  useTexture,
} from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import heroFront from '@/assets/hero-card-front.png';

const BRAND = '#7a76e8';
const INK = '#2c2540';
const PINK_TILE = '#fbdcec';
const PINK_ICON = '#e8519b';
const CARD_Z = -15;

const OCCASIONS = ['Birthday', 'Anniversary', 'Wedding', 'Graduation'];
const FINAL = 0; // lands on Birthday

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
        camera={{ position: [1.2, 0.4, 8], fov: 50 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <ScrollControls pages={3} damping={0.3}>
            <Scene />
          </ScrollControls>
          <EffectComposer>
            <Bloom
              intensity={0.5}
              luminanceThreshold={0.7}
              luminanceSmoothing={0.35}
              mipmapBlur
            />
          </EffectComposer>
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
  const panelRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const o = scroll.offset; // 0..1
    // Cinematic dolly — slight off-axis so we view the panel at an angle.
    state.camera.position.z = THREE.MathUtils.lerp(8, CARD_Z + 4, o);
    state.camera.position.x = THREE.MathUtils.lerp(1.2, -0.6, o);
    state.camera.position.y = 0.4 + Math.sin(o * Math.PI) * 0.25;
    state.camera.lookAt(-0.2, 0, state.camera.position.z - 6);

    // Chips cycle while approaching the panel, then settle on FINAL.
    const p = THREE.MathUtils.clamp((o - 0.08) / (0.26 - 0.08), 0, 1);
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

    // Dissolve the panel just before we fly through it.
    if (panelRef.current) {
      const s = 1 - THREE.MathUtils.smoothstep(o, 0.32, 0.42);
      panelRef.current.scale.setScalar(Math.max(0.0001, s));
    }
  });

  return (
    <>
      {/* Image-based lighting via lightformers (no external HDRI fetch). This
          is what makes white read premium-white with soft reflections. */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.2} position={[0, 4, 2]} scale={[12, 8, 1]} color="#ffffff" />
        <Lightformer intensity={1.1} position={[-6, 1, 2]} scale={[5, 6, 1]} color="#e6ecff" />
        <Lightformer intensity={1.0} position={[6, -1, 2]} scale={[5, 6, 1]} color="#fff2e6" />
        <Lightformer intensity={0.8} position={[0, -4, -3]} scale={[10, 6, 1]} color="#f3eefb" />
      </Environment>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 6, 5]} intensity={0.8} color="#fff6ea" />

      {/* Step 1 — Choose your celebration, presented at a 3/4 angle. */}
      <group ref={panelRef}>
        <Float speed={1} rotationIntensity={0.05} floatIntensity={0.3}>
          <group rotation={[0.03, -0.26, 0]}>
            <ChoosePanel selected={selected} />
          </group>
        </Float>
      </group>

      {/* Landing card — slight angle, soft additive glow. */}
      <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.35}>
        <group position={[-0.2, 0, CARD_Z]} rotation={[0.02, 0.16, 0]}>
          <mesh position={[0, 0, -0.25]}>
            <planeGeometry args={[5.4, 5.4]} />
            <meshBasicMaterial
              color="#ffe6cf"
              transparent
              opacity={0.35}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <CardPlane />
        </group>
      </Float>

      {/* Grounding shadow under the whole scene. */}
      <ContactShadows
        position={[0, -2.7, 0]}
        opacity={0.32}
        scale={26}
        blur={2.6}
        far={6}
        resolution={512}
        color="#3a2f55"
      />
    </>
  );
}

function ChoosePanel({ selected }: { selected: number }) {
  return (
    <group>
      {/* Card body — soft white, low roughness so it catches the env. */}
      <RoundedBox args={[3.7, 4.5, 0.16]} radius={0.2} smoothness={5}>
        <meshStandardMaterial color="#ffffff" roughness={0.32} metalness={0} envMapIntensity={1.1} />
      </RoundedBox>

      <Text
        position={[-1.5, 1.78, 0.1]}
        fontSize={0.26}
        color={INK}
        anchorX="left"
        anchorY="middle"
        maxWidth={3.2}
        lineHeight={1.1}
      >
        Choose your{'\n'}celebration
      </Text>

      {OCCASIONS.map((label, i) => (
        <OccasionRow
          key={label}
          label={label}
          y={0.75 - i * 0.78}
          active={i === selected}
        />
      ))}
    </group>
  );
}

function OccasionRow({
  label,
  y,
  active,
}: {
  label: string;
  y: number;
  active: boolean;
}) {
  return (
    <group position={[0, y, active ? 0.2 : 0.09]}>
      {/* Violet selection ring, behind, when active. */}
      {active && (
        <RoundedBox args={[3.28, 0.74, 0.05]} radius={0.2} smoothness={4} position={[0, 0, -0.04]}>
          <meshStandardMaterial color={BRAND} emissive={BRAND} emissiveIntensity={0.7} roughness={0.4} />
        </RoundedBox>
      )}
      {/* Row card */}
      <RoundedBox args={[3.16, 0.64, 0.09]} radius={0.16} smoothness={4}>
        <meshStandardMaterial color="#ffffff" roughness={0.28} metalness={0} envMapIntensity={1.1} />
      </RoundedBox>
      {/* Pink icon tile + dot (placeholder for the real occasion icon). */}
      <RoundedBox args={[0.44, 0.44, 0.06]} radius={0.12} smoothness={4} position={[-1.22, 0, 0.07]}>
        <meshStandardMaterial color={PINK_TILE} roughness={0.45} />
      </RoundedBox>
      <RoundedBox args={[0.2, 0.2, 0.04]} radius={0.06} smoothness={3} position={[-1.22, 0, 0.12]}>
        <meshStandardMaterial color={PINK_ICON} emissive={PINK_ICON} emissiveIntensity={0.25} roughness={0.5} />
      </RoundedBox>
      <Text position={[-0.82, 0, 0.08]} fontSize={0.2} color={INK} anchorX="left" anchorY="middle">
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
