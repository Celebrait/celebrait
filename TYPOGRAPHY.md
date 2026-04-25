# Typography — Celebrait

**Status 2026-04-25: PARKED. Inter everywhere.**

Fraunces, Instrument Serif, Recoleta, and Newsreader were each tried
across the maker step h1s + dashboard greeting + landing hero +
checkout success. Kevin reverted each time. A proper typography
pass will happen later when brand direction is firmer. Keep this
file as the reference for when we pick it back up.

## Today

| Family | Tailwind | Role |
|---|---|---|
| **Inter** | *(default — no class)* | Everything. |

No serif family is loaded. `fontFamily.serif` is not wired in
Tailwind. To reintroduce a serif, add:

1. `<link>` in `client/index.html` (Google Fonts or Fontshare)
2. `fontFamily.serif: [...]` in `tailwind.config.ts`
3. `font-serif` on the specific element per the rule below.

## When we revisit — the framework to apply

### Rule

> **Serif** if the text answers *"what am I making for whom."*
> **Sans** if it answers *"what do I do next."*

If you can't decide, the answer is sans.

### Allow-list

- Studio step headlines + the generation-screen narration beats
- Card reveal "ready" moments + recipient names
- Recipient viewer: WelcomeGate greeting, envelope opening copy, *"A card from Kevin"* attribution
- Empty-state hero lines on `/studio` and dashboard zero-states
- Landing hero H1s, storytelling sections on info pages (About, Gift a Card) — **H1 only, not H2/H3**
- Transactional email subject lines + the single hero line inside the body
- Order-confirmation emotional beat (*"It's on its way to Mum."*) — never the receipt data next to it

### Deny-list

- Any form label, input, placeholder, button
- Dashboard tables, order lists, drafts grid, card metadata
- Settings, account, billing, admin
- Errors, toasts, validation, loading states
- Navigation, breadcrumbs, tabs
- Helper text, tooltips
- Dense product copy
- Anywhere in `/checkout/*`

### Hard constraints

- **Never below 20px.** Serif at small sizes reads as chrome, not craft.
- **Never on H2 or deeper.** H1 earns the moment; subheads stay sans.
- **Never on interactive elements.** Buttons, links, inputs — all sans.

### Candidates evaluated 2026-04-24/25

- **Fraunces** — first pick + last pick. Warm, crafted, optical-size axis. Each round Kevin reverted as "a bit much" / "revisit later".
- **Instrument Serif** — modern editorial; only ships weight 400 which limited hierarchy.
- **Recoleta** (Fontshare) — warm contemporary, full weight range. Closest to "bold classic with modern" brief.
- **Newsreader** — editorial, optical-size axis; read too "newsy".

### The failure mode to watch for

Serif being *everywhere*. The moment it leaks into *"Save changes"*
or a table header, Celebrait stops feeling like Papier and starts
feeling like a wedding stationer's Shopify theme.

If you're adding a serif class to a screen not on the allow-list,
pause. Probably don't.

### Why we keep parking it

A serif drift is usually signalling that the *real* unresolved
question is brand direction more broadly — palette, voice, visual
references. Until those are firmer, picking the right serif is
guessing. When the brand pass happens, do typography then; trying
to land it in isolation isn't working.
