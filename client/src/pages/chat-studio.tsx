// client/src/pages/chat-studio.tsx
//
// /studio-chat — the chat-driven studio, now wired to REAL backend.
// Auth-gated (RequireAuth in App.tsx). On entry it creates a real draft
// and autosaves the CardDraftState as the conversation fills it in.
//
// REAL now:
//   • Conversation        → POST /api/studio/chat (gpt-4o-mini): the bot
//                           reads free text and extracts name/occasion/
//                           photoMode/front/inside, so it talks like real AI.
//   • "Suggest scenes"    → POST /api/studio/scene-suggestions (the exact
//                           studio endpoint — 3 tailored options).
//   • "Brainstorm with me"→ POST /api/studio/brainstorm (the exact studio
//                           5-phase guided chat — identical behaviour).
//   • Draft               → POST /api/studio/drafts + PATCH autosave.
//
// STILL STUBBED (next increment): photo upload (local preview), card
// generation (sample renders + keyword refine), and the full-screen
// mobile/photo-modal/cards-in-thread layout + front-first gen sequencing.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Sparkles, Send, Loader2, Check, ArrowRight, Upload, X, RefreshCw, Wand2, Lightbulb, SkipForward,
} from 'lucide-react';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import frontImg from '@/assets/hero-card-front.png';
import insideImg from '@/assets/hero-card-inside.png';

/* ───────────── draft model (mirrors CardDraftState) ───────────── */
interface Draft {
  name: string;
  occasion: string;        // a key: birthday | anniversary | ...
  occasionLabel: string;   // freeform label when occasion === 'other'
  photoMode: 'one_person' | 'group';
  photos: string[];        // local previews (stub upload for now)
  photoIds: number[];      // real photo ids once upload is wired
  scene: string;
  front: { mode: 'write' | 'none'; text: string };
  inside: { mode: 'write' | 'blank'; message: string };
  delivery: { format?: 'digital' | 'printed' | 'both'; destination?: 'recipient' | 'sender' };
}
const EMPTY_DRAFT: Draft = {
  name: '', occasion: '', occasionLabel: '', photoMode: 'one_person', photos: [], photoIds: [], scene: '',
  front: { mode: 'write', text: '' }, inside: { mode: 'write', message: '' }, delivery: {},
};

/* ───────────── occasion labels ───────────── */
const OCCASION_PILLS = [
  { key: 'birthday', label: 'Birthday' }, { key: 'anniversary', label: 'Anniversary' },
  { key: 'wedding', label: 'Wedding' }, { key: 'graduation', label: 'Graduation' },
  { key: 'engagement', label: 'Engagement' }, { key: 'newbaby', label: 'New baby' },
];
const OCC_LABELS: Record<string, string> = {
  birthday: 'birthday', anniversary: 'anniversary', wedding: 'wedding', graduation: 'graduation',
  engagement: 'engagement', newbaby: 'new baby', christmas: 'Christmas', valentines: "Valentine's",
  thankyou: 'thank you', sympathy: 'sympathy', other: 'occasion',
};
const OCC_PHRASE: Record<string, string> = {
  birthday: 'Happy Birthday', anniversary: 'Happy Anniversary', wedding: 'Congratulations',
  graduation: 'Congratulations', engagement: 'Congratulations', newbaby: 'Congratulations',
  christmas: 'Merry Christmas', valentines: 'Happy Valentine\'s Day', thankyou: 'Thank You',
};
function labelFor(d: Draft): string {
  if (d.occasion === 'other' && d.occasionLabel) return d.occasionLabel;
  return OCC_LABELS[d.occasion] ?? d.occasion;
}
function defaultFront(d: Draft): string {
  const phrase = OCC_PHRASE[d.occasion] ?? `Happy ${labelFor(d)}`;
  return d.name ? `${phrase}, ${d.name}` : phrase;
}
const MAX_PHOTOS = { one_person: 5, group: 1 } as const;

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
  | 'scene' | 'sceneBrief' | 'scenePick' | 'bsChat'
  | 'frontText' | 'insideFork' | 'insideMessage'
  | 'review' | 'generating' | 'reveal'
  | 'givingFormat' | 'givingDestination' | 'done';
