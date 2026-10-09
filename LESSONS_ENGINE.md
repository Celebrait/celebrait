# LESSONS — what the first engine taught us, for whoever builds the second

**Written 2026-08-19 at the close of the audit, before the rebuild.**
Aidan: *"Are there any other key learnings we've built up before we
essentially start from scratch?"* Everything below was paid for with a
real observed failure. The rebuild reads this first.

## Laws of working with the writer model

1. **Positive examples become a menu.** Any concrete phrase, object or
   reference in an instruction gets copied out or orbited. "The first
   proper hangover" → "and a hangover"; naming platform 9¾ → every HP
   set built on it; four typeface examples → verbatim on cards. Even
   ANTI-leak rules leak: rendering `"18."` inside the rule banning that
   prefix kept the prefix alive (8/9 → 3/9 only after describing the
   shape in words). **Describe territory. Render nothing copyable.**

2. **Named observed failures are the only rules that stick.** "Seas the
   day", the crossed-out telly, "Cushty at 40, My Arse", "18 is mainly
   forms" — each named failure stopped its class. Abstract rules and
   buried sentences do nothing ("mine that world's vocabulary" sat
   inert for weeks until the Royle failure was written into it).

3. **Length drowns guards.** The front-scene prompt failed at 21.5k
   tokens and worked at 5.5k. The writer prompt at ~11k lost arguments
   with itself; condensing 25% IMPROVED output. One added clause once
   flipped a stable 5/5 check to 4/5 in an unrelated case. Past
   ~9–10k tokens, adding a rule weakens the others.

4. **A model asked to vary its own structure doesn't.** Typeled took
   the minimal slot 7/7 until the count was pinned server-side; the
   angle order was identical on every set for weeks until rotation
   moved into code. **Structure is chosen by the server, never the
   model.**

5. **Prompt rules hold ~85% each. Guarantees must live in code.** Five
   floors × 85% = most sets break one. The engine warned and shipped
   anyway. This is the audit's whole finding: generate → verify
   deterministically → regenerate the failing card with the violation
   named → ship only clean sets.

6. **Re-screen everything a judge or fixer writes.** Judge rewrites
   walked past the ban list ("Champion of the Perfect Cast") until
   re-checked. Any LLM that repairs output can reintroduce the failure.

7. **Floors phrased as restraint read as permission to skip.** "At
   most one card" was read as "zero is fine". Hedged lines ("good comic
   fuel, but...") lose to the restraint rules around them. Floors go in
   the FINAL CHECK as things to point at — and even that failed once
   (law 1 was the reason). Now they go in code (law 5).

8. **Repetition is invisible one set at a time.** The standards formula
   (11 appearances), the third-party verdict, two rosettes, the list
   angle "fine now and again, dead in bulk" — all only visible reading
   a day's output side by side. Judge at the SHELF level. This is also
   why the engine remembers lines AND motifs across runs, per subject.

9. **Keyword checkers mark the best lines as failures.** Three times:
   "40 YEARS OF HATING REDS" (no 'Liverpool'), "Hatchday/Pourthday"
   (no 'birthday'), "old enough to be asked for ID" (flagged as
   ageing). Good cards are oblique by nature; detectors need the
   sideways vocabulary or they punish exactly what we want.

10. **Measure before fixing, and measure the thing you send.** The
    medium collapse was blamed on the media list (wrong — removing it
    changed nothing) and was actually the three-ink palette rule
    (removing THAT went 83%→60% concentration). A cost estimate off
    the source file was 7× wrong vs the real string. Two hypotheses in
    a row were wrong from someone who'd been right all day. ~60p of
    measurement beats any instinct.

11. **A/B on identical briefs settles arguments — but bulk-view the
    winner.** Proud vs list: list won 5/5 individually and failed on
    the shelf. Both tests, always.

## Product truths (survive any engine)

- **The buyer is not the fan.** A daughter buys the HP card for her
  dad. Famous layer only — the reference a non-fan could name.
- **IP: the hard core is SMALL — challenge any rule beyond it.**
  (Aidan, closing: "this might limit visual reference that is ok.")
  Genuinely load-bearing: actual logos/wordmarks/crests, faithful
  copyrighted CHARACTERS as themselves (a Moana brief drew Moana),
  photoreal likeness of private individuals. Everything else is OPEN
  and must be POSITIVELY encouraged, not grudgingly permitted:
  caricature of public figures, real places, the styling/kit/era of
  any world, evocation as strong as you like. ⚠️ A prompt full of
  bans teaches timidity BEYOND the ban — the Oasis set drew generic
  speakers when parkas, bucket hats and Gallagher caricature were all
  already allowed. Words got loud permission ("SAY THE NAME") and
  recovered; pictures never got the equivalent. The rebuild grants it.
  Quote the short iconic phrase — it is often the whole card.
