// client/src/components/landing/hero-floating-section.tsx
//
// Hero v7 (2026-06) — the headline + CTA beat of the celebration experience.
// The floating-card field is NOT here: it's a single always-on fixed backdrop
// (`CelebrationBackdrop`) mounted once on the landing so the objects persist
// across the whole page. This section is transparent and sits over it.

import { Link } from 'wouter';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronUp } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';
import { Button } from '@/components/ui/button';

export function HeroFloatingSection() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const showAuthedTreatment = !isLoading && isAuthenticated;
  const reduced = useReducedMotion() ?? false;

  return (
    <section className="relative flex min-h-[86vh] flex-col items-center justify-center px-6 py-20">
      <div className="relative z-10 flex max-w-[60ch] flex-col items-center text-center">
        {/* Headline — violet shimmer wave on "they'll keep". */}
        <h1 className="font-display text-[40px] font-bold leading-[0.95] tracking-[-0.02em] text-ink sm:text-[54px] md:text-[64px] lg:text-[74px]">
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
            Unbinnable
          </motion.span>
          <br />
          <span className="whitespace-nowrap">Greetings Cards</span>
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
            <Button
              onClick={() => openAuth('/studio/new-card')}
              className="h-12 bg-brand px-8 text-base font-medium text-brand-foreground hover:bg-brand-dark"
            >
              Make my first card
            </Button>
          )}
          <ScrollHint reduced={reduced} />
        </div>
      </div>
    </section>
  );
}

// ── Scroll / swipe affordance ────────────────────────────────────────
// A live "go" cue under the CTA. Desktop: a mouse outline with a green
// wheel-dot travelling down (scroll). Mobile: a green chevron pulsing
// up (swipe). The verb adapts per device. Green reads as an action
// signal against the violet/pink brand.
export function ScrollHint({
  reduced,
  prefix = 'or start',
  suffix = 'to experience',
}: {
  reduced: boolean;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="-mt-1 flex flex-col items-center gap-2.5">
      <p className="text-[13px] text-ink-soft">
        {prefix}{' '}
        <span className="font-medium text-cta-hover">
          <span className="md:hidden">swiping</span>
          <span className="hidden md:inline">scrolling</span>
        </span>{' '}
        {suffix}
      </p>

      {/* Desktop — mouse with an animated scroll-wheel dot */}
      <div className="hidden md:block" aria-hidden>
        <div className="relative h-9 w-[23px] rounded-full border-2 border-cta/70 shadow-[0_0_18px_-4px_rgba(95,217,74,0.55)]">
          <motion.span
            className="absolute left-1/2 top-1.5 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-cta"
            initial={{ y: 0, opacity: 1 }}
            animate={reduced ? undefined : { y: [0, 11, 0], opacity: [1, 0.15, 1] }}
            transition={
              reduced
                ? undefined
                : { duration: 1.6, repeat: Infinity, ease: 'easeInOut' }
            }
          />
        </div>
      </div>

      {/* Mobile — swipe-up chevrons */}
      <div className="md:hidden" aria-hidden>
        <motion.div
          className="text-cta drop-shadow-[0_0_10px_rgba(95,217,74,0.5)]"
          initial={{ y: 0, opacity: 0.7 }}
          animate={reduced ? undefined : { y: [4, -5, 4], opacity: [0.45, 1, 0.45] }}
          transition={
            reduced
              ? undefined
              : { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <ChevronUp className="-mb-3 h-5 w-5" strokeWidth={2.75} />
          <ChevronUp className="h-5 w-5 opacity-60" strokeWidth={2.75} />
        </motion.div>
      </div>
    </div>
  );
}
