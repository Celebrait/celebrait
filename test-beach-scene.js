// Quick test of the beach pyjamas scene
import { generateTypographyWithDebug } from './shared/typography.js';

// Test the exact scene you mentioned
const sceneDescription = "chilling on the beach in his pyjamas";

console.log("=== Testing Beach Pyjamas Scene ===");
console.log("Scene:", sceneDescription);
console.log("");

// Test with 3D Animation
console.log("--- 3D Animation Style ---");
const result3D = generateTypographyWithDebug("3D animation", sceneDescription);
console.log("Detected Theme:", result3D.debug.detectedTheme);
console.log("Typography:", result3D.instruction);
console.log("");

// Test with Flat Illustration
console.log("--- Flat Illustration Style ---");
const resultFlat = generateTypographyWithDebug("modern flat illustration", sceneDescription);
console.log("Detected Theme:", resultFlat.debug.detectedTheme);
console.log("Typography:", resultFlat.instruction);