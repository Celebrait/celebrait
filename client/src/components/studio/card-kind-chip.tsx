// client/src/components/studio/card-kind-chip.tsx
//
// Small meta chip naming which kind a card is, from `cards.source`.
// Two products share the studio (photo maker vs the three-card route)
// and, until this chip, their tiles were indistinguishable (launch
// audit 2026-10-06). Quiet by design — a label, not a status.

import { Camera, MessageSquareText, Store } from 'lucide-react';

export function cardKindLabel(source: string | null | undefined): string | null {
  switch (source) {
    case 'photo':
      return 'From a photo';
    case 'maker':
      return 'Made from your answers';
    case 'rack':
      return 'Off the shelf';
    default:
      return null;
  }
}

const ICONS = { photo: Camera, maker: MessageSquareText, rack: Store } as const;

export function CardKindChip({
  source,
  className = '',
}: {
  source: string | null | undefined;
  className?: string;
}) {
  const label = cardKindLabel(source);
  if (!label) return null;
  const Icon = ICONS[source as keyof typeof ICONS];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-brand-light bg-brand-muted px-2 py-0.5 text-[10px] font-medium leading-none text-brand-dark ${className}`}
      data-testid={`chip-card-kind-${source}`}
    >
      {Icon && <Icon className="h-3 w-3" strokeWidth={1.75} aria-hidden />}
      {label}
    </span>
  );
}
