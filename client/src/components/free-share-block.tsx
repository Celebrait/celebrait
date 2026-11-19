// client/src/components/free-share-block.tsx — the free digital link.
//
// One tap mints (or reuses) the card's public share token and copies
// celebrait.co.uk/c/<token> to the clipboard. Lifted out of
// studio-card-view.tsx (2026-11-05) so the beta can hand testers their
// card on the feedback thank-you and under the reveal ("be good to give
// the people a free digital card" — Aidan). Copy, never the native share
// sheet (Aidan 2026-08-07: "the button click should just copy the link").
import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { friendlyError } from '@/lib/friendly-error';

export function FreeShareBlock({ cardId, label = 'Or copy a digital preview link, free', copiedLabel = 'Link copied. Paste it anywhere', sub = "They'll see the card on any screen. The real thing still wants a letterbox.", prominent = false, className = '' }: {
  cardId: number;
  label?: string;
  copiedLabel?: string;
  sub?: string | null;
  /** true = a proper button (the beta thank-you); false = the quiet text link under Send. */
  prominent?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const getLink = async () => {
    if (url) return url;
    const res = await apiRequest('POST', `/api/studio/cards/${cardId}/share-token`);
    const body = (await res.json()) as { shareUrl?: string };
    if (!body.shareUrl) throw new Error('No link returned');
    const abs = `${window.location.origin}${body.shareUrl}`;
    setUrl(abs);
    return abs;
  };

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const link = await getLink();
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (err: any) {
      toast({ title: "Couldn't copy the link", description: friendlyError(err, 'Try again in a moment.'), variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const cls = prominent
    ? 'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-keeper-ink px-7 text-[15px] font-semibold text-keeper-paper transition-colors hover:bg-black disabled:opacity-50'
    : 'inline-flex items-center gap-1.5 text-[13px] font-medium text-keeper-meta underline-offset-2 hover:text-keeper-ink hover:underline disabled:opacity-50';

  return (
    <div className={`text-center ${className}`}>
      <button type="button" onClick={share} disabled={busy} className={cls} data-testid="btn-free-share">
        <Share2 className={prominent ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
        {copied ? copiedLabel : label}
      </button>
      {url && (
        /* The link in the open, selectable — some browsers refuse the
           clipboard (in-app webviews, permissions), so the copy button
           is never the only way to get it. */
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          onClick={(e) => e.currentTarget.select()}
          aria-label="Your card’s link"
          className="mx-auto mt-3 block w-full max-w-sm rounded-xl border border-keeper-hair bg-keeper-paper px-3 py-2 text-center text-[12px] text-keeper-ink"
          data-testid="free-share-url"
        />
      )}
      {sub && <p className="mt-1 text-[11px] text-keeper-meta">{sub}</p>}
    </div>
  );
}
