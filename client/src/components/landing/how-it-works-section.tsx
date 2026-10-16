// client/src/components/landing/how-it-works-section.tsx: HOW IT WORKS
//
// One section, two doors. Three beats, each a square stage that plays
// ONCE as it enters the viewport and then holds still: no pinning, no
// scroll-linked motion (the repo has reverted scroll-jacking before).
// Reduced motion renders the settled state on first paint.
//
// 2026-10-11, second pass (Aidan: "do better, run your own version as
// the sample"). The first pass drew the maker beats from the live
// carousel, so the chips said Mum / 60 / her garden and the cards were
// a 21st and a football boot. The three fronts and the inside here are
// the engine's REAL output for exactly that brief (Mum, birthday, 60,
// warm, her garden, Linda), generated once and kept as assets under
// client/public/hiw, so the three frames tell one story. The frames
// are dense on purpose: the first pass floated small things in big
// empty boxes.
import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { EASE, Rise } from '@/components/landing/rise';
import { DISPLAY, EYEBROW } from '@/pages/doorway';

type Door = 'photo' | 'maker';

// Photo door: the Northern Lights example the hero and proof use.
const PHOTO_SOURCE = '/proof-source-photo.webp';
const PHOTO_FRONT = '/proof-card-front.webp';
const PHOTO_INSIDE = '/proof-card-inside.webp';
const SCENE_TEXT = 'Mum under the Northern Lights';

// Maker door: the real set for Mum / birthday / 60 / warm / her garden.
const MAKER_FRONTS = ['/hiw/mum-1.webp', '/hiw/mum-2.webp', '/hiw/mum-3.webp'];
const MAKER_PICK = 1; // "The greenhouse can wait."
const MAKER_INSIDE = '/hiw/mum-inside.webp';
const QUESTIONS: Array<{ q: string; a: string }> = [
  { q: "Who's it for?", a: 'Mum' },
  { q: 'The occasion', a: 'Birthday' },
  { q: 'How old', a: '60' },
  { q: 'The vibe', a: 'Warm' },
  { q: 'What they love', a: 'Her garden' },
  { q: 'Their name', a: 'Linda' },
];
const TYPE_MS = 35;

const COPY: Record<Door, { eyebrow: string; sub: string; beats: Array<{ label: string; body: string }> }> = {
  photo: {
    eyebrow: 'From a photo',
    sub: 'Three steps. Under ten minutes.',
    beats: [
      { label: 'Start with a photo', body: 'One clear photo of them, and we check the likeness before anything is drawn.' },
      { label: 'Describe the moment', body: 'A few words on the scene, and we draw them into it.' },
      { label: 'Open it, then post it', body: 'Printed on 280gsm gloss and posted, with a free digital link to share.' },
    ],
  },
  maker: {
    eyebrow: 'From six answers',
    sub: 'Six questions. Three cards. Yours in a minute.',
    beats: [
      { label: 'Six quick questions', body: "Who it's for, the occasion, what they're like: a minute of taps." },
      { label: 'We write and draw three', body: 'Three fronts, written and drawn from your answers, in under a minute.' },
      { label: 'Pick one, write the inside', body: "Keep our words, change them or leave it blank. Then it's printed and posted, with a free digital link." },
    ],
  },
};

// ── timing helpers ────────────────────────────────────────────────────
interface Clock {
  play: boolean;
  reduced: boolean;
  base: number;
}
function tr(c: Clock, at: number, d = 0.6) {
  return c.reduced ? { duration: 0 } : { delay: c.base + at, duration: d, ease: EASE };
}
/** `initial` for a piece: skip the hidden state under reduced motion so
 *  framer paints the `animate` values on first render. */
function from<T extends object>(c: Clock, v: T): T | false {
  return c.reduced ? false : v;
}
/** A phase flag that turns true `at` seconds after the beat starts
 *  (immediately under reduced motion), for the bits framer can't tween:
 *  typed text, label swaps. */
