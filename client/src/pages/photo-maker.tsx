// client/src/pages/photo-maker.tsx — THE PUBLIC PHOTO MAKER (/photo/make)
//
// Aidan, 2026-09-04: "open up the photo route to the front end but make
// them sign up before generation".
//
// The studio's own step components (recipient → photo → scene → front
// text) run here signed out, on local state (useLocalCardMaker) with
// the guest photo store behind the photo step. The fifth step is the
// gate: a summary of the card and ONE button — "Sign up to generate"
// when signed out, "Generate" when signed in. After sign-in the page
// comes back with ?claim=1 and TRANSFERS the card into the studio:
// create the draft, upload the held photos, patch the state onto the
// draft, fire the front generation, and land on the studio maker at the
// Review step with the reveal already under way.
//
// Landing chrome (this is still the shop floor), studio panel inside.
// Free account needed to generate, not to start — said on step one.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { ChevronLeft, ChevronRight, Loader2, Sparkles, Lock } from 'lucide-react';
import { StepChips } from '@/components/step-chips';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';
import { useSeo } from '@/lib/use-seo';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { RecipientStep, isRecipientStepReady } from '@/components/studio/steps/recipient-step';
import { PhotoStep, isPhotoStepReady } from '@/components/studio/steps/photo-step';
import { SceneStep, isSceneStepReady } from '@/components/studio/steps/scene-step';
import { FrontStep, isFrontStepReady } from '@/components/studio/steps/front-step';
import { getOccasionLabel } from '@/components/studio/scene-presets';
import { useLocalCardMaker } from '@/hooks/use-local-card-maker';
import { GuestPhotoContext, useGuestPhotos, getGuestPhotoBlobs, clearGuestPhotos, discardGuestSession, photoThumbSrc } from '@/lib/guest-photos';
import { CARD_MAKER_STEPS, type CardDraftState } from '@shared/schema';
import { cardPriceGBP } from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

/** The public walk: the studio's first four steps, then the gate. */
const PUBLIC_STEPS = [
  { id: 'recipient', label: 'Who' },
  { id: 'photo', label: 'Photo' },
  { id: 'scene', label: 'Scene' },
  { id: 'front', label: 'Front text' },
  { id: 'generate', label: 'Generate', locked: true },
] as const;
const GATE = PUBLIC_STEPS.length - 1;
/** Set when "Sign up to generate" is pressed; the transfer fires once signed in. */
const PENDING_KEY = 'celebrait:photo-maker:pending';

function headline(step: number, state: CardDraftState): string {
  const name = state.recipient?.name?.trim();
  const occ = state.recipient?.occasion?.trim();
  const noun = occ && occ !== 'other' ? `${getOccasionLabel(occ).toLowerCase()} card` : 'card';
  const owned = name ? `${name}'s ${noun}` : `the ${noun}`;
  switch (PUBLIC_STEPS[step]?.id) {
    case 'recipient': return "Who's this card for?";
    case 'photo': return 'Upload Photo(s)';
    case 'scene': return `Let's set the scene for ${owned}`;
    case 'front': return `What should it say on the front of ${owned}?`;
    default: return name ? `${name}'s card, ready to draw` : 'Ready to draw';
  }
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="relative mx-auto max-w-6xl px-4 pb-20 pt-32 sm:px-6">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>
    </div>
  );
}

