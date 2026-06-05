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

import { useRef, useState } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionTemplate,
  useMotionValueEvent,
  useReducedMotion,
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
import revealFront from '@/assets/hero-card-front.png';
import revealInside from '@/assets/hero-card-inside.png';

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

export default function HeroScrollPocPage() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress: rawProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });
  // The intro is now a normal hero section ABOVE; the dolly stage is sticky-
  // pinned below it. This virtual progress crops the (removed) intro out of the
  // timing so the flow starts at photos — every beat keeps its original 0→1
  // numbers, they just play over [.13, 1] of the pinned scroll.
  const scrollYProgress = useTransform(rawProgress, [0, 1], [0.14, 1]);

  // Beat 4 — how many photos have "selected" in (0–3).
  const [photoSel, setPhotoSel] = useState(0);
  // Beat 5 — how many characters of the scene have "typed" in.
  const [sceneLen, setSceneLen] = useState(0);
  // Beat 6 — how many characters of the front headline have "typed" in.
  const [frontLen, setFrontLen] = useState(0);
  // Beat 7 — how many characters of the inside message have "typed" in.
  const [insideLen, setInsideLen] = useState(0);

  // Drive the studio card as we approach beat 3: name + occasion toggle IN
  // SYNC while cycling, land on Sarah + Anniversary, then "press" Anniversary.
  useMotionValueEvent(scrollYProgress, 'change', (v) => {

    // Three build beats animate across their crawl (slow zone). Centres:
    // .27 (photos) / .50 (put them in the picture: scene→front) / .72 (inside).
    const ps = clamp((v - 0.245) / (0.285 - 0.245), 0, 1);
    setPhotoSel(Math.min(SELECT_ORDER.length, Math.floor(ps * (SELECT_ORDER.length + 1))));

    // Put them in the picture — scene types across the crawl (centre .50).
    const ps5 = clamp((v - 0.45) / (0.53 - 0.45), 0, 1);
    setSceneLen(Math.round(ps5 * SCENE_TEXT.length));

    // Add your words (centre .72) — front headline types first…
    const ps6 = clamp((v - 0.66) / (0.70 - 0.66), 0, 1);
    setFrontLen(Math.round(ps6 * FRONT_TEXT.length));

    // …then the full inside message.
    const ps7 = clamp((v - 0.70) / (0.78 - 0.70), 0, 1);
    setInsideLen(Math.round(ps7 * INSIDE_MESSAGE.length));
  });

  // ── Unified timing ─────────────────────────────────────────────────
  // Every content beat shares ONE motion profile so the journey reads as one
  // continuous dolly: fast approach (−720→−40) → slow crawl (−40→40, the
  // readable beat where content animates) → fast exit (40→820). Crawl centres
  // are evenly spaced (~.135 apart) at .22 / .355 / .49 / .625 / .76; opacity
  // is held tight to each crawl with a ~.01 overlap at every seam (no white
  // gap — a faint crossfade). The finale (3D card) lands + opens, no dolly.
  //
  // Three build beats: photos (.27) / put them in the picture (.50, wide) /
  // inside (.72). Then the finale.
  // Beat 2 — "Select your photo(s)" (centre .27).
  const z4 = useTransform(scrollYProgress, [0.14, 0.245, 0.295, 0.4], [-720, -40, 40, 820]);
  const o4 = useTransform(scrollYProgress, [0.14, 0.205, 0.295, 0.37], [0, 1, 1, 0]);
  // Beat 3 — "Put them in the picture" (centre .50, wider crawl: scene+front).
  const z5 = useTransform(scrollYProgress, [0.37, 0.45, 0.55, 0.63], [-720, -40, 40, 820]);
  const o5 = useTransform(scrollYProgress, [0.4, 0.45, 0.55, 0.6], [0, 1, 1, 0]);
  // Beat 4 — "Add your words" (centre .72, wide crawl: front then message).
  const z7 = useTransform(scrollYProgress, [0.59, 0.66, 0.78, 0.85], [-720, -40, 40, 820]);
  const o7 = useTransform(scrollYProgress, [0.62, 0.66, 0.78, 0.82], [0, 1, 1, 0]);
  // Finale — a spinner spins as you scroll in (the studio's "creating your
  // card" moment), fades, then the finished card fades in (in sync with the
  // spinner), opens, then simply fades out into the regen screen (no zoom).
  // openProgress scrubs the hinge 1:1 with scroll.
  // Blank card dollies in while the spinner loads → render SWIPES in → the
  // cover OPENS (revealing the inside) → it drops off-screen to "Send it".
  const spinnerRot = useTransform(scrollYProgress, [0.8, 0.89], [0, 540]);
  const spinnerO = useTransform(scrollYProgress, [0.8, 0.82, 0.875, 0.89], [0, 1, 1, 0]);
  const zCard = useTransform(scrollYProgress, [0.82, 0.88], [-720, 0]);
  const backdropO = useTransform(scrollYProgress, [0.82, 0.865, 1], [0, 1, 1]);
  const swipeProgress = useTransform(scrollYProgress, [0.885, 0.92], [0, 1]);
  const openProgress = useTransform(scrollYProgress, [0.925, 0.97], [0, 1]);
  const yCard = useTransform(scrollYProgress, [0.975, 1], [0, 1100]);
  // "Send it" is revealed as the card drops away.
  const oSend = useTransform(scrollYProgress, [0.975, 0.995, 1], [0, 1, 1]);

  return (
    <>
      {/* Constant gradient backdrop — seamless across the hero + the stage. */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 32%, #ffffff 0%, #f4f3fb 55%, #efeefb 100%)',
        }}
      />

      {/* Hero — a normal landing section you just scroll past, over a faded
          field of floating card renders. */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
        <FloatingCards />
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

      {/* Dolly stage — sticky-pinned; the flow plays as you scroll through. */}
      <div ref={ref} className="relative" style={{ height: '1100vh' }}>
        <div
          className="sticky top-0 h-screen overflow-hidden"
          style={{ perspective: '1000px' }}
        >
          {/* Blank card dollies in (spinner loading) → render swipes in → opens → drops. */}
          <motion.div
            style={{ z: zCard, y: yCard, opacity: backdropO }}
            className="pointer-events-none absolute inset-0 flex items-center justify-center will-change-transform"
          >
            <MagicCard swipe={swipeProgress} open={openProgress} />
          </motion.div>

          {/* Headline + photo picker as one unit — photos "select in" as it lands. */}
        <Layer z={z4} opacity={o4}>
          <div className="flex flex-col items-center gap-7 sm:gap-9">
            <h1 className={CHOOSE_CLASS}>Select your photo(s)</h1>
            <PhotoCard selected={photoSel} />
          </div>
        </Layer>

        {/* Put them in the picture — scene description types in. */}
        <Layer z={z5} opacity={o5}>
          <div className="flex flex-col items-center gap-7 sm:gap-9">
            <h1 className={CHOOSE_CLASS}>Put them in the picture</h1>
            <PictureCard scene={SCENE_TEXT.slice(0, sceneLen)} />
          </div>
        </Layer>

        {/* Add your words — front headline then the full inside message. */}
        <Layer z={z7} opacity={o7}>
          <div className="flex flex-col items-center gap-7 sm:gap-9">
            <h1 className={CHOOSE_CLASS}>Add your words</h1>
            <WordsCard
              front={FRONT_TEXT.slice(0, frontLen)}
              message={INSIDE_MESSAGE.slice(0, insideLen)}
            />
          </div>
        </Layer>

        {/* Finale — a spinner spins as you scroll (the "creating your card"
            moment), then the finished 3D card reveals + opens. */}
        <motion.div
          style={{ opacity: spinnerO }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6"
        >
          <motion.div style={{ rotate: spinnerRot }}>
            <Loader2 className="w-14 h-14 text-brand" strokeWidth={2} />
          </motion.div>
        </motion.div>

        {/* Finale — "Send it", revealed in the centre as the card drops away. */}
        <motion.div
          style={{ opacity: oSend }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center px-6"
        >
          <h1 className={CHOOSE_CLASS}>Send it</h1>
        </motion.div>

        </div>
      </div>
    </>
  );
}

const HEADLINE_CLASS =
  'text-[40px] sm:text-[56px] md:text-[68px] lg:text-[80px] font-semibold text-ink leading-[0.95] tracking-[-0.02em] text-center';

// Paired headline (above the studio card) — smaller than the solo hero
// headlines so the headline + card fit the viewport together.
const CHOOSE_CLASS =
  'text-[30px] sm:text-[40px] md:text-[48px] font-semibold text-ink leading-[1.0] tracking-[-0.02em] text-center';

function Layer({
  z,
  opacity,
  children,
}: {
  z: MotionValue<number>;
  opacity: MotionValue<number>;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      style={{ z, opacity }}
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

function PhotoCard({ selected }: { selected: number }) {
  const isSelected = (i: number) => {
    const pos = SELECT_ORDER.indexOf(i);
    return pos !== -1 && pos < selected;
  };
  return (
    <div className="w-[340px] sm:w-[380px] rounded-[28px] bg-white px-6 py-7 shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70">
      <div className="grid grid-cols-3 gap-2.5">
        {PHOTOS.map((g, i) => {
          const sel = isSelected(i);
          return (
            <div
              key={i}
              className={`relative aspect-square rounded-xl overflow-hidden bg-gradient-to-br ${g} ring-2 transition-all duration-200 ${
                sel ? 'ring-brand' : 'ring-transparent'
              } ${selected > 0 && !sel ? 'opacity-60' : 'opacity-100'}`}
            >
              <span className="absolute inset-0 flex items-center justify-center">
                <User className="w-7 h-7 text-white/75" strokeWidth={1.75} />
              </span>
              <motion.div
                initial={false}
                animate={{ opacity: sel ? 1 : 0, scale: sel ? 1 : 0.5 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-brand flex items-center justify-center shadow-md"
              >
                <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
              </motion.div>
            </div>
          );
        })}
      </div>

      <p className="text-[13px] mt-4 h-5 text-center font-semibold text-ink">
        {selected > 0 ? `Sarah — ${selected} selected` : ''}
      </p>
    </div>
  );
}

// "Put them in the picture" — just the scene description, types itself in.
function PictureCard({ scene }: { scene: string }) {
  const empty = scene.length === 0;
  return (
    <div className="w-[340px] sm:w-[380px] rounded-[28px] bg-white px-6 py-7 shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70">
      <p className="mb-1.5 text-[13px] text-ink">The picture</p>
      <div className="h-[150px] overflow-hidden rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[15px] leading-relaxed text-ink">
        {empty ? (
          <span className="text-stone-400">
            e.g. Sarah at golden hour on an Italian terrace…
          </span>
        ) : (
          <span>
            {scene}
            <span className="ml-0.5 inline-block h-[16px] w-[2px] animate-pulse bg-brand align-middle" />
          </span>
        )}
      </div>
    </div>
  );
}

// "Add your words" — what's on the front (headline) + what's on the inside
// (the full message). Front types first, then the message.
function WordsCard({ front, message }: { front: string; message: string }) {
  const fEmpty = front.length === 0;
  const mEmpty = message.length === 0;
  return (
    <div className="w-[340px] sm:w-[380px] rounded-[28px] bg-white px-6 py-7 shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70">
      {/* What's on the front? */}
      <p className="mb-1.5 text-[13px] text-ink">What's on the front?</p>
      <div className="flex min-h-[46px] items-center rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[15px]">
        {fEmpty ? (
          <span className="text-stone-400">Happy Anniversary</span>
        ) : (
          <span className="font-medium text-ink">
            {front}
            <span className="ml-0.5 inline-block h-[16px] w-[2px] animate-pulse bg-brand align-middle" />
          </span>
        )}
      </div>

      {/* What's on the inside? */}
      <p className="mb-1.5 mt-4 text-[13px] text-ink">What's on the inside?</p>
      <div className="h-[120px] overflow-hidden rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[14px] leading-relaxed text-ink">
        {mEmpty ? (
          <span className="text-stone-400">Write a few words from the heart…</span>
        ) : (
          <span>
            {message}
            <span className="ml-0.5 inline-block h-[15px] w-[2px] animate-pulse bg-brand align-middle" />
          </span>
        )}
      </div>
    </div>
  );
}

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
const CARD_W = 340; // px — fixed for the hinge geometry (POC: desktop-first)

// Paper treatment for the finale card faces — a soft drop shadow + top-edge
// highlight + hairline (gives it lift + thickness), plus a surface-shading
// gradient and a faint grain so it reads as paper, not a flat sticker.
const CARD_SHADOW =
  '0 30px 56px -22px rgba(15,23,42,0.55), 0 8px 16px -9px rgba(15,23,42,0.32), inset 0 1px 0 rgba(255,255,255,0.6), 0 0 0 1px rgba(15,23,42,0.07)';
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
}: {
  swipe: MotionValue<number>;
  open: MotionValue<number>;
}) {
  // Front render swipe — left→right wipe with a glowing edge.
  const rightInset = useTransform(swipe, [0, 1], [100, 0]);
  const frontClip = useMotionTemplate`inset(0% ${rightInset}% 0% 0%)`;
  const lineLeft = useTransform(swipe, [0, 1], ['0%', '100%']);
  const lineO = useTransform(swipe, [0, 0.05, 0.95, 1], [0, 1, 1, 0]);

  // Cover hinge — swings open around the spine (left edge).
  const coverRotY = useTransform(open, [0, 1], [0, -158]);
  const coverTransform = useMotionTemplate`rotateY(${coverRotY}deg)`;
  // Shadow the opening cover casts across the inside.
  const shadowO = useTransform(open, [0, 0.25, 0.6, 1], [0, 0.5, 0.34, 0.24]);

  return (
    <div style={{ perspective: 1600 }} className="relative">
      {/* The card box stays put (static, centred); the cover hinges open to the
          left around the spine — same as the 3D render, no recentering. */}
      <div
        className="relative"
        style={{ width: CARD_W, height: CARD_W, transformStyle: 'preserve-3d' }}
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
            <motion.div
              aria-hidden
              style={{ left: lineLeft, opacity: lineO }}
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

// ── Floating card field (hero background) ───────────────────────────
// Faded, static card renders around the PERIPHERY (a centre mask keeps the
// headline clear) — mostly closed with a couple open, varied sizes/tilts,
// gently drifting. Hand-placed so they frame, not clutter.
const FLOATING = [
  { x: 6, y: 17, size: 140, openDeg: 0, rot: -7, opacity: 0.08, delay: 0, dur: 8, drift: 12 },
  { x: 5, y: 48, size: 170, openDeg: 0, rot: 5, opacity: 0.07, delay: 1.2, dur: 9, drift: -14 },
  { x: 11, y: 74, size: 128, openDeg: 138, rot: -6, opacity: 0.06, delay: 0.6, dur: 10, drift: 10 },
  { x: 25, y: 89, size: 108, openDeg: 0, rot: 8, opacity: 0.07, delay: 2, dur: 8, drift: -10 },
  { x: 33, y: 9, size: 98, openDeg: 0, rot: -5, opacity: 0.06, delay: 1.6, dur: 9, drift: 9 },
  { x: 67, y: 8, size: 118, openDeg: 0, rot: 6, opacity: 0.07, delay: 0.3, dur: 10, drift: -11 },
  { x: 94, y: 21, size: 128, openDeg: 0, rot: 7, opacity: 0.08, delay: 1, dur: 8, drift: 13 },
  { x: 93, y: 52, size: 165, openDeg: 142, rot: -5, opacity: 0.07, delay: 0.8, dur: 9, drift: -12 },
  { x: 95, y: 79, size: 124, openDeg: 0, rot: 5, opacity: 0.06, delay: 2.2, dur: 10, drift: 10 },
  { x: 76, y: 88, size: 112, openDeg: 0, rot: -8, opacity: 0.07, delay: 1.4, dur: 8, drift: -9 },
  { x: 86, y: 13, size: 92, openDeg: 0, rot: 4, opacity: 0.05, delay: 0.5, dur: 11, drift: 8 },
];

function FloatingCard({
  x,
  y,
  size,
  openDeg,
  rot,
  opacity,
}: (typeof FLOATING)[number]) {
  return (
    <div className="absolute" style={{ left: `${x}%`, top: `${y}%`, opacity }}>
      <div
        className="relative"
        style={{
          perspective: 1200,
          transform: `translate(-50%, -50%) rotate(${rot}deg)`,
        }}
      >
        <div
          className="relative"
          style={{ width: size, height: size, transformStyle: 'preserve-3d' }}
        >
          {/* inside-right */}
          <div className="absolute inset-0 overflow-hidden rounded-[5px] bg-white ring-1 ring-stone-200/50">
            <img
              src={revealInside}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>
          {/* cover — opened by openDeg */}
          <div
            className="absolute inset-0"
            style={{
              transformOrigin: 'left center',
              transform: `rotateY(${-openDeg}deg)`,
              transformStyle: 'preserve-3d',
            }}
          >
            <div
              className="absolute inset-0 overflow-hidden rounded-[5px] ring-1 ring-stone-200/50"
              style={{ backfaceVisibility: 'hidden' }}
            >
              <img
                src={revealFront}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
            <div
              className="absolute inset-0 rounded-[5px] bg-white ring-1 ring-stone-200/50"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function FloatingCards() {
  // Radial mask — fully transparent in the centre (so the headline is never
  // crowded), fading the cards in only toward the edges.
  const mask =
    'radial-gradient(62% 56% at 50% 44%, transparent 0%, transparent 48%, #000 88%)';
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {FLOATING.map((c, i) => (
        <FloatingCard key={i} {...c} />
      ))}
    </div>
  );
}

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
