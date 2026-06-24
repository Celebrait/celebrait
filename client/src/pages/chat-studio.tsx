// client/src/pages/chat-studio.tsx
//
// PROTOTYPE (/studio-chat) — thesis test for the "chat + canvas" studio:
// converse with a programmed bot to create a card, with the card shown LIVE
// on a canvas beside the thread (like ChatGPT image gen, but on-rails for
// greeting cards). Generation is STUBBED — sample renders + a keyword-driven
// "refine" filter so the canvas visibly responds to what you type — so we can
// feel the INTERACTION fast, before wiring the real generation pipeline. The
// real studio is untouched. See memory: next_chat_canvas_studio.

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Send, Loader2, Check, RefreshCw, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import frontImg from '@/assets/hero-card-front.png';
import insideImg from '@/assets/hero-card-inside.png';

type Role = 'bot' | 'user';
interface Chip {
  label: string;
  value: string;
}
interface Msg {
  id: number;
  role: Role;
  text: string;
}
type Phase =
  | 'occasion'
  | 'scene'
  | 'reviewFront'
  | 'frontText'
  | 'insideText'
  | 'done';
type Canvas = 'empty' | 'generating' | 'front' | 'inside';

// Keyword → CSS filter, so a typed tweak visibly changes the render (stub for
// real regeneration). Sells the "refine by chatting" feel.
function refineFilter(text: string): string {
  const t = text.toLowerCase();
  if (/sunset|warm|gold|orange|amber|cosy|cozy/.test(t))
    return 'saturate(1.25) sepia(0.22) hue-rotate(-12deg) brightness(1.05)';
  if (/cool|blue|night|moon|cold|wintry/.test(t))
    return 'saturate(1.05) hue-rotate(16deg) brightness(0.95)';
  if (/bright|vibrant|pop|vivid|bold/.test(t))
    return 'saturate(1.5) brightness(1.07)';
  if (/soft|dream|pastel|gentle|romantic/.test(t))
    return 'saturate(0.9) brightness(1.07) contrast(0.94)';
  if (/dark|moody|dramatic|night/.test(t))
    return 'saturate(1.1) brightness(0.82) contrast(1.12)';
  return 'saturate(1.18) brightness(1.03)';
}

const SCENE_CHIPS: Chip[] = [
  { label: 'A sunlit terrace in Positano', value: 'On a sunlit terrace in Positano, golden hour' },
  { label: 'The cliffs at golden hour', value: 'On the cliffs at golden hour with the sea behind' },
  { label: 'Our favourite little café', value: 'In our favourite little café, warm and cosy' },
  { label: '✨ Brainstorm with me', value: 'Brainstorm some ideas with me' },
];

let nextId = 1;

