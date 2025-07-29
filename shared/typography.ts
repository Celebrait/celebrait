// Typography analysis and generation system for contextual art styles
// Combines scene themes with art styles to create appropriate typography

export interface SceneTheme {
  primary: string;
  secondary?: string;
  mood: string;
  era?: string;
  genre?: string;
}

export interface TypographyStyle {
  description: string;
  fontCharacteristics: string;
  treatment: string;
  examples: string;
}

// Scene theme detection patterns
const THEME_PATTERNS = {
  fairytale: /\b(fairytale|fairy.?tale|magical|enchanted|princess|prince|castle|dragon|forest|once upon|storybook|fantasy|whimsical|mystical)\b/i,
  adventure: /\b(adventure|journey|exploration|quest|hiking|climbing|outdoor|wilderness|expedition|travel|camping)\b/i,
  romance: /\b(romantic|valentine|love|wedding|anniversary|couple|hearts|roses|romantic|intimate|tender)\b/i,
  vintage: /\b(vintage|retro|classic|old.?fashioned|nostalgic|antique|traditional|historic|1920s|1950s|victorian)\b/i,
  modern: /\b(modern|contemporary|sleek|minimalist|urban|city|tech|digital|trendy|stylish|chic)\b/i,
  nature: /\b(nature|garden|flowers|trees|forest|mountains|ocean|beach|sunset|sunrise|landscape|botanical)\b/i,
  celebration: /\b(party|birthday|celebration|festive|joyful|confetti|balloons|cake|dancing|music|fun)\b/i,
  elegant: /\b(elegant|sophisticated|classy|refined|luxurious|formal|graceful|polished|upscale)\b/i,
  playful: /\b(playful|fun|cheerful|colorful|bright|lively|energetic|vibrant|cartoon|animated)\b/i,
  peaceful: /\b(peaceful|calm|serene|tranquil|quiet|meditation|zen|relaxing|gentle|soft)\b/i,
  dramatic: /\b(dramatic|intense|bold|powerful|striking|dynamic|cinematic|epic|grand)\b/i,
  sci_fi: /\b(sci.?fi|science.?fiction|futuristic|space|robot|technology|cyber|neon|digital|virtual)\b/i,
  holiday: /\b(christmas|halloween|easter|thanksgiving|holiday|seasonal|winter|summer|spring|autumn)\b/i,
  professional: /\b(business|professional|corporate|office|work|career|graduation|achievement|success)\b/i,
  artistic: /\b(artistic|creative|painter|artist|studio|gallery|canvas|brush|palette|masterpiece)\b/i
};

// Typography styles for 3D Animation art style
const TYPOGRAPHY_3D_ANIMATION = {
  fairytale: {
    description: "Magical typography that integrates naturally into enchanted environments",
    fontCharacteristics: "Curved, flowing letterforms that could be formed by magical elements, vines, or fairy dust",
    treatment: "Text that appears carved into ancient trees, spelled out in flower petals, or glowing with magical energy as part of the scene",
    examples: "Text carved in tree bark, letters formed by magical sparkles, words written in starlight"
  },
  adventure: {
    description: "Bold 3D typography with adventure movie aesthetic, dynamic and energetic",
    fontCharacteristics: "Strong, angular letterforms with pronounced 3D depth and motion-inspired design",
    treatment: "Metallic textures, adventure-themed effects, and heroic color schemes",
    examples: "Adventure movie titles, action game logos, expedition branding"
  },
  romance: {
    description: "Elegant 3D typography with romantic movie aesthetic, soft and sophisticated",
    fontCharacteristics: "Graceful, flowing letterforms with gentle dimensional effects and romantic curves",
    treatment: "Soft lighting effects, rose gold textures, and warm romantic gradients",
    examples: "Romantic comedy titles, wedding movie graphics, love story branding"
  },
  sci_fi: {
    description: "Futuristic 3D typography with sci-fi movie aesthetic, sleek and technological",
    fontCharacteristics: "Sharp, geometric letterforms with advanced 3D effects and tech-inspired design",
    treatment: "Holographic effects, neon glows, and futuristic metallic textures",
    examples: "Sci-fi movie titles, tech game logos, futuristic brand identity"
  },
  playful: {
    description: "Fun 3D typography with animated movie aesthetic, bouncy and energetic",
    fontCharacteristics: "Rounded, bubble-like letterforms with exaggerated 3D depth and playful proportions",
    treatment: "Bright color schemes, cartoon-style effects, and joyful dimensional treatments",
    examples: "Animated comedy titles, children's game logos, toy brand identity"
  },
  elegant: {
    description: "Sophisticated 3D typography with premium movie aesthetic, refined and luxurious",
    fontCharacteristics: "Classic, refined letterforms with subtle 3D depth and elegant proportions",
    treatment: "Gold/silver textures, sophisticated lighting, and premium material effects",
    examples: "Drama movie titles, luxury brand logos, high-end product graphics"
  },
  default: {
    description: "Modern 3D typography with contemporary animated aesthetic",
    fontCharacteristics: "Clean, geometric letterforms with balanced 3D depth and modern proportions",
    treatment: "Subtle gradients, contemporary lighting effects, and polished 3D rendering",
    examples: "Modern animated movies, contemporary game logos, tech brand identity"
  }
};

