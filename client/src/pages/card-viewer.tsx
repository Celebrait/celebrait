// client/src/pages/card-viewer.tsx
//
// Phase 1 proof of concept for the 3D card viewer.
//
// Goal: does the opening beat feel magical? Everything else (particles,
// mobile gyro, paper thickness, share flow, lighting polish) is Phase 2+.
// Resist adding anything here that isn't part of that core question.
//
// Data today: reuses the auth-gated /api/studio/drafts/:id endpoint so
// the logged-in sender can preview their own card. A public tokenised
// endpoint (/api/card/:id/view?t=…) lands in Phase 2 when we're ready
// to share links to recipients.

import { useEffect, useRef, useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, useTexture } from '@react-three/drei';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CardDraftState } from '@shared/schema';
import * as THREE from 'three';

interface CardData {
  id: number;
  status: string | null;
  frontImageUrl: string | null;
  insideImageUrl: string | null;
  state: CardDraftState;
}

export default function CardViewerPage() {
  const [, params] = useRoute<{ id: string }>('/card/:id/view');
  const [, setLocation] = useLocation();
  const cardId = params ? parseInt(params.id, 10) : NaN;

  const { data, isLoading, error } = useQuery<CardData>({
    queryKey: [`/api/studio/drafts/${cardId}`],
    enabled: Number.isFinite(cardId),
  });

  // Welcome screen gate — hoisted above early returns so hooks run on
  // every render.
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  if (!Number.isFinite(cardId)) {
    return <Centered>Invalid card id.</Centered>;
  }

  if (isLoading) {
    return (
      <Centered>
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </Centered>
    );
  }

  if (error || !data) {
    return (
      <Centered>
        <p className="text-sm text-stone-600 mb-4">Couldn't load this card.</p>
        <Button onClick={() => setLocation('/studio')}>Back to Studio</Button>
      </Centered>
    );
  }

  if (!data.frontImageUrl) {
    return (
      <Centered>
        <p className="text-sm text-stone-600 mb-2">This card hasn't been generated yet.</p>
        <p className="text-xs text-stone-500 mb-4">Status: {data.status ?? 'draft'}.</p>
        <Button onClick={() => setLocation(`/studio/card/${cardId}/edit`)}>
          Back to editor
        </Button>
      </Centered>
    );
  }

  // URLs come back as ready-to-use paths like /images/card_67_front.png
  // — every other consumer (card-thumbnail, card-mockup, payment pages)
  // drops them straight into an <img src=>. Same here.
  const frontUrl = data.frontImageUrl;
  const insideUrl = data.insideImageUrl ?? data.frontImageUrl;
  const recipientName = data.state.recipient?.name?.trim();

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 70% 60% at 50% 52%, #fefcf7 0%, #f2ebd9 70%, #e8dec7 100%)',
      }}
    >
      <div className="absolute top-4 left-4 z-10 text-xs text-stone-500">
        {recipientName ? `For ${recipientName}` : 'A card'}
      </div>

      <Canvas
        shadows
        camera={{ position: [0, 0.3, 3.4], fov: 35 }}
        dpr={[1, 2]}
        gl={{
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <Scene frontUrl={frontUrl} insideUrl={insideUrl} />
      </Canvas>

      <AnimatePresence>
        {!welcomeDismissed && (
          <WelcomeScreen
            recipientName={recipientName ?? null}
            onEnter={() => setWelcomeDismissed(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── WelcomeScreen ────────────────────────────────────────────────────
// Minimal arrival moment. Full-screen, same vignette background as
// the viewer. A small line of context, the recipient's name in
// handwriting, and a subtle "Tap to open" prompt. Tap anywhere →
// fades out over 700ms to reveal the 3D card. No envelope geometry,
// no 3D, no flair — just a typographic welcome.
function WelcomeScreen({
  recipientName,
  onEnter,
}: {
  recipientName: string | null;
  onEnter: () => void;
}) {
  return (
    <motion.div
      onClick={onEnter}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onEnter();
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } }}
      exit={{ opacity: 0, transition: { duration: 0.7, ease: 'easeInOut' } }}
      className="absolute inset-0 z-20 flex items-center justify-center cursor-pointer select-none"
      style={{
        background:
          'radial-gradient(ellipse 70% 60% at 50% 52%, #fefcf7 0%, #f2ebd9 70%, #e8dec7 100%)',
      }}
      data-testid="card-viewer-welcome"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { delay: 0.25, duration: 0.8, ease: 'easeOut' },
        }}
        className="text-center"
      >
        <p
          className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-4"
          style={{ fontFeatureSettings: '"ss01"' }}
        >
          You've been sent a card
        </p>
        <p
          className="font-handwriting text-ink"
          style={{
            fontSize: 'clamp(44px, 10vmin, 96px)',
            lineHeight: 1,
          }}
        >
          {recipientName ? `For ${recipientName}` : 'For you'}
        </p>
        <p
          className="text-[11px] uppercase tracking-[0.25em] text-stone-400 mt-8"
        >
          Tap to open
        </p>
      </motion.div>
    </motion.div>
  );
}


// ── Scene ────────────────────────────────────────────────────────────
// 3D card + lights + shadow. A procedural envelope was attempted on
// 2026-04-20 and dropped — couldn't clear the quality bar without
// real illustrator-drawn assets or a specialist. The card viewer
// alone is v1; envelope returns when we have the right inputs.
function Scene({ frontUrl, insideUrl }: { frontUrl: string; insideUrl: string }) {
  // Lifted here so the camera + shadow can react to open state too.
  const [open, setOpen] = useState(false);

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
        onOpenChange={setOpen}
      />

      <AttachedShadow open={open} />
    </>
  );
}

