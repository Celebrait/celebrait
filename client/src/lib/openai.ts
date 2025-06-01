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

  return `Full-bleed square greeting card design, no borders, no background, no card mockup. ${artStyle} style featuring ${recipientIdentity} (${skinToneDescription}, ${ageConfirmation}, ${hairDescription}, ${distinctFeatures}, wearing ${clothingStyle}), in a scene: ${sceneDescription}. Mood: ${personalityDescription}. Text overlay: "${frontText}". Print-ready artwork filling entire frame.`;
}

export function buildSceneOnlyPrompt(sceneData: any): string {
  const {
    cardVibe,
    visualSceneDescription,
    artStyle,
    frontText
  } = sceneData;

  return `Full-bleed square greeting card design, no borders, no background, no card mockup. ${artStyle} style. The scene is: ${visualSceneDescription}. Mood: ${cardVibe}. Text overlay: "${frontText}". Print-ready artwork filling entire frame.`;
}

export function buildInsidePrompt(insideText: string, artStyle: string, frontPrompt?: string): string {
  const styleReference = frontPrompt ? `matching the exact style, colors, and mood from: ${frontPrompt}` : `in ${artStyle} style`;
  return `Full-bleed square greeting card interior, no borders, no background, no card mockup. ${styleReference}. Clean typography layout with centered text: "${insideText}". Print-ready artwork filling entire frame with consistent visual theme.`;
}
