# Objective

Replace the current Paystack redirect flow on the regen page with an inline payment modal that:
1. Clearly communicates the commitment (you're ordering a printed version of this new design)
2. Shows a Stripe-style payment form (mock for testing — no keys needed)
3. In test mode: clicking "Pay" bypasses real payment and fires the regen directly
4. When Stripe keys are added later, the same modal wires up to real Stripe with minimal changes

---

# Background

The backend `execute-regeneration` endpoint already supports no-key test mode — if no payment reference or Paystack key is present, it skips verification and fires the regen. So no backend changes are needed. This is a pure frontend rework of `regen-page.tsx`.

---

# Placeholder UK prices (easy to update)

| Item | Price |
|---|---|
| Printed card (5"×5", front + inside) | £9.99 |
| Regen — new front design | +£2.99 |
| Regen — new inside message | +£1.99 |
| Regen — front + inside | +£3.99 |

---

# Tasks

### T001: Replace Paystack redirect with an inline payment modal on the regen page
- **Blocked By**: []
- **Details**:

  **State to add:**
  - `showPayModal: boolean` — controls modal visibility
  - `mockCardNumber: string`, `mockExpiry: string`, `mockCvc: string` — fake card inputs for visual realism
  - `payProcessing: boolean` — loading state while execute-regeneration is called

  **Flow change:**
  - `handlePay` no longer calls `initiate-regeneration` or redirects anywhere
  - Instead: validate email is present, then `setShowPayModal(true)`
  - Remove the old `initiate-regeneration` API call entirely from the frontend

  **Modal design:**
  - Full-screen overlay with a centered card (max-w-md)
  - Top banner: "🧪 TEST MODE — no payment is processed" (yellow/amber, only shown when in test mode — can use an env check or just always show for now since there are no keys)
  - Header: "Order a new version"
  - Subtext: "You're committing to printing this new version of [recipient]'s card."
  - Price breakdown (styled like a receipt):
    - Printed card (front & inside): £9.99
    - [New front design / New inside / Front + inside]: +£X.XX
    - Divider line
    - **Total: £XX.XX**
  - Mock card form (Stripe-style visual):
    - Card number input: placeholder "4242 4242 4242 4242" (auto-formats with spaces)
    - Row: Expiry input (MM/YY) + CVC input (3 digits)
    - Lock icon + "Secured by Stripe" text (even in mock, so it looks right)
  - Pay button: "Pay £XX.XX (Test Mode)" — gradient purple-to-pink, full width
  - On click: set `payProcessing = true`, call `POST /api/cards/:id/execute-regeneration` with:
    ```json
    {
      "regenerateType": "...",
      "userEmail": "...",
      "newScene": "...",   // if edited
      "newArtStyle": "...", // if edited
      "newInsideMessage": "..." // if edited
    }
    ```
    (No `paystackReference` — backend skips verification when it's absent and no keys are set)
  - On success: close modal, `setConfirmPhase(true)` to show existing confirmation/polling screen
  - On error: show error toast, `payProcessing = false`
  - Cancel/close button: "✕" top-right of modal, closes without doing anything

  **Remove:**
  - The old `handlePay` Paystack redirect logic
  - The `paying` state (replaced by `showPayModal` + `payProcessing`)
  - The old `priceLabel` (R25/R15/R35) — replaced by GBP prices

  **Keep:**
  - All existing edit sections (scene, style, message accordions)
  - Regen type auto-selection logic
  - The confirmation/polling screen (already works perfectly)
  - OTP auth gate

  - Files: `client/src/pages/regen-page.tsx`
  - Acceptance: clicking "Pay & Regenerate" opens a modal with full price breakdown; clicking "Pay £X.XX (Test Mode)" fires the regen, closes the modal, shows the generating confirmation screen; no redirect to Paystack; pricing shown in GBP
