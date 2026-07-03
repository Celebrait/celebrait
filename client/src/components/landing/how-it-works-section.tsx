// client/src/components/landing/how-it-works-section.tsx
//
// Three-step explainer. Bg white (rhythm break from the cream hero).
// Steps fade-in on scroll-into-view (framer-motion + viewport once).
// Icons are lucide, stroke 1.75, in the violet `brand-muted` tile
// pattern (the studio's non-interactive context-marker style).

import { motion } from 'framer-motion';
import { MessageSquareHeart, Sparkles, Send } from 'lucide-react';

interface Step {
  icon: typeof MessageSquareHeart;
  eyebrow: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    icon: MessageSquareHeart,
    eyebrow: 'Step 01',
    title: 'Tell us about them',
    body: 'A name, an occasion, a photo, and a few words about the scene. That\'s all we need to start.',
  },
  {
    icon: Sparkles,
    eyebrow: 'Step 02',
    title: 'We illustrate it',
    body: 'A premium AI illustrator paints your card in seconds. Tweak any part for free until it\'s right.',
  },
  {
    icon: Send,
    eyebrow: 'Step 03',
    title: 'We print and post it',
    body: 'A premium 280gsm gloss card, made to order (up to 72 hrs) then posted across the UK — with a private animated link to share included.',
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="relative bg-surface-card py-24 md:py-32"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="text-center mb-16 md:mb-20">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-coral-dark font-semibold mb-4">
            How it works
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-tight">
            From idea to inbox in minutes.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-8 md:gap-10">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.eyebrow}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-80px' }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: 'easeOut' }}
                className="relative"
              >
                <div className="bg-brand-muted rounded-xl w-12 h-12 flex items-center justify-center mb-6">
                  <Icon className="w-5 h-5 text-brand" strokeWidth={1.75} />
                </div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400 font-medium mb-2">
                  {step.eyebrow}
                </p>
                <h3 className="text-xl md:text-2xl font-semibold text-ink mb-3 tracking-tight">
                  {step.title}
                </h3>
                <p className="text-base text-ink-soft leading-relaxed">
                  {step.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