export default function PhotoMakerPage() {
  useSeo('/photo/make');
  useEffect(() => { const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex'; document.head.appendChild(m); return () => { m.remove(); }; }, []);
  const [, navigate] = useLocation();
  // wouter's location is the PATHNAME only; the sign-in return lands on
  // the same path with ?claim=1, so the query has to be watched itself.
  const search = useSearch();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { openAuth, authOpen } = useAuthModal();

  // Reminder / gate deep-links seed the recipient, as /studio/new-card does.
  const seed = useMemo(() => {
    const qp = new URLSearchParams(window.location.search);
    const name = qp.get('recipient')?.trim();
    const occasion = qp.get('occasion')?.trim();
    return name || occasion ? { recipient: { name: name ?? '', occasion: occasion ?? '' } } : undefined;
  }, []);
  const m = useLocalCardMaker(PUBLIC_STEPS.length, seed as Partial<CardDraftState> | undefined);
  const { state, update, setStep, goNext, goBack, currentStep } = m;
  const photos = useGuestPhotos();
  const furthest = Math.max(currentStep, state.step ?? 0);

  const ready = (i: number) =>
    i === 0 ? isRecipientStepReady(state)
    : i === 1 ? isPhotoStepReady(state, photos)
    : i === 2 ? isSceneStepReady(state)
    : i === 3 ? isFrontStepReady(state)
    : true;
  const allReady = [0, 1, 2, 3].every(ready);

  // Fail-open backstop for the photo gate (mirrors card-maker.tsx).
  const [, tick] = useState(0);
  const photoCount = state.photos?.photoIds?.length ?? 0;
  useEffect(() => {
    if (currentStep === 1 && photoCount > 0) {
      const t = setTimeout(() => tick((x) => x + 1), 31_000);
      return () => clearTimeout(t);
    }
  }, [currentStep, photoCount]);

  // ── The transfer: guest card → studio draft → generating ───────────
  const [transfer, setTransfer] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const transferring = useRef(false);
  // Retry-safe: a draft made on a failed attempt is reused, and photos
  // that already went up aren't uploaded twice (no orphan drafts, no
  // duplicate library rows).
  const draftIdRef = useRef<number | null>(null);
  const uploadedRef = useRef(new Map<number, number>());
  const runTransfer = async () => {
    if (transferring.current) return;
    transferring.current = true;
    setTransferError(null);
    const st = m.stateRef.current;
    try {
      setTransfer('Setting up your studio…');
      let id = draftIdRef.current;
      if (id == null) {
        const created = await apiRequest('POST', '/api/studio/drafts', {
          recipientName: st.recipient?.name?.trim() || undefined,
          occasion: st.recipient?.occasion?.trim() || undefined,
        });
        id = ((await created.json()) as { id: number }).id;
        draftIdRef.current = id;
      }

      setTransfer('Saving your photo…');
      const blobs = await getGuestPhotoBlobs();
      const idMap = uploadedRef.current;
      for (const gid of st.photos?.photoIds ?? []) {
        if (idMap.has(gid)) continue;
        const b = blobs.get(gid);
        if (!b) continue;
        const r = await apiRequest('POST', '/api/photos/upload', b);
        const p = (await r.json()) as { id: number };
        idMap.set(gid, p.id);
      }
      const photoIds = (st.photos?.photoIds ?? []).map((g) => idMap.get(g)).filter((x): x is number => typeof x === 'number');
      if (photoIds.length === 0) throw new Error("Your photo didn't make it across — please add it again.");

      const reviewIdx = CARD_MAKER_STEPS.findIndex((s) => s.id === 'review');
      const next: CardDraftState = {
        ...st,
        step: reviewIdx,
        photos: { ...(st.photos ?? { mode: 'one_person', photoIds: [] }), photoIds },
      };
      await apiRequest('PATCH', `/api/studio/drafts/${id}`, { state: next });

      setTransfer('Starting the drawing…');
      try {
        await apiRequest('POST', `/api/studio/drafts/${id}/generate`, { mode: 'front' });
      } catch (err: any) {
        // Daily limit or a hiccup: land in the studio anyway — the Review
        // step carries its own Generate button and the clear message.
        console.warn('[PHOTO_MAKER] generate after transfer failed:', err);
        if (typeof err?.limit === 'number') {
          toast({ title: "You've reached today's limit", description: `You've made ${err.used} cards today (${err.limit} max). Your card is saved in your studio.`, variant: 'destructive' });
        }
      }
      await clearGuestPhotos();
      m.reset();
      navigate(`/studio/card/${id}/edit`);
    } catch (err: any) {
      transferring.current = false;
      setTransfer(null);
      setTransferError(err?.message ?? "Couldn't bring your card into the studio.");
    }
  };

  // Back from sign-in → transfer once we know we're in. Two signals:
  // ?claim=1 (the auth form's redirect, incl. Google's full-page
  // return) or the pending flag set at "Sign up to generate" — the
  // latter only once the auth dialog has closed, so the welcome step
  // (first name, consent) isn't cut short.
  useEffect(() => {
    const claim = new URLSearchParams(search).get('claim');
    const pending = (() => { try { return sessionStorage.getItem(PENDING_KEY) === '1'; } catch { return false; } })();
    if (authLoading) return;
    if (!claim && !(pending && !authOpen)) return;
    if (!isAuthenticated) { if (claim) openAuth('/photo/make?claim=1'); return; }
    try { sessionStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
    if (!allReady) { window.history.replaceState(null, '', '/photo/make'); return; }
    void runTransfer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, isAuthenticated, search, authOpen]);

  const isGate = currentStep === GATE;
  const canAdvance = ready(currentStep);

  if (transfer) {
    return (
      <Shell>
        <div className="mx-auto max-w-md py-24 text-center">
          <Loader2 className="mx-auto mb-5 h-8 w-8 animate-spin text-brand" />
          <p className="font-display text-xl font-bold text-keeper-ink">{transfer}</p>
          <p className="mt-1.5 text-sm text-keeper-meta">A few seconds. Your card opens in the studio, drawing as you arrive.</p>
        </div>
      </Shell>
    );
  }

  return (
    <GuestPhotoContext.Provider value>
      <Shell>
        <div className="mb-3 flex items-center justify-between gap-3 text-xs text-keeper-meta">
          <span className="inline-flex items-center gap-1.5"><Lock className="h-3 w-3" /> Free account needed to generate, not to start.</span>
          {/* Leaving = nothing of theirs stays in this browser. */}
          <Link href="/photo" onClick={() => { void discardGuestSession(); m.reset(); }} className="underline underline-offset-2 hover:text-keeper-body">Close</Link>
        </div>
        <div className="mb-6 sm:mb-8">
          <StepChips steps={[...PUBLIC_STEPS]} current={currentStep} furthest={furthest} onJump={setStep} />
        </div>

        <div className="min-h-[380px] rounded-2xl border border-keeper-hair bg-white p-6 sm:p-10">
          <h1 className="mx-auto mb-5 max-w-2xl font-display text-xl font-bold tracking-[-0.015em] text-keeper-ink sm:mb-6 sm:text-2xl">
            {headline(currentStep, state)}
          </h1>

          {currentStep === 0 && (
            <RecipientStep
              state={state}
              onChange={update}
              // Read through the ref at fire time: the step calls this
              // in the same tick as onChange, before the closure's
              // `state` has caught up (card-maker.tsx does the same).
              onAdvance={() => setTimeout(() => { if (isRecipientStepReady(m.stateRef.current)) goNext(); }, 250)}
            />
          )}
          {currentStep === 1 && <PhotoStep state={state} onChange={update} />}
          {currentStep === 2 && <SceneStep state={state} onChange={update} guest />}
          {currentStep === 3 && <FrontStep state={state} onChange={update} />}
          {isGate && (
            <GateStep
              state={state}
              photos={photos.filter((p) => (state.photos?.photoIds ?? []).includes(p.id))}
              allReady={allReady}
              authed={!authLoading && isAuthenticated}
              error={transferError}
              onEdit={setStep}
              onSignUp={() => { try { sessionStorage.setItem(PENDING_KEY, '1'); } catch { /* ignore */ } openAuth('/photo/make?claim=1'); }}
              onGenerate={() => void runTransfer()}
            />
          )}
        </div>

        {!isGate && (
          <div className="mt-6 flex items-center justify-between">
            <Button variant="ghost" onClick={goBack} disabled={currentStep === 0} className="text-keeper-body">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
            <Button onClick={goNext} disabled={!canAdvance} className="bg-go text-go-foreground hover:bg-go-hover disabled:opacity-50">
              Next <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        )}
        {isGate && (
          <div className="mt-6 flex items-center justify-start">
            <Button variant="ghost" onClick={goBack} className="text-keeper-body">
              <ChevronLeft className="mr-1 h-4 w-4" /> Back
            </Button>
          </div>
        )}
      </Shell>
    </GuestPhotoContext.Provider>
  );
}

/** The gate: the card as a brief, then one button. */
function GateStep({ state, photos, allReady, authed, error, onEdit, onSignUp, onGenerate }: {
  state: CardDraftState;
  photos: Array<{ id: number; thumbnailPath: string; label: string | null }>;
  allReady: boolean;
  authed: boolean;
  error: string | null;
  onEdit: (i: number) => void;
  onSignUp: () => void;
  onGenerate: () => void;
}) {
  const occ = state.recipient?.occasion?.trim();
  const rows: Array<[string, ReactNode, number]> = [
    ['For', `${state.recipient?.name?.trim() || '—'}${occ ? ` · ${getOccasionLabel(occ)}` : ''}`, 0],
    ['Photo', photos.length ? (
      <span className="flex gap-2">{photos.map((p, i) => <img key={p.id} src={photoThumbSrc(p)} alt={p.label ?? `Photo ${i + 1}`} className="h-14 w-14 rounded-lg object-cover" />)}</span>
    ) : '—', 1],
    ['Scene', state.scene?.description?.trim() || '—', 2],
    // No text + not 'none' = the generator writes the front line itself
    // (background-generator falls back to an occasion default).
    ['Front', state.front?.mode === 'none' ? 'No words on the front' : (state.front?.text?.trim() || "We'll pick the words"), 3],
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <dl className="divide-y divide-keeper-hair rounded-xl border border-keeper-hair bg-keeper-paper/60">
        {rows.map(([k, v, i]) => (
          <div key={k} className="grid grid-cols-[4.5rem_1fr_auto] items-start gap-x-3 px-4 py-3">
            <dt className="pt-[2px] text-[11px] font-semibold uppercase tracking-[0.12em] text-keeper-meta">{k}</dt>
            <dd className="min-w-0 text-[14.5px] leading-relaxed text-keeper-body">{v}</dd>
            <button type="button" onClick={() => onEdit(i)} className="text-[12px] font-medium text-keeper-gold underline-offset-2 hover:underline">Edit</button>
          </div>
        ))}
      </dl>

      <div className="mt-6 rounded-xl border-2 border-brand bg-brand-muted p-5 sm:p-6">
        <p className="font-display text-lg font-bold text-keeper-ink">
          {authed ? 'Ready when you are.' : 'One free account, then we draw.'}
        </p>
        <p className="mt-1 text-[14px] leading-relaxed text-keeper-body">
          {authed
            ? 'Your card is saved to your studio and drawn there — a few minutes on our bigger image model.'
            : 'Sign up in ten seconds. Your photo, scene and words come with you; the card is drawn in your studio and saved there.'}
          {' '}Nothing to pay until you print ({gbp(cardPriceGBP('photo'))}).
        </p>
        {error && <p className="mt-3 text-[13px] text-accent-red-dark">{error}</p>}
        <Button
          onClick={authed ? onGenerate : onSignUp}
          disabled={!allReady}
          className="mt-4 w-full bg-go text-go-foreground hover:bg-go-hover disabled:opacity-50 sm:w-auto"
          data-testid="btn-photo-maker-generate"
        >
          <Sparkles className="mr-1.5 h-4 w-4" /> {authed ? 'Generate' : 'Sign up to generate'}
        </Button>
        {!allReady && <p className="mt-2 text-[12.5px] text-keeper-meta">Something's missing above — tap Edit to fill it in.</p>}
      </div>
    </div>
  );
}
