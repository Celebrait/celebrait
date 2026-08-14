// client/src/components/studio/steps/scene-step.tsx
//
// Step 3: describe the scene that goes on the card front. The editable
// textarea IS the primary input — per the locked product decision,
// every input path ends up in the same textarea so users never feel
// locked into a mode.
//
// Placeholder rotates between occasion-specific example scenes, typed
// out character-by-character (not snap-swapped) so the eye tracks
// what's changing. Feels like the textarea is gently suggesting, not
// flashing.
//
// REBUILT 2026-08-13 — suggestions first, blank page never.
//
// Before: a blank textarea was the primary input, with "Suggest scenes"
// and "Brainstorm" as two co-equal buttons underneath. Three paths
// fighting, and the default one asked the user to compose a paragraph
// from nothing. That's work, and most people won't do it — they'd
// either bounce or type something thin.
//
// Now: a one-line BRIEF at the top; Suggest returns three scenes, tap
// one to load it into the textarea and edit freely. No auto-fetch on
// arrival (Aidan 2026-08-13): un-briefed suggestions are occasion-
// generic and unlikely to hit, and three paragraphs of them ate the
// step. The brief comes first, then the ideas. The textarea
// remains the single convergence point (locked product decision) — it
// just isn't the blank thing you meet first.
//
// The brief stays because it is the FUEL, not decoration: the suggest
// prompt says "build on what the user told you in the BRIEF… if the
// brief is empty, infer from the occasion alone". Remove it and every
// user lands on the generic branch and cards homogenise — fatal for a
// product whose promise is "that's really them".
//
// Brainstorm is demoted to a text link, restoring the 2026-04-19
// decision that there should be ONE "stuck?" affordance. If its usage
// stays near zero (scene.source is logged), retire it.
//
// Cost is not a constraint here: gpt-4o-mini, ~£0.0005 per set of
// three — 0.24% of a card. The reroll cap is a UX signal (rerolling
// forever means the suggestions aren't landing and you want the chat),
// not a budget control.

import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Check, Sparkles, PenLine, MessageCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { CardDraftState } from '@shared/schema';
import { OCCASION_PRESETS } from '../scene-presets';
import { BrainstormChatDrawer } from '../brainstorm-chat-drawer';

interface SceneStepProps {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
  /** Card ID — required for the Scene Helper to hit
   *  /api/studio/scene-suggestions, which needs to validate ownership
   *  + read recipient/occasion/photo context server-side. */
  cardId?: number;
}

interface SceneSuggestion {
  id: string;
  text: string;
}

// How long between placeholder phrases (after one finishes typing).
const PLACEHOLDER_PAUSE_MS = 2500;
// Type speed — per character. Slightly varies feel for natural rhythm.
const TYPE_CHAR_MS = 45;
// Backspace speed — faster than typing so the loop doesn't drag.
const BACKSPACE_CHAR_MS = 20;
/** Sets of three the user can pull per visit. Not a cost control (a set
 *  is ~£0.0005) — a UX signal. Someone on their fourth reroll isn't
 *  being served by suggestions and wants the chat or their own words. */
const MAX_SUGGESTION_SETS = 3;
/** Seen-flag for the first-run path-button captions. */
const SCENE_PATHS_GUIDE_KEY = 'celebrait:scene-paths-guide:v1';

