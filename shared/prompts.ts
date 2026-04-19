// Shared prompts used across the application
// Changes here will be reflected in both main journey and test page

export const buildInsidePrompt = (insideText: string, artStyle?: string, frontPrompt?: string, sceneDescription?: string, structuredData?: any) => {
  const parts = [];
  
  // Base requirements for inside card
  parts.push('Square 1:1 aspect ratio interior design, full bleed with no borders or edges visible');
  
  // Explicit instruction to NOT recreate characters
  parts.push('DO NOT include any people, characters, or figures from the front card');
  
  // Enhanced message content with greeting card formatting instructions
  if (structuredData && (structuredData.dear || structuredData.from)) {
    // This is a structured greeting card message
    parts.push(`"${insideText}" prominently displayed as the main focus with proper greeting card typography hierarchy`);
    
    // Add specific formatting instructions for greeting card structure
    let typographyInstructions = 'GREETING CARD TYPOGRAPHY HIERARCHY: Format the text as a traditional greeting card with proper spacing and hierarchy:';
    
    if (structuredData.dear) {
      typographyInstructions += ` - Greeting "${structuredData.dear}" should appear at the top in elegant, smaller font (14-16pt equivalent)`;
    }
    
    if (structuredData.message) {
      typographyInstructions += ` - Main message "${structuredData.message}" should be prominently displayed in the center with larger, readable font (18-24pt equivalent) and generous line spacing`;
    }
    
    if (structuredData.from) {
      typographyInstructions += ` - Signature "${structuredData.from}" should be positioned at the bottom in smaller, elegant font (12-14pt equivalent), typically bottom-right or center-bottom`;
    }
    
    typographyInstructions += '. Use traditional greeting card proportions with proper margins and spacing between sections. Ensure clear visual hierarchy and professional greeting card appearance.';
    
    parts.push(typographyInstructions);
  } else {
    // Standard single message
    parts.push(`"${insideText}" prominently displayed as the main focus`);
  }
  
  // Style consistency with front card
  if (artStyle && artStyle !== 'ai_decide') {
    parts.push(`Apply the same artistic style as the front card: ${artStyle}. Maintain visual consistency with the same style treatment, color palette, and visual aesthetic.`);
  } else {
    parts.push(`Use the same artistic style that was intelligently chosen for the front card to maintain visual consistency. Apply the same style treatment, color palette, and visual aesthetic as the front card.`);
  }
  
  // Subtle theme reference instruction
  parts.push('Make subtle reference to the theme on the front of the card, but ensure any reference is kept very subtle so that the main focus is the text which is always to be readable');
  
  // Strict text restriction for inside card
  parts.push(`STRICT TEXT RESTRICTION: Include EXACTLY and ONLY the text "${insideText}" - ABSOLUTELY NO OTHER TEXT, WORDS, LETTERS, NUMBERS, SIGNS, LABELS, OR WRITING of any kind should appear anywhere in the image. FORBIDDEN: Do not add any background text, signage, labels, captions, watermarks, logos, brand names, decorative text, or any other written content. TYPOGRAPHY: Integrate ONLY the specified text naturally into the design as an organic part of the composition.`);
  
  parts.push('text prominently displayed and clearly readable');
  parts.push('minimal decorative elements that complement without overwhelming the message');
  parts.push('print-ready artwork, no mockup visible');

  return parts.join(', ');
};

