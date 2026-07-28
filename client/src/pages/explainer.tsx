// /explainer — THE LAUNCH FILM ("Unbinnable", ~60s, loops).
// Self-playing and built to be screen-recorded: no After Effects, no AI
// video — the app is the animation engine, so the film speaks fluent
// product (real stepper labels, real narration lines, the REAL 3D card).
//
// Full script with production notes: LAUNCH_FILM_SCRIPT.md (delivered in
// chat 2026-07-28). Structure:
//   ACT I    hook → the bin gag ("BINNED BY FRIDAY.")
//   ACT II   the turn ("What if the card… was them?")
//   ACT III  the studio journey — stepper chips tick along the REAL
//            steps while the viewer "makes" a card: who → photo → the
//            accelerating scene→card loop ×3 → words → making (the
//            product's actual generation narration)
//   ACT IV   made real (letterbox drop) → the bin PAYOFF (the Celebrait
//            card bounces off the bin rim → mantel → "UNBINNABLE.")
//   ACT V    the 3D product reveal → sign-off
//
// Recording:  ?format=story (1080×1920) · ?t=N jump to beat · ?still=1
//             freeze · ?nograin=1. Corner ticks sit OUTSIDE the stage as
//             QuickTime drag targets.
// Swapping in daft example cards later: edit SCENE_LOOPS below (front
// image + typed line) — nothing else to touch.
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
const BODY = '#3A342E';
const META = '#645C53';
const VIOLET = '#5c57d4';
const HAIR = '#E5DFD4';

const SRC_PHOTO = '/hero-source-photo.webp';
const CARD_FRONT = '/hero-card-front.webp';
const CARD_INSIDE = '/hero-card-inside.webp';

// The scene→card loop. To swap in a daft card later (see script's
// placeholder advice): change `typed` + `front` here, done.
const SCENE_LOOPS = [
  { typed: 'on a rooftop in New York, at sunset…', front: '/hero-card-front.webp', charMs: 46 },
  { typed: 'under the Northern Lights…', front: '/proof-card-front.webp', charMs: 38 },
  { typed: 'taking over Times Square…', front: '/proof-timessquare-front.webp', charMs: 30 },
];

const WHO_CHIPS = ['Mum — her 60th', 'Dad — retirement', 'Elle — 10 years'];

// The product's REAL generation narration (generation-wait.tsx) — anyone
// who buys will recognise this moment.
const NARRATION = [
  'Analysing your photo',
  'Creating the scene',
  'Rendering the text',
  'Adding the final details',
];

const STEP_LABELS = ['Recipient', 'Photo', 'Scene', 'Front text', 'Inside text', 'Review & send'];

const BIN_CLICHES = ['Another pun about wine.', '£4.29 of glitter.', 'To… From… Bin.', 'Keep calm and… no.'];

