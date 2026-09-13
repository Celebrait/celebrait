// client/src/components/landing/imagine-describe-ship-section.tsx
//
// "Imagine it. Describe it. Send it." — autoplay demo of the Studio's
// brainstorm chat. CHAT ONLY: the section shows the conversation and
// nothing else.
//
// Hard clone of the real drawer UI from
// `client/src/components/studio/brainstorm-chat-drawer.tsx`:
//
//   • Sparkle-icon header + "Brainstorm the scene" title
//   • Bubble styles (violet "you" / white "ai"), bg-stone-50 chat surface
//   • Phase-aware action pills under the latest AI message
//   • Typing indicator (3 bouncing dots in a bubble)
//   • Disabled input bar at the bottom mirroring the real one
//
// History:
//   1. Autoplay timer loop → 2. scroll-driven (scroll-jacking knots) →
//   3. back to autoplay, chat playing through to a summary, then a
//      phone-fade into a 3D card reveal with its own CTA.
//   4. 2026-07-16 (Kevin): the card reveal is GONE. "Just displaying the
//      chat here quickly, different versions… no need to let the user see
//      a card." So: no reveal, no choice panel, no Card3DViewer, no CTA —
//      the phone now cycles through several short conversations on a loop.
//      The card is the payoff of other sections; this one sells the
//      *process*, and showing a card here spent that beat twice.
//
// The old script was set in Plettenberg Bay — South Africa, from the
// pre-UK-pivot era. V1 is UK-only, so every scene here is now British.
// See next_digital_card_strategy / the UK-only founder call 2026-05-27.

