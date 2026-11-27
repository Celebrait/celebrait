# Catalogue taxonomy — how the stock gets shelved, and what to build next

**Written 2026-08-19**, from Aidan: *"I need you to start categorising
the stock properly for when its ready to go live"* and *"steering me
into creating some cards for the different birthday milestones"*.

Two jobs in one document, because they are the same job: the aisles ARE
the build order. Every aisle is a shelf that needs filling, an SEO page
that needs stock behind it, and a coverage cell that can be empty.

Sources: `RESEARCH_UK_CARD_MARKET.md` (Thortful scouting, 18th/21st/
40th/60th aisle scans) plus a Moonpig navigation pull, 2026-08-19.

---

## 1. The aisles

Five axes. The first four are FINITE and are what a catalogue is; the
fifth is infinite and is what the generator is for.

### A. RECIPIENT — the market's first axis

Moonpig's own list: For Her, For Him, Mum, Dad, Daughter, Son, Friend,
Sister, Brother, Wife, Boyfriend, Best Friend, Husband, Girlfriend,
Niece, Nephew, Grandson, Granddaughter.

We currently offer twelve: Mum, Dad, Nan, Grandad, Sister, Brother,
Daughter, Son, Partner, Best mate, Friend, Colleague.

⚠️ **"Partner" is good UX and poor SEO.** It is the modern, inclusive
word and right for the studio — but almost nobody types it into Google.
They search "birthday card for wife", "for husband", "for girlfriend",
"for boyfriend". One inclusive chip is collapsing four of the highest
intent search terms in the category. Recommendation: keep Partner in
the maker, but split it into wife/husband/girlfriend/boyfriend as
CATALOGUE and SEO aisles.

⚠️ **Missing entirely:** niece, nephew, grandson, granddaughter. These
are real aisles, and the milestone research already found the pattern —
at 18ths the buyer is often a grandparent, not a peer.

### B. MILESTONE

1st · 10th · 13th · 16th · 18th · 21st · 30th · 40th · 50th · 60th ·
70th · 80th. (Moonpig ranges 1st–80th; 90th and 100th exist but are
thin.)

Already scanned in the research doc: **18th** (threshold jokes,
grandparent buyers), **21st** (threshold + memes), **40th** ("Thirties?
Completed It Mate", era references begin), **60th** (era nostalgia
leads, affectionate-habit jokes not decline jokes).

**Not yet scanned: 16th, 30th, 50th, 70th, 80th.** Worth a pass before
building for them, because the research keeps showing the bands are
different WORLDS rather than different numbers.

**The birth-year unlock**, already noted and still unbuilt: "Road To 60
— 1966" is a first-class genre, and the year is ARITHMETIC on what the
buyer typed, not an invented fact. Needs a carve-out in the
never-invent-a-date rule.

### C. AUDIENCE BAND — and the one that changes the product

Moonpig: Kids 2–5, Kids 6–9, Tween 9–12, Teen 13–17, Young Adult
18–24, Adult 25–64, Senior 65+.

⚠️ **KIDS IS A DIFFERENT PRODUCT, NOT A DIFFERENT PALETTE.** Aidan
spotted this himself on a Moana 1st birthday. The rules that change:

- **Words are for the adult reading it aloud** — already encoded in the
  landing check, and it is correct: nobody buys a card for a
  four-year-old to read alone.
- **Artwork must belong to the child**, not the buyer. This is the
  age rule in the style brief, and the reason a bright orange Swiss
  poster failed on a Moana card.
- **No rude, ever.** Rude mode should be unavailable below ~16.
- **No age-roast.** The market's biggest funny-birthday seam is
  explicitly adult.
- **Fictional properties are the dominant interest** — and our
  no-human-figure rule bites hardest exactly here, which is right but
  makes kids' artwork harder. Objects and scenery only.

Everything above the teen line is one product with a tone dial.

### D. TONE

Ours: funny · warm · cheeky, plus rude as a toggle. The market's
equivalent spread is funny/cheeky/rude on one side and cute/classic/
pretty on the other.

⚠️ Note from the research: **rude is a POSITION, not a filter** —
Scribbler built a whole brand and 38 shops on it. Ours is a checkbox.
Worth deciding whether Celebrait has a rude LANE rather than a rude
setting.

### E. INTEREST — infinite, and not a catalogue axis

This is the generator's job and our structural advantage: no shop can
stock "crown green bowls", we can serve it on demand. Only the big
shared interests are worth pre-building as stock — football, gardening,
wine, dogs, golf, walking, baking, reading, running, cycling.

---

## 2. What our data cannot currently express

`card_templates` stores: occasion, angle, recipient, interest,
front_text, inside_text, palette, typeface, format, art_direction,
tone, age, image_path.

- **Milestone** — derivable from `age`. No column needed.
- **Audience band** — derivable from `age`. No column needed.
- ⚠️ **Gender — NOT STORED, and not derivable.** The brief carries it
  and the writer now obeys it, but the template row throws it away. So
  "For Her" and "For Him" — two of the market's top-level aisles —
  cannot be built from our own stock. This is the one real schema gap.
- **Kids vs adult** — derivable from age, EXCEPT for ageless kids'
  cards, which are common ("a card for a little one" with no age). Flag
  falls out of the audience band once gender is in.

---

## 3. Build order — what to make next

Fill the SPINE first: it has no IP exposure, it is the highest-intent
search traffic, and it is what the SEO pages need behind them.

**Round 1 — milestone × tone, interest-light (~36 cards).**
30th, 40th, 50th, 60th, 18th, 21st × funny/warm/cheeky. These work for
anyone of that age whatever they are into, which makes them the most
reusable stock we can hold and the safest under text-editing.

**Round 2 — recipient × the two biggest milestones (~24).**
Mum, Dad, Nan, Grandad, Sister, Brother, Best mate, Partner × 40th and
60th. Pairs the two axes the market shelves by.

**Round 3 — kids (~20).**
1st, 2nd, 3rd, 5th, 10th, 13th × warm/funny. Different product; run it
as its own session with rude off and characters on objects.

**Round 4 — the broad interests (~20).**
Football, gardening, wine, dogs, golf, walking, baking, reading,
running, cycling × two each.

Roughly 100 cards. At three per generation and keeping the good ones,
that is a handful of sessions — and it is the same activity as testing,
which was Aidan's own point: *"it's a useful side effect from testing a
different range of concepts."*

---

## 4. Still open

- **16th, 30th, 50th, 70th, 80th aisle scans** — the bands are
  different worlds and we have only scanned four of them.
- **The birth-year carve-out** ("Road To 60 — 1966").
- **Rude as a lane vs a checkbox.**
- **Partner → wife/husband/girlfriend/boyfriend** for catalogue and SEO
  while keeping Partner in the maker.
