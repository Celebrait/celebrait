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

import { useRef, useState } from 'react';
import { Link, useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Loader2, Mail, MessageSquare, Share2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { GestureHints } from '@/components/gesture-hints';
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
  /** Optional welcome message — only present on the public view
   *  endpoint, pulled from the sender's most recent paid digital
   *  order for this card. */
  welcomeMessage?: string | null;
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

              CSS drop-shadow on this container adds a soft depth
              shadow beneath the card's silhouette — reads as the
              card floating above the white page. The 3D scene's own
              ContactShadows still handle the grounded-on-a-surface
              feel during rotation. */}
          <div
            className="absolute top-[-25vh] bottom-[-25vh] left-[-22vw] right-[-22vw] z-0"
            style={{ filter: 'drop-shadow(0 24px 32px rgba(0,0,0,0.1))' }}
            onPointerDown={startInteract}
            onPointerUp={endInteract}
            onPointerCancel={endInteract}
            onPointerLeave={endInteract}
            onWheel={bumpInteract}
          >
            <Card3DViewer
              frontImageUrl={data.frontImageUrl}
              insideImageUrl={data.insideImageUrl}
              open={open}
              onOpenChange={setOpen}
              className="w-full h-full"
            />
          </div>
        </div>

        {/* UI — flows below the stage. The card canvas extends past
            the stage into this zone at z-0; UI sits at z-10.
            Buttons + hints + make-your-own panel fade out while the
            user is actively interacting with the card (drag/zoom),
            so anything the card rotates over doesn't clip against
            the UI. Fade back in 1.2s after the last interaction. */}
        <div
          className="relative z-10 max-w-xl mx-auto px-4 pt-2 pb-16 transition-opacity duration-500"
          style={{
            opacity: isInteracting ? 0 : 1,
            pointerEvents: isInteracting ? 'none' : 'auto',
          }}
        >
          {/* Gesture hints — sit close to the card with generous gap
              between them and the action row below. min-h reserves
              the row so their one-shot exit doesn't reflow buttons. */}
          <div className="min-h-[64px] flex justify-center items-start">
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

      <WelcomeGate
        show={!gateOpen}
        recipientName={recipientName ?? null}
        occasion={occasion ?? null}
        welcomeMessage={data.welcomeMessage ?? null}
        onOpen={() => setGateOpen(true)}
      />
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
// Arrival moment. Two panels that meet at the centre and swing open
// like doors on the recipient's click. 3D rotateY on each half with
// perspective on the parent.
//
// If `welcomeMessage` is present (sender wrote a custom note when
// they bought the digital add-on), it replaces the default
// "You've been sent a card" eyebrow with a personal line.
function WelcomeGate({
  show,
  recipientName,
  occasion,
  welcomeMessage,
  onOpen,
}: {
  show: boolean;
  recipientName: string | null;
  occasion: string | null;
  welcomeMessage: string | null;
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
          {/* Left door — hinged on the viewport's left edge. */}
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
          {/* Content — floats centred over both doors. Exits fast so
              it doesn't fight the door animation. */}
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
            <div className="text-center max-w-md">
              {welcomeMessage ? (
                <p className="text-base sm:text-lg text-stone-700 leading-relaxed mb-5 whitespace-pre-line">
                  {welcomeMessage}
                </p>
              ) : (
                <p className="text-xs uppercase tracking-[0.25em] text-stone-500 mb-3">
                  You've been sent a card
                </p>
              )}
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
