// server/providers/size.ts
//
// Maps the canonical "WxH" size string used throughout the app to each
// provider's native size/aspect-ratio enum. Kept in one place so adding
// a new size (or a new provider) is a single-file change.
//
// We support three canonical sizes, chosen because they map cleanly to
// all three providers and cover the realistic print ratios for cards
// and invitations:
//   - "1024x1024" — square (the locked production choice for greeting cards)
//   - "1024x1536" — portrait 2:3 (tall — "classic greeting card")
//   - "1536x1024" — landscape 3:2 (wide — invitation, stationery)

export type CanonicalSize = '1024x1024' | '1024x1536' | '1536x1024';

export function isKnownSize(s: string): s is CanonicalSize {
  return s === '1024x1024' || s === '1024x1536' || s === '1536x1024';
}

export function aspectLabel(size: string): string {
  switch (size) {
    case '1024x1024':
      return 'square 1:1';
    case '1024x1536':
      return 'portrait 2:3';
    case '1536x1024':
      return 'landscape 3:2';
    default:
      return size;
  }
}

// Gemini's Imagen/nano-banana models take an aspect ratio string.
// Map our canonical sizes onto supported ratios.
export function geminiAspect(size: string): '1:1' | '2:3' | '3:2' {
  if (size === '1024x1536') return '2:3';
  if (size === '1536x1024') return '3:2';
  return '1:1';
}

// FLUX takes an `image_size` enum. We use the portrait/landscape variants
// that come closest to 2:3 / 3:2 — FLUX exposes 4:3 / 16:9 presets.
// 4:3 is the closest match for both, trading off a touch of the long
// edge for the correct orientation.
export function fluxImageSize(
  size: string,
): 'square_hd' | 'portrait_4_3' | 'landscape_4_3' {
  if (size === '1024x1536') return 'portrait_4_3';
  if (size === '1536x1024') return 'landscape_4_3';
  return 'square_hd';
}

// OpenAI gpt-image-1.5 natively takes our "WxH" strings, so this is a
// passthrough — but we validate against known sizes and fall back to
// square if something unexpected comes through.
export function openaiSize(size: string): CanonicalSize {
  return isKnownSize(size) ? size : '1024x1024';
}
