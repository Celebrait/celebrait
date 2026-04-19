# Style example images

Drop curated example cards here. Filenames must match the style mode
enum values:

- `animated.jpg` — one representative animAIted card
- `realistic.jpg` — one representative reAIlistic card

The Style step in `/studio/card/:id/edit` pulls these via
`/style-examples/<mode>.jpg` (Vite serves everything in
`client/public/` at the web root). Missing files gracefully fall back
to an "Example coming soon" placeholder in the preview dialog — the
UX keeps working, you can add images whenever.

## Guidelines for the curated images

- Square (1:1), ~1024×1024 native; Vite handles caching.
- Generated through the production config you've activated in the
  Prompt Lab. Pick one that REPRESENTS the style at its best — this
  is marketing for the style, not a random sample.
- Diverse subjects — don't use the same face everywhere.
- Reasonable file size: aim <500 KB each. Optimise if needed.
