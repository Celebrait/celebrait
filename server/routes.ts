import type { Express } from "express";
import { createServer, type Server } from "http";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import { storage } from "./storage";
import { insertUserSchema, insertCardSchema, insertLovedOneSchema } from "@shared/schema";
import OpenAI from "openai";
import Stripe from "stripe";

// Temporarily allow running without API keys for testing
const hasOpenAI = !!process.env.OPENAI_API_KEY;
const hasStripe = !!process.env.STRIPE_SECRET_KEY;

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = hasOpenAI ? new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
}) : null;

const stripe = hasStripe ? new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
}) : null;

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
                text: "The owner of this image has given explicit consent to use their photo as a reference for artwork. I need to recreate this scene as artistic reference for illustration. Please describe the artistic elements including: character styling (hair style and color, age range, apparent sex, skin tone for painting, eye color, glasses, facial hair, accessories), and the complete scene composition (background setting, objects, lighting, colors, atmosphere, mood, spatial arrangement). Focus on visual elements that would help an artist recreate this scene in a stylized illustration."
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
                text: "Please describe the artistic visual characteristics visible in this image for the purpose of creating a fictional character illustration. Focus on observable physical features including hair color and style, facial structure, approximate age appearance, skin tone, and any visible accessories like glasses or jewelry. Provide an objective description of these visual elements as they would appear in an artistic rendering."
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
                  text: `Please describe the artistic visual characteristics visible in this image for Person ${i + 1} for the purpose of creating a fictional character illustration. Focus on observable physical features including hair color and style, facial structure, approximate age appearance, skin tone, and any visible accessories like glasses or jewelry. Provide an objective description of these visual elements as they would appear in an artistic rendering. Start your response with "Person ${i + 1}:"`
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

      let insideImageUrl = null;
      
      // Generate inside image if provided
      if (insidePrompt) {
        console.log('Using model: gpt-image-1 for inside image');
        
        const enhancedInsidePrompt = `${insidePrompt}. STYLE MATCHING: Use exactly the same artistic style, color palette, and visual treatment as the front card. Create a cohesive design where the inside feels like the same artist created both cards with consistent visual language.`;
        
        const insideImageGeneration = await openai.images.generate({
          model: "gpt-image-1", 
          prompt: enhancedInsidePrompt,
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
          console.log('Successfully extracted inside image data');
        }
      }

      // Extract front image data
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
        // Use the photo analysis that was already captured during onboarding
        console.log('Using pre-captured photo analysis:', photoAnalysis);
        
        // Integrate facial features from the successful onboarding analysis
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
      } else if (photoData) {
        // Fallback: try to analyze the photo again
        console.log('Photo provided but no analysis - attempting analysis');
        
        try {
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
        } catch (error: any) {
          console.log('Vision analysis failed:', error.message);
          const cleanedPrompt = frontPrompt.replace('Create an artistic representation of the person in the uploaded photo', 'Create an artistic representation of a person');
          frontImageGeneration = await openai.images.generate({
            model: "gpt-image-1",
            prompt: cleanedPrompt,
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
      
      // Generate inside image if provided
      if (insidePrompt) {
        console.log('Using model: gpt-image-1 for inside image');
        
        let finalInsidePrompt = insidePrompt;
        
        // If we have photo analysis and the inside prompt mentions character elements, integrate the analysis
        if (photoData && photoAnalysis && (insidePrompt.includes('character') || insidePrompt.includes('person'))) {
          console.log('Integrating photo analysis into inside prompt');
          finalInsidePrompt = insidePrompt.replace(
            'person with these specific characteristics',
            `person with these specific characteristics: ${photoAnalysis}`
          );
        }
        
        // Extract color and style information from front prompt for consistency
        const artStyle = frontPrompt.includes('watercolor') ? 'watercolor' : 
                        frontPrompt.includes('cartoon') ? 'cartoon' :
                        frontPrompt.includes('realistic') ? 'realistic' :
                        frontPrompt.includes('digital_art') ? 'digital art' :
                        frontPrompt.includes('pop_art') ? 'pop art' :
                        frontPrompt.includes('oil_painting') ? 'oil painting' : 'artistic';
        
        // Extract text from front prompt to understand typography
        const frontTextMatch = frontPrompt.match(/with the text "([^"]+)"/);
        const frontText = frontTextMatch ? frontTextMatch[1] : '';
        
        // Extract scene information from front prompt for subtle background reference
        const sceneMatch = frontPrompt.match(/in (.+?),/);
        const sceneDescription = sceneMatch ? sceneMatch[1] : '';
        
        const enhancedInsidePrompt = `${finalInsidePrompt}. REFERENCE FRONT CARD: The front card uses "${frontText}" in ${artStyle} style with scene: ${sceneDescription}. EXACT MATCHING REQUIRED: 1) Use IDENTICAL typography style, font family, text weight, letter spacing, and color treatment as the front card text. 2) Create a subtle background that makes artistic reference to the front card scene (${sceneDescription}) without overwhelming the message - use similar colors, lighting mood, or abstract elements from that setting. 3) Match the exact color palette, artistic texture, and visual mood from the front card. 4) Ensure the typography looks like it was designed by the same artist using the same font system. The inside should feel like a perfect companion piece to the front card.`;
        
        const insideImageGeneration = await openai.images.generate({
          model: "gpt-image-1", 
          prompt: enhancedInsidePrompt,
          n: 1,
          size: "1024x1024"
        });
        
        const insideResponse = insideImageGeneration as any;
        if (insideResponse.data && Array.isArray(insideResponse.data) && insideResponse.data.length > 0) {
          const imageData = insideResponse.data[0];
          
          // Handle object or string data
          if (typeof imageData === 'string') {
            insideImageUrl = `data:image/png;base64,${imageData}`;
          } else if (imageData.b64_json) {
            insideImageUrl = `data:image/png;base64,${imageData.b64_json}`;
          } else if (imageData.url) {
            insideImageUrl = imageData.url;
          }
          console.log('Successfully extracted inside image data from data array');
        } else {
          console.log('Failed to find data array in insideResponse');
        }
      }

      // Extract image data (gpt-image-1 returns base64 data in 'data' array)
      const frontResponse = frontImageGeneration as any;
      console.log('Checking frontResponse.data:', !!frontResponse.data);
      console.log('frontResponse.data type:', typeof frontResponse.data);
      
      let frontImageUrl = null;
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

  const httpServer = createServer(app);
  return httpServer;
}
