# Studio Tone & Voice — The Soul Pass

**Status:** Locked direction for the Studio card maker's copy + micro-UX layer
**Date:** 2026-04-18
**Owner:** Aidan Chant
**Cross-reference:** Evolves the "card maker UX" component of [UX_STUDIO_DIRECTION.md](./UX_STUDIO_DIRECTION.md). The two-layer studio model in that doc still holds; what changes is the *shape* of Layer 2 (the card maker itself).

---

## The Decision

The card maker stays a **dashboard-style stepper** — the structure built in Sprint 3 (Recipient → Photo → Scene → Style → Inside → Review). What Sprint 3 missed is the *soul*. That soul is added as a deliberate **copy + micro-interaction layer** on top of the existing structure. Not a rebuild. Not a rollback to the conversational wizard.

The old Replit-era conversational flow had warmth the current dashboard lacks. But going full-conversational has real downsides that don't show up until you live with the product. We cherry-pick what made the old flow feel personal — and skip what made it feel like a ChatGPT wrapper.

---

## Why Not Go Back to the Old Conversational Flow

Honest audit of the old Replit build, so we don't nostalgia-trap ourselves:

1. **Enthusiasm fatigue.** "Greetings ✨ / Perfect! ✨ / Great! ✨ / Great scene! ✨" — every step celebrates. Charming once, cloying by step 4. Reads as an eager AI assistant, not a brand with poise.
2. **Brand positioning risk.** Robot mascot + gradient buttons + chat-card layout quietly communicates "AI tool" rather than "premium gift worth buying." Moonpig, Paperless Post, Papier — none have a mascot. Celebrait is a premium emotional product.
3. **Repeat-customer friction.** Cool the first time, tedious the third. LTV model assumes recurring occasions (birthdays, anniversaries every year). One-question-per-screen + mandatory enthusiasm doesn't age well.
4. **Doesn't scale.** Adding features (fonts, layouts, stickers) stretches the conversation. Dashboard accommodates more controls without becoming a slog.
5. **AI-hype copy over-promises.** "I'll intelligently choose the *perfect* style" — if the output doesn't wow, the user blames you for over-selling.
6. **Opaque progress.** Robot's circular progress ring shows vague progress, not "step 2 of 6." Users don't know how long this takes.
7. **Hard to edit.** "Go Back a Step" only — no jump-to-step. On step 6, fixing a typo in step 1 means back-back-back-back-back.
8. **Desktop inefficiency.** One-question-per-screen wastes screen real estate on desktop.

---

## Cherry-Pick: What to Keep vs Skip

### Keep from the old flow

- **Dynamic name-weaving.** Once the user enters the recipient's name, reuse it. "Where does *Mum's* story take us?" on the Scene step. "How should *Mum's* card look?" on the Style step. "*Mum's* inside message" on Inside. This is the single biggest emotional multiplier and it's essentially free — a string interpolation.
- **Warmer microcopy.** "Who's this card for?" instead of `<Label>Recipient name</Label>`. "What's the celebration?" instead of "Occasion." Human language throughout.
- **AI-assist affordances surfaced inline.** "Brainstorm with AI" on Scene (wire up the existing 1,227-line brainstorm component — Sprint 3.5+). "Let AI decide" on Style (picks animAIted silently + advances). Customers who don't know what they want get a helping hand without leaving the step.
- **Micro-acknowledgment moments.** A subtle fade-in of the next step's header when advancing — like the old "Perfect!" feeling, but without the word. Animation, not declaration.

### Skip from the old flow

- **No robot mascot.** Positioning goal is premium, not AI-assistant.
- **No "I / me" AI-as-character voice.** "I'll intelligently choose…" becomes "We'll pick a style that matches." The brand speaks, not a personified AI.
- **No per-step "Perfect! ✨" / "Great! ✨" openings.** The structural stepper is the acknowledgment. Over-celebration becomes noise.
- **No one-question-per-screen chat-card layout.** The dashboard stepper is better for mobile, desktop, editability, and scale.
- **Sparingly on emoji.** ✨ can appear at key brand moments (landing page, completion screen), not every step.

---

## Concrete Tactics

### 1. Copy rewrite pass (every step)

Target tone: warm, confident, brand-as-friend. Not clinical, not chat-bot.

Examples of the shift:

| Current | Soul-pass rewrite |
|---|---|
| "Recipient name" | "Who's this card for?" |
| "Occasion" | "What's the celebration?" |
| "Upload photo" | "Show us {name} — group or solo" |
| "Scene description" | "Where does {name}'s story take us?" |
| "Style" | "How should {name}'s card look?" |
| "Inside message" | "What should be inside?" |
| Review step header | "{Name}'s card is ready to make ✨" |

Use the recipient's name dynamically from step 2 onward. Fall back to "the card" if no name yet.

