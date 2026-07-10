// client/src/components/studio/how-tweaking-works.tsx
//
// "How tweaking works" — the explainer module for the regen surface.
//
// Replaces the always-on reassurance paragraph that used to sit between
// the header and the card thumb (2026-06-01, Kevin). That paragraph
// pushed the card — the thing the user came to look at — down the page,
// and it tried to carry the whole mental model in one run-on sentence.
//
// The mental model the user actually needs (Kevin's brief):
//   • You're editing THIS design, not starting over. The model keeps the
//     composition + likeness and applies only what you describe — and
//     it's most accurate when you're SPECIFIC.
//   • You CAN change: expressions, actions, details in the scene, the
//     text on the front, and the message inside.
//   • You CANNOT change the photo / who's in it. The face stays the
//     person you uploaded; a tweak won't swap or re-pick the reference.
//   • "Front" and "inside" are both defined so the user knows the two
//     surfaces a tweak can touch.
//
// Lives behind a quiet trigger so the card stays high on the page; the
// detail is one tap away for anyone who wants it.

import { useState } from 'react';
import {
  HelpCircle,
  Check,
  X,
  Sparkles,
  Image as ImageIcon,
  PenLine,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function HowTweakingWorks() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand hover:text-brand-dark transition-colors"
          data-testid="btn-how-tweaking-works"
        >
          <HelpCircle className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
          How tweaking works
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 text-left">
          <DialogTitle className="text-base font-semibold text-ink">
            How tweaking works
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* The one idea that matters most. */}
          <p className="text-[13px] text-stone-600 leading-relaxed">
            You're refining{' '}
            <span className="font-medium text-ink">this design</span>, not
            starting over. Our engine keeps the same composition and likeness
            and only applies the change you describe — so the more{' '}
            <span className="font-medium text-ink">specific</span> you are, the
            more accurate it gets.
          </p>

          {/* The two surfaces a tweak can touch. */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-keeper-hair bg-stone-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <ImageIcon
                  className="w-3.5 h-3.5 text-brand"
                  strokeWidth={2}
                  aria-hidden
                />
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
                  Front
                </p>
              </div>
              <p className="text-[12px] text-stone-500 leading-snug">
                The illustrated scene and any wording on it.
              </p>
            </div>
            <div className="rounded-lg border border-keeper-hair bg-stone-50 px-3 py-2.5">
              <div className="flex items-center gap-1.5 mb-0.5">
                <PenLine
                  className="w-3.5 h-3.5 text-brand"
                  strokeWidth={2}
                  aria-hidden
                />
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">
                  Inside
                </p>
              </div>
              <p className="text-[12px] text-stone-500 leading-snug">
                The printed message your recipient reads.
              </p>
            </div>
          </div>

          {/* What you can change. */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles
                className="w-3.5 h-3.5 text-cta-hover"
                strokeWidth={2}
                aria-hidden
              />
              <p className="text-[12px] font-semibold text-ink">
                You can change
              </p>
            </div>
            <ul className="space-y-1.5">
              {[
                'Expressions — “make them laughing”, “a softer smile”',
                'Actions & what’s happening in the scene',
                'Details in the image — objects, background, colours, season',
                'The text on the front',
                'The message inside the card',
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-[12.5px] text-stone-600 leading-snug"
                >
                  <Check
                    className="w-3.5 h-3.5 text-cta-hover shrink-0 mt-0.5"
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* What you can't change — the photo. The single most important
              expectation to set: a tweak won't swap or improve the face. */}
          <div className="rounded-lg bg-stone-50 border border-keeper-hair px-3 py-2.5">
            <div className="flex items-start gap-2">
              <X
                className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5"
                strokeWidth={2.5}
                aria-hidden
              />
              <p className="text-[12.5px] text-stone-600 leading-snug">
                <span className="font-medium text-ink">
                  You can’t change the photo or who’s in it here.
                </span>{' '}
                The face stays the person you uploaded — tweaks adjust the
                scene around them, not the likeness itself.
              </p>
            </div>
          </div>

          {/* Style-coherence nudge — a tweak only changes the side you
              type in, so a whole-look change on the front can leave the
              inside (styled to match) looking out of step. Point the user
              at the fix they already have: tweak both. See
              next_regen_ux_audit.md (front/inside coherence gap). */}
          <p className="text-[12px] text-stone-500 leading-snug">
            Changing the <span className="font-medium text-ink">whole look</span>{' '}
            of the scene? Tweak the inside too, so the two sides still match.
          </p>

          <p className="text-[11.5px] text-stone-400 leading-snug pt-0.5">
            Every version is saved and free, so you can flip back any time
            using the row below the card.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
