# UX_LP2 — THE FRONT DOOR, REBUILT AS A BOOKING ENGINE

*Written 2026-09-02. Aidan: "This is the most important build to date."*
*Builds on UX_THREE_DOORS.md (§2 doors, §3 money boundary, §5 door 2, §8c
maker gate, §9b booking concept) and the two banked mocks (landing v4,
studio new-card). Nothing here changes `/` until LP2 is signed off —
it ships at `/lp2` and is swapped in when complete.*

---

## 0. THE ONE-SENTENCE BRIEF

**Arrive → tell us who it's for and when → three cards appear → pick →
it's on its way — with the shelf and the photo studio one glance away.**

The landing page stops being a pitch you read and becomes a machine you
use. Facts in the bar, preferences as filters, the doors revealed by the
results rather than chosen up front.

---

## 1. THE APPROACH, END TO END

### 1a. What the page has to do (in priority order)
1. **Get a stranger generating within one scroll.** The booking bar is
   the hero. Four facts, one button, no account.
2. **Be the front door to the two racks** — Christmas and Birthday are
   the SEO gateways and the proof of quality. Real cards, live, above the
   fold on mobile within one swipe.
3. **Promote the photo studio clearly** — the starboy route, with the
   existing ProofSection's real worked examples and copy reused verbatim.
4. Carry the trust and commerce beats the current LP already earns
   (object argument, delivery choice, price ladder, dates, FAQ) — reused,
   re-ordered, lightly rewritten to the £4.99 / £5.99 / £6.99 ladder.

### 1b. Register
**Airbnb, never Skyscanner.** A warm, confident search bar over a
browsable shelf. Never a form gating an empty page: flights can't be
browsed, cards can. The keeper paper/ink/violet system, verbatim from
`tailwind.config.ts` — no new colours, no new type.

### 1c. What is NOT on the page
- No route chooser. No "pick photo or maker" fork (studio mock, note 1).
- No tone field in the bar (tone is a results filter — landing mock, note 4).
- No autoplay video hero, no heavyweight LCP image. The bar *is* the LCP.
- No fake urgency. Delivery promises are computed from real lead times
  (CAP Code; the promise line is certainty, not scarcity).

---

## 2. THE LAYOUT — what LP2 houses, top to bottom

Legend: **REAL** = shipping with real data/assets now · **REUSE** =
existing component/copy moved in · **WIRE** = wireframe placeholder,
content owed.

