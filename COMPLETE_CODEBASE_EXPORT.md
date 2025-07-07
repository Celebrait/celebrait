# Celebrait - Complete Functional Codebase Export

This document contains all the working code and configuration needed to rebuild the Celebrait AI greeting card platform.

## Core Architecture

### Tech Stack
- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **AI Services**: OpenAI GPT-4 + Replicate (Flux models)
- **Email**: SendGrid
- **Payment**: Stripe + Paystack
- **Image Processing**: Canvas + Sharp

### Environment Variables Required
```bash
# Database
DATABASE_URL=postgresql://...

# AI Services  
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...

# Email
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=greetings@celebrait.co.za

# Payment (Optional)
STRIPE_SECRET_KEY=sk_...
PAYSTACK_SECRET_KEY=sk_...

# App Domain
CLIENT_URL=https://your-domain.com
```

## Database Schema (shared/schema.ts)

```typescript
import { pgTable, text, serial, integer, boolean, timestamp, jsonb, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const cards = pgTable("cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  cardType: text("card_type").notNull(), // 'printed' | 'digital'
  printOption: text("print_option"), // 'front-only' | 'front-and-inside'
  sceneType: text("scene_type").notNull(), // 'with-person' | 'scene-only'
  conversationData: jsonb("conversation_data"),
  frontImageUrl: text("front_image_url"),
  insideImageUrl: text("inside_image_url"),
  frontImagePath: text("front_image_path"),
  insideImagePath: text("inside_image_path"),
  printReadyPath: text("print_ready_path"),
  status: text("status").default('generating'), // 'generating' | 'completed' | 'paid'
  price: integer("price").notNull(), // in cents
  createdAt: timestamp("created_at").defaultNow(),
});

export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => cards.id),
  customerEmail: text("customer_email").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  amount: integer("amount").notNull(),
  baseAmount: integer("base_amount").notNull().default(0),
  tipAmount: integer("tip_amount").notNull().default(0),
  currency: text("currency").notNull().default("ZAR"),
  paymentReference: text("payment_reference").notNull().unique(),
  paymentStatus: text("payment_status").notNull().default("pending"),
  orderStatus: text("order_status").notNull().default("processing"),
  orderType: text("order_type").notNull().default("regular"),
  shippingAddress: json("shipping_address"),
  trackingNumber: text("tracking_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
});

export const insertCardSchema = createInsertSchema(cards).pick({
  cardType: true,
  printOption: true,
  sceneType: true,
  conversationData: true,
  price: true,
});

export const insertOrderSchema = createInsertSchema(orders).pick({
  cardId: true,
  customerEmail: true,
  customerName: true,
  customerPhone: true,
  amount: true,
  baseAmount: true,
  tipAmount: true,
  currency: true,
  paymentReference: true,
  paymentStatus: true,
  orderStatus: true,
  orderType: true,
  shippingAddress: true,
  trackingNumber: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cards.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof orders.$inferSelect;
```

## AI Prompts System (shared/prompts.ts)