// key → duration ms · stepIdx = which stepper chip is lit (null = no stepper)
const BEATS = [
  { key: 'hook', ms: 3400, stepIdx: null },
  { key: 'bin', ms: 5600, stepIdx: null },
  { key: 'turn', ms: 3400, stepIdx: null },
  { key: 'who', ms: 3800, stepIdx: 0 },
  { key: 'photo', ms: 3600, stepIdx: 1 },
  { key: 'scene0', ms: 4600, stepIdx: 2 },
  { key: 'scene1', ms: 4000, stepIdx: 2 },
  { key: 'scene2', ms: 3400, stepIdx: 2 },
  { key: 'words', ms: 4200, stepIdx: 4 },
  { key: 'making', ms: 4200, stepIdx: 5 },
  { key: 'made', ms: 4600, stepIdx: null },
  { key: 'payoff', ms: 5600, stepIdx: null },
  { key: 'product', ms: 6200, stepIdx: null },
  { key: 'signoff', ms: 4600, stepIdx: null },
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
const SPRING_HEAVY = { type: 'spring', stiffness: 260, damping: 22, mass: 1 } as const;

export default function ExplainerPage() {
  const params = new URLSearchParams(window.location.search);
  const story = params.get('format') === 'story';
  const still = params.get('still') === '1';
  const grain = params.get('nograin') !== '1';
  const startAt = Number(params.get('t'));
  const [beat, setBeat] = useState(Number.isFinite(startAt) && startAt >= 0 ? startAt : 0);

  // Visibility-gated beat timer (rAF freezes in hidden tabs; a naive
  // timer would desync the scene from the animation).
  useEffect(() => {
    if (still) return;
    let t: number | undefined;
    const arm = () => {
      window.clearTimeout(t);
      if (document.visibilityState !== 'visible') return;
      t = window.setTimeout(() => setBeat((b) => (b + 1) % BEATS.length), BEATS[beat]?.ms ?? 3000);
    };
    arm();
    document.addEventListener('visibilitychange', arm);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('visibilitychange', arm);
    };
  }, [beat, still]);

  const cfg = BEATS[beat] ?? BEATS[0];
  const key = cfg.key;

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

  const H = story ? '8.6cqw' : '7cqw';
  const SUB = story ? '3.3cqw' : '2.6cqw';

  const sceneIdx = key === 'scene0' ? 0 : key === 'scene1' ? 1 : key === 'scene2' ? 2 : -1;

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
        @keyframes ex-drift { from { transform: scale(1) translateY(0); }
                              to   { transform: scale(1.05) translateY(-1%); } }
        @keyframes ex-wash  { 0% { transform: translate(-4%,-2%) scale(1.1); }
                              50% { transform: translate(4%,2%) scale(1.18); }
                              100% { transform: translate(-4%,-2%) scale(1.1); } }
        @keyframes ex-shimmer { from { background-position: -140% 0; } to { background-position: 240% 0; } }
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
          {/* ambient violet wash — always breathing */}
          <div
            style={{
              position: 'absolute',
              inset: '-20%',
              background: 'radial-gradient(closest-side, rgba(122,118,232,0.15), rgba(122,118,232,0) 70%)',
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
                opacity: 0.09,
                ['--r' as any]: `${ic.rot}deg`,
                animation: `ex-float ${ic.dur}s ease-in-out ${ic.delay}s infinite alternate`,
              }}
            />
          ))}

          {/* ── the real stepper, carrying the journey ── */}
          <AnimatePresence>
            {cfg.stepIdx !== null && (
              <motion.div
                key="stepper"
                initial={{ opacity: 0, y: -18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.6, ease: EASE }}
                style={{
                  position: 'absolute',
                  top: '4.5cqw',
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '1.1cqw',
                  zIndex: 5,
                }}
              >
                {STEP_LABELS.map((label, i) => (
                  <motion.div
                    key={label}
                    animate={{
                      background: i === cfg.stepIdx ? VIOLET : i < (cfg.stepIdx ?? 0) ? '#EDECFA' : '#fff',
                      color: i === cfg.stepIdx ? '#fff' : i < (cfg.stepIdx ?? 0) ? VIOLET : META,
                      scale: i === cfg.stepIdx ? 1.06 : 1,
                    }}
                    transition={{ duration: 0.4 }}
                    style={{
                      fontSize: '1.55cqw',
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      padding: '0.9cqw 1.7cqw',
                      borderRadius: 999,
                      border: `1px solid ${HAIR}`,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* ═══ ACT I ═══ */}
            {key === 'hook' && (
              <Slot key="hook">
                <Kinetic text="Their birthday's coming." size={H} />
                <div style={{ height: '2.2cqw' }} />
                <Kinetic text="You know how this goes." size={H} delay={1.5} color={META} />
              </Slot>
            )}

            {key === 'bin' && <BinGag key="bin" sub={SUB} />}

            {key === 'turn' && (
              <Slot key="turn">
                <Kinetic text="What if the card…" size={H} />
                <div style={{ height: '1.6cqw' }} />
                <Kinetic text="was them?" size={H} delay={0.7} accentFrom={1} />
              </Slot>
            )}

            {/* ═══ ACT III · the journey ═══ */}
            {key === 'who' && (
              <Slot key="who">
                <InputCard label="Who's it for?">
                  <ChipCycler chips={WHO_CHIPS} />
                </InputCard>
                <Fade delay={1.2} size={SUB} top="3.4cqw">
                  Takes a minute. Means a year.
                </Fade>
              </Slot>
            )}

            {key === 'photo' && (
              <Slot key="photo">
                <motion.img
                  src={SRC_PHOTO}
                  alt=""
                  crossOrigin="anonymous"
                  initial={{ opacity: 0, y: 44, rotate: -9, scale: 0.86 }}
                  animate={{ opacity: 1, y: 0, rotate: -2.5, scale: 1 }}
                  transition={{ ...SPRING_HEAVY, delay: 0.15 }}
                  style={{
                    width: '44cqw',
                    borderRadius: '1cqw',
                    border: '0.9cqw solid #fff',
                    boxShadow: '0 18px 44px -16px rgba(33,29,25,0.4)',
                  }}
                />
                <Fade delay={0.9} size={H} top="3.2cqw" color={INK} serif>
                  One photo. Any photo.
                </Fade>
                <Fade delay={1.6} size={SUB} top="1.2cqw">
                  Yes — that one from the pub works.
                </Fade>
              </Slot>
            )}

            {sceneIdx >= 0 && (
              <SceneLoop key={key} loop={SCENE_LOOPS[sceneIdx]} idx={sceneIdx} sub={SUB} />
            )}

            {key === 'words' && (
              <Slot key="words">
                <div style={{ display: 'flex', gap: '2cqw', alignItems: 'center' }}>
                  <motion.img
                    src={CARD_FRONT}
                    alt=""
                    crossOrigin="anonymous"
                    initial={{ x: '30%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.9, ease: EASE }}
                    style={{ width: '31cqw', borderRadius: '1cqw', boxShadow: '0 16px 40px -16px rgba(33,29,25,0.4)' }}
                  />
                  <motion.img
                    src={CARD_INSIDE}
                    alt=""
                    crossOrigin="anonymous"
                    initial={{ x: '-30%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.9, ease: EASE, delay: 0.25 }}
                    style={{ width: '31cqw', borderRadius: '1cqw', boxShadow: '0 16px 40px -16px rgba(33,29,25,0.4)' }}
                  />
                </div>
                <Fade delay={1.1} size={H} top="3.4cqw" color={INK} serif>
                  Your words inside.
                </Fade>
                <Fade delay={1.8} size={SUB} top="1.1cqw">
                  A soppy essay or a one-liner. Both legal.
                </Fade>
              </Slot>
            )}

            {key === 'making' && (
              <Slot key="making">
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.7, ease: EASE }}
                  style={{
                    width: '44cqw',
                    aspectRatio: '1',
                    borderRadius: '1.2cqw',
                    border: `1px solid ${HAIR}`,
                    background: 'linear-gradient(100deg, #efece6 8%, #ffffff 32%, #efece6 56%)',
                    backgroundSize: '260% 100%',
                    animation: 'ex-shimmer 1.7s linear infinite',
                  }}
                />
                <div style={{ marginTop: '3cqw', minHeight: '3.4cqw' }}>
                  <NarrationTicker lines={NARRATION} everyMs={950} size={SUB} />
                </div>
                <Fade delay={2.4} size={SUB} top="1cqw" color={META}>
                  Ninety seconds. Our art department doesn't sleep.
                </Fade>
              </Slot>
            )}

            {/* ═══ ACT IV · the object ═══ */}
            {key === 'made' && (
              <Slot key="made">
                {/* letterbox slot */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                  style={{
                    width: '30cqw',
                    height: '2cqw',
                    borderRadius: 999,
                    background: INK,
                    marginBottom: '2cqw',
                  }}
                />
                <motion.img
                  src={CARD_FRONT}
                  alt=""
                  crossOrigin="anonymous"
                  initial={{ y: '-46cqw', opacity: 0, rotate: -4 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  transition={{ ...SPRING_HEAVY, delay: 0.5 }}
                  style={{
                    width: '38cqw',
                    borderRadius: '0.9cqw',
                    border: '0.5cqw solid #fff',
                    boxShadow: '0 22px 48px -16px rgba(33,29,25,0.5)',
                  }}
                />
                {/* doormat */}
                <div
                  style={{
                    width: '52cqw',
                    height: '3.4cqw',
                    borderRadius: '0.8cqw',
                    background: '#D8CFC0',
                    marginTop: '-1cqw',
                  }}
                />
                <Fade delay={1.4} size={H} top="3cqw" color={INK} serif>
                  Printed. Posted.
                </Fade>
                <Fade delay={2.1} size={SUB} top="1.1cqw">
                  Proper card, proper stock — anywhere in the UK.
                </Fade>
              </Slot>
            )}

            {key === 'payoff' && <PayoffGag key="payoff" sub={SUB} />}

            {/* ═══ ACT V · the reveal ═══ */}
            {key === 'product' && <ProductReveal key="product" H={H} />}

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
                <Fade delay={0.7} size={story ? '3.4cqw' : '2.8cqw'} color={INK} top="2.8cqw" serif>
                  celebrait.co.uk
                </Fade>
                <Fade delay={1.15} size={SUB} top="1.2cqw">
                  £8.99 · printed &amp; posted
                </Fade>
                <Fade delay={1.9} size={story ? '2.6cqw' : '2cqw'} top="3.2cqw" color={META}>
                  Unbinnable greetings cards.
                </Fade>
              </Slot>
            )}
          </AnimatePresence>

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
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'radial-gradient(circle at 50% 46%, rgba(0,0,0,0) 56%, rgba(60,50,35,0.055) 100%)',
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════ beat components ════════════════════════════

/** ACT I beat 1 — cliché cards tumble into the bin, stamp slams. */
function BinGag({ sub }: { sub: string }) {
  return (
    <Slot>
      <div style={{ position: 'relative', width: '64cqw', height: '52cqw' }}>
        {/* the bin — wire silhouette */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '30cqw',
            height: '24cqw',
            borderLeft: `0.55cqw solid ${META}`,
            borderRight: `0.55cqw solid ${META}`,
            borderBottom: `0.55cqw solid ${META}`,
            borderRadius: '0 0 2.6cqw 2.6cqw',
            clipPath: 'polygon(6% 0, 94% 0, 86% 100%, 14% 100%)',
            opacity: 0.75,
          }}
        />
        {BIN_CLICHES.map((line, i) => (
          <motion.div
            key={line}
            initial={{ y: '-40cqw', x: `${(i - 1.5) * 9}cqw`, rotate: (i % 2 ? 1 : -1) * (8 + i * 3), opacity: 0 }}
            animate={{ y: `${18 - i * 2.4}cqw`, rotate: (i % 2 ? -1 : 1) * (5 + i * 2), opacity: 1 }}
            transition={{ ...SPRING_HEAVY, delay: 0.25 + i * 0.4 }}
            style={{
              position: 'absolute',
              left: '50%',
              marginLeft: '-13cqw',
              width: '26cqw',
              padding: '2.2cqw 1.6cqw',
              background: '#fff',
              border: `1px solid ${HAIR}`,
              borderRadius: '0.8cqw',
              boxShadow: '0 10px 26px -12px rgba(33,29,25,0.35)',
              textAlign: 'center',
              fontSize: '1.9cqw',
              color: META,
              filter: 'grayscale(1)',
            }}
          >
            {line}
          </motion.div>
        ))}
        {/* the stamp */}
        <motion.div
          initial={{ scale: 2.6, opacity: 0, rotate: -14 }}
          animate={{ scale: 1, opacity: 1, rotate: -7 }}
          transition={{ ...SPRING, delay: 2.4 }}
          style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            marginLeft: '-24cqw',
            width: '48cqw',
            textAlign: 'center',
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 700,
            fontSize: '6.4cqw',
            letterSpacing: '0.04em',
            color: INK,
            border: `0.7cqw solid ${INK}`,
            borderRadius: '1cqw',
            padding: '1.4cqw 0',
            background: 'rgba(250,248,244,0.85)',
          }}
        >
          BINNED BY FRIDAY.
        </motion.div>
      </div>
      <Fade delay={3.4} size={sub} top="2.6cqw">
        Every card ends up here. Well — almost every card.
      </Fade>
    </Slot>
  );
}

/** ACT IV payoff — clichés fall in again, OUR card bounces off the rim
 *  onto the mantel. The thesis as slapstick. */
function PayoffGag({ sub }: { sub: string }) {
  return (
    <Slot>
      <div style={{ position: 'relative', width: '76cqw', height: '52cqw' }}>
        {/* bin, stage left */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '4cqw',
            width: '24cqw',
            height: '20cqw',
            borderLeft: `0.5cqw solid ${META}`,
            borderRight: `0.5cqw solid ${META}`,
            borderBottom: `0.5cqw solid ${META}`,
            borderRadius: '0 0 2.2cqw 2.2cqw',
            clipPath: 'polygon(6% 0, 94% 0, 86% 100%, 14% 100%)',
            opacity: 0.7,
          }}
        />
        {/* two clichés drop straight in */}
        {["Sorry it's late!", 'Have a good one'].map((line, i) => (
          <motion.div
            key={line}
            initial={{ y: '-36cqw', opacity: 0, rotate: i ? 9 : -7 }}
            animate={{ y: '34cqw', opacity: [0, 1, 1, 0.55], rotate: i ? -6 : 8 }}
            transition={{ duration: 0.9, ease: [0.5, 0, 0.9, 0.6], delay: 0.2 + i * 0.45 }}
            style={{
              position: 'absolute',
              left: '8cqw',
              width: '16cqw',
              padding: '1.6cqw 1cqw',
              background: '#fff',
              border: `1px solid ${HAIR}`,
              borderRadius: '0.7cqw',
              textAlign: 'center',
              fontSize: '1.5cqw',
              color: META,
              filter: 'grayscale(1)',
            }}
          >
            {line}
          </motion.div>
        ))}
        {/* mantel, stage right */}
        <div
          style={{
            position: 'absolute',
            bottom: '10cqw',
            right: '2cqw',
            width: '34cqw',
            height: '2cqw',
            background: INK,
            borderRadius: '0.4cqw',
          }}
        />
        {/* OUR card: falls at the bin, bounces off the rim, lands on the mantel */}
        <motion.img
          src={CARD_FRONT}
          alt=""
          crossOrigin="anonymous"
          initial={{ x: '6cqw', y: '-40cqw', rotate: -8, opacity: 0 }}
          animate={{
            x: ['6cqw', '8cqw', '26cqw', '44cqw'],
            y: ['-40cqw', '18cqw', '-6cqw', '12.5cqw'],
            rotate: [-8, 6, -3, 0],
            opacity: [0, 1, 1, 1],
          }}
          transition={{ duration: 1.7, delay: 1.15, times: [0, 0.38, 0.68, 1], ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: '19cqw',
            borderRadius: '0.8cqw',
            border: '0.45cqw solid #fff',
            boxShadow: '0 16px 36px -12px rgba(33,29,25,0.5)',
          }}
        />
        {/* the violet stamp */}
        <motion.div
          initial={{ scale: 2.4, opacity: 0, rotate: 10 }}
          animate={{ scale: 1, opacity: 1, rotate: 6 }}
          transition={{ ...SPRING, delay: 3.3 }}
          style={{
            position: 'absolute',
            top: '16%',
            right: '2cqw',
            width: '38cqw',
            textAlign: 'center',
            fontFamily: "'Fraunces', Georgia, serif",
            fontWeight: 700,
            fontSize: '5.4cqw',
            letterSpacing: '0.05em',
            color: VIOLET,
            border: `0.65cqw solid ${VIOLET}`,
            borderRadius: '1cqw',
            padding: '1.2cqw 0',
            background: 'rgba(250,248,244,0.88)',
          }}
        >
          UNBINNABLE.
        </motion.div>
      </div>
      <Fade delay={4.1} size={sub} top="2.2cqw">
        Theirs gets recycled. Yours gets the mantelpiece.
      </Fade>
    </Slot>
  );
}

/** ACT III scene loop — the textarea types, commits, the card ERUPTS. */
function SceneLoop({
  loop,
  idx,
  sub,
}: {
  loop: (typeof SCENE_LOOPS)[number];
  idx: number;
  sub: string;
}) {
  const typeMs = loop.typed.length * loop.charMs + 500;
  const cardDelay = (typeMs + 250) / 1000;
  return (
    <Slot>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        style={{
          width: '64cqw',
          background: '#fff',
          border: `1px solid ${HAIR}`,
          borderRadius: '1.3cqw',
          padding: '2.2cqw 2.6cqw',
          textAlign: 'left',
          fontSize: sub,
          color: INK,
          boxShadow: '0 10px 30px -18px rgba(33,29,25,0.25)',
          minHeight: '6cqw',
          zIndex: 2,
        }}
      >
        <span style={{ color: META, marginRight: '0.6cqw' }}>Scene:</span>
        <Typewriter text={loop.typed} startDelay={350} charMs={loop.charMs} />
      </motion.div>
      <motion.img
        src={loop.front}
        alt=""
        crossOrigin="anonymous"
        initial={{ opacity: 0, scale: 0.7, y: 26, filter: 'blur(12px)' }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ ...SPRING_HEAVY, delay: cardDelay }}
        style={{
          width: '46cqw',
          marginTop: '2.6cqw',
          borderRadius: '1.1cqw',
          boxShadow: '0 22px 54px -18px rgba(33,29,25,0.45)',
        }}
      />
      {idx === 0 && (
        <Fade delay={cardDelay + 1} size={sub} top="2cqw">
          Describe anywhere. We paint them in.
        </Fade>
      )}
      {idx === 2 && (
        <Fade delay={cardDelay + 0.9} size={sub} top="2cqw">
          Daft, epic, soppy — all fair game.
        </Fade>
      )}
    </Slot>
  );
}

/** ACT V — the real 3D card assembles ajar, then swings open. */
function ProductReveal({ H }: { H: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setOpen(true), 2100);
    return () => window.clearTimeout(t);
  }, []);
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.7 }}
      style={{ position: 'absolute', inset: 0 }}
    >
      <motion.div
        initial={{ scale: 0.86, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.3, ease: EASE }}
        style={{ position: 'absolute', inset: 0 }}
      >
        <Card3DViewer
          frontImageUrl={CARD_FRONT}
          insideImageUrl={CARD_INSIDE}
          open={open}
          onOpenChange={setOpen}
          enableRotate={false}
          enableZoom={false}
          closedAngle={-0.38}
          restYaw={-0.1}
          framingMargin={2.15}
          className="w-full h-full"
        />
      </motion.div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: '6.5cqw',
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <Kinetic text="Cards they keep." size={H} delay={3.1} />
      </div>
    </motion.div>
  );
}

