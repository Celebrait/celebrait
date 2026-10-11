// client/src/components/landing/how-it-works-section.tsx: HOW IT WORKS
//
// Three beats, animated once as they scroll into view, one per door
// (Aidan 2026-10-11: "both doors need an animated How it works").
//
//   /photo  photo drops in + crop frame → scene types itself → front
//           rises, inside slides out from behind, "Printed and posted".
//   /create six answers tick in → three fronts deal out of a stack →
//           the middle one lifts, an inside panel types two lines.
//
// Rules this file keeps:
//   • NO scroll-linked motion, pinning or hijack. Every beat plays once
//     from `useInView({ once: true, amount: 0.4 })` and then settles.
//   • `prefers-reduced-motion` renders the SETTLED state immediately
//     (`initial={false}`, zero-duration transitions, full typed text).
//   • Small, honest motion: slides, 0.96 → 1 scales, cross-fades, 0.5 to
//     0.9 s. The only loop is the caret blink while a field is typing.
//   • The maker door draws REAL fronts: the same `/api/catalogue/featured`
//     picks the drift wall shows. Fewer than three (dev, an empty
//     carousel, a failed fetch) → three paper placeholders, same motion.
//   • Palette from tailwind.config.ts only (keeper paper/ink/hair, the
//     one violet as `keeper-gold`, lime `cta` for the readiness chips).
//   • Every card <img> carries crossOrigin="anonymous" (the WebGL
//     cache-poisoning rule, see project_3d_card_cors_cache_poisoning).

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { EASE, Rise } from '@/components/landing/rise';
import { DISPLAY, EYEBROW } from '@/pages/doorway';
import type { CatalogueCard } from '@/components/catalogue/rack-wall';

type Door = 'photo' | 'maker';

// Same worked example as the hero + proof section (Mum, 60, the Northern
// Lights), so the page tells one story.
const PHOTO_SOURCE = '/proof-source-photo.webp';
const PHOTO_FRONT = '/proof-card-front.webp';
const PHOTO_INSIDE = '/proof-card-inside.webp';
const SCENE_TEXT = 'Mum under the Northern Lights';
const INSIDE_LINES = ['Sixty, and still the measure', 'for plants and people.'];
const ANSWERS = ['Mum', 'Birthday', '60', 'Warm', 'Her garden', 'Linda'];
const TYPE_MS = 35;

const COPY: Record<Door, { eyebrow: string; sub: string; beats: Array<{ label: string; body: string }> }> = {
  photo: {
    eyebrow: 'From a photo',
    sub: 'Three steps. Under ten minutes.',
    beats: [
      { label: 'Start with a photo', body: 'One clear photo of them, and we check the likeness before anything is drawn.' },
      { label: 'Describe the moment', body: 'A few words on the scene, and we draw them into it.' },
      { label: 'Pick it up and post it', body: 'Printed on 280gsm gloss and posted, with a free digital link to share.' },
    ],
  },
  maker: {
    eyebrow: 'From six answers',
    sub: 'Six questions. Three cards. Yours in a minute.',
    beats: [
      { label: 'Six quick questions', body: 'Who it\'s for, the occasion, what they\'re like: a minute of taps.' },
      { label: 'We write and draw three', body: 'From your answers we write and draw three fronts, in under a minute.' },
      { label: 'Pick one, write the inside', body: 'Keep our words, change them or leave it blank, then it\'s printed and posted with a free digital link.' },
    ],
  },
};

// ── timing helpers ──────────────────────────────────────────────────
//
// Every animated piece takes a `Clock`: play (in view), reduced (settle
// now) and a base delay (the left-to-right stagger on desktop). `tr()`
// turns "start at s, run for d" into a framer transition that is zero
// length under reduced motion.
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
 *  (immediately under reduced motion). Used for the bits framer can't
 *  tween: typed text, label swaps. */
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

/** Clock-driven typing: `text` appears a character at a time from `at`
 *  seconds, TYPE_MS per character. Returns the visible slice and
 *  whether the field is mid-type (the caret only blinks then). */
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

/** Seconds a typed string takes, so the next piece can wait for it. */
const typeSecs = (text: string) => (text.length * TYPE_MS) / 1000;

// ── shared pieces ───────────────────────────────────────────────────

/** The lime readiness chip (same pair as the studio's status badges:
 *  pale green ground, forest text). */
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

/** The blinking caret, the one loop this section allows, and only
 *  while a field is typing. */
