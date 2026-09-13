// client/src/components/catalogue/carousel-toggle.tsx — "ON THE CAROUSEL"
//
// Admin-only. A star on a rack tile / card page that adds the template
// to (or removes it from) the doorway's drifting wall — the 'carousel'
// aisle tag (Aidan 2026-09-03: "a way to click to add these to the
// carousel list"). Nobody else sees it; the endpoint is admin-gated
// server-side regardless, so visibility is convenience, not security.

import { useState, type MouseEvent } from 'react';
import { Star } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface CarouselToggleProps {
  templateId: number;
  tags: string[];
  /** 'tile' = small overlay star; 'button' = labelled pill. */
  variant?: 'tile' | 'button';
  onChange?: (tags: string[]) => void;
}

export function CarouselToggle({ templateId, tags, variant = 'tile', onChange }: CarouselToggleProps) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<string[] | null>(null);
  const current = local ?? tags;
  const on = current.includes('carousel');
  if (!user || !(user as { isAdmin?: boolean }).isAdmin) return null;

  const toggle = async (e: MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (busy) return;
    const next = on ? current.filter((t) => t !== 'carousel') : [...current, 'carousel'];
    setBusy(true); setLocal(next);
    try {
      const r = await fetch(`/api/admin/card-templates/${templateId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aisle_tags: next }) });
      if (!r.ok) throw new Error(String(r.status));
      onChange?.(next);
    } catch {
      setLocal(current);
    } finally { setBusy(false); }
  };

  if (variant === 'button') {
    return (
      <button type="button" onClick={toggle} disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${on ? 'border-keeper-gold bg-keeper-gold-wash text-keeper-gold-deep' : 'border-keeper-hair bg-white/80 text-keeper-body hover:border-keeper-gold'}`}
        title="Admin: show this card on the doorway carousel">
        <Star className="h-3.5 w-3.5" fill={on ? 'currentColor' : 'none'} /> {on ? 'On the carousel' : 'Add to carousel'}
      </button>
    );
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} aria-label={on ? 'Remove from carousel' : 'Add to carousel'}
      title={on ? 'On the carousel — click to remove' : 'Add to the doorway carousel'}
      className={`absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition-colors ${on ? 'border-keeper-gold bg-keeper-gold text-white' : 'border-keeper-hair bg-white/90 text-keeper-meta hover:border-keeper-gold hover:text-keeper-gold'}`}>
      <Star className="h-4 w-4" fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}
