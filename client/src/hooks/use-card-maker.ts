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
  type CardSide,
} from '@shared/schema';

/** A single regen attempt, as projected by GET /api/studio/drafts/:id.
 *  Failed attempts are filtered server-side. In-flight ('generating')
 *  attempts are included so the UI can show a spinner thumbnail. */
export interface CardAttemptDTO {
  id: number;
  side: CardSide;
  attemptNumber: number;
  status: 'generating' | 'completed';
  imageUrl: string;
  isSelected: boolean;
  createdAt: string;
}

/** Failure metadata returned by GET /api/studio/drafts/:id when
 *  status === 'failed'. Mirrors the columns persisted by
 *  generateStudioCard's catch block. Null when not failed.
 *  Drives <GenerationErrorPanel>'s kind-specific copy. */
export interface DraftFailureDTO {
  kind: string | null; // 'safety' | 'rate' | 'server' | 'auth' | 'unknown'
  message: string | null;
  modelExplanation: string | null;
  provider: string | null;
  code: string | null;
  suggestions: string[] | null;
}

interface DraftResponse {
  id: number;
  status: string | null;
  frontImageUrl: string | null;
  insideImageUrl: string | null;
  createdAt: string | null;
  state: CardDraftState;
  attempts?: CardAttemptDTO[];
  failure?: DraftFailureDTO | null;
  /** Per-side regen failure (most-recent attempt failed). The only way
   *  the client learns a fire-and-forget background regen failed. */
  regenFailures?: { side: CardSide; kind: string }[];
}

export interface RegenError {
  side: CardSide;
  kind: string;
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

  /** All non-failed attempts for this card (front + inside). Empty
   *  on legacy cards that predate the table; the regen flow lazily
   *  backfills attempt #1 on first regen. */
  attempts: CardAttemptDTO[];
  /** True while a regen request is in flight from this client (the
   *  POST to /regenerate). Distinct from server-side attempt status. */
  isRegenerating: CardSide | null;
  /** Set when a background regen failed (poll-detected). null = no
   *  failure. The regen surface reads this to show the error panel —
   *  fire-and-forget regens can't throw to the caller. */
  regenError: RegenError | null;
  /** Trigger a regen of one side. Resolves once the server completes
   *  (regen runs synchronously inside the route — see studio-drafts.ts).
   *  On success the new attempt becomes selected automatically. */
  regenerate: (side: CardSide, tweak?: string) => Promise<void>;
  /** Switch which attempt is the displayed version for a given side.
   *  Pure pointer flip, no generation. */
  selectAttempt: (attemptId: number) => Promise<void>;

  /** Failure metadata when status === 'failed'. Null otherwise.
   *  Drives <GenerationErrorPanel>'s kind-specific copy + suggestions
   *  on the initial-gen failure path. Cleared on retry. */
  failure: DraftFailureDTO | null;

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
  const [attempts, setAttempts] = useState<CardAttemptDTO[]>([]);
  const [isRegenerating, setIsRegenerating] = useState<CardSide | null>(null);
  const [failure, setFailure] = useState<DraftFailureDTO | null>(null);
  // Background-regen failure (poll-detected). null = no failure. Cleared
  // when a fresh regen starts. See next_regen_interaction_polish.md (G1).
  const [regenError, setRegenError] = useState<RegenError | null>(null);
  // True while regenerate()'s own poll loop owns the polling. Suppresses
  // the shouldPoll interval so the two don't double-poll + race (G2).
  const [isManualRegenActive, setIsManualRegenActive] = useState(false);

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
          setAttempts(data.attempts ?? []);
          setFailure(data.failure ?? null);
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
  // Polls while either:
  //   • the WHOLE card is generating (initial gen), OR
  //   • a single attempt is still in 'generating' state (regen of one
  //     side — card.status stays 'completed' for the other side).
  const hasInflightAttempt = attempts.some((a) => a.status === 'generating');
  // G2: don't run this interval while regenerate()'s own loop is polling
  // — that was the double-poll. This interval still covers initial-gen
  // and an orphaned in-flight attempt picked up on a fresh page load.
  const shouldPoll =
    (status === 'generating' || hasInflightAttempt) && !isManualRegenActive;
  useEffect(() => {
    if (!shouldPoll) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const data = await loadDraft();
        if (cancelled || !data) return;
        setStatus(data.status);
        setFrontImageUrl(data.frontImageUrl);
        setInsideImageUrl(data.insideImageUrl);
        setAttempts(data.attempts ?? []);
        setFailure(data.failure ?? null);
        setRegenError(data.regenFailures?.[0] ?? null);
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
  }, [shouldPoll, loadDraft]);

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

