# Plan: the Birthday world — occasion #1

*Aidan's pick, 2026-08-17. First run of the
[[SCOPE_OCCASION_FIRST.md]] playbook. Birthday is the volume market
and the widest tone range — if the process works here it works
anywhere. This document is the build plan; it gets edited as reality
arrives.*

## What "the birthday world" means at v1

One landing route (`/birthday-cards`) that owns its search intent,
containing:
1. **The rack** — Aidan's saved templates, curated, browsable by tone
   and recipient. Buying a template = fixed front, personalised inside
   (the existing inside builder, checkout and print path unchanged).
2. **The maker door** — "make one about them": the interest-led maker,
   running a BIRTHDAY-DEDICATED prompt, producing three takes to
   refine and buy. Same £8.99 product either way.
3. **Milestone side-doors** (SEO): `/birthday-cards/21st` etc., same
   world filtered, where the number-in-the-artwork trick is the whole
   pitch. Market treats milestones as first-class aisles; so do we.

NOT in v1: 35 recipient aisles (the market's full ladder), card packs,
gifts, digital anything. One world, done to taste.

## Workstreams, in order

**WS1 — Research pack (half a day, mine).** Finish what the Thortful
pass started: milestone-by-milestone tone scan (their /birthday/18,
/21, /40, /60 aisles via the alt-text method — how does an 18th differ
from a 60th in tone and design); inside-message conventions (their
"what to write" content); Moonpig + Scribbler + Card Factory structure
via search (premium, edgy and value poles); SEO keyword list drafted
from the aisle names, validated against GSC once live. Output: one
research doc Aidan corrects with taste.

**WS2 — Design direction (half a day + Aidan's red pen).** From the
research: the birthday world's palette families BY tone × age band
(18-25 energy, 30-50 knowing, 60+ warmth-and-pride — but written from
evidence, not these guesses); type moods per tone; motif conventions
(the NUMBER as artwork is ours to own); density mix including typeled
(bestseller-validated). One page. Nothing builds until he signs it.

**WS3 — The birthday prompt (a day, benched).** Dedicated writer
prompt: shared craft floor + the birthday world spec + a buyer-facing
TONE parameter (see D3) + age-aware register from the brief. Its own
fixed bench sheet (recipient × tone × age matrix) so birthday
regressions are visible forever. Goes into Prompt Lab slots before any
customer spend (the rule stands).

**WS4 — Save-as-template (half a day, FIRST build).** `card_templates`
table (occasion, tone, recipient hint, front image → R2, full recipe:
front_text / palette / typeface / format / art_direction / angle), a
save button in the Lab, a browse grid. From the moment this exists,
every test run Aidan does seeds the rack.

**WS5 — The testing loop (Aidan's week, my support).** He runs
birthday briefs in the Lab, saves keepers, says what's wrong in his
own words; I turn notes into prompt edits, benched before/after, one
change at a time. The rack grows as a by-product. Exit condition: he
can run five briefs and want to save from most of them.

**WS6 — THE PRINT GATE.** The first template he loves goes through
composeCardPrintStrip to a real Prodigi order. Nothing customer-facing
ships until the card has been held. This is the oldest open gate on
the whole product line and it closes here.

**WS7 — Birthday world v1 (2-3 days).** The landing route, the rack,
the maker door, three milestone side-doors. Then it's live, and
occasion #2 starts with a proven playbook.

## Decisions that are Aidan's (the taste dials)

- **D1, the age-roast.** The market's best-selling funny-birthday seam
  is the affectionate old-age roast; our engine currently bans age
  jokes outside rude mode. Recommendation: allow the roast inside the
  "funny" tone as an explicit choice, keep it out of warm tones. His
  dial to set during WS5.
- **D2, swearing.** Top-three bestsellers print unmasked profanity;
  our house style masks (f***). Recommendation: HOLD the mask — it's
  differentiation (mantelpiece-safe) and it renders reliably — and
  revisit only if testing says the rude rack underperforms.
- **D3, the tone menu.** Buyer-facing tones for the birthday world —
  recommendation: Funny / Warm / Cheeky (+ Rude behind the existing
  toggle), mapped internally onto the three-angle machinery so every
  tone still yields three genuinely different cards.
- **D4, milestone order.** Which three side-doors first — 21st, 30th,
  40th? 18th? His market instinct beats mine.

## What carries in from the engine, free

The craft floors (titles, invented dates, Americanisms, IP artefacts,
safe margins, metallic inks), the writer→shortlist→judge-selector,
typeled, recipient inflection, the serious-mode guard (a birthday
brief that mentions a recent loss exists — "first birthday since...";
the classifier already routes grief words to sympathy machinery),
gpt-5.4 at 11.6s with gpt-5.5 held for offline catalogue generation,
the bench + build stamp discipline.

## Sequencing and the honest estimate

WS4 and WS1 run first and in parallel (build + research don't
collide). Then WS2 → WS3 → WS5 loops → WS6 print → WS7 live.
**Roughly two weeks to a live birthday world**, dominated by WS5 —
which is the point: the slow bit is Aidan's taste being applied, and
that is the product now.
