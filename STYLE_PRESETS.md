# Celebrait Style Presets — Render Blocks

**Status:** Draft — test each in the Prompt Lab before shipping
**Date:** 2026-04-13
**Owner:** Aidan Chant

---

## How These Work

Each style has a **label** (what the user sees), a **thumbnail** (generated via the lab), and a **render block** (what the model receives instead of a vague style name).

The render block replaces `{{userArtStyle}}` in the front_scene template. When the user taps "Watercolour", the model doesn't receive the word "watercolour" — it receives 2-3 sentences of precise art direction.

The goal: **same style name → same visual output, every time, on every scene, on every provider.**

---

## Core 5 Styles

### 1. Watercolour

**Label:** Watercolour
**Icon:** 🎨
**Best for:** Birthdays, thank you, get well, mother's day, general warmth
**Mood:** Warm, handmade, artistic, personal

**Render block:**
```
Traditional watercolour painting on cold-pressed textured watercolour paper. Visible wet-on-wet bleeding where colours meet, soft diffused edges on all shapes, and pigment granulation visible in wash areas. The palette should be warm and slightly muted — think raw sienna, burnt umber, cerulean blue, and sap green with selective pops of saturated colour for focal points. White paper must be visible through transparent washes, especially in highlight areas and sky. Brushstroke texture and water marks visible throughout. The overall impression should be of a skilled human artist painting with real pigments on real paper — NOT a digital rendering with a watercolour filter applied. Edges should be imperfect and organic.
```

---

### 2. Cinematic

**Label:** Cinematic
**Icon:** 📸
**Best for:** Milestone birthdays, "wow" moments, travel scenes, aspirational cards
**Mood:** Dramatic, premium, photorealistic, "is this real?"

**Render block:**
```
Cinematic photorealistic style shot with professional film photography quality. Dramatic natural lighting with strong golden-hour warmth — rich amber highlights and cool blue-purple shadows creating depth. Shallow depth of field with the subject in sharp focus and background elements softly blurred into creamy bokeh. Film grain subtly visible throughout. Colour grading reminiscent of high-end cinema — slightly lifted blacks, warm midtones, and desaturated highlights. The composition should follow cinematic framing rules: rule of thirds, leading lines, and deliberate negative space. The overall impression should be a still frame from a beautifully shot film, not a phone snapshot.
```

---

### 3. Illustrated

**Label:** Illustrated
**Icon:** ✏️
**Best for:** Younger recipients, contemporary occasions, modern feel
**Mood:** Clean, modern, friendly, approachable

**Render block:**
```
Modern digital illustration with clean, confident line work and a contemporary colour palette. Flat colour areas with subtle gradients and soft ambient lighting. Slightly stylised proportions — not cartoon-exaggerated but gently idealised. Clean vector-like edges with occasional hand-drawn texture for warmth. The palette should be fresh and modern: muted pastels mixed with one or two bold accent colours. Subtle paper or canvas texture in the background. The overall impression should be of a professional illustrator's portfolio piece — polished, intentional, and contemporary. Think editorial illustration for a premium magazine, not clip art.
```

---

### 4. Classic Oil

**Label:** Classic
**Icon:** 🖼️
**Best for:** Older recipients, formal occasions, anniversaries, milestone events
**Mood:** Rich, timeless, premium, gallery-worthy

**Render block:**
```
Classical oil painting on stretched canvas with visible impasto brushwork — thick paint ridges catching light on highlights, smooth blended areas in shadows. Rich, saturated colour palette with deep jewel tones: burgundy, forest green, gold, navy, and warm ochre. Dramatic chiaroscuro lighting with strong directional light source creating bold highlights and deep shadows. Canvas weave texture subtly visible through thinner paint areas. The composition should feel balanced and deliberate, with a sense of gravitas. The overall impression should be of a painting that could hang in a gallery — timeless, accomplished, and unmistakably handcrafted with oil pigments on canvas.
```

---

### 5. Bold & Fun

