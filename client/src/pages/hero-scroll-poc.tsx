// client/src/pages/hero-scroll-poc.tsx
//
// PROOF OF CONCEPT — scroll "dolly" through the hero copy.
// Intro screen shows ONLY the current hero headline + body. Scrolling dollies
// the camera FORWARD through the copy (CSS perspective translateZ on scroll),
// so the words rush up and past you. A "Scroll to walk through" hint (in the
// gesture-hint design) invites the scroll, then fades on first move.
//
// Pure DOM + framer-motion (real crisp copy, no WebGL). Isolated /hero-poc.

import { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

export default function HeroScrollPocPage() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Scroll progress across the tall spacer drives the dolly.
  const { scrollYProgress } = useScroll({ target: ref });

  // Camera moves forward → copy translates toward the viewer (perspective
  // does the zoom), then fades as it passes "through" the lens.
  const z = useTransform(scrollYProgress, [0, 1], [0, 820]);
  const opacity = useTransform(scrollYProgress, [0, 0.55, 0.82], [1, 1, 0]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.06], [1, 0]);

  return (
    <div ref={ref} className="relative" style={{ height: '260vh' }}>
      {/* Fixed viewport with the perspective "lens". */}
      <div
        className="fixed inset-0 overflow-hidden"
        style={{
          perspective: '1000px',
          background:
            'radial-gradient(120% 90% at 50% 30%, #ffffff 0%, #f4f3fb 55%, #efeefb 100%)',
        }}
      >
        <div
          className="absolute inset-0 flex items-center justify-center px-6"
          style={{ transformStyle: 'preserve-3d' }}
        >
          <motion.div
            style={{ z, opacity }}
            className="max-w-[60ch] text-center will-change-transform"
          >
            <h1 className="text-[40px] sm:text-[56px] md:text-[68px] lg:text-[80px] font-semibold text-ink leading-[0.95] tracking-[-0.02em]">
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
                animate={
                  reduced
                    ? undefined
                    : { backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }
                }
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
                they'll keep.
              </motion.span>
            </h1>

            <p className="mt-5 md:mt-6 text-base md:text-xl text-ink-soft leading-relaxed mx-auto">
              Celebrait good times with mind-blowing greetings cards that are
              impossible to forget. Printed &amp; delivered, or opened with a
              custom link.{' '}
              <span className="font-medium text-ink">100% creative control.</span>
            </p>
          </motion.div>
        </div>

        {/* Scroll hint — gesture-hint design, fades on first scroll. */}
        <motion.div
          style={{ opacity: hintOpacity }}
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
