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

// Typography library removed - AI handles text integration directly

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

  // Simple typography integration instruction
  const typographyInstructions = `TYPOGRAPHY INTEGRATION: Naturally integrate the text "${frontText}" into the scene as part of the artistic composition. The text should appear as if it belongs in this specific environment - carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements. Ensure the text is clearly legible while feeling like an organic part of the scene rather than overlaid text.`;

  return `Full-bleed square greeting card design, no borders, no background, no card mockup. ${artStyle} style featuring ${recipientIdentity} (${skinToneDescription}, ${ageConfirmation}, ${hairDescription}, ${distinctFeatures}, wearing ${clothingStyle}), in a scene: ${sceneDescription}. Mood: ${personalityDescription}. ${typographyInstructions}. Print-ready artwork filling entire frame.`;
}

export function buildSceneOnlyPrompt(sceneData: any): string {
  const {
    cardVibe,
    visualSceneDescription,
    artStyle,
    frontText
  } = sceneData;

  // Simple typography integration instruction
  const typographyInstructions = `TYPOGRAPHY INTEGRATION: Naturally integrate the text "${frontText}" into the scene as part of the artistic composition. The text should appear as if it belongs in this specific environment - carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements. Ensure the text is clearly legible while feeling like an organic part of the scene rather than overlaid text.`;

  return `Full-bleed square greeting card design, no borders, no background, no card mockup. ${artStyle} style. The scene is: ${visualSceneDescription}. Mood: ${cardVibe}. ${typographyInstructions}. Print-ready artwork filling entire frame.`;
}

export function buildInsidePrompt(insideText: string, artStyle: string, frontPrompt?: string, sceneDescription?: string): string {
  const styleReference = frontPrompt ? `matching the exact style, colors, and mood from: ${frontPrompt}` : `in ${artStyle} style`;
  
  // Simple typography integration instruction for inside card
  const typographyInstructions = `TYPOGRAPHY: Integrate the text "${insideText}" naturally into the design as an organic part of the composition. The text should feel like it belongs in this artistic environment - whether displayed on surfaces, formed by design elements, or integrated into the scene. Maintain clear legibility while ensuring the typography enhances rather than competes with the artistic style.`;
  
  return `Full-bleed square greeting card interior, no borders, no background, no card mockup. ${styleReference}. ${typographyInstructions}. Print-ready artwork filling entire frame with consistent visual theme.`;
}
