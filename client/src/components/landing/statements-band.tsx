// client/src/components/landing/statements-band.tsx
//
// "Things we know" — the rotating statements given their own room
// (Aidan 2026-08-04: "these quotes deserve their own space… nicely
// styled… something cool"). A full-bleed ink band between the product
// story and the Occasions pitch: one line at a time, cream Fraunces at
// display size, ticks marking position.
//
// Why a dark band: the landing is warm paper end to end, so an ink
// interval reads as a held breath — and it echoes the ticker's
// ink→violet identity, which is also where the free-card offer lives.
// The lines rotate on an 8s dwell (longer than the studio's 6s: bigger
// type, more to read). prefers-reduced-motion pins the first line.

import { occasionFacts } from '@/lib/moments';

export function StatementsBand() {
  const lines = occasionFacts();
  const dwell = 8; // seconds per line — keep in sync with the CSS cycle

  return (
    <section
      className="relative overflow-hidden bg-[#211D19] px-6 py-20 md:py-28"
      aria-label="Things we know about cards"
      data-testid="statements-band"
    >
      {/* Ambient violet wash — the ticker's gradient, dialled right down. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-[#5c57d4]/25 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-[#8B87E8]/10 blur-[100px]"
      />

      <div className="relative mx-auto max-w-3xl text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#8B87E8]">
          Things we know
        </p>

        <div className="statements relative mt-7 min-h-[124px] sm:min-h-[120px] lg:min-h-[136px]">
          {lines.map((line, i) => (
            <p
              key={i}
              className="absolute inset-x-0 top-0 font-display text-[clamp(22px,3.4vw,34px)] font-semibold leading-[1.25] tracking-[-0.015em] text-[#FAF8F4] [text-wrap:balance]"
              style={{ animationDelay: `${i * dwell}s` }}
            >
              {line}
            </p>
          ))}
        </div>

        {/* Position ticks — one per line, lighting in step with the copy. */}
        <div className="mt-2 flex items-center justify-center gap-2" aria-hidden>
          {lines.map((_, i) => (
            <span
              key={i}
              className="statement-tick h-[3px] w-7 rounded-full bg-white/20"
              style={{ animationDelay: `${i * dwell}s` }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
