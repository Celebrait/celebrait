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
  /** Optional controlled open state — lets a parent component wire an
   *  external "Open card" button to the hinge. If omitted, the viewer
   *  manages its own open state (click the card to toggle). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** How much empty space to leave around the card at mount. Lower =
   *  tighter crop (more zoomed in). Default 2.0 frames the card at
   *  ~50% of the canvas — matches the review-step reveal. Use ~1.1
   *  for "nearly fills the frame" (Studio Home empty state). */
  framingMargin?: number;
  /** Closest the user can zoom in via OrbitControls. Default 2.7.
   *  When `framingMargin` is tightened to bring the camera closer
   *  than 2.7 at mount, OrbitControls would snap it back out unless
   *  this is lowered accordingly. Pass ~1.5 alongside framingMargin
   *  ≈ 1.1 for a zoomed-in landing. */
  minDistance?: number;
}

export function Card3DViewer({
  frontImageUrl,
  insideImageUrl,
  backCredit = 'Made with Celebrait',
  className,
  open: openProp,
  onOpenChange,
  framingMargin = 2.0,
  minDistance = 2.7,
}: Card3DViewerProps) {
  const insideUrl = insideImageUrl ?? frontImageUrl;
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };

  // Pointer events are funnelled through this hit-zone div instead of
  // the full Canvas surface. Why:
  //   • The Canvas often renders inside a "bleed" wrapper much larger
  //     than the visible card (so rotation/zoom don't clip).
  //   • If the Canvas catches pointer events on the entire bleed,
  //     wheel-scroll on empty space gets eaten by OrbitControls and
  //     interrupts page scroll.
  //   • Solution: outer wrapper is pointer-events: none, so empty space
  //     passes through to page scroll. A central hit-zone div is
  //     pointer-events: auto and acts as the eventSource for r3f +
  //     the domElement for OrbitControls.
  // Tuned at 70% × 70% — covers the card at the default framingMargin
  // (2.0, card ≈ 50% of canvas) with rotation slack, and still mostly
  // covers it at framingMargin 1.15 (card ≈ 85% — corners pass through
  // but the body of the card is interactive). If the empty-state hero
  // needs full coverage we'd add a `hitZoneSize` prop.
  const [hitEl, setHitEl] = useState<HTMLDivElement | null>(null);

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        // pointer-events: none on the wrapper means empty space (the
        // bleed area where the canvas renders past the card) doesn't
        // capture wheel/touch events — those pass through to the page.
        // Children with pointer-events: auto still receive events
        // normally and bubble up through this element.
        pointerEvents: 'none',
        // touch-action: pan-y so vertical page scroll is never blocked
        // by a touch starting on the card area.
        touchAction: 'pan-y',
      }}
    >
      <Canvas
        shadows
        camera={{ position: [0, 0.15, 2.2], fov: 40 }}
        dpr={[1, 2]}
        gl={{
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
          antialias: true,
        }}
        // Funnel r3f pointer events (raycasting → mesh onClick handlers,
        // e.g. the card's tap-to-open hinge) through the hit zone so
        // they only fire when the user is actually over the card area.
        eventSource={hitEl ?? undefined}
      >
        <Scene
          frontUrl={frontImageUrl}
          insideUrl={insideUrl}
          backCredit={backCredit}
          open={open}
          onOpenChange={setOpen}
          framingMargin={framingMargin}
          minDistance={minDistance}
          orbitDomElement={hitEl ?? undefined}
        />
      </Canvas>
      {/* The hit zone — invisible, sits over roughly the card's visible
          area. All pointer/wheel/touch events for OrbitControls + r3f
          mesh raycasting come through this element. Outside it, events
          pass through to whatever's underneath (page scroll, etc.). */}
      <div
        ref={setHitEl}
        aria-hidden
        style={{
          position: 'absolute',
          top: '15%',
          left: '15%',
          right: '15%',
          bottom: '15%',
          pointerEvents: 'auto',
          touchAction: 'none', // inside the card area, intercept gestures
          cursor: 'grab',
        }}
        data-testid="card-3d-hit-zone"
      />
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
  framingMargin,
  minDistance,
  orbitDomElement,
}: {
  frontUrl: string;
  insideUrl: string;
  backCredit: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  framingMargin: number;
  minDistance: number;
  /** When set, OrbitControls listens for wheel/drag/touch events on
   *  this DOM element instead of the WebGL canvas. Used so events
   *  only fire when the user is on the card hit-zone, not the empty
   *  bleed around it. */
  orbitDomElement?: HTMLElement;
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

      <InitialCameraFit margin={framingMargin} />

      <Card
        frontUrl={frontUrl}
        insideUrl={insideUrl}
        backCredit={backCredit}
        open={open}
        onOpenChange={onOpenChange}
      />

      {/* Ground shadow — two layers. The soft broad layer reads as
          ambient occlusion (card sits in a space). The tight inner
          layer reads as contact with a surface. Together the card
          feels grounded on a subtle floor without an explicit
          floor plane. */}
      <ContactShadows
        position={[0, -CARD_H / 2 - 0.06, 0]}
        opacity={0.35}
        scale={6.5}
        blur={3.2}
        far={1.8}
        resolution={512}
      />
      <ContactShadows
        position={[0, -CARD_H / 2 - 0.05, 0]}
        opacity={0.55}
        scale={2.6}
        blur={1.1}
        far={1.0}
        resolution={768}
      />

      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        enableZoom={true}
        enableDamping
        dampingFactor={0.08}
        // domElement set to the parent's hit-zone div so wheel/drag
        // events only register on the card area. Wheel events outside
        // the hit zone pass through to page scroll instead of being
        // captured for camera zoom.
        domElement={orbitDomElement}
        minDistance={minDistance}
        maxDistance={6}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI - Math.PI / 3}
      />
    </>
  );
}

