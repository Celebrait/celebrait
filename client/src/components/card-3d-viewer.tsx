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

import {
  Component,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, useTexture } from '@react-three/drei';
import type { MotionValue } from 'framer-motion';
import * as THREE from 'three';

// ── Local "airbag" around the 3D canvas ─────────────────────────────
// A failed texture load (dead image URL, CORS break) or a WebGL crash
// throws THROUGH the r3f <Canvas> into the parent React tree. Without
// this boundary the throw sails up to the app-level ErrorBoundary and
// the WHOLE page becomes "Something went wrong" (card 234, 2026-07-04
// — a legacy /images path 404ing on Render's wiped disk). One bad
// texture must never cost more than the 3D effect itself: catch it
// here, show the flat card image, keep the page (Buy/back/regen) alive.
class Viewer3DBoundary extends Component<
  { fallback: (retry: () => void) => ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.warn(
      '[Card3DViewer] 3D render failed — falling back to flat image:',
      error?.message ?? error,
    );
  }
  retry = () => this.setState({ failed: false });
  render() {
    if (this.state.failed) return this.props.fallback(this.retry);
    return this.props.children;
  }
}

/** Flat-image stand-in when the 3D view can't render. Shows the front
 *  image sized roughly like the 3D card; if even that image is dead
 *  (the usual root cause), swaps to a soft cream placeholder so we
 *  never show the browser's broken-image glyph.
 *
 *  `showCaption` — the "3D view couldn't load / Try again" line. Only
 *  for interactive viewers: in miniature/ambient embeds (AjarCardRender
 *  thumbnails, marketing heroes) the wrapper is pointer-events: none so
 *  the button couldn't be clicked anyway, and the caption crammed into
 *  an 80px thumb overlapped surrounding copy (Kevin 2026-07-04, Giving
 *  Moment screenshot). There the fallback is just the flat image. */
