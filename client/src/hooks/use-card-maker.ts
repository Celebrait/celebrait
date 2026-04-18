// client/src/hooks/use-card-maker.ts
//
// State + autosave for the Studio card maker. Loads a draft by id on
// mount, keeps a local mirror, and PATCHes back to the server on step
// transitions and on-demand (`flushSave`).
//
// Keystroke-level autosave for the inside-message textarea is opt-in
// at the field level — the hook exposes a `scheduleSave(delayMs)`
// primitive the Inside step calls with a 1-second debounce. Everything
// else saves on blur / step change.

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import {
  EMPTY_CARD_DRAFT,
  CARD_MAKER_STEPS,
  type CardDraftState,
} from '@shared/schema';

interface DraftResponse {
  id: number;
  status: string | null;
  frontImageUrl: string | null;
  insideImageUrl: string | null;
  createdAt: string | null;
  state: CardDraftState;
}

interface UseCardMakerOptions {
  cardId: number;
}

interface UseCardMakerResult {
  state: CardDraftState;
  /** True while the initial load is in flight. */
  isLoading: boolean;
  /** Latest load error, if any. */
  loadError: string | null;
  /** True if an autosave is currently in flight. */
  isSaving: boolean;

  /** Current DB status: 'draft' | 'generating' | 'completed' | 'failed'. */
  status: string | null;
  /** Rendered front image URL (populated when status='completed'). */
  frontImageUrl: string | null;
  /** Rendered inside image URL (populated when status='completed' and
   *  the customer picked a non-empty inside mode). */
  insideImageUrl: string | null;

  /** Merge partial state into the draft. Triggers an immediate save. */
  update: (patch: Partial<CardDraftState>) => void;

  /** Move to a specific step and save. */
  setStep: (step: number) => void;
  goNext: () => void;
  goBack: () => void;

  /** Request a debounced save after `delayMs`. Multiple calls coalesce
   *  so typing 500 chars in a textarea only results in one request. */
  scheduleSave: (delayMs: number) => void;

  /** Cancel any pending scheduled save and flush current state now. */
  flushSave: () => Promise<void>;

  /** Kick off background generation. Flips the draft to 'generating'
   *  on the server; the polling loop picks up subsequent status
   *  transitions automatically. */
  startGeneration: () => Promise<void>;
  /** True while the POST to /generate is in flight. Separate from
   *  status==='generating' — this is the single-round-trip submit,
   *  the status field tracks the whole background job. */
  isStartingGeneration: boolean;

  /** Number of the current step (0-indexed). */
  currentStep: number;
  /** Total step count. Useful for progress UI. */
  totalSteps: number;
}

// Poll cadence while a generation is in flight. Chosen to feel
// responsive without hammering the server — front + inside usually
// land 20-60s after start.
const STATUS_POLL_INTERVAL_MS = 2000;

