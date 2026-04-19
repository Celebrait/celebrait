// client/src/components/studio/recipient-context-strip.tsx
//
// A small banner that re-grounds the user in who this card is for.
// Drops into the top of later steps (Scene, Style, Inside) so once
// the user moves past Recipient+Photo they still feel the emotional
// context.
//
// Displays: cropped photo thumbnail (if available) + recipient name
// + occasion icon + occasion label. Single row on wider layouts,
// gracefully stacks on tiny widths. No interaction — pure context.

import { useQuery } from '@tanstack/react-query';
import { User } from 'lucide-react';
import type { CardDraftState } from '@shared/schema';
import type { Photo } from '@shared/models/photos';
import { OCCASION_ICON } from './steps/recipient-step';
import { getOccasionLabel } from './scene-presets';

interface RecipientContextStripProps {
  state: CardDraftState;
  /** When true, renders nothing if the strip would be near-empty
   *  (no name yet). Prevents an awkward "For …" stub on early steps
   *  if the user jumped ahead somehow. Default: true. */
  hideIfEmpty?: boolean;
}

export function RecipientContextStrip({
  state,
  hideIfEmpty = true,
}: RecipientContextStripProps) {
  const name = state.recipient?.name?.trim();
  const occasion = state.recipient?.occasion?.trim();
  const photoId = state.photos?.photoIds?.[0];

  // Library fetch — cached by react-query so multiple strips on the
  // same page share one request.
  const { data: photos } = useQuery<Photo[]>({
    queryKey: ['/api/user/photos'],
    // Only fire the query if we actually need a thumbnail — avoids
    // a wasted fetch on pages that wouldn't use the result anyway.
    enabled: !!photoId,
  });
  const photo = photoId ? photos?.find((p) => p.id === photoId) : undefined;

  if (hideIfEmpty && !name) return null;

  const OccasionIcon =
    (occasion && OCCASION_ICON[occasion]) || undefined;
  const occasionLabel = occasion ? getOccasionLabel(occasion) : '';
  // Show the raw user-typed text for custom occasions (e.g. "Retirement")
  // since getOccasionLabel falls back to that exact string for unknowns.

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-xl bg-surface-cream border border-accent-coral-light"
      data-testid="recipient-context-strip"
    >
      {/* Thumbnail slot — real cropped photo if we have one; silhouette
          fallback if the user jumped past Photo (shouldn't happen given
          step gating, but the strip is defensive). */}
      <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 bg-white border border-stone-200 flex items-center justify-center">
        {photo ? (
          <img
            src={`/images/${photo.thumbnailPath}`}
            alt={name ?? 'Recipient photo'}
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-4 h-4 text-stone-400" strokeWidth={1.75} />
        )}
      </div>

      {/* Name + occasion inline. Uses subtle • separator on md+; stacks
          naturally on narrower widths via flex-wrap. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
        <span className="text-sm font-semibold text-ink truncate">
          For {name}
        </span>
        {occasion && (
          <>
            <span className="text-stone-300 text-xs" aria-hidden="true">•</span>
            <span className="flex items-center gap-1 text-xs text-stone-600">
              {OccasionIcon && (
                <OccasionIcon
                  className="w-3.5 h-3.5 text-accent-coral-dark"
                  strokeWidth={1.75}
                />
              )}
              {occasionLabel}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
