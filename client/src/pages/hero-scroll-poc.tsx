// client/src/pages/hero-scroll-poc.tsx
//
// PROOF OF CONCEPT — scroll "dolly" through the hero, beat by beat.
//   1) Intro: hero headline + body. Scroll dollies the camera THROUGH it.
//   2) Headline "Choose your celebration" (same typography) flies in, then we
//      zoom through it too.
//   3) Arrive at the studio step card — names type in (cycling) and land on
//      "Sarah", with "Anniversary" selected as we get close.
//
// Pure DOM + framer-motion: CSS perspective does the dolly; the studio card is
// a live clone (not a screenshot) so it can animate. Isolated /hero-poc.

import { memo, useEffect, useRef, useState } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
  useReducedMotion,
  easeInOut,
  type MotionValue,
} from 'framer-motion';
import {
  Cake,
  Heart,
  Gem,
  GraduationCap,
  ChevronDown,
  User,
  Check,
  Loader2,
} from 'lucide-react';
import { Link } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { ScrollHint } from '@/components/landing/hero-floating-section';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { GestureHints } from '@/components/gesture-hints';
import revealFront from '@/assets/hero-card-front.jpg';
import revealInside from '@/assets/hero-card-inside.jpg';
import envelopeImg from '@/assets/envelope.png';
import cakeIcon from '@/assets/icons/cake.png';
import ringIcon from '@/assets/icons/ring.png';
import presentIcon from '@/assets/icons/present.png';
import heartIcon from '@/assets/icons/heart.png';

const FINAL_NAME = 'Sarah';
const ANNIVERSARY_IDX = 1; // 'Anniversary' in OCC

// Beat 5 — the scene description that types itself in.
const SCENE_TEXT =
  'Sarah on a sunlit terrace in Positano, laughing with a glass of wine as the sea glows gold behind her.';
// Beat 6 — the front headline that types itself in.
const FRONT_TEXT = 'Happy Anniversary, Sarah';
// Beat 7 — the inside message that types itself in.
const INSIDE_MESSAGE =
  "Twenty-five years, and you still make me laugh like it's day one. Here's to every adventure still to come.";

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// The example-card reveal — a PLAIN section after the build steps (Kevin
// 2026-07-04: "it just needs to be a separate part of the current flow…
// scroll down to a button that says Generate Example Card and reveal the
// 3d render with hints"). No sticky pin, no scrub, no overlap handoffs —
// the two previous scrub finales (CSS MagicCard envelope theatre, then a
// scroll-driven 3D hold) both read as clunky. Click → short "painting"
// beat → the REAL Card3DViewer fades in, tap-to-open/close only, green
// tap hint. MagicCard stays retired in-file below.
export function StudioFlowSection() {
  const [cardOpen, setCardOpen] = useState(false);

  return (
    <section className="snap-start relative flex min-h-screen flex-col items-center justify-center py-16">
      <div className="relative mx-auto flex h-[58vh] min-h-[430px] w-full max-w-3xl flex-col items-center justify-center px-6">
        {/* The card is just THERE — no button, no fake generating beat
            (Kevin 2026-07-04: "visual easy without effort on a LP").
            Gentle settle-in as the section scrolls into view; tap to
            open/close with the green hint. */}
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.94 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex h-full w-full flex-col items-center"
          >
            {/* 3D stage — the canvas bleeds past the anchor so the opening
                cover never clips (same pattern as the card viewer). No CSS
                drop-shadow here: filtering a huge canvas region re-rasterises
                every hinge frame (stutter); ContactShadows inside the scene
                already grounds the card. framingMargin 1.4 = card fills ~70%
                of the stage (default 2.0 read tiny on desktop); minDistance
                lowered so OrbitControls doesn't snap the closer fit back out.
                grow + min-h-0 (not h-full) so the flex column distributes
                height deterministically against the fixed hint slot below. */}
            <div className="relative w-full grow min-h-0">
              <div className="absolute bottom-[-12vh] left-[-18vw] right-[-18vw] top-[-12vh]">
                <Card3DViewer
                  frontImageUrl={revealFront}
                  insideImageUrl={revealInside}
                  open={cardOpen}
                  onOpenChange={setCardOpen}
                  enableRotate={false}
                  enableZoom={false}
                  framingMargin={1.7}
                  minDistance={1.6}
                  dprMax={1.5}
                  /* Resting ajar + slight yaw — reads as openable, matches
                     the studio card view's resting pose. */
                  closedAngle={-0.3}
                  restYaw={-0.1}
                  className="h-full w-full"
                />
              </div>
            </div>
            {/* Green tap hint — FIXED-HEIGHT slot (shrink-0) so the hint
                fading out on open doesn't reflow the column (the canvas
                above resized mid-hinge = the "stutters down" bug).
                Rotate/zoom hints hidden. */}
            <div className="relative z-10 mt-2 flex h-16 shrink-0 items-start justify-center">
              <GestureHints open={cardOpen} hideZoomHint hideRotateHint />
            </div>
          </motion.div>
      </div>
    </section>
  );
}

