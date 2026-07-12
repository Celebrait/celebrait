// client/src/components/studio/status-badge.tsx
//
// One-place mapping from card DB status strings to customer-facing labels.
// The DB still holds legacy values ('generating', 'completed', 'paid',
// 'failed') — we'll consolidate when the old flow is retired. For now this
// keeps customer-facing language consistent across the Studio.

import { Loader2 } from 'lucide-react';

type StatusVariant = {
  label: string;
  className: string;
  animated?: boolean;
};

const STATUS_MAP: Record<string, StatusVariant> = {
  draft: {
    label: 'Draft',
    className: 'bg-stone-100 text-stone-700 border-keeper-hair',
  },
  generating: {
    label: 'Generating',
    className: 'bg-keeper-gold-wash text-keeper-gold-deep border-keeper-gold/25',
    animated: true,
  },
  // Front-first generation lifecycle — all read as "Generating" to the
  // user (front done but inside still pending is still in-progress),
  // except a failed inside which is a real failure to retry.
  'generating-front': {
    label: 'Generating',
    className: 'bg-keeper-gold-wash text-keeper-gold-deep border-keeper-gold/25',
    animated: true,
  },
  'front-ready': {
    label: 'Generating',
    className: 'bg-keeper-gold-wash text-keeper-gold-deep border-keeper-gold/25',
    animated: true,
  },
  'generating-inside': {
    label: 'Generating',
    className: 'bg-keeper-gold-wash text-keeper-gold-deep border-keeper-gold/25',
    animated: true,
  },
  'inside-ready': {
    label: 'Generating',
    className: 'bg-keeper-gold-wash text-keeper-gold-deep border-keeper-gold/25',
    animated: true,
  },
  'inside-failed': {
    label: 'Failed',
    className: 'bg-accent-red-light text-accent-red-dark border-accent-red/30',
  },
  completed: {
    label: 'Ready',
    className: 'bg-cta-light text-cta-dark border-cta/30',
  },
  ready: {
    label: 'Ready',
    className: 'bg-cta-light text-cta-dark border-cta/30',
  },
  paid: {
    label: 'Purchased',
    className: 'bg-brand-muted text-brand-dark border-brand-light',
  },
  purchased: {
    label: 'Purchased',
    className: 'bg-brand-muted text-brand-dark border-brand-light',
  },
  failed: {
    label: 'Failed',
    className: 'bg-accent-red-light text-accent-red-dark border-accent-red/30',
  },
  // Shown when a card's status suggests it's completed but the image
  // isn't viewable (legacy data from before the Studio). Softer than
  // "Ready" so it's obviously a different state the user can't act on.
  archived: {
    label: 'Archived',
    className: 'bg-stone-50 text-stone-500 border-keeper-hair',
  },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? '').toLowerCase();
  const variant = STATUS_MAP[key] ?? {
    label: status ?? 'Unknown',
    className: 'bg-stone-100 text-stone-700 border-keeper-hair',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${variant.className}`}
    >
      {variant.animated && <Loader2 className="w-3 h-3 animate-spin" />}
      {variant.label}
    </span>
  );
}
