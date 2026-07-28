// /explainer — a self-playing product film, built to be SCREEN RECORDED
// (no After Effects, no AI video). The app is the animation engine, so
// it uses the real fonts, the real palette and the REAL 3D card.
//
// DESIGN RULES (v2 — v1 was a slide deck of fades, which read as basic):
//  1. NOTHING IS EVER STATIC. Every beat has a slow push/drift, so the
//     frame always breathes.
//  2. THE SUBJECT PERSISTS. The photo doesn't fade out so a card can
//     fade in — it IS the card: one framed object held across beats
//     while its CONTENT transforms. That's the product's promise, shown
//     rather than described.
//  3. THE HERO SHOT IS A WIPE. A travelling light-edge sweeps across the
//     frame and the ordinary photo becomes the painted card art beneath
//     it. Same box, same framing → reads as transformation, not a cut.
//  4. TYPE IS KINETIC. Word-by-word stagger with spring overshoot and
//     clip-path mask reveals — never a plain opacity fade.
//  5. BEATS OVERLAP. Outgoing type leaves while incoming arrives.
//
// Recording:
//   ?format=story  1080×1920 (Reels/TikTok) · default is 1080×1080
//   ?t=N           jump to a beat (re-shoot one segment)
//   ?still=1       freeze (poster frames)
//   ?nograin=1     drop the grain layer (if it moirés on your display)
// Corner ticks sit OUTSIDE the stage as QuickTime drag targets.
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

// The script. Durations are the only timing dial you need.
const BEATS = [
  { key: 'hook', ms: 3400 },     // kinetic hook, frame empty
  { key: 'photo', ms: 3600 },    // the ordinary photo lands + holds
  { key: 'transform', ms: 4200 }, // ★ the wipe: photo → painted art
  { key: 'reveal', ms: 3400 },   // hold on the art, name what happened
  { key: 'card', ms: 5200 },     // it's a real card — 3D, opens
  { key: 'post', ms: 3600 },     // printed / posted / kept
  { key: 'signoff', ms: 4000 },  // logo + url + price
] as const;

const FLOAT_ICONS = [
  { src: iconHeart, left: '5%', top: '11%', size: '5.5%', rot: -12, dur: 11, delay: 0 },
  { src: iconCelebrate, left: '87%', top: '9%', size: '6%', rot: 10, dur: 13, delay: 1.4 },
  { src: iconRing, left: '49%', top: '2%', size: '4.5%', rot: -8, dur: 9, delay: 2.6 },
  { src: iconCake, left: '3%', top: '60%', size: '6.5%', rot: 12, dur: 12, delay: 1.9 },
  { src: iconPresent, left: '89%', top: '76%', size: '7%', rot: -10, dur: 10, delay: 0.6 },
  { src: iconRibbon, left: '8%', top: '87%', size: '5%', rot: 8, dur: 14, delay: 3.4 },
];

const EASE = [0.22, 0.9, 0.24, 1] as const;
const SPRING = { type: 'spring', stiffness: 420, damping: 26, mass: 0.7 } as const;