import { useEffect, useRef, useState } from 'react';
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  useInView,
} from 'framer-motion';
import {
  Battery,
  Check,
  ChevronLeft,
  Lightbulb,
  Pencil,
  RefreshCw,
  Send,
  Signal,
  SkipForward,
  Sparkles,
  Wifi,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────── */

type Role = 'ai' | 'user';
type ActionsKind =
  | 'none'
  | 'ideas-skip'
  | 'suggestions'
  | 'more-ideas-skip'
  | 'summary';

interface BubbleMsg {
  id: number;
  role: Role;
  content: string;
  /** Suggestions render as numbered chips ABOVE the bubble's content
   *  on the AI side (mirrors the real drawer layout). */
  suggestions?: string[];
}

interface ScriptSnapshot {
  /** How long to dwell on this snapshot before advancing. */
  durationMs: number;
  messages: BubbleMsg[];
  typing?: boolean;
  /** Action set rendered under the LATEST AI message in this snapshot. */
  actions?: ActionsKind;
}

/* ─── Scripted brainstorm playback ──────────────────────────────── */

// A conversation is authored as a flat list of turns; buildScript()
// expands it into the cumulative snapshots the screen renders (typing
// beat → message → next). The old hand-authored snapshots restated the
// whole message list on every frame — ~120 lines for ONE conversation,
// with every copy edit needing to be made in a dozen places. That's why
// there was only ever one.
type Turn =
  | { role: 'ai'; text: string; suggestions?: string[]; actions?: ActionsKind }
  | { role: 'user'; text: string };

interface Conversation {
  id: string;
  turns: Turn[];
}

// Pacing. Kevin 2026-07-16: "just displaying the chat here quickly" — so
// these are tighter than the old ~13.7s single run. Each conversation
// now plays in ~7s, and there are three of them on a loop.
const T = {
  typing: 420, // AI "thinking" beat before each of its lines
  ai: 900, // dwell on a plain AI line
  aiIdeas: 1500, // longer — three suggestion chips to read
  user: 520, // dwell on a user reply
  summary: 2400, // hold the finished scene before the next conversation
};

/** Expand a conversation into the cumulative snapshots the screen plays.
 *  `baseId` keeps message ids unique ACROSS conversations: reusing 1,2,3
 *  would let React key the next conversation's bubbles onto the last
 *  one's and morph them mid-swap instead of replacing them. */
function buildScript(turns: Turn[], baseId: number): ScriptSnapshot[] {
  const snaps: ScriptSnapshot[] = [];
  const acc: BubbleMsg[] = [];
  let n = 0;
  turns.forEach((turn, i) => {
    const isLast = i === turns.length - 1;
    if (turn.role === 'ai') {
      // AI always "thinks" before it speaks.
      snaps.push({ durationMs: T.typing, messages: [...acc], typing: true });
      acc.push({
        id: baseId + ++n,
        role: 'ai',
        content: turn.text,
        ...(turn.suggestions ? { suggestions: turn.suggestions } : {}),
      });
      snaps.push({
        durationMs: isLast ? T.summary : turn.suggestions ? T.aiIdeas : T.ai,
        messages: [...acc],
        ...(turn.actions ? { actions: turn.actions } : {}),
      });
    } else {
      acc.push({ id: baseId + ++n, role: 'user', content: turn.text });
      snaps.push({ durationMs: T.user, messages: [...acc] });
    }
  });
  return snaps;
}

// Three British scenes (V1 is UK-only). Deliberately short: the point is
// the RHYTHM of the thing — ask → answer → ideas → pick → done — not the
// transcript. Each lands a different relationship (dad / mate / nan) and
// a different corner of the country, so the loop reads as range rather
// than repetition.
const CONVERSATIONS: Conversation[] = [
  {
    id: 'dad-dales',
    turns: [
      { role: 'ai', text: "Hi — where does Dad's 60th take place?" },
      { role: 'user', text: 'The Yorkshire Dales.' },
      {
        role: 'ai',
        text: 'Lovely. A few Dales-flavoured ideas —',
        suggestions: [
          'Halfway up Pen-y-ghent',
          'On a drystone wall at sunrise',
          'Outside the village pub',
        ],
        actions: 'suggestions',
      },
      { role: 'user', text: 'Halfway up Pen-y-ghent.' },
      { role: 'ai', text: "Got it. What's he doing up there?", actions: 'ideas-skip' },
      { role: 'user', text: 'Raising a flask of tea like a trophy.' },
      {
        role: 'ai',
        text: "Here's the scene: Dad halfway up Pen-y-ghent, flask of tea raised like a trophy, the Dales rolling out behind him.",
        actions: 'summary',
      },
    ],
  },
  {
    id: 'mate-brighton',
    turns: [
      { role: 'ai', text: 'Hi — where does this one happen?' },
      { role: 'user', text: 'Brighton beach.' },
      {
        role: 'ai',
        text: 'Nice. A few Brighton-flavoured ideas —',
        suggestions: [
          'Chips on the pebbles',
          'On the pier at golden hour',
          'In the sea. In November.',
        ],
        actions: 'suggestions',
      },
      { role: 'user', text: 'Chips on the pebbles.' },
      { role: 'ai', text: "Ha. And what's he up to?", actions: 'ideas-skip' },
      { role: 'user', text: 'Defending them from a seagull. Losing.' },
      {
        role: 'ai',
        text: "Here's the scene: your best mate on Brighton beach, chips held aloft, one seagull mid-swoop. He is losing.",
        actions: 'summary',
      },
    ],
  },
  {
    id: 'nan-blackpool',
    turns: [
      { role: 'ai', text: "Hi — where's Nan's 80th set?" },
      { role: 'user', text: 'Blackpool. Obviously.' },
      {
        role: 'ai',
        text: 'A few Blackpool-flavoured ideas —',
        suggestions: [
          'The Tower Ballroom',
          'Under the illuminations',
          'Front seat of the tram',
        ],
        actions: 'suggestions',
      },
      { role: 'user', text: 'The Tower Ballroom.' },
      { role: 'ai', text: "Perfect. And what's she doing?", actions: 'ideas-skip' },
      { role: 'user', text: 'Leading the dance. Obviously.' },
      {
        role: 'ai',
        text: "Here's the scene: Nan mid-twirl at the Blackpool Tower Ballroom, leading the dance, the whole floor watching.",
        actions: 'summary',
      },
    ],
  },
];

const SCRIPTS: ScriptSnapshot[][] = CONVERSATIONS.map((c, i) =>
  buildScript(c.turns, i * 100),
);

/* ─── Phone frame ───────────────────────────────────────────────── */

function PhoneFrame({ children }: { children: React.ReactNode }) {
  // Original widths — restored 2026-05-06 (Kevin: "you made the
  // phone smaller, so now the text cuts off at the bottom of the
  // phone, the entire chat needs to show"). Breathing room below
  // the phone is now provided by translate-y on the wrapper +
  // tighter headline/padding sizing, NOT by shrinking the phone.
  return (
    <div className="relative mx-auto w-[280px] md:w-[300px] lg:w-[320px] aspect-[9/19]">
      <div
        className="absolute inset-0 bg-ink rounded-[44px]"
        style={{
          boxShadow:
            '0 40px 80px -30px rgba(15,23,42,0.32), 0 16px 32px -16px rgba(15,23,42,0.18)',
        }}
      >
        <div className="absolute inset-[10px] bg-surface-card rounded-[34px] overflow-hidden">
          <div
            aria-hidden
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[110px] h-6 bg-ink rounded-b-2xl z-20"
          />
          <div className="relative w-full h-full">{children}</div>
          <div
            aria-hidden
            className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1 bg-stone-300 rounded-full z-20"
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Sub-components: bubbles, typing, action pills ─────────────── */

function MessageBubble({ msg }: { msg: BubbleMsg }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 4, x: isUser ? 6 : -6 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className="max-w-[88%] space-y-1">
        {/* Suggestions chips render ABOVE the bubble content (mirrors
            the studio drawer's layout). */}
        {msg.suggestions && (
          <div className="space-y-1 mb-1.5">
            {msg.suggestions.map((s, i) => (
              <div
                key={i}
                className="text-left text-[10px] leading-snug px-2 py-1.5 rounded-md bg-white border border-brand-light text-ink"
              >
                <span className="font-semibold text-brand mr-1">{i + 1}.</span>
                {s}
              </div>
            ))}
          </div>
        )}
        <div
          className={`px-3 py-1.5 text-[11px] leading-snug ${
            isUser
              ? 'bg-brand text-brand-foreground rounded-2xl rounded-br-md'
              : 'bg-white border border-stone-200 text-ink rounded-2xl rounded-bl-md'
          }`}
        >
          {msg.content}
        </div>
      </div>
    </motion.div>
  );
}

function TypingDots() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex justify-start"
    >
      <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-md px-3 py-2 inline-flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
        <span
          className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce"
          style={{ animationDelay: '0.15s' }}
        />
        <span
          className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce"
          style={{ animationDelay: '0.3s' }}
        />
      </div>
    </motion.div>
  );
}

