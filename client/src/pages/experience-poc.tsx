// client/src/pages/experience-poc.tsx
//
// PROOF OF CONCEPT — immersive 3D scroll journey showcasing the studio.
// v3 (2026-06-02, Kevin's call): DON'T rebuild the UI as 3D geometry (it goes
// puffy/skeuomorphic). Keep the studio UI FLAT + crisp + authentic, and put
// it on the SCREEN of a floating 3D PHONE. The phone is the only 3D object
// (premium material, angle, env lighting, soft shadow, flies on scroll); the
// interface stays exactly like the real app.
//
// This beat = step 1 "Who's this card for?": the phone flies in at an angle,
// the name types itself, the occasion cycles and lands on Birthday, then the
// phone dissolves and we fly to the finished card.
//
// Real UI via drei <Html transform> — actual DOM (real lucide icons, real
// Tailwind), so it's pixel-crisp, not a blurry texture. Isolated /experience.

import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  ScrollControls,
  useScroll,
  Environment,
  Lightformer,
  ContactShadows,
  RoundedBox,
  Html,
  Float,
  useTexture,
} from '@react-three/drei';
import { Cake, Heart, Gem, GraduationCap, ChevronDown } from 'lucide-react';
import * as THREE from 'three';
import heroFront from '@/assets/hero-card-front.png';

const CARD_Z = -14;
const NAME = 'Sarah';
const OCCASIONS = [
  { label: 'Birthday', Icon: Cake },
  { label: 'Anniversary', Icon: Heart },
  { label: 'Wedding', Icon: Gem },
  { label: 'Graduation', Icon: GraduationCap },
];
const FINAL = 0;

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
        camera={{ position: [0.9, 0.3, 7], fov: 45 }}
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
  const [typed, setTyped] = useState('');
  const [selected, setSelected] = useState(0);
  const lastTyped = useRef(-1);
  const lastSel = useRef(-1);
  const phoneRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const o = scroll.offset; // 0..1
    state.camera.position.z = THREE.MathUtils.lerp(7, CARD_Z + 4, o);
    state.camera.position.x = THREE.MathUtils.lerp(0.9, -0.5, o);
    state.camera.position.y = 0.3 + Math.sin(o * Math.PI) * 0.2;
    state.camera.lookAt(-0.1, 0, state.camera.position.z - 6);

    // 1) Name types in (o 0.05 → 0.16)
    const tp = THREE.MathUtils.clamp((o - 0.05) / (0.16 - 0.05), 0, 1);
    const tlen = Math.round(tp * NAME.length);
    if (tlen !== lastTyped.current) {
      lastTyped.current = tlen;
      setTyped(NAME.slice(0, tlen));
    }

    // 2) Occasion cycles then lands on Birthday (o 0.17 → 0.3)
    const sp = THREE.MathUtils.clamp((o - 0.17) / (0.3 - 0.17), 0, 1);
    let idx = 0;
    if (sp > 0 && sp < 0.8) {
      idx = Math.floor((sp / 0.8) * OCCASIONS.length * 2.4) % OCCASIONS.length;
    } else if (sp >= 0.8) {
      idx = FINAL;
    }
    if (idx !== lastSel.current) {
      lastSel.current = idx;
      setSelected(idx);
    }

    // 3) Dissolve the phone just before we fly through it.
    if (phoneRef.current) {
      const s = 1 - THREE.MathUtils.smoothstep(o, 0.34, 0.44);
      phoneRef.current.scale.setScalar(Math.max(0.0001, s));
    }
  });

  return (
    <>
      {/* Image-based light (lightformers — no HDRI fetch) for a premium
          phone body. */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2.2} position={[0, 4, 3]} scale={[12, 8, 1]} color="#ffffff" />
        <Lightformer intensity={1.1} position={[-6, 1, 2]} scale={[5, 6, 1]} color="#e6ecff" />
        <Lightformer intensity={1.0} position={[6, -1, 2]} scale={[5, 6, 1]} color="#fff2e6" />
      </Environment>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={0.8} color="#fff6ea" />

      {/* The 3D phone — only thing that's 3D; screen is the real flat UI. */}
      <group ref={phoneRef}>
        <Float speed={1} rotationIntensity={0.06} floatIntensity={0.3}>
          <group rotation={[0.02, -0.2, 0]}>
            <Phone typed={typed} selected={selected} />
          </group>
        </Float>
      </group>

      {/* Landing card. */}
      <Float speed={1.1} rotationIntensity={0.1} floatIntensity={0.35}>
        <group position={[-0.1, 0, CARD_Z]} rotation={[0.02, 0.14, 0]}>
          <mesh position={[0, 0, -0.25]}>
            <planeGeometry args={[5.2, 5.2]} />
            <meshBasicMaterial color="#ffe6cf" transparent opacity={0.32} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <CardPlane />
        </group>
      </Float>

      <ContactShadows position={[0, -2.6, 0]} opacity={0.3} scale={24} blur={2.6} far={6} resolution={512} color="#3a2f55" />
    </>
  );
}

function Phone({ typed, selected }: { typed: string; selected: number }) {
  return (
    <group>
      {/* Phone body — premium soft-white, catches the environment. */}
      <RoundedBox args={[2.45, 4.95, 0.22]} radius={0.34} smoothness={6}>
        <meshStandardMaterial color="#f4f4f7" roughness={0.28} metalness={0.05} envMapIntensity={1.2} />
      </RoundedBox>

      {/* Screen — the REAL studio UI as flat crisp DOM, on the phone face. */}
      <Html
        transform
        position={[0, 0, 0.13]}
        scale={0.0072}
        style={{ pointerEvents: 'none' }}
        zIndexRange={[0, 0]}
      >
        <StudioScreen typed={typed} selected={selected} />
      </Html>
    </group>
  );
}

// Faithful clone of the studio's "Who's this card for?" step — real Tailwind,
// real lucide icons. Selected occasion uses the brand highlight, like the app.
function StudioScreen({ typed, selected }: { typed: string; selected: number }) {
  return (
    <div
      style={{ width: 300 }}
      className="rounded-[26px] bg-white px-5 py-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.25)] font-sans select-none"
    >
      <h2 className="text-[20px] font-bold text-ink leading-tight">
        Who's this card for?
      </h2>
      <p className="text-[12px] text-stone-500 mt-1.5">
        A name and a reason — that's all we need to start.
      </p>

      <p className="text-[13px] text-ink mt-5 mb-1.5">Name</p>
      <div className="rounded-xl border-2 border-brand/50 bg-stone-50 px-3 py-2.5 text-[14px]">
        {typed ? (
          <span className="text-ink">
            {typed}
            <span className="inline-block w-[2px] h-[15px] bg-brand align-middle ml-0.5 animate-pulse" />
          </span>
        ) : (
          <span className="text-stone-400">e.g. Mum, Sarah, Dad</span>
        )}
      </div>

      <p className="text-[13px] text-ink mt-5 mb-2.5">What's the celebration?</p>
      <div className="space-y-2">
        {OCCASIONS.map(({ label, Icon }, i) => {
          const active = i === selected;
          return (
            <div
              key={label}
              className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors ${
                active
                  ? 'border-brand bg-brand-muted/40'
                  : 'border-stone-200 bg-white'
              }`}
            >
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-pink-100 text-pink-500">
                <Icon className="w-[18px] h-[18px]" strokeWidth={2} />
              </span>
              <span className="text-[14px] font-medium text-ink">{label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-1 text-[12px] text-brand font-medium">
        <ChevronDown className="w-3.5 h-3.5" />
        More occasions
      </div>
    </div>
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
