# UX — THE GUIDED MAKER (customer front-end for the v2 engine)

**Scoped 2026-08-21 from Aidan's brief:** *"I like guided tbh... More
conversational - Typeform approach? Right, who's this card for? Should
we mention their age? Tell us one thing they're into (I don't think 2
things are needed tbh)... Should we mention their name on the front?
And what's the tone (3 options and one of each?) - then generate the
front... sign it off... render inside... etc."*

This is the doc the build works from. Not started; nothing here is
shipped.

---

## The shape: one question per screen, five taps to magic

Guided won over the form for four reasons:

1. **It matches the promise.** "Type a few words, get 3 options that
   land" is a conversation, not a form. A form says *work*; a question
   says *we've got this*.
2. **It feeds the archetype clean data.** One field per screen means
   recipient, age, interest and tone arrive as separate typed values —
   which is exactly what the engine runs on. The studio proved chips
   beat free text (bounded relationships, tone chips); the guided flow
   is that lesson as a whole UX.
3. **Mobile-first for free.** One question per screen IS the mobile
   layout. The current builder's grid is a desktop idea.
4. **Each answer builds anticipation.** The flow is allowed to feel
   like the card taking shape — which the generation narration then
   pays off.

**The discipline that keeps guided from becoming a slog: five steps to
the generate button, every optional skippable in one tap, and no step
that exists for our benefit rather than theirs.**

---

## The flow

Voice throughout: **"we", never "the AI"**. Copy below is draft v1.

### Q1 — "Right — who's the card for?"
Chips: Mum · Dad · Nan · Grandad · Sister · Brother · Daughter · Son ·
Partner · Best mate · Friend · Colleague · Someone else.
- "Someone else" replaces the studio's "Anyone" (a customer always has
  someone in mind; "Anyone" is a rack-building concept).
- Family chips carry implied gender exactly as the studio does; a
  quiet "for a… him / her / not saying" row appears only for the
  ambiguous chips (Partner, Best mate, Friend, Colleague, Someone
  else).
- ⚠️ NO auto-advance on chip tap. The studio maker tried it and it was
  turned off (mis-taps, and the moment to change your mind vanishes).
  Big Next button, always.

### Q2 — "How old are they turning? (skip if you'd rather not say)"
Number pad. Skip is a first-class button, not small print.
- ⚠️ EXPLAIN WHAT THE AGE DOES (Aidan): giving it means the number
  goes ON the card. Copy: "If it's a big one — 18, 21, 30, 40… — we
  recommend it: the number becomes the star of the card. Any other age
  we'll use with a lighter touch." (True to the engine: milestones
  lead all three cards; ordinary ages appear once and still tune the
  voice.) Skip copy: "Skip it and no age appears anywhere."
- If age given: the band system does its work invisibly; under-18
  quietly removes Rude from Q3 and the copy never mentions why.
- If skipped: ageless card, no number anywhere (existing rule).
- ⚠️ ORDER DEPENDENCY: age must come BEFORE the vibe step — the age
  answer is what hides Rude. This is why vibe cannot be Q2.

### Q3 — "What's the vibe?"
Four chips: **Funny · Warm · Rude · One of each**. MOVED ABOVE the
interest step (Aidan, 2026-08-21): the dislike option only exists on
funny and rude, so tone has to be known before that screen renders.
- Rude chip sets expectations honestly: "proper swearing, asterisked".
- Rude hidden when age < 18; "One of each" under 18 resolves per the
  open question below.
- A dislike on a WARM card is joke fuel with no joke to power — the
  engine builds the dislike card as a gag, so warm hides it.