// The pay-off after the scroll journey — a key decision moment: start now, or
// learn more (pricing). The content is PINNED (sticky) and zoom-fades in PLACE
// — no rise-from-below — exactly as the "Send it" finale clears. The -100vh
// margin lines the pin up with the flow's end so they hand off in sync.
export function MakeYourOwnSection() {
  const { isAuthenticated, isLoading } = useAuth();
  const authed = !isLoading && isAuthenticated;
  const reduced = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });
  // Content stays invisible while the section rises (so you never see it come
  // up), then — once pinned — RAPIDLY zooms + fades into place.
  const riseZ = useTransform(scrollYProgress, [0, 0.16], [-1000, 0]);
  const riseO = useTransform(scrollYProgress, [0, 0.08], [0, 1]);
  // The pin overlaps the flow finale by design (-114vh) — which meant this
  // full-screen container sat ON TOP of the 3D card and swallowed its taps
  // while still invisible (found 2026-07-04 when the finale card went
  // interactive). Container is now pointer-inert; the content only accepts
  // clicks once it's actually visible.
  const contentPE = useTransform(riseO, (o) => (o > 0.5 ? ('auto' as const) : ('none' as const)));

  return (
    <div
      ref={ref}
      // pointer-events-none on the SHELL too — it's a transparent later
      // sibling that can overlap the section above, so with default
      // pointer events it would hit-test above the 3D card and eat taps.
      // No more -114vh overlap: the finale is a plain section now
      // (2026-07-04), so this pins normally after it.
      className="snap-start relative pointer-events-none"
      style={{ height: '150vh' }}
    >
      <div className="sticky top-0 h-screen" style={{ perspective: '1000px' }}>
        {/* Centred in the full viewport — same vertical position the flow
            beats (photos … Send it) sit at, so the journey flows consistently. */}
        <div className="flex h-full flex-col items-center justify-center px-6 text-center">
          <motion.div
            style={reduced ? undefined : { z: riseZ, opacity: riseO, pointerEvents: contentPE }}
            className="flex flex-col items-center will-change-transform pointer-events-auto"
          >
            <h2 className="font-display text-[40px] font-bold leading-[1.0] tracking-[-0.02em] text-ink sm:text-[54px] md:text-[64px]">
              Make your own
            </h2>
            <p className="mt-5 max-w-[42ch] text-base leading-relaxed text-ink-soft md:text-lg">
              Your photos, your words, their face in the moment — a card they'll keep.
            </p>
            {/* Two paths: start now, or learn more. */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
              <Link href={authed ? '/studio' : '/login?redirect=/studio/new-card'}>
                <Button className="h-12 bg-brand px-8 text-base font-medium text-brand-foreground hover:bg-brand-dark">
                  {authed ? 'Open my studio' : 'Make my first card'}
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  variant="outline"
                  className="h-12 border-stone-300 bg-white/70 px-7 text-base font-medium text-ink hover:bg-white"
                >
                  See pricing
                </Button>
              </Link>
            </div>
            <p className="mt-3 text-[13px] text-ink-soft">Free to start. No card needed.</p>
          </motion.div>
        </div>

        {/* Green "keep scrolling" cue, pinned near the bottom (out of the
            centred column so it doesn't drag the content upward). */}
        <motion.div
          style={reduced ? undefined : { opacity: riseO }}
          className="absolute inset-x-0 bottom-12 flex justify-center"
        >
          <ScrollHint reduced={reduced} prefix="keep" suffix="— there's more" />
        </motion.div>
      </div>
    </div>
  );
}

