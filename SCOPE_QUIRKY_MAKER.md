# Scope: the Quirky card maker (customer flow)

*Scoped by Aidan 2026-08-15, off the back of the Card Lab. Status:
SCOPED — not approved for build.*

Turning the Lab into a customer product: **one thing they love in →
three designs → pick one → refine it → sign off → design the inside →
assembled card.** Mirrors the existing photo studio's shape so both
routes feel like the same shop.

---

## The flow

### Step 1 · Who it's for
Three inputs, all fast:
- **Who's it for** — chips (Mum / Dad / partner / mate / sibling / nan / colleague)
- **Occasion** — chips, reuse `OCCASION_PRESETS`
- **One thing they love** — single required text field

*"Who it's from" is dropped* (Aidan's call) — it isn't needed to write
the front, and it's collected later at the inside step where it
actually belongs, as the sign-off. One less question in front of the
magic.

**→ GENERATE FRONT**

### Step 2 · Pick a direction
Three finished fronts, revealed as they land (~25s, ~2p total). Each
badged with its angle so the choice is legible: **wordplay / deadpan /
proud**. Tap one to choose.

Also here: **Deal three more** — a fresh set, same brief. Uncapped (the
Lab's cap was removed deliberately; a set costs 2p).

### Step 3 · Refine the front
The chosen design, large, with three moves:
- **Re-roll the design** — same words, new artwork
- **Re-roll the text** — same artwork family, new line (a fresh concept
  at the same angle/format)
- **Edit the text myself** — type the exact words

That last one routes by layout, exactly as built in the Lab: **sparse
formats** (statement/hero) get Gemini's pixel-preserving swap, **dense
formats** (pattern/label) get a full re-render from the stored recipe,
because their artwork is composed around the lettering.

Every version lands in `card_attempts` (side='front'), so nothing is
lost and "go back to the second one" is free.

**→ SIGN OFF FRONT**

### Step 4 · Design the inside
Three ways, matching what the studio already offers:
- **Leave it blank** — a styled empty page to handwrite on
- **Write it for me** — AI message in the card's own voice
- **I'll write it** — the studio's existing inside builder, unchanged

**"To …" and "Love …" are always available** in all three written
modes, rendering as the greeting-card hierarchy the photo route uses
(greeting small at top, message centre, sign-off beneath). This is
where "who it's from" gets collected, in the place it makes sense.

**→ SIGN OFF INSIDE**

### Step 5 · Review & send
**The 3D card.** `Card3DViewer` takes `frontImageUrl` +
`insideImageUrl` — both of which we now have — so the payoff moment is
identical to the photo route: the card sitting ajar at ~22°, tap to
open. Locked interaction model applies (no orbit, no zoom,
`card_interaction_model`).

Then the existing review → checkout → `composeCardPrintStrip` →
Prodigi path, entirely unchanged. The compositor takes a front buffer
and an inside buffer and doesn't care how they were made.

---

## What's reused vs new

**Reused, untouched:** `Card3DViewer` · `composeCardPrintStrip` and the
whole print/Prodigi path · checkout, orders, comp codes · the inside
builder for "I'll write it" · `card_attempts` for history and revert ·
`OCCASION_PRESETS` · Cost Ledger · the studio's step chrome, stepper
and save-draft behaviour.

**Reused from the Lab (built and benched):** the concept engine
(writer → independent judge) · the Quirky style DNA with print physics
· four composition recipes with forced density spread · per-subject
palettes · the character ladder · text edit with format routing · the
inside renderer with all three modes.

**Genuinely new:**
1. **A `cardMode` fork** so `CARD_MAKER_STEPS` differs by route. ⚠️ The
   step-index change is the main regression risk — it has caused two
   production bugs before (see the comment in `card-maker.tsx`).
2. **The three-up picker** (step 2) — new surface, closest existing
   relative is the Lab grid.
3. **Persisting Lab concepts to a real card** — `conversation_data`
   needs to carry `interest`, the chosen concept's angle/format/
   palette/art_direction so re-rolls stay in the same design language
   after a page refresh.
4. **Quirky prompts into Prompt Lab slots** — the Lab currently holds
   them as constants in `admin-card-lab.ts`. Customer-facing spend must
   be iterable without a deploy, per the Prompt-Lab-first rule. New
   slots: `quirky_concept`, `quirky_front`, `quirky_inside`.
5. **Free-text safety on `interest`** — the Lab is admin-only; a public
   field needs the real-person rule enforced in CODE, not just prompt
   (there is still no blocklist anywhere in the app), plus the existing
   studio safety layer.

Realistically: **one PR for the flow + one for the prompt migration**,
with the step fork done carefully.

## Economics

| | |
|---|---|
| Step 2 (3 concepts + 3 fronts) | ~£0.021 |
| Each extra set of three | ~£0.019 |
| A re-roll / text edit | £0.005–0.05 |
| Inside | £0.005 |
| **Typical card, start to signed off** | **~£0.04** |

Versus ~£0.21 for a photo card. Someone who browses and leaves costs
about 2p. High-quality re-renders for print are a later decision — low
is genuinely good enough at card size, and should be judged on a real
print before spending more.

## Open questions for Aidan

- **Price** — same £8.99? I'd hold it; they're buying a printed card,
  not compute. Discounting invites the cannibalisation risk.
- **Where it lives** — quiet second door in the studio first, or a real
  LP route? The LP currently makes one promise and that's a strength.
- **Free-first-card credit** — applies here too, or photo-only?
- **Print quality** — low renders are ~£0.006 and look right on screen.
  One Prodigi test print settles whether that survives 6×6in at 300dpi,
  and that test should happen before any of this is built.

## Recommendation

Sequence is: **one real print → then build.** Everything above assumes
these cards look as good on 280gsm as they do on a retina screen, and
that is genuinely unknown — it's the one assumption the whole product
rests on and it costs a single Prodigi order to check. Compose a
signed-off Lab card through `composeCardPrintStrip`, order one, hold
it. If it's a keeper, this scope is a fortnight's work with most of the
engine already benched.

Related: [[SCOPE_NO_PHOTO_CARDS.md]] (the strategic case and the
positioning constraint — this is that product, specified),
[[SCOPE_CARD_EDITS.md]] (the photo route's equivalent edit story).
