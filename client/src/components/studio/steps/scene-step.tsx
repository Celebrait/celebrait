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
// TWO CLEAR ROUTES 2026-11-18 (Aidan: "give the user 2 panels to choose
// from that are crystal clear in what each route entails"). The step
// now opens on a chooser: "Give me scene ideas" and "I'll write it
// myself", each listing its three steps. Picking one opens only that
// route's box underneath; you can switch at any time and both still
// land in the same editable "Your scene" box. The first-run captions on
// the old path buttons are gone: the panels say it every time. The chat
// (signed-in only) is a text link under the panels.
//
// Cost is not a constraint here: gpt-4o-mini, ~£0.0005 per set of
// three — 0.24% of a card. Rerolls are UNCAPPED (Aidan 2026-08-13,
// "don't limit the user") — an earlier 3-set cap was a UX-signal idea
// that in practice just told an engaged user no.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { friendlyError } from '@/lib/friendly-error';
import { Loader2, RefreshCw, Check, Sparkles, PenLine, MessageCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useTypewriter } from '@/hooks/use-typewriter';
import { motion } from 'framer-motion';
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

interface SceneStepProps {
  state: CardDraftState;
  onChange: (patch: Partial<CardDraftState>) => void;
  /** Card ID — required for the Scene Helper to hit
   *  /api/studio/scene-suggestions, which needs to validate ownership
   *  + read recipient/occasion/photo context server-side. */
  cardId?: number;
  /** The public photo maker (2026-09-04): no draft yet, so the helper
   *  takes the brief inline via the guest-capped route, and the
   *  brainstorm chat (signed-in only) stays hidden. */
  guest?: boolean;
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
type SceneRoute = 'ideas' | 'write';

/** Rotating examples for the BRIEF. Deliberately fragments, lowercase,
 *  comma-separated — the shape teaches more than any label can: short,
 *  specific, personal, and no need for a sentence. Not occasion-bound;
 *  the brief is about the PERSON, and the occasion is already known. */
const BRIEF_EXAMPLES = [
  'the football, Anfield, always in his kit',
  'her garden, the greenhouse, prize tomatoes',
  'sea swimming, all year round, absolutely mad for it',
  'Strictly, prosecco, dancing round the kitchen',
  'camping in the Lakes, rain or shine',
  'his allotment and that daft spaniel',
  'baking, always flour on her jumper',
];


export function SceneStep({ state, onChange, cardId, guest = false }: SceneStepProps) {
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
  /** Which of the two routes is open. Nothing is preselected on a fresh
   *  step: the panels are the question. Coming back to a scene reopens
   *  the route it was made by. */
  const [route, setRoute] = useState<SceneRoute | null>(() => {
    if (!(state.scene?.description ?? '').trim()) return null;
    return state.scene?.source === 'manual' ? 'write' : 'ideas';
  });
  const ideasRef = useRef<HTMLElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const briefRef = useRef<HTMLTextAreaElement | null>(null);
  const [briefFocused, setBriefFocused] = useState(false);
  /** Brief highlight on the editor after a pick (Aidan 2026-08-15).
   *  The modal closing is a big visual change — the glow tells the eye
   *  WHERE the choice landed instead of leaving them to find it. */
  const [justFilled, setJustFilled] = useState(false);
  const glowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The brief that produced the CURRENT suggestions. "See ideas" only
   *  skips the refetch when the brief hasn't changed — reopening stale
   *  tiles after the user typed a new steer read as "it's broken"
   *  (Aidan 2026-08-13). */
  const lastBriefRef = useRef<string | null>(null);
  // Debounce timer for committing the typed scene to the draft WHILE typing
  // (not only on blur) so "Next" enables as soon as there's text — the user
  // no longer has to click out of the box first. Debounced so the
  // per-change server save (onChange → runSave) doesn't fire per keystroke.
  const commitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  // Rotating examples in the brief — stops while they type or focus.
  const briefPlaceholder = useTypewriter(
    BRIEF_EXAMPLES,
    brief.length === 0 && !briefFocused,
  );

  // One-shot LLM call returning 3 tailored scene paragraphs. Posts to
  // /api/studio/scene-suggestions which reads recipient + occasion +
  // photos from the draft. The `brief` param is optional — empty input
  // still works (server falls back to recipient/occasion alone) but
  // the modal copy nudges the user to give us something.
  const suggestMutation = useMutation({
    onMutate: () => {
      lastBriefRef.current = brief.trim();
    },
    /** `likeThis` = "more like this one" — the user points at the closest
     *  scene instead of retyping their brief. Steering by pointing is the
     *  conversational half of this panel. */
    mutationFn: async (likeThis?: string) => {
      if (!cardId && !guest) throw new Error('Card not ready');
      const r = guest
        ? await apiRequest('POST', '/api/photo/scene-suggestions', {
            recipientName: state.recipient?.name?.trim() ?? '',
            occasion: state.recipient?.occasion?.trim() ?? '',
            photoMode: state.photos?.mode,
            brief: brief.trim() || undefined,
            likeThis: likeThis || undefined,
          })
        : await apiRequest('POST', '/api/studio/scene-suggestions', {
            cardId,
            brief: brief.trim() || undefined,
            likeThis: likeThis || undefined,
          });
      return (await r.json()) as { suggestions: SceneSuggestion[] };
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions ?? []);
    },
    onError: (err: any) => {
      toast({
        title: "Couldn't get suggestions",
        description: friendlyError(
          err,
          guest ? 'You can write your own scene instead.' : 'Write your own, or talk it through with us.',
        ),
        variant: 'destructive',
      });
    },
  });

