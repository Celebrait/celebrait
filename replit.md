# Celebrait - AI-Powered Greeting Card Generator

## Overview
Celebrait is a full-stack web application that creates personalized greeting cards using AI. Users can generate custom cards by providing personal details through a guided conversation, with options for both digital delivery and physical printing. The application leverages advanced AI models for image generation and natural language processing to create unique, personalized greeting cards.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React hooks with custom onboarding state management
- **Build Tool**: Vite for development and production builds
- **Query Management**: TanStack Query for server state management

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESNext modules
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: Connect-pg-simple for PostgreSQL-backed sessions
- **File Handling**: Built-in Node.js modules for image processing

### Database Architecture
- **ORM**: Drizzle with PostgreSQL dialect
- **Migration Strategy**: Schema-first approach with migrations directory
- **Connection**: Neon Database serverless PostgreSQL

## Key Components

### Data Models
1. **Users**: Basic user information (username, email, creation timestamp)
2. **Cards**: Generated greeting cards with metadata, images, and pricing
3. **Loved Ones**: User's contacts with birthdays for future card generation
4. **Orders**: Payment and fulfillment tracking for printed cards

### AI Integration Services
1. **OpenAI GPT-4**: Natural language processing for conversational UI
2. **Replicate**: Image generation using various AI models (Flux, DALL-E alternatives)
3. **Custom Prompt Engineering**: Shared prompt system for consistent card generation

### Payment Processing
1. **Stripe**: International payment processing
2. **Paystack**: South African market payment processing
3. **Tip Integration**: Custom tipping system for enhanced user experience

### Image Generation Pipeline
1. **Photo Analysis**: AI-powered analysis of uploaded photos
2. **Prompt Construction**: Dynamic prompt building based on user inputs
3. **Style Application**: Multiple art styles (watercolor, cartoon, oil painting, etc.)
4. **Binary Processing**: Custom handling of AI-generated image outputs

## Data Flow

### Card Generation Process
1. **User Onboarding**: Multi-step guided conversation
   - Name collection
   - Delivery method selection (digital/printed)
   - Print options (front-only/front-and-inside)
   - Scene type (with-person/scene-only)
2. **Conversation Engine**: AI-powered chat for gathering personalization details
3. **Image Generation**: AI model processing with custom prompts
4. **Card Assembly**: Frontend preview with generated images
5. **Payment Processing**: Integrated checkout with optional tipping

### Order Fulfillment
1. **Payment Verification**: Multi-provider payment confirmation
2. **Order Status Tracking**: Database-driven status management
3. **Digital Delivery**: Immediate download availability
4. **Physical Printing**: Order routing to fulfillment partners

## External Dependencies

### AI Services
- **OpenAI API**: GPT-4 for natural language processing
- **Replicate API**: Multiple image generation models
- **Custom Prompt System**: Shared prompt engineering utilities

### Payment Providers
- **Stripe**: Global payment processing with React integration
- **Paystack**: African market payment processing

### Infrastructure
- **Neon Database**: Serverless PostgreSQL hosting
- **Replit**: Development and deployment platform
- **Node.js**: Server runtime environment

### Frontend Libraries
- **shadcn/ui**: Comprehensive React component library
- **Radix UI**: Accessible component primitives
- **TanStack Query**: Server state management
- **Wouter**: Lightweight routing library

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with PostgreSQL 16
- **Development Server**: Vite dev server on port 5000
- **Hot Module Replacement**: Enabled for rapid development
- **Error Handling**: Runtime error overlay for debugging

### Production Build
- **Frontend**: Vite build to `dist/public`
- **Backend**: ESBuild compilation to `dist/index.js`
- **Database**: Drizzle migrations with push strategy
- **Deployment**: Replit autoscale deployment target

### Configuration Management
- **Environment Variables**: Database URLs, API keys for external services
- **TypeScript**: Strict configuration with path mapping
- **Bundling**: External package handling for Node.js compatibility

## Email System
### SendGrid Integration - ACTIVE
- **Email Service**: Automated order confirmations, digital card delivery, and shipping notifications
- **Sender Address**: greetings@celebrait.co.za (verified and operational)
- **Templates**: Professional HTML email templates with responsive design and Celebrait branding
- **Endpoints**: `/api/send-shipping-notification`, `/api/create-free-order`, `/api/test-sendgrid` for email management
- **Status**: Fully operational with successful test confirmations

