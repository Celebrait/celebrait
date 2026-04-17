// client/src/components/studio/steps/scene-step.tsx
//
// Step 2: describe the scene that goes on the card front. The editable
// textarea IS the primary input — the Ideas drawer just pre-fills it.
// Per the product brief, every input path ends up in the same textarea
// so users never feel locked into a mode.
//
// The AI help button is a stub in this phase (Sprint 3) and wires up
// the existing brainstorm chat component in a later sprint.

import { useEffect, useRef, useState } from 'react';
import { Sparkles, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { CardDraftState } from '@shared/schema';
import { OCCASION_PRESETS } from '../scene-presets';

interface SceneStepProps {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
}

// Rotate placeholder every N ms (only while the textarea is empty and
// not focused — we don't fight the user once they engage).
const PLACEHOLDER_ROTATE_MS = 3500;

export function SceneStep({ state, onChange }: SceneStepProps) {
  const occasion = state.recipient?.occasion ?? 'other';
  const presetSet = OCCASION_PRESETS[occasion] ?? OCCASION_PRESETS.other;

  // Local textarea value so typing doesn't fire a save per keystroke.
  // Commits on blur. Kept in sync if `state.scene.description` changes
  // from elsewhere (preset fill).
  const [local, setLocal] = useState(state.scene?.description ?? '');
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // External changes (e.g. preset click) should update the textarea.
    if ((state.scene?.description ?? '') !== local) {
      setLocal(state.scene?.description ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scene?.description]);

  // Rotating placeholder index. Only advances while the textarea is
  // empty + unfocused, so we never distract a typing user.
  const [phIndex, setPhIndex] = useState(0);
  useEffect(() => {
    if (local.length > 0 || focused) return;
    const t = setInterval(() => {
      setPhIndex((i) => (i + 1) % presetSet.placeholders.length);
    }, PLACEHOLDER_ROTATE_MS);
    return () => clearInterval(t);
  }, [local.length, focused, presetSet.placeholders.length]);

  const currentPlaceholder = presetSet.placeholders[phIndex] ?? presetSet.placeholders[0];

  const commit = () => {
    const trimmed = local.trim();
    if (trimmed !== (state.scene?.description ?? '')) {
      onChange({ scene: { ...state.scene, description: trimmed } });
    }
  };

  const [ideasOpen, setIdeasOpen] = useState(false);
  const pickPreset = (scene: string) => {
    setLocal(scene);
    onChange({ scene: { ...state.scene, description: scene } });
    setIdeasOpen(false);
    // Focus the textarea with cursor at end so editing feels natural.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(scene.length, scene.length);
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <Label htmlFor="scene-description" className="text-sm">
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
          placeholder={currentPlaceholder}
          rows={5}
          className="text-base resize-none"
          data-testid="input-scene-description"
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-[11px] text-stone-400">
            {local.length > 0 ? `${local.length} characters` : 'Tap an example for a starting point →'}
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
                <Sparkles className="w-4 h-4" />
                AI help
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>Coming soon — brainstorm with AI</TooltipContent>
        </Tooltip>

        <Button
          type="button"
          variant="outline"
          onClick={() => setIdeasOpen(true)}
          className="flex items-center gap-2"
          data-testid="btn-scene-ideas"
        >
          <Lightbulb className="w-4 h-4" />
          Ideas
        </Button>
      </div>

      <IdeasDrawer
        open={ideasOpen}
        onOpenChange={setIdeasOpen}
        presetSet={presetSet}
        onPick={pickPreset}
      />
    </div>
  );
}

function IdeasDrawer({
  open,
  onOpenChange,
  presetSet,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetSet: (typeof OCCASION_PRESETS)[string];
  onPick: (scene: string) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Scene ideas — {presetSet.label}</SheetTitle>
          <SheetDescription>
            Tap a starting point. You can edit it once it's in the box.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-5">
          {presetSet.presets.map((group) => (
            <div key={group.category}>
              <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
                {group.category}
              </div>
              <div className="space-y-1.5">
                {group.scenes.map((scene, i) => (
                  <button
                    key={`${group.category}-${i}`}
                    type="button"
                    onClick={() => onPick(scene)}
                    className="block w-full text-left text-sm px-3 py-2 rounded-lg bg-surface-muted hover:bg-brand-muted hover:text-brand-dark transition-colors"
                    data-testid={`preset-${group.category}-${i}`}
                  >
                    {scene}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Is the Scene step complete enough to move on? */
export function isSceneStepReady(state: CardDraftState): boolean {
  return !!state.scene?.description?.trim();
}
