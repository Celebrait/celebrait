// client/src/components/landing/hero-floating-section.tsx
//
// Hero v7 (2026-06) — floating celebration field. Replaces the studio-card
// showcase hero with a clean, colourful field of floating 3D celebration
// objects (emoji for now — swap for an image-based icon set later) around the
// headline + CTA. The scroll flow that demos the studio lives further down /
// is iterated separately; this is just the hero beat.
//
// The floating field is SCOPED to this section (absolute, masked centre) so it
// never bleeds into the rest of the landing.

import { Link } from 'wouter';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

/* ─── Floating celebration field ─────────────────────────────────── */
// Distance via a single `depth` 0(far)→1(near) driving size + DOF blur +
// contact shadow + a touch of opacity. Sized in vmin so it scales on mobile
// (own sparser set). Centre-masked so it never crowds the headline.
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const FLOATING_DESKTOP = [
  { x: 31, y: 12, depth: 0.18, icon: '✨', tilt: -8, delay: 0 },
  { x: 69, y: 10, depth: 0.26, icon: '🎈', tilt: 6, delay: 1.4 },
  { x: 87, y: 26, depth: 0.4, icon: '🎁', tilt: -5, delay: 0.6 },
  { x: 13, y: 28, depth: 0.32, icon: '🥂', tilt: 8, delay: 2 },
  { x: 50, y: 8, depth: 0.22, icon: '🌟', tilt: 4, delay: 1.1 },
  { x: 9, y: 72, depth: 0.85, icon: '🎉', tilt: -10, delay: 0.9 },
  { x: 91, y: 68, depth: 0.78, icon: '🎂', tilt: 7, delay: 1.8 },
  { x: 27, y: 90, depth: 0.62, icon: '🍾', tilt: -6, delay: 0.3 },
  { x: 73, y: 91, depth: 0.7, icon: '🎊', tilt: 9, delay: 2.4 },
];
const FLOATING_MOBILE = [
  { x: 15, y: 13, depth: 0.4, icon: '🎈', tilt: -6, delay: 0 },
  { x: 85, y: 16, depth: 0.5, icon: '🎉', tilt: 6, delay: 1.2 },
  { x: 50, y: 9, depth: 0.34, icon: '✨', tilt: 4, delay: 1.4 },
  { x: 13, y: 86, depth: 0.78, icon: '🎁', tilt: -7, delay: 0.6 },
  { x: 87, y: 88, depth: 0.66, icon: '🥂', tilt: 7, delay: 1.8 },
];

function FloatingIcon({
  x,
  y,
  depth,
  icon,
  tilt,
  delay,
}: (typeof FLOATING_DESKTOP)[number]) {
  const size = `clamp(34px, ${lerp(8, 18, depth).toFixed(2)}vmin, 150px)`;
  const blur = (1 - depth) * 2.2;
  const opacity = 0.55 + depth * 0.35;
  const drift = lerp(6, 14, depth) * (tilt >= 0 ? -1 : 1);
  const dur = 8 + depth * 4;
  const sy = Math.round(lerp(6, 16, depth));
  const sb = Math.round(lerp(10, 22, depth));
  const sa = lerp(0.12, 0.22, depth).toFixed(2);
  const filter = `${blur > 0.2 ? `blur(${blur.toFixed(1)}px) ` : ''}drop-shadow(0 ${sy}px ${sb}px rgba(15,23,42,${sa}))`;
  return (
    <motion.div
      className="absolute select-none"
      style={{ left: `${x}%`, top: `${y}%`, opacity }}
      animate={{ y: [0, drift, 0] }}
      transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <div
        aria-hidden
        style={{
          transform: `translate(-50%, -50%) rotate(${tilt}deg)`,
          fontSize: size,
          lineHeight: 1,
          filter,
        }}
      >
        {icon}
      </div>
    </motion.div>
  );
}

function FloatingField({
  cards,
  mask,
  className,
}: {
  cards: typeof FLOATING_DESKTOP;
  mask: string;
  className?: string;
}) {
  const sorted = [...cards].sort((a, b) => a.depth - b.depth);
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ''}`}
      style={{ maskImage: mask, WebkitMaskImage: mask }}
    >
      {sorted.map((c, i) => (
        <FloatingIcon key={i} {...c} />
      ))}
    </div>
  );
}

const DESKTOP_MASK =
  'radial-gradient(58% 56% at 50% 48%, transparent 0%, transparent 44%, #000 86%)';
const MOBILE_MASK =
  'radial-gradient(92% 66% at 50% 46%, transparent 0%, transparent 54%, #000 92%)';

/* ─── Hero ───────────────────────────────────────────────────────── */

export function HeroFloatingSection() {
  const { isAuthenticated, isLoading } = useAuth();
  const showAuthedTreatment = !isLoading && isAuthenticated;
  const reduced = useReducedMotion() ?? false;

  return (
    <section
      className="relative flex min-h-[86vh] flex-col items-center justify-center overflow-hidden px-6 py-20"
      style={{
        background:
          'linear-gradient(180deg, #ffffff 0%, #f8fafc 60%, #eef1f6 100%)',
      }}
    >
      {/* Floating celebration field — scoped to the hero, centre-masked. */}
      <FloatingField cards={FLOATING_DESKTOP} mask={DESKTOP_MASK} className="hidden md:block" />
      <FloatingField cards={FLOATING_MOBILE} mask={MOBILE_MASK} className="md:hidden" />

      <div className="relative z-10 flex max-w-[60ch] flex-col items-center text-center">
        {/* Headline — violet shimmer wave on "they'll keep". */}
        <h1 className="text-[40px] font-semibold leading-[0.95] tracking-[-0.02em] text-ink sm:text-[54px] md:text-[64px] lg:text-[74px]">
          Greetings cards
          <br />
          <motion.span
            className="inline-block overflow-visible bg-clip-text px-1 leading-[1.05] pb-[0.12em] text-transparent"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #0f172a 0%, #0f172a 30%, #7a76e8 45%, #5c57d4 50%, #7a76e8 55%, #0f172a 70%, #0f172a 100%)',
              backgroundSize: '220% 100%',
              backgroundRepeat: 'no-repeat',
            }}
            initial={{ backgroundPosition: '0% 0%' }}
            animate={
              reduced ? undefined : { backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }
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

        <p className="mt-5 text-base leading-relaxed text-ink-soft md:mt-6 md:text-xl">
          Celebrait good times with mind-blowing greetings cards that are
          impossible to forget. Printed &amp; delivered, or opened with a custom
          link.{' '}
          <span className="relative inline-block whitespace-nowrap font-medium text-ink">
            100% creative control.
            <motion.span
              aria-hidden
              className="absolute -bottom-0.5 left-0 right-0 h-[3px] origin-left rounded-full"
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
                  : { scaleX: 1, backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'] }
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

        {/* CTA */}
        <div className="mt-8 flex flex-col items-center gap-4">
          {showAuthedTreatment ? (
            <Link href="/studio">
              <Button className="h-12 bg-brand px-8 text-base font-medium text-brand-foreground hover:bg-brand-dark">
                Open my studio
              </Button>
            </Link>
          ) : (
            <Link href="/login?redirect=/studio/new-card">
              <Button className="h-12 bg-brand px-8 text-base font-medium text-brand-foreground hover:bg-brand-dark">
                Make my first card
              </Button>
            </Link>
          )}
          <p className="-mt-2 text-[13px] text-ink-soft">
            Free to start. No card needed.
          </p>
        </div>
      </div>
    </section>
  );
}
