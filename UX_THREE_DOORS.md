# THREE DOORS, ONE CORRIDOR

**Spec — 2026-08-27.** How the rack, the 3-card maker and the photo studio
become one product without breaking the thing that already works.

Supersedes the "three doors" sketch in `UX_PLATFORM_IA.md` §2 with the
actual data model, and answers Aidan's question of 2026-08-27: *"they
might plumb the same but they can't live together 100% in the studio."*

He's right. This spec draws the line.

---

## 1. WHAT WE FOUND (the survey, not the plan)

### 1a. The corridor already exists

The `cards` table is **not** photo-shaped. It holds:

```
frontImagePath · insideImagePath · printReadyPath · status · price
viewToken · userId (NULLABLE) · selectedFrontAttemptId · selectedInsideAttemptId
```

That is a *card*, not a photo card. And everything downstream of a
finished card is already universal and already built:

| Capability | Where | State |
|---|---|---|
| Checkout | `POST /api/studio/cards/:id/checkout` | built |
| Payment | Stripe provider + `/api/webhooks/stripe` | built, env-stubbed |
| Fulfilment | Prodigi + `/api/webhooks/prodigi/:secret` | built, env-stubbed |
| Order status | `/api/studio/orders/:id`, `refresh-status` | built |
| Reveal / share | `viewToken`, `/studio/card/:id` | built |
| Ready / Sent | `/studio/ready`, `/studio/sent` | built |
| Candidates → pick | `card_attempts` (side, attemptNumber, isSelected) | built |

**Consequence: the finished-card layer needs no work.** A maker card and
a rack card, once made, inherit checkout, print, reveal, sharing, order
history and the dashboard's Ready/Sent tabs for free.

### 1b. The draft layer is photo-shaped to the bone

`CardDraftState` (stored in `cards.conversationData`) is the photo
journey's memory:

```
version · step · recipient · scene · style · photos · front · inside · delivery
```

and the gates enforce it:

- **`isReadyToGenerateFront()` hard-requires `photos.photoIds.length`** —
  a maker card cannot pass this function. It is not a soft assumption.
- **`sceneType` is `NOT NULL` and hardcoded `'with-person'`** at draft
  creation (`studio-drafts.ts`).
- **`step: number`** indexes `CARD_MAKER_STEPS` — a *fixed* six-step
  list (recipient → photo → scene → front → inside → review). Two flows
  with different screens cannot share one integer.

### 1c. The recovery ladder is card-shaped but photo-worded

`server/recovery/dispatcher.ts` fires on `status='completed'` + unpaid:

- T+24h `dropoffEmailSentAt` · T+4d `tweakEmailSentAt` · T+10d `lastCallEmailSentAt`
- `.innerJoin(users)` + `marketingOptIn` — **so guest cards are silently
  excluded from recovery.** Correct by default (no consent, no address),
  but it means guest abandonment is invisible. Named here, decided in §6.

---

## 2. THE DECISION

> **The corridor is shared. The doors are not. A card joins the corridor
> the moment it becomes expensive.**

Three producers, one `cards` row, one finishing pipeline. Each door keeps
its own approach path, its own state shape, its own resume — and hands
over an identical object.

```
   BROWSE THE STORE        GENERATE 3            PHOTO UPLOAD
   (no draft ever)         (draft on generate)   (draft on step 1)
          │                       │                     │
          └───────────┬───────────┴──────────┬──────────┘
                      ▼                      ▼
                 cards row  ──►  checkout ─► Stripe ─► Prodigi
                      │
                 Ready · Sent · Share · Orders   (all existing)
```

---

## 3. THE MONEY BOUNDARY (when a draft is born)

The rule that decides everything else:

> **A draft exists once the user has spent our money, or spent enough of
> their own effort that losing it would sting.**

| Door | Draft created | Why |
|---|---|---|
| **Photo** | Step 1, as today | Upload + crop + likeness is real labour; unchanged |
| **Maker** | **Only when the 3 cards have rendered** | Five questions are cheap and re-typable; three renders are ~£0.05 of spend and a live decision |
| **Rack** | **Never** | Browse → buy. No mid-state exists |

The maker's pre-generation answers live in the browser only. Nothing is
written, nothing is resumed, nothing to clean up. The instant three cards
exist, a `cards` row is written with three `card_attempts`
(`side: 'front'`, none selected) — **exactly the pattern the photo route
already uses for its own candidates.**

Resume for a maker draft is therefore: *"You made three. Pick one."*
Which is a better recovery email than the photo route's, because the
cards are already made and the email can show them.

---

## 4. THE MODEL CHANGES

### 4a. `cards.source` — the discriminator

```ts
source: text('source').notNull().default('photo')   // 'photo' | 'maker' | 'rack'
```

Defaulting to `'photo'` back-fills every existing row correctly. One
column, no migration of data.

### 4b. Two state shapes, not one union of optionals

`CardDraftState` **stays exactly as it is** — it is the photo route's
state and should not grow maker fields it will never use. Add a sibling:

```ts
export interface MakerDraftState {
  version: 1;
  source: 'maker';
  brief: {            // what they typed, for "start again with these details"
    who: string; gender?: 'him' | 'her'; age?: number | null;
    interest?: string; dislike?: string; name?: string;
    tone: 'funny' | 'warm' | 'rude' | 'mix'; occasion: string;
  };
  resumeAt: 'pick' | 'inside' | 'done';   // NOT a shared step index
  pickedAttemptId?: number;
}
```

