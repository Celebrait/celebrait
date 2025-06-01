import type { Express } from "express";
import { createServer, type Server } from "http";
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

  // Generate card images
  app.post("/api/generate-images", async (req, res) => {
    try {
      const { cardId, frontPrompt, insidePrompt, photoData } = req.body;

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
      if (photoData) {
        // Use vision analysis to get facial features, then generate with gpt-image-1
        console.log('Analyzing uploaded photo for facial features');
        
        try {
          const visionResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "I need you to be a precise visual observer. Look at this image and describe EXACTLY what you see for each category. Answer each question specifically:\n\n1. HAIR: What is the exact hair color? What style/cut? Length?\n2. EYES: What color are the eyes? What shape?\n3. SKIN TONE: Describe the person's skin tone precisely (pale, fair, light, medium, olive, tan, brown, dark brown, deep, etc.)\n4. GLASSES: Are they wearing glasses? If yes, describe frame shape, color, and style in detail.\n5. FACE: What is the face shape? Describe facial features.\n6. BODY: What is their apparent build/physique?\n7. ACCESSORIES: List any jewelry, hats, or other accessories you can see.\n8. CLOTHING: Describe what they're wearing.\n9. AGE: How old do they appear?\n\nBe factual and specific about what you actually observe in the image."
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
          
          // Check if we got a valid description
          if (photoDescription && !photoDescription.toLowerCase().includes("can't provide") && !photoDescription.toLowerCase().includes("sorry")) {
            // Integrate facial features and emphasize scene and text
            let enhancedPrompt = frontPrompt.replace(
              'Create an artistic representation of the person in the uploaded photo',
              `Create an artistic representation of a person with these specific characteristics: ${photoDescription}`
            );
            
            // Add explicit instructions for scene and text prominence
            enhancedPrompt += '. CRITICAL REQUIREMENTS: 1) The scene/background must be clearly visible and match the described setting exactly. 2) Text must be large, bold, and clearly readable - positioned prominently in the foreground or on a clear background area.';
            console.log('Using enhanced prompt with prioritized style and scene');
            
            frontImageGeneration = await openai.images.generate({
              model: "gpt-image-1",
              prompt: enhancedPrompt,
              n: 1,
              size: "1024x1024"
            });
          } else {
            console.log('Photo analysis was declined, using fallback with photo reference');
            const fallbackPrompt = `${frontPrompt}. Use the uploaded photo as reference for the person's appearance and facial features.`;
            frontImageGeneration = await openai.images.generate({
              model: "gpt-image-1",
              prompt: fallbackPrompt,
              n: 1,
              size: "1024x1024"
            });
          }
        } catch (error: any) {
          console.log('Vision analysis failed:', error.message);
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
      
      // Generate inside image if provided
      if (insidePrompt) {
        console.log('Using model: gpt-image-1 for inside image');
        // Enhance inside prompt with front style reference
        const enhancedInsidePrompt = `${insidePrompt} Style reference from front card: ${frontPrompt}`;
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
