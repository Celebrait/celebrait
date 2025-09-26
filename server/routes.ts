import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { Readable } from "stream";
import { spawn } from "child_process";
import fs, { promises as fsPromises } from "fs";
import path from "path";
import { storage } from "./storage";
import { insertUserSchema, insertCardSchema, insertLovedOneSchema, insertOrderSchema } from "@shared/schema";
// Typography library removed - AI handles text integration directly

import OpenAI from "openai";
import Stripe from "stripe";
import Replicate from "replicate";
import FormData from "form-data";
import { fal } from "@fal-ai/client";
import { createCanvas, loadImage } from "canvas";
import sharp from "sharp";
import { sendEmail, addToMarketingList, sendBackgroundEmail, generateCardReadyNotificationEmail } from './email-service';
import { generateOrderConfirmationEmail, generateDigitalCardEmail, generateDigitalCardEmailForRecipient, generateAbandonmentRecoveryEmail, generateShippingNotificationEmail } from './missing-email-functions';
import { 
  storeImageFromBase64, 
  getStoredImage, 
  generateCardPDF, 
  getImageUrl, 
  imageExists,
  cleanupOldImages,
  scheduleAutomaticCleanup,
  getStorageStats,
  storeUnwatermarkedImage,
  getUnwatermarkedImageUrl,
  type CleanupConfig
} from "./image-storage";
import { generateSeparatePDFs, generatePrintSpecs, getPDFDownloadUrls } from "./pdf-generator";
import { migrateCardImages, cardNeedsMigration } from "./image-migration";
import { removeWatermarksFromCard } from "./watermark-removal";
import { setupGoogleAuth } from "./google-auth";
import { payfastService } from "./payfast-service";
import session from "express-session";
import passport from "passport";

// Temporarily allow running without API keys for testing
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasReplicate = !!process.env.REPLICATE_API_TOKEN;
const hasStripe = !!process.env.STRIPE_SECRET_KEY;
const hasPaystack = !!process.env.PAYSTACK_SECRET_KEY;

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = hasOpenAI ? new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
}) : null;

const replicate = hasReplicate ? new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
}) : null;

const stripe = hasStripe ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
}) : null;

// Performance cache for card images
const imageCache = new Map<string, {
  data: Buffer;
  timestamp: number;
  etag: string;
}>();

// Performance cache for card metadata
const cardMetadataCache = new Map<string, {
  data: any;
  timestamp: number;
}>();

// Performance cache for complete card data (for email links)
const emailLinkCache = new Map<string, {
  card: any;
  frontImage: Buffer;
  insideImage: Buffer | null;
  timestamp: number;
}>();

// Processing queue to prevent concurrent Sharp operations that may cause resource contention
const pngProcessingQueue = new Map<number, Promise<any>>();

/**
 * CRITICAL: Convert Base64 images to PNG files immediately upon generation
 * This prevents performance issues from large Base64 strings in the database
 */
async function convertBase64ToPngFile(base64Data: string, cardId: number, imageType: string): Promise<string> {
  try {
    // Check if there's already a PNG processing operation for this card
    const processingKey = cardId;
    if (pngProcessingQueue.has(processingKey)) {
      console.log(`[PNG_CONVERSION] Waiting for existing PNG processing for card ${cardId} to complete...`);
      await pngProcessingQueue.get(processingKey);
      console.log(`[PNG_CONVERSION] Previous PNG processing for card ${cardId} completed, continuing...`);
    }
    
    console.log(`[PNG_CONVERSION] Converting ${imageType} image for card ${cardId} from Base64 to PNG file`);
    
    // Remove data URL prefix if present
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    
    // Convert to PNG format using Sharp for optimal compression with resource management
    const startTime = Date.now();
    const pngBuffer = await sharp(imageBuffer)
      .png({ 
        compressionLevel: 6, // Balanced compression
        quality: 100,        // Lossless quality
        progressive: false   // Standard PNG
      })
      .toBuffer();
    
    const processingTime = Date.now() - startTime;
    console.log(`[PNG_CONVERSION] Sharp processing took ${processingTime}ms for ${imageType} image (${pngBuffer.length} bytes)`);
    
    // Store the PNG file directly using filesystem operations
    const fs = await import('fs');
    const path = await import('path');
    
    const filename = `card_${cardId}_${imageType}.png`;
    const filepath = path.join(process.cwd(), 'stored_images', filename);
    
    await fs.promises.writeFile(filepath, pngBuffer);
    
    console.log(`[PNG_CONVERSION] Successfully converted ${imageType} image for card ${cardId} to PNG file: ${filename} (${pngBuffer.length} bytes)`);
    
    // Return the file path/URL for database storage instead of Base64
    return `/images/${filename}`;
    
  } catch (error: any) {
    console.error(`[PNG_CONVERSION] Error converting ${imageType} image for card ${cardId}:`, error);
    throw new Error(`Failed to convert ${imageType} image to PNG file: ${error?.message || 'Unknown error'}`);
  } finally {
    // Clean up processing queue
    pngProcessingQueue.delete(cardId);
  }
}

const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const METADATA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes for metadata

// Clear expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean image cache
  const imageKeysToDelete: string[] = [];
  imageCache.forEach((value, key) => {
    if (now - value.timestamp > CACHE_TTL) {
      imageKeysToDelete.push(key);
    }
  });
  imageKeysToDelete.forEach(key => imageCache.delete(key));
  
  // Clean metadata cache
  const metadataKeysToDelete: string[] = [];
  cardMetadataCache.forEach((value, key) => {
    if (now - value.timestamp > METADATA_CACHE_TTL) {
      metadataKeysToDelete.push(key);
    }
  });
  metadataKeysToDelete.forEach(key => cardMetadataCache.delete(key));
}, 10 * 60 * 1000); // Clean every 10 minutes

