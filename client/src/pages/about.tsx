// client/src/pages/about.tsx
//
// About / manifesto page. Same Keeper chrome as the marketing site
// (celebration backdrop + KeeperHeader + footer), open sections over the
// warm paper rather than a boxed card — it's a story, not a form.
//
// Voice: bold & funny (Kevin's pick 2026-07-22) — cheeky about naff shop
// cards, swagger, but real heart underneath. Facts true to the product:
// 280gsm gloss, kraft envelope, UK-printed, front+inside, blank-to-
// handwrite, ~5 min, £8.99, pay only when you post.

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
            <Eyebrow>The whole point</Eyebrow>
            <h1 className={`mt-4 text-[clamp(40px,7vw,68px)] leading-[1.02] ${DISPLAY}`}>
              Most cards are bin-fodder. We said no.
            </h1>
            <p className="mt-6 text-[18px] leading-[1.6] text-keeper-body">
              £4.50 for a stock wine glass and a pun about turning 40. Read
              once, propped by the kettle, recycled by Tuesday. The people you
              love deserve better than the Tuesday bin — so we made the card
              they <span className="font-medium text-keeper-ink">actually keep</span>.
            </p>
          </section>

          {/* ── The enemy ── */}
          <section className="border-t border-keeper-hair py-14 md:py-20">
            <h2 className={`text-[clamp(28px,4.4vw,40px)] leading-[1.08] ${DISPLAY}`}>
              Greetings cards got lazy.
            </h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-keeper-body">
              A whole aisle of near-identical jokes and stock roses, each one
              forgotten by teatime — while the moment it was meant to mark (the
              big 60th, the new baby, the &ldquo;you actually passed&rdquo;)
              deserved a standing ovation. Somewhere along the line,
              &ldquo;thinking of you&rdquo; started meaning &ldquo;grabbed
              whatever was by the till.&rdquo; We&rsquo;re not into that.
            </p>
          </section>

          {/* ── The good bit (product) ── */}
          <section className="border-t border-keeper-hair py-14 md:py-20">
            <h2 className={`text-[clamp(28px,4.4vw,40px)] leading-[1.08] ${DISPLAY}`}>
              So here&rsquo;s the good bit.
            </h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-keeper-body">
              Bring a photo of someone you love and a daft idea. We illustrate
              it — a front and an inside that actually belong together. Your mum
              gazing at the Northern Lights. Your best mate abseiling off Big
              Ben (no, we don&rsquo;t know why either). Your dad, finally, on
              the moon.
            </p>
            <p className="mt-4 text-[17px] leading-[1.65] text-keeper-body">
              Then it becomes a proper object: pressed onto 280gsm gloss, tucked
              in a kraft envelope, printed here in the UK and posted — straight
              to them, or to you to hand over yourself. Your words set
              beautifully inside, or left blank for your own questionable
              handwriting.
            </p>
            <p className="mt-4 text-[17px] leading-[1.65] text-keeper-body">
              Five minutes from idea to in-the-post.* £8.99, and nothing to pay
              until you actually send one.
            </p>
            <p className="mt-1.5 text-[12px] leading-snug text-keeper-meta">
              *Or take all night over it. It&rsquo;s your card.
            </p>
          </section>

          {/* ── The new player ── */}
          <section className="border-t border-keeper-hair py-14 md:py-20">
            <h2 className={`text-[clamp(28px,4.4vw,40px)] leading-[1.08] ${DISPLAY}`}>
              We&rsquo;re the new lot.
            </h2>
            <p className="mt-5 text-[17px] leading-[1.65] text-keeper-body">
              No hundred-year heritage. No warehouse of clip art. No aisle in
              the supermarket. Just a small British team, mildly obsessed with
              one thing: making the card someone physically cannot bring
              themselves to bin. Classy, a bit funny, occasionally emotional,
              frequently daft.{' '}
              <span className="font-medium text-keeper-ink">
                Land on a mantelpiece instead of in a bag for life, and
                we&rsquo;ve done our job.
              </span>
            </p>
          </section>

          {/* ── Closing CTA ── */}
          <section className="border-t border-keeper-hair py-16 text-center md:py-24">
            <h2 className={`mx-auto max-w-[18ch] text-[clamp(30px,5vw,48px)] leading-[1.05] ${DISPLAY}`}>
              Go on. Make their day — and their mantelpiece.
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