### Q4 — "Tell us one thing they're into. One's enough — the thing
you'd mention first."
Single free-text field. One thing only, by design (Aidan: "I don't
think 2 things are needed").
- Placeholder rotates real examples: *fishing · Ibiza · their
  allotment · Man United · Toy Story*.
- **Skip = "Keep it classic"** — the generic roll is a real product
  (built, live), so skipping here is a choice, not a failure. Copy:
  "No worries — we'll make it a beautiful birthday card, no homework."
- ⚠️ THE SPECIFICITY NUDGE — the single highest-value line of copy in
  the whole flow, confirmed by weeks of testing (specific beats
  category, four separate times): "The more specific, the better the
  card — 'Man United' beats 'football', 'their allotment' beats
  'gardening'."
- ⚠️ The event-vs-love reading (a trip reads FORWARD) is engine-side
  already; the question's phrasing deliberately allows both — and one
  sub-line makes it explicit: "A trip or a plan counts too."
- **Dislike, on this screen, funny/rude only** (Aidan's call): a small
  "+ something they can't stand?" link, not a step. Expectation set
  where it's typed: "we'll build ONE of the three cards around it" —
  the locked one-card rule, said up front so nobody wonders why the
  other two ignore it.

### Q5 — "Want their name on the front? (we'll design it in properly)"
Name field + skip. Sets `recipientName`; one card leads with the name
designed-in, exactly as the studio does.
- ⚠️ SPELLING WARNING, prominent: "It'll be printed exactly as you
  type it — worth a double-check." A misspelled name on a printed
  card is the worst error the product can make, and the engine prints
  letter-for-letter by design.

### Generate → THE PICK
- Generation narration screen (exists — personalised step narration).
- Three fronts land. This is the shop moment: cards big, minimal
  chrome, tone label per card when "One of each".
- Actions per card: **This one** · (regen = "Start again with these
  details" — the locked regen decision, no tweak workbench).
- Fronts count toward the daily cap (existing decision).

### THE INSIDE — "sign it off"
Existing machinery, guided skin: Dear X → message (helper is PARKED
for Premium; plain field now, "or leave it blank to write by hand" —
the blank-inside footgun copy exists) → From Y. `insideMode`
auto/own/blank already in the engine. Inside renders in the front's
medium (existing rule).

### THE REVEAL → THE GIVING MOMENT → checkout
All exist: 3D reveal (blank-until-click rules), Giving Moment screen
(format + destination), Stripe checkout. This flow plugs into them; it
does not rebuild them.

---

## Engine work required (the only new backend)

### 1. "One of each" = tone-per-slot (mixed mode) — Q3's fourth chip
Today tone is per-SET. Mixed mode makes tone a slot property like
angle/length/territory/ground (law 4 — structure is the server's):
- Slots: one funny, one warm, one rude (order shuffled), each with its
  own tone brief line; the occasion brief carries all three registers
  labelled per slot.
- Floors adapt: rude-floor applies to THE RUDE CARD alone (1 front
  carries real masked swearing, not 2-of-3); warm card exempt from
  joke floors; dislike-carries-one-card unchanged.
- Prompt-length risk: three tone briefs in one prompt. Mitigate by
  sending the band brief once and the tone lines compressed. Bench
  before shipping (set-acceptance harness gets a mixed arm).
- Under-18: "One of each" becomes Funny · Warm · Funny? No — becomes
  funny/warm/funny+warm-lean; label honestly ("one of each" hidden
  under 18, or swaps Rude for a second Funny silently — decide at
  build).

### 2. Customer endpoints
`/concepts` and `/render` are admin-gated. Customer flow needs:
- Auth'd customer routes wrapping the same pipeline — no new
  generation logic, same floors, same referee.
- `memory: false` (LOCKED decision: cross-run memory is a
  rack-building tool; customers are fresh eyes).
- Daily cap (photo maker has one; same pattern).
- comp_mode coin, colour system, IP posture: all inherited untouched.
- IP-safe retry: customer-facing copy ("That one didn't come out —
  want us to have another go?") — same endpoint, gentler words.

### 3. Nothing else
The engine is the engine. The guided maker is a THIN CLIENT over v2.
If a UX idea needs a new prompt, it's out of scope for this build.

---

## What testing says must be EXPLAINED (the microcopy list)

Everything below is a lesson this engine actually paid for, surfaced
as one line of customer copy at the moment it matters:

| Where | The line (draft) | The lesson behind it |
|---|---|---|
| Age | "Big birthday? We recommend adding it — the number becomes the star." | Milestones lead all three; ordinary ages tread lightly |
| Age skip | "Skip it and no age appears anywhere." | Wrong-guess age = ruined card; we never infer |
| Vibe: Rude | "Proper swearing, asterisked." | Masked f/s/c, enforced in code |
| Interest | "'Man United' beats 'football'." | Specific beats category — the biggest quality lever we have |
| Interest | "A trip or a plan counts too." | Events read forward; no invented history |
| Interest skip | "We'll make it a beautiful birthday card, no homework." | The generic roll is a product, not a fallback |
| Dislike | "We'll build one of the three around it." | The locked one-card rule |
| Name | "Printed exactly as you type it — double-check the spelling." | Letter-for-letter by design |
| Generating | Expectation + narration screen, ~30–60s honest | Wait-state law: expectations up front |
| A refused card | "That one didn't come out — want us to have another go?" | IP-safe retry, gentler words |
| The pick | Tone label on each card when "One of each" | The mixed set must be legible |

What we deliberately do NOT explain: why Rude vanished (under-18),
how the engine works, anything about IP rules before they bite, and
anything with the word "AI" in it.

## What this is NOT (v1 fences)

- NOT the photo maker. No photos of people anywhere in this flow (no
  people in the occasion flow — locked). The two makers stay separate
  products until proven otherwise.
- NOT occasions beyond Birthday. The flow ships when Birthday is
  strong; the occasion chip row comes when a second world is built.
- NOT the catalogue/rack browse. Editable stock entry ("or pick one
  we made earlier") is its own build; leave a slot for it on the
  landing step, don't build it.
- NO tweak workbench (PARKED for Premium — locked). Regen is "start
  again with these details", full stop.

---

## Build order

1. **Mixed-tone engine mode + bench** (the only risky bit — do it
   first, in the lab, behind the existing studio so Aidan can eyeball
   sets before any customer sees one).
2. **Guided shell** — the five questions, static, wired to existing
   admin endpoints in a dev flag, desktop+mobile.
3. **Customer endpoints + caps** (memory=false, daily cap, auth).
4. **The pick + inside + reveal integration** (mostly plumbing into
   existing screens).
5. **Copy pass with Aidan** — every question's wording is brand voice;
   his call line by line.

## Open questions for Aidan

1. ~~Dislike~~ — DECIDED (Aidan, 2026-08-21): lives on the interest
   screen as a "+ add" link, funny/rude only.
2. **Under-18 + "One of each"**: hide the chip, or quietly swap rude
   for a second funny?
3. **Daily cap number** for the guided maker (photo maker precedent).
4. **Entry point**: where does this live — /make, replacing the
   current maker's front door, or beside it? (Ties to the two-maker
   question.)
5. **"One of each" as the DEFAULT selection on Q5** — bold move,
   shows range, but means rude reaches people who didn't ask. My
   instinct: default nothing, require a tap.