// Watermark utility function (legacy - for base64 data)
async function applyWatermark(imageData: string, opacity: number = 0.65): Promise<string> {
  try {
    // Remove data URL prefix if present
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Load the original image
    const originalImage = await loadImage(imageBuffer);

    // Create canvas with same dimensions
    const canvas = createCanvas(originalImage.width, originalImage.height);
    const ctx = canvas.getContext('2d');

    // Draw original image
    ctx.drawImage(originalImage, 0, 0);

    // Apply watermark
    ctx.save();

    // Set up readable watermark text
    const text = 'CELEBRAIT PREVIEW';
    const fontSize = Math.min(originalImage.width, originalImage.height) * 0.08;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = `rgba(255, 255, 255, 0.3)`; // Reduced opacity white text for less prominence
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Rotate canvas for diagonal text
    ctx.translate(originalImage.width / 2, originalImage.height / 2);
    ctx.rotate(-Math.PI / 8); // Reduced angle for better readability

    // Calculate text dimensions
    const textWidth = ctx.measureText(text).width;
    const textHeight = fontSize;

    // Draw fewer, larger, more readable watermarks
    const spacingX = textWidth * 1.5;
    const spacingY = textHeight * 3;
    const numCols = Math.ceil((originalImage.width * 1.5) / spacingX);
    const numRows = Math.ceil((originalImage.height * 1.5) / spacingY);

    const startX = -(numCols * spacingX) / 2;
    const startY = -(numRows * spacingY) / 2;

    for (let col = 0; col < numCols; col++) {
      for (let row = 0; row < numRows; row++) {
        const x = startX + col * spacingX;
        const y = startY + row * spacingY;

        // Draw text with strong outline for maximum readability
        ctx.fillText(text, x, y);
      }
    }

    ctx.restore();

    // Convert back to base64
    const watermarkedBuffer = canvas.toBuffer('image/png');
    return `data:image/png;base64,${watermarkedBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Watermark application failed:', error);
    // Return original image if watermarking fails
    return imageData;
  }
}

// PNG-only watermark function - applies watermark to PNG files directly
async function applyWatermarkToPngFile(
  cardId: number, 
  sourceImageType: string, 
  targetImageType: string, 
  opacity: number = 0.65
): Promise<string> {
  try {
    const fs = await import('fs');
    const path = await import('path');
    
    // Read source PNG file
    const sourceFilename = `card_${cardId}_${sourceImageType}.png`;
    const sourceFilepath = path.join(process.cwd(), 'stored_images', sourceFilename);
    const imageBuffer = await fs.promises.readFile(sourceFilepath);
    
    console.log(`[PNG_WATERMARK] Reading source PNG: ${sourceFilename} (${imageBuffer.length} bytes)`);
    
    // Load the original image
    const originalImage = await loadImage(imageBuffer);

    // Create canvas with same dimensions
    const canvas = createCanvas(originalImage.width, originalImage.height);
    const ctx = canvas.getContext('2d');

    // Draw original image
    ctx.drawImage(originalImage, 0, 0);

    // Apply watermark
    ctx.save();

    // Set up readable watermark text
    const text = 'CELEBRAIT PREVIEW';
    const fontSize = Math.min(originalImage.width, originalImage.height) * 0.08;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.fillStyle = `rgba(255, 255, 255, 0.3)`; // Reduced opacity white text for less prominence
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Rotate canvas for diagonal text
    ctx.translate(originalImage.width / 2, originalImage.height / 2);
    ctx.rotate(-Math.PI / 8); // Reduced angle for better readability

    // Calculate text dimensions
    const textWidth = ctx.measureText(text).width;
    const textHeight = fontSize;

    // Draw fewer, larger, more readable watermarks
    const spacingX = textWidth * 1.5;
    const spacingY = textHeight * 3;
    const numCols = Math.ceil((originalImage.width * 1.5) / spacingX);
    const numRows = Math.ceil((originalImage.height * 1.5) / spacingY);

    const startX = -(numCols * spacingX) / 2;
    const startY = -(numRows * spacingY) / 2;

    for (let col = 0; col < numCols; col++) {
      for (let row = 0; row < numRows; row++) {
        const x = startX + col * spacingX;
        const y = startY + row * spacingY;

        // Draw text with strong outline for maximum readability
        ctx.fillText(text, x, y);
      }
    }

    ctx.restore();

    // Save watermarked PNG file
    const watermarkedBuffer = canvas.toBuffer('image/png');
    const targetFilename = `card_${cardId}_${targetImageType}.png`;
    const targetFilepath = path.join(process.cwd(), 'stored_images', targetFilename);
    
    await fs.promises.writeFile(targetFilepath, watermarkedBuffer);
    
    console.log(`[PNG_WATERMARK] Created watermarked PNG: ${targetFilename} (${watermarkedBuffer.length} bytes)`);
    
    return `/images/${targetFilename}`;
  } catch (error) {
    console.error(`[PNG_WATERMARK] Failed to apply watermark to PNG file for card ${cardId}:`, error);
    throw error;
  }
}

// Compress image for digital sharing (optimized size and quality)
async function compressImageForDigital(imageBuffer: Buffer): Promise<Buffer> {
  try {
    // Optimized compression: smaller size for faster loading
    const compressedBuffer = await sharp(imageBuffer)
      .resize(600, 600, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ 
        quality: 82,
        progressive: true,
        mozjpeg: true, // Use mozjpeg encoder for better compression
        optimiseScans: true // Optimize progressive scans for faster loading
      })
      .toBuffer();
    
    console.log(`[COMPRESSION] Compressed image from ${imageBuffer.length} to ${compressedBuffer.length} bytes (${Math.round(compressedBuffer.length / imageBuffer.length * 100)}% of original)`);
    return compressedBuffer;
  } catch (error) {
    console.error('[COMPRESSION] Error compressing image:', error);
    // Return original buffer if compression fails
    return imageBuffer;
  }
}

// Helper function to process Replicate flux binary output

async function processFluxBinaryOutput(output: any): Promise<string> {
  console.log('processFluxBinaryOutput called with output type:', typeof output);
  const binaryChunks: Uint8Array[] = [];

  // Collect all binary chunks from the async output
  for await (const chunk of output) {
    console.log('Processing chunk:', typeof chunk, chunk instanceof Uint8Array ? `Uint8Array(${chunk.length})` : chunk);
    if (chunk instanceof Uint8Array) {
      binaryChunks.push(chunk);
      console.log('Collected binary chunk:', chunk.length, 'bytes');
    }
  }

  console.log('Total binary chunks collected:', binaryChunks.length);

  if (binaryChunks.length === 0) {
    throw new Error('No binary chunks received from flux model');
  }

  // Concatenate all binary chunks into a single image
  const totalLength = binaryChunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const fullImage = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of binaryChunks) {
    fullImage.set(chunk, offset);
    offset += chunk.length;
  }

  console.log('Assembled complete image:', fullImage.length, 'bytes');

  // Convert to base64 data URL
  const base64 = Buffer.from(fullImage).toString('base64');

  // Detect image format from header bytes
  let mimeType = 'image/jpeg'; // default
  if (fullImage[0] === 0x89 && fullImage[1] === 0x50 && fullImage[2] === 0x4E && fullImage[3] === 0x47) {
    mimeType = 'image/png';
  } else if (fullImage[0] === 0xFF && fullImage[1] === 0xD8) {
    mimeType = 'image/jpeg';
  }

  const dataUrl = `data:${mimeType};base64,${base64}`;
  console.log('Generated data URL with mime type:', mimeType, 'length:', dataUrl.length);

  return dataUrl;
}

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Serve stored images statically
  app.use('/images', (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year cache
    next();
  }, (req, res) => {
    const imagePath = path.join(process.cwd(), 'stored_images', req.path);
    res.sendFile(imagePath, (err) => {
      if (err) {
        res.status(404).send('Image not found');
      }
    });
  });

  // Start automatic image cleanup scheduler (runs daily)
  const cleanupConfig: CleanupConfig = {
    retentionDays: 90,        // Keep images for 90 days
    preservePaidCards: true,  // Never delete paid card images
    preserveRecentOrders: true,
    dryRun: false
  };
  
  scheduleAutomaticCleanup(cleanupConfig);
  console.log(`[CLEANUP] Automatic cleanup scheduled: ${cleanupConfig.retentionDays} day retention, preserve paid cards: ${cleanupConfig.preservePaidCards}`);

  // Storage management endpoints
  
  // Get storage statistics
  app.get("/api/admin/storage/stats", async (req, res) => {
    try {
      const stats = await getStorageStats();
      res.json({
        ...stats,
        totalSizeMB: (stats.totalSize / 1024 / 1024).toFixed(2),
        avgFileSizeMB: (stats.avgFileSize / 1024 / 1024).toFixed(2)
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error getting storage stats: " + error.message });
    }
  });
  
  // Manual cleanup trigger
  app.post("/api/admin/storage/cleanup", async (req, res) => {
    try {
      const config: CleanupConfig = {
        retentionDays: req.body.retentionDays || 90,
        preservePaidCards: req.body.preservePaidCards !== false,
        preserveRecentOrders: req.body.preserveRecentOrders !== false,
        dryRun: req.body.dryRun === true
      };
      
      console.log(`[CLEANUP] Manual cleanup triggered:`, config);
      const results = await cleanupOldImages(config);
      
      res.json({
        success: true,
        results,
        config,
        message: `${config.dryRun ? 'Simulation: Would delete' : 'Deleted'} ${results.deleted} files, freed ${(results.size / 1024 / 1024).toFixed(2)}MB`
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error running cleanup: " + error.message });
    }
  });

  // AI Brainstorming Assistant endpoint
  app.post("/api/ai-brainstorm", async (req, res) => {
    try {
      if (!hasOpenAI || !openai) {
        return res.status(503).json({ message: "OpenAI API is not configured" });
      }

      const { type, context, userInput, recipientName, celebration, conversationHistory, conversationStep, photoContext, userName, collectedInfo } = req.body;

      let systemPrompt = "";
      let messages: any[] = [];

      if (type === "scene") {
        // Use naturally inclusive language that works for both single and multiple people
        // Focus on scene elements (location, activity, clothing) rather than specific people
        
        systemPrompt = `You are a professional creative assistant helping someone create detailed scene descriptions for greeting cards for ${recipientName}'s ${celebration}. 

CRITICAL RULES:
1. NEVER address the user by name in your responses - use neutral language like "you" or avoid direct address
2. Use naturally inclusive language that works for both single and multiple people - focus on scene elements (location, activities, clothing, mood) rather than counting people
3. Ask about general scene elements: "What kind of activities would work well in this scene?" instead of "What would [name] be doing?"
4. Use inclusive terms: "What style of clothing would fit this setting?" instead of referring to specific people
5. NEVER make assumptions about relationships - even for anniversaries, birthday parties, or couple celebrations, avoid words like "couple", "pair", "duo", "romantic partners"
6. Focus on activities and scenes that could work for any number of people: "people enjoying", "someone relaxing", "activities in this setting"
7. NEVER provide suggestions in opening statements or unless explicitly requested
8. Only provide exactly 3 numbered options when user inputs "Get Suggestions" or "Get More Suggestions"  
9. Follow-up questions must seek MORE SPECIFIC details about previous answers
10. Keep opening messages simple and ask only one clear question

CONVERSATION FLOW:
1. INITIAL SCENE - User provides initial scene description (text input required)
2. SCENE SPECIFICS - Ask for more details (Give Me Ideas/Skip buttons)
3. ACTIVITY - What activities would work well in this scene (Give Me Ideas/Skip buttons)
4. CLOTHING - Clothing and appearance style (Give Me Ideas/Skip buttons)
5. SUMMARY - Complete scene summary (Sounds great let's go/I'd like to make a change buttons)

STEP-SPECIFIC INSTRUCTIONS:

INITIAL SCENE STEP:
- Ask simple question about WHERE scene takes place (NEVER provide suggestions)
- User MUST provide text input, no buttons available

SCENE SPECIFICS STEP:
- Ask for MORE SPECIFIC location details based on their answer
- Provide "Give Me Ideas" and "Skip This Question" buttons
- Only show 3 suggestions when user clicks "Give Me Ideas" button

ACTIVITY STEP:
- Ask simple question about what activities would work well in this scene
- Provide "Give Me Ideas" and "Skip This Question" buttons
- Only show 3 suggestions when user clicks "Give Me Ideas" button

CLOTHING STEP:
- Ask simple question about clothing and appearance style for this scene
- Provide "Give Me Ideas" and "Skip This Question" buttons
- Only show 3 suggestions when user clicks "Give Me Ideas" button
- ALWAYS remind that they can skip to let AI choose appropriate clothing

SUMMARY STEP:
- Summarize complete scene description for this ${celebration} celebration
- Tell user they can add more details if they like
- End with: "When you're ready to proceed, click 'Sounds great, let's go!' to continue to choosing text for the front of the card."
- CRITICAL: Only show "Sounds great, let's go!" and "I'd like to make a change" buttons in this step

CHANGE REQUEST:
- Ask specifically what they want to change
- Help modify that element
- Present updated summary with same buttons

Current step: ${conversationStep || 'initial_scene'}`;
        

        // Build context message based on current step and user input
        let contextMessage = `I'm creating a ${celebration} greeting card for ${recipientName}. Current step: ${conversationStep || 'initial_scene'}. User input: "${userInput || ''}"`;
        
        // Add collected information context
        if (collectedInfo) {
          const context = [];
          if (collectedInfo.initialScene) context.push(`Initial Scene: ${collectedInfo.initialScene}`);
          if (collectedInfo.sceneSpecifics) context.push(`Scene Specifics: ${collectedInfo.sceneSpecifics}`);
          if (collectedInfo.activity) context.push(`Activity: ${collectedInfo.activity}`);
          if (collectedInfo.clothing) context.push(`Clothing: ${collectedInfo.clothing}`);
          
          if (context.length > 0) {
            contextMessage += ` Previously collected: ${context.join(', ')}`;
          }
        }

        messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: contextMessage }
        ];
        
        // Add step-specific instructions based on current state
        if (userInput === "Give Me Ideas") {
          messages.push({
            role: "system", 
            content: `The user is requesting suggestions for the ${conversationStep} step. Provide exactly 3 numbered options relevant to this step. Format as: 1. First option, 2. Second option, 3. Third option. Focus on scene elements (activities, clothing, mood, setting details) using naturally inclusive language that works for any number of people. CRITICAL: Never use words like "couple", "pair", "duo", or "romantic partners" - use inclusive terms like "people", "someone", or focus on activities rather than relationships.`
          });
        } else if (!conversationHistory || conversationHistory.length === 0) {
          // This is an opening message - add extra emphasis to NOT provide suggestions
          messages.push({
            role: "system",
            content: `This is an opening message. Use this EXACT text as your response: "Greetings! ✨ I'm here to help you create an amazing scene for the front of ${recipientName || 'NAME'}'s ${celebration || 'CELEBRATION'} card.\n\nFor this first question, I'll need you to type your own creative input, but throughout the rest of our conversation you can either type your ideas or ask me for suggestions anytime.\n\nTo get us started, where would you like the scene to take place?"`
          });
        }
        
        if (conversationStep === 'summary') {
          messages.push({
            role: "system", 
            content: `Generate a complete scene summary using all collected information. Present the final scene description in a professional manner. CRITICAL: Do NOT include any numbered suggestions, options, or lists in your response. This is a final summary, not a suggestion step. End with: "When you're ready to proceed, click 'Sounds great, let's go!' to continue to choosing text for the front of the card." IMPORTANT: You are in the SUMMARY step - this means the frontend will show "Sounds great, let's go!" and "I'd like to make a change" buttons.`
          });
        }
        
        if (conversationStep === 'change_request') {
          messages.push({
            role: "system", 
            content: `The user wants to make a change to the scene. Process their change request and provide a complete updated scene description. Format your response as: "Got it! Let's update the scene with that detail:\n\n[COMPLETE UPDATED SCENE DESCRIPTION]\n\nWhen you're ready to proceed, click 'Sounds great, let's go!' to continue to choosing text for the front of the card." Make sure the scene description is complete and includes all previous elements plus the new changes.`
          });
        }
      } else if (type === "art_style") {
        systemPrompt = `You are a professional creative assistant helping users choose art styles for personalized greeting cards. You should:

1. Start by understanding the celebration and the feeling they want to convey
2. Ask one specific question at a time about their preferences
3. Only suggest specific art styles after gathering context about their preferences
4. Explain why certain styles work well for their celebration
5. Guide them toward the ideal style choice step-by-step
6. Keep the conversation professional but engaging

CONVERSATION FLOW:
- First interaction: Ask about the mood/feeling they want the card to convey
- Build on their responses with specific style suggestions
- Help them visualize exactly how different styles would look
- End with a perfect art style description they can use
- DO NOT provide suggestions in your first response - let the user provide their initial input first

Remember: You're helping them discover their perfect artistic vision through guided questions.`;
        
        messages = [
          { role: "system", content: systemPrompt },
          { role: "user", content: `I'm creating a ${celebration} greeting card for ${recipientName}. I need help choosing an art style. ${userInput || "I need help with the art style selection."}` }
        ];
      }

      // Add conversation history if provided
      if (conversationHistory && conversationHistory.length > 0) {
        messages = [
          { role: "system", content: systemPrompt },
          ...conversationHistory
        ];
      }

      console.log('AI Brainstorm request:', { type, recipientName, celebration, userInput, hasHistory: !!conversationHistory, photoContext });

      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages,
        max_tokens: 400,
        temperature: 0.8 // Higher temperature for more creative suggestions
      });

      const aiResponse = response.choices[0].message.content;
      console.log('AI brainstorm response generated successfully');

      res.json({ 
        response: aiResponse,
        type,
        context: { recipientName, celebration, userInput }
      });

    } catch (error: any) {
      console.error('AI brainstorm error:', error);
      res.status(500).json({ message: "Failed to generate AI suggestions: " + error.message });
    }
  });

  // Art Style Suggestions endpoint

  app.post("/api/art-style-suggestions", async (req, res) => {
    if (!hasOpenAI || !openai) {
      return res.status(503).json({ error: "OpenAI API not configured" });
    }

    try {
      const { sceneDescription, celebration, recipientName, photoContext, userName, previousSuggestions } = req.body;
      
      console.log('Art Style Suggestions request:', { sceneDescription, celebration, recipientName, photoContext, userName });
      
      // Since we're using naturally inclusive language, we don't need to detect multiple people
      // All prompts now work for any number of people
      const peopleReference = recipientName;

      // Build list of previously suggested items to avoid duplicates
      const avoidList = previousSuggestions && previousSuggestions.length > 0 
        ? previousSuggestions.map((s: any) => s.name).join(', ')
        : '';

      const systemPrompt = `You are an expert visual theme consultant specializing in greeting card design. Your job is to provide exactly 2 options: one traditional art style and one visual style reference.

CRITICAL RULES:
1. This card is FOR ${recipientName} - use naturally inclusive language that works for any number of people
2. When discussing the scene, focus on scene elements rather than counting people
3. Provide exactly 2 suggestions: one "art_style" and one "visual_style_reference"
4. Keep descriptions brief and concise (1-2 sentences max)
5. Consider the emotional impact and how relatable each option is for users
6. AVOID REPETITION: ${avoidList ? `Do NOT suggest any of these previously provided themes: ${avoidList}` : 'Provide completely fresh suggestions'}

DUAL APPROACH:
- First suggestion: Traditional art style (watercolor, oil painting, digital art, cartoon style, realistic portrait, etc.) - category: "art_style"
- Second suggestion: Visual Style Reference using descriptive terms that capture recognizable aesthetics without copyright infringement - category: "visual_style_reference"

VISUAL STYLE REFERENCE EXAMPLES (NO COPYRIGHT NAMES):
- Animation styles: "3D computer animated adventure style", "hand-drawn animated fairy tale style", "superhero comic book illustration style"
- Time periods: "1920s art deco elegance", "1950s vintage diner aesthetic", "1980s neon synthwave", "Victorian steampunk"
- Art movements: "impressionist garden painting style", "cubist portrait style", "pop art comic book style", "starry night swirling sky style"
- Genre aesthetics: "space opera sci-fi style", "romantic comedy warm tones", "magical fantasy realm style", "cozy coffee shop atmosphere"
- Cultural aesthetics: "Japanese anime illustration style", "Scandinavian minimalist design", "bohemian cottage core aesthetic"
- Photography styles: "golden hour portrait photography", "black and white dramatic lighting", "vintage polaroid snapshot style"

IMPORTANT: Use descriptive terms that capture the visual essence without mentioning specific copyrighted properties. Focus on searchable aesthetic terms that consistently produce similar visual results when users research them.

Scene: "${sceneDescription}"
Celebration: ${celebration}
Recipient: ${recipientName}
${photoContext ? `Photo context: ${photoContext}` : ''}

You must respond with valid JSON in this exact format (no markdown code blocks, just plain JSON):
{
  "message": "I've analyzed your scene and prepared 2 perfect options: one traditional Art Style and one Visual Style Reference with searchable aesthetic terms.",
  "suggestions": [
    {
      "name": "Traditional Art Style Name",
      "description": "Brief 1-2 sentence description",
      "whyItWorks": "Concise reason why this suits this ${celebration} scene",
      "famousExample": "Brief recognizable reference",
      "mood": "One word mood",
      "category": "art_style"
    },
    {
      "name": "Visual Style Reference Name (e.g., 3D Computer Animated Adventure, Impressionist Garden Painting, 1920s Art Deco Elegance)",
      "description": "Brief 1-2 sentence description of the visual style aesthetic",
      "whyItWorks": "Concise reason why this suits this ${celebration} scene",
      "famousExample": "Descriptive aesthetic term that users can Google for consistent visual examples", 
      "mood": "One word mood",
      "category": "visual_style_reference"
    }
  ]
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Please analyze this scene and provide art style suggestions in the required JSON format." }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });

      const response = completion.choices[0].message.content;
      console.log('Art style suggestions response generated successfully');
      
      try {
        // Clean up the response by removing markdown code blocks if present
        let cleanResponse = response || '';
        if (response && response.includes('```json')) {
          cleanResponse = response.replace(/```json\s*/, '').replace(/```\s*$/, '');
        } else if (response && response.includes('```')) {
          cleanResponse = response.replace(/```\s*/, '').replace(/```\s*$/, '');
        }
        
        const parsedResponse = JSON.parse(cleanResponse);
        res.json(parsedResponse);
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.error('Raw response:', response);
        res.status(500).json({ error: "Failed to parse AI response" });
      }
    } catch (error) {
      console.error('Art style suggestions error:', error);
      res.status(500).json({ error: "Failed to generate style suggestions" });
    }
  });

  // Art Style Chat endpoint
  app.post("/api/art-style-chat", async (req, res) => {
    if (!hasOpenAI || !openai) {
      return res.status(503).json({ error: "OpenAI API not configured" });
    }

    try {
      const { 
        userMessage, 
        sceneDescription, 
        celebration, 
        recipientName, 
        photoContext, 
        userName, 
        isExpertMode, 
        conversationHistory 
      } = req.body;
      
      console.log('Art Style Chat request:', { userMessage, sceneDescription, celebration, recipientName, isExpertMode });
      
      const systemPrompt = `You are an expert visual theme consultant having a conversation with ${userName} about choosing the perfect visual theme for their ${celebration} card for ${recipientName}.

CRITICAL RULES:
1. This card is FOR ${recipientName} - use naturally inclusive language that works for scenes with any number of people
2. When discussing the scene, focus on scene elements (activities, clothing, mood, setting) rather than counting people
3. Focus on how visual themes will enhance the overall scene and celebration
4. Emphasize FAMOUS THEMES from well-known references that users can easily research and understand

Scene context: "${sceneDescription}"
${photoContext ? `Photo context: ${photoContext}` : ''}
Expert mode: ${isExpertMode ? 'User prefers direct input but may still want suggestions' : 'User prefers guided suggestions'}

VISUAL STYLE REFERENCE CATEGORIES TO CONSIDER:
- Animation styles: "3D computer animated adventure style", "hand-drawn animated fairy tale style", "superhero comic book illustration style"
- Art movements: "impressionist garden painting style", "cubist portrait style", "pop art comic book style", "starry night swirling sky style"
- Time periods: "1920s art deco elegance", "1950s vintage diner aesthetic", "1980s neon synthwave", "Victorian steampunk"
- Genre aesthetics: "space opera sci-fi style", "romantic comedy warm tones", "magical fantasy realm style", "cozy coffee shop atmosphere"
- Cultural aesthetics: "Japanese anime illustration style", "Scandinavian minimalist design", "bohemian cottage core aesthetic"
- Photography styles: "golden hour portrait photography", "black and white dramatic lighting", "vintage polaroid snapshot style"

Your role:
1. Be warm, helpful, and educational
2. Answer questions about visual style references with descriptive aesthetic terms
3. When users ask for specific themes (Disney, soccer, vintage, etc.), ALWAYS provide exactly 2 structured suggestions in JSON format
4. Provide suggestions when asked (focus on searchable aesthetic terms without copyright issues)
5. Help users understand why certain visual styles work better for this ${celebration} celebration
6. If user seems unsure, offer to provide structured suggestions

CRITICAL: Always provide EXACTLY 2 suggestions when the user asks for style ideas - one art_style and one visual_style_reference.

If providing suggestions, respond with valid JSON in this exact format (no markdown code blocks, just plain JSON):
{
  "message": "Your conversational response about the scene and celebration",
  "suggestions": [
    {
      "name": "Traditional Art Style Name",
      "description": "Clear description of the art technique",
      "whyItWorks": "Why it suits this ${celebration} scene",
      "famousExample": "Brief recognizable reference",
      "mood": "One word mood",
      "category": "art_style"
    },
    {
      "name": "Visual Style Reference Name (e.g., 3D Computer Animated Adventure, Impressionist Garden Painting)",
      "description": "Clear description of the visual style aesthetic",
      "whyItWorks": "Why it suits this ${celebration} scene",
      "famousExample": "Descriptive aesthetic term that users can Google for consistent visual examples",
      "mood": "One word mood",
      "category": "visual_style_reference"
    }
  ]
}

If just having a conversation (no suggestions), respond with valid JSON:
{
  "message": "Your conversational response about the scene and celebration"
}`;

      const messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.map((msg: any) => ({
          role: msg.role,
          content: msg.content
        })),
        { role: "user", content: userMessage },
        { role: "system", content: `Based on the user's message, if they are asking for specific themes, ideas, or suggestions (like Disney, soccer, vintage, modern, etc.), you MUST respond with the JSON format including exactly 2 suggestions. If they're just asking questions or having a conversation, respond with just the message field in JSON format.` }
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 1500,
        temperature: 0.7
      });

      const response = completion.choices[0].message.content;
      console.log('Art style chat response generated successfully');
      
      try {
        // Clean up the response by removing markdown code blocks if present
        let cleanResponse = response || '';
        if (response && response.includes('```json')) {
          cleanResponse = response.replace(/```json\s*/, '').replace(/```\s*$/, '');
        } else if (response && response.includes('```')) {
          cleanResponse = response.replace(/```\s*/, '').replace(/```\s*$/, '');
        }
        
        const parsedResponse = JSON.parse(cleanResponse);
        res.json(parsedResponse);
      } catch (parseError) {
        console.error('Failed to parse AI response as JSON:', parseError);
        console.error('Raw response:', response);
        // If not JSON, treat as plain text response
        res.json({ message: response || 'Unable to generate response' });
      }
    } catch (error) {
      console.error('Art style chat error:', error);
      res.status(500).json({ error: "Failed to generate chat response" });
    }
  });



  // User registration
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        // Return the existing user instead of error
        return res.json(existingUser);
      }

      const user = await storage.createUser(userData);

      // Create loved ones if provided
      if (req.body.lovedOnes && Array.isArray(req.body.lovedOnes)) {
        for (const lovedOneData of req.body.lovedOnes) {
          if (lovedOneData.name && lovedOneData.birthday) {
            await storage.createLovedOne({
              userId: user.id,
              name: lovedOneData.name,
              birthday: lovedOneData.birthday
            });
          }
        }
      }

      res.json(user);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Create prospect for marketing automation
  app.post("/api/prospects", async (req, res) => {
    try {
      const { email, firstName, lastName, signupSource, cardData } = req.body;

      console.log('Creating prospect for marketing automation:', email);

      // Validate required fields
      if (!email || !firstName) {
        return res.status(400).json({ message: "Email and first name are required" });
      }

      // Add to Brevo marketing list with card context
      const metadata = {
        recipientName: cardData?.recipientName || 'loved one',
        celebrationType: cardData?.celebrationType || 'celebration',
        signupSource: signupSource || 'signup_form'
      };

      const brevoContactId = await addToMarketingList(email, firstName, lastName, metadata);
      
      if (brevoContactId) {
        console.log('✅ Marketing automation: Prospect added to Brevo list:', brevoContactId);
        res.json({ 
          success: true, 
          message: "Successfully added to marketing list",
          brevoContactId 
        });
      } else {
        console.log('❌ Marketing automation: Failed to add to Brevo list');
        res.status(500).json({ 
          success: false, 
          message: "Failed to add to marketing list" 
        });
      }
    } catch (error: any) {
      console.error('Prospect creation error:', error);
      res.status(500).json({ message: "Error creating prospect: " + error.message });
    }
  });

  // Create card
  app.post("/api/cards", async (req, res) => {
    try {
      const { userId, ...cardData } = req.body;

      console.log('Card creation request body:', req.body);
      console.log('Extracted userId:', userId);
      console.log('Extracted cardData:', cardData);

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Ensure required fields have default values if missing
      const sanitizedCardData = {
        cardType: cardData.cardType || 'printed',
        printOption: cardData.printOption || 'front-only',
        sceneType: cardData.sceneType || 'with-person',
        conversationData: cardData.conversationData || {},
        price: cardData.price || 8900
      };

      console.log('Sanitized card data:', sanitizedCardData);

      // Validate the card data structure
      const validatedCardData = insertCardSchema.parse(sanitizedCardData);

      const card = await storage.createCard({
        ...validatedCardData,
        userId
      });

      res.json(card);
    } catch (error: any) {
      console.error('Card creation error:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // Ultra-fast cached metadata endpoint for email links
  app.get("/api/cards/:id/fast-metadata", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const cacheKey = `fast-metadata-${cardId}`;
      
      // ULTRA-AGGRESSIVE CACHING: Extended TTL for instant response
      const cached = cardMetadataCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < (METADATA_CACHE_TTL * 24)) {
        console.log(`[INSTANT] Fast metadata from extended cache for card ${cardId}`);
        res.set({
          'Cache-Control': 'public, max-age=86400, immutable',
          'ETag': `"fast-${cardId}-v2"`,
          'X-Cache': 'HIT'
        });
        return res.json(cached.data);
      }
      
      console.log(`[PERF] Cache miss - database query for fast metadata: ${cardId}`);
      const dbStartTime = Date.now();
      
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      console.log(`[PERF] Fast metadata database query took: ${Date.now() - dbStartTime}ms`);
      
      // Ultra-minimal metadata for instant loading
      const fastMetadata = {
        id: card.id,
        cardType: card.cardType,
        conversationData: card.conversationData || {}
      };
      
      // ULTRA-AGGRESSIVE CACHING: Extended memory cache and longer browser cache  
      cardMetadataCache.set(cacheKey, {
        data: fastMetadata,
        timestamp: Date.now()
      });
      
      // Also cache with alternative key patterns for broader cache hits
      cardMetadataCache.set(`card-${cardId}`, {
        data: card, // Full card data for complete-order page
        timestamp: Date.now()
      });
      
      // Maximum browser caching for instant subsequent loads
      res.set({
        'Cache-Control': 'public, max-age=86400, immutable', // 24-hour cache
        'ETag': `"fast-${cardId}-v3"`,
        'X-Cache': 'MISS',
        'X-Performance': `db-${Date.now() - dbStartTime}ms`
      });
      
      res.json(fastMetadata);
    } catch (error) {
      console.error("[PERF] Fast metadata error:", error);
      res.status(500).json({ message: "Error fetching fast metadata" });
    }
  });

  // Get card by ID (optimized endpoint with performance monitoring)
  app.get("/api/cards/:id", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      
      console.log(`[PERF] Fetching card ${cardId} metadata...`);
      const dbStartTime = Date.now();
      const card = await storage.getCard(cardId);
      const dbEndTime = Date.now();
      console.log(`[PERF] Card metadata query took: ${dbEndTime - dbStartTime}ms`);

      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // For performance, only send metadata and serve images as separate endpoints
      const optimizedCard = {
        id: card.id,
        userId: card.userId,
        cardType: card.cardType,
        printOption: card.printOption,
        sceneType: card.sceneType,
        status: card.status,
        price: card.price,
        frontImageUrl: card.frontImageUrl ? `/api/cards/${cardId}/front-image` : null,
        insideImageUrl: card.insideImageUrl ? `/api/cards/${cardId}/inside-image` : null,
        conversationData: card.conversationData || {}
      };
      
      // Add caching headers for faster subsequent loads
      res.set({
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'ETag': `"${cardId}-${card.status}"`
      });
      
      const endTime = Date.now();
      console.log(`[PERF] Total card metadata serving time: ${endTime - startTime}ms`);
      
      res.json(optimizedCard);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[PERF] Card metadata error after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error fetching card: " + error.message });
    }
  });

  // Get card front image (ULTRA-FAST with preloaded email cache)
  app.get("/api/cards/:id/front-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const cacheKey = `front-${cardId}`;
      const etag = `"${cardId}-front"`;
      
      // Check client cache first
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        console.log(`[CACHE] 304 Not Modified for front image ${cardId}`);
        return res.status(304).end();
      }
      
      // PRIORITY 1: Check preloaded email link cache for instant serving
      emailLinkCache.forEach((emailData, reference) => {
        if (emailData.card.id === cardId && emailData.frontImage && (Date.now() - emailData.timestamp) < 900000) {
          console.log(`[INSTANT] Serving front image ${cardId} from preloaded email cache (${emailData.frontImage.length} bytes) - ${Date.now() - startTime}ms`);
          res.set({
            'Content-Type': 'image/png',
            'Content-Length': emailData.frontImage.length.toString(),
            'Cache-Control': 'public, max-age=31536000',
            'ETag': etag,
            'X-Cache': 'HIT-PRELOADED'
          });
          res.send(emailData.frontImage);
          return;
        }
      });
      
      // If we already sent a response from the cache, return early
      if (res.headersSent) return;
      
      // PRIORITY 2: Check server cache
      const cached = imageCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log(`[CACHE] Serving front image ${cardId} from memory cache (${cached.data.length} bytes)`);
        res.set({
          'Content-Type': 'image/png',
          'Content-Length': cached.data.length.toString(),
          'Cache-Control': 'public, max-age=31536000',
          'ETag': etag,
          'X-Cache': 'HIT-MEMORY'
        });
        return res.send(cached.data);
      }
      
      console.log(`[PERF] Cache miss - fetching card ${cardId} for front image...`);
      const dbStartTime = Date.now();
      const card = await storage.getCard(cardId);
      const dbEndTime = Date.now();
      console.log(`[PERF] Database query took: ${dbEndTime - dbStartTime}ms`);

      if (!card || !card.frontImageUrl) {
        return res.status(404).json({ message: "Front image not found" });
      }

      // Handle PNG file URLs (new system) vs Base64 data (legacy)
      let imageBuffer: Buffer;
      const conversionStartTime = Date.now();
      
      if (card.frontImageUrl.startsWith('/images/')) {
        // NEW: PNG file URL - serve from stored PNG files
        console.log(`[PNG_SERVE] Serving front image from PNG file: ${card.frontImageUrl}`);
        
        try {
          const filename = path.basename(card.frontImageUrl);
          const filepath = path.join(process.cwd(), 'stored_images', filename);
          imageBuffer = await fsPromises.readFile(filepath);
          console.log(`[PNG_SERVE] Successfully loaded PNG file: ${filename} (${imageBuffer.length} bytes)`);
        } catch (error) {
          console.error(`[PNG_SERVE] Failed to load PNG file: ${card.frontImageUrl}`, error);
          return res.status(404).json({ message: "Front image file not found" });
        }
      } else {
        // LEGACY: Base64 data - convert to buffer
        console.log(`[BASE64_SERVE] Processing Base64 front image data (${card.frontImageUrl.length} chars)`);
        const base64Data = card.frontImageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      }
      
      // Use high-quality JPEG with optimal settings for fast loading
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 95, 
          progressive: true,
          mozjpeg: true,
          optimiseScans: true
        })
        .toBuffer();
      
      const conversionEndTime = Date.now();
      console.log(`[PERF] Base64 conversion and optimization took: ${conversionEndTime - conversionStartTime}ms`);
      
      // Cache the processed image
      imageCache.set(cacheKey, {
        data: optimizedBuffer,
        timestamp: Date.now(),
        etag
      });
      console.log(`[CACHE] Cached front image ${cardId} (${optimizedBuffer.length} bytes)`);
      
      // Set headers and send
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': optimizedBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000',
        'ETag': etag
      });
      
      const endTime = Date.now();
      console.log(`[PERF] Total front image serving time: ${endTime - startTime}ms`);
      
      res.send(optimizedBuffer);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[PERF] Front image error after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error serving front image: " + error.message });
    }
  });

  // Get card inside image (ULTRA-FAST with preloaded email cache)  
  app.get("/api/cards/:id/inside-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const cacheKey = `inside-${cardId}`;
      const etag = `"${cardId}-inside"`;
      
      // Check client cache first
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        console.log(`[CACHE] 304 Not Modified for inside image ${cardId}`);
        return res.status(304).end();
      }
      
      // PRIORITY 1: Check preloaded email link cache for instant serving
      emailLinkCache.forEach((emailData, reference) => {
        if (emailData.card.id === cardId && emailData.insideImage && (Date.now() - emailData.timestamp) < 900000) {
          console.log(`[INSTANT] Serving inside image ${cardId} from preloaded email cache (${emailData.insideImage.length} bytes) - ${Date.now() - startTime}ms`);
          res.set({
            'Content-Type': 'image/png',
            'Content-Length': emailData.insideImage.length.toString(),
            'Cache-Control': 'public, max-age=31536000',
            'ETag': etag,
            'X-Cache': 'HIT-PRELOADED'
          });
          res.send(emailData.insideImage);
          return;
        }
      });
      
      // If we already sent a response from the cache, return early
      if (res.headersSent) return;
      
      // PRIORITY 2: Check server cache
      const cached = imageCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        console.log(`[CACHE] Serving inside image ${cardId} from memory cache (${cached.data.length} bytes)`);
        res.set({
          'Content-Type': 'image/png',
          'Content-Length': cached.data.length.toString(), 
          'Cache-Control': 'public, max-age=31536000',
          'ETag': etag,
          'X-Cache': 'HIT-MEMORY'
        });
        return res.send(cached.data);
      }
      
      console.log(`[PERF] Cache miss - fetching card ${cardId} for inside image...`);
      const dbStartTime = Date.now();
      const card = await storage.getCard(cardId);
      const dbEndTime = Date.now();
      console.log(`[PERF] Database query took: ${dbEndTime - dbStartTime}ms`);

      if (!card || !card.insideImageUrl) {
        return res.status(404).json({ message: "Inside image not found" });
      }

      // Handle PNG file URLs (new system) vs Base64 data (legacy)
      let imageBuffer: Buffer;
      const conversionStartTime = Date.now();
      
      if (card.insideImageUrl.startsWith('/images/')) {
        // NEW: PNG file URL - serve from stored PNG files
        console.log(`[PNG_SERVE] Serving inside image from PNG file: ${card.insideImageUrl}`);
        
        try {
          const filename = path.basename(card.insideImageUrl);
          const filepath = path.join(process.cwd(), 'stored_images', filename);
          imageBuffer = await fsPromises.readFile(filepath);
          console.log(`[PNG_SERVE] Successfully loaded PNG file: ${filename} (${imageBuffer.length} bytes)`);
        } catch (error) {
          console.error(`[PNG_SERVE] Failed to load PNG file: ${card.insideImageUrl}`, error);
          return res.status(404).json({ message: "Inside image file not found" });
        }
      } else {
        // LEGACY: Base64 data - convert to buffer
        console.log(`[BASE64_SERVE] Processing Base64 inside image data (${card.insideImageUrl.length} chars)`);
        const base64Data = card.insideImageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      }
      
      // Use high-quality JPEG with optimal settings for fast loading
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 95, 
          progressive: true,
          mozjpeg: true,
          optimiseScans: true
        })
        .toBuffer();
      
      const conversionEndTime = Date.now();
      console.log(`[PERF] Base64 conversion and optimization took: ${conversionEndTime - conversionStartTime}ms`);
      
      // Cache the processed image
      imageCache.set(cacheKey, {
        data: optimizedBuffer,
        timestamp: Date.now(),
        etag
      });
      console.log(`[CACHE] Cached inside image ${cardId} (${optimizedBuffer.length} bytes)`);
      
      // Set headers and send
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': optimizedBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000',
        'ETag': etag
      });
      
      const endTime = Date.now();
      console.log(`[PERF] Total inside image serving time: ${endTime - startTime}ms`);
      
      res.send(optimizedBuffer);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[PERF] Inside image error after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error serving inside image: " + error.message });
    }
  });

  // ULTRA-FAST compressed image endpoint for email links
  app.get("/api/cards/:id/fast-front-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const cacheKey = `fast-front-${cardId}`;
      
      // PRIORITY 1: Check preloaded email link cache for instant serving
      emailLinkCache.forEach((emailData, reference) => {
        if (emailData.card.id === cardId && emailData.frontImage && (Date.now() - emailData.timestamp) < 900000) {
          console.log(`[INSTANT] Serving fast front image ${cardId} from preloaded email cache (${emailData.frontImage.length} bytes) - ${Date.now() - startTime}ms`);
          
          // Use preloaded image data for instant serving
          const optimizedBuffer = emailData.frontImage;
          res.set({
            'Content-Type': 'image/png',
            'Content-Length': optimizedBuffer.length.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': `"preloaded-front-${cardId}"`,
            'X-Cache': 'HIT-PRELOADED'
          });
          res.send(optimizedBuffer);
          return;
        }
      });
      
      // If we already sent a response from the preloaded cache, return early
      if (res.headersSent) return;
      
      // PRIORITY 2: Check memory cache
      const cached = imageCache.get(cacheKey);
      if (cached) {
        console.log(`[CACHE] Serving fast front image ${cardId} from memory cache - ${Date.now() - startTime}ms`);
        res.set({
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': cached.etag
        });
        return res.send(cached.data);
      }
      
      const card = await storage.getCard(cardId);
      if (!card?.frontImageUrl) {
        return res.status(404).json({ message: "Front image not found" });
      }
      
      // Handle both base64 data and PNG file URLs
      let imageBuffer: Buffer;
      
      if (card.frontImageUrl.startsWith('data:image/')) {
        // Handle base64 data URLs
        const base64Data = card.frontImageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (card.frontImageUrl.startsWith('/images/')) {
        // Handle PNG file URLs - read the file from disk
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'stored_images', card.frontImageUrl.replace('/images/', ''));
        
        try {
          imageBuffer = await fs.promises.readFile(filePath);
        } catch (error) {
          console.log(`[FAST-FRONT] PNG file not found: ${filePath}, falling back to base64`);
          // FALLBACK: Try to get base64 from conversationData if PNG file doesn't exist
          const conversationData = (card.conversationData as any) || {};
          
          // Check multiple possible sources for base64 data
          let fallbackBase64 = null;
          if (conversationData.frontImageUrl && conversationData.frontImageUrl.startsWith('data:image/')) {
            fallbackBase64 = conversationData.frontImageUrl.split(',')[1];
          } else if (conversationData.photo_upload && conversationData.photo_upload.startsWith('data:image/')) {
            fallbackBase64 = conversationData.photo_upload.split(',')[1];
          }
          
          if (fallbackBase64) {
            imageBuffer = Buffer.from(fallbackBase64, 'base64');
            console.log(`[FAST-FRONT] Using fallback base64 image: ${imageBuffer.length} bytes`);
          } else {
            console.log(`[FAST-FRONT] No fallback base64 image found in conversationData`);
            throw error; // Re-throw if no fallback available
          }
        }
      } else {
        throw new Error('Invalid front image URL format');
      }
      
      // Use maximum quality JPEG with optimal settings for fast loading
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 98, 
          progressive: true,
          mozjpeg: true,
          optimiseScans: true
        })
        .toBuffer();
      
      // Cache the optimized image
      const etag = `"optimized-front-${cardId}"`;
      imageCache.set(cacheKey, {
        data: optimizedBuffer,
        timestamp: Date.now(),
        etag
      });
      
      res.set({
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag
      });
      
      res.send(optimizedBuffer);
    } catch (error: any) {
      console.error("[PERF] Fast front image error:", error);
      res.status(500).json({ message: "Error serving fast front image" });
    }
  });

  // ULTRA-FAST compressed inside image endpoint
  app.get("/api/cards/:id/fast-inside-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const cacheKey = `fast-inside-${cardId}`;
      
      // PRIORITY 1: Check preloaded email link cache for instant serving
      emailLinkCache.forEach((emailData, reference) => {
        if (emailData.card.id === cardId && emailData.insideImage && (Date.now() - emailData.timestamp) < 900000) {
          console.log(`[INSTANT] Serving fast inside image ${cardId} from preloaded email cache (${emailData.insideImage.length} bytes) - ${Date.now() - startTime}ms`);
          
          // Use preloaded image data for instant serving
          const optimizedBuffer = emailData.insideImage;
          res.set({
            'Content-Type': 'image/png',
            'Content-Length': optimizedBuffer.length.toString(),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'ETag': `"preloaded-inside-${cardId}"`,
            'X-Cache': 'HIT-PRELOADED'
          });
          res.send(optimizedBuffer);
          return;
        }
      });
      
      // If we already sent a response from the preloaded cache, return early
      if (res.headersSent) return;
      
      // PRIORITY 2: Check memory cache
      const cached = imageCache.get(cacheKey);
      if (cached) {
        console.log(`[CACHE] Serving fast inside image ${cardId} from memory cache - ${Date.now() - startTime}ms`);
        res.set({
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'ETag': cached.etag
        });
        return res.send(cached.data);
      }
      
      const card = await storage.getCard(cardId);
      if (!card?.insideImageUrl) {
        return res.status(404).json({ message: "Inside image not found" });
      }
      
      // Handle both base64 data and PNG file URLs
      let imageBuffer: Buffer;
      
      if (card.insideImageUrl.startsWith('data:image/')) {
        // Handle base64 data URLs
        const base64Data = card.insideImageUrl.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else if (card.insideImageUrl.startsWith('/images/')) {
        // Handle PNG file URLs - read the file from disk
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'stored_images', card.insideImageUrl.replace('/images/', ''));
        
        try {
          imageBuffer = await fs.promises.readFile(filePath);
        } catch (error) {
          console.log(`[FAST-INSIDE] PNG file not found: ${filePath}, falling back to base64`);
          // FALLBACK: Try to get base64 from conversationData if PNG file doesn't exist
          const conversationData = (card.conversationData as any) || {};
          
          // Check multiple possible sources for base64 data
          let fallbackBase64 = null;
          if (conversationData.insideImageUrl && conversationData.insideImageUrl.startsWith('data:image/')) {
            fallbackBase64 = conversationData.insideImageUrl.split(',')[1];
          } else if (conversationData.photo_upload && conversationData.photo_upload.startsWith('data:image/')) {
            fallbackBase64 = conversationData.photo_upload.split(',')[1];
          }
          
          if (fallbackBase64) {
            imageBuffer = Buffer.from(fallbackBase64, 'base64');
            console.log(`[FAST-INSIDE] Using fallback base64 image: ${imageBuffer.length} bytes`);
          } else {
            console.log(`[FAST-INSIDE] No fallback base64 image found in conversationData`);
            throw error; // Re-throw if no fallback available
          }
        }
      } else {
        throw new Error('Invalid inside image URL format');
      }
      
      // Use maximum quality JPEG with optimal settings for fast loading
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 98, 
          progressive: true,
          mozjpeg: true,
          optimiseScans: true
        })
        .toBuffer();
      
      // Cache the optimized image
      const etag = `"optimized-inside-${cardId}"`;
      imageCache.set(cacheKey, {
        data: optimizedBuffer,
        timestamp: Date.now(),
        etag
      });
      
      res.set({
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'ETag': etag
      });
      
      res.send(optimizedBuffer);
    } catch (error: any) {
      console.error("[PERF] Fast inside image error:", error);
      res.status(500).json({ message: "Error serving fast inside image" });
    }
  });

  // Get optimized digital card front image (smaller size for digital sharing)
  app.get("/api/cards/:id/digital-front-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const etag = `"${cardId}-digital-front"`;
      
      // Check client cache first
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        console.log(`[CACHE] 304 Not Modified for digital front image ${cardId}`);
        return res.status(304).end();
      }
      
      console.log(`[DIGITAL] Fetching optimized digital front image for card ${cardId}`);
      
      // Get the card and check if it exists
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Check if migration is needed
      if (cardNeedsMigration(card)) {
        console.log(`[MIGRATION] Migrating card ${cardId} images on-demand`);
        await migrateCardImages(card);
      }
      
      // Get the original unwatermarked image from conversationData (if available)
      let imageBuffer;
      const conversationData = card.conversationData as any || {};
      
      if (conversationData.originalFrontImageUrl) {
        // Use the original unwatermarked image from conversationData
        console.log(`[DIGITAL] Using original unwatermarked front image for card ${cardId}`);
        const base64Data = conversationData.originalFrontImageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // Fall back to stored image if no original is available
        console.log(`[DIGITAL] Using stored front image for card ${cardId} (no original found)`);
        imageBuffer = await getStoredImage(cardId, 'front');
      }
      
      if (!imageBuffer) {
        return res.status(404).json({ message: "Front image not found" });
      }
      
      // Use high-quality JPEG with optimal settings for fast loading
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 95, 
          progressive: true,
          mozjpeg: true,
          optimiseScans: true
        })
        .toBuffer();
      
      // Set caching headers
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': optimizedBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'ETag': etag
      });
      
      const endTime = Date.now();
      console.log(`[DIGITAL] Digital front image served in ${endTime - startTime}ms (${optimizedBuffer.length} bytes)`);
      
      res.send(optimizedBuffer);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[DIGITAL] Error serving digital front image after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error serving digital front image: " + error.message });
    }
  });

  // Get full-resolution card front image for download
  app.get("/api/cards/:id/download-front-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const etag = `"${cardId}-download-front"`;
      
      // Check client cache first
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end();
      }
      
      console.log(`[DOWNLOAD] Fetching full-resolution front image for card ${cardId}`);
      
      let imageBuffer: Buffer | null = null;
      
      // Try to get original unwatermarked image first
      const card = await storage.getCard(cardId);
      if (card?.conversationData) {
        const originalImageUrl = (card.conversationData as any).originalFrontImageUrl;
        if (originalImageUrl) {
          console.log(`[DOWNLOAD] Using original unwatermarked front image for card ${cardId}`);
          imageBuffer = Buffer.from(originalImageUrl.replace('data:image/png;base64,', ''), 'base64');
        }
      }
      
      if (!imageBuffer) {
        // Fall back to stored image if no original is available
        console.log(`[DOWNLOAD] Using stored front image for card ${cardId} (no original found)`);
        imageBuffer = await getStoredImage(cardId, 'front');
      }
      
      if (!imageBuffer) {
        return res.status(404).json({ message: "Front image not found" });
      }
      
      // Set download headers (no compression for full resolution)
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length.toString(),
        'Content-Disposition': `attachment; filename="celebrait-card-front-${cardId}.png"`,
        'Cache-Control': 'public, max-age=3600',
        'ETag': etag
      });
      
      const endTime = Date.now();
      console.log(`[DOWNLOAD] Full-resolution front image served in ${endTime - startTime}ms (${imageBuffer.length} bytes)`);
      
      res.send(imageBuffer);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[DOWNLOAD] Error serving full-resolution front image after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error serving full-resolution front image: " + error.message });
    }
  });

  // Get full-resolution card inside image for download
  app.get("/api/cards/:id/download-inside-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const etag = `"${cardId}-download-inside"`;
      
      // Check client cache first
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        return res.status(304).end();
      }
      
      console.log(`[DOWNLOAD] Fetching full-resolution inside image for card ${cardId}`);
      
      let imageBuffer: Buffer | null = null;
      
      // Try to get original unwatermarked image first
      const card = await storage.getCard(cardId);
      if (card?.conversationData) {
        const originalImageUrl = (card.conversationData as any).originalInsideImageUrl;
        if (originalImageUrl) {
          console.log(`[DOWNLOAD] Using original unwatermarked inside image for card ${cardId}`);
          imageBuffer = Buffer.from(originalImageUrl.replace('data:image/png;base64,', ''), 'base64');
        }
      }
      
      if (!imageBuffer) {
        // Fall back to stored image if no original is available
        console.log(`[DOWNLOAD] Using stored inside image for card ${cardId} (no original found)`);
        imageBuffer = await getStoredImage(cardId, 'inside');
      }
      
      if (!imageBuffer) {
        return res.status(404).json({ message: "Inside image not found" });
      }
      
      // Set download headers (no compression for full resolution)
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length.toString(),
        'Content-Disposition': `attachment; filename="celebrait-card-inside-${cardId}.png"`,
        'Cache-Control': 'public, max-age=3600',
        'ETag': etag
      });
      
      const endTime = Date.now();
      console.log(`[DOWNLOAD] Full-resolution inside image served in ${endTime - startTime}ms (${imageBuffer.length} bytes)`);
      
      res.send(imageBuffer);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[DOWNLOAD] Error serving full-resolution inside image after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error serving full-resolution inside image: " + error.message });
    }
  });

  // Get optimized digital card inside image (smaller size for digital sharing)
  app.get("/api/cards/:id/digital-inside-image", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const etag = `"${cardId}-digital-inside"`;
      
      // Check client cache first
      const clientETag = req.headers['if-none-match'];
      if (clientETag === etag) {
        console.log(`[CACHE] 304 Not Modified for digital inside image ${cardId}`);
        return res.status(304).end();
      }
      
      console.log(`[DIGITAL] Fetching optimized digital inside image for card ${cardId}`);
      
      // Get the card and check if it exists
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Check if migration is needed
      if (cardNeedsMigration(card)) {
        console.log(`[MIGRATION] Migrating card ${cardId} images on-demand`);
        await migrateCardImages(card);
      }
      
      // Get the original unwatermarked image from conversationData (if available)
      let imageBuffer;
      const conversationData = card.conversationData as any || {};
      
      if (conversationData.originalInsideImageUrl) {
        // Use the original unwatermarked image from conversationData
        console.log(`[DIGITAL] Using original unwatermarked inside image for card ${cardId}`);
        const base64Data = conversationData.originalInsideImageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } else {
        // Fall back to stored image if no original is available
        console.log(`[DIGITAL] Using stored inside image for card ${cardId} (no original found)`);
        imageBuffer = await getStoredImage(cardId, 'inside');
      }
      
      if (!imageBuffer) {
        return res.status(404).json({ message: "Inside image not found" });
      }
      
      // Use high-quality JPEG with optimal settings for fast loading
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 95, 
          progressive: true,
          mozjpeg: true,
          optimiseScans: true
        })
        .toBuffer();
      
      // Set caching headers
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': optimizedBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
        'ETag': etag
      });
      
      const endTime = Date.now();
      console.log(`[DIGITAL] Digital inside image served in ${endTime - startTime}ms (${optimizedBuffer.length} bytes)`);
      
      res.send(optimizedBuffer);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[DIGITAL] Error serving digital inside image after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error serving digital inside image: " + error.message });
    }
  });

  // Get order by payment reference (for digital card viewing)
  app.get("/api/orders/reference/:reference", async (req, res) => {
    try {
      const { reference } = req.params;
      const order = await storage.getOrderByReference(reference);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Get the associated card
      const card = await storage.getCard(order.cardId);
      
      res.json({
        ...order,
        card
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // AI Chat completion
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, cardId, systemPrompt } = req.body;

      if (!cardId) {
        return res.status(400).json({ message: "Card ID is required" });
      }

      if (!openai) {
        return res.status(503).json({ message: "AI service not available - API key required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: systemPrompt || "You are Celebrait, a friendly AI assistant that helps users create custom greeting cards."
          },
          ...messages
        ],
        temperature: 0.9,
        max_tokens: 500
      });

      const response = completion.choices[0].message.content;

      // Update card with conversation data
      const conversationData = card.conversationData || {};
      const existingMessages = (conversationData as any)?.messages || [];
      const updatedConversationData = {
        ...conversationData,
        messages: [...existingMessages, ...messages, {
          role: "assistant",
          content: response
        }]
      };

      await storage.updateCard(cardId, {
        conversationData: updatedConversationData
      });

      res.json({ response });
    } catch (error: any) {
      res.status(500).json({ message: "Error processing chat: " + error.message });
    }
  });

  // Style transformation with greeting card text overlay
  app.post("/api/transform-image-style", async (req, res) => {
    try {
      const { stylePrompt, imageAnalysis, frontText, insideText, cardOption } = req.body;

      if (!stylePrompt) {
        return res.status(400).json({ message: "Style prompt is required" });
      }

      if (!openai) {
        return res.status(500).json({ message: "OpenAI API not configured" });
      }

      // Generate front card with text overlay
      const frontPrompt = imageAnalysis 
        ? `Create an image in ${stylePrompt} style. Recreate this exact scene: ${imageAnalysis}. Add the text "${frontText || 'Happy Birthday!'}" in elegant typography that matches the ${stylePrompt} artistic style. The text should be prominently displayed and beautifully integrated into the design.`
        : `Create an image card in ${stylePrompt} style with the text "${frontText || 'Happy Birthday!'}" in elegant typography`;

      console.log("Generating front card with text overlay");

      let frontResponse;
      try {
        frontResponse = await openai.images.generate({
          model: "gpt-image-1",
          prompt: frontPrompt,
          size: "1024x1024",
          quality: "high",
          n: 1
        });
        console.log("Successfully used gpt-image-1 for front card generation");
      } catch (gptError: any) {
        console.log("gpt-image-1 not available, falling back to dall-e-2:", gptError.message);

        frontResponse = await openai.images.generate({
          model: "gpt-image-1",
          prompt: frontPrompt,
          size: "1024x1024",
          quality: "high",
          n: 1
        });
      }

      if (!frontResponse.data || frontResponse.data.length === 0) {
        throw new Error('Failed to generate front image - no data returned');
      }
      const frontImageUrl = frontResponse.data[0].url || `data:image/png;base64,${frontResponse.data[0].b64_json}`;

      let insideImageUrl = null;

      // Generate inside card if requested
      if (cardOption === 'front-and-inside' && insideText) {
        const insidePrompt = `Square 1:1 aspect ratio design, full bleed with no borders or card edges visible, fill entire frame. DO NOT include any people, characters, or figures from the front card. "${insideText}" prominently displayed as the main focus with elegant typography. ${stylePrompt} art style with same visual treatment as front card. Subtle visual reference points to overall scene atmosphere from front card, but nothing too imposing as text is the primary focus. Typography style matching front card exactly - same font family, weight, and text treatment. Color palette matching front card exactly - same primary and accent colors. New image must feel like it is part of the same design family with cohesive design language and visual consistency. Print-ready artwork, no card mockup visible.`;

        console.log("Generating inside card with matching style");

        let insideResponse;
        try {
          insideResponse = await openai.images.generate({
            model: "gpt-image-1",
            prompt: insidePrompt,
            size: "1024x1024",
            quality: "high",
            n: 1
          });
          console.log("Successfully used gpt-image-1 for inside card generation");
        } catch (gptError: any) {
          console.log("gpt-image-1 not available for inside card, falling back to dall-e-2:", gptError.message);

          insideResponse = await openai.images.generate({
            model: "gpt-image-1",
            prompt: insidePrompt,
            size: "1024x1024",
            quality: "high",
            n: 1
          });
        }

        if (!insideResponse.data || insideResponse.data.length === 0) {
          throw new Error('Failed to generate inside image - no data returned');
        }
        insideImageUrl = insideResponse.data[0].url || `data:image/png;base64,${insideResponse.data[0].b64_json}`;
      }

      res.json({ 
        frontImageUrl,
        insideImageUrl 
      });
    } catch (error: any) {
      console.error("Style transformation error:", error);
      res.status(500).json({ message: "Error transforming image style: " + error.message });
    }
  });



  // Generate style-transformed images
  app.post("/api/generate-style-transform", async (req, res) => {
    try {
      const { cardId, frontPrompt, insidePrompt, originalImage, imageAnalysis } = req.body;

      console.log('Style transformation request:', { cardId, frontPrompt, insidePrompt });

      if (!cardId || !frontPrompt) {
        return res.status(400).json({ message: "Card ID and front prompt are required" });
      }

      if (!openai) {
        return res.status(500).json({ message: "OpenAI API not configured" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      console.log('Found card:', card.id);
      console.log('Using model: gpt-image-1 for style transformation');

      // Generate front image with style transformation
      let enhancedFrontPrompt = frontPrompt;
      if (originalImage && imageAnalysis) {
        console.log('Using image analysis for style transformation:', imageAnalysis);
        enhancedFrontPrompt += `. CRITICAL REQUIREMENTS: 1) Recreate the exact composition, pose, and scene described. 2) Text must be large, bold, and clearly readable - positioned prominently. 3) Maintain the essence of the original while transforming the artistic style completely.`;
      }

      console.log('🎯 FRONT CARD - EXACT PROMPT SENT TO GPT-IMAGE-1:');
      console.log('=== DEBUG: FRONT CARD PROMPT START ===');
      console.log(enhancedFrontPrompt);
      console.log('=== DEBUG: FRONT CARD PROMPT END ===');
      
      const frontImageGeneration = await openai.images.generate({
        model: "gpt-image-1",
        prompt: enhancedFrontPrompt,
        n: 1,
        size: "1024x1024",
        quality: "low"
      });

      // Extract front image data first
      const frontResponse = frontImageGeneration as any;
      let frontImageUrl = null;
      if (frontResponse.data && Array.isArray(frontResponse.data) && frontResponse.data.length > 0) {
        const imageData = frontResponse.data[0];

        if (typeof imageData === 'string') {
          frontImageUrl = `data:image/png;base64,${imageData}`;
        } else if (imageData.b64_json) {
          frontImageUrl = `data:image/png;base64,${imageData.b64_json}`;
        } else if (imageData.url) {
          frontImageUrl = imageData.url;
        }
        console.log('Successfully extracted front image data');
      }

      let insideImageUrl = null;

      // Generate inside image if provided, using front card as visual reference
      if (insidePrompt && frontImageUrl) {
        console.log('Using model: gpt-image-1 for inside image with front card visual reference');

        const imageToImagePrompt = `Using the attached front greeting card image as a visual style reference, create the interior of this greeting card. Match the exact artistic style, color palette, lighting, and visual mood from the reference image. Use identical typography treatment and display this message prominently: "${insidePrompt.match(/"([^"]+)"/)?.[1] || 'Message'}". Create a subtle, complementary background that references visual elements from the front card. The inside should look like it was designed by the same artist using the same design system.`;

        console.log('🎯 EXACT INSIDE PROMPT SENT TO GPT-IMAGE-1 (IMAGE-TO-IMAGE):', imageToImagePrompt);
        try {
          const insideImageGeneration = await openai.images.generate({
            model: "gpt-image-1",
            prompt: imageToImagePrompt,
            n: 1,
            size: "1024x1024",
            quality: "low"
          });

          const insideResponse = insideImageGeneration as any;
          if (insideResponse.data && Array.isArray(insideResponse.data) && insideResponse.data.length > 0) {
            const imageData = insideResponse.data[0];

            if (typeof imageData === 'string') {
              insideImageUrl = `data:image/png;base64,${imageData}`;
            } else if (imageData.b64_json) {
              insideImageUrl = `data:image/png;base64,${imageData.b64_json}`;
            } else if (imageData.url) {
              insideImageUrl = imageData.url;
            }
            console.log('Successfully generated inside card using front card as visual reference');
          }
        } catch (imageToImageError: any) {
          console.log('Image-to-image generation failed, falling back to enhanced text prompt:', imageToImageError.message);

          const enhancedInsidePrompt = `${insidePrompt}. STYLE MATCHING: Use exactly the same artistic style, color palette, and visual treatment as the front card. Create a cohesive design where the inside feels like the same artist created both cards with consistent visual language.`;

          console.log('🎯 EXACT INSIDE PROMPT SENT TO GPT-IMAGE-1 (FALLBACK):', enhancedInsidePrompt);
          const fallbackGeneration = await openai.images.generate({
            model: "gpt-image-1", 
            prompt: enhancedInsidePrompt,
            n: 1,
            size: "1024x1024",
            quality: "low"
          });

          const fallbackResponse = fallbackGeneration as any;
          if (fallbackResponse.data && Array.isArray(fallbackResponse.data) && fallbackResponse.data.length > 0) {
            const imageData = fallbackResponse.data[0];

            if (typeof imageData === 'string') {
              insideImageUrl = `data:image/png;base64,${imageData}`;
            } else if (imageData.b64_json) {
              insideImageUrl = `data:image/png;base64,${imageData.b64_json}`;
            } else if (imageData.url) {
              insideImageUrl = imageData.url;
            }
            console.log('Successfully generated inside card using fallback approach');
          }
        }
      }

      console.log('Extracted front image URL:', frontImageUrl ? 'Base64 data received' : 'No image data');
      console.log('Extracted inside image URL:', insideImageUrl ? 'Base64 data received' : 'No image data');

      // CRITICAL: PNG-ONLY WORKFLOW - Convert base64 to PNG immediately and use PNG files throughout
      let frontImagePngUrl = null;
      let insideImagePngUrl = null;
      
      if (frontImageUrl) {
        console.log('[PNG_ONLY] Converting front image to PNG and creating watermarked/unwatermarked versions...');
        
        // Step 1: Convert base64 to PNG file immediately (unwatermarked original)
        const unwatermarkedFrontPngUrl = await convertBase64ToPngFile(frontImageUrl, cardId, 'front_unwatermarked');
        console.log('[PNG_ONLY] Unwatermarked front PNG created:', unwatermarkedFrontPngUrl);
        
        // Step 2: Apply watermark to PNG file and create watermarked PNG file
        frontImagePngUrl = await applyWatermarkToPngFile(cardId, 'front_unwatermarked', 'front');
        console.log('[PNG_ONLY] Watermarked front PNG created:', frontImagePngUrl);
      }
      
      if (insideImageUrl) {
        console.log('[PNG_ONLY] Converting inside image to PNG and creating watermarked/unwatermarked versions...');
        
        // Step 1: Convert base64 to PNG file immediately (unwatermarked original)
        const unwatermarkedInsidePngUrl = await convertBase64ToPngFile(insideImageUrl, cardId, 'inside_unwatermarked');
        console.log('[PNG_ONLY] Unwatermarked inside PNG created:', unwatermarkedInsidePngUrl);
        
        // Step 2: Apply watermark to PNG file and create watermarked PNG file
        insideImagePngUrl = await applyWatermarkToPngFile(cardId, 'inside_unwatermarked', 'inside');
        console.log('[PNG_ONLY] Watermarked inside PNG created:', insideImagePngUrl);
      }

      // Update card with watermarked PNG file URLs (for preview)
      const updatedCard = await storage.updateCard(cardId, {
        frontImageUrl: frontImagePngUrl, // Store watermarked PNG file URL for preview
        insideImageUrl: insideImagePngUrl, // Store watermarked PNG file URL for preview
        status: 'completed'
      });

      // 🚀 CRITICAL: Send email with card preview link after successful generation
      try {
        const user = await storage.getUser(updatedCard.userId);
        if (user?.email) {
          console.log(`✅ Card ${cardId} completed - sending preview email to ${user.email}`);
          const emailSent = await sendBackgroundEmail(cardId, user.email, user.firstName || user.email);
          if (emailSent) {
            console.log(`🎉 Email sent successfully for card ${cardId}`);
          } else {
            console.log(`⚠️ Email failed for card ${cardId} - user still gets card but no notification`);
          }
        } else {
          console.log(`⚠️ No user email found for card ${cardId} - skipping email`);
        }
      } catch (emailError: any) {
        console.error(`❌ Email error for card ${cardId}:`, emailError);
        // Continue - don't fail the card generation due to email issues
      }

      res.json(updatedCard);
    } catch (error: any) {
      res.status(500).json({ message: "Error generating style transformation: " + error.message });
    }
  });

  // Generate card images
  app.post("/api/generate-images", async (req, res) => {
    // Test hook for triggering safety errors (development only)
    if (process.env.NODE_ENV === 'development' && req.headers['x-test-trigger'] === 'safety_violation') {
      console.log('[TEST] Triggering safety error for testing');
      return res.status(400).json({
        error: 'Content moderation detected inappropriate content',
        isSafetyError: true,
        errorType: req.headers['x-test-error-type'] || 'children_photos'
      });
    }

    try {
      const { cardId, frontPrompt, insidePrompt, photoData, photoAnalysis } = req.body;

      console.log('Image generation request:', { cardId, frontPrompt, insidePrompt });

      if (!cardId || !frontPrompt) {
        return res.status(400).json({ message: "Card ID and front prompt are required" });
      }

      if (!openai) {
        return res.status(503).json({ message: "AI service not available - API key required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        console.log('Card not found for ID:', cardId);
        return res.status(404).json({ message: "Card not found" });
      }

      console.log('Found card:', card.id);

      // Generate front image using GPT-Image-1 model
      console.log('Using model: gpt-image-1 for front image');

      let frontImageGeneration;

      // CRITICAL UPDATE: All photo uploads now use detailed 8-step facial recreation prompt (PATH 2)
      // This eliminates simple prompts and ensures consistent high-quality results
      
      if (photoData) {
        // REDIRECT ALL PHOTO UPLOADS TO PATH 2: Detailed 8-step facial recreation
        console.log('🎯 REDIRECTING PHOTO UPLOADS TO PATH 2 - DETAILED FACIAL RECREATION');
        console.log('Photo upload detected - using detailed /api/edit-scene-gpt-image-1 endpoint');
        
        // Extract scene and style from the front prompt for PATH 2
        const imageDataArray = Array.isArray(photoData) ? photoData : [photoData];
        
        // Make internal call to the detailed PATH 2 endpoint
        try {
          const sceneEditResponse = await fetch(`${req.protocol}://${req.get('host')}/api/edit-scene-gpt-image-1`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': req.headers.authorization || ''
            },
            body: JSON.stringify({
              imageDataArray,
              scenePrompt: frontPrompt,
              cardText: '', // Will be extracted from prompt
              includeText: true,
              userArtStyle: 'ai_decide',
              userClothing: ''
            })
          });
          
          if (!sceneEditResponse.ok) {
            throw new Error(`PATH 2 endpoint failed: ${sceneEditResponse.status}`);
          }
          
          const sceneEditResult = await sceneEditResponse.json();
          
          // Convert PATH 2 response to expected format
          frontImageGeneration = {
            data: [{
              url: sceneEditResult.imageUrl || sceneEditResult.transformedImageUrl
            }]
          };
          
          console.log('🎯 SUCCESS: Photo upload processed through PATH 2 detailed facial recreation');
        } catch (path2Error: any) {
          console.log('PATH 2 detailed processing failed, falling back to text generation:', path2Error.message);
          
          // Fallback to standard text-only generation
          frontImageGeneration = await openai.images.generate({
            model: "gpt-image-1",
            prompt: frontPrompt,
            n: 1,
            size: "1024x1024",
            quality: "low"
          });
        }
      } else {
        // Standard text-only generation
        frontImageGeneration = await openai.images.generate({
          model: "gpt-image-1",
          prompt: frontPrompt,
          n: 1,
          size: "1024x1024",
          quality: "low"
        });
      }

      const responseData = frontImageGeneration as any;
      console.log('Response keys:', Object.keys(responseData));
      console.log('Has images property:', 'images' in responseData);
      if (responseData.images) {
        console.log('Images array length:', responseData.images.length);
        console.log('First image exists:', !!responseData.images[0]);
        if (responseData.images[0]) {
          console.log('First image data type:', typeof responseData.images[0]);
          console.log('First image data length:', responseData.images[0].length);
        }
      }

      let insideImageUrl = null;
      let frontImageUrl = null;

      // Extract image data FIRST (dall-e-3 returns base64 data in 'data' array)
      const frontResponse = frontImageGeneration as any;
      console.log('Checking frontResponse.data:', !!frontResponse.data);
      console.log('frontResponse.data type:', typeof frontResponse.data);

      if (frontResponse.data && Array.isArray(frontResponse.data) && frontResponse.data.length > 0) {
        const imageData = frontResponse.data[0];
        console.log('Image data type:', typeof imageData);
        console.log('Image data keys:', Object.keys(imageData));

        // The data might be in imageData.b64_json or imageData.url
        if (typeof imageData === 'string') {
          frontImageUrl = `data:image/png;base64,${imageData}`;
        } else if (imageData.b64_json) {
          frontImageUrl = `data:image/png;base64,${imageData.b64_json}`;
        } else if (imageData.url) {
          frontImageUrl = imageData.url;
        }
        console.log('Successfully extracted front image data from data array');
      } else {
        console.log('Failed to find data array in frontResponse');
      }

      // Generate inside image if provided, using direct style reference approach
      if (insidePrompt && frontImageUrl) {
        console.log('Generating inside card using direct GPT-Image-1 style reference approach');

        try {
          // Extract the message text from the inside prompt
          const messageMatch = insidePrompt.match(/"([^"]+)"/);
          const insideMessage = messageMatch ? messageMatch[1] : 'Happy Birthday!';

          // Use proper inside card prompt with comprehensive requirements
          const insideCardPrompt = `Square 1:1 aspect ratio design, full bleed with no borders or card edges visible, fill entire frame. DO NOT include any people, characters, or figures from the front card. "${insideMessage}" prominently displayed as the main focus with elegant typography. Reference this front card image for style consistency: same art style, same typography style exactly (font family, weight, text treatment), same color palette exactly (primary and accent colors). Include subtle visual reference points to overall scene atmosphere from front card, but nothing too imposing as text is the primary focus. New image must feel like it is part of the same design family with cohesive design language and visual consistency. Print-ready artwork, no card mockup visible.`;

          console.log('Using direct GPT-Image-1 style reference for inside card');

          // Convert front card image to buffer for GPT-Image-1 edits API
          const base64Data = frontImageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');

          // Detect MIME type from the front card image
          const mimeMatch = frontImageUrl.match(/^data:image\/([a-z]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'png';

          console.log('Front card image buffer size:', imageBuffer.length, 'bytes, MIME type:', mimeType);

          // Use form-data approach with GPT-Image-1 edits API
          const formData = new FormData();

          // Add image buffer with proper metadata
          formData.append('image', imageBuffer, {
            filename: `front-card.${mimeType}`,
            contentType: `image/${mimeType}`
          });
          formData.append('prompt', insideCardPrompt);
          formData.append('model', 'gpt-image-1');
          formData.append('n', '1');
          formData.append('size', '1024x1024');
          formData.append('quality', 'high');
          formData.append('moderation', 'low');

          const fetch = (await import('node-fetch')).default;
          const response = await fetch('https://api.openai.com/v1/images/edits', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              ...formData.getHeaders()
            },
            body: formData
          });

          if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: { message: errorText } };
            }
            throw new Error(`GPT-Image-1 API error: ${response.status} ${errorData.error?.message || 'Unknown error'}`);
          }

          const responseData = await response.json();

          if (responseData && (responseData as any).data && Array.isArray((responseData as any).data) && (responseData as any).data.length > 0) {
            const imageResult = (responseData as any).data[0];

            if (imageResult.b64_json) {
              insideImageUrl = `data:image/png;base64,${imageResult.b64_json}`;
              console.log('Generated inside card using direct style reference approach');
            } else if (imageResult.url) {
              insideImageUrl = imageResult.url;
              console.log('Generated inside card image URL:', imageResult.url);
            } else {
              throw new Error('No image data received from GPT-Image-1');
            }
          } else {
            throw new Error('Invalid response format from GPT-Image-1 API');
          }
        } catch (styleReferenceError: any) {
          console.log('Direct style reference approach failed:', styleReferenceError.message);
          // Skip inside card generation if it fails
          insideImageUrl = null;
        }
      }

      console.log('Extracted front image URL:', frontImageUrl ? 'Base64 data received' : 'No image data');
      console.log('Extracted inside image URL:', insideImageUrl ? 'Base64 data received' : 'No image data');

      // CRITICAL: PNG-ONLY WORKFLOW - Convert base64 to PNG immediately and use PNG files throughout
      let frontImagePngUrl = null;
      let insideImagePngUrl = null;
      
      if (frontImageUrl) {
        console.log('[PNG_ONLY] Converting front image to PNG and creating watermarked/unwatermarked versions...');
        
        // Step 1: Convert base64 to PNG file immediately (unwatermarked original)
        const unwatermarkedFrontPngUrl = await convertBase64ToPngFile(frontImageUrl, cardId, 'front_unwatermarked');
        console.log('[PNG_ONLY] Unwatermarked front PNG created:', unwatermarkedFrontPngUrl);
        
        // Step 2: Apply watermark to PNG file and create watermarked PNG file
        frontImagePngUrl = await applyWatermarkToPngFile(cardId, 'front_unwatermarked', 'front');
        console.log('[PNG_ONLY] Watermarked front PNG created:', frontImagePngUrl);
      }
      
      if (insideImageUrl) {
        console.log('[PNG_ONLY] Converting inside image to PNG and creating watermarked/unwatermarked versions...');
        
        // Step 1: Convert base64 to PNG file immediately (unwatermarked original)
        const unwatermarkedInsidePngUrl = await convertBase64ToPngFile(insideImageUrl, cardId, 'inside_unwatermarked');
        console.log('[PNG_ONLY] Unwatermarked inside PNG created:', unwatermarkedInsidePngUrl);
        
        // Step 2: Apply watermark to PNG file and create watermarked PNG file
        insideImagePngUrl = await applyWatermarkToPngFile(cardId, 'inside_unwatermarked', 'inside');
        console.log('[PNG_ONLY] Watermarked inside PNG created:', insideImagePngUrl);
      }

      // Update card with watermarked PNG file URLs (for preview)
      const updatedCard = await storage.updateCard(cardId, {
        frontImageUrl: frontImagePngUrl, // Store watermarked PNG file URL for preview
        insideImageUrl: insideImagePngUrl, // Store watermarked PNG file URL for preview
        status: 'completed'
      });

      // 🚀 CRITICAL: Send email with card preview link after successful generation
      try {
        const user = await storage.getUser(updatedCard.userId);
        if (user?.email) {
          console.log(`✅ Card ${cardId} completed - sending preview email to ${user.email}`);
          const emailSent = await sendBackgroundEmail(cardId, user.email, user.firstName || user.email);
          if (emailSent) {
            console.log(`🎉 Email sent successfully for card ${cardId}`);
          } else {
            console.log(`⚠️ Email failed for card ${cardId} - user still gets card but no notification`);
          }
        } else {
          console.log(`⚠️ No user email found for card ${cardId} - skipping email`);
        }
      } catch (emailError: any) {
        console.error(`❌ Email error for card ${cardId}:`, emailError);
        // Continue - don't fail the card generation due to email issues
      }

      res.json(updatedCard);
    } catch (error: any) {
      res.status(500).json({ message: "Error generating images: " + error.message });
    }
  });

  // Stripe payment intent
  app.post("/api/create-payment-intent", async (req, res) => {
    try {
      const { cardId } = req.body;

      if (!cardId) {
        return res.status(400).json({ message: "Card ID is required" });
      }

      if (!stripe) {
        return res.status(503).json({ message: "Payment service not available - Stripe API key required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: card.price, // Already in cents
        currency: "zar", // South African Rand
        metadata: {
          cardId: cardId.toString()
        }
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Complete payment and remove watermark
  app.post("/api/complete-payment", async (req, res) => {
    try {
      const { cardId } = req.body;

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      const updatedCard = await storage.updateCard(cardId, {
        status: 'paid'
      });

      res.json(updatedCard);
    } catch (error: any) {
      res.status(500).json({ message: "Error completing payment: " + error.message });
    }
  });

  // Enhanced AI chat endpoint with improved conversation parameters
  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;

      if (!openai) {
        return res.status(503).json({ message: "AI service not available - API key required" });
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a friendly, emotionally intelligent AI assistant helping people create greetings cards using personal details and creative prompts. Guide the user step-by-step and ask only one question at a time. Always give examples, and speak casually with warmth and personality."
          },
          ...messages
        ],
        temperature: 0.9,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0.6,
        max_tokens: 1000
      });

      res.json({ 
        response: response.choices[0].message.content 
      });
    } catch (error: any) {
      res.status(500).json({ message: "Error in chat: " + error.message });
    }
  });

  // Paystack payment initialization
  app.post("/api/create-payment", async (req, res) => {
    try {
      const { cardId, customerInfo, amount, currency = 'ZAR' } = req.body;

      if (!cardId || !customerInfo || !amount) {
        return res.status(400).json({ message: "Card ID, customer info, and amount are required" });
      }

      const reference = `celebrait_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const orderData = {
        cardId: parseInt(cardId),
        customerEmail: customerInfo.email,
        customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customerPhone: customerInfo.phone,
        amount: parseInt(amount),
        currency,
        paymentReference: reference,
        shippingAddress: customerInfo.address || null
      };

      const order = await storage.createOrder(orderData);

      if (!hasPaystack) {
        const mockPaymentUrl = `https://${req.get('host')}/payment-success?reference=${reference}&status=success`;
        return res.json({ 
          paymentUrl: mockPaymentUrl, 
          reference,
          message: "Test mode - payment will be simulated"
        });
      }

      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: customerInfo.email,
          amount: amount,
          currency,
          reference,
          callback_url: `https://${req.get('host')}/payment-success`,
          metadata: {
            cardId: cardId.toString(),
            orderId: order.id.toString(),
            customerName: orderData.customerName,
            cardType: 'greeting_card'
          }
        })
      });

      const paystackData = await paystackResponse.json();

      if (paystackData.status) {
        res.json({ 
          paymentUrl: paystackData.data.authorization_url, 
          reference,
          accessCode: paystackData.data.access_code
        });
      } else {
        throw new Error(paystackData.message || 'Payment initialization failed');
      }

    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment: " + error.message });
    }
  });

  // Paystack payment with tip
  app.post("/api/create-payment-with-tip", async (req, res) => {
    try {
      const { cardId, customerInfo, amount, baseAmount, tipAmount, currency = 'ZAR' } = req.body;

      if (!cardId || !customerInfo || amount === undefined) {
        return res.status(400).json({ message: "Card ID, customer info, and amount are required" });
      }

      const reference = `celebrait_tip_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const orderData = {
        cardId: parseInt(cardId),
        customerEmail: customerInfo.email,
        customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customerPhone: customerInfo.phone,
        amount: parseInt(amount),
        baseAmount: parseInt(baseAmount),
        tipAmount: parseInt(tipAmount || 0),
        currency,
        paymentReference: reference,
        shippingAddress: customerInfo.address || null,
        orderType: 'paid_with_tip'
      };

      console.log('Creating order with data:', orderData);
      const order = await storage.createOrder(orderData);
      console.log('Order created successfully:', order?.id, 'with reference:', order?.paymentReference);

      // Send order confirmation email
      try {
        const emailParams = generateOrderConfirmationEmail(orderData);
        await sendEmail(emailParams);
        console.log('Order confirmation email sent successfully');
      } catch (emailError) {
        console.error('Failed to send order confirmation email:', emailError);
        // Don't fail the entire request if email fails
      }

      if (!order || !order.id) {
        console.error('Order creation failed - no order returned or missing ID');
        return res.status(500).json({ message: "Failed to create order" });
      }

      if (!hasPaystack) {
        const mockPaymentUrl = `https://${req.get('host')}/payment-success?reference=${reference}&status=success`;
        console.log('Generated mock payment URL:', mockPaymentUrl);
        return res.json({ 
          paymentUrl: mockPaymentUrl, 
          reference,
          message: "Test mode - payment with tip will be simulated"
        });
      }

      const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: customerInfo.email,
          amount: amount,
          currency,
          reference,
          callback_url: `https://${req.get('host')}/payment-success`,
          metadata: {
            cardId: cardId.toString(),
            orderId: order.id.toString(),
            customerName: orderData.customerName,
            cardType: 'greeting_card',
            baseAmount: baseAmount.toString(),
            tipAmount: (tipAmount || 0).toString(),
            orderType: 'paid_with_tip'
          }
        })
      });

      const paystackData = await paystackResponse.json();

      if (paystackData.status) {
        res.json({ 
          paymentUrl: paystackData.data.authorization_url, 
          reference,
          accessCode: paystackData.data.access_code
        });
      } else {
        throw new Error(paystackData.message || 'Payment initialization failed');
      }

    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment with tip: " + error.message });
    }
  });

  // DEPRECATED - Digital cards now cost R1.00 via Payfast
  app.post("/api/create-free-order", async (req, res) => {
    // Digital cards are no longer free - redirect to payment flow
    return res.status(400).json({ 
      message: "Digital cards now cost R1.00 and require payment via Payfast", 
      requiresPayment: true,
      amount: 1.00,
      redirectToPayment: true
    });
  });

  // Paystack payment verification
  app.post("/api/verify-payment", async (req, res) => {
    try {
      const { reference } = req.body;

      if (!reference) {
        return res.status(400).json({ message: "Payment reference is required" });
      }

      console.log('Verifying payment for reference:', reference);

      const order = await storage.getOrderByReference(reference);
      if (!order) {
        console.log('Order not found for reference:', reference);
        return res.status(404).json({ message: "Order not found for reference: " + reference });
      }

      console.log('Found order:', order.id, 'for reference:', reference);

      if (!hasPaystack) {
        // Get card to determine order status based on type
        const card = await storage.getCard(order.cardId);
        const isDigital = !order.shippingAddress;

        const updatedOrder = await storage.updateOrder(order.id, {
          paymentStatus: 'successful',
          orderStatus: isDigital ? 'completed' : 'processing'
        });

        // Update card status to paid
        if (card) {
          await storage.updateCard(card.id, { status: 'paid' });

          // Send appropriate email based on order type
          try {
            if (isDigital && card.frontImageUrl) {
              // Send digital card email with the card image
              const emailParams = generateDigitalCardEmail(order, card.frontImageUrl);
              await sendEmail(emailParams);
              console.log('Digital card email sent successfully');
            }
          } catch (emailError) {
            console.error('Failed to send digital card email:', emailError);
          }
        }

        return res.json({
          ...updatedOrder,
          card,
          status: 'success',
          message: 'Payment verified successfully (test mode)'
        });
      }

      const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        headers: {
          'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
        }
      });

      const verifyData = await verifyResponse.json();

      if (verifyData.status && verifyData.data.status === 'success') {
        const updatedOrder = await storage.updateOrder(order.id, {
          paymentStatus: 'successful',
          orderStatus: order.shippingAddress ? 'processing' : 'completed'
        });

        const card = await storage.getCard(order.cardId);

        if (card) {
          await storage.updateCard(card.id, { status: 'paid' });

          // Send appropriate email based on order type
          try {
            const isDigital = !order.shippingAddress;
            if (isDigital && card.frontImageUrl) {
              // Send digital card email with the card image
              const emailParams = generateDigitalCardEmail(order, card.frontImageUrl);
              await sendEmail(emailParams);
              console.log('Digital card email sent successfully');
            }
          } catch (emailError) {
            console.error('Failed to send digital card email:', emailError);
          }
        }

        res.json({
          ...updatedOrder,
          card,
          status: 'success',
          message: 'Payment verified successfully'
        });
      } else {
        await storage.updateOrder(order.id, {
          paymentStatus: 'failed'
        });

        res.status(400).json({
          message: 'Payment verification failed',
          status: 'failed'
        });
      }

    } catch (error: any) {
      res.status(500).json({ message: "Error verifying payment: " + error.message });
    }
  });

  // Get order details
  app.get("/api/orders/:id", async (req, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);

      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const card = await storage.getCard(order.cardId);

      res.json({
        ...order,
        card
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get order by payment reference
  app.get("/api/orders/reference/:reference", async (req, res) => {
    try {
      const reference = req.params.reference;
      console.log('Fetching order by reference:', reference);
      
      const order = await storage.getOrderByReference(reference);
      
      if (!order) {
        console.log('Order not found for reference:', reference);
        return res.status(404).json({ message: "Order not found" });
      }

      // Get the associated card
      const card = await storage.getCard(order.cardId);
      console.log('Found order and card for reference:', reference);
      
      res.json({
        ...order,
        card
      });
    } catch (error: any) {
      console.error('Error fetching order by reference:', error);
      res.status(400).json({ message: error.message });
    }
  });

  // Get card by ready reference for delivery choice flow (ULTRA-FAST with preloaded cache)
  app.get("/api/cards/ready/:reference", async (req, res) => {
    const startTime = Date.now();
    try {
      const reference = req.params.reference;
      
      // PRIORITY 1: Check preloaded email link cache for instant loading
      const emailCached = emailLinkCache.get(reference);
      if (emailCached && (Date.now() - emailCached.timestamp) < 900000) { // 15 minutes cache
        console.log(`[INSTANT] Serving from preloaded email cache: ${reference} (${Date.now() - startTime}ms)`);
        
        const responseData = {
          card: {
            ...emailCached.card,
            frontImageUrl: `/api/cards/${emailCached.card.id}/fast-front-image`,
            insideImageUrl: emailCached.insideImage ? `/api/cards/${emailCached.card.id}/fast-inside-image` : null,
            // Remove base64 images for ultra-fast loading
            frontImageBase64: null,
            insideImageBase64: null
          },
          reference,
          message: "Card ready for delivery choice"
        };
        
        res.set({
          'Cache-Control': 'public, max-age=600',
          'ETag': `"${reference}"`,
          'X-Cache': 'HIT-PRELOADED',
          'X-Response-Time': `${Date.now() - startTime}ms`,
          'Content-Type': 'application/json; charset=utf-8',
          'Connection': 'keep-alive'
        });
        return res.json(responseData);
      }
      
      // PRIORITY 2: Check metadata cache
      const cacheKey = `ready-${reference}`;
      const cached = cardMetadataCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < METADATA_CACHE_TTL) {
        console.log(`[CACHE] Serving ready card from metadata cache for reference: ${reference}`);
        res.set({
          'Cache-Control': 'public, max-age=300',
          'ETag': `"${reference}"`,
          'X-Cache': 'HIT-METADATA'
        });
        return res.json(cached.data);
      }
      
      console.log(`[PERF] Cache miss - fetching card by ready reference: ${reference}`);
      
      // Extract cardId from reference if it follows pattern
      if (!reference.startsWith('celebrait_ready_')) {
        return res.status(400).json({ message: "Invalid ready reference format" });
      }
      
      // Extract cardId from reference pattern: celebrait_ready_{cardId}_{timestamp}_{random}
      const parts = reference.split('_');
      if (parts.length < 4) {
        return res.status(400).json({ message: "Invalid ready reference format" });
      }
      
      const cardId = parts[2]; // Third part is the cardId
      
      if (!cardId || isNaN(parseInt(cardId))) {
        return res.status(400).json({ message: "Cannot extract card ID from reference" });
      }

      const dbStartTime = Date.now();
      const card = await storage.getCard(parseInt(cardId));
      const dbEndTime = Date.now();
      console.log(`[PERF] Database query for ready card took: ${dbEndTime - dbStartTime}ms`);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // For maximum performance, only send metadata and serve images as separate endpoints
      const optimizedCard = {
        id: card.id,
        userId: card.userId,
        cardType: card.cardType,
        printOption: card.printOption,
        sceneType: card.sceneType,
        status: card.status,
        price: card.price,
        frontImageUrl: card.frontImageUrl ? `/api/cards/${cardId}/fast-front-image` : null,
        insideImageUrl: card.insideImageUrl ? `/api/cards/${cardId}/fast-inside-image` : null,
        // Remove massive base64 data to improve loading speed
        conversationData: card.conversationData || {}
      };
      
      const responseData = {
        card: optimizedCard,
        reference,
        message: "Card ready for delivery choice"
      };
      
      // Cache the response
      cardMetadataCache.set(cacheKey, {
        data: responseData,
        timestamp: Date.now()
      });
      console.log(`[CACHE] Cached ready card metadata for reference: ${reference}`);
      
      // Preload images into cache for instant loading
      if (card.frontImageUrl) {
        const frontCacheKey = `fast-front-${cardId}`;
        if (!imageCache.has(frontCacheKey)) {
          try {
            let imageBuffer: Buffer;
            
            if (card.frontImageUrl.startsWith('data:image/')) {
              // Handle legacy base64 data URLs
              const base64Data = card.frontImageUrl.split(',')[1];
              imageBuffer = Buffer.from(base64Data, 'base64');
            } else if (card.frontImageUrl.startsWith('/images/')) {
              // Handle PNG file URLs
              const fs = await import('fs');
              const path = await import('path');
              const frontFilePath = path.join(process.cwd(), 'stored_images', card.frontImageUrl.replace('/images/', ''));
              
              if (fs.existsSync(frontFilePath)) {
                imageBuffer = fs.readFileSync(frontFilePath);
              } else {
                console.warn(`[PRELOAD] PNG front image file not found: ${frontFilePath}`);
                return;
              }
            } else {
              console.warn(`[PRELOAD] Unsupported front image URL format: ${card.frontImageUrl}`);
              return;
            }
            
            const compressedBuffer = await sharp(imageBuffer)
              .jpeg({ quality: 60, progressive: true })
              .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
              .toBuffer();
            
            imageCache.set(frontCacheKey, {
              data: compressedBuffer,
              timestamp: Date.now(),
              etag: `"fast-front-${cardId}"`
            });
            console.log(`[PRELOAD] Cached front image for instant loading: ${cardId} (${imageBuffer.length} bytes)`);
          } catch (e) {
            console.warn(`[PRELOAD] Failed to cache front image: ${e}`);
          }
        }
      }
      
      if (card.insideImageUrl) {
        const insideCacheKey = `fast-inside-${cardId}`;
        if (!imageCache.has(insideCacheKey)) {
          try {
            let imageBuffer: Buffer;
            
            if (card.insideImageUrl.startsWith('data:image/')) {
              // Handle legacy base64 data URLs
              const base64Data = card.insideImageUrl.split(',')[1];
              imageBuffer = Buffer.from(base64Data, 'base64');
            } else if (card.insideImageUrl.startsWith('/images/')) {
              // Handle PNG file URLs
              const fs = await import('fs');
              const path = await import('path');
              const insideFilePath = path.join(process.cwd(), 'stored_images', card.insideImageUrl.replace('/images/', ''));
              
              if (fs.existsSync(insideFilePath)) {
                imageBuffer = fs.readFileSync(insideFilePath);
              } else {
                console.warn(`[PRELOAD] PNG inside image file not found: ${insideFilePath}`);
                return;
              }
            } else {
              console.warn(`[PRELOAD] Unsupported inside image URL format: ${card.insideImageUrl}`);
              return;
            }
            
            const compressedBuffer = await sharp(imageBuffer)
              .jpeg({ quality: 60, progressive: true })
              .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
              .toBuffer();
            
            imageCache.set(insideCacheKey, {
              data: compressedBuffer,
              timestamp: Date.now(),
              etag: `"fast-inside-${cardId}"`
            });
            console.log(`[PRELOAD] Cached inside image for instant loading: ${cardId} (${imageBuffer.length} bytes)`);
          } catch (e) {
            console.warn(`[PRELOAD] Failed to cache inside image: ${e}`);
          }
        }
      }
      
      // Add caching headers for faster subsequent loads
      res.set({
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'X-Cache': 'MISS',
        'ETag': `"${reference}"`
      });
      
      const endTime = Date.now();
      console.log(`[PERF] Total ready card serving time: ${endTime - startTime}ms`);
      
      res.json(responseData);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[PERF] Ready card error after ${endTime - startTime}ms:`, error);
      res.status(400).json({ message: error.message });
    }
  });

  // Lightweight card metadata endpoint for instant delivery choice loading
  app.get("/api/cards/:id/metadata", async (req, res) => {
    const startTime = Date.now();
    try {
      const cardId = parseInt(req.params.id);
      const cacheKey = `metadata-${cardId}`;
      
      // Check cache first
      const cached = cardMetadataCache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < METADATA_CACHE_TTL) {
        console.log(`[CACHE] Serving metadata from cache for card ${cardId}`);
        res.set({
          'Cache-Control': 'public, max-age=300',
          'ETag': `"${cardId}-meta"`
        });
        return res.json(cached.data);
      }
      
      console.log(`[PERF] Cache miss - fetching lightweight metadata for card ${cardId}`);
      const dbStartTime = Date.now();
      const card = await storage.getCard(cardId);
      const dbEndTime = Date.now();
      console.log(`[PERF] Lightweight metadata query took: ${dbEndTime - dbStartTime}ms`);
      
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }
      
      // Return only essential metadata - no images
      const metadata = {
        id: card.id,
        userId: card.userId,
        cardType: card.cardType,
        printOption: card.printOption,
        sceneType: card.sceneType,
        status: card.status,
        price: card.price,
        hasImages: !!(card.frontImageUrl && card.insideImageUrl),
        conversationData: card.conversationData
      };
      
      // Cache the lightweight response
      cardMetadataCache.set(cacheKey, {
        data: metadata,
        timestamp: Date.now()
      });
      
      res.set({
        'Cache-Control': 'public, max-age=300',
        'ETag': `"${cardId}-meta"`
      });
      
      const endTime = Date.now();
      console.log(`[PERF] Total metadata serving time: ${endTime - startTime}ms`);
      
      res.json(metadata);
    } catch (error: any) {
      const endTime = Date.now();
      console.error(`[PERF] Metadata error after ${endTime - startTime}ms:`, error);
      res.status(500).json({ message: "Error fetching metadata: " + error.message });
    }
  });

  // Get orders by email
  app.get("/api/orders", async (req, res) => {
    try {
      const { email } = req.query;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const orders = await storage.getOrdersByEmail(email as string);

      const ordersWithCards = await Promise.all(
        orders.map(async (order) => {
          const card = await storage.getCard(order.cardId);
          return { ...order, card };
        })
      );

      res.json(ordersWithCards);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Character transformation using flux-kontext-max
  app.post("/api/transform-character-flux", async (req, res) => {
    try {
      const { 
        cardId, 
        originalImage, 
        prompt, 
        scene, 
        artStyle,
        // Optional flux parameters
        guidance_scale = 15,
        num_inference_steps = 50,
        seed,
        strength = 1,
        output_format = "png",
        safety_tolerance = 5,
        aspect_ratio = "1:1",
        output_quality = 80
      } = req.body;

      if (!cardId || !originalImage || !prompt) {
        return res.status(400).json({ message: "Card ID, original image, and prompt are required" });
      }

      if (!replicate) {
        return res.status(503).json({ message: "Replicate API not configured - REPLICATE_API_TOKEN required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      console.log('Character transformation with flux-kontext-max:', { cardId, prompt, scene, artStyle });

      // Build transformation prompt for character in new scene
      const transformPrompt = `Square 1:1 aspect ratio, full bleed design. Make this a ${artStyle} style image. ${prompt} ${scene}`.trim();

      console.log('Flux character transformation prompt:', transformPrompt);
      console.log('Original image data length:', originalImage.length);

      const fluxInput: any = {
        prompt: transformPrompt,
        input_image: originalImage,
        aspect_ratio: "1:1",
        output_format: "jpg",
        safety_tolerance: 1
      };

      console.log('Flux parameters:', fluxInput);

      // Try flux-kontext-pro first, fall back to flux-dev if content is flagged
      let output;
      let modelUsed = "flux-kontext-pro";

      try {
        output = await replicate.run(
          "black-forest-labs/flux-kontext-pro",
          { input: fluxInput }
        );
      } catch (error: any) {
        if (error.message && (error.message.includes('flagged as sensitive') || error.message.includes('E005'))) {
          console.log('flux-kontext-pro flagged content as sensitive, switching to flux-dev...');
          modelUsed = "flux-dev";

          // Use flux-dev which has less restrictive content filtering
          const fluxDevInput = {
            prompt: transformPrompt,
            image: originalImage,
            guidance_scale: 15,
            num_inference_steps: 50,
            strength: 1,
            seed: seed || Math.floor(Math.random() * 1000000)
          };

          console.log('Using flux-dev with input:', fluxDevInput);

          output = await replicate.run(
            "black-forest-labs/flux-dev",
            { input: fluxDevInput }
          );
        } else {
          throw error;
        }
      }

      console.log(`Successfully generated image using ${modelUsed}`);

      console.log('Flux character transformation output type:', typeof output);

      // Handle different flux model output formats
      let frontImageUrl: string = '';

      if (output && typeof output === 'object' && 'url' in output && typeof (output as any).url === 'function') {
        // flux-kontext-pro returns an object with url() method
        const urlResult = (output as any).url();
        frontImageUrl = urlResult.toString();
        console.log('Using flux-kontext-pro URL method:', frontImageUrl);
      } else if (Array.isArray(output) && output.length > 0) {
        // flux-dev returns an array of URLs or streams
        const firstOutput = output[0];
        if (typeof firstOutput === 'string') {
          frontImageUrl = firstOutput;
        } else if (firstOutput && typeof firstOutput === 'object') {
          // Handle flux-dev binary output
          frontImageUrl = await processFluxBinaryOutput(firstOutput);
        }
        console.log('Using first image from array (flux-dev):', frontImageUrl);
      } else if (typeof output === 'string') {
        frontImageUrl = output;
        console.log('Using direct string URL:', frontImageUrl);
      } else if (output && typeof output === 'object') {
        // Handle flux binary output from Replicate
        console.log('Processing flux binary output from Replicate...');

        try {
          frontImageUrl = await processFluxBinaryOutput(output);
        } catch (fluxError) {
          console.error('Flux binary processing failed:', fluxError);
          throw new Error('Failed to process flux binary output');
        }
      } else {
        console.error('Unexpected flux output format:', typeof output, output);
        throw new Error('Invalid flux output format - expected object with url() method, array, string URL, or binary iterator');
      }

      console.log('Final extracted frontImageUrl:', frontImageUrl);

      const updatedCard = await storage.updateCard(cardId, {
        frontImageUrl,
        status: 'completed'
      });

      // 🚀 CRITICAL: Send email with card preview link after successful generation
      try {
        const user = await storage.getUser(updatedCard.userId);
        if (user?.email) {
          console.log(`✅ Card ${cardId} completed - sending preview email to ${user.email}`);
          const emailSent = await sendBackgroundEmail(cardId, user.email, user.firstName || user.email);
          if (emailSent) {
            console.log(`🎉 Email sent successfully for card ${cardId}`);
          } else {
            console.log(`⚠️ Email failed for card ${cardId} - user still gets card but no notification`);
          }
        } else {
          console.log(`⚠️ No user email found for card ${cardId} - skipping email`);
        }
      } catch (emailError: any) {
        console.error(`❌ Email error for card ${cardId}:`, emailError);
        // Continue - don't fail the card generation due to email issues
      }

      res.json(updatedCard);
    } catch (error: any) {
      console.error('Character transformation error:', error);
      res.status(500).json({ message: "Character transformation failed: " + error.message });
    }
  });

  // Style transformation using flux-kontext-max
  app.post("/api/transform-style-flux", async (req, res) => {
    try {
      const { 
        cardId, 
        originalImage, 
        prompt, 
        artStyle,
        // Optional flux parameters
        guidance_scale = 3.5,
        num_inference_steps = 28,
        seed,
        strength = 0.95,
        output_format = "png",
        safety_tolerance = 5,
        aspect_ratio = "1:1",
        output_quality = 80
      } = req.body;

      if (!cardId || !originalImage || !prompt) {
        return res.status(400).json({ message: "Card ID, original image, and prompt are required" });
      }

      if (!replicate) {
        return res.status(503).json({ message: "Replicate API not configured - REPLICATE_API_TOKEN required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      console.log('Style transformation with flux-kontext-max:', { cardId, prompt, artStyle });

      // Build transformation prompt for style change with stronger reference emphasis
      const transformPrompt = `SQUARE 1:1 ASPECT RATIO, EXACTLY 1024x1024 PIXELS. Using the provided reference image as the primary visual guide, recreate this exact person with their specific facial features, hair, and physical characteristics. ${prompt}, ${artStyle} art style. The person in the output must match the reference image exactly - same face, same hair, same physical appearance. MAINTAIN PERFECT SQUARE FORMAT 1:1 RATIO. High-quality artistic rendering, professional artwork.`;

      console.log('Flux style transformation prompt:', transformPrompt);
      console.log('Original image data length:', originalImage.length);
      console.log('Flux parameters:', { guidance_scale, num_inference_steps, strength, seed, safety_tolerance, aspect_ratio });

      const fluxInput: any = {
        input_image: originalImage,
        prompt: transformPrompt,
        guidance_scale,
        num_inference_steps,
        strength,
        output_format,
        safety_tolerance,
        aspect_ratio
      };

      if (output_format === 'jpg') {
        fluxInput.output_quality = output_quality;
      }

      if (seed) fluxInput.seed = seed;

      const output = await replicate.run(
        "black-forest-labs/flux-kontext-max",
        { input: fluxInput }
      );

      console.log('Flux style transformation output type:', typeof output);

      // Handle Replicate flux binary output
      let frontImageUrl: string = '';

      if (Array.isArray(output) && output.length > 0) {
        frontImageUrl = output[0];
        console.log('Using first image from array:', frontImageUrl);
      } else if (typeof output === 'string') {
        frontImageUrl = output;
        console.log('Using direct string URL:', frontImageUrl);
      } else if (output && typeof output === 'object') {
        // Handle flux binary output from Replicate
        console.log('Processing flux binary output from Replicate...');

        try {
          frontImageUrl = await processFluxBinaryOutput(output);
        } catch (fluxError) {
          console.error('Flux binary processing failed:', fluxError);
          throw new Error('Failed to process flux binary output');
        }
      } else {
        console.error('Unexpected flux output format:', typeof output, output);
        throw new Error('Invalid flux output format - expected array, string URL, or binary iterator');
      }

      console.log('Final extracted frontImageUrl:', frontImageUrl);

      const updatedCard = await storage.updateCard(cardId, {
        frontImageUrl,
        status: 'completed'
      });

      // 🚀 CRITICAL: Send email with card preview link after successful generation
      try {
        const user = await storage.getUser(updatedCard.userId);
        if (user?.email) {
          console.log(`✅ Card ${cardId} completed - sending preview email to ${user.email}`);
          const emailSent = await sendBackgroundEmail(cardId, user.email, user.firstName || user.email);
          if (emailSent) {
            console.log(`🎉 Email sent successfully for card ${cardId}`);
          } else {
            console.log(`⚠️ Email failed for card ${cardId} - user still gets card but no notification`);
          }
        } else {
          console.log(`⚠️ No user email found for card ${cardId} - skipping email`);
        }
      } catch (emailError: any) {
        console.error(`❌ Email error for card ${cardId}:`, emailError);
        // Continue - don't fail the card generation due to email issues
      }

      res.json(updatedCard);
    } catch (error: any) {
      console.error('Style transformation error:', error);
      res.status(500).json({ message: "Style transformation failed: " + error.message });
    }
  });

  // Scene editing using GPT-Image-1 edits API
  app.post("/api/edit-scene-gpt-image-1", async (req, res) => {
    if (!openai) {
      return res.status(500).json({ message: "OpenAI API key not configured" });
    }

    try {
      const { imageData, imageDataArray, scenePrompt, style, includeText, cardText, userClothing, userArtStyle } = req.body;

      // ALWAYS FORCE SQUARE ASPECT RATIO - IGNORE ANY SIZE PARAMETER
      const size = '1024x1024';

      // Support both single image (legacy) and multiple images (new)
      const imagesToProcess = imageDataArray || (imageData ? [imageData] : []);

      if (imagesToProcess.length === 0 || !scenePrompt) {
        return res.status(400).json({ message: "Image data and scene description are required" });
      }

      console.log('🎯 STARTING /api/edit-scene-gpt-image-1 - SCENE EDIT REQUEST');
      console.log('Processing GPT-Image-1 scene edit request with scene:', scenePrompt);
      console.log('Art style:', userArtStyle || 'AI_DECIDE');
      console.log('Number of images:', imagesToProcess.length);
      console.log('Scene prompt:', scenePrompt);
      console.log('Style:', style);
      console.log('Include text:', includeText);
      console.log('Card text:', cardText);
      console.log('Requested size:', size);

      // Use detected person count if provided, otherwise fall back to image count
      // No longer need to detect people count since we use naturally inclusive language
      
      // Build the complete prompt using naturally inclusive language
      const characterText = 'characters from the reference images';
      // ALWAYS FORCE SQUARE ASPECT RATIO - NO PORTRAIT ALLOWED
      const aspectDescription = 'MANDATORY: Create a perfectly SQUARE composition with equal width and height - NOT portrait, NOT landscape. Full bleed square design with no borders, fill entire square frame.';
      const formatInstruction = 'COMPOSE FOR SQUARE FORMAT - ensure all elements fit within a square boundary';
      
      const faceAnalysisText = 'ANALYZE EACH FACE IN DETAIL';
      const faceRecreationText = 'RECREATE EACH IDENTICAL FACE';
      const characterPositioning = 'Place the characters';
      const characterPoses = 'Give the characters';
      const clothingInstruction = 'dress the characters appropriately';
      const positioningInstruction = 'Reimagine character positioning and interactions';

      // Build clothing requirements section
      let clothingSection = '';
      if (userClothing && userClothing.trim()) {
        clothingSection = `CLOTHING REQUIREMENTS: The scene description includes specific clothing requirements. Dress the character(s) exactly as described: ${userClothing}`;
      } else {
        clothingSection = `CLOTHING REQUIREMENTS: Choose scene-appropriate clothing that fits the new environment and activity. Change the clothing completely from the reference photo to match the scenario while maintaining identical faces only.`;
      }

      // Build art style section
      let styleSection = '';
      if (userArtStyle && userArtStyle.trim() && userArtStyle !== 'ai_decide') {
        styleSection = `ARTISTIC STYLE APPLICATION: Apply the user-specified artistic style: ${userArtStyle}. Render the entire image consistently in this style while maintaining high artistic quality and visual cohesion.`;
      } else {
        styleSection = `ARTISTIC STYLE APPLICATION: DYNAMIC STYLE SELECTION: Analyze the scene description and intelligently choose the most appropriate artistic style that best complements the mood, atmosphere, setting, and emotional tone of this specific scene.

Consider artistic styles such as:
- Watercolor painting (for soft, dreamy, romantic scenes)
- Oil painting (for classical, elegant, formal celebrations)
- Digital illustration (for modern, contemporary settings)
- Fantasy art (for magical, mystical, fairytale scenes)
- Storybook illustration (for whimsical, children's book-style scenes)
- Impressionistic (for atmospheric, mood-focused scenes)
- Contemporary art (for urban, trendy, modern celebrations)
- Realistic photography style (for authentic, documentary-style moments)
- Vintage illustration (for retro, nostalgic, classic scenes)
- Comic book style (for dynamic, energetic, fun celebrations)
- Minimalist design (for clean, simple, sophisticated scenes)
- Renaissance painting (for grand, ornate, classical scenes)
- Anime/manga style (for vibrant, expressive, youthful scenes)
- Art nouveau (for decorative, elegant, artistic scenes)

Choose the single artistic style that creates the most contextually appropriate, visually stunning, and emotionally resonant result for this specific scene.`;
      }

      let fullPrompt = `${aspectDescription} ABSOLUTE PRIORITY: FACIAL ACCURACY FIRST - Before applying any artistic style, the EXACT facial likeness from the reference photo(s) must be preserved with absolute precision in the new scene.

MANDATORY FACIAL RECREATION REQUIREMENTS FOR ALL CHARACTERS IN THE REFERENCE PHOTO(S) (COMPLETE BEFORE ANY STYLING):
1) FACIAL STRUCTURE MATCH: Recreate the EXACT facial bone structure - same cheekbone height, same jawline angle, same forehead shape, same chin projection
2) EYE PRECISION: Match exact eye shape (almond, round, hooded), eye spacing, eyelid fold pattern, iris color, eyebrow shape and arch
3) NOSE ACCURACY: Replicate precise nose bridge width, nostril shape, nose tip definition, any bumps or unique nose characteristics  
4) MOUTH DUPLICATION: Copy exact lip fullness, mouth width, corner shape, any asymmetries or distinctive mouth features
5) SKIN MATCHING: Preserve exact skin tone, texture, any blemishes, freckles, moles, or distinctive skin characteristics
6) HAIR PRECISION: Match exact hair color, texture, natural growth patterns, hairline shape
7) DISTINCTIVE MARKS: Include any scars, dimples, laugh lines, or other identifying facial features
8) CRITICAL EXPRESSION CHANGE: DO NOT copy the original facial expression from the reference photo. You must create a COMPLETELY NEW facial expression that matches the mood and energy of the new scene

