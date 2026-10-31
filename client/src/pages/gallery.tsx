// /gallery — real cards, told as stories.
//
// One card per story: the photo it started from, what the sender typed,
// the printed card closed and open, and the sender's words. The first
// (Aidan 2026-10-31): a dad making his son's 8th-birthday card as the
// reveal for England tickets at Wembley. Same marketing chrome as
// /blog: backdrop + KeeperHeader + footer.
//
// Add a story = add an entry to STORIES and three shots to
// client/public/gallery-img/ (not gallery/: a public dir named after the route makes express.static 301 /gallery → /gallery/). `provenance` is the small-print line under
// the review: a card the team made to show the route says so; a real
// customer's card carries their permission line instead. Fake reviews
// presented as genuine are banned (DMCC Act 2024), so keep this honest.
import { Link, useLocation } from 'wouter';
import { Camera, Check, PenLine, Star, Truck } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { Rise } from '@/components/landing/rise';
import { DISPLAY, EYEBROW } from '@/pages/doorway';
import { useSeo } from '@/lib/use-seo';

interface Story {
  slug: string;
  /** Who it is for, shown on the card's chip: "Adam's 8th · from Dad". */
  chip: string;
  heading: string;
  /** The story, in the sender's voice. Short paragraphs. */
  story: string[];
  photo: { src: string; alt: string; caption: string };
  /** What the sender typed on the photo route: the moment, the inside. */
  typed: { moment: string; inside: string };
  front: { src: string; alt: string };
  inside: { src: string; alt: string };
  review: { quote: string; by: string; stars: number };
  facts: string[];
  provenance: string;
}

const STORIES: Story[] = [
  {
    slug: 'wembley',
    chip: "Adam's 8th · from Dad",
    heading: 'The tickets were the present. The card was the reveal.',
    story: [
      "Mark and Jo had England tickets for Adam's eighth birthday and one problem: how do you hand an eight-year-old two tickets and make it land? An envelope with a printout wasn't going to do it.",
      "So the card did the telling. Mark took a selfie of the two of them from a cold Tuesday night at their local ground, typed where he wanted them to be instead, and the card put them outside Wembley on match day, scarves on, arch behind them, flag in hand.",
      'Adam opened it at breakfast on his birthday. He read the front, opened it, read the inside twice, and then the house heard about it.',
    ],
    photo: {
      src: '/gallery-img/wembley-source.webp',
      alt: 'A selfie of Mark and Adam in the stands at a floodlit football ground',
      caption: 'One phone selfie from a Tuesday night at the football. That was the whole upload.',
    },
    typed: {
      moment:
        "Me and Adam outside Wembley on England match day, scarves and face paint, the arch behind us, holding a flag that says We're going to Wembley!",
      inside:
        "Dear Adam, Happy 8th birthday mate, we're off to Wembley to watch England! Love you so much, Mum & Dad x",
    },
    front: {
      src: '/gallery-img/wembley-front.webp',
      alt: "The printed card standing on a kitchen table: Mark and Adam outside Wembley in England scarves, holding a flag that reads We're going to Wembley!",
    },
    inside: {
      src: '/gallery-img/wembley-inside.webp',
      alt: "The card open: Wembley Way at sunset with the message Dear Adam, Happy 8th birthday mate, we're off to Wembley to watch England! Love you so much, Mum & Dad x",
    },
    review: {
      quote:
        "He read it twice, looked at me, then screamed. It's him. It's actually him, in the shirt, outside Wembley. We'd have paid double. It's on the fridge until we go.",
      by: 'Mark, Adam’s dad',
      stars: 5,
    },
    facts: ['Made from one selfie', 'Typed in about ten minutes', 'Printed once, posted Royal Mail 24'],
    provenance:
      'Made by the Celebrait team with our own photo, to show the route from selfie to doormat. The names are ours too.',
  },
];

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
        <Star
          key={i}
          className={`h-4 w-4 ${i < n ? 'fill-keeper-gold text-keeper-gold' : 'text-keeper-hair'}`}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function StoryBlock({ s }: { s: Story }) {
  const shot = 'overflow-hidden rounded-3xl border border-keeper-hair shadow-[0_32px_80px_-40px_rgba(33,29,25,0.45)]';
  return (
    <article id={s.slug} className="scroll-mt-32 space-y-20 md:space-y-28">
      {/* The card, closed, as it stood on the table, beside the story.
          The shots are composed square, so they are shown square: no
          crop ever takes the top of the card or the flag. */}
      <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-14">
        <Rise>
          <figure className={`relative ${shot}`}>
            <img src={s.front.src} alt={s.front.alt} width={1400} height={1400} decoding="async" className="aspect-square w-full object-cover" />
            <figcaption className="absolute left-5 top-5 rounded-full border border-keeper-hair bg-white/90 px-3.5 py-1.5 text-[12.5px] font-semibold text-keeper-ink shadow-sm backdrop-blur">
              {s.chip}
            </figcaption>
          </figure>
        </Rise>
        <Rise delay={0.1}>
          <h2 className={`text-[clamp(30px,4.2vw,42px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>{s.heading}</h2>
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
          <h3 className={`mt-3 text-[clamp(26px,3.4vw,34px)] leading-[1.1] ${DISPLAY}`}>A selfie and two sentences.</h3>
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
          <figure className={shot}>
            <img src={s.inside.src} alt={s.inside.alt} width={1400} height={1400} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
          </figure>
        </Rise>
        <Rise delay={0.1} className="md:order-1">
          <p className={EYEBROW}>The inside</p>
          <p className="mt-3 max-w-[40ch] text-[17px] leading-[1.7] text-keeper-body">
            Same light, same Wembley. The message is set in the card&rsquo;s own hand, so the inside belongs with the front.
          </p>
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

export default function GalleryPage() {
  const [location] = useLocation();
  useSeo(location);

  return (
    <div className="keeper-serif min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-32 md:pt-40">
        <Rise className="max-w-3xl">
          <p className={EYEBROW}>The gallery</p>
          <h1 className={`mt-3 text-[clamp(34px,5vw,56px)] leading-[1.04] [text-wrap:balance] ${DISPLAY}`}>
            Made from one photo.
          </h1>
          <p className="mt-4 max-w-[52ch] text-[17px] leading-[1.7] text-keeper-body">
            Real cards, start to finish: the selfie they began as, the words that were typed, and the card that
            landed on the doormat.
          </p>
        </Rise>

        <div className="mt-14 space-y-32 md:mt-20">
          {STORIES.map((s) => (
            <StoryBlock key={s.slug} s={s} />
          ))}
        </div>

        {/* Make yours. */}
        <Rise className="mt-28 rounded-3xl border border-keeper-hair bg-white/70 px-7 py-10 text-center md:mt-36 md:px-12 md:py-14">
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
      </main>
      <MarketingFooter />
    </div>
  );
}