export function useCardMaker({ cardId }: UseCardMakerOptions): UseCardMakerResult {
  const [state, setState] = useState<CardDraftState>(EMPTY_CARD_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [frontImageUrl, setFrontImageUrl] = useState<string | null>(null);
  const [insideImageUrl, setInsideImageUrl] = useState<string | null>(null);
  const [isStartingGeneration, setIsStartingGeneration] = useState(false);

  // Keep a live mirror of state so the debounced save can read the
  // latest value when its timer fires (avoids stale-closure bugs).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  // Reusable loader — initial mount + polling loop both call this.
  const loadDraft = useCallback(async (): Promise<DraftResponse | null> => {
    const res = await fetch(`/api/studio/drafts/${cardId}`, {
      credentials: 'include',
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${res.status}: ${body}`);
    }
    return (await res.json()) as DraftResponse;
  }, [cardId]);

  // ── Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    let aborted = false;
    setIsLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const data = await loadDraft();
        if (!aborted && data) {
          setState(data.state);
          setStatus(data.status);
          setFrontImageUrl(data.frontImageUrl);
          setInsideImageUrl(data.insideImageUrl);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (!aborted) {
          setLoadError(err?.message ?? 'Could not load draft');
          setIsLoading(false);
        }
      }
    })();

    return () => {
      aborted = true;
    };
  }, [cardId, loadDraft]);

  // ── Status polling ───────────────────────────────────────────────
  // While the server is generating, re-fetch the draft on a timer so
  // the UI picks up the completion (or failure) without the user
  // having to refresh. Polling naturally stops once status leaves
  // 'generating' because the effect's dependency re-runs.
  useEffect(() => {
    if (status !== 'generating') return;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await loadDraft();
        if (cancelled || !data) return;
        setStatus(data.status);
        setFrontImageUrl(data.frontImageUrl);
        setInsideImageUrl(data.insideImageUrl);
        // Also refresh state so any server-side post-processing that
        // modified conversationData (future-proofing) is reflected.
        setState(data.state);
      } catch (err) {
        // Transient — keep polling; the UI stays on "generating".
        console.warn('[CARD_MAKER] status poll failed:', err);
      }
    };
    const interval = setInterval(tick, STATUS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [status, loadDraft]);

  // ── Save primitives ──────────────────────────────────────────────
  const runSave = useCallback(
    async (next: CardDraftState) => {
      setIsSaving(true);
      try {
        await apiRequest('PATCH', `/api/studio/drafts/${cardId}`, { state: next });
        // Invalidate the card grid query so drafts show up with latest
        // step / metadata without the user manually refreshing.
        queryClient.invalidateQueries({ queryKey: ['/api/user/cards'] });
      } catch (err) {
        console.error('[CARD_MAKER] save failed:', err);
        // Swallow — autosave is best-effort. The next save attempt will
        // retry. Surfacing every transient failure would create noise.
      } finally {
        setIsSaving(false);
      }
    },
    [cardId],
  );

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await runSave(stateRef.current);
  }, [runSave]);

  const scheduleSave = useCallback(
    (delayMs: number) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void runSave(stateRef.current);
      }, delayMs);
    },
    [runSave],
  );

  // ── Mutators ─────────────────────────────────────────────────────
  const update = useCallback(
    (patch: Partial<CardDraftState>) => {
      setState((prev) => {
        const next: CardDraftState = { ...prev, ...patch };
        stateRef.current = next;
        // Fire-and-forget save. Step transitions + blur-triggered
        // updates go through here so the user's progress is durable.
        void runSave(next);
        return next;
      });
    },
    [runSave],
  );

  const totalSteps = CARD_MAKER_STEPS.length;

  const setStep = useCallback(
    (step: number) => {
      const clamped = Math.max(0, Math.min(totalSteps - 1, step));
      update({ step: clamped });
    },
    [update, totalSteps],
  );

  const goNext = useCallback(() => {
    setStep((stateRef.current.step ?? 0) + 1);
  }, [setStep]);

  const goBack = useCallback(() => {
    setStep((stateRef.current.step ?? 0) - 1);
  }, [setStep]);

  // ── Generation ────────────────────────────────────────────────────
  const startGeneration = useCallback(async (): Promise<void> => {
    setIsStartingGeneration(true);
    try {
      // Flush any pending debounced saves before the server reads the
      // draft state. Otherwise the user's last keystroke in the inside
      // textarea might not be on the server yet when the generator
      // runs.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        await runSave(stateRef.current);
      }
      const res = await apiRequest('POST', `/api/studio/drafts/${cardId}/generate`, {});
      const data = (await res.json()) as { id: number; status: string };
      setStatus(data.status);
    } finally {
      setIsStartingGeneration(false);
    }
  }, [cardId, runSave]);

  // Cancel pending saves on unmount, but let any in-flight ones resolve.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  return {
    state,
    isLoading,
    loadError,
    isSaving,
    status,
    frontImageUrl,
    insideImageUrl,
    update,
    setStep,
    goNext,
    goBack,
    scheduleSave,
    flushSave,
    startGeneration,
    isStartingGeneration,
    currentStep: state.step ?? 0,
    totalSteps,
  };
}
