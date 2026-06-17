// client/src/components/studio/welcome-intro.tsx
//
// Animated, type-only welcome narrative for NEW users — sets expectations
// for the studio journey in ~10s. Reuses the clean-typography pattern
// (large Fraunces display + crossfade) shipped on the generation screen.
//
// Beats crossfade (fade up + sharpen from a soft blur): Welcome →
// "cards they'll never bin" → the 01–04 journey → "we bring it to life"
// → delivery → CTA. Skippable any time; Replay on the final frame.
//
// Currently mounted only on the /welcome-intro PREVIEW route. The
// first-studio-visit trigger (localStorage-gated) is wired separately
// once the look is signed off.

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;
const VIOLET = 'linear-gradient(90deg,#5c57d4,#7a76e8,#a78bfa,#7a76e8,#5c57d4)';

// Big Fraunces display line — the workhorse type for every beat.
const H =
  'font-display font-semibold text-ink leading-[1.04] tracking-[-0.02em] text-[clamp(2.1rem,8vw,4rem)]';

function Em({ children }: { children: React.ReactNode }) {
  return (
    <span className="bg-clip-text text-transparent" style={{ backgroundImage: VIOLET }}>
      {children}
    </span>
  );
}
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 text-[13px] font-medium uppercase tracking-[0.24em] text-brand">
      {children}
    </div>
  );
}
function Num({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 font-display text-[15px] font-semibold tracking-[0.14em] text-[#a78bfa]">
      {children}
    </div>
  );
}

type Beat = { hold: number; node: React.ReactNode };

// Each beat's `hold` (ms) is the time before advancing — numbered journey
// steps are quicker, statements linger. Tune freely.
const BEATS: Beat[] = [
  { hold: 1600, node: (<><Eyebrow>Welcome to</Eyebrow><p className={H}><Em>Celebrait</Em></p></>) },
  { hold: 1700, node: (<p className={H}>Cards they'll<br /><Em>never bin.</Em></p>) },
  { hold: 1050, node: (<><Num>01</Num><p className={H}>Choose the occasion.</p></>) },
  { hold: 1050, node: (<><Num>02</Num><p className={H}>Add their photo.</p></>) },
  { hold: 1050, node: (<><Num>03</Num><p className={H}>Describe the scene.</p></>) },
  { hold: 1050, node: (<><Num>04</Num><p className={H}>Write your words.</p></>) },
  { hold: 1500, node: (<p className={H}>And we<br /><Em>bring it to life.</Em></p>) },
  {
    hold: 1800,
    node: (
      <p className={`${H} !text-[clamp(1.7rem,6vw,3rem)]`}>
        Printed &amp; posted.<br />Or sent with a link.
      </p>
    ),
  },
];

export function WelcomeIntro({ onDismiss }: { onDismiss: () => void }) {
  const reduced = useReducedMotion() ?? false;
  const [step, setStep] = useState(0);
  const isFinal = step >= BEATS.length;

  // Auto-advance through the beats. Reduced-motion users jump straight to
  // the final frame (CTA) so they're never stranded mid-sequence.
  useEffect(() => {
    if (reduced) {
      setStep(BEATS.length);
      return;
    }
    if (step >= BEATS.length) return;
    const t = window.setTimeout(() => setStep((s) => s + 1), BEATS[step].hold);
    return () => window.clearTimeout(t);
  }, [step, reduced]);

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden"
      style={{ background: 'linear-gradient(180deg,#ffffff 0%,#f3f2fb 100%)' }}
    >
      {/* Skip — dismisses the whole intro (straight into the studio). */}
      {!isFinal && (
        <button
          onClick={onDismiss}
          className="absolute right-5 top-4 z-10 text-[13px] tracking-[0.04em] text-ink-soft/70 hover:text-ink-soft"
        >
          Skip
        </button>
      )}

      <AnimatePresence>
        <motion.div
          key={step}
          className="absolute inset-0 flex flex-col items-center justify-center px-[9%] text-center"
          initial={reduced ? false : { opacity: 0, y: 18, filter: 'blur(9px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -15, filter: 'blur(7px)' }}
          transition={{ duration: 0.6, ease: EASE }}
        >
          {isFinal ? (
            <>
              <p className={H}>Let's make<br /><Em>their day.</Em></p>
              <button
                onClick={onDismiss}
                className="mt-7 rounded-full bg-brand px-7 py-3 text-base font-medium text-brand-foreground transition-colors hover:bg-brand-dark"
              >
                Make my first card
              </button>
              <button
                onClick={() => setStep(0)}
                className="mt-4 text-[13px] tracking-[0.02em] text-brand hover:text-brand-dark"
              >
                Replay
              </button>
            </>
          ) : (
            BEATS[step].node
          )}
        </motion.div>
      </AnimatePresence>

      {/* Progress dots — one per content beat. */}
      {!isFinal && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center gap-[7px]">
          {BEATS.map((_, i) => (
            <span
              key={i}
              className="h-[6px] rounded-full transition-all duration-300"
              style={{
                width: i === step ? 18 : 6,
                background: i === step ? '#7a76e8' : '#dad8ef',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
