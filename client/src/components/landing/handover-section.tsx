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
import { copyFor } from '@shared/market-copy';

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
    body: `${copyFor().sentHow} in a kraft envelope, your message printed inside.`,
    img: '/handover-printed.webp',
    alt: 'A finished Celebrait birthday card standing on a desk beside its kraft envelope.',
  },
  {
    icon: PenLine,
    tag: 'F2',
    title: 'Or to you first',
    body: 'Posted to you with a spare envelope, ready to hand over in person.',
    img: '/handover-blank.webp',
    alt: 'An open Celebrait card, blank inside with a decorative floral border, ready to handwrite.',
  },
];

export function HandoverSection() {
  return (
    // REBUILT 2026-11-11. This used to share THE INSIDE's chassis on
    // purpose (text left, staggered pair of desk shots right) — and with
    // the two sections now two apart, three reviews called them twins. So
    // this one is the page's "choice" layout instead: centred heading, then
    // the two destinations as equal side-by-side panels, each with its own
    // photo. Copy and the product rule above are unchanged.
    // #delivery is the footer's anchor; scroll-mt clears the fixed header.
    <section id="delivery" className="scroll-mt-32 px-6 py-16 md:py-32">
      <div className="mx-auto max-w-5xl">
        <Rise className="mx-auto max-w-3xl text-center">
          <h2 className={`text-[clamp(30px,4.4vw,44px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>
            Send direct. Or receive it yourself, to hand over.
          </h2>
          <p className="mx-auto mt-4 max-w-[58ch] text-[17px] leading-[1.6] text-keeper-body">
            A soppy essay, a heartfelt message, a snappy one-liner. Tell them
            how you feel and we'll add it to the inside (styled to match the
            front). Rather write it yourself with good old ink? All good,
            it'll still look the part.
          </p>
        </Rise>
        <div className="relative mt-12 grid gap-6 md:mt-16 md:grid-cols-2 md:gap-8">
          {/* Envelope seal — the "only open on your special day" round
              sticker that goes on the direct-to-recipient kraft envelope,
              so it sits on the corner of THAT panel. Static tilt + shadow
              read it as a real sticker. */}
          {/* Deliberately NOT /envelope-seal.png: that file is the
              PRODIGI PRINT asset (803×803 PNG, fetched by URL by
              prodigi-provider.ts) and must not change. It's 804KB. This
              is the same art at web size: 28KB. */}
          <img
            src="/envelope-seal-web.webp"
            alt="Celebrait envelope seal: only open on your special day"
            loading="lazy"
            decoding="async"
            width={480}
            height={480}
            className="pointer-events-none absolute -top-6 right-2 z-20 w-24 rotate-[-8deg] drop-shadow-[0_16px_30px_rgba(33,29,25,0.22)] sm:w-28 md:-top-14 md:left-[calc(50%-5.5rem)] md:right-auto md:w-36"
          />
          {HANDOVER.map((h, i) => {
            const Icon = h.icon;
            return (
              <Rise key={h.tag} delay={i * 0.08}>
                <div className="h-full overflow-hidden rounded-[24px] border border-keeper-hair bg-white shadow-[0_24px_60px_-36px_rgba(33,29,25,0.4)]">
                  {/* Intrinsic 1100×734 — reserves the box so the panel
                      doesn't jump as the photo decodes. */}
                  <img
                    src={h.img}
                    alt={h.alt}
                    loading="lazy"
                    decoding="async"
                    width={1100}
                    height={734}
                    className="block aspect-[3/2] w-full object-cover"
                  />
                  <div className="flex gap-4 p-6 md:p-7">
                    {/* Violet tint, not green: green is for readiness
                        states on this site, and these are choices. */}
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-muted text-brand-dark">
                      <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
                    </span>
                    <div>
                      {/* Fraunces Bold comes from `.keeper-serif h3` in
                          index.css (the page makes EVERY heading serif) —
                          don't add a font-weight, that rule out-specifies it. */}
                      <h3 className="text-[21px] leading-tight text-keeper-ink">{h.title}</h3>
                      <p className="mt-1.5 text-[15px] leading-relaxed text-keeper-body">
                        {h.body}
                      </p>
                    </div>
                  </div>
                </div>
              </Rise>
            );
          })}
        </div>
      </div>
    </section>
  );
}