- **Specific beats category — confirmed by Aidan four separate times**
  ("sea is not Moana" / "dance music generic aren't they?" / "why
  would the model not show it better?" / the Royle mix-up). Keep the
  LESSON, not the lectures: in the rebuild this is what the ARCHETYPE
  produces, and what the acceptance harness tests for — not prompt
  paragraphs.
- **Read the whole brief before deciding what the subject is.**
  "The Royal Family on TV" + "Neighbours" in dislikes = the sitcom.
  Expect near-miss spellings. Split the set when genuinely ambiguous.
- **Derived facts attach to the RECIPIENT only.** Birth year from age
  is legal; welding it to the band ("50 YEARS. OASIS STILL MATTERS.")
  is a printed factual error.
- **Milestones lead all three cards; ordinary ages appear on once.**
  Nobody throws a party for a 37th. Say the number ONCE per card —
  artwork or words, never both.
- **The age bands are different worlds** (aisle-scanned): kids=pure
  celebration, 16=irony off, 18–21=threshold, 30–40=expiry, 50=
  defiance+era begins, 60=era, 70=elevation (the joke praises), 80=
  warmth leads. Mockery peaks in the middle, vanishes at both ends.
  Kids get every year as an aisle; adults get decades. Kids is a
  different PRODUCT: words for the adult reading aloud, art for the
  child, no rude, no roast.
- **Registers: funny / warm / rude.** Cheeky was defined by its
  neighbours = not a register. Rude is a lane (bestseller top 3,
  Scribbler), never a modifier over warm. Under-18 always clean.
- **Sincere is the majority of the market's wall** (Mum aisle ~65-70%),
  but OUR sincere must stay specific — their "wonderful Mum with love"
  genericism is forced by mass stock; we don't have that excuse.
- **Editable stock test at Keep time:** still good with someone else's
  words on it? One-pun cards are one-offs, not stock.
- **Catalogue axes:** recipient (market's first axis) × milestone ×
  register. Interest is infinite = the generator's job, not the
  rack's. "Partner" is good UX, bad SEO (wife/husband/gf/bf).
  pSEO pages need real cards or Google bins them.

## Mechanics worth carrying over as-is

- Deterministic floors: artefact/IP regex (21 pinned cases), BANNED_
  WORDS (incl. "standards"), grand-title/sole-authority/house-rule
  shapes, REAL_CHEEK swear list.
- Cross-run memory, server-side, lines AND motifs, same-subject +
  global stock puns. Log INSIDE /concepts (client logging missed runs).
- Keep-rate per build (card_generations + build_commit) — the only
  objective quality signal we have.
- The check scripts (landing, band-bleed, gender, milestone-number,
  medium-spread, brief-specifics, ageless, sweep) — becoming the
  acceptance harness's organs.
- Print path: composeCardPrintStrip, IS_THE_CARD_ITSELF (the image is
  the card, not a photo of one), inside must inherit the front's
  medium, 1024 source = 171 DPI at 6" (test prints in the post decide
  low vs high; high is 35× cost and a fresh generation, not the same
  image sharper).
- Free style: medium sets its own palette rules (the three-ink law
  caused the 83% style collapse); faces allowed when the medium
  abstracts them; caricature for public figures; no marks ever.

## Operations

- ~6p per set base; retries multiply it; high-quality renders 21p each.
- The studio's session counter shows images only (~25% of true spend).
- Sweeps ~45-60p: batch them, don't run per-edit.
- Aidan tests the DEPLOYED admin (prod DB); Claude verifies on dev.
  Green locally proves nothing about his screen. Schema changes ship
  WITH their prod SQL or the .catch() swallows the failure silently.
- Aidan runs no commands, ever. Deploy = push. Report results.

## The weekend of the buyer's eye (2026-08-28 → 08-31)

Twenty-odd rules, every one earned by Aidan reacting to a real card at
card-shop speed. The distilled laws:

- **The floors you grade are the product you get.** Rude was defined by
  swear-regexes, so the writer shipped swearing instead of jokes
  (Goodhart). Fix: DEAL the comedy engine per slot (roast / innuendo /
  too-honest truth / misplaced formality) and grade the swear-strip.
- **Check which pipeline actually runs your judge.** The twelve
  model-judged sense floors lived in the LEGACY judge; the v2 path
  returned before reaching it. Every gallery entry was a dead letter
  until v2SenseCheck. Before adding a floor, trace the call path.
- **Make referees hand in their working.** "Write the scene sentence"
  catches what "check the line makes sense" waves through. Same trick
  as the swear-strip: force the work product, not the promise.
- **A menu with a don't sign is still a menu.** Cross-subject fronts
  fed to the writer as an avoid-list leaked their STANCES into new
  sets (the anti-jumper card). Guards that need examples run in code
  (stockPunCheck); the writer only ever sees its own aisle.
- **Rack-level rules beat set-level rules for stock.** Occasion must
  land on every card's FACE (cards sell alone; the inside is
  invisible); swear variety per set still let "bollocks" become the
  RACK's tic across keeps — curation catches what floors can't.