export function SceneStep({ state, onChange, cardId }: SceneStepProps) {
  const occasion = state.recipient?.occasion ?? 'other';
  const presetSet = OCCASION_PRESETS[occasion] ?? OCCASION_PRESETS.other;

  // Local textarea value so typing doesn't fire a save per keystroke.
  // Commits on blur. Kept in sync if `state.scene.description` changes
  // from elsewhere.
  const [local, setLocal] = useState(state.scene?.description ?? '');
  const [focused, setFocused] = useState(false);
  const [brainstormOpen, setBrainstormOpen] = useState(false);
  // Suggestions are INLINE now, not behind a modal. The modal existed to
  // make the brief-then-pick ask explicit; with the brief on the page
  // that job is done by the layout, and a modal would hide the very
  // thing we want people to meet first.
  const [brief, setBrief] = useState('');
  const [suggestions, setSuggestions] = useState<SceneSuggestion[]>([]);
  /** Sets fetched this visit. Caps rerolls — see MAX_SUGGESTION_SETS. */
  const [setsLoaded, setSetsLoaded] = useState(0);
  /** Which suggestion is currently in the textarea, so the chosen tile
   *  can show as selected. Cleared as soon as the user edits the text —
   *  a tile claiming to be "in use" when the box says something else is
   *  a small lie the eye catches. */
  const [chosenId, setChosenId] = useState<string | null>(null);
  /** The picker modal (Aidan 2026-08-13 — "the pop up worked well").
   *  Inline tiles pushed the page about; the modal frames choosing as
   *  one focused decision. Opens on Suggest, closes on pick. Reopening
   *  via "See ideas" does NOT refetch — the reroll inside the modal is
   *  the only thing that spends a set. */
  const [suggestOpen, setSuggestOpen] = useState(false);
  /** Progressive reveal for the editor. An empty "Your scene" box under
   *  the tiles read as a second job to do; now it appears when there's
   *  something to edit (picked a tile / returning with a scene) or the
   *  user asks to write their own. Latches on — it never hides again
   *  mid-edit, even if they delete every character. */
  const [editorOpen, setEditorOpen] = useState(
    () => (state.scene?.description ?? '').trim().length > 0,
  );
  /** First-run guide captions on the path buttons (Aidan 2026-08-13),
   *  same philosophy as the studio-home hints: per-device localStorage
   *  ledger, never blocking. Captions show until the user has taken any
   *  path once; the flag is written on first use but the captions don't
   *  collapse mid-session (no layout jump under the pointer) — the
   *  compact version greets them next visit. */
  const [showPathGuide] = useState(() => {
    try {
      return localStorage.getItem(SCENE_PATHS_GUIDE_KEY) !== '1';
    } catch {
      return true;
    }
  });
  const markPathUsed = () => {
    try {
      localStorage.setItem(SCENE_PATHS_GUIDE_KEY, '1');
    } catch {
      /* private mode — captions just show again next time */
    }
  };
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Debounce timer for committing the typed scene to the draft WHILE typing
  // (not only on blur) so "Next" enables as soon as there's text — the user
  // no longer has to click out of the box first. Debounced so the
  // per-change server save (onChange → runSave) doesn't fire per keystroke.
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();

  // One-shot LLM call returning 3 tailored scene paragraphs. Posts to
  // /api/studio/scene-suggestions which reads recipient + occasion +
  // photos from the draft. The `brief` param is optional — empty input
  // still works (server falls back to recipient/occasion alone) but
  // the modal copy nudges the user to give us something.
  const suggestMutation = useMutation({
    mutationFn: async () => {
      if (!cardId) throw new Error('Card not ready');
      const r = await apiRequest('POST', '/api/studio/scene-suggestions', {
        cardId,
        brief: brief.trim() || undefined,
      });
      return (await r.json()) as { suggestions: SceneSuggestion[] };
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions ?? []);
      setSetsLoaded((n) => n + 1);
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't get suggestions",
        description:
          err?.message ?? 'Write your own below, or talk it through with us.',
        variant: 'destructive',
      });
    },
  });

  const acceptSuggestion = (s: SceneSuggestion) => {
    markPathUsed();
    setSuggestOpen(false);
    setLocal(s.text);
    setChosenId(s.id);
    setEditorOpen(true);
    onChange({
      scene: { ...state.scene, description: s.text, source: 'suggestion' },
    });
    // Suggestions STAY on screen — picking one shouldn't hide the
    // alternatives. Changing your mind is a tap, not a re-fetch.
    // Focus after the editor mounts (it reveals on first pick).
    setTimeout(() => {
      textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  };

  const openEditorToWrite = () => {
    markPathUsed();
    setEditorOpen(true);
    setTimeout(() => textareaRef.current?.focus(), 80);
  };

  /** Suggest button / Enter in the brief. Opens the picker; only spends
   *  a set when there's nothing to show yet. */
  const openIdeas = () => {
    if (!cardId || busy) return;
    if (suggestions.length === 0) {
      if (!canReroll) return;
      suggestMutation.mutate();
    }
    setSuggestOpen(true);
  };

  useEffect(() => {
    // Adopt EXTERNAL changes (preset/brainstorm fill) into the textarea —
    // but IGNORE our own debounced commit landing back. That commit stores
    // the TRIMMED value, so while the user is mid-typing (e.g. a trailing
    // space between words) `local` is untrimmed and differs from it; a plain
    // `!==` here would reset `local` to the trimmed value and eat the char
    // being typed — the "jumps back / deletes while typing" bug (Kevin
    // 2026-07-24). Comparing against `local.trim()` lets the untrimmed
    // in-progress value survive, and only a genuinely different (external)
    // value replaces it.
    const incoming = state.scene?.description ?? '';
    if (incoming !== local && incoming !== local.trim()) {
      setLocal(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scene?.description]);

  // ── Typing placeholder ───────────────────────────────────────────
  // State machine:
  //   typing → paused → deleting → next phrase → typing
  // Only runs while textarea is empty + unfocused (don't fight the user).
  const placeholders = presetSet.placeholders;
  const [placeholderText, setPlaceholderText] = useState('');
  const [phIndex, setPhIndex] = useState(0);
  const [phPhase, setPhPhase] = useState<'typing' | 'pausing' | 'deleting'>(
    'typing',
  );

  const shouldAnimate = local.length === 0 && !focused;

  useEffect(() => {
    if (!shouldAnimate) return;
    const target = placeholders[phIndex] ?? placeholders[0] ?? '';

    if (phPhase === 'typing') {
      if (placeholderText.length < target.length) {
        const t = setTimeout(
          () => setPlaceholderText(target.slice(0, placeholderText.length + 1)),
          TYPE_CHAR_MS,
        );
        return () => clearTimeout(t);
      }
      // Finished typing — pause before deleting.
      const t = setTimeout(() => setPhPhase('pausing'), 0);
      return () => clearTimeout(t);
    }
    if (phPhase === 'pausing') {
      const t = setTimeout(() => setPhPhase('deleting'), PLACEHOLDER_PAUSE_MS);
      return () => clearTimeout(t);
    }
    // phPhase === 'deleting'
    if (placeholderText.length > 0) {
      const t = setTimeout(
        () => setPlaceholderText(placeholderText.slice(0, -1)),
        BACKSPACE_CHAR_MS,
      );
      return () => clearTimeout(t);
    }
    // Fully deleted — advance to next phrase + start typing.
    setPhIndex((i) => (i + 1) % placeholders.length);
    setPhPhase('typing');
  }, [phPhase, placeholderText, phIndex, placeholders, shouldAnimate]);

  // When animation is suspended (user focused or typed), reset to a
  // fresh start so resuming doesn't pick up mid-word.
  useEffect(() => {
    if (!shouldAnimate) {
      setPlaceholderText('');
      setPhPhase('typing');
    }
  }, [shouldAnimate]);

  const commit = () => {
    if (commitTimerRef.current) {
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = null;
    }
    const trimmed = local.trim();
    if (trimmed !== (state.scene?.description ?? '')) {
      onChange({
        scene: { ...state.scene, description: trimmed, source: manualSource() },
      });
    }
  };

  // Commit on a short debounce as the user types, so `isSceneStepReady`
  // (which reads state.scene.description) flips true and "Next" enables
  // without a blur. Fires ~250ms after the last keystroke, so a burst of
  // typing coalesces into one save.
  /** Manual typing. If they'd adopted a helper's text, record that they
   *  then edited it rather than silently relabelling it 'manual'. */
  const manualSource = (): NonNullable<
    NonNullable<CardDraftState['scene']>['source']
  > => {
    const prev = state.scene?.source;
    if (prev === 'suggestion' || prev === 'suggestion_edited') return 'suggestion_edited';
    if (prev === 'brainstorm' || prev === 'brainstorm_edited') return 'brainstorm_edited';
    return 'manual';
  };

  const scheduleCommit = (value: string) => {
    if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    commitTimerRef.current = setTimeout(() => {
      commitTimerRef.current = null;
      const trimmed = value.trim();
      if (trimmed !== (state.scene?.description ?? '')) {
        onChange({
          scene: { ...state.scene, description: trimmed, source: manualSource() },
        });
      }
    }, 250);
  };

  // Clear any pending commit on unmount.
  useEffect(
    () => () => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
    },
    [],
  );

  // Quick-start example chips were removed 2026-04-24 — the scene step
  // is a creativity surface, and pills nudge users toward a template-y
  // output. Free text + Brainstorm the scene are the two paths now.

  const canReroll = setsLoaded < MAX_SUGGESTION_SETS;
  const busy = suggestMutation.isPending;
  const firstName = (state.recipient?.name ?? '').trim().split(/\s+/)[0] || '';

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* ── The idea panel ─────────────────────────────────────────
          One visual object, not a stack of form controls: the brief
          steers, the tiles answer, the footer offers the two escape
          hatches. Tinted ground so the white tiles read as the content
          and the panel as the tool. */}
      <section
        className="rounded-2xl border border-brand/15 bg-gradient-to-b from-brand-muted/40 via-brand-muted/15 to-brand-muted/5 p-4 sm:p-5 space-y-4"
        data-testid="scene-suggestions"
      >
        <div className="flex items-center justify-between">
          <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-dark">
            <Sparkles className="w-3.5 h-3.5" />
            Scene ideas
          </p>
          {firstName && (
            <p className="text-[11px] text-keeper-meta">
              made for {firstName}
            </p>
          )}
        </div>

        {/* The brief — steering, not a form field. Optional by design:
            blank still returns three, inferred from the occasion. */}
        <div className="space-y-1.5">
          {/* Stacks under 640px — side-by-side crushed the input to
              three visible words, and the brief is the steering wheel. */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="scene-brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={
                firstName
                  ? `What makes ${firstName} ${firstName}? Hobbies, places, their thing…`
                  : 'Their thing — the football, the garden, the caravan…'
              }
              className="flex-1 min-w-0 h-10 bg-white text-[15px] border-keeper-hair focus-visible:border-brand focus-visible:ring-brand/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  openIdeas();
                }
              }}
              data-testid="input-scene-brief"
            />
            <Button
              type="button"
              onClick={openIdeas}
              disabled={busy || !cardId || (suggestions.length === 0 && !canReroll)}
              className="shrink-0 h-10 px-4 bg-brand-dark hover:bg-brand text-brand-foreground font-semibold shadow-sm w-full sm:w-auto"
              data-testid="btn-scene-suggest-submit"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="ml-1.5">
                {suggestions.length > 0 ? 'See ideas' : 'Suggest'}
              </span>
            </Button>
          </div>
          <p className="text-[11px] text-keeper-meta">
            A few words steer the ideas — or leave it blank and start
            fresh below.
          </p>
        </div>

      </section>

      {/* ── The other two ways in (Aidan 2026-08-13) ───────────────
          Real cards, equal to each other, deliberately NOT equal to the
          Suggest panel above — the product keeps its opinion about the
          best path while making all three visible. First visit carries a
          one-line guide under each title (studio-hints philosophy,
          localStorage ledger); once any path has been used the captions
          collapse and the buttons compact. "Write my own" disappears
          when the editor is open — its job is done. */}
      <div className="flex flex-col gap-2 sm:flex-row">
        {!editorOpen && (
          <button
            type="button"
            onClick={openEditorToWrite}
            className="flex-1 rounded-xl border border-keeper-hair bg-white p-3.5 text-left shadow-sm hover:border-brand/60 hover:shadow-md hover:-translate-y-px transition-all"
            data-testid="btn-scene-write-own"
          >
            <span className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-muted/60 text-brand-dark">
                <PenLine className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-keeper-ink">
                  Write my own scene
                </span>
                {showPathGuide && (
                  <span className="mt-0.5 block text-xs leading-snug text-keeper-meta">
                    Know the moment already? Type it straight in.
                  </span>
                )}
              </span>
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            markPathUsed();
            setBrainstormOpen(true);
          }}
          className="flex-1 rounded-xl border border-keeper-hair bg-white p-3.5 text-left shadow-sm hover:border-brand/60 hover:shadow-md hover:-translate-y-px transition-all"
          data-testid="btn-scene-ai-help"
        >
          <span className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-muted/60 text-brand-dark">
              <MessageCircle className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-keeper-ink">
                Chat with AI to craft the perfect scene
              </span>
              {showPathGuide && (
                <span className="mt-0.5 block text-xs leading-snug text-keeper-meta">
                  Not sure yet? A quick back-and-forth to find it.
                </span>
              )}
            </span>
          </span>
        </button>
      </div>

      {/* ── Your scene ─────────────────────────────────────────────
          Progressive reveal: an empty editor under the tiles read as a
          second job to do. It appears when a tile is picked (latched
          open from then on) or on request below. Still the single
          convergence point every path lands in. */}
      {editorOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <Label
              htmlFor="scene-description"
              className="whitespace-nowrap text-sm font-semibold text-keeper-ink"
            >
              Your scene
            </Label>
            <span className="text-[11px] text-keeper-meta">
              edit freely — this exact text guides the artwork
            </span>
          </div>
          <Textarea
            ref={textareaRef}
            id="scene-description"
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              // Editing breaks the tie to the tile it came from — the
              // source enum still records it as suggestion_edited.
              setChosenId(null);
              scheduleCommit(e.target.value);
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false);
              commit();
            }}
            placeholder={placeholderText}
            rows={6}
            className="mt-1.5 min-h-[140px] text-base resize-y bg-white border-brand-light focus-visible:border-brand focus-visible:ring-brand/20"
            // aria-live=off so the animated placeholder doesn't spam
            // screen readers with every keystroke-of-text change.
            aria-live="off"
            data-testid="input-scene-description"
          />
          {local.length > 0 && (
            <p className="mt-1 text-[11px] text-keeper-meta">
              {local.length} characters
            </p>
          )}
        </motion.div>
      ) : null}

      {/* ── The picker (Aidan: "the pop up worked well") ───────────
          Choosing happens in a focused frame; the page stays calm.
          Every string here works to make one thing unmissable: picking
          is not committing — the scene lands in an editable box. */}
      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-left">
              {firstName ? `Three scenes for ${firstName}` : 'Three scenes'}
            </DialogTitle>
            <DialogDescription className="text-left">
              Tap one to make it yours — every word stays editable before
              we draw anything.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 mt-1">
            {busy ? (
              <div className="space-y-2" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-[84px] rounded-xl border border-keeper-hair/70 bg-keeper-paper/70 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            ) : (
              suggestions.map((s, i) => {
                const chosen = chosenId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => acceptSuggestion(s)}
                    className={`group block w-full text-left rounded-xl border p-3.5 sm:p-4 transition-all ${
                      chosen
                        ? 'border-brand bg-brand-muted/20 ring-2 ring-brand/25 shadow-md'
                        : 'border-keeper-hair bg-white hover:border-brand/60 hover:shadow-md shadow-sm'
                    }`}
                    data-testid={`scene-suggestion-${s.id}`}
                  >
                    <span className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                          chosen
                            ? 'bg-brand-dark text-brand-foreground'
                            : 'bg-brand-muted/60 text-brand-dark group-hover:bg-brand-muted'
                        }`}
                      >
                        {chosen ? <Check className="w-3.5 h-3.5" /> : String.fromCharCode(65 + i)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[13.5px] leading-relaxed text-keeper-body">
                          {s.text}
                        </span>
                        <span className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-brand-dark opacity-70 group-hover:opacity-100 transition-opacity">
                          <PenLine className="h-3 w-3" />
                          Use &amp; edit
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })
            )}

            <div className="flex items-center justify-between pt-1">
              {canReroll ? (
                <button
                  type="button"
                  onClick={() => suggestMutation.mutate()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-full border border-keeper-hair bg-white px-3 py-1.5 text-xs font-medium text-keeper-body shadow-sm hover:border-brand/60 hover:text-brand-dark transition-colors disabled:opacity-50"
                  data-testid="btn-scene-reroll"
                >
                  <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
                  Show me three more
                </button>
              ) : (
                <span className="text-xs text-keeper-meta">
                  That's our lot — pick one and shape it your way.
                </span>
              )}
              <button
                type="button"
                onClick={() => setSuggestOpen(false)}
                className="text-xs text-keeper-body hover:text-brand-dark underline-offset-4 hover:underline"
              >
                Close
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BrainstormChatDrawer
        open={brainstormOpen}
        onOpenChange={setBrainstormOpen}
        recipientName={state.recipient?.name?.trim() ?? ''}
        occasion={state.recipient?.occasion?.trim() ?? ''}
        currentSceneText={local}
        onAccept={(scene) => {
          // Overwrite the Scene textarea with the accepted scene.
          // Matches the established pattern: every input path ends up
          // in the same textarea (locked product decision).
          setLocal(scene);
          onChange({
            scene: { ...state.scene, description: scene, source: 'brainstorm' },
          });
        }}
      />
    </div>
  );
}

/** Is the Scene step complete enough to move on? */
export function isSceneStepReady(state: CardDraftState): boolean {
  return !!state.scene?.description?.trim();
}