function ActionPill({
  icon: Icon,
  label,
}: {
  icon: typeof Lightbulb;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-brand font-medium px-2 py-1 rounded-full border border-brand-light bg-white">
      <Icon className="w-2.5 h-2.5" strokeWidth={1.75} />
      {label}
    </span>
  );
}

function PrimaryActionPill({
  icon: Icon,
  label,
}: {
  icon: typeof Check;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2.5 py-1 rounded-full bg-cta text-cta-foreground">
      <Icon className="w-2.5 h-2.5" strokeWidth={2.5} />
      {label}
    </span>
  );
}

function ActionRow({ kind }: { kind: ActionsKind }) {
  if (kind === 'none') return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: 0.1 }}
      className="flex flex-wrap gap-1.5 mt-2 pl-1"
    >
      {kind === 'ideas-skip' && (
        <>
          <ActionPill icon={Lightbulb} label="Give me ideas" />
          <ActionPill icon={SkipForward} label="Skip" />
        </>
      )}
      {kind === 'more-ideas-skip' || kind === 'suggestions' ? (
        <>
          <ActionPill icon={Lightbulb} label="More ideas" />
          <ActionPill icon={SkipForward} label="Skip" />
        </>
      ) : null}
      {kind === 'summary' && (
        <>
          <PrimaryActionPill icon={Check} label="Sounds great" />
          <ActionPill icon={Pencil} label="Make a change" />
          <ActionPill icon={RefreshCw} label="Start over" />
        </>
      )}
    </motion.div>
  );
}

/* ─── Brainstorm screen ─────────────────────────────────────────── */