Both live in `conversationData`; `cards.source` says which to parse.
Resume dispatches on `source`, never on `step`.

### 4c. The three landmines, disarmed

1. **`isReadyToGenerateFront()`** — becomes source-aware, or (cleaner)
   the maker never calls it. Maker generation is gated by the maker's
   own brief validation, which already exists in the research page.
2. **`sceneType` NOT NULL** — maker rows write `'maker'`, rack rows
   write `'rack'`. Nothing reads it except the photo pipeline, which
   only sees `'with-person'` rows.
3. **`step`** — absent from `MakerDraftState` by design. `resumeAt` is
   a named state, not an index into someone else's screen list.

---

## 5. THE THREE DOORS, BUILD BY BUILD

### Door 1 — BROWSE THE STORE (lowest risk, ships first)

The template already has everything: front image, pre-rendered inside
(`inside_image_path`), print file. Buying it is a **copy, not a
generation**.

```
POST /api/shop/templates/:id/buy
  → clone template images into a cards row
      source:'rack', status:'completed', price: <occasion price>
      userId: session user OR null (guest)
      conversationData: { source:'rack', templateId, insideChoice }
  → return { cardId } → existing checkout takes over
```

Inside choice at this step (already designed on the product page): the
card's own message / write your own / blank. "Write your own" is the
only branch that needs a render; the other two are instant.

**No draft. No resume. No recovery email.** If they leave, they leave —
nothing was spent.

### Door 2 — GENERATE 3 (the new customer surface)

`/make` — the research maker, promoted to production:

1. Five questions (browser state only)
2. Generate → **write the `cards` row + 3 front attempts here**
3. Pick → `selectedFrontAttemptId`
4. Inside → the card's own message / write your own / blank
5. → `status: 'completed'` → existing checkout

Signed in: card appears in Drafts immediately, resume works, recovery
ladder applies. Guest: card exists, checkout works, no recovery (§6).

**Reuses:** the entire research-maker UI (built, tested on real people),
the engine endpoints (dual-registered already), `card_attempts`.

### Door 3 — PHOTO UPLOAD

Unchanged. Not one line.

---

## 6. GUESTS — the honest limits

`cards.userId` is nullable, so guest cards are structurally fine. Three
consequences that need decisions, not code:

1. **`/studio/*` is auth-gated.** A guest can't see order status there.
   Needs `/order/:token` — a tokenised, account-free status page. Small
   build, unavoidable.
2. **Recovery excludes guests** (inner-joins `users` + `marketingOptIn`).
   Right by default: no account, no consent. It means guest abandonment
   is invisible — accept it, or capture email earlier and treat that as
   consent (PECR: soft opt-in on an *initiated purchase* is defensible;
   an abandoned browse is not).
3. **Claiming.** A guest who later signs up with the same email should
   inherit their orders. Worth designing; not v1.

---

## 7. THE STUDIO STOPS BEING THE PHOTO PRODUCT

The consequence that isn't technical.

Today "the studio" means *where you make photo cards*. After this it
means **"your cards"** — the account home behind three entrances. That
changes:

- **Naming** — /studio survives as a URL; the *language* becomes "your
  cards", "make another", not "the studio".
- **Empty states** — currently "make your first card" (photo-shaped).
  Becomes the three doors.
- **Drafts tab** — shows both kinds, labelled by source, each resuming
  into its own flow. A rack card never appears here.
- **`/studio/new-card`** — currently straight into the photo flow.
  Becomes the three-door chooser: the LP's hero, repeated inside.
- **The LP** — three doors, honestly described, *after* the doors open.

---

## 8. OPEN DECISIONS (Aidan's, not mine)

1. **Does the free-first-card offer apply to all three doors, or photo
   only?** `/api/user/free-card` exists and is photo-era. A free rack
   card costs us ~£2 of print; a free maker card costs print + tokens; a
   free photo card is the current acquisition hook. **Recommendation:
   photo only** — it's the differentiator worth subsidising, and the
   rack sells on impulse without a giveaway.
2. **Price per door.** `cards.price` is NOT NULL. Rack and maker at the
   same £8.99, or does the rack undercut (£5.99 as tested in research)?
   Research answers land in `/admin/research`.
3. **Does the maker require sign-in?** Guest maker = we pay for
   generation with no email captured. **Recommendation: guest can
   generate, sign-in (or email) required to keep or buy** — the research
   tool proves people will walk the flow without an account.
4. **Basket or single-card checkout?** Rack browsing invites multi-buy
   (Christmas especially — "one design × twenty" from
   `next_digital_card_strategy` thinking). V1 single-card is honest;
   Christmas may force the question.

---

## 9. SEQUENCE

| Phase | Work | Unblocks |
|---|---|---|
| **0** | `cards.source` column + `MakerDraftState` type | everything |
| **1** | Door 1: template→card copy + guest order + `/order/:token` | **first live revenue** |
| **2** | Stripe + Prodigi live env (needs the test print) | real money |
| **3** | Door 2: `/make` promoted from research, draft-on-generate | the maker as product |
| **4** | Drafts tab source-aware; recovery copy source-aware | retention across doors |
| **5** | IA reframe: empty states, `/studio/new-card` chooser | coherence |
| **6** | LP rebuild — three doors that genuinely open | the shopfront |

Phase 1 is the shortest path to money and touches nothing that already
works. Phase 6 is last on purpose: **design the shopfront when the doors
open, not before.**
