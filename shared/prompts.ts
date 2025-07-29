// Shared prompts used across the application
// Changes here will be reflected in both main journey and test page

// Typography library removed - AI handles integration directly



export const buildImagePrompt = (answers: any, photoAnalyses?: Array<{personIndex: number, analysis: string}>) => {
  const parts = [];
  
  // Base requirements (matching test page structure)
  parts.push("Square 1:1 aspect ratio design, full bleed with no borders or card edges visible");
  
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
  
  // Simple typography integration instruction
  if (answers.art_style && answers.scene) {
    parts.push(`TYPOGRAPHY INTEGRATION: If text is included, naturally integrate it into the scene as part of the artistic composition. The text should appear as if it belongs in this specific environment - carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements. Ensure the text is clearly legible while feeling like an organic part of the scene rather than overlaid text.`);
  }
  
  // Quality requirements
  parts.push('professional artwork quality, print-ready');
  
  return parts.join(', ');
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