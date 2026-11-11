// client/src/pages/landing-keeper.tsx (PREVIEW at /keeper)
//
// THE KEEPER — the landing rebuild, evolving under Kevin's direction.
// Becomes the live landing when he calls it. Panel blueprint in
// next_lp_keeper_blueprint.md; Kevin's revisions 2026-07-04:
//   • Fraunces BOLD on every display headline (font-display; loaded in
//     index.html). Inter for body/UI. The old crime was the serif
//     vanishing halfway — here it's on EVERY headline, no exceptions.
//   • Cards are SQUARE (5.5" product) — every card slot is 1:1.
//   • The real 3D card asset used STATIC (ajar, non-interactive) as
//     the hero visual; gallery examples are permanently-ajar cards
//     whose covers spring open IN PLACE on click (pure composited CSS
//     hinge — fixed dimensions, nothing mounts, one value animates).
//     The real WebGL engine appears only in the hero + free-link beat.
//   • CelebrationBackdrop (floating icons), ImagineDescribeShip
//     (animated phone) and DemoVideoSection (walkthrough placeholder)
//     restored — founder call, overriding the panel's deletions.
//
// ASSET SLOTS still to fill (Kevin, in the Studio, consented photos):
// A2/B2 source snapshots · B proof card · C inside spread · D1–D6
// gallery cards · E print macro photo (needs the Prodigi test print).
// Gallery dialogs use the hero card as a stand-in until D1–6 land.

import { lazy, Suspense, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'wouter';
import {
  Mail,
  RefreshCw,
  Truck,
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Mountain,
  Type,
  PenLine,
  Play,
  BookOpen,
  X,
  type LucideIcon,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useMakerEnabled } from '@/hooks/use-maker';
import { useBetaMinimalChrome } from '@/hooks/use-beta';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import celebraitLogo from '@/assets/celebrait.webp';
import { FaqSection } from '@/components/landing/faq-section';
import { Rise } from '@/components/landing/rise';
import { SceneIdeasSection } from '@/components/landing/scene-ideas-section';
import { ShimmerWord } from '@/components/landing/shimmer-word';
import { HandoverSection } from '@/components/landing/handover-section';
import { InsideSection } from '@/components/landing/inside-section';
import { HowItWorksSection } from '@/components/landing/how-it-works-section';
export { ShimmerWord };
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { FreeCardInvite } from '@/components/landing/free-card-invite';
import { CLAIM_EVENT } from '@/components/landing/ticker-banner';
import { OccasionsPromoSection } from '@/components/landing/occasions-promo-section';
import { GestureHints } from '@/components/gesture-hints';
// The shared kit: display face, hero headline scale, the one primary
// button. This page kept its own copies, which is how it drifted (2026-09-22).
import { DISPLAY, H1, BTN_PRIMARY, BTN_PRIMARY_LG } from '@/pages/doorway';
import { cardPrice, firstOrderPrice, shippingPrice } from '@shared/pricing';
import { useFirstCardOnUs } from '@/hooks/use-first-card-offer';
import { formatMoney } from '@shared/market';
import { copyFor } from '@shared/market-copy';
// Pence → "£6.99". The same one-liner the three-card doorway keeps locally.
// Hero art lives in client/public (NOT bundled assets) so index.html
// can <link rel="preload"> it — the download starts in parallel with
// the JS bundle instead of after it. On prod that parallel start is
// most of the fix for the white-card beat Kevin screenshotted.
const heroCardFront = '/hero-card-front.webp';
const heroCardInside = '/hero-card-inside.webp';

// ⚠️ TEMPORARY (Kevin 2026-07-24, for the F&F test link): hide only the
// placeholder gallery section ("Any face. Any occasion." / "Real cards,
// made in the Studio." + its 3D tiles). The hero 3D card STAYS. Flip to
// false to bring the gallery back.
// Proof section ("Greetings cards used to be boring") — the REAL worked
// example, so the recipe and the result are the same card end to end:
// this selfie of Mum + "Gazing at the Northern Lights" + "Happy 60th, Mum"
// really did produce this front, and the inside message really is the
// typography on the inside (Kevin's own gen, 2026-07-14).
const proofSourcePhoto = '/proof-source-photo.webp';
const proofCardFront = '/proof-card-front.webp';
const proofCardInside = '/proof-card-inside.webp';
// Example 2 — Kevin's own gen (2026-07-16). Same deal end to end: this
// selfie of Rach + Lulu + "Abseiling off Big Ben" really did produce this
// front, and the inside message really is the typography on the inside.
const bigBenSourcePhoto = '/proof-bigben-source.webp';
const bigBenCardFront = '/proof-bigben-front.webp';
const bigBenCardInside = '/proof-bigben-inside.webp';
// Example 3 — Kevin's own gen (2026-07-17), and the first one made with the
// hardened inside prompt (inside_write v5): the inside is pure typography
// over the NY skyline, with nobody in it.
const timesSqSourcePhoto = '/proof-timessquare-source.webp';
const timesSqCardFront = '/proof-timessquare-front.webp';
const timesSqCardInside = '/proof-timessquare-inside.webp';
// Tiny blurred stand-in (28px, ~1KB, inline in the bundle) painted
// BEHIND the hero art — zero network, so there's never blank white
// card stock while the real jpg downloads.
const HERO_FRONT_LQIP =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABIMDRANCxIQDhAUExIVGywdGxgYGzYnKSAsQDlEQz85Pj1HUGZXR0thTT0+WXlaYWltcnNyRVV9hnxvhWZwcm7/2wBDARMUFBsXGzQdHTRuST5Jbm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm7/wAARCAAcABwDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCjDrKKoDxg+9PfWIXfCRDmsq0tRMCN2AKn+zrbzcjIx1rnfLc6YubLst+sagmNeagOqJn/AFYqhcyo8GAcENTRGWAIBNaLRakSd3ZE1lc+ShDA4PSpJJGncEKQoqvbMZHUNggCrczEJxxWbWpcdihcQhZh70vmyJ8q9BTJmJcEnmk3Gt1G61MXKzdj/9k=';

// three.js loads on demand only (hero static card + gallery dialogs).
const Card3DViewer = lazy(() =>
  import('@/components/card-3d-viewer').then((m) => ({ default: m.Card3DViewer })),
);

// ── Shared bits ──────────────────────────────────────────────────────

// Rise (fade + 12px entrance) and EASE live in components/landing/rise.tsx
// since 2026-10-09 — the sections shared with /create need them too.

/** Auto-advance a carousel, politely. Who wins, in order:
 *
 *   1. prefers-reduced-motion — never runs at all.
 *   2. Off screen — doesn't run. No invisible cycling: the slide you scroll
 *      back to is the one you left, and we don't burn timers off-screen.
 *   3. Hover / keyboard focus — pauses, so it can't yank a slide out from
 *      under someone mid-read or mid-click.
 *   4. `paused` — the caller's own reason (e.g. the card is open, or there's
 *      only one example so there's nowhere to go).
 *   5. Viewer navigates by arrow/dot/swipe — stops for good. Once someone
 *      takes the wheel we don't grab it back off them.
 *
 *  Rules 3 + 5 are also what keeps this the right side of WCAG 2.2.2
 *  (Pause, Stop, Hide) — the motion is pausable and stoppable, and it's
 *  decorative either way.
 */
function useAutoAdvance({
  advance,
  delayMs = 6000,
  paused = false,
}: {
  advance: () => void;
  delayMs?: number;
  paused?: boolean;
}) {
  const reduced = useReducedMotion();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [stopped, setStopped] = useState(false);
  // Hold the latest closure so the interval doesn't restart every render
  // (and never fires a stale index).
  const advanceRef = useRef(advance);
  advanceRef.current = advance;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(!!entry?.isIntersecting),
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || stopped || paused || hovered || !inView) return;
    const timer = window.setInterval(() => advanceRef.current(), delayMs);
    return () => window.clearInterval(timer);
  }, [reduced, stopped, paused, hovered, inView, delayMs]);

  return {
    /** Attach to the carousel root — drives the on-screen check. */
    hostRef,
    /** Call from any viewer-initiated navigation. */
    stop: () => setStopped(true),
    /** Spread onto the carousel root. */
    pauseProps: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => setHovered(false),
      onFocusCapture: () => setHovered(true),
      onBlurCapture: () => setHovered(false),
    },
  };
}