**Label:** Bold & Fun
**Icon:** 💥
**Best for:** Kids' birthdays, joke cards, mates' cards, celebrations with energy
**Mood:** Loud, colourful, playful, maximum energy

**Render block:**
```
Vibrant, high-energy illustration with bold saturated colours and dynamic composition. Exaggerated, slightly cartoonish proportions — big smiles, expressive poses, larger-than-life energy. Bright primary and secondary colours dominating: electric blue, hot pink, sunshine yellow, lime green, and orange. Thick outlines with confident strokes. Background filled with energy — confetti, streamlines, stars, bursts, or graphic patterns. Slight retro pop-art influence with halftone dots or comic-book shading in places. The overall impression should be of pure celebration and fun — like a greeting card designed by someone who thinks every birthday deserves a party. Nothing subtle, nothing muted, nothing restrained.
```

---

## Gallery Styles (Phase 2 — add once core 5 are tested)

Draft names and directions. Each needs a full render block and lab testing before shipping.

| Style | Category | One-line direction |
|---|---|---|
| Lego | Fun & Themed | Everything built from Lego bricks — characters, scene, text integrated as Lego studs |
| Anime | Fun & Themed | Japanese anime style — large expressive eyes, dynamic action lines, vibrant palette |
| Pixel Art | Fun & Themed | 16-bit retro video game aesthetic — visible pixels, limited palette, nostalgic |
| Disney Magic | Fun & Themed | Animated fairy tale — soft lens glow, jewel-tone palette, magical sparkle particles |
| Comic Book | Fun & Themed | Bold ink outlines, halftone dots, speech bubbles, action panels, superhero energy |
| 90s Sitcom | Fun & Themed | Warm domestic lighting, laugh-track energy, VHS colour warmth, cozy interiors |
| Retro Poster | Artistic | Mid-century travel poster — flat bold shapes, limited palette, vintage typography |
| Pop Art | Artistic | Warhol-inspired — repeated bold shapes, primary colours, screen-print texture |
| Art Nouveau | Artistic | Mucha-inspired — flowing organic lines, floral frames, muted gold/green/rose palette |
| Stained Glass | Artistic | Cathedral window style — bold black leading lines, jewel-tone transparent colour fills |
| Impressionist | Artistic | Monet-inspired — visible dabs of colour, soft focus, light-dappled scenes |
| Pencil Sketch | Elegant | Graphite on cartridge paper — crosshatching, tonal shading, raw artistic feel |
| Gold Foil | Elegant | Luxurious — gold metallic accents on deep navy or black, elegant and premium |
| Minimalist | Elegant | Sparse, geometric, lots of whitespace, single accent colour, sophisticated restraint |
| Renaissance | Elegant | Old masters style — dramatic Caravaggio lighting, rich fabrics, classical composition |
| Neon Cyberpunk | Trending | Dark cityscape, neon pink/blue glow, rain-slicked streets, futuristic atmosphere |
| Vintage Film | Trending | Kodachrome colours, light leaks, vignetting, 1970s warmth, nostalgic imperfection |
| Ukiyo-e | Artistic | Japanese woodblock print — flat colour areas, wave patterns, cherry blossoms, traditional |

---

## Testing Protocol

For each style, run this standard test in the Prompt Lab:

1. **Scene:** "On a beach at sunset, holding a tropical cocktail, looking joyful"
2. **Card text:** "Happy Birthday Sarah"
3. **Photo:** Use the standard test photo (same one every time)
4. **Provider:** Gemini (primary) then OpenAI (comparison)
5. **Save the output** as the style's thumbnail preview

**Pass criteria:**
- The output is unmistakably the named style (watercolour looks like watercolour, not "photo with a filter")
- Text is legible
- The person is recognisable
- Running it 3 times produces visually consistent results (same style feel, even if scene details vary)

**If a style fails consistency:** tweak the render block wording and re-test. The Prompt Lab's version history tracks what you changed.

---

## Revision Log

| Date | Change | By |
|---|---|---|
| 2026-04-13 | Initial 5 core render blocks + 18 gallery style stubs | Claude (with Aidan) |

*Test each render block in the lab before promoting to production.*