// ── InitialCameraFit ─────────────────────────────────────────────────
// Adapts the camera distance so the card renders at a comfortable
// size with generous margin, on any viewport aspect. Runs once on
// mount; subsequent zoom is under user control via OrbitControls.
//
// Without this, a static camera z lands the card at ~90% of a
// landscape viewport height and clips horizontally on portrait
// phones (card width > viewport width at narrow aspects). The
// margin factor controls how much empty space surrounds the card.
function InitialCameraFit({ margin }: { margin: number }) {
  const { camera, size, invalidate } = useThree();
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    didInit.current = true;
    const aspect = size.width / size.height;
    const halfFovRad = (camera.fov / 2) * (Math.PI / 180);
    // Landing framing — `margin` controls how much empty space surrounds
    // the card. margin=2.0 → card at ~50% of the canvas (review-step
    // reveal); margin=1.1 → card nearly fills the frame (Studio Home
    // empty state). Paired with the viewer's canvas bleed and a
    // matching `minDistance` so OrbitControls don't snap the camera
    // back out after mount.
    const required = CARD_W * margin;
    const distByHeight = required / (2 * Math.tan(halfFovRad));
    const distByWidth = required / (2 * Math.tan(halfFovRad) * aspect);
    camera.position.z = Math.max(distByHeight, distByWidth);
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, size, invalidate, margin]);
  return null;
}

// ── Card ─────────────────────────────────────────────────────────────
const CARD_W = 1.45;
const CARD_H = 1.45;
// Subtle corner rounding — ~1.8% of card width. Not enough to read
// as "rounded card" at default zoom; just enough to take the hard
// sharpness off the corner silhouettes.
const CARD_CORNER = 0.025;

const CLOSED_REST = 0;
const OPEN_REST = -2.1;

// Shape geometry with softly-rounded corners, UVs remapped to
// cover the original rectangular bounds so textures map identically
// to the equivalent PlaneGeometry. Created once, reused across all
// four card faces.
function buildCardGeometry(w: number, h: number, radius: number) {
  const hw = w / 2;
  const hh = h / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw + radius, -hh);
  shape.lineTo(hw - radius, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + radius);
  shape.lineTo(hw, hh - radius);
  shape.quadraticCurveTo(hw, hh, hw - radius, hh);
  shape.lineTo(-hw + radius, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - radius);
  shape.lineTo(-hw, -hh + radius);
  shape.quadraticCurveTo(-hw, -hh, -hw + radius, -hh);

  const geom = new THREE.ShapeGeometry(shape);
  // ShapeGeometry assigns UVs from vertex world-space positions by
  // default. Remap to [0, 1] across the card's bounding box so the
  // texture maps like a PlaneGeometry would.
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

