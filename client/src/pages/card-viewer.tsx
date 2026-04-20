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
import { Check, Copy, Loader2, Sparkles } from 'lucide-react';
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
  // Welcome gate — acts as the arrival moment. Shown until the user
  // clicks "Open", at which point it slides away like a pair of doors
  // opening to reveal the viewer behind.
  const [gateOpen, setGateOpen] = useState(false);

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
        {/* Stage — 3D card + gesture hints. Stage is wider than the
            square card so the cover can swing open without clipping
            against the container edge (cover rotates left when open,
            extending the card's footprint past the closed bounds). */}
        <div className="relative">
          <div className="aspect-[5/4] max-w-3xl mx-auto">
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

        {/* Create-your-own panel — acquisition funnel per ROADMAP. A
            proper boxed card so it reads as a distinct moment (not an
            afterthought link at the page foot). Anonymous recipients
            land on /login?next= so sign-in funnels straight into the
            card maker. */}
        <div className="mt-10 sm:mt-16 max-w-md mx-auto">
          <div className="bg-white rounded-2xl border border-stone-200 p-6 sm:p-8 text-center">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-muted text-brand mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-semibold text-ink mb-1">
              Make one of your own
            </h2>
            <p className="text-sm text-stone-600 mb-5">
              A few minutes to craft a card worth sending.
            </p>
            <Link
              href={createHref}
              className="inline-flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-brand-foreground font-semibold px-6 py-3 rounded-lg w-full"
              data-testid="btn-viewer-create"
            >
              Start a card
            </Link>
          </div>
        </div>
      </div>

      <WelcomeGate
        show={!gateOpen}
        recipientName={recipientName ?? null}
        occasion={occasion ?? null}
        onOpen={() => setGateOpen(true)}
      />
    </Shell>
  );
}

// ── WelcomeGate ──────────────────────────────────────────────────────
// Arrival moment. Two panels that meet in the centre of the viewport
// and swing open like doors on the recipient's click. 3D rotateY on
// each half with perspective on the parent gives the "going through
// a door" metaphor Kevin asked for — rather than a straight slide.
//
// Structure: content sits above both doors and exits on its own short
// fade/lift while the doors keep their longer swing. Doors are solid
// bg-surface so the viewer behind is fully hidden until they start
// to rotate.
function WelcomeGate({
  show,
  recipientName,
  occasion,
  onOpen,
}: {
  show: boolean;
  recipientName: string | null;
  occasion: string | null;
  onOpen: () => void;
}) {
  return (
    <AnimatePresence>
      {show && (
        <div
          className="fixed inset-0 z-40"
          style={{ perspective: '1400px' }}
          data-testid="viewer-welcome-gate"
        >
          {/* Left door — hinged on the viewport's left edge. Swings
              back + away from the camera when it exits. */}
          <motion.div
            className="absolute inset-y-0 left-0 w-1/2 bg-surface border-r border-stone-200/60"
            style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d' }}
            initial={{ rotateY: 0 }}
            exit={{
              rotateY: -98,
              transition: { duration: 1.1, ease: [0.65, 0, 0.3, 1] },
            }}
          />
          {/* Right door — mirror image. */}
          <motion.div
            className="absolute inset-y-0 right-0 w-1/2 bg-surface border-l border-stone-200/60"
            style={{ transformOrigin: 'right center', transformStyle: 'preserve-3d' }}
            initial={{ rotateY: 0 }}
            exit={{
              rotateY: 98,
              transition: { duration: 1.1, ease: [0.65, 0, 0.3, 1] },
            }}
          />
          {/* Content — floats centred over both doors. Exits quickly
              so the doors aren't fighting the headline on the way out. */}
          <motion.div
            className="absolute inset-0 flex items-center justify-center px-6"
            initial={{ opacity: 0, y: 12 }}
            animate={{
              opacity: 1,
              y: 0,
              transition: { duration: 0.7, ease: 'easeOut', delay: 0.15 },
            }}
            exit={{
              opacity: 0,
              y: -10,
              transition: { duration: 0.35, ease: 'easeIn' },
            }}
          >
            <div className="text-center">
              <p className="text-xs uppercase tracking-[0.25em] text-stone-500 mb-3">
                You've been sent a card
              </p>
              <h1 className="text-4xl sm:text-5xl font-semibold text-ink mb-2">
                {recipientName ? `For ${recipientName}` : 'A card for you'}
              </h1>
              {occasion && (
                <p className="text-sm text-stone-600 capitalize mb-8">{occasion}</p>
              )}
              {!occasion && <div className="mb-8" />}
              <Button
                onClick={onOpen}
                size="lg"
                className="bg-cta hover:bg-cta/90 text-cta-foreground font-semibold px-10 py-3.5 rounded-lg"
                data-testid="btn-welcome-open"
              >
                Open
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
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
// Animated pointer-SVG hints under the card. Each hint pairs a small
// animated glyph with a short label. Fade in 900ms after mount so
// they read as a whisper; auto-hide once the card opens.
//
// The animations are framer-motion loops on pure SVG — no external
// lottie / assets. Keeps bundle cost to zero and the motion tunable.
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8, transition: { duration: 0.3 } }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-x-0 -bottom-4 flex justify-center"
        >
          <div className="flex items-center gap-6 sm:gap-10">
            <GestureHint label="Tap to open">
              <TapGlyph />
            </GestureHint>
            <GestureHint label="Drag to rotate">
              <DragGlyph />
            </GestureHint>
            <GestureHint label="Scroll to zoom" hideOnMobile>
              <ZoomGlyph />
            </GestureHint>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GestureHint({
  label,
  children,
  hideOnMobile,
}: {
  label: string;
  children: React.ReactNode;
  hideOnMobile?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center gap-1.5 ${hideOnMobile ? 'hidden sm:flex' : ''}`}
    >
      <div className="w-9 h-9 flex items-center justify-center text-stone-500">
        {children}
      </div>
      <span className="text-[10px] uppercase tracking-[0.15em] text-stone-500">{label}</span>
    </div>
  );
}

// ── Gesture glyphs (pure SVG + framer-motion loops) ──────────────────

function TapGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      {/* Concentric ripple — two rings pulsing outward */}
      {[0, 0.75].map((delay, i) => (
        <motion.circle
          key={i}
          cx="16"
          cy="16"
          r="6"
          stroke="currentColor"
          strokeWidth="1.4"
          initial={{ scale: 1, opacity: 0 }}
          animate={{ scale: [1, 2.2], opacity: [0.7, 0] }}
          transition={{ duration: 1.5, delay, repeat: Infinity, ease: 'easeOut' }}
          style={{ transformOrigin: '16px 16px' }}
        />
      ))}
      <circle cx="16" cy="16" r="3.5" fill="currentColor" />
    </svg>
  );
}

function DragGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      {/* Dot orbits around a centre — signals "drag to rotate" */}
      <circle
        cx="16"
        cy="16"
        r="9"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2 3"
        opacity="0.4"
      />
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '16px 16px' }}
      >
        <circle cx="25" cy="16" r="2.5" fill="currentColor" />
      </motion.g>
    </svg>
  );
}

function ZoomGlyph() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      {/* Magnifier with an inner plus that pulses — pulse reads as zoom-in */}
      <circle cx="14" cy="14" r="7" stroke="currentColor" strokeWidth="1.6" />
      <line x1="19.5" y1="19.5" x2="24" y2="24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <motion.g
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <line x1="11" y1="14" x2="17" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </motion.g>
    </svg>
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
