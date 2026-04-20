// client/src/components/card-3d-viewer.tsx
//
// Reusable 3D card component. Square format only — matches the
// print product. Drives two contexts:
//
//   1. Digital card viewer (full-page) — via pages/card-viewer.tsx
//   2. Inline preview — Review step completion state
//
// Interaction model:
//   - Click → toggles open/close along the spine hinge
//   - Drag  → rotates the card via drei OrbitControls
//   - Wheel/pinch → zooms in/out (clamped)
//   - Back of card carries a "Made with Celebrait" wordmark as a
//     canvas texture — visible when rotated 180°. Foundation for the
//     viral credit (personalise with sender name later).
//
// Realness pass (2026-04-20):
//   - drei <Environment preset="apartment" /> for HDRI reflections
//   - 3-point lighting rig (warm key + cool fill + cool rim)
//   - MeshPhysicalMaterial with sheen so paper catches light
//   - ContactShadows to ground the card with a soft cast below
//   - Anisotropy from renderer.capabilities.getMaxAnisotropy()
//
// This is NOT the full CelebrationCard from celebrait-card-brief.md —
// that's a Sprint 5+ rebuild (envelope, seal, state machine, audio).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface Card3DViewerProps {
  frontImageUrl: string;
  insideImageUrl?: string | null;
  /** Optional wordmark text for the back of the card. Defaults to
   *  "Made with Celebrait" — the acquisition-funnel credit. */
  backCredit?: string;
  /** Container className — parent controls sizing + positioning. */
  className?: string;
}

export function Card3DViewer({
  frontImageUrl,
  insideImageUrl,
  backCredit = 'Made with Celebrait',
  className,
}: Card3DViewerProps) {
  const insideUrl = insideImageUrl ?? frontImageUrl;
  const [open, setOpen] = useState(false);

  return (
    <div className={className}>
      <Canvas
        shadows
        camera={{ position: [0, 0.15, 2.2], fov: 40 }}
        dpr={[1, 2]}
        gl={{
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
          antialias: true,
        }}
      >
        <Scene
          frontUrl={frontImageUrl}
          insideUrl={insideUrl}
          backCredit={backCredit}
          open={open}
          onOpenChange={setOpen}
        />
      </Canvas>
    </div>
  );
}

// ── Scene ────────────────────────────────────────────────────────────
function Scene({
  frontUrl,
  insideUrl,
  backCredit,
  open,
  onOpenChange,
}: {
  frontUrl: string;
  insideUrl: string;
  backCredit: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <>
      {/* HDRI environment — provides reflections for the sheen +
          clearcoat layers on the card stock. background={false} so
          the scene itself stays transparent and composites over the
          host page's backdrop. */}
      <Environment preset="apartment" background={false} />

      {/* 3-point lighting rig, brief §6. Keep intensities modest so
          the emissive texture still reads as the primary colour
          source — lighting adds the specular/sheen highlights on
          top, not the base colour. */}
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[3.5, 4, 3]}
        intensity={0.9}
        color="#fff4e4"                 // warm key (natural window)
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.02}
      />
      <directionalLight
        position={[-3, 2.5, 1.5]}
        intensity={0.35}
        color="#e8f0ff"                 // cool fill
      />
      <directionalLight
        position={[0, 1.5, -3]}
        intensity={0.3}
        color="#d8e4ff"                 // cool rim (back-light)
      />

      <Card
        frontUrl={frontUrl}
        insideUrl={insideUrl}
        backCredit={backCredit}
        open={open}
        onOpenChange={onOpenChange}
      />

      {/* ContactShadows — soft cast underneath the card for weight.
          Positioned just below the card's lowest edge; far clamp
          keeps the shadow from stretching into infinity when the
          card tilts. */}
      <ContactShadows
        position={[0, -CARD_H / 2 - 0.06, 0]}
        opacity={0.35}
        scale={4}
        blur={2.6}
        far={1.4}
        resolution={512}
      />

      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        enableZoom={true}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.5}
        maxDistance={3.2}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI - Math.PI / 3}
      />
    </>
  );
}

// ── Card ─────────────────────────────────────────────────────────────
// Single-panel-door model: the cover flips open around the spine. The
// inside plane carries the inside illustration on its front face and
// the credit wordmark on its back face (visible when rotated 180°).
const CARD_W = 1.45;
const CARD_H = 1.45;

const CLOSED_REST = 0;
const OPEN_REST = -2.1;

// Paper tones for the non-illustrated faces.
const PAPER_BACK = '#f8f4e8';
const CARD_BACK_PAPER = '#f8f4e8';

