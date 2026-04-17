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

  /** Number of the current step (0-indexed). */
  currentStep: number;
  /** Total step count. Useful for progress UI. */
  totalSteps: number;
}

export function useCardMaker({ cardId }: UseCardMakerOptions): UseCardMakerResult {
  const [state, setState] = useState<CardDraftState>(EMPTY_CARD_DRAFT);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Keep a live mirror of state so the debounced save can read the
  // latest value when its timer fires (avoids stale-closure bugs).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  // ── Load ─────────────────────────────────────────────────────────
  useEffect(() => {
    let aborted = false;
    setIsLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const res = await fetch(`/api/studio/drafts/${cardId}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`${res.status}: ${body}`);
        }
        const data: DraftResponse = await res.json();
        if (!aborted) {
          setState(data.state);
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
  }, [cardId]);

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
    update,
    setStep,
    goNext,
    goBack,
    scheduleSave,
    flushSave,
    currentStep: state.step ?? 0,
    totalSteps,
  };
}
