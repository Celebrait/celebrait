# Celebrait product showcase

An editable 25-second portrait video (1080 × 1920, 30 fps), composed in Remotion.
Designed for viewing without sound; no music or voiceover is included.

## Story

- 0–5s: a real source photo, with the Northern Lights scene idea.
- 4.5–10.5s: a wipe reveals the actual birthday card made from that photo.
- 10–15s: Big Ben and Times Square examples.
- 14.5–19.5s: the site's printed-card image and product details.
- 19–25s: Celebrait closing message, website and honest delivery expectation.

The half-second overlaps are intentional crossfades. Each scene is a separate
file under `src/scenes`, with named editable text and artwork layers in Studio.

All artwork and fonts are copied from the existing site's public assets.
The Northern Lights source/result is the documented real pairing in
`client/src/pages/landing-keeper.tsx`. The printed-card scene uses the site's
existing `keeper-card-open.webp` marketing image. No customer data, generated
claims, testimonials or new product prompts are used. Prices are omitted so the
video does not freeze a changing price list; delivery copy follows the shared
pricing module's week-ahead guidance.

## Project isolation

This directory has its own dependencies and build. The live app does not import
it. Dependencies, preview bundles and exported videos are excluded from Git.
The selected composition is `CelebraitShowcase`; the standard project scripts
provide Studio, lint/type checks, and a production bundle. Ask Codex to start the
preview or export an MP4 when needed.
