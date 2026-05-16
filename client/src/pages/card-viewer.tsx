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

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Loader2, Mail, MessageSquare, Share2, Sparkles } from 'lucide-react';
import Lottie from 'lottie-react';
import { Button } from '@/components/ui/button';
import envelopeAnimation from '../assets/envelope-open.lottie.json';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GestureHints } from '@/components/gesture-hints';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import logoSrc from '../assets/Logo2.png';
import type { CardDraftState } from '@shared/schema';

// Card3DViewer lazy-loaded to keep the recipient viewer's first paint
// fast (Comms PR2 follow-up, 2026-04-30 — Kevin caught the slow load
// during PR1 testing).
//
// Why: the eager import pulled three.js + @react-three/fiber +
// @react-three/drei + lottie-react upfront — ~150-200KB of JS before
// the user could see anything. On a fresh mobile device tapping a
// link from email, that's a multi-second delay against the recipient's
// FIRST IMPRESSION of Celebrait via a card from someone they know.
//
// With React.lazy(), Vite splits Three.js into its own chunk that
// loads in the background while the user reads the welcome gate. By
// the time they click "Open envelope", the chunk is loaded; if not,
// Suspense renders the static <CardFrontPoster /> fallback so they
// always see *something* (the actual card front, just flat instead of
// 3D-interactive).
//
// The named-export-wrapper (.then(m => ({ default: m.Card3DViewer })))
// is required because React.lazy expects a default export and
// Card3DViewer is a named export.
const Card3DViewer = lazy(() =>
  import('@/components/card-3d-viewer').then((m) => ({
    default: m.Card3DViewer,
  })),
);

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
  const [shareOpen, setShareOpen] = useState(false);
  // Once the user has interacted with the card at all, we stop
  // showing the gesture hints — they've found the controls. Persists
  // for the session only (no localStorage); fresh visit = hints back.
  const [hasInteracted, setHasInteracted] = useState(false);
  // Welcome gate — acts as the arrival moment. Shown until the user
  // clicks "Open", at which point it slides away like a pair of doors
  // opening to reveal the viewer behind.
  const [gateOpen, setGateOpen] = useState(false);

  // Fade the UI (buttons + make-your-own + hints) while the user
  // is actively interacting with the card. Triggered on pointer
  // down / wheel; 1.2s after the last interaction the UI fades back
  // in. Lets the card rotate/zoom over the button area without
  // clipping against the UI. Header is intentionally NOT faded —
  // card passes behind it (translucent bg gives depth cue).
  const [isInteracting, setIsInteracting] = useState(false);
  const interactTimerRef = useRef<number | null>(null);
  const startInteract = () => {
    if (interactTimerRef.current) window.clearTimeout(interactTimerRef.current);
    setIsInteracting(true);
    setHasInteracted(true);
  };
  const endInteract = () => {
    if (interactTimerRef.current) window.clearTimeout(interactTimerRef.current);
    interactTimerRef.current = window.setTimeout(() => setIsInteracting(false), 1200);
  };
  const bumpInteract = () => {
    startInteract();
    endInteract();
  };

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

  // Share text + URL used across the share sheet channels. Keep
  // message short so it doesn't eat SMS character limits.
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = recipientName
    ? `A card for ${recipientName} ✨`
    : 'A card for you ✨';

  const handleShareCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: 'Link copied' });
      setShareOpen(false);
    } catch {
      toast({ title: "Couldn't copy link", variant: 'destructive' });
    }
  };

  const handleShareNative = async () => {
    if (typeof navigator === 'undefined' || !('share' in navigator)) {
      toast({ title: 'Native share not available here' });
      return;
    }
    try {
      await (navigator as any).share({
        title: recipientName ? `A card for ${recipientName}` : 'A card made with Celebrait',
        text: shareText,
        url: shareUrl,
      });
      setShareOpen(false);
    } catch {
      // user cancelled — keep the sheet open
    }
  };

  const shareViaUrl = (href: string) => {
    window.open(href, '_blank', 'noopener,noreferrer');
    setShareOpen(false);
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  const smsHref = `sms:?&body=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(
    shareText,
  )}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`;

  const createHref = isAuthenticated ? '/studio/new-card' : '/login?next=/studio/new-card';

  return (
    <Shell>
      {/* Document flows below the fixed header: stage first, then
          UI. Stage has a fixed height so the card renders at a
          consistent size regardless of viewport. UI sits in normal
          flow below with generous vertical spacing — the page
          scrolls if the viewport is short, which is fine. */}
      <div className="pt-16">
        {/* Stage — reserves vertical space in the document flow. The
            actual 3D canvas inside extends past the stage on ALL
            sides (top/bottom/left/right) so the card can freely
            rotate, open, and tilt without clipping. Gesture hints
            sit as an absolute overlay inside the stage so their
            exit animation doesn't reflow the layout below (fixes
            the snap-up glitch Kevin flagged). */}
        <div className="h-[56vh] sm:h-[62vh] w-full relative">
          {/* Canvas bleed: ±25vh vertical + ±22vw horizontal. Large
              enough that the card never hits the canvas edge when
              rotating/tilting/zooming, even at max zoom. Paired with
              margin 2.0 in InitialCameraFit + minDistance 2.7.

              Canvas sits at z-25 — ABOVE the header (z-20). When the
              card rotates up it renders on top of the header for
              real depth (not just peeking through the translucent
              bg). UI is bumped to z-30 so buttons + make-your-own
              still receive pointer events at rest.

              CSS drop-shadow adds a soft depth shadow beneath the
              card's silhouette. The 3D scene's own ContactShadows
              still handle grounded-on-surface during rotation. */}
          <div
            className="absolute top-[-25vh] bottom-[-25vh] left-[-22vw] right-[-22vw] z-[25]"
            style={{ filter: 'drop-shadow(0 24px 32px rgba(0,0,0,0.1))' }}
            onPointerDown={startInteract}
            onPointerUp={endInteract}
            onPointerCancel={endInteract}
            onPointerLeave={endInteract}
            onWheel={bumpInteract}
          >
            {/* Suspense fallback = static poster while the lazy
                Three.js chunk loads. Recipients always see their card
                immediately — even on slow connections — and the chunk
                upgrades to interactive 3D in the background. */}
            <Suspense
              fallback={
                <CardFrontPoster
                  frontImageUrl={data.frontImageUrl}
                  recipientName={recipientName}
                />
              }
            >
              <Card3DViewer
                frontImageUrl={data.frontImageUrl}
                insideImageUrl={data.insideImageUrl}
                open={open}
                onOpenChange={setOpen}
                className="w-full h-full"
                // Card3DViewer auto-derives its hit zone from framingMargin,
                // but our outer wrapper bleeds 25vh + 22vw past the visible
                // card so the card can rotate/zoom without clipping. The
                // auto-inset is calculated against this BLEED wrapper —
                // resulting in a hit zone too narrow to cover the visible
                // card on the outer edges. Force the hit zone to fill
                // the bleed wrapper entirely (0% inset) so any tap on the
                // visible card lands. The bleed wrapper itself is mostly
                // off-screen anyway; the on-screen overlap is roughly
                // the stage area + a small buffer (Kevin caught the bug
                // 2026-04-28 — clicks only worked on the card's right edge).
                hitZoneInsetPercent={0}
              />
            </Suspense>
          </div>
        </div>

        {/* UI — flows below the stage. The card canvas extends past
            the stage into this zone at z-0; UI sits at z-10.
            Buttons + hints + make-your-own panel fade out while the
            user is actively interacting with the card (drag/zoom),
            so anything the card rotates over doesn't clip against
            the UI. Fade back in 1.2s after the last interaction. */}
        <div
          className="relative z-30 max-w-xl mx-auto px-4 pt-2 pb-16 transition-opacity duration-500"
          style={{
            opacity: isInteracting ? 0 : 1,
            pointerEvents: isInteracting ? 'none' : 'auto',
          }}
        >
          {/* Gesture hints — sit close to the card with generous gap
              between them and the action row below. Container
              collapses (max-height → 0) once hasInteracted fires,
              smoothly pulling the action row upward as the hints
              fade out so no dead whitespace is left behind. */}
          <div
            className="flex justify-center items-start overflow-hidden transition-[height] duration-500 ease-out"
            style={{ height: hasInteracted ? 0 : 72 }}
          >
            <GestureHints open={open || hasInteracted} />
          </div>

          {/* Action row */}
          <div className="mt-10 flex flex-col sm:flex-row justify-center items-center gap-3">
            <Button
              onClick={() => setOpen(!open)}
              className="bg-brand hover:bg-brand-dark text-brand-foreground font-semibold px-7 py-3 rounded-lg w-full sm:w-auto"
              size="lg"
              data-testid="btn-viewer-open"
            >
              {open ? 'Close card' : 'Open card'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShareOpen(true)}
              className="w-full sm:w-auto bg-white"
              size="lg"
              data-testid="btn-viewer-share"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>

          {/* Acquisition panel — boxed so it reads as a distinct
              moment. */}
          <Link
            href={createHref}
            className="mt-8 block bg-white rounded-xl border border-stone-200 p-4 hover:border-brand/60 hover:shadow-sm transition-all group"
            data-testid="btn-viewer-create"
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-brand-muted text-brand flex-shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink">Make one of your own</p>
                <p className="text-xs text-stone-600 mt-0.5">
                  A few minutes to craft a card worth sending.
                </p>
              </div>
              <span className="text-brand group-hover:text-brand-dark text-sm font-medium whitespace-nowrap">
                Start →
              </span>
            </div>
          </Link>
        </div>
      </div>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        shareUrl={shareUrl}
        whatsappHref={whatsappHref}
        smsHref={smsHref}
        emailHref={emailHref}
        onNativeShare={handleShareNative}
        onCopy={handleShareCopy}
        onShareVia={shareViaUrl}
      />

      <WelcomeGate show={!gateOpen} onOpen={() => setGateOpen(true)} />
    </Shell>
  );
}

