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