/** Tagged placeholder for a not-yet-generated asset. Cards are SQUARE. */
function AssetSlot({
  tag,
  note,
  ratio = '1/1',
  className,
}: {
  tag: string;
  note: string;
  ratio?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-keeper-hair bg-white/60 p-4 text-center ${className ?? ''}`}
      style={{ aspectRatio: ratio }}
    >
      <span className="rounded bg-keeper-gold-wash px-2 py-0.5 font-mono text-[11px] font-semibold text-keeper-gold">
        {tag}
      </span>
      <span className="max-w-[26ch] text-[11.5px] leading-snug text-keeper-meta">{note}</span>
    </div>
  );
}

// ShimmerWord moved to components/landing/shimmer-word.tsx (2026-10-09)
// and is re-exported below so /create and the doorway keep importing it
// from here. CardPair went with the Inside section.

// Signed out, this opens the CLAIM modal rather than the bare auth one
// (Aidan 2026-08-06: "just want everyone presented with this").
//
// Note this doesn't add friction — the studio was ALREADY gated, so an
// anonymous visitor met a sign-in prompt here either way. Same gate, same
// step; it just leads with the free card instead of "we'll email you a
// code", which is the strongest reason we have for paying that cost.
// The invite modal is mounted on this page and listens for CLAIM_EVENT,
// same mechanism the ticker and the corner pill already use.
function PrimaryCta({ large = false, fullOnMobile = false }: { large?: boolean; fullOnMobile?: boolean }) {
  const { isAuthenticated, isLoading } = useAuth();
  const authed = !isLoading && isAuthenticated;
  // Violet go primary (2026-09-04): one primary treatment across the
  // gate, /create and this page; the header's ink pill stays secondary.
  const cls = `${large ? BTN_PRIMARY_LG : BTN_PRIMARY}${fullOnMobile ? ' w-full sm:w-auto' : ''}`;
  return authed ? (
    <Link href="/studio/new-card" className={cls} data-testid="keeper-cta">
      Make a card. It's free
    </Link>
  ) : (
    /* Signed out → the PUBLIC photo maker (2026-09-04): start with the
       photo now, sign up at Generate. The 3-dates offer still lives on
       the ticker + the claim flow. */
    <Link href="/photo/make" className={cls} data-testid="keeper-cta">
      Make a card, free to start
    </Link>
  );
}

// Chips carry lil icons (Kevin 2026-07-05); the privacy chip swapped
// for the deliver-your-way promise.
const TRUST_CHIPS = [
  { icon: RefreshCw, label: "Don't love it? A fresh take is free" },
  { icon: Mail, label: `280gsm · kraft envelope · ${copyFor().printedIn}` },
  { icon: Truck, label: 'Straight to them, or to you to hand over' },
] as const;

export function TrustChips({ center = false }: { center?: boolean }) {
  return (
    <div className={`mt-5 flex flex-wrap gap-2 ${center ? 'justify-center' : ''}`}>
      {TRUST_CHIPS.map(({ icon: Icon, label }) => (
        <span
          key={label}
          className="inline-flex items-center gap-1.5 rounded-full border border-keeper-hair bg-white/70 px-3 py-1 text-[11px] text-keeper-meta"
        >
          <Icon className="h-3 w-3 shrink-0 text-keeper-gold" aria-hidden="true" />
          {label}
        </span>
      ))}
    </div>
  );
}

/** The real 3D card, resting ajar (Kevin: "we have a great 3d card
 *  asset that can be used static"). Since 2026-07-05 the HERO copy is
 *  clickable — tap/click swings the cover open (the viewer's ONLY
 *  enabled gesture: no rotate, no zoom) and reports open state up so
 *  the hero can fade the source polaroid + hints. Pass no
 *  `onOpenChange` for the truly static uses. */
function StaticAjarCard({
  className,
  open = false,
  onToggle,
}: {
  className?: string;
  open?: boolean;
  onToggle?: () => void;
}) {
  // True once the 3D engine has painted its first frame (chunk + GL +
  // textures). Until then a flat card image holds the space — the
  // engine is a ~1.4MB lazy chunk, and without this there's a dead
  // beat between the Suspense fallback unmounting and the first
  // painted frame. Crossfade beats a spinner on a gallery page.
  const [engineReady, setEngineReady] = useState(false);
  return (
    // pointer-events-none on the whole tree — only the overlay button
    // (the card square itself) accepts taps, so the huge bleed canvas
    // never eats clicks on the hero text/CTA it overlaps.
    <div
      className={`pointer-events-none relative ${className ?? ''}`}
      style={{ aspectRatio: '1/1' }}
    >
      {/* The canvas BLEEDS past the square anchor so the cover is
          never clipped. x-bleed is HUGE: at fov 40 the open cover
          (-2.1 rad) tilts toward the camera and its free edge
          projects ~1.6 world units left of centre — the canvas needs
          ~2.9× the anchor width to contain it. Camera fit is
          height-driven, so the wider canvas doesn't change the card's
          visual size. */}
      <div className="absolute inset-y-[-24%] inset-x-[-105%]">
        {/* The 3D card is hidden until its first frame paints, then fades in
            as the spinner fades out — a clean cross-fade. Without this the
            card rendered UNDER the spinner, so the spinner lingered on top of
            an already-visible card (Kevin's video, 2026-07-22). */}
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            engineReady ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <Suspense fallback={null}>
            <Card3DViewer
              frontImageUrl={heroCardFront}
              insideImageUrl={heroCardInside}
              open={open}
              interactive={false}
              enableRotate={false}
              enableZoom={false}
              closedAngle={-0.55}
              restYaw={-0.12}
              framingMargin={1.75}
              minDistance={1.2}
              dprMax={1.5}
              onFirstFrame={() => setEngineReady(true)}
              className="h-full w-full"
            />
          </Suspense>
        </div>
        {/* Load placeholder — a neutral spinner centred on the card, held
            until the engine's first painted frame (+ a settle beat), then
            cross-faded away to reveal the 3D card. A previous CSS "cover"
            mimic tried to look like the card, but it never lined up exactly
            with the settled 3D card underneath, so the hand-over read as a
            jump (measured 2026-07-22: canvas size was stable — the shift was
            purely mimic-vs-card). A neutral spinner has no shape to
            misalign, so the reveal is clean. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
            engineReady ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-keeper-hair border-t-brand" />
        </div>
      </div>
      {/* Our own tap target: the card square. Controlled-open beats
          the viewer's hit zone here — its single inset percentage
          can't hug the card inside a 2.9:1 bleed box. */}
      {onToggle && (
        <button
          type="button"
          aria-label={open ? 'Close the card' : 'Open the card'}
          onClick={onToggle}
          className="pointer-events-auto absolute inset-0 z-10 cursor-pointer bg-transparent"
        />
      )}
    </div>
  );
}

/** Gallery tile — a permanently-ajar card with a spring-hinged cover.
 *  Kevin on the live-3D-swap version: "super clunky… each asset should
 *  be slightly ajar and not change its dimensions once clicked. Must
 *  be super fluid." The fix: NOTHING mounts or reframes on click —
 *  every tile is always this exact DOM, and the click animates ONE
 *  value (the cover's hinge angle) on a spring. Pure composited CSS
 *  3D; at tile scale it reads identically to the WebGL card, without
 *  costing six GPU contexts (the real engine stays in the hero + the
 *  free-link section). Hero art is the stand-in until D1–D6 land. */
/** Gallery tile — a card sitting ajar. Deliberately NOT interactive
 *  (Kevin 2026-07-16). Tap-to-open was the THIRD outing of that gesture —
 *  the hero opens a card, the proof opens a card, and then this asked you
 *  to open six more — and the "inside matches the front" proof it bought
 *  is now made explicitly and full-size by THE INSIDE section. So these sit
 *  still and say one thing: any occasion. Breadth is this section's job;
 *  depth belongs to the hero and the proof.
 *
 *  Why only the FRONTS need real art: at -22° the cover still covers
 *  cos(22°) ≈ 93% of the width, so barely a ~7% strip of the inside page
 *  is ever visible — a sliver of texture, not something anyone can read.
 *  Every tile therefore shares one inside image and nobody can tell.
 *  Ajar rather than flat because that strip + the shadow are what make it
 *  read as an object instead of a picture (and rest-ajar is the locked
 *  card language site-wide). */
function AjarTile({
  tag,
  what,
  front,
}: {
  tag: string;
  what: string;
  front: string;
}) {
  return (
    <div
      className="relative w-full"
      style={{ aspectRatio: '1/1' }}
      data-testid={`gallery-card-${tag}`}
    >
      <div className="absolute inset-[6%]" style={{ perspective: '1100px' }}>
        {/* Inside page — only its right ~7% ever shows. Shared by all six. */}
        <div className="absolute inset-0 overflow-hidden rounded-[6px] bg-white shadow-[0_20px_44px_-20px_rgba(33,29,25,0.35)]">
          <img src={heroCardInside}
                crossOrigin="anonymous" alt="" className="h-full w-full object-cover" />
          {/* Soft spine shadow so the inside reads as a page, not a print */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-[18%]"
            style={{ background: 'linear-gradient(90deg, rgba(33,29,25,0.18), transparent)' }}
          />
        </div>
        {/* Cover — hinged left, parked ajar. No spring, no state: it never
            moves, so this is a plain static transform. The cover's BACK
            face is gone with the tap — past 90° was the only way to see it. */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[6px] shadow-[0_10px_26px_-12px_rgba(33,29,25,0.4)]"
          style={{ transformOrigin: 'left center', transform: 'rotateY(-22deg)' }}
        >
          {/* The briefs underneath are gone, so the ART carries the
              occasion — this alt is now the ONLY place it survives for a
              screen reader. Don't blank it. */}
          <img src={front}
                crossOrigin="anonymous" alt={`${what} card`} className="h-full w-full object-cover" />
        </div>
      </div>
      <span className="absolute left-2 top-2 rounded bg-keeper-gold-wash/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-keeper-gold">
        {tag}
      </span>
    </div>
  );
}

// Lightweight CSS-3D "ajar" card — the SAME trick as the gallery's AjarTile
// (two flat images + a cover hinged on rotateY), NO WebGL. Used in the proof
// coverflow so three cards cost three <img> pairs, not three live GL contexts
// (Kevin 2026-07-14: "use the same approach as Any face. Any occasion?").
// Fast to load, and any number can run at once.
function CssAjarCard({
  frontUrl,
  insideUrl,
  open,
}: {
  frontUrl: string;
  insideUrl: string;
  open: boolean;
}) {
  return (
    <div className="absolute inset-0" style={{ perspective: '1200px' }}>
      {/* Inside page — revealed as the cover swings open. */}
      <div className="absolute inset-0 overflow-hidden rounded-[6px] bg-white shadow-[0_20px_44px_-20px_rgba(33,29,25,0.35)]">
        <img
          src={insideUrl}
          crossOrigin="anonymous"
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
        <div
          className="pointer-events-none absolute inset-y-0 left-0 w-[18%]"
          style={{ background: 'linear-gradient(90deg, rgba(33,29,25,0.18), transparent)' }}
        />
      </div>
      {/* Cover — hinged on the left edge; rests ajar (-16°), opens (-150°). */}
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d', transformOrigin: 'left center' }}
        initial={false}
        animate={{ rotateY: open ? -150 : -24 }}
        transition={{ type: 'spring', stiffness: 65, damping: 13, mass: 0.9 }}
      >
        <div
          className="absolute inset-0 overflow-hidden rounded-[6px] shadow-[0_10px_26px_-12px_rgba(33,29,25,0.4)]"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <img
            src={frontUrl}
            crossOrigin="anonymous"
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        </div>
        {/* Inside-left (back of the cover) — white stock + the celebrait
            wordmark small at bottom-centre, matching the 3D render. */}
        <div
          className="absolute inset-0 flex items-end justify-center rounded-[6px] border border-stone-200/60 bg-white pb-[10%]"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <img src={celebraitLogo} alt="" className="w-[27%] opacity-70" />
        </div>
      </motion.div>
    </div>
  );
}


// ── 1. HERO — The Transformation ─────────────────────────────────────

// Always 'your SOMETHING' (Kevin's rule) — and short enough that the
// persona line never wraps at any breakpoint.
const PERSONAS = [
  'your best mate',
  'your first born',
  'your big sis',
  'your little bro',
  'your grandad',
  'your nan',
  'your better half',
  'your auntie',
  'your soulmate',
];

/** Shuffle the personas for variety on each load, but PIN 'your mum'
 *  first — it's the strong universal opener that first paint, crawlers,
 *  and reduced-motion users all land on. Fisher-Yates on the rest. */
function shuffledPersonas(): string[] {
  const rest = PERSONAS.slice(1);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [PERSONAS[0], ...rest];
}

// ── HeroProof ────────────────────────────────────────────────────────
// The hero's right column: a REAL printed card photographed on a desk,
// with the ordinary phone snap it was made from pinned to its corner as
// a polaroid. One glance tells the whole story — "that snap became this
// object" — with no interaction and no WebGL.
//
// ASSETS (all real — these ARE the handover photos + a tester's snap):
//   /hero-real-card.webp   the printed card, standing, on a desk
//   /hero-real-open.webp   the same card open (spare, for a peek beat)
//   /hero-real-source.webp the phone snap it came from
//   /reaction.mp4          recipient opening it
//                          ⚠ 11MB — MUST be compressed before production
//
// PERF NOTE (honest): dropping the 3D hero does NOT by itself remove
// three.js from this page. The `three-stack` manual chunk in
// vite.config.ts also ends up holding React (Rollup hoists the shared
// dep into it), so every page statically imports that chunk regardless.
// Splitting React into its own chunk is the actual fix — separate job.
/** Warm the browser cache for the reaction clip once, on first intent.
 *  A bare fetch() populates the HTTP cache the <video> then reads from,
 *  and `low` priority keeps it from competing with the hero image. */
let reactionPrefetched = false;
function prefetchVideo() {
  if (reactionPrefetched) return;
  reactionPrefetched = true;
  try {
    void fetch('/reaction.mp4', { priority: 'low' } as RequestInit).catch(() => {});
  } catch {
    /* prefetch is best-effort — never break the click */
  }
}

const HERO_VIDEO_EVENT = 'celebrait:hero-video';

function HeroProof() {
  const [playing, setPlaying] = useState(false);
  // Beta testers get no way off the photo route (2026-11-05), so the
  // stories link hides for them; the video stays.
  const betaChrome = useBetaMinimalChrome();
  // The phone layout renders its two links in the text column, under the
  // primary button (2026-11-11), so they ask this component to open the
  // video rather than owning a second player.
  useEffect(() => {
    const open = () => setPlaying(true);
    window.addEventListener(HERO_VIDEO_EVENT, open);
    return () => window.removeEventListener(HERO_VIDEO_EVENT, open);
  }, []);
  // `started` gates the poster overlay + the native controls: the modal
  // opens on a clean poster, and the chrome only appears once it's
  // actually playing. Reset on end so the poster + play button come
  // back for a replay.
  const [started, setStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const startPlayback = () => {
    const v = videoRef.current;
    if (!v) return;
    // Unmuted on purpose — this runs inside the tap's user-gesture
    // window, which is what permits audio on iOS. If a browser still
    // refuses, fall back to muted playback rather than a dead button.
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      void v.play().catch(() => {});
    });
  };

  // Escape closes, and the page behind is locked so a mobile scroll
  // gesture doesn't drift the landing page under the overlay.
  useEffect(() => {
    // Closing resets to the poster + play button, so reopening never
    // lands on a paused mid-video frame.
    if (!playing) {
      setStarted(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPlaying(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [playing]);

  return (
    <div className="relative">
      {/* Image + the "started as this" snap share their own box, so the
          snap hangs off the IMAGE, not off the links below it. */}
      <div className="relative">
      {/* The object itself — the proof it's not a digital gimmick. */}
      <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_28px_70px_-24px_rgba(33,29,25,0.45)]">
        {/* Nana's 80th (Aidan 2026-11-10) — the same card Real stories
            tells in full further down. Cropped 3:2 from gallery-img. */}
        <img
          src="/hero-nana-card.webp"
          alt="A printed Celebrait card: Hannah and her Nana on a Budapest riverside wall at sunset, reading Happy 80th Nana"
          className="h-full w-full object-cover"
          width={1100}
          height={734}
          // Lowercase, and spread, on purpose. React 18.3 does NOT know
          // the camelCase `fetchPriority` prop — it warns and DROPS it,
          // so the hint this line exists for was never reaching the DOM.
          // Lowercase isn't in React's img typings either, hence the
          // spread. Revisit when we're on React 19, which supports the
          // camelCase form natively.
          {...{ fetchpriority: 'high' }}
        />
      </div>

      {/* The ordinary snap it started as — deliberately small and a
          little wonky. The gap between this and the card above is the
          entire pitch. */}
      <div className="absolute -bottom-6 -left-3 w-[34%] -rotate-6 sm:-bottom-8 sm:-left-6 sm:w-[30%]">
        <div className="rounded-lg border-[6px] border-white bg-stone-100 shadow-[0_16px_36px_-12px_rgba(33,29,25,0.45)]">
          <img
            src="/hero-nana-source.webp"
            alt="The everyday selfie this card was made from: Hannah and her Nana on a Lake District walk"
            className="block h-full w-full rounded-sm object-cover"
            style={{ aspectRatio: '3/4' }}
          />
        </div>
        <p className="mt-2 text-center text-[11px] font-medium leading-tight text-keeper-meta">
          started as this
        </p>
      </div>
      </div>

      {/* Watch-her-open-it — secondary to the main CTA on purpose.
          Prefetch on INTENT (hover/touch-start), not page load: the clip
          is 1.3MB and most visitors never open it, so eagerly fetching
          it would tax every mobile visit for nothing. Hovering or
          starting a tap gives a few hundred ms head start, which is
          usually the whole download. */}
      {/* Two big links (Aidan 2026-11-11), replacing the small
          "Watch her open it" pill: read the stories, or watch the video.
          The video still prefetches on intent, not on page load. */}
      <div className="mt-24 hidden gap-3 md:grid md:grid-cols-2">
        {!betaChrome && (
          <Link
            href="/stories"
            className="flex items-center justify-center gap-2.5 rounded-full border-2 border-brand bg-white px-6 py-4 text-[16px] font-semibold text-keeper-ink shadow-sm transition-colors hover:bg-brand-muted/40"
            data-testid="hero-read-stories"
          >
            <BookOpen className="h-5 w-5 text-brand-dark" strokeWidth={2} aria-hidden="true" />
            Read the stories
          </Link>
        )}
        <button
          type="button"
          onPointerEnter={prefetchVideo}
          onTouchStart={prefetchVideo}
          onFocus={prefetchVideo}
          onClick={() => setPlaying(true)}
          className={`flex items-center justify-center gap-2.5 rounded-full border-2 border-brand bg-white px-6 py-4 text-[16px] font-semibold text-keeper-ink shadow-sm transition-colors hover:bg-brand-muted/40 ${betaChrome ? 'sm:col-span-2' : ''}`}
          data-testid="hero-play-reaction"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white">
            <Play className="ml-[2px] h-3.5 w-3.5 fill-current" strokeWidth={0} />
          </span>
          Watch the video
        </button>
      </div>

      {/* PORTALLED TO <body> — and it has to be. This lives inside
          <Rise className="relative z-10">, which creates a STACKING
          CONTEXT, so any z-index here (even z-[999]) only ranks within
          that box and the whole modal still sat at z-10 against the page
          — behind the z-[150] header (Kevin saw the menu bar over the
          video on both mobile and desktop, 2026-07-29). Raising the
          number can't fix a stacking-context problem; escaping the
          context can. The close button is FIXED to the viewport corner
          rather than the video, so it stays reachable however tall the
          clip renders; backdrop-tap and Escape also close. */}
      {playing && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-keeper-ink/85 p-4 backdrop-blur-sm"
          onClick={() => setPlaying(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Recipient opening her card"
        >
          <button
            type="button"
            onClick={() => setPlaying(false)}
            aria-label="Close video"
            className="fixed right-4 top-4 z-[201] flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-keeper-ink shadow-lg transition-colors hover:bg-white"
          >
            <X className="h-5 w-5" strokeWidth={2.5} />
          </button>
          {/* TAP-TO-START, WITH SOUND (Kevin's call 2026-07-29). It's a
              reaction video — the sound is half the moment, so a silent
              autoplay was the wrong trade.
              Deliberately NOT autoPlay+muted: iOS blocks unmuted
              autoplay, so autoplay could only ever be silent. A direct
              tap on this button IS a user gesture, which is exactly what
              lets .play() run with audio on iOS.
              poster (21KB first frame) means the modal opens on a real
              image, never the black box Kevin saw; combined with the
              prefetch-on-intent above, playback starts on the tap.
              playsInline is load-bearing: without it iOS hijacks
              fullscreen. Controls appear only once playing so the poster
              stays clean. */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <video
              ref={videoRef}
              src="/reaction.mp4"
              poster="/reaction-poster.webp"
              preload="auto"
              controls={started}
              playsInline
              onPlay={() => setStarted(true)}
              onEnded={() => setStarted(false)}
              className="max-h-[82vh] w-auto max-w-full rounded-xl bg-black shadow-2xl sm:max-w-md"
            />
            {!started && (
              <button
                type="button"
                onClick={startPlayback}
                aria-label="Play video with sound"
                className="absolute inset-0 flex items-center justify-center rounded-xl transition-colors hover:bg-black/10"
                data-testid="hero-video-play"
              >
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-white/95 shadow-xl transition-transform duration-200 hover:scale-105">
                  <Play
                    className="ml-1.5 h-8 w-8 fill-keeper-ink text-keeper-ink"
                    strokeWidth={0}
                  />
                </span>
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function HeroSection() {
  const reduced = useReducedMotion();
  // The other door shows only while the three-card route is open
  // (/admin/site, 2026-10-29: photo route only for launch).
  const maker = useMakerEnabled() === true;
  const onUs = useFirstCardOnUs();
  const betaChrome = useBetaMinimalChrome();
  const [persona, setPersona] = useState(0);
  // Shuffled display order (mum pinned first). Stable for the session —
  // useState's lazy init runs the shuffle once on mount.
  const [order] = useState(shuffledPersonas);
  const [visible, setVisible] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (reduced) return;
    const el = sectionRef.current;
    if (!el) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && timer === undefined) {
          timer = window.setInterval(() => {
            // Background tabs throttle timers, which can batch this
            // fade-out with its paired fade-in and strand the word at
            // opacity 0 — skip cycles while hidden.
            if (document.hidden) return;
            setVisible(false);
            window.setTimeout(() => {
              setPersona((p) => (p + 1) % order.length);
              setVisible(true);
            }, 200);
          }, 2200);
        } else if (!e.isIntersecting && timer !== undefined) {
          window.clearInterval(timer);
          timer = undefined;
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [reduced]);

  return (
    <section ref={sectionRef} className="px-6 pb-12 pt-10 md:pb-12 md:pt-20">
      {/* Explicit row/col placement so MOBILE order is
          headline → the proof photo → copy → CTA. Stacking the columns
          naively buried the card photo below a full screen of text and
          the CTA, which wastes the one asset that does the convincing
          (2026-07-29). Desktop is unchanged: text left, proof right. */}
      <div className="mx-auto grid max-w-6xl items-start gap-x-16 gap-y-10 md:grid-cols-[1.05fr_0.95fr] md:gap-y-0">
        <div className="md:col-start-1 md:row-start-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">
            Unbinnable Greetings Cards
          </p>
          {/* STRUCTURAL three lines (Kevin's rule: "ALWAYS flows 3 lines
              on desktop and mobile"): Put / your-something / in the
              picture. The persona line is nowrap and every persona is
              short enough to fit at all breakpoints — the layout can
              never reflow, so the 3D card column never moves. */}
          <h1
            className={`mt-4 ${H1} ${DISPLAY}`}
          >
            Put
            <br />
            {/* Stack the visible persona over invisible sizers of EVERY
                persona (same grid cell) so the line width is fixed at the
                widest — constant regardless of which word shows → the
                headline column, and the 3D card beside it, never reflow
                (Kevin 2026-07-23). The sizers mirror ShimmerWord's box
                (inline-block + px-1) so they reserve the exact rendered
                width, minus the shimmer animation. */}
            <span className="relative inline-grid align-baseline">
              {PERSONAS.map((p) => (
                <span
                  key={p}
                  aria-hidden
                  className="invisible col-start-1 row-start-1 inline-block whitespace-nowrap px-1"
                >
                  {p}
                </span>
              ))}
              <span
                className="col-start-1 row-start-1 whitespace-nowrap transition-opacity duration-200"
                style={{ opacity: visible ? 1 : 0 }}
              >
                <ShimmerWord reduced={!!reduced}>{order[persona]}</ShimmerWord>
              </span>
            </span>
            <br />
            in the picture.
          </h1>
        </div>

        {/* THE PROOF — row 1 of the right column on desktop; on mobile it
            sits directly under the headline (see the grid comment). */}
        <Rise className="relative z-10 md:col-start-2 md:row-start-1 md:row-span-2">
          <HeroProof />
        </Rise>

        {/* PHONE ORDER (2026-11-11, all three reviews): image → the primary
            button, full width → the offer line → description → the two
            links. Desktop keeps description first. The top margin on
            phones clears the "started as this" snap that hangs off the
            image. */}
        <div className="flex flex-col md:col-start-1 md:row-start-2">
          {/* One plain line (Aidan 2026-11-11): replaced the three-step
              recipe, the £ price and the 7–10 minutes wink. */}
          <p className="order-2 mt-7 max-w-[30rem] text-[17px] leading-[1.6] text-keeper-body md:order-1 md:mt-6">
            Celebrait turns your photo into any scene imaginable to create mind blowing
            custom greetings cards. Print ready in under ten minutes.
          </p>
          <div className="order-1 mt-10 md:order-2 md:mt-8">
            <PrimaryCta large fullOnMobile />
            {/* The offer where the decision is made, conditions included
                (ASA: "free" shows its terms). Falls back when it's off. */}
            <p className="mt-3 text-[12.5px] leading-snug text-keeper-meta" data-testid="hero-offer-line">
              {onUs ? (
                <>
                  <b className="font-semibold text-keeper-ink">First card free when you save three dates.</b>{' '}
                  {formatMoney(shippingPrice())} postage. No payment details to start.
                </>
              ) : (
                'Free to make. No payment details needed.'
              )}
            </p>
            {/* The other door (the gate, 2026-09-03): each landing page
                points at the other. */}
            {maker && (
              <p className="mt-3 text-[13px] text-keeper-body">
                No photo to hand?{' '}
                <Link href="/create" className="font-medium text-keeper-ink underline decoration-keeper-hair underline-offset-4 transition-colors hover:text-keeper-gold hover:decoration-keeper-gold">
                  Tell us one thing they love and pick from three cards →
                </Link>
              </p>
            )}
          </div>
          {/* The two links, phones only (desktop shows them big under the
              image, in HeroProof). Smaller than the primary on purpose. */}
          <div className={`order-3 mt-6 grid gap-2.5 md:hidden ${betaChrome ? '' : 'grid-cols-2'}`}>
            {!betaChrome && (
              <Link
                href="/stories"
                className="flex items-center justify-center gap-2 rounded-full border border-keeper-hair bg-white px-3 py-3 text-[14px] font-semibold text-keeper-ink"
                data-testid="hero-read-stories-mobile"
              >
                <BookOpen className="h-4 w-4 text-brand-dark" strokeWidth={2} aria-hidden="true" />
                Read the stories
              </Link>
            )}
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event(HERO_VIDEO_EVENT))}
              className="flex items-center justify-center gap-2 rounded-full border border-keeper-hair bg-white px-3 py-3 text-[14px] font-semibold text-keeper-ink"
              data-testid="hero-play-reaction-mobile"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white">
                <Play className="ml-[1px] h-2.5 w-2.5 fill-current" strokeWidth={0} />
              </span>
              Watch the video
            </button>
          </div>
          <div className="order-4">
            <TrustChips />
          </div>
        </div>

      </div>
    </section>
  );
}

// ── 2. PROOF — Any scene imaginable ──────────────────────────────────

// Each worked example is a COMPLETE recipe → result: the source photo, the
// three text inputs, and the openable card those inputs produced. The
// section cycles through them (see ProofSection) so the "any scene
// imaginable" claim is shown, not just asserted. Slide 1 is Kevin's real
// generation; drop 2 more objects here (each with its own /public webp
// trio + the three strings) and the carousel arrows/dots/hint light up
// automatically — they're hidden while there's only one example.
type ProofExample = {
  id: string;
  sourcePhoto: string;
  sourceAlt: string;
  scene: string;
  frontText: string;
  insideMessage: string;
  cardFront: string;
  cardInside: string;
  cardAlt: string;
};

const MUM_EXAMPLE: ProofExample = {
  id: 'northern-lights',
  sourcePhoto: proofSourcePhoto,
  sourceAlt: 'The photo of Mum this card was made from',
  scene: 'Gazing at the Northern Lights',
  frontText: 'Happy 60th, Mum',
  insideMessage:
    'Sixty years and you still light up every room. Happy birthday, Mum, all my love.',
  cardFront: proofCardFront,
  cardInside: proofCardInside,
  cardAlt: 'The finished card front: Mum under the Northern Lights',
};

// Example 2 — REAL as of 2026-07-16. Text below is transcribed from the
// card itself, not written to fit: the front really says "Happy 30th,
// Rach!" (skywritten) and the inside really is signed "Lulu x".
const BIG_BEN_EXAMPLE: ProofExample = {
  id: 'big-ben',
  sourcePhoto: bigBenSourcePhoto,
  sourceAlt: 'The selfie of Rach and Lulu this card was made from',
  scene: 'Abseiling off Big Ben',
  frontText: 'Happy 30th, Rach!',
  insideMessage:
    "Not sure why we're abseiling off Big Ben but it's funny AF. Love you always, Lulu x",
  cardFront: bigBenCardFront,
  cardInside: bigBenCardInside,
  cardAlt: 'The finished card front: Rach and Lulu abseiling off Big Ben',
};

// Example 3 — REAL as of 2026-07-17. Transcribed from the card, not written
// to fit it. Inside re-generated shorter (Kevin: "forgot how long it was"),
// and the recipient is Sarah — the earlier long version was addressed to
// Lulu, so the alt text follows the artwork.
const TIMES_SQUARE_EXAMPLE: ProofExample = {
  id: 'times-square',
  sourcePhoto: timesSqSourcePhoto,
  sourceAlt: 'The selfie of Sarah this card was made from',
  scene: 'Going viral in Times Square',
  frontText: 'Sweet 16 x',
  insideMessage:
    'Wishing you all the joy in the world today on your sweet 16th. Love, Mum and Dad x',
  cardFront: timesSqCardFront,
  cardInside: timesSqCardInside,
  cardAlt: 'The finished card front: Sarah going viral in Times Square',
};

// Example 4 — the couple who used to headline the hero. When the hero
// became a real printed-card photo (2026-07-29) this card lost its home,
// and it's too good to retire: it's the only example carrying a whole
// surprise inside ("Pack a bag — we're going to New York"), which shows
// the inside message doing real work rather than just signing off.
const NEW_YORK_EXAMPLE: ProofExample = {
  id: 'new-york',
  sourcePhoto: '/hero-source-photo.webp',
  sourceAlt: 'The pub photo of the couple this card was made from',
  scene: 'On a rooftop in New York at sunset',
  frontText: 'Happy Anniversary Baby!',
  insideMessage:
    "Happy 10th anniversary, Sarah. Pack a bag, we're going to New York baby! Love you so much x",
  cardFront: heroCardFront,
  cardInside: heroCardInside,
  cardAlt:
    'The finished card front: the couple toasting on a New York rooftop at sunset',
};

// All four are REAL worked examples: navigating changes the card, not just
// the caption. ORDER MATTERS — it mirrors the body copy above it word for
// word ("Best friends abseiling off Big Ben, mum under the Northern Lights,
// daughter going viral in Times Square, ten years together on a New York
// rooftop"), so the first card you see is the first example you just read.
// Keep the two in step (Kevin 2026-07-17).
const PROOF_EXAMPLES: ProofExample[] = [
  BIG_BEN_EXAMPLE,
  MUM_EXAMPLE,
  TIMES_SQUARE_EXAMPLE,
  NEW_YORK_EXAMPLE,
];

// ── 2b. THE SCENES ROW (2026-11-11) ──────────────────────────────────
// Replaces the one-card carousel on /photo. Three real cards side by
// side, each with the photo it started as and the scene that was typed:
// the proof comes from the product, no reviews needed. Tap a card to see
// its inside. Mum / Northern Lights is left out on purpose — the
// how-it-works section one screen up already walks through that card,
// and the page was showing it three times running. ProofSection (the
// carousel, with its openable card) is kept below for an easy swap back.
const SCENE_ROW: ProofExample[] = [BIG_BEN_EXAMPLE, TIMES_SQUARE_EXAMPLE, NEW_YORK_EXAMPLE];

function SceneTile({ e }: { e: ProofExample }) {
  const [inside, setInside] = useState(false);
  return (
    <li className="w-[76%] max-w-[340px] shrink-0 snap-center md:w-auto md:max-w-none">
      <button
        type="button"
        onClick={() => setInside((v) => !v)}
        aria-pressed={inside}
        aria-label={inside ? 'Show the front of this card' : 'Show the inside of this card'}
        className="group relative block w-full text-left"
        data-testid={`scene-tile-${e.id}`}
      >
        <span className="relative block aspect-square overflow-hidden rounded-[10px] bg-white shadow-[0_26px_60px_-28px_rgba(33,29,25,0.5)] ring-1 ring-black/5">
          <img
            src={e.cardFront}
            alt={e.cardAlt}
            loading="lazy"
            decoding="async"
            width={900}
            height={900}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${inside ? 'opacity-0' : 'opacity-100'}`}
          />
          <img
            src={e.cardInside}
            alt={`The inside of the card: ${e.insideMessage}`}
            loading="lazy"
            decoding="async"
            width={900}
            height={900}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${inside ? 'opacity-100' : 'opacity-0'}`}
          />
          <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-keeper-ink shadow-sm">
            {inside ? 'See the front' : 'See inside'}
          </span>
        </span>
        {/* The ordinary photo it started as — same tilted snap as the hero. */}
        <span className="absolute -bottom-5 -left-3 block w-[30%] -rotate-6 rounded-md border-[5px] border-white bg-stone-100 shadow-[0_14px_30px_-12px_rgba(33,29,25,0.5)]">
          <img
            src={e.sourcePhoto}
            alt={e.sourceAlt}
            loading="lazy"
            decoding="async"
            width={500}
            height={500}
            className="block aspect-square w-full rounded-sm object-cover"
          />
        </span>
      </button>
      <div className="mt-9 pl-1 text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">The scene they typed</p>
        <p className="mt-1.5 font-display text-[20px] font-bold leading-snug tracking-[-0.01em] text-keeper-ink">
          “{e.scene}”
        </p>
        <p className="mt-1 text-[14px] text-keeper-meta">On the front: {e.frontText}</p>
      </div>
    </li>
  );
}

function ScenesRowSection() {
  const reduced = useReducedMotion();
  const beta = useBetaMinimalChrome();
  return (
    <section id="proof" className="scroll-mt-32 py-16 md:pb-32 md:pt-16">
      <Rise className="mx-auto max-w-4xl px-6 text-center">
        {/* The page's one big centred statement: every other heading is 44px. */}
        <h2 className={`text-[clamp(34px,5.6vw,64px)] leading-[1.04] [text-wrap:balance] ${DISPLAY}`}>
          Greetings cards <ShimmerWord reduced={!!reduced}>used</ShimmerWord> to be boring
        </h2>
        <p className="mt-5 text-[19px] leading-[1.5] text-keeper-body md:text-[21px]">
          You describe the scene. We make it real.
        </p>
      </Rise>
      {/* Phones: a swipeable row with the next card peeking. Desktop: three across. */}
      <ul
        className="mt-12 flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-8 pt-2 md:mx-auto md:mt-16 md:grid md:max-w-6xl md:grid-cols-3 md:gap-10 md:overflow-visible md:pb-0"
        style={{ scrollbarWidth: 'none' }}
        data-testid="scenes-row"
      >
        {SCENE_ROW.map((e) => (
          <SceneTile key={e.id} e={e} />
        ))}
      </ul>
      <div className="mt-8 flex flex-col items-center gap-4 px-6 md:mt-14">
        <PrimaryCta />
        {!beta && (
          <Link
            href="/gallery"
            className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-keeper-ink underline decoration-keeper-hair underline-offset-4 transition-colors hover:decoration-keeper-gold"
            data-testid="scenes-row-gallery"
          >
            See every card in the gallery
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </Link>
        )}
      </div>
    </section>
  );
}

function ProofSection() {
  const reduced = useReducedMotion();
  const [cardOpen, setCardOpen] = useState(false);
  // Carousel index. `many` gates every carousel affordance so a lone
  // example renders exactly as before — no arrows, no dots, no hint.
  const [idx, setIdx] = useState(0);
  const many = PROOF_EXAMPLES.length > 1;
  const prevIdx = (idx - 1 + PROOF_EXAMPLES.length) % PROOF_EXAMPLES.length;
  const nextIdx = (idx + 1) % PROOF_EXAMPLES.length;

  const goTo = (next: number) => {
    // Always land on the CLOSED front — a new slide reads as a new card,
    // and carrying `open` over would flash the previous card's inside.
    setCardOpen(false);
    setIdx((next + PROOF_EXAMPLES.length) % PROOF_EXAMPLES.length);
  };

  // Cycle the examples on their own (Kevin 2026-07-16). Paused while a card
  // is open — sliding the inside away mid-read would be the rudest possible
  // moment — and while there's only one example to show.
  const { hostRef, stop, pauseProps } = useAutoAdvance({
    advance: () => goTo(idx + 1),
    paused: cardOpen || !many,
    delayMs: 7000, // each slide carries a recipe to read; don't rush it
  });
  /** Viewer-initiated navigation: takes the wheel off the auto-advance. */
  const userGoTo = (next: number) => {
    stop();
    goTo(next);
  };

  const field = (Icon: LucideIcon, label: string, value: string) => (
    <div className="rounded-xl border border-keeper-hair bg-white px-3.5 py-2.5">
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-keeper-meta">
        <Icon className="h-3 w-3 shrink-0 text-keeper-gold" aria-hidden="true" />
        {label}
      </div>
      {/* line-clamp guards a layout invariant: the recipe column must stay
          SHORTER than the card, or it unbalances the slide and breaks the
          md:-translate-y-8 that centres it on the card. Every example
          currently fits in 4 lines, so this never fires — it's here because
          a real inside message can be any length (the first Times Square gen
          ran ~4x longer and pushed the column to ~450px vs the 360px card).
          Clamps the DISPLAY only; the card beside it always shows the lot. */}
      <div className="line-clamp-4 text-[14px] leading-snug text-keeper-ink">{value}</div>
    </div>
  );

  // Green signpost for the carousel. Wording matches the actual gesture per
  // device — "Tap to see more" on desktop (click a neighbour / edge), "Swipe
  // to see more" on mobile (Kevin 2026-07-14). Chevrons flag it either way.
  const swipeHint = (className = '') => (
    <div className={`flex justify-start ${className}`}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-cta-light px-3 py-1 text-[11.5px] font-semibold uppercase tracking-[0.09em] text-cta-dark">
        <ChevronsLeft className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
        <span className="md:hidden">Swipe to see more</span>
        <span className="hidden md:inline">Tap to see more</span>
        <ChevronsRight className="h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden="true" />
      </span>
    </div>
  );

  // Horizontal swipe → change slide (mobile). Track BOTH axes so we only
  // treat a gesture as a slide-swipe when it's clearly horizontal —
  // otherwise it was a vertical/diagonal scroll and we leave it to the page.
  // Paired with touch-action: pan-y on the track (below), which lets the
  // browser own vertical scrolling and frees horizontal for us, so swiping
  // and scrolling stop fighting each other (Kevin 2026-07-23).
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    touchStart.current = t ? { x: t.clientX, y: t.clientY } : null;
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    const s = touchStart.current;
    touchStart.current = null;
    if (!s || !many) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    // Clearly horizontal: >45px across AND at least ~1.3× the vertical drift.
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      userGoTo(dx < 0 ? idx + 1 : idx - 1);
    }
  };

  return (
    <section id="proof" className="scroll-mt-32 px-6 py-16 md:pb-32 md:pt-16">
      <div className="mx-auto max-w-5xl text-center">
        {/* px-1 mirrors the slides' own px-1 inset, so this column's left
            edge lines up with the recipe column's on mobile too (where the
            recipe left-aligns rather than centres). */}
        <Rise className="px-1">
          {/* Headline, body and signpost share ONE left-aligned column,
              centred at the SAME width as the slider row's content below —
              recipe (320) + md:gap-16 (64) + card (360) = 744 — so this
              column's left edge lands exactly on the recipe column's.
              Keep 744 in step if the card size or the row gap changes.
              Prose keeps a readable 54ch measure inside (Kevin 2026-07-16). */}
          <div className="mx-auto max-w-[744px] text-left">
            <div className="max-w-[54ch]">
              <h2 className={`text-[clamp(30px,4.4vw,44px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>
                Greetings cards <ShimmerWord reduced={!!reduced}>used</ShimmerWord> to be
                boring
              </h2>
              {/* The examples are listed in the SAME order the carousel plays
                  them (see PROOF_EXAMPLES) — keep the two in step. */}
              <p className="mt-5 text-[17px] leading-[1.6] text-keeper-body">
                Best friends abseiling off Big Ben, mum under the Northern
                Lights, daughter going viral in Times Square, ten years
                together on a New York rooftop: You describe the scene. We
                make it real.
              </p>
            </div>
            {/* One signpost above the carousel. */}
            {many && swipeHint('mt-6')}
          </div>
        </Rise>

        {/* RECIPE SLIDER — each slide is a WHOLE example: the photo + text
            boxes AND the card they produced, as one unit (Kevin 2026-07-15).
            Desktop lays the inputs left / card right; mobile stacks inputs
            over card. Navigating slides the entire unit sideways, bringing in
            the next example's recipe + card together. Plain translateX track —
            no perspective, naturally responsive, no resize gremlins. */}
        <Rise delay={0.1} className="mt-16 md:mt-20">
          <div ref={hostRef} {...pauseProps} className="relative">
            {/* Viewport clips the off-screen slides horizontally; overflow-x
                CLIP (not hidden) keeps vertical shadows + the open cover from
                being cut. */}
            <div className="overflow-x-clip">
              <div
                className={`flex ${reduced ? '' : 'transition-transform duration-500 ease-out'}`}
                style={{
                  transform: `translateX(-${idx * 100}%)`,
                  // Browser owns vertical scroll; horizontal is ours to swipe.
                  touchAction: many ? 'pan-y' : undefined,
                }}
                onTouchStart={many ? onTouchStart : undefined}
                onTouchEnd={many ? onTouchEnd : undefined}
              >
                {PROOF_EXAMPLES.map((example, i) => (
                  <div key={example.id} className="w-full shrink-0 px-1" aria-hidden={i !== idx}>
                    {/* Mobile stacks: items-start so the recipe's left edge
                        matches the heading/body column above (the card gets
                        self-center to stay optically centred). Desktop
                        (md+) switches items-center back to its real job —
                        vertical centring of the two columns. */}
                    <div className="mx-auto flex max-w-5xl flex-col items-start justify-center gap-16 md:flex-row md:items-center md:gap-16">
                      {/* The recipe — photo + the three text boxes. Nudged up
                          32px on desktop so it centres on the CARD, not the
                          taller card+hint column (transform keeps the dots
                          spacing below untouched). */}
                      <div className="flex w-full max-w-[320px] shrink-0 flex-col gap-3 text-left md:-translate-y-8">
                        <div className="flex items-center gap-3">
                          <div className="flex h-[70px] w-[70px] shrink-0 items-center justify-center rounded-xl border-[1.5px] border-dashed border-keeper-stone/35 bg-white p-1">
                            <img
                              src={example.sourcePhoto}
                              alt={example.sourceAlt}
                              loading="lazy"
                              className="h-full w-full rounded-lg object-cover"
                            />
                          </div>
                          <div>
                            <div className="text-[15px] font-medium text-keeper-ink">Upload a photo</div>
                            <div className="text-[12.5px] text-keeper-meta">featuring the person you love</div>
                          </div>
                        </div>
                        {field(Mountain, 'The scene', example.scene)}
                        {field(Type, 'Front text', example.frontText)}
                        {field(PenLine, 'Inside message', example.insideMessage)}
                      </div>

                      {/* The card it produced — tap to open, with the hint
                          tucked right beneath it (hero-style). z-20 so the
                          swung cover overlaps the inputs on its way left. */}
                      <div className="flex shrink-0 flex-col items-center self-center md:self-auto">
                        <div className="relative z-20 h-[288px] w-[288px] sm:h-[360px] sm:w-[360px]">
                          <button
                            type="button"
                            onClick={() => i === idx && setCardOpen((o) => !o)}
                            aria-label={cardOpen ? 'Close card' : 'Open card'}
                            tabIndex={i === idx ? 0 : -1}
                            className="relative block h-full w-full"
                          >
                            <CssAjarCard
                              frontUrl={example.cardFront}
                              insideUrl={example.cardInside}
                              open={i === idx && cardOpen}
                            />
                          </button>
                        </div>
                        <div className="mt-3 flex h-8 items-start justify-center sm:mt-8">
                          {i === idx && (
                            <GestureHints open={cardOpen} hideZoomHint hideRotateHint openLabel="Tap to close" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quiet edge arrows flanking the slider. */}
            {many && (
              <>
                <button
                  type="button"
                  onClick={() => userGoTo(prevIdx)}
                  aria-label="Previous example"
                  className="absolute -left-4 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-cta-light text-cta-dark ring-1 ring-cta-dark/10 backdrop-blur-sm transition-colors hover:bg-cta hover:text-white sm:left-0"
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => userGoTo(nextIdx)}
                  aria-label="Next example"
                  className="absolute -right-4 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-cta-light text-cta-dark ring-1 ring-cta-dark/10 backdrop-blur-sm transition-colors hover:bg-cta hover:text-white sm:right-0"
                >
                  <ChevronRight className="h-5 w-5" strokeWidth={2} />
                </button>
              </>
            )}
          </div>

          {/* Pill pager — same treatment as the studio's hero switcher and
              the Inside section: long pill for the current example, dots
              for the rest. */}
          {many && (
            <div
              role="tablist"
              aria-label="Switch example"
              className="mt-16 flex items-center justify-center gap-1.5"
            >
              {PROOF_EXAMPLES.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  role="tab"
                  aria-selected={i === idx}
                  onClick={() => userGoTo(i)}
                  aria-label={`Example ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all ${
                    i === idx
                      ? 'w-6 bg-brand-dark'
                      : 'w-1.5 bg-keeper-hair hover:bg-keeper-meta/50'
                  }`}
                />
              ))}
            </div>
          )}
        </Rise>
        {/* A button after the proof (2026-11-11): most of the page had none. */}
        <div className="mt-10 text-center md:mt-12">
          <PrimaryCta />
        </div>
      </div>
    </section>
  );
}

// ── 2b. THE INSIDE ───────────────────────────────────────────────────
// "The magic's digital. The card isn't." Lives in
// components/landing/inside-section.tsx since 2026-10-09 (shared with
// /create), CardPair and the two lifestyle shots with it.

// ── 3. THE HANDOVER ──────────────────────────────────────────────────
// "Send direct. Or receive it yourself, to hand over." Lives in
// components/landing/handover-section.tsx since 2026-10-09 — /create
// carries the same section, so it had to leave this page.

// ── 4. REAL STORIES — components/landing/real-stories-section.tsx ──
// The six-tile gallery wall that was parked here (placeholder fronts,
// HIDE_GALLERY) was replaced 2026-10-31 by one real card told in full,
// linking to /gallery. AjarTile below stays for the carousel's trick.

// ── 5. THE OBJECT ────────────────────────────────────────────────────

function ObjectSection() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.15fr_0.85fr] md:gap-16">
        <Rise>
          <AssetSlot
            tag="E"
            ratio="3/2"
            note="Macro photo — hands holding the printed card, gloss catching light, the face visible. Shot from the real Prodigi test print."
          />
        </Rise>
        <Rise delay={0.1}>
          <h2 className={`text-[clamp(30px,4.4vw,44px)] leading-[1.08] ${DISPLAY}`}>
            Made to be kept.
          </h2>
          <ul className="mt-6 space-y-2 text-[16px] text-keeper-ink">
            <li>✓ 280gsm gloss art card, HP Indigo press</li>
            <li>✓ Kraft envelope, recyclable materials</li>
            <li>✓ Printed in {copyFor().country}</li>
          </ul>
          <p className="mt-6 border-l-2 border-keeper-hair pl-4 text-[13.5px] leading-relaxed text-keeper-meta">
            Our cards are one-off prints, made just for them, so please allow at
            least a week from order to arrival. {copyFor().za ? 'Sent by courier' : 'Posted Royal Mail 24, tracked,'}{' '}
            for {formatMoney(shippingPrice())}.
          </p>
          <p className="mt-4 font-mono text-[12px] text-keeper-meta">
            Today you make it → printed once, just for them → {copyFor().za ? copyFor().shipPhrase : 'posted Royal Mail 24'} · allow a week
          </p>
          {/* The "Straight to them / Or to you first" pair used to sit here
              as two 13px cards. It's now its own section (HandoverSection)
              where it can carry icons + shots — saying it in both places
              would spend the point twice. */}
        </Rise>
      </div>
    </section>
  );
}

