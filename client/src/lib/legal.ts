// client/src/lib/legal.ts
//
// Single source of truth for the legal identity used across the Privacy
// Policy and Terms of Service pages. Fill these in ONCE before launch and
// both documents update.
//
// ⚠️ TODO(founder + solicitor) before publishing:
//   • legalName / address / companyNumber — the real registered entity.
//   • icoNumber — register at ico.org.uk (data-protection fee) and add it.
//   • Confirm the two contact mailboxes actually exist and are monitored;
//     the documents promise responses to them.
//   • Have a UK solicitor review both documents. These are careful,
//     accurate drafts written to match what the product actually does —
//     they are not a substitute for legal advice.

export const CONTROLLER = {
  /** Registered legal entity (the party the user contracts with). */
  legalName: "[Legal entity name — e.g. Celebrait Ltd]",
  /** Consumer-facing brand. */
  tradingAs: "Celebrait",
  /** Registered / principal business address. */
  address: "[Registered / business address, United Kingdom]",
  /** Companies House number, if a limited company (else leave blank). */
  companyNumber: "[Companies House number, if applicable]",
  /** ICO data-protection registration number. */
  icoNumber: "[ICO registration number — see note]",
  /** Mailbox for privacy / data-protection requests. */
  privacyEmail: "privacy@celebrait.co.uk",
  /** Mailbox for general / legal / support enquiries. */
  contactEmail: "hello@celebrait.co.uk",
  website: "https://celebrait.co.uk",
  /** Governing-law jurisdiction. */
  jurisdiction: "England and Wales",
} as const;

export const PRIVACY_LAST_UPDATED = "1 July 2026";
export const TERMS_LAST_UPDATED = "1 July 2026";
