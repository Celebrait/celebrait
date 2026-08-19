# AUDIT: the builder promise — "3 options that land every time"

**Commissioned by Aidan, 2026-08-19**, off an Oasis/50th/rude set that
broke five rules at once: *"I need a full on audit. Understand what I
want to achieve here. A builder for the casual greetings card buyer who
wants to come in, type a few words, and get 3 options that land every
time. UK market. Make them make sense!"*

## The product, stated once

A casual buyer types a few words. Three cards come back. **All three
make sense, at least one is good enough to buy.** Every time — not on
the average run, not when the dice land well. UK voice, UK market.

## The failing set (evidence)

Brief: Dad, 50, Oasis, can't stand Manchester City, RUDE register.

| failure | rule that should have caught it |
|---|---|
| 0/3 cards sweary | rude floor: ≥2 of 3 |
| Man City absent everywhere | dislike floor: exactly 1 card |
| "50 YEARS. OASIS STILL MATTERS." — band is ~35 years old | never-invent-a-fact; birth-year carve-out misapplied to the SUBJECT |
| artwork = speakers/vinyl/cassette, no Oasis anywhere | specific-beats-category (pictures) |
| visual styles still clustering | medium spread work, partial |

## Root cause — architectural, not prompt quality

**Every guarantee in this engine is a prompt instruction.** The server
warns (`rude mode on but the set came back tame`), retries once, then
**ships whatever it has** ("shipping originals"). Nothing ever rejects
a bad set. Prompt rules hold ~80–90% each; with 5+ independent floors
per set, most sets violate at least one. The failure Aidan saw is not
bad luck, it is the expected value.

Secondary causes, all observed today:
- **Per-floor checks, never per-set.** My scripts each verify one rule
  in isolation; nothing asserts a whole set passes ALL floors at once,
  which is the only thing the customer experiences.
- **Local/deployed skew.** I verify against dev; Aidan tests the
  deployed admin. My greens do not prove his experience.
