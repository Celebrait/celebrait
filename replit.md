# AI Greeting Card Platform

## Overview

This is a full-stack web application that creates personalized AI-generated greeting cards. Users can create custom cards through a guided conversation interface, choose between digital or printed delivery options, and complete payments through Paystack integration. The platform uses AI image generation to create unique card designs based on user inputs and photo analysis.

## System Architecture

The application follows a modern full-stack architecture with clear separation between frontend and backend concerns:

- **Frontend**: React with TypeScript, using Vite for development and building
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **AI Integration**: OpenAI for chat interactions and Replicate for image generation
- **Payment Processing**: Paystack for South African payment processing
- **UI Framework**: Tailwind CSS with shadcn/ui components for consistent design

## Key Components

### Frontend Architecture
- **React SPA**: Single-page application using Wouter for client-side routing
- **State Management**: React hooks with custom onboarding state management
- **UI Components**: shadcn/ui component library for consistent, accessible interface
- **Styling**: Tailwind CSS with custom gradient utilities and South African branding
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Express Server**: RESTful API with middleware for logging and error handling
- **Database Layer**: Drizzle ORM with PostgreSQL for data persistence
- **AI Services**: Integration with OpenAI GPT-4 and Replicate Flux models
- **Payment Integration**: Paystack API for secure payment processing
- **File Storage**: Local storage with plans for cloud storage integration

### Database Schema
- **Users**: Basic user information and authentication
- **Cards**: Generated card data including images, pricing, and status
- **Loved Ones**: User's contact list for future card creation
- **Orders**: Payment and fulfillment tracking

## Data Flow

1. **User Onboarding**: Multi-step guided process collecting user preferences
2. **AI Generation**: Photo analysis and image generation using AI models
3. **Payment Processing**: Secure checkout with Paystack integration
4. **Order Fulfillment**: Digital delivery or physical printing coordination

The application uses a conversational AI approach where users interact with the system through guided questions, leading to personalized card generation based on their responses and uploaded photos.

## External Dependencies

### AI Services
- **OpenAI GPT-4**: For chat interactions and prompt engineering
- **Replicate Flux**: For high-quality image generation

### Payment Processing
- **Paystack**: Primary payment gateway for South African market
- **Stripe**: Alternative payment processing (configured but not primary)

### Development Tools
- **Vite**: Fast development server and build tool
- **Drizzle Kit**: Database migrations and schema management
- **TypeScript**: Type safety across the entire stack

## Deployment Strategy

The application is configured for deployment on Replit with the following setup:

- **Development**: `npm run dev` starts both frontend and backend
- **Production Build**: `npm run build` creates optimized bundles
- **Database**: PostgreSQL 16 module with automatic provisioning
- **Port Configuration**: Backend on port 5000, frontend served through Vite

Environment variables required:
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API access
- `REPLICATE_API_TOKEN`: Replicate API access
- `PAYSTACK_SECRET_KEY`: Paystack payment processing

## Changelog

- June 15, 2025. Initial setup
- June 15, 2025. Updated GPT-Image-1 API quality settings from "low" to "high" for upload photo + describe scene option (both front and inside card generation)
- June 15, 2025. Fixed front card prompt to ensure square 1:1 aspect ratio format instead of portrait orientation
- June 15, 2025. Enhanced image quality with correct "high" quality settings, vivid style, and improved prompt structure to eliminate duplication and ensure professional artwork quality

## User Preferences

Preferred communication style: Simple, everyday language.