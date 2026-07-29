# Celebrait — working notes for Claude

Personalised greetings cards: a customer's photo becomes the **artwork** of a
card (any scene they describe), printed on 280gsm and posted in the UK.
£8.99 + postage. **LIVE and taking real money** since 2026-07-27.

Founder: Kevin (`kevin@adc.business`). Solo, non-technical-by-trade, does not
use a terminal — **run commands yourself; never hand him a shell command to
run.** He handles dashboards (Render/Stripe/Neon/GoDaddy/Brevo/Prodigi).

---

## Stack

- **Client** React 18 + TS + Vite + **wouter** (not react-router) + TanStack
  Query + Tailwind + framer-motion + three.js/react-three-fiber v8 + drei
- **Server** Express + Drizzle + **Neon Postgres** · sessions in PG
- **Images** Cloudflare R2 (`server/r2-storage.ts`) · **Render's disk is
  ephemeral — anything written locally dies on deploy**
- **Money** Stripe Checkout · **Print** Prodigi (`GLOBAL-GRE-GLOS-6X6-DIR`
  to recipient / `-BLA` to sender) · **Email** Brevo
- **Hosting** Render, autodeploys branch `claude/nice-rosalind-171f52`

Two databases: **prod** (`ep-gentle-art`) and **dev** (`ep-silent-lab`).
Local `.env` → **dev**. Schema is pushed **manually per-DB**; Kevin runs prod
SQL via the Neon SQL Editor (give him idempotent `IF NOT EXISTS` SQL).

---

## Hard rules (each earned the hard way)

1. **Any `<img>` of a card image MUST set `crossOrigin="anonymous"`.** R2
   only returns CORS headers when the request carries `Origin`; a plain
   `<img>` caches a non-CORS response that then poisons the WebGL texture
   load → blank cards / broken-image icons. Enforced by
   `npm run check` → `scripts/check-card-image-cors.mjs`. Prefer
   `<CardImage>` (`client/src/components/card-image.tsx`).
2. **Every r3f `<Canvas>` needs a `<Suspense>` INSIDE it.** r3f rethrows
   suspensions into the parent DOM tree; the app's only other boundary is
   route-level, so a suspending texture blanks the whole page.
3. **Preload URLs must byte-match what `useTexture` loads** (`.webp` via
   `toWebpDisplay`) — drei's cache is string-keyed.
4. **Prompt changes go through the Prompt Lab first** (`/admin/prompts`),
   never straight to the live prompt. Prompts are DB-versioned.
5. **New AI touchpoint? Add its slot to `LLM_SLOTS`** in
   `shared/models/prompts.ts` or its spend is invisible in the Cost Ledger.
6. **Card interaction model is LOCKED**: rest ajar ~22°, tap to open/close,
   **no orbit, no zoom, no autorotate** anywhere.
7. **Money is integer pence** everywhere. Prices come from
   `shared/pricing.ts` — never hardcode.
8. **Commit at every natural pause**, push to the deploy branch. Detailed
   commit messages explaining *why* (this repo's history is a knowledge
   store). Don't blanket `git add -A`.

---

## Landmines

- **Dev hides prod bugs.** R2 is off locally, so card images are same-origin
  and CORS/persistence bugs are invisible until deployed.
- **Verify in the real bundle.** `npm run build` then run `dist/index.js` —
  the dev server pre-fetches dynamic imports and injects nothing.
- **`server/launch-guards.ts` refuses to boot prod** on money-in-nothing-out
  configs (live Stripe + stub/sandbox Prodigi, missing `SESSION_SECRET`,
  `DEV_STUB_AI` set). A red deploy with `✖✖✖ LAUNCH-GUARD FATAL` is it
  working. Set `STUDIO_PAYMENT_PROVIDER=stub STUDIO_PRINT_PROVIDER=stub` for
  local prod-bundle tests.
- **Generations run in-process 4–8 min** and die on deploy;
  `server/recovery/stale-sweeper.ts` heals orphans. Registry:
  `server/generation-registry.ts`.
- **`three-stack` chunk also contains React**, so it loads on every page —
  removing 3D from a page does NOT drop it. Real fix = split React into its
  own `manualChunk` (not yet done).
- Debugging a blank/misrendering 3D card? **Read the browser console and run
  a runtime probe first.** `THREE.WebGLRenderer: Context Lost` is usually
  r3f's own teardown message, NOT a GPU fault. `numCanvases: 0` ⇒ React
  unmounted it — look UP the tree.

---

## Conventions

- Comments explain **why**, not what — especially the non-obvious constraint
  a line protects. Match surrounding density.
- Copy voice: warm, wry, British, honest. Never over-promise delivery
  ("up to 72 hrs, then posted"), never invent stats.
- Admin pages: per-request DB `is_admin` check in the route (client
  `RequireAdmin` is UX only). Pattern: `server/routes/admin-*.ts`.
- Analytics/SEO metadata is registry-driven — `shared/seo.ts` and
  `shared/models/analytics.ts` are single sources of truth used by both
  server and client so they can't drift.

---

## Verify like this

```
npx tsc -p tsconfig.json --noEmit      # front-ab-test.ts errors are pre-existing
npm run build                          # includes the card-image CORS guard
node scripts/check-card-image-cors.mjs
```

Then **look at it** in the browser preview (mobile + desktop) before saying
it works. Don't claim verification you didn't do; say what you checked and
what you couldn't.

---

## Where things live

| Area | Path |
|---|---|
| Card maker flow | `client/src/pages/card-maker.tsx`, `components/studio/steps/*` |
| 3D card | `client/src/components/card-3d-viewer.tsx` |
| Landing | `client/src/pages/landing-keeper.tsx` |
| Generation | `server/background-generator.ts`, `server/providers/*` |
| Checkout/fulfilment | `server/routes/studio-checkout.ts`, `server/studio/*` |
| Emails | `server/email-service.ts` |
| Admin | `/admin/customers`, `/admin/costs`, `/admin/analytics`, `/admin/prompts` |
| Blog + SEO | `client/src/pages/blog*.tsx`, `shared/seo.ts`, `server/seo-inject.ts` |

**Longer history, decisions and parked ideas live in Claude's memory
directory** (`MEMORY.md` is the index) — read it for context on *why* things
are the way they are before proposing changes.
