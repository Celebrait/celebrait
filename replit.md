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
- July 4, 2025. DUAL DELIVERY SYSTEM COMPLETION: Separated user and recipient information collection for proper dual email delivery:
  * FORM RESTRUCTURE: Complete-order page now separates recipient details from user details when delivering to recipients
  * RECIPIENT FIELDS: Recipient name and email fields are now blank and require manual input instead of pre-populating with user data
  * USER DETAILS SECTION: Added dedicated "Your Details" section that pre-populates with user's name and email captured earlier in flow
  * DUAL VALIDATION: Form validation now checks both recipient and user information when delivering to recipients
  * BACKEND INTEGRATION: Updated create-free-order endpoint to properly use actual recipient name and email from form inputs
  * MESSAGING CONSISTENCY: Updated success messages and digital card experience text to use actual recipient names throughout
- July 4, 2025. ENHANCED DIGITAL CARD DELIVERY: Improved recipient personalization and dual delivery implementation:
  * PERSONALIZED DELIVERY: Updated delivery options to show actual recipient name instead of "the recipient" throughout the flow
  * DUAL DELIVERY: Changed "Send to recipient" option to "Send to recipient and me" - both user and recipient now receive the digital card
  * CLEAR SIGNPOSTING: Enhanced Recipients Information page blue box to clarify that user will also receive copy when sending to recipient
  * BACKEND IMPLEMENTATION: Updated create-free-order endpoint to send emails to both user and recipient when dual delivery is selected
  * CONSISTENT MESSAGING: Updated success messages and email templates to reflect dual delivery functionality
  * DYNAMIC LABELS: Email label changes to "[Name]'s Email" when delivering to recipient, "Your Email" when delivering to self
  * USER-CENTRIC MESSAGING: Digital card experience text updated to emphasize user control over forwarding card links
- July 4, 2025. CRITICAL EMAIL FLOW FIX: Eliminated duplicate delivery choice from email notification workflow:
  * FIXED EMAIL FLOW: Card ready notification emails now skip delivery choice page and go directly to delivery details based on user's pre-selected delivery method
  * EMAIL ROUTING: Digital cards link to `/delivery-details/{reference}?type=digital`, printed cards link to `/delivery-details/{reference}?type=printed`
  * DELIVERY DETAILS: Updated page to read delivery type from URL parameters (for email links) and session storage (for main site flow)
  * CONSISTENT EXPERIENCE: Users no longer see "Choose Your Delivery Option" page after clicking email links when they already selected delivery method in streamlined flow
  * EMAIL TEMPLATES: Updated card ready notification to show "Complete Your Digital Card Order" or "Complete Your Printed Card Order" based on card type
- July 4, 2025. MAJOR DIGITAL CARD VIEWING EXPERIENCE OVERHAUL: Complete redesign with performance optimization and enhanced UX:
  * CRITICAL FIX: Added watermark removal to free digital card orders - watermarks now automatically removed after successful order completion
  * PERFORMANCE: Created optimized digital image endpoints (`/api/cards/:id/digital-front-image`) with Sharp compression (max 800x800, 85% quality, progressive JPEG)
  * UI/UX: Completely redesigned digital card viewer with square envelope design, custom message display, and celebration-specific button text
  * NAVIGATION: Added swipeable card interface with navigation arrows and progress indicators for seamless viewing experience
  * DOWNLOAD: Enhanced download functionality - supports both front and inside images with proper mobile compatibility
  * SHARING: Comprehensive social media sharing integration (WhatsApp, Facebook, Twitter, Instagram) plus native mobile sharing and copy link
  * DESIGN: Square image display, handwritten envelope styling with Caveat font, gradient backgrounds, and smooth animations
  * METADATA: Smart extraction of recipient name, celebration type, and custom message from conversation data for personalized experience
- July 4, 2025. CRITICAL PERFORMANCE FIX: Eliminated slow loading screens and optimized image serving:
  * Fixed "Loading delivery options..." taking too long by removing unnecessary loading state and using cached data first
  * Replaced all base64 image loading with optimized `/api/cards/:id/front-image` and `/api/cards/:id/inside-image` endpoints
  * Updated delivery details page to use ultra-fast `/api/cards/:id/metadata` endpoint instead of full card data
  * Optimized card preview, payment pages, and complete-order pages to use image endpoints instead of transferring large base64 data
  * Images now load instantly from cached endpoints instead of multi-megabyte API responses
  * Delivery options page loads instantly using sessionStorage cache with background API updates only when needed
- July 4, 2025. CRITICAL FIX: Removed duplicate delivery choice from streamlined flow:
  * Fixed streamlined flow to remember initial delivery selection and skip "CHOOSE DELIVERY" step in conversation
  * Updated card preview to automatically bypass delivery choice page when delivery type was pre-selected
  * Modified email notification text to reflect delivery choice already made in streamlined flow
  * Added proper delivery type storage and retrieval from sessionStorage for flow continuity
  * Streamlined flow now goes: delivery choice → photo option → conversation → card generation → delivery details (skips duplicate delivery choice)