// ── 7. PRICE ─────────────────────────────────────────────────────────

function PriceSection() {
  // The launch offer (2026-11-06): the first card on us while it's open.
  const onUs = useFirstCardOnUs();
  return (
    <section id="price" className="scroll-mt-32 px-6 py-16 md:pb-32 md:pt-16">
      {/* White panel (variation pass 2026-11-11): the offer is the one
          block on the page that should read as an object, not more page. */}
      <div className="mx-auto max-w-3xl rounded-[32px] border border-keeper-hair bg-white px-6 py-14 text-center shadow-[0_30px_80px_-40px_rgba(33,29,25,0.35)] sm:px-12 md:py-16">
        <Rise>
          {/* THE OFFER HERE IS THE ONE CHECKOUT APPLIES. This block sold a
              FREE first card ("just pay £2.95 postage") until 2026-10-06,
              two screens below three banners stating the real offer — and
              checkout only ever applies firstOrderPriceGBP, which is 50%.
              A visitor promised free and charged £3.49 is a complaint and
              an ASA-upholdable claim. The numbers come from shared/pricing
              now, so this line cannot drift from the bill again.
              Still no "limited time" — there is no end date, and a
              perpetual urgency claim is the kind the ASA upholds against. */}
          <p className="font-mono text-[12px] uppercase tracking-[0.18em] text-keeper-meta">
            {onUs ? 'Your first card’s on us. Seriously.' : 'Half price on your first card'}
          </p>
          <div className="mt-2 flex items-baseline justify-center gap-4">
            <span className={`text-[clamp(56px,9vw,96px)] ${DISPLAY}`}>
              {onUs ? 'Free' : formatMoney(firstOrderPrice('photo'))}
            </span>
            <span className="text-[clamp(22px,3.4vw,34px)] text-keeper-meta">
              <span className="sr-only">Normally </span>
              <s>{formatMoney(cardPrice('photo'))}</s>
            </span>
          </div>
          <p className="mx-auto mt-3 max-w-[56ch] text-[17px] leading-[1.6] text-keeper-body">
            When you save three dates that matter. {onUs ? 'Just' : 'Plus'} {formatMoney(shippingPrice())} standard
            postage. One per account{onUs ? ' and address, UK only' : ''}; after that, photo cards
            are {formatMoney(cardPrice('photo'))} plus postage. Make and preview as many as you like for free.
            You only pay when you post one. Our cards are one-off prints, so please allow at least
            a week from order to arrival.
          </p>
          <div className="mt-8">
            <PrimaryCta large />
          </div>
          <TrustChips center />
        </Rise>
      </div>
    </section>
  );
}

