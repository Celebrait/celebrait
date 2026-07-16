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
import { Link } from 'wouter';
import {
  Mail,
  RefreshCw,
  Send,
  Truck,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Mountain,
  Type,
  PenLine,
  type LucideIcon,
} from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { WhatsNewDrawer } from '@/components/studio/whats-new-drawer';
import celebraitLogo from '@/assets/celebrait.png';
import { FaqSection } from '@/components/landing/faq-section';
import { DemoVideoSection } from '@/components/landing/demo-video-section';
import { ImagineDescribeShipSection } from '@/components/landing/imagine-describe-ship-section';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { GestureHints } from '@/components/gesture-hints';
// Hero art lives in client/public (NOT bundled assets) so index.html
// can <link rel="preload"> it — the download starts in parallel with
// the JS bundle instead of after it. On prod that parallel start is
// most of the fix for the white-card beat Kevin screenshotted.
const heroCardFront = '/hero-card-front.webp';
const heroCardInside = '/hero-card-inside.webp';
// Panel C lifestyle shots — same scene, front card + open card — crossfaded.
const keeperCardClosed = '/keeper-card-closed.webp';
const keeperCardOpen = '/keeper-card-open.webp';
// Proof section ("Greetings cards used to be boring") — the REAL worked
// example, so the recipe and the result are the same card end to end:
// this selfie of Mum + "Gazing at the Northern Lights" + "Happy 60th, Mum"
// really did produce this front, and the inside message really is the
// typography on the inside (Kevin's own gen, 2026-07-14).
const proofSourcePhoto = '/proof-source-photo.webp';
const proofCardFront = '/proof-card-front.webp';
const proofCardInside = '/proof-card-inside.webp';
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

const EASE = [0.22, 1, 0.36, 1] as const;
// Fraunces Bold for every display headline (Kevin 2026-07-04). Serif
// wants gentler negative tracking than the grotesque did.
const DISPLAY = 'font-display font-bold tracking-[-0.015em] text-keeper-ink';

