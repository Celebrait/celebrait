// /gallery — every finished card, scannable. A grid of front shots;
// hover (or tap) a card and it flips to its inside. No narrative here:
// that is /stories, linked from the tiles that have one and from the
// top of the page. Data: client/src/lib/gallery-examples.ts.
import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { Rise } from '@/components/landing/rise';
import { GALLERY_EXAMPLES, type GalleryExample } from '@/lib/gallery-examples';
import { MakeYoursBand } from '@/pages/stories';
import { DISPLAY, EYEBROW } from '@/pages/doorway';
import { useSeo } from '@/lib/use-seo';

/** One card. The button flips front ↔ inside on tap (phones have no
 *  hover); hover previews the inside on a pointer. */
function ExampleTile({ e }: { e: GalleryExample }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="group">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-pressed={open}
        aria-label={`${e.title}: ${open ? 'show the front' : 'open the card'}`}
        className="relative block w-full overflow-hidden rounded-3xl border border-keeper-hair bg-white text-left shadow-[0_28px_70px_-40px_rgba(33,29,25,0.45)] outline-none transition-transform duration-500 hover:-translate-y-1 focus-visible:ring-2 focus-visible:ring-keeper-gold/60"
        data-testid={`example-${e.id}`}
      >
        <img src={e.front} alt={e.alt} width={1024} height={1024} loading="lazy" decoding="async" crossOrigin="anonymous" className="aspect-square w-full object-cover" />
        <img
          src={e.inside}
          alt=""
          width={1024}
          height={1024}
          loading="lazy"
          decoding="async"
          crossOrigin="anonymous"
          aria-hidden="true"
          className={`absolute inset-0 aspect-square w-full object-cover transition-opacity duration-700 ease-out motion-reduce:transition-none ${
            open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        />
        <span className="pointer-events-none absolute bottom-4 right-4 rounded-full bg-keeper-ink/70 px-3 py-1 text-[11.5px] font-medium text-white backdrop-blur">
          {open ? 'Inside' : 'Front'}
        </span>
      </button>
      <div className="mt-4 flex items-start justify-between gap-4 px-1">
        <div className="min-w-0">
          <p className="text-[16px] font-semibold text-keeper-ink">{e.title}</p>
          <p className="mt-0.5 text-[14px] text-keeper-meta">{e.scene}</p>
        </div>
        {e.storySlug && (
          <Link
            href={`/stories/${e.storySlug}`}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[13.5px] font-semibold text-keeper-gold"
            data-testid={`example-story-${e.id}`}
          >
            The story
            <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function GalleryPage() {
  const [location] = useLocation();
  useSeo(location);

  return (
    <div className="keeper-serif min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-36 md:pt-40">
        <Rise className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
          <div className="max-w-3xl">
            <p className={EYEBROW}>The gallery</p>
            <h1 className={`mt-3 text-[clamp(34px,5vw,56px)] leading-[1.04] [text-wrap:balance] ${DISPLAY}`}>
              Every one from a photo.
            </h1>
            <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.7] text-keeper-body">
              Real cards, fronts and insides. Tap a card to open it.
            </p>
          </div>
          <Link
            href="/stories"
            className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-keeper-ink underline decoration-keeper-hair underline-offset-4 transition-colors hover:decoration-keeper-gold"
            data-testid="gallery-to-stories"
          >
            Read the stories behind them
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </Link>
        </Rise>

        <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 md:mt-16 lg:grid-cols-3">
          {GALLERY_EXAMPLES.map((e, i) => (
            <Rise key={e.id} delay={(i % 3) * 0.07}>
              <ExampleTile e={e} />
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
