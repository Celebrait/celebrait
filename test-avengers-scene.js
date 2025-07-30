// Test the specific avengers San Francisco scene
import { generateTypographyWithDebug } from './shared/typography.ts';

// Test the exact scene from the logs
const sceneDescription = "Wine tasting in San Francisco with a group of friends, enjoying a view of the Golden Gate Bridge at sunset, dressed as the avengers";

console.log("=== Testing Avengers San Francisco Scene ===");
console.log("Scene:", sceneDescription);
console.log("");

// Test with modern flat illustration (which appears to be what was used)
console.log("--- Modern Flat Illustration Style ---");
const resultFlat = generateTypographyWithDebug("modern flat illustration", sceneDescription);
console.log("Detected Theme:", resultFlat.debug.detectedTheme);
console.log("Selected Typography Style:", resultFlat.debug.selectedStyle);
console.log("Art Style Category:", resultFlat.debug.artStyleCategory);
console.log("");
console.log("FULL TYPOGRAPHY INSTRUCTION:");
console.log(resultFlat.instruction);
console.log("");

// Also test with 3D animation for comparison
console.log("--- 3D Animation Style (for comparison) ---");
const result3D = generateTypographyWithDebug("3D animation", sceneDescription);
console.log("Detected Theme:", result3D.debug.detectedTheme);
console.log("Selected Typography Style:", result3D.debug.selectedStyle);
console.log("Art Style Category:", result3D.debug.artStyleCategory);
console.log("");
console.log("FULL TYPOGRAPHY INSTRUCTION:");
console.log(result3D.instruction);