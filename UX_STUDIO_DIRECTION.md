# Celebrait UX Direction — The Studio Model

**Status:** Locked direction for future UX overhaul
**Date:** 2026-04-12
**Owner:** Aidan Chant
**Prerequisite:** Complete Prompt Lab Phases 2–4 + define brand palette before building this.

---

## The Core Insight

The current customer flow is good at the *first card*. It's terrible at the *second card, the third card, and the relationship in between.*

The conversational wizard works for first-time visitors — it's warm, guides without overwhelming, and produces a card with minimal friction. **Keep it.** But the moment someone finishes their first card, they hit a dead end: no workspace to return to, no saved state, no reason to come back, no feeling of membership. It's a vending machine, not a studio.

The fix isn't "make everything a dashboard." It's: **wrap the conversational warmth inside a persistent workspace that makes users feel like members, not visitors.**

---

## The Two-Layer Model

### Layer 1 — The Studio (persistent, always there)

What a logged-in user sees as their home. This is the "platform" feel.

Contains:
- **My Cards** — gallery of cards in various states (draft, generated, purchased, shipped). Click any card to re-enter, edit, regenerate, or purchase.
- **My Photos** — uploaded once, reusable across multiple cards. "Use the same photo of Mum for her birthday and Mother's Day."
- **Credits / balance** — visible in the header. Each generation costs N credits. Top-up or subscription to refill.
- **New Card** button — launches the conversational card maker (Layer 2).
- **Account settings** — name, email, addresses, order history, subscription status.
- **Empty state for first-time users** — welcoming, shows example cards, guides them to "New Card."

This is the thing that makes Celebrait feel like a product you *belong to*, not a page you *pass through*.

Reference energy: Canva's home dashboard. Not Jira. Not a spreadsheet. Clean, visual, warm — but clearly a workspace with state.

### Layer 2 — The Card Maker (conversational, per-card)

The guided conversation flow that already exists. Warm, personal, step-by-step. **Keep the conversational UX — it works.**

Key change: it runs *inside* the studio context, not as a standalone page. When it finishes, you land back in the studio with your new card sitting in "My Cards," editable and purchasable. Not on a dead-end "here's your card, now what?" page.

The conversation is a **feature of the studio**, not the product itself. Right now the conversation IS the product. In the new model, the studio is the product and the conversation is one tool inside it.

---

## What the Studio Unlocks

These features become natural once the persistent layer exists:

| Feature | Why it matters | Blocked without studio? |
|---|---|---|
| **Regeneration** | Click a card, tweak the scene, hit regenerate. No starting over. | Yes — currently no way to re-enter a card |
| **Token/credit system** | Balance in header, each gen costs N credits, subscription refills | Yes — nowhere to show balance or gate usage |
| **Intermittent work** | Cards have states (draft → generated → purchased). Close browser, come back tomorrow. | Yes — state dies with the session |
| **Photo library** | Upload once, reuse across cards. Saves re-upload friction. | Yes — photos are per-session only |
| **Subscription/membership** | Monthly plan = N credits + free delivery + saved photos. Studio is where you *feel* the membership. | Yes — no persistent identity = no membership feel |
| **Premium positioning** | A studio with your name, your cards, your history feels like a product you pay for. A wizard feels like a free demo. | Yes |
| **Gift reminders** | "Mum's birthday is in 3 weeks — start a card?" | Yes — no persistent user context |

---

## Structural Principles (Borrowed from Admin Panel)

The admin panel (`/admin/prompts`) accidentally became the design language reference for this overhaul. The specific principles to carry over:

1. **Persistent navigation** — sidebar or top nav that always shows where you are (My Cards / New Card / Photos / Account). No mystery about "where am I."
2. **State that survives** — everything persists. Cards, photos, preferences, history. Nothing is lost on page refresh.
3. **Actions in context** — regenerate/edit/buy buttons right next to the card they act on. Not behind a menu, not on a separate page.
4. **Inputs next to outputs** — when making a card, the controls (scene, style, photo) should be visually adjacent to the preview. Same pattern as the Prompt Lab test panel.
5. **Density where it helps, space where it breathes** — the card gallery can be compact. The card maker should have room to breathe. Match density to task.

**What NOT to carry over from the admin panel:**
- Clinical/sterile aesthetic — customers need warmth
- Monospace fonts and technical labels — customers need friendly language
- Zero decorative elements — a studio can have personality
- Dark sidebar — save that for the back office