// ═════════════════════════ shared bits ════════════════════════════════

function Slot({ children, noExit = false }: { children: React.ReactNode; noExit?: boolean }) {
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
        justifyContent: 'center',
        textAlign: 'center',
        padding: '8cqw',
        pointerEvents: 'none',
      }}
    >
      {children}
    </motion.div>
  );
}

/** Word-by-word rise out of clip masks with spring overshoot.
 *  accentFrom: index from which words go violet. */
function Kinetic({
  text,
  size,
  delay = 0,
  stagger = 0.07,
  color = INK,
  accentFrom,
}: {
  text: string;
  size: string;
  delay?: number;
  stagger?: number;
  color?: string;
  accentFrom?: number;
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
              color: accentFrom !== undefined && i >= accentFrom ? VIOLET : color,
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
        letterSpacing: serif ? '-0.015em' : '0.01em',
        fontFamily: serif ? "'Fraunces', Georgia, serif" : undefined,
        fontWeight: serif ? 600 : undefined,
        textShadow: '0 1px 14px rgba(250,248,244,0.9)',
      }}
    >
      {children}
    </motion.div>
  );
}

/** Studio-style white input card. */
function InputCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...SPRING, delay: 0.1 }}
      style={{
        width: '56cqw',
        background: '#fff',
        border: `1px solid ${HAIR}`,
        borderRadius: '1.4cqw',
        padding: '2.6cqw 3cqw',
        boxShadow: '0 12px 34px -18px rgba(33,29,25,0.28)',
        textAlign: 'left',
      }}
    >
      <div style={{ fontSize: '1.8cqw', color: META, marginBottom: '1.4cqw', fontWeight: 600 }}>{label}</div>
      {children}
    </motion.div>
  );
}

/** Cycles chips with a spring swap. */
function ChipCycler({ chips }: { chips: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => (n + 1) % chips.length), 1150);
    return () => window.clearInterval(t);
  }, [chips.length]);
  return (
    <div style={{ height: '4.6cqw', position: 'relative' }}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={i}
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -16, opacity: 0 }}
          transition={SPRING}
          style={{
            display: 'inline-block',
            background: '#EDECFA',
            color: VIOLET,
            fontWeight: 700,
            fontSize: '2.5cqw',
            padding: '0.9cqw 2cqw',
            borderRadius: 999,
          }}
        >
          {chips[i]}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Ticks through the product's real generation narration lines. */
function NarrationTicker({ lines, everyMs, size }: { lines: string[]; everyMs: number; size: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((n) => Math.min(n + 1, lines.length - 1)), everyMs);
    return () => window.clearInterval(t);
  }, [lines.length, everyMs]);
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={i}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
        style={{ fontSize: size, color: INK, fontWeight: 600 }}
      >
        {lines[i]}
        <span style={{ color: VIOLET }}>…</span>
      </motion.div>
    </AnimatePresence>
  );
}

function Typewriter({ text, startDelay = 0, charMs = 55 }: { text: string; startDelay?: number; charMs?: number }) {
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