// ── CameraDolly ──────────────────────────────────────────────────────
// Dollies the camera forward a touch when the card opens so the
// inside reads as "presented to you." Also lifts the camera slightly
// to look over the opened cover instead of down its edge.
function CameraDolly({ open }: { open: boolean }) {
  useFrame((state, delta) => {
    const targetZ = open ? 2.95 : 3.4;
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

// ── AttachedShadow ───────────────────────────────────────────────────
// ContactShadows that track the card. Shifts horizontally with the
// cursor tilt and adjusts footprint when the card opens (wider + a
// bit to the left, reflecting the cover's open position). Makes the
// shadow feel attached to the object instead of floating on a fixed
// plane.
function AttachedShadow({ open }: { open: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const { pointer } = useThree();
  useFrame((_, delta) => {
    if (!ref.current) return;
    const targetX = (open ? -0.18 : 0) + pointer.x * 0.08;
    const targetScale = open ? 1.1 : 1;
    const dt = Math.min(delta, 1 / 30);
    const ease = 1 - Math.pow(0.04, dt);
    ref.current.position.x += (targetX - ref.current.position.x) * ease;
    const s = ref.current.scale.x + (targetScale - ref.current.scale.x) * ease;
    ref.current.scale.setScalar(s);
  });
  return (
    <group ref={ref}>
      <ContactShadows
        position={[0, -0.9, 0]}
        opacity={0.42}
        scale={4.2}
        blur={2.6}
        far={1.0}
        color="#4a3a28"
      />
    </group>
  );
}

// ── Card ─────────────────────────────────────────────────────────────
// Single-panel-door model: the cover flips open around the spine to
// reveal the inside. Thickness removed entirely — we're embracing the
// digital-card aesthetic (not pretending to be real paper) and focusing
// polish budget on the interaction beats (open, tilt, reveal) instead
// of material fidelity. Flat planes, emissive front face for exact
// source-colour reproduction.
const CARD_W = 1.25;
const CARD_H = 1.7;

// Resting tilt — a baseline rotation so the card doesn't render dead-
// on to camera. Interactive cursor tilt adds offsets on top of this.
const REST_TILT_X = -0.06;
const REST_TILT_Y = 0.08;

// Paper tone for the back of the cover (visible when open).
const PAPER_BACK = '#f4efe4';

function Card({
  frontUrl,
  insideUrl,
  open,
  onOpenChange,
}: {
  frontUrl: string;
  insideUrl: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [frontTex, insideTex] = useTexture([frontUrl, insideUrl]);
  // Portrait textures — ensure correct colour space so they don't look
  // washed out under the lighting. Drei's useTexture doesn't set this
  // by default for older three versions.
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

  // Spring physics for the cover hinge. Critically-damped-but-slightly-
  // bouncy — overshoots the target by a hair before settling. Feels
  // alive vs pure exponential damping which is visually mechanical.
  const coverVelocity = useRef(0);

  // Cursor-tilt state. Target rotation updated by pointermove; actual
  // rotation damps toward it each frame.
  const { pointer } = useThree();
  const tiltTarget = useRef(new THREE.Vector2(0, 0));
  useFrame((state, delta) => {
    if (!rootRef.current || !coverRef.current) return;

    // Cover hinge — spring motion. Tune stiffness + damping together:
    //   stiffness ↑ → faster snap  · damping ↑ → less overshoot
    // Clamping rotation to [-π, 0] so the close animation's overshoot
    // can't swing PAST closed into positive rotation — that's what
    // was causing the "inside pings over cover" glitch: when cover
    // rotation briefly went positive during close, its right edge
    // tipped behind the inside plane, and opaque depth-sort correctly
    // rendered the inside on top of that part of the cover.
    const targetRotY = open ? -2.1 : 0;
    const cover = coverRef.current;
    const stiffness = 70;
    const damping = 14;
    const accel = (targetRotY - cover.rotation.y) * stiffness - coverVelocity.current * damping;
    const dt = Math.min(delta, 1 / 30);
    coverVelocity.current += accel * dt;
    let nextRotY = cover.rotation.y + coverVelocity.current * dt;
    // Hard clamp — never cross 0 into positive. If the spring would
    // push past, kill velocity and pin at 0 so we settle cleanly.
    if (nextRotY > 0) {
      nextRotY = 0;
      coverVelocity.current = 0;
    }
    cover.rotation.y = nextRotY;

    // Tilt — baseline rest rotation + cursor offsets. When CLOSED the
    // tilt strength is cut hard so the cursor can't parallax the inside
    // plane into view past the cover. When OPEN we can tilt more freely
    // since both surfaces are already visible.
    const tiltStrength = open ? 0.12 : 0.06;
    tiltTarget.current.set(
      REST_TILT_Y + pointer.x * tiltStrength,
      REST_TILT_X + -pointer.y * tiltStrength * 0.6,
    );
    const root = rootRef.current;
    const tiltEase = 1 - Math.pow(0.05, delta);
    root.rotation.y += (tiltTarget.current.x - root.rotation.y) * tiltEase;
    root.rotation.x += (tiltTarget.current.y - root.rotation.x) * tiltEase;

    // Idle breathing — gentle scale oscillation when closed. Amplitude
    // fades to zero as the card opens so the animation doesn't interfere
    // with the reveal moment. 1.6s period, ±0.6% scale — subtle enough
    // that you register "it's alive" without noticing the mechanism.
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
          no-op). Sits slightly in front of the card so it's always
          hittable. */}
      <mesh position={[0, 0, 0.05]} onClick={toggle}>
        <planeGeometry args={[CARD_W * 1.3, CARD_H * 1.15]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Inside plane — opaque, hard edges. Emissive = exact source
          colour. Bigger z-gap (-0.008) behind the cover so the close
          animation can't z-fight and cause the "inside pings over"
          glitch we saw with transparent materials. */}
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

      {/* Cover — pivoted at left edge so rotation.y swings it like a
          door. Opaque materials + proper depth write means render
          order is always correct; no more "inside pings over cover"
          glitch during close. */}
      <group ref={coverRef} position={[-CARD_W / 2, 0, 0]}>
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
        {/* Paper back of the cover — only visible when the cover has
            rotated past ~90°. */}
        <mesh position={[CARD_W / 2, 0, -0.003]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[CARD_W, CARD_H]} />
          <meshStandardMaterial
            color={PAPER_BACK}
            roughness={0.95}
            side={THREE.FrontSide}
          />
        </mesh>
      </group>
    </group>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f5f2ec] text-center p-6">
      {children}
    </div>
  );
}