---

## The Card Lifecycle (State Machine)

Define before building. Proposed states:

```
[new] → [drafting] → [generated] → [purchased] → [fulfilled] → [shipped]
                  ↑         |
                  |    [regenerating]
                  └─────────┘
```

- **new** — card created, user hasn't started filling in details yet
- **drafting** — user is in the conversation flow, filling in occasion/scene/photo
- **generated** — front (and optionally inside) images exist. Viewable, shareable as digital, purchasable for print.
- **regenerating** — user tweaked something and hit regenerate. Previous version preserved.
- **purchased** — payment complete, enters print queue
- **fulfilled** — sent to print supplier
- **shipped** — tracking number assigned, card is in the post

Key questions to answer before building:
- Can you regenerate after purchase? (Probably no — print is already queued.)
- Can you edit the inside text after seeing the generated image? (Should be yes.)
- Is there a "digital only" state where the card is free to download but not printed?
- How many regenerations are included per card / per credit?

---

## Business Model Decision (Choose Before Building)

The studio UX is shaped by which model you pick. Don't build the studio without deciding.

### Option A — Pay per card (simplest)
- No credits, no subscription
- Each printed card costs R129 (or whatever pricing)
- Generation is free, printing is the paywall
- Studio just shows cards and lets you buy
- **Pro:** simplest to build. **Con:** no recurring revenue, no membership feel.

### Option B — Credit system
- Buy credits (e.g. 5 credits for R299)
- Each generation costs 1 credit, printing costs additional
- Credits visible in studio header
- First N credits free (acquisition hook)
- **Pro:** recurring purchase behaviour. **Con:** more complex, needs top-up flow.

### Option C — Subscription
- Monthly plan (e.g. R99/month = 5 cards + free delivery)
- Pay-as-you-go for overages
- Subscriber perks: saved photos, priority generation, exclusive styles
- **Pro:** predictable revenue, membership feel. **Con:** most complex, needs plan management.

### Recommendation
Start with **Option A** (pay per card) for launch. Layer **Option B** (credits) as a fast-follow once you have data on how many cards per customer per month. Option C only makes sense when you know the retention curve supports it.

---

## The Card Maker Journey (Detailed)

The card maker is Layer 2 — the tool that opens when a user clicks "New card." It replaces the current 4,624-line chatbot wizard with a **guided builder + live preview** layout that borrows the admin panel's inputs-next-to-outputs pattern while keeping conversational warmth.

### Layout: Steps Left, Preview Right

```
┌──────────────────────────────────────────────────────┐
│  [Logo]              [My Cards]  [Sarah ▾]  [Logout] │
├──────────────────────┬───────────────────────────────┤
│                      │                               │
│  ① Who's this for?   │     ┌─────────────────┐      │
│     [Sarah]          │     │                 │      │
│     🎂 Birthday      │     │   Card Preview   │      │
│                      │     │                 │      │
│  ② Photos            │     │   (updates as    │      │
│     📸 📸 📸 [+]      │     │    you build)   │      │
│                      │     │                 │      │
│  ③ Scene             │     └─────────────────┘      │
│     [On a yacht...]  │     [Front] [Inside]          │
│                      │                               │
│  ④ Style             │     [✨ Generate preview]     │
│     🎨 Watercolor ✓  │                               │
│                      │     Not right?                │
│  ⑤ Card text         │     [↻ Regenerate]            │
│     [Happy Birthday]  │     [✏️ Edit something]       │
│                      │                               │
│  ⑥ Inside message    │  ┌──────────────────────────┐│
│     [Dear Sarah...]  │  │ 📱 Digital  🖨️ Print+Post ││
│                      │  │ [Free]     [R129]       ││
│                      │  └──────────────────────────┘│
└──────────────────────┴───────────────────────────────┘
```

### The Six Steps

Each step is a collapsible card in a vertical stepper. All steps are visible at once (not hidden behind conversational turns), but only the active step is expanded. Steps unlock progressively but completed steps can be clicked to re-edit at any time.

**① Who's this for?**
- Name field ("Who are we celebrating?")
- Occasion chips: Birthday, Anniversary, Graduation, Wedding, Sympathy, New Baby, Thank You, Other
- Sets the tone for everything downstream (sympathy cards get different prompt treatment than birthday cards)

