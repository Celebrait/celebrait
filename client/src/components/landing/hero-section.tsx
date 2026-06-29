// client/src/components/landing/hero-section.tsx
//
// Hero v6 (2026-05-01) — left column carries Photos + Scene; right
// column is Front + Inside in a card-text style. Headline trimmed
// down so it doesn't crowd the card.
//
// Layout shape:
//   ┌─────────────────────────────────────────────────────────┐
//   │              Greetings cards                             │
//   │              they'll keep.   ← shimmer on this           │
//   │                                                          │
//   │  Upload your photos.                Front of card        │
//   │  [photo collage]                    [mono panel]         │
//   │                                                          │
//   │  Describe how it looks.   [3D card] Inside of card       │
//   │  [Scene panel]                      [mono panel]         │
//   │                                                          │
//   │              [Make my first card]                        │
//   │              [Watch the 60s story]                       │
//   └─────────────────────────────────────────────────────────┘
//
// Scene stays Studio-input chrome (sparkle icon + sans body). Front +
// Inside switch to a CARD-TEXT style — mono font on a warm paper
// background, no sparkle icon — reads as "this is what lands ON the
// card" rather than "this is the input field."
//
// Sequential typing flow:
//   0ms     Scene starts (left column)
//   4200ms  Front starts (right column)
//   7700ms  Inside starts (right column)

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, PenLine, Sparkles, Type, UploadCloud } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { GestureHints } from '@/components/gesture-hints';
// Hero card art — sourced from Studio card 120 ("Sarah / anniversary,
// rooftop bar in NY at sunset"). The canonical PNGs were copied from
// stored_images/ so the lander stays in lockstep with what the real
// product produces. To swap to a different card, copy that card's
// PNGs over these filenames.
import heroCardFront from '@/assets/hero-card-front.jpg';
import heroCardInside from '@/assets/hero-card-inside.jpg';
import heroPhotoGroup from '@/assets/hero-photo-group.jpg';
import heroPhotoIndividuals from '@/assets/hero-photo-individuals.jpg';

const Card3DViewer = lazy(() =>
  import('@/components/card-3d-viewer').then((m) => ({ default: m.Card3DViewer })),
);

/* ─── Card poster (Suspense fallback) ────────────────────────────── */

/** Card loader — Suspense fallback while the lazy three.js chunk
 *  streams in. Spinner first, "Loading 3D greeting card" caption
 *  fades in 0.6s later so the text appears once the user has had a
 *  beat to register the spinner (avoids text flashing in
 *  unnecessarily on a fast load). */
function CardLoader() {
  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center gap-5">
      <Loader2
        className="w-9 h-9 text-brand animate-spin"
        strokeWidth={1.75}
      />
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6, ease: 'easeOut' }}
        className="text-[11px] uppercase tracking-[0.18em] text-ink-soft font-medium"
      >
        Loading 3D greeting card
      </motion.p>
    </div>
  );
}

/* ─── Photo collage (left column, top) ───────────────────────────── */

// Real photos shot at The Royal Oak (London, May 2026). The "group"
// shot is a couple cheek-to-cheek; the "individuals" image is a
// side-by-side of the same two people solo. Visually communicates
// "you can upload a group shot OR individual photos." Each polaroid
// carries a small badge to make the option explicit.

/** Photo collage — no panel chrome (the surrounding box looked off
 *  per founder call). Standalone "Upload your photos" sub-label
 *  sized UP for clarity-on-process role, with an UploadCloud icon
 *  alongside it. The two polaroid photos sit below, floating freely.
 *
 *  Sub-label is bigger than the in-panel headers of Scene/Front/
 *  Inside (text-base md:text-lg vs text-xs) so it functions as the
 *  page's process explainer rather than a panel label. */
