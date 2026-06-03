// client/src/pages/experience-poc.tsx
//
// PROOF OF CONCEPT — immersive scroll journey showcasing the studio.
// v8 (2026-06-02, Kevin's brief): use the real studio screenshot, mobile
// render — NO border/frame, silently floating, soft curved edges, gentle
// lighting + a soft shadow. Scroll crossfades through the steps (one for now).
//
// Screenshots live at client/src/assets/experience/step-N.png. Drop more in
// and extend STEPS. Custom artwork can replace them later. Isolated.

import { Suspense, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  ScrollControls,
  useScroll,
  Environment,
  Lightformer,
  ContactShadows,
  Float,
  useTexture,
} from '@react-three/drei';
import * as THREE from 'three';
import step1 from '@/assets/experience/step-1.png';
// import step2 from '@/assets/experience/step-2.png';

const STEPS: string[] = [step1];
const PANEL_H = 5.0; // world height of the screenshot

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
        camera={{ position: [0.2, 0.2, 7.6], fov: 42 }}
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
    state.camera.position.z = THREE.MathUtils.lerp(7.6, 6.3, o);
    state.camera.position.x = THREE.MathUtils.lerp(0.2, -0.2, o);
    state.camera.position.y = 0.2 + Math.sin(o * Math.PI) * 0.08;
    state.camera.lookAt(0, 0, 0);
  });

  return (
    <>
      {/* Soft, even light + a gentle gradient across the card so it reads as
          a real lit object, without washing out the UI colours. */}
      <Environment resolution={256} frames={1}>
        <Lightformer intensity={2} position={[0, 4, 4]} scale={[14, 10, 1]} color="#ffffff" />
        <Lightformer intensity={1.2} position={[-6, 1, 3]} scale={[6, 8, 1]} color="#eef2ff" />
        <Lightformer intensity={1.1} position={[6, -1, 3]} scale={[6, 8, 1]} color="#fff6ee" />
      </Environment>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 5, 6]} intensity={0.6} color="#ffffff" />

      {/* Silently floating screenshot — no frame, curved edges. */}
      <Float speed={0.9} rotationIntensity={0.06} floatIntensity={0.45}>
        <group rotation={[0.015, -0.12, 0]}>
          <StepCard />
        </group>
      </Float>

      <ContactShadows position={[0, -2.9, 0]} opacity={0.26} scale={20} blur={3.2} far={6} resolution={512} color="#3a2f55" />
    </>
  );
}

// Rounded-rectangle plane geometry with the texture UV-mapped across it — for
// soft curved edges on the screenshot without any frame.
function buildRoundedPlane(w: number, h: number, r: number) {
  const hw = w / 2;
  const hh = h / 2;
  const s = new THREE.Shape();
  s.moveTo(-hw + r, -hh);
  s.lineTo(hw - r, -hh);
  s.quadraticCurveTo(hw, -hh, hw, -hh + r);
  s.lineTo(hw, hh - r);
  s.quadraticCurveTo(hw, hh, hw - r, hh);
  s.lineTo(-hw + r, hh);
  s.quadraticCurveTo(-hw, hh, -hw, hh - r);
  s.lineTo(-hw, -hh + r);
  s.quadraticCurveTo(-hw, -hh, -hw + r, -hh);
  const geom = new THREE.ShapeGeometry(s, 16);
  const pos = geom.attributes.position;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uvs[i * 2] = (pos.getX(i) + hw) / w;
    uvs[i * 2 + 1] = (pos.getY(i) + hh) / h;
  }
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return geom;
}

function StepCard() {
  const scroll = useScroll();
  const textures = useTexture(STEPS) as unknown as THREE.Texture[];
  const list = Array.isArray(textures) ? textures : [textures];
  list.forEach((t) => (t.colorSpace = THREE.SRGBColorSpace));

  const img0 = list[0]?.image as HTMLImageElement | undefined;
  const aspect = img0 && img0.height ? img0.width / img0.height : 0.81;
  const W = PANEL_H * aspect;
  const geom = useMemo(() => buildRoundedPlane(W, PANEL_H, 0.18), [W]);

  const matRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);

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
        <mesh key={i} geometry={geom} position={[0, 0, 0.001 * i]} renderOrder={i}>
          <meshStandardMaterial
            ref={(r) => (matRefs.current[i] = r)}
            map={tex}
            roughness={0.82}
            metalness={0}
            envMapIntensity={0.5}
            transparent
            opacity={i === 0 ? 1 : 0}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
