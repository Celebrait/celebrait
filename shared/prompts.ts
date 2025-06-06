// Shared prompts used across the application
// Changes here will be reflected in both main journey and test page

export const PHOTO_ANALYSIS_PROMPT = `Please provide an extremely detailed artistic visual analysis of this person for creating a fictional character illustration. The person has given explicit consent for this analysis.

REQUIRED DETAILS - Be exhaustively descriptive:

FACIAL STRUCTURE: Describe face shape (oval, round, square, heart, diamond), jawline definition, cheekbone prominence, chin shape and size, forehead height and width, overall facial proportions.

EYES: Color (exact shade and any variations), size, shape (almond, round, hooded, etc.), eyelid characteristics, eyelash length/thickness/curl, eyebrow shape/thickness/arch/color, any asymmetry, expression quality.

HAIR: Exact color including highlights/lowlights/graying patterns, texture (fine, coarse, curly, straight, wavy), length, styling, hairline, density, any balding patterns, facial hair details including mustache/beard style, coverage, trim level.

NOSE: Size relative to face, bridge width/height, nostril shape/flare, tip shape (bulbous, pointed, upturned), any distinctive characteristics.

MOUTH & LIPS: Lip fullness (upper vs lower), shape, color, mouth width relative to nose, smile characteristics, teeth visibility, any distinctive features.

SKIN: Exact tone and undertones, texture quality, any visible marks/freckles/moles/scars, complexion evenness, signs of aging.

BUILD: Shoulder width, neck length/thickness, apparent body type, posture characteristics.

ACCESSORIES: Glasses (exact style, frame material, color, lens type), jewelry (earrings, necklaces, rings - describe materials, styles, placement), piercings, tattoos if visible.

AGE INDICATORS: Specific age range based on visible characteristics like skin texture, eye area, hair patterns.

Provide this as a flowing, detailed artistic description suitable for an AI image generator. Focus on precision and completeness - every visible detail matters for accurate artistic reproduction.`;

export const buildImagePrompt = (answers: any, photoAnalyses?: Array<{personIndex: number, analysis: string}>) => {
  const parts = [];
  
  // Base requirements (matching test page structure)
  parts.push("Square 1:1 aspect ratio greeting card design, full bleed with no borders or card edges visible");
  
  // Add photo analysis if available
  if (photoAnalyses && photoAnalyses.length > 0) {
    photoAnalyses.forEach((analysis, index) => {
      const personDescription = analysis.analysis.replace(`Person ${analysis.personIndex}:`, '').trim();
      parts.push(`featuring Person ${index + 1}: ${personDescription}`);
    });
  }
  
  // Add scene description
  if (answers.scene) {
    parts.push(answers.scene);
  }
  
  // Add art style
  if (answers.art_style) {
    parts.push(`${answers.art_style} style`);
  }
  
  // Add celebration text if name is provided
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
    
    parts.push(`with "Happy ${celebrationText} ${answers.name}" text prominently displayed`);
  }
  
  // Quality requirements
  parts.push('professional greeting card quality, print-ready artwork');
  
  return parts.join(', ');
};

export const buildInsidePrompt = (insideText: string, artStyle: string, frontPrompt?: string) => {
  const parts = [];
  
  // Base requirements for inside card
  parts.push('Square 1:1 aspect ratio greeting card interior design, full bleed with no borders or card edges visible');
  
  // Message content
  parts.push(`"${insideText}" prominently displayed as the main focus`);
  
  // Art style consistency
  if (artStyle) {
    parts.push(`${artStyle} art style with same visual treatment as front`);
  }
  
  // Typography and layout requirements
  parts.push('professional greeting card typography using same font style and treatment as front card');
  parts.push('text prominently displayed and clearly readable');
  parts.push('minimal decorative elements that complement without overwhelming the message');
  parts.push('print-ready artwork, no card mockup visible');
  
  return parts.join(', ');
};