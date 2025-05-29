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

  return `Square greeting card in ${artStyle} style featuring ${recipientIdentity} (${skinToneDescription}, ${ageConfirmation}, ${hairDescription}, ${distinctFeatures}, wearing ${clothingStyle}), in a scene: ${sceneDescription}. Mood: ${personalityDescription}. Text on front: "${frontText}".`;
}

export function buildSceneOnlyPrompt(sceneData: any): string {
  const {
    cardVibe,
    visualSceneDescription,
    artStyle,
    frontText
  } = sceneData;

  return `Square greeting card in ${artStyle} style. The scene is: ${visualSceneDescription}. Mood: ${cardVibe}. Text on front: "${frontText}".`;
}

export function buildInsidePrompt(insideText: string, artStyle: string): string {
  return `Square card interior, styled to match the front in ${artStyle}, with text-only message: "${insideText}". Match color tone, typography, and emotion.`;
}