export default function ChatStudio() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [phase, setPhase] = useState<Phase>('occasion');
  const [chips, setChips] = useState<Chip[]>([]);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const [canvas, setCanvas] = useState<Canvas>('empty');
  const [filter, setFilter] = useState('none');
  const [refines, setRefines] = useState(0);
  const threadRef = useRef<HTMLDivElement>(null);

  const push = (role: Role, text: string) =>
    setMessages((m) => [...m, { id: nextId++, role, text }]);

  // Bot "types" then speaks — a small delay sells the conversation.
  const bot = (text: string, after?: () => void, delay = 700) => {
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      push('bot', text);
      after?.();
    }, delay);
  };

  // Seed the opening question once.
  useEffect(() => {
    bot("Hi — I'm your card-maker. Who's this card for, and what's the occasion?");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll the thread.
  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, typing]);

  function handleSend(raw: string) {
    const value = raw.trim();
    if (!value || typing) return;
    push('user', value);
    setInput('');
    setChips([]);

    if (phase === 'occasion') {
      bot('Lovely. Now picture the scene — where are they, what are they doing?', () => {
        setPhase('scene');
        setChips(SCENE_CHIPS);
      });
      return;
    }

    if (phase === 'scene') {
      // "Brainstorm" branch — offer a few concrete ideas, stay on scene.
      if (/brainstorm/i.test(value)) {
        bot(
          'Of course! A few directions:\n• Golden hour on a rooftop, city glowing\n• A candlelit dinner, just the two of you\n• Walking a quiet beach at dusk\nPick one, or describe your own.',
          () => setChips(SCENE_CHIPS.slice(0, 3)),
        );
        return;
      }
      bot('Beautiful. Designing the front of your card…', () => {
        setCanvas('generating');
        window.setTimeout(() => {
          setCanvas('front');
          setFilter('none');
          bot(
            "Here's your front. Love it, or want to tweak it? Just tell me — e.g. “make it sunset”, “add more flowers”, “warmer”.",
            () => {
              setPhase('reviewFront');
              setChips([
                { label: 'Love it ✓', value: 'Love it' },
                { label: 'Make it sunset', value: 'make it sunset' },
                { label: 'Softer + dreamier', value: 'softer and dreamier' },
              ]);
            },
          );
        }, 1700);
      });
      return;
    }

    if (phase === 'reviewFront') {
      if (/^love it|looks great|perfect|keep it|yes$/i.test(value)) {
        bot('Great choice. What should the front say?', () => setPhase('frontText'));
        return;
      }
      // Treat anything else as a refine instruction.
      bot('Refining…', () => {
        setCanvas('generating');
        window.setTimeout(() => {
          setFilter(refineFilter(value));
          setRefines((r) => r + 1);
          setCanvas('front');
          bot("Updated — how's that? Tweak again, or say “love it”.", () => {
            setChips([
              { label: 'Love it ✓', value: 'Love it' },
              { label: 'A bit warmer', value: 'a bit warmer' },
              { label: 'Brighter + bolder', value: 'brighter and bolder' },
            ]);
          });
        }, 1200);
      });
      return;
    }

    if (phase === 'frontText') {
      bot('Perfect. And the message inside?', () => setPhase('insideText'));
      return;
    }

    if (phase === 'insideText') {
      bot('Writing the inside…', () => {
        setCanvas('generating');
        window.setTimeout(() => {
          setCanvas('inside');
          setFilter('none');
          bot("Done — here's your card. 🎉", () => setPhase('done'));
        }, 1500);
      });
      return;
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-surface md:flex-row">
      {/* CANVAS — the card, live. Top on mobile, right on desktop. */}
      <div
        className="relative flex shrink-0 items-center justify-center overflow-hidden border-b border-stone-200 bg-[linear-gradient(180deg,#ffffff,#f3f2fb)] md:order-2 md:flex-1 md:border-b-0 md:border-l"
        style={{ minHeight: '38dvh' }}
      >
        <div className="relative h-[clamp(180px,32dvh,420px)] w-[clamp(180px,32dvh,420px)] md:h-[min(60vh,460px)] md:w-[min(60vh,460px)]">
          <AnimatePresence>
            {canvas === 'empty' && (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex h-full w-full items-center justify-center rounded-[16px] border border-dashed border-stone-300 text-center text-[13px] text-ink-soft"
              >
                Your card will appear here ✨
              </motion.div>
            )}
            {(canvas === 'front' || canvas === 'inside') && (
              <motion.img
                key={canvas + refines}
                src={canvas === 'front' ? frontImg : insideImg}
                alt=""
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{ filter }}
                className="h-full w-full rounded-[16px] object-cover shadow-[0_40px_90px_-30px_rgba(15,23,42,0.45)]"
              />
            )}
          </AnimatePresence>
          {canvas === 'generating' && (
            <div className="absolute inset-0 flex items-center justify-center rounded-[16px] bg-white/70 backdrop-blur-sm">
              <Loader2 className="h-9 w-9 animate-spin text-brand" strokeWidth={2} />
            </div>
          )}
        </div>
        {canvas !== 'empty' && (
          <span className="absolute left-4 top-4 rounded-full bg-white/80 px-3 py-1 text-[11px] font-medium text-ink-soft backdrop-blur">
            {canvas === 'inside' ? 'Inside' : 'Front'}
          </span>
        )}
      </div>

      {/* CHAT — the conversation. */}
      <div className="flex min-h-0 flex-1 flex-col md:order-1 md:max-w-[440px]">
        <div className="flex items-center gap-2 border-b border-stone-200 px-5 py-3.5">
          <Sparkles className="h-4 w-4 text-brand" strokeWidth={1.75} />
          <p className="text-[14px] font-semibold tracking-tight text-ink">Make a card</p>
          <span className="ml-auto rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-ink-soft">
            prototype
          </span>
        </div>

        <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-5">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${
                  m.role === 'user'
                    ? 'rounded-br-md bg-brand text-brand-foreground'
                    : 'rounded-bl-md border border-stone-200 bg-white text-ink'
                }`}
              >
                {m.text}
              </div>
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
        </div>

        {/* Chips + input, or the finish CTA. */}
        <div className="border-t border-stone-200 px-4 py-3">
          {phase === 'done' ? (
            <Link href="/login?redirect=/studio/new-card">
              <button className="flex w-full items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-[15px] font-medium text-brand-foreground transition-colors hover:bg-brand-dark">
                Make it for real <ArrowRight className="h-4 w-4" strokeWidth={2.25} />
              </button>
            </Link>
          ) : (
            <>
              {chips.length > 0 && (
                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {chips.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => handleSend(c.value)}
                      className="inline-flex items-center gap-1 rounded-full border border-brand-light bg-white px-3 py-1.5 text-[12px] font-medium text-brand transition-colors hover:bg-brand-muted"
                    >
                      {/love it/i.test(c.label) ? (
                        <Check className="h-3 w-3" strokeWidth={2.5} />
                      ) : phase === 'reviewFront' ? (
                        <RefreshCw className="h-3 w-3" strokeWidth={2} />
                      ) : null}
                      {c.label}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend(input);
                }}
                className="flex items-center gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type your answer…"
                  className="h-11 flex-1 rounded-full border border-stone-300 bg-white px-4 text-[15px] text-ink outline-none focus:border-brand"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || typing}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition-colors hover:bg-brand-dark disabled:opacity-40"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" strokeWidth={2} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