- **Derived facts collide with subject facts** (1976 is his birth year,
  not the band's origin) — the carve-out needs a "may only attach to
  the RECIPIENT" clause enforced in code.

## The fix — move guarantees from prompts to code

Generate → **verify deterministically in the server** → regenerate only
the failing card(s) with targeted feedback → only ship a set that
passes. The prompts become the first draft; the loop is the guarantee.

Deterministic per-set checks (all cheap, all regex/logic, no LLM):
1. RUDE: ≥2 fronts match the swear list (already exists as REAL_CHEEK).
2. DISLIKE: exactly one card references it (hint-list matching, oblique
   forms included — the brief-specifics-check logic, moved server-side).
3. NUMBERS: any year/age in a front must be the brief's age, the
   derived birth year (recipient-anchored phrasing only), or clearly
   comic. A year attached to the SUBJECT's name = reject.
4. SET SHAPE: ≤1 front opens with the bare number; no shared
   distinctive word; angles match the assignment.
5. OCCASION: ageless sets carry exactly one occasion front.
The LLM landing check stays for taste; these floors stop being its job.

Regeneration is per-card with the violation named ("this card must
reference Manchester City; these two must not"), max 2 rounds, then
ship best-effort with the failure logged — never silently.

## Acceptance harness (the audit's measuring stick)

`server/scripts/set-acceptance-check.ts`: a fixed panel of ~12 real
briefs (interests, milestones, rude, dislikes, kids, franchises), each
generated N times, each SET scored pass/fail against ALL floors
simultaneously. The headline number is **% of sets with zero
violations** — the customer's actual experience. Today's engine would
likely score 40–60%. Ship the verify loop, target ≥95%.

## Order of work
1. Build the acceptance harness; measure the true baseline. (~£1)
2. Server-side verify loop with per-card regeneration.
3. Re-measure. Iterate the two or three floors that still leak.
4. Only then resume catalogue building — stock made before this is
   suspect and needs a re-check pass.

Prompt polish continues to matter for QUALITY. It stops being the
mechanism for CORRECTNESS.

## The target architecture (Aidan, 2026-08-19, after the audit)

*"Take the initial user information, recipient, age, interests,
dislikes, and use it to create an ARCHETYPE of what that person will
react to in relation to the interests provided. Let the AI be creative
in terms of output design. Just make sure it's current and landing. Old
can work if treated new!"*

Three stages, replacing the single 8k-token lecture:

**1. ARCHETYPE (new, ~1p).** A first cheap call that turns the brief
into a model of the person: the era they came of age in, what they
actually react to about THIS interest, what reads as cliché to them
versus current, where the line is on cheek, what a card shop would get
wrong about them. Dynamic per-brief inference instead of static rules —
the model is genuinely good at "what lands for a 50-year-old Oasis fan"
when asked directly; today that knowledge is smeared across forty
standing instructions it half-reads.

**2. CREATIVE GENERATION (short prompt).** Brief + archetype + the
craft bar. Design free. The style directive is exactly Aidan's words:
CURRENT AND LANDING — old media welcome when treated with a modern eye
("old can work if treated new"), which is what the medium-spread fix
already unlocked.

**3. REFEREE (code).** The deterministic floors + per-card regeneration
from the plan above. The guarantee lives here, not in the prompt.

⚠️ INTERESTS ARE MANDATORY on the customer occasion builder — Aidan's
explicit call. The blank-interest milestone cards remain a STUDIO
capability for building spine stock; the customer flow always has an
interest, and the archetype is built "in relation to the interests
provided".

The baseline harness therefore compares FOUR arms: bare prompt, current
prompt, short+referee, and archetype+short+referee. Build order:
harness → archetype call → referee → measure all four → keep what wins.

## Style governance (Aidan, closing the audit)

*"Where does style come from? Think the only thing we really need to
concern ourselves with is direct IP... but tbh I would let this run
free and cut down as we go. Rather than block upwards."*

**Style comes from the archetype + subject, unconstrained.** No media
list, no palette law, no pre-emptive taste fences. PERMISSIVE BY
DEFAULT, RESTRICT ON EVIDENCE — a rule may only exist because of an
observed failure, named. (This is also what the data showed all week:
the condense pass, the examples audit, the media list, the three-ink
rule — four times, removing instruction beat adding it. And the rules
that WORK are all named observed failures, which is exactly
"cut down as we go".)

The short list that is NOT style, and stays as hard floors:
1. **Direct IP** — marks, characters, artefacts (legal; the
   deterministic artefact floor stays).
2. **Real people** — no likenesses of private individuals, caricature
   rules for public figures (legal).
3. **Print mechanics** — exact words rendered, type clean and inside
   the safe margin, image is the card not a photo of one (physical
   product).
4. **Correctness** — no invented facts, no contradicted gender, no
   wrong years (printed and posted).

Everything else runs free and earns a ban only by failing in front of
us. The keep rate and the acceptance harness are the pruning shears.

## Length is a register — one long card per set (Aidan, reviewing the rendered arms)

*"When I say bare lands its the length of text - think there's some good
resolve in there - nice finishing of the concepts - a good to have in
the choices for me."*

Bare had no length cap, and its best cards BUILD AND RESOLVE: "still
doing away days, still chatting absolute s***, still redder than a
service-station kebab at 2am." Setup stacked on setup, then the finish.
The winning arm caps fronts at 8 words, so it structurally cannot write
that card — Aidan was not rating bare's quality, he was spotting a
missing register.

So the set's variety includes LENGTH: one card per set may run long
(~20-35 words), built to be read aloud, the last few words landing the
turn. This folds together three separate discoveries: the old typeled
long-line rule, the list angle's accumulation shape, and bare's
unconstrained resolve. Pinned server-side like every other structural
choice (law 4: the model will not vary its own structure unasked).

Set shape target: one SHORT hit, one MID, one LONG read-aloud — three
genuinely different reading experiences, not three lengths of the same
sentence.

## THE VISUAL DECISION — nailed down (end of audit)

Aidan: this engine IS the customer product, so the style decision is
what Celebrait sells. His instinct, made precise here: *"do what we did
before but also let the AI run free."*

**The concept: HOME REGISTER WITH LICENSED DEPARTURES.**

The house discipline — flat, graphic, bold confident grounds, type
doing the work, objects not scenes — is where every card STARTS. It is
a home base, not a cage: the archetype is explicitly licensed to leave
it when the person's world genuinely calls for something else (chrome
for a 21st raver, watercolour for a nan, airbrush for an 80s petrolhead)
— and a departure must be a DECISION the direction can name, never
drift. This is not the old regime: the three-ink law stays dead, media
stay unlisted, the departure licence is real.

**Built as a studio toggle so the decision is made by eye, not debate:**
- **CELEBRAIT** — archetype + home register with licensed departures
- **OPEN** — archetype + no visual constraint ("current and landing"
  only)
Both modes share everything else: three length registers (short hit /
mid / long read-aloud), format rotation with typeled pinned, the code
referee. Same briefs through both, rendered side by side, Aidan judges;
keep-rate arbitrates over time; customer purchases arbitrate for real
once live.

**Recommendation on record — CELEBRAIT as the default,** for four
reasons: (1) Aidan's 28 keeps are the revealed taste and they are
discipline-shaped to a card; (2) the moat — "AI generation anyone can
do" is the commodity risk, and a recognisable rack is the defence;
(3) print physics — flat graphic art survives the 1024→print upscale
far better than painterly scenes (the 171-DPI finding); (4) nothing is
lost — the range collapse was caused by the ink law, not the
discipline, and the ink law is gone. But the toggle exists precisely so
this is his call from pictures, and "unsure rn" is a legitimate state
the build must not foreclose.

## NEXT SESSION — one job, no detours

Wire the winner into /concepts behind the toggle:
1. Archetype call (with per-brief referee hints generated alongside).
2. Short prompt ×2 variants (Celebrait register / Open) + length
   registers + format rotation.
3. Code referee with per-card regeneration.
4. Harness against the LIVE route, both modes.
5. Render one side-by-side sheet for the style call.
Then, and only then: the catalogue restarts.

## Customer flow: blank interest is allowed after all (Aidan, refining)

*"When this becomes front end, users should be able to test putting no
interests in and just getting generic, that's when a random roll can go
and just say happy birthday etc."*

Supersedes the earlier "interests are MANDATORY on the customer
builder": interest is ENCOURAGED (it is the product's magic) but a
blank brief is a valid customer, not an error. The mechanics mostly
exist already:
- blank interest + AGE → the milestone path (the age is the subject;
  live since 3dec242c)
- blank interest + no age → the GENERIC ROLL: straight-angle-led sets,
  beautifully made "Happy Birthday" variety — the spine stock
  behaviour, served fresh. Needs the interest-or-age gate relaxed for
  the customer surface only, with the straight/typeled angles weighted
  up since there is no subject to joke about.
The archetype still runs on whatever IS given (recipient, age, tone) —
a blank brief has an audience even when it has no subject.
