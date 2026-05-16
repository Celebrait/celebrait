// client/src/components/landing/founder-note-section.tsx
//
// Quiet, signed paragraph between the heavy product sections and the
// FAQ. Sells craft + intent. No big visual — typography does the work.
// Headshot left intentionally blank for now (Kevin's call: real photo
// or wordmark, decide post-launch).

export function FounderNoteSection() {
  return (
    <section className="relative bg-surface py-24 md:py-32">
      <div className="max-w-3xl mx-auto px-6 md:px-10 text-center">
        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-coral-dark font-semibold mb-6">
          A note from us
        </p>
        <p className="text-xl md:text-2xl text-ink leading-relaxed font-medium">
          We started Celebrait because greeting cards lost their soul. Mass-
          produced, vaguely pleasant, instantly forgotten. We wanted cards that
          felt designed for one person, made by hand, and worth keeping in a
          drawer for years. So we built one.
        </p>
        <p className="text-sm text-ink-soft mt-8 italic">
          — Aidan & the Celebrait team
        </p>
      </div>
    </section>
  );
}
