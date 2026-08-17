# Scope: Occasion intelligence for the Quirky engine

*Scoped with Aidan 2026-08-17, off the back of the first full bench
runs. Status: SCOPED — phase 1 approved in principle, not started.*

The insight (Aidan's): **every occasion carries its own buyer mindset**,
and the engine currently treats them all as "birthday with different
words". A Father's Day card wants bad dad jokes. A baby shower card must
not be masculine if it's for a girl. Sympathy must not joke AT ALL. A
21st lands differently from a 45th even for the same hobby. And the
buyer is not a neutral party: **most greeting-card buyers are women**
(UK industry figure is roughly 8 in 10), which means our current
defaults — moody saturated grounds, workwear slab serifs, fishing-and-
football test briefs — have quietly tuned the whole look masculine.

The trap to avoid: this is NOT 21 separate engines, 21 prompts, or 21
styles. It is ONE engine (writer → judge → renderer, already built and
benched) plus a **structured profile per occasion** injected into the
prompts the way `characters` and `cheeky` already are. Everything about
yesterday's work carries over untouched.

---

## The shape: an occasion profile

One constant map, `OCCASION_PROFILES`, keyed by the ~19 chip occasions,
each profile a small structured block:

- **mindset** — what the buyer is feeling and shopping for, one
  sentence. ("Father's Day: affectionate mickey-take; the dad joke is
  the genre and is WELCOME here, overriding the usual groan-pun rule.")
- **humour** — full / gentle / OFF. Sympathy and (sometimes) get-well
  turn the Quirky "turn" machinery OFF — the turn test, cheek, and
  disproportion are all wrong there. This is the single most important
  field; today the engine would write a joke on a sympathy card.
- **palette temperature** — where the ground should sit for this
  occasion (wedding: bleached, airy; Christmas: deep and candlelit;
  new baby: soft mid-tones, NEVER gendered unless the brief says).
- **motif inflection** — what the occasion contributes visually, and
  its banned clichés (birthday: number yes, balloons/cake NO — the rule
  exists but needs the profile to give it teeth per occasion).
- **register** — formal ↔ matey bounds. Anniversary from him→her reads
  different to her→him; wedding is the couple, not one person.

**Free-typed occasions** ("21st", "gender reveal", "baby shower",
"passed her driving test") are classified by the writer model itself to
the nearest profile — plus extracted milestone numbers (already
working: "his 60th" → 60 in the artwork) and any gender signal. No
lookup table can enumerate what people type; the model can, and the
profile keeps it on rails. Unknown → the generic celebration profile.

**Recipient inflection** (phase 2) is the same idea for WHO: age
signals, gender signals (only ever from the brief, never inferred from
the hobby), and relationship register. Also where the masculinity
correction lives: the default aesthetic should assume the buyer is
probably a woman buying for someone she loves — warmer, brighter, more
range — with moody-masculine as the marked case, not the default.

## Phases

**Phase 1 — the occasion brain (~a day).** `OCCASION_PROFILES` for the
19 chips + free-text classification + humour OFF for sympathy.
Prompt-Lab-first rule applies when this ships to customers; in the Lab
it stays a constant. Gate: bench with an occasion-diverse brief set
(sympathy, wedding, Father's Day, baby, 21st — not five birthdays).

**Phase 2 — recipient inflection (~half day).** Age/gender/relationship
register, anniversary direction, and the de-masculinising of defaults.
Gate: bench the same interest across different recipients ("Nan",
"my sister Kate, 21", "my husband") and see the sets diverge.

**Phase 3 — the type-led card (~half day, independent).** A fourth
composition where TYPE IS THE ARTWORK — no motif, the words huge,
beautifully set, the ground and one accent doing everything (the
Thortful-style text-only card). Slots into `QUIRKY_FORMATS` beside
statement/hero/pattern/label; the concept writer chooses it when the
line is strong enough to carry a card alone. Cheap, and it directly
addresses "the text doesn't always fully land" — a text-only card
forces the line to be good.

**Phase 4 — SEO occasion routes (post-maker, marketing).** Every
profile becomes a landing route ("/cards/21st-birthday", "/cards/new-
baby") pre-filling the builder. This is where the commercial value
compounds — but it needs the customer maker live first, so it queues
behind the Prodigi print test and the maker build.

**Phase 5 — style packs (parked).** The Thortful designer look as a
second house style (soft florals, scripts, feminine-leaning). Parked
deliberately: occasion + recipient profiles may get most of the way
there by pulling palette and type per audience, and a second style
doubles every future style fix. Revisit only if phase 2's bench still
reads masculine.

## Rules for the build (lessons already paid for)

- One phase per sitting, benched before and after. Yesterday's fatigue
  came from stacking untested changes.
- Profiles are DATA, not prose scattered through the prompt. One
  injection point, like the cheek block.
- No sample sentences in profiles — grammars and constraints only
  (sample lines get copied verbatim; "the Reel deal" lesson).
- Sympathy ships in phase 1 or the feature doesn't ship: a joke on a
  sympathy card is the single worst card we could print.
- The buyer test stays supreme: profiles sharpen the aim, they never
  add obscurity.

Related: [[SCOPE_QUIRKY_MAKER.md]] (the flow this feeds),
[[SCOPE_NO_PHOTO_CARDS.md]] (strategic case). The Prodigi test print
remains the gate on the whole product and none of this changes that.
