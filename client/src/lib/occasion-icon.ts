// client/src/lib/occasion-icon.ts
//
// Single source of truth for "give me a lucide icon for this occasion".
// Used by the dashboard (draft rows + card thumbnails) and anywhere
// else that needs to represent a card visually when the rendered
// image is missing or not yet generated.
//
// The mapping itself originally lived in recipient-step.tsx (where
// each occasion tile has its icon). It's been lifted here so we can
// reuse without importing the whole step file into dashboard pages.

import {
  Cake,
  HeartHandshake,
  Gem,
  GraduationCap,
  Baby,
  TreePine,
  Heart,
  Flower2,
  Leaf,
  PenLine,
  Diamond,
  type LucideIcon,
} from 'lucide-react';

export const OCCASION_ICON: Record<string, LucideIcon> = {
  birthday: Cake,
  anniversary: HeartHandshake,
  wedding: Gem,
  graduation: GraduationCap,
  engagement: Diamond,
  baby: Baby,
  christmas: TreePine,
  valentines: Heart,
  thankyou: Flower2,
  sympathy: Leaf,
  other: PenLine,
};

/** Lookup by occasion key. Falls back to the generic PenLine icon for
 *  unknown / missing / legacy-shaped occasion strings so the caller
 *  always has something to render. */
export function getOccasionIcon(occasion: string | null | undefined): LucideIcon {
  if (!occasion) return PenLine;
  const key = occasion.trim().toLowerCase();
  return OCCASION_ICON[key] ?? PenLine;
}
