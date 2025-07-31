# Celebrait - AI-Powered Greeting Card Generator

## Overview
Celebrait is a full-stack web application that creates personalized greeting cards using advanced AI for image generation and natural language processing. Its purpose is to offer users a unique way to generate custom cards through a guided conversational experience, supporting both digital delivery and physical printing. The project aims to revolutionize personalized greetings with high-quality, AI-generated content.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### UI/UX Decisions
- **Design Philosophy**: Focus on a clean, modern, and intuitive user interface.
- **Styling**: Uses Tailwind CSS with shadcn/ui components for a consistent and accessible design.
- **User Flow**: Employs a multi-step guided conversation for personalized card creation, including dynamic AI interaction for gathering details.
- **Visuals**: Incorporates brand colors (purple-to-pink gradients), rounded elements, and engaging animations (typing effects, subtle transitions, confetti for digital cards).
- **Responsiveness**: Mobile-first design for core AI brainstorming and digital card viewing, with responsive layouts for desktop.
- **Card Design**: Offers various art styles, with AI adapting typography and visuals contextually. Prioritizes facial accuracy in generated images.
- **Delivery Experience**: Streamlined delivery process leading directly from card preview to a single, complete order page with clear options for digital and physical delivery.

### Technical Implementations
- **Frontend**: React with TypeScript, Wouter for routing, TanStack Query for server state. Vite is used for builds.
- **Backend**: Node.js with Express.js, TypeScript.
- **Database**: PostgreSQL with Drizzle ORM for schema-first management and Neon Database for serverless hosting. Session management uses Connect-pg-simple.
- **AI Integration**: Custom prompt engineering for OpenAI GPT-4 (conversational UI) and Replicate (image generation). AI models are leveraged for photo analysis, dynamic prompt construction, and style application.
- **Payment Processing**: Integrates Stripe for international payments and Paystack for the South African market, including a custom tipping system.
- **Image Pipeline**: Involves AI-powered photo analysis, dynamic prompt building, application of various art styles, and efficient handling of AI-generated image outputs (PNG-only workflow with server-side watermarking and removal).
- **Email System**: SendGrid integration for automated order confirmations, digital card delivery, and shipping notifications, using branded HTML templates.
- **Configuration**: Manages environment variables for API keys and database connections, with strict TypeScript configuration.

### Feature Specifications
- **AI-Guided Conversation**: Collects user preferences and personalization details for card generation.
- **Image Generation**: Creates personalized card images based on user input, including scene descriptions, photo transformations, and inside card designs. Supports various aspect ratios (square, portrait).
- **Order Management**: Tracks order status, payment verification, and fulfillment (digital delivery, physical printing routing).
- **User Customization**: Allows selection of delivery method (digital/printed), print options, and scene types.
- **Payment Gateway**: Secure processing of payments via integrated third-party providers.
- **Digital Card Viewer**: Interactive, shareable digital card experience with animations, download, and social media sharing.

## External Dependencies

- **AI Services**:
    - OpenAI API (GPT-4 for NLP, GPT-Image-1 for image generation)
    - Replicate API (various image generation models)
- **Payment Providers**:
    - Stripe
    - Paystack
- **Infrastructure**:
    - Neon Database (PostgreSQL hosting)
    - Replit (Development and deployment)
    - Node.js (Server runtime)
- **Frontend Libraries**:
    - shadcn/ui
    - Radix UI
    - TanStack Query
    - Wouter
- **Email Service**:
    - SendGrid