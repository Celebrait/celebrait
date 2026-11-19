import { loadFont } from "@remotion/fonts";
import { preloadImage } from "@remotion/preload";
import { staticFile } from "remotion";

// Load the complete set at startup so scene cuts never wait on a new image.
for (const file of [
  "proof-source-photo.webp",
  "proof-card-front.webp",
  "proof-bigben-front.webp",
  "proof-timessquare-front.webp",
  "keeper-card-open.webp",
])
  preloadImage(staticFile(file));

// Remotion waits for these local fonts before rendering an export frame.
loadFont({
  family: "Fraunces",
  url: staticFile("fonts/fraunces-latin-standard-normal.woff2"),
  weight: "100 900",
});
loadFont({
  family: "Figtree",
  url: staticFile("fonts/figtree-latin-wght-normal.woff2"),
  weight: "300 900",
});
