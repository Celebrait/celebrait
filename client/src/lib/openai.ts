// This file is mainly for frontend utilities related to OpenAI integration
// The actual OpenAI calls are made from the backend for security

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  response: string;
}

export interface ImageGenerationRequest {
  cardId: number;
  frontPrompt: string;
  insidePrompt?: string;
}

export interface GeneratedCard {
  id: number;
  frontImageUrl: string;
  insideImageUrl?: string;
  status: 'generating' | 'completed' | 'paid';
  price: number;
}

// Import typography utilities
import { generateTypographyInstructions } from '../../../shared/typography';

// Helper functions for prompt construction
export function buildCharacterPrompt(characterData: any): string {
  const {
    recipientIdentity,
    skinToneDescription,
    ageConfirmation,
    hairDescription,
    distinctFeatures,
    clothingStyle,
    personalityDescription,
    sceneDescription,
    artStyle,
    frontText
  } = characterData;

  // Generate contextual typography instructions
  const typographyInstructions = generateTypographyInstructions(artStyle, sceneDescription);

  return `Full-bleed square greeting card design, no borders, no background, no card mockup. ${artStyle} style featuring ${recipientIdentity} (${skinToneDescription}, ${ageConfirmation}, ${hairDescription}, ${distinctFeatures}, wearing ${clothingStyle}), in a scene: ${sceneDescription}. Mood: ${personalityDescription}. Text overlay: "${frontText}". ${typographyInstructions}. Print-ready artwork filling entire frame.`;
}

export function buildSceneOnlyPrompt(sceneData: any): string {
  const {
    cardVibe,
    visualSceneDescription,
    artStyle,
    frontText
  } = sceneData;

  // Generate contextual typography instructions
  const typographyInstructions = generateTypographyInstructions(artStyle, visualSceneDescription);

  return `Full-bleed square greeting card design, no borders, no background, no card mockup. ${artStyle} style. The scene is: ${visualSceneDescription}. Mood: ${cardVibe}. Text overlay: "${frontText}". ${typographyInstructions}. Print-ready artwork filling entire frame.`;
}

export function buildInsidePrompt(insideText: string, artStyle: string, frontPrompt?: string, sceneDescription?: string): string {
  const styleReference = frontPrompt ? `matching the exact style, colors, and mood from: ${frontPrompt}` : `in ${artStyle} style`;
  
  // Generate contextual typography instructions for inside card
  // Use scene description if provided, otherwise extract from front prompt or use generic
  const contextForTypography = sceneDescription || frontPrompt || 'greeting card interior';
  const typographyInstructions = generateTypographyInstructions(artStyle, contextForTypography);
  
  return `Full-bleed square greeting card interior, no borders, no background, no card mockup. ${styleReference}. Centered text: "${insideText}". ${typographyInstructions}. Print-ready artwork filling entire frame with consistent visual theme.`;
}
