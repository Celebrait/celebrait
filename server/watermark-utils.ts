import { createCanvas, loadImage } from "canvas";

export async function applyWatermark(imageData: string, opacity: number = 0.65): Promise<string> {
  try {
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const originalImage = await loadImage(imageBuffer);

    const canvas = createCanvas(originalImage.width, originalImage.height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(originalImage, 0, 0);

    ctx.save();

    const text = 'CELEBRAIT PREVIEW';
    const fontSize = Math.min(originalImage.width, originalImage.height) * 0.08;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = `rgba(255, 255, 255, 0.3)`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.translate(originalImage.width / 2, originalImage.height / 2);
    ctx.rotate(-Math.PI / 8);

    const textWidth = ctx.measureText(text).width;
    const textHeight = fontSize;

    const spacingX = textWidth * 1.5;
    const spacingY = textHeight * 3;
    const numCols = Math.ceil((originalImage.width * 1.5) / spacingX);
    const numRows = Math.ceil((originalImage.height * 1.5) / spacingY);

    const startX = -(numCols * spacingX) / 2;
    const startY = -(numRows * spacingY) / 2;

    for (let col = 0; col < numCols; col++) {
      for (let row = 0; row < numRows; row++) {
        ctx.fillText(text, startX + col * spacingX, startY + row * spacingY);
      }
    }

    ctx.restore();

    const watermarkedBuffer = canvas.toBuffer('image/png');
    return `data:image/png;base64,${watermarkedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Watermark application failed:', error);
    return imageData;
  }
}
