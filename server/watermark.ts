
import { createCanvas, loadImage, registerFont } from 'canvas';

export interface WatermarkOptions {
  text?: string;
  opacity?: number;
  fontSize?: number;
  color?: string;
  position?: 'center' | 'bottom-right' | 'diagonal';
}

export async function addWatermark(
  imageData: string, 
  options: WatermarkOptions = {}
): Promise<string> {
  const {
    text = 'CELEBRAIT PREVIEW',
    opacity = 0.3,
    fontSize = 48,
    color = '#FFFFFF',
    position = 'diagonal'
  } = options;

  try {
    // Load the original image
    const img = await loadImage(imageData);
    
    // Create canvas with same dimensions
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    
    // Draw original image
    ctx.drawImage(img, 0, 0);
    
    // Configure watermark text
    ctx.globalAlpha = opacity;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = color;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    
    if (position === 'diagonal') {
      // Add diagonal watermarks across the image
      const textWidth = ctx.measureText(text).width;
      const spacing = Math.max(textWidth * 1.5, 200);
      
      ctx.save();
      ctx.rotate(-Math.PI / 6); // -30 degrees
      
      for (let x = -img.width; x < img.width * 2; x += spacing) {
        for (let y = -img.height; y < img.height * 2; y += spacing) {
          ctx.strokeText(text, x, y);
          ctx.fillText(text, x, y);
        }
      }
      
      ctx.restore();
    } else if (position === 'center') {
      const textWidth = ctx.measureText(text).width;
      const x = (img.width - textWidth) / 2;
      const y = img.height / 2;
      
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    } else if (position === 'bottom-right') {
      const textWidth = ctx.measureText(text).width;
      const x = img.width - textWidth - 20;
      const y = img.height - 20;
      
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    }
    
    // Convert back to base64
    return canvas.toDataURL('image/png');
  } catch (error) {
    console.error('Watermark error:', error);
    // Return original image if watermarking fails
    return imageData;
  }
}

export async function addWatermarkToMultipleImages(
  images: { frontImageUrl?: string; insideImageUrl?: string },
  options?: WatermarkOptions
): Promise<{ frontImageUrl?: string; insideImageUrl?: string }> {
  const result: { frontImageUrl?: string; insideImageUrl?: string } = {};
  
  if (images.frontImageUrl) {
    result.frontImageUrl = await addWatermark(images.frontImageUrl, options);
  }
  
  if (images.insideImageUrl) {
    result.insideImageUrl = await addWatermark(images.insideImageUrl, options);
  }
  
  return result;
}
