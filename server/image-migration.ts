import { storage } from "./storage";
import { storeImageFromBase64 } from "./image-storage";

/**
 * Migrate existing base64 images to file storage
 * This will be run once to convert existing cards
 */
export async function migrateExistingImagesToFiles(): Promise<void> {
  console.log('[MIGRATION] Starting migration of base64 images to file storage...');
  
  try {
    // Get all cards that have base64 images but no file paths
    const cards = await getAllCardsForMigration();
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const card of cards) {
      try {
        console.log(`[MIGRATION] Processing card ${card.id}...`);
        
        const updates: any = {};
        
        // Migrate front image if it's base64
        if (card.frontImageUrl && card.frontImageUrl.startsWith('data:image/') && !card.frontImagePath) {
          try {
            const frontImage = await storeImageFromBase64(card.frontImageUrl, card.id, 'front');
            updates.frontImagePath = frontImage.filename;
            updates.frontImageUrl = `/images/${frontImage.filename}`; // Update to file URL
            console.log(`[MIGRATION] Migrated front image for card ${card.id}`);
          } catch (error) {
            console.error(`[MIGRATION] Failed to migrate front image for card ${card.id}:`, error);
          }
        }
        
        // Migrate inside image if it's base64
        if (card.insideImageUrl && card.insideImageUrl.startsWith('data:image/') && !card.insideImagePath) {
          try {
            const insideImage = await storeImageFromBase64(card.insideImageUrl, card.id, 'inside');
            updates.insideImagePath = insideImage.filename;
            updates.insideImageUrl = `/images/${insideImage.filename}`; // Update to file URL
            console.log(`[MIGRATION] Migrated inside image for card ${card.id}`);
          } catch (error) {
            console.error(`[MIGRATION] Failed to migrate inside image for card ${card.id}:`, error);
          }
        }
        
        // Update card record if we have changes
        if (Object.keys(updates).length > 0) {
          await storage.updateCard(card.id, updates);
          migratedCount++;
          console.log(`[MIGRATION] Updated card ${card.id} with file paths`);
        }
        
      } catch (error) {
        console.error(`[MIGRATION] Error processing card ${card.id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`[MIGRATION] Migration completed. Migrated: ${migratedCount}, Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('[MIGRATION] Migration failed:', error);
    throw error;
  }
}

/**
 * Get all cards that need migration (have base64 images but no file paths)
 */
async function getAllCardsForMigration(): Promise<any[]> {
  // This is a simplified version - in production you'd query the database directly
  // For now, we'll return an empty array since we don't have direct database access
  // The migration will be triggered manually when needed
  
  console.log('[MIGRATION] Getting cards for migration...');
  return [];
}

/**
 * Check if a card needs migration
 */
export function cardNeedsMigration(card: any): boolean {
  const frontNeedsMigration = card.frontImageUrl && 
    card.frontImageUrl.startsWith('data:image/') && 
    !card.frontImagePath;
    
  const insideNeedsMigration = card.insideImageUrl && 
    card.insideImageUrl.startsWith('data:image/') && 
    !card.insideImagePath;
    
  return frontNeedsMigration || insideNeedsMigration;
}

/**
 * Migrate a single card's images during runtime
 */
export async function migrateCardImages(card: any): Promise<any> {
  if (!cardNeedsMigration(card)) {
    return card;
  }
  
  console.log(`[MIGRATION] Runtime migration for card ${card.id}`);
  
  const updates: any = {};
  
  // Migrate front image
  if (card.frontImageUrl && card.frontImageUrl.startsWith('data:image/') && !card.frontImagePath) {
    try {
      const frontImage = await storeImageFromBase64(card.frontImageUrl, card.id, 'front');
      updates.frontImagePath = frontImage.filename;
      updates.frontImageUrl = `/images/${frontImage.filename}`;
    } catch (error) {
      console.error(`Failed to migrate front image for card ${card.id}:`, error);
    }
  }
  
  // Migrate inside image
  if (card.insideImageUrl && card.insideImageUrl.startsWith('data:image/') && !card.insideImagePath) {
    try {
      const insideImage = await storeImageFromBase64(card.insideImageUrl, card.id, 'inside');
      updates.insideImagePath = insideImage.filename;
      updates.insideImageUrl = `/images/${insideImage.filename}`;
    } catch (error) {
      console.error(`Failed to migrate inside image for card ${card.id}:`, error);
    }
  }
  
  // Update database if we have changes
  if (Object.keys(updates).length > 0) {
    const updatedCard = await storage.updateCard(card.id, updates);
    console.log(`[MIGRATION] Card ${card.id} migrated to file storage`);
    return updatedCard;
  }
  
  return card;
}