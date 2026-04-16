// client/src/components/studio/card-thumbnail.tsx
//
// Single card tile in the Studio "My Cards" grid. Shows the front image
// (or a placeholder while generating / on failure), the recipient name +
// occasion derived from conversationData, and a status badge.
//
// Clicking a tile currently routes to /studio/card/:id which doesn't
// exist yet — Sprint 3 adds the card detail / maker pages. For now the
// link is a no-op so the UI still feels alive.

import { useState } from 'react';
import { Link } from 'wouter';
import { ImageOff, Loader2 } from 'lucide-react';
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
  const [imageFailed, setImageFailed] = useState(false);
  const hasImage = !!card.frontImageUrl && !imageFailed;

  return (
    <Link
      href={`/studio/card/${card.id}`}
      className="group block bg-white rounded-2xl border border-stone-200 overflow-hidden hover:border-brand hover:shadow-lg transition-all"
      data-testid={`card-tile-${card.id}`}
    >
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
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-stone-400">
            <ImageOff className="w-8 h-8 mb-1" />
            <p className="text-xs">No preview</p>
          </div>
        )}
        <div className="absolute top-2 right-2">
          <StatusBadge status={card.status} />
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-stone-900 truncate">{title}</p>
      </div>
    </Link>
  );
}
