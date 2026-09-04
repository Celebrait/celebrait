// client/src/pages/gate.tsx — THE GATE (/)
//
// Aidan, 2026-09-03: "a super ridic simple doorway that asks the users
// what kind of creator they are — and then points them at either the
// current LP or the door one. Both can have links to the others."
//
// Aidan, 2026-09-04: no images; communicate EFFORT — what they need,
// what they get, what they can and can't do, that the image models
// differ, speed. Then: "so heavy with text — summarise, visual
// hierarchy, pro-choice label, second option visible on mobile
// (collapse the info)".
//
// So each door is: route label + badge · title · one line · a strip of
// three facts (time · effort · price) · the button · and the detail
// folded behind "What you need, what you get". The door is a plain
// panel (not one big link) so the fold can open without navigating.
// Every fact is true of the live routes — the photo studio renders ONE
// card per go on the bigger model at print quality (minutes); the
// three-card maker renders THREE at once on the quicker model (about a
// minute). The maker's chosen front is NOT re-rendered at high, so we
// don't say it is.

import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { Camera, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { TrustChips } from '@/pages/landing-keeper';
import { CardDrift } from '@/components/catalogue/card-drift';
import { DISPLAY } from '@/pages/doorway';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

const doorCls = 'relative flex flex-col rounded-2xl border border-keeper-hair bg-white/70 p-5 shadow-[0_12px_40px_-24px_rgba(33,29,25,0.3)] backdrop-blur-sm sm:p-6';
const ctaCls = 'inline-flex items-center justify-center gap-2 rounded-full bg-keeper-ink px-6 py-3 text-[15px] font-semibold text-keeper-paper transition-colors hover:bg-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-keeper-gold';

/** One of the three facts in the strip: a small label over a big value. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-keeper-meta">{label}</div>
      <div className="mt-0.5 font-display text-[18px] font-bold sm:text-[19px] leading-tight text-keeper-ink">{children}</div>
    </div>
  );
}

/** Effort as four dots — reads at a glance, no adjectives needed. */
function Effort({ level, word }: { level: 1 | 2 | 3 | 4; word: string }) {
  return (
    <span className="inline-flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
      <span className="inline-flex gap-1 pt-1 sm:pt-0" aria-hidden>
        {[1, 2, 3, 4].map((n) => (
          <span key={n} className={`h-2 w-2 rounded-full ${n <= level ? 'bg-keeper-ink' : 'bg-keeper-hair'}`} />
        ))}
      </span>
      <span>{word}</span>
    </span>
  );
}

/** The folded detail: four short lines under tiny labels. */
function Detail({ rows }: { rows: Array<[string, string]> }) {
  return (
    <details className="group/d mt-4 border-t border-keeper-hair pt-3 sm:mt-5">
      <summary className="flex cursor-pointer list-none items-center justify-between text-[13.5px] font-medium text-keeper-ink [&::-webkit-details-marker]:hidden">
        What you need, what you get
        <ChevronDown className="h-4 w-4 text-keeper-meta transition-transform group-open/d:rotate-180" />
      </summary>
      <dl className="mt-3 space-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[5.5rem_1fr] gap-x-3">
            <dt className="pt-[3px] text-[10.5px] font-semibold uppercase tracking-[0.12em] text-keeper-meta">{k}</dt>
            <dd className="text-[13.5px] leading-relaxed text-keeper-body">{v}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

export default function GatePage() {
  useSeo('/');
  const photo = gbp(cardPriceGBP('photo'));
  const maker = gbp(cardPriceGBP('maker'));
  const rack = gbp(cardPriceGBP('rack'));

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="pt-[120px] md:pt-32">
        <section className="px-6 pb-16 pt-4 md:pb-20 md:pt-16">
          <div className="mx-auto max-w-5xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">Unbinnable Greetings Cards</p>
            <h1 className={`mt-3 max-w-[20ch] text-[clamp(30px,5.4vw,58px)] leading-[1.06] text-balance ${DISPLAY}`}>
              Before we create, what kind of card maker are you?
            </h1>
            <p className="mt-2.5 max-w-[38rem] text-[15px] leading-relaxed text-keeper-body md:text-[17px]">
              Celebrait offers two unique ways to design a greetings card that's all about them.
              Pick one (you can always switch later once you know what we're about).
            </p>

            <div className="mt-7 grid gap-4 md:mt-10 md:grid-cols-2 md:gap-5">
              {/* ── Door one — the photo route ── */}
              <div className={doorCls}>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">
                    <Camera className="h-4 w-4 text-cta" /> Photo route
                  </span>
                  <span className="rounded-full bg-keeper-ink px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-keeper-paper">Pro choice</span>
                </div>
                <h2 className="mt-3 font-display text-[24px] font-bold leading-tight text-keeper-ink sm:text-[26px]">I've got a photo of them.</h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-keeper-body">
                  They become the artwork, in a scene you direct.
                </p>

                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-keeper-hair pt-3.5 sm:mt-5 sm:pt-4">
                  <Fact label="Time">~10 min</Fact>
                  <Fact label="Effort"><Effort level={3} word="More" /></Fact>
                  <Fact label="Price">{photo}</Fact>
                </div>

                <div className="mt-4 sm:mt-5">
                  <Link href="/photo" className={ctaCls}>Start with a photo <ArrowRight className="h-4 w-4" /></Link>
                </div>

                <Detail rows={[
                  ['Need', 'One clear photo of their face, a scene in mind, and a free account so your card is saved as you go.'],
                  ['Get', 'One card with them as the artwork, in the scene you described. You write the inside; we set the type.'],
                  ['Can', 'Any scene in your own words. More than one person. Start again if it isn\'t quite them.'],
                  ['Can\'t', 'Blurry photos (we check the likeness first and tell you straight). Logos, brands or famous faces.'],
                  ['Drawn by', 'Our bigger image model, one card at a time, at full print quality. Slower and dearer to run — that\'s the price difference.'],
                ]} />
              </div>

              {/* ── Door two — tell us about them ── */}
              <div className={doorCls}>
                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">
                    <Sparkles className="h-4 w-4 text-cta" /> Three-card route
                  </span>
                  <span className="rounded-full border border-keeper-hair bg-white px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-keeper-ink">Quickest</span>
                </div>
                <h2 className="mt-3 font-display text-[24px] font-bold leading-tight text-keeper-ink sm:text-[26px]">I'll tell you about them.</h2>
                <p className="mt-1.5 text-[15px] leading-relaxed text-keeper-body">
                  Seven quick questions, three original cards. You pick the one.
                </p>

                <div className="mt-4 grid grid-cols-3 gap-3 border-t border-keeper-hair pt-3.5 sm:mt-5 sm:pt-4">
                  <Fact label="Time">~2 min</Fact>
                  <Fact label="Effort"><Effort level={1} word="Low" /></Fact>
                  <Fact label="Price">{maker}</Fact>
                </div>

                <div className="mt-4 sm:mt-5">
                  <Link href="/create" className={ctaCls}>Tell us about them <ArrowRight className="h-4 w-4" /></Link>
                </div>

                <Detail rows={[
                  ['Need', 'Who it\'s for, the occasion, their age, one thing they love. No photo. No sign-in to see your three.'],
                  ['Get', 'Three different fronts to choose from, then the inside written and designed to match your pick.'],
                  ['Can', 'Roll again with a new vibe. Change the details. Add their photo after you\'ve picked and we\'ll draw them in.'],
                  ['Can\'t', `Direct the scene yourself — your answers steer, we draw. Logos, brands or famous faces. (Ready-made cards off the rack from ${rack}.)`],
                  ['Drawn by', 'Our quicker image model, three at once. A lighter touch than the photo route, and why this one costs less.'],
                ]} />
              </div>
            </div>

            <p className="mt-5 text-[13.5px] text-keeper-meta">
              Both printed on the same 280gsm card, posted anywhere in the UK. Nothing to pay until you print.
            </p>
          </div>

          {/* ── The wall: real cards, drifting (same component as /create) ── */}
          <div className="mt-10 md:mt-14">
            <div className="mx-auto max-w-5xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-keeper-gold">From the rack · every one made from a real brief</p>
            </div>
            <div className="-mx-6 mt-3 pl-6 md:pl-[max(1.5rem,calc((100vw-64rem)/2+1.5rem))]">
              <CardDrift />
            </div>
          </div>

          <div className="mx-auto mt-8 max-w-5xl"><TrustChips /></div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
