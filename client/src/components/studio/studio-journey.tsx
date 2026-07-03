// client/src/components/studio/studio-journey.tsx
//
// First-run "How it works" journey panel — the numbered step-card grid
// shown on Studio Home BEFORE the user has ever completed a card
// (empty + draft-pending states; see studio.tsx). Gated on server truth
// (zero ready/sent cards), NOT localStorage, so a returning user who
// still hasn't made a card sees it on any device — and it disappears
// for good the moment their first card completes.
//
// Modelled on the photobooth-style numbered card grid Kevin liked
// (2026-07-03), translated to Celebrait's warm light style: white cards,
// violet accents, big ghost numerals. Steps mirror the ACTUAL maker
// flow — keep them in sync with CARD_MAKER_STEPS if that changes.
//
// The condensed 4-step landing strip (landing/how-it-works-strip.tsx)
// mirrors this same journey — update both if the flow changes.

import { Link } from 'wouter';
import {
  MessageSquareHeart,
  Camera,
  Palette,
  Sparkles,
  SlidersHorizontal,
  Send,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';

interface JourneyStep {
  icon: LucideIcon;
  title: string;
  body: string;
}

const JOURNEY_STEPS: JourneyStep[] = [
  {
    icon: MessageSquareHeart,
    title: 'Tell us who it’s for',
    body: 'A name, the occasion, and the vibe you’re after.',
  },
  {
    icon: Camera,
    title: 'Add a photo',
    body: 'Their face goes into the scene — or skip it entirely.',
  },
  {
    icon: Palette,
    title: 'Describe the scene',
    body: 'A few words is plenty. We’ll do the imagining.',
  },
  {
    icon: Sparkles,
    title: 'We paint your card',
    body: 'A premium illustration, made around them, in about a minute.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Tweak it free',
    body: 'Regenerate any part — scene, style, words — until it’s right.',
  },
  {
    icon: Send,
    title: 'We print and post it',
    body: '280gsm gloss card to any UK door — free digital link included.',
  },
];

export function StudioJourney({ showCta = true }: { showCta?: boolean }) {
  return (
    <section className="mb-16" data-testid="studio-journey">
      <div className="text-center mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-ink tracking-tight">
          How it works
        </h2>
        <p className="text-sm text-stone-600 mt-1">
          Your first card, start to finish — about five minutes.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {JOURNEY_STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div
              key={step.title}
              className="relative bg-white rounded-2xl border border-stone-200 p-5 overflow-hidden hover:border-brand/40 transition-colors"
            >
              {/* Ghost numeral — the sequencing cue, kept faint so the
                  card content leads. */}
              <span
                aria-hidden
                className="absolute top-2 right-4 text-6xl font-bold text-stone-100 select-none leading-none"
              >
                {i + 1}
              </span>
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-brand-muted text-brand-dark flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-semibold text-ink mb-1">
                  {step.title}
                </p>
                <p className="text-xs text-stone-600 leading-relaxed">
                  {step.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {showCta && (
        <div className="text-center mt-8">
          <Link
            href="/studio/new-card"
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white rounded-full px-7 py-3 text-sm font-semibold transition-colors shadow-sm"
            data-testid="journey-start-cta"
          >
            Start your first card
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
