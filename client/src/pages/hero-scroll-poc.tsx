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
import { Card3DViewer } from '@/components/card-3d-viewer';
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
const INSIDE_GREETING = 'Dear Sarah,';
const INSIDE_MESSAGE =
  "Twenty-five years, and you still make me laugh like it's day one. Here's to every adventure still to come.";
const INSIDE_SIGNOFF = 'All my love, Mum';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function HeroScrollPocPage() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref });

  const [name, setName] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [pressed, setPressed] = useState(false);
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

    // Photos "select in" across the crawl (centre .35).
    const ps = clamp((v - 0.325) / (0.365 - 0.325), 0, 1);
    setPhotoSel(Math.min(SELECT_ORDER.length, Math.floor(ps * (SELECT_ORDER.length + 1))));

    // Design the front (centre .53) — scene types first…
    const ps5 = clamp((v - 0.47) / (0.515 - 0.47), 0, 1);
    setSceneLen(Math.round(ps5 * SCENE_TEXT.length));

    // …then the front headline (before the render paints over at .535).
    const ps6 = clamp((v - 0.515) / (0.535 - 0.515), 0, 1);
    setFrontLen(Math.round(ps6 * FRONT_TEXT.length));

    // Design the inside (centre .72) — message types (before render at .71).
    const ps7 = clamp((v - 0.66) / (0.71 - 0.66), 0, 1);
    setInsideLen(Math.round(ps7 * INSIDE_MESSAGE.length));


    // Choose celebration (centre .21) — name stays "Sarah"; occasions toggle
    // on approach, Anniversary "clicked" (pressed) as we pass.
    const sub = clamp((v - 0.135) / (0.22 - 0.135), 0, 1);
    if (sub <= 0) {
      setName('');
      setSelectedIdx(-1);
      setPressed(false);
      return;
    }
    setName(FINAL_NAME); // static "Sarah"
    if (sub < 0.8) {
      const steps = Math.floor((sub / 0.8) * 12);
      setSelectedIdx(steps % OCC.length);
      setPressed(false);
    } else {
      setSelectedIdx(ANNIVERSARY_IDX);
      setPressed(sub > 0.9); // tap Anniversary near the end of the approach
    }
  });

  // ── Unified timing ─────────────────────────────────────────────────
  // Every content beat shares ONE motion profile so the journey reads as one
  // continuous dolly: fast approach (−720→−40) → slow crawl (−40→40, the
  // readable beat where content animates) → fast exit (40→820). Crawl centres
  // are evenly spaced (~.135 apart) at .22 / .355 / .49 / .625 / .76; opacity
  // is held tight to each crawl with a ~.01 overlap at every seam (no white
  // gap — a faint crossfade). The finale (3D card) lands + opens, no dolly.
  //
  // Beat 1 — intro: full at top, zooms through + fades.
  const z1 = useTransform(scrollYProgress, [0, 0.16], [0, 880]);
  const o1 = useTransform(scrollYProgress, [0, 0.08, 0.16], [1, 1, 0]);
  // Four build beats: choose / photos / Design the front / Design the inside.
  // The two design beats are wider — text inputs type in, THEN the AI render
  // paints over them inside the same square.
  // Beat 2 — "Choose your celebration" + card (centre .21).
  const zChoose = useTransform(scrollYProgress, [0.11, 0.185, 0.235, 0.31], [-720, -40, 40, 820]);
  const oChoose = useTransform(scrollYProgress, [0.14, 0.185, 0.235, 0.28], [0, 1, 1, 0]);
  // Confetti burst — fires out of the card as Anniversary is "clicked" (~.21).
  const burst = useTransform(scrollYProgress, [0.205, 0.26], [0, 1]);
  // Beat 3 — "Select your photo(s)" (centre .35).
  const z4 = useTransform(scrollYProgress, [0.25, 0.325, 0.375, 0.45], [-720, -40, 40, 820]);
  const o4 = useTransform(scrollYProgress, [0.28, 0.325, 0.375, 0.42], [0, 1, 1, 0]);
  // Beat 4 — "Design the front" (centre .53, wide crawl). Scene+front type,
  // then the front render paints over.
  const z5 = useTransform(scrollYProgress, [0.43, 0.47, 0.59, 0.63], [-720, -40, 40, 820]);
  const o5 = useTransform(scrollYProgress, [0.425, 0.47, 0.59, 0.635], [0, 1, 1, 0]);
  const frontRender = useTransform(scrollYProgress, [0.535, 0.585], [0, 1]);
  // Beat 5 — "Design the inside" (centre .72, wide crawl). Message types, then
  // the inside render paints over.
  const z7 = useTransform(scrollYProgress, [0.62, 0.66, 0.78, 0.82], [-720, -40, 40, 820]);
  const o7 = useTransform(scrollYProgress, [0.615, 0.66, 0.78, 0.825], [0, 1, 1, 0]);
  const insideRender = useTransform(scrollYProgress, [0.71, 0.77], [0, 1]);
  // Finale — a spinner spins as you scroll in (the studio's "creating your
  // card" moment), fades, then the finished card fades in (in sync with the
  // spinner), opens, then simply fades out into the regen screen (no zoom).
  // openProgress scrubs the hinge 1:1 with scroll.
  const spinnerRot = useTransform(scrollYProgress, [0.835, 0.89], [0, 540]);
  const spinnerO = useTransform(scrollYProgress, [0.835, 0.85, 0.87, 0.885], [0, 1, 1, 0]);
  // Card: fades in with the spinner, opens (see inside), closes again, then
  // slides DOWN off the screen — the "send it" gesture. Stays full opacity; it
  // leaves by sliding, not fading.
  const backdropO = useTransform(scrollYProgress, [0.835, 0.875, 1], [0, 1, 1]);
  const openProgress = useTransform(scrollYProgress, [0.875, 0.905, 0.93, 0.955], [0, 1, 1, 0]);
  const yCard = useTransform(scrollYProgress, [0.95, 1], [0, 1100]);
  // "Send it" is revealed as the card drops away.
  const oSend = useTransform(scrollYProgress, [0.95, 0.99, 1], [0, 1, 1]);

  const hintO = useTransform(scrollYProgress, [0, 0.07], [1, 0]);

  return (
    <div ref={ref} className="relative" style={{ height: '1400vh' }}>
      <div
        className="fixed inset-0 overflow-hidden"
        style={{
          perspective: '1000px',
          background:
            'radial-gradient(120% 90% at 50% 32%, #ffffff 0%, #f4f3fb 55%, #efeefb 100%)',
        }}
      >
        {/* The finished card — invisible through the steps (clean white), fades
            in during the spinner phase, opens (see inside), closes, then slides
            DOWN off the screen — sent. */}
        <motion.div
          style={{ opacity: backdropO, y: yCard }}
          className="pointer-events-none absolute inset-0 flex items-center justify-center will-change-transform"
        >
          <div className="relative w-full max-w-[460px] sm:max-w-[540px] aspect-square mx-auto">
            <div
              className="absolute top-[-30vh] bottom-[-30vh] left-[-25vw] right-[-25vw]"
              style={{ filter: 'drop-shadow(0 28px 40px rgba(15,23,42,0.12))' }}
            >
              <Card3DViewer
                frontImageUrl={revealFront}
                insideImageUrl={revealInside}
                openProgress={openProgress}
                closedAngle={0}
                restYaw={-0.1}
                interactive={false}
                enableRotate={false}
                enableZoom={false}
                framingMargin={1.8}
                minDistance={1.8}
                className="w-full h-full"
              />
            </div>
          </div>
        </motion.div>

        <Layer z={z1} opacity={o1}>
          <HeadlineIntro reduced={!!reduced} />
        </Layer>

        {/* Headline + card are ONE unit — fade in and dolly together, text
            above the asset. */}
        <Layer z={zChoose} opacity={oChoose}>
          <div className="flex flex-col items-center gap-7 sm:gap-9">
            <h1 className={CHOOSE_CLASS}>Choose your celebration</h1>
            <div className="relative">
              <StudioCard name={name} selectedIdx={selectedIdx} pressed={pressed} />
              <ConfettiBurst burst={burst} />
            </div>
          </div>
        </Layer>

        {/* Headline + photo picker as one unit — photos "select in" as it lands. */}
        <Layer z={z4} opacity={o4}>
          <div className="flex flex-col items-center gap-7 sm:gap-9">
            <h1 className={CHOOSE_CLASS}>Select your photo(s)</h1>
            <PhotoCard selected={photoSel} />
          </div>
        </Layer>

        {/* Design the front — scene + front headline type into the square,
            then the front render paints over them. */}
        <Layer z={z5} opacity={o5}>
          <div className="flex flex-col items-center gap-7 sm:gap-9">
            <h1 className={CHOOSE_CLASS}>Design the front</h1>
            <DesignSquare image={revealFront} renderProgress={frontRender}>
              <SquareField
                label="The picture"
                value={SCENE_TEXT.slice(0, sceneLen)}
                placeholder="e.g. Sarah at golden hour on an Italian terrace…"
                live
                grow
              />
              <SquareField
                label="Front headline"
                value={FRONT_TEXT.slice(0, frontLen)}
                placeholder="Happy Anniversary"
                live
                minH={50}
              />
            </DesignSquare>
          </div>
        </Layer>

        {/* Design the inside — greeting / message / sign-off into the square,
            then the inside render paints over them. */}
        <Layer z={z7} opacity={o7}>
          <div className="flex flex-col items-center gap-7 sm:gap-9">
            <h1 className={CHOOSE_CLASS}>Design the inside</h1>
            <DesignSquare image={revealInside} renderProgress={insideRender}>
              <SquareField label="Greeting" value={INSIDE_GREETING} minH={50} />
              <SquareField
                label="Message"
                value={INSIDE_MESSAGE.slice(0, insideLen)}
                placeholder="Write a few words from the heart…"
                live
                grow
              />
              <SquareField label="Sign-off" value={INSIDE_SIGNOFF} minH={50} />
            </DesignSquare>
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

        <motion.div
          style={{ opacity: hintO }}
          className="absolute inset-x-0 bottom-10 flex justify-center"
        >
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-9 h-9 flex items-center justify-center text-cta">
              <ScrollGlyph />
            </div>
            <span className="text-[10px] uppercase tracking-[0.15em] text-stone-500">
              Scroll to walk through
            </span>
          </div>
        </motion.div>
      </div>
    </div>
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

// A square "design" container — text inputs sit inside, then the AI render
// paints OVER them (scan-reveal, top→down) as `renderProgress` goes 0→1. Used
// for both Design the front and Design the inside (same move, different art).
function DesignSquare({
  image,
  renderProgress,
  children,
}: {
  image: string;
  renderProgress: MotionValue<number>;
  children: React.ReactNode;
}) {
  const bottomInset = useTransform(renderProgress, [0, 1], [100, 0]);
  const clipPath = useMotionTemplate`inset(0% 0% ${bottomInset}% 0%)`;
  const scanTopPct = useTransform(renderProgress, [0, 1], [0, 100]);
  const scanTop = useMotionTemplate`${scanTopPct}%`;
  const scanO = useTransform(renderProgress, [0, 0.04, 0.96, 1], [0, 1, 1, 0]);
  return (
    <div className="relative aspect-square w-[300px] overflow-hidden rounded-[12px] bg-white shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70 sm:w-[340px]">
      {/* Text inputs — underneath, get painted over by the render. They fill
          the square (the main field grows) with a small even margin. */}
      <div className="absolute inset-0 flex flex-col gap-4 px-6 py-6">
        {children}
      </div>
      {/* The render paints over the inputs, revealed top→down. */}
      <motion.img
        src={image}
        alt=""
        style={{ clipPath }}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Bright scan line at the render edge. */}
      <motion.div
        aria-hidden
        style={{ top: scanTop, opacity: scanO }}
        className="pointer-events-none absolute inset-x-0 h-[3px] -translate-y-1/2 bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_20px_5px_rgba(255,255,255,0.85)]"
      />
    </div>
  );
}

// A compact field used inside DesignSquare. `live` = typing field (brand
// border + cursor); otherwise a static filled field.
function SquareField({
  label,
  value,
  placeholder,
  live = false,
  grow = false,
  minH = 38,
}: {
  label: string;
  value: string;
  placeholder?: string;
  live?: boolean;
  grow?: boolean;
  minH?: number;
}) {
  const empty = value.length === 0;
  return (
    <div className={`flex flex-col ${grow ? 'flex-1' : ''}`}>
      <p className="mb-1.5 text-[14px] font-medium text-stone-500">{label}</p>
      <div
        className={`overflow-hidden rounded-xl px-3.5 py-2.5 text-[17px] leading-relaxed ${
          grow ? 'flex-1' : 'flex items-center'
        } ${
          live
            ? 'border-2 border-brand/50 bg-stone-50'
            : 'border border-stone-200 bg-stone-50'
        }`}
        style={grow ? undefined : { minHeight: minH }}
      >
        {empty ? (
          <span className="text-stone-400">{placeholder}</span>
        ) : (
          <span className="text-ink">
            {value}
            {live && (
              <span className="ml-0.5 inline-block h-[18px] w-[2px] animate-pulse bg-brand align-middle" />
            )}
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