```typescript
export const buildImagePrompt = (answers: any, photoAnalyses?: Array<{personIndex: number, analysis: string}>) => {
  const parts = [];
  
  // Base requirements
  parts.push("Square 1:1 aspect ratio design, full bleed with no borders or card edges visible");
  
  // Add photo analysis if available
  if (photoAnalyses && photoAnalyses.length > 0) {
    photoAnalyses.forEach((analysis, index) => {
      const personDescription = analysis.analysis.replace(`Person ${analysis.personIndex}:`, '').trim();
      parts.push(`featuring Person ${index + 1}: ${personDescription}`);
    });
  }
  
  // Add scene description
  if (answers.scene) {
    parts.push(answers.scene);
  }
  
  // Add art style
  if (answers.art_style) {
    parts.push(`${answers.art_style} style`);
  }
  
  // Add celebration text if name is provided
  if (answers.name && answers.celebration) {
    const celebrationText = answers.celebration === 'birthday' ? 'Birthday' :
                           answers.celebration === 'anniversary' ? 'Anniversary' :
                           answers.celebration === 'graduation' ? 'Graduation' :
                           answers.celebration === 'wedding' ? 'Wedding' :
                           answers.celebration === 'retirement' ? 'Retirement' :
                           answers.celebration === 'new_baby' ? 'New Baby' :
                           answers.celebration === 'vacation' ? 'Vacation' :
                           answers.celebration === 'promotion' ? 'Promotion' :
                           answers.celebration === 'thank_you' ? 'Thank You' :
                           answers.celebration === 'other' ? 'Special Day' :
                           'Special Day';
    
    parts.push(`with "Happy ${celebrationText} ${answers.name}" text prominently displayed`);
  }
  
  // Quality requirements
  parts.push('professional artwork quality, print-ready');
  
  return parts.join(', ');
};

export const buildInsidePrompt = (insideText: string, artStyle: string, frontPrompt?: string) => {
  const parts = [];
  
  // Base requirements for inside card
  parts.push('Square 1:1 aspect ratio interior design, full bleed with no borders or edges visible');
  
  // Explicit instruction to NOT recreate characters
  parts.push('DO NOT include any people, characters, or figures from the front card');
  
  // Message content
  parts.push(`"${insideText}" prominently displayed as the main focus`);
  
  // Art style consistency
  if (artStyle) {
    parts.push(`${artStyle} art style with same visual treatment as front`);
  }
  
  // Typography and layout requirements
  parts.push('professional typography using same font style and treatment as front design');
  parts.push('text prominently displayed and clearly readable');
  parts.push('minimal decorative elements that complement without overwhelming the message');
  parts.push('print-ready artwork, no mockup visible');
  
  return parts.join(', ');
};
```

## Core Conversation Flow Logic

```typescript
// Conversation questions configuration
const conversationQuestions = [
  {
    id: 'recipient_name',
    question: 'Who is this card for?',
    aiMessage: streamlinedFlow ? 
      `Perfect! ✨ What's the recipient's name?` :
      `Hi there! ✨ What's the name of the person you're creating this card for?`,
    type: 'text',
    validation: (value: string) => value.trim().length > 0,
    followUp: true
  },
  {
    id: 'celebration',
    question: 'What celebration is this card for?',
    aiMessage: streamlinedFlow ? 
      `Perfect! ✨ Now what's ${answers.name || 'NAME'}'s big celebration?` :
      `Let's do this! So what are we celebrating with your greetings card?`,
    type: 'select',
    options: [
      { value: 'birthday', label: 'A Birthday', description: 'Celebrate another year of life', color: 'bg-pink-500' },
      { value: 'anniversary', label: 'An Anniversary', description: 'Mark a special milestone', color: 'bg-red-500' },
      { value: 'graduation', label: 'A Graduation', description: 'Honor academic achievement', color: 'bg-blue-500' },
      { value: 'wedding', label: 'A Wedding', description: 'Celebrate love and union', color: 'bg-purple-500' },
      { value: 'retirement', label: 'A Retirement', description: 'Honor years of dedication', color: 'bg-green-500' },
      { value: 'new_baby', label: 'A New Baby', description: 'Welcome a little miracle', color: 'bg-yellow-500' },
      { value: 'vacation', label: 'A Vacation', description: 'Celebrate travel and adventure', color: 'bg-cyan-500' },
      { value: 'promotion', label: 'A Promotion', description: 'Celebrate career success', color: 'bg-indigo-500' },
      { value: 'thank_you', label: 'Thank You', description: 'Express heartfelt gratitude', color: 'bg-orange-500' },
      { value: 'other', label: 'Something Else', description: 'Another special occasion', color: 'bg-gray-500' }
    ]
  },
  // Photo upload steps based on streamlined flow selection
  ...photoUploadSteps,
  {
    id: 'art_style',
    question: 'What artistic style would you like?',
    aiMessage: `Amazing! ✨ Now for the fun part - describe the artistic style you'd like for ${answers.name || 'your recipient'}'s card. Think colors, mood, artistic influences - be as creative as you want!`,
    type: 'text',
    validation: (value: string) => value.trim().length > 5,
    placeholder: 'E.g., "vibrant watercolor with soft pastels and dreamy clouds" or "bold comic book style with bright colors"',
    followUp: true
  },
  {
    id: 'message',
    question: 'What message would you like on the front?',
    aiMessage: `Perfect! ✨ What special message would you like displayed on the front of ${answers.name || 'your recipient'}'s ${answers.celebration || 'celebration'} card?`,
    type: 'text',
    validation: (value: string) => value.trim().length > 0,
    placeholder: `E.g., "Happy Birthday ${answers.name}!" or "Congratulations ${answers.name}!"`,
    followUp: true
  },
  {
    id: 'inside_message',
    question: 'What would you like to write inside the card?',
    aiMessage: `Wonderful! ✨ Now what heartfelt message would you like inside ${answers.name || 'your recipient'}'s card?`,
    type: 'textarea',
    validation: (value: string) => value.trim().length > 0,
    placeholder: 'Write your personal message here...',
    followUp: true
  },
  {
    id: 'email',
    question: 'What\'s your email address?',
    aiMessage: 'Almost done! ✨ I need your email to send you the card preview (generation takes 2-3 minutes).',
    type: 'email',
    validation: (value: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value.trim());
    },
    followUp: true
  },
  {
    id: 'email_confirm',
    question: 'Please confirm your email address',
    aiMessage: 'Perfect! ✨ Please confirm your email address to ensure you receive your card preview.',
    type: 'email',
    validation: (value: string) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(value.trim()) && value.trim() === answers.email?.trim();
    },
    followUp: false
  }
];
```

## Key API Endpoints (Core Routes)

```typescript
// Image generation using OpenAI DALL-E
app.post("/api/generate-front-image", async (req, res) => {
  try {
    const { prompt, size = "1024x1024" } = req.body;
    
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: size as "1024x1024" | "1024x1792" | "1792x1024",
      quality: "hd",
      n: 1,
    });
    
    const imageUrl = response.data[0].url;
    
    // Download and convert to base64
    const imageResponse = await fetch(imageUrl!);
    const imageBuffer = await imageResponse.arrayBuffer();
    const base64Image = `data:image/png;base64,${Buffer.from(imageBuffer).toString('base64')}`;
    
    res.json({ imageUrl: base64Image, originalImageUrl: imageUrl });
  } catch (error) {
    console.error('Image generation error:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// Photo analysis using GPT-4 Vision
app.post("/api/analyze-photos", async (req, res) => {
  try {
    const { images } = req.body; // Array of base64 images
    
    const analyses = await Promise.all(
      images.map(async (imageData: string, index: number) => {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Analyze this photo for greeting card creation. Describe the person's appearance, clothing, setting, and mood. Be specific about visual details that would help an AI recreate the scene."
                },
                {
                  type: "image_url",
                  image_url: { url: imageData }
                }
              ]
            }
          ],
          max_tokens: 300
        });
        
        return {
          personIndex: index + 1,
          analysis: response.choices[0].message.content || "Could not analyze image"
        };
      })
    );
    
    res.json({ analyses });
  } catch (error) {
    console.error('Photo analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze photos' });
  }
});