export default function ExplainerPage() {
  const params = new URLSearchParams(window.location.search);
  const story = params.get('format') === 'story';
  const still = params.get('still') === '1';
  const grain = params.get('nograin') !== '1';
  const startAt = Number(params.get('t'));
  const [beat, setBeat] = useState(Number.isFinite(startAt) && startAt >= 0 ? startAt : 0);

  // Beat timer, gated on visibility: browsers freeze rAF in a hidden
  // tab, so framer-motion stalls while a naive timer marches on and
  // desyncs the scene. Alt-tabbing mid-recording now just pauses.
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

  const key = BEATS[beat]?.key ?? 'hook';
  const stageStyle = useMemo(
    () =>
      story
        ? { width: 'min(52vmin, 620px)', height: 'min(92.4vmin, 1102px)' }
        : { width: 'min(86vmin, 980px)', height: 'min(86vmin, 980px)' },
    [story],
  );

  // Which beats show the framed subject, and what it's showing.
  const framed = key === 'photo' || key === 'transform' || key === 'reveal';
  const wiping = key === 'transform' || key === 'reveal';
  const artOnly = key === 'reveal';

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

  const H = story ? '9.2cqw' : '7.4cqw';
  const SUB = story ? '3.4cqw' : '2.7cqw';

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
        @keyframes ex-caret { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        /* Continuous ambient push — nothing on screen is ever still. */
        @keyframes ex-drift { from { transform: scale(1) translateY(0); }
                              to   { transform: scale(1.055) translateY(-1.2%); } }
        @keyframes ex-wash  { 0%   { transform: translate(-4%, -2%) scale(1.1); }
                              50%  { transform: translate(4%, 2%) scale(1.18); }
                              100% { transform: translate(-4%, -2%) scale(1.1); } }
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
          {/* Slow violet wash — depth behind everything, always moving */}
          <div
            style={{
              position: 'absolute',
              inset: '-20%',
              background:
                'radial-gradient(closest-side, rgba(122,118,232,0.16), rgba(122,118,232,0) 70%)',
              animation: 'ex-wash 18s ease-in-out infinite',
              pointerEvents: 'none',
            }}
          />

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

          {/* ── THE PERSISTENT SUBJECT ─────────────────────────────
              One framed object across three beats. It doesn't cut —
              its CONTENT transforms under a travelling light edge. */}
          <AnimatePresence>
            {framed && (
              <motion.div
                key="frame"
                initial={{ opacity: 0, scale: 0.82, y: 34, rotate: -2.5 }}
                animate={{
                  opacity: 1,
                  scale: wiping ? 1.04 : 1,
                  y: wiping ? '-6%' : 0,
                  rotate: wiping ? 0 : -1.6,
                }}
                exit={{ opacity: 0, scale: 1.12, filter: 'blur(10px)' }}
                transition={{ duration: 1.1, ease: EASE }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  x: '-50%',
                  y: '-50%',
                  width: '58cqw',
                  aspectRatio: '1',
                  borderRadius: '1.2cqw',
                  overflow: 'hidden',
                  background: '#fff',
                  border: '0.85cqw solid #fff',
                  boxShadow: '0 24px 60px -20px rgba(33,29,25,0.4)',
                }}
              >
                {/* Ordinary photo — the "before", always drifting */}
                <img
                  src={SRC_PHOTO}
                  alt=""
                  crossOrigin="anonymous"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    animation: 'ex-drift 9s ease-in-out infinite alternate',
                  }}
                />
                {/* Painted card art — revealed by the wipe */}
                <motion.img
                  src={CARD_FRONT}
                  alt=""
                  crossOrigin="anonymous"
                  initial={{ clipPath: 'inset(0 100% 0 0)' }}
                  animate={{ clipPath: artOnly ? 'inset(0 0% 0 0)' : wiping ? 'inset(0 0% 0 0)' : 'inset(0 100% 0 0)' }}
                  transition={{ duration: artOnly ? 0 : 1.8, ease: [0.65, 0, 0.35, 1], delay: artOnly ? 0 : 0.5 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    animation: 'ex-drift 9s ease-in-out infinite alternate',
                  }}
                />
                {/* The travelling light edge that does the transforming */}
                {key === 'transform' && (
                  <motion.div
                    initial={{ left: '-6%', opacity: 0 }}
                    animate={{ left: '104%', opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 1.8, ease: [0.65, 0, 0.35, 1], delay: 0.5, times: [0, 0.1, 0.85, 1] }}
                    style={{
                      position: 'absolute',
                      top: '-10%',
                      bottom: '-10%',
                      width: '9%',
                      background:
                        'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.95) 45%, rgba(122,118,232,0.85) 60%, rgba(255,255,255,0) 100%)',
                      filter: 'blur(2px)',
                      mixBlendMode: 'screen',
                    }}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── KINETIC TYPE ───────────────────────────────────────── */}
          <AnimatePresence mode="wait">
            {key === 'hook' && (
              <Slot key="hook">
                <Kinetic text="Anyone can send" size={H} />
                <Kinetic text="a card." size={H} delay={0.34} color={VIOLET} />
                <Fade delay={1.5} size={SUB} top="2.6cqw">
                  Send one they could only get from you.
                </Fade>
              </Slot>
            )}

            {key === 'photo' && (
              <Slot key="photo" bottom>
                <Fade delay={0.5} size={SUB} color={INK}>
                  It starts with a photo you already have.
                </Fade>
              </Slot>
            )}

            {key === 'transform' && (
              <Slot key="transform" bottom>
                <Fade delay={1.9} size={SUB} color={INK}>
                  We paint them into the moment.
                </Fade>
              </Slot>
            )}

            {key === 'reveal' && (
              <Slot key="reveal" bottom>
                <Kinetic text="There they are." size={H} stagger={0.05} />
              </Slot>
            )}

            {key === 'card' && (
              <motion.div
                key="card"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
                style={{ position: 'absolute', inset: 0 }}
              >
                <motion.div
                  initial={{ scale: 0.88, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1.2, ease: EASE }}
                  style={{ position: 'absolute', inset: 0 }}
                >
                  <Card3DViewer
                    frontImageUrl={CARD_FRONT}
                    insideImageUrl={CARD_INSIDE}
                    open
                    enableRotate={false}
                    enableZoom={false}
                    closedAngle={-0.38}
                    restYaw={-0.1}
                    framingMargin={2.2}
                    className="w-full h-full"
                  />
                </motion.div>
                <Slot bottom noExit>
                  <Fade delay={2.2} size={SUB} color={INK}>
                    A real card — with your words inside.
                  </Fade>
                </Slot>
              </motion.div>
            )}

            {key === 'post' && (
              <Slot key="post">
                <Kinetic text="Printed." size={H} />
                <Kinetic text="Posted." size={H} delay={0.28} />
                <Kinetic text="Kept." size={H} delay={0.56} color={VIOLET} />
                <Fade delay={1.5} size={SUB} top="2.6cqw">
                  Through their door, anywhere in the UK.
                </Fade>
              </Slot>
            )}

            {key === 'signoff' && (
              <Slot key="signoff">
                <motion.img
                  src={celebraitLogo}
                  alt="Celebrait"
                  initial={{ opacity: 0, y: 22, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ ...SPRING, delay: 0.1 }}
                  style={{ width: '42cqw' }}
                />
                <Fade delay={0.7} size={story ? '3.4cqw' : '2.8cqw'} color={INK} top="2.6cqw" serif>
                  celebrait.co.uk
                </Fade>
                <Fade delay={1.15} size={SUB} top="1.2cqw">
                  £8.99 · printed &amp; posted
                </Fade>
              </Slot>
            )}
          </AnimatePresence>

          {/* Film grain — kills the flat "web page" look on video */}
          {grain && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                opacity: 0.055,
                mixBlendMode: 'multiply',
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
              }}
            />
          )}

          {/* Vignette */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background:
                'radial-gradient(circle at 50% 46%, rgba(0,0,0,0) 56%, rgba(60,50,35,0.055) 100%)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── bits ──────────────────────────────────────────────────────────────

/** A centred (or bottom-anchored) type slot that overlaps its
 *  neighbours — outgoing lines leave as incoming arrive. */
function Slot({
  children,
  bottom = false,
  noExit = false,
}: {
  children: React.ReactNode;
  bottom?: boolean;
  noExit?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={noExit ? undefined : { opacity: 0, y: -14, transition: { duration: 0.42 } }}
      transition={{ duration: 0.4 }}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: bottom ? 'flex-end' : 'center',
        textAlign: 'center',
        padding: bottom ? '0 8cqw 7cqw' : '8cqw',
        pointerEvents: 'none',
      }}
    >
      {children}
    </motion.div>
  );
}

