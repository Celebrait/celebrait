import type { Express } from "express";
import { createServer, type Server } from "http";
import { Readable } from "stream";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { insertUserSchema, insertCardSchema, insertLovedOneSchema, insertOrderSchema } from "@shared/schema";
import { PHOTO_ANALYSIS_PROMPT } from "@shared/prompts";
import OpenAI from "openai";
import Stripe from "stripe";
import Replicate from "replicate";
import FormData from "form-data";

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
      const cardData = insertCardSchema.parse(req.body);
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const card = await storage.createCard({
        ...cardData,
        userId
      });

      res.json(card);
    } catch (error: any) {
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
        ? `Create a greeting card in ${stylePrompt} style. Recreate this exact scene: ${imageAnalysis}. Add the text "${frontText || 'Happy Birthday!'}" in elegant typography that matches the ${stylePrompt} artistic style. The text should be prominently displayed and beautifully integrated into the design.`
        : `Create a greeting card in ${stylePrompt} style with the text "${frontText || 'Happy Birthday!'}" in elegant typography`;

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
        console.log("gpt-image-1 not available, falling back to dall-e-3:", gptError.message);
        
        frontResponse = await openai.images.generate({
          model: "dall-e-3",
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
        const insidePrompt = `Create the inside of a greeting card in ${stylePrompt} style. Use similar colors, textures, and artistic elements from the front card design. Display the message "${insideText}" in elegant typography that matches the front card style. Layout should be clean and readable like a traditional greeting card interior with the text centered and beautifully formatted.`;
        
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
          console.log("gpt-image-1 not available for inside card, falling back to dall-e-3:", gptError.message);
          
          insideResponse = await openai.images.generate({
            model: "dall-e-3",
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

  // Analyze image composition endpoint for style transformation
  app.post("/api/analyze-image-composition", async (req, res) => {
    try {
      const { photoData } = req.body;

      if (!photoData) {
        return res.status(400).json({ message: "Photo data is required" });
      }

      if (!openai) {
        return res.status(500).json({ message: "OpenAI API not configured" });
      }

      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "The owner of this image has given explicit consent to use their photo as a reference for artwork. I need to recreate this scene as artistic reference for illustration. Please describe the artistic elements including: character styling (hair style and color, age range, skin tone for painting, eye color, glasses, facial hair, accessories), and the complete scene composition (background setting, objects, lighting, colors, atmosphere, mood, spatial arrangement). Focus on visual elements that would help an artist recreate this scene in a stylized illustration."
              },
              {
                type: "image_url",
                image_url: {
                  url: photoData
                }
              }
            ]
          }
        ],
        max_tokens: 600
      });

      const analysis = visionResponse.choices[0].message.content;
      res.json({ analysis });
    } catch (error: any) {
      res.status(500).json({ message: "Error analyzing image: " + error.message });
    }
  });

  // Photo analysis endpoint (single photo)
  app.post("/api/analyze-photo", async (req, res) => {
    try {
      const { photoData } = req.body;
      
      if (!photoData) {
        return res.status(400).json({ message: "Photo data is required" });
      }

      if (!openai) {
        return res.status(500).json({ message: "OpenAI API not configured" });
      }

      const visionResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: PHOTO_ANALYSIS_PROMPT
              },
              {
                type: "image_url",
                image_url: {
                  url: photoData
                }
              }
            ]
          }
        ],
        max_tokens: 500
      });

      const analysis = visionResponse.choices[0].message.content;
      
      if (!analysis) {
        return res.status(400).json({ 
          message: "Photo analysis failed. Please try a different photo with clear lighting and the person's face visible."
        });
      }

      res.json({ analysis });
    } catch (error: any) {
      res.status(500).json({ message: "Error analyzing photo: " + error.message });
    }
  });

  // Multi-photo analysis endpoint
  app.post("/api/analyze-photos", async (req, res) => {
    try {
      const { photoDataArray } = req.body;
      
      if (!photoDataArray || !Array.isArray(photoDataArray) || photoDataArray.length === 0) {
        return res.status(400).json({ message: "Photo data array is required" });
      }

      if (!openai) {
        return res.status(500).json({ message: "OpenAI API not configured" });
      }

      const analyses = [];

      for (let i = 0; i < photoDataArray.length; i++) {
        const photoData = photoDataArray[i];
        
        console.log(`Analyzing photo ${i + 1} of ${photoDataArray.length}...`);
        
        const visionResponse = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `${PHOTO_ANALYSIS_PROMPT}\n\nStart your response with "Person ${i + 1}:"`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: photoData
                  }
                }
              ]
            }
          ],
          max_tokens: 500
        });

        const analysis = visionResponse.choices[0].message.content;
        
        if (analysis) {
          analyses.push({
            personIndex: i + 1,
            analysis: analysis
          });
        }
      }

      if (analyses.length === 0) {
        return res.status(400).json({ 
          message: "Photo analysis failed for all photos. Please try different photos with clear lighting and faces visible."
        });
      }

      res.json({ analyses });
    } catch (error: any) {
      res.status(500).json({ message: "Error analyzing photos: " + error.message });
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
      } else if (photoData && photoAnalysis) {
        // Check if this is a scene composition analysis (for upload_and_transform)
        const isSceneAnalysis = photoAnalysis.includes('background setting') || 
                               photoAnalysis.includes('scene composition') ||
                               photoAnalysis.includes('lighting') ||
                               photoAnalysis.includes('atmosphere');
        
        if (isSceneAnalysis) {
          // Use the complete scene analysis for transformation
          console.log('Using scene composition analysis for style transformation:', photoAnalysis);
          
          let enhancedPrompt = frontPrompt.includes('Create an artistic representation') 
            ? frontPrompt.replace(
                'Create an artistic representation of the person in the uploaded photo',
                `Recreate this exact scene with precise accuracy: ${photoAnalysis}`
              )
            : `${frontPrompt}. Recreate this exact scene: ${photoAnalysis}`;
          
          // Add transformation and text requirements
          enhancedPrompt += '. CRITICAL REQUIREMENTS: 1) Maintain the exact composition, poses, and spatial relationships described. 2) Transform the artistic style completely while preserving all scene elements. 3) Text must be large, bold, and clearly readable - positioned prominently.';
          console.log('Using scene transformation prompt:', enhancedPrompt);
          
          frontImageGeneration = await openai.images.generate({
            model: "gpt-image-1",
            prompt: enhancedPrompt,
            n: 1,
            size: "1024x1024"
          });
        } else {
          // Use the person-only analysis as before
          console.log('Using pre-captured person analysis:', photoAnalysis);
          
          let enhancedPrompt = frontPrompt.replace(
            'Create an artistic representation of the person in the uploaded photo',
            `Create an artistic representation of a person with these specific characteristics: ${photoAnalysis}`
          );
          
          // Add explicit instructions for scene and text prominence
          enhancedPrompt += '. CRITICAL REQUIREMENTS: 1) The scene/background must be clearly visible and match the described setting exactly. 2) Text must be large, bold, and clearly readable - positioned prominently in the foreground or on a clear background area.';
          console.log('Using enhanced prompt with photo description:', enhancedPrompt);
          
          frontImageGeneration = await openai.images.generate({
            model: "gpt-image-1",
            prompt: enhancedPrompt,
            n: 1,
            size: "1024x1024"
          });
        }
      } else if (photoData) {
        // Direct image-to-image transformation using the uploaded photo as visual reference
        console.log('Using direct image-to-image transformation with uploaded photo as reference');
        
        try {
          // For now, analyze the photo to create enhanced prompts since direct image input isn't supported
          console.log('Analyzing uploaded photo for enhanced prompt generation');
          
          const visionResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze this image and describe ONLY the visual artistic elements for recreation: composition, poses, spatial relationships, lighting, color palette, artistic style, scene elements, and overall mood. Focus on what would be needed to recreate this exact visual arrangement in a different artistic style."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: photoData
                    }
                  }
                ]
              }
            ],
            max_tokens: 300
          });
          
          const visualAnalysis = visionResponse.choices[0].message.content;
          console.log('Visual analysis result:', visualAnalysis);
          
          if (visualAnalysis) {
            // Create enhanced prompt using visual analysis for true style transformation
            const enhancedPrompt = `${frontPrompt}. VISUAL REFERENCE: Recreate this exact composition and arrangement: ${visualAnalysis}. Transform the artistic style while maintaining the precise visual structure, poses, and spatial relationships described.`;
            
            frontImageGeneration = await openai.images.generate({
              model: "gpt-image-1",
              prompt: enhancedPrompt,
              n: 1,
              size: "1024x1024"
            });
            console.log('Successfully generated image using visual analysis enhancement');
          } else {
            throw new Error('Visual analysis failed');
          }
        } catch (imageInputError: any) {
          console.log('Direct image input not supported, using enhanced prompt approach:', imageInputError.message);
          
          // Fallback: analyze the photo for prompt enhancement
          const visionResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Describe the visual characteristics for artistic reference: hair color and texture, hairstyle, age appearance, skin tone, eyewear, facial structure, and build. Focus on artistic details only."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: photoData
                    }
                  }
                ]
              }
            ],
            max_tokens: 200
          });
          
          const photoDescription = visionResponse.choices[0].message.content;
          console.log('Photo analysis result:', photoDescription);
          
          if (photoDescription && photoDescription.trim().length > 20 && !photoDescription.includes("can't identify")) {
            let enhancedPrompt = frontPrompt.replace(
              'Create an artistic representation of the person in the uploaded photo',
              `Create an artistic representation of a person with these specific characteristics: ${photoDescription}`
            );
            
            enhancedPrompt += '. CRITICAL REQUIREMENTS: 1) The scene/background must be clearly visible and match the described setting exactly. 2) Text must be large, bold, and clearly readable - positioned prominently in the foreground or on a clear background area.';
            
            frontImageGeneration = await openai.images.generate({
              model: "gpt-image-1",
              prompt: enhancedPrompt,
              n: 1,
              size: "1024x1024"
            });
          } else {
            console.log('Photo analysis failed, using original prompt without photo reference');
            const cleanedPrompt = frontPrompt.replace('Create an artistic representation of the person in the uploaded photo', 'Create an artistic representation of a person');
            frontImageGeneration = await openai.images.generate({
              model: "gpt-image-1",
              prompt: cleanedPrompt,
              n: 1,
              size: "1024x1024"
            });
          }
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

      // Generate inside image if provided, using GPT Vision analysis for perfect style matching
      if (insidePrompt && frontImageUrl) {
        console.log('Generating inside card using GPT Vision style matching approach');
        
        try {
          // Analyze the front card with GPT Vision for detailed style analysis
          const styleAnalysisResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze this greeting card image for visual style consistency. Please describe in detail: 1) The artistic style (watercolor, digital art, cartoon, realistic, etc.) 2) Color palette (dominant colors, mood, saturation levels) 3) Typography style (font family, weight, size, color, positioning, decorative elements) 4) Lighting and atmosphere (bright, soft, dramatic, warm, cool) 5) Background elements and textures 6) Overall visual mood and artistic treatment. Be very specific about visual elements that would help recreate the same artistic style for a companion piece."
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: frontImageUrl
                    }
                  }
                ]
              }
            ],
            max_tokens: 800
          });
          
          const styleAnalysis = styleAnalysisResponse.choices[0].message.content;
          console.log('Front card style analysis completed');
          
          if (styleAnalysis) {
            // Extract the message text from the inside prompt
            const messageMatch = insidePrompt.match(/"([^"]+)"/);
            const insideMessage = messageMatch ? messageMatch[1] : 'Happy Birthday!';
            
            // Generate inside card using the detailed style analysis
            const styleMatchedInsidePrompt = `Create the interior of a greeting card that perfectly matches this visual style analysis: ${styleAnalysis}. 

CRITICAL REQUIREMENTS FOR PERFECT STYLE MATCHING:
1) Use the EXACT same artistic style, technique, and visual treatment described in the analysis
2) Apply the IDENTICAL color palette, saturation levels, and mood from the front card
3) Use the SAME typography style - match font family, weight, sizing, color, and positioning approach exactly
4) Match the lighting, atmosphere, and overall visual mood precisely
5) Display this message prominently and beautifully: "${insideMessage}"
6) Create a subtle, complementary background that references the front card's visual elements without overwhelming the text
7) Maintain the same artistic quality and professional appearance as the front card
8) Square 1:1 aspect ratio, full bleed design, no borders
9) The inside should look like it was created by the same artist using identical design principles

The result should be a perfect visual companion to the front card with seamless style consistency.`;
            
            console.log('Generating inside card with style-matched prompt');
            const insideGeneration = await openai.images.generate({
              model: "gpt-image-1",
              prompt: styleMatchedInsidePrompt,
              n: 1,
              size: "1024x1024"
            });
            
            const insideResponse = insideGeneration as any;
            if (insideResponse.data && Array.isArray(insideResponse.data) && insideResponse.data.length > 0) {
              const imageData = insideResponse.data[0];
              
              if (typeof imageData === 'string') {
                insideImageUrl = `data:image/png;base64,${imageData}`;
              } else if (imageData.b64_json) {
                insideImageUrl = `data:image/png;base64,${imageData.b64_json}`;
              } else if (imageData.url) {
                insideImageUrl = imageData.url;
              }
              console.log('Successfully generated style-matched inside card using GPT Vision analysis');
            }
          } else {
            throw new Error('GPT Vision analysis failed to provide style description');
          }
        } catch (visionError: any) {
          console.log('GPT Vision style matching failed, using enhanced fallback approach:', visionError.message);
          
          // Enhanced fallback approach with better style inference
          const messageMatch = insidePrompt.match(/"([^"]+)"/);
          const insideMessage = messageMatch ? messageMatch[1] : 'Happy Birthday!';
          
          // Extract style clues from the front prompt
          const artStyle = frontPrompt.includes('watercolor') ? 'watercolor' : 
                          frontPrompt.includes('cartoon') ? 'cartoon' :
                          frontPrompt.includes('realistic') ? 'realistic' :
                          frontPrompt.includes('digital art') ? 'digital art' :
                          frontPrompt.includes('pop art') ? 'pop art' :
                          frontPrompt.includes('oil painting') ? 'oil painting' :
                          frontPrompt.includes('whimsical') ? 'whimsical' :
                          frontPrompt.includes('dreamy') ? 'dreamy watercolor' : 'artistic';
          
          const frontTextMatch = frontPrompt.match(/(?:text|message)[^"]*"([^"]+)"/i);
          const frontText = frontTextMatch ? frontTextMatch[1] : 'Happy Birthday!';
          
          const enhancedFallbackPrompt = `Create the interior of a greeting card in ${artStyle} style that perfectly matches the front card design. 

STYLE CONSISTENCY REQUIREMENTS:
1) Use identical ${artStyle} artistic technique and visual treatment
2) Match the exact color palette, mood, and saturation from the front card  
3) Use the same typography style as "${frontText}" - identical font family, weight, color, and positioning approach
4) Create complementary background elements that reference the front card without overwhelming the message
5) Display this message prominently: "${insideMessage}"
6) Maintain consistent lighting, atmosphere, and artistic quality
7) Square 1:1 aspect ratio, full bleed design, no borders

The inside should look like a perfect companion piece created by the same artist.`;
          
          console.log('Generating inside card with enhanced fallback prompt');
          const fallbackGeneration = await openai.images.generate({
            model: "gpt-image-1", 
            prompt: enhancedFallbackPrompt,
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
            console.log('Successfully generated inside card using enhanced fallback approach');
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
        const mockPaymentUrl = `${req.protocol}://${req.get('host')}/payment-success?reference=${reference}&status=success`;
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
          callback_url: `${req.protocol}://${req.get('host')}/payment-success`,
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

  // Paystack payment verification
  app.post("/api/verify-payment", async (req, res) => {
    try {
      const { reference } = req.body;

      if (!reference) {
        return res.status(400).json({ message: "Payment reference is required" });
      }

      const order = await storage.getOrderByReference(reference);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

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
      const transformPrompt = `Make this a ${artStyle} style image. ${prompt} ${scene}`.trim();

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
      const { imageData, scenePrompt, style, includeText, cardText } = req.body;
      
      if (!imageData || !scenePrompt) {
        return res.status(400).json({ message: "Image data and scene description are required" });
      }

      console.log('Processing GPT-Image-1 scene edit request');
      console.log('Scene prompt:', scenePrompt);
      console.log('Style:', style);
      console.log('Include text:', includeText);
      console.log('Card text:', cardText);

      // Build the complete prompt
      let fullPrompt = scenePrompt;
      if (style && style.trim()) {
        fullPrompt = `${scenePrompt} in ${style}`;
      }
      if (includeText && cardText && cardText.trim()) {
        fullPrompt = `${fullPrompt}. Include the text "${cardText}" beautifully integrated into the composition, rendered in the same artistic style as the rest of the image, as if it were naturally part of a greeting card design.`;
      }

      console.log('Complete prompt for scene editing:', fullPrompt);

      // Extract MIME type and base64 data
      const mimeMatch = imageData.match(/^data:image\/([a-z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'png';
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      
      console.log('Image buffer size:', imageBuffer.length, 'bytes, MIME type:', mimeType);

      try {
        console.log('Making GPT-Image-1 scene edit API request using direct HTTP form-data');
        
        // Use form-data package for proper multipart form handling
        const formData = new FormData();
        
        // Add image buffer directly with proper metadata
        formData.append('image', imageBuffer, {
          filename: `image.${mimeType}`,
          contentType: `image/${mimeType}`
        });
        formData.append('prompt', fullPrompt);
        formData.append('model', 'gpt-image-1');
        formData.append('n', '1');
        formData.append('size', '1024x1024');
        formData.append('quality', 'low');
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
        res.json({ 
          imageUrl,
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

  // GPT-Image-1 style transformation using OpenAI SDK as per documentation
  app.post("/api/transform-style-gpt-image-1", async (req, res) => {
    try {
      if (!hasOpenAI || !openai) {
        return res.status(503).json({ message: "OpenAI API is not configured" });
      }

      const { imageData, style } = req.body;

      if (!imageData || !style) {
        return res.status(400).json({ message: "Image data and style are required" });
      }

      console.log('GPT-Image-1 style transformation with style:', style);

      // Extract MIME type and base64 data
      const mimeMatch = imageData.match(/^data:image\/([a-z]+);base64,/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'png';
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      console.log('Image buffer size:', imageBuffer.length, 'bytes, MIME type:', mimeType);

      // Build transformation prompt
      const transformPrompt = `Transform the attached image into ${style}`;
      console.log('GPT-Image-1 transformation prompt:', transformPrompt);

      try {
        console.log('Making GPT-Image-1 API request using direct HTTP form-data');
        
        // Use form-data package for proper multipart form handling
        const formData = new FormData();
        
        // Add image buffer directly with proper metadata
        formData.append('image', imageBuffer, {
          filename: `image.${mimeType}`,
          contentType: `image/${mimeType}`
        });
        formData.append('prompt', transformPrompt);
        formData.append('model', 'gpt-image-1');
        formData.append('n', '1');
        formData.append('size', '1024x1024');
        
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
        res.json({ imageUrl });
        
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

  const httpServer = createServer(app);
  return httpServer;
}
