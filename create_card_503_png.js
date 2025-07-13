import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

// Create PNG file for card 503 from Base64 data in conversationData
const cardId = 503;

// Get the base64 data from the database
const response = await fetch(`http://localhost:5000/api/cards/${cardId}`);
const cardData = await response.json();

console.log('Card data received:', {
  id: cardData.id,
  hasConversationData: !!cardData.conversationData,
  hasPhotoUpload: !!cardData.conversationData?.photo_upload
});

if (cardData.conversationData?.photo_upload) {
  const base64Data = cardData.conversationData.photo_upload;
  console.log('Base64 data length:', base64Data.length);
  
  // Remove data URL prefix
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  const imageBuffer = Buffer.from(cleanBase64, 'base64');
  
  // Convert to PNG format
  const pngBuffer = await sharp(imageBuffer)
    .png({ 
      compressionLevel: 6,
      quality: 100,
      progressive: false
    })
    .toBuffer();
  
  // Store front image
  const frontFilename = `card_${cardId}_front.png`;
  const frontFilepath = path.join(process.cwd(), 'stored_images', frontFilename);
  fs.writeFileSync(frontFilepath, pngBuffer);
  
  // Store inside image (use same image for both)
  const insideFilename = `card_${cardId}_inside.png`;
  const insideFilepath = path.join(process.cwd(), 'stored_images', insideFilename);
  fs.writeFileSync(insideFilepath, pngBuffer);
  
  console.log(`Created PNG files for card ${cardId}:`);
  console.log(`Front: ${frontFilename} (${fs.statSync(frontFilepath).size} bytes)`);
  console.log(`Inside: ${insideFilename} (${fs.statSync(insideFilepath).size} bytes)`);
} else {
  console.log('No base64 data found in conversationData');
}
