// client/src/pages/about.tsx
//
// About / manifesto page. Same Keeper chrome as the marketing site
// (celebration backdrop + KeeperHeader + footer), open sections over the
// warm paper rather than a boxed card — it's a story, not a form. Voice
// pulled straight from the landing: unbinnable, "the magic's digital, the
// card isn't", gloriously daft, honest money, made to be kept.

import { Link, useLocation } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';

const DISPLAY = 'font-display font-bold tracking-[-0.015em] text-keeper-ink';

// Auth-aware CTA styled for a light page.
function MakeCardCta() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const authed = !isLoading && isAuthenticated;
  const cls =
    'group inline-flex items-center gap-2 rounded-full bg-keeper-ink px-8 py-4 text-base font-semibold text-keeper-paper transition-all hover:-translate-y-0.5 hover:bg-black';
  const inner = (
    <>
      Make a card — it&rsquo;s free
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </>
  );
  return authed ? (
    <Link href="/studio/new-card" className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={() => openAuth('/studio/new-card')} className={cls}>
      {inner}
    </button>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-keeper-gold">
      {children}
    </p>
  );
}

export default function AboutPage() {
  const [location] = useLocation();
  const jumpHome = (id: string) => {
    if (location === '/' || location === '/keeper') {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.location.assign(`/#${id}`);
    }
  };

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop
        background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)"
        permanentFade
      />
      <KeeperHeader />

      <main className="relative pt-36">
        <div className="mx-auto max-w-2xl px-6">
          {/* ── Hero ── */}
          <section className="pb-16 md:pb-24">
            <Eyebrow>The whole idea</Eyebrow>
            <h1 className={`mt-4 text-[clamp(38px,6.5vw,64px)] leading-[1.05] ${DISPLAY}`}>
              We make the one they don&rsquo;t bin.
            </h1>
            <p className="mt-6 text-[18px] leading-[1.6] text-keeper-body">
              Everyone gets cards. Almost nobody keeps them — a glance, a week
              on the windowsill, then the recycling. Celebrait exists to make
              the other kind. The one that ends up in a drawer, a frame, a
              memory box. <span className="font-medium text-keeper-ink">Kept.</span>
            </p>
          </section>

          {/* ── The problem ── */}
          <section className="border-t border-keeper-hair py-14 md:py-20">
            <h2 className={`text-[clamp(28px,4.4vw,40px)] leading-[1.08] ${DISPLAY}`}>
              Cards got lazy.
            </h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-keeper-body">
              A rack of near-identical jokes and stock roses. A few quid for
              something forgotten by teatime — while the moment it was meant to
              mark (the 60th, the new baby, the &ldquo;you actually did
              it&rdquo;) deserved so much more. A card should be as specific as
              the person it&rsquo;s for. So we built one that is.
            </p>
          </section>

          {/* ── What we do ── */}
          <section className="border-t border-keeper-hair py-14 md:py-20">
            <h2 className={`text-[clamp(28px,4.4vw,40px)] leading-[1.08] ${DISPLAY}`}>
              The magic&rsquo;s digital. The card isn&rsquo;t.
            </h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-keeper-body">
              Pick a photo of someone you love. Describe a scene — Mum under the
              Northern Lights, your best mate abseiling off Big Ben, your
              daughter going viral in Times Square. We illustrate it: a front
              and an inside that belong together.
            </p>
            <p className="mt-4 text-[17px] leading-[1.65] text-keeper-body">
              Then it becomes a real thing — pressed onto 280gsm gloss, sealed
              in a kraft envelope, printed in the UK and posted. Straight to
              them, or to you to hand over yourself. Your message set
              beautifully inside, or left blank for your own pen.
            </p>
            <p className="mt-4 text-[17px] leading-[1.65] text-keeper-body">
              Idea to in-the-post in about five minutes.* From £8.99 — and you
              only pay when you post one.
            </p>
            <p className="mt-1.5 text-[12px] leading-snug text-keeper-meta">
              *Possible, but you might prefer to take longer.
            </p>
          </section>

          {/* ── Values ── */}
          <section className="border-t border-keeper-hair py-14 md:py-20">
            <h2 className={`text-[clamp(28px,4.4vw,40px)] leading-[1.08] ${DISPLAY}`}>
              What we actually stand for.
            </h2>
            <ul className="mt-6 space-y-4">
              {[
                ['Personal beats generic.', 'Every single time.'],
                ['Funny is allowed.', 'Gloriously daft is positively encouraged.'],
                ['Real paper, real post, real feeling.', 'The internet has never hugged anyone.'],
                ['Honest money.', 'Free to make, free to change your mind — you only pay when it’s posted.'],
                ['We’ll nudge you before the next birthday.', 'Because you’ll forget. It’s fine.'],
              ].map(([bold, rest], i) => (
                <li key={i} className="flex gap-3 text-[17px] leading-[1.5] text-keeper-body">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-keeper-gold" aria-hidden />
                  <span>
                    <span className="font-semibold text-keeper-ink">{bold}</span> {rest}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* ── The new player ── */}
          <section className="border-t border-keeper-hair py-14 md:py-20">
            <h2 className={`text-[clamp(28px,4.4vw,40px)] leading-[1.08] ${DISPLAY}`}>
              We&rsquo;re the new name on the shelf.
            </h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-keeper-body">
              No hundred-year heritage, no warehouse of clip art. We&rsquo;re
              new, we&rsquo;re small, and we&rsquo;re quietly obsessed with one
              thing: making the card someone keeps. Classy, funny, a little
              emotional, occasionally daft.{' '}
              <span className="font-medium text-keeper-ink">
                Get that right and we&rsquo;ve done our job.
              </span>
            </p>
          </section>

          {/* ── Closing CTA ── */}
          <section className="border-t border-keeper-hair py-16 text-center md:py-24">
            <h2 className={`mx-auto max-w-[16ch] text-[clamp(30px,5vw,48px)] leading-[1.05] ${DISPLAY}`}>
              Put someone you love in the picture.
            </h2>
            <div className="mt-8 flex flex-col items-center gap-3">
              <MakeCardCta />
              <button
                type="button"
                onClick={() => jumpHome('price')}
                className="text-[13px] text-keeper-meta underline underline-offset-4 hover:text-keeper-ink"
              >
                Free to make · £8.99 to print &amp; post
              </button>
            </div>
          </section>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