**② Upload photo(s)**
- The "One person / Group photo" toggle (already built in the Prompt Lab)
- One person + Gemini: multi-upload (up to 5 angles for better likeness)
- One person + OpenAI: single upload
- Group: single upload with everyone visible
- Photo library integration for returning users: "Use a saved photo" picker showing previously uploaded photos
- Helper text adapts per mode

**③ Describe the scene (inline AI brainstorm)**

This step replaces the current separate `AIBrainstormChat` modal dialog (953 lines, `ai-brainstorm-chat-new.tsx`) with an **inline conversation embedded directly in the step.** The brainstorm IS the step — not a tool you launch from the step.

The current brainstorm feature's core insight is correct: most people can't describe a scene from scratch, and a structured conversation (where → vibe → details) helps them build the scene they can see in their head but can't articulate. Someone who knows "Las Vegas" doesn't need a suggestion chip — they need a follow-up: "Casino floor, pool party, or Strip at night?"

**The conversation flow (2-3 exchanges, not 7):**

```
🤖 Where should we set the scene for Sarah's birthday?

[Type here...                     ] [↵]

   Need ideas?
   [🏖️ Beach party]  [🎉 Rooftop]  [⛵ Yacht]
   [🏔️ Mountains]  [🍳 Kitchen]  [More...]
```

User types "Las Vegas" or taps a chip →

```
🤖 Love it! What part of Vegas — casino floor,
   pool party at a rooftop hotel, or the Strip
   at night with the fountains?

   [Casino]  [Pool party]  [Strip at night]
```

User taps "Pool party" →

```
🤖 Any specific vibe — glamorous with cocktails,
   or relaxed fun with inflatables?

   [Glamorous]  [Relaxed fun]
```

User taps "Glamorous" →

```
🤖 Here's your scene:
   "Sarah at a glamorous Las Vegas rooftop pool
    party at sunset, cocktail in hand, city
    skyline behind"

   [✓ Use this]  [Tweak something]
```

**What changed from the current brainstorm:**
- **Not a modal/dialog** — inline within the step, visible alongside the card preview on desktop
- **2-3 follow-ups, not 7 steps.** Location → vibe → confirmation. Clothing moves to step ⑤.
- **Each follow-up offers chips AND a text input** — user can type or tap
- **No typing animation.** Suggestions appear instantly as chips. The delay is in the API call (show a shimmer), not in character-by-character rendering.
- **One API call per exchange** (GPT-4o-mini instead of GPT-4o — quality difference for "suggest casino or pool party" is nil, cost is 10-20× lower)
- **The preview panel stays visible** the whole time on desktop

**What stayed from the current brainstorm:**
- The conversational tone and warmth
- The structured progression (where → what → how) — the order of questions matters because each answer constrains the next suggestions
- "Give Me Ideas" / suggestion chips when the user is stuck
- The ability to go deep on specifics ("Which part of Vegas?")
- AI driving the conversation based on occasion + recipient context

**On completion:** "Use this" fills a regular text field with the scene description. The user can manually edit the wording before moving to step ④. The brainstorm output is a starting point, not a locked-in result.

**Cost reduction:** Current brainstorm uses 4-5 GPT-4o calls (~$0.05-0.10 per brainstorm). New approach: 2-3 GPT-4o-mini calls (~$0.002-0.005 per brainstorm). 10-20× cheaper.

**④ Choose a style**
- Visual grid of style thumbnails (not a text dropdown)
- Each thumbnail is a pre-rendered example of that style: watercolour, oil painting, digital illustration, photorealistic, comic book, anime, etc.
- "AI decide" option: let the model pick the best style for the scene
- Clicking a style shows the name + a one-line description

**⑤ Card text**
- "What should it say on the front?"
- Pre-filled suggestion based on occasion + name: "Happy Birthday Sarah"
- Checkbox: "Include text in the image" (default: yes)
- Optional clothing field: "Any specific outfit?" (collapsed by default, power-user feature)

**⑥ Inside message**
- "Write your personal message"
- Structured fields (collapsible): Dear / Message / From
- Or just type the whole thing as free text
- Option: "Leave inside blank for handwriting" (the self-write feature discussed earlier — generates styled inside with white centre)

### The Preview Panel (Right Side)

