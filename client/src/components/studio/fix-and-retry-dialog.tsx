// client/src/components/studio/fix-and-retry-dialog.tsx
//
// Focused fix-and-retry surface that opens from the
// <GenerationErrorPanel>'s action chips. Lets the user edit ONE input
// (scene / photo / style) — with the OTHER two visible as "Also using"
// reminders so they can reconsider before retrying — then save and
// retry in a single click.
//
// Replaces the earlier "navigate back into the maker stepper" approach
// (Kevin's call 2026-05-09: "feels weird to go back into the flow
// again — way more sense for this to be a separate UI"). The user is
// not making a card here; they're fixing one input on a card that
// already failed. Different mental model, different UI.
//
// Why "Also using" strip:
//   The user's first instinct ("the scene was the problem") might be
//   wrong. Showing the other potential culprits at the same time gives
//   them a chance to reconsider before burning another attempt. Also
//   one-click switch to a different editor without closing/reopening
//   the dialog.
//
// Scope: scene / photo / style only. These are the three image-
// affecting inputs and the most common failure causes. Front/inside
// text are typography only and rarely the culprit; recipient is
// metadata. If those become real failure causes, extend the editor
// list later.

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Pencil,
  Image as ImageIcon,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import type { CardDraftState } from '@shared/schema';
import { SceneEditor, PhotoEditor } from './input-editors';

// 'style' was a third editor — REMOVED 2026-05-17 when the style
// picker was parked for Celebrait Premium. The StyleEditor component
// still exists in input-editors.tsx for Premium revival. See
// next_celebrait_premium.md.
export type FixAndRetryEditor = 'scene' | 'photo';

export interface FixAndRetryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Which editor opens first — comes from the chip the user clicked. */
  initialEditor: FixAndRetryEditor;
  /** Current draft state — used to pre-fill editors and render the
   *  "Also using" strip. */
  state: CardDraftState;
  /** Apply a partial state patch + fire retry. The parent owns both:
   *  PATCH /api/studio/drafts/:id with the changes, then POST /retry +
   *  start gen. Returns once gen is kicked off. */
  onSaveAndRetry: (patch: Partial<CardDraftState>) => Promise<void>;
  /** True while the save+retry is in flight — disables the CTA. */
  isRetrying?: boolean;
}

const EDITOR_META: Record<FixAndRetryEditor, { label: string; icon: typeof Pencil }> = {
  scene: { label: 'Scene', icon: Pencil },
  photo: { label: 'Photo', icon: ImageIcon },
};

