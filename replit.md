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
- July 2, 2025. Successfully replaced dual email input system with Replit Auth OAuth integration:
  * Completely removed dual email input popup that required users to enter email twice
  * Integrated comprehensive Replit Auth system supporting GitHub, Google, and other OAuth providers
  * Added smart header with login/logout functionality and user avatar display
  * Created user account dashboard with order history and card management features
  * Updated card generation flow to use authenticated user's email for notifications
  * Fixed server authentication middleware and database session storage
  * Enhanced user experience with one-click OAuth login instead of manual email entry
  * Users now have full account functionality with persistent login sessions and order tracking
- July 1, 2025. Unified styling across complete delivery journey with frosted glass design:
  * Fixed cache clearing function to preserve delivery type selection during navigation
  * Updated both information pages (digital and printed) to match journey styling with frosted glass background
  * Applied consistent gradient backgrounds (purple-50 via pink-50 to orange-50) across all delivery pages
  * Enhanced all form cards with backdrop-blur and white/80 transparency for cohesive visual design
  * Updated all submit buttons to use consistent purple-to-pink gradient matching delivery choice buttons
  * Added Header component and proper loading screens with frosted glass containers across all pages
  * Fixed digital delivery flow to correctly show email-focused options vs printed delivery options
  * Both payment and complete-order pages now feature identical "Your Information" styling and structure
- July 1, 2025. Enhanced art style selection with interactive carousel interface:
  * Replaced grid with carousel showing 4 art styles at a time with smooth navigation
  * Added 12 new art styles including Anime, Cyberpunk, LEGO, Pixar, Renaissance, Fantasy Realism, Pixel Art, Barbie/Glam, Grunge, Vaporwave, and Mythical Creature fusion
  * Moved preview buttons below style cards to prevent accidental progression
  * Restored custom text input with encouraging copy about AI's style creation abilities
  * Each style includes emoji indicators, color coding, and detailed inspiration sources
  * Mobile-optimized 2x2 grid layout with clear example preview modals
- July 1, 2025. Redesigned delivery and payment flow for printed cards:
  * Created new delivery details page asking users to choose between delivering to themselves or the recipient
  * Simplified payment page focused only on gathering customer information with Paystack integration
  * Removed payment options and support creator sections as requested
  * Added order summary with front/inside card image toggles for mobile users
  * Updated delivery choice flow to navigate through: delivery choice → delivery details → simplified payment
  * Integrated with existing Paystack payment endpoints for seamless checkout experience
- June 30, 2025. Implemented mandatory email collection step in conversation flow:
  * Added required email collection step before final summary screen to ensure all users provide email
  * Enhanced conversation flow to explain AI generation takes up to 2 minutes, requiring email for notification
  * Replaced optional loading screen email collection with mandatory conversation step
  * Users must now enter and confirm email address twice before proceeding to card generation
  * Simplified loading screen to show confirmed email and generation progress
  * Email notifications now guaranteed to work since email is collected upfront in conversation flow
- June 29, 2025. Systematically fixed email timing, performance, and UI issues for seamless user experience:
  * CRITICAL FIX: Implemented polling-based email validation - emails now sent only after complete image generation verification (50KB+ size check)
  * CRITICAL FIX: Fixed card version inconsistency - background generation now completely skips regeneration and preserves identical front and inside images from interactive session
  * CRITICAL FIX: Fixed email notification failure - removed validation error causing background generation to fail and preventing email notifications
  * CRITICAL FIX: Removed failed polling system - background generation now sends emails immediately since cards are already complete from interactive session
  * CRITICAL FIX: Fixed email timing - background email now waits 60 seconds for interactive generation to complete before sending, ensuring perfect synchronization
  * Fixed race conditions between immediate and background generation causing premature email notifications
  * Added 10-second interval polling with 5-minute timeout to ensure both front and inside images are fully processed before email
  * Eliminated UI duplication by removing duplicate "Your Card is Ready" headers between CardPreviewPage and CardPreview components
  * Optimized database performance - cards/ready endpoint now serves only essential metadata (removed massive base64 transfers)
  * Added missing /api/cards/:id endpoint with same optimization pattern to prevent excessive API polling on delivery choice screen
  * Added response caching (5-minute cache, ETag headers) to eliminate 16-second email link loading times
  * Enhanced database queries to transfer ~1KB instead of ~2MB for instant email link performance
  * Fixed background generation to properly sequence: front image → inside image → validation polling → email notification
  * Email links now provide truly flawless experience with instant loading and no UI duplication or loading delays
- June 29, 2025. Fixed card generation loading screen and removed signup modal barrier:
  * Fixed stuck loading screen issue where cards weren't generating after clicking "Generate My Card"
  * Modified generateCard function to properly execute card generation instead of only showing email collection
  * Restored email input boxes to loading screen so users can choose between waiting or email notification
  * Enhanced loading screen to show both generation progress and email notification option
  * Users can now either wait for immediate card display or receive email notification when ready
  * Removed signup modal popup that forced users to input name, email, and family members before viewing cards
  * Users can now view generated cards immediately without registration barriers
  * Maintained existing background generation workflow for email notifications
- June 29, 2025. Enhanced email workflow and generation screen interactivity:
  * Fixed email links to show card viewing screen before delivery choice instead of direct delivery choice
  * Updated email templates to link to /card/{reference} for proper card preview flow
  * Enhanced DigitalCardViewer to handle celebrait_ready_* references from email notifications
  * Added "Choose Delivery Options" button for preview cards to guide users to delivery selection
  * Removed progress bar from generation screen and replaced with interactive AI working animations
  * Enhanced email confirmation screen to show success message instead of returning to summary
  * Added proper card initialization checks before starting background generation
  * Improved error handling and logging for background generation debugging
- June 28, 2025. Replaced loading screen with email notification system:
  * Kept the summary screen intact as requested
  * Replaced the "generating card" loading screen with email collection interface
  * Users can provide email and close window instead of waiting 3-5 minutes
  * Email collection requires double-entry verification for accuracy
  * Background generation creates digital order and sends email notification when complete
  * Maintained existing workflow flow but eliminated forced waiting during generation
- June 28, 2025. Fixed email domain URLs and enhanced digital card interactivity:
  * Fixed email template URLs to use correct Replit app domain for working email links
  * Made digital card preview clickable - both card image and button now open the card
  * Enhanced digital card viewer with confetti animations and interactive opening experience
  * Updated email generation to dynamically include proper host domain from request headers
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