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
}

function deriveTitle(card: CardGridItem): string {
  const name = card.recipientName?.trim() || null;
  const occasion = card.occasion?.trim() || null;
  if (name && occasion) return `${name}'s ${occasion}`;
  if (name) return `For ${name}`;
  if (occasion) return `${occasion.charAt(0).toUpperCase()}${occasion.slice(1)} card`;
  return 'Untitled card';
}

export function CardThumbnail({ card }: CardThumbnailProps) {
  const title = deriveTitle(card);
  const isGenerating = card.status === 'generating';
  const isDraft = card.status === 'draft';
  // "Ready to send" = generated card with no paid order against it.
  // Small chip on the tile nudges the user to go buy it; click still
  // goes to the viewer where the Buy CTA lives.
  const isReadyToSend =
    !isDraft &&
    !isGenerating &&
    card.status !== 'failed' &&
    !card.hasPaidOrder;
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
    !isGenerating &&
    !isDraft &&
    (card.status === 'completed' ||
      card.status === 'ready' ||
      card.status === 'paid' ||
      card.status === 'purchased');
  const effectiveStatus = isOrphanedCompleted ? 'archived' : card.status;
  // Drafts click back into the maker to resume; finished cards go to
  // their detail/preview page (not built yet — Sprint 4).
  const href = isDraft ? `/studio/card/${card.id}/edit` : `/studio/card/${card.id}`;

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', `/api/studio/cards/${card.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/cards'] });
      toast({ title: 'Card deleted' });
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
          <div className="w-full h-full flex flex-col items-center justify-center text-stone-500">
            <Loader2 className="w-8 h-8 animate-spin text-brand mb-2" />
            <p className="text-xs">Generating…</p>
          </div>
        ) : isOrphanedCompleted ? (
          // Orphaned "completed" card with no viewable image. Keep the
          // explicit ImageOff treatment here so the user understands
          // this is a broken state, not a draft they can edit.
          <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
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
        {isReadyToSend && (
          <div
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-cta text-white text-[10px] font-semibold uppercase tracking-wider rounded-full px-2.5 py-1 shadow-sm"
            data-testid={`chip-ready-to-send-${card.id}`}
          >
            Ready to send
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-stone-900 truncate">{title}</p>
      </div>
    </>
  );

  return (
    <div className="group relative">
      <Link
        href={href}
        className="block bg-white rounded-2xl border border-stone-200 overflow-hidden hover:border-brand hover:shadow-lg transition-all"
        data-testid={`card-tile-${card.id}`}
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
        className="absolute top-2 left-2 flex items-center justify-center w-7 h-7 rounded-full bg-white/90 backdrop-blur text-stone-600 hover:text-red-600 hover:bg-white shadow-sm opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-50"
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
