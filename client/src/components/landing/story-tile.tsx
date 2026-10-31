// client/src/components/landing/story-tile.tsx
//
// A card on the gallery wall and in the landing's "Real stories": the
// front shot, which crossfades to the inside shot on hover (the card
// opening, in two photographs), a chip saying who it was for, and the
// one-line hook. Links to the story (/stories/:slug). `featured` lays the shot beside
// the words at desktop width; otherwise the words sit under the shot.

import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import type { GalleryStory } from '@/lib/gallery-stories';
import { DISPLAY } from '@/pages/doorway';

/** `flip`: crossfade to the inside on hover. Off on the homepage (Aidan
 *  2026-10-31: "static front is fine"); on for /stories. */
export function StoryTile({ s, featured = false, flip = true }: { s: GalleryStory; featured?: boolean; flip?: boolean }) {
  const href = `/stories/${s.slug}`;
  return (
    <Link
      href={href}
      className={`group block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-keeper-gold/60 ${
        featured ? 'md:grid md:grid-cols-[1.05fr_0.95fr] md:items-center md:gap-14' : ''
      }`}
      data-testid={`story-tile-${s.slug}`}
    >
      <figure className="relative overflow-hidden rounded-3xl border border-keeper-hair shadow-[0_32px_80px_-40px_rgba(33,29,25,0.45)] transition-transform duration-500 group-hover:-translate-y-1">
        <img src={s.front.src} alt={s.front.alt} width={1400} height={1400} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
        {flip && (
        <img
          src={s.inside.src}
          alt=""
          width={1400}
          height={1400}
          loading="lazy"
          decoding="async"
          aria-hidden="true"
          className="absolute inset-0 aspect-square w-full object-cover opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
        />
        )}
        <figcaption className="absolute left-5 top-5 rounded-full border border-keeper-hair bg-white/90 px-3.5 py-1.5 text-[12.5px] font-semibold text-keeper-ink shadow-sm backdrop-blur">
          {s.chip}
        </figcaption>
        {flip && (
        <span className="pointer-events-none absolute bottom-5 right-5 rounded-full bg-keeper-ink/70 px-3 py-1 text-[11.5px] font-medium text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
          Hover: the inside
        </span>
        )}
      </figure>
      <div className={featured ? 'mt-7 md:mt-0' : 'mt-5'}>
        <h3
          className={`${featured ? 'text-[clamp(28px,3.6vw,40px)]' : 'text-[22px]'} leading-[1.1] [text-wrap:balance] ${DISPLAY}`}
        >
          {s.hook}
        </h3>
        <p className={`mt-3 max-w-[48ch] text-keeper-body ${featured ? 'text-[17px] leading-[1.65]' : 'text-[15px] leading-relaxed'}`}>
          {s.story[0]}
        </p>
        <span className="mt-5 inline-flex items-center gap-1.5 text-[15px] font-semibold text-keeper-gold">
          Read the story
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
