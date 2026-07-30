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
import logoSrc from '../assets/logo-mark.webp';
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
  // Welcome gate — acts as the arrival moment. Shown until the user
  // clicks "Open", at which point it slides away like a pair of doors
  // opening to reveal the viewer behind.
  const [gateOpen, setGateOpen] = useState(false);
  // (The fade-UI-while-interacting + hide-hints-after-first-touch
  // machinery from the drag-rotate era was removed 2026-07-08 —
  // tap-to-open is the only gesture now, and hiding CTAs on scroll
  // read as a bug.)

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
    // Token present = an anonymous RECIPIENT with a broken/expired link —
    // "Back to Studio" just walked them into a login wall (audit
    // 2026-07-27). Give them the honest fix + a warm way in instead.
    if (token) {
      return (
        <Shell>
          <Centered>
            <p className="text-sm font-medium text-keeper-ink mb-1">
              This card link isn't working
            </p>
            <p className="text-sm text-keeper-body mb-4 max-w-xs text-center">
              It may not have copied across in full — ask whoever sent it to
              share the link again.
            </p>
            <Button onClick={() => setLocation('/')}>Make your own card</Button>
          </Centered>
        </Shell>
      );
    }
    return (
      <Shell>
        <Centered>
          <p className="text-sm text-keeper-body mb-4">Couldn't load this card.</p>
          <Button onClick={() => setLocation('/studio')}>Back to Studio</Button>
        </Centered>
      </Shell>
    );
  }
  if (!data.frontImageUrl) {
    return (
      <Shell>
        <Centered>
          <p className="text-sm text-keeper-body mb-2">This card hasn't been generated yet.</p>
          <p className="text-xs text-keeper-meta mb-4">Status: {data.status ?? 'draft'}.</p>
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
        <div className="mx-auto h-[55vh] sm:h-[62vh] w-full max-w-3xl relative">
          {/* Canvas bleed: ±25vh vertical + ±22vw horizontal. Large
              enough that the card never hits the canvas edge when
              rotating/tilting/zooming, even at max zoom. Paired with
              margin 2.0 in InitialCameraFit + minDistance 2.7.

              Canvas sits BELOW the header (z-10 vs z-20) — it used
              to render above it for rotate-era depth, which now just
              meant the card overlapped the menu when scrolling
              (Kevin 2026-07-08).

              CSS drop-shadow adds a soft depth shadow beneath the
              card's silhouette. The 3D scene's own ContactShadows
              still handle grounded-on-surface during rotation. */}
          {/* Bleed matches studio-card-view exactly (2026-07-08:
              "card size should be the same as the studio") — same
              stage height, same max-w-3xl, same insets = identical
              rendered card size. */}
          <div
            className="absolute top-[-18vh] bottom-[-18vh] left-[-20vw] right-[-20vw] z-[10]"
            style={{ filter: 'drop-shadow(0 24px 32px rgba(0,0,0,0.1))' }}
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
                // Orbit gadget removed SITE-WIDE (Kevin 2026-07-07:
                // "fancy gadget that does not really do much other
                // than cause us issues"). Cards rest ajar (~22°, the
                // studio-reveal pose) and tap to open/close — that's
                // the whole interaction model now.
                enableRotate={false}
                enableZoom={false}
                closedAngle={-0.38}
                restYaw={-0.12}
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

        {/* UI — flows below the stage. Always visible: the old
            fade-while-interacting belonged to the drag-rotate era
            (orbit removed site-wide 2026-07-07). */}
        <div className="relative z-30 max-w-xl mx-auto px-4 pt-2 pb-16">
          {/* Gesture hints — sit close to the card with generous gap
              between them and the action row below. Container
              collapses (max-height → 0) once hasInteracted fires,
              smoothly pulling the action row upward as the hints
              fade out so no dead whitespace is left behind. */}
          <div className="flex h-[72px] items-start justify-center">
            <GestureHints
              open={open}
              hideRotateHint
              hideZoomHint
              openLabel="Tap to close"
            />
          </div>

          {/* Acquisition moment (Kevin 2026-07-08): a STRONG make-your-
              own CTA — plus the honest path for the 95% who aren't
              ready right now: email yourself the link for later.
              Recipients arrive emotional but busy; capture the intent,
              don't demand the act. */}
          <MakeYourOwnPanel createHref={createHref} cardId={cardId} onShare={() => setShareOpen(true)} />
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

// ── MakeYourOwnPanel ─────────────────────────────────────────────────
// The acquisition moment, two-speed (Kevin 2026-07-08): a strong
// primary for the ready-now visitor, and an email-capture for the
// realistic majority who love the card but aren't making one on the
// spot. The capture stores a lead + fires ONE immediate "here's your
// link" email — intent preserved past the moment.
function MakeYourOwnPanel({
  createHref,
  cardId,
  onShare,
}: {
  createHref: string;
  cardId: number;
  onShare: () => void;
}) {
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    if (busy || sent) return;
    setBusy(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'card-viewer',
          cardId,
          marketingOptIn: optIn,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? 'Please try again.');
      }
      setSent(true);
    } catch (err: any) {
      toast({
        title: "Couldn't save that",
        description: err?.message ?? 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 text-center shadow-sm"
      data-testid="make-your-own-panel"
    >
      {/* 1 — the hook */}
      <p className="text-xl sm:text-2xl font-semibold text-keeper-ink">
        Someone made this just for you.
      </p>
      <p className="mx-auto mt-2 max-w-[40ch] text-sm leading-relaxed text-keeper-body">
        Now put someone you love in the picture — upload a photo, describe
        the scene, and we make the card. Free to make.
      </p>

      {/* 2 — the act-now path */}
      <Link
        href={createHref}
        className="mt-5 inline-flex h-[52px] w-full items-center justify-center rounded-lg bg-brand px-8 text-[15px] font-semibold text-brand-foreground transition-colors hover:bg-brand-dark sm:w-auto sm:min-w-[300px]"
        data-testid="btn-viewer-create"
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Make one of your own — free
      </Link>

      {/* 3 — recipient utility, quiet */}
      <div className="mt-3">
        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-keeper-meta underline underline-offset-4 transition-colors hover:text-brand-dark"
          data-testid="btn-viewer-share"
        >
          <Share2 className="h-3.5 w-3.5" />
          Share this card
        </button>
      </div>

      {/* 4 — the not-right-now path */}
      <div className="mt-6 border-t border-stone-100 pt-5">
        {sent ? (
          <p className="text-sm font-medium text-cta-hover" data-testid="lead-captured">
            Done — the link's in your inbox for whenever you're ready. ✨
          </p>
        ) : (
          <>
            <p className="text-sm font-medium text-keeper-ink">Not the moment?</p>
            <p className="mt-0.5 text-xs text-keeper-meta">
              We'll email you the link for later.
            </p>
            <form
              className="mx-auto mt-3 flex max-w-sm items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="h-11 min-w-0 flex-1 rounded-lg border border-stone-200 bg-white px-3 text-sm text-keeper-ink placeholder:text-keeper-meta focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                data-testid="input-lead-email"
              />
              <Button
                type="submit"
                disabled={busy}
                className="h-11 shrink-0 bg-brand hover:bg-brand-dark text-brand-foreground"
                data-testid="btn-lead-submit"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send it'}
              </Button>
            </form>
            {/* Explicit opt-in for anything beyond the one link email
                (GDPR-clean: unticked default, plain language). */}
            <label className="mx-auto mt-3 flex max-w-sm cursor-pointer items-start gap-2 text-left">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-stone-300 accent-[#5c57d4]"
                data-testid="check-lead-optin"
              />
              <span className="text-[11.5px] leading-snug text-keeper-meta">
                Keep me posted now and then — new features and ideas.
                Unsubscribe anytime.
              </span>
            </label>
            <p className="mx-auto mt-2 max-w-sm text-[10.5px] text-keeper-meta">
              We'll send your link straight away. No spam, ever.
            </p>
          </>
        )}
      </div>
    </div>
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
            icon={<Copy className="w-5 h-5 text-keeper-body" />}
            textColor="text-keeper-body"
          />
        </div>

        {hasNativeShare && (
          <button
            onClick={onNativeShare}
            className="mt-4 w-full text-center text-sm text-keeper-body hover:text-brand-dark transition-colors"
          >
            More sharing options…
          </button>
        )}

        <div className="mt-4 text-xs text-keeper-meta text-center truncate px-2">
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
      className="flex flex-col items-center gap-1.5 text-xs text-keeper-body hover:text-keeper-ink transition-colors"
    >
      <div
        className={`w-12 h-12 rounded-xl ${color} flex items-center justify-center shadow-sm`}
      >
        {icon}
      </div>
      <span className={textColor ?? 'text-keeper-body'}>{label}</span>
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

            <p className="text-xs uppercase tracking-[0.25em] text-keeper-meta">
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
    <div className="min-h-screen overflow-x-clip bg-white">
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
            className="text-sm font-medium text-keeper-body hover:text-brand-dark"
          >
            My studio
          </Link>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium text-keeper-body hover:text-brand-dark"
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
          // Share one CORS-clean cache entry with the 3D viewer's texture
          // loader (which is crossOrigin). Without this, this flat image —
          // which loads first — caches a no-CORS response that poisons the
          // WebGL texture fetch and the 3D card renders blank.
          crossOrigin="anonymous"
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
          <Loader2 className="w-6 h-6 animate-spin text-keeper-meta" />
        </div>
      )}
    </div>
  );
}