export function FixAndRetryDialog({
  open,
  onOpenChange,
  initialEditor,
  state,
  onSaveAndRetry,
  isRetrying,
}: FixAndRetryDialogProps) {
  const [activeEditor, setActiveEditor] = useState<FixAndRetryEditor>(initialEditor);

  // Pending edits — held locally until "Try again with these" fires.
  // Initial value mirrors the current draft so the user sees what's
  // currently in place; saving only fires the patch if it actually
  // changed (avoids no-op DB writes).
  const [pendingScene, setPendingScene] = useState<string>(state.scene?.description ?? '');
  const [pendingPhotoId, setPendingPhotoId] = useState<number | null>(
    state.photos?.photoIds?.[0] ?? null,
  );
  // Style pending-state REMOVED 2026-05-17 — see EDITOR_META comment.

  // Reset pending state every time the dialog opens with fresh draft
  // data. Avoids stale edits leaking between separate failure events.
  useEffect(() => {
    if (open) {
      setActiveEditor(initialEditor);
      setPendingScene(state.scene?.description ?? '');
      setPendingPhotoId(state.photos?.photoIds?.[0] ?? null);
    }
  }, [open, initialEditor, state]);

  // Local pending flag — set IMMEDIATELY on click for instant visual
  // feedback. The parent's `isRetrying` prop reflects the gen-start
  // state, which only flips true after the save flush + retry POST
  // resolve (100-500ms after click). Without a local flag the button
  // looks unresponsive in that window and users double-click — the
  // second click fires a duplicate /retry against a card that's
  // already non-failed → 409 → dev error overlay.
  const [submitting, setSubmitting] = useState(false);

  const handleRetry = async () => {
    if (submitting || isRetrying) return; // belt-and-braces double-click guard
    setSubmitting(true);
    try {
      // Build a minimal patch — only fields that actually changed.
      // Avoids overwriting unrelated fields with current snapshot.
      const patch: Partial<CardDraftState> = {};

      if (pendingScene.trim() !== (state.scene?.description ?? '').trim()) {
        patch.scene = { ...state.scene, description: pendingScene };
      }

      const currentPhotoId = state.photos?.photoIds?.[0] ?? null;
      if (pendingPhotoId !== null && pendingPhotoId !== currentPhotoId) {
        patch.photos = {
          ...state.photos,
          mode: state.photos?.mode ?? 'one_person',
          photoIds: [pendingPhotoId],
        };
      }

      // Style change block REMOVED 2026-05-17 — style picker parked
      // for Premium. See next_celebrait_premium.md.

      await onSaveAndRetry(patch);
    } finally {
      setSubmitting(false);
    }
  };

  // Combined disabled / spinner state — true if EITHER our local flag
  // OR the parent's gen-start flag is set. Local flag covers the gap
  // between click and gen-start; parent flag covers the gen itself.
  const inFlight = submitting || !!isRetrying;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden bg-keeper-paper">
        {/* Header — neutral chrome. Once the user is in the dialog
            they're editing, not being warned. The red lives back on
            the failure panel; here it's a regular Studio surface with
            just a small "EDITING" eyebrow as the through-line. */}
        <div className="px-6 pt-6 pb-4 border-b border-keeper-hair/80">
          <DialogTitle className="text-lg font-display font-bold tracking-[-0.015em] text-keeper-ink">
            Fix and try again
          </DialogTitle>
          <DialogDescription className="text-sm text-keeper-meta mt-1">
            Edit what you think went wrong. Anything else look off? Switch to
            it before retrying.
          </DialogDescription>
        </div>

        {/* Active editor */}
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] uppercase tracking-[0.18em] text-accent-red-dark font-semibold">
              Editing
            </span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-keeper-ink">
              {(() => {
                const Icon = EDITOR_META[activeEditor].icon;
                return <Icon className="w-3.5 h-3.5 text-accent-red-dark" />;
              })()}
              {EDITOR_META[activeEditor].label}
            </span>
          </div>

          {activeEditor === 'scene' && (
            <SceneEditor value={pendingScene} onChange={setPendingScene} />
          )}
          {activeEditor === 'photo' && (
            <PhotoEditor
              selectedId={pendingPhotoId}
              onSelect={setPendingPhotoId}
            />
          )}
          {/* StyleEditor render block REMOVED 2026-05-17 — style picker
              parked for Premium. See next_celebrait_premium.md. */}
        </div>

        {/* Also using strip */}
        <div className="px-6 pb-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-keeper-meta font-semibold mb-2">
            Also using — could one of these be it?
          </p>
          <div className="grid grid-cols-2 gap-2">
            {(['scene', 'photo'] as FixAndRetryEditor[])
              .filter((e) => e !== activeEditor)
              .map((editor) => (
                <AlsoUsingTile
                  key={editor}
                  editor={editor}
                  state={state}
                  pendingScene={pendingScene}
                  pendingPhotoId={pendingPhotoId}
                  onSwitch={() => setActiveEditor(editor)}
                />
              ))}
          </div>
        </div>

        {/* Footer — neutral, brand-violet CTA. Same studio chrome as
            any other action surface in the app. Disabled state uses
            `inFlight` (local + parent) so the spinner appears the
            moment the user clicks, not after the round-trip. */}
        <div className="px-6 py-4 border-t border-keeper-hair/80 bg-white/40 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={inFlight}
            className="text-keeper-meta hover:text-keeper-ink"
          >
            Back
          </Button>
          <Button
            onClick={() => void handleRetry()}
            disabled={inFlight}
            className="bg-go hover:bg-go-hover text-go-foreground"
            data-testid="fix-and-retry-cta"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${inFlight ? 'animate-spin' : ''}`}
            />
            {inFlight ? 'Trying…' : 'Try again with these'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


// ─── Also using tile ──────────────────────────────────────────────────

function AlsoUsingTile({
  editor,
  state,
  pendingScene,
  pendingPhotoId,
  onSwitch,
}: {
  editor: FixAndRetryEditor;
  state: CardDraftState;
  pendingScene: string;
  pendingPhotoId: number | null;
  onSwitch: () => void;
}) {
  // Use pending values when displayed (so users see their in-progress
  // edits reflected), falling back to draft state.
  let summary = '';
  if (editor === 'scene') {
    const text = pendingScene || state.scene?.description || '';
    summary = text.length > 60 ? text.slice(0, 60) + '…' : text || '(no scene yet)';
  } else if (editor === 'photo') {
    summary =
      pendingPhotoId !== null
        ? `Photo #${pendingPhotoId}`
        : state.photos?.photoIds?.[0]
          ? `Photo #${state.photos.photoIds[0]}`
          : '(no photo selected)';
  }
  // Style branch REMOVED 2026-05-17 — see EDITOR_META comment.

  const Icon = EDITOR_META[editor].icon;
  return (
    <button
      type="button"
      onClick={onSwitch}
      className="text-left px-3 py-2.5 rounded-lg bg-white border border-keeper-hair hover:border-brand/40 hover:bg-brand/5 transition-all group"
      data-testid={`fix-retry-switch-${editor}`}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3 text-keeper-meta" />
        <span className="text-[10px] uppercase tracking-[0.14em] text-keeper-meta font-semibold">
          {EDITOR_META[editor].label}
        </span>
        <ChevronRight className="w-3 h-3 text-stone-300 group-hover:text-brand ml-auto transition-colors" />
      </div>
      <p className="text-xs text-keeper-ink leading-snug truncate">{summary}</p>
    </button>
  );
}