function PhotoCollage({ reduced }: { reduced: boolean }) {
  return (
    <div className="w-full">
      {/* Sub-label now mentions both options so the polaroids' visual
          difference (couple vs. side-by-side individuals) maps to a
          stated choice in the copy. */}
      <div className="flex items-center gap-2 mb-5">
        <div className="w-8 h-8 rounded-full bg-brand-muted flex items-center justify-center shrink-0">
          <UploadCloud className="w-4 h-4 text-brand" strokeWidth={2} />
        </div>
        <p className="text-sm md:text-base font-semibold text-ink-soft tracking-tight">
          Upload a group shot — or individuals
        </p>
      </div>

      {/* Floating polaroid photos — no container chrome.
          Foreground polaroid (z-20, top-left) shows the GROUP shot
          (couple cheek-to-cheek). Background polaroid (z-10, offset
          down/right) shows the INDIVIDUAL portraits.
          Each polaroid carries a tiny badge in the bottom-left so
          first-time visitors get the "either format works" message
          without having to read the sub-label. */}
      <div className="relative h-[200px] lg+:h-[230px] xl:h-[260px] w-full max-w-[260px]">
        <motion.div
          className="absolute top-0 left-0 w-[110px] lg+:w-[125px] xl:w-[140px] aspect-square rounded-xl bg-white ring-4 ring-white overflow-hidden z-20"
          style={{
            boxShadow:
              '0 18px 30px -10px rgba(15,23,42,0.22), 0 6px 14px -6px rgba(15,23,42,0.12)',
          }}
          initial={{ rotate: -4, y: 0 }}
          animate={
            reduced
              ? { rotate: -4, y: 0 }
              : { rotate: [-4, -3, -4], y: [0, -8, 0] }
          }
          transition={
            reduced
              ? undefined
              : { duration: 5.4, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <img
            src={heroPhotoGroup}
            alt="A couple cheek-to-cheek outside The Royal Oak pub"
            className="w-full h-full object-cover"
            loading="eager"
          />
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center text-[9px] uppercase tracking-[0.12em] font-semibold text-white bg-ink/70 px-1.5 py-0.5 rounded-full backdrop-blur-[2px]">
            Group
          </span>
        </motion.div>

        <motion.div
          className="absolute top-[80px] lg+:top-[95px] xl:top-[110px] left-[60px] lg+:left-[70px] xl:left-[80px] w-[110px] lg+:w-[125px] xl:w-[140px] aspect-square rounded-xl bg-white ring-4 ring-white overflow-hidden z-10"
          style={{
            boxShadow:
              '0 18px 30px -10px rgba(15,23,42,0.22), 0 6px 14px -6px rgba(15,23,42,0.12)',
          }}
          initial={{ rotate: 5, y: 0 }}
          animate={
            reduced
              ? { rotate: 5, y: 0 }
              : { rotate: [5, 6, 5], y: [0, -6, 0] }
          }
          transition={
            reduced
              ? undefined
              : {
                  duration: 6.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: 0.8,
                }
          }
        >
          <img
            src={heroPhotoIndividuals}
            alt="The same couple as two individual portraits side by side"
            className="w-full h-full object-cover"
            loading="eager"
          />
          <span className="absolute bottom-1.5 left-1.5 inline-flex items-center text-[9px] uppercase tracking-[0.12em] font-semibold text-white bg-ink/70 px-1.5 py-0.5 rounded-full backdrop-blur-[2px]">
            Individual
          </span>
        </motion.div>
      </div>
    </div>
  );
}

/* ─── Typing cycle hook (gated by `enabled`) ─────────────────────── */

function useTypingCycle(
  options: string[],
  enabled: boolean,
  speedMs = 50,
  holdMs = 1600,
) {
  const [text, setText] = useState('');
  const [optionIdx, setOptionIdx] = useState(0);
  const indexRef = useRef(0);
  const phaseRef = useRef<'typing' | 'holding' | 'deleting'>('typing');

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      const target = options[optionIdx];
      const phase = phaseRef.current;

      if (phase === 'typing') {
        if (indexRef.current < target.length) {
          indexRef.current += 1;
          setText(target.slice(0, indexRef.current));
        } else {
          phaseRef.current = 'holding';
          setTimeout(() => {
            phaseRef.current = 'deleting';
          }, holdMs);
        }
      } else if (phase === 'deleting') {
        if (indexRef.current > 0) {
          indexRef.current -= 1;
          setText(target.slice(0, indexRef.current));
        } else {
          phaseRef.current = 'typing';
          setOptionIdx((i) => (i + 1) % options.length);
        }
      }
    };

    const interval = setInterval(tick, speedMs);
    return () => clearInterval(interval);
  }, [enabled, optionIdx, options, speedMs, holdMs]);

  return text;
}