function Rise({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
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

/** The "Unbinnable" shimmer — the one glow treatment on this page.
 *  Gradient-clipped text that runs BLACK through PURPLE and back to
 *  black, with the violet wave sweeping left-to-right every ~8s.
 *
 *  Lives here as ONE component because two headlines wear it — the hero's
 *  rotating persona ("your best mate") and the proof heading's "used" — and
 *  Kevin's call is that they must match exactly (2026-07-14). Defining the
 *  gradient twice is how they'd silently drift apart. Still under
 *  prefers-reduced-motion: the ink-to-violet gradient stays, the wave stops.
 */
function ShimmerWord({
  children,
  reduced,
}: {
  children: string;
  reduced: boolean;
}) {
  return (
    <motion.span
      className="inline-block overflow-visible bg-clip-text px-1 pb-[0.12em] text-transparent"
      style={{
        backgroundImage:
          'linear-gradient(90deg, #211D19 0%, #211D19 30%, #7a76e8 45%, #5c57d4 50%, #7a76e8 55%, #211D19 70%, #211D19 100%)',
        backgroundSize: '220% 100%',
        backgroundRepeat: 'no-repeat',
      }}
      initial={{ backgroundPosition: '0% 0%' }}
      animate={reduced ? undefined : { backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }}
      transition={
        reduced
          ? undefined
          : {
              duration: 4,
              repeat: Infinity,
              repeatDelay: 4.5,
              ease: 'easeInOut',
              delay: 0.8,
              times: [0, 0.5, 1],
            }
      }
    >
      {children}
    </motion.span>
  );
}

/** Two lifestyle photos — the front card and the open inside — sat
 *  straight, close but NOT overlapping (Kevin 2026-07-11). Stacked and
 *  staggered off-centre at every width: first hugs left, second hugs
 *  right, so it reads casual rather than dead-centred. */
function CardPair({
  first,
  second,
  alt,
}: {
  first: string;
  second: string;
  alt: string;
}) {
  // Corner radius matches the 3D card's, so the photographed card and the
  // rendered one read as the same object (Kevin 2026-07-14). The viewer
  // rounds by CARD_CORNER/CARD_W = 0.025/1.45 ≈ 1.7% of the card's width;
  // at the hero's ~433px on-screen card that's ~7.5px, and 1.7% of these
  // ~490px images is ~8.4px — so 8px lands on both the absolute and the
  // proportional match. (Was rounded-2xl = 16px: twice as round.)
  const img =
    'w-[92%] sm:w-[55%] rounded-[8px] shadow-[0_18px_42px_-22px_rgba(33,29,25,0.42)] ring-1 ring-black/5';
  return (
    <div className="flex flex-col gap-5">
      <img src={first} alt="" loading="lazy" className={`${img} self-start`} />
      <img src={second} alt={alt} loading="lazy" className={`${img} self-end`} />
    </div>
  );
}

function PrimaryCta({ large = false }: { large?: boolean }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const authed = !isLoading && isAuthenticated;
  const cls = `inline-flex items-center justify-center rounded-full bg-keeper-ink font-semibold text-keeper-paper transition-colors hover:bg-black ${
    large ? 'px-9 py-4 text-base' : 'px-7 py-3 text-[15px]'
  }`;
  return authed ? (
    <Link href="/studio/new-card" className={cls} data-testid="keeper-cta">
      Make a card — it's free
    </Link>
  ) : (
    <button type="button" onClick={() => openAuth('/studio/new-card')} className={cls} data-testid="keeper-cta">
      Make a card — it's free
    </button>
  );
}

// Chips carry lil icons (Kevin 2026-07-05); the privacy chip swapped
// for the deliver-your-way promise.
const TRUST_CHIPS = [
  { icon: RefreshCw, label: "Don't love it? A fresh take is free" },
  { icon: Mail, label: '280gsm · kraft envelope · printed in the UK' },
  { icon: Truck, label: 'Straight to them — or to you to hand over' },
] as const;

function TrustChips({ center = false }: { center?: boolean }) {
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
        {/* CSS-posed stand-in — covers chunk load, GL init AND texture
            upload; fades only when the engine reports its first
            painted frame. Crucially it's NOT a flat image: it mimics
            the 3D card's rest pose (yaw -0.12 rad ≈ -7°, cover ajar
            -0.55 rad ≈ -31°, white body behind) so the handover reads
            as the same card gaining depth, not a snap between two
            different objects. */}
        <div
          className={`pointer-events-none absolute left-[36%] top-[21%] w-[27%] transition-opacity duration-700 ${
            engineReady ? 'opacity-0' : 'opacity-100'
          }`}
          style={{ perspective: '1400px' }}
        >
          <div
            className="relative"
            style={{
              aspectRatio: '1/1',
              transform: 'rotateY(-7deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Cover ONLY — front art hinged at the spine, resting
                ajar, LQIP behind the img so it's never blank. NO white
                body layer behind it: a flat white square peeking out
                around the art read as a "white flash in the bg" while
                the engine loaded (Kevin). The 3D card introduces its
                body sliver itself when it takes over. */}
            <div
              className="absolute inset-0 overflow-hidden rounded-xl shadow-[0_28px_60px_-24px_rgba(33,29,25,0.35)]"
              style={{
                transformOrigin: 'left center',
                transform: 'rotateY(-31deg)',
                backfaceVisibility: 'hidden',
                backgroundImage: `url(${HERO_FRONT_LQIP})`,
                backgroundSize: 'cover',
              }}
            >
              <img
                src={heroCardFront}
                crossOrigin="anonymous"
                alt="Celebrait card"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
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
function AjarTile({
  tag,
  what,
  open,
  onToggle,
}: {
  tag: string;
  what: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative block w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-keeper-gold rounded-2xl ${open ? 'z-20' : 'z-0'}`}
      style={{ aspectRatio: '1/1' }}
      data-testid={`gallery-card-${tag}`}
      aria-label={`${what} — ${open ? 'tap to close' : 'tap to open'} the card`}
    >
      <div className="absolute inset-[6%]" style={{ perspective: '1100px' }}>
        {/* Inside page (right-hand spread) */}
        <div className="absolute inset-0 overflow-hidden rounded-[6px] bg-white shadow-[0_20px_44px_-20px_rgba(33,29,25,0.35)]">
          <img src={heroCardInside}
                crossOrigin="anonymous" alt="" className="h-full w-full object-cover" />
          {/* Soft spine shadow so the inside reads as a page, not a print */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-[18%]"
            style={{ background: 'linear-gradient(90deg, rgba(33,29,25,0.18), transparent)' }}
          />
        </div>
        {/* Cover — hinged on the left edge. Rests slightly ajar (-14°),
            springs to open (-152°). The paper spring: soft stiffness,
            a touch underdamped so it settles like card stock. */}
        <motion.div
          className="absolute inset-0"
          style={{ transformStyle: 'preserve-3d', transformOrigin: 'left center' }}
          initial={false}
          animate={{ rotateY: open ? -152 : -22 }}
          transition={{ type: 'spring', stiffness: 65, damping: 13, mass: 0.9 }}
        >
          {/* Front face */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[6px] shadow-[0_10px_26px_-12px_rgba(33,29,25,0.4)]"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <img src={heroCardFront}
                crossOrigin="anonymous" alt="" className="h-full w-full object-cover" />
          </div>
          {/* Inside-left (back of the cover) — white stock + celebrait
              wordmark small at bottom-centre, matching the 3D render. */}
          <div
            className="absolute inset-0 flex items-end justify-center rounded-[6px] border border-stone-200/60 bg-white pb-[10%]"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          >
            <img src={celebraitLogo} alt="" className="w-[27%] opacity-70" />
          </div>
        </motion.div>
      </div>
      <span className="absolute left-2 top-2 rounded bg-keeper-gold-wash/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-keeper-gold">
        {tag}
      </span>
      <span className="absolute bottom-2 right-2 rounded-full bg-white/90 px-2.5 py-1 text-[10px] text-keeper-meta">
        {open ? 'tap to close' : 'tap to open'}
      </span>
    </button>
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

// ── 0. HEADER — floating pill nav (memorae-style, Kevin 2026-07-05) ──
//
// A single rounded capsule floating over the page instead of a
// full-width bar: warm glass (paper tint + blur) so the celebration
// backdrop reads through it, hairline border, ink CTA. Scoped to
// /keeper until Kevin approves it for the rest of the site.

const NAV_LINKS = [
  { label: 'The proof', id: 'proof' },
  { label: 'Examples', id: 'gallery' },
  { label: 'Pricing', id: 'price' },
] as const;

function KeeperHeader() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[150]">
      {/* Production-promise banner — brand violet → CTA green (Kevin
          2026-07-05). Same 72h copy the ValueStrip carried mid-page;
          it lives up here now instead. */}
      <div
        className="pointer-events-auto flex h-10 items-center justify-center px-4 text-center font-sans text-[11.5px] font-medium text-white sm:text-[12.5px]"
        style={{
          // Kevin's final call (after five steps down the gradient
          // ladder): ink black sweeping into the brand purple, left to
          // right — the logo's own two colours — white copy on top.
          background: 'linear-gradient(90deg, #211D19 0%, #5c57d4 100%)',
        }}
      >
        <span className="sm:hidden">
          Printed to order in 72 hrs — £8.99 + delivery.
        </span>
        <span className="hidden sm:inline">
          Every card is printed to order, just for them — allow up to 72 hrs,
          then posted. £8.99 + delivery.
        </span>
        <Send className="ml-2 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      </div>
      <div className="px-4 pt-5">
      <header className="pointer-events-auto mx-auto flex h-14 w-full max-w-3xl items-center justify-between rounded-full border border-keeper-hair bg-white/75 pl-4 pr-1.5 shadow-[0_12px_40px_-18px_rgba(33,29,25,0.35)] backdrop-blur-md sm:pl-5 sm:pr-2">
        <Link href="/" className="flex items-center" aria-label="Celebrait home">
          <img src={celebraitLogo} alt="Celebrait" className="h-8 w-auto sm:h-9" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => jump(l.id)}
              className="text-[13px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink"
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <WhatsNewDrawer />
          {!isLoading && isAuthenticated ? (
            <Link href="/studio">
              <button
                type="button"
                className="h-10 rounded-full bg-keeper-ink px-4 text-[13px] font-semibold text-keeper-paper transition-colors hover:bg-black sm:px-5"
              >
                <span className="sm:hidden">My studio</span>
                <span className="hidden sm:inline">Open my studio</span>
              </button>
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openAuth('/studio')}
                className="hidden px-2 text-[13px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink sm:block"
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => openAuth('/studio/new-card')}
                className="h-10 rounded-full bg-keeper-ink px-4 text-[13px] font-semibold text-keeper-paper transition-colors hover:bg-black sm:px-5"
              >
                <span className="sm:hidden">Make a card</span>
                <span className="hidden sm:inline">Make my first card</span>
              </button>
            </>
          )}
        </div>
      </header>
      </div>
    </div>
  );
}

// ── 1. HERO — The Transformation ─────────────────────────────────────

// Always 'your SOMETHING' (Kevin's rule) — and short enough that the
// persona line never wraps at any breakpoint.
const PERSONAS = ['your mum', 'your best mate', 'your grandad', 'your sister'];

function HeroSection() {
  const reduced = useReducedMotion();
  const [persona, setPersona] = useState(0);
  const [visible, setVisible] = useState(true);
  // Card open state lives here (viewer self-manages the hinge; this
  // mirror drives the snapshot fade + the tap hint).
  const [cardOpen, setCardOpen] = useState(false);
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
              setPersona((p) => (p + 1) % PERSONAS.length);
              setVisible(true);
            }, 260);
          }, 3500);
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
    <section ref={sectionRef} className="px-6 pb-20 pt-10 md:pb-28 md:pt-20">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.05fr_0.95fr] md:gap-16">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">
            Unbinnable Greetings Cards
          </p>
          {/* STRUCTURAL three lines (Kevin's rule: "ALWAYS flows 3 lines
              on desktop and mobile"): Put / your-something / in the
              picture. The persona line is nowrap and every persona is
              short enough to fit at all breakpoints — the layout can
              never reflow, so the 3D card column never moves. */}
          <h1
            className={`mt-4 text-[clamp(44px,7vw,74px)] leading-[1.04] ${DISPLAY}`}
          >
            Put
            <br />
            <span
              className="inline-block whitespace-nowrap transition-opacity duration-300"
              style={{ opacity: visible ? 1 : 0 }}
            >
              <ShimmerWord reduced={!!reduced}>{PERSONAS[persona]}</ShimmerWord>
            </span>
            <br />
            in the picture.
          </h1>
          {/* The recipe in one line — three beats joined by purple (brand)
              arrows, then the payoff. Inline reads as a single flow rather
              than a choppy stacked list (Kevin 2026-07-14). Wraps gracefully
              on narrow columns without ever orphaning an arrow (arrows are
              glued to the step before them). */}
          <div className="mt-6 max-w-[30rem]">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[17px] font-medium text-keeper-ink">
              <span className="whitespace-nowrap">
                Choose your photo
                <ArrowRight className="mb-0.5 ml-2 inline h-4 w-4 text-brand-dark" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="whitespace-nowrap">
                Describe the scene
                <ArrowRight className="mb-0.5 ml-2 inline h-4 w-4 text-brand-dark" strokeWidth={2.25} aria-hidden="true" />
              </span>
              <span className="whitespace-nowrap">Craft your message</span>
            </div>
            <p className="mt-3 text-[16px] leading-[1.6] text-keeper-body">
              The result? A close to perfect greetings card they'll{' '}
              <span className="font-medium text-keeper-ink">probably keep</span> from just
              £8.99. From idea to production in just 5 minutes*
            </p>
            {/* The wink — the asterisk is the joke, so keep it quiet and
                right under the claim it qualifies. */}
            <p className="mt-1.5 text-[12px] leading-snug text-keeper-meta">
              *Possible, but you might prefer to take longer
            </p>
          </div>
          <div className="mt-8">
            <PrimaryCta large />
            <p className="mt-3 text-[12px] text-keeper-meta">
              Free to make. No payment details needed.
            </p>
          </div>
          <TrustChips />
        </div>

        {/* The real 3D card, ajar + CLICKABLE (Kevin 2026-07-05) — tap
            swings it open, the source snapshot fades out (its job is
            done once the card takes over), green tap hint underneath.
            Snapshot STAND-IN: a crop of the card art itself (it IS the
            same people). Swap for the real A2 snapshot when it exists. */}
        {/* z-10: the open cover swings LEFT over the text column —
            Kevin: let it cover that text (don't clip it). */}
        <Rise className="relative z-10">
          <StaticAjarCard open={cardOpen} onToggle={() => setCardOpen((o) => !o)} />
          <div
            className={`absolute -left-3 top-1 w-[27%] -rotate-6 transition-opacity duration-500 ${
              cardOpen ? 'pointer-events-none opacity-0' : 'opacity-100'
            }`}
          >
            <div
              className="relative overflow-hidden rounded-lg border-[6px] border-white bg-stone-100 shadow-[0_14px_32px_-12px_rgba(33,29,25,0.4)]"
              style={{ aspectRatio: '1/1' }}
            >
              <img
                src="/hero-source-photo.webp"
                alt="Source snapshot of the couple"
                className="h-full w-full object-cover"
                style={{ objectPosition: '50% 32%' }}
              />
            </div>
          </div>
          {/* Green tap/click hint — fades out once the card opens.
              FIXED-HEIGHT slot: the hints mount late + unmount on
              open; without a reserved height the column reflows and
              the card clunks down (same bug as the old landing). */}
          <div className="mt-7 h-14 sm:mt-3">
            <GestureHints
              open={cardOpen}
              hideRotateHint
              hideZoomHint
              openLabel="Tap to close"
            />
          </div>
        </Rise>
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
    'Sixty years and you still light up every room. Happy birthday, Mum — all my love.',
  cardFront: proofCardFront,
  cardInside: proofCardInside,
  cardAlt: 'The finished card front — Mum under the Northern Lights',
};

// Slides 2 + 3 are TEMPORARY placeholders so the carousel is live now (Kevin
// 2026-07-14). They reuse the Mum CARD IMAGE (only real asset we have) but
// carry different recipe TEXT so navigating visibly changes the "Made from"
// caption — proof the carousel moves. Replace each with a real generation
// (its own webp trio in /public + strings) and the cards differ too.
const PROOF_EXAMPLES: ProofExample[] = [
  MUM_EXAMPLE,
  {
    ...MUM_EXAMPLE,
    id: 'placeholder-bigben',
    scene: 'Abseiling off Big Ben',
    frontText: 'Happy 40th, Dave',
    insideMessage: "Forty floors up and still no fear of heights. Happy birthday, mate.",
  },
  {
    ...MUM_EXAMPLE,
    id: 'placeholder-rome',
    scene: 'Leading the Roman empire',
    frontText: 'Hail, Caesar!',
    insideMessage: 'To the emperor of the whole office — many happy returns.',
  },
];

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

  const field = (Icon: LucideIcon, label: string, value: string) => (
    <div className="rounded-xl border border-keeper-hair bg-white px-3.5 py-2.5">
      <div className="mb-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-stone-400">
        <Icon className="h-3 w-3 shrink-0 text-keeper-gold" aria-hidden="true" />
        {label}
      </div>
      <div className="text-[14px] leading-snug text-keeper-ink">{value}</div>
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

  // Horizontal swipe → change slide (mobile). A swipe on the card reads as a
  // drag by the viewer's 4px tap threshold, so it never also toggles open.
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: ReactTouchEvent) => {
    touchX.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    if (touchX.current == null || !many) return;
    const dx = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 45) goTo(dx < 0 ? idx + 1 : idx - 1);
  };

  return (
    <section id="proof" className="scroll-mt-32 px-6 py-24 md:py-32">
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
              <p className="mt-5 text-[17px] leading-[1.6] text-keeper-body">
                Best friend abseiling off Big Ben, mum under the Northern
                Lights, daughter going viral in Times Square: You describe the
                scene, we make it real. Then you write the front and the inside.
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
          <div className="relative">
            {/* Viewport clips the off-screen slides horizontally; overflow-x
                CLIP (not hidden) keeps vertical shadows + the open cover from
                being cut. */}
            <div className="overflow-x-clip">
              <div
                className={`flex ${reduced ? '' : 'transition-transform duration-500 ease-out'}`}
                style={{ transform: `translateX(-${idx * 100}%)` }}
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
                  onClick={() => goTo(prevIdx)}
                  aria-label="Previous example"
                  className="absolute -left-4 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-cta-light text-cta-dark ring-1 ring-cta-dark/10 backdrop-blur-sm transition-colors hover:bg-cta hover:text-white sm:left-0"
                >
                  <ChevronLeft className="h-5 w-5" strokeWidth={2} />
                </button>
                <button
                  type="button"
                  onClick={() => goTo(nextIdx)}
                  aria-label="Next example"
                  className="absolute -right-4 top-1/2 z-30 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-cta-light text-cta-dark ring-1 ring-cta-dark/10 backdrop-blur-sm transition-colors hover:bg-cta hover:text-white sm:right-0"
                >
                  <ChevronRight className="h-5 w-5" strokeWidth={2} />
                </button>
              </>
            )}
          </div>

          {/* Dots. */}
          {many && (
            <div className="mt-16 flex items-center justify-center gap-1.5">
              {PROOF_EXAMPLES.map((e, i) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => goTo(i)}
                  aria-label={`Example ${i + 1}`}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    i === idx ? 'bg-brand-dark' : 'bg-keeper-hair hover:bg-keeper-stone/50'
                  }`}
                />
              ))}
            </div>
          )}
        </Rise>
      </div>
    </section>
  );
}