| # | Section | Status | Notes |
|---|---|---|---|
| 0 | `KeeperHeader` + ticker | REUSE | Nav rewires to: Christmas · Birthdays · From your photo · Sign in. Ticker keeps the free-first-card offer (photo-only per §8b). |
| 1 | **Hero: the question + the booking bar** | REAL (new) | h1 "Who's it for, and when do they need it?" · bar: occasion · who · one thing they love · needed by · conditional "turning" (birthday) · "+ add a detail" disclosure (name, can't-stand) · CTA "Find their card" · sub-line: price-from + the photo forewarn ("Got a photo of them handy? After you pick, we can put them right in the card."). Submits to `/make?…` (§3). |
| 2 | **The two racks** — gateway band | REAL | "Or straight off the shelf." Two big doors (Christmas · Birthday) each with a live rail of 4 real cards from the catalogue API + "Browse all N →" + the Kids chip where live. Cards use `AjarTile`/`ThumbImg`. This is the SEO front door and the quality proof in one. |
| 3 | **How it works** — three steps | REAL copy, WIRE icons | "Three cards appear · Pick your favourite · Put them in it (your call)". Sets expectations for the wait and the photo moment before anyone presses go. Icons wireframed until designed. |
| 4 | **From your photo** — the starboy | REUSE (verbatim) | The current `ProofSection`: "Greetings cards used to be boring" + "Best friends abseiling off Big Ben, mum under the Northern Lights…" + the four real worked-example slides (source photo → inputs → card). CTA → the photo studio. Eyebrow makes the distinction: *Our directed route — you describe the scene, we make it real.* |
| 5 | **The object** | REUSE | `InsideSection` — "The magic's digital. The card isn't." Real keeper-card-closed/open imagery. |
| 6 | **Send direct or hand over** | REUSE | `HandoverSection` as is. |
| 7 | **The price ladder** | REUSE, rewritten | Off the shelf £4.99 · Made for them £5.99 · From your photo £6.99 · postage £2.95 flat · first photo card free. Replaces the single-price PriceSection copy. |
| 8 | **Never miss another one** | REUSE | `OccasionsPromoSection` (dates → reminders → prefilled bar next year — the retention loop the bar's date field feeds). |
| 9 | **FAQ** | REUSE | `FaqSection`; add two entries: "What happens when I press Find their card?" and "Can I add a photo?". |
| 10 | Social proof | WIRE | Testimonial slot — array is empty by decision until real assets land. Wireframe band, hidden in production until filled. |
| 11 | `MarketingFooter` + `FreeCardInvite` | REUSE | Unchanged. |

Mobile: the bar stacks to one column with a sticky "Find their card"
button at the bottom of the viewport once the bar scrolls off; the rack
rails become horizontal swipes; everything else already stacks.

---

## 3. THE CORE FLOW — search → wait → results → card

This is the genuinely new UX and where the golden standards bite.

### 3a. Submit
- The bar submits to **`/make?occasion=…&who=…&thing=…&by=…&age=…`** — a
  real route with the brief in the URL. State in the URL means back
  button, refresh, share-a-link and analytics all work for free.
- If the bar carried all required facts, `/make` goes **straight to
  generating** — no re-asking. If something's missing (a bare "Make a
  card" click from elsewhere), `/make` shows the questions it still
  needs, prefilled with whatever it has.

### 3b. The wait (the "spinner")
Generation takes 30–60s. Nielsen's response-time limits say anything
over ~10s needs a progress indicator *and* a reason to stay; anything
over ~1s must acknowledge the action instantly. So:
- **Instant acknowledgement**: the bar button goes busy and the page
  transitions within 100ms to the wait screen (no dead click).
- **A wait screen, not an overlay** — it's a real step with its own
  heading ("Writing three cards for your dad…"), the personalised
  narration lines already proven in research (Reading up on X… Working
  out what your dad would pick up… Drawing the fronts…), and an honest
  ETA ("about a minute — worth it").
- **Progressive reveal**: the moment concepts return, the three card
  slots appear with their *words* while the fronts are still drawing —
  the user starts reading, and each front fades in as it lands. Nobody
  stares at a spinner for 45 seconds; they watch a card get made.
- `aria-live="polite"` on the narration; reduced-motion respected.
- **Escape hatch**: "Browse the shelf while you wait" link — the rack
  rail for that occasion renders under the wait, so a bored visitor
  browses instead of bouncing.

### 3c. Where it lands — the results screen
Same route, `results` phase. In order:
1. **The promise bar** — "Posted tomorrow, first class — at your door by
   Thursday 18 Dec. Four days to spare." Computed from `needed by` and
   real production + Royal Mail lead times. This is the conversion.
2. **Made for them — £5.99** — the three cards, tone badges, "Choose this
   one" on each. Tone filter chips above (One of each · All funny · All
   warm · Cheekier) that *re-deal* = "same details, three new cards".
3. **Ready now — £4.99** — matching rack cards (the occasion catalogue
   filtered by the interest/age when there's a match; the hub's top
   picks when there isn't). Skyscanner-mixes the corridor in one screen.
4. **Put them in the picture** — the dashed strip: add a photo → we draw
   them into the card you pick (after-pick, the proven timing) — and the
   quiet pointer to the directed photo studio for people with a scene in
   mind.

### 3d. After the pick (the existing corridor)
Pick → cameo offer (photo after pick, as research) → inside (ours / own /
blank) → **Keep it** (sign in — §8c) or **Buy it** (guest checkout via
the rack's token pattern, price by `source: 'maker'` = £5.99, which the
checkout already charges by source). Draft-on-generate per §3: the
`cards` row + 3 `card_attempts` are written the moment the three render,
so a signed-in user finds it in Drafts and a guest's checkout works.

### 3e. Failure and edge states (designed, not defaulted)
- **Generation failed** → honest message, one-tap retry, and the rack
  rail *right there*: "Meanwhile, these are ready now."
- **Daily cap hit** (guest gate) → "We've made a lot of cards today —
  here's the shelf, or sign in to keep going."
- **No rack matches** → the Ready-now band shows the occasion's best
  instead of hiding; the made-for-them set carries the page.
- **Refresh mid-wait** → the brief is in the URL; regenerate or, once
  the draft exists, resume it.
- **Under-18 brief with Cheekier chip** → chip disabled with the reason
  (the server downgrades regardless).

---

## 4. GOLDEN STANDARDS APPLIED (the references, so this isn't taste)

- **Response times (Nielsen):** 0.1s instant / 1s flow / 10s attention —
  acknowledge instantly, show progress past 1s, give a *reason to wait*
  past 10s. §3b is built on this.
- **Progressive disclosure & skeletons:** words before pictures, partial
  results over blank waits (Facebook/LinkedIn skeleton research: perceived
  wait drops when *something* is arriving).
- **Search-first landing (Airbnb pattern):** the bar is the product; the
  page beneath is browsable inventory, never empty.
- **Form design:** four fields, smart defaults, conditional fields
  (Baymard: every extra field costs), labels always visible, one primary
  action.
- **State in the URL** for anything a user might refresh, share or
  return to.
- **Honest urgency only** — computed delivery promises, no countdowns, no
  "3 people are looking" (CAP Code; also the brand).
- **Trust near the action:** TrustChips (280gsm, UK printed, fresh take
  free) sit under the bar and under the price, not in a footer.
- **Core Web Vitals:** the bar is the LCP; no hero media above the fold;
  rack tiles are the ~30KB thumbs; the proof carousel lazy-loads below.
- **Accessibility:** real labels, focus rings (brand violet), `aria-live`
  wait narration, reduced-motion honoured, 4.5:1 body contrast (keeper
  body ink, not stone).

---

## 5. WHAT'S REAL VS WIREFRAME ON DAY ONE

REAL: the bar; both rack rails (live catalogue); ProofSection assets and
copy; Inside/Handover imagery; price ladder; occasions promo; FAQ;
header/footer; the make flow's wait, results, pick, cameo, inside.

WIRE (labelled on the page, hidden when we flip `/`): how-it-works icons;
testimonial band; any illustration for the empty/failed states.

Nothing on LP2 needs new photography. The gallery's old placeholder
problem (six fronts all the same image) is dead — the racks ARE the
gallery now.

---

## 6. BUILD SEQUENCE

| Phase | What ships | Where | Est. |
|---|---|---|---|
| **A** | LP2 page at `/lp2`: header, hero + bar, two-rack band, how-it-works, reused proof/inside/handover/ladder/occasions/FAQ/footer, SEO entry. Bar submits to `/make`. | `client/src/pages/landing-two.tsx`, `components/landing/booking-bar.tsx`, `rack-gateway.tsx` | ½ day |
| **B** | `/make` — the public maker: guest gate (third `Gate`, per-IP + global daily caps, no key), research-maker fork minus survey, prefill from URL, straight-to-generate, wait screen with progressive reveal, results screen (promise bar, made-for-them, chips, ready-now rail, photo strip), pick → cameo → inside. | `pages/make.tsx`, `server/routes/admin-card-lab.ts` (gate) | 1–1½ days |
| **C** | Draft-on-generate + keep/buy: `cards` row + 3 attempts on render, guest token, Keep → sign-in, Buy → `/buy/:id` at £5.99. Drafts tab shows maker drafts. | `server/routes/make.ts`, `pages/buy.tsx` | ½–1 day |
| **D** | Polish + flip: mobile QA, a11y pass, perf (LCP), analytics events on bar/wait/results/pick, then `/` → LP2 (old LP kept at `/lp-classic` for a fortnight). | — | ½ day |

**Status:** Phase A shipped `0a2ecc49`; Phase B shipped `fee6449c` (2026-09-02) — `/make` real, guest gate `requireGuestMaker` on `/api/make/*` (per-IP / per-user / global daily caps, `GUEST_MAKER_OFF=1` kills it). Verified live: brief screen, wait screen with narration, failure screen. NOT yet exercised end-to-end (OpenAI credits exhausted at build time): results → pick → cameo → inside → done. First job when credits land: run a full brief through dev before Phase C.

---

## 7. DECISIONS OWED (Aidan)

1. **Needed-by default**: Christmas prefills 25 Dec minus posting margin;
   birthdays blank until typed. OK?
2. **The research maker**: stays live behind its key for F&F testing;
   `/make` is the customer twin. OK?
3. **Kids briefs from the bar**: the conditional "turning" field arms the
   kids register; the Cheekier chip disables under 18. OK?
4. **Free first card on LP2**: ticker + price ladder say it's photo-only.
   Keep that promise visible in the bar's sub-line, or only on the photo
   section?
5. **Flip criteria for `/`**: after B+C ship and one week of F&F traffic
   through `/lp2`, or straight after D?
