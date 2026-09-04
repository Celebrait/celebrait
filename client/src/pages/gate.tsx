// client/src/pages/gate.tsx — THE GATE (/)
//
// Aidan, 2026-09-03: "a super ridic simple doorway that asks the users
// what kind of creator they are — and then points them at either the
// current LP or the door one. Both can have links to the others. But
// they need to be live as my photo route is just too too good."
//
// Aidan, 2026-09-04: "This is all about communicating effort too. I
// don't actually think we need images on this page tbh — keep it super
// simple and descriptive. What they need, what they receive, what they
// can and can't do, the fact that the image models are different,
// speed, effort. Nail it."
//
// So: no pictures. One question, two honest spec sheets, a button on
// each. The landing's chrome so it is unmistakably the same site. Each
// door is a real page that already works: /photo (the photo landing
// page, moved from /) and /create (the three-card doorway). Every fact
// below is true of the live routes — the photo studio renders ONE card
// per go on the bigger model at print quality (minutes); the three-card
// maker renders THREE at once on the quicker model (about a minute).
// The maker's chosen front is NOT re-rendered at high, so we don't say
// it is.

import type { ReactNode } from 'react';
import { Link } from 'wouter';
import { Camera, Sparkles, ArrowRight } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { TrustChips } from '@/pages/landing-keeper';
import { DISPLAY } from '@/pages/doorway';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

const doorCls = 'group flex flex-col rounded-2xl border border-keeper-hair bg-white/70 p-6 shadow-[0_12px_40px_-24px_rgba(33,29,25,0.3)] backdrop-blur-sm transition-colors hover:border-keeper-gold sm:p-7';
const doorCta = 'inline-flex items-center gap-2 rounded-full bg-keeper-ink px-5 py-2.5 text-sm font-semibold text-keeper-paper transition-colors group-hover:bg-black';

/** One row of the spec sheet: a small label, then plain words. */
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-1 border-t border-keeper-hair py-3 first:border-t-0 first:pt-0 sm:grid-cols-[6.5rem_1fr]">
      <dt className="text-[11px] sm:pt-[2px] font-semibold uppercase tracking-[0.12em] text-keeper-meta">{label}</dt>
      <dd className="text-[14.5px] leading-relaxed text-keeper-body">{children}</dd>
    </div>
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
      <main className="pt-32">
        <section className="px-6 pb-16 pt-10 md:pb-20 md:pt-20">
          <div className="mx-auto max-w-6xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">Unbinnable Greetings Cards</p>
            <h1 className={`mt-4 max-w-[20ch] text-[clamp(38px,6vw,66px)] leading-[1.04] text-balance ${DISPLAY}`}>
              Before we create, what kind of card maker are you?
            </h1>
            <p className="mt-5 max-w-[38rem] text-[17px] leading-relaxed text-keeper-body">
              Celebrait offers two unique ways to design a greetings card that's all about them.
              Pick one (you can always switch later once you know what we're about).
            </p>

            <div className="mt-10 grid gap-5 md:grid-cols-2">
              {/* ── Door one — the photo route ── */}
              <Link href="/photo" className={doorCls}>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">
                  <Camera className="h-4 w-4 text-cta" /> The photo route
                </div>
                <h2 className="mt-3 font-display text-[26px] font-bold leading-tight text-keeper-ink">I've got a photo of them.</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-keeper-body">
                  They become the artwork. You direct the scene — Mum under the Northern Lights, your best mate abseiling off Big Ben.
                </p>

                <dl className="mt-6">
                  <Row label="You need">
                    One clear photo where we can see their face. A scene in mind (or borrow one of ours).
                    A free account, so your card is saved while you work on it.
                  </Row>
                  <Row label="You get">
                    One card, drawn from your photo, in the scene you described. The inside is yours to write; we set the type.
                  </Row>
                  <Row label="You can">
                    Describe any scene in your own words. Pick the look. Put more than one person in it. Start again if it isn't quite them.
                  </Row>
                  <Row label="You can't">
                    Use a blurry photo or a photo of a stranger (we check the likeness before we draw and tell you straight).
                    Ask for logos, brands or famous faces.
                  </Row>
                  <Row label="Drawn by">
                    Our bigger image model, one card at a time, at full print quality. It's slower and it costs more to run — that's the price difference.
                  </Row>
                  <Row label="Time">
                    About five minutes of yours, then a few minutes of ours while it draws.
                  </Row>
                  <Row label="Effort">
                    More. You crop the photo, describe the scene and check the likeness. Worth it — this is the one they keep.
                  </Row>
                </dl>

                <div className="mt-6 flex flex-1 flex-wrap items-end justify-between gap-3">
                  <span className="text-[13px] text-keeper-meta">{photo} · nothing to pay until you print</span>
                  <span className={doorCta}>Start with a photo <ArrowRight className="h-3.5 w-3.5" /></span>
                </div>
              </Link>

              {/* ── Door two — tell us about them ── */}
              <Link href="/create" className={doorCls}>
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">
                  <Sparkles className="h-4 w-4 text-cta" /> The three-card route
                </div>
                <h2 className="mt-3 font-display text-[26px] font-bold leading-tight text-keeper-ink">I'll tell you about them.</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-keeper-body">
                  Seven quick questions. Three original cards, written and drawn for them. You pick the one.
                </p>

                <dl className="mt-6">
                  <Row label="You need">
                    Nothing you don't already know: who it's for, the occasion, their age, one thing they love.
                    No photo. No sign-in to see your three.
                  </Row>
                  <Row label="You get">
                    Three different fronts to choose from, then the inside written and designed to match the one you pick.
                  </Row>
                  <Row label="You can">
                    Roll again with a different vibe. Change the details. Add their photo after you've picked and we'll draw them in.
                    Or take a ready-made card off the rack instead.
                  </Row>
                  <Row label="You can't">
                    Direct the scene yourself — your answers steer, we draw. Ask for logos, brands or famous faces.
                  </Row>
                  <Row label="Drawn by">
                    Our quicker image model, three cards at once. A lighter touch than the photo route, and it's why this one costs less.
                  </Row>
                  <Row label="Time">
                    About a minute to answer, about a minute for the three to arrive.
                  </Row>
                  <Row label="Effort">
                    Low. Answer, pick, sign the inside. Done before the kettle's boiled.
                  </Row>
                </dl>

                <div className="mt-6 flex flex-1 flex-wrap items-end justify-between gap-3">
                  <span className="text-[13px] text-keeper-meta">{maker} · off the rack from {rack}</span>
                  <span className={doorCta}>Tell us about them <ArrowRight className="h-3.5 w-3.5" /></span>
                </div>
              </Link>
            </div>

            <p className="mt-6 text-[14px] text-keeper-meta">
              Both are printed on the same 280gsm card, posted in the same envelope, anywhere in the UK.
            </p>
            <div className="mt-6"><TrustChips /></div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
