// /explainer — a self-playing product explainer, built to be SCREEN
// RECORDED (no After Effects, no AI video). The web app is the animation
// engine: real fonts, real palette, the REAL 3D card. Unlisted route.
//
// Beats (~34s, then it loops after a beat of black):
//   0  Cold open      "Anyone can send a card."
//   1  The photo      an ordinary snapshot lands
//   2  The scene      the description types itself
//   3  The making     shimmer + the card front materialises
//   4  The inside     the card opens (real 3D viewer)
//   5  The object     "Printed. Posted. Kept."
//   6  The sign-off   logo + celebrait.co.uk + £8.99
//
// Recording:
//   ?format=square (default 1080×1080) | ?format=story (1080×1920, Reels/TikTok)
//   ?t=3        jump straight to a beat (for re-shooting one segment)
//   ?still=1    freeze on that beat (poster frames)
// Corner ticks sit OUTSIDE the stage as QuickTime drag targets, exactly
// like /card-capture, so the guide never lands in the recording.
import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card3DViewer } from '@/components/card-3d-viewer';
import celebraitLogo from '@/assets/celebrait.png';
import iconCake from '@/assets/icons/cake.png';
import iconCelebrate from '@/assets/icons/celebrate.png';
import iconHeart from '@/assets/icons/heart.png';
import iconPresent from '@/assets/icons/present.png';
import iconRibbon from '@/assets/icons/ribbon.png';
import iconRing from '@/assets/icons/ring.png';

const PAPER = '#FAF8F4';
const INK = '#211D19';
const META = '#645C53';
const VIOLET = '#5c57d4';

const SRC_PHOTO = '/hero-source-photo.webp';
const CARD_FRONT = '/hero-card-front.webp';
const CARD_INSIDE = '/hero-card-inside.webp';

// Beat durations in ms — the whole script in one editable place.
const BEATS = [
  { key: 'open', ms: 3200 },
  { key: 'photo', ms: 4200 },
  { key: 'scene', ms: 5200 },
  { key: 'making', ms: 4200 },
  { key: 'card', ms: 5000 },
  { key: 'inside', ms: 5200 },
  { key: 'object', ms: 3600 },
  { key: 'signoff', ms: 4200 },
] as const;

const SCENE_TEXT = 'on a rooftop in New York, at sunset…';

const FLOAT_ICONS = [
  { src: iconHeart, left: '6%', top: '10%', size: '5.5%', rot: -12, dur: 11, delay: 0 },
  { src: iconCelebrate, left: '86%', top: '8%', size: '6%', rot: 10, dur: 13, delay: 1.4 },
  { src: iconRing, left: '50%', top: '3%', size: '4.5%', rot: -8, dur: 9, delay: 2.6 },
  { src: iconCake, left: '4%', top: '58%', size: '6.5%', rot: 12, dur: 12, delay: 1.9 },
  { src: iconPresent, left: '88%', top: '74%', size: '7%', rot: -10, dur: 10, delay: 0.6 },
  { src: iconRibbon, left: '9%', top: '86%', size: '5%', rot: 8, dur: 14, delay: 3.4 },
];

const ease = [0.22, 0.9, 0.24, 1] as const;

