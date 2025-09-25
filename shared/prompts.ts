// Shared prompts used across the application
// Changes here will be reflected in both main journey and test page

// Typography library removed - AI handles integration directly



// Text-only prompt for non-photo scenarios - uses same detailed structure as GPT-Image-1 route
export const buildTextOnlyImagePrompt = (answers: any, artStyle?: string) => {
  const aspectDescription = 'MANDATORY: Create a perfectly SQUARE composition with equal width and height - NOT portrait, NOT landscape. Full bleed square design with no borders, fill entire square frame.';
  
  // Build character description from answers
  let characterDescription = '';
  if (answers.name) {
    characterDescription = `featuring a person named ${answers.name}`;
  } else {
    characterDescription = 'featuring the main character';
  }
  
  // Build celebration text
  let cardText = '';
  if (answers.name && answers.celebration) {
    const celebrationText = answers.celebration === 'birthday' ? 'Birthday' :
                           answers.celebration === 'anniversary' ? 'Anniversary' :
                           answers.celebration === 'graduation' ? 'Graduation' :
                           answers.celebration === 'wedding' ? 'Wedding' :
                           answers.celebration === 'retirement' ? 'Retirement' :
                           answers.celebration === 'new_baby' ? 'New Baby' :
                           answers.celebration === 'vacation' ? 'Vacation' :
                           answers.celebration === 'promotion' ? 'Promotion' :
                           answers.celebration === 'thank_you' ? 'Thank You' :
                           answers.celebration === 'other' ? 'Special Day' :
                           'Special Day';
    cardText = `Happy ${celebrationText} ${answers.name}`;
  }
  
  // Build the detailed prompt using same structure as GPT-Image-1 route
  let fullPrompt = `${aspectDescription} ABSOLUTE PRIORITY: ARTISTIC QUALITY AND COMPOSITION FIRST.

SCENE CREATION:
Create a completely new artistic scene ${characterDescription}. 

COMPOSITION RULES:
- Show the character actively participating in the scene, not just posing
- Include relevant background elements that tell the story of the scene
- Use full-body or three-quarter shots that tell the story of the scene
- Create immersive scene composition that showcases the environment

SCENE DESCRIPTION: ${answers.scene || 'in a celebratory setting'}

ARTISTIC STYLE APPLICATION:`;

  // Handle artistic style - either user-specified or AI-decided
  let styleInstruction;
  if (artStyle && artStyle !== 'ai_decide') {
    // User-specified style
    styleInstruction = `Apply the following artistic style: ${artStyle}. Render the entire image consistently in this style while maintaining high artistic quality and visual cohesion. TYPOGRAPHY INTEGRATION: Naturally integrate text into the scene as part of the artistic composition - text should appear carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements, ensuring clear legibility while feeling like an organic part of the scene rather than overlaid text.`;
  } else {
    // AI-decided style (dynamic selection)
    const sceneDescription = answers.scene || 'in a celebratory setting';
    styleInstruction = `DYNAMIC STYLE SELECTION: Analyze the scene description "${sceneDescription}" and intelligently choose the most appropriate artistic style that best complements the mood, atmosphere, setting, and emotional tone of this specific scene.

Consider artistic styles such as:
- Watercolor painting (for soft, dreamy, romantic scenes)
- Oil painting (for classical, elegant, formal celebrations)
- Digital illustration (for modern, contemporary settings)
- Fantasy art (for magical, mystical, fairytale scenes)
- Storybook illustration (for whimsical, children's book-style scenes)
- Impressionistic (for atmospheric, mood-focused scenes)
- Contemporary art (for urban, trendy, modern celebrations)
- Realistic photography style (for authentic, documentary-style moments)
- Vintage illustration (for retro, nostalgic, classic scenes)
- Comic book style (for dynamic, energetic, fun celebrations)
- Minimalist design (for clean, simple, sophisticated scenes)
- Renaissance painting (for grand, ornate, classical scenes)
- Anime/manga style (for vibrant, expressive, youthful scenes)
- Art nouveau (for decorative, elegant, artistic scenes)
- And any other artistic style that would create the most visually compelling result

Choose the single artistic style that creates the most contextually appropriate, visually stunning, and emotionally resonant result for this specific scene. TYPOGRAPHY INTEGRATION: Naturally integrate text into the scene as part of the artistic composition - text should appear carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements, ensuring clear legibility while feeling like an organic part of the scene rather than overlaid text.`;
  }
    
  fullPrompt = `${fullPrompt} ${styleInstruction}`;

  if (cardText) {
    fullPrompt = `${fullPrompt}. STRICT TEXT RESTRICTION: Add EXACTLY and ONLY the text "${cardText}" - ABSOLUTELY NO OTHER TEXT, WORDS, LETTERS, NUMBERS, SIGNS, LABELS, OR WRITING of any kind should appear anywhere in the image. CRITICAL: Do NOT overlay text on top of the image. Instead, naturally integrate ONLY this specific text into the scene as part of the artistic composition. The text should appear as if it belongs in this specific environment - carved into surfaces, written in natural elements, displayed on signs, formed by scene elements, or integrated into the background architecture. FORBIDDEN: Do not add any background text, signage, labels, captions, watermarks, logos, brand names, location names, or any other written content. Typography should match the chosen artistic style and complement the scene's natural elements.`;
  }
  
  fullPrompt = `${fullPrompt}. High-quality artistic rendering, professional artwork.`;
  
  return fullPrompt;
};

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