// client/src/components/photo-consent-tips.tsx — the photo scaffold, shared
//
// The consent line and the upload tips the photo route shows before a
// real person's photo is used (studio/steps/photo-step.tsx). The three-
// card cameo takes the same photo for the same purpose — printed and
// sold — so it shows the same words (launch audit 2026-10-06, parity).
// Same localStorage key as the studio, so a customer who has already
// said yes on one route isn't asked again on the other.
//
// ⚠️ TODO(solicitor): wording + whether consent must be recorded
// server-side — see the note on PHOTO_CONSENT_KEY in photo-step.tsx.
// photo-step.tsx still carries its own copy of these; fold it onto this
// file once the photo-route edits in flight have landed.

import { Lightbulb, Check } from 'lucide-react';
import { Link } from 'wouter';
import { Checkbox } from '@/components/ui/checkbox';

export const PHOTO_CONSENT_KEY = 'celebrait:photo-consent:v1';

export function readPhotoConsent(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(PHOTO_CONSENT_KEY) === 'true';
  } catch {
    return false;
  }
}

export function rememberPhotoConsent(): void {
  try {
    window.localStorage.setItem(PHOTO_CONSENT_KEY, 'true');
  } catch {
    /* private mode / storage disabled — consent still holds for this session */
  }
}

/** The one-time consent line: a checkbox that gates the upload. Render
 *  only while consent hasn't been given; the caller holds the state. */
export function PhotoConsentLine({ onConsent, className = '' }: { onConsent: () => void; className?: string }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border border-accent-red/25 bg-accent-red-light/60 px-4 py-3 ${className}`}
      data-testid="photo-consent"
    >
      <Checkbox
        checked={false}
        onCheckedChange={(v) => { if (v === true) onConsent(); }}
        className="mt-0.5"
        aria-label="I have permission to use these photos and agree to the Terms and Privacy Policy"
        data-testid="photo-consent-checkbox"
      />
      <span className="text-[12.5px] text-keeper-body leading-snug">
        I have permission to use these photos, and I agree to the{' '}
        <Link href="/terms-of-service" className="text-brand hover:text-brand-dark underline underline-offset-2">Terms</Link>{' '}
        and{' '}
        <Link href="/privacy-policy" className="text-brand hover:text-brand-dark underline underline-offset-2">Privacy Policy</Link>.
      </span>
    </div>
  );
}

/** "What makes a good photo" — inline, read where it's acted on. `cameo`
 *  is the one-crop variant: the three-card route draws from a single
 *  crop, so "a few angles" would be a promise it can't keep. */
export function PhotoTips({ mode, className = '' }: { mode: 'one_person' | 'group' | 'cameo'; className?: string }) {
  const tips =
    mode === 'group'
      ? ['One photo with everyone in it', 'Faces clearly visible and facing the camera', 'Even lighting, no heavy shadows or backlight']
      : mode === 'cameo'
        ? ['A clear, front-on photo of their face', 'Even lighting, no heavy shadows or backlight', 'Crop in close. We draw from the crop you choose']
        : ['A clear, front-on photo of their face', 'Even lighting, no heavy shadows or backlight', 'A few different angles help the likeness'];
  return (
    <div className={`rounded-xl border border-keeper-hair bg-stone-50 px-4 py-3 ${className}`} data-testid="photo-tips">
      <div className="flex items-center gap-1.5 mb-2">
        <Lightbulb className="w-3.5 h-3.5 text-brand" strokeWidth={2} aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-keeper-ink">Tips for a great result</p>
      </div>
      <ul className="space-y-1">
        {tips.map((t) => (
          <li key={t} className="flex items-start gap-2 text-[12.5px] text-keeper-body leading-snug">
            <Check className="w-3.5 h-3.5 text-cta-hover shrink-0 mt-0.5" strokeWidth={2.5} aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