function usePhase(c: Clock, at: number): boolean {
  const [on, setOn] = useState(c.reduced);
  useEffect(() => {
    if (c.reduced) { setOn(true); return; }
    if (!c.play) return;
    const t = window.setTimeout(() => setOn(true), (c.base + at) * 1000);
    return () => window.clearTimeout(t);
  }, [c.play, c.reduced, c.base, at]);
  return on;
}
/** Clock-driven typing from `at` seconds, TYPE_MS per character. */
function useTyped(c: Clock, text: string, at: number): { shown: string; typing: boolean } {
  const [n, setN] = useState(c.reduced ? text.length : 0);
  const started = usePhase(c, at);
  useEffect(() => {
    if (c.reduced) { setN(text.length); return; }
    if (!started) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) window.clearInterval(id);
    }, TYPE_MS);
    return () => window.clearInterval(id);
  }, [started, c.reduced, text]);
  return { shown: text.slice(0, n), typing: started && n < text.length };
}
const typeSecs = (text: string) => (text.length * TYPE_MS) / 1000;

// ── shared pieces ─────────────────────────────────────────────────────
/** The lime readiness chip (pale green ground, forest text, the
 *  studio's own status pair). */
function ReadyChip({ c, at, label, className = '' }: { c: Clock; at: number; label: string; className?: string }) {
  return (
    <motion.span
      initial={from(c, { opacity: 0, y: 8, scale: 0.96 })}
      animate={c.play ? { opacity: 1, y: 0, scale: 1 } : undefined}
      transition={tr(c, at, 0.5)}
      className={`inline-flex items-center gap-1.5 rounded-full border border-cta/30 bg-cta-light px-3 py-1 text-[12px] font-semibold text-cta-dark shadow-sm ${className}`}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
      {label}
    </motion.span>
  );
}

/** The blinking caret: the one loop this section allows, and only
 *  while a field is typing. */
function Caret({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`ml-px inline-block h-[1.1em] w-[2px] translate-y-[0.18em] bg-keeper-ink align-baseline ${on ? 'animate-pulse' : 'opacity-0'}`}
    />
  );
}

const CARD_SHADOW = 'shadow-[0_22px_48px_-22px_rgba(33,29,25,0.45)]';

function CardImg({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <img
      src={src}
      alt={alt}
      width={900}
      height={900}
      loading="lazy"
      decoding="async"
      crossOrigin="anonymous"
      className={`block aspect-square w-full rounded-[8px] object-cover ${className}`}
    />
  );
}

/**
 * The last beat on both doors: a closed card that OPENS. The front is
 * the cover; it swings on its left edge through 180° and its back is
 * the blank inside-left panel, revealing the printed inside-right
 * behind it. Starts centred as a closed card, settles centred as the
 * open spread, then the lime chip lands. Reduced motion: open, still.
 */
function OpenCard({ c, front, inside, at = 0.2, alt }: { c: Clock; front: string; inside: string; at?: number; alt: string }) {
  const open = c.play;
  const T = c.reduced ? 0 : c.base + at;
  const D = c.reduced ? 0 : 1.1;
  return (
    <div className="absolute inset-0 flex items-center justify-center" style={{ perspective: '1600px' }}>
      {/* The spread is two squares wide. Closed, only the cover shows
          (over the right square), so the spread slides left by a
          quarter of its width to keep the closed card centred, then
          slides back as it opens. */}
      <motion.div
        className="relative w-[94%]"
        style={{ aspectRatio: '2 / 1' }}
        initial={from(c, { x: '-25%' })}
        animate={open ? { x: '0%' } : undefined}
        transition={{ delay: T, duration: D, ease: EASE }}
      >
        {/* inside-right: the printed inside, already in place behind the cover */}
        <div className={`absolute right-0 top-0 h-full w-1/2 overflow-hidden rounded-r-[8px] ring-1 ring-keeper-hair ${CARD_SHADOW}`}>
          <CardImg src={inside} alt={`${alt}, the inside`} className="rounded-none" />
        </div>
        {/* the cover: front face is the card front, back face is the
            blank inside-left; hinged on its left edge */}
        <motion.div
          className="absolute left-1/2 top-0 h-full w-1/2"
          style={{ transformOrigin: '0% 50%', transformStyle: 'preserve-3d' }}
          initial={from(c, { rotateY: 0 })}
          animate={open ? { rotateY: -180 } : undefined}
          transition={{ delay: T, duration: D, ease: EASE }}
        >
          <div className={`absolute inset-0 overflow-hidden rounded-[8px] ${CARD_SHADOW}`} style={{ backfaceVisibility: 'hidden' }}>
            <CardImg src={front} alt={alt} className="rounded-none" />
          </div>
          <div
            className="absolute inset-0 rounded-l-[8px] bg-[#FBF8F2] ring-1 ring-keeper-hair"
            style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            aria-hidden="true"
          />
        </motion.div>
      </motion.div>
      <ReadyChip c={c} at={at + 1.2} label="Printed and posted" className="absolute bottom-4 left-4" />
    </div>
  );
}

