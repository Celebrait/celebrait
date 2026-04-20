// client/src/pages/card-viewer.tsx
//
// Digital card viewer — full-page wrapper that hosts the reusable
// Card3DViewer plus the welcome-screen arrival moment and (Phase 2+)
// share chrome + "Made with Celebrait" viral loop.
//
// All the 3D work lives in components/card-3d-viewer.tsx — this file
// is just the page-specific framing (route, data fetch, welcome,
// vignette background).

import { useState } from 'react';
import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card3DViewer } from '@/components/card-3d-viewer';
import type { CardDraftState } from '@shared/schema';

// One shape for both endpoints — the auth-gated /api/studio/drafts/:id
// returns a `state.recipient.name` shape; the public /api/card/:id/view
// returns top-level `recipientName`. Normalise to a single field below.
interface CardData {
  id: number;
  status: string | null;
  frontImageUrl: string | null;
  insideImageUrl: string | null;
  // From the auth-gated endpoint only.
  state?: CardDraftState;
  // From the public endpoint only.
  recipientName?: string | null;
  occasion?: string | null;
}

export default function CardViewerPage() {
  const [, params] = useRoute<{ id: string }>('/card/:id/view');
  const [, setLocation] = useLocation();
  const cardId = params ? parseInt(params.id, 10) : NaN;

  // Token in the query string = recipient is viewing via a share link;
  // hit the public endpoint. No token = sender previewing their own
  // card; use the auth-gated draft endpoint.
  const token = new URLSearchParams(window.location.search).get('t');
  const endpoint = token
    ? `/api/card/${cardId}/view?t=${encodeURIComponent(token)}`
    : `/api/studio/drafts/${cardId}`;

  const { data, isLoading, error } = useQuery<CardData>({
    queryKey: [endpoint],
    enabled: Number.isFinite(cardId),
  });

  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  if (!Number.isFinite(cardId)) {
    return <Centered>Invalid card id.</Centered>;
  }

  if (isLoading) {
    return (
      <Centered>
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </Centered>
    );
  }

  if (error || !data) {
    return (
      <Centered>
        <p className="text-sm text-stone-600 mb-4">Couldn't load this card.</p>
        <Button onClick={() => setLocation('/studio')}>Back to Studio</Button>
      </Centered>
    );
  }

  if (!data.frontImageUrl) {
    return (
      <Centered>
        <p className="text-sm text-stone-600 mb-2">This card hasn't been generated yet.</p>
        <p className="text-xs text-stone-500 mb-4">Status: {data.status ?? 'draft'}.</p>
        <Button onClick={() => setLocation(`/studio/card/${cardId}/edit`)}>
          Back to editor
        </Button>
      </Centered>
    );
  }

  // Normalise across endpoints — public endpoint returns `recipientName`
  // top-level; auth-gated endpoint nests under `state.recipient.name`.
  const recipientName =
    data.recipientName?.trim() || data.state?.recipient?.name?.trim() || undefined;

  return (
    <div
      className="fixed inset-0 overflow-hidden"
      style={{
        background:
          'radial-gradient(ellipse 70% 60% at 50% 52%, #fefcf7 0%, #f2ebd9 70%, #e8dec7 100%)',
      }}
    >
      <div className="absolute top-4 left-4 z-10 text-xs text-stone-500">
        {recipientName ? `For ${recipientName}` : 'A card'}
      </div>

      <Card3DViewer
        frontImageUrl={data.frontImageUrl}
        insideImageUrl={data.insideImageUrl}
        format="portrait"
        className="absolute inset-0"
      />

      <AnimatePresence>
        {!welcomeDismissed && (
          <WelcomeScreen
            recipientName={recipientName ?? null}
            onEnter={() => setWelcomeDismissed(true)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── WelcomeScreen ────────────────────────────────────────────────────
// Minimal arrival moment. Tap anywhere to fade out → 3D card.
function WelcomeScreen({
  recipientName,
  onEnter,
}: {
  recipientName: string | null;
  onEnter: () => void;
}) {
  return (
    <motion.div
      onClick={onEnter}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onEnter();
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } }}
      exit={{ opacity: 0, transition: { duration: 0.7, ease: 'easeInOut' } }}
      className="absolute inset-0 z-20 flex items-center justify-center cursor-pointer select-none"
      style={{
        background:
          'radial-gradient(ellipse 70% 60% at 50% 52%, #fefcf7 0%, #f2ebd9 70%, #e8dec7 100%)',
      }}
      data-testid="card-viewer-welcome"
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{
          opacity: 1,
          y: 0,
          transition: { delay: 0.25, duration: 0.8, ease: 'easeOut' },
        }}
        className="text-center"
      >
        <p className="text-xs uppercase tracking-[0.2em] text-stone-500 mb-4">
          You've been sent a card
        </p>
        <p
          className="font-handwriting text-ink"
          style={{
            fontSize: 'clamp(44px, 10vmin, 96px)',
            lineHeight: 1,
          }}
        >
          {recipientName ? `For ${recipientName}` : 'For you'}
        </p>
        <p className="text-[11px] uppercase tracking-[0.25em] text-stone-400 mt-8">
          Tap to open
        </p>
      </motion.div>
    </motion.div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#f5f2ec] text-center p-6">
      {children}
    </div>
  );
}