### 2. Micro-acknowledgment on step transitions

A brief fade-up of the step's header text when the step mounts. Framer Motion, ~200ms. Carries the "something just advanced" feeling the old flow's "Perfect!" gave, without the verbal theatre.

### 3. Surface AI assistance properly

- **Scene step:** "Brainstorm with AI" button active (today it's a stubbed "coming soon" tooltip). Opens the extracted brainstorm chat in a drawer/modal. Wire via the `useBrainstormChat` hook (planned Sprint 3.5).
- **Style step:** a third path at the top of the card grid: "Let the AI decide" (or "Surprise me") — picks animAIted silently and advances. Reduces friction for the "I don't know what I want" user.
- **Inside step:** later, could offer "AI help me write something" as a third tertiary path under Write Your Own. Not Sprint 3.

### 4. Header presence — not a mascot

Instead of a robot avatar, the Studio header gets a small recognisable element that's *not* a character. Options to test: a subtle ✨ glyph, a small brand wordmark, a gradient dot. Conveys personality without "AI-tool-ness."

### 5. Completion feels like a moment

Review step's success state (`status === 'completed'`) already shows the front + inside images. Layer on: confetti/sparkle animation on the first render, a "Your card is ready ✨" header that feels earned, and a clear "What's next?" (download, order print, share digital).

---

## What This Is Not

- Not a mascot integration.
- Not emoji-on-every-step.
- Not an AI personality with a name.
- Not one-question-per-screen.
- Not a rebuild. Existing Sprint 3 components stay.

---

## Proposed Delivery

Originally scoped as a single Sprint 3.7. After Kevin's shakedown walk of the shipped Studio (2026-04-19), the feedback expanded beyond tone — structural UX changes and real bugs surfaced. Splitting into **3.7a (visual lift + quick wins)** and **3.7b (structural + wiring)** so 3.7a can land fast and 3.7b doesn't get delayed by not-yet-final decisions.

### Sprint 3.7a — Visual lift + quick wins (~half day)

1. **Palette expansion** — add accent tokens (coral, amber, cream, deep ink) alongside the provisional brand + CTA. Semantic usage rules locked before any sprinkling (coral = emotion, amber = celebration, cream = warm surface, ink = premium heading).
2. **Occasions as button cards, not dropdown** — 4-6 primary occasion tiles (Birthday / Anniversary / Graduation / Wedding / Sympathy / Other...), "type your own" fallback for custom. Mirrors the MVP pattern.
3. **Placeholder typing animation on Scene textarea** — replaces the rotating-string placeholder. `aria-live="off"` so screen readers don't spam.
4. **New-card loading animation** — brand-moment dress-up for the draft creation wait. Only when there's a real wait (Neon cold-start); fast path stays invisible so we don't artificially slow things down.
5. **My Cards grid polish** — fix the Ready-badge-with-no-preview bug (status/preview mismatch), better empty state treatment, warmer framing.

### Sprint 3.7b — Structural changes + wiring (~1–2 days)

6. **Copy rewrite pass** — all six step components, warmer tone, dynamic name-weaving from step 2 onward (helper `withName(template, state)`).
7. **Micro-acknowledgment transitions** — Framer Motion fade-up between steps. No "Perfect!" words; animation carries the feeling.
8. **Brainstorm chat wiring** — extract the 1,227-line MVP component to `useBrainstormChat` hook, wire into Scene step (drawer/modal). Output flows back into the Scene textarea (one canonical input). See `memory/next_brainstorm_chat_wiring.md`.
9. **Kill the Scene ideas drawer** — single "stuck? here's help" path via brainstorm chat only. No inline preset chips (decided 2026-04-19 — tradeoffs were a wash, one path is cleaner).
10. **"Let AI decide" on Style step** — picks animAIted silently + advances. Reduces friction for the "I don't know what I want" user.
11. **Photo step: Solo vs Group mode toggle + multi-photo upload** — real structural fix. See the Photo Step section below.
12. **Auto-face-crop hybrid** — client-side face detection pre-fills the crop box; user adjusts if needed. Crop tool stays but is invisible for the 90% happy path. Library TBD (probably `face-api.js` or similar — vision API is overkill and adds cost per upload).
13. **Photo copy rewrite** — "Show us {name}" header, progressive disclosure for multi-upload ("+ Add another — more angles = better likeness"), no big "Important" warning box.
14. **Review step completion polish** — subtle sparkle/confetti on the rendered state, clearer "what next" (download, order print, share).

### Photo Step: Solo vs Group mode toggle

Uncovered during the shakedown — group shots and multi-angle uploads are currently **not mapped correctly** in the Studio. The Prompt Lab's semantics:

- `one_person` + N photos = same person at N angles (multi-reference identity anchor)
- `group` + 1 photo = one photo containing multiple people

The Studio currently:

- Accepts only 1 photo (PhotoStep header comment: "One photo per card for v1 — multi-reference is a later polish pass").
- Derives `photoMode` as `orderedPhotos.length > 1 ? 'group' : 'one_person'` in `background-generator.ts:329` — **semantically inverted** relative to the Prompt Lab. Latent bug today (length always = 1) but active bug the moment multi-upload ships.
- No UI signal for "this is a group shot" — users uploading a group photo of Mum + her sisters today get `'one_person'` mode and the template will render only Mum.

Fix (in 3.7b):

- PhotoStep gains a two-mode toggle at the top: **Solo** (default) or **Group**.
- Solo mode: can upload 1-N photos of the same person; all flow to the generator as multi-reference.
- Group mode: exactly one photo, clamps to 1 (matches the Prompt Lab's clamp logic in `admin-prompts.tsx:1234`).
- `photoMode` in the generator comes from the toggle, not derived from count. Remove the inverted derivation.
- `CardDraftState.photos` may need a `mode: 'solo' | 'group'` field alongside `photoIds[]` for persistence.

Brand palette decision (separate track) is a prerequisite for the completion animation + any colour-specific tactics. Tone pass can land before palette is final.

---

## Colour usage rules (locked 2026-04-19)

Learned the hard way after a few feedback rounds where violet text felt
"random." These are the rules; don't break them without a new brief.

**Ticks + selection indicators:**
- Within-step selection (picked an occasion / style / inside mode) →
  **brand violet** tick.
- Progression / "go" moments (completed stepper step, Generate button,
  "card ready" success) → **cta green**.
- Don't mix. Green on every selection tick dilutes the "confirmed /
  go" signal.

**Text colours:**
- `text-ink` — all titles, headings, and selected-state labels.
  Always. Selection doesn't flip title colour (the border + tick
  already communicate that). Never use `text-brand-dark` on a
  heading — that's a link colour.
- `text-brand` (hover: `text-brand-dark`) — **only** interactive text
  links (Edit, Change photo, More occasions, Actually I'll write a
  message, etc.). Consistent signal = "tap this."
- `text-stone-500` / `text-stone-600` — secondary / helper copy.
- `text-cta-hover` — only on completed-stepper step label (progression).
- `text-accent-coral-dark` — tiny uppercase section labels ("Need a
  spark?" "Your custom style"). Decorative badge text, nothing larger.
- `text-accent-amber-dark` — only paired with amber-light backgrounds
  (the warning/"too vague" examples in the custom style modal).

**Violet (`brand`) usage beyond ticks and links:**
- Selected-state borders + rings (`border-brand`, `ring-brand/20`).
- Primary-action button backgrounds (`bg-brand`, `hover:bg-brand-dark`).
- The New Card tile default state (brand surface; flips to cta on hover).
- Nothing else. If violet wants to appear somewhere, it's either a
  selection indicator, a link, or a primary-action button.

**Green (`cta`) usage beyond ticks and Generate:**
- Completed stepper steps + their connector lines.
- "Ready" status badge on completed cards in My Cards grid.
- New Card tile hover state.
- Nothing else.

**Icon tile backgrounds (codified 2026-04-19):**
There are two icon-tile patterns in the Studio. The split is semantic,
not decorative — keep them separate.

- **Interactive picker tiles** (occasion buttons on Recipient, the
  "Describe your own style" button on Style, and any future "pick one
  of N" tappable icons) → unselected = `bg-accent-coral-light
  text-accent-coral-dark`, selected flips to `bg-brand
  text-brand-foreground`. Coral says "pick me"; the flip to violet is
  the same "selected = brand" signal as every other selection tick.
- **Non-interactive anchor tiles** (the MessageSquare on the Inside
  "Write your own" pill *if it still exists*, Review summary-row
  leading tiles) → `bg-brand-muted text-brand`. Quiet violet, doesn't
  compete with interactive elements, reads as "context marker."
- **Stroke weight** stays `1.75` on lucide icons throughout so glyphs
  read at the same visual density across steps.

Don't mix the two patterns within a single step — a coral pill next
to a violet pill inside the same panel reads as accidental, not
intentional.

## Open Questions

- **Voice of brand** — warm-friend-at-your-shoulder or poised-premium-concierge? Both can work; they imply different copy weights. TBD with first copy pass.
- **Emoji usage** — sparkle (✨) has brand equity from "Satisf-AI-ction Guarantee" positioning. Use it sparingly as a signature, or retire it?
- **"Let AI decide" fallback** — does it silently commit to animAIted, or does it ask Gemini to suggest a style from the scene? Simpler = silently commit; smarter = one extra API call but more magical feel.

---

*Add open questions + tactics freely as this direction matures. Kill sections when shipped.*