// The always-on celebration background — a fixed gradient + the floating emoji
// field (desktop + mobile sets, centre-masked). Mount once behind a page so the
// objects persist across the WHOLE scroll. Sits at -z-10; pages that use it must
// not paint an opaque background over it.
export function CelebrationBackdrop() {
  const reduced = useReducedMotion();
  const { scrollY } = useScroll();
  // Cache the viewport height (refreshed on resize) instead of reading
  // window.innerHeight on every scroll frame inside the transform — keeps the
  // per-frame fade computation a cheap ref read, no layout access.
  const vhRef = useRef(typeof window !== 'undefined' ? window.innerHeight : 800);
  useEffect(() => {
    const onResize = () => {
      vhRef.current = window.innerHeight;
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  // Fade the floating field DOWN (not out) as the user scrolls past the hero
  // (step one) into the flow — full while reading the hero, then settling to a
  // faint floor so it still adds depth without competing with the journey.
  // Fades across ~0.4vh→1.0vh of scroll (leaving the hero → into the flow).
  const FIELD_FLOOR = 0.28; // lingering opacity once into the flow
  const fieldOpacity = useTransform(scrollY, (y) => {
    const vh = vhRef.current;
    const t = clamp((y - vh * 0.4) / (vh * 1.0 - vh * 0.4), 0, 1);
    return 1 - t * (1 - FIELD_FLOOR);
  });
  return (
    <>
      <div
        className="fixed inset-0 -z-10"
        style={{ background: 'linear-gradient(180deg, #ffffff 0%, #f3f2fb 100%)' }}
      />
      <motion.div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{ opacity: reduced ? 1 : fieldOpacity }}
      >
        <FloatingCards cards={FLOATING_DESKTOP} mask={DESKTOP_MASK} className="hidden md:block" />
        <FloatingCards cards={FLOATING_MOBILE} mask={MOBILE_MASK} className="md:hidden" />
      </motion.div>
    </>
  );
}

// The standalone POC page: the always-on celebration backdrop + a hero + the flow.
export default function HeroScrollPocPage() {
  const reduced = useReducedMotion();
  return (
    <>
      <CelebrationBackdrop />
      {/* Hero — a normal landing section you just scroll past. */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6">
        <div className="relative z-10">
          <HeadlineIntro reduced={!!reduced} />
        </div>
        <div className="absolute inset-x-0 bottom-10 flex justify-center">
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex h-9 w-9 items-center justify-center text-cta">
              <ScrollGlyph />
            </div>
            <span className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
              Scroll to begin
            </span>
          </div>
        </div>
      </section>
      <StudioFlowSection />
      <MakeYourOwnSection />
    </>
  );
}

const HEADLINE_CLASS =
  'text-[40px] sm:text-[56px] md:text-[68px] lg:text-[80px] font-semibold text-ink leading-[0.95] tracking-[-0.02em] text-center';

// Paired headline (above the studio card) — smaller than the solo hero
// headlines so the headline + card fit the viewport together.
const CHOOSE_CLASS =
  'font-display text-[30px] sm:text-[40px] md:text-[48px] font-bold text-ink leading-[1.0] tracking-[-0.02em] text-center';

function Layer({
  z,
  y,
  opacity,
  children,
}: {
  z: MotionValue<number>;
  y?: MotionValue<number>;
  opacity: MotionValue<number>;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      style={{ z, y, opacity }}
      className="absolute inset-0 flex items-center justify-center px-6 will-change-transform"
    >
      {children}
    </motion.div>
  );
}

function HeadlineIntro({ reduced }: { reduced: boolean }) {
  return (
    <div className="max-w-[60ch] text-center">
      <h1 className={HEADLINE_CLASS}>
        Greetings cards
        <br />
        <motion.span
          className="bg-clip-text text-transparent inline-block px-1 leading-[1.05] pb-[0.12em]"
          style={{
            backgroundImage:
              'linear-gradient(90deg, #0f172a 0%, #0f172a 30%, #7a76e8 45%, #5c57d4 50%, #7a76e8 55%, #0f172a 70%, #0f172a 100%)',
            backgroundSize: '220% 100%',
            backgroundRepeat: 'no-repeat',
          }}
          initial={{ backgroundPosition: '0% 0%' }}
          animate={reduced ? undefined : { backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }}
          transition={
            reduced
              ? undefined
              : { duration: 4, repeat: Infinity, repeatDelay: 4.5, ease: 'easeInOut', delay: 0.8, times: [0, 0.5, 1] }
          }
        >
          they'll keep.
        </motion.span>
      </h1>
      <p className="mt-5 md:mt-6 text-base md:text-xl text-ink-soft leading-relaxed mx-auto">
        Celebrait good times with mind-blowing greetings cards that are
        impossible to forget. Printed &amp; delivered, or opened with a custom
        link. <span className="font-medium text-ink">100% creative control.</span>
      </p>
    </div>
  );
}

const OCC = [
  { label: 'Birthday', Icon: Cake },
  { label: 'Anniversary', Icon: Heart },
  { label: 'Wedding', Icon: Gem },
  { label: 'Graduation', Icon: GraduationCap },
];

function StudioCard({
  name,
  selectedIdx,
  pressed,
}: {
  name: string;
  selectedIdx: number;
  pressed: boolean;
}) {
  return (
    <div className="w-[340px] sm:w-[380px] rounded-[28px] bg-white px-6 py-7 shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70">
      <p className="text-[13px] text-ink mb-1.5">Name</p>
      <div className="rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[15px] min-h-[46px] flex items-center">
        {name ? (
          <span className="text-ink">
            {name}
            <span className="inline-block w-[2px] h-[16px] bg-brand align-middle ml-0.5 animate-pulse" />
          </span>
        ) : (
          <span className="text-stone-400">e.g. Mum, Sarah, Dad</span>
        )}
      </div>

      <p className="text-[14px] text-ink mt-5 mb-2.5">What's the celebration?</p>
      <div className="space-y-2.5">
        {OCC.map(({ label, Icon }, i) => {
          const active = i === selectedIdx;
          const isPress = pressed && active;
          return (
            <div
              key={label}
              className={`relative overflow-hidden flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 transition-all ${
                active ? 'border-brand bg-brand-muted/40' : 'border-stone-200 bg-white'
              }`}
            >
              {/* Purple "press" overlay — flashes over the row as Anniversary
                  is tapped near the end of the approach. */}
              <motion.div
                className="absolute inset-0 bg-brand pointer-events-none"
                initial={false}
                animate={{ opacity: isPress ? 1 : 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              />
              <span
                className={`relative z-10 flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                  isPress ? 'bg-white/20 text-white' : 'bg-pink-100 text-pink-500'
                }`}
              >
                <Icon className="w-[19px] h-[19px]" strokeWidth={2} />
              </span>
              <span
                className={`relative z-10 text-[15px] font-medium transition-colors ${
                  isPress ? 'text-white' : 'text-ink'
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3.5 flex items-center gap-1 text-[13px] text-brand font-medium">
        <ChevronDown className="w-4 h-4" />
        More occasions
      </div>
    </div>
  );
}

// Placeholder photo thumbnails — gradient tiles standing in for portraits
// (swap for real sample shots later). SELECT_ORDER = the order they tick in.
const PHOTOS = [
  'from-rose-300 to-orange-200',
  'from-sky-300 to-indigo-200',
  'from-amber-300 to-pink-200',
  'from-emerald-300 to-teal-200',
  'from-violet-300 to-fuchsia-200',
  'from-stone-300 to-stone-200',
];
const SELECT_ORDER = [0, 4, 2];

// Photos "select in" as the beat lands. Imperative: subscribes to the scroll
// value and toggles tile classes / the count text directly on the DOM — no
// React state, so it never re-renders during the scrub. memo() keeps it inert
// even if a parent re-renders (the `progress` prop is a stable motion value).
const PhotoCard = memo(function PhotoCard({ progress }: { progress: MotionValue<number> }) {
  const tilesRef = useRef<HTMLDivElement>(null);
  const countRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const apply = (v: number) => {
      const ps = clamp((v - 0.245) / (0.285 - 0.245), 0, 1);
      const selected = Math.min(
        SELECT_ORDER.length,
        Math.floor(ps * (SELECT_ORDER.length + 1)),
      );
      const tiles = tilesRef.current?.children;
      if (tiles) {
        for (let i = 0; i < tiles.length; i++) {
          const pos = SELECT_ORDER.indexOf(i);
          const sel = pos !== -1 && pos < selected;
          const tile = tiles[i] as HTMLElement;
          tile.classList.toggle('ring-brand', sel);
          tile.classList.toggle('ring-transparent', !sel);
          tile.style.opacity = selected > 0 && !sel ? '0.6' : '1';
          const chk = tile.querySelector('[data-check]') as HTMLElement | null;
          if (chk) {
            chk.style.opacity = sel ? '1' : '0';
            chk.style.transform = sel ? 'scale(1)' : 'scale(0.5)';
          }
        }
      }
      if (countRef.current) {
        countRef.current.textContent = selected > 0 ? `Sarah — ${selected} selected` : '';
      }
    };
    apply(progress.get());
    return progress.on('change', apply);
  }, [progress]);

  return (
    <div className="w-[340px] sm:w-[380px] rounded-[28px] bg-white px-6 py-7 shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70">
      <div ref={tilesRef} className="grid grid-cols-3 gap-2.5">
        {PHOTOS.map((g, i) => (
          <div
            key={i}
            style={{ opacity: 1 }}
            className={`relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br ${g} ring-2 ring-transparent transition-all duration-200`}
          >
            <span className="absolute inset-0 flex items-center justify-center">
              <User className="w-7 h-7 text-white/75" strokeWidth={1.75} />
            </span>
            <div
              data-check
              style={{ opacity: 0, transform: 'scale(0.5)' }}
              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-brand flex items-center justify-center shadow-md transition-all duration-200"
            >
              <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
            </div>
          </div>
        ))}
      </div>

      <p ref={countRef} className="text-[13px] mt-4 h-5 text-center font-semibold text-ink"></p>
    </div>
  );
});

// "Put them in the picture" — the scene description types itself in.
// Imperative: writes characters straight to a ref's textContent off the scroll
// value (no setState), so typing causes zero re-renders.
const PictureCard = memo(function PictureCard({ progress }: { progress: MotionValue<number> }) {
  const placeholderRef = useRef<HTMLSpanElement>(null);
  const typedRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const apply = (v: number) => {
      const t = clamp((v - 0.435) / (0.515 - 0.435), 0, 1);
      const n = Math.round(t * SCENE_TEXT.length);
      if (textRef.current) textRef.current.textContent = SCENE_TEXT.slice(0, n);
      const empty = n === 0;
      if (placeholderRef.current) placeholderRef.current.style.display = empty ? '' : 'none';
      if (typedRef.current) typedRef.current.style.display = empty ? 'none' : '';
    };
    apply(progress.get());
    return progress.on('change', apply);
  }, [progress]);

  return (
    <div className="w-[340px] sm:w-[380px] rounded-[28px] bg-white px-6 py-7 shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70">
      <p className="mb-1.5 text-[13px] text-ink">The picture</p>
      <div className="h-[150px] overflow-hidden rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[15px] leading-relaxed text-ink">
        <span ref={placeholderRef} className="text-stone-400">
          e.g. Sarah at golden hour on an Italian terrace…
        </span>
        <span ref={typedRef} style={{ display: 'none' }}>
          <span ref={textRef}></span>
          <span className="ml-0.5 inline-block h-[16px] w-[2px] animate-pulse bg-brand align-middle" />
        </span>
      </div>
    </div>
  );
});

// "Add your words" — front headline types first, then the inside message.
// Imperative (same pattern as PictureCard): two ref-driven typed fields,
// zero re-renders during the scrub.
const WordsCard = memo(function WordsCard({ progress }: { progress: MotionValue<number> }) {
  const fPlace = useRef<HTMLSpanElement>(null);
  const fTyped = useRef<HTMLSpanElement>(null);
  const fText = useRef<HTMLSpanElement>(null);
  const mPlace = useRef<HTMLSpanElement>(null);
  const mTyped = useRef<HTMLSpanElement>(null);
  const mText = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const apply = (v: number) => {
      const t6 = clamp((v - 0.665) / (0.705 - 0.665), 0, 1);
      const fn = Math.round(t6 * FRONT_TEXT.length);
      const t7 = clamp((v - 0.705) / (0.76 - 0.705), 0, 1);
      const mn = Math.round(t7 * INSIDE_MESSAGE.length);
      if (fText.current) fText.current.textContent = FRONT_TEXT.slice(0, fn);
      const fEmpty = fn === 0;
      if (fPlace.current) fPlace.current.style.display = fEmpty ? '' : 'none';
      if (fTyped.current) fTyped.current.style.display = fEmpty ? 'none' : '';
      if (mText.current) mText.current.textContent = INSIDE_MESSAGE.slice(0, mn);
      const mEmpty = mn === 0;
      if (mPlace.current) mPlace.current.style.display = mEmpty ? '' : 'none';
      if (mTyped.current) mTyped.current.style.display = mEmpty ? 'none' : '';
    };
    apply(progress.get());
    return progress.on('change', apply);
  }, [progress]);

  return (
    <div className="w-[340px] sm:w-[380px] rounded-[28px] bg-white px-6 py-7 shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70">
      {/* What's on the front? */}
      <p className="mb-1.5 text-[13px] text-ink">What's on the front?</p>
      <div className="flex min-h-[46px] items-center rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[15px]">
        <span ref={fPlace} className="text-stone-400">Happy Anniversary</span>
        <span ref={fTyped} style={{ display: 'none' }} className="font-medium text-ink">
          <span ref={fText}></span>
          <span className="ml-0.5 inline-block h-[16px] w-[2px] animate-pulse bg-brand align-middle" />
        </span>
      </div>

      {/* What's on the inside? */}
      <p className="mb-1.5 mt-4 text-[13px] text-ink">What's on the inside?</p>
      <div className="h-[120px] overflow-hidden rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[14px] leading-relaxed text-ink">
        <span ref={mPlace} className="text-stone-400">Write a few words from the heart…</span>
        <span ref={mTyped} style={{ display: 'none' }}>
          <span ref={mText}></span>
          <span className="ml-0.5 inline-block h-[15px] w-[2px] animate-pulse bg-brand align-middle" />
        </span>
      </div>
    </div>
  );
});

// Confetti pieces — deterministic spread (index-based, no RNG) so it's stable.
const CONFETTI_COLORS = ['#7a76e8', '#e8519b', '#f5c542', '#5ad19a', '#5c57d4'];
const CONFETTI = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2 + (i % 2 ? 0.3 : -0.2);
  const dist = 96 + (i % 4) * 36;
  return {
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    dx: Math.cos(angle) * dist,
    dy: Math.sin(angle) * dist - 28, // slight upward bias — a pop, not a drop
    rot: 140 + (i % 5) * 70,
    w: i % 3 === 0 ? 6 : 9,
    h: i % 3 === 0 ? 11 : 6,
  };
});

function ConfettiBurst({ burst }: { burst: MotionValue<number> }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      <div className="relative">
        {CONFETTI.map((c, i) => (
          <ConfettiPiece key={i} burst={burst} c={c} />
        ))}
      </div>
    </div>
  );
}

function ConfettiPiece({
  burst,
  c,
}: {
  burst: MotionValue<number>;
  c: (typeof CONFETTI)[number];
}) {
  const x = useTransform(burst, [0, 1], [0, c.dx]);
  const y = useTransform(burst, [0, 1], [0, c.dy]);
  const rotate = useTransform(burst, [0, 1], [0, c.rot]);
  const scale = useTransform(burst, [0, 0.2, 1], [0.3, 1, 0.85]);
  // Pop in fast, fade out as it travels — 0 at both ends so it's invisible
  // outside the burst window.
  const opacity = useTransform(burst, [0, 0.12, 0.6, 1], [0, 1, 1, 0]);
  return (
    <motion.span
      aria-hidden
      style={{
        x,
        y,
        rotate,
        scale,
        opacity,
        width: c.w,
        height: c.h,
        backgroundColor: c.color,
      }}
      className="absolute left-0 top-0 rounded-[2px]"
    />
  );
}

// Finale card. Starts BLANK; the render SWIPES in on the cover (`swipe` 0→1);
// then the cover OPENS on the spine (`open` 0→1) like a real card — revealing a
// WHITE inside-left (the cover's back) and the message on the inside-right, with
// the cover casting a shadow on the inside-right. Pure CSS hinge, no 3D viewer.
// Responsive square box for the hinge — deliberately small now; the finale
// pushes the "camera" in (translateZ) so it grows ~1.2× during the dwell.
// Both width + height use the same expression so the box stays square; the
// hinge geometry is relative so it scales cleanly.
const CARD_SIZE = 'clamp(300px, 26vw, 400px)';

// Paper treatment for the finale card faces — a soft drop shadow + top-edge
// highlight + hairline (gives it lift + thickness), plus a surface-shading
// gradient and a faint grain so it reads as paper, not a flat sticker.
// Drop shadow matches the build-step cards exactly; the inset highlight +
// hairline add the paper edge.
const CARD_SHADOW =
  '0 36px 90px -32px rgba(15,23,42,0.32), inset 0 1px 0 rgba(255,255,255,0.6), 0 0 0 1px rgba(15,23,42,0.07)';
const PAPER_GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E\")";

function CardSurface() {
  return (
    <>
      {/* Form — light top-left → shade bottom-right. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/25 via-transparent to-black/[0.12]" />
      {/* Paper grain. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay"
        style={{ backgroundImage: PAPER_GRAIN }}
      />
    </>
  );
}

function MagicCard({
  swipe,
  open,
  replace,
}: {
  swipe: MotionValue<number>;
  open: MotionValue<number>;
  replace: MotionValue<number>;
}) {
  // Front render swipe — left→right wipe with a glowing edge.
  const rightInset = useTransform(swipe, [0, 1], [100, 0]);
  const frontClip = useMotionTemplate`inset(0% ${rightInset}% 0% 0%)`;
  const lineLeft = useTransform(swipe, [0, 1], ['0%', '100%']);
  const lineO = useTransform(swipe, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);

  // Envelope replace-swipe — the SAME wipe, reversed (right→left): the envelope
  // wipes IN over the front render, inside the same cover face, so the card's
  // front literally becomes the envelope. Glowing edge travels the other way.
  const replLeftInset = useTransform(replace, [0, 1], [100, 0]);
  const replClip = useMotionTemplate`inset(0% 0% 0% ${replLeftInset}%)`;
  const replLineLeft = useTransform(replace, [0, 1], ['100%', '0%']);
  const replLineO = useTransform(replace, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);

  // Cover hinge — swings open around the spine (left edge). Eased (ease-in-out)
  // so it accelerates then settles, rather than scrubbing linearly = smoother.
  const coverRotY = useTransform(open, [0, 1], [0, -158], { ease: easeInOut });
  const coverTransform = useMotionTemplate`rotateY(${coverRotY}deg)`;
  // Shadow the opening cover casts across the inside.
  const shadowO = useTransform(open, [0, 0.25, 0.6, 1], [0, 0.5, 0.34, 0.24]);

  return (
    <div style={{ perspective: 1600 }} className="relative">
      {/* The card box stays put (static, centred); the cover hinges open to the
          left around the spine — same as the 3D render, no recentering. */}
      <div
        className="relative"
        style={{ width: CARD_SIZE, height: CARD_SIZE, transformStyle: 'preserve-3d' }}
      >
        {/* Inside-right — the inside render + paper surface + the cast shadow. */}
        <div
          className="absolute inset-0 overflow-hidden rounded-[6px] bg-white"
          style={{ boxShadow: CARD_SHADOW }}
        >
          <img
            src={revealInside}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <CardSurface />
          <motion.div
            aria-hidden
            style={{ opacity: shadowO }}
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/55 via-black/15 to-transparent"
          />
        </div>

        {/* Cover — hinged on the left edge (spine), two faces. */}
        <motion.div
          className="absolute inset-0"
          style={{
            transformOrigin: 'left center',
            transform: coverTransform,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Front face — the render, swiped in, + paper surface. */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[6px] bg-white"
            style={{ backfaceVisibility: 'hidden', boxShadow: CARD_SHADOW }}
          >
            <motion.img
              src={revealFront}
              alt=""
              style={{ clipPath: frontClip }}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <CardSurface />
            {/* Envelope — wipes IN over the front (white face backs it so the
                render never shows through the envelope's transparent areas). */}
            <motion.div
              style={{ clipPath: replClip }}
              className="absolute inset-0 overflow-hidden bg-white"
            >
              <img
                src={envelopeImg}
                alt=""
                className="absolute inset-0 h-full w-full scale-[1.16] object-cover"
              />
            </motion.div>
            {/* Glow edge — initial render swipe (left→right). */}
            <motion.div
              aria-hidden
              style={{ left: lineLeft, opacity: lineO }}
              className="pointer-events-none absolute bottom-0 top-0 w-[4px] -translate-x-1/2 bg-white/90 shadow-[0_0_24px_7px_rgba(122,118,232,0.85)]"
            />
            {/* Glow edge — envelope replace swipe (right→left). */}
            <motion.div
              aria-hidden
              style={{ left: replLineLeft, opacity: replLineO }}
              className="pointer-events-none absolute bottom-0 top-0 w-[4px] -translate-x-1/2 bg-white/90 shadow-[0_0_24px_7px_rgba(122,118,232,0.85)]"
            />
          </div>
          {/* Back face — the inside-left, WHITE paper. */}
          <div
            className="absolute inset-0 overflow-hidden rounded-[6px] bg-white"
            style={{
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              boxShadow: CARD_SHADOW,
            }}
          >
            <CardSurface />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ── Floating celebration field (hero background) ────────────────────
// Glossy 3D celebration icons scattered around the periphery (a centre mask
// keeps the headline clear). Distance is conveyed by a single `depth`
// 0(far)→1(near) driving SIZE + contact shadow only — no blur or opacity
// fade, so every object reads crisp. Sized in vmin so it scales on mobile.
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// { x,y: % position · depth: 0(far)→1(near) drives size + contact shadow ·
//   icon: celebration icon image · tilt: z-rotate ·
//   delay: bob phase }
// The ORIGINAL scatter that read well as all-cakes — an asymmetric,
// depth-layered field (small/far up top at varied x; big/near anchoring
// the lower corners) — now populated with the five icons distributed
// across it (cake featured, no identical neighbours). The field is
// offset below the ~120px header+promo bar (see FloatingCards), so these
// original y values now sit just under it.
// Four objects, each shown ONCE in a corner: ribbon top-left, ring
// top-right, cake bottom-left, present bottom-right. The lower pair sit
// nearer (bigger); the upper pair sit further back (smaller + a slight
// depth fade). Same set on desktop + mobile. y values keep the upper band
// below the ~120px header+promo bar (field offset under it — FloatingCards).
const FLOATING_DESKTOP = [
  // upper band — further back: smaller + slightly faded
  { x: 16, y: 16, depth: 0.24, icon: heartIcon, tilt: -7, delay: 0 },
  { x: 84, y: 14, depth: 0.24, icon: ringIcon, tilt: 6, delay: 1.5 },
  // lower band — nearer + bigger, anchoring the composition
  { x: 13, y: 74, depth: 0.92, icon: cakeIcon, tilt: -9, delay: 0.6 },
  { x: 87, y: 70, depth: 0.9, icon: presentIcon, tilt: 8, delay: 1.9 },
];
// Mobile — same four.
const FLOATING_MOBILE = [
  { x: 16, y: 11, depth: 0.32, icon: heartIcon, tilt: -6, delay: 0 },
  { x: 85, y: 14, depth: 0.32, icon: ringIcon, tilt: 6, delay: 1.2 },
  { x: 14, y: 84, depth: 0.88, icon: cakeIcon, tilt: -7, delay: 0.6 },
  { x: 86, y: 86, depth: 0.84, icon: presentIcon, tilt: 7, delay: 1.8 },
];

function FloatingIcon({
  x,
  y,
  depth,
  tilt,
  delay,
  icon,
}: (typeof FLOATING_DESKTOP)[number]) {
  const size = `clamp(34px, ${lerp(8, 18, depth).toFixed(2)}vmin, 150px)`;
  const drift = lerp(6, 14, depth) * (tilt >= 0 ? -1 : 1);
  const dur = 8 + depth * 4;
  // Slight depth fade (no blur) — far/top objects sit back a touch, near/
  // bottom read at full strength. Subtle: even the furthest stays legible.
  const opacity = 0.72 + depth * 0.28;
  // Soft contact shadow scaled by proximity grounds the object.
  const sy = Math.round(lerp(6, 16, depth));
  const sb = Math.round(lerp(10, 22, depth));
  const sa = lerp(0.12, 0.22, depth).toFixed(2);
  const filter = `drop-shadow(0 ${sy}px ${sb}px rgba(15,23,42,${sa}))`;
  return (
    <motion.div
      className="absolute select-none"
      style={{ left: `${x}%`, top: `${y}%`, opacity }}
      animate={{ y: [0, drift, 0] }}
      transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <img
        src={icon}
        alt=""
        aria-hidden
        draggable={false}
        style={{
          transform: `translate(-50%, -50%) rotate(${tilt}deg)`,
          height: size,
          width: 'auto',
          filter,
        }}
      />
    </motion.div>
  );
}

function FloatingCards({
  cards,
  mask,
  className,
}: {
  cards: typeof FLOATING_DESKTOP;
  mask: string;
  className?: string;
}) {
  // Paint far→near so nearer cards sit in front.
  const sorted = [...cards].sort((a, b) => a.depth - b.depth);
  return (
    <div
      // Start BELOW the fixed header + promo bar (~120px) so floating
      // objects never hide behind them — the field packs into the
      // visible area underneath instead.
      className={`pointer-events-none fixed inset-x-0 bottom-0 top-[120px] -z-10 overflow-hidden ${className ?? ''}`}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {sorted.map((c, i) => (
        <FloatingIcon key={i} {...c} />
      ))}
    </div>
  );
}

// Centre-clearing masks — wider/taller clear zone on mobile (tall narrow column).
const DESKTOP_MASK =
  'radial-gradient(60% 54% at 50% 47%, transparent 0%, transparent 46%, #000 86%)';
// Full opacity (#000) reached by 74% radius so the corner icons render
// crisp — the old 92% stop left them inside the fade ramp (washed out).
const MOBILE_MASK =
  'radial-gradient(86% 60% at 50% 42%, transparent 0%, transparent 44%, #000 74%)';

function ScrollGlyph() {
  return (
    <svg width="22" height="32" viewBox="0 0 22 32" fill="none" aria-hidden>
      <rect x="3" y="3" width="16" height="26" rx="8" stroke="currentColor" strokeWidth="1.6" />
      <motion.circle
        cx="11"
        r="2"
        fill="currentColor"
        initial={{ cy: 9, opacity: 1 }}
        animate={{ cy: [9, 17, 9], opacity: [1, 0.3, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
      />
    </svg>
  );
}