function Caret({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`ml-px inline-block h-[1.1em] w-[2px] translate-y-[0.18em] bg-keeper-ink align-baseline ${on ? 'animate-pulse' : 'opacity-0'}`}
    />
  );
}

/** A card front: a real image, or the paper placeholder when the
 *  catalogue has fewer than three picks. */
function Front({ src, alt, className = '' }: { src: string | null; alt: string; className?: string }) {
  const box = `aspect-square w-full overflow-hidden rounded-[8px] bg-keeper-paper ring-1 ring-keeper-hair shadow-[0_18px_42px_-22px_rgba(33,29,25,0.42)] ${className}`;
  if (!src) {
    return (
      <div className={`${box} flex items-end p-3`} aria-label={alt} role="img">
        <div className="absolute inset-x-3 top-3 h-[55%] rounded-[6px] bg-brand-muted" aria-hidden="true" />
        <span className={`relative text-[13px] text-keeper-meta ${DISPLAY}`}>{alt}</span>
      </div>
    );
  }
  return (
    <div className={box}>
      <img
        src={src}
        alt={alt}
        crossOrigin="anonymous"
        loading="lazy"
        decoding="async"
        width={900}
        height={900}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

// ── photo door ──────────────────────────────────────────────────────

/** 1. The photo drops in, a crop frame draws itself around the face,
 *  the photo tightens to it and the likeness verdict lands. The frame
 *  sits around the face in the 500×500 selfie (left 20%, top 6%, 60%
 *  square); the tighten is a 1.45× scale about the frame's centre. */
function PhotoBeat1({ c }: { c: Clock }) {
  return (
    <>
      <motion.div
        initial={from(c, { opacity: 0, y: -18, scale: 0.96 })}
        animate={c.play ? { opacity: 1, y: 0, scale: [null, 1, 1.45] } : undefined}
        transition={
          c.reduced
            ? { duration: 0 }
            : { opacity: tr(c, 0, 0.6), y: tr(c, 0, 0.6), scale: { delay: c.base, duration: 2.1, times: [0, 0.28, 1], ease: EASE } }
        }
        style={{ transformOrigin: '50% 30%' }}
        className="absolute inset-0"
      >
        <img
          src={PHOTO_SOURCE}
          alt="The photo of Mum the card was made from"
          crossOrigin="anonymous"
          loading="lazy"
          decoding="async"
          width={500}
          height={500}
          className="h-full w-full object-cover"
        />
        {/* The crop frame draws itself (pathLength), then fades as the
            photo tightens to it. */}
        <motion.svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
          initial={from(c, { opacity: 1 })}
          animate={c.play ? { opacity: 0 } : undefined}
          transition={tr(c, 1.4, 0.5)}
          className="absolute left-[20%] top-[6%] h-[48%] w-[60%] overflow-visible"
        >
          <motion.rect
            x="0" y="0" width="100" height="100" rx="3"
            fill="none"
            stroke="#5c57d4"
            strokeWidth="2.5"
            vectorEffect="non-scaling-stroke"
            initial={from(c, { pathLength: 0 })}
            animate={c.play ? { pathLength: 1 } : undefined}
            transition={tr(c, 0.55, 0.7)}
          />
        </motion.svg>
      </motion.div>
      <div className="absolute bottom-4 left-4">
        <ReadyChip c={c} at={2.0} label="Looks good" />
      </div>
    </>
  );
}

/** 2. The scene field types itself, then the drawing bar fills. */
function PhotoBeat2({ c }: { c: Clock }) {
  const { shown, typing } = useTyped(c, SCENE_TEXT, 0.5);
  const drawAt = 0.5 + typeSecs(SCENE_TEXT) + 0.5;
  const drawn = usePhase(c, drawAt + 0.9);
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-4 p-5 sm:p-6">
      <motion.div
        initial={from(c, { opacity: 0, y: 12 })}
        animate={c.play ? { opacity: 1, y: 0 } : undefined}
        transition={tr(c, 0, 0.55)}
        className="rounded-xl border border-keeper-hair bg-white px-4 py-3.5 shadow-sm"
      >
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-keeper-meta">The scene</p>
        <p className="mt-1.5 min-h-[3.2em] text-[16px] leading-[1.6] text-keeper-ink">
          {shown}
          <Caret on={typing} />
        </p>
      </motion.div>
      <motion.div
        initial={from(c, { opacity: 0, y: 8 })}
        animate={c.play ? { opacity: 1, y: 0 } : undefined}
        transition={tr(c, drawAt, 0.5)}
        className="px-1"
      >
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-keeper-meta" aria-live="polite">
          {drawn ? (
            <>
              <Check className="h-3.5 w-3.5 text-cta-dark" strokeWidth={2.5} aria-hidden="true" />
              Drawn
            </>
          ) : (
            'Drawing it…'
          )}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-keeper-hair/70">
          <motion.div
            initial={from(c, { scaleX: 0 })}
            animate={c.play ? { scaleX: 1 } : undefined}
            transition={tr(c, drawAt + 0.1, 0.9)}
            style={{ transformOrigin: '0% 50%' }}
            className="h-full w-full rounded-full bg-keeper-gold"
          />
        </div>
      </motion.div>
    </div>
  );
}

/** 3. The finished front rises in, the inside slides out from behind it,
 *  the posted chip lands. */
function PhotoBeat3({ c }: { c: Clock }) {
  return (
    <>
      <div className="absolute inset-x-[7%] top-[15%]">
        <div className="relative w-[64%]">
          {/* The inside: starts exactly behind the front, slides right and down. */}
          <motion.div
            initial={from(c, { opacity: 0, x: 0, y: 0, rotate: 0 })}
            animate={c.play ? { opacity: 1, x: '40%', y: '16%', rotate: 5 } : undefined}
            transition={tr(c, 0.75, 0.8)}
            className="absolute inset-0"
          >
            <Front src={PHOTO_INSIDE} alt="The inside of the finished card" />
          </motion.div>
          <motion.div
            initial={from(c, { opacity: 0, y: 24, scale: 0.96 })}
            animate={c.play ? { opacity: 1, y: 0, scale: 1 } : undefined}
            transition={tr(c, 0, 0.7)}
            className="relative"
          >
            <Front src={PHOTO_FRONT} alt="The finished front: Mum under the Northern Lights" />
          </motion.div>
        </div>
      </div>
      <div className="absolute bottom-4 left-4">
        <ReadyChip c={c} at={1.6} label="Printed and posted" />
      </div>
    </>
  );
}

// ── maker door ──────────────────────────────────────────────────────

/** 1. Six answers tick in, one after another. */
function MakerBeat1({ c }: { c: Clock }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-center p-5 sm:p-6">
      <ul className="flex flex-wrap gap-2.5">
        {ANSWERS.map((a, i) => {
          const at = 0.1 + i * 0.22;
          return (
            <motion.li
              key={a}
              initial={from(c, { opacity: 0, x: -10 })}
              animate={c.play ? { opacity: 1, x: 0 } : undefined}
              transition={tr(c, at, 0.5)}
              className="inline-flex items-center gap-2 rounded-full border border-keeper-hair bg-white px-3.5 py-2 text-[14px] font-medium text-keeper-ink shadow-sm"
            >
              <motion.span
                initial={from(c, { scale: 0.6, opacity: 0 })}
                animate={c.play ? { scale: 1, opacity: 1 } : undefined}
                transition={tr(c, at + 0.25, 0.4)}
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground"
              >
                <Check className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
              </motion.span>
              {a}
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}

// The fan the three fronts settle into (and beat 3 starts from).
const FAN = [
  { x: '-42%', rotate: -8 },
  { x: '0%', rotate: 0 },
  { x: '42%', rotate: 8 },
] as const;

/** 2. Three fronts deal out of a stack into a fan, middle on top. */
function MakerBeat2({ c, fronts }: { c: Clock; fronts: Array<string | null> }) {
  return (
    <div className="absolute inset-0">
      <motion.div
        initial={from(c, { opacity: 0, y: 14 })}
        animate={c.play ? { opacity: 1, y: 0 } : undefined}
        transition={tr(c, 0, 0.5)}
        className="absolute left-[31%] top-[16%] w-[38%]"
      >
        {fronts.map((src, i) => (
          <motion.div
            key={i}
            initial={from(c, { x: '0%', rotate: 0, y: 0 })}
            animate={c.play ? { x: FAN[i].x, rotate: FAN[i].rotate, y: i === 1 ? 0 : 10 } : undefined}
            transition={tr(c, 0.55 + i * 0.16, 0.7)}
            style={{ transformOrigin: '50% 120%', zIndex: i === 1 ? 2 : 1 }}
            className={i === 0 ? 'relative' : 'absolute inset-0'}
          >
            <Front src={src} alt={`Card ${['one', 'two', 'three'][i]}`} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}

/** 3. The middle card lifts, the other two fade back, the inside panel
 *  slides in beside it and types two lines. */
function MakerBeat3({ c, fronts }: { c: Clock; fronts: Array<string | null> }) {
  const l1 = useTyped(c, INSIDE_LINES[0], 1.2);
  const l2 = useTyped(c, INSIDE_LINES[1], 1.2 + typeSecs(INSIDE_LINES[0]) + 0.15);
  const chipAt = 1.2 + typeSecs(INSIDE_LINES[0]) + 0.15 + typeSecs(INSIDE_LINES[1]) + 0.4;
  return (
    <>
      <div className="absolute inset-0">
        <div className="absolute left-[7%] top-[14%] w-[40%]">
          {fronts.map((src, i) => (
            <motion.div
              key={i}
              initial={from(c, { x: i === 1 ? '0%' : i === 0 ? '-30%' : '30%', rotate: i === 1 ? 0 : i === 0 ? -8 : 8, opacity: 1, scale: 1, y: 0 })}
              animate={
                c.play
                  ? i === 1
                    ? { x: '0%', rotate: 0, opacity: 1, scale: 1.04, y: -8 }
                    : { x: i === 0 ? '-18%' : '18%', rotate: i === 0 ? -7 : 7, opacity: 0.22, scale: 0.94, y: 14 }
                  : undefined
              }
              transition={tr(c, 0.2, 0.7)}
              style={{ transformOrigin: '50% 120%', zIndex: i === 1 ? 2 : 1 }}
              className={i === 0 ? 'relative' : 'absolute inset-0'}
            >
              <Front src={src} alt={`Card ${['one', 'two', 'three'][i]}`} className={i === 1 ? 'shadow-[0_24px_48px_-20px_rgba(33,29,25,0.5)]' : ''} />
            </motion.div>
          ))}
        </div>
        <motion.div
          initial={from(c, { opacity: 0, x: 24 })}
          animate={c.play ? { opacity: 1, x: 0 } : undefined}
          transition={tr(c, 0.8, 0.6)}
          className="absolute right-[5%] top-[18%] z-10 w-[42%] rounded-xl border border-keeper-hair bg-white px-3.5 py-3 shadow-[0_12px_30px_-16px_rgba(33,29,25,0.35)]"
        >
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-keeper-meta">Inside</p>
          <p className="mt-1.5 min-h-[4.6em] text-[13px] leading-[1.55] text-keeper-ink sm:text-[14px]">
            {l1.shown}
            {l1.typing && <Caret on />}
            <br />
            {l2.shown}
            {l2.typing && <Caret on />}
          </p>
        </motion.div>
      </div>
      <div className="absolute bottom-4 left-4">
        <ReadyChip c={c} at={chipAt} label="Printed and posted" />
      </div>
    </>
  );
}

/** The three fronts the maker beats draw: the carousel picks (the same
 *  call the drift wall makes), or three placeholders. `null` entries
 *  are placeholders; the beats animate either way. */
function useFeaturedFronts(enabled: boolean): Array<string | null> {
  const [fronts, setFronts] = useState<Array<string | null>>([null, null, null]);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch('/api/catalogue/featured')
      .then((r) => (r.ok ? r.json() : null))
      .then((x: { cards?: CatalogueCard[] } | null) => {
        if (cancelled) return;
        const urls = (x?.cards ?? []).map((k) => k.imageUrl).filter(Boolean);
        if (urls.length >= 3) setFronts(urls.slice(0, 3));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);
  return fronts;
}

// ── the beat frame + section ────────────────────────────────────────

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
      {/* The stage: paper ground, hairline, 4:5. Everything inside is
          absolutely placed and clipped so no beat can push the column. */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-keeper-hair bg-keeper-paper shadow-[0_18px_42px_-30px_rgba(33,29,25,0.3)]">
        {children(c)}
      </div>
      <div className="mt-5 flex items-baseline gap-3">
        <span className={`text-[13px] tabular-nums text-keeper-gold ${DISPLAY}`}>{index + 1}</span>
        {/* Fraunces Bold via `.keeper-serif h3` in index.css. */}
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
  const stagger = wide ? 0.25 : 0;
  const fronts = useFeaturedFronts(door === 'maker');
  const copy = COPY[door];
  const stages: Array<(c: Clock) => React.ReactNode> =
    door === 'photo'
      ? [(c) => <PhotoBeat1 c={c} />, (c) => <PhotoBeat2 c={c} />, (c) => <PhotoBeat3 c={c} />]
      : [(c) => <MakerBeat1 c={c} />, (c) => <MakerBeat2 c={c} fronts={fronts} />, (c) => <MakerBeat3 c={c} fronts={fronts} />];

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