/* ─── Typing panel — unified chrome for Scene / Front / Inside ───── */

// Hero copy is anchored to Studio card 120 (Sarah / anniversary,
// rooftop bar in NY). The Scene panel still types out its content
// for the "user is describing" feel, but only ever types this one
// scene. The Front + Inside panels are static (isStatic=true on
// StudioInputPanel) so they just render options[0] verbatim.
const SCENES = [
  'Celebrating their anniversary on a rooftop bar at sunset in New York, with the city skyline and central park visible below.',
];

const FRONT_TEXTS = [
  'Happy Anniversary Baby!',
];

const INSIDE_TEXTS = [
  "Happy 10th anniversary, Sarah.\nPack a bag — we're going to New York baby!\nLove you so much x",
];

/** Studio-input panel — used for all three typing windows on the
 *  hero (Scene, Front, Inside). White card with a sparkle-style icon
 *  header, divider, sans-serif typed body. The body's `minHeight` is
 *  passed in per use so the panel reserves enough space for the
 *  longest option in its option list — text grows INTO the reserved
 *  space rather than the panel jumping height as text fills. */
function StudioInputPanel({
  label,
  icon: Icon,
  options,
  multiline,
  speedMs,
  startDelayMs = 0,
  bodyMinHeight,
  bobDelay = 0,
  reduced,
  isStatic = false,
}: {
  label: string;
  icon: typeof Sparkles;
  options: string[];
  multiline?: boolean;
  speedMs?: number;
  startDelayMs?: number;
  /** Reserved body height — pre-sized to fit the longest option in
   *  this panel so the panel doesn't grow as text types. Use a
   *  fixed-pixel value or any valid CSS height. */
  bodyMinHeight: string;
  /** Stagger offset for the bob animation so panels don't bob in
   *  sync — each one feels alive on its own clock. */
  bobDelay?: number;
  /** Pass through `prefers-reduced-motion` so the panel can disable
   *  the bob entirely without an extra hook call per panel. */
  reduced: boolean;
  /** Render the first option as static text — no typing cycle, no
   *  cursor. Used to draw attention to the Scene panel's typing by
   *  keeping the Front + Inside panels still. */
  isStatic?: boolean;
}) {
  const [enabled, setEnabled] = useState(startDelayMs === 0);
  useEffect(() => {
    if (startDelayMs === 0) return;
    const t = setTimeout(() => setEnabled(true), startDelayMs);
    return () => clearTimeout(t);
  }, [startDelayMs]);

  // Skip the typing cycle entirely when static — render options[0].
  const typedText = useTypingCycle(
    options,
    enabled && !isStatic,
    speedMs ?? 45,
    1800,
  );
  const text = isStatic ? options[0] : typedText;

  return (
    <motion.div
      className="w-full bg-surface-card border border-stone-200 rounded-xl p-4 shadow-lg"
      animate={reduced ? undefined : { y: [0, -6, 0] }}
      transition={
        reduced
          ? undefined
          : {
              duration: 5.4,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: bobDelay,
            }
      }
    >
      <div className="flex items-center gap-2 mb-3 pb-3 border-b border-stone-100">
        <div className="w-7 h-7 rounded-full bg-brand-muted flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-brand" strokeWidth={2} />
        </div>
        <p className="text-xs md:text-sm font-semibold text-ink-soft tracking-tight">
          {label}
        </p>
      </div>
      <div
        aria-live="off"
        className={`text-sm text-ink leading-relaxed ${
          multiline ? 'whitespace-pre-line' : ''
        }`}
        style={{ minHeight: bodyMinHeight }}
      >
        {text}
        {!isStatic && (
          <span className="inline-block w-[1.5px] h-3.5 bg-brand animate-pulse align-middle ml-0.5" />
        )}
      </div>
    </motion.div>
  );
}

