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
### SendGrid Integration
- **Email Service**: Automated order confirmations, digital card delivery, and shipping notifications
- **Templates**: Professional HTML email templates with responsive design and Celebrait branding
- **Endpoints**: `/api/send-shipping-notification` and `/api/create-free-order` for email management
- **Configuration**: Requires verified SendGrid sender domain/email and API key with Mail Send permissions

## Changelog
```
Changelog:
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