- **The kids register needs cages, not guidance.** The
  wink-for-the-adult licence ate every kids' set until the wink was
  capped (one card, max), LONG register undealt ≤12, office vocabulary
  banned in code, and the child test armed in the sense referee.
- **First-read failure shapes, the gallery so far:** the TELEGRAM,
  the BORROWED TERM, the INVENTED COMPOUND, the UNANCHORED SCENARIO,
  the GARDEN-PATH PUN (puns must parse as plain English first), the
  SWEAR-TAG ("X. F***ing obviously." — twice across subjects = dead),
  and the DECODER TRAP (you can decode them; the buyer gets one second
  — judge at their speed).
- **Identity objects are colour-locked.** A United scarf in
  yellow/black is a factual error; palette variety routes AROUND
  allegiance through neutral objects.
- **The masking law is code** (f/s/c always first-letter+asterisks) —
  two keeps printed obscenity in full while it lived in prompt alone.
- **The factory must show its parts.** /admin/engine renders the live
  prompts and floors from the running code; each card in the studio
  shows its dealt slot. House rule from here: every engine change
  lands with its lesson in this file.

## The curation pass (2026-09-02)

- **Keep ≠ publish.** Keeping is the builder's verdict, publishing is
  the merchant's — merging them put QA output on the shop. Both racks
  now cut to the salesperson test: would this card alone convince a
  stranger the maker is worth £5.99?
- **Your review inherits the blind spots of the API it reads.** The
  catalogue's newest-120 cap hid the 27 oldest cards from the hub, the
  "complete" curation review AND the thumb backfill — an invisible
  shelf still serving on aisle pages. When auditing "everything",
  verify the count against the source of truth, not a payload.
- **Old stock ages out of the constitution silently.** 48 cuts were
  almost all pre-law cards (unmasked swears, drawn IP characters, the
  banned seam) that today's engine cannot produce. After every new
  floor, ask what already-published stock now violates it.