function FlatCardFallback({
  src,
  framingMargin,
  onRetry,
  showCaption,
}: {
  src: string;
  framingMargin: number;
  onRetry: () => void;
  showCaption: boolean;
}) {
  const [imgDead, setImgDead] = useState(false);
  const side = `${Math.min(90, 100 / framingMargin)}%`;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 2,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        pointerEvents: 'auto',
      }}
      data-testid="card-3d-fallback"
    >
      {imgDead ? (
        <div
          style={{
            height: side,
            aspectRatio: '1 / 1',
            maxWidth: '80%',
            borderRadius: 12,
            background: '#fbf5ea',
            border: '1px solid #e7e5e4',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          {showCaption && (
            <p style={{ fontSize: 13, color: '#78716c', textAlign: 'center', margin: 0 }}>
              This card's image couldn't be loaded.
            </p>
          )}
        </div>
      ) : (
        <img
          src={src}
          alt="Card front"
          onError={() => setImgDead(true)}
          style={{
            height: side,
            aspectRatio: '1 / 1',
            maxWidth: '80%',
            objectFit: 'cover',
            borderRadius: 12,
            boxShadow: '0 18px 40px -12px rgba(15,23,42,0.35)',
          }}
        />
      )}
      {showCaption && (
      <p style={{ fontSize: 12, color: '#78716c', margin: 0 }}>
        3D view couldn't load — showing the card flat.{' '}
        <button
          type="button"
          onClick={onRetry}
          style={{
            textDecoration: 'underline',
            textUnderlineOffset: 3,
            color: '#6d28d9',
            background: 'none',
            border: 'none',
            padding: 0,
            font: 'inherit',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </p>
      )}
    </div>
  );
}

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
  /** Slow auto-rotation around the card's vertical axis. Used by
   *  ambient/decorative renderings (e.g. Studio empty-state hero,
   *  marketing hero) where the card should feel alive without
   *  demanding interaction. Default false. User drag still works
   *  (drei OrbitControls pauses rotation while dragging and resumes
   *  on release). */
  autoRotate?: boolean;
  /** Auto-rotation speed (drei OrbitControls units). Lower = slower.
   *  Default 0.6, which is a gentle ~2 RPM. Only applies when
   *  autoRotate is true. */
  autoRotateSpeed?: number;
  /** Override the auto-derived DOM hit-zone inset (in %).
   *
   *  By default the inset is derived from `framingMargin` so the hit
   *  zone hugs the card with a small buffer. That works when the
   *  outer wrapper's bounds match the card's visible footprint.
   *
   *  Some surfaces (e.g. recipient viewer card-viewer.tsx) wrap
   *  Card3DViewer in a "bleed" container that extends way past the
   *  visible card (so the card can rotate/zoom without clipping).
   *  In that case the auto-derivation produces a hit zone too small
   *  to cover the visible card — clicks on the card's edges miss.
   *  Pass an explicit value to opt out: 0 = fill the wrapper entirely,
   *  >0 = inset by that percentage.
   *
   *  This is the CLOSED-state hit zone size. When `open` is true, the
   *  hit zone optionally expands per `openHitZoneInsetPercent` (below)
   *  so clicks on the swung-out cover and inside spread also register. */
  hitZoneInsetPercent?: number;
  /** Hit zone inset (%) used when the card is OPEN. Defaults to the
   *  same value as `hitZoneInsetPercent` (no change between states).
   *  Set lower than the closed value when the card visibly grows
   *  on opening — typically the marketing hero, where the cover
   *  swings out and the inside spread occupies ~2× the closed
   *  card's horizontal extent. The hit zone CSS-transitions
   *  smoothly between the two states. */
  openHitZoneInsetPercent?: number;
  /** Disable mouse-wheel / pinch zoom. Default true (zoom enabled).
   *  Used by static-display surfaces (e.g. marketing hero where the
   *  card should sit at its mount framing without user re-zoom). */
  enableZoom?: boolean;
  /** Disable click-drag rotate. Default true (rotation enabled).
   *  Pair with `enableZoom={false}` for a fully static display where
   *  the only user gesture is the click-to-open hinge. */
  enableRotate?: boolean;
  /** Disable ALL pointer interaction with the card. Default true.
   *  When `false`, the hit zone becomes `pointer-events: none` so:
   *    - Click-to-open hinge no longer fires
   *    - Drag/wheel/touch never capture (so vertical page scroll is
   *      never hijacked by the card area)
   *    - Cursor stays default (no `grab` affordance)
   *  Used by surfaces that drive `open` externally (e.g. marketing
   *  hero scroll-driven reveal). */
  interactive?: boolean;
  /** Continuous open progress as a framer-motion `MotionValue<number>`,
   *  expected in [0, 1]. When provided, OVERRIDES the binary `open`
   *  prop and drives the cover rotation directly with no spring
   *  smoothing — the rotation tracks the motion value 1:1 each frame.
   *  Useful for scroll-driven choreography where the cover should hug
   *  scroll position without lag. The MotionValue is read inside
   *  `useFrame` via `.get()` so React doesn't re-render per frame. */
  openProgress?: MotionValue<number>;
  /** Cover rotation when `open` is false. Default 0 (cover flush with
   *  the card body). Set to a negative value (e.g. -0.5) to leave the
   *  cover slightly ajar at rest so the inside is partially visible —
   *  used on the marketing hero so first-time visitors get a hint of
   *  what's inside without having to interact. Spring physics still
   *  animate to/from this rest position when `open` toggles. */
  closedAngle?: number;
  /** Subtle floating hover on the card body — sine oscillation in y,
   *  driven inside `useFrame` so it composes with cover rotation
   *  cleanly. ContactShadows stay world-fixed (they're scene-level,
   *  not parented to the card group), so the card visibly lifts off
   *  its shadow as it bobs. Default false. */
  hover?: boolean;
  /** Resting yaw of the whole card, in radians, applied to the card's
   *  root group. Default 0 (straight-on). A small NEGATIVE value angles
   *  the card to the left so the opening side (the cover's free right
   *  edge) turns toward the viewer — which makes a `closedAngle` ajar
   *  actually read as "open a crack" instead of a flat skew, because you
   *  can see INTO the gap. Pair with `closedAngle` for a resting "peek".
   *  The camera/OrbitControls are unchanged, so drag-to-rotate still
   *  orbits freely around this resting pose. */
  restYaw?: number;
  /** Render the card ALREADY open at mount, with NO opening animation —
   *  the cover initialises at the fully-open angle and the spring starts
   *  there, so it never swings. For static open-card displays (e.g. an
   *  example render). Default false; only meaningful alongside `open`. */
  instantOpen?: boolean;
  /** Cap the canvas devicePixelRatio. Default 2 (crisp on retina). Drop
   *  to ~1.5 on large decorative stages (e.g. the landing example card)
   *  where the bleed canvas is huge and full retina costs frame rate
   *  during the open/close spring. */
  dprMax?: number;
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
  autoRotate = false,
  autoRotateSpeed = 0.6,
  hitZoneInsetPercent,
  openHitZoneInsetPercent,
  enableZoom = true,
  enableRotate = true,
  interactive = true,
  openProgress,
  closedAngle = 0,
  hover = false,
  restYaw = 0,
  instantOpen = false,
  dprMax = 2,
}: Card3DViewerProps) {
  const insideUrl = insideImageUrl ?? frontImageUrl;
  const [openState, setOpenState] = useState(false);
  const open = openProp ?? openState;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOpenState(next);
    onOpenChange?.(next);
  };

  // DOM-level tap-to-open detection on the hit zone div (Kevin call
  // 2026-05-06: "It does not allow clicking all over the front and
  // inside to open and close freely like it used to"). The R3F-based
  // bubble-from-mesh path was unreliable — pointer events from the
  // canvas synthetic-event system weren't always firing the group's
  // onPointerDown/Up handlers. DOM events on the hit zone are simple
  // and reliable. Drag detection: if pointer moves >4px between
  // down and up, treat as drag (OrbitControls handles rotation), else
  // treat as tap and toggle open. OrbitControls listens directly on
  // the hit zone too (its domElement) so it still gets the events
  // for rotation drag — these don't conflict.
  const tapRef = useRef({ down: false, moved: false, x: 0, y: 0 });
  const handleHitPointerDown = (e: React.PointerEvent) => {
    tapRef.current = {
      down: true,
      moved: false,
      x: e.clientX,
      y: e.clientY,
    };
  };
  const handleHitPointerMove = (e: React.PointerEvent) => {
    if (!tapRef.current.down) return;
    const dx = e.clientX - tapRef.current.x;
    const dy = e.clientY - tapRef.current.y;
    if (dx * dx + dy * dy > 16) tapRef.current.moved = true;
  };
  const handleHitPointerUp = () => {
    const wasTap = tapRef.current.down && !tapRef.current.moved;
    tapRef.current.down = false;
    if (wasTap && interactive) setOpen(!open);
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
  //
  // Inset auto-derives from framingMargin (2026-04-28 fix — Kevin
  // caught the empty-state hero bug "card only opens when clicked on
  // the right"). Previous hardcoded 22% inset assumed margin=2.0; a
  // tighter framing (e.g. margin=1.5 on the studio empty-state hero)
  // makes the card visually larger than the 22% hit zone, so clicks
  // on the card's outer edges fell outside the hit zone and the
  // tap-to-open never fired.
  //
  // Formula:
  //   cardFraction      = 1 / framingMargin   (approximate)
  //   emptySpaceEachSide = (1 - cardFraction) / 2
  //   insetPct          = max(2, (emptySpaceEachSide - 0.03) * 100)
  //
  // The 0.03 = 3% buffer trims into the card a touch so the hit zone
  // doesn't extend past the card's silhouette + risk capturing page
  // scroll on touch devices (the original 2026-04-26 fix). The
  // max(2, …) clamps a hard floor — even at very tight framing
  // (margin ≈ 1.0), keep at least 2% inset so the hit zone can't go
  // edge-to-edge.
  //
  // Worked examples:
  //   margin=2.0 → 22% inset (matches the original tuning)
  //   margin=1.5 → 13.7% inset (used by studio empty-state hero)
  //   margin=1.1 → 2% inset (zoomed-in landings)
  const cardFraction = 1 / framingMargin;
  const emptySpaceEachSide = (1 - cardFraction) / 2;
  const autoInsetPct = Math.max(2, (emptySpaceEachSide - 0.03) * 100);
  // Caller can override the auto-derived inset for surfaces where the
  // outer wrapper extends past the visible card (e.g. card-viewer's
  // bleed container). hitZoneInsetPercent={0} = full coverage.
  const closedInsetPct =
    typeof hitZoneInsetPercent === 'number'
      ? Math.max(0, Math.min(45, hitZoneInsetPercent))
      : autoInsetPct;
  // Open-state inset — defaults to closed value (no change between
  // states). Callers that need a wider hit zone when the card opens
  // (because the cover swings out and the inside spread occupies more
  // horizontal space) pass a smaller value here.
  const openInsetPct =
    typeof openHitZoneInsetPercent === 'number'
      ? Math.max(0, Math.min(45, openHitZoneInsetPercent))
      : closedInsetPct;
  // Active inset switches with `open` state. Width transitions
  // smoothly via CSS so the hit-zone bounds animate alongside the
  // cover's spring rotation rather than snapping.
  const hitZoneInsetPct = open ? openInsetPct : closedInsetPct;
  const [hitEl, setHitEl] = useState<HTMLDivElement | null>(null);

  // ── Card-hugging hit zone (px-accurate) ────────────────────────────
  // The % model above sizes the hit square as a fraction of the wrapper
  // WIDTH. That only matches the card when the wrapper's bounds equal the
  // card's visible footprint. Inside a "bleed" wrapper (much larger than
  // the card, so it can rotate/zoom without clipping) the % square balloons
  // way past the card — you end up able to drag/rotate while hovering empty
  // space around it (Kevin 2026-06-01: "the hit point is too large").
  //
  // Fix: when no explicit `hitZoneInsetPercent` is given, size the hit zone
  // to the card's ACTUAL rendered footprint, in px. InitialCameraFit frames
  // the card to span 1/framingMargin of the wrapper's SMALLER dimension, so
  // the on-screen card is a square of side ≈ min(w, h) / framingMargin. We
  // measure the wrapper and size the hit square to that (× 0.96 so it sits
  // just inside the silhouette and never spills onto empty space). Surfaces
  // that pass an explicit inset (recipient viewer = 0 full, landing heroes
  // = 30) keep the % model and are unaffected.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [autoSquarePx, setAutoSquarePx] = useState<number | null>(null);
  const useAutoHug = typeof hitZoneInsetPercent !== 'number';
  useLayoutEffect(() => {
    if (!useAutoHug) {
      setAutoSquarePx(null);
      return;
    }
    const el = wrapperRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      setAutoSquarePx((Math.min(r.width, r.height) / framingMargin) * 0.96);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [useAutoHug, framingMargin]);

  return (
    <div
      ref={wrapperRef}
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
      <Viewer3DBoundary
        fallback={(retry) => (
          <FlatCardFallback
            src={frontImageUrl}
            framingMargin={framingMargin}
            // Miniature/ambient embeds (interactive={false}: AjarCardRender
            // thumbnails, marketing heroes) get image-only — no caption, no
            // Try again (their wrappers are pointer-events: none anyway).
            showCaption={interactive}
            onRetry={() => {
              // r3f's useLoader caches FAILED loads too — without
              // clearing, a retry re-throws instantly from cache.
              try {
                useLoader.clear(THREE.TextureLoader, [frontImageUrl, insideUrl]);
              } catch {
                /* cache clear is best-effort */
              }
              retry();
            }}
          />
        )}
      >
        <Canvas
          shadows
          camera={{ position: [0, 0.15, 2.2], fov: 40 }}
          dpr={[1, dprMax]}
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
            autoRotate={autoRotate}
            autoRotateSpeed={autoRotateSpeed}
            enableZoom={enableZoom}
            enableRotate={enableRotate}
            openProgress={openProgress}
            closedAngle={closedAngle}
            hover={hover}
            restYaw={restYaw}
            instantOpen={instantOpen}
          />
        </Canvas>
      </Viewer3DBoundary>
      {/* The hit zone — invisible, sits over roughly the card's visible
          area. All pointer/wheel/touch events for OrbitControls + r3f
          mesh raycasting come through this element. Outside it, events
          pass through to whatever's underneath (page scroll, etc.). */}
      <div
        ref={setHitEl}
        aria-hidden
        onPointerDown={handleHitPointerDown}
        onPointerMove={handleHitPointerMove}
        onPointerUp={handleHitPointerUp}
        style={{
          // Hit zone is a CENTRED SQUARE inside the bleed wrapper.
          //
          // Was previously inset by `hitZoneInsetPercent` on each
          // edge, which produced a rectangle when the bleed wrapper
          // wasn't square (which it almost never is — the marketing
          // hero's bleed extends ±35vw horizontally and ±30vh
          // vertically, giving a ~1.6:1 wrapper aspect). That
          // rectangle covered the card's left/right edges but missed
          // the top/bottom — clicks there fell through to page scroll
          // and the card didn't open. The "tap zone is super right"
          // bug.
          //
          // Now the hit zone is sized as a percentage of the wrapper
          // WIDTH and locked to a 1:1 aspect ratio via `aspectRatio`,
          // centred via top/left 50% + translate. The size is derived
          // from the existing `hitZoneInsetPercent` to preserve the
          // tuning surface: inset=30% → size 40% of wrapper width.
          //
          // Interaction-mode rules (unchanged) still apply:
          //   - interactive=false → inert (no events captured)
          //   - tap-only (rotate=false && zoom=false) → pointer-events
          //     on but touch-action: pan-y so vertical page scroll
          //     started on the card area still works on touch
          //   - full interactive → events on, touch-action: none for
          //     OrbitControls drag/wheel/pinch
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          // Auto-hug mode: an exact px square matching the card's rendered
          // footprint. Otherwise the legacy %-of-width square (explicit
          // inset callers). aspectRatio keeps it square in both cases.
          width:
            autoSquarePx != null
              ? `${autoSquarePx.toFixed(1)}px`
              : `${(100 - 2 * hitZoneInsetPct).toFixed(2)}%`,
          aspectRatio: '1 / 1',
          // Smooth width transition between closed/open hit zones.
          // ~500ms tracks the cover spring rotation roughly so the
          // hit-zone bounds grow alongside the visible open spread.
          transition: 'width 0.5s ease-out',
          pointerEvents: interactive ? 'auto' : 'none',
          touchAction: !interactive
            ? 'auto'
            : !enableRotate && !enableZoom
              ? 'pan-y'
              : 'none',
          cursor: !interactive
            ? 'default'
            : !enableRotate && !enableZoom
              ? 'pointer'
              : 'grab',
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
  autoRotate,
  autoRotateSpeed,
  enableZoom,
  enableRotate,
  openProgress,
  closedAngle,
  hover,
  restYaw,
  instantOpen,
}: {
  frontUrl: string;
  insideUrl: string;
  backCredit: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  framingMargin: number;
  minDistance: number;
  enableZoom: boolean;
  enableRotate: boolean;
  /** When set, OrbitControls listens for wheel/drag/touch events on
   *  this DOM element instead of the WebGL canvas. Used so events
   *  only fire when the user is on the card hit-zone, not the empty
   *  bleed around it. */
  orbitDomElement?: HTMLElement;
  autoRotate: boolean;
  autoRotateSpeed: number;
  openProgress?: MotionValue<number>;
  closedAngle: number;
  hover: boolean;
  restYaw: number;
  instantOpen: boolean;
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
        openProgress={openProgress}
        closedAngle={closedAngle}
        hover={hover}
        restYaw={restYaw}
        instantOpen={instantOpen}
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
        enableZoom={enableZoom}
        enableRotate={enableRotate}
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
        // Auto-rotation for ambient/decorative renderings (e.g. empty-state
        // hero). drei pauses rotation while the user actively drags and
        // resumes shortly after release — feels alive without fighting
        // user intent.
        autoRotate={autoRotate}
        autoRotateSpeed={autoRotateSpeed}
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
  openProgress,
  closedAngle,
  hover,
  restYaw,
  instantOpen,
}: {
  frontUrl: string;
  insideUrl: string;
  backCredit: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  openProgress?: MotionValue<number>;
  closedAngle: number;
  hover: boolean;
  restYaw: number;
  instantOpen: boolean;
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

  useFrame((state, delta) => {
    if (!rootRef.current || !coverRef.current) return;
    const cover = coverRef.current;
    const root = rootRef.current;

    // Resting yaw — angle the whole card so an ajar cover reads as a real
    // opening (you see into the gap) rather than a flat skew. Constant
    // pose; OrbitControls moves the camera, not this group, so drag-to-
    // rotate still orbits freely around it.
    root.rotation.y = restYaw;

    // Hover bob — sine oscillation in y, applied to the card's root
    // group. ContactShadows live at scene level (not parented to this
    // group), so the card visibly lifts off its shadow as it bobs,
    // which sells the "floating above the surface" feel without
    // animating the shadow itself. Amplitude/frequency tuned subtle
    // (~3% of card width over a ~7s loop) so it reads as "alive" not
    // "fidgeting".
    if (hover) {
      const t = state.clock.getElapsedTime();
      root.position.y = Math.sin(t * 0.9) * 0.04;
    } else if (root.position.y !== 0) {
      root.position.y = 0;
    }

    // Continuous-progress branch (e.g. scroll-driven choreography).
    // When an `openProgress` MotionValue is provided, drive the cover
    // rotation directly with no spring smoothing — the cover hugs the
    // motion value 1:1 each frame so it responds to scroll without lag.
    // `.get()` reads the current value WITHOUT subscribing this
    // component to per-frame React re-renders.
    if (openProgress) {
      const raw = openProgress.get();
      const p = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      cover.rotation.y = p * OPEN_REST;
      coverVelocity.current = 0;
      return;
    }

    // Binary open/close branch — spring physics for the click-to-open
    // surfaces (studio review, public viewer). Stiff + slightly damped
    // so the open feels theatrical without overshooting too far.
    //
    // Rest target is `closedAngle` (default 0 = flush) so callers can
    // park the cover slightly ajar for a "peek inside" preview without
    // changing how `open=true` is interpreted.
    const targetRotY = open ? OPEN_REST : closedAngle;
    const stiffness = 70;
    const damping = 14;
    const accel = (targetRotY - cover.rotation.y) * stiffness - coverVelocity.current * damping;
    const dt = Math.min(delta, 1 / 30);
    coverVelocity.current += accel * dt;
    let nextRotY = cover.rotation.y + coverVelocity.current * dt;
    // Clamp on the closed side so the cover never tries to swing past
    // its rest angle in the wrong direction.
    if (nextRotY > closedAngle) {
      nextRotY = closedAngle;
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
    // Pointer handlers REMOVED from this group 2026-05-06 (Kevin
    // call: tap-to-open wasn't firing reliably). Click detection
    // moved up to the parent's hit-zone DIV via DOM PointerEvents
    // — simpler, more reliable, no R3F synthetic-event bubble
    // chain to fail. OrbitControls (still on `domElement={hitEl}`)
    // continues to handle drag-to-rotate independently.
    <group ref={rootRef} position={[0, 0, 0]}>
      {/* Invisible tap-to-open BACKUP. The mesh stays for autoRotate
          / orbit angles where the visible card faces become edge-on
          and stop receiving raycasts (Kevin's 2026-04-28 fix).
          Pointer handlers removed — events bubble to the group above. */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[CARD_W * 2, CARD_H * 2, 0.4]} />
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
        /* Start at the caller's `closedAngle` rest so the cover doesn't
           briefly animate from 0 → closedAngle on mount. When `instantOpen`
           is set, start fully open instead so the card renders open with no
           swing (the spring targets OPEN_REST and is already there). */
        rotation={[0, instantOpen ? OPEN_REST : closedAngle, 0]}
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
          {/* Emissive lift: this face is the inside-LEFT panel when
              the card is open. Standard lighting leaves the white
              paper reading grey next to the vivid inside art — the
              emissive floor keeps it true blank-white, matching the
              printed product (inside-left is unprinted stock). */}
          <meshStandardMaterial
            map={coverBackTex}
            roughness={0.95}
            side={THREE.DoubleSide}
            emissive="#ffffff"
            emissiveIntensity={0.4}
          />
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
