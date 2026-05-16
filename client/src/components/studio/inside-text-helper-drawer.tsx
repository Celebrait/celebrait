// client/src/components/studio/inside-text-helper-drawer.tsx
//
// "Help me write this" drawer for the inside-card message step.
//
// Opened by a small CTA next to the inside-message textarea. Renders
// 3 LLM-generated suggestions (sincere / playful / brief) grounded
// in the card's recipient, occasion, scene description, photo
// summaries, and style choice. The user clicks a suggestion to drop
// it into the textarea (which then becomes editable as normal).
//
// Tabs:
//   - "Fresh ideas" — generate three new suggestions from card context
//   - "Adapt mine"  — paste their draft, AI returns three tightened
//                     variations that preserve their voice
//
// Controls under the suggestions:
//   - "More options" → re-roll across all three tones
//   - Tone chips     → narrow the next re-roll to one tone
//   - Close X        → dismiss
//
// Drawer pattern mirrors BrainstormChatDrawer (same Sheet from
// /components/ui/sheet, same right-side slide, same width). Keeps
// the Studio's spatial language consistent.

import { useState } from 'react';
import { Sparkles, Loader2, Pencil, RefreshCw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { apiRequest } from '@/lib/queryClient';

interface InsideTextSuggestion {
  text: string;
  toneLabel: 'sincere' | 'playful' | 'brief';
  lengthCategory: 'short' | 'medium' | 'longer';
}

type Tone = 'sincere' | 'playful' | 'brief';

interface InsideTextHelperDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Card ID — the server pulls all context from the draft itself
   *  (recipient, occasion, scene, photo summaries, style). */
  cardId: number;
  /** Called when the user picks a suggestion. Should drop into the
   *  inside-message textarea and close the drawer. */
  onAccept: (text: string) => void;
  /** Current value of the inside-message textarea — used as the
   *  starting point for the "Adapt mine" tab. */
  currentText: string;
}

const TONE_LABELS: Record<Tone, string> = {
  sincere: 'Sincere',
  playful: 'Playful',
  brief: 'Brief',
};

const TONE_COLOURS: Record<Tone, string> = {
  sincere: 'bg-accent-coral-light text-accent-coral-dark',
  playful: 'bg-accent-amber-light text-accent-amber-dark',
  brief: 'bg-brand-muted text-brand-dark',
};

