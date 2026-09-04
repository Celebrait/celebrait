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
// only — the two doors answer it in the sans as PERSONAS (Aidan
// 2026-09-04: "different answers to the headline": The casual browser
// first, The director second).
//
// Every fact is true of the live routes — the photo studio renders ONE
// card per go on the bigger model at print quality (minutes); the
// three-card maker renders THREE at once on the quicker model (about a
// minute). The maker's chosen front is NOT re-rendered at high, so we
// don't say it is.

import { type MouseEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Camera, Sparkles, ArrowRight, ChevronDown, Check, Clock, Wrench } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { DISPLAY, HERO_MAIN, HERO_TOP, EYEBROW, SUB } from '@/pages/doorway';
import { useAuth } from '@/hooks/use-auth';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

interface DoorProps {
  href: string;
  icon: typeof Camera;
  chip: { label: string; tone: 'brand' | 'ready' };
  title: string;
  line: string;
  time: string;
  effort: string;
  price: string;
  /** The three points that decide it — visible, never folded. */
  points: string[];
  cta: string;
  /** The small print: what it can't do, and what draws it. Folded. */
  fine: Array<[string, string]>;
  /** The landing page behind this route — one quiet link for anyone
   *  who wants to look before they start. The door itself goes
   *  straight into the builder (Aidan 2026-09-04). */
  proof: { href: string; label: string };
  /** The lead door wears the studio's "selected" tint — violet wash +
   *  violet border. The other sits on white with a hairline. */
  lead?: boolean;
}

/** A studio choice tile. The whole tile is the door (click anywhere);
 *  the fold inside stops the click so it can open without leaving. */
function Door({ href, icon: Icon, chip, title, line, time, effort, price, points, cta, fine, proof, lead = false }: DoorProps) {
  const [, navigate] = useLocation();
  const go = () => navigate(href);
  const stop = (e: MouseEvent) => e.stopPropagation();
  const tile = lead
    ? 'border-brand bg-brand-muted shadow-[0_18px_50px_-28px_rgba(92,87,212,0.45)] hover:border-brand-dark'
    : 'border-keeper-hair bg-white shadow-[0_12px_40px_-28px_rgba(33,29,25,0.35)] hover:border-brand';
  const pill = lead ? 'bg-white/80 border-brand-light' : 'bg-keeper-paper border-keeper-hair';
  const chipCls = chip.tone === 'brand' ? 'bg-brand text-white' : 'bg-cta-light text-cta-dark';
  return (
    <div
      onClick={go}
      className={`group flex cursor-pointer flex-col rounded-xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 sm:p-6 ${tile}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl sm:h-11 sm:w-11 ${lead ? 'bg-brand text-white' : 'bg-brand-muted text-keeper-gold'}`}>
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] ${chipCls}`}>{chip.label}</span>
      </div>

      <h2 className="mt-3 font-display text-[23px] font-bold leading-[1.1] tracking-[-0.01em] text-keeper-ink sm:mt-4 sm:text-[27px]">
        <Link href={href} onClick={stop} className="outline-none focus-visible:underline">{title}</Link>
      </h2>
      <p className="mt-1 text-[14px] leading-snug text-keeper-body sm:text-[15px]">{line}</p>

      {/* Time · effort · price as three small pills — scannable, no
          display type, the price carries the weight. */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium text-keeper-body ${pill}`}><Clock className="h-3 w-3 text-keeper-meta" /> {time}</span>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium text-keeper-body ${pill}`}><Wrench className="h-3 w-3 text-keeper-meta" /> {effort}</span>
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold text-keeper-ink ${pill}`}>{price}</span>
      </div>

      {/* The three decision points, green checks (the studio's readiness
          accent). flex-1 keeps buttons level across the pair. */}
      <ul className="mt-3.5 flex-1 space-y-1.5 sm:space-y-2">
        {points.map((pt) => (
          <li key={pt} className="flex items-start gap-2 text-[13.5px] leading-snug text-keeper-body sm:text-[14px]">
            <span className="mt-[2px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cta-light text-cta-dark"><Check className="h-2.5 w-2.5" strokeWidth={3} /></span>
            <span>{pt}</span>
          </li>
        ))}
      </ul>

      <Link
        href={href}
        onClick={stop}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-go px-6 py-2.5 text-[15px] sm:mt-5 sm:py-3 font-semibold text-go-foreground transition-colors hover:bg-go-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-keeper-gold"
      >
        {cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
      <Link href={proof.href} onClick={stop} className="mt-2.5 inline-block text-[12.5px] font-medium text-keeper-meta underline decoration-keeper-hair underline-offset-4 transition-colors hover:text-keeper-ink hover:decoration-keeper-gold">
        {proof.label} →
      </Link>

      {/* The small print, folded: a quiet text link, and a soft panel of
          plain sentences when it opens — no caps labels, no box. */}
      <details onClick={stop} className="group/d mt-3">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[12.5px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink [&::-webkit-details-marker]:hidden">
          The small print
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open/d:rotate-180" />
        </summary>
        <div className={`mt-2 space-y-2 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed text-keeper-body ${lead ? 'bg-white/70' : 'bg-keeper-paper'}`}>
          {fine.map(([k, v]) => (
            <p key={k}><span className="font-semibold text-keeper-ink">{k}</span> {v}</p>
          ))}
        </div>
      </details>
    </div>
  );
}

