// client/src/components/landing/how-it-works-strip.tsx
//
// Super-simple "how it works" strip for the lander — four numbered
// beats, big ghost numerals, no cards, no icons. A condensed mirror of
// the studio's first-run journey panel (studio/studio-journey.tsx);
// update both if the maker flow changes.
//
// Deliberately quieter than the killed how-it-works-section.tsx (icon
// tiles) — this one reads in a single glance between the card finale
// and the brainstorm demo.

import { motion } from 'framer-motion';

interface StripStep {
  n: string;
  title: string;
  body: string;
}

const STRIP_STEPS: StripStep[] = [
  {
    n: '01',
    title: 'Tell us who it’s for',
    body: 'A name, an occasion, a photo if you like.',
  },
  {
    n: '02',
    title: 'We paint the card',
    body: 'A premium illustration, made around them.',
  },
  {
    n: '03',
    title: 'Tweak it free',
    body: 'Regenerate any part until it’s just right.',
  },
  {
    n: '04',
    title: 'Printed and posted',
    body: 'To order, on 280gsm gloss — free digital link too.',
  },
];

export function HowItWorksStrip() {
  return (
    <section className="relative bg-surface-card border-y border-stone-200/70 py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-6 md:px-10">
        <div className="text-center mb-10 md:mb-12">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-coral-dark font-semibold mb-3">
            How it works
          </p>
          <h2 className="text-2xl md:text-4xl font-semibold text-ink tracking-tight">
            Four steps. About five minutes.
          </h2>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
          {STRIP_STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.45, delay: i * 0.08, ease: 'easeOut' }}
            >
              <p
                aria-hidden
                className="text-5xl md:text-6xl font-bold text-brand-muted leading-none mb-3 select-none"
              >
                {step.n}
              </p>
              <p className="text-sm md:text-base font-semibold text-ink mb-1">
                {step.title}
              </p>
              <p className="text-xs md:text-sm text-ink-soft leading-relaxed">
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
