// client/src/pages/gate.tsx — THE GATE (/)
//
// Aidan, 2026-09-03: "a super ridic simple doorway that asks the users
// what kind of creator they are — and then points them at either the
// current LP or the door one. Both can have links to the others."
//
// Aidan, 2026-09-04: no images; communicate EFFORT (need / get / can /
// can't / the image models differ / speed). Then "so heavy with text —
// summarise, visual hierarchy, pro-choice label, second option visible
// on mobile". Then the audit: "lean on the studio look and feel".
//
// So this is a FORK, not a landing page: a centred question and two
// STUDIO choice tiles (rounded-xl, border-2, violet on hover — the
// studio's picker pattern) with the studio's icon well and its violet
// `go` primary — the only two violet buttons on the page. One label
// per tile, one quiet meta line for the facts, the detail folded. The
// header and footer on this page point at the doors instead of
// answering the question for them. Fraunces on the h1 and the two
// titles only.
//
// Every fact is true of the live routes — the photo studio renders ONE
// card per go on the bigger model at print quality (minutes); the
// three-card maker renders THREE at once on the quicker model (about a
// minute). The maker's chosen front is NOT re-rendered at high, so we
// don't say it is.

import { type MouseEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Camera, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { CardDrift } from '@/components/catalogue/card-drift';
import { DISPLAY } from '@/pages/doorway';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

interface DoorProps {
  href: string;
  icon: typeof Camera;
  chip?: string;
  title: string;
  line: string;
  time: string;
  effort: string;
  price: string;
  cta: string;
  rows: Array<[string, string]>;
}

/** A studio choice tile. The whole tile is the door (click anywhere);
 *  the fold inside stops the click so it can open without leaving. */
function Door({ href, icon: Icon, chip, title, line, time, effort, price, cta, rows }: DoorProps) {
  const [, navigate] = useLocation();
  const go = () => navigate(href);
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <div
      onClick={go}
      className="group flex cursor-pointer flex-col rounded-xl border-2 border-keeper-hair bg-white p-4 text-left shadow-[0_12px_40px_-28px_rgba(33,29,25,0.35)] transition-all hover:-translate-y-0.5 hover:border-brand hover:shadow-[0_18px_50px_-28px_rgba(92,87,212,0.45)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-muted text-keeper-gold">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        {chip ? (
          <span className="rounded-full bg-keeper-gold-wash px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-keeper-gold">{chip}</span>
        ) : null}
      </div>

      <h2 className="mt-3 font-display text-[23px] font-bold leading-tight text-keeper-ink sm:mt-4 sm:text-[26px]">
        <Link href={href} onClick={stop} className="outline-none focus-visible:underline">{title}</Link>
      </h2>
      {/* flex-1 so a wrapping tagline pushes nothing: both tiles' meta
          lines, buttons and folds sit level across the pair. */}
      <p className="mt-1 flex-1 text-[14.5px] leading-snug text-keeper-body sm:text-[15px]">{line}</p>

      <p className="mt-2.5 text-[13px] text-keeper-meta">
        {time} <span className="mx-1 text-keeper-hair">·</span> {effort} <span className="mx-1 text-keeper-hair">·</span>{' '}
        <span className="font-semibold text-keeper-ink">{price}</span>
      </p>

      <Link
        href={href}
        onClick={stop}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-go px-6 py-3 text-[15px] font-semibold text-go-foreground transition-colors hover:bg-go-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-keeper-gold"
      >
        {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>

      <details onClick={stop} className="group/d mt-4 border-t border-keeper-hair pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-[13px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink [&::-webkit-details-marker]:hidden">
          What you need, what you get
          <ChevronDown className="h-4 w-4 transition-transform group-open/d:rotate-180" />
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
      <main className="pt-[116px] md:pt-32">
        <section className="px-5 pb-14 pt-3 sm:px-6 md:pb-20 md:pt-14">
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">Unbinnable Greetings Cards</p>
            <h1 className={`mx-auto mt-2.5 max-w-[18ch] text-[clamp(30px,5vw,56px)] leading-[1.06] text-balance ${DISPLAY}`}>
              Before we create, what kind of card maker are you?
            </h1>
            <p className="mx-auto mt-2.5 max-w-[40rem] text-[15px] leading-relaxed text-keeper-body md:mt-4 md:text-[17px]">
              Celebrait offers two unique ways to design a greetings card that's all about them.
              Pick one<span className="hidden sm:inline"> (you can always switch later once you know what we're about)</span>.
            </p>
          </div>

          <div id="doors" className="mx-auto mt-6 grid max-w-4xl scroll-mt-32 gap-3 sm:gap-5 md:mt-10 md:grid-cols-2">
            <Door
              href="/photo"
              icon={Camera}
              chip="Pro choice"
              title="I've got a photo of them."
              line="They become the artwork, in a scene you direct."
              time="~10 min"
              effort="more effort"
              price={photo}
              cta="Start with a photo"
              rows={[
                ['Need', 'One clear photo of their face, a scene in mind, and a free account so your card is saved as you go.'],
                ['Get', 'One card with them as the artwork, in the scene you described. You write the inside; we set the type.'],
                ['Can', 'Any scene in your own words. More than one person. Start again if it isn\'t quite them.'],
                ['Can\'t', 'Blurry photos (we check the likeness first and tell you straight). Logos, brands or famous faces.'],
                ['Drawn by', 'Our bigger image model, one card at a time, at full print quality. Slower and dearer to run — that\'s the price difference.'],
              ]}
            />
            <Door
              href="/create"
              icon={Sparkles}
              chip="Quickest"
              title="I'll tell you about them."
              line="Seven quick questions, three original cards. You pick the one."
              time="~2 min"
              effort="low effort"
              price={maker}
              cta="Tell us about them"
              rows={[
                ['Need', 'Who it\'s for, the occasion, their age, one thing they love. No photo. No sign-in to see your three.'],
                ['Get', 'Three different fronts to choose from, then the inside written and designed to match your pick.'],
                ['Can', 'Roll again with a new vibe. Change the details. Add their photo after you\'ve picked and we\'ll draw them in.'],
                ['Can\'t', `Direct the scene yourself — your answers steer, we draw. Logos, brands or famous faces. (Ready-made cards off the rack from ${rack}.)`],
                ['Drawn by', 'Our quicker image model, three at once. A lighter touch than the photo route, and why this one costs less.'],
              ]}
            />
          </div>

          {/* ── The wall: real cards, drifting (same component as /create) ── */}
          <div className="mt-12 md:mt-16">
            <p className="mx-auto max-w-4xl text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-keeper-gold">
              From the rack · every one made for a real person · 280gsm, posted UK-wide
            </p>
            <div className="-mx-5 mt-3 pl-5 sm:-mx-6 sm:pl-6 md:pl-[max(1.5rem,calc((100vw-56rem)/2))]">
              <CardDrift />
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter cta="gate" />
    </div>
  );
}
