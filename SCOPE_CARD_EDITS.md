# Scope: Targeted card edits — weight, clothing, text

*Seeded by Aidan 2026-08-13. Status: SCOPING — not approved for build.*

The observation driving this: generated people sometimes read as heavier
or differently dressed than the photo, which breaks the "that's really
them" moment — the entire product promise. Today the only remedy is
"Start again with these details" (full re-roll), which gambles the parts
the user already loved to fix the one part they didn't.

The ask: let users change **weight**, **clothing**, and **front text**
on the front; **text only** on the inside. Multi-person cards need a way
to say *which* person.

---

## What already exists (this is most of the build)

| Piece | State |
|---|---|
| `ImageProvider.refine()` — image-in + instruction + reference photos | **Built.** Gemini implements it; interface + `supportsRefine` capability flag already in `image-provider.ts`. This is the "Gemini edits our OpenAI images" path. |
| Prompt Lab refine bench | **Built.** `/api/admin/prompts/test-refine` — instructions can be tested against real card images today, before any studio UI exists. |
| Attempts system (`card-attempts.ts`) | **Built.** Every edit = a new attempt; selected-attempt pointers give history + revert with zero new schema. |
| Parked tweak workbench (`regen-controls.tsx`, `how-tweaking-works.tsx`) | **Parked for Premium** (regen launch decision 2026-07-07). UI skeleton to salvage, not necessarily to revive wholesale. |
| Daily generation cap / Cost Ledger | **Built.** Edits must count against the cap and land in the ledger like any other generation. |

What does NOT exist: any user-facing edit UI, any person-targeting
mechanism, any edit-instruction prompt template, and — critically —
**likeness verdicts on refine output** (photo-likeness system currently
judges uploads, not edit results).

## The three hard problems (the actual scope)

### 1. Weight is a different kind of edit from clothing
Clothing is a fact ("blue jacket, not a suit"). Weight is the person's
body, and a UI that says "adjust weight" invites users to relitigate
what people look like — including making *other* people in the photo
thinner as a joke or a jab. The recipient sees this card.

**Position: never expose weight as a control.** Expose **"Make them
truer to the photo"** — one likeness-repair action whose instruction
(built server-side, never user-authored) tells the model to match build,
face and frame to the reference photos. That fixes the real complaint
(the render drifted from reality) without shipping a body-editing tool.
The reference-photo parameter on `refine()` exists precisely for this.
Weight drift is a symptom; likeness drift is the disease.

### 2. Which person? (multi-person cards)
Options considered:
- **Tap-to-target:** tap the person on the card preview; send normalised
  x,y in the instruction ("the person nearest the top-left…"). Slick,
  but spatial reference reliability in edit models needs proving in PL
  before any UI is built on it.
- **Describe-to-target:** "the man in the red jumper" — free text, no
  build, but pushes the disambiguation problem onto the user and the
  model.
- **V1 position: don't solve it.** Single-person cards are the dominant
  case (`one_person` is the flagship prompt). Ship edits for
  single-person cards; on multi-person cards show "editing works on
  single-person cards for now". Group targeting is its own PL research
  task with a kill criterion, not a blocker on the 80% case.

### 3. Text edits are two different features
- **Front text** is painted INTO the artwork. Changing it = a refine
  instruction ("change the banner text to 'Happy 40th Dave'") and edit
  models are historically shaky at re-rendering text cleanly — this is
  the highest-regression-risk edit and needs a PL pass rate measured
  before it's offered. (Same lesson as Kling: instructions about text
  are where models embarrass you.)
- **Inside text** is typography we render (inside message is typography,
  not handwriting). It should NOT go through refine at all — it's a
  re-run of the `inside_write` slot with new text. Cheaper, deterministic,
  zero likeness risk. Arguably ship-able independently of everything
  above.

## Product shape (V1 proposal)

On a completed card, per side, an **"Adjust"** action offering exactly
three structured fixes (no free-text prompt box — that's the parked
Premium workbench, and free text is where safety and cost go to die):

1. **Truer to the photo** — likeness repair, zero user input.
2. **Change the clothing** — one short field, folded into a
   server-built instruction template.
3. **Fix the text** — front: refine instruction from a single field;
   inside: re-render via `inside_write`.

Each edit: counts against the daily cap, lands in Cost Ledger, creates
an attempt (revert = attempts UI already built), and runs the likeness
verdict on the RESULT with the original crop as reference before the
user sees it — a failed edit should retry silently once, then offer the
previous attempt back, never present a worse card as "done".

Single-person cards only. Bounded edits per card (suggest 3/side) so a
tinkerer can't 20x the card's cost — ledger data can tune this later.

## Sequencing (Prompt Lab first — hard rule)

1. **PL pass:** author `edit_person` instruction templates (likeness /
   clothing / front-text) as PL-testable prompts; run against a bank of
   real cards incl. failure cases; measure pass rates per edit type.
   **Kill criterion per edit type: <70% clean on 20 varied cards → that
   edit type doesn't ship in V1.** Front text is the one most likely to
   die here; the feature survives without it.
2. **Studio PR:** Adjust UI + attempts wiring + caps + ledger, gated to
   the edit types that passed.
3. **Later / separate:** multi-person targeting research; free-text
   tweaks stay Premium (regen launch decision stands).

## Open questions for Aidan
- Free vs paid: is an edit a free correction (quality guarantee) or a
  Premium tease? Leaning free-with-cap: a bad likeness is OUR miss, and
  charging to fix it reads terribly. Cost ~£0.02–0.04/edit (ledger will
  say precisely).
- Does "truer to the photo" surface pre-purchase only, or also on sent
  cards? (Suggest pre-purchase only — post-send edits confuse the
  print/order relationship.)

## Relationship to parked work
This is NOT the tweak workbench revived. Workbench = open-ended
free-text iteration, parked for Premium (2026-07-07, reopen on Cost
Ledger abandonment data — that trigger stands). This is three bounded,
templated fixes for specific quality complaints. If both ship, the
workbench is the Premium upsell sitting behind these free fixes.
