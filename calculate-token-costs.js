// Calculate exact token costs for the soccer basement test
import { encode } from 'gpt-tokenizer';

// Your exact scene and text from the logs
const scenePrompt = "Watching soccer in a basement in Mexico, sometime in the 90s, there's a retro feel to this scene, the guys are having so much fun, dressed as cowboys";
const cardText = "HBD 2 YA!";
const style = "animated_movie_style";
const peopleCount = 2;
const size = "1024x1024";

// Reconstruct the EXACT prompt that was sent based on server code
const characterText = peopleCount > 1 ? 'characters from the reference images' : 'the character from the reference image';
const aspectDescription = size === '1024x1536' 
  ? 'MANDATORY: Create a PORTRAIT composition with 2:3 aspect ratio (height is 1.5x the width). Full bleed portrait design with no borders, fill entire portrait frame.'
  : 'MANDATORY: Create a perfectly SQUARE composition with equal width and height - NOT portrait, NOT landscape. Full bleed square design with no borders, fill entire square frame.';
const formatInstruction = size === '1024x1536' 
  ? '8) COMPOSE FOR PORTRAIT FORMAT - ensure all elements fit within a portrait boundary'
  : '8) COMPOSE FOR SQUARE FORMAT - ensure all elements fit within a square boundary';

const faceAnalysisText = peopleCount > 1 ? 'ANALYZE EACH FACE IN DETAIL' : 'ANALYZE THE FACE IN DETAIL';
const faceRecreationText = peopleCount > 1 ? 'RECREATE EACH IDENTICAL FACE' : 'RECREATE THE IDENTICAL FACE';
const characterPositioning = peopleCount > 1 ? 'Place the characters' : 'Place the character';
const characterPoses = peopleCount > 1 ? 'Give the characters' : 'Give the character';
const clothingInstruction = peopleCount > 1 ? 'dress the characters appropriately' : 'dress the character appropriately';
const positioningInstruction = peopleCount > 1 ? 'Reimagine character positioning and interactions' : 'Reimagine character positioning';

let fullPrompt = `${aspectDescription} ABSOLUTE PRIORITY: FACIAL ACCURACY FIRST - Before applying any artistic style, the EXACT facial likeness must be preserved with photographic precision. 

MANDATORY FACIAL RECREATION REQUIREMENTS (COMPLETE BEFORE ANY STYLING):
1) FACIAL STRUCTURE MATCH: Recreate the EXACT facial bone structure - same cheekbone height, same jawline angle, same forehead shape, same chin projection
2) EYE PRECISION: Match exact eye shape (almond, round, hooded), eye spacing, eyelid fold pattern, iris color, eyebrow shape and arch
3) NOSE ACCURACY: Replicate precise nose bridge width, nostril shape, nose tip definition, any bumps or unique nose characteristics  
4) MOUTH DUPLICATION: Copy exact lip fullness, mouth width, corner shape, any asymmetries or distinctive mouth features
5) SKIN MATCHING: Preserve exact skin tone, texture, any blemishes, freckles, moles, or distinctive skin characteristics
6) HAIR PRECISION: Match exact hair color, texture, natural growth patterns, hairline shape
7) DISTINCTIVE MARKS: Include any scars, dimples, laugh lines, or other identifying facial features
8) CRITICAL EXPRESSION CHANGE: DO NOT copy the original facial expression from the reference photo. You must create a COMPLETELY NEW facial expression that matches the mood and energy of the new scene

AFTER ESTABLISHING PERFECT LIKENESS - SCENE CREATION:
Create a completely new scene featuring ${characterText}. CRITICAL: Generate EXACTLY ${peopleCount} ${peopleCount === 1 ? 'person' : 'people'} - NO MORE, NO LESS.

COMPOSITION RULES - DO NOT COPY REFERENCE PHOTO:
- If reference photo is a headshot/upper body, create a FULL BODY or WIDE scene shot
- If reference photo is close-up, create a MID-SHOT or ENVIRONMENTAL shot  
- Show the character actively participating in the scene, not just posing
- Include relevant background elements that tell the story of the scene
9) SCENE-APPROPRIATE EXPRESSION: The character must display a brand NEW facial expression that perfectly captures the energy and mood of this specific scene: "${scenePrompt}". If it's a party scene, show excitement and joy. If it's relaxing, show contentment. If it's adventurous, show confidence and thrill. NEVER use the original photo's expression
10) COMPLETELY IGNORE ORIGINAL PHOTO COMPOSITION: Do NOT copy the positioning, framing, or body placement from the reference photo. The reference is ONLY for facial features.
11) CREATE ENTIRELY NEW SCENE COMPOSITION for: ${scenePrompt}
12) CREATIVE POSITIONING REQUIRED: ${characterPositioning} in completely different positions that showcase the full scene context. If it's a yacht scene, show the character on deck with ocean background. If it's a party, show them dancing or celebrating. Use full-body or three-quarter shots that tell the story of the scene.
13) DYNAMIC POSES AND INTERACTIONS: ${characterPoses} completely new poses that are appropriate for the scene activity and energy level
14) SCENE-APPROPRIATE CLOTHING: CHANGE the clothing completely to fit the new scene - ${clothingInstruction} for the scenario while maintaining identical faces only
15) ENVIRONMENTAL INTEGRATION: ${positioningInstruction} for the new environment to create an immersive scene composition
${formatInstruction}`;

