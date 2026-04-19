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

Scoped as **"Sprint 3.7 — Soul Pass"**, shipping after Sprint 3 Phase 6b (rate limit) lands and Sprint 3 merges to main.

Estimated scope: 4–8 hours of focused work. Commit plan:

1. **Copy rewrite** — all six step components + labels + headers. Static strings.
2. **Dynamic name-weaving** — tiny helper (`withName(template, state)`) used in step headers/subheaders.
3. **Micro-acknowledgments** — Framer Motion fade-up on step transition.
4. **AI-assist wiring** — "Brainstorm with AI" button live on Scene; "Let AI decide" on Style. (Brainstorm extraction may slip into Sprint 3.5 if the 1,227-line component needs more work.)
5. **Completion polish** — subtle animation on the completed state + better "what next" affordance.

Brand palette decision (separate track) is a prerequisite for the completion animation + any colour-specific tactics. Tone pass can land before palette is final.

---

## Open Questions

- **Voice of brand** — warm-friend-at-your-shoulder or poised-premium-concierge? Both can work; they imply different copy weights. TBD with first copy pass.
- **Emoji usage** — sparkle (✨) has brand equity from "Satisf-AI-ction Guarantee" positioning. Use it sparingly as a signature, or retire it?
- **"Let AI decide" fallback** — does it silently commit to animAIted, or does it ask Gemini to suggest a style from the scene? Simpler = silently commit; smarter = one extra API call but more magical feel.

---

*Add open questions + tactics freely as this direction matures. Kill sections when shipped.*
