import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Create a proper 1x1 transparent PNG for testing
async function createValidTestPNG() {
  const buffer = await sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
  .png()
  .toBuffer();
  
  return buffer;
}

// Replace the corrupted PNG files with valid ones
async function fixCard497() {
  const imagesDir = path.join(process.cwd(), 'stored_images');
  const validPngBuffer = await createValidTestPNG();
  
  // Replace corrupted files
  fs.writeFileSync(path.join(imagesDir, 'card_497_front.png'), validPngBuffer);
  fs.writeFileSync(path.join(imagesDir, 'card_497_inside.png'), validPngBuffer);
  
  console.log('Created valid PNG files for card 497');
  console.log(`Front image size: ${validPngBuffer.length} bytes`);
  console.log(`Inside image size: ${validPngBuffer.length} bytes`);
}

await fixCard497();