- **The aisle-third rule cuts both ways** — four borderline cards were
  spared solely to keep aisles above threshold; note them for
  replacement when better stock lands (#96, #137, #196, #216).

## 2026-09-03 — The cameo is an EDIT of the picked card, not a redraw
The OpenAI variant runs reference-conditioned GENERATION via the Responses API (`useResponsesGenerate`), so "put them in" was composing a NEW card from the recipe with the photo attached: words moved, palette drifted, people sometimes dropped (the "Moana island 6" miss). Now: `render` accepts `baseImage` (the picked front) + `cameoPhoto` + `cameoMode:'edit'|'redraw'`; edit mode forces `/v1/images/edits` with image[] = [card, photo] and `cameoEditPrompt()` (canvas held exactly, the one change is the people painted in, placement fallback for no-activity cards). Lab chip beside the cameo photo flips edit/redraw for the A/B; maker + research send edit. Note: `input_fidelity` is gpt-image-1-only — gpt-image-2 rejects it. Smoke test on a stored front: composition/words held, figures drawn in-style ($0.006, 23s, low quality).
**Same day, reverted for customers:** the edit kept the card as PIXELS and wedged the person INTO the shirt, half-photoreal (Man United card). Aidan: the redraw "took the existing concept and just reworked it — even if it had to change the card it kept the text style, colours". Maker + research → `cameoMode:'redraw'`; edit stays lab-only (chip). Lesson: for the cameo, concept fidelity beats pixel fidelity — re-staging around the person reads as designed; pasting the person into a finished layout reads as a composite.

## 2026-09-03 — "None of this lands Manchester United": the VARIETY floor was pushing sets off the club's colours
Not IP, not the image model. The `shared-lead` code floor forbade two cards leading with the same hue family and let an identity colour lead ONCE — so a United set was forced to red / teal / royal blue by our own rule. Fix: with a named subject, the family every palette carries is the subject's OWN and is exempt from the lead rule; the writer's palette bullet now says an owned colour LEADS every card and variety comes from medium/shape/composition, never hue. First run after (Brother, Man Utd, mix): red in all three palettes (was 1/3) — but one card still took a "soft teal ground"; the floor doesn't police grounds against the identity, so watch this in the lab before tightening further. Lesson: when a set reads as the wrong world, check our own floors before blaming the model.

## 2026-09-03 — "I keep seeing this group-chat line-up stuff for Man United": the seam ledger never warmed up
The phone-screen seam IS rationed by the ledger — but the ledger keys the memory window on the LITERAL interest string ("Manchester United" / "Man Utd" / "United fan" = separate cold aisles) and needed 9 prior cards (3 sets) before speaking. Fix: `aisleKeys()` — lowercase, strip filler (fan/supporter/fc/the/club…), strip punctuation, fold a names-only alias table (28 UK clubs); the SQL side applies the same strip and matches any alias, so old rows join without a migration. Warm-up 9 → 6. Law unchanged: ration, never ban — the group-chat card is good once, not every time.

## 2026-10-08 — "One card per set is an essay": the LONG register was 20–35 words
Five customer-path sets, five fronts of 27–36 words ("Born in 1976, so you come from the generation that knows fishing time is measured not in hours, but in tea gone warm…"). A six-inch front is read at a glance, not aloud; the good cards in the same sets were 4–9 words. Fix: `v2Verify` LONG register 20–35 → 12–18 (code floor), and the ONE prompt sentence that names the register says the same. After bench, six briefs: longest front 18; the floor fired once (Mum, 23 → 17 on repair). Lesson: a register is a floor, and a floor the writer can satisfy with an essay will be satisfied with an essay.

## 2026-10-08 — Swears bolted on to satisfy a count; masked f-words on a nan's "one of each" card
"At this age, even your pull day sounds suggestive, bollocks." — the rude-slot count was met by a trailing tag. And Nan/80 on MIX got "annoyingly f***ing right": the buyer chose a range, not Rude. Fix in code: `swear-trail` (a swear parked after a comma/dash/colon at the end of the line is a violation) and `mix-family` (tone=mix + a family-grade `who` → the rude card swears in printed milds, masked f/s/c is a violation; the rude-slot floor accepts the milds so the writer isn't trapped). One sentence added to MIX_TONE_BRIEF. `rude` itself untouched. After bench: "bloody crossword cheating, apparently" / "bloody selective measuring" on the two family-mix sets; the Tom/gym RUDE set still rude in three corners. Watch: "bloody" becoming the family-mix tic (swear-variety is per-set only).

## 2026-10-08 — The concepts call was 45–70 s on prod against a 60 s client ceiling and Cloudflare's 100 s cap
Instrumented first (law 10): every v2 ledger row carried `durationMs: 0`. Real numbers (gpt-5.4 everywhere): archetype ~15 s, writer ~15 s + ~8 s repair, sense ~5 s × 2 — ~47 s, and 5/5 sets lose round 0. Shipped: real `durationMs` + `stage` + `violations` per row and one `[CONCEPTS]` line per set; repairs capped at one round (was two); the customer doors return a fast 502 instead of silently running the classic chain after a v2 throw (~50 s, double cost); `make.tsx` sends `memory:false` per the 2026-08-19 decision. A/B of the helper calls: gpt-5.4-mini on archetype + sense = ~30 s and ~4c per set (−33 % / −27 %); `reasoning_effort:'low'` made sense SLOWER (5.6 → 13.8 s) — don't. Next lever (law 2): round 0 is lost mostly to `generic-set`/`generic-artwork` firing on cards that plainly land the interest ("missing the tide", "tackle-shop") — the hints regex from `interest_words` is too narrow; widen it before touching the writer.

## 2026-10-09 — "Textbook AI": the writer joined its clauses with an em-dash
Aidan, on the day's samples ("Happy birthday, Linda — for all the steady jobs…", "Sixty, and still the measure — for plants and people."): the em-dash is the model's tell, and it comes off the site AND the cards. His rule: "one dash is fine but not --" — a hyphen inside a word (co-op, well-earned, 21-gun) is fine; the em-dash, a spaced en-dash used as a clause break, and a double hyphen are not, in any model-written text a customer sees. Shipped: `shared/no-dash.ts` (`hasAiDash` the floor, `stripAiDash` the deterministic repair: spaced dash → full stop before a capital, comma otherwise; glued em-dash/`--` → comma; dangling dash dropped; hyphens inside words untouched); a `no-dash` code floor in `v2Verify` over front_text, front_candidates and inside_text; ONE sentence in THE BAR of the writer prompt; and `stripAiDash` at every boundary where model text leaves the server (v2 + classic concepts, inside-text suggest/compose, scene suggestions, brainstorm). Bench, three customer briefs (Mum/garden/warm, Dad/fishing/funny, mate/gym/rude): 18 printed fields, zero dashes, the floor never fired. Lesson: a punctuation habit is a floor like any other, and the strip is a repair, not a rewrite — a dash that gets past the writer becomes a full stop or a comma, never a different sentence. Watch: the one-set-each sample is small; if `no-dash` starts firing in the ledger, that is the prompt sentence losing, and the strip is still the guarantee.
