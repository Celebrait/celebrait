# Celebrait Prompt Lab — Plan & Model Research

**Status:** Locked plan of record
**Date:** 2026-04-10
**Owner:** Aidan Chant
**Purpose:** Single source of truth for the Prompt Lab build and the AI image generation model strategy that feeds into it. All future Prompt Lab work should reference and update this document.

---

## Table of Contents

1. [Context & Motivation](#1-context--motivation)
2. [Pain Points This Plan Solves](#2-pain-points-this-plan-solves)
3. [Ground Truth: Current State of the Codebase](#3-ground-truth-current-state-of-the-codebase)
4. [The Phased Plan](#4-the-phased-plan)
5. [Bonus Ideas Worth Building In](#5-bonus-ideas-worth-building-in)
6. [Model Research: The Landscape](#6-model-research-the-landscape)
7. [Pricing Comparison](#7-pricing-comparison)
8. [Recommended First Bake-Off](#8-recommended-first-bake-off)
9. [Strategic Notes](#9-strategic-notes)
10. [Sources](#10-sources)

---

## 1. Context & Motivation

Celebrait is an AI-powered greeting card platform. The core IP is the prompt engineering — the exact instructions sent to image generation models to produce a card's front image (often from a user-uploaded photo) and inside image. Everything else is glue.

Today, prompts are:
- Hardcoded in `shared/prompts.ts`
- Untracked (no versioning, no history, no DB)
- Untestable cheaply (every test burns full `quality: high` pricing)
- Locked to a single model (OpenAI `gpt-image-1.5`)
- Unmeasured (no cost tracking, no per-generation logging)

The Prompt Lab is an internal tool that turns this from vibes-based iteration into a measurable, versioned, multi-model engineering discipline. It is a prerequisite to the UX overhaul: output quality compounds, and every UX improvement wraps around a stronger core.

---

## 2. Pain Points This Plan Solves

| # | Pain Point | Phase That Addresses It |
|---|---|---|
| 1 | Testing full journey at high quality costs too much | Phase 2 (Fixture & Preview Modes) |
| 2 | Don't know which prompts are actually live — dead prompt iterations litter the DB/codebase | Phase 0 (Cleanup) + Phase 1 (Source of Truth) |
| 3 | Clunky A/B testing of front and inside prompts, lost testing spaces | Phase 3 (Variant Testing UI) |
| 4 | Safety filter hits are poorly understood | Phase 4 logging + Phase 5 categorisation |
| 5 | Can't easily add new models, no cost tracking, API key management is painful | Phase 4 (Provider Abstraction + Cost Ledger) |
| 6 | Front and inside can't be tested in isolation with tailored prompts | Phase 3 (slot-aware variant testing) |

---

## 3. Ground Truth: Current State of the Codebase

Audit completed 2026-04-10. This is what is actually running in production today.

### 3.1 Active Prompt Pipeline

**Corrected 2026-04-10** — the initial audit was polluted by a stale worktree (`.claude/worktrees/frosty-bhaskara`) that had the pre-merge prompt state. The real `shared/prompts.ts` in main is only 120 lines and contains **two** active functions, not three:

| Function | Lines | Slot | Used By | Model |
|---|---|---|---|---|
| `buildInsidePrompt` | 4–59 | Inside card | `server/routes/generation.ts`, `server/routes/ai.ts`, `server/background-generator.ts`, `client/src/components/onboarding/guided-conversation.tsx` | gpt-image-1.5 |
| `buildScenePrompt` | 61–118 | Front card (photo-based) — **primary flow** | `server/routes/generation.ts`, `server/background-generator.ts` | gpt-image-1.5 |

There is **no separate text-only front-card prompt function.** Text-only generation appears to route through the client-side flow without a dedicated prompt builder — this is a gap the Prompt Lab Phase 1 should address by making `front_text` an explicit slot even if it reuses `buildScenePrompt` today.

**Generation parameters (all slots):** `size: 1024x1024`, `quality: high`, `n: 1`, `moderation: low` (for edits).

The authoritative rendering of both prompts at snapshot time is captured in `prompts-snapshot-v0.md` at the repo root. That file is the frozen baseline for Phase 1 version 1.

### 3.2 Dead Code Removed in Phase 0 Cleanup

The following were deleted on 2026-04-10 as part of Phase 0:

- `client/src/lib/openai.ts` — **entire file deleted.** Nothing in the client imported from it. Contained three dead functions (`buildCharacterPrompt`, `buildSceneOnlyPrompt`, `buildInsidePrompt`) that were superseded by the server-side versions.
- Stale worktree at `.claude/worktrees/frosty-bhaskara` removed (its contents were already merged into main via PR #1).

`buildTransformPrompt` and `buildTextOnlyImagePrompt` were listed as candidates for deletion in an earlier version of this plan. They do not exist in the main repo — the earlier audit was reading the stale worktree. No action needed.

Keep the `x-test-trigger: safety_violation` dev hook in `server/routes/generation.ts` — useful for testing UI safety states.

### 3.3 Current Flows

**Text-only front (`/api/generate-images` without `photoData`)**
- Uses `/v1/images/generations`
- Prompt built from `answers.name`, `answers.celebration`, `answers.scene`, `answers.art_style`
- Hardcoded "MANDATORY: perfectly SQUARE composition" opener
- Integrates card text (e.g. `Happy Birthday Sarah`) naturally into scene
- Dynamic art style selection from a pool of 14 (watercolour, oil, digital, fantasy, storybook, impressionistic, contemporary, realistic photography, vintage, comic book, minimalist, Renaissance, anime/manga, art nouveau)

**Photo-based front (`/api/edit-scene-gpt-image-1`)**
- Uses `/v1/images/edits` via multipart FormData
- Prompt contains an 8-point facial recreation mandate (bone structure, eyes, nose, mouth, skin, hair, distinctive marks, expression change)
- Explicitly instructs the model to IGNORE the reference photo's composition/framing/pose — reference is for facial features only
- Custom clothing and art style supported

**Inside card (`/api/generate-inside-card`)**
- Uses image-to-image edits referencing the front card
- Strict "no people, no characters from front" instruction
- Typography hierarchy: greeting (top, small), main message (centre, large), signature (bottom, small)
- Maintains art style continuity with front

### 3.4 Card Type Handling — Notable Gap

Celebration type (`birthday`, `anniversary`, `wedding`, `sympathy`, etc.) currently only swaps the greeting string (`Happy {Type} {Name}`). The rest of the prompt structure is identical across all card types.

**This is a problem.** A sympathy card currently includes "MANDATORY: characters look happy to be part of the scene" which is actively wrong. Per-card-type prompt variants should be a first-class concept in the lab.

### 3.5 Model, SDK, API Keys

- **Active model:** `gpt-image-1.5` (OpenAI) — confirmed real, released 2025-12-16. Not a typo.
- **SDK:** `openai` npm package, direct calls, no abstraction layer
- **API key:** `process.env.OPENAI_API_KEY`, read in `server/utils/shared.ts` lines 12–17
- **Other providers:** none. No Fal, Replicate, Stability, Gemini, Flux wired up.

### 3.6 Safety Handling

File: `shared/openaiErrorHandler.ts`

Three safety codes detected:
- `content_policy_violation`
- `moderation_blocked`
- `safety_system`

Behaviour: fail-fast, no retries, no logging. Error is mapped to a user-facing message. Which prompt version caused which safety hit is not recorded anywhere.

### 3.7 Cost Tracking

**None.** Usage objects are pulled off OpenAI responses and discarded. No DB table, no per-generation logging, no dashboards.

### 3.8 Database Storage of Prompts

**None.** Prompts are pure functions over user answers. No versioning, no audit trail. The cards table (`shared/schema.ts`) stores `conversationData` (user answers) and image URLs — never the rendered prompt that produced each image.

### 3.9 Test / Preview Endpoints

**None.** Every test run costs full `quality: high` price. The only dev hook is the safety-error simulator.

---

## 4. The Phased Plan

Each phase delivers value independently. Do not skip phases — each builds on the data model or infra of the previous one.

### Phase 0 — Cleanup (½ day) — **COMPLETED 2026-04-10**

**Goal:** Lock the current state as the known baseline before we change anything.

- [x] Confirm `gpt-image-1.5` is the correct model ID (it is — released 2025-12-16)
- [x] Delete orphaned `client/src/lib/openai.ts` (entire file was dead)
- [x] Snapshot current prompt text into `prompts-snapshot-v0.md`
- [x] Refactor `client/src/utils/image-store.ts` to remove redundant second image load in `addPhoto` (this was the source of the "stuck at 90%" upload hang)
- [x] Remove stale `.claude/worktrees/frosty-bhaskara` worktree
- [x] Correct ground-truth section of this plan to reflect the real main-branch state

### Phase 1 — Source of Truth

**Goal:** You always know exactly which prompt is live and can roll back instantly.

**New database tables:**

```
prompt_templates
  id              serial PK
  slot            text          -- 'front_text' | 'front_scene' | 'inside'
  card_type       text          -- nullable; null = default for slot
  name            text          -- human label
  version         integer       -- auto-incrementing per (slot, card_type)
  template_text   text          -- raw template with {{variables}}
  variables       jsonb         -- [{ name, type, required, default }]
  notes           text          -- what changed vs previous version
  created_at      timestamp
  created_by      text

prompt_active
  slot            text
  card_type       text          -- nullable
  active_template_id  integer FK -> prompt_templates.id
  PRIMARY KEY (slot, card_type)
```

**Work:**
- Migrate the three current functions from `shared/prompts.ts` into `prompt_templates` as `version 1` of each slot
- Refactor `server/routes/generation.ts` to read the active template from DB via a `resolvePrompt(slot, cardType)` helper
- Render templates server-side with variable substitution (replace `{{name}}`, `{{scene}}`, etc.)
- Admin UI page `/admin/prompts`:
  - One panel per slot
  - Full version history per slot, newest first
  - Diff view between any two versions
  - "Activate" button (atomic flip of `prompt_active`)
  - "Duplicate and edit" to create a new draft version

**Success criteria:** The question "what prompt generated card X?" has a precise answer after this phase ships.

### Phase 2 — Fixture & Preview Modes

**Goal:** Run the full user journey end-to-end for near-zero cost.

**Three generation modes, switchable per-request:**

| Mode | Cost | Behaviour |
|---|---|---|
| `live` | Full (~$0.133) | Real OpenAI call, `quality: high`, real output |
| `preview` | ~$0.009 | Real OpenAI call, `quality: low`, same prompt, ~15× cheaper |
| `fixture` | $0 | Returns a pre-generated stock image from `test-fixtures/` keyed by slot + scene archetype. No API call. |

**Work:**
- Add a `mode` parameter to all image generation endpoints (query param or header `x-generation-mode`)
- Gate mode selection by authenticated admin email to prevent abuse
- Add a "Dev Mode" toggle in your own user profile that forces `fixture` for the entire journey
- Build a fixture library: 8–10 pre-generated representative images covering beach, forest, kitchen, abstract, portrait, urban, fantasy, minimalist — stored under `server/test-fixtures/`
- Log the mode used with every generation for later analysis

**Success criteria:** You can click through the entire card-creation journey 50 times a day without material spend.

### Phase 3 — Variant Testing UI

**Goal:** Test front and inside prompts side-by-side, with real data, cheaply.

**New admin page:** `/admin/prompt-lab`

**Layout:**
- **Left pane — Prompt editor:** pick slot, pick base version, edit the template in a textarea with variable autocomplete. Syntax highlighting for `{{variables}}`.
- **Middle pane — Input fixtures:** library of saved test input bundles (e.g. "Sarah, birthday, beach, watercolour, + photo-of-Sarah"). Reusable, versioned, named. This is your golden test set.
- **Right pane — Results:** "Run" button generates N variants in parallel (default 2, max 4) against the selected inputs. Defaults to `preview` mode. Side-by-side display with the exact rendered prompt under each image.

**Actions:**
- "Save as version" — creates new `prompt_templates` row as draft (not active)
- "Promote to active" — atomically flips `prompt_active`
- "Diff vs active" — inline diff view
- "Fork from version X" — branch and experiment
- "Tag" — free-text notes ("reduced facial rules", "tried emphasising lighting")

**Success criteria:** Testing a prompt change against 5 inputs takes under 2 minutes and costs under $0.10.

### Phase 4 — Provider Abstraction + Cost Ledger

**Goal:** Swap models in seconds; track every penny.

**New abstraction layer:** `server/image-providers/`

```ts
interface ImageProvider {
  id: string;                    // 'openai-gpt-image-1.5'
  displayName: string;
  handlesText2Image: boolean;
  handlesEdits: boolean;
  supportsMultiReference: boolean;
  maxReferenceImages: number;

  generate(req: GenerateRequest): Promise<GenerateResult>;
  estimateCost(req: GenerateRequest): number; // in pence
}
```

**Concrete adapters:**
- `openai.ts` — gpt-image-1.5 (primary, existing behaviour)
- `gemini.ts` — Nano Banana Pro (new, priority)
- `flux.ts` — Flux Kontext Pro (new, cost-optimised tier)
- Stubs only, no impl: `replicate.ts`, `stability.ts`

**New DB tables:**

```
generation_log
  id                     bigserial PK
  card_id                integer FK nullable
  slot                   text
  provider_id            text
  model                  text
  prompt_template_id     integer FK
  prompt_template_version integer
  prompt_rendered        text         -- the exact string sent to the model
  input_tokens           integer      -- where applicable
  output_tokens          integer
  cost_pence             integer      -- calculated per provider
  duration_ms            integer
  mode                   text         -- 'live' | 'preview' | 'fixture'
  success                boolean
  error_code             text nullable
  error_safety_category  text nullable -- 'person' | 'minor' | 'violence' | 'ip' | 'other'
  created_at             timestamp

provider_credentials
  provider_id     text PK
  api_key_encrypted  text
  rotated_at      timestamp
```

**Every single generation writes a row. No exceptions.** This is the IP record — it's how you prove a prompt version is better than another.

**Admin dashboard `/admin/costs`:**
- Spend per day / week / month
- Spend broken down by provider / model / slot / card type
- Average cost per completed card (and per abandoned card)
- Safety-filter hit rate per prompt version
- Top 10 most expensive prompt versions
- "Cost per successful card" including retries

**API key vault:** encrypted at rest in `provider_credentials`, managed via admin UI, never touched in `.env` after initial bootstrap.

**Success criteria:** You can answer "what did I spend on image generation last week, broken down by model?" in under 5 seconds.

### Phase 5 — Evals, Safety, Shadow Mode

**Goal:** Move from "feels better" to "scores 8.2 vs 7.4 on the rubric."

**Features:**
- **Golden test set:** 20 curated input bundles covering edge cases (diverse ethnicities, tricky names, ambiguous scenes, potentially-sensitive scenarios). Frozen regression suite.
- **Blind comparison UI:** generate prompt A and prompt B against the same input, hide identities, click the winner. Builds an Elo-style score per prompt version over time.
- **Rubric scoring (automated):** pass outputs through a vision model (Claude/GPT-4V) to auto-score on:
  - Facial likeness (photo flow only)
  - Composition quality
  - Text rendering accuracy
  - Style adherence
  - Safety / appropriateness
- **Safety category logging:** every safety hit bucketed so you can see which prompt phrases trigger which categories
- **Pre-flight moderation:** run user inputs through OpenAI's cheap moderation endpoint before spending on image generation
- **Shadow mode:** optionally run a candidate prompt alongside the live prompt on real user traffic. Log both outputs. Only serve the live one. Gold standard for validating before promotion.
- **Cost caps:** hard daily/monthly spend limits in code. Belt and braces.

**Success criteria:** You ship a new prompt version with quantitative confidence it's better than the previous one.

---

## 5. Bonus Ideas Worth Building In

These came out of reading the actual current prompts. Not gated to any specific phase — build them when the opportunity arises.

1. **Card-type-aware prompts.** First-class support for per-celebration prompt variants. Sympathy cards must not say "characters look happy."
2. **Composable prompt blocks.** Split `buildScenePrompt`'s 60 lines into reusable sections (`FACIAL_RECREATION_BLOCK`, `COMPOSITION_BLOCK`, `TEXT_INTEGRATION_BLOCK`, `STYLE_BLOCK`). Mix-and-match without rewriting the whole prompt.
3. **Named variables with types.** Instead of raw `${name}` interpolation, declare typed variables per template so the lab UI can auto-generate input forms.
4. **Prompt "recipes" for regeneration.** Store the exact rendered prompt (+ seed where supported) against each card. User regenerations become "modify this recipe" rather than "rebuild from answers".
5. **Known-bad prompt museum.** Archive prompts that failed in interesting ways, tagged with why. Saves re-learning lessons six months later.
6. **Pre-flight moderation.** Covered in Phase 5 but worth restating — cheap moderation call before expensive image call.
7. **Multi-reference photo upload.** Nano Banana Pro supports up to 14 reference images. This is a product unlock — asking users for 2–3 photos could jump likeness from 60–70% to 90%+.
8. **Seed control where supported.** Determinism for reproducible tests, even if only on some providers.

---

## 6. Model Research: The Landscape

Research completed 2026-04-10. Prices and capabilities as of that date.

### 6.1 OpenAI gpt-image-1.5 — Current Baseline

**Released:** 2025-12-16
**Status:** Already in production at Celebrait

**Improvements over gpt-image-1:**
- 4× faster generation
- ~20% cheaper image tokens
- **Targeted likeness preservation across edits** — OpenAI explicitly optimised for "upload a photo, change context/clothing/environment, keep recognisable facial features." This is literally Celebrait's product.
- Natural skin texture (gpt-image-1 had a plastic-smooth look)
- Tighter prompt following — hex colours, camera angles, lighting setups actually respected

**Known weakness (from user experience):**
- Likeness from single-reference photo still hits a ceiling around 60–70% accuracy on challenging subjects
- Gets worse when pushing hard on stylisation (watercolour, anime, etc.)

**Pricing (1024×1024):**
| Quality | Cost |
|---|---|
| Low | $0.009 |
| Medium | $0.034 |
| High (current Celebrait setting) | $0.133 |

**API:** OpenAI direct, mature SDK
**Multi-reference:** No (single image input)

### 6.2 Google Nano Banana Pro (Gemini 3 Pro Image) — The Likely Winner on Likeness

**Released:** Late 2025 / early 2026
**Status:** Not yet tested at Celebrait — **top priority to test**

**Why it matters:**
- **Identity Lock supports up to 14 reference images** of the same subject. This is a structural advantage, not just a bigger model. More reference data in → dramatically better likeness out.
- Maintains character resemblance across **up to 5 characters simultaneously** — useful for family / group cards
- Independent third-party comparisons report Nano Banana Pro beats gpt-image-1.5 specifically on **face preservation during style transfer** — the exact failure mode Celebrait hits hardest
- Strong spatial-context understanding

**Pricing (1024×1024):**
- Google direct: $0.134/image
- fal.ai: $0.15/image
- Google Batch API: $0.067/image (50% discount)

**API:** Google AI API direct, or via fal.ai / Kie.ai / other aggregators
**Multi-reference:** Yes (up to 14 images)

### 6.3 Black Forest Labs FLUX.1 Kontext Pro — The Cheap Workhorse

**Status:** Not yet tested at Celebrait — secondary priority

**Why it matters:**
- Purpose-built for in-context editing: take a reference image, modify scene/style/background, keep identity intact
- Ranked top in third-party benchmarks for "Character Preservation"
- **$0.04/image on fal.ai** — roughly 1/3 the price of gpt-image-1.5 high quality
- Also has a `[max]` variant (higher quality) and `[dev]` open-weight version (self-hosting escape hatch)
- Minor weakness: occasionally softens fine detail on tight masks

**Pricing (1024×1024):**
- fal.ai: $0.04/image (Kontext Pro)
- Kontext Max: ~$0.08/image depending on platform

**API:** BFL direct, fal.ai, AIMLAPI, Fireworks AI, Replicate — mature options
**Multi-reference:** 1 reference image (primary use case is single-ref editing)

**Role in the bake-off:** if it's 80% as good at 1/3 the price, it becomes the `preview` tier — or even the default for certain card types.

### 6.4 Midjourney (Omni Reference / --cref) — Don't Build On It

**Status:** Honourable mention only

**Pros:**
- Best raw aesthetic quality in the market
- Omni Reference (v7) is the current character-reference system

**Cons (fatal for a commercial product):**
- **No official API.** Only unofficial API wrappers, all TOS-grey and unreliable
- Best results require first generating a Midjourney-style version of the photo, then referencing that — adds a round trip
- Inconsistent availability

**Verdict:** Don't wire into production. Worth keeping as an R&D reference tool for benchmarking aesthetic ceilings.

### 6.5 Open-source escape hatch — FLUX.1 Kontext [dev], PuLID

Not a day-one concern. Worth knowing they exist if Celebrait ever needs to self-host (privacy-sensitive customers, or to escape per-image costs at scale). FLUX Kontext [dev] is open-weight and runs the same core model as Kontext Pro.

---

## 7. Pricing Comparison

All prices for 1024×1024 unless stated. Snapshot: 2026-04-10.

| Model | Cost/image | Identity Strength | Multi-Photo Input | API Maturity | Notes |
|---|---|---|---|---|---|
| gpt-image-1.5 `low` | $0.009 | Good | No | ★★★★★ | Ideal for `preview` mode |
| gpt-image-1.5 `medium` | $0.034 | Good | No | ★★★★★ | Middle ground |
| gpt-image-1.5 `high` (current) | $0.133 | Good (60–70% likeness ceiling) | No | ★★★★★ | Current baseline |
| Nano Banana Pro | $0.134 | **Best** (reportedly) | **Up to 14 refs** | ★★★★ | Priority test |
| Nano Banana Pro (batch) | $0.067 | Best | Yes | ★★★★ | Async, 50% cheaper |
| Flux Kontext Pro | $0.040 | Very good | 1 ref | ★★★★ | Cheap workhorse |
| Flux Kontext Max | ~$0.080 | Very good | 1 ref | ★★★★ | Quality tier |
| Midjourney (via unofficial API) | Variable | Very good | 1 ref | ★★ | **Do not use in production** |

---

## 8. Recommended First Bake-Off

Run this the moment Phase 3 (Variant Testing UI) is live — or as a manual exercise beforehand if urgency demands.

### 8.1 Models Under Test

1. **gpt-image-1.5 @ high** — baseline
2. **Nano Banana Pro** (single-reference) — expected likeness winner
3. **Nano Banana Pro** (3-reference) — test the multi-ref advantage
4. **Flux Kontext Pro** — cost-performance play

### 8.2 Scoring Rubric (1–10 per axis, blind ratings)

| Axis | What It Measures |
|---|---|
| Facial likeness | Does the output look like the reference person? (photo flow only) |
| Scene adherence | Did it actually put them on the beach / in the forest / etc.? |
| Style adherence | Does the watercolour actually look like watercolour? |
| Text rendering | Is "Happy Birthday Sarah" spelled right and well-integrated? |
| Composition | Is the image well-framed, balanced, print-ready? |
| Safety hit rate | How often does this model refuse on the same inputs? (lower is better) |
| Cost per successful generation | Including retries after safety hits |
| Wall-clock time | Per generation |

### 8.3 Golden Input Set

10 fixed input bundles covering:
- Diverse ethnicities (5+ skin tones)
- Diverse ages (child, young adult, middle-aged, senior)
- Different celebration types (birthday, anniversary, graduation, sympathy, new baby)
- Varied scenes (beach, forest, kitchen, abstract, portrait, urban)
- A mix of art styles (watercolour, oil, photorealistic, anime, minimalist)
- At least one "edge case" scenario (multi-person, unusual clothing, sensitive context)

Store these as reusable fixtures in the lab. They become the permanent regression suite.

### 8.4 Budget

10 golden inputs × 4 model configurations × 2 variants each = 80 generations
At averaged ~$0.10/image = **~$8 for a full bake-off**

This becomes a repeatable drill, run whenever a new model ships or every ~3 months.

### 8.5 Decision Criteria

A model becomes a candidate for production if it scores **≥ baseline** on facial likeness **and** scene adherence, at **≤ 1.5× baseline cost**. A model becomes the new default if it beats baseline on both axes at equal or lower cost.

---

## 9. Strategic Notes

### 9.1 Model Flexibility Is Non-Negotiable

Image generation is improving at roughly one generational leap every 6–9 months. Celebrait must be positioned to re-benchmark every 3 months and silently upgrade. The Phase 4 provider abstraction is the specific lever that makes this a 1-day job instead of a 1-month rewrite.

### 9.2 The Multi-Reference Photo Unlock

Nano Banana Pro's 14-image identity lock is a **product-level unlock**, not just a technical one. If asking users for 3 photos (front, 3/4, smile) jumps likeness from 60–70% to 90%+, that is a conversion-rate improvement, not just a quality improvement. It may warrant changing the journey UX, not just the backend model.

**Action when building Phase 3:** include a test specifically for "single photo vs 3 photos on Nano Banana Pro" so the product question is answered with data.

### 9.3 Build Order Rationale

Why Phase 1 (DB) before Phase 2 (fixture mode)?
- Because you need somewhere to log which mode each generation used, and the prompt template it rendered. The DB model is the foundation everything else records against.

Why Phase 3 (UI) before Phase 4 (multi-model)?
- Because you should be able to iterate on OpenAI prompts today in a clean environment, and new-model integration is a bigger lift. Shipping Phase 3 against OpenAI-only still removes the biggest daily friction.

Why Phase 5 last?
- Because evals are only meaningful when you have multiple versions to compare, multiple models to A/B, and cost data to weigh against quality. It assumes everything below it.

### 9.4 What This Is NOT

- Not a public-facing feature
- Not a replacement for user feedback
- Not a reason to delay the UX overhaul forever — Phases 0–2 are the critical path; Phases 3–5 can overlap with UX work
- Not a moat in itself — the moat is the prompt IP that the lab lets you develop faster than competitors

---

## 10. Sources

### OpenAI gpt-image-1.5
- [GPT Image 1.5 Model | OpenAI Platform Docs](https://platform.openai.com/docs/models/gpt-image-1.5)
- [OpenAI Launched GPT-Image-1.5 | Fello AI](https://felloai.com/the-gpt-image-1-5-update-that-changes-everything/)
- [GPT Image 1 vs GPT Image 1.5 | AI Free API](https://www.aifreeapi.com/en/posts/gpt-image-1-vs-gpt-image-1-5)
- [GPT Image 1.5 Pricing | AI Free API](https://www.aifreeapi.com/en/posts/gpt-image-1-5-pricing)
- [OpenAI Image Generation API Pricing in 2026](https://www.aifreeapi.com/en/posts/openai-image-generation-api-pricing)

### Google Nano Banana Pro
- [Nano Banana Pro | Google DeepMind](https://deepmind.google/models/gemini-image/pro/)
- [Nano Banana Pro: Gemini 3 Pro Image | Google Blog](https://blog.google/innovation-and-ai/products/nano-banana-pro/)
- [Nano Banana Pro Face Consistency Guide | LaoZhang](https://blog.laozhang.ai/en/posts/nano-banana-pro-face-consistency-guide)
- [Nano Banana Pro on fal.ai](https://fal.ai/models/fal-ai/nano-banana-pro)
- [Nano Banana Pro Pricing Breakdown](https://blog.laozhang.ai/en/posts/nano-banana-pro-pricing)

### Black Forest Labs FLUX.1 Kontext
- [FLUX.1 Kontext | Black Forest Labs](https://bfl.ai/models/flux-kontext)
- [FLUX.1 Kontext on fal.ai](https://fal.ai/models/fal-ai/flux-pro/kontext)
- [FLUX API Pricing | BFL](https://bfl.ai/pricing)
- [FLUX.1 Kontext Paper (arXiv)](https://arxiv.org/html/2506.15742v2)

### Comparison Articles
- [GPT Image 1.5 vs Nano Banana Pro | getimg.ai](https://getimg.ai/blog/gpt-image-15-vs-nano-banana-pro-comparison-which-ai-image-model-is-better)
- [Nano Banana Pro vs GPT-Image 1.5 | Vidguru](https://www.vidguru.ai/blog/nano-banana-pro-vs-gpt-image-1-5-comparison.html)
- [GPT Image 1.5 vs Nano Banana Pro vs FLUX.2 Max | Overchat](https://overchat.ai/ai-hub/ultimate-ai-image-generator-showdown)
- [Nano Banana Pro vs Flux 2 Max vs GPT 1.5 | Medium (Cogni Down Under)](https://medium.com/@cognidownunder/nano-banana-pro-vs-flux-2-max-vs-gpt-1-5-106c8f5de7b4)

### Midjourney (Reference Only)
- [Midjourney Character Reference Docs](https://docs.midjourney.com/hc/en-us/articles/32162917505293-Character-Reference)

---

## Revision Log

| Date | Change | By |
|---|---|---|
| 2026-04-10 | Initial plan locked, based on codebase audit + model research | Claude (with Aidan) |
| 2026-04-10 | Phase 0 cleanup executed: deleted `client/src/lib/openai.ts`, snapshotted prompts to `prompts-snapshot-v0.md`, refactored `image-store.ts` to fix upload-hang bug. Corrected 3.1 ground-truth section after discovering the original audit was reading a stale worktree; the real `shared/prompts.ts` has two functions (`buildInsidePrompt`, `buildScenePrompt`), not three. | Claude (with Aidan) |

*Update this table whenever the plan changes. If phases are reordered, features added/removed, or new model research comes in, log it here.*
