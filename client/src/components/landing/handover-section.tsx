// client/src/components/landing/handover-section.tsx — THE HANDOVER
//
// "Send direct. Or receive it yourself, to hand over." Replaces the old
// StatementSection ("Everyone gets cards. Nobody gets them. / This is the
// unbinnable kind.") — Kevin 2026-07-17 wanted this beat made explicit
// and VISUAL rather than a bare aphorism.
//
// The two columns are PRODUCT-TRUE, not a marketing pairing. A blank
// inside has no giving choice: it's printed and posted to the SENDER,
// always, because you can't post someone an empty card — that's the
// blank-card footgun deliberately designed out (see the header comment in
// components/studio/giving-moment.tsx). Written insides are the ones that
// get a destination choice. So "your message printed → either
// destination" / "blank → always to you" is exactly the rule, and the
// supporting copy says so out loud.
//
// This copy previously lived buried at the bottom of ObjectSection as two
// 13px cards under a spec list — removed from there so the page doesn't
// make the same point twice.
//
// Extracted from landing-keeper.tsx 2026-10-09 so /create can carry it
// too. The copy is door-agnostic (nothing here is about photos or
// scenes), so there is no `door` prop — one section, two doors.

import { Send, PenLine, type LucideIcon } from 'lucide-react';
import { Rise } from '@/components/landing/rise';
import { DISPLAY } from '@/pages/doorway';

const HANDOVER: Array<{
  icon: LucideIcon;
  tag: string;
  title: string;
  body: string;
  img: string;
  alt: string;
}> = [
  {
    icon: Send,
    tag: 'F1',
    title: 'Straight to them',
    body: 'Posted tracked in a kraft envelope, your message printed inside.',
    img: '/handover-printed.webp',
    alt: 'A finished Celebrait birthday card standing on a desk beside its kraft envelope.',
  },
  {
    icon: PenLine,
    tag: 'F2',
    title: 'Or to you first',
    body: 'Posted to you with a spare envelope, ready to hand over in person.',
    img: '/handover-blank.webp',
    alt: 'An open Celebrait card — blank inside with a decorative floral border, ready to handwrite.',
  },
];

export function HandoverSection() {
  return (
    // Same chassis as THE INSIDE ("The magic's digital. The card isn't.") —
    // text left, staggered pair of shots right (Kevin 2026-07-17), so the
    // two picture-led sections rhyme instead of each inventing a layout.
    // #delivery is the footer's anchor; scroll-mt clears the fixed header.
    <section id="delivery" className="scroll-mt-32 px-6 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[0.85fr_1.15fr] md:gap-16">
        <Rise>
          <h2 className={`text-[clamp(30px,4.4vw,44px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>
            Send direct. Or receive it yourself, to hand over.
          </h2>
          <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.6] text-keeper-body">
            A soppy essay, a heartfelt message, a snappy one-liner. Tell them
            how you feel and we'll add it to the inside (styled to match the
            front). Rather write it yourself with good old ink? All good —
            it'll still look the part.
          </p>
          {/* The two destinations, stacked. The icon badge is the hierarchy
              rung between the headline and the meta copy; it wears the same
              green pair as the carousel arrows + signpost, so green means
              "go" everywhere on the page rather than decoration. */}
          <div className="mt-8 space-y-6">
            {HANDOVER.map((h) => {
              const Icon = h.icon;
              return (
                <div key={h.tag} className="flex gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cta-light text-cta-dark">
                    <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                  </span>
                  <div>
                    {/* Fraunces Bold comes from `.keeper-serif h3` in
                        index.css (the page makes EVERY heading serif) —
                        don't add a font-weight, that rule out-specifies it. */}
                    <h3 className="text-[18px] text-keeper-ink">{h.title}</h3>
                    <p className="mt-1 max-w-[34ch] text-[14px] leading-relaxed text-keeper-meta">
                      {h.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Rise>
        <Rise delay={0.1}>
          {/* Staggered pair — deliberately the SAME geometry as CardPair
              (w-[92%] sm:w-[55%], self-start then self-end, gap-5) so this
              reads as a sibling of the Inside section's visual. F1 = the
              finished printed card; F2 = the open card, blank inside with
              the decorative border. */}
          <div className="relative flex flex-col gap-5">
            {/* Envelope seal — the "only open on your special day" round
                sticker that goes on the direct-to-recipient kraft envelope.
                Signals the sealed D2R option; sits above the card cluster
                (top-right). Static tilt + shadow read it as a real sticker. */}
            {/* Deliberately NOT /envelope-seal.png: that file is the
                PRODIGI PRINT asset (803×803 PNG, fetched by URL by
                prodigi-provider.ts) and must not change. It's 804KB —
                which we were shipping to every visitor to draw a 240px
                sticker. This is the same art at web size: 28KB, −96%. */}
            <img
              src="/envelope-seal-web.webp"
              alt="Celebrait envelope seal — only open on your special day"
              loading="lazy"
              decoding="async"
              width={480}
              height={480}
              className="pointer-events-none absolute -top-12 right-0 z-20 w-28 rotate-[-8deg] drop-shadow-[0_16px_30px_rgba(33,29,25,0.22)] sm:w-32 md:-top-20 md:-right-10 md:w-52 lg:w-60"
            />
            {/* Intrinsic 1100×734 — reserves the box so the pair doesn't
                shove the section as each one decodes (see ProofPair). */}
            {HANDOVER.map((h, i) => (
              <img
                key={h.tag}
                src={h.img}
                alt={h.alt}
                loading="lazy"
                decoding="async"
                width={1100}
                height={734}
                className={`w-[92%] rounded-[8px] shadow-[0_18px_42px_-22px_rgba(33,29,25,0.42)] ring-1 ring-black/5 sm:w-[55%] ${
                  i === 0 ? 'self-start' : 'self-end'
                }`}
              />
            ))}
          </div>
        </Rise>
      </div>
    </section>
  );
}
