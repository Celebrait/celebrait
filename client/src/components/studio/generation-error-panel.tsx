// client/src/components/studio/generation-error-panel.tsx
//
// Friendly failure UI for Studio generation errors. Replaces both the
// generic FailedView (initial-gen path) and the destructive red toast
// (regen path). Single source of truth so the user sees consistent
// kind-aware copy whether the failure happened during initial gen or a
// regen.
//
// Visual language (Keeper pass, 2026-07-09):
//
//   History: amber-only → too soft → warm dusty-brick red (#b94a44).
//   Under the Keeper skin Kevin rejected the brick as muddy on paper,
//   and picked "Keeper + ember": the panel now sits on keeper-paper +
//   hairline with a Fraunces title, and the ONE warm accent is the
//   refined ember terracotta (the `accent-red` token, now #c15b43) on
//   the top bar + icon disc + kind tag — so a failure still reads
//   distinct from a normal panel without a siren. The retry CTA is
//   GREEN (cta) — it fires a re-generation, a "commit" moment in the
//   button system. Destructive-delete keeps the separate system red;
//   this ember is warnings/failures only.
//
//   • One unified panel for ALL kinds. Kind differentiation comes from
//     the icon glyph + title + a small "kind tag" pill under the title
//     — not from per-kind surface tones.
//   • Surface: keeper-paper with an ember (accent-red) top bar +
//     hairline — reads as a confident stamp, not siren tape.
//   • Icon: `accent-red-dark` (ember) glyph in an `accent-red-light`
//     disc. Kind-specific lucide icon (Shield / Clock / CloudOff /
//     Settings / HelpCircle).
//   • Title: kind-specific friendly statement, Fraunces on keeper-ink.
//   • Kind tag: small uppercase ember pill ("Safety filter", …).
//   • Description: 1–2 line plain-English body in keeper-stone.
//   • Action chips: white pill that hovers to an ember tint.
//   • Primary CTA: GREEN (cta) "Try again" — it fires a re-generation, a
//     commit moment in the button system. (Was brand violet pre-Keeper.)
//   • Disclosable footer: provider · code · attempts + raw model
//     explanation, quiet in the ember family.
//
// Copy ladder (description picks based on what we know):
//   1. Pre-flight matched a known IP term → name it (future, when the
//      legal hard-block list lands)
//   2. Gemini RECITATION / SAFETY / BLOCKLIST → category-specific
//   3. Generic fallback → "usually a copyrighted character, named
//      celebrity, or something sharp in the scene"
//
// Same panel shape every time; only the description sentence + kind
// tag + icon glyph change.
//
// Accepts a `context: 'initial' | 'regen'` prop so the copy can branch
// (regen failures preserve the prior version; initial-gen failures
// don't have one). Cleaner than two parallel components.