/** Word-by-word reveal: each word rises out of a clip mask with a
 *  spring overshoot. The reason the film doesn't read as a slide deck. */
function Kinetic({
  text,
  size,
  delay = 0,
  stagger = 0.07,
  color = INK,
}: {
  text: string;
  size: string;
  delay?: number;
  stagger?: number;
  color?: string;
}) {
  const words = text.split(' ');
  return (
    <div style={{ display: 'flex', gap: '0.28em', justifyContent: 'center', flexWrap: 'wrap' }}>
      {words.map((w, i) => (
        <span key={i} style={{ overflow: 'hidden', display: 'inline-block', paddingBottom: '0.06em' }}>
          <motion.span
            initial={{ y: '108%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{ ...SPRING, delay: delay + i * stagger }}
            style={{
              display: 'inline-block',
              fontFamily: "'Fraunces', Georgia, serif",
              fontWeight: 600,
              fontSize: size,
              lineHeight: 1.06,
              letterSpacing: '-0.022em',
              color,
            }}
          >
            {w}
          </motion.span>
        </span>
      ))}
    </div>
  );
}

function Fade({
  children,
  delay = 0,
  size,
  color = META,
  top,
  serif = false,
}: {
  children: React.ReactNode;
  delay?: number;
  size: string;
  color?: string;
  top?: string;
  serif?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.85, ease: EASE, delay }}
      style={{
        marginTop: top,
        fontSize: size,
        color,
        letterSpacing: serif ? '-0.01em' : '0.01em',
        fontFamily: serif ? "'Fraunces', Georgia, serif" : undefined,
        textShadow: '0 1px 14px rgba(250,248,244,0.9)',
      }}
    >
      {children}
    </motion.div>
  );
}
