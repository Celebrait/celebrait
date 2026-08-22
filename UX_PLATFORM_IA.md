# PLATFORM IA — one shop, three doors

**Scoped 2026-08-22.** Aidan: *"now we're more of a proper website
platform with a catalogue to browse, and 2 routes to create — quick
brief any occasion no photo — higher bar to entry with a photo…
what do we lead with… map out the sitemap… SEO rich."*

Companion to `UX_GUIDED_MAKER.md` (the quick route's flow) and
`RESEARCH_UK_CARD_MARKET.md` (the Thortful field study this leans on).

---

## 1. The thesis

Celebrait is now **one shop with three doors**, in ascending order of
effort and personal payoff:

| Door | Effort | What it is | Who it's for |
|---|---|---|---|
| **The rack** | ~0 | Browse finished cards; personalise words or buy as-is | The undecided, the in-a-hurry, and every SEO arrival |
| **Quick maker** (occasion builder) | 5 taps | Three generated options, in and out in minutes | The casual buyer — the volume door |
| **The studio** (photo route) | minutes + a photo | Put them in the picture — the signature | The invested sender — the premium door |

The doors are **entry points, not silos**: rack cards flow into a
shortened quick-maker ("make it theirs"), and every quick-maker pick
screen offers the step up ("want them IN it? add a photo"). One
ladder, three rungs, upsell always upward and never a dead end.

**The market grammar we adopt** (Thortful's four-slice, confirmed at
Moonpig): navigation is OCCASION-FIRST, then sliced by RECIPIENT ×
AGE × STYLE. Moonpig treats photo-upload as a facet *inside* each
occasion, not a separate product. We differ deliberately (our photo
route is an experience, not a card type) — but the *browsing* grammar
must match what every UK card buyer already knows.

## 2. What leads — decided by entry surface, not once

There is no single answer to "what do we lead with", because arrivals
differ. The rule: **each surface leads with what its visitor came
for.**

- **Homepage** → leads with THE MAGIC DEMONSTRATED, quick-maker
  first (REVISED 2026-08-22 — Aidan: "occasion builder approach is
  just as valuable... targeting more of the market", and he is right:
  the earlier photo-hero call over-weighted differentiation against
  addressable intent — "upload a photo" quietly excludes the casual
  majority). The hero is a live-feeling demo: a typed brief ("Dad ·
  60 · his allotment") dissolving into three REAL cards, rotating
  across audiences so it reads universal. CTA "Make theirs in
  minutes"; secondary "Put them in the picture". ACT TWO, one scroll
  down, is the photo route at full ceremony — the 3D card, the moat,
  "the one they keep forever". Then rack rails. The demo must be
  unmistakably ours (real engine output, specific briefs) or the
  page reads as a generic AI card site — quality IS the
  differentiation at the top of this funnel.
- **/cards/… (catalogue + SEO pages)** → leads with CARDS, and its
  maker CTA is the QUICK maker (the arrival was searching for a
  card, not an experience). Photo route appears as the step-up rail.
- **/make** → leads with Q1, because everyone here tapped an intent
  button to arrive (guided maker rule: never start the conversation
  with someone who hasn't sat down).
- **/studio** → the logged-in workspace; leads with your cards.

## 3. Sitemap

```
/                       Homepage: quick-maker demo hero → photo route act two → occasion rails → proof
/cards                  Catalogue hub: occasion tiles + bestseller wall
/cards/birthday         Occasion page (the uniform template, §4)
/cards/birthday/18th    Age aisle (one per: 1st…13th, 16th, 18th, 21st, 30th…80th)
/cards/birthday/for-mum Recipient aisle (mum, dad, nan, grandad, sister, brother,
                        her, him, best-mate, daughter, son… extend with stock)
/cards/birthday/funny   Style aisle (funny, rude, warm)
/cards/birthday/kids    Kids (its own product per the taxonomy: every year an aisle)
/cards/christmas …      Same template per occasion, unlocked BY STOCK (§5)
/cards/birthday/40th-for-dad   pSEO long-tail composites — GATED ON STOCK
                        (Google's scaled-content rule: real cards or binned)
/make                   Quick maker (guided). /make?occasion=birthday&age=40 —
                        every aisle deep-links in with fields pre-answered
/studio                 The photo route + workspace (existing product, untouched flow)
/card/:slug             Single card page (fixed OR editable; the pSEO leaf + share unit)
```

URL grammar copies the market's (`/cards/birthday/18th` reads like
Moonpig/Thortful) because SEO arrivals pattern-match known shapes.

## 4. The uniform occasion page (one template, every world)

Top to bottom:
1. **Title + one-line world copy** (H1 = "Birthday Cards", the SEO
   head; copy in brand voice, not keyword soup)
2. **The maker invitation** — one slim band, not a hero: "Tell us one
   thing they love — we'll make three just for them" → /make
   pre-filled. THE PAGE SELLS CARDS FIRST; the maker is the twist.
3. **Card wall** — the rack, filterable by the four slices
4. **Aisle rails** — By age / By recipient / By style, linking the
   subcategory pages (internal linking = the SEO lattice)
5. **The step-up** — photo-route rail: "Or put them in the picture"
6. FAQ block (delivery, editability, sizes — the schema.org fodder)

Every card tile: front image, the line, price, two actions —
**"Make it theirs"** (editable → short wizard; fixed → inside-only
personalisation) and buy-as-is.

## 5. Stock thresholds (what unlocks a page)

Grounded in what the rack actually holds (birthday ≈ 141 today,
growing; other occasions ≈ 0 until their studio sittings):

| Page | Minimum to publish | Why |
|---|---|---|
| Occasion page | **24 cards** across ≥3 aisles | A wall, not a shelf; Google-credible |
| Age / recipient / style aisle | **8** | Below 8 reads bare; noindex until then |
| pSEO composite (40th-for-dad) | **6** | Leaf pages are judged hardest |
| Homepage rail | 6–8 per rail, hand-picked | Curation, not recency |
| Kids aisle | 8 per age year | Different product, same bar |

Birthday can publish its hub + ~6 aisles TODAY. Each new occasion
needs roughly two studio sittings (~50 generated, keep ~25) to clear
its hub bar — that is the content roadmap, and it is deliberately
the same activity as engine QA (build stock = test worlds).

## 5b. The pick, when goes multiply — the shortlist

Three options is a gift; nine is paralysis. The quick maker's pick
screen handles accumulation with ONE mechanic, the capped shortlist:

- Each card: **"This one"** (ends the flow) or **keep it back** —
  pins it to a shelf above the trio.
- "Three new ones" rolls a fresh trio UNDER the shelf; the near-miss
  is safe, so regenerating stops feeling like gambling a good card
  away (loss aversion is why regen buttons go unpressed).
- **The shelf caps at 3.** Keeping a fourth asks which drops — the
  forced trade is the decision mechanism; comparison converges
  instead of accumulating.
- Everything un-kept **evaporates**. Generations are ephemeral; only
  the PICKED card becomes a draft. No hoard in the studio, no image
  storage for unpicked fronts, and the daily cap (5 sets) bounds a
  session at 15 seen / 3 held / 1 chosen.
- The live question is only ever "these three, or roll again?" —
  never a gallery audit.

## 6. The two creation routes — separate flows, one platform

**They stay separate.** The quick maker never asks for a photo; the
studio never loses its ceremony. The bar-height difference is the
point: collapsing them into one flow with a photo-optional step would
make the quick route slower and the photo route shallower.

**They converge at the pipeline**, which is already shared: pick →
inside → reveal → Giving Moment → checkout → drafts. One drafts
list, one order history, one reveal.

**In the studio workspace**: one "New card" moment with two tiles —
"Quick card — three options in minutes" / "Put them in the picture —
made from their photo". The occasion builder is a *creation mode*,
not a second studio. Sidebar IA (Drafts / Ready / Sent) untouched;
drafts carry a small mode badge.

**Naming (customer-facing):** never "occasion builder" / "photo
route". Working names: **"Quick card"** and **"Put them in the
picture"** (the existing brand line does the work).

## 7. SEO architecture

- Head terms are unwinnable (41k birthday cards at £2.50 on
  Thortful). The lattice exists to win the LONG TAIL: milestone ×
  recipient × style composites, and eventually interest pages — the
  generator serves "crown green bowls birthday card" and no shop on
  earth stocks it. Interest pages come LAST and only stock-backed.
- Every aisle page: canonical (already fixed site-wide), unique
  H1 + 60-word world copy, card grid server-rendered, FAQ schema,
  breadcrumbs. Internal links: hub ↔ aisles ↔ composites ↔ /make.
- **The maker is the conversion twist on every SEO page**: arrivals
  who don't love the 8 cards shown are one tap from three made for
  them — that is the answer to thin-stock anxiety, and no
  incumbent can copy it.
- `/card/:slug` pages double as share targets (sent cards' public
  faces) — organic acquisition from every recipient.

## 8. Style

Defined, not redesigned here: current homepage look; hero-card
pattern on product surfaces (3D card owns the screen, chrome
recedes); clean type on info surfaces; the studio's paper/hairline
"Keeper skin" direction for the workspace. The catalogue borrows the
card-wall discipline from the Keeper LP blueprint: photography-grade
card images, generous white, no decoration competing with the cards.

## 9. Build order

1. **/cards/birthday** hub + the 6 aisles stock already supports —
   proves the template, starts SEO clock
2. **Card tile → short wizard** ("make it theirs" on editable stock)
3. **Homepage two-speed strip** + occasion rails (photo hero stays)
4. **Studio "New card" fork** (two tiles; occasion builder becomes a
   mode)
5. Occasion #2 (Christmas — seasonal clock decides) stocked, then
   its hub from the same template
6. pSEO composites once aisles are 8+
7. Interest pages — later, stock-gated, solicitor-checked for brand
   terms

## 10. Open calls for Aidan

1. ~~Homepage hero~~ — DECIDED 2026-08-22: quick-maker demo hero,
   photo route as act two at full ceremony.
2. "Quick card" as the customer-facing name — better ideas welcome
3. Kids aisle placement: inside birthday (recommended) or top-level?
4. Buy-as-is on fixed cards at launch, or personalise-inside-only?
5. Which occasion gets stocked second (Christmas recommended —
   September SEO clock).