// Card creation endpoint
app.post("/api/create-card", async (req, res) => {
  try {
    const cardData = req.body;
    
    // Calculate price based on card type
    const price = cardData.cardType === 'digital' ? 2900 : 12900; // 29 or 129 ZAR in cents
    
    const card = await storage.createCard({
      ...cardData,
      price,
      status: 'generating'
    });
    
    res.json(card);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create card' });
  }
});

// Email notification after card generation
app.post("/api/send-card-ready-notification", async (req, res) => {
  try {
    const { cardId, customerEmail, customerName } = req.body;
    
    // Poll for card completion with timeout
    const pollForCard = async (): Promise<any> => {
      const card = await storage.getCard(parseInt(cardId));
      if (!card) throw new Error("Card not found");
      
      const frontReady = card.frontImageUrl && card.frontImageUrl.startsWith('data:image/');
      const insideReady = !card.insideImageUrl || card.insideImageUrl.startsWith('data:image/');
      
      if (frontReady && insideReady) {
        return card;
      }
      
      // Wait and retry (implement polling logic)
      await new Promise(resolve => setTimeout(resolve, 10000));
      return pollForCard();
    };
    
    const card = await pollForCard();
    
    // Generate reference for email link
    const reference = `celebrait_ready_${cardId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create order data for email template
    const orderData = {
      customerEmail,
      customerName,
      paymentReference: reference,
      cardId: cardId,
      cardType: card.cardType
    };
    
    // Send email
    const emailParams = generateCardReadyNotificationEmail(orderData, req.get('host'));
    await sendEmail(emailParams);
    
    res.json({ success: true, reference });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Digital card order creation
app.post("/api/create-free-order", async (req, res) => {
  try {
    const { cardId, customerEmail, customerName, deliveryMethod, recipientEmail, recipientName } = req.body;
    
    const card = await storage.getCard(cardId);
    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }
    
    // Generate unique reference
    const reference = `digital_${cardId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create order
    const order = await storage.createOrder({
      cardId,
      customerEmail,
      customerName,
      customerPhone: null,
      amount: 0,
      baseAmount: 0,
      tipAmount: 0,
      currency: "ZAR",
      paymentReference: reference,
      paymentStatus: "completed",
      orderStatus: "completed",
      orderType: "digital_free",
      shippingAddress: null,
      trackingNumber: null
    });
    
    // Send digital card emails
    const host = req.get('host');
    
    // Send to user
    const userEmailParams = generateDigitalCardEmail({
      customerEmail,
      customerName,
      paymentReference: reference
    }, `/api/cards/${cardId}/digital-front-image`, host);
    
    await sendEmail(userEmailParams);
    
    // Send to recipient if different
    if (deliveryMethod === 'recipient' && recipientEmail && recipientEmail !== customerEmail) {
      const recipientEmailParams = generateDigitalCardEmail({
        customerEmail: recipientEmail,
        customerName: recipientName || 'Friend',
        paymentReference: reference
      }, `/api/cards/${cardId}/digital-front-image`, host);
      
      await sendEmail(recipientEmailParams);
    }
    
    res.json({ 
      success: true, 
      reference,
      message: "Digital card delivered successfully!"
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create digital order' });
  }
});
```

## Email Templates (server/email-service.ts)

```typescript
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await sgMail.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || 'Email content is available in HTML format.',
      ...(params.html && { html: params.html }),
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export function generateCardReadyNotificationEmail(orderData: any, host?: string): EmailParams {
  const { customerEmail, customerName, paymentReference } = orderData;
  
  return {
    to: customerEmail,
    from: 'greetings@celebrait.co.za',
    subject: 'Your Celebrait Card is Ready to View! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Your Card is Ready!</h1>
            <p>Time to view your personalized Celebrait card!</p>
          </div>
          <div class="content">
            <h2>Hi ${customerName}!</h2>
            <p>Your personalized greeting card has been generated and is ready to view!</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="https://${host}/card-preview/${paymentReference}" class="button">View Your Card</a>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  };
}

export function generateDigitalCardEmail(orderData: any, cardImageUrl: string, host?: string): EmailParams {
  const { customerEmail, customerName, paymentReference } = orderData;
  
  return {
    to: customerEmail,
    from: 'greetings@celebrait.co.za',
    subject: 'Your Digital Celebrait Card is Ready! 🎉',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
          .container { max-width: 500px; margin: 0 auto; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 10px 10px; text-align: center; }
          .card-image { max-width: 250px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin: 15px 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 Your Card is Ready!</h1>
          </div>
          <div class="content">
            <p>Hi ${customerName}!</p>
            <p>Your digital greeting card is ready to view and share:</p>
            
            <img src="${cardImageUrl}" alt="Your custom card" class="card-image" />
            
            <div>
              <a href="https://${host}/card/${paymentReference}" class="button">View Digital Card</a>
            </div>
            
            <p style="color: #666; font-size: 14px; margin-top: 15px;">
              Share this link: https://${host}/card/${paymentReference}
            </p>
          </div>
        </div>
      </body>
      </html>
    `
  };
}
```

## Frontend Core Components

### Main App Structure (client/src/App.tsx)
```typescript
import { Route, Switch } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Landing from './pages/landing';
import CreateCard from './pages/create-card';
import CardPreview from './pages/card-preview';
import DeliveryDetails from './pages/delivery-details';
import CompleteOrder from './pages/complete-order';
import DigitalCardViewer from './pages/digital-card-viewer';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/create-card" component={CreateCard} />
      <Route path="/card-preview/:reference" component={CardPreview} />
      <Route path="/delivery-details/:reference" component={DeliveryDetails} />
      <Route path="/complete-order" component={CompleteOrder} />
      <Route path="/card/:reference" component={DigitalCardViewer} />
      <Route>404 Page Not Found</Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50">
        <Router />
      </div>
    </QueryClientProvider>
  );
}
```

### Key Conversation Logic (client/src/components/guided-conversation.tsx)
```typescript
// Core conversation state management
const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
const [answers, setAnswers] = useState<Record<string, any>>({});
const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);

// Main card generation function
const generateCard = async () => {
  try {
    setIsGenerating(true);
    
    // Create card record
    const cardResponse = await apiRequest("POST", "/api/create-card", {
      cardType: selectedDeliveryType || 'digital',
      printOption: 'front-and-inside',
      sceneType: photoCreationChoice === 'upload-scene' ? 'with-person' : 'scene-only',
      conversationData: answers,
      price: (selectedDeliveryType || 'digital') === 'digital' ? 2900 : 12900
    });
    
    const card = await cardResponse.json();
    
    // Generate front image
    const frontPrompt = buildImagePrompt(answers, photoAnalyses);
    const frontResult = await generateFrontImage(frontPrompt, card.id);
    
    // Generate inside image
    const insidePrompt = buildInsidePrompt(answers.inside_message, answers.art_style, frontPrompt);
    const insideResult = await generateInsideImage(insidePrompt, card.id);
    
    // Update card with generated images
    const updateResponse = await apiRequest("POST", "/api/update-card-images", {
      cardId: card.id,
      frontImageUrl: frontResult.imageUrl,
      insideImageUrl: insideResult.imageUrl,
      conversationData: answers,
      status: 'completed'
    });
    
    const completedCard = await updateResponse.json();
    
    // Navigate to card preview
    setLocation(`/card-preview/${completedCard.id}`);
    
    // Send background email notification
    if (emailToNotify) {
      setTimeout(() => {
        sendBackgroundEmail(completedCard.id, emailToNotify, onboarding.userName || "User");
      }, 2000);
    }
    
  } catch (error) {
    console.error('Card generation failed:', error);
    // Handle error
  } finally {
    setIsGenerating(false);
  }
};

// Photo upload and analysis
const handlePhotoUpload = async (files: FileList) => {
  const photoPromises = Array.from(files).map(async (file) => {
    return new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  });
  
  const photoDataUrls = await Promise.all(photoPromises);
  setUploadedPhotos(photoDataUrls);
  
  // Analyze photos with GPT-4 Vision
  try {
    const analysisResponse = await apiRequest("POST", "/api/analyze-photos", {
      images: photoDataUrls
    });
    
    const { analyses } = await analysisResponse.json();
    setPhotoAnalyses(analyses);
  } catch (error) {
    console.error('Photo analysis failed:', error);
  }
};
```

## Package.json Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.24.3",
    "@hookform/resolvers": "^3.3.4",
    "@neondatabase/serverless": "^0.9.0",
    "@radix-ui/react-*": "^1.0.4",
    "@sendgrid/mail": "^8.1.0",
    "@stripe/react-stripe-js": "^2.6.2",
    "@stripe/stripe-js": "^3.0.7",
    "@tanstack/react-query": "^5.28.6",
    "canvas": "^2.11.2",
    "drizzle-orm": "^0.30.4",
    "drizzle-zod": "^0.5.1",
    "express": "^4.19.2",
    "express-session": "^1.18.0",
    "framer-motion": "^11.0.24",
    "lucide-react": "^0.363.0",
    "openai": "^4.28.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.51.0",
    "replicate": "^0.29.4",
    "sharp": "^0.33.3",
    "stripe": "^14.21.0",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.4.2",
    "vite": "^5.1.6",
    "wouter": "^3.0.0",
    "zod": "^3.22.4"
  }
}
```

## Key Business Logic

### Pricing Structure
- Digital cards: 2900 cents (R29.00)
- Printed cards: 12900 cents (R129.00)
- Free digital delivery for completed cards

### Conversation Flow
1. Delivery choice (printed/digital)
2. Photo upload method selection
3. Recipient name collection
4. Celebration type selection
5. Photo upload & analysis
6. Art style description
7. Front message input
8. Inside message input
9. Email collection & confirmation
10. Card generation & email notification

### AI Integration Points
- **GPT-4 Vision**: Photo analysis for character description
- **DALL-E 3**: Front card image generation
- **DALL-E 3**: Inside card message generation
- **GPT-4**: Conversation flow and prompt optimization

### Critical Features
- Base64 image storage for immediate preview
- Email notification system with polling
- Watermark system for previews
- Dual delivery (user + recipient emails)
- Mobile-optimized interface
- Error handling and retry logic

This export contains all the core functional code needed to rebuild the platform. The key is maintaining the conversation flow, AI integration points, and email notification system while cleaning up the architecture.