function Card({
  frontUrl,
  insideUrl,
  backCredit,
  open,
  onOpenChange,
}: {
  frontUrl: string;
  insideUrl: string;
  backCredit: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { gl } = useThree();
  const maxAnisotropy = useMemo(() => gl.capabilities.getMaxAnisotropy(), [gl]);

  const [frontTex, insideTex] = useTexture([frontUrl, insideUrl]);
  useEffect(() => {
    [frontTex, insideTex].forEach((t) => {
      if (t) {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = maxAnisotropy;
        t.minFilter = THREE.LinearMipmapLinearFilter;
        t.generateMipmaps = true;
        t.needsUpdate = true;
      }
    });
  }, [frontTex, insideTex, maxAnisotropy]);

  const backTex = useBackCreditTexture(backCredit, maxAnisotropy);

  const rootRef = useRef<THREE.Group>(null);
  const coverRef = useRef<THREE.Group>(null);
  const coverVelocity = useRef(0);

  const dragRef = useRef<{ down: boolean; moved: boolean; x: number; y: number }>({
    down: false,
    moved: false,
    x: 0,
    y: 0,
  });

  useFrame((_, delta) => {
    if (!rootRef.current || !coverRef.current) return;

    const targetRotY = open ? OPEN_REST : CLOSED_REST;
    const cover = coverRef.current;
    const stiffness = 70;
    const damping = 14;
    const accel = (targetRotY - cover.rotation.y) * stiffness - coverVelocity.current * damping;
    const dt = Math.min(delta, 1 / 30);
    coverVelocity.current += accel * dt;
    let nextRotY = cover.rotation.y + coverVelocity.current * dt;
    if (nextRotY > CLOSED_REST) {
      nextRotY = CLOSED_REST;
      coverVelocity.current = 0;
    }
    cover.rotation.y = nextRotY;
  });

  const handlePointerDown = (e: any) => {
    dragRef.current = {
      down: true,
      moved: false,
      x: e.clientX,
      y: e.clientY,
    };
  };
  const handlePointerMove = (e: any) => {
    if (!dragRef.current.down) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    if (dx * dx + dy * dy > 16) dragRef.current.moved = true;
  };
  const handlePointerUp = () => {
    const wasTap = dragRef.current.down && !dragRef.current.moved;
    dragRef.current.down = false;
    if (wasTap) onOpenChange(!open);
  };

  return (
    <group ref={rootRef} position={[0, 0, 0]}>
      <mesh
        position={[0, 0, 0.05]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[CARD_W * 1.3, CARD_H * 1.15]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Inside front face — illustration. PaperFace wraps the
          MeshPhysicalMaterial so every card face gets the same
          sheen + clearcoat + roughness recipe. Only the emissive
          texture changes. */}
      <PaperFace position={[0, 0, -0.008]} emissiveMap={insideTex} receiveShadow castShadow />

      {/* Back of the card — credit wordmark, visible at 180°. */}
      <PaperFace
        position={[0, 0, -0.011]}
        rotation={[0, Math.PI, 0]}
        emissiveMap={backTex}
        receiveShadow
      />

      <group
        ref={coverRef}
        position={[-CARD_W / 2, 0, 0]}
        rotation={[0, CLOSED_REST, 0]}
      >
        <PaperFace
          position={[CARD_W / 2, 0, 0]}
          emissiveMap={frontTex}
          receiveShadow
          castShadow
        />
        <PaperFace
          position={[CARD_W / 2, 0, -0.003]}
          rotation={[0, Math.PI, 0]}
          emissiveColor={PAPER_BACK}
          receiveShadow
        />
      </group>
    </group>
  );
}

// ── PaperFace ────────────────────────────────────────────────────────
// One side of a card face. MeshPhysicalMaterial with emissive map for
// colour fidelity + sheen/clearcoat for paper's subtle specular
// response. Uses emissive (not map) so the illustration stays vivid
// under any lighting — but sheen catches the 3-point rig, which is
// what produces the "paper" quality.
function PaperFace({
  position,
  rotation,
  emissiveMap,
  emissiveColor,
  castShadow,
  receiveShadow,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  emissiveMap?: THREE.Texture;
  emissiveColor?: string;
  castShadow?: boolean;
  receiveShadow?: boolean;
}) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <planeGeometry args={[CARD_W, CARD_H]} />
      <meshPhysicalMaterial
        color={0x000000}
        emissive={emissiveMap ? 0xffffff : (emissiveColor ?? PAPER_BACK)}
        emissiveMap={emissiveMap}
        emissiveIntensity={1.0}
        roughness={0.72}
        metalness={0}
        sheen={0.35}
        sheenRoughness={0.55}
        sheenColor={'#ffffff'}
        clearcoat={0.08}
        clearcoatRoughness={0.8}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

// ── useBackCreditTexture ─────────────────────────────────────────────
function useBackCreditTexture(credit: string, anisotropy: number): THREE.CanvasTexture {
  return useMemo(() => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = CARD_BACK_PAPER;
    ctx.fillRect(0, 0, size, size);

    const gradient = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.35,
      size / 2,
      size / 2,
      size * 0.75,
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.04)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = '#3d3529';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "300 42px 'Inter', system-ui, sans-serif";
    ctx.fillText(credit.toUpperCase(), size / 2, size / 2);

    ctx.fillStyle = '#8a7f6f';
    ctx.font = "300 22px 'Inter', system-ui, sans-serif";
    ctx.fillText('celebrait.com', size / 2, size / 2 + 44);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    return tex;
  }, [credit, anisotropy]);
}
