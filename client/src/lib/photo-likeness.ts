// client/src/lib/photo-likeness.ts
//
// Set-level judgement over the per-photo likeness assessments
// (photos.likeness, written by server/photos/analyze.ts at upload).
//
// The model judges ONE photo per call and cannot know the others exist —
// but the set is what generation actually uses, so the customer-facing
// message must be computed over the set. That aggregation is
// deterministic and lives here, in one place, so the review step and any
// future surface say the same thing.
//
// POLICY (Kevin 2026-07-31):
//   · Best photo dominates. One strong photo among weak ones = say
//     NOTHING. The strong source carries the generation; a warning here
//     is noise that erodes trust in the warnings that matter.
//   · Warn only when EVERY assessed photo is weak.
//   · Single weak photo in one_person mode → fold in the multi-angle
//     nudge, because adding a photo is the cheapest fix.
//   · No data (legacy uploads, analysis pending or failed) → SILENCE.
//     Never treat "unknown" as "weak".
//   · Advisory always. This never gates the generate button.

import type { Photo } from '@shared/models/photos';
import type { PhotoMode } from '@shared/schema';

export interface PhotoSetNote {
  headline: string;
  detail: string;
}

export function likenessNoteForSet(
  selected: Array<Pick<Photo, 'likeness'>>,
  mode: PhotoMode,
): PhotoSetNote | null {
  const assessed = selected
    .map((p) => p.likeness)
    .filter((l): l is NonNullable<typeof l> => !!l && typeof l.verdict === 'string');

  // Warn only when EVERY photo in the set has been assessed. An
  // unassessed photo (legacy upload, analysis still landing) might be a
  // perfectly strong source — warning around an unknown is guessing,
  // and the whole policy is "silence unless we actually know".
  if (assessed.length === 0 || assessed.length < selected.length) return null;

  // Any non-weak photo carries the set.
  if (assessed.some((l) => l.verdict !== 'weak')) return null;

  // Everything assessed is weak. Prefer the model's own reason from the
  // least-bad photo (they're all weak; first is fine — reasons across a
  // weak set are usually the same complaint).
  const reason = assessed[0].reason?.trim();

  if (mode === 'group') {
    return {
      headline: 'This photo may make likeness tricky',
      detail:
        (reason ? `${reason} ` : '') +
        'A clearer shot of everyone facing the camera usually lands much better — but it’s your call, and you can always roll again.',
    };
  }

  if (selected.length === 1) {
    return {
      headline: 'One photo, and a tricky one',
      detail:
        (reason ? `${reason} ` : '') +
        'Adding one or two more angles of them gives us much more to work with — it matters most when we only have a single photo.',
    };
  }

  return {
    headline: 'These photos may make likeness tricky',
    detail:
      (reason ? `${reason} ` : '') +
      'One clear, front-on shot added to the set usually does it — but you can generate as-is and see.',
  };
}
