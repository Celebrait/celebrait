// client/src/pages/studio-drafts.tsx
//
// Drafts surface — every card the user hasn't finished yet.
//
// Rebuild 2026-04-26 (Kevin's test feedback): replaced the CardGrid
// of large tiles with a stacked list of compact rows. The big tiles
// were poorly sized for half-finished drafts (no front image, lots
// of whitespace, low information density), so the page felt sparse
// and uninviting.
//
// New design:
//   • One row per draft. Icon + title + step meta + progress dots +
//     Continue arrow. Mobile: progress drops below the title.
//   • Sorted by step desc (closer-to-done first), then date desc
//     within the same step. The user's eye lands on the drafts
//     they're closest to finishing — the implicit nudge to complete.
//   • Visual nudge for the "almost there" cohort: a subtle
//     "Ready to generate" badge for drafts on Review (step 6), and
//     a "One step away" hint for drafts on Inside text (step 5).
//   • Earlier drafts get the same row, no badge — quietly
//     de-emphasised by being lower in the list, not by chrome.

import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { ArrowRight, Wand2, FileEdit, Sparkles } from 'lucide-react';
import { bucketCards, deriveCardTitle } from '@/lib/studio-card-buckets';
import { getOccasionIcon } from '@/lib/occasion-icon';
import { CARD_MAKER_STEPS } from '@shared/schema';
import type { CardGridItem } from '@shared/schema';

// Steps that count toward the user-visible progress dots — excludes
// the final Review step which is the "ready to generate" celebratory
// state, not a step. Total = 6 (Recipient → Inside text).
const VISIBLE_STEP_COUNT = CARD_MAKER_STEPS.length - 1;

export default function StudioDrafts() {
  const { data, isLoading, error } = useQuery<CardGridItem[]>({
    queryKey: ['/api/user/cards'],
  });

  return (
    <>
      <PageHeader />

      {isLoading ? (
        <DraftListSkeleton />
      ) : error ? (
        <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} />
      ) : (
        <DraftList drafts={bucketCards(data ?? []).drafts} />
      )}
    </>
  );
}

// ── Page header ─────────────────────────────────────────────────────
function PageHeader() {
  return (
    <div className="mb-6 sm:mb-8 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-ink">Drafts</h1>
        <p className="text-sm text-stone-600 mt-1">
          Pick up where you left off — drafts save automatically.
        </p>
      </div>
      <Link
        href="/studio/new-card"
        className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white rounded-full px-4 py-2 text-sm font-semibold transition-colors shadow-sm flex-shrink-0"
        data-testid="drafts-new-card"
      >
        <Wand2 className="w-4 h-4" />
        <span className="hidden sm:inline">New card</span>
      </Link>
    </div>
  );
}

// ── List + sort ─────────────────────────────────────────────────────
function DraftList({ drafts }: { drafts: CardGridItem[] }) {
  if (drafts.length === 0) return <DraftsEmpty />;

  // Sort: higher step first (closer to done), then newer first within
  // the same step. Drives the user's eye to the drafts they're
  // closest to finishing — the implicit nudge to complete.
  const sorted = [...drafts].sort((a, b) => {
    const stepA = a.draftStep ?? 0;
    const stepB = b.draftStep ?? 0;
    if (stepA !== stepB) return stepB - stepA;
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tB - tA;
  });

  return (
    <div className="space-y-2.5" data-testid="draft-list">
      {sorted.map((card) => (
        <DraftListRow key={card.id} card={card} />
      ))}
    </div>
  );
}

