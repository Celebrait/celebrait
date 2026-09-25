# End-to-end test on Render (payment → print)

How to make a **real** run of the whole flow on the Render deploy: sign in →
make a card → pay → Prodigi order → emails.

Everything below is env config. **No code changes are needed — the pipeline
is already complete**: payment confirms → the order flips to paid →
`submitPrintOrder()` → `provider.submitOrder()`
(`server/routes/studio-checkout.ts`). Both webhook routes exist.

---

## 1. Pick your level first

| | **Sandbox run** (recommended) | **Live run** |
|---|---|---|
| Stripe | test keys (`sk_test_…`) | live keys |
| Prodigi | sandbox (default host) | live host |
| Money | none | **real** |
| Physical card | none | **really printed + posted** |
| Good for | letting someone hammer the flow | exactly one deliberate test print |

**Start with the sandbox run.** It exercises every line of code the live one
does — the only difference is which host the two APIs point at.

> ⚠️ **Don't hand anyone the live run.** The checkout audit still lists price
> drift, VAT, refunds and fraud as open (`next_checkout_shipping_robust`).
> The live run is the one paid test print *you* do once, on purpose.

---

## 2. Pre-flight — the three that silently ruin the test

Check these **before** anyone starts, or you'll debug the wrong thing.

### `DEV_STUB_AI` must be UNSET
This is the big one. If it's set, generation never calls the model — the
pipeline **hands back the uploaded photo as the "card"** and reports success.
Your tester will think the AI is broken. It fails silently.

- Render → service → Environment → **delete `DEV_STUB_AI`** (and
  `ALLOW_STUB_TOGGLE`).
- Verify in the deploy logs: the line `⚠ DEV_STUB_AI is ON` must be **absent**.
- The admin toggle is per-instance and in-memory — it resets on every
  restart. **The env var is the master switch.**

### R2 must be enabled (all five vars)
Prodigi fetches the print asset over HTTP, so the images must be at absolute
public URLs. `isR2Enabled()` is false unless **all five** are set, and the
Prodigi provider then hard-errors:

```
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
R2_PUBLIC_URL          # public base URL, no trailing slash
```

### `DEV_AUTH_ACCEPT_ANY_CODE` must be UNSET
If set, OTP accepts `000000`/`123456` **for any email** — i.e. anyone can sign
in as anyone. Fine locally, a hole on a public URL.

---

## 3. Env vars to set on Render

Both providers **default to `stub`**. Without these you get a fake redirect,
"mark as paid" theatre, and no print order — which is not a test.

```bash
# ── switches (the important two) ──────────────────────────
STUDIO_PAYMENT_PROVIDER=stripe        # default: stub
STUDIO_PRINT_PROVIDER=prodigi         # default: stub

# ── Stripe ────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...         # TEST key for the sandbox run
STRIPE_WEBHOOK_SECRET=whsec_...       # from the Stripe dashboard (step 4)

# ── Prodigi ───────────────────────────────────────────────
PRODIGI_API_KEY=...                   # sandbox key for the sandbox run
# PRODIGI_BASE_URL                    # LEAVE UNSET → defaults to sandbox
                                      # live: https://api.prodigi.com/v4.0
PRODIGI_WEBHOOK_SECRET=<make one up>  # any random string; it's in the URL

# ── needed by both ────────────────────────────────────────
PUBLIC_APP_ORIGIN=https://<your-render-host>
```

Optional — only if the defaults don't match your Prodigi account:

```bash
PRODIGI_CARD_SKU=...            # Direct Delivery SKU (posted to recipient)
PRODIGI_CARD_SKU_SELFSEND=...   # Self Send SKU (posted to sender)
PRODIGI_SHIPPING_METHOD=...     # fallback when the order carries no tier
```

---

## 4. Webhooks

**Stripe** → dashboard → Developers → Webhooks → add endpoint:

```
https://<your-render-host>/api/webhooks/stripe
```

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

**Prodigi** → dashboard → callback URL:

```
https://<your-render-host>/api/webhooks/prodigi/<PRODIGI_WEBHOOK_SECRET>
```

The secret is the URL path, so make it long and random.

> The success page **also** confirms the order on redirect, so payment works
> even if the Stripe webhook isn't wired. Wire it anyway — it's what catches
> the case where the customer closes the tab before redirecting back.

---

## 5. The run

1. **Sign in** — real OTP email via Brevo. Check it arrives.
2. **Make a card** — upload a photo, describe a scene, generate the front.
   → *If the "card" is just your photo back, `DEV_STUB_AI` is still on. Stop.*
3. **Write the inside** — or choose blank.
   → Blank insides skip the giving step and always post to **you** (by design —
   you can't post someone an empty card).
4. **Review → Send this card.**
5. **Giving step** — pick **Straight to them** or **To me first**.
   → This picks the Prodigi SKU: `DIR` (recipient) vs `BLA` (sender).
6. **Checkout** — £8.99 + postage (£1.95 RM24 / £5.95 / £10.95).
   Stripe hosted page. Test card: `4242 4242 4242 4242`, any future expiry,
   any CVC.
7. **Success page** — order flips to paid.

### What to verify

| Where | Expect |
|---|---|
| Stripe dashboard | a test payment for the right amount |
| Render logs | no `print submission dispatch failed` |
| Prodigi sandbox | a new order, correct SKU, **one** asset (the 4-panel strip) |
| `/studio/orders` | `providerOrderId` + fulfilment status set, not "processing" forever |
| Inbox | order-confirmed email |

---

## 6. What will NOT happen (known, not bugs)

- **No physical card** on the sandbox run. Prodigi sandbox accepts and
  fulfils nothing.
- **Shipped/delivered emails won't fire** unless Prodigi's callback reaches
  you and their sandbox emits those events. The order may sit at `submitted`.
- **Anything after payment is best-effort** — a print submission failure is
  logged and marked `failed`, never thrown back into the paid flip. So a
  green success page does **not** prove the print order landed. Check Prodigi.
- **`generation_log` writes** are on (Render is `NODE_ENV=production`), so
  test runs will land in the cost/telemetry table alongside real data.

---

## 7. Rolling back

Delete the two switches — everything reverts to stub:

```bash
STUDIO_PAYMENT_PROVIDER    # delete → stub
STUDIO_PRINT_PROVIDER      # delete → stub
```

Leave the Stripe/Prodigi keys; they're inert while the switches are stub
(both providers construct their clients lazily).

---

## 8. Going live later

Only two changes:

```bash
STRIPE_SECRET_KEY=sk_live_...
PRODIGI_BASE_URL=https://api.prodigi.com/v4.0   # + live PRODIGI_API_KEY
```

Then **one** order, watched end to end, with a real card arriving. Do the
open checkout work first (price drift, VAT, refunds, fraud).
