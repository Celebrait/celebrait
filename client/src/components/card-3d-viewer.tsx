// client/src/components/card-3d-viewer.tsx
//
// Reusable 3D card component. Square format only — matches the
// print product. Two integration contexts:
//
//   1. Digital card viewer (full-page) — pages/card-viewer.tsx
//   2. Inline preview — Review step completion state
//
// Interaction:
//   - Click → toggle open/close along the spine hinge
//   - Drag  → rotate the card (drei OrbitControls)
//   - Wheel/pinch → zoom (clamped)
//   - Back of card carries a "Made with Celebrait" wordmark, visible
//     when rotated 180°. Viral-credit foundation.
//
// Rendering approach:
//   - Textures applied as `map` (not emissive). Texture response is
//     driven by lighting so shadows are actually visible on the
//     card surface. Lighting levels are balanced so the texture's
//     full colour reads on lit regions (ambient + key ≈ 1.0) while
//     shadowed regions drop to ambient-only (~0.6) — visibly darker
//     without washing out.
//   - MeshStandardMaterial, not Physical. Sheen / clearcoat /
//     environment reflections desaturate the illustration; the
//     "paper feel" has to come from lighting + shadows alone.
//   - ContactShadows underneath for ground weight.
//   - Cover meshes castShadow so they drop a shadow on the inside
//     plane (receiveShadow) when the card is open.
//
// This is NOT the full CelebrationCard from celebrait-card-brief.md.
// That's a Sprint 5+ rebuild (envelope, seal, state machine, audio).

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface Card3DViewerProps {
  frontImageUrl: string;
  insideImageUrl?: string | null;
  backCredit?: string;
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
      {/* Ambient + one key light. Balanced so lit regions render the
          texture at full saturation (ambient 0.6 + key ~0.45 at the
          face's typical angle ≈ 1.0) while shadowed regions drop to
          ambient only (~0.6). That 40% delta is what makes the
          cover-cast shadow on the inside plane visibly read.

          Key light positioned upper-LEFT-front so when the cover
          swings open to the left, it sits between the key light and
          the inside plane, casting the shadow onto the inside. */}
      {/* Intensities tuned for three.js 0.170 physically-correct
          lighting — each light's contribution is ~/PI vs. the legacy
          model. 1.9 ambient + 1.5 key lands ≈ 1.0 texture response on
          lit regions and ≈ 0.6 in shadow (a visible 40% delta for
          the cover-cast shadow on the inside). */}
      <ambientLight intensity={1.9} />
      <directionalLight
        position={[-2.5, 3, 3]}
        intensity={1.5}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.02}
        shadow-camera-near={0.1}
        shadow-camera-far={12}
        shadow-camera-left={-3}
        shadow-camera-right={3}
        shadow-camera-top={3}
        shadow-camera-bottom={-3}
      />

      <Card
        frontUrl={frontUrl}
        insideUrl={insideUrl}
        backCredit={backCredit}
        open={open}
        onOpenChange={onOpenChange}
      />

      {/* Ground shadow — grounds the card with a soft cast below.
          far 1.4 keeps the shadow from stretching when the card
          tilts via OrbitControls. */}
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
const CARD_W = 1.45;
const CARD_H = 1.45;

const CLOSED_REST = 0;
const OPEN_REST = -2.1;

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

      {/* Inside face — receives the cover's shadow when open. */}
      <mesh position={[0, 0, -0.008]} receiveShadow>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={insideTex} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Back of the card — credit wordmark, visible at 180°. */}
      <mesh position={[0, 0, -0.011]} rotation={[0, Math.PI, 0]} receiveShadow>
        <planeGeometry args={[CARD_W, CARD_H]} />
        <meshStandardMaterial map={backTex} roughness={0.95} side={THREE.DoubleSide} />
      </mesh>

      {/* Cover — pivoted at the spine edge. Casts shadows onto the
          inside plane when swung open. DoubleSide so the shadow
          casts regardless of which side faces the key light. */}
      <group
        ref={coverRef}
        position={[-CARD_W / 2, 0, 0]}
        rotation={[0, CLOSED_REST, 0]}
      >
        <mesh position={[CARD_W / 2, 0, 0]} castShadow receiveShadow>
          <planeGeometry args={[CARD_W, CARD_H]} />
          <meshStandardMaterial map={frontTex} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[CARD_W / 2, 0, -0.003]} rotation={[0, Math.PI, 0]} castShadow receiveShadow>
          <planeGeometry args={[CARD_W, CARD_H]} />
          <meshStandardMaterial color={PAPER_BACK} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
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
