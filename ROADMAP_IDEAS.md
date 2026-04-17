# Celebrait — Roadmap Ideas

Parking lot for "great future thing, not now." One-liner per idea with just
enough context to pick it up later. Add freely; prune when built or killed.

---

## Growth & retention

### Occasions / reminders
Users save recurring dates (Mum's birthday, wedding anniversary) and get a
nudge N days out: *"It's Mum's birthday in 5 days — start a card?"*
**Why it matters:** greeting cards are forgetful purchases. Reminders turn
"forgot" into "bought" and drive repeat revenue. One saved occasion ≈ one
card purchase/year minimum.
**Ships after:** Card maker v2, payments, landing-page free-gen funnel.
Premature reminders point at an unfinished product.

### Last-year nudges
"You made Mum a birthday card last year — want another?" Personalised follow-up
in the occasion reminder email. Natural upsell surface.
**Ships with or after:** Occasions.

---

## Product expansion

### Celebration stationery suite (tier 1 — natural extensions)
All share the same "card" DNA — same AI engine, same customer moment,
same print partner relationships, just different cuts + templates.
Target: one wedding customer buys 4+ SKUs → 4× AOV from one event.

- **Invitations** — weddings, birthdays, kids' parties, baby showers, engagement parties
- **Save the dates** — smaller format, precedes invitations chronologically
- **Thank you cards** — post-event. Underserved by AI, huge volume category
- **RSVP cards** — natural bundle with invitations (premium wedding package)
- **Announcements** — baby, engagement, moving, graduation
- **Order of service / wedding programs** — premium paper spend category
- **Menu + place cards** — dinner parties, weddings, milestone birthdays

**Why it matters:** bigger market, higher AOV for events, reuse of existing
infrastructure. Informs the sidebar nav structure (which is why the sidebar
was chosen over top-nav in Sprint 2).
**Ships after:** Core greeting card flow is polished and converting.

### Paper/print family (tier 2 — slight stretch)
Still print, still celebration-related, but requires new print specs.

- **Framed AI portraits / prints** — "Dad's 70th in oil painting style" as a wall piece
- **Personalised calendars** — 12 AI-generated scenes, one per month, annual repeat purchase
- **Photo books** — compile a year of cards/scenes into a keepsake
- **Christmas card bulk orders** — 50+ personalised cards for family mailout lists
- **Gift tags** — high-volume impulse add-on to main order

### Custom apparel (tier 2 — separate product line)
Hen/stag t-shirts, family reunion merch, milestone birthday group shirts.
Vistaprint does this badly with clipart — AI could produce custom cartoon
group portraits no one else offers.

**Why it works:** bulk orders (10-20 shirts per order), £200-400 AOV,
differentiated product. Hen/stag especially is an underserved AI niche.
**Why it's a different business:** DTG garment printers (not card printers),
sizing matrices, higher return rates.
**Ships:** Sprint 8+. Own workflow + supplier relationships.

### Party collateral bundles (tier 3 — stretch)
Full event packages around one celebration: banners, balloons with faces,
photo-booth props, custom wrapping paper, favour bags.
**Why interesting:** sells as "Dad's 60th package" = 5× AOV from one moment.
Real business-model shift to event bundles.
**Why risky:** more print partners, SKU complexity, harder to demo online.

---

## Digital products strategy

### The thesis
Digital is **the acquisition funnel, not the product**. "Sell the AI image"
is a dead business — ChatGPT commoditises that. Celebrait's moat is the
curated prompt library, style presets, house style, and the 100+ hours of
prompt engineering that makes outputs reliably good — plus the physical
fulfilment on the back end.

### The funnel
1. **Free digital card with watermark** — homepage generation hook
2. **£0.99 digital card without watermark** — low-friction conversion
3. **£4.99 printed card + delivery** — the real margin (~£2.70/unit)

Digital proves intent. Physical prints the money.

### Worth selling digitally
- **Instant e-card delivery** — email/WhatsApp link with animated reveal.
  Same-day "oh shit it's today" sends is a huge underserved market
- **Video messages** — AI-animated cards as short video. ChatGPT can't do this
- **Bulk digital packs** — "50 personalised thank-yous for wedding guests, £29"
  (nobody does 50 iterations in ChatGPT manually)
- **Social share templates** — card auto-reformatted to square + 9:16 Story

### Not worth selling digitally
- Single static "just the image" downloads (ChatGPT commoditises this)
- Stock-style template libraries

### Format rule for digital products
- **Digital-native → portrait** (phones, Stories, WhatsApp previews, email on mobile)
- **Physical → whatever the product demands** (greeting cards square, invitations
  often portrait, banners landscape)
- **Digital bonus attached to a physical order → match the physical format**
  (don't re-crop what they already bought)

---

## Card maker polish

### Character anchor (revisit)
Face-analysis-to-text feature currently lives in the Prompt Lab only
([project memory](./… /memory/project_character_anchor.md)). Not worth the
extra ~3s per generation in the customer flow for marginal likeness gain.
**Revisit if:** post-launch feedback shows likeness is the top complaint.
Infrastructure exists, it's just not wired to the customer path.

### Photo library organisation
Once users have >10 photos, the library picker needs structure — labels
("Mum", "Dad"), tags, or collections. `label` column already exists on
the `photos` table, just no UI yet.
**Ships when:** heavy users hit friction finding the right photo.

---

## Business & ops

### Dual-currency checkout (GBP + ZAR)
Stripe for UK/international (GBP), Paystack for South Africa (ZAR).
Detect region, pick provider. Paystack wiring still in the codebase.
**Ships in:** Sprint 4 (payments).

### Admin analytics
Back-office dashboard alongside Prompt Lab — conversions, card statuses,
revenue, refund rate, provider mix (OpenAI vs Gemini vs FLUX cost-per-card).
**Ships when:** there's real traffic to analyse.

---

*Add ideas liberally. Delete when shipped or killed.*
