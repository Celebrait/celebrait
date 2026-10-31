// client/src/components/landing/real-stories-section.tsx
//
// /photo's "Real stories": the gallery's first card, told in a line,
// linking to its story and to the wall. Sits after the proof (photo →
// card, in three examples): the proof says it works, this says what
// it is for. Replaced the parked six-tile GallerySection (2026-10-31).

import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { Rise } from '@/components/landing/rise';
import { StoryTile } from '@/components/landing/story-tile';
import { GALLERY_STORIES } from '@/lib/gallery-stories';
import { DISPLAY, EYEBROW } from '@/pages/doorway';

export function RealStoriesSection() {
  const [first, ...rest] = GALLERY_STORIES;
  if (!first) return null;
  return (
    <section id="real-stories" className="scroll-mt-32 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Rise className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <div>
            <p className={EYEBROW}>Real stories</p>
            <h2 className={`mt-3 text-[clamp(30px,4.4vw,44px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>
              One photo. The whole story.
            </h2>
          </div>
          <Link
            href="/gallery"
            className="inline-flex items-center gap-1.5 text-[15px] font-semibold text-keeper-ink underline decoration-keeper-hair underline-offset-4 transition-colors hover:decoration-keeper-gold"
            data-testid="real-stories-all"
          >
            See the gallery
            <ArrowRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </Link>
        </Rise>
        <Rise className="mt-12" delay={0.08}>
          <StoryTile s={first} featured />
        </Rise>
        {rest.length > 0 && (
          <div className="mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
            {rest.slice(0, 3).map((s, i) => (
              <Rise key={s.slug} delay={i * 0.08}>
                <StoryTile s={s} />
              </Rise>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
