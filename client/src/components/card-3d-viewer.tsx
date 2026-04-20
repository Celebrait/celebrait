// client/src/components/card-3d-viewer.tsx
//
// Reusable 3D card component. Same core r3f scene feeds two contexts:
//
//   1. Digital card viewer (full-page) — via pages/card-viewer.tsx.
//      Wraps this with a welcome screen + share chrome. Portrait format.
//   2. Print preview inline — via Review step completion state.
//      Embedded preview of the card the user is about to order. Square
//      format (current print product).
//
// Everything visual and interactive (open animation, tilt, camera dolly,
// shadow tracking, breathing idle) lives here. Parents control
// container sizing (via className) and whatever chrome surrounds it.

import { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

export type CardFormat = 'portrait' | 'square';

interface Card3DViewerProps {
  frontImageUrl: string;
  insideImageUrl?: string | null;
  /** Card aspect — 'portrait' (tall, digital default) or 'square'
   *  (current print product format). Default 'portrait'. */
  format?: CardFormat;
  /** Container className — parent controls sizing + positioning. */
  className?: string;
}

export function Card3DViewer({
  frontImageUrl,
  insideImageUrl,
  format = 'portrait',
  className,
}: Card3DViewerProps) {
  const insideUrl = insideImageUrl ?? frontImageUrl;
  // Lifted here so the DOM-overlay TapIndicator can hide/fade based
  // on open state without needing to peek inside the r3f scene.
  const [open, setOpen] = useState(false);

  return (
    <div className={`${className ?? ''} relative`}>
      <Canvas
        shadows
        // Restored to the original framing — front-facing card with
        // a gentle downward camera angle and breathing room below
        // for the shadow.
        camera={{ position: [0, 0.3, 3.4], fov: 35 }}
        dpr={[1, 2]}
        gl={{
          // r3f defaults to ACESFilmicToneMapping which desaturates the
          // illustration. NoToneMapping lets the texture pass through
          // at full saturation so the card reads like a real photo.
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <Scene
          frontUrl={frontImageUrl}
          insideUrl={insideUrl}
          format={format}
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
  format,
  open,
  onOpenChange,
}: {
  frontUrl: string;
  insideUrl: string;
  format: CardFormat;
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

      <CameraDolly open={open} />

      <Card
        frontUrl={frontUrl}
        insideUrl={insideUrl}
        open={open}
        onOpenChange={onOpenChange}
        format={format}
      />
    </>
  );
}

// ── CameraDolly ──────────────────────────────────────────────────────
// Dollies camera forward + up on open so the inside reads as
// "presented to you." Reverses on close.
function CameraDolly({ open }: { open: boolean }) {
  useFrame((state, delta) => {
    const targetZ = open ? 3.0 : 3.4;
    const targetY = open ? 0.45 : 0.3;
    const cam = state.camera;
    const dt = Math.min(delta, 1 / 30);
    const ease = 1 - Math.pow(0.02, dt);
    cam.position.z += (targetZ - cam.position.z) * ease;
    cam.position.y += (targetY - cam.position.y) * ease;
    cam.lookAt(0, 0, 0);
  });
  return null;
}

// ── Card ─────────────────────────────────────────────────────────────
// Single-panel-door model: the cover flips open around the spine to
// reveal the inside. Flat planes, emissive front face for exact
// source-colour reproduction. Thickness + paper texture were tried
// and dropped — couldn't clear the quality bar without real assets.
//
// Format drives the geometry dimensions:
//   - portrait (digital): tall card, CARD_W 1.25 × CARD_H 1.7
//   - square (print): CARD_W 1.45 × CARD_H 1.45
const PORTRAIT = { w: 1.25, h: 1.7 };
const SQUARE = { w: 1.45, h: 1.45 };

// Resting tilt — front-facing by design (Kevin's call). Card faces
// camera head-on at rest; cursor movement still tilts subtly via the
// interactive tilt in useFrame.
const REST_TILT_X = 0;
const REST_TILT_Y = 0;

// Cover rest rotations. CLOSED_REST = 0 (fully closed, front-facing).
// The pulsing tap indicator carries the "there's something to open"
// signal; we don't need the geometric hint that was making the card
// look tilted at rest. OPEN_REST fully tips the cover open.
const CLOSED_REST = 0;
const OPEN_REST = -2.1;

// Paper tone for the back of the cover (visible when open). Slight
// off-white (very faint cream tint) so the cover-back stays visible
// against pure-white backgrounds without losing the "fresh blank
// paper" feel. Just enough difference to read as a distinct surface.
const PAPER_BACK = '#f8f4e8';

function Card({
  frontUrl,
  insideUrl,
  open,
  onOpenChange,
  format,
}: {
  frontUrl: string;
  insideUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  format: CardFormat;
}) {
  const dims = format === 'square' ? SQUARE : PORTRAIT;

  const [frontTex, insideTex] = useTexture([frontUrl, insideUrl]);
  useEffect(() => {
    [frontTex, insideTex].forEach((t) => {
      if (t) {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 8;
      }
    });
  }, [frontTex, insideTex]);

  const rootRef = useRef<THREE.Group>(null);
  const coverRef = useRef<THREE.Group>(null);

  // Spring physics for the cover hinge.
  const coverVelocity = useRef(0);

  // Cursor-tilt state.
  const { pointer } = useThree();
  const tiltTarget = useRef(new THREE.Vector2(0, 0));

  useFrame((state, delta) => {
    if (!rootRef.current || !coverRef.current) return;

    // Cover hinge — spring motion. Settles at CLOSED_REST (a hint
    // of open) when closed so users can see there's an inside. On
    // open, swings out to OPEN_REST (~-120°). Clamped so close-
    // overshoot can't tip the cover past the hint position into
    // territory where the right edge drops behind the inside plane
    // (that was the close-glitch render-order problem).
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

    // Tilt — baseline rest rotation + cursor offsets. Hard-limited
    // tilt strength when closed so the cursor can't parallax the
    // inside plane into view past the cover.
    const tiltStrength = open ? 0.12 : 0.06;
    tiltTarget.current.set(
      REST_TILT_Y + pointer.x * tiltStrength,
      REST_TILT_X + -pointer.y * tiltStrength * 0.6,
    );
    const root = rootRef.current;
    const tiltEase = 1 - Math.pow(0.05, delta);
    root.rotation.y += (tiltTarget.current.x - root.rotation.y) * tiltEase;
    root.rotation.x += (tiltTarget.current.y - root.rotation.x) * tiltEase;

    // Idle breathing — gentle scale oscillation when closed, fades to
    // zero amplitude as the card opens.
    const t = state.clock.elapsedTime;
    const breatheAmplitude = open ? 0 : 0.006;
    const breathe = 1 + Math.sin(t * 3.9) * breatheAmplitude;
    root.scale.setScalar(breathe);
  });

  const toggle = () => onOpenChange(!open);

  return (
    <group ref={rootRef} position={[0, 0, 0]}>
      {/* Large invisible hit-target plane — catches taps anywhere on
          or just-around the card. onClick only (NOT pointerdown, which
          would double-fire with click on the same tap and net to a
          no-op). */}
      <mesh position={[0, 0, 0.05]} onClick={toggle}>
        <planeGeometry args={[dims.w * 1.3, dims.h * 1.15]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Inside plane — opaque, emissive for exact source colour. */}
      <mesh position={[0, 0, -0.008]}>
        <planeGeometry args={[dims.w, dims.h]} />
        <meshStandardMaterial
          color={0x000000}
          emissive={0xffffff}
          emissiveMap={insideTex}
          emissiveIntensity={1.0}
          roughness={0.9}
          side={THREE.FrontSide}
        />
      </mesh>

      {/* Cover — pivoted at left edge; rotates like a door. Initial
          rotation.y = CLOSED_REST so it mounts at the hint-of-open
          position instead of wobbling from 0 to CLOSED_REST on load. */}
      <group
        ref={coverRef}
        position={[-dims.w / 2, 0, 0]}
        rotation={[0, CLOSED_REST, 0]}
      >
        <mesh position={[dims.w / 2, 0, 0]}>
          <planeGeometry args={[dims.w, dims.h]} />
          <meshStandardMaterial
            color={0x000000}
            emissive={0xffffff}
            emissiveMap={frontTex}
            emissiveIntensity={1.0}
            roughness={0.9}
            side={THREE.FrontSide}
          />
        </mesh>
        {/* Paper back of the cover — visible when cover flips past 90°.
            Emissive (matches the front + inside faces) so it renders
            at full brightness regardless of lighting. Without this,
            ambient + key only reach ~75% of white = grey on a white
            container. */}
        <mesh position={[dims.w / 2, 0, -0.003]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[dims.w, dims.h]} />
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
