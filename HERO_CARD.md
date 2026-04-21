# Hero Card Pattern

The card is the hero. It breaks containers. It renders above chrome. You can pick it up before you buy it.

---

## Thesis

A greeting card is an *object*, not a template. Every competitor treats it as a flat graphic in a grid — we treat it as a physical thing you can rotate, open, zoom, and inspect. The signature of Celebrait's UI is that **wherever you're looking at a specific card, the card overrides the page**: it escapes its bounding container, passes over headers and buttons when zoomed, and the surrounding UI defers to it.

The inconsistency between "product surfaces" (card-as-hero) and "information surfaces" (clean typographic) *is* the brand language. Halfway is worse than either extreme.

## Where to use it

**Yes:**
- Landing hero (the card is the first thing you see, interactive on page load once engaged)
- Gallery / examples sections (each showcase card is a live mini-viewer)
- Studio review step (confirming before purchase — sender plays with their own card)
- Public recipient viewer (the core delivery moment)
- Any future "pick a card" / template-selection surface

**No:**
- Marketing copy, FAQ, pricing explanations, about
- Checkout (transactional, needs focus)
- Account / support / settings
- Onboarding forms

If a surface needs the user to *read and reason*, it's an information surface — clean typographic layout, no floating cards. If a surface is about *the card itself*, it's a product surface — Hero Card pattern applies.

## Rules

**Must:**
1. **Canvas bleeds past the stage container** on all sides so rotation/zoom never clips against an edge.
2. **The card renders above the header's z-index** (canvas `z-25`, header `z-20` in our current tokens). Card overlap with header is the visible depth cue.
3. **UI elements fade or remain explicitly pinned** during active card interaction (we choose per surface). Gesture hints fade; primary CTAs stay pinned when interaction would otherwise block them.
4. **Gesture hints retire after first interaction.** One-shot. Once someone has touched the card, they've found the controls.
5. **Canvas extends symmetrically.** Card stays centred in the stage at default; bleed serves rotation/zoom, not initial framing.
6. **Minimum-distance zoom clamp prevents overflow.** User can zoom in enough to read fine print, but not enough that the card clips its canvas at max zoom + max tilt.
7. **The ContactShadow below the card grounds it.** Always on. Combined with CSS drop-shadow for page-level depth.

**Must not:**
1. **Never render card geometry over body copy.** Chrome (headers, buttons) is fair game. Paragraph text the user needs to parse is not.
2. **Never make header links unclickable as a silent side effect.** If the card's z-index covers a nav element, ensure the route is still reachable from another surface (e.g. acquisition panel, direct URL).
3. **Never auto-open the card on page load** unless the user has explicitly gestured to open it (e.g. envelope tap on welcome gate).
4. **Never load the full Three.js stack on marketing/info pages** without progressive enhancement.

## Technical notes

**Core component:** `client/src/components/card-3d-viewer.tsx` — `<Card3DViewer />`. Accepts `open` + `onOpenChange` for controlled hinge state.

**Reference implementations:**
- `client/src/pages/card-viewer.tsx` — public recipient viewer, full Hero Card treatment.
- `client/src/components/studio/steps/review-step.tsx` — Studio Review (inside a step panel; bleed passes through panel boundaries since no `overflow-hidden`).

**Stack:**
- `@react-three/fiber` + `@react-three/drei` + `three` (pinned versions)
- `framer-motion` for UI transitions around the canvas
- `lottie-react` for any 2D supporting animations (e.g. welcome-gate envelope)

**Canvas bleed defaults** (public viewer):
```
top: -25vh, bottom: -25vh, left: -22vw, right: -22vw
margin factor: 2.0x CARD_W (via InitialCameraFit)
minDistance: 2.7 (prevents zoom-in overflow)
```

**Z-index tokens:**
- Welcome gate: 40
- Share dialog / modals: 50 (Radix default)
- UI layer (buttons, panel, hints): 30
- Canvas (card): 25
- Header: 20

## Progressive enhancement

**Marketing / landing:**
- First paint serves a static poster image (PNG export of frame 1 rendered server-side, or pre-computed).
- On interaction / scroll into view, swap to the live Three.js scene. `IntersectionObserver` gates it.
- On low-end devices (`navigator.hardwareConcurrency <= 4` && `navigator.deviceMemory <= 4`), stay on the static poster + a subtle CSS parallax. Don't ship 150KB of Three to a 2GB Android.

**Reduced motion:**
- `prefers-reduced-motion: reduce` → static poster, no auto-drift, no idle breathing, no floating. User can still interact if they initiate, but nothing moves on its own.

**Accessibility:**
- Arrow keys rotate the card in `revealed` state (clamped to the same polar/azimuthal range as the mouse orbit).
- `aria-live="polite"` announcements for state transitions ("Card opened"). 
- Keyboard-skip to `revealed` state for users who don't want to play the arrival animation.

## What we've committed to

- Public recipient viewer: landing → envelope → card, full Hero Card treatment. Ships as of 2026-04-21.
- Studio Review step: Hero Card treatment inside the step panel. Single Buy CTA pinned.
- Welcome gate: Lottie envelope with flap-opening animation on tap, white-flash reveal of the Hero Card viewer behind.

## What's parked

- **Full CelebrationCard rebuild** per `celebrait-card-brief.md` (envelope + seal + state machine + audio). Sprint 5+ work. Faithful build lands ~8.5/10; 10/10 needs a designer + sound designer. Current viewer is the interim.
- **Landing page Hero Card** — not yet built. When we tackle it, follow the progressive-enhancement rules above. Static poster first paint, interactive swap on viewport intersection.

---

*Last updated 2026-04-21. If you're reading this months from now and the card has stopped overriding the page anywhere, something has drifted. Bring it back.*