**Before generation:**
- Shows the uploaded photo in a card-shaped frame with soft overlay: "Your card is taking shape..."
- As steps fill in, metadata appears below: "Birthday card for Sarah · Beach scene · Watercolour"
- Builds anticipation without showing a fake preview

**Generation trigger:**
- "Generate preview" button appears once steps ①–④ are filled in (minimum viable inputs)
- Button shows estimated wait: "Generate preview (~15 seconds)"
- Loading state: card frame shows a shimmer/pulse animation
- Provider selection is invisible to the customer — the system uses the best provider automatically (Gemini for generation, potentially OpenAI as fallback)

**After generation:**
- Card image fills the preview frame
- Front/Inside toggle below (if inside message was provided)
- Metadata: "Watercolour · Gemini" (optional, could hide provider from customers)
- Action buttons:
  - **Regenerate** — same inputs, new generation. Previous version is kept (card versions v1, v2, v3...). Costs 1 credit or is free depending on business model.
  - **Edit something** — Gemini's iterative edit capability: "Change the shirt colour to blue" or "Move the text to the bottom." Passes the existing output back as input with the modification instruction. OpenAI can't do this.
  - **Try a different style** — quick re-run with a different art style, keeping everything else the same.

**Checkout strip (below preview):**
- Two paths once the user is happy:
  - **Digital (free):** Download as PNG / share via WhatsApp / email to recipient
  - **Print + post (R129):** Enter delivery address → payment → card is printed and shipped
- "Send to me" vs "Send to recipient" toggle within the print path

### First-Time Visitor Journey

1. Land on `/` — the builder IS the landing page. Pre-filled with a beautiful example (Sarah on a beach, watercolour). Card preview shows the example card.
2. CTA: "Make yours" — clears the example, step ① activates.
3. Fill in steps ①–④ without logging in. No gate. No friction. Let them play.
4. Click "Generate preview" → **now** prompt for email OTP login: "We need your email to generate — it's free, no password."
5. Card generates (~15s). They see it.
6. Iterate (regenerate / edit) or proceed to checkout.
7. Card lands in their studio for next time.

### Returning User Journey

1. Land on `/` → studio view: their cards, their photos, "New card" button.
2. Click "New card" → builder opens. Photo library is pre-populated.
3. Or click an existing card → re-enter the builder with everything pre-filled → tweak → regenerate.
4. Faster because context is saved.

### Design Language

The card maker borrows the admin panel's structural patterns but wraps them in consumer-friendly skin:

| Admin panel | Card maker adaptation |
|---|---|
| Monospace text, data-dense | Rounded fonts, generous whitespace |
| Purple accent on grey | Brand palette (TBD) on warm white |
| Functional labels ("slot", "template") | Friendly copy ("Who are we celebrating?") |
| Version history sidebar | Card versions as a horizontal strip |
| Quality selector tiles | Hidden — system picks automatically |
| Provider dropdown | Hidden — system picks automatically |
| Recent runs strip | "Previous versions" strip after regeneration |

### Mobile-First Design (Primary Target)

Mobile is the primary design target, not an afterthought. Greeting cards are impulse/emotional purchases — triggered by a birthday reminder on a phone, made in bed at 11pm, paid via Apple Pay. The entire journey happens on a phone for most customers.

**Layout collapse:** The two-column layout (steps left, preview right) collapses to a single-column stacked flow on mobile:

```
┌─────────────────────────┐
│ [Logo]    [Sarah ▾] [×] │
├─────────────────────────┤
│                         │
│  ✓ Sarah · Birthday     │  ← completed, collapsed
│  ✓ 📸 2 photos          │  ← completed, collapsed
│                         │
│  ▼ Scene                │  ← active, expanded
│  🤖 Where should we     │
│     set the scene?      │
│                         │
│  [Las Vegas        ] ↵  │
│                         │
│  🤖 Casino, pool        │
│     party, or Strip?    │
│  [Casino] [Pool] [Strip]│
│                         │
├─────────────────────────┤
│ ┌─────┐                 │  ← sticky bottom bar
│ │ 📷  │ Preview card ▸  │
│ └─────┘                 │
└─────────────────────────┘
```

**Sticky preview bar:** On mobile, the card preview becomes a collapsed bar at the bottom with a small thumbnail and "Preview card ▸". Tap → card slides up full-screen as an overlay. Tap "Back to editing" → slides back down. Before generation: thumbnail shows uploaded photo. After generation: shows the generated card. Same pattern as Instagram story creation.

