# Scope: Occasion-first — the reversal and the new build order

*Aidan's call, 2026-08-17: "let's start from the beginning, and build
each occasion independently, with the view to each one living in its
own world on the site, powered by a different prompt... anything that I
love I can save as a templated option, so we'll be building our own
catalogue and process in one." Status: DIRECTION SET — supersedes the
build order in [[SCOPE_OCCASION_INTELLIGENCE.md]] and the customer-flow
sequencing in [[SCOPE_QUIRKY_MAKER.md]].*

## What is being reversed (and what is not)

REVERSED: the idea that one universal maker, tuned by profiles, is the
product. Two days of building proved each general rule fights the
others, and the sets still read "close but not landing" to the founder.
Each occasion now gets built INDEPENDENTLY: its own research, its own
design world, its own prompt, its own page — shipped one at a time,
each one finished to Aidan's taste before the next begins.

NOT REVERSED — checked 2026-08-17: nothing from this sprint ever
touched a customer surface; the whole engine lives behind /admin. So no
code is deleted. The Lab stops being a rehearsal of "the product" and
becomes the FACTORY each occasion is built with. Likewise these
learnings carry into every occasion build as the shared craft floor —
they are occasion-agnostic and were each paid for with a real failure:

- the style DNA + print physics (ink, misregistration on artwork only)
- typography: typeset-clean lettering, safe margins, per-card typeface,
  the type-led format
- writer → shortlist → judge-as-selector (choosing beats repairing)
- the deterministic floors: title formulas, banned words, invented
  dates/ages, Americanisms, protected artefacts (IP), cheek floor
- serious mode: the sympathy writer/judge pair — no joke machinery can
  ever touch a condolence card
- the buyer test (the buyer is not the fan), the turn test, the
  specificity rule, evoke-never-reproduce for franchises
- the bench + build stamp (never judge unmeasured again), the model
  timing script, gpt-5.4 live / gpt-5.5 for offline quality
- recipient inflection (stated-gender-only, age from brief only)

## The per-occasion playbook (repeat 19×, one at a time)

1. **RESEARCH** — a real pack per occasion, not vibes: who buys it and
   for whom; the buyer's mindset at purchase; the accepted framework
   (what a "proper" card for this occasion must and must not do); the
   tone spectrum sold today (Thortful/Moonpig/indie scan); current
   design conventions and palettes; SEO search terms. Claude drafts the
   pack with web research; Aidan corrects it with taste.
2. **DESIGN DIRECTION** — from the research: this occasion's palette
   family, type mood, motif world, density range. Written down, short.
3. **ITS OWN PROMPT** — a dedicated writer prompt for the occasion,
   built on the shared craft floor. Goes through Prompt Lab when it
   ships to customers (Prompt-Lab-first rule stands).
4. **BENCH IT** — occasion-specific briefs, before/after sheets, same
   discipline as now.
5. **AIDAN TESTS, AND SAVES** — anything he loves gets saved as a
   TEMPLATE from the Lab with one click. The catalogue assembles
   itself as a by-product of testing; templates are where editable
   text, names and dates are allowed (the buyer supplies them).
6. **SHIP THE OCCASION'S WORLD** — its own landing route (the SEO
   door), showing the curated template rack for that occasion plus its
   dedicated mini-maker. Occasions go live one by one; the site never
   advertises a world that isn't finished.

## Build order for the machinery (small, in service of the above)

1. **Save-as-template** — `card_templates` table (occasion, front
   image → R2, front text, palette/typeface/format/art_direction
   recipe, angle), a save button in the Lab, a browse grid. Without
   this Aidan's testing throws away its own gold. FIRST BUILD.
2. **Per-occasion prompt slots** — the Lab gains an occasion picker
   that loads the occasion's dedicated prompt (constant first, Prompt
   Lab slot when live).
3. **The first occasion's landing page** — only after its catalogue
   has real depth and its maker makes Aidan happy.

Occasion #1 is Aidan's choice. Recommendation: BIRTHDAY (the volume
market, and the hardest test of tone range — if the process works
there it works anywhere); alternative: a narrow seasonal one
(Father's Day) as a faster complete-world proof.

## Parked but logged: photo-as-illustration front end

Aidan's idea, same day: a quicker, cheaper route where an uploaded
photo becomes an ILLUSTRATED card (stylised, not likeness-precise) —
front-end friendly, tolerant of a lower-cost image model, distinct
from the studio's precision photo route (which stays, with scene
description, for the flagship product). Genuinely promising because
image-to-image stylisation is far more forgiving than likeness
generation. NOT in scope now — gets its own exploration after the
first occasion world ships. Related: [[next_photo_likeness_system]].

## What good looks like

Aidan, three weeks from now, has one occasion live: researched,
designed, prompted, benched, with a curated rack of his own saved
templates and a landing page that owns its search term. The process
that built it is written down and repeats 18 more times, faster each
run. The universal engine never shipped — it just quietly became the
tooling that made this possible.

The Prodigi test print remains the gate before ANY occasion world
takes real customer money on this product line.
