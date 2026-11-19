// /stories/:slug — one card, told in full: the shot of it closed beside
// the story, the selfie beside what was typed, the shot of it open
// beside the sender's words, then "your photo next". /stories lists
// them; /gallery is every card at a glance.
// Data: client/src/lib/gallery-stories.ts.
import { Link, useLocation, useRoute } from 'wouter';
import { ArrowLeft, ArrowRight, Camera, Check, PenLine, Star } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { Rise } from '@/components/landing/rise';
import { GALLERY_STORIES, storyBySlug, type GalleryStory } from '@/lib/gallery-stories';
import { MakeYoursBand } from '@/pages/stories';
import { DISPLAY, EYEBROW } from '@/pages/doorway';
import { useSeo, setRobotsMeta } from '@/lib/use-seo';
import { useEffect } from 'react';

/** The typed input, as it looks on the maker: caps label over the words. */
function Typed({ label, text, icon: Icon }: { label: string; text: string; icon: typeof Camera }) {
  return (
    <div className="rounded-2xl border border-keeper-hair bg-white px-5 py-4 shadow-[0_10px_24px_-18px_rgba(33,29,25,0.45)]">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-meta">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
        {label}
      </p>
      <p className="mt-1.5 text-[16px] leading-snug text-keeper-ink">{text}</p>
    </div>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-4 w-4 ${i < n ? 'fill-keeper-gold text-keeper-gold' : 'text-keeper-hair'}`} strokeWidth={1.5} aria-hidden="true" />
      ))}
    </div>
  );
}

const SHOT = 'overflow-hidden rounded-3xl border border-keeper-hair shadow-[0_32px_80px_-40px_rgba(33,29,25,0.45)]';

function Story({ s }: { s: GalleryStory }) {
  return (
    <article className="space-y-20 md:space-y-28">
      {/* The card, closed, beside the story. The shots are composed
          square, so they are shown square: no crop takes the flag. */}
      <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-14">
        <Rise>
          <figure className={`relative ${SHOT}`}>
            <img src={s.front.src} alt={s.front.alt} width={1400} height={1400} decoding="async" className="aspect-square w-full object-cover" />
            <figcaption className="absolute left-5 top-5 rounded-full border border-keeper-hair bg-white/90 px-3.5 py-1.5 text-[12.5px] font-semibold text-keeper-ink shadow-sm backdrop-blur">
              {s.chip}
            </figcaption>
          </figure>
        </Rise>
        <Rise delay={0.1}>
          <h1 className={`text-[clamp(30px,4.2vw,42px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>{s.heading}</h1>
          <div className="mt-6 max-w-[58ch] space-y-4 text-[17px] leading-[1.7] text-keeper-body">
            {s.story.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[14px] text-keeper-meta">
            {s.facts.map((f) => (
              <li key={f} className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-keeper-gold" strokeWidth={2} aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        </Rise>
      </div>

      {/* How it was made: the photo beside what was typed. */}
      <div>
        <Rise>
          <p className={EYEBROW}>How it was made</p>
          <h2 className={`mt-3 text-[clamp(26px,3.4vw,34px)] leading-[1.1] ${DISPLAY}`}>A selfie and two sentences.</h2>
        </Rise>
        <div className="mt-10 grid items-center gap-8 md:grid-cols-[0.9fr_1.1fr] md:gap-12">
          <Rise>
            <figure>
              <img
                src={s.photo.src}
                alt={s.photo.alt}
                width={1400}
                height={1280}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full rounded-2xl border border-keeper-hair object-cover shadow-[0_18px_42px_-30px_rgba(33,29,25,0.3)]"
              />
              <figcaption className="mt-3 text-[14px] leading-relaxed text-keeper-meta">{s.photo.caption}</figcaption>
            </figure>
          </Rise>
          <Rise delay={0.1} className="flex flex-col justify-center gap-4">
            <Typed label="The moment" text={s.typed.moment} icon={Camera} />
            <Typed label="Inside" text={s.typed.inside} icon={PenLine} />
            <p className="px-1 text-[14px] leading-relaxed text-keeper-meta">
              Typed the way you&rsquo;d say it. We drew them into it, then set the message inside in the card&rsquo;s own style.
            </p>
          </Rise>
        </div>
      </div>

      {/* The inside, open on the table, beside what Dad said. */}
      <div className="grid items-center gap-10 md:grid-cols-[0.95fr_1.05fr] md:gap-14">
        <Rise className="md:order-2">
          <figure className={SHOT}>
            <img src={s.inside.src} alt={s.inside.alt} width={1400} height={1400} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
          </figure>
        </Rise>
        <Rise delay={0.1} className="md:order-1">
          <p className={EYEBROW}>The inside</p>
          <p className="mt-3 max-w-[40ch] text-[17px] leading-[1.7] text-keeper-body">{s.insideNote}</p>
          <blockquote className="mt-8 rounded-3xl border border-keeper-gold/30 bg-keeper-gold-wash/60 p-7 md:p-8">
            <Stars n={s.review.stars} />
            <p className={`mt-4 text-[22px] leading-[1.35] text-keeper-ink md:text-[24px] ${DISPLAY} font-semibold`}>
              &ldquo;{s.review.quote}&rdquo;
            </p>
            <footer className="mt-5 text-[14px] text-keeper-meta">{s.review.by}</footer>
          </blockquote>
          <p className="mt-3 px-1 text-[12px] leading-relaxed text-keeper-meta">{s.provenance}</p>
        </Rise>
      </div>
    </article>
  );
}

export default function GalleryStoryPage() {
  const [location] = useLocation();
  const [, params] = useRoute('/stories/:slug');
  const s = params?.slug ? storyBySlug(params.slug) : undefined;
  useSeo(location);
  // A slug we don't have is the client's not-found: noindex it.
  useEffect(() => { if (!s) setRobotsMeta('noindex, nofollow'); }, [s]);

  const i = s ? GALLERY_STORIES.indexOf(s) : -1;
  const next = i >= 0 && GALLERY_STORIES.length > 1 ? GALLERY_STORIES[(i + 1) % GALLERY_STORIES.length] : null;

  return (
    <div className="keeper-serif min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-36 md:pt-40">
        <Rise className="mb-10 flex items-center justify-between gap-6 md:mb-14">
          <Link
            href="/stories"
            className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-keeper-meta transition-colors hover:text-keeper-ink"
            data-testid="story-back"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            All stories
          </Link>
          {s && <p className={EYEBROW}>Real stories · {s.chip}</p>}
        </Rise>

        {s ? (
          <Story s={s} />
        ) : (
          <div className="py-16 text-center">
            <h1 className={`text-[28px] ${DISPLAY}`}>We couldn&rsquo;t find that card</h1>
            <Link href="/stories" className="mt-4 inline-block text-[15px] font-semibold text-keeper-gold underline underline-offset-4">
              Back to the stories
            </Link>
          </div>
        )}

        {next && (
          <Rise className="mt-20 flex justify-end md:mt-28">
            <Link href={`/stories/${next.slug}`} className="group inline-flex items-center gap-2 text-[16px] font-semibold text-keeper-ink">
              Next card: {next.chip}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden="true" />
            </Link>
          </Rise>
        )}

        <div className="mt-28 md:mt-36">
          <MakeYoursBand />
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}
