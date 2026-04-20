// client/src/components/card-3d-viewer.tsx
//
// Reusable 3D card component. Square format only — matches the
// print product (the only format we ship). Drives two contexts:
//
//   1. Digital card viewer (full-page) — via pages/card-viewer.tsx
//   2. Inline preview — Review step completion state
//
// Interaction model (MVP pass 2):
//   - Click → toggles open/close along the spine hinge
//   - Drag  → rotates the whole card on the Y axis (drei OrbitControls)
//   - Wheel/pinch → zooms in/out (clamped)
//   - Back of card carries a "Made with Celebrait" wordmark as a
//     canvas texture — visible when rotated 180°. Foundation for the
//     viral credit (personalise with sender name later).
//
// This is NOT the full CelebrationCard from celebrait-card-brief.md.
// That's a Sprint 5+ rebuild (envelope, seal, state machine, audio).
// This is the interim MVP viewer done well.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
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
        // Close framing so the card reads as "right in front of you"
        // at default. FOV wide enough for breathing room when the
        // cover swings out. Slightly above centre so the card's
        // horizontal centreline isn't on the viewport midline.
        camera={{ position: [0, 0.15, 2.2], fov: 40 }}
        dpr={[1, 2]}
        gl={{
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
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
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[3, 4, 2.5]}
        intensity={0.8}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0005}
      />
      <directionalLight position={[-3, 2, 1]} intensity={0.2} />

      <Card
        frontUrl={frontUrl}
        insideUrl={insideUrl}
        backCredit={backCredit}
        open={open}
        onOpenChange={onOpenChange}
      />

      {/* Drag-to-rotate + wheel/pinch-to-zoom. target=[0,0,0] forces
          the orbit focus onto the card — without it, drei infers the
          target from the initial camera lookAt and can land far off
          the card, which presents as "the card is tiny and drifting
          at the edge of the viewport." Clamped so users can't flip
          upside-down. Panning off — no reason to translate the card
          off-centre. */}
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
// inside plane is double-sided now so the back of the card (visible
// when the user drags around to 180°) renders a credit wordmark.
const CARD_W = 1.45;
const CARD_H = 1.45;

const CLOSED_REST = 0;
const OPEN_REST = -2.1;

// Back-of-cover paper tone. Visible when the cover swings past 90°.
const PAPER_BACK = '#f8f4e8';
// Back-of-card paper tone. Visible when the user rotates the whole
// card 180° via drag. Matches cover-back so the card reads as one
// cohesive piece of paper.
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
  const [frontTex, insideTex] = useTexture([frontUrl, insideUrl]);
  useEffect(() => {
    [frontTex, insideTex].forEach((t) => {
      if (t) {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
      }
    });
  }, [frontTex, insideTex]);

  const backTex = useBackCreditTexture(backCredit);

  const rootRef = useRef<THREE.Group>(null);
  const coverRef = useRef<THREE.Group>(null);
  const coverVelocity = useRef(0);

  // Track whether the user is actively dragging via the orbit handle.
  // When they are, we suppress the idle breathing so the card doesn't
  // subtly pulse-scale while they're inspecting it.
  const dragRef = useRef<{ down: boolean; moved: boolean; x: number; y: number }>({
    down: false,
    moved: false,
    x: 0,
    y: 0,
  });

  useFrame((_, delta) => {
    if (!rootRef.current || !coverRef.current) return;

    // Cover hinge — spring motion toward current target.
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

  // Click vs drag discrimination. OrbitControls consumes pointer moves
  // but doesn't stop the card's onClick handler firing after a drag.
  // Track pointer movement on the hit-target and only toggle open if
  // the pointer stayed close to its start.
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
      {/* Hit-target — catches taps for open/close. Drag suppresses
          the tap via the pointerdown/up bookkeeping above. */}
      <mesh
        position={[0, 0, 0.05]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[CARD_W * 1.3, CARD_H * 1.15]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Inside front face — the inside illustration. */}
      <mesh position={[0, 0, -0.008]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial
          color={0x000000}
          emissive={0xffffff}
          emissiveMap={insideTex}
          emissiveIntensity={1.0}
          roughness={0.9}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Back of the card — visible when the user rotates the whole
          card 180°. Canvas texture with the credit wordmark. Rotated
          180° on Y so the text reads correctly from the back side. */}
      <mesh position={[0, 0, -0.011]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial
          color={0x000000}
          emissive={0xffffff}
          emissiveMap={backTex}
          emissiveIntensity={1.0}
          roughness={0.95}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Cover — pivoted at the spine edge (x = -CARD_W/2). Rotation
          on Y swings it open like a door. Two faces: the front
          illustration (visible when closed) and the paper-back tone
          (visible when the cover is open past 90°). */}
      <group
        ref={coverRef}
        position={[-CARD_W / 2, 0, 0]}
        rotation={[0, CLOSED_REST, 0]}
      >
        <mesh position={[CARD_W / 2, 0, 0]}>
          <planeGeometry args={[CARD_W, CARD_H]} />
          <meshStandardMaterial
            color={0x000000}
            emissive={0xffffff}
            emissiveMap={frontTex}
            emissiveIntensity={1.0}
            roughness={0.9}
            side={THREE.FrontSide}
          />
        </mesh>
        <mesh position={[CARD_W / 2, 0, -0.003]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[CARD_W, CARD_H]} />
          <meshStandardMaterial
            color={0x000000}
            emissive={PAPER_BACK}
            emissiveIntensity={1.0}
            roughness={0.95}
            side={THREE.FrontSide}
          />
        </mesh>
      </group>
    </group>
  );
}

// ── useBackCreditTexture ─────────────────────────────────────────────
// Paints the credit wordmark onto an offscreen canvas and hands it
// back as a THREE.CanvasTexture. Cheaper than loading an image + lets
// the text composition tweak at dev time without re-exporting assets.
// Sized at 1024² because anisotropy + mipmaps keep it crisp at any
// zoom reachable via the orbit clamps.
function useBackCreditTexture(credit: string): THREE.CanvasTexture {
  return useMemo(() => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Paper background — matches CARD_BACK_PAPER so the textured
    // plane reads as one continuous paper surface with the edges.
    ctx.fillStyle = CARD_BACK_PAPER;
    ctx.fillRect(0, 0, size, size);

    // Subtle off-white vignette around the edges so the texture
    // doesn't look like a solid colour fill at close zoom.
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

    // Wordmark — centred, modest size. Colour is warm ink rather
    // than pure black so it sits on the cream paper naturally.
    ctx.fillStyle = '#3d3529';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "300 42px 'Inter', system-ui, sans-serif";
    ctx.fillText(credit.toUpperCase(), size / 2, size / 2);

    // Small celebrait.com line below the wordmark as the call-back
    // surface. Lighter weight so it reads as secondary.
    ctx.fillStyle = '#8a7f6f';
    ctx.font = "300 22px 'Inter', system-ui, sans-serif";
    ctx.fillText('celebrait.com', size / 2, size / 2 + 44);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    return tex;
  }, [credit]);
}
