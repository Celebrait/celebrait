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
// AI help is a stub in this phase — wiring the brainstorm chat is a
// 3.7b deliverable. The old Ideas drawer is gone: we decided (2026-04-19)
// that two helper paths split attention; AI help is the single "stuck?"
// affordance once it's live.

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Wand2, Loader2, RefreshCw, ArrowRight } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
import { StepExample } from '@/components/studio/step-example';

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

export function SceneStep({ state, onChange, cardId }: SceneStepProps) {
  const occasion = state.recipient?.occasion ?? 'other';
  const presetSet = OCCASION_PRESETS[occasion] ?? OCCASION_PRESETS.other;

  // Local textarea value so typing doesn't fire a save per keystroke.
  // Commits on blur. Kept in sync if `state.scene.description` changes
  // from elsewhere.
  const [local, setLocal] = useState(state.scene?.description ?? '');
  const [focused, setFocused] = useState(false);
  const [brainstormOpen, setBrainstormOpen] = useState(false);
  // Scene Helper modal — opens when user clicks "Suggest scenes". The
  // modal takes a quick brief from the user (1-2 sentence idea) and
  // shows three tile suggestions; tap a tile to fill the main textarea
  // and close. Modal-based instead of inline because the prompt-and-pick
  // pattern needs an explicit ask: clicking a button without any input
  // field made it unclear that user input was the lever.
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [brief, setBrief] = useState('');
  const [suggestions, setSuggestions] = useState<SceneSuggestion[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
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
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't get suggestions",
        description: err?.message ?? 'Try again, or use the Brainstorm chat.',
        variant: 'destructive',
      });
    },
  });

  const openSuggestModal = () => {
    // Pre-fill the brief with whatever's in the textarea (if anything)
    // so the user can tweak rather than retype. They can also blank it.
    setBrief(local.trim());
    setSuggestions([]);
    setSuggestOpen(true);
  };

  const acceptSuggestion = (text: string) => {
    setLocal(text);
    onChange({ scene: { ...state.scene, description: text } });
    setSuggestOpen(false);
    // Reset for next open
    setSuggestions([]);
    setBrief('');
  };

  useEffect(() => {
    // External changes (e.g. preset fill from future brainstorm-chat)
    // should update the textarea.
    if ((state.scene?.description ?? '') !== local) {
      setLocal(state.scene?.description ?? '');
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
    const trimmed = local.trim();
    if (trimmed !== (state.scene?.description ?? '')) {
      onChange({ scene: { ...state.scene, description: trimmed } });
    }
  };

  // Quick-start example chips were removed 2026-04-24 — the scene step
  // is a creativity surface, and pills nudge users toward a template-y
  // output. Free text + Brainstorm the scene are the two paths now.

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <Label htmlFor="scene-description" className="sr-only">
          Scene description
        </Label>
        {/* House-style example — the front-of-card picture, front-on. The
            guidance that used to sit inline (who's there, where, doing what)
            now lives in the module's description. */}
        <div className="mb-3">
          <StepExample
            eyebrow="Front Scene Example"
            assist="Not sure what to describe?"
            modalTitle="Front scene example"
            modalDescription="The front of the card is the picture — who's there, where they are, what they're doing. Describe the moment and we'll bring it to life in this style."
            show="front"
          />
        </div>
        <Textarea
          ref={textareaRef}
          id="scene-description"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            commit();
          }}
          placeholder={placeholderText}
          rows={5}
          className="text-base resize-none border-brand-light focus-visible:border-brand focus-visible:ring-brand/20"
          // aria-live=off so the animated placeholder doesn't spam
          // screen readers with every keystroke-of-text change.
          aria-live="off"
          data-testid="input-scene-description"
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-[11px] text-keeper-meta">
            {local.length > 0
              ? `${local.length} characters`
              : "Not sure? Brainstorm it with us."}
          </p>
        </div>
      </div>

      {/* Two helpers — escalating depth.
            Suggest scenes (left): one-shot modal — user types a quick
            brief, gets three tile suggestions to pick from.
            Brainstorm (right): multi-turn drawer for a real chat.
            Both buttons sized up + visually filled by default
            (2026-04-27, Kevin: "make it look like the hover state") so
            they read as real CTAs, not afterthoughts. The brainstorm
            button is the headline action — bg-brand-dark by default
            with a soft brand glow so it carries the eye. */}
      <div className="flex flex-wrap gap-2.5">
        <Button
          type="button"
          onClick={openSuggestModal}
          disabled={!cardId}
          size="lg"
          className="h-11 flex items-center gap-2 bg-brand-muted hover:bg-brand-muted/80 text-brand-dark border border-brand/40 shadow-sm hover:shadow"
          data-testid="btn-scene-suggest"
        >
          <Wand2 className="w-4 h-4" />
          <span className="font-semibold">Suggest scenes</span>
        </Button>
        <Button
          type="button"
          onClick={() => setBrainstormOpen(true)}
          size="lg"
          className="h-11 flex items-center gap-2 bg-brand-dark hover:bg-brand text-brand-foreground shadow-md shadow-brand/20 hover:shadow-lg hover:shadow-brand/30 transition-shadow"
          data-testid="btn-scene-ai-help"
        >
          <Sparkles className="w-4 h-4" />
          <span className="font-semibold">Brainstorm the scene</span>
        </Button>
      </div>

      {/* Scene Helper modal — brief input → tiles → pick → close.
          Lives here (vs a sibling component) because the state it
          manipulates (local + onChange) lives in this scope. */}
      <Dialog
        open={suggestOpen}
        onOpenChange={(o) => {
          setSuggestOpen(o);
          if (!o) {
            // Reset on close so reopening starts fresh
            setSuggestions([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-left">
              Suggest scenes
            </DialogTitle>
            <DialogDescription className="text-left">
              Give us a quick idea — even two or three words is enough.
              We'll spin up three scenes you can tap to use.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-1">
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="e.g. Mum at the beach at sunset, or just 'something autumnal'"
              rows={3}
              className="text-base resize-none"
              autoFocus
              onKeyDown={(e) => {
                // Cmd/Ctrl+Enter submits — saves a click for keyboard users
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  if (!suggestMutation.isPending) suggestMutation.mutate();
                }
              }}
              data-testid="input-scene-brief"
            />
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-keeper-meta">
                Optional — leave blank for surprise.
              </p>
              <Button
                type="button"
                onClick={() => suggestMutation.mutate()}
                disabled={suggestMutation.isPending || !cardId}
                className="flex items-center gap-1.5 bg-go hover:bg-go-hover text-brand-foreground"
                data-testid="btn-scene-suggest-submit"
              >
                {suggestMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                {suggestMutation.isPending
                  ? 'Thinking…'
                  : suggestions.length > 0
                    ? 'Try again'
                    : 'Get suggestions'}
              </Button>
            </div>

            {/* Tiles render inside the modal once we have results. Tap
                a tile to fill the main textarea and close. */}
            <AnimatePresence>
              {suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                  className="space-y-2 pt-2 border-t border-keeper-hair"
                  data-testid="scene-suggestions"
                >
                  <p className="text-xs uppercase tracking-wider text-keeper-meta font-medium pt-3">
                    Tap one to use it
                  </p>
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => acceptSuggestion(s.text)}
                      className="block w-full text-left rounded-xl border border-keeper-hair bg-white hover:border-brand hover:bg-brand-muted/30 transition-all p-4 text-sm text-keeper-ink leading-relaxed shadow-sm hover:shadow"
                      data-testid={`scene-suggestion-${s.id}`}
                    >
                      {s.text}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => suggestMutation.mutate()}
                    disabled={suggestMutation.isPending}
                    className="inline-flex items-center gap-1.5 text-xs text-keeper-body hover:text-brand-dark underline-offset-4 hover:underline disabled:opacity-50 pt-1"
                    data-testid="btn-scene-reroll"
                  >
                    <RefreshCw
                      className={`w-3 h-3 ${suggestMutation.isPending ? 'animate-spin' : ''}`}
                    />
                    Try another three
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
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
          onChange({ scene: { ...state.scene, description: scene } });
        }}
      />
    </div>
  );
}

/** Is the Scene step complete enough to move on? */
export function isSceneStepReady(state: CardDraftState): boolean {
  return !!state.scene?.description?.trim();
}