## Changelog
```
Changelog:
- June 28, 2025. Optimized image generation performance and fixed digital card processing:
  * Created new fast generation endpoint (/api/generate-fast) using DALL-E 3 for reliable, faster generation
  * Reduced image generation time from 4-5 minutes to under 60 seconds by eliminating complex fallback chains
  * Fixed digital card order processing database constraint errors with customerPhone field
  * Updated database schema to support all order fields and made phone number optional
  * Streamlined image generation workflow by removing sequential API calls and complex prompt processing
- June 28, 2025. Implemented persistent PostgreSQL storage to fix digital card links:
  * Replaced in-memory storage with PostgreSQL database storage using Drizzle ORM
  * Digital card email links now work permanently even after server restarts
  * All card and order data persists in database instead of being lost on server restart
  * Fixed the core issue where email links became invalid due to memory storage limitations
- June 28, 2025. Fixed test mode and delivery choice loading issues:
  * Improved test mode button to properly set loading state and create mock cards instantly
  * Enhanced delivery choice page with better error handling and storage cleanup
  * Fixed mobile input readonly error with proper null checking
  * Added fallback card data for delivery choice page when API calls fail
  * Improved session storage handling to prevent quota errors during card generation
- June 28, 2025. Enhanced interactive digital card viewing experience:
  * Created stunning digital card viewer with confetti animations and 3D effects
  * Added interactive card opening experience with party popper animations
  * Implemented download and share functionality for digital cards
  * Enhanced email templates to include interactive viewing links to /card/{reference} route
  * Fixed missing API endpoint for fetching orders by payment reference
  * Added hover effects, gradient backgrounds, and smooth transitions for premium feel
- June 28, 2025. Test mode functionality and email delivery fixes:
  * Added "Test Mode (Skip AI Generation)" button for instant flow testing without OpenAI API calls
  * Fixed test mode to bypass loading screens and immediately create mock cards
  * Resolved email delivery issue for digital cards by adding email functionality to correct API endpoint
  * Enhanced digital card emails with interactive viewing links to /card/{reference} route
  * Improved order processing speed and reliability for testing purposes
- June 28, 2025. Implemented mobile keyboard control:
  * Updated Input and Textarea components to prevent unwanted mobile keyboard activation
  * Added mobile device detection and user interaction tracking
  * Inputs now remain readonly until user explicitly taps them on mobile devices
  * Prevented autofocus on mobile while maintaining desktop functionality
  * Enhanced mobile user experience by eliminating intrusive keyboard pop-ups
- June 28, 2025. Fixed digital delivery "no order found" issue:
  * Updated delivery choice flow to navigate to complete-order page for digital cards instead of directly to order-success
  * Fixed API integration to use /api/create-free-order endpoint for digital orders
  * Corrected order creation data structure to match schema requirements (added missing customerPhone field)
  * Updated complete-order page to properly create free digital orders and navigate with correct reference parameter
  * Digital cards now properly create orders, send emails, and show success page with order details
- June 25, 2025. SendGrid email system integration:
  * Added comprehensive email service with HTML templates for order confirmations, digital deliveries, and shipping
  * Integrated automatic email sending into payment workflows and order creation
  * Created admin endpoints for shipping notifications and free digital card distribution
  * Implemented responsive email templates with Celebrait branding and mobile optimization
- June 22, 2025. Canvas-based watermark system implementation:
  * Added Canvas library with system dependencies for server-side image processing
  * Implemented diagonal "CELEBRAIT PREVIEW" watermarks applied to all generated images
  * Updated all image generation endpoints (edit-scene, transform-style, generate-inside) to apply watermarks
  * Stored original unwatermarked images securely in card conversationData
  * Built watermark removal system that activates automatically after payment verification
  * Integrated watermark removal into payment success and order success workflows
- June 22, 2025. Unified card generation system:
  * All cards now require both front and inside messaging
  * Removed conditional logic for inside message based on print options
  * Updated pricing to reflect front-and-inside for all printed cards ($129 vs $29 digital)
  * Modified conversational flow to always ask for inside message
  * Updated all card generation workflows to include inside content
- June 22, 2025. Major onboarding flow restructure:
  * Removed card selection process from initial flow
  * Simplified to 3-step process: Name Input → AI Loading → Card Creation
  * Moved delivery choice (printed/digital only) to post-card generation
  * Eliminated print options and scene type selections
  * Created new DeliveryChoice component for streamlined checkout
- June 15, 2025. Initial setup
```

## User Preferences
```
Preferred communication style: Simple, everyday language.
```