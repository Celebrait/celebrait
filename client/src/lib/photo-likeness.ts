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

  // Wording is deliberately DIRECT (Kevin 2026-07-31: "harder messaging
  // when there's a clear issue"). We only reach this branch when every
  // photo assessed weak, so hedging reads as indecision — say what to do.
  // Still advisory: nothing gates, and the copy says continuing is
  // allowed, just honestly costed.
  if (mode === 'group') {
    return {
      headline: 'This photo won’t give a good likeness',
      detail:
        (reason ? `${reason} ` : '') +
        'Swap it for a clearer shot — everyone facing the camera, in decent light. You can continue with this one, but faces are unlikely to look right.',
    };
  }

  if (selected.length === 1) {
    return {
      headline: 'This photo isn’t enough on its own',
      detail:
        (reason ? `${reason} ` : '') +
        'Use a different photo, or add a clearer angle — front-on, good light. You can continue with just this one, but the likeness will suffer.',
    };
  }

  return {
    headline: 'These photos won’t give a good likeness',
    detail:
      (reason ? `${reason} ` : '') +
      'Add one clear, front-on shot — that usually fixes it. You can continue as-is, but faces are unlikely to look right.',
  };
}

// ── Analysis gate ───────────────────────────────────────────────────
// Next is held while a selected photo's analysis is still in flight
// (Kevin 2026-07-31) — the verdict is the whole point of the step, so
// advancing before it lands defeats it. But the gate FAILS OPEN after
// 30s: analysis is a background job against a third-party API, and if
// it hangs (outage, deploy mid-flight) a hard gate would strand a
// paying customer on the photo step with no way forward. Blocking on
// pending-AND-RECENT means a stuck analysis costs 30 seconds, not a
// customer. Legacy never-analysed photos are old → never block.
export const ANALYSIS_GATE_MS = 30_000;

export function analysisBlocking(
  selected: Array<{ analyzedAt: unknown; createdAt: unknown }>,
): boolean {
  const now = Date.now();
  return selected.some((p) => {
    if (p.analyzedAt != null) return false;
    const created = p.createdAt ? new Date(p.createdAt as string | Date).getTime() : 0;
    return Number.isFinite(created) && now - created < ANALYSIS_GATE_MS;
  });
}
