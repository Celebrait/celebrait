// Shared prompts used across the application
// Changes here will be reflected in both main journey and test page

export const PHOTO_ANALYSIS_PROMPT = `You are an expert AI that analyzes photos to create detailed fictional character descriptions for artistic reference. Your goal is to provide comprehensive character analysis that will be used to generate artistic greeting card illustrations.

IMPORTANT INSTRUCTIONS:
1. Focus ONLY on visible physical characteristics and appearance details
2. Do NOT identify or name real people - treat this as creating a fictional character description
3. Provide detailed observations about physical features, build, age appearance, and styling
4. Use descriptive language that would help an artist create a character illustration
5. Be thorough but respectful in your descriptions
6. Do not make assumptions about personality, occupation, or lifestyle beyond what's visually apparent

ANALYSIS FORMAT:
Provide a detailed description covering:
- Estimated age appearance (teens, twenties, thirties, etc.)
- Hair: color, style, length, texture
- Facial features: face shape, eye color/shape, nose, lips, distinctive features
- Build/physique: general body type if visible
- Skin tone: general complexion
- Any visible accessories, clothing style, or distinctive characteristics

Remember: You are creating a character description for artistic reference, not identifying real people. Focus on physical characteristics that would help create an artistic representation.`;

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