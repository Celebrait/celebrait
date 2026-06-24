// client/src/pages/chat-studio.tsx
//
// PROTOTYPE (/studio-chat) — the full studio creation flow as a chat + canvas
// experience, mirroring the real maker (see memory next_chat_canvas_studio).
// Selector pills render INLINE in the thread under the bot's message (like the
// studio brainstorm chat); only free text sits in the footer composer. The
// scene step offers BOTH real helpers, each with its own conversational flow:
//   • "Suggest scenes" — type a rough brief → 3 options → pick or re-roll
//   • "Brainstorm"      — a guided multi-turn that drafts a scene to refine/use
// Generation is STUBBED (sample renders + keyword refine). Real endpoints get
// wired if the feel holds. The real studio + landing are untouched.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles, Send, Loader2, Check, ArrowRight, Upload, X, RefreshCw, Wand2,
} from 'lucide-react';
import { Link } from 'wouter';
import frontImg from '@/assets/hero-card-front.png';
import insideImg from '@/assets/hero-card-inside.png';

/* ───────────── draft model (mirrors CardDraftState) ───────────── */
interface Draft {
  name: string;
  occasion: string;
  photoMode: 'one_person' | 'group';
  photos: string[];
  scene: string;
  front: { mode: 'write' | 'none'; text: string };
  inside: { mode: 'write' | 'blank'; message: string };
  delivery: { format?: 'digital' | 'printed' | 'both'; destination?: 'recipient' | 'sender' };
}
const EMPTY_DRAFT: Draft = {
  name: '', occasion: '', photoMode: 'one_person', photos: [], scene: '',
  front: { mode: 'write', text: '' }, inside: { mode: 'write', message: '' }, delivery: {},
};

/* ───────────── helpers ───────────── */
const OCCASIONS = [
  { key: 'birthday', label: 'Birthday' }, { key: 'anniversary', label: 'Anniversary' },
  { key: 'wedding', label: 'Wedding' }, { key: 'graduation', label: 'Graduation' },
  { key: 'engagement', label: 'Engagement' }, { key: 'newbaby', label: 'New baby' },
];
const OCC_PHRASE: Record<string, string> = {
  birthday: 'Happy Birthday', anniversary: 'Happy Anniversary', wedding: 'Congratulations',
  graduation: 'Congratulations', engagement: 'Congratulations', newbaby: 'Congratulations',
};
function labelFor(occ: string): string {
  return OCCASIONS.find((o) => o.key === occ)?.label.toLowerCase() ?? occ;
}
function defaultFront(d: Draft): string {
  const phrase = OCC_PHRASE[d.occasion] ?? `Happy ${d.occasion}`;
  return d.name ? `${phrase}, ${d.name}` : phrase;
}
const MAX_PHOTOS = { one_person: 5, group: 1 } as const;

const SCENE_SCAFFOLDS = [
  (who: string, place: string) => `${who} ${place}, bathed in golden-hour light, mid-laugh`,
  (who: string, place: string) => `${who} ${place} at dusk — candlelit and warm`,
  (who: string, place: string) => `${who} ${place} in soft morning light, flowers everywhere`,
  (who: string, place: string) => `${who} ${place} under string lights, glasses raised`,
  (who: string, place: string) => `${who} ${place}, the city glowing behind them`,
  (who: string, place: string) => `${who} ${place} on a quiet evening, just the two of them`,
];
function defaultPlace(occ: string): string {
  return (
    { birthday: 'at a rooftop party', anniversary: 'on a candlelit terrace', wedding: 'in a sunlit garden', graduation: 'on campus, caps in the air' } as Record<string, string>
  )[occ] || 'somewhere they love';
}
function makeSuggestions(brief: string, d: Draft, salt: number): string[] {
  const who = d.name || 'They';
  const raw = brief && !/surprise/i.test(brief) ? brief.trim() : defaultPlace(d.occasion);
  const place = /^(on|in|at|by|under|beside|near)\b/i.test(raw) ? raw : `at ${raw}`;
  const start = (salt * 3) % SCENE_SCAFFOLDS.length;
  return [0, 1, 2].map((i) => SCENE_SCAFFOLDS[(start + i) % SCENE_SCAFFOLDS.length](who, place));
}
function refineFilter(text: string): string {
  const t = text.toLowerCase();
  if (/sunset|warm|gold|orange|amber|autumn|cosy|cozy/.test(t)) return 'saturate(1.25) sepia(0.22) hue-rotate(-12deg) brightness(1.05)';
  if (/cool|blue|night|moon|cold|wintry/.test(t)) return 'saturate(1.05) hue-rotate(16deg) brightness(0.95)';
  if (/bright|vibrant|pop|vivid|bold/.test(t)) return 'saturate(1.5) brightness(1.07)';
  if (/soft|dream|pastel|gentle|romantic/.test(t)) return 'saturate(0.9) brightness(1.07) contrast(0.94)';
  if (/dark|moody|dramatic/.test(t)) return 'saturate(1.1) brightness(0.82) contrast(1.12)';
  return 'saturate(1.18) brightness(1.03)';
}