function BrainstormScreen({ snapshot }: { snapshot: ScriptSnapshot }) {
  const lastAiIndex = (() => {
    for (let i = snapshot.messages.length - 1; i >= 0; i--) {
      if (snapshot.messages[i].role === 'ai') return i;
    }
    return -1;
  })();

  return (
    <div className="absolute inset-0 flex flex-col bg-stone-50">
      {/* Status bar */}
      <div className="h-7 px-5 pt-1.5 flex items-center justify-between text-[10px] font-semibold text-ink tabular-nums shrink-0 bg-surface-card">
        <span>9:41</span>
        <div className="flex items-center gap-1">
          <Signal className="w-3 h-3" strokeWidth={2.5} />
          <Wifi className="w-3 h-3" strokeWidth={2.5} />
          <Battery className="w-4 h-3" strokeWidth={2} />
        </div>
      </div>

      {/* App header — Brainstorm the scene */}
      <div className="px-4 py-2.5 border-b border-stone-200 shrink-0 bg-surface-card">
        <div className="flex items-center gap-2">
          <ChevronLeft className="w-4 h-4 text-ink" strokeWidth={2.25} />
          <Sparkles className="w-3.5 h-3.5 text-brand" strokeWidth={1.75} />
          <p className="text-[12px] font-semibold text-ink tracking-tight">
            Brainstorm the scene
          </p>
        </div>
        <p className="text-[9px] text-stone-500 mt-1 ml-6">
          A few quick questions, and we'll draft a scene.
        </p>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden px-3 pt-3 pb-2 flex flex-col gap-2 bg-stone-50 relative">
        {snapshot.messages.map((msg, i) => (
          <div key={msg.id}>
            <MessageBubble msg={msg} />
            {i === lastAiIndex && msg.role === 'ai' && snapshot.actions && (
              <ActionRow kind={snapshot.actions} />
            )}
          </div>
        ))}
        <AnimatePresence>{snapshot.typing && <TypingDots />}</AnimatePresence>
      </div>

      {/* Disabled input bar (mirrors the real drawer's footer) */}
      <div className="px-3 py-2.5 border-t border-stone-200 bg-surface-card shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="flex-1 h-7 px-2.5 rounded-md border border-stone-200 bg-white flex items-center text-[10px] text-stone-400">
            Type your answer…
          </div>
          <div className="w-7 h-7 rounded-md bg-brand flex items-center justify-center">
            <Send className="w-3 h-3 text-brand-foreground" strokeWidth={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section ───────────────────────────────────────────────────── */

export function ImagineDescribeShipSection() {
  const reduced = useReducedMotion() ?? false;
  const sectionRef = useRef<HTMLElement>(null);

  // Playback is gated on the section being on screen. Note this is NOT
  // `once: true` any more: the old timeline ran once and stopped on a
  // card, so it only ever needed starting. This one loops, so it also
  // needs STOPPING — otherwise three conversations keep cycling timers
  // forever while the viewer is ten sections away. `amount: 0.2` because
  // the section is tall; demanding more would never trip on a laptop.
  const inView = useInView(sectionRef, { amount: 0.2 });

  // Which conversation, and how far through it.
  const [convIdx, setConvIdx] = useState(0);
  const [snapIdx, setSnapIdx] = useState(0);

  const script = SCRIPTS[convIdx];

  // Advance the snapshot; at the end of a conversation, roll on to the
  // next one and start it over. Pauses off-screen and resumes where it
  // left off.
  useEffect(() => {
    if (reduced || !inView) return;

    const isLast = snapIdx >= script.length - 1;
    const dwell = script[snapIdx].durationMs;

    const t = window.setTimeout(() => {
      if (isLast) {
        setConvIdx((c) => (c + 1) % SCRIPTS.length);
        setSnapIdx(0);
      } else {
        setSnapIdx((i) => i + 1);
      }
    }, dwell);
    return () => window.clearTimeout(t);
  }, [snapIdx, convIdx, script, reduced, inView]);

  // Reduced motion: no typing, no cycling — just show one finished
  // conversation. There's nothing to miss, so it resolves on mount.
  const snapshot = reduced ? script[script.length - 1] : script[snapIdx];

  return (
    <section
      ref={sectionRef}
      className="snap-center relative py-16 md:py-20 lg:py-24"
    >
      <div className="w-full max-w-7xl mx-auto px-6 md:px-10 flex flex-col">
        {/* Headline + subline */}
        <div className="text-center max-w-3xl mx-auto shrink-0">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-5xl font-semibold text-ink tracking-tight leading-[1.05] lg:whitespace-nowrap">
            <span className="block md:inline">Imagine it.</span>{' '}
            <span className="block md:inline">Describe it.</span>{' '}
            <span className="block md:inline">Send it.</span>
          </h2>
          <p className="mt-5 md:mt-6 text-base md:text-lg text-ink-soft leading-relaxed max-w-[48ch] mx-auto">
            Let your imagination run free. Or{' '}
            <span className="relative inline-block font-medium text-ink whitespace-nowrap">
              brainstorm with AI
              <motion.span
                aria-hidden
                className="absolute left-0 right-0 -bottom-0.5 h-[3px] origin-left rounded-full"
                style={{
                  background:
                    'linear-gradient(90deg, #5c57d4 0%, #7a76e8 35%, #a78bfa 50%, #7a76e8 65%, #5c57d4 100%)',
                  backgroundSize: '220% 100%',
                }}
                initial={
                  reduced
                    ? { scaleX: 1, backgroundPosition: '0% 0%' }
                    : { scaleX: 0, backgroundPosition: '0% 0%' }
                }
                animate={
                  reduced
                    ? { scaleX: 1 }
                    : inView
                      ? {
                          scaleX: 1,
                          backgroundPosition: ['0% 0%', '100% 0%', '0% 0%'],
                        }
                      : // Hold un-drawn until the section scrolls into
                        // view, or it draws + sweeps before anyone's there.
                        { scaleX: 0 }
                }
                transition={
                  reduced
                    ? undefined
                    : {
                        scaleX: { duration: 1, delay: 0.9, ease: 'easeOut' },
                        backgroundPosition: {
                          duration: 6,
                          delay: 2,
                          repeat: Infinity,
                          ease: 'linear',
                        },
                      }
                }
              />
            </span>{' '}
            to craft the perfect scene.
          </p>
        </div>

        {/* Stage — just the phone now. The stage used to be a swap
            surface (phone fading out, 3D card fading in), which is why it
            carried an absolute-positioned pair and a min-height big
            enough for both. With the card gone it's a single centred
            child in normal flow. */}
        <div className="mt-6 md:mt-8 lg:mt-10 flex justify-center">
          <PhoneFrame>
            <BrainstormScreen snapshot={snapshot} />
          </PhoneFrame>
        </div>
      </div>
    </section>
  );
}
