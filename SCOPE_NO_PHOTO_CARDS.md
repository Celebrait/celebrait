# Scope: Cards with no photo

*Seeded by Aidan 2026-08-14. Status: SCOPING — not approved for build.*

A route where the user never uploads a photo: pick a theme or describe
an idea, and get a beautiful illustrated card.

---

## The engine already does this (the build is smaller than it looks)

`ImageGenerationRequest.referenceImageBase64` is **optional**, and both
providers already branch on it:

| Provider | With photo | Without photo |
|---|---|---|
| OpenAI | Responses API (reference-conditioned) or `/images/edits` | **`images.generate` — pure text-to-image, already wired** |
| Gemini | builds a reference array | empty array → text-only prompt |

Everything downstream is photo-agnostic: the print compositor, the
4-panel strip, orders, checkout, share links, the viewer. None of them
ask where the pixels came from. **No infrastructure work.**

What genuinely needs building is listed under "The build" below — but
the decision below it matters more than any of it.

## The strategic problem: this can quietly eat the company

Celebrait's entire position is *put them in the picture*. The photo is
the moat: it's the reason a card is unbinnable, the reason it beats
Moonpig, and the reason someone pays £8.99 + postage instead of £2.50
in Card Factory. A card without a photo is, on its face, **a generic AI
card** — a crowded category with no defensible edge.

The risk is not that we build it. The risk is that it becomes the
DEFAULT, because it is genuinely easier:

- no upload, no crop, no likeness verdict, no blur block
- no 30s photo-analysis gate
- faster, cheaper per card, and far more reliable output
- no consent surface, no GDPR question

Put a "skip the photo" door next to the photo door and a large share of
users will take it, rate the experience as smoother, and we'll have
optimised our way out of our own differentiator. The Cost Ledger would
even applaud — cheaper cards, higher completion — while the moat
drains.

**So the design constraint is: make it a DIFFERENT PRODUCT, not an
EASIER PATH to the same one.**

## The positioning that makes it safe

**Never frame it as "without a photo". Frame it as an illustrated
card** — the traditional greeting-card category, done with real art
quality. That is honest, it's a category people already buy, and it
doesn't pretend to do the thing the photo card does.

Three rules that fall out of that:

1. **Occasion-led entry, never convenience-led.** The door says
   *"Send an illustrated card"*, never *"Skip the photo"* / *"No photo?
   No problem"*. The moment the copy apologises for the photo step, the
   photo step reads as a chore and the flagship product is damaged.
2. **No generic humans in the artwork.** A no-photo card renders
   places, objects, light, weather, flora, still lifes — never
   stock-looking strangers standing in for the recipient. Faceless
   invented people are uncanny AND they blur the line with the flagship
   product. This is the cleanest possible separation: photo cards have
   PEOPLE, illustrated cards have WORLDS.
3. **Lead with the occasions where a face is genuinely wrong.**
   Sympathy (a smiling AI portrait is the wrong object entirely),
   thank-you, congratulations, professional/business, new home, get
   well. These are cards Celebrait cannot serve today at all — that's
   net-new demand, not cannibalisation.

Under this framing the two products barely compete: *"I want them IN
it"* vs *"I want something beautiful to send"*.

## The prompt work (the actual hard part)

The current `front_scene` prompts are built on one inverted principle:

> "DESCRIBE THE WORLD AND THE MOMENT, NOT THE PEOPLE. The downstream
> image generator already has the customer's photo… the PEOPLE come
> from the photo."

Take the photo away and that principle has nothing to lean on. The
whole scaffold — identity preservation, expression rebirth, breaking
the posed pairing, headcount scaling, the vacancy rule — is dead weight
or actively harmful with no reference image.

**A `no_photo` variant is not a tweak to `one_person`. It's a new,
much SHORTER template** whose job is composition, palette, light and
craft rather than likeness. The v6 lesson applies directly: length
drowns guards, and this template should be a fraction of the size.

New territory it must cover instead:
- Art direction as a first-class input (the "theme" — watercolour
  botanical, mid-century, linocut, gouache, art deco…). Today art style
  is an afterthought var; here it's the main event.
- Composition for a card front with no subject to anchor it.
- Text integration is now the DOMINANT element far more often — the
  existing typography blocks get more load, not less.
- Explicit **no-people** rule (see positioning above), with the same
  discipline learned this week: **no example imagery in the
  instruction**, or it leaks verbatim into every card.

Scene suggestions need a parallel change: `studio-scene-suggest.ts`
currently says "never describe the people, the photo handles them",
which is exactly backwards here.

**Prompt Lab first, per the standing rule.** Author `no_photo` as a
new front_scene variant, bench it against a spread of occasions and
themes, and set a bar before any studio work: *would I post this?* If
the output is merely competent AI art, the feature isn't ready —
competent AI art is free everywhere and sells nothing.

## The build (assuming the prompt clears the bar)

| Piece | Work |
|---|---|
| Provider / print / orders | **None** — already photo-agnostic |
| Draft state | A `cardMode: 'photo' \| 'illustrated'` (cleaner than overloading `PhotoMode`, which is about *who's in the photo*) |
| Prompt variant | New `no_photo` front_scene template + PL bench |
| Step flow | Fork at the start; `CARD_MAKER_STEPS` becomes mode-dependent — the photo step is skipped, not "optional" (see the two-prod-bugs comment on step indexing: this is the risky bit) |
| Step gating | `isPhotoStepReady` bypassed for illustrated mode |
| Theme picker | New small step or a scene-step mode — the "choose a look" surface |
| Scene suggest | Mode-aware prompt (subject + setting, not setting-only) |
| Likeness system | Bypassed entirely — no upload, no verdict, no gate |
| Review / viewer | Unchanged |

Realistically **one PL pass + one studio PR**, with the step-index
change being the main regression risk (it has caused two production
bugs before — see the comment in `card-maker.tsx`).

## Open questions for Aidan

- **Price.** An illustrated card costs us materially less (no photo
  analysis, fewer likeness re-rolls, cheaper generation). Same £8.99?
  I'd say yes — the customer is buying a printed card, not compute —
  but if it ever gets discounted it becomes the "cheap option" and the
  cannibalisation risk returns.
- **Where does it live?** A quiet second door in the studio, or its own
  entry point on the LP? I'd start it studio-only and invisible on the
  LP until the flagship's conversion is understood — the landing page
  should keep making one promise.
- **Does it get the same free-first-card credit?** Probably yes for
  simplicity, but it's a cheaper card being given away against the same
  mechanic.

## Recommendation

Worth building, on the illustrated-card framing, **after** the current
photo product is converting. The engine's free and the build is
moderate; the danger is entirely positional. If it ships framed as
"easier", it will win on metrics and lose the business — that's the
one outcome to design against.

Related: [[SCOPE_CARD_EDITS.md]] (the other parked scope),
`memory/next_digital_card_strategy.md` (the last time an "easier,
cheaper" variant was deliberately killed to protect the core promise —
same reasoning applies here).
