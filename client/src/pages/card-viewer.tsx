// client/src/pages/card-viewer.tsx
//
// Digital card viewer — the recipient's page. Full-bleed stage for the
// reusable Card3DViewer with a slim top bar, a "For {Name}" headline,
// controlled open/close via an external CTA, gesture hints that fade
// in on load, and action CTAs (Open, Share, Make your own) that funnel
// anonymous viewers into the product.
//
// Two data paths, one page:
//   - `?t=TOKEN` in the query string → recipient view via the public
//     endpoint. Works without auth.
//   - No token → sender previewing their own card via the auth-gated
//     draft endpoint.

import { useEffect, useState } from 'react';
import { Link, useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Copy,
  Loader2,
  MousePointer2,
  RotateCcw,
  Sparkles,
  ZoomIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import logoSrc from '../assets/Logo2.png';
import type { CardDraftState } from '@shared/schema';

interface CardData {
  id: number;
  status: string | null;
  frontImageUrl: string | null;
  insideImageUrl: string | null;
  state?: CardDraftState;
  recipientName?: string | null;
  occasion?: string | null;
}

export default function CardViewerPage() {
  const [, params] = useRoute<{ id: string }>('/card/:id/view');
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isAuthenticated } = useAuth();
  const cardId = params ? parseInt(params.id, 10) : NaN;

  const token = new URLSearchParams(window.location.search).get('t');
  const endpoint = token
    ? `/api/card/${cardId}/view?t=${encodeURIComponent(token)}`
    : `/api/studio/drafts/${cardId}`;

  const { data, isLoading, error } = useQuery<CardData>({
    queryKey: [endpoint],
    enabled: Number.isFinite(cardId),
  });

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!Number.isFinite(cardId)) {
    return <Shell><Centered>Invalid card id.</Centered></Shell>;
  }
  if (isLoading) {
    return (
      <Shell>
        <Centered><Loader2 className="w-6 h-6 animate-spin text-brand" /></Centered>
      </Shell>
    );
  }
  if (error || !data) {
    return (
      <Shell>
        <Centered>
          <p className="text-sm text-stone-600 mb-4">Couldn't load this card.</p>
          <Button onClick={() => setLocation('/studio')}>Back to Studio</Button>
        </Centered>
      </Shell>
    );
  }
  if (!data.frontImageUrl) {
    return (
      <Shell>
        <Centered>
          <p className="text-sm text-stone-600 mb-2">This card hasn't been generated yet.</p>
          <p className="text-xs text-stone-500 mb-4">Status: {data.status ?? 'draft'}.</p>
          <Button onClick={() => setLocation(`/studio/card/${cardId}/edit`)}>
            Back to editor
          </Button>
        </Centered>
      </Shell>
    );
  }

  const recipientName =
    data.recipientName?.trim() || data.state?.recipient?.name?.trim() || undefined;
  const occasion = data.occasion?.trim() || data.state?.recipient?.occasion?.trim();

  const handleShare = async () => {
    const url = window.location.href;
    // Native share sheet on mobile if available.
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await (navigator as any).share({
          title: recipientName ? `A card for ${recipientName}` : 'A card made with Celebrait',
          url,
        });
        return;
      } catch {
        // User cancelled — fall through to clipboard copy so they still
        // have the link handy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast({ title: 'Link copied' });
    } catch {
      toast({ title: "Couldn't copy link", variant: 'destructive' });
    }
  };

  const createHref = isAuthenticated ? '/studio/new-card' : '/login?next=/studio/new-card';

  return (
    <Shell>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {/* Headline */}
        <div className="text-center mb-6 sm:mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-2">
            You've been sent a card
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-ink">
            {recipientName ? `For ${recipientName}` : 'A card for you'}
          </h1>
          {occasion && (
            <p className="text-sm text-stone-600 mt-2 capitalize">{occasion}</p>
          )}
        </div>

        {/* Stage — 3D card + gesture hints */}
        <div className="relative">
          <div className="aspect-square max-w-xl mx-auto">
            <Card3DViewer
              frontImageUrl={data.frontImageUrl}
              insideImageUrl={data.insideImageUrl}
              open={open}
              onOpenChange={setOpen}
              className="w-full h-full"
            />
          </div>
          <GestureHints open={open} />
        </div>

        {/* Actions */}
        <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-center items-center gap-3 sm:gap-4">
          <Button
            onClick={() => setOpen(!open)}
            className="bg-cta hover:bg-cta/90 text-cta-foreground font-semibold px-7 py-3 rounded-lg w-full sm:w-auto"
            size="lg"
            data-testid="btn-viewer-open"
          >
            {open ? 'Close card' : 'Open card'}
          </Button>
          <Button
            variant="outline"
            onClick={handleShare}
            className="w-full sm:w-auto"
            size="lg"
            data-testid="btn-viewer-share"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2" /> Copied
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" /> Share
              </>
            )}
          </Button>
        </div>

        {/* Create-your-own nudge — the acquisition funnel per ROADMAP.
            Anonymous recipients land on /login?next= so the next step
            after sign-in is building their own card. */}
        <div className="mt-10 sm:mt-16 text-center">
          <p className="text-sm text-stone-600 mb-3">
            Like what you see? Make one for someone you care about.
          </p>
          <Link
            href={createHref}
            className="inline-flex items-center gap-2 text-brand hover:text-brand-dark font-medium text-sm"
            data-testid="btn-viewer-create"
          >
            <Sparkles className="w-4 h-4" />
            Make your own card
          </Link>
        </div>
      </div>
    </Shell>
  );
}

// ── Shell ────────────────────────────────────────────────────────────
// Slim top bar — same visual language as CheckoutLayout so the viewer
// feels part of the same product. Shows a Sign in link for anonymous
// viewers and a "My studio" link for logged-in ones.
function Shell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="h-16 bg-white border-b border-stone-200 flex items-center px-4 sm:px-6 gap-3 flex-shrink-0">
        <Link href="/" className="flex items-center">
          <img src={logoSrc} alt="Celebrait" className="h-8 object-contain" />
        </Link>
        <div className="flex-1" />
        {isAuthenticated ? (
          <Link
            href="/studio"
            className="text-sm font-medium text-stone-700 hover:text-brand-dark"
          >
            My studio
          </Link>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium text-stone-700 hover:text-brand-dark"
          >
            Sign in
          </Link>
        )}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}

// ── GestureHints ─────────────────────────────────────────────────────
// Small animated hint row under the card. Fades in a few seconds after
// mount so it reads as a whisper, not an instruction. Auto-hides once
// the user opens the card (presumed engaged).
function GestureHints({ open }: { open: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <AnimatePresence>
      {visible && !open && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6, transition: { duration: 0.3 } }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-x-0 -bottom-2 flex justify-center"
        >
          <div className="flex items-center gap-4 text-[11px] uppercase tracking-[0.15em] text-stone-500">
            <Hint icon={<MousePointer2 className="w-3.5 h-3.5" />} label="Tap to open" />
            <span className="w-px h-3 bg-stone-300" />
            <Hint icon={<RotateCcw className="w-3.5 h-3.5" />} label="Drag to rotate" />
            <span className="hidden sm:inline w-px h-3 bg-stone-300" />
            <Hint
              icon={<ZoomIn className="w-3.5 h-3.5" />}
              label="Scroll to zoom"
              hideOnMobile
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Hint({
  icon,
  label,
  hideOnMobile,
}: {
  icon: React.ReactNode;
  label: string;
  hideOnMobile?: boolean;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${hideOnMobile ? 'hidden sm:inline-flex' : ''}`}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24">
      {children}
    </div>
  );
}
