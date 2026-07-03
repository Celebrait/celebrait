// client/src/components/landing/send-it-your-way-section.tsx
//
// Sells the "what happens next" half of the product. Two beats side
// by side at desktop, stacked at mobile:
//
//   Beat 1 — Digital recipient viewer:
//     Mock of the public viewer experience. A "Tap to open" envelope
//     graphic that auto-loops the open animation every few seconds so
//     the section is alive without user input.
//
//   Beat 2 — Print quality + delivery:
//     Specs for the printed product — paper weight, finish, delivery
//     options. Text-led with a single supporting visual (the back of
//     a printed card with the credit line).
//
// This is also where we anchor the #delivery URL fragment that the
// footer Help column points at.

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Truck, Sparkles, Package, MailOpen, Globe } from 'lucide-react';
import fathersDayFront from '@/assets/fathers-day-front.jpg';

/** Auto-looping envelope-opening mock. Just CSS transforms — full
 *  Lottie/three.js for one section is overkill. The animation runs on
 *  a 4-second cycle: closed → opening → revealed → closed. */
function EnvelopeMock() {
  const [phase, setPhase] = useState<'closed' | 'opening' | 'revealed'>('closed');

  useEffect(() => {
    let cancelled = false;
    const tick = (next: 'closed' | 'opening' | 'revealed', delay: number) => {
      setTimeout(() => {
        if (!cancelled) setPhase(next);
      }, delay);
    };

    const cycle = () => {
      tick('opening', 800);
      tick('revealed', 2000);
      tick('closed', 4500);
      tick('opening', 5300);
    };

    cycle();
    const interval = setInterval(cycle, 5500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      className="relative aspect-[4/3] rounded-2xl overflow-hidden"
      style={{
        background:
          'radial-gradient(800px 600px at 50% 40%, #fff8ec 0%, #fef7ed 50%, #fbeed5 100%)',
      }}
    >
      {/* Card revealed underneath the envelope */}
      <div
        className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out ${
          phase === 'revealed'
            ? 'scale-100 opacity-100'
            : phase === 'opening'
              ? 'scale-90 opacity-70'
              : 'scale-75 opacity-0'
        }`}
        style={{ width: '52%' }}
      >
        <img
          src={fathersDayFront}
          alt="Card preview"
          className="w-full aspect-square object-cover rounded-xl"
          style={{
            boxShadow:
              '0 20px 40px -16px rgba(15,23,42,0.32), 0 8px 16px -8px rgba(15,23,42,0.18)',
          }}
        />
      </div>

      {/* Envelope flap — folds up when opening */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[64%] aspect-[4/3] pointer-events-none">
        <div
          className={`absolute inset-0 origin-bottom transition-transform duration-700 ease-out ${
            phase === 'closed' ? 'rotate-0' : '-rotate-180'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-stone-50 to-stone-100 rounded-t-lg border border-stone-200" />
          <div
            className="absolute inset-x-0 bottom-0 h-[60%]"
            style={{
              clipPath: 'polygon(0% 0%, 50% 100%, 100% 0%)',
              background: 'linear-gradient(to bottom, #f5f5f4, #e7e5e4)',
            }}
          />
        </div>
      </div>

      {/* Pinned label */}
      <div className="absolute bottom-4 left-4 bg-surface-card/95 backdrop-blur-sm border border-stone-200 rounded-full px-3 py-1.5 shadow-sm">
        <div className="flex items-center gap-1.5">
          <MailOpen className="w-3 h-3 text-brand" strokeWidth={2} />
          <p className="text-[10px] font-medium text-ink uppercase tracking-wider">
            Auto-opens for them
          </p>
        </div>
      </div>
    </div>
  );
}

interface PrintFeature {
  icon: typeof Truck;
  title: string;
  body: string;
}

const PRINT_FEATURES: PrintFeature[] = [
  {
    icon: Sparkles,
    title: 'Premium 280gsm gloss card',
    body: 'Gloss-coated art card, HP Indigo digital print — crisp, vivid colour.',
  },
  {
    icon: Package,
    title: 'Printed to order in up to 72 hrs',
    body: 'Every card is made just for you before it ships — no shelf, no stock.',
  },
  {
    icon: Truck,
    title: 'Then posted, tracked',
    body: 'Royal Mail 24 as standard, or Express & Overnight couriers to speed up the post.',
  },
  {
    icon: Globe,
    title: 'UK launch · more soon',
    body: 'United Kingdom today. South Africa, Europe and the US in the pipeline.',
  },
];

export function SendItYourWaySection() {
  return (
    <section id="delivery" className="relative bg-surface py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="max-w-3xl mb-16 md:mb-20">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-coral-dark font-semibold mb-4">
            Send it your way
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-tight leading-[1.05]">
            Printed, posted,
            <br />
            and shareable.
          </h2>
          <p className="text-lg text-ink-soft mt-6 leading-relaxed max-w-[52ch]">
            A premium 280gsm gloss card, posted anywhere in the UK — and every
            one comes with a free private link to share too.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16">
          {/* Beat 1 — digital viewer mock */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <EnvelopeMock />
            <h3 className="text-2xl font-semibold text-ink tracking-tight mt-8 mb-3">
              A link to share, too.
            </h3>
            <p className="text-base text-ink-soft leading-relaxed">
              Recipients open the card in any browser — no app, no signup.
              Watch the envelope, open the card, replay it forever. Free with
              every Celebrait.
            </p>
          </motion.div>

          {/* Beat 2 — print specs */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
            className="bg-surface-card border border-stone-200 rounded-2xl p-8 md:p-10"
          >
            <h3 className="text-2xl font-semibold text-ink tracking-tight mb-2">
              Printed and posted.
            </h3>
            <p className="text-base text-ink-soft leading-relaxed mb-8">
              £8.99 plus postage — HP Indigo printed on 280gsm gloss card,
              posted in a kraft envelope.
            </p>

            <div className="space-y-5">
              {PRINT_FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="flex items-start gap-4">
                    <div className="bg-accent-coral-light rounded-lg w-9 h-9 flex items-center justify-center shrink-0">
                      <Icon
                        className="w-4 h-4 text-accent-coral-dark"
                        strokeWidth={1.75}
                      />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink mb-0.5">
                        {f.title}
                      </p>
                      <p className="text-sm text-ink-soft leading-relaxed">
                        {f.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