// ── DraftListRow — the compact stacked-list row ─────────────────────
function DraftListRow({ card }: { card: CardGridItem }) {
  const title = deriveCardTitle(card);
  const Icon = getOccasionIcon(card.occasion);
  const step = card.draftStep ?? 0;

  // Step interpretation:
  //   step 0..5 = Recipient → Inside text (in-progress)
  //   step 6    = Review & Purchase (= ready to generate)
  // Filled-dot count caps at VISIBLE_STEP_COUNT (6).
  const isReadyToGenerate = step >= VISIBLE_STEP_COUNT;
  const isOneStepAway = step === VISIBLE_STEP_COUNT - 1;
  const filled = Math.min(step, VISIBLE_STEP_COUNT);

  const stepLabel = formatStepLabel(step);
  const dateLabel = formatRelativeTime(card.createdAt);
  const metaLine =
    stepLabel && dateLabel ? `${stepLabel} · ${dateLabel}` : stepLabel || dateLabel || '';

  return (
    <Link
      href={`/studio/card/${card.id}/edit`}
      className={`group block rounded-2xl border transition-all hover:shadow-sm ${
        isReadyToGenerate
          ? 'bg-brand-muted/40 border-brand/40 hover:border-brand'
          : 'bg-white border-stone-200 hover:border-stone-300'
      }`}
      data-testid={`draft-list-row-${card.id}`}
    >
      <div className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4">
        {/* Icon — occasion-specific. Image thumbnail if the draft
            already has one (rare for half-finished drafts but possible
            for failed-then-restarted ones); icon otherwise.
            Icon colour locked to brand violet across all rows so the
            occasion glyph reads as a consistent visual anchor; the
            background tint still differentiates 'ready' from the rest. */}
        <div
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-brand-dark ${
            isReadyToGenerate ? 'bg-brand/10' : 'bg-brand-muted'
          }`}
        >
          {card.frontImageUrl ? (
            <img
              src={card.frontImageUrl}
              alt={title}
              className="w-full h-full object-cover rounded-xl"
            />
          ) : (
            <Icon className="w-5 h-5" strokeWidth={1.75} />
          )}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <p className="text-sm sm:text-base font-semibold text-ink truncate">
            {title}
          </p>
          {metaLine && (
            <p className="text-[11px] sm:text-xs text-stone-500 truncate mt-0.5">
              {metaLine}
            </p>
          )}
        </div>

        {/* Right side — progress + badge + arrow.
            Hidden on mobile (the progress strip drops below). */}
        <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
          <ProgressDots filled={filled} total={VISIBLE_STEP_COUNT} highlight={isReadyToGenerate} />
          {isReadyToGenerate ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-dark">
              <Sparkles className="w-3 h-3" />
              Ready to generate
            </span>
          ) : isOneStepAway ? (
            <span className="text-[11px] text-stone-500 italic">
              One step away
            </span>
          ) : null}
        </div>

        <ArrowRight
          className={`w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0 transition-colors ${
            isReadyToGenerate
              ? 'text-brand'
              : 'text-stone-400 group-hover:text-stone-600'
          }`}
        />
      </div>

      {/* Mobile-only progress strip — under the title row, since the
          right-aligned cluster is hidden on small screens. Dropping
          it here keeps the title line uncluttered on phones. */}
      <div className="sm:hidden px-3 pb-3 -mt-1 flex items-center justify-between gap-3">
        <ProgressDots filled={filled} total={VISIBLE_STEP_COUNT} highlight={isReadyToGenerate} />
        {isReadyToGenerate ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand-dark">
            <Sparkles className="w-3 h-3" />
            Ready
          </span>
        ) : isOneStepAway ? (
          <span className="text-[10px] text-stone-500 italic">
            One step away
          </span>
        ) : null}
      </div>
    </Link>
  );
}

// ── ProgressDots — six tiny dots, filled left-to-right ───────────────
function ProgressDots({
  filled,
  total,
  highlight,
}: {
  filled: number;
  total: number;
  highlight: boolean;
}) {
  return (
    <div className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: total }).map((_, i) => {
        const isFilled = i < filled;
        return (
          <span
            key={i}
            className={`block w-1.5 h-1.5 rounded-full transition-colors ${
              isFilled
                ? highlight
                  ? 'bg-brand'
                  : 'bg-brand/70'
                : 'bg-stone-200'
            }`}
          />
        );
      })}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Step label — "Recipient", "Photo", … "Inside text", or "Ready to
 *  review" for the final step. Returns null for missing/invalid. */
function formatStepLabel(step: number): string | null {
  if (step >= VISIBLE_STEP_COUNT) return 'Ready to review';
  if (step < 0 || step >= CARD_MAKER_STEPS.length) return null;
  const label = CARD_MAKER_STEPS[step]?.label ?? '';
  return label ? `Step ${step + 1} of ${VISIBLE_STEP_COUNT} · ${label}` : null;
}

/** Relative time for the draft row. "Today" / "Yesterday" / "X days
 *  ago" / "12 Apr". Matches studio.tsx + studio-orders.tsx so the
 *  three surfaces feel coherent. */
function formatRelativeTime(ts: Date | string | null): string | null {
  if (!ts) return null;
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  const diffMs = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diffMs < day) return 'Started today';
  if (diffMs < 2 * day) return 'Started yesterday';
  if (diffMs < 7 * day) return `Started ${Math.floor(diffMs / day)} days ago`;
  return `Started ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

// ── Skeleton — three rows so the page doesn't pop ────────────────────
function DraftListSkeleton() {
  return (
    <div className="space-y-2.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-stone-200 bg-white p-3 sm:p-4 flex items-center gap-3 sm:gap-4 animate-pulse"
        >
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-stone-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-stone-100 rounded w-2/3" />
            <div className="h-3 bg-stone-100 rounded w-1/3" />
          </div>
          <div className="hidden sm:flex gap-1">
            {[0, 1, 2, 3, 4, 5].map((j) => (
              <span key={j} className="block w-1.5 h-1.5 rounded-full bg-stone-100" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Empty + error ───────────────────────────────────────────────────
function DraftsEmpty() {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-14 h-14 rounded-full bg-brand-muted text-brand-dark flex items-center justify-center mx-auto mb-4">
        <FileEdit className="w-6 h-6" />
      </div>
      <p className="text-base font-semibold text-ink mb-1">No drafts right now</p>
      <p className="text-sm text-stone-600 mb-6 max-w-sm mx-auto">
        When you start a card and step away, it'll live here until you come back.
      </p>
      <Link
        href="/studio/new-card"
        className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white rounded-full px-5 py-2.5 text-sm font-semibold transition-colors shadow-sm"
        data-testid="drafts-empty-start-card"
      >
        <Wand2 className="w-4 h-4" />
        Start a card
      </Link>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-12">
      <p className="text-sm text-red-600 mb-2">Couldn't load your drafts.</p>
      <p className="text-xs text-stone-500">{message}</p>
    </div>
  );
}