// Typography styles for Flat Illustration art style
const TYPOGRAPHY_FLAT_ILLUSTRATION = {
  fairytale: {
    description: "Typography that appears magically created within the enchanted scene",
    fontCharacteristics: "Whimsical letterforms that could be formed by fairy dust, magical vines, or storybook elements",
    treatment: "Text that appears carved into ancient stone, spelled out in flower petals, or glowing as magical runes on trees",
    examples: "Words carved in castle stones, letters formed by magical sparkles, text written in fairy dust"
  },
  vintage: {
    description: "Retro flat typography with vintage poster aesthetic, classic and nostalgic",
    fontCharacteristics: "Period-appropriate letterforms with vintage character and historical accuracy",
    treatment: "Muted color palettes, vintage textures, and classic poster styling",
    examples: "Vintage advertising posters, retro magazine covers, classic brand identity"
  },
  modern: {
    description: "Typography that seamlessly integrates into contemporary urban environments",
    fontCharacteristics: "Clean, geometric letterforms that could appear on digital displays, neon signs, or architectural elements",
    treatment: "Text that appears on billboards, digital screens, building facades, or as part of modern urban infrastructure",
    examples: "Text on neon signs, digital billboard displays, architectural lettering, modern storefronts"
  },
  nature: {
    description: "Typography that grows organically from the natural environment",
    fontCharacteristics: "Letterforms that could be formed by branches, leaves, or natural elements",
    treatment: "Text that appears written in sand, formed by flower petals, carved in tree trunks, or shaped by natural formations",
    examples: "Words spelled out in fallen leaves, text written in beach sand, letters formed by tree branches"
  },
  playful: {
    description: "Fun flat typography with contemporary illustration aesthetic, bright and energetic",
    fontCharacteristics: "Rounded, friendly letterforms with playful character and approachable design",
    treatment: "Vibrant color schemes, playful decorative elements, and energetic styling",
    examples: "Children's illustration books, fun brand identity, contemporary poster design"
  },
  elegant: {
    description: "Refined flat typography with sophisticated illustration aesthetic",
    fontCharacteristics: "Serif letterforms with elegant proportions and sophisticated character",
    treatment: "Sophisticated color palettes, minimal decorative elements, and refined styling",
    examples: "Fashion magazine covers, luxury brand identity, sophisticated poster design"
  },
  default: {
    description: "Contemporary flat typography with modern illustration aesthetic",
    fontCharacteristics: "Clean, readable letterforms with balanced proportions and modern character",
    treatment: "Contemporary color schemes, subtle styling, and professional presentation",
    examples: "Modern illustration work, contemporary magazine design, professional brand identity"
  }
};

/**
 * Analyzes scene description to extract thematic context
 */
export function analyzeSceneTheme(sceneDescription: string): SceneTheme {
  const text = sceneDescription.toLowerCase();
  const detectedThemes: string[] = [];
  
  // Check for theme patterns
  for (const [theme, pattern] of Object.entries(THEME_PATTERNS)) {
    if (pattern.test(text)) {
      detectedThemes.push(theme);
    }
  }
  
  // Determine primary and secondary themes
  const primary = detectedThemes[0] || 'modern';
  const secondary = detectedThemes[1];
  
  // Extract mood indicators
  let mood = 'balanced';
  if (/\b(happy|joyful|cheerful|bright|fun)\b/i.test(text)) mood = 'joyful';
  else if (/\b(calm|peaceful|serene|gentle|soft)\b/i.test(text)) mood = 'peaceful';
  else if (/\b(dramatic|intense|bold|powerful)\b/i.test(text)) mood = 'dramatic';
  else if (/\b(elegant|sophisticated|refined)\b/i.test(text)) mood = 'elegant';
  else if (/\b(playful|fun|energetic|lively)\b/i.test(text)) mood = 'playful';
  
  return {
    primary,
    secondary,
    mood
  };
}

/**
 * Generates typography instructions based on art style and scene theme
 */