export default function ExplainerPage() {
  const params = new URLSearchParams(window.location.search);
  const story = params.get('format') === 'story';
  const still = params.get('still') === '1';
  const startAt = Number(params.get('t'));
  const [beat, setBeat] = useState(Number.isFinite(startAt) && startAt >= 0 ? startAt : 0);

  // Drive the script. Loops from the top so one long recording yields
  // several clean takes.
  //
  // PAUSED WHILE HIDDEN: browsers freeze requestAnimationFrame in a
  // background tab, so framer-motion stops mid-transition while a plain
  // timer would happily march on — you'd tab back to a desynced scene
  // (verified: in a hidden pane every motion value sticks at its initial
  // state). Gating the timer on visibility keeps the beat and the
  // animation in lockstep, so alt-tabbing mid-recording just pauses.
  useEffect(() => {
    if (still) return;
    let t: number | undefined;
    const arm = () => {
      window.clearTimeout(t);
      if (document.visibilityState !== 'visible') return;
      const ms = BEATS[beat]?.ms ?? 3000;
      t = window.setTimeout(() => setBeat((b) => (b + 1) % BEATS.length), ms);
    };
    arm();
    document.addEventListener('visibilitychange', arm);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', arm);
    };
  }, [beat, still]);

  const key = BEATS[beat]?.key ?? 'open';
  const stageStyle = useMemo(
    () =>
      story
        ? { width: 'min(52vmin, 620px)', height: 'min(92.4vmin, 1102px)' }
        : { width: 'min(86vmin, 980px)', height: 'min(86vmin, 980px)' },
    [story],
  );

  const TICK = 26;
  const tick = (v: 'top' | 'bottom', h: 'left' | 'right') => ({
    position: 'absolute' as const,
    width: TICK,
    height: TICK,
    [v]: -(TICK + 6),
    [h]: -(TICK + 6),
    [`border${v[0].toUpperCase()}${v.slice(1)}`]: '3px solid #C9C2B6',
    [`border${h[0].toUpperCase()}${h.slice(1)}`]: '3px solid #C9C2B6',
    borderRadius: 2,
  });

  // Type scales off the stage width (cqw) so square and story both look
  // right at any recording size. Sized BIG on purpose — social video is
  // watched thumb-sized, and timid headlines read as a slide deck.
  const H = story ? '9.2cqw' : '7.4cqw';
  const SUB = story ? '3.6cqw' : '2.8cqw';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#EDE7DC',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'none',
      }}
    >
      <style>{`
        @keyframes ex-float { from { transform: translateY(-7px) rotate(var(--r)); }
                              to   { transform: translateY(7px) rotate(calc(var(--r) + 4deg)); } }
        @keyframes ex-shimmer { from { background-position: -140% 0; } to { background-position: 240% 0; } }
        @keyframes ex-caret { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
      `}</style>

      <div style={{ position: 'relative', ...stageStyle }}>
        <div style={tick('top', 'left')} />
        <div style={tick('top', 'right')} />
        <div style={tick('bottom', 'left')} />
        <div style={tick('bottom', 'right')} />

        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: PAPER,
            overflow: 'hidden',
            containerType: 'inline-size',
            boxShadow: '0 24px 80px -32px rgba(33,29,25,0.28)',
            fontFamily: "'Figtree', system-ui, sans-serif",
          }}
        >
          {/* Ambient brand motif */}
          {FLOAT_ICONS.map((ic, i) => (
            <img
              key={i}
              src={ic.src}
              alt=""
              style={{
                position: 'absolute',
                left: ic.left,
                top: ic.top,
                width: ic.size,
                opacity: 0.1,
                ['--r' as any]: `${ic.rot}deg`,
                animation: `ex-float ${ic.dur}s ease-in-out ${ic.delay}s infinite alternate`,
              }}
            />
          ))}

          <AnimatePresence mode="wait">
            {/* ── 0 · COLD OPEN ─────────────────────────────────── */}
            {key === 'open' && (
              <Center key="open">
                <Line delay={0.1} size={H}>Anyone can send</Line>
                <Line delay={0.45} size={H}>a card.</Line>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.5, duration: 0.8 }}
                  style={{ marginTop: '3cqw', fontSize: SUB, color: META, letterSpacing: '0.02em' }}
                >
                  Send one they couldn't get anywhere else.
                </motion.div>
              </Center>
            )}

            {/* ── 1 · THE PHOTO ─────────────────────────────────── */}
            {key === 'photo' && (
              <Center key="photo">
                <Eyebrow>Step one</Eyebrow>
                <Line delay={0.15} size={H}>Start with a photo.</Line>
                <motion.img
                  src={SRC_PHOTO}
                  alt=""
                  crossOrigin="anonymous"
                  initial={{ opacity: 0, y: 26, rotate: -3, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, rotate: -2, scale: 1 }}
                  transition={{ delay: 0.6, duration: 1, ease }}
                  style={{
                    marginTop: '3.4cqw',
                    width: '46cqw',
                    borderRadius: '1cqw',
                    boxShadow: '0 18px 44px -18px rgba(33,29,25,0.35)',
                    border: '0.9cqw solid #fff',
                  }}
                />
              </Center>
            )}

            {/* ── 2 · THE SCENE (types itself) ──────────────────── */}
            {key === 'scene' && (
              <Center key="scene">
                <Eyebrow>Step two</Eyebrow>
                <Line delay={0.15} size={H}>Describe the moment.</Line>
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.6, ease }}
                  style={{
                    marginTop: '3.4cqw',
                    width: '72cqw',
                    background: '#fff',
                    border: '1px solid #E5DFD4',
                    borderRadius: '1.4cqw',
                    padding: '2.6cqw 3cqw',
                    textAlign: 'left',
                    fontSize: SUB,
                    color: INK,
                    boxShadow: '0 10px 30px -18px rgba(33,29,25,0.25)',
                    minHeight: '7cqw',
                  }}
                >
                  <Typewriter text={SCENE_TEXT} startDelay={1100} charMs={52} />
                </motion.div>
              </Center>
            )}

            {/* ── 3 · THE MAKING ────────────────────────────────── */}
            {key === 'making' && (
              <Center key="making">
                <Line delay={0.1} size={H}>We paint them in.</Line>
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5, duration: 0.7, ease }}
                  style={{
                    marginTop: '4cqw',
                    width: '52cqw',
                    aspectRatio: '1',
                    borderRadius: '1.2cqw',
                    background:
                      'linear-gradient(100deg, #efece6 8%, #ffffff 32%, #efece6 56%)',
                    backgroundSize: '260% 100%',
                    animation: 'ex-shimmer 1.9s linear infinite',
                    border: '1px solid #E5DFD4',
                  }}
                />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.4, duration: 0.7 }}
                  style={{ marginTop: '2.6cqw', fontSize: SUB, color: META }}
                >
                  Their face. Your scene. One picture.
                </motion.div>
              </Center>
            )}

            {/* ── 4 · THE CARD ARRIVES ──────────────────────────── */}
            {key === 'card' && (
              <Center key="card">
                <motion.img
                  src={CARD_FRONT}
                  alt=""
                  crossOrigin="anonymous"
                  initial={{ opacity: 0, scale: 0.9, filter: 'blur(14px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  transition={{ duration: 1.3, ease }}
                  style={{
                    width: '58cqw',
                    borderRadius: '1.2cqw',
                    boxShadow: '0 26px 60px -22px rgba(33,29,25,0.42)',
                  }}
                />
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.5, duration: 0.8, ease }}
                  style={{
                    marginTop: '3.2cqw',
                    fontFamily: "'Fraunces', Georgia, serif",
                    fontSize: H,
                    color: INK,
                    fontWeight: 600,
                    letterSpacing: '-0.015em',
                  }}
                >
                  There they are.
                </motion.div>
              </Center>
            )}

            {/* ── 5 · THE INSIDE (real 3D card) ─────────────────── */}
            {key === 'inside' && (
              <motion.div
                key="inside"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
                style={{ position: 'absolute', inset: 0 }}
              >
                <div style={{ position: 'absolute', inset: 0 }}>
                  <Card3DViewer
                    frontImageUrl={CARD_FRONT}
                    insideImageUrl={CARD_INSIDE}
                    open
                    instantOpen={false}
                    enableRotate={false}
                    enableZoom={false}
                    closedAngle={-0.38}
                    restYaw={-0.1}
                    framingMargin={2.15}
                    className="w-full h-full"
                  />
                </div>
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 2.4, duration: 0.9, ease }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: '7cqw',
                    textAlign: 'center',
                    fontSize: SUB,
                    color: META,
                  }}
                >
                  Your words inside. However you want to say it.
                </motion.div>
              </motion.div>
            )}

            {/* ── 6 · THE OBJECT ────────────────────────────────── */}
            {key === 'object' && (
              <Center key="object">
                <Line delay={0.05} size={H}>Printed.</Line>
                <Line delay={0.45} size={H}>Posted.</Line>
                <Line delay={0.85} size={H} color={VIOLET}>Kept.</Line>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.6, duration: 0.8 }}
                  style={{ marginTop: '3cqw', fontSize: SUB, color: META }}
                >
                  A real card, through their door — anywhere in the UK.
                </motion.div>
              </Center>
            )}

            {/* ── 7 · SIGN-OFF ──────────────────────────────────── */}
            {key === 'signoff' && (
              <Center key="signoff">
                <motion.img
                  src={celebraitLogo}
                  alt="Celebrait"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, ease }}
                  style={{ width: '40cqw' }}
                />
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8, duration: 0.8 }}
                  style={{
                    marginTop: '3cqw',
                    fontFamily: "'Fraunces', Georgia, serif",
                    fontSize: story ? '3.4cqw' : '2.8cqw',
                    color: INK,
                  }}
                >
                  celebrait.co.uk
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.3, duration: 0.8 }}
                  style={{ marginTop: '1.4cqw', fontSize: SUB, color: META }}
                >
                  £8.99 · printed &amp; posted
                </motion.div>
              </Center>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── bits ──────────────────────────────────────────────────────────────
function Center({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.5 }}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '8cqw',
      }}
    >
      {children}
    </motion.div>
  );
}

function Line({
  children,
  delay = 0,
  size,
  color = INK,
}: {
  children: React.ReactNode;
  delay?: number;
  size: string;
  color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.85, ease }}
      style={{
        fontFamily: "'Fraunces', Georgia, serif",
        fontWeight: 600,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: '-0.02em',
        color,
      }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      style={{
        fontSize: '1.7cqw',
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        color: VIOLET,
        marginBottom: '2cqw',
        fontWeight: 600,
      }}
    >
      {children}
    </motion.div>
  );
}

function Typewriter({
  text,
  startDelay = 0,
  charMs = 55,
}: {
  text: string;
  startDelay?: number;
  charMs?: number;
}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    let i = 0;
    let iv: number;
    const start = window.setTimeout(() => {
      iv = window.setInterval(() => {
        i += 1;
        setN(i);
        if (i >= text.length) window.clearInterval(iv);
      }, charMs);
    }, startDelay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(iv);
    };
  }, [text, startDelay, charMs]);
  return (
    <span>
      {text.slice(0, n)}
      <span style={{ animation: 'ex-caret 1s step-end infinite', color: VIOLET }}>|</span>
    </span>
  );
}
