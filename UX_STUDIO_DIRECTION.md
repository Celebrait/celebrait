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

*Update this document when the direction evolves. Don't let it go stale.*