export function generateTypographyInstructions(artStyle: string, sceneDescription: string): string {
  const theme = analyzeSceneTheme(sceneDescription);
  
  // Determine if this is 3D animation or flat illustration
  const is3D = artStyle.toLowerCase().includes('3d') || 
              artStyle.toLowerCase().includes('animation') ||
              artStyle.toLowerCase().includes('dimensional');
  
  const isFlatIllustration = artStyle.toLowerCase().includes('flat') ||
                           artStyle.toLowerCase().includes('illustration') ||
                           artStyle.toLowerCase().includes('editorial');
  
  let typographyStyle: TypographyStyle;
  
  if (is3D) {
    // Use 3D animation typography styles
    typographyStyle = TYPOGRAPHY_3D_ANIMATION[theme.primary as keyof typeof TYPOGRAPHY_3D_ANIMATION] || 
                     TYPOGRAPHY_3D_ANIMATION.default;
  } else if (isFlatIllustration) {
    // Use flat illustration typography styles
    typographyStyle = TYPOGRAPHY_FLAT_ILLUSTRATION[theme.primary as keyof typeof TYPOGRAPHY_FLAT_ILLUSTRATION] || 
                     TYPOGRAPHY_FLAT_ILLUSTRATION.default;
  } else {
    // Fallback to modern style
    typographyStyle = {
      description: "Professional typography with clean, readable design",
      fontCharacteristics: "Balanced letterforms with appropriate proportions",
      treatment: "Clean presentation with appropriate styling for the artistic medium",
      examples: "Contemporary design standards"
    };
  }
  
  // Build scene-integrated typography instruction focused on artistic composition
  const instruction = `TYPOGRAPHY INTEGRATION: Analyze the scene "${sceneDescription}" and design typography that becomes an organic part of the artistic composition. ${typographyStyle.description}. The text should appear as if it naturally belongs in this specific scene - for example, if it's a fairytale forest, the text could appear carved into tree bark or formed by magical sparkles; if it's a beach scene, text could be written in sand or formed by waves; if it's a modern city, text could appear on billboards or neon signs. ${typographyStyle.fontCharacteristics}. ${typographyStyle.treatment}. CRITICAL: Make the typography feel like an integral environmental element of the scene rather than overlaid text - it should tell part of the story and enhance the narrative composition.`;
  
  return instruction;
}

/**
 * Enhanced version that includes debugging information
 */
export function generateTypographyWithDebug(artStyle: string, sceneDescription: string): {
  instruction: string;
  debug: {
    detectedTheme: SceneTheme;
    selectedStyle: TypographyStyle;
    artStyleCategory: string;
  };
} {
  const theme = analyzeSceneTheme(sceneDescription);
  
  const is3D = artStyle.toLowerCase().includes('3d') || 
              artStyle.toLowerCase().includes('animation') ||
              artStyle.toLowerCase().includes('dimensional');
  
  const isFlatIllustration = artStyle.toLowerCase().includes('flat') ||
                           artStyle.toLowerCase().includes('illustration') ||
                           artStyle.toLowerCase().includes('editorial');
  
  let typographyStyle: TypographyStyle;
  let artStyleCategory: string;
  
  if (is3D) {
    artStyleCategory = '3D Animation';
    typographyStyle = TYPOGRAPHY_3D_ANIMATION[theme.primary as keyof typeof TYPOGRAPHY_3D_ANIMATION] || 
                     TYPOGRAPHY_3D_ANIMATION.default;
  } else if (isFlatIllustration) {
    artStyleCategory = 'Flat Illustration';
    typographyStyle = TYPOGRAPHY_FLAT_ILLUSTRATION[theme.primary as keyof typeof TYPOGRAPHY_FLAT_ILLUSTRATION] || 
                     TYPOGRAPHY_FLAT_ILLUSTRATION.default;
  } else {
    artStyleCategory = 'Generic';
    typographyStyle = {
      description: "Professional typography with clean, readable design",
      fontCharacteristics: "Balanced letterforms with appropriate proportions",
      treatment: "Clean presentation with appropriate styling for the artistic medium",
      examples: "Contemporary design standards"
    };
  }
  
  const instruction = `TYPOGRAPHY INTEGRATION: Analyze the scene "${sceneDescription}" and design typography that becomes an organic part of the artistic composition. ${typographyStyle.description}. The text should appear as if it naturally belongs in this specific scene - for example, if it's a fairytale forest, the text could appear carved into tree bark or formed by magical sparkles; if it's a beach scene, text could be written in sand or formed by waves; if it's a modern city, text could appear on billboards or neon signs. ${typographyStyle.fontCharacteristics}. ${typographyStyle.treatment}. CRITICAL: Make the typography feel like an integral environmental element of the scene rather than overlaid text - it should tell part of the story and enhance the narrative composition.`;
  
  return {
    instruction,
    debug: {
      detectedTheme: theme,
      selectedStyle: typographyStyle,
      artStyleCategory
    }
  };
}