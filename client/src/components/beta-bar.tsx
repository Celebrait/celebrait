// client/src/components/beta-bar.tsx
//
// The tester's reminder: a small pill, bottom-right, on every page while
// this visitor is in the beta. "Nothing is charged" + the way to the
// feedback form, so the ask is never more than one tap away. Marketing
// pages only (never over a flow's Next button). Dismiss = this tab.
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { MessageSquareHeart, X } from 'lucide-react';
import { useBetaTester, betaFeedbackHref } from '@/hooks/use-beta';

const KEY = 'celebrait:beta-bar:hidden';

export function BetaBar() {
  const tester = useBetaTester();
  const [location] = useLocation();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(sessionStorage.getItem(KEY) === '1'); } catch { setHidden(false); }
  }, []);
  if (!tester || hidden) return null;
  // Not where it could sit on a Next button: the making flows, sign-in,
  // checkout. Marketing pages only; the reveal screens carry their own CTA.
  if (/^\/(beta|admin|login|studio|make|create|photo\/make|checkout|buy|card-capture)(\/|$)/.test(location)) return null;
  const dismiss = () => { setHidden(true); try { sessionStorage.setItem(KEY, '1'); } catch { /* fine */ } };
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 sm:justify-end sm:px-6" data-testid="beta-bar">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-keeper-gold/40 bg-white/95 py-1.5 pl-4 pr-1.5 text-[13px] text-keeper-ink shadow-[0_6px_24px_rgba(20,16,12,0.12)] backdrop-blur">
        <span className="font-semibold text-keeper-gold">Beta</span>
        <span className="hidden text-keeper-body sm:inline">· nothing is charged</span>
        <Link
          href={betaFeedbackHref()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-keeper-gold px-3.5 font-semibold text-white transition-colors hover:bg-keeper-gold-deep"
          data-testid="beta-bar-feedback"
        >
          <MessageSquareHeart className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          Give feedback
        </Link>
        <button type="button" onClick={dismiss} aria-label="Hide for now" className="flex h-8 w-8 items-center justify-center rounded-full text-keeper-meta hover:bg-keeper-paper hover:text-keeper-ink">
          <X className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}