// ── photo door ────────────────────────────────────────────────────────
/** 1. The photo fills the stage, a crop frame draws itself round the
 *  face, the photo tightens to it, "Looks good" lands. */
function PhotoBeat1({ c }: { c: Clock }) {
  return (
    <div className="absolute inset-0">
      <motion.img
        src={PHOTO_SOURCE}
        alt="A photo of Mum"
        width={900}
        height={900}
        loading="lazy"
        decoding="async"
        crossOrigin="anonymous"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ objectPosition: '50% 32%' }}
        initial={from(c, { opacity: 0, scale: 1 })}
        animate={c.play ? { opacity: 1, scale: 1.22 } : undefined}
        transition={c.reduced ? { duration: 0 } : { opacity: { delay: c.base, duration: 0.5 }, scale: { delay: c.base + 1.5, duration: 1.0, ease: EASE } }}
      />
      {/* the crop frame: draws, holds, fades as the photo tightens */}
      <motion.svg
        viewBox="0 0 100 100"
        className="absolute left-[22%] top-[12%] h-[52%] w-[56%]"
        initial={from(c, { opacity: 1 })}
        animate={c.play ? { opacity: 0 } : undefined}
        transition={tr(c, 1.9, 0.5)}
        aria-hidden="true"
      >
        <motion.rect
          x="2" y="2" width="96" height="96" rx="6"
          fill="none" stroke="#5c57d4" strokeWidth="2.5" strokeDasharray="14 10"
          initial={from(c, { pathLength: 0 })}
          animate={c.play ? { pathLength: 1 } : undefined}
          transition={tr(c, 0.5, 0.9)}
        />
      </motion.svg>
      <ReadyChip c={c} at={2.6} label="Looks good" className="absolute bottom-4 left-4" />
    </div>
  );
}

/** 2. The scene types itself, a bar draws it, and the drawn card rises
 *  into the lower half so the stage ends full. */
