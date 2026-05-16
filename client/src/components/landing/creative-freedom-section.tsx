// client/src/components/landing/creative-freedom-section.tsx
//
// THE killer-feature section — sells the "describe anything imaginable"
// freedom that's the brand's strongest pitch. Two beats:
//
//   Beat 1 — Brainstorm hover-reveal:
//     A static card image with a "speech bubble" mock UI floating
//     beside it. On hover (or scroll-into-view on mobile) the bubble
//     animates in, showing fake AI brainstorm chat. Communicates
//     creative collaboration without exposing the live tool.
//
//   Beat 2 — Style picker:
//     A row of tappable style chips that swap the underlying card
//     preview when hovered. Each chip is a different art style ("Soft
//     watercolour" / "Mid-century" / "Pixar-3D" / "Risograph") with a
//     mini swatch. Hovering preloads the corresponding card image and
//     crossfades it in.
//
// Both beats use Framer Motion for the choreography. No live AI calls
// — the whole section is a marketing demo with prefetched assets.

import { motion } from 'framer-motion';
import { Sparkles, Wand2 } from 'lucide-react';
import { useState } from 'react';
import fathersDayFront from '@/assets/fathers-day-front.png';
import fathersDayInside from '@/assets/fathers-day-inside-new.png';

// Placeholder style options — when Kevin curates real example cards
// per art style, swap `previewSrc` per row.
const STYLES = [
  {
    id: 'watercolour',
    label: 'Soft watercolour',
    swatch: 'linear-gradient(135deg, #ffe4ef, #fef3c7)',
    previewSrc: fathersDayFront,
  },
  {
    id: 'midcentury',
    label: 'Mid-century print',
    swatch: 'linear-gradient(135deg, #fbeed5, #ec4899)',
    previewSrc: fathersDayInside,
  },
  {
    id: 'pixar',
    label: 'Pixar-3D',
    swatch: 'linear-gradient(135deg, #7a76e8, #5c57d4)',
    previewSrc: fathersDayFront,
  },
  {
    id: 'risograph',
    label: 'Risograph',
    swatch: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
    previewSrc: fathersDayInside,
  },
  {
    id: 'or-your-own',
    label: 'Or describe your own',
    swatch: 'transparent',
    previewSrc: fathersDayFront,
    custom: true,
  },
];

/* ─── Brainstorm hover-reveal ────────────────────────────────────── */

interface BubbleLine {
  who: 'you' | 'ai';
  text: string;
}

const BRAINSTORM_LINES: BubbleLine[] = [
  { who: 'you', text: "Birthday card for my mum. She loves gardening." },
  { who: 'ai', text: "How about her tending a sunlit greenhouse, surrounded by orchids?" },
  { who: 'you', text: 'Yes! And maybe a labrador napping at her feet.' },
  { who: 'ai', text: 'Lovely. Want her in a sun hat too?' },
];