  const acceptSuggestion = (s: SceneSuggestion) => {
    setSuggestOpen(false);
    setLocal(s.text);
    setChosenId(s.id);
    setEditorOpen(true);
    // Re-picking restarts the glow rather than stacking timers.
    if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
    setJustFilled(true);
    glowTimerRef.current = setTimeout(() => {
      setJustFilled(false);
      glowTimerRef.current = null;
    }, 1900);
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

  const chooseWrite = () => {
    setRoute('write');
    setTimeout(() => textareaRef.current?.focus(), 80);
  };

  /** No autofocus here: the brief's rotating examples only play while it
   *  is empty and unfocused, and they teach the shape better than a
   *  blinking cursor does. Just bring the box into view. */
  const chooseIdeas = () => {
    setRoute('ideas');
    setTimeout(() => ideasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  };

  /** "These aren't it — let me steer differently." Closes the picker
   *  and puts the cursor in the brief, so the retype path is one tap
   *  instead of a guess. Spends nothing. */
  const backToBrief = () => {
    setSuggestOpen(false);
    setRoute('ideas');
    setTimeout(() => briefRef.current?.focus(), 120);
  };

  /** Suggest button / Enter in the brief. Opens the picker; only spends
   *  a set when there's nothing to show yet. */
  const openIdeas = () => {
    if ((!cardId && !guest) || busy) return;
    const briefChanged = brief.trim() !== (lastBriefRef.current ?? '');
    if (suggestions.length === 0 || briefChanged) {
      suggestMutation.mutate(undefined);
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
      if (glowTimerRef.current) clearTimeout(glowTimerRef.current);
    },
    [],
  );

  // Quick-start example chips were removed 2026-04-24 — the scene step
  // is a creativity surface, and pills nudge users toward a template-y
  // output. Free text + Brainstorm the scene are the two paths now.

  const busy = suggestMutation.isPending;
  const firstName = (state.recipient?.name ?? '').trim().split(/\s+/)[0] || '';
  const them = firstName || 'them';
  // The editor shows for the write route, once an idea has been picked,
  // and whenever there is already a scene to edit.
  const showEditor = route === 'write' || editorOpen || local.trim().length > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* ── The choice ─────────────────────────────────────────────
          Two equal panels. Each says who it suits, what it is and the
          three things that happen, so nobody has to guess what a button
          will do. Stacked on phones, ideas first. */}
      <p className="text-sm text-keeper-body">
        Two ways to do this. Pick one, and you can switch at any time.
      </p>
      {/* On phones, once a route is chosen the two panels shrink to a
          side-by-side switch (name + tick only), so the box you just
          opened sits right under your thumb instead of a screen below. */}
      <div
        className={`grid gap-3 sm:grid-cols-2 ${route ? 'grid-cols-2' : ''}`}
        role="group"
        aria-label="How to set the scene"
      >
        <RouteCard
          active={route === 'ideas'}
          compact={route !== null}
          onClick={chooseIdeas}
          icon={<Sparkles className="h-4 w-4" />}
          kicker="Not sure what to put?"
          title="Give me scene ideas"
          steps={[
            `Type a few words about ${them}`,
            'We write three scenes',
            'Pick one and change any word you like',
          ]}
          testId="btn-scene-get-ideas"
        />
        <RouteCard
          active={route === 'write'}
          compact={route !== null}
          onClick={chooseWrite}
          icon={<PenLine className="h-4 w-4" />}
          kicker="Know the moment already?"
          title="I'll write it myself"
          steps={[
            firstName ? `Say where ${firstName} is and what's happening` : "Say where they are and what's happening",
            'Keep it to a sentence or two',
            'We draw the card front from your words',
          ]}
          testId="btn-scene-write-own"
        />
      </div>

      {/* The chat is the one "stuck?" affordance, signed-in only. A link,
          not a third panel: the choice above stays a choice of two. */}
      {!guest && (
        <p className="text-sm text-keeper-body">
          Can't decide?{' '}
          <button
            type="button"
            onClick={() => setBrainstormOpen(true)}
            className="inline-flex items-center gap-1 font-semibold text-brand-dark underline-offset-4 hover:underline"
            data-testid="btn-scene-ai-help"
          >
            <MessageCircle className="h-3.5 w-3.5" />
            Chat it through with us
          </button>
        </p>
      )}

      {/* ── Route 1: ideas ─────────────────────────────────────────
          The brief steers, the picker answers. Tinted ground so it reads
          as belonging to the selected panel above. */}
      {route === 'ideas' && (
        <motion.section
          ref={ideasRef}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="rounded-2xl border border-brand/15 bg-gradient-to-b from-brand-muted/40 via-brand-muted/15 to-brand-muted/5 p-4 sm:p-5 space-y-2"
          data-testid="scene-suggestions"
        >
          <Label htmlFor="scene-brief" className="text-sm font-semibold text-keeper-ink">
            A few words about {them}
          </Label>
          {/* Stacks under 640px — side-by-side crushed the input to
              three visible words, and the brief is the steering wheel. */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Textarea
              ref={briefRef}
              id="scene-brief"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              onFocus={() => setBriefFocused(true)}
              onBlur={() => setBriefFocused(false)}
              // Rotating fragments type themselves out while the field is
              // empty and unfocused — showing the SHAPE of a good brief
              // beats describing it (Aidan 2026-08-14).
              placeholder={briefPlaceholder}
              rows={2}
              className="flex-1 min-w-0 resize-none bg-white text-[15px] border-keeper-hair focus-visible:border-brand focus-visible:ring-brand/20"
              onKeyDown={(e) => {
                // Enter submits (this is a short brief, not prose);
                // Shift+Enter still makes a newline for anyone who wants one.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  openIdeas();
                }
              }}
              aria-live="off"
              data-testid="input-scene-brief"
            />
            <Button
              type="button"
              onClick={openIdeas}
              disabled={busy || (!cardId && !guest)}
              className="shrink-0 h-10 px-4 bg-brand-dark hover:bg-brand text-brand-foreground font-semibold shadow-sm w-full sm:w-auto"
              data-testid="btn-scene-suggest-submit"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span className="ml-1.5">
                {suggestions.length > 0 ? 'See ideas' : 'Show me ideas'}
              </span>
            </Button>
          </div>
          {/* Responds to what they've done, so the panel feels like a
              conversation rather than a form: encouragement when empty,
              acknowledgement once they've typed. */}
          <p className="text-xs text-keeper-meta">
            {brief.trim().length === 0
              ? "Even one word helps. We'll turn it into three scenes. Or just hit the button and we'll start you off."
              : brief.trim().length < 12
                ? "Good start. Add another detail or two and they'll sound more like them."
                : "That's plenty to work with."}
          </p>
        </motion.section>
      )}

      {/* ── Your scene ─────────────────────────────────────────────
          Where both routes land. Open straight away on the write route;
          on the ideas route it appears once a scene has been picked, so
          an empty box never reads as a second job to do. */}
      {showEditor ? (
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
            <span className="text-xs text-keeper-meta">
              {route === 'write' && local.trim().length === 0
                ? 'a sentence or two is plenty'
                : 'edit freely, this exact text guides the artwork'}
            </span>
          </div>
          <Textarea
            ref={textareaRef}
            id="scene-description"
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              // Once there is a scene, the box stays for the rest of the visit.
              if (e.target.value.trim()) setEditorOpen(true);
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
            // The typed-out examples stop on focus (they'd fight the
            // cursor). The write route focuses the box straight away, so
            // hold one still example there rather than a blank box.
            placeholder={
              focused && local.length === 0 && placeholders[0]
                ? `For example: ${placeholders[0]}`
                : placeholderText
            }
            rows={6}
            className={`mt-1.5 min-h-[140px] text-base resize-y bg-white focus-visible:border-brand focus-visible:ring-brand/20 transition-all duration-500 ${
              justFilled
                ? 'border-brand ring-4 ring-brand/30 shadow-lg shadow-brand/20'
                : 'border-brand-light'
            }`}
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
              Tap one to make it yours. Every word stays editable before
              we draw anything.
            </DialogDescription>
          </DialogHeader>

          {/* What steered these — and the one-tap path to steer
              differently. Without this, "wrong direction" only had
              reroll (same brief, wasted set) or a cold Close. */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-keeper-meta">
            {brief.trim() ? (
              <>
                <span className="truncate max-w-[75%]">
                  From your words: &ldquo;{brief.trim()}&rdquo;
                </span>
                <button
                  type="button"
                  onClick={backToBrief}
                  className="font-medium text-brand-dark underline-offset-4 hover:underline"
                  data-testid="btn-scene-change-brief"
                >
                  Change them
                </button>
              </>
            ) : (
              <>
                <span>Going off the occasion alone.</span>
                <button
                  type="button"
                  onClick={backToBrief}
                  className="font-medium text-brand-dark underline-offset-4 hover:underline"
                  data-testid="btn-scene-change-brief"
                >
                  Add a few words to sharpen them
                </button>
              </>
            )}
          </div>

          <div className="space-y-2 mt-1">
            {busy ? (
              // Placeholder tiles with a working wheel in each — the
              // bare pulse boxes read as dead space on the white modal
              // (Aidan 2026-08-13).
              <div className="space-y-2" aria-hidden>
                <p className="text-xs text-keeper-meta">
                  Sketching three ideas…
                </p>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex h-[84px] items-center justify-center rounded-xl border border-keeper-hair bg-keeper-paper/80 animate-pulse"
                    style={{ animationDelay: `${i * 150}ms` }}
                  >
                    <Loader2 className="h-5 w-5 animate-spin text-brand/70" />
                  </div>
                ))}
              </div>
            ) : (
              suggestions.map((s, i) => {
                const chosen = chosenId === s.id;
                return (
                  <div
                    key={s.id}
                    className={`group rounded-xl border transition-all ${
                      chosen
                        ? 'border-brand bg-brand-muted/20 ring-2 ring-brand/25 shadow-md'
                        : 'border-keeper-hair bg-white hover:border-brand/60 hover:shadow-md shadow-sm'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => acceptSuggestion(s)}
                      className="block w-full text-left p-3.5 sm:p-4 pb-2"
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
                    {/* Steer by pointing rather than retyping — the whole
                        point of "more like this". Sibling of the main
                        button, never nested inside it. */}
                    <div className="px-3.5 sm:px-4 pb-3 pl-[3.4rem]">
                      <button
                        type="button"
                        onClick={() => suggestMutation.mutate(s.text)}
                        disabled={busy}
                        className="text-[11px] text-keeper-meta hover:text-brand-dark underline-offset-4 hover:underline disabled:opacity-50"
                        data-testid={`scene-more-like-${s.id}`}
                      >
                        More like this →
                      </button>
                    </div>
                  </div>
                );
              })
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => suggestMutation.mutate(undefined)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full border border-keeper-hair bg-white px-3 py-1.5 text-xs font-medium text-keeper-body shadow-sm hover:border-brand/60 hover:text-brand-dark transition-colors disabled:opacity-50"
                data-testid="btn-scene-reroll"
              >
                <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
                Show me three more
              </button>
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

/** One of the two routes on the chooser. A single big button: the
 *  situation it suits, the route's name, the three things that happen,
 *  and whether it is the one that's open. Spans, not a list, because a
 *  button may only hold phrasing content. */
function RouteCard({
  active,
  compact,
  onClick,
  icon,
  kicker,
  title,
  steps,
  testId,
}: {
  active: boolean;
  /** Phones only: name and tick, no steps. Wider screens always show it all. */
  compact: boolean;
  onClick: () => void;
  icon: ReactNode;
  kicker: string;
  title: string;
  steps: string[];
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid={testId}
      className={`group flex h-full flex-col rounded-2xl border text-left transition-all sm:p-5 ${
        compact ? 'p-3' : 'p-4'
      } ${
        active
          ? 'border-brand bg-brand-muted/50 ring-2 ring-brand/25 shadow-md'
          : 'border-keeper-hair bg-white shadow-sm hover:-translate-y-px hover:border-brand/60 hover:shadow-md'
      }`}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-dark">
          {icon}
        </span>
        <span
          aria-hidden
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            active ? 'border-brand-dark bg-brand-dark text-brand-foreground' : 'border-keeper-hair bg-white group-hover:border-brand/60'
          }`}
        >
          {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
        </span>
      </span>
      <span className={`mt-3 text-xs font-semibold uppercase tracking-wider text-brand-dark ${compact ? 'hidden sm:block' : 'block'}`}>
        {kicker}
      </span>
      <span className={`block font-semibold leading-snug text-keeper-ink sm:mt-1 sm:text-lg ${compact ? 'mt-2.5 text-[15px]' : 'mt-1 text-lg'}`}>
        {title}
      </span>
      <span className={`mt-3 flex-col gap-2 ${compact ? 'hidden sm:flex' : 'flex'}`}>
        {steps.map((step, i) => (
          <span key={i} className="flex items-start gap-2.5 text-sm leading-snug text-keeper-body">
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-light text-[11px] font-bold text-brand-dark">
              {i + 1}
            </span>
            <span>{step}</span>
          </span>
        ))}
      </span>
      <span className={`mt-auto pt-4 text-sm font-semibold text-brand-dark ${compact ? 'hidden sm:block' : 'block'}`}>
        {active ? 'Selected' : 'Choose this'}
      </span>
    </button>
  );
}

/** Is the Scene step complete enough to move on? */
export function isSceneStepReady(state: CardDraftState): boolean {
  return !!state.scene?.description?.trim();
}
