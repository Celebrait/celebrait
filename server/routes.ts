import type { Express } from "express";
import { createServer, type Server } from "http";
import { Readable } from "stream";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { insertUserSchema, insertCardSchema, insertLovedOneSchema, insertOrderSchema } from "@shared/schema";

import OpenAI from "openai";
import Stripe from "stripe";
import Replicate from "replicate";
import FormData from "form-data";
import { createCanvas, loadImage } from "canvas";
import { sendEmail, generateOrderConfirmationEmail, generateDigitalCardEmail, generateCardReadyNotificationEmail, generateShippingNotificationEmail } from './email-service';
import { setupGoogleAuth } from "./google-auth";
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

// Watermark utility function
async function applyWatermark(imageData: string, opacity: number = 0.3): Promise<string> {
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
    ctx.fillStyle = `rgba(255, 255, 255, 0.8)`; // High opacity white text without outline
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

  // Get card
  app.get("/api/cards/:id", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const card = await storage.getCard(cardId);

      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      res.json(card);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Get card by ID (optimized endpoint)
  app.get("/api/cards/:id", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const card = await storage.getCard(cardId);

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
      
      res.json(optimizedCard);
    } catch (error: any) {
      res.status(500).json({ message: "Error fetching card: " + error.message });
    }
  });

  // Get card front image (optimized endpoint)
  app.get("/api/cards/:id/front-image", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const card = await storage.getCard(cardId);

      if (!card || !card.frontImageUrl) {
        return res.status(404).json({ message: "Front image not found" });
      }

      // Extract base64 data and convert to buffer for faster serving
      const base64Data = card.frontImageUrl.split(',')[1];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Set appropriate headers for image serving
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'ETag': `"${cardId}-front"`
      });
      
      res.send(imageBuffer);
    } catch (error: any) {
      res.status(500).json({ message: "Error serving front image: " + error.message });
    }
  });

  // Get card inside image (optimized endpoint)
  app.get("/api/cards/:id/inside-image", async (req, res) => {
    try {
      const cardId = parseInt(req.params.id);
      const card = await storage.getCard(cardId);

      if (!card || !card.insideImageUrl) {
        return res.status(404).json({ message: "Inside image not found" });
      }

      // Extract base64 data and convert to buffer for faster serving
      const base64Data = card.insideImageUrl.split(',')[1];
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      // Set appropriate headers for image serving
      res.set({
        'Content-Type': 'image/png',
        'Content-Length': imageBuffer.length,
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'ETag': `"${cardId}-inside"`
      });
      
      res.send(imageBuffer);
    } catch (error: any) {
      res.status(500).json({ message: "Error serving inside image: " + error.message });
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
          n: 1
        });
        console.log("Successfully used gpt-image-1 for front card generation");
      } catch (gptError: any) {
        console.log("gpt-image-1 not available, falling back to dall-e-3:", gptError.message);

        frontResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: frontPrompt,
          size: "1024x1024",
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
        const insidePrompt = `Create the inside of a greeting card in ${stylePrompt} style. Use similar colors, textures, and artistic elements from the front card design. Display the message "${insideText}" in elegant typography that matches the front card style. Layout should be clean and readable like a traditional greeting card interior with the text centered and beautifully formatted.`;

        console.log("Generating inside card with matching style");

        let insideResponse;
        try {
          insideResponse = await openai.images.generate({
            model: "gpt-image-1",
            prompt: insidePrompt,
            size: "1024x1024",
            n: 1
          });
          console.log("Successfully used gpt-image-1 for inside card generation");
        } catch (gptError: any) {
          console.log("gpt-image-1 not available for inside card, falling back to dall-e-3:", gptError.message);

          insideResponse = await openai.images.generate({
            model: "dall-e-3",
            prompt: insidePrompt,
            size: "1024x1024",
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

      const frontImageGeneration = await openai.images.generate({
        model: "gpt-image-1",
        prompt: enhancedFrontPrompt,
        n: 1,
        size: "1024x1024"
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

        try {
          const insideImageGeneration = await openai.images.generate({
            model: "gpt-image-1",
            prompt: imageToImagePrompt,
            n: 1,
            size: "1024x1024"
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

          const fallbackGeneration = await openai.images.generate({
            model: "gpt-image-1", 
            prompt: enhancedInsidePrompt,
            n: 1,
            size: "1024x1024"
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

      // Update card with generated images
      const updatedCard = await storage.updateCard(cardId, {
        frontImageUrl,
        insideImageUrl,
        status: 'completed'
      });

      res.json(updatedCard);
    } catch (error: any) {
      res.status(500).json({ message: "Error generating style transformation: " + error.message });
    }
  });

  // Generate card images
  app.post("/api/generate-images", async (req, res) => {
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

      // Check if frontPrompt already contains detailed character descriptions (from test page)
      const hasDetailedCharacters = frontPrompt.includes('featuring Person') || frontPrompt.includes('Person 1:') || frontPrompt.includes('Person 2:');

      if (hasDetailedCharacters) {
        // Use the detailed prompt directly from the test page
        console.log('Using detailed character prompt from frontend:', frontPrompt);

        frontImageGeneration = await openai.images.generate({
          model: "gpt-image-1",
          prompt: frontPrompt,
          n: 1,
          size: "1024x1024"
        });
      } else if (photoData) {
        // Direct GPT-Image-1 transformation with multiple photo references (no GPT Vision analysis needed)
        console.log('Using direct GPT-Image-1 edits API with photo reference');

        try {
          console.log('Using GPT-Image-1 edits API for direct transformation with multiple photo support');

          // Support both single photo and multiple photos
          const photosToProcess = Array.isArray(photoData) ? photoData : [photoData];

          // Use form-data approach with GPT-Image-1 edits API
          const FormData = (await import('form-data')).default;
          const formData = new FormData();

          // Add all photos to the form data
          photosToProcess.forEach((photo: string, index: number) => {
            // Extract MIME type and base64 data from uploaded photo
            const mimeMatch = photo.match(/^data:image\/([a-z]+);base64,/);
            const mimeType = mimeMatch ? mimeMatch[1] : 'png';
            const base64Data = photo.replace(/^data:image\/[a-z]+;base64,/, '');
            const imageBuffer = Buffer.from(base64Data, 'base64');

            console.log(`Photo ${index + 1} buffer size:`, imageBuffer.length, 'bytes, MIME type:', mimeType);

            // Add image buffer with proper metadata using image[] parameter for multiple photos
            formData.append('image[]', imageBuffer, {
              filename: `photo${index + 1}.${mimeType}`,
              contentType: `image/${mimeType}`
            });
          });

          formData.append('prompt', frontPrompt);
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

          // Process the response to create frontImageGeneration-like object
          frontImageGeneration = {
            data: (responseData as any).data || []
          };

          console.log('Successfully generated image using GPT-Image-1 edits API with multiple photo support');
        } catch (imageEditError: any) {
          console.log('GPT-Image-1 edits API failed, falling back to standard text generation:', imageEditError.message);

          // Fallback to standard text-only generation
          frontImageGeneration = await openai.images.generate({
            model: "gpt-image-1",
            prompt: frontPrompt,
            n: 1,
            size: "1024x1024"
          });
        }
      } else {
        // Standard text-only generation
        frontImageGeneration = await openai.images.generate({
          model: "gpt-image-1",
          prompt: frontPrompt,
          n: 1,
          size: "1024x1024"
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

      // Extract image data FIRST (gpt-image-1 returns base64 data in 'data' array)
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

          // Use the same pattern as line 1431 - direct style reference with front card image
          const insideCardPrompt = `Square 1:1 aspect ratio design. Reference this images style, atmosphere, colour, vibe and typography to create a new image with the text "${insideMessage}" The reference image should be used to stylise the background with the text prominent on the screen, as a square format design.`;

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

      // Update card with generated images
      const updatedCard = await storage.updateCard(cardId, {
        frontImageUrl,
        insideImageUrl,
        status: 'completed'
      });

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

  // Create free order
  app.post("/api/create-free-order", async (req, res) => {
    try {
      const { cardId, customerInfo, paymentType = 'free' } = req.body;

      if (!cardId || !customerInfo) {
        return res.status(400).json({ message: "Card ID and customer info are required" });
      }

      const reference = `celebrait_free_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const orderData = {
        cardId: parseInt(cardId),
        customerEmail: customerInfo.email,
        customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
        customerPhone: customerInfo.phone || null,
        amount: 0,
        baseAmount: 0,
        tipAmount: 0,
        currency: 'ZAR',
        paymentReference: reference,
        shippingAddress: customerInfo.address || null,
        orderType: 'free',
        paymentStatus: 'free',
        orderStatus: 'completed'
      };

      const order = await storage.createOrder(orderData);

      // Update card status to completed for free orders
      const card = await storage.getCard(cardId);
      if (card) {
        await storage.updateCard(cardId, { status: 'completed' });
      }

      // Send digital card email
      try {
        const emailParams = generateDigitalCardEmail({
          customerEmail: customerInfo.email,
          customerName: `${customerInfo.firstName} ${customerInfo.lastName}`,
          paymentReference: reference
        }, card?.frontImageUrl || '', req.get('host'));
        await sendEmail(emailParams);
        console.log('Free digital card email sent successfully to:', customerInfo.email);
      } catch (emailError) {
        console.error('Failed to send free digital card email:', emailError);
      }

      res.json({ 
        orderId: order.id,
        reference,
        downloadUrl: card?.frontImageUrl,
        message: "Free order created successfully"
      });

    } catch (error: any) {
      res.status(500).json({ message: "Error creating free order: " + error.message });
    }
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

  // Get card by ready reference for delivery choice flow
  app.get("/api/cards/ready/:reference", async (req, res) => {
    try {
      const reference = req.params.reference;
      console.log('Fetching card by ready reference:', reference);
      
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

      const card = await storage.getCard(parseInt(cardId));
      
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
        frontImageUrl: card.frontImageUrl ? `/api/cards/${cardId}/front-image` : null,
        insideImageUrl: card.insideImageUrl ? `/api/cards/${cardId}/inside-image` : null,
        // Remove massive base64 data to improve loading speed
        conversationData: card.conversationData || {}
      };
      
      // Add caching headers for faster subsequent loads
      res.set({
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'ETag': `"${cardId}-${card.status}"`
      });
      
      res.json({
        card: optimizedCard,
        reference,
        message: "Card ready for delivery choice"
      });
    } catch (error: any) {
      console.error('Error fetching card by ready reference:', error);
      res.status(400).json({ message: error.message });
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
      const { imageData, imageDataArray, scenePrompt, style, includeText, cardText } = req.body;

      // Support both single image (legacy) and multiple images (new)
      const imagesToProcess = imageDataArray || (imageData ? [imageData] : []);

      if (imagesToProcess.length === 0 || !scenePrompt) {
        return res.status(400).json({ message: "Image data and scene description are required" });
      }

      console.log('Processing GPT-Image-1 scene edit request');
      console.log('Number of images:', imagesToProcess.length);
      console.log('Scene prompt:', scenePrompt);
      console.log('Style:', style);
      console.log('Include text:', includeText);
      console.log('Card text:', cardText);

      // Build the complete prompt with enhanced character action descriptions
      const characterText = imagesToProcess.length > 1 ? 'characters from the reference images' : 'characters from the reference image';
      let fullPrompt = `MANDATORY: Create a perfectly SQUARE composition with equal width and height - NOT portrait, NOT landscape. Full bleed square design with no borders, fill entire square frame. Create a completely new scene featuring the ${characterText}. CRITICAL INSTRUCTIONS: 
1) Use the people in the reference image(s) ONLY as character appearance references (facial features, general look)
2) DO NOT copy or replicate their original positioning, poses, spatial relationships, or interactions from the reference image
3) CREATE AN ENTIRELY NEW COMPOSITION where characters are arranged differently and naturally for this new scene: ${scenePrompt}
4) If multiple people were together in the reference, separate them and place them in new positions that fit the scene
5) Give each character new poses, actions, and interactions that match the described scenario, not their original photo
6) Choose NEW CLOTHING for each person that appropriately matches the occasion and setting described in the scene
7) Completely reimagine how the characters would naturally be positioned and interact in this new environment
8) COMPOSE FOR SQUARE FORMAT - ensure all elements fit within a square boundary`;
      if (style && style.trim()) {
        fullPrompt = `${fullPrompt}, rendered in ${style} art style`;
      }
      if (includeText && cardText && cardText.trim()) {
        fullPrompt = `${fullPrompt}. Add EXACTLY the text "${cardText}" and NO OTHER TEXT. Use typography that matches the ${style || 'artistic'} style and complements the overall vibe of the image. The text should be prominently displayed and well-integrated into the design.`;
      }
      fullPrompt = `${fullPrompt}. High-quality artistic rendering, professional artwork.`;

      console.log('Complete prompt for scene editing:', fullPrompt);

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
        formData.append('quality', 'low');
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

        // Add timeout handling for GPT-Image-1 requests
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('GPT-Image-1 scene edit request timed out - this model may require special OpenAI API access')), 30000);
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

        // Apply watermark to the generated image
        const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);

        console.log('Watermark applied to front image');
        res.json({ 
          imageUrl: watermarkedImageUrl,
          originalImageUrl: imageUrl, // Store original for secure access
          usage: (responseData as any).usage
        });

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

      let errorMessage = 'Scene editing failed';
      if (error.message?.includes('moderation')) {
        errorMessage = 'Content moderation detected unsafe content in the image or prompt';
      } else if (error.message?.includes('special access')) {
        errorMessage = 'GPT-Image-1 requires special access permissions from OpenAI';
      } else if (error.message) {
        errorMessage = error.message;
      }

      res.status(500).json({ message: errorMessage });
    }
  });

  // Generate inside card with style analysis from front card
  app.post("/api/generate-inside-card", async (req, res) => {
    if (!openai) {
      return res.status(500).json({ message: "OpenAI API key not configured" });
    }

    try {
      const { frontCardImage, insideText } = req.body;

      if (!frontCardImage || !insideText) {
        return res.status(400).json({ message: "Front card image and inside text are required" });
      }

      console.log('Generating inside card using GPT-Image-1 image-to-image');
      console.log('Inside text:', insideText);

      // Convert base64 front card image to buffer for upload
      const base64Data = frontCardImage.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // Detect MIME type from the front card image
      const mimeMatch = frontCardImage.match(/^data:image\/([a-z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'png';

      console.log('Front card image buffer size:', imageBuffer.length, 'bytes, MIME type:', mimeType);

      // Create prompt following your exact specification
      const insideCardPrompt = `Square 1:1 aspect ratio design. Reference this images style, atmosphere, colour, vibe and typography to create a new image with the text "${insideText}" The reference image should be used to stylise the background with the text prominent on the screen, as a square format design.`;

      console.log('Inside card prompt:', insideCardPrompt);

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
      formData.append('quality', 'low');
      formData.append('moderation', 'low');
      formData.append('background', 'auto');

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

      // Apply watermark to the generated inside card
      const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);

      console.log('Watermark applied to inside card');
      res.json({ 
        imageUrl: watermarkedImageUrl,
        originalImageUrl: imageUrl, // Store original for secure access
        usage: (responseData as any).usage
      });

    } catch (error: any) {
      console.error('Inside card generation error:', error);

      let errorMessage = 'Inside card generation failed';
      if (error.message?.includes('moderation')) {
        errorMessage = 'Content moderation detected unsafe content in the text or image';
      } else if (error.message?.includes('special access')) {
        errorMessage = 'GPT-Image-1 requires special access permissions from OpenAI';
      } else if (error.message) {
        errorMessage = error.message;
      }

      res.status(500).json({ message: errorMessage });
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

      // Extract original images from conversationData
      const conversationData = card.conversationData as any;
      if (!conversationData || !conversationData.originalFrontImageUrl) {
        return res.status(400).json({ message: "Original images not found in card data" });
      }

      // Update card with original unwatermarked images
      const updatedCard = await storage.updateCard(cardId, {
        frontImageUrl: conversationData.originalFrontImageUrl,
        insideImageUrl: conversationData.originalInsideImageUrl || null,
        status: 'paid'
      });

      console.log('Watermarks removed successfully');
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
  app.post("/api/transform-style-gpt-image-1", async (req, res) => {
    try {
      if (!hasOpenAI || !openai) {
        return res.status(503).json({ message: "OpenAI API is not configured" });
      }

      const { imageData, imageDataArray, style } = req.body;

      // Support both single image (legacy) and multiple images (new)
      const imagesToProcess = imageDataArray || (imageData ? [imageData] : []);

      if (imagesToProcess.length === 0 || !style) {
        return res.status(400).json({ message: "Image data and style are required" });
      }

      console.log('GPT-Image-1 style transformation with style:', style);
      console.log('Number of images:', imagesToProcess.length);

      // Enhance the style prompt to explicitly preserve photo content while transforming style
      const transformPrompt = `Transform this image into ${style} art style. CRITICAL REQUIREMENTS: 1) Keep the EXACT same person, pose, composition, background, and all visual elements from the original photo - DO NOT change anything about the content, scene, or subject matter. 2) ONLY transform the artistic style/rendering technique to ${style} while preserving every detail of the original image. 3) The person must look identical to the original photo - same facial features, expression, clothing, positioning. 4) Render as a perfectly square image with 1:1 aspect ratio (width equals height). The final output must be square-formatted, not portrait or landscape.`;
      console.log('GPT-Image-1 transformation prompt:', transformPrompt);

      try {
        console.log('Making GPT-Image-1 API request using direct HTTP form-data');
        console.log('🔍 DEBUG: Requested size parameter:', '1024x1024');

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

        formData.append('prompt', transformPrompt);
        formData.append('model', 'gpt-image-1');
        formData.append('n', '1');
        formData.append('size', '1024x1024');
        formData.append('quality', 'low');
        formData.append('moderation', 'low');

        console.log('📋 Form data parameters being sent:');
        console.log('- model:', 'gpt-image-1');
        console.log('- size:', '1024x1024');
        console.log('- quality:', 'high');
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
          setTimeout(() => reject(new Error('GPT-Image-1 request timed out - this model may require special OpenAI API access')), 30000);
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

        // Apply watermark to the generated image
        const watermarkedImageUrl = await applyWatermark(imageUrl, 0.25);

        console.log('Watermark applied to transformed image');
        res.json({ 
          imageUrl: watermarkedImageUrl,
          originalImageUrl: imageUrl // Store original for secure access
        });

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

        // Check if both front and inside images are ready
        const frontReady = card.frontImageUrl && card.frontImageUrl.startsWith('data:image/');
        const insideReady = !card.insideImageUrl || card.insideImageUrl.startsWith('data:image/');

        console.log(`Card ${card.id} image readiness check:`, {
          frontImageUrl: card.frontImageUrl ? 'present' : 'null',
          frontReady,
          insideImageUrl: card.insideImageUrl ? 'present' : 'null', 
          insideReady,
          status: card.status
        });

        if (!frontReady || !insideReady) {
          return { ready: false, card };
        }

        // Check if base64 data is substantial (not corrupted)
        if (card.frontImageUrl) {
          try {
            const frontBase64Data = card.frontImageUrl.split(',')[1];
            if (!frontBase64Data || frontBase64Data.length < 100) { // Minimum reasonable size (lowered for testing)
              console.log(`Card ${card.id} front image data too small:`, frontBase64Data?.length || 0, 'characters');
              return { ready: false, card };
            }
            console.log(`Card ${card.id} images validated successfully:`, {
              frontSize: frontBase64Data.length,
              hasInside: !!card.insideImageUrl,
              status: card.status
            });
            return { ready: true, card };
          } catch (parseError) {
            console.log(`Card ${card.id} base64 parsing error:`, parseError);
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

      // Create a temporary reference for the delivery choice flow that includes cardId
      const reference = `celebrait_ready_${cardId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create order data structure for the email template
      const orderData = {
        customerEmail,
        customerName,
        paymentReference: reference,
        cardId: cardId
      };

      // Send card ready notification email (this should take user to delivery choice)
      try {
        const emailParams = generateCardReadyNotificationEmail(orderData, req.get('host'));
        await sendEmail(emailParams);
        console.log('Card ready notification email sent successfully to:', customerEmail);

        res.json({
          success: true,
          message: 'Card ready notification sent successfully',
          reference
        });
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

  // Create free digital order
  app.post("/api/create-free-order", async (req, res) => {
    try {
      const { cardId, customerEmail, customerName } = req.body;

      if (!cardId || !customerEmail || !customerName) {
        return res.status(400).json({ message: "Card ID, customer email, and name are required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      const orderData = {
        cardId: parseInt(cardId),
        customerEmail,
        customerName,
        customerPhone: '', // Not required for digital orders
        amount: 0,
        currency: 'ZAR',
        paymentReference: `free_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        shippingAddress: null
      };

      const order = await storage.createOrder(orderData);
      
      // Update order status for digital delivery
      const updatedOrder = await storage.updateOrder(order.id, {
        orderType: 'free_digital',
        paymentStatus: 'completed',
        orderStatus: 'completed',
        baseAmount: 0,
        tipAmount: 0
      });
      
      await storage.updateCard(card.id, { status: 'paid' });

      // Send digital card email
      try {
        const emailParams = generateDigitalCardEmail(updatedOrder, card.frontImageUrl || '');
        await sendEmail(emailParams);
        console.log('Free digital card email sent successfully');
      } catch (emailError) {
        console.error('Failed to send free digital card email:', emailError);
      }

      res.json({
        ...order,
        card,
        message: 'Free digital card created and sent successfully'
      });

    } catch (error: any) {
      res.status(500).json({ message: "Error creating free order: " + error.message });
    }
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

  const httpServer = createServer(app);
  return httpServer;
}