// Paper tone for the back-of-cover + back-of-card faces. Pure white
// card stock — silhouette is carried by the edge stroke drawn into
// the canvas texture + the ContactShadow underneath, not by a tinted
// paper colour, so the card reads cleanly on any white background.
const PAPER_BACK = '#ffffff';
const CARD_BACK_PAPER = '#ffffff';
// Edge stroke colour drawn at the perimeter of every canvas-texture
// paper face. Gives every card face a soft darker ring so the card
// silhouette reads against white.
const EDGE_STROKE = 'rgba(120, 110, 95, 0.22)';

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

  const backTex = usePaperTexture({ credit: backCredit, anisotropy: maxAnisotropy });
  const coverBackTex = usePaperTexture({ anisotropy: maxAnisotropy });

  // Rounded-corner card geometry, built once and reused across all
  // four card faces. ShapeGeometry + remapped UVs so textures map
  // identically to the equivalent PlaneGeometry.
  const cardGeom = useMemo(
    () => buildCardGeometry(CARD_W, CARD_H, CARD_CORNER),
    [],
  );

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

      {/* Inside face — receives the cover's shadow when open.
          Uses the rounded card geometry so the silhouette carries
          subtle corner softness. Note: inside + back mesh share the
          same geometry instance — R3F handles disposal. */}
      <mesh position={[0, 0, -0.008]} geometry={cardGeom} receiveShadow>
        <meshStandardMaterial map={insideTex} roughness={0.9} side={THREE.DoubleSide} />
      </mesh>

      {/* Back of the card — credit wordmark, visible at 180°. */}
      <mesh
        position={[0, 0, -0.011]}
        rotation={[0, Math.PI, 0]}
        geometry={cardGeom}
        receiveShadow
      >
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
        <mesh position={[CARD_W / 2, 0, 0]} geometry={cardGeom} castShadow receiveShadow>
          <meshStandardMaterial map={frontTex} roughness={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh
          position={[CARD_W / 2, 0, -0.003]}
          rotation={[0, Math.PI, 0]}
          geometry={cardGeom}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial map={coverBackTex} roughness={0.95} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

// ── usePaperTexture ──────────────────────────────────────────────────
// Generates a premium-card paper texture on an offscreen canvas and
// returns it as a THREE.CanvasTexture. Used for both the back of the
// card (with wordmark) and the back of the cover (no wordmark).
//
// Effects, layered bottom-up:
//   1. Base paper tone
//   2. Soft radial vignette — subtle edge darkening so the plane
//      doesn't read as a flat solid fill at close zoom
//   3. Fine grain noise — per-pixel ±5 RGB jitter, gives the eye
//      something to bite into so the paper doesn't feel "rendered"
//   4. Thin perimeter edge stroke so the card has a silhouette on a
//      pure-white background
//   5. Optional wordmark (credit + celebrait.com) centred
function usePaperTexture(opts: {
  credit?: string;
  anisotropy: number;
}): THREE.CanvasTexture {
  const { credit, anisotropy } = opts;
  return useMemo(() => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1. Base paper tone
    ctx.fillStyle = CARD_BACK_PAPER;
    ctx.fillRect(0, 0, size, size);

    // 2. Radial vignette — corners slightly darker
    const vignette = ctx.createRadialGradient(
      size / 2,
      size / 2,
      size * 0.3,
      size / 2,
      size / 2,
      size * 0.75,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.06)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, size, size);

    // 3. Grain — jitter every pixel ± a few RGB steps. At 1024² this
    //    is ~1M iterations; runs in well under a frame on warm CPUs
    //    and only happens once per mount.
    const imageData = ctx.getImageData(0, 0, size, size);
    const pixels = imageData.data;
    for (let i = 0; i < pixels.length; i += 4) {
      const jitter = (Math.random() - 0.5) * 10;
      pixels[i] = clamp8(pixels[i] + jitter);
      pixels[i + 1] = clamp8(pixels[i + 1] + jitter);
      pixels[i + 2] = clamp8(pixels[i + 2] + jitter);
    }
    ctx.putImageData(imageData, 0, 0);

    // 4. Edge stroke — thin ring just inside the perimeter so the
    //    card has a visible silhouette against a white background.
    //    Offset inside the edge (not at x=0) so mipmaps don't chew
    //    it away at shallow angles. Layered with a soft inner shadow
    //    to avoid a hard painted-line look.
    ctx.strokeStyle = EDGE_STROKE;
    ctx.lineWidth = 3;
    const edgeInset = 3;
    ctx.strokeRect(edgeInset, edgeInset, size - edgeInset * 2, size - edgeInset * 2);
    ctx.strokeStyle = 'rgba(120, 110, 95, 0.08)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, size - 16, size - 16);

    // 5. Optional wordmark
    if (credit) {
      ctx.fillStyle = '#3d3529';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = "300 42px 'Inter', system-ui, sans-serif";
      ctx.fillText(credit.toUpperCase(), size / 2, size / 2 - 10);

      ctx.fillStyle = '#8a7f6f';
      ctx.font = "300 22px 'Inter', system-ui, sans-serif";
      ctx.fillText('celebrait.com', size / 2, size / 2 + 34);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = anisotropy;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.generateMipmaps = true;
    return tex;
  }, [credit, anisotropy]);
}

function clamp8(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
