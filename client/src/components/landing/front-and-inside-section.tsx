// client/src/components/landing/front-and-inside-section.tsx
//
// Two product moments stacked: how the FRONT is styled (text rendered
// as part of the illustration, not slapped on top), and how the INSIDE
// works (type a message and we'll style it to match the front, OR leave
// it blank and we'll lay out a beautiful blank page for handwriting).
//
// Visually: full-width white surface, two big card composites shown
// side by side at desktop, stacked at mobile. Each composite is a
// static card image plus a labelled overlay calling out the feature.

import { motion } from 'framer-motion';
import { Type, PenLine } from 'lucide-react';
import fathersDayFront from '@/assets/fathers-day-front.jpg';
import fathersDayInside from '@/assets/fathers-day-inside-new.jpg';

interface ShowcaseProps {
  src: string;
  label: string;
  title: string;
  body: string;
  Icon: typeof Type;
  /** Faux-overlay tag that sits on top of the card. */
  overlay?: { top?: string; left?: string; right?: string; bottom?: string; text: string };
}

function Showcase({ src, label, title, body, Icon, overlay }: ShowcaseProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex flex-col"
    >
      <div
        className="relative aspect-square rounded-2xl overflow-hidden bg-surface-cream mb-8"
        style={{
          boxShadow:
            '0 30px 60px -20px rgba(15,23,42,0.28), 0 12px 24px -12px rgba(15,23,42,0.14)',
        }}
      >
        <img
          src={src}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
        />

        {overlay && (
          <div
            className="absolute bg-surface-card/95 backdrop-blur-sm border border-stone-200 rounded-xl px-3.5 py-2 shadow-md"
            style={{
              top: overlay.top,
              left: overlay.left,
              right: overlay.right,
              bottom: overlay.bottom,
            }}
          >
            <p className="text-[11px] font-medium text-ink whitespace-nowrap">
              {overlay.text}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className="bg-brand-muted rounded-lg w-9 h-9 flex items-center justify-center">
          <Icon className="w-4 h-4 text-brand" strokeWidth={1.75} />
        </div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-stone-400 font-medium">
          {label}
        </p>
      </div>

      <h3 className="text-2xl font-semibold text-ink tracking-tight mb-3">
        {title}
      </h3>
      <p className="text-base text-ink-soft leading-relaxed">{body}</p>
    </motion.div>
  );
}

export function FrontAndInsideSection() {
  return (
    <section className="relative bg-surface-card py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="max-w-3xl mb-16 md:mb-20">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-coral-dark font-semibold mb-4">
            Front & inside
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-tight leading-[1.05]">
            Every detail, illustrated.
          </h2>
          <p className="text-lg text-ink-soft mt-6 leading-relaxed max-w-[52ch]">
            Words on the front aren't slapped on — they're painted in. The
            inside is yours: type a message and we'll style it to match the
            front, or leave it blank for handwriting.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-10 md:gap-16">
          <Showcase
            src={fathersDayFront}
            Icon={Type}
            label="The front"
            title="Words painted into the scene."
            body="Names, ages, occasions — rendered in the same style as the illustration. Looks designed, not generated."
            overlay={{
              top: '24px',
              left: '24px',
              text: 'Happy 60th, Dad ✨',
            }}
          />
          <Showcase
            src={fathersDayInside}
            Icon={PenLine}
            label="The inside"
            title="Type a message, or leave it blank."
            body="A typed message gets styled to match the front. Leaving it blank gives you a beautifully laid-out page for your own handwriting."
            overlay={{
              top: '24px',
              right: '24px',
              text: 'Type or handwrite',
            }}
          />
        </div>
      </div>
    </section>
  );
}