type CanvasMode = 'empty' | 'photo' | 'generating' | 'card' | 'giving';

// Brainstorm sub-flow (mirrors the studio's /api/studio/brainstorm machine).
type BsPhase = 'initial_scene' | 'scene_specifics' | 'activity' | 'clothing' | 'summary' | 'change_request';
type BsAction = 'reply' | 'ideas' | 'more_ideas' | 'choose_option' | 'skip' | 'change_request' | 'tweak';
interface BsHistory { role: 'user' | 'assistant'; content: string }
function bsKey(p: BsPhase): keyof BsCollected | null {
  return p === 'initial_scene' ? 'initialScene'
    : p === 'scene_specifics' ? 'sceneSpecifics'
    : p === 'activity' ? 'activity'
    : p === 'clothing' ? 'clothing' : null;
}
interface BsCollected { initialScene?: string; sceneSpecifics?: string; activity?: string; clothing?: string }

let nextId = 1;

export default function ChatStudio() {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [cardId, setCardId] = useState<number | null>(null);
  const baseStateRef = useRef<any>(null); // server's valid CardDraftState to merge onto

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

  // scene-suggestions
  const [brief, setBrief] = useState('');
  // brainstorm sub-flow
  const [bsPhase, setBsPhase] = useState<BsPhase>('initial_scene');
  const [bsCollected, setBsCollected] = useState<BsCollected>({});
  const [bsHistory, setBsHistory] = useState<BsHistory[]>([]);
  const [bsAwaiting, setBsAwaiting] = useState<'reply' | 'tweak'>('reply');
  const [proposedScene, setProposedScene] = useState('');

  const threadRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const push = (role: Role, text: string) => setMessages((m) => [...m, { id: nextId++, role, text }]);
  const up = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  /* ── create the real draft on mount ── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiRequest('POST', '/api/studio/drafts');
        const { id } = await res.json();
        if (cancelled) return;
        setCardId(id);
        // Pull the server's empty state so autosave merges onto a valid shape.
        const g = await apiRequest('GET', `/api/studio/drafts/${id}`);
        const data = await g.json();
        baseStateRef.current = data?.state ?? { version: 1 };
      } catch {
        // Non-fatal — the conversation still works; autosave/scene-suggest
        // just won't persist. Surfaced softly if scene-suggest fails.
      }
    })();
    push('bot', "Hi — I'm your card-maker. Let's make something they'll keep. Who's this card for?");
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' }); }, [messages, typing, chips]);

  /* ── autosave (debounced) ── */
  function buildState(d: Draft) {
    const base = baseStateRef.current ?? { version: 1 };
    return {
      ...base,
      version: 1,
      recipient: { ...(base.recipient ?? {}), name: d.name || undefined, occasion: d.occasion || undefined },
      photos: { ...(base.photos ?? {}), mode: d.photoMode, photoIds: d.photoIds },
      scene: { ...(base.scene ?? {}), description: d.scene || undefined },
      front: { ...(base.front ?? {}), mode: d.front.mode, text: d.front.mode === 'none' ? undefined : (d.front.text || undefined) },
      inside: d.inside.mode === 'blank'
        ? { ...(base.inside ?? {}), mode: 'blank' }
        : { ...(base.inside ?? {}), mode: 'write', write: { ...((base.inside ?? {}).write ?? {}), message: d.inside.message || undefined } },
      delivery: { ...(base.delivery ?? {}), ...d.delivery },
    };
  }
  const saveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!cardId) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      apiRequest('PATCH', `/api/studio/drafts/${cardId}`, { state: buildState(draft) }).catch(() => {});
    }, 600);
    return () => { if (saveTimer.current) window.clearTimeout(saveTimer.current); };
  }, [draft, cardId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Immediate flush (await) before reads that depend on persisted state.
  async function flushSave() {
    if (!cardId) return;
    try { await apiRequest('PATCH', `/api/studio/drafts/${cardId}`, { state: buildState(draft) }); } catch { /* noop */ }
  }

  function chatHistory(): BsHistory[] {
    return messages.slice(-10).map((m) => ({ role: m.role === 'user' ? 'user' as const : 'assistant' as const, content: m.text }));
  }

  /* ── merge LLM-captured fields into a fresh draft object ── */
  function mergeCaptured(cap: any): Draft {
    const d: Draft = { ...draft, front: { ...draft.front }, inside: { ...draft.inside }, delivery: { ...draft.delivery } };
    if (cap.name) d.name = cap.name;
    if (cap.occasion) d.occasion = cap.occasion;
    if (cap.occasionLabel) d.occasionLabel = cap.occasionLabel;
    if (cap.photoMode) d.photoMode = cap.photoMode;
    if (cap.frontMode || cap.frontText) {
      d.front = { mode: cap.frontMode ?? 'write', text: cap.frontText ?? d.front.text };
    }
    if (cap.insideMode || cap.insideMessage) {
      d.inside = { mode: cap.insideMode ?? d.inside.mode, message: cap.insideMessage ?? d.inside.message };
    }
    return d;
  }

  /* ── LLM conversation turn ── */
  const CHAT_STEP: Partial<Record<Phase, string>> = {
    name: 'name', occasion: 'occasion', photoMode: 'photoMode', frontText: 'front', insideMessage: 'inside',
  };
  async function runChatTurn(userMessage: string) {
    setTyping(true);
    try {
      const res = await apiRequest('POST', '/api/studio/chat', {
        step: CHAT_STEP[phase] ?? 'freeform',
        userMessage,
        history: chatHistory(),
        draft: { name: draft.name, occasion: draft.occasion, photoMode: draft.photoMode, frontText: draft.front.text, insideMode: draft.inside.mode },
      });
      const data = await res.json(); // { reply, captured, stepComplete }
      const merged = mergeCaptured(data.captured ?? {});
      setDraft(merged);
      setTyping(false);
      if (data.reply) push('bot', data.reply);
      advanceAfterChat(merged, data.stepComplete === true);
    } catch {
      setTyping(false);
      push('bot', 'Sorry — I hit a snag there. Could you say that again?');
    }
  }

  function advanceAfterChat(d: Draft, stepComplete: boolean) {
    switch (phase) {
      case 'name':
        if (d.name && d.occasion) { goPhotoMode(d); }
        else if (d.name) { setPhase('occasion'); setChips(occasionChips()); }
        break;
      case 'occasion':
        if (d.occasion) goPhotoMode(d);
        break;
      case 'photoMode':
        if (d.photoMode && stepComplete) goPhoto();
        break;
      case 'frontText':
        if (stepComplete || d.front.mode === 'none' || d.front.text) goInsideFork(d);
        break;
      case 'insideMessage':
        if (d.inside.message) goReview(d);
        break;
      default: break;
    }
  }

  function occasionChips(): Chip[] {
    return [
      ...OCCASION_PILLS.map((o) => ({ label: o.label, value: o.key })),
      { label: 'Something else', value: '__custom__', kind: 'ghost' as const },
    ];
  }
  function goPhotoMode(d: Draft) {
    setPhase('photoMode');
    setChips([{ label: `Just ${d.name || 'them'}`, value: 'one_person' }, { label: 'A group photo', value: 'group' }]);
  }
  function goPhoto() { setPhase('photo'); setCanvas('photo'); }

  /* ── free-text composer submit ── */
  function handleSend(raw: string, label?: string) {
    const v = raw.trim();
    if (!v || typing) return;
    push('user', label ?? v);
    setInput('');
    setChips([]);

    // LLM-driven steps.
    if (phase === 'name' || phase === 'occasion' || phase === 'photoMode' || phase === 'frontText' || phase === 'insideMessage') {
      void runChatTurn(v);
      return;
    }
    // Scene: user typed their own description.
    if (phase === 'scene') { const d = { ...draft, scene: v }; setDraft(d); bot('Beautiful — that works.', () => goFrontText(d)); return; }
    // Scene-suggestions: user typed a brief.
    if (phase === 'sceneBrief') { setBrief(v); void fetchSuggestions(v); return; }
    // Brainstorm: free text drives the guided machine.
    if (phase === 'bsChat') { void bsTurn(bsAwaiting, v); setBsAwaiting('reply'); return; }
  }

  // Simple scripted bot line (used for deterministic transitions, NOT the LLM).
  function bot(text: string, after?: () => void, delay = 450) {
    setTyping(true);
    window.setTimeout(() => { setTyping(false); push('bot', text); after?.(); }, delay);
  }

  /* ── scene-suggestions (real) ── */
  async function fetchSuggestions(briefText: string) {
    setTyping(true);
    await flushSave(); // ensure recipient + occasion are persisted for the endpoint
    try {
      const res = await apiRequest('POST', '/api/studio/scene-suggestions', { cardId, brief: briefText });
      const data = await res.json(); // { suggestions: [{id,text}] }
      const opts: string[] = (data.suggestions ?? []).map((s: any) => s.text).filter(Boolean);
      setTyping(false);
      if (!opts.length) { push('bot', "Hmm, I couldn't spin those up. Want to describe the scene yourself instead?"); setPhase('scene'); return; }
      push('bot', 'Here are three to start — tap one, or get three more:');
      setPhase('scenePick');
      setChips(suggestionChips(opts));
    } catch {
      setTyping(false);
      push('bot', "I couldn't reach the scene helper just now — you can type the scene yourself and we'll roll with it.");
      setPhase('scene');
    }
  }
  function suggestionChips(opts: string[]): Chip[] {
    return [
      ...opts.map((o) => ({ label: o, value: o, kind: 'option' as const })),
      { label: '↻ Try another three', value: '__reroll__', kind: 'ghost' as const },
    ];
  }

  /* ── brainstorm (real — mirrors the studio machine) ── */
  function startBrainstorm() {
    const opener = "Let's set the scene together. Where does the moment take place — a city, a beach, a back garden, grandma's kitchen?";
    setBsPhase('initial_scene'); setBsCollected({}); setBsAwaiting('reply'); setProposedScene('');
    setBsHistory([{ role: 'assistant', content: opener }]);
    setPhase('bsChat');
    bot(opener, () => setChips([{ label: '💡 Give me ideas', value: '__ideas__', kind: 'ghost' }]));
  }
  async function bsTurn(action: BsAction, userInput?: string) {
    setTyping(true);
    // Stash the answer for the current phase when replying/choosing.
    let collectedToSend = bsCollected;
    if ((action === 'reply' || action === 'choose_option') && userInput) {
      const k = bsKey(bsPhase);
      if (k) { collectedToSend = { ...bsCollected, [k]: userInput }; setBsCollected(collectedToSend); }
    }
    try {
      const res = await apiRequest('POST', '/api/studio/brainstorm', {
        recipientName: draft.name, occasion: draft.occasion || 'other',
        currentSceneText: draft.scene || '',
        history: bsHistory,
        action, userInput, currentPhase: bsPhase, collectedInfo: collectedToSend,
        photoMode: draft.photoMode,
      });
      const data = await res.json(); // { reply, phase, suggestions?, finalScene? }
      setTyping(false);
      if (data.reply) push('bot', data.reply);
      setBsHistory((h) => [...h, ...(userInput ? [{ role: 'user' as const, content: userInput }] : []), { role: 'assistant' as const, content: data.reply ?? '' }]);
      if (data.phase) setBsPhase(data.phase);
      if (data.finalScene) {
        setProposedScene(data.finalScene);
        setChips([
          { label: 'Use this scene ✓', value: '__use__', kind: 'primary' },
          { label: 'Tweak it', value: '__change__', kind: 'ghost' },
        ]);
      } else if (Array.isArray(data.suggestions) && data.suggestions.length) {
        setChips([
          ...data.suggestions.map((s: string) => ({ label: s, value: s, kind: 'option' as const })),
          { label: '↻ More ideas', value: '__more__', kind: 'ghost' },
          { label: 'Skip — you choose', value: '__skip__', kind: 'ghost' },
        ]);
      } else {
        setChips([
          { label: '💡 Ideas', value: '__ideas__', kind: 'ghost' },
          { label: 'Skip — you choose', value: '__skip__', kind: 'ghost' },
        ]);
      }
    } catch {
      setTyping(false);
      push('bot', "I lost the thread there — want to type the scene yourself instead?");
      setPhase('scene');
    }
  }

  /* ── transitions ── */
  function goFrontText(d: Draft) {
    bot(`What should the front say? I'll go with “${defaultFront(d)}” unless you'd like something else — or skip the headline.`, () => {
      setPhase('frontText');
      setChips([
        { label: `Use “${defaultFront(d)}”`, value: '__default__', kind: 'primary' },
        { label: 'Skip the headline', value: '__skipfront__', kind: 'ghost' },
      ]);
    });
  }
  function goInsideFork(d: Draft) {
    bot(`And inside ${d.name ? `${d.name}'s` : 'the'} card — shall I write a message, or leave it blank for your own handwriting?`, () => {
      setPhase('insideFork');
      setChips([{ label: 'Write a message', value: '__write__' }, { label: 'Leave it blank', value: '__blank__', kind: 'ghost' }]);
    });
  }
  function goReview(d: Draft) {
    setPhase('review');
    const lines = [
      `For: ${d.name} · ${labelFor(d)}`,
      `Photo: ${d.photos.length || 1} of ${d.photoMode === 'group' ? 'the group' : d.name}`,
      `Scene: ${d.scene}`,
      `Front: ${d.front.mode === 'none' ? '(no headline)' : d.front.text || defaultFront(d)}`,
      `Inside: ${d.inside.mode === 'blank' ? '(blank — handwrite)' : d.inside.message}`,
    ];
    bot(`Here's the plan:\n${lines.join('\n')}\n\nNothing gets sent until you say so. Ready to make it?`, () => {
      setChips([{ label: `Make ${d.name}'s card ✓`, value: '__generate__', kind: 'primary' }]);
    });
  }

  /* ── generation (STILL STUBBED — real /generate next increment) ── */
  function runGenerate() {
    setChips([]); setPhase('generating'); setCanvas('generating'); setGenStage(0);
    push('bot', 'Making it now — about 45 seconds…');
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
    push('bot', 'Refining — keeping their face, the composition and the words, just changing what you asked…');
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

  /* ── photo widget (stub upload) ── */
  function addPhotos(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS[draft.photoMode] - draft.photos.length;
    Array.from(files).slice(0, room).forEach((f) => setDraft((d) => ({ ...d, photos: [...d.photos, URL.createObjectURL(f)] })));
  }
  function photosDone() {
    setCanvas('empty');
    bot(`Lovely — that's ${draft.name || 'them'} sorted. Now the scene for the front of ${draft.name ? `${draft.name}'s` : 'the'} ${labelFor(draft)} card. Describe it, or I can help:`, () => {
      setPhase('scene');
      setChips([
        { label: '✨ Suggest scenes', value: '__suggest__' },
        { label: '💬 Brainstorm with me', value: '__brainstorm__' },
      ]);
    });
  }

  /* ── chip dispatch ── */
  function onChip(c: Chip) {
    // Occasion pills (LLM step, but pills are deterministic).
    if (phase === 'occasion') {
      if (c.value === '__custom__') { push('user', c.label); setChips([]); bot('Tell me the occasion in your own words.'); return; }
      push('user', c.label); setChips([]);
      const d = { ...draft, occasion: c.value };
      setDraft(d);
      bot(`A ${labelFor(d)} card — lovely.`, () => goPhotoMode(d));
      return;
    }
    if (phase === 'photoMode') {
      push('user', c.label); setChips([]);
      const d = { ...draft, photoMode: (c.value === 'group' ? 'group' : 'one_person') as Draft['photoMode'] };
      setDraft(d);
      bot(c.value === 'group' ? 'Add one photo with everyone in it.' : `Add a photo of ${d.name || 'them'} — a few angles help the likeness.`, () => goPhoto());
      return;
    }
    if (phase === 'scene') {
      push('user', c.label); setChips([]);
      if (c.value === '__suggest__') { bot("Give me a rough idea — a place, a vibe, anything — and I'll spin up three options. Or say “surprise me”.", () => setPhase('sceneBrief')); return; }
      startBrainstorm();
      return;
    }
    if (phase === 'scenePick') {
      if (c.value === '__reroll__') { push('user', 'Try another three'); setChips([]); void fetchSuggestions(brief); return; }
      push('user', c.label); setChips([]);
      const d = { ...draft, scene: c.value };
      setDraft(d);
      bot("Beautiful — that's the one.", () => goFrontText(d));
      return;
    }
    if (phase === 'bsChat') {
      if (c.value === '__ideas__') { push('user', 'Give me ideas'); setChips([]); void bsTurn('ideas'); return; }
      if (c.value === '__more__') { push('user', 'More ideas'); setChips([]); void bsTurn('more_ideas'); return; }
      if (c.value === '__skip__') { push('user', 'Skip — you choose'); setChips([]); void bsTurn('skip'); return; }
      if (c.value === '__change__') { push('user', 'Tweak it'); setChips([]); setBsAwaiting('tweak'); void bsTurn('change_request'); return; }
      if (c.value === '__use__') {
        push('user', 'Use this scene'); setChips([]);
        const d = { ...draft, scene: proposedScene };
        setDraft(d);
        bot('Locked in.', () => goFrontText(d));
        return;
      }
      // an option suggestion was tapped
      push('user', c.label); setChips([]);
      void bsTurn('choose_option', c.value);
      return;
    }
    if (phase === 'frontText') {
      if (c.value === '__default__') { const d = { ...draft, front: { mode: 'write' as const, text: defaultFront(draft) } }; setDraft(d); push('user', c.label); setChips([]); bot(`“${defaultFront(draft)}” on the front. Nice.`, () => goInsideFork(d)); return; }
      if (c.value === '__skipfront__') { const d = { ...draft, front: { mode: 'none' as const, text: '' } }; setDraft(d); push('user', c.label); setChips([]); bot('Done — the scene will speak for itself.', () => goInsideFork(d)); return; }
    }
    if (phase === 'insideFork') {
      push('user', c.label); setChips([]);
      if (c.value === '__blank__') { const d = { ...draft, inside: { mode: 'blank' as const, message: '' } }; setDraft(d); bot("Lovely — blank inside, ready for your handwriting. (We'll print + post it to you.)", () => goReview(d)); return; }
      bot('What should it say inside?', () => setPhase('insideMessage'));
      return;
    }
    if (phase === 'review' && c.value === '__generate__') { push('user', c.label); runGenerate(); return; }
    if (phase === 'reveal') {
      if (c.value === 'Love it') { push('user', c.label); afterApprove(); return; }
      push('user', c.label); refine(c.value); return;
    }
  }

  /* ───────────── render ───────────── */
  const canvasHidden = canvas === 'empty'; // mobile: full-screen chat until there's something to show
  return (
    <div className="flex h-[100dvh] flex-col bg-surface md:flex-row">
      {/* CANVAS — hidden on mobile while empty (full-screen chat); always shown on desktop */}
      <div
        className={`relative shrink-0 items-center justify-center overflow-hidden border-stone-200 bg-[linear-gradient(180deg,#ffffff,#f3f2fb)] md:order-2 md:flex md:flex-1 md:border-b-0 md:border-l ${canvasHidden ? 'hidden md:flex' : 'flex border-b'}`}
        style={canvasHidden ? undefined : { minHeight: '40dvh' }}
      >
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
                    : /ideas/i.test(c.label) ? <Lightbulb className="h-3 w-3 shrink-0" strokeWidth={2} />
                    : /skip/i.test(c.label) ? <SkipForward className="h-3 w-3 shrink-0" strokeWidth={2} />
                    : /try another|more ideas/i.test(c.label) ? <RefreshCw className="h-3 w-3 shrink-0" strokeWidth={2} /> : null}
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* composer — text only; pills live in the thread */}
        <div className="border-t border-stone-200 px-4 py-3">
          {phase === 'done' ? (
            <Link href="/studio/new-card">
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
  return ['name', 'occasion', 'photoMode', 'scene', 'sceneBrief', 'bsChat', 'frontText', 'insideMessage', 'reveal'].includes(p);
}
function placeholderFor(p: Phase): string {
  switch (p) {
    case 'name': return 'e.g. Mum, Sarah, Dad…';
    case 'occasion': return 'Type the occasion…';
    case 'photoMode': return 'Just them, or a group?';
    case 'scene': return 'Describe the scene…';
    case 'sceneBrief': return 'A place, a vibe… or “surprise me”';
    case 'bsChat': return 'Type your answer…';
    case 'frontText': return 'What should the front say?';
    case 'insideMessage': return 'Your message inside…';
    case 'reveal': return 'Tell me a tweak, or “love it”…';
    default: return 'Type your answer…';
  }
}
