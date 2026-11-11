// client/src/components/landing/scene-ideas-section.tsx — "Stuck for a
// scene? Steal one." (2026-11-12)
//
// Sits where "Imagine it. Describe it. Send it." used to. That section
// sold the brainstorm chat, which is signed-in only; this does the same
// job for a signed-out visitor with no chat and no model call: the blank
// "describe the scene" box is the hardest step in the maker, so hand
// them a scene. Pick who it's for, tap an idea, and the maker opens with
// it already written (photo-maker.tsx reads ?scene= and ?recipient=).
//
// Deliberately a different SHAPE from the rest of /photo (pills and a
// wall of tappable lines, no picture), and each line is its own way in —
// the only buttons on the page that don't say "Make a card".
//
// The ideas live in lib/scene-ideas.ts with the rules they must pass.
import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { Rise } from '@/components/landing/rise';
import { DISPLAY, EYEBROW } from '@/pages/doorway';
import { SCENE_IDEA_GROUPS, sceneIdeaHref } from '@/lib/scene-ideas';

export function SceneIdeasSection() {
  const [groupId, setGroupId] = useState(SCENE_IDEA_GROUPS[0].id);
  const group = SCENE_IDEA_GROUPS.find((g) => g.id === groupId) ?? SCENE_IDEA_GROUPS[0];
  return (
    <section id="scene-ideas" className="scroll-mt-32 px-6 py-16 md:py-28" data-testid="scene-ideas">
      <div className="mx-auto max-w-4xl">
        <Rise className="text-center">
          <p className={EYEBROW}>Scene ideas</p>
          <h2 className={`mt-3 text-[clamp(30px,4.4vw,44px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>
            Stuck for a scene? Steal one.
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[17px] leading-[1.6] text-keeper-body">
            Pick who it’s for and tap an idea. It’ll be waiting in the maker, and you can change every word.
          </p>
        </Rise>

        <Rise delay={0.06}>
          {/* Who's it for — plain toggle buttons, one pressed at a time. */}
          <div className="mt-8 flex flex-wrap justify-center gap-2" role="group" aria-label="Who is the card for?">
            {SCENE_IDEA_GROUPS.map((g) => {
              const on = g.id === group.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setGroupId(g.id)}
                  className={`min-h-[44px] rounded-full border px-4 py-2 text-[14.5px] font-semibold transition-colors ${
                    on
                      ? 'border-brand bg-brand text-brand-foreground'
                      : 'border-keeper-hair bg-white text-keeper-ink hover:border-brand/60'
                  }`}
                  data-testid={`scene-ideas-for-${g.id}`}
                >
                  {g.label}
                </button>
              );
            })}
          </div>

          {/* The ideas for that person. Each one is a link into the maker. */}
          <ul className="mt-6 grid gap-3 sm:grid-cols-2" aria-live="polite">
            {group.ideas.map((idea) => (
              <li key={idea}>
                <Link
                  href={sceneIdeaHref(group, idea)}
                  className="group flex h-full min-h-[64px] items-center justify-between gap-4 rounded-2xl border border-keeper-hair bg-white px-5 py-4 shadow-sm transition-colors hover:border-brand"
                  data-testid="scene-idea"
                >
                  <span className="font-display text-[17px] font-bold leading-snug tracking-[-0.01em] text-keeper-ink">
                    {idea}
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-brand-dark transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-6 text-center text-[14px] text-keeper-meta">
            Got your own?{' '}
            <Link
              href="/photo/make"
              className="font-semibold text-keeper-ink underline decoration-keeper-hair underline-offset-4 transition-colors hover:decoration-keeper-gold"
              data-testid="scene-ideas-own"
            >
              Start with a blank page
            </Link>
            . Anywhere, doing anything.
          </p>
        </Rise>
      </div>
    </section>
  );
}