// ── OCCASION CAPTURE — "Whose birthday's next?" ─────────────────────
// Two-speed lead capture (Kevin 2026-07-08, built pre-launch on his
// call): email REQUIRED, name + date OPTIONAL — skipping the date
// still captures the lead and still teaches that reminders exist.
// A date makes the lead nudgeable (stored on marketing_leads;
// the scheduled nudge email is a post-launch job — the setup email
// makes the promise either way).
function OccasionCaptureSection() {
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | 'dated' | 'plain'>(null);
  // Reminders are optional + tucked behind a toggle (Kevin 2026-07-22) —
  // the main form is just name + email; expand to add an occasion (whose +
  // what + when). A date is what makes it nudgeable.
  const [showReminder, setShowReminder] = useState(false);
  const [whose, setWhose] = useState('');
  const [occasionType, setOccasionType] = useState('');
  const hasReminder = showReminder && !!date;

  const submit = async () => {
    if (busy || sent) return;
    setBusy(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: hasReminder ? 'keeper-occasion' : 'keeper-plain',
          // On a reminder it's whose-celebration; otherwise the lead's own
          // name (falls back to the lead's name if "whose" is blank).
          recipientName: (hasReminder ? whose || name : name) || undefined,
          occasionType: hasReminder ? occasionType || undefined : undefined,
          occasionDate: hasReminder ? date : undefined,
          marketingOptIn: optIn,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? 'Please try again.');
      }
      setSent(hasReminder ? 'dated' : 'plain');
    } catch {
      setSent(null);
    } finally {
      setBusy(false);
    }
  };

  // Shared field style — white field on the violet card, violet focus.
  const capInput =
    'h-12 w-full min-w-0 rounded-xl border border-[#cfcbee] bg-white px-4 text-sm text-keeper-ink shadow-sm placeholder:text-keeper-meta focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark/20';

  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-xl">
        <Rise>
          {/* Purple-tinted capture card — the LP's lead-capture moment,
              given prominence + brand-purple hierarchy (Kevin 2026-07-11):
              soft violet tint, a purple accent rule up top, purple in the
              headline + on the action. */}
          {/* Lead-capture card — OG light violet, with an email icon +
              black headline for cleaner hierarchy (Kevin 2026-07-22). */}
          <div
            className="rounded-[24px] border border-brand-light bg-brand-muted px-6 py-10 text-center sm:px-10"
            style={{
              borderTop: '3px solid #5c57d4',
              boxShadow: '0 22px 44px -26px rgba(92,87,212,0.32)',
            }}
          >
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-brand-dark shadow-sm">
              <Mail className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
            </span>
            <h2 className={`text-[clamp(27px,3.6vw,36px)] leading-[1.08] text-keeper-ink ${DISPLAY}`}>
              Not quite ready?
            </h2>
            <p className="mx-auto mt-3 max-w-[48ch] text-[15px] leading-[1.55] text-keeper-body">
              Stick your name and email address in below to join Celebrait. You
              can also include a day of celebration in the future so we can
              remind you to create a card closer to the time.
            </p>

            <div className="mt-7">
          {sent ? (
            <div
              className="mx-auto max-w-md rounded-2xl border border-keeper-hair bg-white/80 p-6"
              data-testid="occasion-captured"
            >
              <p className="text-[15px] font-semibold text-keeper-ink">
                {sent === 'dated'
                  ? "Done. We'll nudge you in good time. ✨"
                  : "Done. The link's in your inbox. ✨"}
              </p>
              <p className="mt-1 text-[12.5px] text-keeper-meta">
                {sent === 'dated'
                  ? 'Your link is in your inbox meanwhile, whenever you fancy a look.'
                  : 'Whenever the moment comes, it takes 7–10 minutes.'}
              </p>
            </div>
          ) : (
            <form
              className="mx-auto max-w-md"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
              data-testid="occasion-capture-form"
            >
              {/* Main capture — just name + email. */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={capInput}
                  data-testid="input-occasion-name"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className={capInput}
                  data-testid="input-occasion-email"
                />
              </div>

              {/* Optional: add a reminder for a birthday/occasion. */}
              <button
                type="button"
                onClick={() => setShowReminder((v) => !v)}
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-dark transition-colors hover:text-brand"
                aria-expanded={showReminder}
                data-testid="toggle-occasion-reminder"
              >
                <Bell className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                Remind me before a birthday or date
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${showReminder ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
              {showReminder && (
                <div className="mt-2.5 space-y-2 text-left">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      value={occasionType}
                      onChange={(e) => setOccasionType(e.target.value)}
                      aria-label="What are we celebrating?"
                      className={`${capInput} ${occasionType ? '' : 'text-keeper-meta'}`}
                      data-testid="select-occasion-type"
                    >
                      <option value="">What's the occasion?</option>
                      <option>Birthday</option>
                      <option>Anniversary</option>
                      <option>Wedding</option>
                      <option>New baby</option>
                      <option>Christmas</option>
                      <option>Valentine's</option>
                      <option>Mother's Day</option>
                      <option>Father's Day</option>
                      <option>Something else</option>
                    </select>
                    <input
                      type="text"
                      value={whose}
                      onChange={(e) => setWhose(e.target.value)}
                      placeholder="Whose is it? (optional)"
                      className={capInput}
                      data-testid="input-occasion-whose"
                    />
                  </div>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    aria-label="The date"
                    className={capInput}
                    data-testid="input-occasion-date"
                  />
                  <p className="text-[11.5px] leading-snug text-keeper-meta">
                    Add the date and we'll email you in good time. No forgetting,
                    no last-minute panic.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="mt-3 h-12 w-full rounded-full bg-go px-6 text-[14px] font-semibold text-go-foreground transition-colors hover:bg-go-hover disabled:opacity-50"
                data-testid="btn-occasion-submit"
              >
                {busy ? 'One sec…' : hasReminder ? 'Set my reminder' : 'Email me the link'}
              </button>

              <label className="mx-auto mt-3 flex max-w-md cursor-pointer items-start gap-2 text-left">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-keeper-hair accent-[#5c57d4]"
                  data-testid="check-occasion-optin"
                />
                <span className="text-[11.5px] leading-snug text-keeper-meta">
                  Keep me posted now and then with new features and ideas.
                  Unsubscribe anytime.
                </span>
              </label>
              <p className="mt-2 text-[10.5px] text-keeper-meta/80">
                {hasReminder
                  ? 'One nudge before the day + your link now. No spam, ever.'
                  : "We'll send your link straight away. No spam, ever."}
              </p>
            </form>
          )}
            </div>
          </div>
        </Rise>
      </div>
    </section>
  );
}

// ── Floating CTA pill ────────────────────────────────────────────────
// FloatingPill (bottom-right make-your-own CTA) removed 2026-08-03 —
// replaced by FreeCardInvite's "First card on us" pill (Kevin).

// ── Page ─────────────────────────────────────────────────────────────

export default function LandingKeeper() {
  // Beta testers (2026-11-05: "no links to main site"): the page is the
  // photo route's front door and nothing else — no stories link, no
  // 3-dates offer, no first-order price, no invite modal.
  const beta = useBetaMinimalChrome();
  // (Hero imagery preloading moved to index.html <link rel="preload">
  // — the JS-side version here couldn't start until the bundle ran,
  // which was exactly the delay it was trying to hide. crossOrigin
  // still must match three.js's anonymous texture loads everywhere.)

  return (
    // overflow-x-clip: the hero card's bleed wrapper (inset-[-24%])
    // pokes past the viewport on mobile and made the whole page pan
    // sideways. Clip (not hidden) so no scroll container is created.
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      {/* Floating celebration icons — Kevin's call. The page paints NO
          opaque background (that's what hid them before); the backdrop
          supplies the warm-paper tint behind its icon field. */}
      <CelebrationBackdrop
        background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)"
        permanentFade
        fadeOutAfterHero
      />
      <KeeperHeader />
      <main className="pt-32">
        <HeroSection />
        {/* The three steps the hero names, shown (Aidan 2026-10-11). */}
        <HowItWorksSection door="photo" pairedBelow cta={<PrimaryCta />} />
        {/* The scenes row replaced the one-card carousel here (2026-11-11);
            ProofSection is kept in this file for a swap back. */}
        <ScenesRowSection />
        {/* One card told in full, linking to /gallery (2026-10-31). */}
        {/* THE INSIDE ("The magic's digital. The card isn't.") moved above
            Real stories (Aidan 2026-11-10): the claim, then the story that
            proves it. */}
        {/* Variation pass (2026-11-11): the page was nine sections on one
            unbroken paper ground. This one gets a full-bleed violet-tint
            band with hairline edges, and carries the mid-page button —
            five sections in a row had none. */}
        <div className="border-y border-brand/15 bg-brand-muted" data-testid="band-inside">
          <InsideSection />
          <div className="-mt-4 px-6 pb-14 text-center md:-mt-14 md:pb-24">
            <PrimaryCta large />
            <p className="mt-3 text-[12px] text-keeper-meta">
              Free to make. No payment details needed.
            </p>
          </div>
        </div>
        {/* RealStoriesSection removed from /photo (Aidan 2026-11-11): the
            hero's "Read the stories" link goes to /stories instead. */}
        {/* ImagineDescribeShipSection ("Imagine it. Describe it. Send it.")
            removed 2026-11-12 (Aidan). Its whole content was the BRAINSTORM
            CHAT, on a phone and in the line "brainstorm with us" — and the
            chat is signed-in only (decision of 2026-09-04, reaffirmed
            today), while the page's main button goes to the signed-out
            maker. The page was promising something a new visitor can't
            find. Component kept in components/landing for the studio's
            own use or a later return. */}
        {/* What took its place (2026-11-12, third build): a short film in
            a phone — a few words → three scenes → one picked → a real
            card. Not interactive. History in the component's header. */}
        <SceneIdeasSection cta={<PrimaryCta />} />
        <HandoverSection />
        {/* ObjectSection ("Made to be kept") removed 2026-07-24 — its macro
            shot is an unfilled Prodigi-test-print placeholder and its specs
            already live in FAQ / pricing / the header banner. The function
            is kept below, ready to re-add once the real print photo exists. */}
        {/* OccasionCaptureSection (email lead form) replaced 2026-08-04 by
            the Occasions promo — the free-card mechanic is the same capture
            play with a real account + three dates instead of a lone email.
            Function preserved below for re-add if ever wanted. */}
        {!beta && <OccasionsPromoSection />}
        {/* DemoVideoSection removed 2026-07-24 (Kevin). Component preserved
            for easy re-add. */}
        {!beta && <PriceSection />}
        <FaqSection />
      </main>
      <MarketingFooter />
      {/* Free-first-card capture — auto-shows once, then a bottom-right
          pill (replaced the old make-your-own FloatingPill, Kevin
          2026-08-03). Signed-in visitors see none of it (they have the
          world band; the header CTA still covers "make a card"). */}
      {!beta && <FreeCardInvite />}
    </div>
  );
}