- July 4, 2025. Enhanced navigation throughout streamlined flow:
  * Changed "Back to Name Input" button text to "Start Fresh" across all conversation screens
  * Added "Start Fresh" button to first question screen (recipient name) for consistency
  * Added back button to photo creation choice screen allowing users to return to delivery selection
  * Added onStartFresh callback to properly reset streamlined flow back to delivery choice when "Start Fresh" is clicked
  * Enhanced navigation flow: users can now go back from photo options to delivery choice, and restart entire flow from any conversation step
- July 4, 2025. Added missing art style question to streamlined flow:
  * BUGFIX: Fixed art style step ID mismatch in filtering logic (was looking for 'art_style_grid', actual ID is 'art_style')
  * Art style question now appears in both streamlined flow options (upload+scene and upload+transform)
  * Includes all 12 art style options: AI-Painterly, Anime, Cyberpunk, LEGO, Pixar, Renaissance, Fantasy Realism, Pixel Art, Barbie/Glam, Grunge, Vaporwave, Mythical Creature
  * Flow sequence now complete: delivery choice → photo option → recipient name → celebration → photo upload → [scene] → art style → message → inside message
- July 4, 2025. Swapped flow order on homepage for easier testing:
  * Moved new streamlined flow to top of homepage for immediate access
  * Moved original flow to bottom section for comparison testing
  * Updated divider text to reflect new positioning
  * Makes it easier to test the streamlined flow without scrolling past original flow
- July 4, 2025. Updated AI message wording throughout streamlined flow:
  * Changed celebration question to: "Perfect! ✨ Now what's [NAME]'s big celebration?"
  * Updated transform photo upload message to: "Cool! ✨ Now please upload ONE clear photo that you'd like me to transform into a new artistic style for the front of [NAME]'s card"
  * Updated scene photo upload message to: "Great! ✨ Please upload your photo(s) featuring [NAME] + anyone else you'd like in the scene on the front of your card"
  * All messages now use dynamic name substitution and specific wording for better user experience
  * Flow sequence: delivery choice → photo option → recipient name → celebration → photo upload → remaining steps
- July 4, 2025. Updated photo creation choice styling to match delivery selection design:
  * Redesigned photo creation choice component with 2-column grid layout matching delivery selection cards
  * Enhanced buttons with full-width styling and consistent gradient colors per option
  * Increased icon and card sizes for better mobile experience and visual hierarchy
  * Added proper hover states and transitions matching delivery choice component design
  * Simplified "How it works" functionality temporarily while maintaining visual consistency
- July 4, 2025. Created new streamlined flow for testing delivery preference and photo options upfront:
  * Added new flow starting with delivery method selection (printed vs digital) on homepage underneath current name input
  * Created delivery selection component with styled cards showing pricing and features for both options
  * Added photo creation choice component allowing selection between upload+scene and upload+transform options
  * Implemented streamlined conversation flow that skips initial personal details and jumps directly to photo upload
  * Modified guided conversation to support streamlined flow with filtered steps based on photo option selection
  * Both flows available for testing and comparison - original journey and new streamlined approach
- July 4, 2025. Fixed digital card information page layout consistency and removed duplicate recipient selection:
  * Updated digital card route "YOUR INFORMATION" screen to match printed + delivered layout with front and inside card previews
  * Removed duplicate delivery method selection (who receives card) since this was already captured in earlier flow
  * Enhanced card preview section to show both front and inside images with proper labels
  * Replaced radio button delivery options with clear confirmation message based on earlier choice
  * Improved digital delivery confirmation with personalized messaging using recipient name from conversation data
- July 3, 2025. Redesigned art style selection to prioritize custom text input with inspiration popup:
  * Completely redesigned art style screen to focus on text input for describing custom artistic visions
  * Replaced overwhelming grid of style options with clean, prominent text input as primary interface
  * Added "Browse Art Style Inspiration" popup button with swipeable carousel of style examples
  * Users can now describe any artistic style they envision instead of being limited to preset options
  * Inspiration popup uses same modal design pattern with square placeholder areas for future style images
  * Enhanced user creativity by encouraging custom descriptions while providing inspiration when needed
- July 3, 2025. Removed swipeable feature from photo creation choice and fixed transition glitches:
  * Replaced annoying fade transitions between name input and conversation screens with clean AI-themed loading animation
  * Created new AILoading component with brain icon and spinning ring for smooth transitions
  * Removed mobile swipeable carousel from photo creation choice - reverted to stacked grid view for better visibility
  * Enhanced user experience with instant, clean transitions without jarring fade effects
  * Both mobile and desktop now display photo creation options in easy-to-compare stacked format