function BrainstormReveal() {
  return (
    <div className="relative">
      <img
        src={fathersDayFront}
        alt="A Celebrait card mid-edit"
        className="w-full aspect-square object-cover rounded-2xl"
        style={{
          boxShadow:
            '0 30px 60px -20px rgba(15,23,42,0.32), 0 12px 24px -12px rgba(15,23,42,0.16)',
        }}
      />

      {/* Brainstorm panel — floats over the lower-right of the card,
          breaks past the card edge on the right. The illusion is that
          the user is mid-brainstorm with the AI. */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
        className="absolute -right-4 md:-right-8 lg:-right-12 bottom-8 w-[280px] md:w-[320px] bg-surface-card border border-stone-200 rounded-2xl p-4 shadow-xl"
      >
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-stone-100">
          <div className="w-7 h-7 rounded-full bg-brand-muted flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-brand" strokeWidth={2} />
          </div>
          <p className="text-xs font-semibold text-ink">Brainstorm</p>
        </div>

        <div className="space-y-2.5">
          {BRAINSTORM_LINES.map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: line.who === 'you' ? 8 : -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.18, ease: 'easeOut' }}
              className={`flex ${line.who === 'you' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-snug ${
                  line.who === 'you'
                    ? 'bg-brand text-brand-foreground rounded-br-md'
                    : 'bg-stone-100 text-ink rounded-bl-md'
                }`}
              >
                {line.text}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Style picker ──────────────────────────────────────────────── */

function StylePicker() {
  const [activeStyle, setActiveStyle] = useState(STYLES[0]);

  return (
    <div className="relative">
      {/* Card preview — crossfade between style sources */}
      <div className="relative aspect-square rounded-2xl overflow-hidden bg-surface-cream">
        {STYLES.map((s) => (
          <img
            key={s.id}
            src={s.previewSrc}
            alt={s.label}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
              activeStyle.id === s.id ? 'opacity-100' : 'opacity-0'
            }`}
            style={{
              boxShadow:
                '0 30px 60px -20px rgba(15,23,42,0.32), 0 12px 24px -12px rgba(15,23,42,0.16)',
            }}
          />
        ))}
      </div>

      {/* Chip rail beneath the preview */}
      <div className="mt-6 flex flex-wrap gap-2.5">
        {STYLES.map((s) => {
          const active = activeStyle.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onMouseEnter={() => setActiveStyle(s)}
              onFocus={() => setActiveStyle(s)}
              className={`flex items-center gap-2 h-10 px-3.5 rounded-full border transition-all ${
                active
                  ? 'border-brand bg-brand-muted'
                  : 'border-stone-200 bg-surface-card hover:border-stone-300'
              }`}
            >
              {s.custom ? (
                <Wand2
                  className="w-3.5 h-3.5 text-accent-coral-dark"
                  strokeWidth={1.75}
                />
              ) : (
                <span
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ background: s.swatch }}
                  aria-hidden
                />
              )}
              <span
                className={`text-xs font-medium ${
                  active ? 'text-ink' : 'text-ink-soft'
                }`}
              >
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Section composition ──────────────────────────────────────── */

export function CreativeFreedomSection() {
  return (
    <section className="relative bg-surface py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6 md:px-10">
        <div className="max-w-3xl mb-16 md:mb-20">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-coral-dark font-semibold mb-4">
            Creative freedom
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-tight leading-[1.05]">
            If you can describe it,
            <br />
            we can illustrate it.
          </h2>
          <p className="text-lg text-ink-soft mt-6 leading-relaxed max-w-[52ch]">
            Brainstorm with us, or pick from a house of styles. Either way the
            card ends up looking like nothing else.
          </p>
        </div>

        {/* Beat 1 — brainstorm hover-reveal */}
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center mb-24 md:mb-32">
          <div className="lg:col-span-7">
            <BrainstormReveal />
          </div>
          <div className="lg:col-span-5">
            <h3 className="text-2xl md:text-3xl font-semibold text-ink tracking-tight">
              Brainstorm with the AI.
            </h3>
            <p className="text-base text-ink-soft mt-4 leading-relaxed">
              Stuck? Riff with us. Chat through the scene, the mood, the small
              touches that make it feel like them. We turn the conversation into
              the card.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-ink-soft">
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-coral-dark shrink-0" />
                Describe a moment, not a template
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-coral-dark shrink-0" />
                Add inside jokes, pets, places — they're the magic
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent-coral-dark shrink-0" />
                Tweak any element, free, until it's right
              </li>
            </ul>
          </div>
        </div>

        {/* Beat 2 — style picker */}
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          <div className="lg:col-span-5 order-2 lg:order-1">
            <h3 className="text-2xl md:text-3xl font-semibold text-ink tracking-tight">
              House styles, or your own.
            </h3>
            <p className="text-base text-ink-soft mt-4 leading-relaxed">
              Pick a curated style from our house, or describe your own — pencil
              sketch, comic strip, oil painting on canvas, whatever fits the
              recipient. The look is yours.
            </p>
            <p className="text-xs text-ink-soft/70 mt-6 italic">
              Hover the chips to preview →
            </p>
          </div>
          <div className="lg:col-span-7 order-1 lg:order-2">
            <StylePicker />
          </div>
        </div>
      </div>
    </section>
  );
}
