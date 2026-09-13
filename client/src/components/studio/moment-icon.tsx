// Occasion → icon, in the app's lucide stroke style (Kevin 2026-08-01:
// no gradient tiles, no emoji — one icon language across the board).
import {
  Cake,
  Heart,
  TreePine,
  Flower2,
  Gift,
  CalendarHeart,
  type LucideIcon,
} from 'lucide-react';

export function occasionIcon(occasion: string): LucideIcon {
  const o = occasion.toLowerCase();
  if (o.includes('birthday')) return Cake;
  if (o.includes('anniversary') || o.includes('valentine')) return Heart;
  if (o.includes('christmas')) return TreePine;
  if (o.includes('mother')) return Flower2;
  if (o.includes('father')) return Gift;
  return CalendarHeart;
}

/** Soft circular icon tile — the one way a moment is pictured. */
export function MomentIcon({
  occasion,
  size = 'md',
}: {
  occasion: string;
  size?: 'md' | 'lg';
}) {
  const Icon = occasionIcon(occasion);
  const box = size === 'lg' ? 'h-16 w-16' : 'h-11 w-11';
  const glyph = size === 'lg' ? 'h-7 w-7' : 'h-5 w-5';
  return (
    <div
      className={`flex ${box} shrink-0 items-center justify-center rounded-full bg-brand-muted`}
    >
      <Icon className={`${glyph} text-brand`} strokeWidth={1.75} />
    </div>
  );
}
