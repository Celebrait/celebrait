// client/src/lib/legal.ts
//
// Single source of truth for the legal identity used across the Privacy
// Policy and Terms of Service pages. Fill these in ONCE and both
// documents update.
//
// ⚠️ TODO(founder + solicitor) before real customers or real payments:
//   • legalName / address / companyNumber — the real registered entity.
//     (Aidan 2026-09-23: "there is no registered entity atm just
//     testing", so these are deliberately still unset.)
//   • icoNumber — register at ico.org.uk (data-protection fee) and add it.
//   • Confirm the two contact mailboxes actually exist and are monitored;
//     the documents promise responses to them.
//   • Have a UK solicitor review both documents. These are careful,
//     accurate drafts written to match what the product actually does —
//     they are not a substitute for legal advice.
//
// UNTIL THEN: a field left as a [bracketed placeholder] is treated as
// UNSET, and the pages leave its line out entirely rather than printing
// the brackets at a real visitor. Both legal pages are deliberately
// OUTSIDE the pre-launch site lock (see components/site-gate.tsx), so
// anyone who clicks "Privacy" from the early-access form reaches them —
// which is exactly why they must never read like a half-built form.
//
// This is a stopgap that stops the page looking broken. It is NOT a
// substitute for naming the controller: UK GDPR expects a visitor to be
// able to see WHO holds their data. Name the entity before the list is
// used for anything.

/** A value counts as set only once the [placeholder] has been replaced. */
const set = (v: string): string | null => {
  const t = v.trim();
  return !t || t.startsWith('[') ? null : t;
};

const RAW = {
  /** Registered legal entity (the party the user contracts with). */
  legalName: "[Legal entity name — e.g. Celebrait Ltd]",
  /** Registered / principal business address. */
  address: "[Registered / business address, United Kingdom]",
  /** Companies House number, if a limited company (else leave blank). */
  companyNumber: "[Companies House number, if applicable]",
  /** ICO data-protection registration number. */
  icoNumber: "[ICO registration number — see note]",
} as const;

export const CONTROLLER = {
  /** Consumer-facing brand. */
  tradingAs: "Celebrait",
  /** Mailbox for privacy / data-protection requests. */
  privacyEmail: "privacy@celebrait.co.uk",
  /** Mailbox for general / legal / support enquiries. */
  contactEmail: "hello@celebrait.co.uk",
  website: "https://celebrait.co.uk",
  /** Governing-law jurisdiction. */
  jurisdiction: "England and Wales",

  /** Null until the real entity is set — callers must handle that. */
  legalName: set(RAW.legalName),
  address: set(RAW.address),
  companyNumber: set(RAW.companyNumber),
  icoNumber: set(RAW.icoNumber),
} as const;

/** True once there is a named entity to contract with. While false, the
 *  pages say plainly that the service is pre-launch and not yet trading,
 *  instead of naming a company that doesn't exist yet. */
export const ENTITY_NAMED = CONTROLLER.legalName !== null;

/** Who the documents call "us". Falls back to the brand so no sentence
 *  ends up with a gap in the middle of it. */
export const PARTY = CONTROLLER.legalName ?? CONTROLLER.tradingAs;

/** Shown wherever the entity block appears while the entity is unset. */
export const PRE_LAUNCH_NOTE =
  "Celebrait is in pre-launch testing and is not yet trading as a registered company. " +
  "Registered-entity details will be published here before any card is sold. " +
  "In the meantime the contact addresses below reach us and are monitored.";

export const PRIVACY_LAST_UPDATED = "1 July 2026";
export const TERMS_LAST_UPDATED = "1 July 2026";
