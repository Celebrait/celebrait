// client/src/components/studio/card-thumbnail.tsx
//
// Single card tile in the Studio "My Cards" grid. Shows the front
// image (or a placeholder while generating / on failure), the
// derived title, a status badge, and a hover-revealed delete button.
//
// Drafts click into the maker to resume; finished cards click into
// their detail page (which is still a Sprint 4 placeholder).

import { useState } from 'react';
import { Link } from 'wouter';
import { ImageOff, Loader2, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { getOccasionIcon } from '@/lib/occasion-icon';
import {
  deriveCardTitle,
  isDraftStatus,
  isGeneratedStatus,
  isGeneratingStatus,
} from '@/lib/studio-card-buckets';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { StatusBadge } from './status-badge';
import type { CardGridItem } from '@shared/schema';

interface CardThumbnailProps {
  card: CardGridItem;
  /** Family size when this tile is the COVER of a take-family with
   *  more than one member (see collapseFamilies). Renders an "N takes"
   *  badge bottom-left; the card view's takes rail does the switching. */
  takesCount?: number;
}

// Title derivation lives in @/lib/studio-card-buckets so the dashboard
// + grid + drafts/ready/sent surfaces all read identically. Was
// duplicated here pre-2026-04-26 — leaked "Mum's birthday" / "Mum's
// thankyou" because this copy didn't get the suffix + label fixes.
export function CardThumbnail({ card, takesCount }: CardThumbnailProps) {
  const title = deriveCardTitle(card);
  // Use the shared bucket logic so front-first lifecycle statuses
  // (generating-front/front-ready/…) read correctly — inline
  // status==='generating' checks missed them, so a half-generated card
  // showed a green "Ready to send" chip (audit 2026-07-02).
  const isGenerating = isGeneratingStatus(card.status);
  const isUnfinished = isDraftStatus(card.status);
  // "Ready to send" = fully generated card with no paid order against it.
  // Small chip on the tile nudges the user to go buy it; click still
  // goes to the viewer where the Buy CTA lives.
  const isReadyToSend = isGeneratedStatus(card.status) && !card.hasPaidOrder;
  // "Just finished" — completed card the sender hasn't yet opened or
  // dismissed the toast for. Layered on TOP of the Ready/Sent split so
  // a freshly-finished unpaid card shows the violet "Just finished"
  // chip + glow instead of the standard green "Ready to send"; a
  // freshly-finished PAID card (rare, but possible if the user paid
  // before viewing) just gets the glow. The flag flips server-side
  // the moment the user views the card or dismisses the toast, so
  // this treatment naturally fades out after engagement.
  const isJustFinished = card.isJustFinished === true;
  const [imageFailed, setImageFailed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { toast } = useToast();
  const hasImage = !!card.frontImageUrl && !imageFailed;

  // A card whose status claims it's ready-for-the-customer (completed,
  // ready, paid, purchased) but has no viewable image is almost always
  // legacy data from the pre-Studio flow where image paths were stored
  // differently. Don't mislead the user with a green "Ready" badge on
  // a card they can't see — downgrade to an "Archived" label instead
  // so it's clearly a different state.
  const isOrphanedCompleted =
    !hasImage &&
    !isUnfinished &&
    (card.status === 'completed' ||
      card.status === 'ready' ||
      card.status === 'paid' ||
      card.status === 'purchased');
  const effectiveStatus = isOrphanedCompleted ? 'archived' : card.status;
  // Unfinished cards (draft + any front-first in-progress status) click
  // back into the maker to resume; finished cards go to their detail page.
  const href = isUnfinished ? `/studio/card/${card.id}/edit` : `/studio/card/${card.id}`;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/studio/cards/${card.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/cards'] });
      toast({ title: 'Card deleted', variant: 'success' });
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't delete",
        description: err?.message ?? 'Try again in a moment.',
        variant: 'destructive',
      });
    },
  });

  // Shared tile body so the tile stays one clickable unit while the
  // delete button sits absolutely on top of it.
  const tileBody = (
    <>
      <div className="aspect-square bg-stone-100 relative overflow-hidden">
        {hasImage ? (
          <img
            src={card.frontImageUrl!}
            alt={title}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
          />
        ) : isGenerating ? (
          <div className="w-full h-full flex flex-col items-center justify-center text-keeper-meta">
            <Loader2 className="w-8 h-8 animate-spin text-brand mb-2" />
            <p className="text-xs">Generating…</p>
          </div>
        ) : isOrphanedCompleted ? (
          // Orphaned "completed" card with no viewable image. Keep the
          // explicit ImageOff treatment here so the user understands
          // this is a broken state, not a draft they can edit.
          <div className="w-full h-full flex flex-col items-center justify-center text-keeper-meta">
            <ImageOff className="w-8 h-8 mb-1" />
            <p className="text-xs">Image unavailable</p>
          </div>
        ) : (
          // No image yet (draft / failed). Show the occasion icon
          // when known — gives the tile meaning even before any
          // rendering happens. Falls back to PenLine for unknown
          // / missing occasions. Much warmer than the old "No preview"
          // grey block.
          (() => {
            const Icon = getOccasionIcon(card.occasion);
            return (
              <div className="w-full h-full flex items-center justify-center bg-brand-muted/50 text-brand-dark">
                <Icon className="w-10 h-10" strokeWidth={1.5} />
              </div>
            );
          })()
        )}
        {/* For "ready" cards we drop the top-right StatusBadge — having
            both a yellow status pill AND a ready-to-send chip on the
            same tile was noise. The green chip (bottom-right) is the
            single action signal. Drafts/generating/failed/sent tiles
            keep the status badge. */}
        {!isReadyToSend && (
          <div className="absolute top-2 right-2">
            <StatusBadge status={effectiveStatus} />
          </div>
        )}
        {isReadyToSend && !isJustFinished && (
          <div
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-cta text-white text-[10px] font-semibold uppercase tracking-wider rounded-full px-2.5 py-1 shadow-sm"
            data-testid={`chip-ready-to-send-${card.id}`}
          >
            Ready to send
          </div>
        )}
        {isJustFinished && (
          <div
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-brand text-brand-foreground text-[10px] font-semibold uppercase tracking-wider rounded-full px-2.5 py-1 shadow-sm"
            data-testid={`chip-just-finished-${card.id}`}
          >
            <span aria-hidden>✨</span>
            Just finished
          </div>
        )}
        {typeof takesCount === 'number' && takesCount > 1 && (
          <div
            className="absolute bottom-2 left-2 inline-flex items-center gap-1 bg-white/90 text-keeper-body text-[10px] font-semibold rounded-full px-2.5 py-1 shadow-sm border border-keeper-hair"
            data-testid={`chip-takes-${card.id}`}
          >
            {takesCount} takes
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-keeper-ink truncate">{title}</p>
      </div>
    </>
  );

  return (
    <div className="group relative">
      <Link
        href={href}
        className={`block bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition-all ${
          isJustFinished
            ? // Violet ring + glow on "Just finished" tiles. Subtle —
              // visible enough to draw the eye, not so loud it overwhelms
              // the rest of the grid. Fades to normal once notifiedAt
              // is stamped (user opens it or dismisses the toast).
              'border-brand ring-2 ring-brand/20 shadow-[0_4px_20px_-4px_rgba(92,87,212,0.3)] hover:border-brand-dark'
            : 'border-keeper-hair hover:border-brand'
        }`}
        data-testid={`card-tile-${card.id}`}
        data-just-finished={isJustFinished ? 'true' : undefined}
      >
        {tileBody}
      </Link>

      {/* Delete — absolute so it overlays the Link without becoming
          part of its click target. Appears on hover (desktop) and
          on focus (keyboard), and stays visible on touch devices
          via the always-shown `sm:opacity-0 sm:group-hover:opacity-100`
          trick: mobile gets always-visible, desktop gets hover-reveal. */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setConfirmOpen(true);
        }}
        disabled={deleteMutation.isPending}
        // pointer-events MUST track opacity. When the button is
        // visible (mobile always, desktop on hover/focus) it should
        // receive clicks; when invisible it must NOT, otherwise the
        // top-left corner of every tile becomes a dead zone where
        // taps trigger the (invisible) delete instead of the Link
        // beneath. Kevin caught this 2026-04-27 — "cards only open
        // when clicked on the right".
        className="absolute top-2 left-2 flex items-center justify-center w-7 h-7 rounded-full bg-white/90 backdrop-blur text-keeper-body hover:text-red-600 hover:bg-white shadow-sm opacity-100 pointer-events-auto sm:opacity-0 sm:pointer-events-none sm:group-hover:opacity-100 sm:group-hover:pointer-events-auto focus:opacity-100 focus:pointer-events-auto transition-opacity disabled:opacity-50"
        aria-label={`Delete ${title}`}
        data-testid={`btn-delete-card-${card.id}`}
      >
        {deleteMutation.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Trash2 className="w-3.5 h-3.5" />
        )}
      </button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this card?</AlertDialogTitle>
            <AlertDialogDescription>
              "{title}" will be removed from your gallery. Any generated
              images are also deleted. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="btn-cancel-delete-card">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
              data-testid="btn-confirm-delete-card"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
