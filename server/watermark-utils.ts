// Watermarking removed — digital cards are free to download
// This module is kept for compatibility but applyWatermark is now a passthrough
export async function applyWatermark(imageData: string, opacity?: number): Promise<string> {
  return imageData;
}
