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
  Wand2,
  Sparkles,
  Type,
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
  // Finale — the 3D card swings open once you scroll past the reveal point.
  const [revealOpen, setRevealOpen] = useState(false);

  // Drive the studio card as we approach beat 3: name + occasion toggle IN
  // SYNC while cycling, land on Sarah + Anniversary, then "press" Anniversary.
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    // Each content beat's animation runs across its crawl, starting exactly as
    // the card slows (crawl start = centre − .025) so type-in syncs with the
    // deceleration. Centres: .22 / .355 / .49 / .625 / .76, then the finale.
    // Photos "select in" across the crawl (centre .355).
    const ps = clamp((v - 0.33) / (0.37 - 0.33), 0, 1);
    setPhotoSel(Math.min(SELECT_ORDER.length, Math.floor(ps * (SELECT_ORDER.length + 1))));

    // Design the front — scene types in (centre .49).
    const ps5 = clamp((v - 0.465) / (0.505 - 0.465), 0, 1);
    setSceneLen(Math.round(ps5 * SCENE_TEXT.length));

    // Add text to the front (centre .625).
    const ps6 = clamp((v - 0.6) / (0.64 - 0.6), 0, 1);
    setFrontLen(Math.round(ps6 * FRONT_TEXT.length));

    // Add text on the inside (centre .76).
    const ps7 = clamp((v - 0.735) / (0.775 - 0.735), 0, 1);
    setInsideLen(Math.round(ps7 * INSIDE_MESSAGE.length));

    // Finale — the card opens once we scroll past the reveal point.
    setRevealOpen(v > 0.92);

    // Choose celebration (centre .22) — name stays "Sarah"; occasions toggle
    // on approach, Anniversary "clicked" (pressed) as we pass.
    const sub = clamp((v - 0.145) / (0.23 - 0.145), 0, 1);
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
  // Beat 2 — "Choose your celebration" + card (centre .22).
  const zChoose = useTransform(scrollYProgress, [0.12, 0.195, 0.245, 0.32], [-720, -40, 40, 820]);
  const oChoose = useTransform(scrollYProgress, [0.148, 0.195, 0.245, 0.293], [0, 1, 1, 0]);
  // Confetti burst — fires out of the card as Anniversary is "clicked" (~.22).
  const burst = useTransform(scrollYProgress, [0.215, 0.27], [0, 1]);
  // Beat 3 — "Select your photo(s)" (centre .355).
  const z4 = useTransform(scrollYProgress, [0.255, 0.33, 0.38, 0.455], [-720, -40, 40, 820]);
  const o4 = useTransform(scrollYProgress, [0.283, 0.33, 0.38, 0.428], [0, 1, 1, 0]);
  // Beat 4 — "Design the front" (centre .49).
  const z5 = useTransform(scrollYProgress, [0.39, 0.465, 0.515, 0.59], [-720, -40, 40, 820]);
  const o5 = useTransform(scrollYProgress, [0.418, 0.465, 0.515, 0.563], [0, 1, 1, 0]);
  // Beat 5 — "Add text to the front" (centre .625).
  const z6 = useTransform(scrollYProgress, [0.525, 0.6, 0.65, 0.725], [-720, -40, 40, 820]);
  const o6 = useTransform(scrollYProgress, [0.553, 0.6, 0.65, 0.698], [0, 1, 1, 0]);
  // Beat 6 — "Add text on the inside" (centre .76) — now a through-beat.
  const z7 = useTransform(scrollYProgress, [0.66, 0.735, 0.785, 0.86], [-720, -40, 40, 820]);
  const o7 = useTransform(scrollYProgress, [0.688, 0.735, 0.785, 0.833], [0, 1, 1, 0]);
  // Finale — the finished 3D card. No CSS dolly (it's a live 3D render); it
  // rises + scales in, then swings open (revealOpen) to show the inside.
  const oReveal = useTransform(scrollYProgress, [0.82, 0.88, 1], [0, 1, 1]);
  const yReveal = useTransform(scrollYProgress, [0.82, 0.9], [48, 0]);
  const scaleReveal = useTransform(scrollYProgress, [0.82, 0.9], [0.9, 1]);

  const hintO = useTransform(scrollYProgress, [0, 0.07], [1, 0]);

  return (
    <div ref={ref} className="relative" style={{ height: '1340vh' }}>
      <div
        className="fixed inset-0 overflow-hidden"
        style={{
          perspective: '1000px',
          background:
            'radial-gradient(120% 90% at 50% 32%, #ffffff 0%, #f4f3fb 55%, #efeefb 100%)',
        }}
      >
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

        {/* Headline + scene composer — the description types itself in. */}
        <Layer z={z5} opacity={o5}>
          <div className="flex flex-col items-center gap-7 sm:gap-9">
            <h1 className={CHOOSE_CLASS}>Design the front</h1>
            <SceneCard typed={SCENE_TEXT.slice(0, sceneLen)} />
          </div>
        </Layer>

        {/* Headline + front-text composer — the headline types itself in. */}
        <Layer z={z6} opacity={o6}>
          <div className="flex flex-col items-center gap-7 sm:gap-9">
            <h1 className={CHOOSE_CLASS}>Add text to the front</h1>
            <FrontTextCard typed={FRONT_TEXT.slice(0, frontLen)} />
          </div>
        </Layer>

        {/* Headline + inside-text composer — the message types itself in. */}
        <Layer z={z7} opacity={o7}>
          <div className="flex flex-col items-center gap-7 sm:gap-9">
            <h1 className={CHOOSE_CLASS}>Add text on the inside</h1>
            <InsideTextCard typed={INSIDE_MESSAGE.slice(0, insideLen)} />
          </div>
        </Layer>

        {/* Finale — the finished 3D card. Rises + scales in (no CSS dolly),
            then swings open on scroll to reveal the inside message. */}
        <motion.div
          style={{ opacity: oReveal }}
          className="absolute inset-0 flex items-center justify-center px-6 will-change-transform"
        >
          <motion.div
            style={{ y: yReveal, scale: scaleReveal }}
            className="flex flex-col items-center gap-6 sm:gap-8"
          >
            <h1 className={CHOOSE_CLASS}>And it's ready</h1>
            <div className="w-[320px] sm:w-[380px] h-[420px] sm:h-[460px]">
              <Card3DViewer
                frontImageUrl={revealFront}
                insideImageUrl={revealInside}
                open={revealOpen}
                closedAngle={-0.32}
                restYaw={-0.12}
                interactive={false}
                enableRotate={false}
                enableZoom={false}
                framingMargin={1.95}
                minDistance={2.4}
                className="w-full h-full"
              />
            </div>
          </motion.div>
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

function SceneCard({ typed }: { typed: string }) {
  const empty = typed.length === 0;
  return (
    <div className="w-[340px] sm:w-[380px] rounded-[28px] bg-white px-6 py-7 shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70">
      {/* Textarea-styled box — the scene types itself in with a live cursor. */}
      <div className="rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[14px] leading-relaxed min-h-[104px] text-ink">
        {empty ? (
          <span className="text-stone-400">
            e.g. Sarah at golden hour on an Italian terrace…
          </span>
        ) : (
          <span>
            {typed}
            <span className="inline-block w-[2px] h-[15px] bg-brand align-middle ml-0.5 animate-pulse" />
          </span>
        )}
      </div>

      {/* Two AI helpers — match the studio's Suggest / Brainstorm pair. */}
      <div className="mt-4 flex gap-2.5">
        <div className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-brand-muted text-brand-dark border border-brand/40 text-[13px] font-semibold">
          <Wand2 className="w-4 h-4" strokeWidth={2} />
          Suggest scenes
        </div>
        <div className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-brand-dark text-white text-[13px] font-semibold shadow-md shadow-brand/20">
          <Sparkles className="w-4 h-4" strokeWidth={2} />
          Brainstorm
        </div>
      </div>
    </div>
  );
}

function FrontTextCard({ typed }: { typed: string }) {
  const empty = typed.length === 0;
  return (
    <div className="w-[340px] sm:w-[380px] rounded-[28px] bg-white px-6 py-7 shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70">
      <p className="text-[13px] text-ink mb-1.5 flex items-center gap-1.5">
        <Type className="w-3.5 h-3.5 text-brand" strokeWidth={2} />
        Front headline
        <span className="text-stone-400 font-normal">optional</span>
      </p>
      <div className="rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 min-h-[46px] flex items-center text-[15px]">
        {empty ? (
          <span className="text-stone-400">Happy Anniversary</span>
        ) : (
          <span className="text-ink font-medium">
            {typed}
            <span className="inline-block w-[2px] h-[16px] bg-brand align-middle ml-0.5 animate-pulse" />
          </span>
        )}
      </div>
    </div>
  );
}

function InsideTextCard({ typed }: { typed: string }) {
  const empty = typed.length === 0;
  return (
    <div className="w-[340px] sm:w-[380px] rounded-[28px] bg-white px-6 py-7 shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70">
      {/* Greeting */}
      <p className="text-[12px] text-stone-500 mb-1">
        Greeting <span className="text-stone-400">optional</span>
      </p>
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[14px] text-ink mb-3.5">
        {INSIDE_GREETING}
      </div>

      {/* Message — the hero field, types itself in. */}
      <p className="text-[12px] text-stone-500 mb-1">Message</p>
      <div className="rounded-xl border-2 border-brand/50 bg-stone-50 px-3.5 py-3 text-[14px] leading-relaxed min-h-[92px] text-ink mb-3.5">
        {empty ? (
          <span className="text-stone-400">Write a few words from the heart…</span>
        ) : (
          <span>
            {typed}
            <span className="inline-block w-[2px] h-[15px] bg-brand align-middle ml-0.5 animate-pulse" />
          </span>
        )}
      </div>

      {/* Sign-off */}
      <p className="text-[12px] text-stone-500 mb-1">
        Sign-off <span className="text-stone-400">optional</span>
      </p>
      <div className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-[14px] text-ink">
        {INSIDE_SIGNOFF}
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
