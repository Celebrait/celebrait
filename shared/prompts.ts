// Shared prompts used across the application
// Changes here will be reflected in both main journey and test page

// Typography library removed - AI handles integration directly



// Text-only prompt for non-photo scenarios - uses same detailed structure as GPT-Image-1 route
export const buildTextOnlyImagePrompt = (answers: any) => {
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

  if (answers.art_style) {
    // Enhanced style specifications
    let enhancedStyle = answers.art_style;
    
    if (answers.art_style.toLowerCase().includes('animated_movie_style') || answers.art_style.toLowerCase().includes('animated movie style')) {
      enhancedStyle = `professional 3D animated movie style with high-quality computer animation aesthetic, clean digital rendering with soft edges and polished surfaces, professional animation studio quality with realistic proportions. TYPOGRAPHY INTEGRATION: Naturally integrate text into the scene as part of the artistic composition - text should appear carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements, ensuring clear legibility while feeling like an organic part of the scene rather than overlaid text.`;
    }
    else if (answers.art_style.toLowerCase().includes('modern_flat_illustration') || answers.art_style.toLowerCase().includes('modern flat illustration')) {
      enhancedStyle = `contemporary editorial illustration style with subtle dimensional shading, vibrant saturated color palette with rich tones, sophisticated graphic design elements with confident brushwork. Features modern magazine illustration style with selective artistic detail. Art style influences: high-end editorial portraiture, contemporary character illustration, and professional concept art. TYPOGRAPHY INTEGRATION: Naturally integrate text into the scene as part of the artistic composition - text should appear carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements, ensuring clear legibility while feeling like an organic part of the scene rather than overlaid text.`;
    }
    else if (answers.art_style.toLowerCase().includes('semi-realistic illustration')) {
      enhancedStyle = 'semi-realistic digital illustration with clean digital art style and simplified background details, soft edges and painterly quality for artistic balance. TYPOGRAPHY INTEGRATION: Naturally integrate text into the scene as part of the artistic composition - text should appear carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements, ensuring clear legibility while feeling like an organic part of the scene rather than overlaid text.';
    }
    else if (answers.art_style.toLowerCase().includes('stylized semi-realism')) {
      enhancedStyle = 'stylized semi-realistic art with enhanced reality and vibrant colors, selective detail emphasis and refined digital painting techniques. TYPOGRAPHY INTEGRATION: Naturally integrate text into the scene as part of the artistic composition - text should appear carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements, ensuring clear legibility while feeling like an organic part of the scene rather than overlaid text.';
    }
    else {
      enhancedStyle = `${answers.art_style} with TYPOGRAPHY INTEGRATION: Naturally integrate text into the scene as part of the artistic composition - text should appear carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements, ensuring clear legibility while feeling like an organic part of the scene rather than overlaid text.`;
    }
    
    fullPrompt = `${fullPrompt} Apply the following artistic style: ${enhancedStyle} art style`;
  }

  if (cardText) {
    fullPrompt = `${fullPrompt}. ORGANIC TEXT INTEGRATION: Add EXACTLY the text "${cardText}" and NO OTHER TEXT. CRITICAL: Do NOT overlay text on top of the image. Instead, naturally integrate the text into the scene as part of the artistic composition. The text should appear as if it belongs in this specific environment - carved into surfaces, written in natural elements, displayed on signs, formed by scene elements, or integrated into the background architecture. Ensure the text is clearly legible while feeling like an organic part of the scene rather than overlaid text. Typography should match the ${answers.art_style || 'artistic'} style and complement the scene's natural elements.`;
  }
  
  fullPrompt = `${fullPrompt}. High-quality artistic rendering, professional artwork.`;
  
  return fullPrompt;
};

export const buildInsidePrompt = (insideText: string, artStyle: string, frontPrompt?: string, sceneDescription?: string) => {
  const parts = [];
  
  // Base requirements for inside card
  parts.push('Square 1:1 aspect ratio interior design, full bleed with no borders or edges visible');
  
  // Explicit instruction to NOT recreate characters
  parts.push('DO NOT include any people, characters, or figures from the front card');
  
  // Message content
  parts.push(`"${insideText}" prominently displayed as the main focus`);
  
  // Art style consistency
  if (artStyle) {
    parts.push(`${artStyle} art style with same visual treatment as front`);
  }
  
  // Simple typography instruction for inside card
  parts.push('TYPOGRAPHY: Integrate the text naturally into the design as an organic part of the composition. The text should feel like it belongs in this artistic environment - whether displayed on surfaces, formed by design elements, or integrated into the scene. Maintain clear legibility while ensuring the typography enhances rather than competes with the artistic style.');
  
  parts.push('text prominently displayed and clearly readable');
  parts.push('minimal decorative elements that complement without overwhelming the message');
  parts.push('print-ready artwork, no mockup visible');
  
  return parts.join(', ');
};