// Add enhanced style for animated movie style
const enhancedStyle = `professional 3D animated movie style with EXACT FACIAL ACCURACY as absolute priority, maintain photographic facial likeness while applying high-quality computer animation aesthetic. CRITICAL: Preserve precise facial bone structure and anatomy during animation style conversion. Apply clean digital rendering with soft edges and polished surfaces only AFTER establishing perfect facial recreation. Professional animation studio quality with realistic proportions but NEVER compromise facial recognition for stylistic choices. TYPOGRAPHY INTEGRATION: Naturally integrate text into the scene as part of the artistic composition - text should appear carved into surfaces, written in natural elements, displayed on signs, or formed by scene elements, ensuring clear legibility while feeling like an organic part of the scene rather than overlaid text.`;

fullPrompt = `${fullPrompt}. FINAL STEP - ARTISTIC STYLING: Once the exact facial likeness is established, THEN apply the following artistic style while maintaining all facial accuracy: ${enhancedStyle} art style`;

fullPrompt = `${fullPrompt}. Add EXACTLY the text "${cardText}" and NO OTHER TEXT. Use typography that matches the ${style || 'artistic'} style and complements the overall vibe of the image. The text should be prominently displayed and well-integrated into the design.`;

fullPrompt = `${fullPrompt}. High-quality artistic rendering, professional artwork.`;

console.log("=== EXACT PROMPT ANALYSIS FOR SOCCER BASEMENT TEST ===");
console.log("");
console.log("Scene:", scenePrompt);
console.log("Text:", cardText);
console.log("Style:", style);
console.log("People Count:", peopleCount);
console.log("Size:", size);
console.log("");

// Calculate tokens
const tokens = encode(fullPrompt);
const tokenCount = tokens.length;

console.log("=== TOKEN ANALYSIS ===");
console.log("Total Prompt Tokens:", tokenCount);
console.log("Prompt Character Count:", fullPrompt.length);
console.log("");

// OpenAI GPT-Image-1 Pricing Analysis
console.log("=== OPENAI GPT-IMAGE-1 PRICING BREAKDOWN ===");
console.log("");

// Current OpenAI pricing (as of 2024)
const standardCost = 0.020; // $0.020 per image for standard quality
const highQualityCost = 0.040; // $0.040 per image for high quality
const editsCost = 0.020; // Base cost for edits API
const highQualityMultiplier = 2; // High quality costs roughly 2x

console.log("Standard Quality (1024x1024):", `$${standardCost.toFixed(3)}`);
console.log("High Quality (1024x1024):", `$${highQualityCost.toFixed(3)}`);
console.log("");

console.log("YOUR TEST CONFIGURATION:");
console.log("- Model: gpt-image-1");
console.log("- Quality: high");
console.log("- Size: 1024x1024 (square)");
console.log("- Method: Image edits (image-to-image)");
console.log("- Processing Time: 64 seconds (complex scene)");
console.log("");

// Calculate potential costs
const baseCost = editsCost;
const qualityMultiplierCost = baseCost * highQualityMultiplier;
const complexSceneMultiplier = 1.5; // Complex scenes may cost more
const multiPersonMultiplier = 1.2; // Multi-person scenes may cost more

const estimatedCost = qualityMultiplierCost * complexSceneMultiplier * multiPersonMultiplier;

console.log("=== COST BREAKDOWN ANALYSIS ===");
console.log("Base Image Edit Cost:", `$${baseCost.toFixed(3)}`);
console.log("High Quality Multiplier (2x):", `$${qualityMultiplierCost.toFixed(3)}`);
console.log("Complex Scene Multiplier (1.5x):", `$${(qualityMultiplierCost * complexSceneMultiplier).toFixed(3)}`);
console.log("Multi-Person Multiplier (1.2x):", `$${estimatedCost.toFixed(3)}`);
console.log("");
console.log("ESTIMATED TOTAL COST:", `$${estimatedCost.toFixed(3)}`);
console.log("YOUR ACTUAL COST:", "$0.25");
console.log("");

console.log("=== COST OPTIMIZATION RECOMMENDATIONS ===");
console.log("1. Quality Setting: Change 'high' to 'standard' = ~50% cost reduction");
console.log("2. Simpler Prompts: Reduce complexity = ~25% cost reduction");
console.log("3. Single Person Scenes: Avoid multi-person = ~15% cost reduction");
console.log("");

console.log("=== COMPLETE PROMPT SENT TO OPENAI ===");
console.log(fullPrompt);
console.log("");
console.log("=== PROMPT STATISTICS ===");
console.log("Character Count:", fullPrompt.length);
console.log("Word Count:", fullPrompt.split(' ').length);
console.log("Token Count:", tokenCount);