AFTER ESTABLISHING PERFECT LIKENESS - SCENE CREATION:
Create a completely new scene featuring the character(s) from the reference photo(s).

COMPOSITION RULES:
- Show the character(s) actively participating in the new scene, not just posing
- Include relevant background elements that tell the story of the scene
- Use full-body or three-quarter shots that tell the story of the scene
- Create immersive scene composition that showcases the environment
- SCENE-APPROPRIATE EXPRESSION: The character(s) must display a brand NEW facial expression that perfectly captures the energy and mood of this specific scene
- COMPLETELY IGNORE ORIGINAL PHOTO COMPOSITION: Do NOT copy the positioning, framing, or body placement from the reference photo. The reference is ONLY for facial features
- CREATIVE POSITIONING REQUIRED: Position character(s) in completely different positions that showcase the full scene context
- DYNAMIC POSES AND INTERACTIONS: Create completely new poses that are appropriate for the scene activity and energy level
- ENVIRONMENTAL INTEGRATION: Reimagine character positioning and interactions for the new environment to create an immersive scene composition

SCENE DESCRIPTION: ${scenePrompt}

${clothingSection}

${styleSection}`;
      // Add typography integration
      fullPrompt = `${fullPrompt}\n\nTYPOGRAPHY INTEGRATION: Naturally integrate text into the scene as part of the artistic composition - text should appear carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements, ensuring clear legibility while feeling like an organic part of the scene rather than overlaid text.`;
      
      if (includeText && cardText && cardText.trim()) {
        fullPrompt = `${fullPrompt}. STRICT TEXT RESTRICTION: Add EXACTLY and ONLY the text "${cardText}" - ABSOLUTELY NO OTHER TEXT, WORDS, LETTERS, NUMBERS, SIGNS, LABELS, OR WRITING of any kind should appear anywhere in the image. CRITICAL: Do NOT overlay text on top of the image. Instead, naturally integrate ONLY this specific text into the scene as part of the artistic composition. The text should appear as if it belongs in this specific environment - carved into surfaces, written in natural elements, displayed on signs, formed by scene elements, or integrated into the background architecture. FORBIDDEN: Do not add any background text, signage, labels, captions, watermarks, logos, brand names, location names, or any other written content. Typography should match the artistic style and complement the scene's natural elements.`;
      }
      fullPrompt = `${fullPrompt}. High-quality artistic rendering, professional artwork.`;

      console.log('🎯 PATH 2 - DETAILED FACIAL RECREATION TO GPT-IMAGE-1:', fullPrompt);
      console.log('Complete prompt for scene editing:', fullPrompt);
      console.log('=== DEBUG: EXACT DETAILED FACIAL RECREATION PROMPT ===');
      console.log(fullPrompt);
      console.log('=== END DETAILED PROMPT ===');

      try {
        console.log('Making GPT-Image-1 scene edit API request using direct HTTP form-data');

        // Use form-data package for proper multipart form handling
        const formData = new FormData();

        // Add all images to the form data with image[] parameter names
        imagesToProcess.forEach((imageData: string, index: number) => {
          // Extract MIME type and base64 data
          const mimeMatch = imageData.match(/^data:image\/([a-z]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'png';
          const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');

          console.log(`Image ${index + 1} buffer size:`, imageBuffer.length, 'bytes, MIME type:', mimeType);

          // Add image buffer with proper metadata using image[] parameter name
          formData.append('image[]', imageBuffer, {
            filename: `image${index + 1}.${mimeType}`,
            contentType: `image/${mimeType}`
          });
        });

        formData.append('prompt', fullPrompt);
        formData.append('model', 'gpt-image-1');
        formData.append('n', '1');
        formData.append('size', '1024x1024');
        formData.append('quality', 'high');
        formData.append('moderation', 'low');
        formData.append('background', 'auto');

        // Use node-fetch with proper FormData handling
        const fetch = (await import('node-fetch')).default;
        const response = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            ...formData.getHeaders()
          },
          body: formData
        });

        // Add timeout handling for GPT-Image-1 requests - increased for complex processing
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('GPT-Image-1 scene edit request timed out after 4 minutes - complex processing may take time')), 240000);
        });

        const responsePromise = (async () => {
          if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: { message: errorText } };
            }
            throw new Error(`GPT-Image-1 API error: ${response.status} ${errorData.error?.message || 'Unknown error'}`);
          }

          return await response.json();
        })();

        const responseData = await Promise.race([responsePromise, timeoutPromise]);

        console.log('GPT-Image-1 scene edit response received successfully');

        // Extract image URL from response
        let imageUrl: string = '';
        if (responseData && (responseData as any).data && Array.isArray((responseData as any).data) && (responseData as any).data.length > 0) {
          const imageResult = (responseData as any).data[0];

          if (imageResult.b64_json) {
            imageUrl = `data:image/png;base64,${imageResult.b64_json}`;
            console.log('Generated base64 image URL successfully');
          } else if (imageResult.url) {
            imageUrl = imageResult.url;
            console.log('Generated image URL:', imageResult.url);
          } else {
            throw new Error('No image data received from GPT-Image-1');
          }
        } else {
          throw new Error('Invalid response format from GPT-Image-1 API');
        }

        console.log('GPT-Image-1 scene editing completed successfully');

        // CRITICAL: PNG-ONLY WORKFLOW - Convert to PNG immediately and use PNG files throughout
        const { cardId } = req.body;
        
        if (cardId) {
          console.log('[PNG_ONLY] Converting scene image to PNG with OPTIMIZED parallel processing...');
          
          try {
            const pngStartTime = Date.now();
            
            // PERFORMANCE OPTIMIZATION: Run PNG operations in parallel
            const [unwatermarkedFrontPngUrl, frontImagePngUrl] = await Promise.all([
              // Step 1: Convert base64 to PNG file immediately (unwatermarked original)
              convertBase64ToPngFile(imageUrl, cardId, 'front_unwatermarked'),
              // Step 2: Apply watermark directly to base64 and save as PNG (parallel processing)
              (async () => {
                const watermarkedBase64 = await applyWatermark(imageUrl, 0.25);
                return await convertBase64ToPngFile(watermarkedBase64, cardId, 'front');
              })()
            ]);
            
            const totalPngDuration = Date.now() - pngStartTime;
            console.log(`[PNG_ONLY] OPTIMIZED front PNG processing completed in ${totalPngDuration}ms (parallel processing)`);
            console.log('[PNG_ONLY] Created unwatermarked front:', unwatermarkedFrontPngUrl);
            console.log('[PNG_ONLY] Created watermarked front:', frontImagePngUrl);
          
            res.json({ 
              imageUrl: frontImagePngUrl, // Return PNG file URL instead of Base64
              originalImageUrl: imageUrl, // Store original for secure access
              usage: (responseData as any).usage
            });
          } catch (pngError: any) {
            console.error('[PNG_ONLY] Error during PNG processing:', pngError);
            // Fallback to original response if PNG processing fails
            const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);
            console.log('PNG processing failed, using base64 watermark fallback');
            
            res.json({ 
              imageUrl: watermarkedImageUrl,
              originalImageUrl: imageUrl,
              usage: (responseData as any).usage
            });
          }
        } else {
          // Fallback for requests without cardId (legacy support)
          const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);
          console.log('Watermark applied to front image (legacy fallback)');
          
          res.json({ 
            imageUrl: watermarkedImageUrl,
            originalImageUrl: imageUrl,
            usage: (responseData as any).usage
          });
        }

      } catch (error: any) {
        console.error('GPT-Image-1 FormData scene edit error details:', error);

        // Handle specific API errors
        if (error.message?.includes('400')) {
          if (error.message?.includes('model') || error.message?.includes('model_not_found')) {
            throw new Error('GPT-Image-1 model is not available with your current OpenAI API access. This model may require special permissions.');
          } else if (error.message?.includes('multipart') || error.message?.includes('form-data')) {
            throw new Error('Image upload format error. Please ensure the image is valid.');
          } else {
            throw new Error(`GPT-Image-1 API error: ${error.message}`);
          }
        } else if (error.message?.includes('401')) {
          throw new Error('OpenAI API authentication failed. Please check your API key.');
        } else if (error.message?.includes('429')) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else if (error.message?.includes('500')) {
          throw new Error('OpenAI API server error. Please try again later.');
        } else {
          throw new Error(`GPT-Image-1 scene edit error: ${error.message || 'Unknown error'}`);
        }
      }

    } catch (error: any) {
      console.error('GPT-Image-1 scene edit error:', error);

      // Use enhanced error handler
      const { mapOpenAIError } = await import('../shared/openaiErrorHandler');
      const mappedError = mapOpenAIError(error);
      
      console.log('🔍 MAPPED ERROR:', mappedError);

      res.status(mappedError.http).json({ 
        message: mappedError.userMessage, 
        isSafetyError: mappedError.kind === 'safety',
        errorType: mappedError.kind === 'safety' ? 'safety_filter' : mappedError.kind,
        errorKind: mappedError.kind,
        title: mappedError.title,
        techMessage: mappedError.techMessage,
        code: mappedError.code
      });
    }
  });

  // Generate inside card with style analysis from front card
  app.post("/api/generate-inside-card", async (req, res) => {
    const requestStartTime = Date.now();
    console.log('[TIMING] Inside card generation request started');
    
    // Set longer timeout for this specific request
    req.setTimeout(600000); // 10 minute timeout
    res.setTimeout(600000); // 10 minute timeout
    
    if (!openai) {
      return res.status(500).json({ message: "OpenAI API key not configured" });
    }

    try {
      const { frontCardImage, insideText, artStyle, size = '1024x1024' } = req.body;

      if (!frontCardImage || !insideText) {
        return res.status(400).json({ message: "Front card image and inside text are required" });
      }

      // Validate size parameter
      if (!['1024x1024', '1024x1536'].includes(size)) {
        return res.status(400).json({ message: "Size must be either 1024x1024 or 1024x1536" });
      }

      console.log('Generating inside card using GPT-Image-1 image-to-image');
      console.log('Inside text:', insideText);
      console.log('Requested size:', size);

      // Handle both base64 data and PNG file URLs
      let imageBuffer: Buffer;
      let mimeType: string;
      
      if (frontCardImage.startsWith('data:image/')) {
        // Handle base64 data URLs
        const base64Data = frontCardImage.replace(/^data:image\/[a-z]+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
        const mimeMatch = frontCardImage.match(/^data:image\/([a-z]+);base64,/);
        mimeType = mimeMatch ? mimeMatch[1] : 'png';
      } else if (frontCardImage.startsWith('/images/')) {
        // Handle PNG file URLs - read the file from disk
        const fs = await import('fs');
        const path = await import('path');
        const filePath = path.join(process.cwd(), 'stored_images', frontCardImage.replace('/images/', ''));
        try {
          imageBuffer = await fs.promises.readFile(filePath);
          mimeType = 'png';
        } catch (error) {
          console.error('Error reading front card PNG file:', error);
          throw new Error('Failed to read front card image file');
        }
      } else {
        throw new Error('Invalid front card image format. Expected base64 data URL or PNG file URL');
      }

      console.log('Front card image buffer size:', imageBuffer.length, 'bytes, MIME type:', mimeType);

      // Parse inside message into structured greeting card components
      const parseInsideMessage = (text: string) => {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Look for greeting patterns (Dear X, Hi X, etc.)
        const greetingPatterns = /^(dear|hi|hello|hey)\s+[^,]+[,]?/i;
        // Look for signature patterns (Love X, From X, -X, etc.)
        const signaturePatterns = /^(love|from|yours|sincerely|best|cheers|xoxo|\-|♥)\s*.+$/i;
        
        let greeting = null;
        let message = [];
        let signature = null;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          if (i === 0 && greetingPatterns.test(line)) {
            greeting = line;
          } else if (i === lines.length - 1 && signaturePatterns.test(line)) {
            signature = line;
          } else if (signature === null && signaturePatterns.test(line)) {
            signature = line;
          } else {
            message.push(line);
          }
        }
        
        // If no structured components found, treat as simple message
        if (!greeting && !signature) {
          return null;
        }
        
        return {
          dear: greeting,
          message: message.join(' '),
          from: signature
        };
      };
      
      const structuredData = parseInsideMessage(insideText);
      console.log('Parsed inside message structure:', structuredData);
      
      // Use the enhanced buildInsidePrompt function for proper style matching
      const { buildInsidePrompt } = await import('../shared/prompts');
      const insideCardPrompt = buildInsidePrompt(
        insideText, 
        artStyle || 'artistic', 
        undefined, 
        undefined, 
        structuredData
      );

      console.log('Inside card prompt:', insideCardPrompt);

      // Use form-data approach with GPT-Image-1 edits API
      const formData = new FormData();

      // Add image buffer with proper metadata
      formData.append('image', imageBuffer, {
        filename: `front-card.${mimeType}`,
        contentType: `image/${mimeType}`
      });
      console.log('🎯 INSIDE CARD - EXACT PROMPT SENT TO GPT-IMAGE-1:');
      console.log('=== DEBUG: INSIDE CARD PROMPT START ===');
      console.log(insideCardPrompt);
      console.log('=== DEBUG: INSIDE CARD PROMPT END ===');
      
      formData.append('prompt', insideCardPrompt);
      formData.append('model', 'gpt-image-1');
      formData.append('n', '1');
      formData.append('size', size);
      formData.append('quality', 'high');
      formData.append('moderation', 'low');
      formData.append('background', 'auto');

      const fetch = (await import('node-fetch')).default;
      const apiStartTime = Date.now();
      console.log('[TIMING] Starting OpenAI API call...');
      
      const response = await fetch('https://api.openai.com/v1/images/edits', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          ...formData.getHeaders()
        },
        body: formData
      });
      
      const apiDuration = Date.now() - apiStartTime;
      console.log(`[TIMING] OpenAI API call completed in ${apiDuration}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }
        throw new Error(`GPT-Image-1 API error: ${response.status} ${errorData.error?.message || 'Unknown error'}`);
      }

      const responseData = await response.json();

      let imageUrl: string = '';
      if (responseData && (responseData as any).data && Array.isArray((responseData as any).data) && (responseData as any).data.length > 0) {
        const imageResult = (responseData as any).data[0];

        if (imageResult.b64_json) {
          imageUrl = `data:image/png;base64,${imageResult.b64_json}`;
          console.log('Generated inside card base64 image URL successfully');
        } else if (imageResult.url) {
          imageUrl = imageResult.url;
          console.log('Generated inside card image URL:', imageResult.url);
        } else {
          throw new Error('No image data received from GPT-Image-1');
        }
      } else {
        throw new Error('Invalid response format from GPT-Image-1 API');
      }

      console.log('Inside card generation completed successfully');

      // CRITICAL: PNG-ONLY WORKFLOW - Convert to PNG immediately and use PNG files throughout
      const { cardId } = req.body;
      
      if (cardId) {
        const pngStartTime = Date.now();
        console.log('[PNG_TIMING] Starting OPTIMIZED PNG conversion process...');
        
        try {
          // PERFORMANCE OPTIMIZATION: Run PNG operations in parallel
          const [unwatermarkedInsidePngUrl, insideImagePngUrl] = await Promise.all([
            // Step 1: Convert base64 to PNG file immediately (unwatermarked original)
            convertBase64ToPngFile(imageUrl, cardId, 'inside_unwatermarked'),
            // Step 2: Apply watermark directly to base64 and save as PNG (parallel processing)
            (async () => {
              const watermarkedBase64 = await applyWatermark(imageUrl, 0.25);
              return await convertBase64ToPngFile(watermarkedBase64, cardId, 'inside');
            })()
          ]);
          
          const totalPngDuration = Date.now() - pngStartTime;
          console.log(`[PNG_TIMING] OPTIMIZED PNG processing completed in ${totalPngDuration}ms (parallel processing)`);
          console.log(`[PNG_TIMING] Created unwatermarked: ${unwatermarkedInsidePngUrl}`);
          console.log(`[PNG_TIMING] Created watermarked: ${insideImagePngUrl}`);
        
          // Ensure response is sent immediately after PNG creation
          console.log('[PNG_ONLY] Sending response with PNG file URL:', insideImagePngUrl);
          
          // Check if response is still writable before sending
          if (!res.headersSent) {
            const responsePayload = { 
              imageUrl: insideImagePngUrl, // Return PNG file URL instead of Base64
              originalImageUrl: imageUrl, // Store original for secure access
              usage: (responseData as any).usage
            };
            
            res.json(responsePayload);
            const totalRequestDuration = Date.now() - requestStartTime;
            console.log(`[TIMING] Complete inside card generation finished in ${totalRequestDuration}ms`);
            console.log('[PNG_ONLY] Response sent successfully');
          } else {
            const totalRequestDuration = Date.now() - requestStartTime;
            console.log(`[TIMING] Headers already sent after ${totalRequestDuration}ms - connection may have timed out`);
          }
        } catch (pngError) {
          console.error('PNG processing error:', pngError);
          // Fallback to original response without PNG conversion
          const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);
          console.log('Watermark applied to inside card (PNG fallback)');
          
          res.json({ 
            imageUrl: watermarkedImageUrl,
            originalImageUrl: imageUrl,
            usage: (responseData as any).usage
          });
        }
      } else {
        // Fallback for requests without cardId (legacy support)
        const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);
        console.log('Watermark applied to inside card (legacy fallback)');
        
        res.json({ 
          imageUrl: watermarkedImageUrl,
          originalImageUrl: imageUrl,
          usage: (responseData as any).usage
        });
      }

    } catch (error: any) {
      console.error('Inside card generation error:', error);

      // Use enhanced error handler
      const { mapOpenAIError } = await import('../shared/openaiErrorHandler');
      const mappedError = mapOpenAIError(error);
      
      console.log('🔍 MAPPED ERROR:', mappedError);

      res.status(mappedError.http).json({ 
        message: mappedError.userMessage, 
        isSafetyError: mappedError.kind === 'safety',
        errorType: mappedError.kind === 'safety' ? 'safety_filter' : mappedError.kind,
        errorKind: mappedError.kind,
        title: mappedError.title,
        techMessage: mappedError.techMessage,
        code: mappedError.code
      });
    }
  });

  // Remove watermarks after payment verification
  app.post("/api/remove-watermarks", async (req, res) => {
    try {
      const { cardId } = req.body;

      if (!cardId) {
        return res.status(400).json({ message: "Card ID is required" });
      }

      console.log('Removing watermarks for card:', cardId);

      // Get card from storage
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Switch to unwatermarked file URLs
      const frontFileUrl = getImageUrl(cardId, 'front');
      const insideFileUrl = card.insideImageUrl ? getImageUrl(cardId, 'inside') : null;

      // Update card to use file URLs instead of Base64
      const updatedCard = await storage.updateCard(cardId, {
        frontImageUrl: frontFileUrl,
        insideImageUrl: insideFileUrl,
        status: 'paid'
      });

      console.log('Watermarks removed - switched to file serving');
      res.json({ 
        success: true,
        card: updatedCard
      });

    } catch (error: any) {
      console.error('Watermark removal error:', error);
      res.status(500).json({ message: 'Failed to remove watermarks' });
    }
  });

  // GPT-Image-1 style transformation using OpenAI SDK as per documentation
  app.post("/api/transform-style-dall-e-3", async (req, res) => {
    const requestStartTime = Date.now();
    console.log('[TIMING] Style transformation request started');
    
    // Set longer timeout for this specific request
    req.setTimeout(600000); // 10 minute timeout
    res.setTimeout(600000); // 10 minute timeout
    
    try {
      if (!hasOpenAI || !openai) {
        return res.status(503).json({ message: "OpenAI API is not configured" });
      }

      const { imageData, imageDataArray, style, size = '1024x1024' } = req.body;

      // Support both single image (legacy) and multiple images (new)
      const imagesToProcess = imageDataArray || (imageData ? [imageData] : []);

      if (imagesToProcess.length === 0 || !style) {
        return res.status(400).json({ message: "Image data and style are required" });
      }

      // Validate size parameter
      if (!['1024x1024', '1024x1536'].includes(size)) {
        return res.status(400).json({ message: "Size must be either 1024x1024 or 1024x1536" });
      }

      console.log('GPT-Image-1 style transformation with style:', style);
      console.log('Number of images:', imagesToProcess.length);

      // Enhance the style prompt to explicitly preserve photo content while transforming style
      const aspectDescription = size === '1024x1536' 
        ? 'Render as a portrait image with 2:3 aspect ratio (height is 1.5x the width). The final output must be portrait-formatted.'
        : 'Render as a perfectly square image with 1:1 aspect ratio (width equals height). The final output must be square-formatted, not portrait or landscape.';
      
      // DYNAMIC STYLE SELECTION: For style transformation, use the original style request
      // This endpoint is for transforming existing images to different styles, so we respect the user's style choice
      let enhancedStyle = style;
      
      const transformPrompt = `Transform this image into ${enhancedStyle} art style. CRITICAL REQUIREMENTS: 1) Keep the EXACT same person, pose, composition, background, and all visual elements from the original photo - DO NOT change anything about the content, scene, or subject matter. 2) ONLY transform the artistic style/rendering technique to ${enhancedStyle} while preserving every detail of the original image. 3) The person must look identical to the original photo - same facial features, expression, clothing, positioning. 4) ${aspectDescription}`;
      console.log('GPT-Image-1 transformation prompt:', transformPrompt);
      console.log('GPT-Image-1 requested size:', size);

      try {
        console.log('Making GPT-Image-1 API request using direct HTTP form-data');
        console.log('🔍 DEBUG: Requested size parameter:', size);

        // Use form-data package for proper multipart form handling
        const formData = new FormData();

        // Add all images to the form data with image[] parameter names
        imagesToProcess.forEach((imageData: string, index: number) => {
          // Extract MIME type and base64 data
          const mimeMatch = imageData.match(/^data:image\/([a-z]+);base64,/);
          const mimeType = mimeMatch ? mimeMatch[1] : 'png';
          const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');

          console.log(`Image ${index + 1} buffer size:`, imageBuffer.length, 'bytes, MIME type:', mimeType);

          // Add image buffer with proper metadata using image[] parameter name
          formData.append('image[]', imageBuffer, {
            filename: `image${index + 1}.${mimeType}`,
            contentType: `image/${mimeType}`
          });
        });

        console.log('🎯 FRONT CARD /api/edit-scene-gpt-image-1 - EXACT PROMPT SENT TO GPT-IMAGE-1:');
        console.log('=== DEBUG: FRONT CARD SCENE EDIT PROMPT START ===');
        console.log(transformPrompt);
        console.log('=== DEBUG: FRONT CARD SCENE EDIT PROMPT END ===');
        
        formData.append('prompt', transformPrompt);
        formData.append('model', 'gpt-image-1');
        formData.append('n', '1');
        formData.append('size', size);
        formData.append('quality', 'high');
        formData.append('moderation', 'low');

        console.log('📋 Form data parameters being sent:');
        console.log('- model:', 'gpt-image-1');
        console.log('- size:', size);
        console.log('- quality:', 'medium');
        console.log('- prompt length:', transformPrompt.length);
        console.log('- moderation:', 'low');
        console.log('- n:', '1');

        // Use node-fetch with proper FormData handling
        const fetch = (await import('node-fetch')).default;

        console.log('🌐 EXACT API CALL DETAILS:');
        console.log('   Endpoint: https://api.openai.com/v1/images/edits');
        console.log('   Method: POST');
        console.log('   Content-Type: multipart/form-data');
        console.log('   Authorization: Bearer [API_KEY_PRESENT]');

        const response = await fetch('https://api.openai.com/v1/images/edits', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            ...formData.getHeaders()
          },
          body: formData
        });

        // Add timeout handling for GPT-Image-1 requests
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('GPT-Image-1 request timed out - this model may require special OpenAI API access')), 120000);
        });

        const responsePromise = (async () => {
          if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
              errorData = JSON.parse(errorText);
            } catch {
              errorData = { error: { message: errorText } };
            }
            throw new Error(`GPT-Image-1 API error: ${response.status} ${errorData.error?.message || 'Unknown error'}`);
          }

          return await response.json();
        })();

        const responseData = await Promise.race([responsePromise, timeoutPromise]);

        console.log('GPT-Image-1 response received successfully');

        // Extract image URL from response
        let imageUrl: string = '';
        if (responseData && (responseData as any).data && Array.isArray((responseData as any).data) && (responseData as any).data.length > 0) {
          const imageResult = (responseData as any).data[0];

          if (imageResult.b64_json) {
            imageUrl = `data:image/png;base64,${imageResult.b64_json}`;
            console.log('Generated base64 image URL successfully');

            // Check actual image dimensions by decoding the base64
            const imageBuffer = Buffer.from(imageResult.b64_json, 'base64');
            console.log('Generated image buffer size:', imageBuffer.length, 'bytes');

            // Try to extract image dimensions from image header
            if (imageBuffer.length > 24) {
              const signature = imageBuffer.toString('hex', 0, 8);
              console.log('🔍 Image signature:', signature);

              let width, height;

              // PNG signature: 89504e470d0a1a0a
              if (signature === '89504e470d0a1a0a') {
                width = imageBuffer.readUInt32BE(16);
                height = imageBuffer.readUInt32BE(20);
                console.log('📏 PNG DIMENSIONS:', width, 'x', height);
              }
              // JPEG signature: ffd8ff
              else if (signature.startsWith('ffd8ff')) {
                console.log('📸 JPEG detected - checking for SOF marker');
                // Look for SOF (Start of Frame) marker to get dimensions
                for (let i = 2; i < imageBuffer.length - 8; i++) {
                  if (imageBuffer[i] === 0xFF && imageBuffer[i + 1] === 0xC0) {
                    height = imageBuffer.readUInt16BE(i + 5);
                    width = imageBuffer.readUInt16BE(i + 7);
                    console.log('📏 JPEG DIMENSIONS:', width, 'x', height);
                    break;
                  }
                }
              }
              // WebP signature: 52494646
              else if (signature.startsWith('52494646')) {
                console.log('🖼️ WebP detected');
                if (imageBuffer.toString('ascii', 8, 12) === 'WEBP') {
                  // Simple WebP format
                  width = imageBuffer.readUInt16LE(26) + 1;
                  height = imageBuffer.readUInt16LE(28) + 1;
                  console.log('📏 WebP DIMENSIONS:', width, 'x', height);
                }
              }

              if (width && height) {
                console.log('🎯 ACTUAL IMAGE DIMENSIONS:', width, 'x', height);
                console.log('📐 Image aspect ratio:', (width/height).toFixed(3));
                console.log('📋 Requested dimensions: 1024x1024 (ratio: 1.000)');

                if (width !== height) {
                  console.log('⚠️ WARNING: OpenAI returned NON-SQUARE image!');
                  console.log('   Requested: 1024x1024 (square)');
                  console.log('   Received:', width, 'x', height, '(', width > height ? 'landscape' : 'portrait', ')');
                  console.log('   This explains why the image appears cropped in UI');
                } else if (width === 1024 && height === 1024) {
                  console.log('✅ Perfect! Image is exactly 1024x1024 as requested');
                } else {
                  console.log('⚠️ Image is square but wrong size:', width, 'x', height, '(expected 1024x1024)');
                }
              } else {
                console.log('❌ Could not determine image dimensions from header');
              }
            }
          } else if (imageResult.url) {
            imageUrl = imageResult.url;
            console.log('Generated image URL:', imageResult.url);
          } else {
            throw new Error('No image data received from GPT-Image-1');
          }
        } else {
          throw new Error('Invalid response format from GPT-Image-1 API');
        }

        console.log('GPT-Image-1 transformation completed successfully');

        // CRITICAL: PNG-ONLY WORKFLOW - Convert to PNG immediately and use PNG files throughout
        const { cardId } = req.body;
        
        if (cardId) {
          console.log('[PNG_ONLY] Converting transformed image to PNG and creating watermarked/unwatermarked versions...');
          
          try {
            // Step 1: Convert base64 to PNG file immediately (unwatermarked original)
            const unwatermarkedFrontPngUrl = await convertBase64ToPngFile(imageUrl, cardId, 'front_unwatermarked');
            console.log('[PNG_ONLY] Unwatermarked front PNG created:', unwatermarkedFrontPngUrl);
            
            // Step 2: Apply watermark to PNG file and create watermarked PNG file
            const frontImagePngUrl = await applyWatermarkToPngFile(cardId, 'front_unwatermarked', 'front');
            console.log('[PNG_ONLY] Watermarked front PNG created:', frontImagePngUrl);
            
            // Check if response is still writable before sending
            if (!res.headersSent) {
              const responsePayload = { 
                imageUrl: frontImagePngUrl, // Return PNG file URL instead of Base64
                originalImageUrl: imageUrl // Store original for secure access
              };
              
              res.json(responsePayload);
              const totalRequestDuration = Date.now() - requestStartTime;
              console.log(`[TIMING] Complete style transformation finished in ${totalRequestDuration}ms`);
              console.log('[PNG_ONLY] Transform response sent successfully');
            } else {
              const totalRequestDuration = Date.now() - requestStartTime;
              console.log(`[TIMING] Headers already sent after ${totalRequestDuration}ms - connection may have timed out`);
            }
          } catch (pngError: any) {
            console.error('[PNG_ONLY] Error during PNG processing:', pngError);
            // Fallback to original response if PNG processing fails
            const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);
            console.log('PNG processing failed, using base64 watermark fallback');
            
            res.json({ 
              imageUrl: watermarkedImageUrl,
              originalImageUrl: imageUrl
            });
          }
        } else {
          // Fallback for requests without cardId (legacy support)
          const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);
          console.log('Watermark applied to transformed image (legacy fallback)');
          
          res.json({ 
            imageUrl: watermarkedImageUrl,
            originalImageUrl: imageUrl
          });
        }

      } catch (error: any) {

        console.error('GPT-Image-1 FormData error details:', error);

        // Handle specific API errors
        if (error.message?.includes('400')) {
          if (error.message?.includes('model') || error.message?.includes('model_not_found')) {
            throw new Error('GPT-Image-1 model is not available with your current OpenAI API access. This model may require special permissions.');
          } else if (error.message?.includes('multipart') || error.message?.includes('form-data')) {
            throw new Error('Image upload format error. Please ensure the image is valid.');
          } else {
            throw new Error(`GPT-Image-1 API error: ${error.message}`);
          }
        } else if (error.message?.includes('401')) {
          throw new Error('OpenAI API authentication failed. Please check your API key.');
        } else if (error.message?.includes('429')) {
          throw new Error('OpenAI API rate limit exceeded. Please try again later.');
        } else if (error.message?.includes('500')) {
          throw new Error('OpenAI API server error. Please try again later.');
        } else {
          throw new Error(`GPT-Image-1 error: ${error.message || 'Unknown error'}`);
        }
      }
    } catch (error: any) {
      console.error('GPT-Image-1 transformation error:', error);
      res.status(500).json({ message: "GPT-Image-1 transformation failed: " + error.message });
    }
  });

  // Update card images after GPT-Image-1 generation
  app.post("/api/update-card-images", async (req, res) => {
    try {
      const { cardId, frontImageUrl, insideImageUrl, conversationData, status } = req.body;

      if (!cardId || !frontImageUrl) {
        return res.status(400).json({ message: "Card ID and front image URL are required" });
      }

      const updates: any = {
        frontImageUrl,
        status: status || 'completed'
      };

      if (insideImageUrl) {
        updates.insideImageUrl = insideImageUrl;
      }

      if (conversationData) {
        updates.conversationData = conversationData;
      }

      const updatedCard = await storage.updateCard(cardId, updates);

      if (!updatedCard) {
        return res.status(404).json({ message: "Card not found" });
      }

      console.log('Card updated successfully with images');
      res.json(updatedCard);
    } catch (error: any) {
      console.error('Update card error:', error);
      res.status(500).json({ message: "Failed to update card: " + error.message });
    }
  });

  // Send card ready notification email with polling
  app.post("/api/send-card-ready-notification", async (req, res) => {
    try {
      const { cardId, customerEmail, customerName } = req.body;

      if (!cardId || !customerEmail || !customerName) {
        return res.status(400).json({ message: "Card ID, customer email, and name are required" });
      }

      console.log('Starting email notification process for card:', cardId);

      // Function to check if card is ready
      const isCardReady = async () => {
        const card = await storage.getCard(parseInt(cardId));
        if (!card) {
          return { ready: false, error: "Card not found" };
        }
        
        console.log(`Card ${cardId} raw data:`, JSON.stringify(card, null, 2));

        // Check if both front and inside images are ready (support both base64 and PNG file URLs)
        const frontReady = card.frontImageUrl && (card.frontImageUrl.startsWith('data:image/') || card.frontImageUrl.startsWith('/images/'));
        const insideReady = !card.insideImageUrl || card.insideImageUrl.startsWith('data:image/') || card.insideImageUrl.startsWith('/images/');

        console.log(`Card ${card.id} image readiness check:`, {
          frontImageUrl: card.frontImageUrl ? 'present' : 'null',
          frontImageUrlValue: card.frontImageUrl,
          frontReady,
          insideImageUrl: card.insideImageUrl ? 'present' : 'null',
          insideImageUrlValue: card.insideImageUrl,
          insideReady,
          status: card.status
        });

        if (!frontReady || !insideReady) {
          return { ready: false, card };
        }

        // Check if image data is substantial (support both base64 and PNG files)
        if (card.frontImageUrl) {
          try {
            if (card.frontImageUrl.startsWith('data:image/')) {
              // Validate base64 data URLs
              const frontBase64Data = card.frontImageUrl.split(',')[1];
              if (!frontBase64Data || frontBase64Data.length < 100) {
                console.log(`Card ${card.id} front image base64 data too small:`, frontBase64Data?.length || 0, 'characters');
                return { ready: false, card };
              }
              console.log(`Card ${card.id} base64 images validated successfully:`, {
                frontSize: frontBase64Data.length,
                hasInside: !!card.insideImageUrl,
                status: card.status
              });
            } else if (card.frontImageUrl.startsWith('/images/')) {
              // Validate PNG file URLs by checking file existence
              const fs = await import('fs');
              const path = await import('path');
              const frontFilePath = path.join(process.cwd(), 'stored_images', card.frontImageUrl.replace('/images/', ''));
              
              if (!fs.existsSync(frontFilePath)) {
                console.log(`Card ${card.id} front PNG file not found:`, frontFilePath);
                return { ready: false, card };
              }
              
              const frontFileSize = fs.statSync(frontFilePath).size;
              if (frontFileSize < 1000) { // Minimum 1KB for PNG file
                console.log(`Card ${card.id} front PNG file too small:`, frontFileSize, 'bytes');
                return { ready: false, card };
              }
              
              console.log(`Card ${card.id} PNG images validated successfully:`, {
                frontSize: frontFileSize,
                hasInside: !!card.insideImageUrl,
                status: card.status
              });
            }
            return { ready: true, card };
          } catch (parseError) {
            console.log(`Card ${card.id} image validation error:`, parseError);
            return { ready: false, card };
          }
        }
        
        return { ready: false, card };
      };

      // Poll for card completion with 10-second intervals, 5-minute timeout
      const maxAttempts = 30; // 5 minutes total
      let attempts = 0;

      const pollForCard = async (): Promise<any> => {
        attempts++;
        console.log(`Polling attempt ${attempts}/${maxAttempts} for card ${cardId}`);

        const { ready, card, error } = await isCardReady();

        if (error) {
          throw new Error(error);
        }

        if (ready && card) {
          console.log('Card is ready for email notification:', {
            cardId: card.id,
            hasFront: !!card.frontImageUrl,
            hasInside: !!card.insideImageUrl,
            status: card.status
          });
          return card;
        }

        if (attempts >= maxAttempts) {
          throw new Error('Card generation timeout - images not ready after 5 minutes');
        }

        // Wait 10 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 10000));
        return pollForCard();
      };

      const card = await pollForCard();
      console.log('Images validated successfully - proceeding with email notification');

      // Extract actual user name from conversation data if available
      let actualCustomerName = customerName;
      if (card.conversationData) {
        try {
          const conversationData = typeof card.conversationData === 'string' 
            ? JSON.parse(card.conversationData) 
            : card.conversationData;
          
          // Try to get user's actual name from conversation data
          if (conversationData.user_first_name) {
            actualCustomerName = `${conversationData.user_first_name} ${conversationData.user_last_name || ''}`.trim();
          } else if (conversationData.sender_name) {
            actualCustomerName = conversationData.sender_name;
          }
          
          console.log('[EMAIL PERSONALIZATION] Name extraction:', {
            originalName: customerName,
            extractedName: actualCustomerName,
            hasUserFirstName: !!conversationData.user_first_name,
            hasSenderName: !!conversationData.sender_name
          });
        } catch (parseError) {
          console.warn('Failed to parse conversation data for name extraction:', parseError);
        }
      }

      // Create a temporary reference for the delivery choice flow that includes cardId
      const reference = `celebrait_ready_${cardId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create order data structure for the email template
      const orderData = {
        customerEmail,
        customerName: actualCustomerName, // Use the extracted actual name
        paymentReference: reference,
        cardId: cardId,
        cardType: card.cardType // Include delivery method to skip delivery choice page
      };

      // Preload card data into cache for instant email link access
      try {
        console.log('Preloading card data for instant email access...');
        
        // Load PNG images from file system for caching
        let frontImageBuffer: Buffer | null = null;
        let insideImageBuffer: Buffer | null = null;
        
        // Handle both PNG file URLs and legacy base64 data URLs
        if (card.frontImageUrl) {
          if (card.frontImageUrl.startsWith('/images/')) {
            // PNG file URL - read from file system
            const fs = await import('fs');
            const path = await import('path');
            const frontFilePath = path.join(process.cwd(), 'stored_images', card.frontImageUrl.replace('/images/', ''));
            
            if (fs.existsSync(frontFilePath)) {
              frontImageBuffer = fs.readFileSync(frontFilePath);
              console.log(`[PRELOAD] Loaded PNG front image: ${frontImageBuffer.length} bytes`);
            } else {
              console.log(`[PRELOAD] PNG front image file not found: ${frontFilePath}`);
              // FALLBACK: Try to get base64 from conversationData if PNG file doesn't exist
              const conversationData = card.conversationData || {};
              let fallbackBase64 = null;
              if (conversationData.frontImageUrl && conversationData.frontImageUrl.startsWith('data:image/')) {
                fallbackBase64 = conversationData.frontImageUrl.split(',')[1];
              } else if (conversationData.photo_upload && conversationData.photo_upload.startsWith('data:image/')) {
                fallbackBase64 = conversationData.photo_upload.split(',')[1];
              }
              
              if (fallbackBase64) {
                frontImageBuffer = Buffer.from(fallbackBase64, 'base64');
                console.log(`[PRELOAD] Fallback - loaded base64 front image from conversationData: ${frontImageBuffer.length} bytes`);
              }
            }
          } else if (card.frontImageUrl.startsWith('data:image/')) {
            // Legacy base64 data URL
            const frontBase64 = card.frontImageUrl.split(',')[1];
            frontImageBuffer = Buffer.from(frontBase64, 'base64');
            console.log(`[PRELOAD] Loaded base64 front image: ${frontImageBuffer.length} bytes`);
          }
        }
        
        if (card.insideImageUrl) {
          if (card.insideImageUrl.startsWith('/images/')) {
            // PNG file URL - read from file system
            const fs = await import('fs');
            const path = await import('path');
            const insideFilePath = path.join(process.cwd(), 'stored_images', card.insideImageUrl.replace('/images/', ''));
            
            if (fs.existsSync(insideFilePath)) {
              insideImageBuffer = fs.readFileSync(insideFilePath);
              console.log(`[PRELOAD] Loaded PNG inside image: ${insideImageBuffer.length} bytes`);
            } else {
              console.log(`[PRELOAD] PNG inside image file not found: ${insideFilePath}`);
              // FALLBACK: Try to get base64 from conversationData if PNG file doesn't exist
              const conversationData = card.conversationData || {};
              let fallbackBase64 = null;
              if (conversationData.insideImageUrl && conversationData.insideImageUrl.startsWith('data:image/')) {
                fallbackBase64 = conversationData.insideImageUrl.split(',')[1];
              } else if (conversationData.photo_upload && conversationData.photo_upload.startsWith('data:image/')) {
                fallbackBase64 = conversationData.photo_upload.split(',')[1];
              }
              
              if (fallbackBase64) {
                insideImageBuffer = Buffer.from(fallbackBase64, 'base64');
                console.log(`[PRELOAD] Fallback - loaded base64 inside image from conversationData: ${insideImageBuffer.length} bytes`);
              }
            }
          } else if (card.insideImageUrl.startsWith('data:image/')) {
            // Legacy base64 data URL
            const insideBase64 = card.insideImageUrl.split(',')[1];
            insideImageBuffer = Buffer.from(insideBase64, 'base64');
            console.log(`[PRELOAD] Loaded base64 inside image: ${insideImageBuffer.length} bytes`);
          }
        }
        
        // Cache complete card data for instant email link loading
        if (frontImageBuffer) {
          const conversationData = card.conversationData || {};
          
          emailLinkCache.set(reference, {
            card: {
              id: card.id,
              userId: card.userId,
              cardType: card.cardType,
              printOption: card.printOption,
              sceneType: card.sceneType,
              status: card.status,
              price: card.price,
              conversationData: conversationData
            },
            frontImage: frontImageBuffer,
            insideImage: insideImageBuffer,
            timestamp: Date.now()
          });
          
          // AGGRESSIVE PRELOADING: Also cache individual images for ultra-fast API serving
          imageCache.set(`front-${card.id}`, {
            data: frontImageBuffer,
            timestamp: Date.now(),
            etag: `"${card.id}-front"`
          });
          
          if (insideImageBuffer) {
            imageCache.set(`inside-${card.id}`, {
              data: insideImageBuffer,
              timestamp: Date.now(),
              etag: `"${card.id}-inside"`
            });
          }
          
          console.log(`[PRELOAD] Successfully cached all data for reference: ${reference} (front: ${frontImageBuffer.length} bytes, inside: ${insideImageBuffer ? insideImageBuffer.length : 0} bytes)`);
        } else {
          console.log('[PRELOAD] No front image buffer available for caching');
        }
        
        console.log('Card data preloaded successfully for reference:', reference);
      } catch (cacheError) {
        console.error('Failed to preload card data, but continuing with email:', cacheError);
      }

      // Send card ready notification email (this should take user to delivery choice)
      try {
        const requestHost = req.get('host') || '71e6d7ef-7b58-4101-8db3-cda92f056e91-00-2ev7qrlb7zpv.picard.replit.dev';
        const emailParams = generateCardReadyNotificationEmail(orderData, requestHost);
        const emailSent = await sendEmail(emailParams);
        
        if (emailSent) {
          console.log('Card ready notification email sent successfully to:', customerEmail);
          res.json({
            success: true,
            message: 'Card ready notification sent successfully',
            reference
          });
        } else {
          console.error('Failed to send card ready notification email - SendGrid error');
          res.status(500).json({ 
            message: "Failed to send card ready notification - email service error",
            error: "SendGrid may have exceeded its credit limit or configuration issue"
          });
        }
      } catch (emailError) {
        console.error('Failed to send card ready notification email:', emailError);
        res.status(500).json({ message: "Failed to send card ready notification" });
      }

    } catch (error: any) {
      res.status(500).json({ message: "Error sending card ready notification: " + error.message });
    }
  });

  // Send shipping notification email
  app.post("/api/send-shipping-notification", async (req, res) => {
    try {
      const { orderId, trackingNumber } = req.body;

      if (!orderId || !trackingNumber) {
        return res.status(400).json({ message: "Order ID and tracking number are required" });
      }

      const order = await storage.getOrder(parseInt(orderId));
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Update order with tracking number
      const updatedOrder = await storage.updateOrder(order.id, {
        orderStatus: 'shipped',
        trackingNumber
      });

      // Send shipping notification email
      try {
        const emailParams = generateShippingNotificationEmail(order, trackingNumber);
        await sendEmail(emailParams);
        console.log('Shipping notification email sent successfully');

        res.json({
          ...updatedOrder,
          message: 'Shipping notification sent successfully'
        });
      } catch (emailError) {
        console.error('Failed to send shipping notification email:', emailError);
        res.status(500).json({ message: "Failed to send shipping notification" });
      }

    } catch (error: any) {
      res.status(500).json({ message: "Error sending shipping notification: " + error.message });
    }
  });

  // DEPRECATED - Digital cards now cost R1.00 via Payfast
  app.post("/api/create-free-order", async (req, res) => {
    // Digital cards are no longer free - redirect to payment flow
    return res.status(400).json({ 
      message: "Digital cards now cost R1.00 and require payment via Payfast", 
      requiresPayment: true,
      amount: 1.00,
      redirectToPayment: true
    });
  });

  // Test SendGrid configuration with detailed response
  app.post("/api/test-sendgrid", async (req, res) => {
    try {
      const { testEmail } = req.body;

      if (!testEmail) {
        return res.status(400).json({ message: "Test email address is required" });
      }

      console.log(`Testing SendGrid with email: ${testEmail}`);

      // Test with current timestamp for tracking
      const timestamp = new Date().toISOString();
      const testEmailParams = {
        to: testEmail,
        from: 'greetings@celebrait.co.za',
        subject: `SendGrid Test Email - ${timestamp}`,
        html: `
          <h1>SendGrid Test Email</h1>
          <p>This is a test email to verify your SendGrid configuration.</p>
          <p>Timestamp: ${timestamp}</p>
          <p>If you receive this email, your SendGrid integration is working correctly!</p>
        `,
        text: `SendGrid Test Email - Timestamp: ${timestamp} - If you receive this email, your SendGrid integration is working correctly!`
      };

      const success = await sendEmail(testEmailParams);

      if (success) {
        res.json({ 
          success: true, 
          message: 'Test email sent successfully',
          timestamp,
          note: 'Check your SendGrid Activity dashboard in 1-2 minutes for delivery status'
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to send test email - check server logs for details' 
        });
      }

    } catch (error: any) {
      res.status(500).json({ 
        success: false, 
        message: "SendGrid test failed: " + error.message 
      });
    }
  });

  // Test Mode Endpoints for End-to-End Testing
  
  // Send test card ready email notification
  app.post("/api/send-card-ready-email", async (req, res) => {
    try {
      const { email, cardId } = req.body;
      
      if (!email || !cardId) {
        return res.status(400).json({ message: "Email and cardId are required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Generate a test reference for the email
      const testReference = `celebrait_ready_${cardId}_${Date.now()}`;
      
      // Create card ready notification email
      const cardType = card.cardType === 'digital' ? 'digital' : 'printed';
      const requestHost = req.get('host') || '71e6d7ef-7b58-4101-8db3-cda92f056e91-00-2ev7qrlb7zpv.picard.replit.dev';
      const emailData = generateCardReadyNotificationEmail(
        { 
          ...card, 
          customerEmail: email, 
          reference: testReference,
          cardType 
        },
        requestHost
      );

      const success = await sendEmail(emailData);

      if (success) {
        // Store the reference for testing email links
        emailLinkCache.set(testReference, {
          card,
          insideImage: card.insideImageUrl ? true : false,
          timestamp: Date.now()
        });

        res.json({ 
          success: true, 
          message: 'Card ready email sent successfully',
          reference: testReference,
          previewLink: `/card-preview/${testReference}`
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to send card ready email' 
        });
      }

    } catch (error: any) {
      console.error('Error sending test card ready email:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send card ready email: " + error.message 
      });
    }
  });

  // Create test digital order
  app.post("/api/test-digital-order", async (req, res) => {
    try {
      const { 
        cardId, 
        customerEmail, 
        customerName, 
        deliveryMethod, 
        recipientEmail, 
        recipientName 
      } = req.body;

      if (!cardId || !customerEmail || !customerName) {
        return res.status(400).json({ message: "CardId, customerEmail, and customerName are required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Create the order
      const orderReference = `test_order_${Date.now()}`;
      const order = await storage.createOrder({
        cardId,
        customerEmail,
        customerName,
        deliveryType: 'digital',
        shippingAddress: null,
        amount: 500, // R5.00 for digital cards
        status: 'completed',
        paymentReference: orderReference,
        paymentMethod: 'payfast'
      });

      // Send appropriate emails based on delivery method
      if (deliveryMethod === 'recipient' && recipientEmail && recipientName) {
        // Send to both recipient and customer
        const digitalCardUrl = `${req.protocol}://${req.get('host')}/card/celebrait_digital_${cardId}_${Date.now()}`;
        
        // Email to recipient
        const recipientEmailData = generateDigitalCardEmail(
          { 
            ...order, 
            customerEmail: recipientEmail,
            customerName: recipientName,
            card 
          }, 
          digitalCardUrl,
          req.get('host')
        );
        await sendEmail(recipientEmailData);

        // Email to customer
        const customerEmailData = generateDigitalCardEmail(
          { 
            ...order, 
            customerEmail,
            customerName,
            card 
          }, 
          digitalCardUrl,
          req.get('host')
        );
        await sendEmail(customerEmailData);

      } else {
        // Send only to customer
        const digitalCardUrl = `${req.protocol}://${req.get('host')}/card/celebrait_digital_${cardId}_${Date.now()}`;
        const emailData = generateDigitalCardEmail(
          { ...order, card }, 
          digitalCardUrl,
          req.get('host')
        );
        await sendEmail(emailData);
      }

      res.json({ 
        success: true, 
        order,
        message: 'Test digital order created and emails sent successfully'
      });

    } catch (error: any) {
      console.error('Error creating test digital order:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to create test digital order: " + error.message 
      });
    }
  });

  // Create test printed order 
  app.post("/api/test-printed-order", async (req, res) => {
    try {
      const { 
        cardId, 
        customerEmail, 
        customerName,
        shippingAddress
      } = req.body;

      if (!cardId || !customerEmail || !customerName) {
        return res.status(400).json({ message: "CardId, customerEmail, and customerName are required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Create the order
      const orderReference = `test_printed_${Date.now()}`;
      const order = await storage.createOrder({
        cardId,
        customerEmail,
        customerName,
        deliveryType: 'printed',
        shippingAddress: shippingAddress || {
          line1: '123 Test Street',
          line2: '',
          city: 'Test City',
          province: 'Test Province',
          postalCode: '12345'
        },
        amount: card.price,
        status: 'paid',
        paymentReference: orderReference,
        paymentMethod: 'test'
      });

      // Send order confirmation email
      const emailData = generateOrderConfirmationEmail(order);
      await sendEmail(emailData);

      res.json({ 
        success: true, 
        order,
        message: 'Test printed order created and confirmation email sent successfully'
      });

    } catch (error: any) {
      console.error('Error creating test printed order:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to create test printed order: " + error.message 
      });
    }
  });

  // Test shipping notification
  app.post("/api/test-shipping-notification", async (req, res) => {
    try {
      const { email, orderId, trackingNumber } = req.body;

      if (!email || !orderId) {
        return res.status(400).json({ message: "Email and orderId are required" });
      }

      // Create mock order data for shipping notification
      const mockOrder = {
        id: orderId,
        customerEmail: email,
        customerName: 'Test Customer',
        deliveryType: 'printed' as const,
        status: 'shipped' as const,
        paymentReference: `test_ref_${Date.now()}`,
        shippingAddress: {
          line1: '123 Test Street',
          line2: '',
          city: 'Test City',
          province: 'Test Province',
          postalCode: '12345'
        }
      };

      const emailData = generateShippingNotificationEmail(
        mockOrder, 
        trackingNumber || `TEST${Date.now()}`
      );
      
      const success = await sendEmail(emailData);

      if (success) {
        res.json({ 
          success: true, 
          message: 'Test shipping notification sent successfully',
          trackingNumber: trackingNumber || `TEST${Date.now()}`
        });
      } else {
        res.status(500).json({ 
          success: false, 
          message: 'Failed to send shipping notification' 
        });
      }

    } catch (error: any) {
      console.error('Error sending test shipping notification:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to send shipping notification: " + error.message 
      });
    }
  });

  // Payfast payment endpoints
  
  // Get Payfast status
  app.get("/api/payfast/status", (req, res) => {
    res.json(payfastService.getStatus());
  });

  // Test Payfast signature generation
  app.get("/api/payfast/test-signature", (req, res) => {
    res.json(payfastService.testSignature());
  });

  // Toggle live mode for testing (development only)
  app.post("/api/payfast/toggle-live", (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Cannot toggle live mode in production' });
    }
    
    const { forceLive } = req.body;
    if (forceLive) {
      process.env.PAYFAST_FORCE_LIVE = 'true';
    } else {
      delete process.env.PAYFAST_FORCE_LIVE;
    }
    
    res.json({ 
      success: true, 
      forceLive: !!process.env.PAYFAST_FORCE_LIVE,
      message: `Payfast mode will be ${forceLive ? 'LIVE' : 'SANDBOX'} after restart`
    });
  });

  // Create Payfast payment
  app.post("/api/payfast/create-payment", async (req, res) => {
    try {
      console.log('Payfast payment request body:', req.body);
      const { cardId, customerInfo, deliveryInfo, isDigital, recipientInfo, amount } = req.body;

      if (!cardId) {
        return res.status(400).json({ message: "Card ID is required" });
      }

      if (!customerInfo || !customerInfo.email || !customerInfo.name) {
        console.log('Missing customerInfo:', customerInfo);
        return res.status(400).json({ message: "Customer info with name and email is required" });
      }

      if (!payfastService.isConfigured()) {
        return res.status(500).json({ message: "Payfast not configured" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Use provided amount or calculate based on card type
      const orderAmount = amount || (isDigital ? 500 : 12900); // Custom amount or R5.00/R129.00 in cents
      
      console.log('Amount calculation debug:', {
        providedAmount: amount,
        isDigital,
        calculatedAmount: orderAmount,
        fallback: isDigital ? 500 : 12900
      });

      // Create order record
      const orderData = {
        cardId: parseInt(cardId),
        customerEmail: customerInfo.email,
        customerName: customerInfo.name,
        customerPhone: customerInfo.phone || '',
        amount: orderAmount,
        currency: 'ZAR',
        paymentReference: `payfast_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        orderStatus: 'pending',
        paymentStatus: 'pending',
        // Add delivery info for printed cards
        deliveryAddress: deliveryInfo ? JSON.stringify(deliveryInfo) : null,
        // Store recipient info for dual delivery
        recipientInfo: recipientInfo ? JSON.stringify(recipientInfo) : null
      };

      const order = await storage.createOrder(orderData);

      // Create Payfast payment data - use correct domain for production
      const host = req.get('host') || 'localhost:5000';
      const actualHost = host.includes('localhost') ? host : '71e6d7ef-7b58-4101-8db3-cda92f056e91-00-2ev7qrlb7zpv.picard.replit.dev';
      const protocol = actualHost.includes('localhost') ? 'http' : 'https';
      const baseUrl = `${protocol}://${actualHost}`;
      
      console.log('Payment redirect URLs:', { 
        returnUrl: `${baseUrl}/payment-success/${order.paymentReference}`,
        cancelUrl: `${baseUrl}/payment-cancelled/${order.paymentReference}`,
        notifyUrl: `${baseUrl}/api/payfast/notify`
      });

      const paymentData = payfastService.createPaymentData({
        orderId: order.paymentReference,
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        amount: orderAmount,
        itemName: `Celebrait ${isDigital ? 'Digital' : 'Printed'} Greeting Card`,
        itemDescription: `Personalized greeting card for ${card.conversationData?.name || 'recipient'}`,
        returnUrl: `${baseUrl}/payment-success/${order.paymentReference}`,
        cancelUrl: `${baseUrl}/payment-cancelled/${order.paymentReference}`,
        notifyUrl: `${baseUrl}/api/payfast/notify`
      });

      console.log('Payfast payment created:', {
        orderId: order.id,
        paymentReference: order.paymentReference,
        amount: orderAmount,
        customerEmail: customerInfo.email
      });

      res.json({
        order,
        paymentData,
        paymentUrl: payfastService.getPaymentUrl()
      });

    } catch (error: any) {
      console.error('Payfast payment creation error:', error);
      res.status(500).json({ message: "Error creating payment: " + error.message });
    }
  });

  // Payfast ITN (Instant Transaction Notification)
  app.post("/api/payfast/notify", async (req, res) => {
    try {
      console.log('Payfast ITN received:', req.body);

      const itnData = req.body;
      const paymentReference = itnData.m_payment_id;

      if (!paymentReference) {
        console.error('No payment reference in ITN');
        return res.status(400).send('No payment reference');
      }

      // Get order by payment reference
      const order = await storage.getOrderByReference(paymentReference);
      if (!order) {
        console.error('Order not found for payment reference:', paymentReference);
        return res.status(404).send('Order not found');
      }

      console.log('Processing ITN for order:', order.id, 'payment status:', itnData.payment_status);

      // For live environment, we'll trust the payment status for now
      // TODO: Implement proper signature verification for live environment
      const isPaymentComplete = itnData.payment_status === 'COMPLETE';
      console.log('Payment completion status:', isPaymentComplete);

      if (isPaymentComplete) {
        // Update order status
        const updatedOrder = await storage.updateOrder(order.id, {
          paymentStatus: 'completed',
          orderStatus: 'confirmed'
        });

        console.log('Payment confirmed for order:', order.id);

        // Generate PDFs for ALL card types after payment completion
        const card = await storage.getCard(order.cardId);
        if (card) {
          console.log('Generating PDFs for card after payment completion:', card.id);
          try {
            // Generate high-quality PDFs for both digital and printed cards
            const pdfs = await generateSeparatePDFs({
              cardId: card.id,
              format: '5x5',
              dpi: 300
            });
            console.log('PDFs generated successfully:', pdfs);
          } catch (pdfError) {
            console.error('PDF generation failed after payment:', pdfError);
            // Don't fail the whole payment process if PDF generation fails
          }
        }

        // Send order confirmation email and digital card if applicable
        try {
          // For now, send a simple order confirmation email
          const emailParams = {
            to: order.customerEmail,
            subject: 'Order Confirmation - Your Celebrait Card',
            html: `
              <h2>Thank you for your order!</h2>
              <p>Dear ${order.customerName},</p>
              <p>Your payment has been confirmed and your order is being processed.</p>
              <p><strong>Order Details:</strong></p>
              <ul>
                <li>Payment Reference: ${order.paymentReference}</li>
                <li>Amount: ${order.currency} ${(order.amount / 100).toFixed(2)}</li>
                <li>Card ID: ${order.cardId}</li>
              </ul>
              <p>You can download your PDFs from your payment confirmation page.</p>
              <p>Thank you for choosing Celebrait!</p>
            `
          };
          await sendEmail(emailParams);
          console.log('Order confirmation email sent for:', order.paymentReference);
          
          // If digital card (R5.00 = 500 cents), also send the digital card email
          if (order.amount === 500) {
            const card = await storage.getCard(order.cardId);
            if (card) {
              // Use the correct Replit domain for emails
              const actualHost = '71e6d7ef-7b58-4101-8db3-cda92f056e91-00-2ev7qrlb7zpv.picard.replit.dev';
              const baseUrl = `https://${actualHost}`;
              
              // Send digital card email to customer
              const customerEmailParams = generateDigitalCardEmail(
                { ...order, card },
                `${baseUrl}/card/${order.paymentReference}`,
                actualHost
              );
              await sendEmail(customerEmailParams);
              console.log('Digital card email sent to customer:', order.customerEmail);
              
              // Send digital card email to recipient if specified
              if (order.recipientInfo) {
                try {
                  const recipientInfo = JSON.parse(order.recipientInfo);
                  if (recipientInfo.email && recipientInfo.email !== order.customerEmail) {
                    // Use the new recipient-specific email template
                    const recipientEmailParams = generateDigitalCardEmailForRecipient(
                      { ...order, card },
                      recipientInfo.name,
                      recipientInfo.email,
                      order.customerName,
                      `${baseUrl}/api/cards/${card.id}/digital-front-image`,
                      actualHost
                    );
                    await sendEmail(recipientEmailParams);
                    console.log('Digital card email sent to recipient:', recipientInfo.email);
                  }
                } catch (parseError) {
                  console.error('Error parsing recipient info:', parseError);
                }
              }
            }
          }
        } catch (emailError) {
          console.error('Failed to send confirmation/digital emails:', emailError);
        }

        // For printed cards, generate PDFs and start fulfillment process  
        if (order.cardId && (order.amount === 12900 || order.amount === 500)) { // R129.00 or R5.00 (testing) = 12900 or 500 cents
          const card = await storage.getCard(order.cardId);
          if (card) {
            console.log('Generating PDFs for printed card:', card.id);
            try {
              // Generate high-quality PDFs for printing
              const pdfs = await generateSeparatePDFs({
                cardId: card.id,
                format: '5x5',
                dpi: 300
              });
              
              // Generate print specs
              await generatePrintSpecs(card.id);
              
              console.log('PDFs generated successfully for card:', card.id, pdfs);
              
              // Update order status to indicate PDFs are ready
              await storage.updateOrder(order.id, {
                orderStatus: 'processing' // PDFs ready for printing
              });
              
            } catch (pdfError) {
              console.error('Failed to generate PDFs for card:', card.id, pdfError);
            }
          }
        }

        res.status(200).send('OK');
      } else {
        console.error('Payment not complete - ITN status:', itnData.payment_status);
        res.status(400).send('Payment not complete');
      }

    } catch (error: any) {
      console.error('Payfast ITN processing error:', error);
      res.status(500).send('ITN processing error');
    }
  });

  // Get payment status
  app.get("/api/payfast/payment-status/:reference", async (req, res) => {
    try {
      const reference = req.params.reference;
      const order = await storage.getOrderByReference(reference);
      
      if (!order) {
        return res.status(404).json({ message: "Payment not found" });
      }

      res.json({
        paymentReference: order.paymentReference,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        amount: order.amount,
        currency: order.currency,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        cardId: order.cardId
      });

    } catch (error: any) {
      console.error('Payment status error:', error);
      res.status(500).json({ message: "Error fetching payment status: " + error.message });
    }
  });

  // Get Payfast configuration status
  app.get("/api/payfast/status", async (req, res) => {
    try {
      const status = payfastService.getStatus();
      
      res.json({
        configured: status.configured,
        mode: status.mode,
        merchantId: status.merchantId,
        paymentUrl: payfastService.getPaymentUrl(),
        hasPassphrase: status.hasPassphrase
      });

    } catch (error: any) {
      console.error('Payfast status error:', error);
      res.status(500).json({ message: "Error fetching Payfast status: " + error.message });
    }
  });

  // Test endpoint to simulate successful payment (for testing only)
  app.post('/api/payfast/simulate-payment/:reference', async (req, res) => {
    try {
      const { reference } = req.params;
      
      console.log('Simulating payment completion for:', reference);
      
      // Find the order
      const order = await storage.getOrderByReference(reference);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Update order status
      await storage.updateOrder(order.id, {
        paymentStatus: 'completed',
        orderStatus: 'completed'
      });
      
      // Send email notification for digital cards
      if (order.orderType === 'digital' || order.orderType === 'regular') {
        const card = await storage.getCard(order.cardId);
        if (card) {
          // Remove watermarks from the card using PNG files
          const cardWithoutWatermarks = await removeWatermarksFromCard(card.id);
          
          // Send digital card email to customer
          const actualHost = '71e6d7ef-7b58-4101-8db3-cda92f056e91-00-2ev7qrlb7zpv.picard.replit.dev';
          const customerEmailData = generateDigitalCardEmail(order, `https://${actualHost}/card/${reference}`, actualHost);
          const customerEmailSent = await sendEmail(customerEmailData);
          console.log('Digital card email sent to customer:', customerEmailSent ? 'SUCCESS' : 'FAILED');
          
          // Send digital card email to recipient if specified
          if (order.recipientInfo) {
            try {
              const recipientInfo = JSON.parse(order.recipientInfo);
              if (recipientInfo.email && recipientInfo.email !== order.customerEmail) {
                const recipientEmailData = generateDigitalCardEmail(
                  { 
                    ...order, 
                    customerEmail: recipientInfo.email,
                    customerName: recipientInfo.name
                  }, 
                  `https://${actualHost}/card/${reference}`, 
                  actualHost
                );
                const recipientEmailSent = await sendEmail(recipientEmailData);
                console.log('Digital card email sent to recipient:', recipientEmailSent ? 'SUCCESS' : 'FAILED');
              }
            } catch (parseError) {
              console.error('Error parsing recipient info for simulate payment:', parseError);
            }
          }
        }
      }
      
      res.json({ 
        success: true, 
        message: 'Payment simulated successfully',
        order: await storage.getOrderByReference(reference)
      });
    } catch (error) {
      console.error('Error simulating payment:', error);
      res.status(500).json({ error: 'Failed to simulate payment' });
    }
  });

  // FLUX KONTEXT TEST ENDPOINT - Runs alongside OpenAI for comparison
  app.post("/api/test-flux-kontext", async (req, res) => {
    try {
      const { prompt, artStyle, imageUrl, cardId, guidanceScale = 3.5, inferenceSteps = 28 } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ message: "Prompt is required" });
      }

      console.log('🧪 FLUX KONTEXT TEST - Starting generation...');
      console.log('📝 Prompt:', prompt.substring(0, 100) + '...');
      console.log('🎨 Art Style:', artStyle);
      console.log('🎛️ Parameters:', { guidanceScale, inferenceSteps });
      
      // Configure fal.ai client if API key is available
      if (process.env.FAL_API_KEY) {
        fal.config({ credentials: process.env.FAL_API_KEY });
      } else {
        return res.status(400).json({ message: "FAL_API_KEY not configured. Please set this secret to test Flux Kontext." });
      }

      // Build full prompt using same style processing as OpenAI
      let fullPrompt = prompt;
      
      if (artStyle) {
        // Apply detailed style descriptions for consistent results with OpenAI
        const styleInstructions = getFluxStyleInstructions(artStyle);
        fullPrompt = `${prompt}. ${styleInstructions}`;
        console.log('🎨 Style instructions added:', styleInstructions.substring(0, 100) + '...');
      }
      
      // Add typography integration instructions for text rendering
      if (fullPrompt.includes('Include text:')) {
        fullPrompt += '. TYPOGRAPHY INTEGRATION: Naturally integrate text into the scene as part of the artistic composition. Text should appear carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements. Ensure clear legibility while making text feel like an organic part of the scene rather than overlaid text.';
        console.log('📝 Typography integration instructions added for text rendering');
      }
      
      // Helper function to convert art style names to detailed descriptions for Flux
      function getFluxStyleInstructions(style: string): string {
        const lowerStyle = style.toLowerCase();
        
        if (lowerStyle === 'watercolor painting') {
          return 'Create in beautiful watercolor painting style with soft, flowing colors, natural brushstrokes, and transparent layering effects. Use gentle color bleeding and organic textures typical of professional watercolor artwork.';
        }
        
        if (lowerStyle === 'oil painting') {
          return 'Transform into rich oil painting style with thick brushstrokes, vibrant colors, and textured canvas appearance. Use classical oil painting techniques with layered paint application and artistic brush textures.';
        }
        
        if (lowerStyle === 'animated_movie_style') {
          return 'DYNAMIC STYLE SELECTION: Analyze the scene content and choose the most appropriate artistic style that best complements the mood, atmosphere, and setting. Consider styles like watercolor, oil painting, digital illustration, fantasy art, storybook illustration, contemporary art, vintage illustration, and others. Choose the style that creates the most contextually appropriate and visually compelling result.';
        }
        
        if (lowerStyle === 'modern_flat_illustration') {
          return 'Transform into contemporary flat illustration style with clean vector-like appearance, bold shapes, modern color palette, geometric forms, and simplified details while maintaining precise facial accuracy as TOP PRIORITY.';
        }
        
        if (lowerStyle === 'cartoon style') {
          return 'Create in cartoon style with exaggerated features, bright colors, clean lines, and playful character design while preserving facial recognition and likeness.';
        }
        
        if (lowerStyle === 'digital art') {
          return 'Transform into polished digital art style with crisp details, modern digital painting techniques, sophisticated color gradients, and contemporary digital artwork aesthetic.';
        }
        
        if (lowerStyle === 'sketch style') {
          return 'Create in artistic sketch style with pencil-like lines, crosshatching, artistic shading, and hand-drawn appearance while maintaining clear facial features.';
        }
        
        // Default fallback for any other styles
        return `Transform into ${style} artistic style with professional quality, maintaining clear facial features and appropriate artistic techniques for this style.`;
      }

      const startTime = Date.now();
      
      let result;
      
      if (imageUrl) {
        // Image-to-image editing with Flux Kontext Pro
        console.log('🖼️ Using image-to-image mode with Flux Kontext Pro');
        result = await fal.subscribe("fal-ai/flux-pro/kontext", {
          input: {
            prompt: fullPrompt,
            image_url: imageUrl,
            guidance_scale: guidanceScale, // User-configurable guidance scale
            num_inference_steps: inferenceSteps, // User-configurable steps
            seed: Math.floor(Math.random() * 1000000)
          }
        });
      } else {
        // Text-to-image generation with Flux Pro (fallback)
        console.log('📝 Using text-to-image mode with Flux Pro');
        result = await fal.subscribe("fal-ai/flux-pro", {
          input: {
            prompt: prompt,
            image_size: "square_hd", // 1024x1024
            num_inference_steps: 28,
            guidance_scale: 3.5,
            num_images: 1,
            seed: Math.floor(Math.random() * 1000000)
          }
        });
      }

      const processingTime = Date.now() - startTime;
      console.log(`⚡ FLUX completed in ${processingTime}ms (${(processingTime/1000).toFixed(1)}s)`);
      
      if (result && result.data && result.data.images && result.data.images.length > 0) {
        const fluxImageUrl = result.data.images[0].url;
        console.log('✅ FLUX generation successful');
        
        // Apply watermark for preview (optional - for testing comparison)
        let finalImageUrl = fluxImageUrl;
        
        if (cardId) {
          try {
            // Download and convert to base64 for watermarking
            const fetch = (await import('node-fetch')).default;
            const imageResponse = await fetch(fluxImageUrl);
            const imageBuffer = await imageResponse.buffer();
            const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
            
            // Apply watermark
            const watermarkedImageUrl = await applyWatermark(base64Image, 0.25);
            finalImageUrl = watermarkedImageUrl;
            console.log('🏷️ Watermark applied to Flux image');
          } catch (watermarkError) {
            console.warn('⚠️ Watermark failed, using original Flux image:', watermarkError);
          }
        }
        
        res.json({
          success: true,
          imageUrl: finalImageUrl,
          originalImageUrl: fluxImageUrl,
          processingTime: processingTime,
          model: imageUrl ? "flux-kontext-pro" : "flux-pro",
          cost: imageUrl ? 0.04 : 0.03, // Estimated cost in USD
          metadata: {
            processingTimeSeconds: (processingTime/1000).toFixed(1),
            promptLength: prompt.length,
            mode: imageUrl ? "image-to-image" : "text-to-image"
          }
        });
        
      } else {
        throw new Error('No image data received from Flux API');
      }
      
    } catch (error: any) {
      console.error('❌ FLUX KONTEXT TEST ERROR:', error);
      res.status(500).json({ 
        message: "Flux Kontext test failed: " + error.message,
        error: error.toString()
      });
    }
  });

  // Flux Kontext inside card generation using front card as style reference
  app.post("/api/flux-kontext-inside-card", async (req, res) => {
    try {
      const { 
        frontCardImage, 
        insideText, 
        size = '1024x1024',
        guidanceScale = 3.5,
        inferenceSteps = 28
      } = req.body;

      if (!frontCardImage || !insideText) {
        return res.status(400).json({ message: "Front card image and inside text are required" });
      }

      // Validate size parameter
      if (!['1024x1024', '1024x1536'].includes(size)) {
        return res.status(400).json({ message: "Size must be either 1024x1024 or 1024x1536" });
      }

      // Configure fal.ai client if API key is available
      if (process.env.FAL_API_KEY) {
        fal.config({ credentials: process.env.FAL_API_KEY });
      } else {
        return res.status(400).json({ message: "FAL_API_KEY not configured. Please set this secret to use Flux Kontext." });
      }

      console.log('🧪 FLUX KONTEXT INSIDE CARD - Starting generation...');
      console.log('📝 Inside text:', insideText.substring(0, 50) + '...');
      console.log('🎛️ Parameters:', { guidanceScale, inferenceSteps, size });

      // Create prompt following the same format as GPT-Image-1 inside card generation
      const formatDescription = size === '1024x1536' 
        ? 'Portrait 2:3 aspect ratio design (height is 1.5x the width)'
        : 'Square 1:1 aspect ratio design';
      const formatInstruction = size === '1024x1536' 
        ? 'as a portrait format design'
        : 'as a square format design';
      
      const insideCardPrompt = `${formatDescription}, full bleed with no borders or card edges visible, fill entire frame. DO NOT include any people, characters, or figures from the front card. "${insideText}" prominently displayed as the main focus with elegant typography. Reference this front card image for style consistency: same art style, same typography style exactly (font family, weight, text treatment), same color palette exactly (primary and accent colors). Include subtle visual reference points to overall scene atmosphere from front card, but nothing too imposing as text is the primary focus. New image must feel like it is part of the same design family with cohesive design language and visual consistency. Print-ready artwork, no card mockup visible, ${formatInstruction}.`;

      console.log('🖼️ Using image-to-image mode with Flux Kontext Pro for inside card');
      console.log('📝 Full prompt:', insideCardPrompt.substring(0, 100) + '...');

      const startTime = Date.now();
      
      const result = await fal.subscribe("fal-ai/flux-pro/kontext", {
        input: {
          prompt: insideCardPrompt,
          image_url: frontCardImage,
          guidance_scale: guidanceScale,
          num_inference_steps: inferenceSteps,
          seed: Math.floor(Math.random() * 1000000)
        }
      });

      const processingTime = Date.now() - startTime;
      console.log(`⚡ FLUX inside card completed in ${processingTime}ms (${(processingTime/1000).toFixed(1)}s)`);
      
      if (result && result.data && result.data.images && result.data.images.length > 0) {
        const fluxImageUrl = result.data.images[0].url;
        console.log('✅ FLUX inside card generation successful');
        
        res.json({
          success: true,
          imageUrl: fluxImageUrl,
          metadata: {
            model: "fal-ai/flux-pro/kontext",
            processingTimeSeconds: (processingTime / 1000).toFixed(1),
            cost: "0.055"
          }
        });
      } else {
        throw new Error('No image generated from Flux Kontext');
      }

    } catch (error: any) {
      console.error('🚨 FLUX KONTEXT INSIDE CARD ERROR:', error);
      res.status(500).json({ 
        message: error.message || "Flux Kontext inside card generation failed", 
        details: error.details || "Check server logs for more information" 
      });
    }
  });

  // PDF Download endpoints for testing print-ready files
  app.get("/api/download-pdf/:cardId/:side/:format/:dpi", async (req, res) => {
    try {
      const { cardId, side, format, dpi } = req.params;
      
      if (!['front', 'inside'].includes(side)) {
        return res.status(400).json({ message: "Invalid side. Must be 'front' or 'inside'" });
      }
      
      if (!['5x5', 'A4', 'Letter'].includes(format)) {
        return res.status(400).json({ message: "Invalid format. Must be '5x5', 'A4', or 'Letter'" });
      }
      
      if (!['150', '300', '600'].includes(dpi)) {
        return res.status(400).json({ message: "Invalid DPI. Must be 150, 300, or 600" });
      }
      
      const filename = `card_${cardId}_${side}_${format}_${dpi}dpi.pdf`;
      const filepath = path.join(process.cwd(), 'print_files', filename);
      
      // Check if PDF exists
      try {
        await fsPromises.access(filepath);
      } catch (error) {
        return res.status(404).json({ message: "PDF not found. Generate PDFs first by completing payment." });
      }
      
      // Get file stats for Content-Length
      const stats = await fsPromises.stat(filepath);
      
      // Set headers for PDF download
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': stats.size.toString(),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, no-cache'
      });
      
      // Stream the PDF file
      const readStream = fs.createReadStream(filepath);
      readStream.pipe(res);
      
      console.log(`[PDF-DOWNLOAD] Served ${filename} (${stats.size} bytes)`);
      
    } catch (error: any) {
      console.error('PDF download error:', error);
      res.status(500).json({ message: "Error downloading PDF: " + error.message });
    }
  });
  
  // Download print specifications
  app.get("/api/download-pdf/:cardId/specs", async (req, res) => {
    try {
      const { cardId } = req.params;
      
      const filename = `card_${cardId}_print_specs.json`;
      const filepath = path.join(process.cwd(), 'print_files', filename);
      
      // Check if specs file exists
      try {
        await fsPromises.access(filepath);
      } catch (error) {
        return res.status(404).json({ message: "Print specs not found" });
      }
      
      // Read and return the specs
      const specsData = await fsPromises.readFile(filepath, 'utf8');
      const specs = JSON.parse(specsData);
      
      res.json(specs);
      
    } catch (error: any) {
      console.error('Print specs download error:', error);
      res.status(500).json({ message: "Error downloading print specs: " + error.message });
    }
  });

  // TESTING ENDPOINT: Generate PDFs for any existing card
  app.post("/api/generate-test-pdfs/:cardId", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      
      if (isNaN(cardId)) {
        return res.status(400).json({ message: "Invalid cardId" });
      }

      // Check if card exists
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      console.log(`[TEST] Generating PDFs for card ${cardId}`);

      try {
        // Generate high-quality PDFs for testing
        const pdfs = await generateSeparatePDFs({
          cardId: cardId,
          format: '5x5',
          dpi: 300
        });
        
        // Generate print specs
        await generatePrintSpecs(cardId);
        
        console.log(`[TEST] PDFs generated successfully for card ${cardId}:`, pdfs);
        
        // Return download URLs
        const downloadUrls = {
          frontPdf: `/api/download-pdf/${cardId}/front/5x5/300`,
          insidePdf: `/api/download-pdf/${cardId}/inside/5x5/300`,
          specs: `/api/download-pdf/${cardId}/specs`
        };
        
        res.json({
          success: true,
          message: `PDFs generated for card ${cardId}`,
          downloadUrls,
          pdfs
        });
        
      } catch (pdfError) {
        console.error(`[TEST] Failed to generate PDFs for card ${cardId}:`, pdfError);
        res.status(500).json({ 
          message: "PDF generation failed", 
          error: pdfError instanceof Error ? pdfError.message : "Unknown error"
        });
      }
      
    } catch (error: any) {
      console.error('Test PDF generation error:', error);
      res.status(500).json({ message: "Error generating test PDFs: " + error.message });
    }
  });

  // RECOVERY SYSTEM FOR ABANDONED CARDS
  
  // Track card abandonment
  app.post("/api/track-abandonment", async (req, res) => {
    try {
      const { cardId, userEmail, userName, stepData, stage } = req.body;
      
      console.log(`Tracking abandonment for card ${cardId}, stage: ${stage}`);
      
      // Update card with abandonment tracking data
      const card = await storage.getCard(cardId);
      if (card) {
        await storage.updateCard(cardId, {
          abandonmentData: JSON.stringify({
            userEmail,
            userName,
            stepData,
            stage,
            lastActivity: Date.now()
          })
        });
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error tracking abandonment:', error);
      res.status(500).json({ error: 'Failed to track abandonment' });
    }
  });
  
  // Recovery endpoint - resumes card creation flow
  app.get("/api/recover/:recoveryToken", async (req, res) => {
    try {
      const { recoveryToken } = req.params;
      
      // Decode recovery token (format: cardId_timestamp_hash)
      const parts = recoveryToken.split('_');
      if (parts.length < 2) {
        return res.status(400).json({ error: 'Invalid recovery token' });
      }
      
      const cardId = parseInt(parts[0]);
      const card = await storage.getCard(cardId);
      
      if (!card) {
        return res.status(404).json({ error: 'Card not found or expired' });
      }
      
      // Check if card is still recoverable (within 7 days)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      if (new Date(card.createdAt).getTime() < sevenDaysAgo) {
        return res.status(410).json({ error: 'Recovery period expired' });
      }
      
      // Redirect to appropriate page based on card status
      let redirectUrl = '/create-card';
      
      if (card.status === 'completed' && card.frontImageUrl) {
        redirectUrl = `/complete-order/${cardId}?recovery=true`;
      } else if (card.conversationData) {
        redirectUrl = `/create-card?cardId=${cardId}&recovery=true`;
      }
      
      // Redirect to frontend with recovery data
      res.redirect(redirectUrl);
      
    } catch (error) {
      console.error('Error processing recovery:', error);
      res.status(500).json({ error: 'Recovery failed' });
    }
  });
  
  // Send abandonment recovery email
  app.post("/api/send-abandonment-email", async (req, res) => {
    try {
      const { cardId, userEmail, userName } = req.body;
      
      if (!userEmail || !cardId) {
        return res.status(400).json({ error: 'Card ID and email are required' });
      }
      
      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ error: 'Card not found' });
      }
      
      // Generate recovery token
      const recoveryToken = `${cardId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const recoveryUrl = `${req.protocol}://${req.get('host')}/api/recover/${recoveryToken}`;
      
      // Send abandonment recovery email
      const emailParams = generateAbandonmentRecoveryEmail(
        card,
        userEmail,
        userName || 'Friend',
        recoveryUrl
      );
      
      const emailSent = await sendEmail(emailParams);
      
      if (emailSent) {
        // Update card with recovery info
        await storage.updateCard(cardId, {
          recoveryEmailSent: new Date().toISOString(),
          recoveryToken
        });
        
        res.json({ 
          success: true, 
          message: 'Recovery email sent successfully',
          recoveryUrl 
        });
      } else {
        res.status(500).json({ error: 'Failed to send recovery email' });
      }
      
    } catch (error) {
      console.error('Error sending abandonment email:', error);
      res.status(500).json({ error: 'Failed to send abandonment email' });
    }
  });

  // Photo Quality Assessment endpoint using GPT-4 Vision
  app.post("/api/assess-photo-quality", async (req, res) => {
    if (!openai) {
      return res.status(503).json({ error: "OpenAI API not configured" });
    }

    try {
      const { images } = req.body;
      
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Images array is required" });
      }

      console.log(`[PHOTO_QUALITY] Assessing quality for ${images.length} photos using GPT-4 Vision`);
      
      const assessments = await Promise.all(
        images.map(async (imageData: string, index: number) => {
          try {
            const response = await openai.chat.completions.create({
              model: "gpt-4o",
              messages: [{
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Assess this photo's suitability for AI character generation. Rate each factor 1-10 and provide an overall quality score:

FACE QUALITY FACTORS:
- Face clarity/sharpness: Is the face in focus vs blurry?
- Face size in frame: Too small (poor), appropriate size (good), or too large (acceptable)
- Face angle: Profile view (poor 3-4), 3/4 view (good 6-7), frontal view (excellent 8-10)
- Lighting on face: Poor lighting/harsh shadows (low), even natural lighting (high)
- Eye visibility: Eyes clearly visible (high) vs sunglasses/hidden (reduces score)

TECHNICAL QUALITY:
- Overall image sharpness and focus
- Resolution and detail level
- Color balance and natural skin tones
- Noise/grain levels (low noise = better)

COMPOSITION FACTORS:
- Number of faces: Single person (best 8-10), multiple people (harder 5-7)
- Face obstructions: Clear face (high) vs hands/hair/objects covering (lower)
- Background complexity: Simple background (better) vs busy/distracting (lower)

ASSESSMENT REQUIREMENTS:
1. Provide overall quality score (1-10)
2. List 2-3 specific strengths or issues
3. Give recommendation: "Excellent for AI generation" / "Good with minor limitations" / "Fair - may have some issues" / "Poor - consider retaking photo"
4. If score is below 6, suggest specific improvements

Format: "Quality Score: X/10" followed by brief analysis.`
                  },
                  {
                    type: "image_url",
                    image_url: { url: imageData }
                  }
                ]
              }],
              max_tokens: 500,
              temperature: 0.3 // Lower temperature for more consistent assessments
            });

            const content = response.choices[0].message.content || "Could not assess photo quality";
            
            // Parse the response to extract structured data
            const scoreMatch = content.match(/Quality Score:\s*(\d+(?:\.\d+)?)/i);
            const score = scoreMatch ? parseFloat(scoreMatch[1]) : 5;
            
            // Determine rating and usability
            const rating = score >= 8 ? "Excellent" : 
                          score >= 6 ? "Good" : 
                          score >= 4 ? "Fair" : "Poor";
            
            const usableForGeneration = score >= 5;
            
            // Extract recommendation
            const recommendationMatch = content.match(/recommendation:\s*"([^"]+)"/i) ||
                                      content.match(/(Excellent for AI generation|Good with.*?limitations|Fair.*?issues|Poor.*?retaking)/i);
            const recommendation = recommendationMatch ? recommendationMatch[1] : 
                                 score >= 7 ? "Great for AI generation!" :
                                 score >= 5 ? "Usable with some limitations" :
                                 "Consider retaking photo for better results";

            console.log(`[PHOTO_QUALITY] Photo ${index + 1}: Score ${score}/10, Rating: ${rating}`);
            
            return {
              photoIndex: index + 1,
              qualityScore: score,
              rating,
              usableForGeneration,
              recommendation,
              detailedAnalysis: content,
              timestamp: new Date().toISOString()
            };
            
          } catch (error: any) {
            console.error(`[PHOTO_QUALITY] Error assessing photo ${index + 1}:`, error);
            return {
              photoIndex: index + 1,
              qualityScore: 5,
              rating: "Unknown",
              usableForGeneration: true,
              recommendation: "Unable to assess - proceeding with generation",
              detailedAnalysis: `Assessment failed: ${error.message}`,
              timestamp: new Date().toISOString()
            };
          }
        })
      );

      // Calculate overall session stats
      const avgScore = assessments.reduce((sum, a) => sum + a.qualityScore, 0) / assessments.length;
      const usableCount = assessments.filter(a => a.usableForGeneration).length;
      
      console.log(`[PHOTO_QUALITY] Assessment complete - Average score: ${avgScore.toFixed(1)}/10, ${usableCount}/${assessments.length} photos usable`);
      
      res.json({
        success: true,
        assessments,
        summary: {
          averageScore: Math.round(avgScore * 10) / 10,
          totalPhotos: assessments.length,
          usablePhotos: usableCount,
          recommendation: avgScore >= 7 ? "Photos are excellent for generation" :
                         avgScore >= 5 ? "Photos are suitable for generation" :
                         "Consider improving photo quality for better results"
        }
      });
      
    } catch (error: any) {
      console.error('[PHOTO_QUALITY] Assessment error:', error);
      res.status(500).json({ 
        error: "Failed to assess photo quality",
        message: error.message 
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}