/* ─── Section composition ────────────────────────────────────────── */

export function HeroSection() {
  const { isAuthenticated, isLoading } = useAuth();
  const showAuthedTreatment = !isLoading && isAuthenticated;
  const reduced = useReducedMotion() ?? false;

  // Click-to-toggle interaction model. Card sits at a slight ajar
  // angle at rest (set on Card3DViewer below as `closedAngle={-0.5}`)
  // so first-time visitors get a peek at the inside without having
  // to interact. Clicking the card swings it fully open; clicking
  // again returns it to ajar. Spring physics inside Card3DViewer
  // handle the smooth motion. The card also bobs gently via the
  // `hover` prop — composed in the same useFrame so it doesn't fight
  // the cover rotation. GestureHints below tell the user what they
  // can do; they fade out once the card opens fully.
  const [open, setOpen] = useState(false);

  return (
    <section
      className="relative w-full overflow-visible pt-8 md:pt-12 pb-16 md:pb-20"
      style={{
        background:
          /* Pearl gradient — white → faintest cool grey. Reverted
             from the violet gradient (founder's call). */
          'linear-gradient(180deg, #ffffff 0%, #f8fafc 60%, #eef1f6 100%)',
      }}
    >
      <div className="relative max-w-[1280px] mx-auto px-6 md:px-10 overflow-visible">
        {/* Headline — "they'll keep" gets a violet shimmer wave that
            sweeps L→R every few seconds. Gradient is mostly ink with
            a narrow violet stripe; backgroundPosition animates within
            visible range so the text never goes transparent. */}
        <h1 className="relative z-0 text-[34px] sm:text-[42px] md:text-[48px] lg:text-[58px] xl:text-[64px] font-semibold text-ink leading-[0.95] tracking-[-0.02em] text-center">
          Greetings cards
          <br />
          <motion.span
            /* leading-[1.05] + pb grows the span's line box so the
               descenders on `g` and the period don't clip against
               the parent h1's leading-[0.95]. inline-block needed
               for bg-clip-text gradient containment. */
            className="bg-clip-text text-transparent inline-block px-1 leading-[1.05] pb-[0.12em] overflow-visible"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #0f172a 0%, #0f172a 30%, #7a76e8 45%, #5c57d4 50%, #7a76e8 55%, #0f172a 70%, #0f172a 100%)',
              backgroundSize: '220% 100%',
              backgroundRepeat: 'no-repeat',
            }}
            initial={{ backgroundPosition: '0% 0%' }}
            animate={
              reduced
                ? undefined
                : { backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }
            }
            transition={
              reduced
                ? undefined
                : {
                    /* Looping shimmer (founder call). Wave fires every
                       4s + 4.5s pause = ~9s cycle. Long enough that it
                       reads as deliberate magic, not constant motion. */
                    duration: 4,
                    repeat: Infinity,
                    repeatDelay: 4.5,
                    ease: 'easeInOut',
                    delay: 0.8,
                    times: [0, 0.5, 1],
                  }
            }
          >
            they'll keep.
          </motion.span>
        </h1>

        {/* Subline — single paragraph. The closing phrase "100%
            creative control" gets a stylish violet underline that
            draws in on mount and then slowly shimmers left→right
            forever. Decorative; aria-hidden on the underline so
            screen readers just hear the text. mt tightened (mt-6 →
            mt-4) so subline + card + hints all shift up a touch as
            a unit. */}
        <p className="mt-4 md:mt-5 text-base md:text-lg text-ink-soft leading-relaxed max-w-[56ch] mx-auto text-center">
          Celebrait good times with mind-blowing greetings cards that are
          impossible to forget. Printed &amp; delivered, or opened with a
          custom link.{' '}
          <span className="relative inline-block font-medium text-ink whitespace-nowrap">
            100% creative control.
            <motion.span
              aria-hidden
              className="absolute left-0 right-0 -bottom-0.5 h-[3px] origin-left rounded-full"
              style={{
                background:
                  'linear-gradient(90deg, #5c57d4 0%, #7a76e8 35%, #a78bfa 50%, #7a76e8 65%, #5c57d4 100%)',
                backgroundSize: '220% 100%',
              }}
              initial={
                reduced
                  ? { scaleX: 1, backgroundPosition: '0% 0%' }
                  : { scaleX: 0, backgroundPosition: '0% 0%' }
              }
              animate={
                reduced
                  ? { scaleX: 1 }
                  : {
                      scaleX: 1,
                      backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'],
                    }
              }
              transition={
                reduced
                  ? undefined
                  : {
                      scaleX: { duration: 1, delay: 0.9, ease: 'easeOut' },
                      backgroundPosition: {
                        duration: 6,
                        delay: 2,
                        repeat: Infinity,
                        ease: 'linear',
                      },
                    }
              }
            />
          </span>
        </p>

        {/* Three-column layout. Side cols lifted via negative grid mt
            but RELAXED a step so they sit a little lower (founder
            call). Centre col compensator matches the reduction so
            the card stays put — only side cols drop. */}
        <div className="mt-0 md:-mt-12 lg:-mt-14 xl:-mt-16 grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start overflow-visible">
          {/* LEFT — Photos + Scene. Outboard via negative margins
              that scale by breakpoint — at lg the -ml-10 cancels the
              container's px-10 exactly, so the column edge sits flush
              with the viewport-side of page padding. Mirrored on the
              right column for symmetry. Small extra negative `mt-X`
              pulls just the left column up a touch (founder call). */}
          <div className="md:col-span-3 order-2 md:order-1 md:-ml-4 lg:-ml-10 xl:-ml-16 flex flex-col gap-6 items-center md:items-start">
            <PhotoCollage reduced={reduced} />

            {/* Scene panel — small inward indent (pl-X) so it's not
                perfectly aligned with the photos above. */}
            <div className="w-full md:pl-4 lg:pl-6">
              <StudioInputPanel
                label="Describe the scene on the front"
                icon={Sparkles}
                options={SCENES}
                /* Sized taller — real scene descriptions will be longer
                   than the current placeholders. */
                bodyMinHeight="6.5em"
                bobDelay={0}
                reduced={reduced}
              />
            </div>

          </div>

          {/* CENTRE — card + hints up together one tiny step
              (mt-44→40 / 52→48 / 60→56). */}
          <div className="md:col-span-6 order-1 md:order-2 relative overflow-visible mt-0 md:mt-16 lg:mt-20 lg+:mt-24 xl:mt-32">
            <div className="relative w-full max-w-[340px] md:max-w-[340px] lg:max-w-[350px] lg+:max-w-[380px] xl:max-w-[400px] aspect-square mx-auto overflow-visible">
              {/* Bleed wrapper: vertical stays generous so opened
                  card has headroom, horizontal scales DOWN at smaller
                  viewports (vw is viewport-relative — at 900px, ±40vw
                  was footgunning into the side columns). z-[100] beats
                  the motion shimmer span on the headline. */}
              <div
                className="absolute top-[-30vh] bottom-[-30vh] left-[-25vw] right-[-25vw] lg+:left-[-35vw] lg+:right-[-35vw] xl:left-[-40vw] xl:right-[-40vw] z-[100] pointer-events-none"
                style={{
                  filter: 'drop-shadow(0 28px 40px rgba(15,23,42,0.12))',
                }}
              >
                <Suspense fallback={<CardLoader />}>
                  <Card3DViewer
                    frontImageUrl={heroCardFront}
                    insideImageUrl={heroCardInside}
                    backCredit="Made with Celebrait"
                    open={open}
                    onOpenChange={setOpen}
                    framingMargin={2.4}
                    minDistance={2.2}
                    /* Rotate ON (drag), zoom OFF — card stays at the
                       mount framing while still inviting playful
                       rotation. Tap-to-open hinge is wired to the
                       `open` state above (controlled). */
                    enableZoom={false}
                    enableRotate={true}
                    /* Resting ajar (Kevin 2026-06-01): a gentle peek so
                       the card reads as a real openable object, not a flat
                       image. Earlier attempts looked lopsided because the
                       angle was too big on a dead-on camera (the cover
                       hinges on one side, so a big swing skews). -0.3 rad
                       (~17°, ~14% of the full open) is a modest peek.
                       Matches the brainstorm reveal + studio card view. */
                    closedAngle={-0.3}
                    /* Slight left angle on the resting card so the ajar
                       reads as 3D depth, not a flat skew. Tunable; matches
                       the other surfaces. */
                    restYaw={-0.1}
                    /* Hit zone hugs the card (2026-06-01). Previously the
                       hit zone was sized as a % of the bleed-wrapper WIDTH
                       (closed 30% → ~40% of bleed width), which — because
                       the bleed is huge — still extended well past the card
                       silhouette: you could grab/rotate on empty space
                       around it (Kevin). Dropping the explicit insets lets
                       Card3DViewer auto-size the hit zone to the card's
                       actual rendered footprint in px (same fix as the
                       studio card view). Card-hug applies in both states;
                       the centred inside spread is still covered when open. */
                    className="w-full h-full"
                  />
                </Suspense>
              </div>
            </div>

            {/* Gesture hints — z-[70] above the card's bleed (z-100
                stays clear because hints are siblings, not children
                of the bleed). The container reserves a fixed
                min-height so when hints exit the DOM (via their
                internal AnimatePresence on card open), the CTA stack
                below doesn't snap up into the freed space — the
                space stays reserved, the hints just fade away.
                Hints mt bumped (mt-6/8 → mt-12/14) per founder call;
                the button stack's mt is reduced by the same amount
                (mt-8/12 → mt-2/6) so the CTA doesn't shift. */}
            <div className="relative mt-12 md:mt-14 z-[70] min-h-[64px]">
              <GestureHints open={open} hideZoomHint />
            </div>

            {/* CTA + watch button — centred stack, no desktop flanks. */}
            <div className="relative z-[70] mt-2 md:mt-6 flex flex-col items-center gap-4">
              {showAuthedTreatment ? (
                <Link href="/studio">
                  <Button className="bg-brand hover:bg-brand-dark text-brand-foreground h-12 px-8 text-base font-medium">
                    Open my studio
                  </Button>
                </Link>
              ) : (
                <Link href="/login?redirect=/studio/new-card">
                  <Button className="bg-brand hover:bg-brand-dark text-brand-foreground h-12 px-8 text-base font-medium">
                    Make my first card
                  </Button>
                </Link>
              )}
              <p className="-mt-2 text-[13px] text-ink-soft">
                Free to start. No card needed.
              </p>
            </div>
          </div>

          {/* RIGHT — Front + Inside. Mirror of LEFT: outboard
              negative margins per breakpoint so the column edge
              extends past the right-side header chrome (Open my
              studio button) by the same amount the left extends past
              the wordmark. Per-block `max-w-[280px]` dropped so the
              column inhabits its full md:col-span-3 width — Symmetric
              with the left column which uses col-span width too. */}
          <div className="md:col-span-3 order-3 md:-mr-4 lg:-mr-10 xl:-mr-16 flex flex-col gap-8 items-center md:items-end">
            {/* Front box — narrower than Inside since the front-text
                content is one short line. Balances visually with the
                photo collage on the left (similar width). */}
            <div className="w-full max-w-[240px]">
              <StudioInputPanel
                label="Add text to the front"
                icon={Type}
                options={FRONT_TEXTS}
                bodyMinHeight="3.5em"
                bobDelay={1.6}
                reduced={reduced}
                isStatic
              />
            </div>

            {/* Inside box — full column width for the multiline
                Dear/From paragraph. Small inward indent (pr-X) so
                it's not perfectly aligned with the Front box above. */}
            <div className="w-full md:pr-4 lg:pr-6">
              <StudioInputPanel
                label="Add text to the inside"
                icon={PenLine}
                options={INSIDE_TEXTS}
                multiline
                /* Inside is multi-line (Dear / message / From) — ~5
                   lines max at this width with leading-relaxed. */
                bodyMinHeight="8.5em"
                bobDelay={3.2}
                reduced={reduced}
                isStatic
              />
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