// ── 2b. THE INSIDE ───────────────────────────────────────────────────

function InsideSection() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[0.85fr_1.15fr] md:gap-16">
        <Rise>
          {/* This section's job is the one thing the page never says outright:
              the digital process ends as a PHYSICAL object (the visual beside
              it is a real card on a table). The bin/keep beat belongs to the
              StatementSection right below ("the unbinnable kind"), so "keep"
              only lands here as the payoff — it doesn't steal that punch.
              NB: the old "in the card's own hand" implied handwriting; the
              inside is SET TYPE (see project_inside_message_is_typography). */}
          <h2 className={`text-[clamp(30px,4.4vw,44px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>
            The magic's digital. The card isn't.
          </h2>
          <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.6] text-keeper-body">
            Tell us what to write and we set it inside — lettering matched to
            the front, same palette, same brush. Then it's printed on 280gsm and
            posted: something real to hold, not a link to click. Or leave the
            inside blank and write it yourself.
          </p>
        </Rise>
        <Rise delay={0.1}>
          <CardPair
            first={keeperCardClosed}
            second={keeperCardOpen}
            alt="A Celebrait card on a table — the open inside message and the front"
          />
        </Rise>
      </div>
    </section>
  );
}

// ── 3. STATEMENT ─────────────────────────────────────────────────────

function StatementSection() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-6">
      <Rise className="text-center">
        <h2 className={`text-[clamp(38px,6vw,64px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>
          Everyone gets cards.
          <br />
          Nobody <em className="italic">gets</em> them.
        </h2>
        <p className="mt-5 text-[15px] text-keeper-body">This is the unbinnable kind.</p>
      </Rise>
    </section>
  );
}

// ── 4. RANGE — The gallery wall (every card clickable) ──────────────

const GALLERY: Array<{ tag: string; what: string; brief: string }> = [
  { tag: 'D1', what: "Kid's birthday", brief: '“Leo, 7, dinosaur mad”' },
  { tag: 'D2', what: 'Anniversary', brief: '“25 years since Positano”' },
  { tag: 'D3', what: 'New baby', brief: '“Welcome, little Ada”' },
  { tag: 'D4', what: 'Graduation', brief: '“Dr. Patel, at last”' },
  { tag: 'D5', what: "Father's Day", brief: '“Dad, 60, mad about fishing”' },
  { tag: 'D6', what: 'Retirement', brief: '“36 years of Mrs. H”' },
];

function GallerySection() {
  const [active, setActive] = useState<number | null>(null);
  return (
    <section id="gallery" className="scroll-mt-32 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Rise className="text-center">
          <h2 className={`text-[clamp(30px,4.4vw,44px)] leading-[1.08] ${DISPLAY}`}>
            Any face. Any occasion.
          </h2>
          <p className="mt-3 text-[15px] text-keeper-body">
            Made in the Studio this month — tap any card to open it.
          </p>
        </Rise>
        <div className="mt-12 grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-7">
          {GALLERY.map((g, i) => (
            <Rise key={g.tag} delay={i * 0.08}>
              <AjarTile
                tag={g.tag}
                what={g.what}
                open={active === i}
                onToggle={() => setActive(active === i ? null : i)}
              />
              <div className="mt-2 flex items-center gap-2">
                <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-keeper-hair bg-white/60" />
                <span className="text-[12px] text-keeper-meta">{g.brief}</span>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}

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
            <li>✓ Printed in the UK</li>
          </ul>
          <p className="mt-6 border-l-2 border-keeper-hair pl-4 text-[13.5px] leading-relaxed text-keeper-meta">
            Every card is printed to order, just for them — allow up to 72
            hours, then it's in the post. Standard £1.95 (Royal Mail 24) ·
            Express £5.95 · Overnight £10.95.
          </p>
          <p className="mt-4 font-mono text-[12px] text-keeper-meta">
            Today you make it → within 72 hrs it's printed → then posted from £1.95
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-keeper-hair bg-white/70 p-4">
              <p className="text-[13px] font-semibold text-keeper-ink">Straight to them</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-keeper-meta">
                Posted tracked in a kraft envelope, your message printed inside.
              </p>
            </div>
            <div className="rounded-xl border border-keeper-hair bg-white/70 p-4">
              <p className="text-[13px] font-semibold text-keeper-ink">Or to you first</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-keeper-meta">
                Sealed with a spare envelope, ready to hand over in person.
              </p>
            </div>
          </div>
        </Rise>
      </div>
    </section>
  );
}

// ── 7. PRICE ─────────────────────────────────────────────────────────

function PriceSection() {
  return (
    <section id="price" className="scroll-mt-32 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <Rise>
          <div className={`text-[clamp(56px,9vw,96px)] ${DISPLAY}`}>£8.99</div>
          <p className="mx-auto mt-3 max-w-[56ch] text-[17px] leading-[1.6] text-keeper-body">
            Printed, posted, and free to share. Make and preview unlimited
            cards free — pay only when you post one. Postage from £1.95 ·
            printed to order, allow up to 72 hours.
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

  const submit = async () => {
    if (busy || sent) return;
    setBusy(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: date ? 'keeper-occasion' : 'keeper-plain',
          recipientName: name || undefined,
          occasionDate: date || undefined,
          marketingOptIn: optIn,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? 'Please try again.');
      }
      setSent(date ? 'dated' : 'plain');
    } catch {
      setSent(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-xl">
        <Rise>
          {/* Purple-tinted capture card — the LP's lead-capture moment,
              given prominence + brand-purple hierarchy (Kevin 2026-07-11):
              soft violet tint, a purple accent rule up top, purple in the
              headline + on the action. */}
          <div
            className="rounded-[20px] border border-brand-light bg-brand-muted px-6 py-9 text-center sm:px-9"
            style={{
              borderTop: '3px solid #5c57d4',
              boxShadow: '0 22px 44px -26px rgba(92,87,212,0.32)',
            }}
          >
            <h2 className={`text-[clamp(27px,3.6vw,36px)] leading-[1.08] ${DISPLAY}`}>
              Whose birthday's <span className="text-brand-dark">next?</span>
            </h2>
            <p className="mx-auto mt-3 max-w-[42ch] text-[15px] leading-[1.55] text-keeper-body">
              Tell us the date and we'll nudge you in good time — with a card
              idea ready. Or skip the date and just take the link for later.
            </p>

            <div className="mt-7">
          {sent ? (
            <div
              className="mx-auto max-w-md rounded-2xl border border-keeper-hair bg-white/80 p-6"
              data-testid="occasion-captured"
            >
              <p className="text-[15px] font-semibold text-keeper-ink">
                {sent === 'dated'
                  ? "Done — we'll nudge you in good time. ✨"
                  : "Done — the link's in your inbox. ✨"}
              </p>
              <p className="mt-1 text-[12.5px] text-keeper-meta">
                {sent === 'dated'
                  ? 'Your link is in your inbox meanwhile, whenever you fancy a look.'
                  : 'Whenever the moment comes, it takes a few minutes.'}
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
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Their name (optional)"
                  className="h-12 min-w-0 rounded-xl border border-[#cfcbee] bg-white px-4 text-sm text-keeper-ink placeholder:text-keeper-meta/70 focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                  data-testid="input-occasion-name"
                />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-label="Their date (optional)"
                  className="h-12 min-w-0 rounded-xl border border-[#cfcbee] bg-white px-4 text-sm text-keeper-ink placeholder:text-keeper-meta/70 focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                  data-testid="input-occasion-date"
                />
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="h-12 min-w-0 flex-1 rounded-xl border border-[#cfcbee] bg-white px-4 text-sm text-keeper-ink placeholder:text-keeper-meta/70 focus:border-brand-dark focus:outline-none focus:ring-2 focus:ring-brand-dark/20"
                  data-testid="input-occasion-email"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="h-12 shrink-0 rounded-full bg-go px-6 text-[14px] font-semibold text-go-foreground transition-colors hover:bg-go-hover disabled:opacity-50"
                  data-testid="btn-occasion-submit"
                >
                  {busy ? 'One sec…' : date ? 'Set my nudge' : 'Email me the link'}
                </button>
              </div>
              <label className="mx-auto mt-3 flex max-w-md cursor-pointer items-start gap-2 text-left">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-keeper-hair accent-[#5c57d4]"
                  data-testid="check-occasion-optin"
                />
                <span className="text-[11.5px] leading-snug text-keeper-meta">
                  Keep me posted now and then — new features and ideas.
                  Unsubscribe anytime.
                </span>
              </label>
              <p className="mt-2 text-[10.5px] text-keeper-meta/80">
                {date
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

// ── 8. FINALE ────────────────────────────────────────────────────────

function FinaleSection() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const authed = !isLoading && isAuthenticated;
  const cls =
    'inline-flex items-center justify-center rounded-full bg-keeper-ink px-9 py-4 text-base font-semibold text-keeper-paper transition-colors hover:bg-black';
  return (
    <section className="bg-keeper-ink px-6 py-20 text-center md:py-28">
      <Rise>
        <p className="text-[17px] text-keeper-paper/80">
          You bring the person. We paint the moment.
        </p>
        <div className="mt-6 font-display text-[clamp(56px,12vw,140px)] font-bold leading-none tracking-[-0.01em] text-keeper-paper">
          Celebrait
        </div>
        <div className="mt-10">
          {authed ? (
            <Link href="/studio/new-card" className={cls}>
              Make a card — it's free
            </Link>
          ) : (
            <button type="button" onClick={() => openAuth('/studio/new-card')} className={cls}>
              Make a card — it's free
            </button>
          )}
        </div>
        <p className="mt-4 text-[12.5px] text-keeper-paper/60">
          Free to make. £8.99 to print and post. We'll even remind you before
          the next birthday.
        </p>
      </Rise>
    </section>
  );
}

// ── Floating CTA pill ────────────────────────────────────────────────

function FloatingPill() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setShow(y > window.innerHeight * 0.9 && y < max - window.innerHeight * 1.5);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      className="fixed bottom-6 right-6 z-40 transition-all duration-300"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(12px)',
        pointerEvents: show ? 'auto' : 'none',
      }}
    >
      <PrimaryCta />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function LandingKeeper() {
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
      />
      <KeeperHeader />
      <main className="pt-32">
        <HeroSection />
        <ProofSection />
        <InsideSection />
        <StatementSection />
        <GallerySection />
        <ObjectSection />
        <OccasionCaptureSection />
        {/* Imagine it → describe it → send it (animated phone) + the
            demo-walkthrough video slot — restored on Kevin's call. */}
        <ImagineDescribeShipSection />
        <DemoVideoSection />
        <PriceSection />
        <FaqSection />
        <FinaleSection />
      </main>
      <MarketingFooter />
      <FloatingPill />
    </div>
  );
}
