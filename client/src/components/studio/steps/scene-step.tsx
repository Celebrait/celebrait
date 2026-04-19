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
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { CardDraftState } from '@shared/schema';
import { OCCASION_PRESETS } from '../scene-presets';

interface SceneStepProps {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
}

// How long between placeholder phrases (after one finishes typing).
const PLACEHOLDER_PAUSE_MS = 2500;
// Type speed — per character. Slightly varies feel for natural rhythm.
const TYPE_CHAR_MS = 45;
// Backspace speed — faster than typing so the loop doesn't drag.
const BACKSPACE_CHAR_MS = 20;

export function SceneStep({ state, onChange }: SceneStepProps) {
  const occasion = state.recipient?.occasion ?? 'other';
  const presetSet = OCCASION_PRESETS[occasion] ?? OCCASION_PRESETS.other;

  // Local textarea value so typing doesn't fire a save per keystroke.
  // Commits on blur. Kept in sync if `state.scene.description` changes
  // from elsewhere.
  const [local, setLocal] = useState(state.scene?.description ?? '');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <Label htmlFor="scene-description" className="text-sm text-ink">
          What's happening in the scene?
        </Label>
        <p className="text-xs text-stone-500 mt-1 mb-2">
          Describe the moment — who, where, what they're doing. Specific beats
          generic.
        </p>
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
          className="text-base resize-none"
          // aria-live=off so the animated placeholder doesn't spam
          // screen readers with every keystroke-of-text change.
          aria-live="off"
          data-testid="input-scene-description"
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-[11px] text-stone-400">
            {local.length > 0
              ? `${local.length} characters`
              : 'Stuck? Try the AI helper below →'}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                type="button"
                variant="outline"
                disabled
                className="flex items-center gap-2"
                data-testid="btn-scene-ai-help"
              >
                <Sparkles className="w-4 h-4 text-accent-amber" />
                Brainstorm with AI
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Coming soon — chat through ideas with the AI</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

/** Is the Scene step complete enough to move on? */
export function isSceneStepReady(state: CardDraftState): boolean {
  return !!state.scene?.description?.trim();
}