export function InsideTextHelperDrawer({
  open,
  onOpenChange,
  cardId,
  onAccept,
  currentText,
}: InsideTextHelperDrawerProps) {
  const [mode, setMode] = useState<'fresh' | 'adapt'>('fresh');
  const [suggestions, setSuggestions] = useState<InsideTextSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [narrowTone, setNarrowTone] = useState<Tone | null>(null);
  const [adaptDraft, setAdaptDraft] = useState(currentText);

  const generate = async (opts: {
    tone?: Tone;
    adaptFrom?: string;
  } = {}) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiRequest('POST', '/api/studio/inside-text/suggest', {
        cardId,
        tone: opts.tone,
        adaptFrom: opts.adaptFrom,
      });
      const data = (await res.json()) as { suggestions: InsideTextSuggestion[] };
      setSuggestions(data.suggestions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFreshGenerate = () => {
    setMode('fresh');
    void generate({ tone: narrowTone ?? undefined });
  };

  const handleAdaptGenerate = () => {
    if (!adaptDraft.trim()) {
      setError('Type or paste a draft above first.');
      return;
    }
    setMode('adapt');
    void generate({ adaptFrom: adaptDraft.trim() });
  };

  const handlePick = (text: string) => {
    onAccept(text);
    onOpenChange(false);
    // Reset for next open
    setSuggestions([]);
    setNarrowTone(null);
    setError(null);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-stone-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-muted flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-brand" strokeWidth={1.75} />
            </div>
            <SheetTitle className="text-lg">Help me write this</SheetTitle>
          </div>
          <SheetDescription className="text-sm text-ink-soft">
            Pick a starting point, then edit freely. Each suggestion is grounded
            in your card's context.
          </SheetDescription>

          {/* Mode tabs */}
          <div className="flex gap-1 pt-2">
            <button
              type="button"
              onClick={() => setMode('fresh')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'fresh'
                  ? 'bg-ink text-white'
                  : 'bg-stone-100 text-ink-soft hover:bg-stone-200'
              }`}
              data-testid="tab-fresh"
            >
              Fresh ideas
            </button>
            <button
              type="button"
              onClick={() => setMode('adapt')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                mode === 'adapt'
                  ? 'bg-ink text-white'
                  : 'bg-stone-100 text-ink-soft hover:bg-stone-200'
              }`}
              data-testid="tab-adapt"
            >
              Adapt mine
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {mode === 'adapt' && (
            <div className="mb-5">
              <label className="text-xs font-medium text-ink-soft uppercase tracking-wider mb-2 block">
                Your draft
              </label>
              <Textarea
                value={adaptDraft}
                onChange={(e) => setAdaptDraft(e.target.value)}
                placeholder="Type or paste what you've got so far…"
                className="min-h-[100px] text-sm"
                data-testid="textarea-adapt-draft"
              />
              <Button
                onClick={handleAdaptGenerate}
                disabled={isLoading || !adaptDraft.trim()}
                className="mt-2 w-full bg-brand hover:bg-brand-dark text-brand-foreground"
                size="sm"
                data-testid="btn-adapt-generate"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Tightening…
                  </>
                ) : (
                  <>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" />
                    Tighten my draft
                  </>
                )}
              </Button>
            </div>
          )}

          {mode === 'fresh' && (
            <div className="mb-5">
              {/* Tone narrowing chips — sets the next re-roll's tone */}
              <label className="text-xs font-medium text-ink-soft uppercase tracking-wider mb-2 block">
                Tone {narrowTone ? '(narrowed)' : '(all three)'}
              </label>
              <div className="flex flex-wrap gap-1.5 mb-3">
                <button
                  type="button"
                  onClick={() => setNarrowTone(null)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    narrowTone === null
                      ? 'bg-ink text-white'
                      : 'bg-stone-100 text-ink-soft hover:bg-stone-200'
                  }`}
                  data-testid="chip-tone-all"
                >
                  All tones
                </button>
                {(['sincere', 'playful', 'brief'] as Tone[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNarrowTone(t)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                      narrowTone === t
                        ? 'bg-ink text-white'
                        : 'bg-stone-100 text-ink-soft hover:bg-stone-200'
                    }`}
                    data-testid={`chip-tone-${t}`}
                  >
                    {TONE_LABELS[t]}
                  </button>
                ))}
              </div>
              <Button
                onClick={handleFreshGenerate}
                disabled={isLoading}
                className="w-full bg-brand hover:bg-brand-dark text-brand-foreground"
                size="sm"
                data-testid="btn-generate-fresh"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Writing…
                  </>
                ) : suggestions.length === 0 ? (
                  <>
                    <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                    Show me three ideas
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    More options
                  </>
                )}
              </Button>
            </div>
          )}

          {error && (
            <div
              className="mb-4 rounded-lg bg-accent-red/10 border border-accent-red/30 px-3 py-2 text-xs text-accent-red"
              data-testid="error-inside-helper"
            >
              {error}
            </div>
          )}

          {/* Suggestion cards */}
          {suggestions.length > 0 && (
            <div className="space-y-3" data-testid="suggestions-list">
              <p className="text-xs text-ink-soft">
                Click a card to use it. You can edit freely after.
              </p>
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handlePick(s.text)}
                  className="w-full text-left bg-white border border-stone-200 rounded-xl p-4 hover:border-brand hover:shadow-sm transition-all group"
                  data-testid={`suggestion-${i}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded ${TONE_COLOURS[s.toneLabel]}`}
                    >
                      {TONE_LABELS[s.toneLabel]} · {s.lengthCategory}
                    </span>
                    <Check
                      className="w-3.5 h-3.5 text-stone-300 group-hover:text-cta-hover transition-colors"
                      strokeWidth={2.5}
                    />
                  </div>
                  <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">
                    {s.text}
                  </p>
                </button>
              ))}
            </div>
          )}

          {/* Empty initial state — when nothing's loaded yet */}
          {suggestions.length === 0 && !isLoading && mode === 'fresh' && (
            <div className="text-center py-8">
              <Sparkles
                className="w-8 h-8 text-stone-300 mx-auto mb-2"
                strokeWidth={1.5}
              />
              <p className="text-sm text-ink-soft">
                Three suggestions, one click away. I'll use everything you've
                already told the card — recipient, occasion, scene — to make
                them specific to you.
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