function PhotoBeat2({ c }: { c: Clock }) {
  const { shown, typing } = useTyped(c, SCENE_TEXT, 0.3);
  const drawingAt = 0.3 + typeSecs(SCENE_TEXT) + 0.3;
  const drawnAt = drawingAt + 1.1;
  const drawing = usePhase(c, drawingAt);
  const drawn = usePhase(c, drawnAt);
  return (
    <div className="absolute inset-0 flex flex-col px-[8%] pt-[9%]">
      <motion.div
        initial={from(c, { opacity: 0, y: 8 })}
        animate={c.play ? { opacity: 1, y: 0 } : undefined}
        transition={tr(c, 0, 0.5)}
        className="rounded-xl border border-keeper-hair bg-white px-4 py-3.5 shadow-sm"
      >
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-keeper-meta">The scene</p>
        <p className="mt-1 min-h-[1.5em] text-[17px] leading-snug text-keeper-ink">
          {shown}
          <Caret on={typing} />
        </p>
      </motion.div>
      <div className={`mt-3 transition-opacity duration-300 ${drawing ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-2 text-[12px] text-keeper-meta">
          {drawn ? <Check className="h-3.5 w-3.5 text-cta-dark" strokeWidth={2.5} aria-hidden="true" /> : null}
          <span>{drawn ? 'Drawn' : 'Drawing it…'}</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-keeper-hair/70">
          <motion.div
            className="h-full rounded-full bg-keeper-gold"
            initial={from(c, { width: '0%' })}
            animate={c.play ? { width: '100%' } : undefined}
            transition={tr(c, drawingAt, 1.0)}
          />
        </div>
      </div>
      {/* the drawn front rises into the lower half */}
      <motion.div
        className="mx-auto mt-auto mb-[6%] w-[52%]"
        initial={from(c, { opacity: 0, y: 24, scale: 0.96 })}
        animate={c.play ? { opacity: 1, y: 0, scale: 1 } : undefined}
        transition={tr(c, drawnAt, 0.7)}
      >
        <CardImg src={PHOTO_FRONT} alt="Mum under the Northern Lights, the drawn card" className={`ring-1 ring-keeper-hair ${CARD_SHADOW}`} />
      </motion.div>
    </div>
  );
}

function PhotoBeat3({ c }: { c: Clock }) {
  return <OpenCard c={c} front={PHOTO_FRONT} inside={PHOTO_INSIDE} alt="Mum under the Northern Lights" />;
}

// ── maker door ────────────────────────────────────────────────────────
/** 1. Six questions, six answers: the rows fill the stage top to
 *  bottom, each answer landing with its check, then the deal button. */
function MakerBeat1({ c }: { c: Clock }) {
  const step = 0.22;
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-[2.6%] px-[8%] py-[7%]">
      {QUESTIONS.map((row, i) => (
        <motion.div
          key={row.q}
          className="flex items-center justify-between gap-3 border-b border-keeper-hair/80 pb-[2.6%]"
          initial={from(c, { opacity: 0, x: -10 })}
          animate={c.play ? { opacity: 1, x: 0 } : undefined}
          transition={tr(c, 0.1 + i * step, 0.45)}
        >
          <span className="text-[12px] font-medium uppercase tracking-[0.1em] text-keeper-meta">{row.q}</span>
          <motion.span
            className="inline-flex items-center gap-1.5 rounded-full border border-keeper-hair bg-white px-3 py-1 text-[14px] font-medium text-keeper-ink shadow-sm"
            initial={from(c, { opacity: 0, scale: 0.9 })}
            animate={c.play ? { opacity: 1, scale: 1 } : undefined}
            transition={tr(c, 0.25 + i * step, 0.35)}
          >
            <span className="flex h-[16px] w-[16px] items-center justify-center rounded-full bg-cta text-cta-foreground">
              <Check className="h-[10px] w-[10px]" strokeWidth={3} aria-hidden="true" />
            </span>
            {row.a}
          </motion.span>
        </motion.div>
      ))}
      <motion.div
        className="mt-[3%] self-start rounded-full bg-brand px-4 py-2 text-[13px] font-semibold text-brand-foreground shadow-sm"
        initial={from(c, { opacity: 0, y: 8 })}
        animate={c.play ? { opacity: 1, y: 0 } : undefined}
        transition={tr(c, 0.4 + QUESTIONS.length * step, 0.5)}
        aria-hidden="true"
      >
        Deal my three →
      </motion.div>
    </div>
  );
}

/** 2. The three real fronts deal out of a stack into a fan that fills
 *  the stage, middle on top. */
const FAN = [
  { x: '-40%', rotate: -8, y: 12 },
  { x: '0%', rotate: 0, y: 0 },
  { x: '40%', rotate: 8, y: 12 },
];
function MakerBeat2({ c }: { c: Clock }) {
  return (
    <div className="absolute inset-0">
      <div className="absolute left-[28%] top-[24%] w-[44%]">
        {MAKER_FRONTS.map((src, i) => (
          <motion.div
            key={src}
            className="absolute inset-x-0 top-0"
            style={{ transformOrigin: '50% 120%', zIndex: i === 1 ? 2 : 1 }}
            initial={from(c, { opacity: 0, x: '0%', rotate: 0, y: 24 })}
            animate={c.play ? { opacity: 1, x: FAN[i].x, rotate: FAN[i].rotate, y: FAN[i].y } : undefined}
            transition={tr(c, 0.2 + i * 0.18, 0.8)}
          >
            <CardImg src={src} alt={`Card ${i + 1} of three for Mum`} className={`ring-1 ring-keeper-hair ${CARD_SHADOW}`} />
          </motion.div>
        ))}
      </div>
      <ReadyChip c={c} at={1.4} label="Three, written and drawn" className="absolute bottom-4 left-4" />
    </div>
  );
}

/** 3. The picked card opens: cover swings, the inside is already
 *  printed, the chip lands. */
function MakerBeat3({ c }: { c: Clock }) {
  return <OpenCard c={c} front={MAKER_FRONTS[MAKER_PICK]} inside={MAKER_INSIDE} alt="The greenhouse can wait" />;
}

// ── the section ───────────────────────────────────────────────────────
function Beat({
  index,
  label,
  body,
  stagger,
  children,
}: {
  index: number;
  label: string;
  body: string;
  stagger: number;
  children: (c: Clock) => React.ReactNode;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduced = !!useReducedMotion();
  const c: Clock = { play: inView || reduced, reduced, base: index * stagger };
  return (
    <li ref={ref} className="flex flex-col">
      {/* The stage: paper ground, hairline, square at every width so the
          phone sees the same composition as the desktop (a shorter frame
          cut the fan and parked the chip on the cards). Everything inside
          is absolutely placed and clipped so no beat can push the column. */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-keeper-hair bg-keeper-paper shadow-[0_18px_42px_-30px_rgba(33,29,25,0.3)]">
        {children(c)}
      </div>
      <div className="mt-5 flex items-baseline gap-3">
        <span className={`text-[13px] tabular-nums text-keeper-gold ${DISPLAY}`}>{index + 1}</span>
        <h3 className="text-[19px] text-keeper-ink">{label}</h3>
      </div>
      <p className="mt-1.5 max-w-[34ch] text-[15px] leading-relaxed text-keeper-body">{body}</p>
    </li>
  );
}

/** `true` from md up, where the three beats share a row and stagger
 *  left to right. Stacked on a phone, each enters on its own. */
function useWide(): boolean {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const sync = () => setWide(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  return wide;
}

export function HowItWorksSection({ door }: { door: Door }) {
  const wide = useWide();
  const stagger = wide ? 0.3 : 0;
  const copy = COPY[door];
  const stages: Array<(c: Clock) => React.ReactNode> =
    door === 'photo'
      ? [(c) => <PhotoBeat1 c={c} />, (c) => <PhotoBeat2 c={c} />, (c) => <PhotoBeat3 c={c} />]
      : [(c) => <MakerBeat1 c={c} />, (c) => <MakerBeat2 c={c} />, (c) => <MakerBeat3 c={c} />];

  return (
    <section id="how-it-works" className="scroll-mt-32 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Rise>
          <p className={EYEBROW}>{copy.eyebrow}</p>
          <h2 className={`mt-3 text-[clamp(30px,4.4vw,44px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>
            How it works
          </h2>
          <p className="mt-3 max-w-[46ch] text-[17px] leading-[1.6] text-keeper-body">{copy.sub}</p>
        </Rise>
        <ol className="mt-12 grid gap-10 md:mt-16 md:grid-cols-3 md:gap-8">
          {copy.beats.map((b, i) => (
            <Beat key={b.label} index={i} label={b.label} body={b.body} stagger={stagger}>
              {stages[i]}
            </Beat>
          ))}
        </ol>
      </div>
    </section>
  );
}