// ── ShareDialog ──────────────────────────────────────────────────────
// Proper share sheet with a row of platform options — more useful
// than the old "Share = copy link" button. WhatsApp first (biggest
// person-to-person share surface), then Messages (sms:), then Email
// (mailto:), then Copy link. On devices that support navigator.share
// a "More" option exposes the OS share sheet as a secondary path.
function ShareDialog({
  open,
  onOpenChange,
  shareUrl,
  whatsappHref,
  smsHref,
  emailHref,
  onNativeShare,
  onCopy,
  onShareVia,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  shareUrl: string;
  whatsappHref: string;
  smsHref: string;
  emailHref: string;
  onNativeShare: () => void;
  onCopy: () => void;
  onShareVia: (href: string) => void;
}) {
  const hasNativeShare =
    typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-left">Share this card</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-4 gap-2 pt-2">
          <ShareTile
            label="WhatsApp"
            color="bg-[#25D366]"
            onClick={() => onShareVia(whatsappHref)}
            icon={<WhatsAppIcon />}
          />
          <ShareTile
            label="Messages"
            color="bg-brand"
            onClick={() => onShareVia(smsHref)}
            icon={<MessageSquare className="w-5 h-5 text-white" />}
          />
          <ShareTile
            label="Email"
            color="bg-stone-700"
            onClick={() => onShareVia(emailHref)}
            icon={<Mail className="w-5 h-5 text-white" />}
          />
          <ShareTile
            label="Copy link"
            color="bg-stone-100"
            onClick={onCopy}
            icon={<Copy className="w-5 h-5 text-stone-700" />}
            textColor="text-stone-700"
          />
        </div>

        {hasNativeShare && (
          <button
            onClick={onNativeShare}
            className="mt-4 w-full text-center text-sm text-stone-600 hover:text-brand-dark transition-colors"
          >
            More sharing options…
          </button>
        )}

        <div className="mt-4 text-xs text-stone-500 text-center truncate px-2">
          {shareUrl}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShareTile({
  label,
  color,
  onClick,
  icon,
  textColor,
}: {
  label: string;
  color: string;
  onClick: () => void;
  icon: React.ReactNode;
  textColor?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 text-xs text-stone-600 hover:text-ink transition-colors"
    >
      <div
        className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shadow-sm`}
      >
        {icon}
      </div>
      <span className={textColor ?? 'text-stone-600'}>{label}</span>
    </button>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.304-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── WelcomeGate ──────────────────────────────────────────────────────
// Stripped-back arrival moment. Celebrait logo at the top of the
// screen, Lottie envelope centred, "Tap to open" caption beneath.
// No "For {Name}" / occasion / custom message — the recipient will
// see all of that on the card itself once it opens.
function WelcomeGate({ show, onOpen }: { show: boolean; onOpen: () => void }) {
  const [opening, setOpening] = useState(false);

  const handleClick = () => {
    setOpening(true);
    // Flap lifts ~750ms, then we hold on pure-white for ~300ms
    // before dismissing the gate. That hold reads as a camera-flash
    // beat between envelope-open and card-reveal.
    window.setTimeout(() => onOpen(), 1050);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-40 bg-white flex flex-col items-center px-6"
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            transition: { duration: 0.45, ease: [0.55, 0, 0.1, 1] },
          }}
          data-testid="viewer-welcome-gate"
        >
          {/* Logo at top */}
          <motion.div
            className="pt-6 sm:pt-8"
            initial={{ opacity: 0, y: -8 }}
            animate={{
              opacity: opening ? 0 : 1,
              y: 0,
              transition: opening
                ? { opacity: { duration: 0.25, delay: 0.6, ease: 'easeIn' } }
                : { duration: 0.6, ease: 'easeOut' },
            }}
          >
            <img src={logoSrc} alt="Celebrait" className="h-8 object-contain" />
          </motion.div>

          {/* Envelope + caption, vertically centred in the remaining
              space. Content fades in place once `opening` flips so
              there's a clean white-flash beat before the gate exit. */}
          <motion.div
            className="flex-1 flex flex-col items-center justify-center gap-6"
            initial={{ opacity: 0 }}
            animate={{
              opacity: opening ? 0 : 1,
              transition: opening
                ? { duration: 0.25, delay: 0.75, ease: 'easeIn' }
                : { duration: 0.7, ease: 'easeOut', delay: 0.15 },
            }}
          >
            <motion.button
              onClick={handleClick}
              whileHover={opening ? undefined : { scale: 1.03 }}
              whileTap={opening ? undefined : { scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              disabled={opening}
              className="group relative focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded-xl"
              data-testid="btn-welcome-open"
              aria-label="Open card"
            >
              <motion.div
                animate={opening ? { y: 0 } : { y: [-6, 6, -6] }}
                transition={
                  opening
                    ? { duration: 0.25, ease: 'easeOut' }
                    : { duration: 3.2, repeat: Infinity, ease: 'easeInOut' }
                }
              >
                <SquareEnvelope opening={opening} />
              </motion.div>
            </motion.button>

            <p className="text-xs uppercase tracking-[0.25em] text-stone-500">
              Tap to open
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── SquareEnvelope ───────────────────────────────────────────────────
// Lottie-driven envelope. The source animation runs 0-105 with the
// envelope fading in over frames 0-34, flap opening 35-58, letter
// revealing 51-77. We park at frame 34 (envelope fully visible +
// closed) as the idle state. On `opening` flip, play forward to
// the end.
const ENVELOPE_IDLE_FRAME = 34;
const ENVELOPE_END_FRAME = 105;

function SquareEnvelope({ opening }: { opening: boolean }) {
  const lottieRef = useRef<any>(null);

  // Seek to the "closed-but-visible" frame on mount. lottie-react's
  // DOMLoaded callback fires once the animation is ready to control.
  const handleDomLoaded = () => {
    if (lottieRef.current) {
      lottieRef.current.goToAndStop(ENVELOPE_IDLE_FRAME, true);
    }
  };

  useEffect(() => {
    if (opening && lottieRef.current) {
      lottieRef.current.playSegments(
        [ENVELOPE_IDLE_FRAME, ENVELOPE_END_FRAME],
        true,
      );
    }
  }, [opening]);

  return (
    <div
      className="w-56 h-56 sm:w-64 sm:h-64"
      style={{ filter: 'drop-shadow(0 18px 30px rgba(0,0,0,0.18))' }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={envelopeAnimation}
        autoplay={false}
        loop={false}
        onDOMLoaded={handleDomLoaded}
        className="w-full h-full"
      />
    </div>
  );
}

// ── Shell ────────────────────────────────────────────────────────────
// Slim top bar — same visual language as CheckoutLayout so the viewer
// feels part of the same product. Shows a Sign in link for anonymous
// viewers and a "My studio" link for logged-in ones.
function Shell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  return (
    <div className="min-h-screen bg-white">
      {/* Header at z-20. The 3D canvas sits at z-0 and extends past
          the stage bounds, so the card visually passes behind the
          header (and the UI below, at z-10) when zoomed/rotated.
          Adds depth — no fade. */}
      <header className="fixed top-0 inset-x-0 h-16 bg-white/90 backdrop-blur-sm border-b border-stone-200/80 flex items-center px-4 sm:px-6 gap-3 z-20">
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
      {children}
    </div>
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

// CardFrontPoster — static fallback shown by Suspense while the
// lazy-loaded Card3DViewer chunk is downloading. Recipients always
// see their card front immediately, even on a slow first paint;
// the chunk upgrades to interactive 3D in the background.
//
// Visual budget is intentionally low: we want it to look like the
// 3D card paused (centred, soft drop-shadow, gentle border) rather
// than a separate "loading" screen. Once the chunk lands, Suspense
// swaps it out — ideally before the user has clicked "Open envelope".
//
// The fallback only renders inside the bleed wrapper, so it inherits
// the same z-index + drop-shadow filter from the parent. We just need
// to centre the image and clamp it to a sensible card-aspect.
function CardFrontPoster({
  frontImageUrl,
  recipientName,
}: {
  frontImageUrl: string | null;
  recipientName: string | undefined;
}) {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      aria-label={
        recipientName ? `Card for ${recipientName}` : 'Card preview'
      }
    >
      {frontImageUrl ? (
        <img
          src={frontImageUrl}
          alt=""
          className="max-w-[min(75vw,55vh)] max-h-[55vh] aspect-square object-cover rounded-lg shadow-[0_12px_32px_-8px_rgba(15,23,42,0.25)]"
          // Hint to the browser: front asset is the highest-priority
          // resource on this page. Modern browsers respect fetchpriority
          // for image preload; older ones ignore the attribute.
          // @ts-expect-error — `fetchpriority` not yet in React's typing
          fetchpriority="high"
          decoding="async"
        />
      ) : (
        <div className="w-[min(60vw,40vh)] aspect-square rounded-lg bg-stone-100 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-stone-400" />
        </div>
      )}
    </div>
  );
}
