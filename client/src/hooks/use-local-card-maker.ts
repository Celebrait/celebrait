// client/src/hooks/use-local-card-maker.ts
//
// The signed-out twin of useCardMaker (2026-09-04, the public photo
// maker). Same `state / update / setStep / goNext / goBack` surface the
// step components lean on, but the draft lives in THIS browser
// (sessionStorage) instead of a cards row — there is no user to own one
// yet. When the visitor signs up, /photo/make transfers the state into a
// real draft and this store is cleared.
//
// sessionStorage, not localStorage: a Google sign-in is a full-page
// redirect in the same tab (survives), while a different tab or a
// closed browser starts clean (a half-made card for someone else's
// photo shouldn't linger on a shared machine).

import { useCallback, useRef, useState } from 'react';
import { EMPTY_CARD_DRAFT, type CardDraftState } from '@shared/schema';

export const LOCAL_DRAFT_KEY = 'celebrait:photo-maker:v1';
// Furthest step ever reached, kept beside the draft. Launch audit
// 2026-10-06: deriving it from the CURRENT step meant "Edit" from the
// gate collapsed it, disabling every forward chip until the user had
// Next-ed back through each step.
const FURTHEST_KEY = 'celebrait:photo-maker:furthest:v1';

function read(): CardDraftState {
  try {
    const raw = window.sessionStorage.getItem(LOCAL_DRAFT_KEY);
    if (!raw) return EMPTY_CARD_DRAFT;
    const parsed = JSON.parse(raw) as CardDraftState;
    return parsed && parsed.version === 1 ? parsed : EMPTY_CARD_DRAFT;
  } catch {
    return EMPTY_CARD_DRAFT;
  }
}
function write(s: CardDraftState) {
  try { window.sessionStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(s)); } catch { /* private mode */ }
}
function readFurthest(): number {
  try { return Math.max(0, Number(window.sessionStorage.getItem(FURTHEST_KEY)) || 0); } catch { return 0; }
}
function writeFurthest(n: number) {
  try { window.sessionStorage.setItem(FURTHEST_KEY, String(n)); } catch { /* private mode */ }
}
export function clearLocalDraft() {
  try {
    window.sessionStorage.removeItem(LOCAL_DRAFT_KEY);
    window.sessionStorage.removeItem(FURTHEST_KEY);
  } catch { /* ignore */ }
}

export function useLocalCardMaker(totalSteps: number, seed?: Partial<CardDraftState>) {
  const [state, setState] = useState<CardDraftState>(() => {
    const s = read();
    return seed && s === EMPTY_CARD_DRAFT ? { ...s, ...seed } : s;
  });
  const stateRef = useRef(state);
  // Never below the step the draft was restored on.
  const [furthest, setFurthest] = useState<number>(() => Math.max(readFurthest(), state.step ?? 0));

  const update = useCallback((patch: Partial<CardDraftState>) => {
    setState((prev) => {
      const next: CardDraftState = { ...prev, ...patch };
      stateRef.current = next;
      write(next);
      return next;
    });
  }, []);

  const setStep = useCallback((step: number) => {
    const clamped = Math.max(0, Math.min(totalSteps - 1, step));
    update({ step: clamped });
    setFurthest((f) => {
      const n = Math.max(f, clamped);
      if (n !== f) writeFurthest(n);
      return n;
    });
  }, [update, totalSteps]);
  const goNext = useCallback(() => setStep((stateRef.current.step ?? 0) + 1), [setStep]);
  const goBack = useCallback(() => setStep((stateRef.current.step ?? 0) - 1), [setStep]);

  const reset = useCallback(() => {
    stateRef.current = EMPTY_CARD_DRAFT;
    setState(EMPTY_CARD_DRAFT);
    setFurthest(0);
    clearLocalDraft();
  }, []);

  const currentStep = Math.max(0, Math.min(totalSteps - 1, state.step ?? 0));
  return { state, stateRef, update, setStep, goNext, goBack, reset, currentStep, furthest };
}
