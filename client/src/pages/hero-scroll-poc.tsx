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
import { Cake, Heart, Gem, GraduationCap, ChevronDown } from 'lucide-react';

const NAMES = ['Mum', 'Jack', 'Emma', 'Dad', 'Sarah'];
const FINAL_NAME = 'Sarah';
const SELECT = 'Anniversary';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export default function HeroScrollPocPage() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref });

  const [name, setName] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  // Drive the studio card's name typing + selection as we approach beat 3.
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    const sub = clamp((v - 0.62) / (0.86 - 0.62), 0, 1);
    if (sub <= 0) {
      setName('');
      setSelected(null);
      return;
    }
    const nm =
      sub < 0.78
        ? NAMES[Math.floor((sub / 0.78) * NAMES.length * 2.4) % NAMES.length]
        : FINAL_NAME;
    setName(nm);
    setSelected(sub > 0.5 ? SELECT : null);
  });

  // Beat 1 — intro: full at top, zooms through + fades.
  const z1 = useTransform(scrollYProgress, [0, 0.3], [0, 880]);
  const o1 = useTransform(scrollYProgress, [0, 0.2, 0.3], [1, 1, 0]);
  // Beat 2 — headline: approaches, full mid, zooms through + fades.
  const z2 = useTransform(scrollYProgress, [0.2, 0.44, 0.62], [-720, 0, 880]);
  const o2 = useTransform(scrollYProgress, [0.28, 0.44, 0.56, 0.66], [0, 1, 1, 0]);
  // Beat 3 — studio card: approaches, lands, holds.
  const z3 = useTransform(scrollYProgress, [0.62, 0.88, 1], [-760, 0, 70]);
  const o3 = useTransform(scrollYProgress, [0.62, 0.84, 1], [0, 1, 1]);

  const hintO = useTransform(scrollYProgress, [0, 0.06], [1, 0]);

  return (
    <div ref={ref} className="relative" style={{ height: '380vh' }}>
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

        <Layer z={z2} opacity={o2}>
          <h1 className={HEADLINE_CLASS}>Choose your celebration</h1>
        </Layer>

        <Layer z={z3} opacity={o3}>
          <StudioCard name={name} selected={selected} />
        </Layer>

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
  selected,
}: {
  name: string;
  selected: string | null;
}) {
  return (
    <div className="w-[340px] sm:w-[380px] rounded-[28px] bg-white px-6 py-7 shadow-[0_36px_90px_-32px_rgba(15,23,42,0.32)] ring-1 ring-stone-200/70">
      <h2 className="text-[22px] font-bold text-ink leading-tight">
        Who's this card for?
      </h2>
      <p className="text-[13px] text-stone-500 mt-1.5">
        A name and a reason — that's all we need to start.
      </p>

      <p className="text-[13px] text-ink mt-5 mb-1.5">Name</p>
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
        {OCC.map(({ label, Icon }) => {
          const active = selected === label;
          return (
            <div
              key={label}
              className={`flex items-center gap-3 rounded-xl border-2 px-3.5 py-3 transition-all ${
                active ? 'border-brand bg-brand-muted/40' : 'border-stone-200 bg-white'
              }`}
            >
              <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-pink-100 text-pink-500">
                <Icon className="w-[19px] h-[19px]" strokeWidth={2} />
              </span>
              <span className="text-[15px] font-medium text-ink">{label}</span>
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
