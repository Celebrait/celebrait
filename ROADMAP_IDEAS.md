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

### Invitations + other celebratory print
Studio isn't just greeting cards long-term — invitations, thank-you cards,
save-the-dates, maybe event stationery. Same card maker engine, different
scene/layout templates per product.
**Why it matters:** bigger market, higher AOV for events, reuse of existing
infrastructure. Informs the sidebar nav structure (which is why the sidebar
was chosen over top-nav in Sprint 2).
**Ships after:** Core greeting card flow is polished and converting.

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
