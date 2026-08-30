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

## 8. DECISIONS — MADE 2026-08-27

All seven settled with Aidan. These are the spec now, not options.

### 8a. Pricing — a three-tier ladder by effort

| Door | Price | Why it's higher/lower |
|---|---|---|
| **Rack** (browse the store) | **£4.99** | Pre-made, zero generation spend, impulse buy |
| **Made-for-you** (generate 3) | **£5.99** | Written and drawn for them, ~£0.06 of tokens |
| **Photo** (upload) | **£6.99** | The differentiator, highest production cost |

⚠️ **This supersedes the £8.99 anchor** (`next_pricing_and_regen_economics.md`
and the rejected £1 soft-launch). The ladder's logic is that customers
instantly understand *pre-made < made-for-you < made-from-your-photo*,
and the cost ladder matches the price ladder.

✅ **The ladder clears cost comfortably.** Real figures (Prodigi live
invoices, `next_pricing_and_regen_economics`): card item **£0.60 ex /
~£0.72 inc**, Standard shipping **£2.82 inc** against **£2.95 charged**
(postage at cost — see §8d), generation **~£0.21** per set of three,
Stripe ~1.5% + 20p.

| Door | Collected (card + £2.95) | Cost | Net |
|---|---|---|---|
| Rack £4.99 | £7.94 | £3.54 print+ship | **~£4.05** |
| Made-for-you £5.99 | £8.94 | £3.75 (+ tokens) | **~£4.85** |
| Photo £6.99 | £9.94 | £3.75+ (+ tokens) | **~£5.85** |

And the basket compounds it: a second card adds ~£0.72 of cost against
£4.99+ of revenue, because **shipping is already paid** (§8d).

The test print remains a **quality** gate — and settles the
low-vs-high render question (35× cost) — but it is *not* a pricing
blocker. Prices can be set now.

### 8b. Free first card — PHOTO ONLY

Subsidise the differentiator. The rack sells on impulse without a
giveaway, and the offer needs an account while the rack is guest-first.
Cost of the hook: print + AI, offset by £1.13 of postage margin —
roughly **£1.50–2.50 of CAC per free card**.

### 8c. Maker gate — GENERATE FREE, SIGN IN TO KEEP OR BUY

The research tool proved people walk the whole flow without an account.
They feel the magic first; the ask lands at the moment they want the
card. ~£0.06 exposure per curious visitor, bounded by the existing
daily caps.

### 8d. Basket — YES, FROM THE START

- **Postage: flat £2.95 per ORDER, any quantity** (dropped from £3.95,
  2026-08-27). Prodigi's true inc-VAT cost is £2.82, so this is
  **deliberately at cost — ~13p** — treating postage as a conversion
  lever and letting the card carry the margin. Prodigi bills shipping
  per order with items combined, so the second card ships essentially
  free to us; charged ONCE per order however many cards.
  ⚠️ **Zero headroom: any Prodigi shipping rise puts standard postage
  underwater.** Express (£8.95 vs £7.74) and Overnight (£13.95 vs
  £12.90) keep their ~£1 cushions and are unchanged.
- **Mixed doors allowed in one basket** — rack + made-for-you + photo,
  one shipment. They're all `cards` rows by then; fulfilment doesn't
  care.
- **No same-design quantity in v1.** One design × twenty recipients is
  the *sender's card* — a separate product (recipient list, per-copy
  inside, pack pricing) worth building properly for next Christmas, not
  bolted on now.

---

## 8e. THE ORDER MODEL — the basket's real cost

The one genuinely structural consequence:

```
TODAY:  studio_orders.cardId  integer NOT NULL     -- one order, one card
NEEDED: order → many cards                          -- one order, N cards
```

- **21 usages** of `cardId` in `studio-checkout.ts` to migrate, plus 1
  in `print-provider.ts`, 2 in `prodigi-provider.ts`.
- **Prodigi is already basket-shaped**: its submission builds
  `items: [{ ..., copies: 1 }]` — an array with a copies field. Multi-item
  orders need mapping work, not a new integration.
- **Money columns already sum-friendly**: `printAmount`, `shippingAmount`,
  `totalAmount` are order-level. Card price becomes a line-item sum;
  shipping is charged once per order (§8d).

Shape: an `order_items` table (`orderId`, `cardId`, `unitPrice`) with
`studio_orders.cardId` retained-but-deprecated for existing rows, or
back-filled and dropped. **Decide at build time; the back-fill is
trivial (one row per existing order).**

## 9. SEQUENCE

| Phase | Work | Unblocks |
|---|---|---|
| **0** | `cards.source` column · `MakerDraftState` type · price-by-source in `shared/pricing.ts` · **copy sweep** (landing, product page, blog, SEO and free-card copy still quote £8.99 + £3.95) | everything |
| **1** | **Order model → line items** (`order_items`, migrate 24 `cardId` usages, Prodigi multi-item mapping, shipping charged once) | the basket, and every door after it |
| **2** | Door 1: template→card copy · guest orders · `/order/:token` status page | **first live revenue** |
| **3** | Stripe + Prodigi live env — gated on the test print (which also settles §8a costs) | real money |
| **4** | Door 2: `/make` promoted from research · draft-on-generate · sign-in at keep | the maker as product |
| **5** | Drafts tab source-aware · recovery copy source-aware · basket UI polish | retention across doors |
| **6** | IA reframe: empty states, `/studio/new-card` chooser, "your cards" language | coherence |
| **7** | LP rebuild — three doors that genuinely open | the shopfront |

### 9b. LP concept — the booking engine (Aidan, 2026-08-30)

"Kinda like a booking experience... arrive on landing, preselect occasion, dates, interest, then generate and it's like searching for flights." The mapping holds and solves three standing problems:

- **The date field** — booking sites run on date anxiety and so do cards ("will it arrive by the 14th?"). Date in the search bar → honest urgency on every result ("order by Tuesday") → and every typed date feeds the address-book/reminders retention engine for free. Nobody else in the market asks the date first.
- **The wait state** — "searching 400 airlines" trained the world to wait when the frame promises bespoke work. Generation's ~60s + the personalised narration IS a flight-search interstitial.
- **One search, three doors** — occasion+age+interest is also a catalogue query. Results lead with the generated set (£5.99, "made for them") over matching rack cards (£4.99, "ready now"), Skyscanner-mixing the corridor in one screen. Photo door stays its own entrance.

⚠️ **Register: Airbnb, never Skyscanner.** Booking is commodity-comparison; the brand is the keeper. Warm confident search bar OVER a browsable shelf — never a form gating an empty page (flights force the form because flights can't be browsed; cards can).

**Phase 1 moved ahead of the rack** because "basket from the start"
means the order model must be right *before* the first real order lands
— migrating live orders later is far worse than doing it now with zero
rows to migrate.

**Phase 7 stays last on purpose**: design the shopfront when the doors
open, not before.
