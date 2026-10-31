// /stories — Real stories. Every card with a story, each a tile that
// links to it (/stories/:slug). Every story is a full row, the shot
// alternating sides; stories are few and each deserves the width. The scannable wall of all cards is /gallery. Same marketing
// chrome as /blog: backdrop + KeeperHeader + footer.
// Data: client/src/lib/gallery-stories.ts.
import { Link, useLocation } from 'wouter';
import { Truck } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { Rise } from '@/components/landing/rise';
import { StoryTile } from '@/components/landing/story-tile';
import { GALLERY_STORIES } from '@/lib/gallery-stories';
import { DISPLAY, EYEBROW } from '@/pages/doorway';
import { useSeo } from '@/lib/use-seo';

export function MakeYoursBand() {
  return (
    <Rise className="rounded-3xl border border-keeper-hair bg-white/70 px-7 py-10 text-center md:px-12 md:py-14">
      <h2 className={`text-[clamp(28px,3.8vw,40px)] leading-[1.08] ${DISPLAY}`}>Your photo next.</h2>
      <p className="mx-auto mt-3 max-w-[46ch] text-[16px] leading-[1.65] text-keeper-body">
        Any clear photo of them. Tell us where to put them. We check the likeness before anything is drawn.
      </p>
      <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/photo/make"
          className="inline-flex h-12 items-center justify-center rounded-full bg-keeper-gold px-7 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-keeper-gold-deep"
          data-testid="gallery-cta-make"
        >
          Make yours from a photo
        </Link>
        <Link
          href="/photo#how-it-works"
          className="inline-flex h-12 items-center justify-center rounded-full border border-keeper-hair bg-white px-7 text-[15px] font-semibold text-keeper-ink transition-colors hover:bg-keeper-paper"
        >
          See how it works
        </Link>
      </div>
      <p className="mt-5 flex items-center justify-center gap-2 text-[13px] text-keeper-meta">
        <Truck className="h-4 w-4 text-keeper-gold" strokeWidth={1.75} aria-hidden="true" />
        Printed once, just for them, and posted. Allow a week.
      </p>
    </Rise>
  );
}

export default function StoriesPage() {
  const [location] = useLocation();
  useSeo(location);

  return (
    <div className="keeper-serif min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-36 md:pt-40">
        <Rise className="max-w-3xl">
          <p className={EYEBROW}>Real stories</p>
          <h1 className={`mt-3 text-[clamp(34px,5vw,56px)] leading-[1.04] [text-wrap:balance] ${DISPLAY}`}>
            One photo. The whole story.
          </h1>
          <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.7] text-keeper-body">
            Real cards, start to finish: the selfie each one began as, the words that were typed, and what
            happened when it arrived. For every card at a glance, see the{' '}
            <Link href="/gallery" className="font-semibold text-keeper-ink underline decoration-keeper-hair underline-offset-4 hover:decoration-keeper-gold">gallery</Link>.
          </p>
        </Rise>

        <div className="mt-14 space-y-20 md:mt-20 md:space-y-28">
          {GALLERY_STORIES.map((s, i) => (
            <Rise key={s.slug} delay={0.08}>
              <StoryTile s={s} featured reverse={i % 2 === 1} />
            </Rise>
          ))}
        </div>

        <div className="mt-28 md:mt-36">
          <MakeYoursBand />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