**Step accordion:** Only the active step is expanded on mobile. Completed steps collapse to a single line showing what was filled in. Tap any completed step to re-expand and edit.

**Brainstorm on mobile:** The inline conversation in step ③ works naturally — it's a vertical list of messages, exactly what phones are built for. Suggestion chips wrap to one per row on narrow screens. Text input stays above the keyboard.

**Photo upload advantage:** Mobile has a camera. "Take a photo" opens the camera directly — shorter path to a card than finding a file on desktop.

**Generation wait:** Full-screen loading animation. Show the photo transforming, shimmer effects, progress counter. On mobile, people are used to waiting for content. Make it feel like anticipation.

**Results on mobile:** Card fills the screen. Swipe left/right for front ↔ inside. Action buttons stacked below.

**Checkout on mobile:** Apple Pay / Google Pay = one biometric tap. No typing card numbers. Two taps and a Face ID scan → card ordered.

**Architecture note:** Nothing server-side changes for mobile. The Prompt Lab, provider abstraction, auth, API endpoints are all mobile-agnostic. Only the client layout adapts, handled natively by Tailwind's responsive classes (`grid-cols-1 md:grid-cols-2`).

---

### What to NOT Build

- **A blank canvas.** Customers aren't designers. The stepper guides them.
- **Auto-generate on keystroke.** Generation costs money. Make it intentional.
- **Provider or quality selection.** Admin-only. System picks the best.
- **Technical metadata in the preview.** No "promptLen=4832" or "durationMs=18500". Just "Generating..." and then the image.
- **This UX before the brand palette is defined.** Colours, typography, and spacing define the personality. Building with Replit's default purple will require an immediate reskin.

---

## What NOT to Change

- **The conversational card-maker flow.** It works. It's warm. It doesn't overwhelm. Don't replace it with a form. Wrap it in the studio — don't gut it.
- **The admin panel.** Keep it exactly as-is. It's for you, not customers. Don't merge the two UX languages.
- **The Prompt Lab.** It runs independently of customer UX. Continue iterating prompts regardless of when the studio ships.

---

## Prerequisites (Do These First)

1. **Brand palette.** The current pink/purple/blue is Replit's default. Define a proper Celebrait palette before touching customer-facing UX. Colours affect every component; changing them after building is a full reskin.
2. **Prompt Lab Phases 2–4.** Output quality compounds under any UX. Finish the prompt iteration + model flexibility work first. The studio wraps around better outputs.
3. **Paper sketches of the studio page.** Before code, sketch: what are the 4–5 things a logged-in user sees? Where does "New card" live? Where do in-progress cards show? What does the empty state look like?
4. **Card lifecycle state machine.** Map the states and transitions. This drives the data model, the UI, and the backend. Get it on paper before touching code.
5. **Business model decision.** Pay-per-card vs credits vs subscription. Pick one for v1.

---

## Rough Build Order (When Ready)

1. Define brand palette + design tokens (colours, typography, spacing, border radii)
2. Build the Studio shell — layout, nav, empty states, card gallery (no card maker yet)
3. Add card state persistence to the DB (drafts, generated, purchased)
4. Migrate the existing card maker into the studio context (it launches inside the studio, results land in the gallery)
5. Add photo library persistence
6. Add regeneration flow (click card → edit → regenerate → updated in gallery)
7. Add credit/payment system (if Option B)
8. Polish: empty states, loading states, mobile responsive, error handling

Estimated effort: 1.5–2.5 weeks focused work, depending on business model complexity.

---

## Revision Log

| Date | Change | By |
|---|---|---|
| 2026-04-12 | Initial direction locked, based on admin panel design language + conversation about platform feel | Claude (with Aidan) |
| 2026-04-12 | Added detailed card maker journey: six-step guided builder, live preview panel, first-time vs returning user flows, design language mapping from admin panel to customer UX | Claude (with Aidan) |
| 2026-04-12 | Added inline AI brainstorm spec for step ③ (replaces modal dialog with embedded conversation, 2-3 exchanges, chips + text, GPT-4o-mini). Added mobile-first design patterns (sticky preview bar, step accordion, camera integration, Apple Pay checkout). | Claude (with Aidan) |

*Update this document when the direction evolves. Don't let it go stale.*