export function buildScenePrompt(params: {
  scenePrompt: string;
  userArtStyle?: string;
  userClothing?: string;
  includeText?: boolean;
  cardText?: string;
}): string {
  const { scenePrompt, userArtStyle, userClothing, includeText, cardText } = params;

  const clothingSection = userClothing?.trim()
    ? `CLOTHING REQUIREMENTS: The scene description includes specific clothing requirements. Dress the character(s) exactly as described: ${userClothing}`
    : `CLOTHING REQUIREMENTS: Choose scene-appropriate clothing that fits the new environment and activity. Change the clothing completely from the reference photo to match the scenario while maintaining identical faces only.`;

  const styleSection = (userArtStyle && userArtStyle.trim() && userArtStyle !== 'ai_decide')
    ? `ARTISTIC STYLE APPLICATION: Apply the user-specified artistic style: ${userArtStyle}. Render the entire image consistently in this style while maintaining high artistic quality and visual cohesion.`
    : `ARTISTIC STYLE APPLICATION: DYNAMIC STYLE SELECTION: Analyze the scene description and intelligently choose the most appropriate artistic style that best complements the mood, atmosphere, setting, and emotional tone of this specific scene. Consider styles such as watercolor painting, oil painting, digital illustration, fantasy art, storybook illustration, impressionistic, contemporary art, realistic photography style, vintage illustration, comic book style, minimalist design, Renaissance painting, anime/manga style, or art nouveau.`;

  let fullPrompt = `MANDATORY: Create a perfectly SQUARE 1024x1024 composition with equal width and height - NOT portrait, NOT landscape. Full bleed square design with no borders, fill entire square frame. ABSOLUTE PRIORITY: FACIAL ACCURACY FIRST - Before applying any artistic style, the EXACT facial likeness from the reference photo(s) must be preserved with absolute precision in the new scene BUT with new expressions to match the new scene. Ensure that the characters always look happy to be a part of the new scene in a natural way to fit the new scene.

MANDATORY FACIAL RECREATION REQUIREMENTS FOR ALL CHARACTERS IN THE REFERENCE PHOTO(S) (COMPLETE BEFORE ANY STYLING):
1) FACIAL STRUCTURE MATCH: Recreate the EXACT facial bone structure - same cheekbone height, same jawline angle, same forehead shape, same chin projection (but with new facial expression to match the new scene and mood)
2) EYE PRECISION: Match exact eye shape (almond, round, hooded), eye spacing, eyelid fold pattern, iris color, eyebrow shape and arch
3) NOSE ACCURACY: Replicate precise nose bridge width, nostril shape, nose tip definition, any bumps or unique nose characteristics
4) MOUTH DUPLICATION: Copy exact lip fullness, mouth width, corner shape, any asymmetries or distinctive mouth features
5) SKIN MATCHING: Preserve exact skin tone, texture, any blemishes, freckles, moles, or distinctive skin characteristics
6) HAIR PRECISION: Match exact hair color, texture, natural growth patterns, hairline shape
7) DISTINCTIVE MARKS: Include any scars, dimples, laugh lines, or other identifying facial features
8) CRITICAL EXPRESSION CHANGE: DO NOT copy the original facial expression from the reference photo. You must create a COMPLETELY NEW facial expression that matches the mood and energy of the new scene

AFTER ESTABLISHING PERFECT LIKENESS - SCENE CREATION:
Create a completely new scene featuring the character(s) from the reference photo(s). CRITICAL: Ensure the characters facial expressions capture the mood of the new scene. DO NOT COPY the original expressions.

COMPOSITION RULES:
- Show the character(s) actively participating in the new scene, not just posing
- Include relevant background elements that tell the story of the scene
- Use full-body or three-quarter shots that tell the story of the scene
- Create immersive scene composition that showcases the environment
- SCENE-APPROPRIATE EXPRESSION: The character(s) must display a brand NEW facial expression that perfectly captures the energy and mood of this specific scene
- COMPLETELY IGNORE ORIGINAL PHOTO COMPOSITION: Do NOT copy the positioning, framing, or body placement from the reference photo. The reference is ONLY for facial features
- CREATIVE POSITIONING REQUIRED: Position character(s) in completely different positions that showcase the full scene context
- DYNAMIC POSES AND INTERACTIONS: Create completely new poses that are appropriate for the scene activity and energy level
- ENVIRONMENTAL INTEGRATION: Reimagine character positioning and interactions for the new environment to create an immersive scene composition

SCENE DESCRIPTION: ${scenePrompt}

${clothingSection}

${styleSection}

TYPOGRAPHY INTEGRATION: Naturally integrate text into the scene as part of the artistic composition - text should appear prominent on the image, carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements, ensuring clear legibility of ALL letters while feeling like an organic part of the scene, rather than overlaid text.`;

  if (includeText && cardText?.trim()) {
    fullPrompt += `. STRICT TEXT RESTRICTION: Add EXACTLY and ONLY the text "${cardText}" - ABSOLUTELY NO OTHER TEXT, WORDS, LETTERS, NUMBERS, SIGNS, LABELS, OR WRITING of any kind should appear anywhere in the image. CRITICAL: Do NOT overlay text on top of the image. Instead, naturally integrate ONLY this specific text into the scene as part of the artistic composition. FORBIDDEN: Do not add any background text, signage, labels, captions, watermarks, logos, brand names, location names, or any other written content. Typography should match the chosen artistic style and complement the scene's natural elements. CRITICAL: All letters of the text should be legible within the square frame of the artwork. CRITICAL: DO NOT allow the text to be cropped off the screen in any way; all letters in the text MUST be readable with no cropping of the text whatsoever.`;
  }

  fullPrompt += `. High-quality artistic rendering, professional artwork.`;
  return fullPrompt;
}