import { useState } from 'react';
import {
  ShieldAlert,
  Clock,
  CloudOff,
  HelpCircle,
  Settings2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export type GenerationErrorKind =
  | 'safety'
  | 'rate'
  | 'server'
  | 'auth'
  | 'unknown';

export interface GenerationErrorPanelProps {
  /** Kind classification from the ProviderError. Drives icon, title,
   *  description, action chips, and tone. Null/unknown falls through
   *  to a generic 'unknown' presentation. */
  kind: GenerationErrorKind | null | undefined;
  /** Raw model explanation from the provider, if any. Shown in muted
   *  type below the description and (verbatim) in technical details. */
  modelExplanation?: string | null;
  /** Static suggestions[] from the ProviderError. Currently displayed
   *  via the action-chip mapping below — unused as raw text. Kept on
   *  the props for future use (e.g. when LLM rewrite generates
   *  contextual suggestions). */
  suggestions?: string[] | null;
  /** Provider id (e.g. 'openai', 'gemini-flash-2-5') — shown in
   *  technical details. */
  provider?: string | null;
  /** Error code (e.g. 'moderation_blocked') — shown in technical details. */
  code?: string | null;
  /** Number of retry attempts before final failure. Shown in technical
   *  details. Optional — null when not tracked. */
  retryAttempts?: number | null;
  /** Whether this came from initial-gen (no prior version) or regen
   *  (prior version preserved). Branches the description copy. */
  context: 'initial' | 'regen';
  /** Trigger a retry of the gen. The parent owns the actual mechanism
   *  (retry endpoint + start gen for initial; regen endpoint for regen). */
  onRetry: () => void | Promise<void>;
  /** Navigate to a specific Studio step. Wired by the parent so the
   *  action chips can jump to scene / photo / style etc. */
  onJumpToStep: (stepId: 'scene' | 'photo') => void;
  /** Show the retry CTA as pending (parent's mutation in flight). */
  isRetrying?: boolean;
}

// ─── Kind config — one place per kind ─────────────────────────────────

interface KindConfig {
  icon: typeof ShieldAlert;
  /** Short uppercase tag shown under the title. Skipped when undefined
   *  — used for rate/server/auth where the title already conveys the
   *  kind and the tag is just noise. */
  tag?: string;
  title: string;
  description: (context: 'initial' | 'regen') => string;
  /** Action chips in probability order (left = most likely fix). Empty
   *  array = skip the chips block entirely. Pills only make sense when
   *  the user can actually fix the failure by editing inputs (safety;
   *  unknown as a hedge). For rate/server/auth, editing inputs doesn't
   *  help — the failure is on the provider side or our infra. */
  chips: Array<{ stepId: 'scene' | 'photo'; label: string }>;
  /** Optional secondary line below the retry CTA. Used by `auth` to
   *  surface a support contact since the user can't actually fix an
   *  auth issue themselves. */
  contactLine?: { lead: string; email: string };
  /** Show the persistent panel (true) vs. expect a brief toast (false).
   *  Currently only safety+unknown render the panel; rate/server/auth
   *  render the panel too in the initial-gen path because there's no
   *  existing card to show, but as a brief warm toast in the regen path. */
  isPanelKind: boolean;
}

const KIND_CONFIG: Record<GenerationErrorKind, KindConfig> = {
  safety: {
    icon: ShieldAlert,
    tag: 'Safety filter',
    title: 'The safety filter caught this one',
    description: (_ctx) =>
      'Usually it’s a copyrighted character, a named celebrity, or something sharp in the scene. Tweak the input and try again.',
    chips: [
      { stepId: 'scene', label: 'Edit scene' },
      { stepId: 'photo', label: 'Change photo' },
      // 'Try a different style' chip REMOVED 2026-05-17 — style picker
      // parked for Premium. See next_celebrait_premium.md.
    ],
    isPanelKind: true,
  },
  rate: {
    icon: Clock,
    // No tag — title already conveys the kind. No chips — editing
    // inputs doesn't help with a rate limit, only waiting does.
    title: 'Slow down a sec',
    description: (ctx) =>
      ctx === 'regen'
        ? 'We’ve hit a rate limit on this provider. Wait 30 seconds and try again — your card’s still here.'
        : 'We’ve hit a rate limit on this provider. Wait 30 seconds and try again — your draft is saved.',
    chips: [],
    isPanelKind: true,
  },
  server: {
    icon: CloudOff,
    // No tag, no chips — same reasoning as rate. The provider's
    // overloaded; editing inputs doesn't help.
    title: 'The drawing engine’s busy',
    description: (ctx) =>
      ctx === 'regen'
        ? 'The image model is overloaded right now. Try again in a minute — your card’s still here.'
        : 'The image model is overloaded right now. Try again in a minute — your draft is saved.',
    chips: [],
    isPanelKind: true,
  },
  auth: {
    icon: Settings2,
    // No tag, no chips — the user can't fix an auth issue themselves.
    // Pills would imply agency they don't have. Contact line below
    // the retry CTA gives them a real escalation path if the retry
    // doesn't help.
    title: 'Something’s misconfigured',
    description: (_ctx) =>
      'We hit an authentication issue with the image provider. The team’s been notified — your draft is saved. Try again in a few minutes.',
    chips: [],
    contactLine: {
      lead: 'Still happening?',
      // Support mailbox, NOT ip@ — that's the IP/takedown address
      // (audit 2026-07-27).
      email: 'greetings@celebrait.co.uk',
    },
    isPanelKind: true,
  },
  unknown: {
    icon: HelpCircle,
    tag: 'Hiccup',
    title: 'That one didn’t land',
    description: (ctx) =>
      ctx === 'regen'
        ? 'Something didn’t go to plan, but your card’s still here. Try again, or tweak an input first.'
        : 'Something didn’t go to plan. Your draft is all saved — try again, or tweak an input first.',
    chips: [
      { stepId: 'scene', label: 'Edit scene' },
      { stepId: 'photo', label: 'Change photo' },
      // 'Try a different style' chip REMOVED 2026-05-17 — style picker
      // parked for Premium. See next_celebrait_premium.md.
    ],
    isPanelKind: true,
  },
};

function configFor(kind: GenerationErrorKind | null | undefined): KindConfig {
  if (!kind) return KIND_CONFIG.unknown;
  return KIND_CONFIG[kind] ?? KIND_CONFIG.unknown;
}

// ─── Component ────────────────────────────────────────────────────────

export function GenerationErrorPanel({
  kind,
  modelExplanation,
  provider,
  code,
  retryAttempts,
  context,
  onRetry,
  onJumpToStep,
  isRetrying,
}: GenerationErrorPanelProps) {
  const cfg = configFor(kind);
  const [techOpen, setTechOpen] = useState(false);
  const Icon = cfg.icon;

  return (
    <div
      className="max-w-md mx-auto rounded-2xl bg-keeper-paper border border-accent-red/30 shadow-[0_1px_2px_rgba(33,29,25,0.05),0_10px_30px_-18px_rgba(193,91,67,0.28)] overflow-hidden"
      data-testid="generation-error-panel"
      data-failure-kind={kind ?? 'unknown'}
      role="alert"
    >
      {/* Warm red accent bar — confident stamp of attention. Subtle
          inner gradient (light → dark → light) gives it a soft craft
          glow rather than a flat siren stripe. Sits in the new
          dusty-brick red family so it reads as "warning" without
          clashing with the cream + amber + violet palette. */}
      <div
        aria-hidden
        className="h-1.5 w-full bg-gradient-to-r from-accent-red/70 via-accent-red-dark to-accent-red/70"
      />

      <div className="p-6 sm:p-8">
        {/* Icon + title + kind tag — vertical stack, all centered.
            The red-tinted disc anchors the panel; the kind tag below
            the title is the lightweight differentiation surface that
            lets one unified design serve all five kinds. */}
        <div className="flex flex-col items-center text-center mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mb-4 bg-accent-red-light ring-1 ring-accent-red/40 ring-offset-2 ring-offset-keeper-paper"
            aria-hidden
          >
            <Icon
              className="w-7 h-7 text-accent-red-dark"
              strokeWidth={1.75}
            />
          </div>

          <h2 className="text-xl font-display font-bold text-keeper-ink leading-tight tracking-[-0.015em]">
            {cfg.title}
          </h2>

          {/* Kind tag — uppercase pill, sits between title and body.
              Only rendered when the kind config supplies a tag. Skipped
              for rate/server/auth where the title already conveys the
              kind and the tag would just be redundant chrome. */}
          {cfg.tag && (
            <span
              className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full bg-accent-red-light border border-accent-red/40 text-[10px] uppercase tracking-[0.16em] font-semibold text-accent-red-dark"
              data-testid="error-panel-kind-tag"
            >
              {cfg.tag}
            </span>
          )}
        </div>

        {/* Description — friendly, actionable. The provider's raw model
            explanation is intentionally NOT shown here; it's cold corporate
            boilerplate ("Your request was rejected by the safety system…")
            that adds nothing for the user. Available in technical details
            for devs / debugging. */}
        <p className="text-sm text-keeper-body leading-relaxed text-center max-w-sm mx-auto">
          {cfg.description(context)}
        </p>

        {/* Action chips — only render when the kind config supplies
            them. Skipped for rate/server/auth where editing inputs
            doesn't fix the failure (the user has no agency over
            provider rate limits or our auth config). For those kinds
            the panel collapses to icon + title + description + retry
            + tech details, which is what the user actually needs. */}
        {cfg.chips.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2 justify-center">
            {cfg.chips.map((chip) => (
              <button
                key={chip.stepId}
                type="button"
                onClick={() => onJumpToStep(chip.stepId)}
                className="inline-flex items-center px-3.5 py-1.5 rounded-full bg-white border border-keeper-hair hover:border-accent-red/60 hover:bg-accent-red-light/60 text-sm text-keeper-meta hover:text-keeper-ink transition-all shadow-sm"
                data-testid={`error-panel-chip-${chip.stepId}`}
              >
                <span>{chip.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Primary CTA — brand violet, consistent with regen's
            "Use this version". Keeps the studio's primary-action
            language stable across surfaces. */}
        <div className="mt-6">
          <Button
            onClick={() => onRetry()}
            disabled={isRetrying}
            size="lg"
            className="w-full bg-go hover:bg-go-hover text-go-foreground shadow-md shadow-cta/20"
            data-testid="error-panel-retry"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${isRetrying ? 'animate-spin' : ''}`}
            />
            {isRetrying ? 'Trying again…' : 'Try again'}
          </Button>
        </div>

        {/* Optional contact line — used by `auth` since the user can't
            actually fix an auth issue themselves. Light, non-alarming
            mailto so they have a real escalation path. */}
        {cfg.contactLine && (
          <p className="mt-3 text-[11px] text-keeper-meta text-center">
            {cfg.contactLine.lead}{' '}
            <a
              href={`mailto:${cfg.contactLine.email}`}
              className="text-brand hover:text-brand-dark font-medium"
              data-testid="error-panel-contact"
            >
              {cfg.contactLine.email}
            </a>
          </p>
        )}

        {/* Technical details (disclosable). Tighter, quieter than before.
            Hairline divider in red rather than stone so it stays in
            the same colour family as the rest of the panel. */}
        <div className="mt-6 border-t border-accent-red/20 pt-3">
          <button
            type="button"
            onClick={() => setTechOpen((v) => !v)}
            className="flex items-center gap-1 text-[11px] text-keeper-meta/70 hover:text-keeper-meta transition-colors mx-auto"
            data-testid="error-panel-tech-toggle"
          >
            {techOpen ? (
              <ChevronUp className="w-3 h-3" />
            ) : (
              <ChevronDown className="w-3 h-3" />
            )}
            <span>{techOpen ? 'Hide' : 'Show'} technical details</span>
          </button>
          {techOpen && (
            <dl className="mt-3 space-y-1 text-[11px] text-keeper-meta/80 font-mono bg-white/60 rounded-lg p-3 border border-accent-red/15">
              {kind && <Row label="kind" value={kind} />}
              {provider && <Row label="provider" value={provider} />}
              {code && <Row label="code" value={code} />}
              {typeof retryAttempts === 'number' && (
                <Row label="attempts" value={String(retryAttempts)} />
              )}
              {modelExplanation && (
                <div className="pt-2">
                  <span className="block text-keeper-meta/60">
                    model explanation:
                  </span>
                  <span className="block whitespace-pre-wrap text-keeper-meta mt-0.5">
                    {modelExplanation}
                  </span>
                </div>
              )}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-keeper-meta/50 w-20 flex-shrink-0">{label}:</span>
      <span className="text-keeper-meta break-all">{value}</span>
    </div>
  );
}