export default function GatePage() {
  useSeo('/');
  // The photo door goes straight into the maker: the public one when
  // signed out, the studio's when signed in.
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const photoHref = !authLoading && isAuthenticated ? '/studio/new-card' : '/photo/make';
  const photo = gbp(cardPriceGBP('photo'));
  const maker = gbp(cardPriceGBP('maker'));
  const rack = gbp(cardPriceGBP('rack'));

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className={HERO_MAIN}>
        <section className={`px-6 pb-16 md:pb-24 ${HERO_TOP}`}>
          <div className="mx-auto max-w-4xl text-left">
            <p className={EYEBROW}>Unbinnable Greetings Cards</p>
            <h1 className={`mt-4 max-w-[18ch] text-[clamp(28px,5vw,58px)] leading-[1.06] text-balance ${DISPLAY}`}>
              Before we create, what kind of card buyer are you?
            </h1>
            <p className={`max-w-[40rem] ${SUB}`}>
              Celebrait offers two ways to design a greetings card that's unique to them.
              Pick one<span className="hidden sm:inline"> (you can always switch later once you know what we're about)</span>.
            </p>
          </div>

          <div id="doors" className="mx-auto mt-8 grid max-w-4xl scroll-mt-32 gap-4 sm:gap-5 md:mt-10 md:grid-cols-[1fr_1.3fr] md:items-stretch">
            <Door
              href="/make"
              icon={Sparkles}
              chip={{ label: 'Quickest', tone: 'ready' }}
              title="The casual browser"
              line="I know them well. I just don't want to spend an hour on it."
              time="2 minutes"
              effort="easy"
              price={maker}
              points={[
                'Tell us who they are and what they love.',
                'We draw three cards. You pick the one.',
                'Not quite right? Roll again, free.',
              ]}
              cta="Tell us about them"
              proof={{ href: '/create', label: 'See how it works' }}
              fine={[
                ['You can', 'roll again with a new vibe, change the details, or add their photo once you\'ve picked and we\'ll draw them in.'],
                ['You can\'t', 'direct the scene yourself — your answers steer, we draw. No logos, brands or famous faces.'],
                ['Drawn by', 'our quicker image model, three at once. That\'s why it costs less.'],
                ['No account', `needed to see your three. Ready-made cards from ${rack} too.`],
              ]}
            />
            <Door
              lead
              href={photoHref}
              icon={Camera}
              chip={{ label: 'Pro choice', tone: 'brand' }}
              title="The director"
              line="I've got a photo of them, and I know exactly where I want to put them."
              time="10 minutes"
              effort="worth it"
              price={photo}
              points={[
                'Bring one clear photo of their face.',
                'Describe the scene. We draw them into it.',
                'One card, made properly, print quality.',
              ]}
              cta="Start with a photo"
              proof={{ href: '/photo#proof', label: 'See the proof first' }}
              fine={[
                ['You can', 'describe any scene in your own words, put more than one person in, and start again if it isn\'t quite them. You write the inside; we set the type.'],
                ['You can\'t', 'use a blurry photo (we check the likeness first and tell you straight), or ask for logos, brands or famous faces.'],
                ['Drawn by', 'our bigger image model, one card at a time, at full print quality. Slower and dearer to run — that\'s the price difference.'],
                ['No account', 'to start. You\'ll make one, free, when you press Generate.'],
              ]}
            />
          </div>

        </section>
      </main>
      <MarketingFooter cta="gate" />
    </div>
  );
}