- July 3, 2025. Implemented recipient name personalization throughout delivery flow:
  * Updated delivery details page to show "Deliver to Aidan" instead of "Deliver to friend"
  * Modified complete-order page to display "Aidan's Information" and "Aidan's Details" when delivering to recipient
  * Updated payment page to show "Aidan's Address" and "Aidan's Contact Details" for recipient deliveries
  * Enhanced all delivery-related headers and labels to use actual recipient name from conversation data
  * Improved user experience with personalized messaging throughout checkout process
- July 3, 2025. Fixed delivery choice page loading performance for instant display:
  * Changed initial loading state from true to false for immediate page rendering
  * Modified card data loading to run in background without blocking UI display
  * Delivery options now show instantly while card data loads asynchronously
  * Eliminated 10+ second "Loading delivery options..." spinner that frustrated users
  * Enhanced user experience with immediate page responsiveness
- July 3, 2025. Removed duplicate IMPORTANT box from photo upload section:
  * Deleted redundant yellow "Important" box at line 2785 that was duplicating guidance
  * Streamlined photo upload interface by removing unnecessary duplicate messaging
  * Maintained single IMPORTANT box positioning after "Upload a Different Photo" button for cleaner UI
- July 3, 2025. Replaced FILE REQUIREMENTS boxes with IMPORTANT boxes on photo upload screens:
  * Replaced yellow "File Requirements" boxes with yellow "Important" boxes containing user-friendly guidance
  * IMPORTANT boxes now provide contextual help about photo uploads (single vs multiple people)
  * Maintained file format information (JPEG, PNG, WebP • Max size: 10MB) within the Important boxes
  * Enhanced user experience with more encouraging and helpful messaging about photo upload best practices
- July 3, 2025. Repositioned file format guidance and removed success notifications:
  * Moved "File Requirements" yellow boxes to appear directly under "Upload a Different Photo" button
  * Removed green "Photo uploaded successfully!" success boxes from both upload screens
  * Added file format info to yellow boxes on both photo upload pages with consistent messaging
  * Streamlined upload interface by removing redundant success notifications
  * Enhanced user guidance placement for better visibility during upload process
- July 3, 2025. Added comprehensive file format guidance across all photo upload screens:
  * Added accepted file formats to yellow box for both upload + describe scene and upload + transform style options
  * Created dedicated "File Requirements" yellow box that appears after AI messages on photo upload screens
  * Added format info to both "Perfect! ✨ Please upload a photo featuring TEST" and "Perfect! ✨ Please upload ONE clear photo" AI message screens
  * Consistent formatting: "Accepted formats: JPEG, PNG, WebP • Max size: 10MB" across all upload screens
  * Enhanced user guidance with clear file requirements before they attempt uploads
- July 3, 2025. Removed style transformation requirements modal and streamlined photo upload:
  * Completely removed "Style Transformation Requirements" modal from workflow
  * Added accepted file formats directly to yellow box in photo upload step for transform option
  * Streamlined photo upload process to go directly from copyright consent to file selection
  * Updated upload instruction to include "Accepted formats: JPEG, PNG, WebP • Max size: 10MB" below main text
  * Simplified user flow by eliminating unnecessary requirement acknowledgment step
- July 3, 2025. Fixed photo creation choice bugs and enhanced mobile experience:
  * Fixed event propagation issues preventing modal navigation bugs when swiping or closing
  * Moved "How it works" buttons outside clickable option containers to prevent accidental selection
  * Added mobile swipeable carousel for both photo creation options matching delivery choice design
  * Added "Swipe to see both options" instruction for mobile users with arrow icons
  * Implemented responsive design: desktop shows grid view, mobile shows swipeable carousel
  * Added stopPropagation handlers to prevent unwanted navigation during modal interactions
  * Enhanced modal carousel with proper click event handling to prevent dialog closure
- July 3, 2025. Made images swipable in photo creation modals with carousel functionality:
  * Added swipable carousel to both "Upload Photo + Describe Scene" and "Upload Photo + Transform Style" modals
  * Each modal now contains two swipable image placeholders ready for actual images
  * First image labeled "Photo Upload Example" with camera icon (blue themed)
  * Second image labeled "Final Scene Example" with image icon (green themed)
  * Added navigation arrows for smooth swiping between example images
  * Maintained same clean modal design pattern as art style selection screen
- July 3, 2025. Redesigned card generation loading screen with ethereal typing effect:
  * Replaced card generation loading screen with same design approach as AI loading screen
  * Added ethereal character-by-character typing animation referencing user's name and celebration
  * Removed email input section and "Don't want to wait" box from generation screen
  * Maintained 2-3 minute timing note while AI works
  * Enhanced personalization by dynamically incorporating recipient details into AI's message
  * Card preview already properly references recipient's name and celebration from captured data
- July 3, 2025. Removed AI warming up loading screen from onboarding flow:
  * Simplified onboarding to 2 steps: Name Input → Guided Conversation
  * Removed Step4AILoading component from the flow entirely
  * Updated onboarding hook to limit steps to 2 maximum
  * Modified guided conversation back button to reference step 1 instead of step 2
  * Streamlined user experience by eliminating unnecessary waiting screen
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