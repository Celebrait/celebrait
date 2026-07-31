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
  /** 'good' = green confirmation · 'warn' = amber advice, Next stays
   *  live · 'block' = red, Next is HELD until the photo is swapped or
   *  the user explicitly overrides (Kevin 2026-07-31: a heavily blurred
   *  face prints as a face-shaped smear at £8.99 — that one we stop). */
  tone: 'good' | 'warn' | 'block';
  headline: string;
  detail: string;
}

/** The dominant reason a weak set is weak, read deterministically off
 *  the per-face fields the model already returns. Different causes need
 *  DIFFERENT advice (Kevin 2026-07-31): a profile shot usually still
 *  resembles the person — side-on, holding the photo's pose — which is
 *  nothing like the right message for a blurred face. */
function dominantWeakCause(
  assessed: Array<NonNullable<Photo['likeness']>>,
): 'angle' | 'blur' | 'occlusion' | 'lighting' | 'expression' | 'other' {
  const faces = assessed.flatMap((l) => l.faces ?? []);
  if (faces.some((f) => f.angle === 'profile' || f.angle === 'turned-away')) return 'angle';
  if (faces.some((f) => f.focus === 'blurred')) return 'blur';
  if (faces.some((f) => (f.occlusions?.length ?? 0) > 0)) return 'occlusion';
  if (faces.some((f) => f.lighting && f.lighting !== 'even')) return 'lighting';
  if (faces.some((f) => f.expressionRisk)) return 'expression';
  return 'other';
}

export function likenessNoteForSet(
  selected: Array<Pick<Photo, 'likeness'>>,
  mode: PhotoMode,
): PhotoSetNote | null {
  const assessed = selected
    .map((p) => p.likeness)
    .filter((l): l is NonNullable<typeof l> => !!l && typeof l.verdict === 'string');

  // Speak only when EVERY photo in the set has been assessed. An
  // unassessed photo (legacy upload, analysis still landing) might be a
  // perfectly strong source — judging around an unknown is guessing,
  // and the whole policy is "silence unless we actually know".
  if (assessed.length === 0 || assessed.length < selected.length) return null;

  const plural = selected.length > 1;

  // ── Green light (Kevin 2026-07-31) ────────────────────────────────
  // A good photo used to resolve to SILENCE, which after an "Analysing…"
  // spinner read as the check having gone nowhere. Positive confirmation
  // also makes the amber warnings mean something when they do appear.
  if (assessed.some((l) => l.verdict !== 'weak')) {
    const best = assessed.some((l) => l.verdict === 'strong') ? 'strong' : 'usable';
    if (best === 'strong') {
      return {
        tone: 'good',
        headline: plural ? 'Great photos — likeness looks strong' : 'Great photo — likeness looks strong',
        detail:
          mode === 'one_person' && !plural
            ? 'This will work well. A second angle can sharpen it further, but you’re good to go.'
            : 'Clear faces, good light — exactly what we need. You’re good to go.',
      };
    }
    // Best is "usable". A tick next to a hefty caveat reads
    // contradictory (Kevin's hat-and-hand example got "the hat and hand
    // obscure important information… good to go"), so usable-with-
    // visible-obstructions drops to amber advice; clean usable stays
    // green.
    const usable = assessed.find((l) => l.verdict === 'usable');
    const usableReason = usable?.reason?.trim();
    const obstructed = (usable?.faces ?? []).some(
      (f) => (f.occlusions?.length ?? 0) > 0 || f.expressionRisk,
    );
    if (obstructed) {
      return {
        tone: 'warn',
        headline: 'This photo can work, but something’s in the way',
        detail:
          (usableReason ? `${usableReason} ` : '') +
          'A shot with the face and hair fully visible would land better. Your call — you can continue with this one.',
      };
    }
    return {
      tone: 'good',
      headline: plural ? 'These photos should work' : 'This photo should work',
      detail:
        (usableReason ? `One small thing: ${usableReason} ` : '') +
        'Good to go — likeness should come through.',
    };
  }

  // ── Everything assessed weak: warn, with CAUSE-SPECIFIC advice ────
  // Wording is deliberately DIRECT (Kevin: "harder messaging when
  // there's a clear issue") but honest about what actually happens.
  // Still advisory: nothing gates, continuing is allowed and priced.
  const reason = assessed[0].reason?.trim();
  const cause = dominantWeakCause(assessed);

  // Profile shots get their own truth (Kevin 2026-07-31): they often DO
  // resemble the person — side-on, keeping the photo's pose — because
  // the model reproduces what it saw and invents what it didn't. That's
  // a different promise from "won't look like them".
  if (cause === 'angle') {
    return {
      tone: 'warn',
      headline: plural
        ? 'These photos only show their faces from the side'
        : 'This photo only shows their face from the side',
      detail:
        'The card may well come out side-on too — we redraw the view we’re given, and a front-on happy face would be half-invented. If you’re happy with a side-on card, carry on. For their full face, ' +
        (mode === 'group'
          ? 'use a shot where everyone’s looking at the camera.'
          : 'add a photo where they’re looking at the camera.'),
    };
  }

  // Heavy blur is the one cause we BLOCK on: it's the model's most
  // certain judgement, and the output is reliably a smear. Everything
  // else stays advisory. The UI pairs this with an explicit
  // "use it anyway" override — blocking by friction, not by wall,
  // because the only-photo-of-a-late-relative case is real and the
  // 2026-07-22 lesson (hard-blocking on an imperfect detector strands
  // users on false alarms) still applies.
  if (cause === 'blur') {
    return {
      tone: 'block',
      headline: 'This photo is too blurred to work from',
      detail:
        (reason ? `${reason} ` : '') +
        'A blurred face gives us nothing to rebuild from — the card would get a guess, not them. Please use a sharper photo.',
    };
  }

  const fix =
    cause === 'occlusion'
        ? 'Whatever’s covering them, we have to make up what’s underneath. A photo with the face and hair fully visible will land far better.'
        : cause === 'lighting'
          ? 'Harsh light hides the detail we read a face from. A photo in even, decent light will land far better.'
          : cause === 'expression'
            ? 'That expression bends the features we build a new face from, so a happy version becomes guesswork. A relaxed or naturally smiling photo works much better.'
            : (mode === 'group'
                ? 'Swap it for a clearer shot — everyone facing the camera, in decent light.'
                : 'Use a clearer photo — front-on, good light.');

  return {
    tone: 'warn',
    headline:
      mode === 'group'
        ? 'This photo will hurt the likeness'
        : plural
          ? 'These photos will hurt the likeness'
          : 'This photo isn’t enough on its own',
    detail: (reason ? `${reason} ` : '') + fix + ' You can continue anyway — your call.',
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
