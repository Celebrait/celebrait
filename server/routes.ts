import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserSchema, insertCardSchema, insertLovedOneSchema } from "@shared/schema";
import OpenAI from "openai";
import Stripe from "stripe";

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing required OpenAI API key: OPENAI_API_KEY');
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export async function registerRoutes(app: Express): Promise<Server> {
  // User registration
  app.post("/api/users", async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
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
      const updatedConversationData = {
        ...card.conversationData,
        messages: [...(card.conversationData?.messages || []), ...messages, {
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
      const { cardId, frontPrompt, insidePrompt } = req.body;

      if (!cardId || !frontPrompt) {
        return res.status(400).json({ message: "Card ID and front prompt are required" });
      }

      const card = await storage.getCard(cardId);
      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Generate front image
      const frontImageResponse = await openai.images.generate({
        model: "dall-e-3",
        prompt: `Square greeting card design: ${frontPrompt}. High quality, professional greeting card style, full-bleed square format.`,
        n: 1,
        size: "1024x1024",
        quality: "standard",
      });

      let insideImageUrl = null;
      
      // Generate inside image if provided
      if (insidePrompt) {
        const insideImageResponse = await openai.images.generate({
          model: "dall-e-3",
          prompt: `Square greeting card interior design: ${insidePrompt}. Typography-focused, matching the front design style, square format.`,
          n: 1,
          size: "1024x1024", 
          quality: "standard",
        });
        insideImageUrl = insideImageResponse.data[0].url;
      }

      // Update card with generated images
      const updatedCard = await storage.updateCard(cardId, {
        frontImageUrl: frontImageResponse.data[0].url,
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

  const httpServer = createServer(app);
  return httpServer;
}