/* ───────────── chat types ───────────── */
type Role = 'bot' | 'user';
interface Msg { id: number; role: Role; text: string }
interface Chip { label: string; value: string; kind?: 'primary' | 'ghost' | 'option' }
type Phase =
  | 'name' | 'occasion' | 'photoMode' | 'photo'
  | 'scene' | 'sceneBrief' | 'scenePick'
  | 'bsWhere' | 'bsDoing' | 'bsMood' | 'bsConfirm' | 'bsTweak'
  | 'frontText' | 'insideFork' | 'insideMessage'
  | 'review' | 'generating' | 'reveal'
  | 'givingFormat' | 'givingDestination' | 'done';
type CanvasMode = 'empty' | 'photo' | 'generating' | 'card' | 'giving';
let nextId = 1;

export default function ChatStudio() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [phase, setPhase] = useState<Phase>('name');
  const [chips, setChips] = useState<Chip[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [canvas, setCanvas] = useState<CanvasMode>('empty');
  const [filter, setFilter] = useState('none');
  const [cardSide, setCardSide] = useState<'front' | 'inside'>('front');
  const [genStage, setGenStage] = useState(0);
  const [revKey, setRevKey] = useState(0);
  const [brief, setBrief] = useState('');
  const [reroll, setReroll] = useState(0);
  const [bs, setBs] = useState<{ where?: string; doing?: string; mood?: string }>({});
  const threadRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const push = (role: Role, text: string) => setMessages((m) => [...m, { id: nextId++, role, text }]);
  const bot = (text: string, after?: () => void, delay = 650) => {
    setTyping(true);
    window.setTimeout(() => { setTyping(false); push('bot', text); after?.(); }, delay);
  };
  const up = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => { bot("Hi — I'm your card-maker. Let's make something they'll keep. Who's this card for?"); }, []); // eslint-disable-line
  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, typing, chips]);

  /* ── free-text answers ── */
  function handleSend(raw: string) {
    const v = raw.trim();
    if (!v || typing) return;
    push('user', v);
    setInput('');
    setChips([]);

    switch (phase) {
      case 'name':
        up({ name: v });
        bot("What's the celebration?", () => {
          setPhase('occasion');
          setChips([
            ...OCCASIONS.map((o) => ({ label: o.label, value: o.key })),
            { label: 'Something else', value: '__custom__', kind: 'ghost' as const },
          ]);
        });
        break;

      case 'occasion':
        up({ occasion: v });
        bot(`A ${labelFor(v)} card — lovely. Who's in the photo: just ${draft.name || 'them'}, or a group?`, () => {
          setPhase('photoMode');
          setChips([{ label: `Just ${draft.name || 'them'}`, value: 'one_person' }, { label: 'A group photo', value: 'group' }]);
        });
        break;

      case 'scene': // user typed their own scene
        up({ scene: v });
        bot('Beautiful.', goFrontText);
        break;

      case 'sceneBrief':
        setBrief(v);
        setReroll(0);
        bot('Here are three to start — tap one, or get three more:', () => {
          setPhase('scenePick');
          setChips(suggestionChips(makeSuggestions(v, draft, 0)));
        });
        break;

      case 'bsWhere':
        setBs((b) => ({ ...b, where: v }));
        bot('And what are they doing there?', () => setPhase('bsDoing'));
        break;

      case 'bsDoing':
        setBs((b) => ({ ...b, doing: v }));
        bot('Lovely. Last one — the mood or time of day? (golden hour, cosy evening, bright morning…)', () => setPhase('bsMood'));
        break;

      case 'bsMood': {
        const composed = composeBs({ ...bs, mood: v });
        bot(`Here's the scene:\n“${composed}”\n\nUse it, or keep tweaking?`, () => {
          setPhase('bsConfirm');
          setChips([
            { label: 'Use this scene ✓', value: composed, kind: 'primary' },
            { label: 'Keep tweaking', value: '__tweak__', kind: 'ghost' },
          ]);
        });
        break;
      }

      case 'bsTweak': {
        const composed = `${composeBs(bs)} — ${v}`;
        bot(`Updated:\n“${composed}”\n\nUse it, or tweak again?`, () => {
          setPhase('bsConfirm');
          setChips([
            { label: 'Use this scene ✓', value: composed, kind: 'primary' },
            { label: 'Keep tweaking', value: '__tweak__', kind: 'ghost' },
          ]);
        });
        break;
      }

      case 'frontText': {
        if (/^skip|no headline|leave it|none$/i.test(v)) {
          up({ front: { mode: 'none', text: '' } });
          bot('Done — the scene will speak for itself.', goInsideFork);
          break;
        }
        up({ front: { mode: 'write', text: v } });
        bot(`“${v}” on the front. Nice.`, goInsideFork);
        break;
      }

      case 'insideMessage':
        up({ inside: { mode: 'write', message: v } });
        goReview();
        break;

      case 'reveal':
        if (/^love it|perfect|keep it|looks great|yes$/i.test(v)) { afterApprove(); break; }
        refine(v);
        break;

      default:
        break;
    }
  }

  function composeBs(b: { where?: string; doing?: string; mood?: string }): string {
    const who = draft.name || 'They';
    let s = who;
    if (b.doing) s += ` ${b.doing}`;
    if (b.where) s += `, ${b.where}`;
    if (b.mood) s += `, ${b.mood}`;
    return s;
  }
  function suggestionChips(opts: string[]): Chip[] {
    return [
      ...opts.map((o) => ({ label: o, value: o, kind: 'option' as const })),
      { label: '↻ Try another three', value: '__reroll__', kind: 'ghost' as const },
    ];
  }

  /* ── photo widget (canvas) ── */
  function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS[draft.photoMode] - draft.photos.length;
    Array.from(files).slice(0, room).forEach((f) => setDraft((d) => ({ ...d, photos: [...d.photos, URL.createObjectURL(f)] })));
  }
  function photosDone() {
    setCanvas('empty');
    bot(`Got it — that's ${draft.name || 'them'} sorted. Now the scene for the front of ${draft.name ? `${draft.name}'s` : 'the'} ${labelFor(draft.occasion)} card. Describe it, or I can help:`, () => {
      setPhase('scene');
      setChips([
        { label: '✨ Suggest scenes', value: '__suggest__' },
        { label: '💬 Brainstorm with me', value: '__brainstorm__' },
      ]);
    });
  }

  /* ── transitions ── */
  function goFrontText() {
    bot(`What should the front say? I'll go with “${defaultFront(draft)}” unless you'd rather change it or skip the headline.`, () => {
      setPhase('frontText');
      setChips([
        { label: `Use “${defaultFront(draft)}”`, value: '__default__', kind: 'primary' },
        { label: 'Skip the headline', value: 'skip', kind: 'ghost' },
      ]);
    });
  }
  function goInsideFork() {
    bot(`And inside ${draft.name ? `${draft.name}'s` : 'the'} card — write a message, or leave it blank to handwrite yourself?`, () => {
      setPhase('insideFork');
      setChips([{ label: 'Write a message', value: '__write__' }, { label: 'Leave it blank', value: '__blank__', kind: 'ghost' }]);
    });
  }
  function chooseInside(mode: 'write' | 'blank') {
    if (mode === 'blank') { up({ inside: { mode: 'blank', message: '' } }); bot("Lovely — blank inside, ready for your handwriting. (We'll print + post it to you.)", goReview); return; }
    bot('What should it say inside?', () => setPhase('insideMessage'));
  }
  function goReview() {
    setPhase('review');
    const lines = [
      `For: ${draft.name} · ${labelFor(draft.occasion)}`,
      `Photo: ${draft.photos.length || 1} of ${draft.photoMode === 'group' ? 'the group' : draft.name}`,
      `Scene: ${draft.scene}`,
      `Front: ${draft.front.mode === 'none' ? '(no headline)' : draft.front.text || defaultFront(draft)}`,
      `Inside: ${draft.inside.mode === 'blank' ? '(blank — handwrite)' : draft.inside.message}`,
    ];
    bot(`Here's the plan:\n${lines.join('\n')}\n\nNothing gets sent until you say so. Ready to make it?`, () => {
      setChips([{ label: `Make ${draft.name}'s card ✓`, value: '__generate__', kind: 'primary' }]);
    });
  }
  function runGenerate() {
    setChips([]); setPhase('generating'); setCanvas('generating'); setGenStage(0);
    bot('Making it now — about 45 seconds…');
    [900, 2000, 3100].forEach((t, i) => window.setTimeout(() => setGenStage(i + 1), t));
    window.setTimeout(() => {
      setFilter('none'); setCardSide('front'); setRevKey((k) => k + 1); setCanvas('card'); setPhase('reveal');
      bot("Here's their card. 🎉 Love it, or want to tweak it? Tell me — e.g. “make it sunset”, “add more flowers”.", () => {
        setChips([
          { label: 'Love it ✓', value: 'Love it', kind: 'primary' },
          { label: 'Make it sunset', value: 'make it sunset', kind: 'ghost' },
          { label: 'Softer + dreamier', value: 'softer and dreamier', kind: 'ghost' },
        ]);
      });
    }, 4200);
  }
  function refine(instruction: string) {
    setChips([]);
    bot('Refining — keeping their face, the composition and the words, just changing what you asked…');
    setCanvas('generating'); setGenStage(1);
    window.setTimeout(() => {
      setFilter(refineFilter(instruction)); setRevKey((k) => k + 1); setCanvas('card');
      bot("Updated — how's that? Tweak again, or say “love it”.", () => {
        setChips([
          { label: 'Love it ✓', value: 'Love it', kind: 'primary' },
          { label: 'A bit warmer', value: 'a bit warmer', kind: 'ghost' },
          { label: 'Brighter + bolder', value: 'brighter and bolder', kind: 'ghost' },
        ]);
      });
    }, 1400);
  }
  function afterApprove() {
    setChips([]);
    if (draft.inside.mode === 'blank') {
      up({ delivery: { format: 'printed', destination: 'sender' } });
      bot("Perfect. Since the inside's blank, we'll print it and post it to you to handwrite + send on. All set!", () => setPhase('done'));
      return;
    }
    bot('Beautiful. Now — how do you want to give it?', () => { setPhase('givingFormat'); setCanvas('giving'); });
  }
  function chooseFormat(f: Draft['delivery']['format']) {
    up({ delivery: { ...draft.delivery, format: f } });
    bot(f === 'digital' ? `A digital card for ${draft.name}. Where should it go?` : `A printed card${f === 'both' ? ' + digital copy' : ''}. Where should it go?`, () => setPhase('givingDestination'));
  }
  function chooseDestination(dest: 'recipient' | 'sender') {
    up({ delivery: { ...draft.delivery, destination: dest } });
    setCanvas('card'); setCardSide('front');
    bot(dest === 'recipient' ? `Straight to ${draft.name} it is. That's everything — ready when you are.` : `To you first, so you can add the finishing touch. All set!`, () => setPhase('done'));
  }

  /* ── chip dispatch ── */
  function onChip(c: Chip) {
    if (phase === 'photoMode' || phase === 'occasion') {
      if (c.value === '__custom__') { push('user', c.label); setChips([]); bot('Tell me the occasion in your own words.'); return; }
      handleSend(c.value);
      return;
    }
    if (phase === 'scene') {
      push('user', c.label); setChips([]);
      if (c.value === '__suggest__') { bot("Give me a rough idea — a place, a vibe, anything — and I'll spin up three options. Or say “surprise me”.", () => setPhase('sceneBrief')); return; }
      bot("Love it. I'll ask two quick questions, then draft a scene you can tweak. First — where's the moment?", () => setPhase('bsWhere'));
      return;
    }
    if (phase === 'scenePick') {
      if (c.value === '__reroll__') {
        push('user', 'Try another three'); setChips([]);
        const n = reroll + 1; setReroll(n);
        bot('Three more:', () => setChips(suggestionChips(makeSuggestions(brief, draft, n))));
        return;
      }
      push('user', c.label); setChips([]);
      up({ scene: c.value });
      bot("Beautiful — that's the one.", goFrontText);
      return;
    }
    if (phase === 'bsConfirm') {
      if (c.value === '__tweak__') { push('user', c.label); setChips([]); bot('What would you change?', () => setPhase('bsTweak')); return; }
      push('user', 'Use this scene'); setChips([]);
      up({ scene: c.value });
      bot('Locked in.', goFrontText);
      return;
    }
    if (phase === 'insideFork') { push('user', c.label); setChips([]); chooseInside(c.value === '__blank__' ? 'blank' : 'write'); return; }
    if (phase === 'review' && c.value === '__generate__') { push('user', c.label); runGenerate(); return; }
    if (phase === 'frontText' && c.value === '__default__') { handleSend(defaultFront(draft)); return; }
    handleSend(c.value);
  }

  /* ───────────── render ───────────── */
  return (
    <div className="flex h-[100dvh] flex-col bg-surface md:flex-row">
      {/* CANVAS */}
      <div className="relative flex shrink-0 items-center justify-center overflow-hidden border-b border-stone-200 bg-[linear-gradient(180deg,#ffffff,#f3f2fb)] md:order-2 md:flex-1 md:border-b-0 md:border-l" style={{ minHeight: '40dvh' }}>
        <Canvas
          mode={canvas} draft={draft} filter={filter} cardSide={cardSide} genStage={genStage} revKey={revKey}
          onAddPhotos={addPhotos} onRemovePhoto={(i) => setDraft((d) => ({ ...d, photos: d.photos.filter((_, k) => k !== i) }))}
          onPhotosDone={photosDone} onFlip={() => setCardSide((s) => (s === 'front' ? 'inside' : 'front'))}
          onFormat={chooseFormat} onDestination={chooseDestination} fileRef={fileRef}
        />
      </div>

      {/* CHAT */}
      <div className="flex min-h-0 flex-1 flex-col md:order-1 md:max-w-[460px]">
        <div className="flex items-center gap-2 border-b border-stone-200 px-5 py-3.5">
          <Sparkles className="h-4 w-4 text-brand" strokeWidth={1.75} />
          <p className="text-[14px] font-semibold tracking-tight text-ink">Make a card</p>
          <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-ink-soft">prototype</span>
        </div>

        <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[86%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${m.role === 'user' ? 'rounded-br-md bg-brand text-brand-foreground' : 'rounded-bl-md border border-stone-200 bg-white text-ink'}`}>{m.text}</div>
            </div>
          ))}
          {typing && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md border border-stone-200 bg-white px-3 py-2.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: '0.15s' }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          )}
          {/* Selector pills — INLINE under the latest bot message, like the brainstorm chat. */}
          {!typing && chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pl-1 pt-0.5">
              {chips.map((c) => (
                <button key={c.label} onClick={() => onChip(c)}
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-left text-[12.5px] font-medium transition-colors ${
                    c.kind === 'primary' ? 'bg-brand text-brand-foreground hover:bg-brand-dark'
                    : c.kind === 'option' ? 'w-full border border-brand-light bg-white text-ink hover:bg-brand-muted'
                    : c.kind === 'ghost' ? 'border border-stone-200 bg-white text-ink-soft hover:bg-stone-50'
                    : 'border border-brand-light bg-white text-brand hover:bg-brand-muted'}`}>
                  {/love it|use this/i.test(c.label) ? <Check className="h-3 w-3 shrink-0" strokeWidth={2.5} />
                    : /generate|make .*card/i.test(c.label) ? <Sparkles className="h-3 w-3 shrink-0" strokeWidth={2} />
                    : /brainstorm/i.test(c.label) ? <Wand2 className="h-3 w-3 shrink-0" strokeWidth={2} />
                    : /try another/i.test(c.label) ? <RefreshCw className="h-3 w-3 shrink-0" strokeWidth={2} /> : null}
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* composer — text only; pills live in the thread */}
        <div className="border-t border-stone-200 px-4 py-3">
          {phase === 'done' ? (
            <Link href="/login?redirect=/studio/new-card">
              <button className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-[15px] font-medium text-brand-foreground transition-colors hover:bg-brand-dark">
                Make it for real <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </Link>
          ) : showComposer(phase) ? (
            <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="flex items-center gap-2">
              <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholderFor(phase)} className="h-11 flex-1 rounded-full border border-stone-300 bg-white px-4 text-[15px] text-ink outline-none focus:border-brand" />
              <button type="submit" disabled={!input.trim() || typing} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-40" aria-label="Send"><Send className="h-4 w-4" strokeWidth={2} /></button>
            </form>
          ) : (
            <p className="py-1 text-center text-[12px] text-ink-soft">Tap an option above ↑</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────── canvas ───────────── */
function Canvas({
  mode, draft, filter, cardSide, genStage, revKey,
  onAddPhotos, onRemovePhoto, onPhotosDone, onFlip, onFormat, onDestination, fileRef,
}: {
  mode: CanvasMode; draft: Draft; filter: string; cardSide: 'front' | 'inside'; genStage: number; revKey: number;
  onAddPhotos: (f: FileList | null) => void; onRemovePhoto: (i: number) => void; onPhotosDone: () => void;
  onFlip: () => void; onFormat: (f: Draft['delivery']['format']) => void; onDestination: (d: 'recipient' | 'sender') => void;
  fileRef: React.RefObject<HTMLInputElement>;
}) {
  const STAGES = ['Sketching the scene…', 'Drawing the front…', 'Writing the inside…', 'Final touches…'];

  if (mode === 'photo') {
    const full = draft.photos.length >= MAX_PHOTOS[draft.photoMode];
    return (
      <div className="w-full max-w-[460px] px-6">
        <div className="rounded-[20px] border border-stone-200 bg-white p-5 shadow-sm">
          <p className="mb-3 text-[14px] font-semibold text-ink">{draft.photoMode === 'group' ? 'Add a group photo' : `Add photos of ${draft.name || 'them'}`}</p>
          <div className="grid grid-cols-3 gap-2.5">
            {draft.photos.map((p, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-xl ring-2 ring-brand">
                <img src={p} alt="" className="h-full w-full object-cover" />
                <button onClick={() => onRemovePhoto(i)} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-white"><X className="h-3 w-3" /></button>
              </div>
            ))}
            {!full && (
              <button onClick={() => fileRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 text-ink-soft transition-colors hover:border-brand hover:text-brand">
                <Upload className="h-5 w-5" strokeWidth={1.75} /><span className="text-[11px]">Upload</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple={draft.photoMode === 'one_person'} className="hidden" onChange={(e) => onAddPhotos(e.target.files)} />
          <label className="mt-4 flex items-start gap-2 text-[11.5px] leading-snug text-ink-soft">
            <input type="checkbox" className="mt-0.5" defaultChecked />
            I have permission to use these photos, and I agree to the Terms & Privacy Policy.
          </label>
          <button disabled={draft.photos.length === 0} onClick={onPhotosDone} className="mt-4 w-full rounded-full bg-brand px-4 py-2.5 text-[14px] font-medium text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-40">
            {draft.photos.length ? 'Use these →' : 'Add a photo to continue'}
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'giving') {
    return (
      <div className="w-full max-w-[440px] px-6">
        {!draft.delivery.format ? (
          <div className="space-y-2.5">
            <p className="mb-1 text-center text-[13px] font-medium text-ink-soft">How do you want to give it?</p>
            {([['digital', 'Digital card', 'Sent with a link', '£0.99'], ['printed', 'Printed & posted', 'Real card in the post', '£5.99'], ['both', 'Printed + digital', 'Most popular', '£6.49']] as const).map(([k, t, s, p]) => (
              <button key={k} onClick={() => onFormat(k)} className="flex w-full items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-brand">
                <div><p className="text-[15px] font-medium text-ink">{t}</p><p className="text-[12.5px] text-ink-soft">{s}</p></div>
                <span className="text-[15px] font-semibold text-brand">{p}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            <p className="mb-1 text-center text-[13px] font-medium text-ink-soft">Where should it go?</p>
            {([['recipient', `Straight to ${draft.name}`, 'We send it for you'], ['sender', 'To you first', 'Add a finishing touch']] as const).map(([k, t, s]) => (
              <button key={k} onClick={() => onDestination(k)} className="flex w-full items-center justify-between rounded-2xl border border-stone-200 bg-white px-4 py-3.5 text-left transition-colors hover:border-brand">
                <div><p className="text-[15px] font-medium text-ink">{t}</p><p className="text-[12.5px] text-ink-soft">{s}</p></div>
                <ArrowRight className="h-4 w-4 text-brand" strokeWidth={2} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-[clamp(190px,34dvh,440px)] w-[clamp(190px,34dvh,440px)] md:h-[min(60vh,460px)] md:w-[min(60vh,460px)]">
      <AnimatePresence>
        {mode === 'empty' && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full w-full items-center justify-center rounded-[16px] border border-dashed border-stone-300 text-center text-[13px] text-ink-soft">Your card will appear here ✨</motion.div>
        )}
        {mode === 'card' && (
          <motion.img key={'card' + cardSide + revKey} src={cardSide === 'front' ? frontImg : insideImg} alt="" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} style={{ filter }} className="h-full w-full rounded-[16px] object-cover shadow-[0_40px_90px_-30px_rgba(15,23,42,0.45)]" />
        )}
      </AnimatePresence>
      {mode === 'generating' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-[16px] bg-white/75 backdrop-blur-sm">
          <Loader2 className="h-9 w-9 animate-spin text-brand" strokeWidth={2} />
          <p className="text-[13px] font-medium text-ink-soft">{STAGES[Math.min(genStage, STAGES.length - 1)]}</p>
        </div>
      )}
      {mode === 'card' && draft.inside.mode === 'write' && (
        <button onClick={onFlip} className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-white/85 px-3.5 py-1.5 text-[12px] font-medium text-ink shadow-sm backdrop-blur transition-colors hover:bg-white">
          {cardSide === 'front' ? 'See inside →' : '← See front'}
        </button>
      )}
    </div>
  );
}

/* ───────────── small helpers ───────────── */
function showComposer(p: Phase): boolean {
  return ['name', 'occasion', 'scene', 'sceneBrief', 'bsWhere', 'bsDoing', 'bsMood', 'bsTweak', 'frontText', 'insideMessage', 'reveal'].includes(p);
}
function placeholderFor(p: Phase): string {
  switch (p) {
    case 'name': return 'e.g. Mum, Sarah, Dad…';
    case 'occasion': return 'Type the occasion…';
    case 'scene': return 'Describe the scene…';
    case 'sceneBrief': return 'A place, a vibe… or “surprise me”';
    case 'bsWhere': return 'Where is the moment?';
    case 'bsDoing': return 'What are they doing?';
    case 'bsMood': return 'Mood or time of day…';
    case 'bsTweak': return 'What would you change?';
    case 'frontText': return 'What should the front say?';
    case 'insideMessage': return 'Your message inside…';
    case 'reveal': return 'Tell me a tweak, or “love it”…';
    default: return 'Type your answer…';
  }
}