  // ── Regen ────────────────────────────────────────────────────────
  // The server-side regen route changed 2026-05-15 to return the new
  // attemptId IMMEDIATELY (after creating the row in 'generating'
  // state), with the actual generation running in a background promise
  // on the server. So we can't await the POST and assume "done" —
  // we have to poll the draft until the new attempt's status flips
  // off 'generating'.
  //
  // Spinner state (`isRegenerating`) stays true for the whole poll
  // loop, naturally bracketing the real gen duration rather than the
  // (now-fast) API request lifetime.
  const REGEN_POLL_INTERVAL_MS = 2000;
  const REGEN_POLL_TIMEOUT_MS = 8 * 60 * 1000; // hard ceiling — gpt-image-2 high quality is ~5 min worst case
  const regenerate = useCallback(
    async (side: CardSide, tweak?: string): Promise<void> => {
      setIsRegenerating(side);
      setIsManualRegenActive(true); // G2: this loop owns the poll
      setRegenError(null); // clear any prior failure for the fresh attempt
      const startedAt = Date.now();
      try {
        await apiRequest('POST', `/api/studio/drafts/${cardId}/regenerate`, {
          side,
          tweak: tweak?.trim() || undefined,
        });

        // Poll until no attempt is in 'generating' state. The new
        // attempt was created server-side BEFORE the route returned,
        // so the very next loadDraft() call should see it as
        // 'generating'. We continue until it flips to 'completed' or
        // 'failed' (both terminal states).
        while (true) {
          const data = await loadDraft();
          if (!data) {
            // Transient poll failure (network blip / busy server). Do NOT
            // treat "couldn't fetch" as "done" — that ended the regen
            // early and made the spinner clear + the "ready" panel flash
            // while the gen was still running. Keep polling.
            if (Date.now() - startedAt > REGEN_POLL_TIMEOUT_MS) {
              setRegenError({ side, kind: 'server' });
              break;
            }
            await new Promise((r) => setTimeout(r, REGEN_POLL_INTERVAL_MS));
            continue;
          }
          setFrontImageUrl(data.frontImageUrl);
          setInsideImageUrl(data.insideImageUrl);
          setAttempts(data.attempts ?? []);
          setFailure(data.failure ?? null);
          setStatus(data.status);
          const stillGenerating =
            data.attempts?.some((a) => a.status === 'generating') ?? false;
          if (!stillGenerating) {
            // G1: did THIS side's regen fail? The failed attempt is
            // filtered out of `attempts`, so the spinner just clears —
            // surface the failure explicitly so the panel can show it
            // instead of silently dropping back to the old card.
            const failed =
              data?.regenFailures?.find((f) => f.side === side) ?? null;
            setRegenError(failed);
            break;
          }
          if (Date.now() - startedAt > REGEN_POLL_TIMEOUT_MS) {
            // Defensive cap — if we get here something has gone
            // seriously sideways server-side. Stop spinning forever and
            // surface it (G9) rather than a silent spinner-stop.
            console.warn(
              `[use-card-maker] regen poll timed out after ${REGEN_POLL_TIMEOUT_MS}ms — bailing.`,
            );
            setRegenError({ side, kind: 'server' });
            break;
          }
          await new Promise((r) => setTimeout(r, REGEN_POLL_INTERVAL_MS));
        }
        queryClient.invalidateQueries({ queryKey: ['/api/user/cards'] });
      } finally {
        setIsRegenerating(null);
        setIsManualRegenActive(false);
      }
    },
    [cardId, loadDraft],
  );

  const selectAttempt = useCallback(
    async (attemptId: number): Promise<void> => {
      await apiRequest(
        'PATCH',
        `/api/studio/cards/${cardId}/select-attempt`,
        { attemptId },
      );
      // Reload so frontImageUrl / insideImageUrl + attempts.isSelected
      // pick up the change. Cheap (single DB read).
      const data = await loadDraft();
      if (data) {
        setFrontImageUrl(data.frontImageUrl);
        setInsideImageUrl(data.insideImageUrl);
        setAttempts(data.attempts ?? []);
        setFailure(data.failure ?? null);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/user/cards'] });
    },
    [cardId, loadDraft],
  );

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
    attempts,
    isRegenerating,
    regenError,
    regenerate,
    selectAttempt,
    failure,
    // Clamp on read — defends against legacy drafts saved before a
    // CARD_MAKER_STEPS change (the V1 style-step removal on 2026-05-17
    // shifted indices, leaving existing test drafts with state.step
    // values that no longer have a render branch — empty-panel bug).
    // setStep already clamps writes; this matches on the read side so
    // a single bad value can't render an empty maker. Subsequent
    // navigation persists a clamped step, self-healing the draft.
    currentStep: Math.max(
      0,
      Math.min(totalSteps - 1, state.step ?? 0),
    ),
    totalSteps,
  };
}
