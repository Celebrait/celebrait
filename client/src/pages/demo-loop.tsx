// client/src/pages/demo-loop.tsx — THE DEMO REEL, AS A TEMPLATE
//
// What plays in the home page's phone: the journey, told by us, end to
// end, with a camera that never stops moving (Aidan 2026-09-22: "rework
// it as a template… show the steps and zoom in, out, fluid… enough time
// to digest"). Not a replay of taps — a directed cut of one saved run.
//
// THE TEMPLATE IS THE `SHOTS` LIST BELOW. Each shot is one step:
//   cap   the line at the top, in our voice
//   ms    how long it holds
//   cam   [from, to] — the camera drifts between them for the whole
//         shot, so the move is continuous rather than a cut
//   only  'cameo' — skipped when the featured run has no photo
// Reorder, retime or reword by editing that list; nothing else needs to
// change. Scale > 1 pushes in, < 1 pulls back; x/y are px on the stage.
//
// The cards come from the run an admin featured (Demo runs → "Feature on
// the home page"), so it costs nothing, can't fail live, and every loop
// is identical. Public, no chrome, ignores the pointer.

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2 } from 'lucide-react';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { EMBED_GLOW } from '@/components/phone-mockup';
import celebraitLogo from '@/assets/celebrait.webp';

interface Reel {
  fronts: string[]; picked: number; cameo: string | null; inside: string | null;
  photo: string | null; who: string; chips: string[];
}
type Cam = { s: number; x?: number; y?: number };
type ShotKey = 'brief' | 'gen' | 'three' | 'pick' | 'cameo' | 'open' | 'post';

const SHOTS: Array<{ k: ShotKey; ms: number; cap: string; cam: [Cam, Cam]; only?: 'cameo' }> = [
  { k: 'brief', ms: 2600, cap: 'Tell us about them', cam: [{ s: 1.08, y: 10 }, { s: 1.0, y: 0 }] },
  { k: 'gen', ms: 2000, cap: 'We write and draw three', cam: [{ s: 1.0 }, { s: 1.1 }] },
  { k: 'three', ms: 3000, cap: 'Three made for them', cam: [{ s: 0.94 }, { s: 1.02 }] },
  { k: 'pick', ms: 2000, cap: 'Pick your favourite', cam: [{ s: 1.0 }, { s: 1.14 }] },
  { k: 'cameo', ms: 2600, cap: 'Put them in it', cam: [{ s: 1.12 }, { s: 1.0 }], only: 'cameo' },
  { k: 'open', ms: 3000, cap: 'Open it', cam: [{ s: 1.06 }, { s: 0.96 }] },
  { k: 'post', ms: 2800, cap: 'We print it and post it', cam: [{ s: 1.0 }, { s: 1.07 }] },
];
const GAP_MS = 700;   // the breath before it starts again
const FADE = 0.45;    // how long content takes to change hands

const EASE = [0.22, 1, 0.36, 1] as const;
const DRIFT = [0.4, 0, 0.6, 1] as const;
const OCCASION_LABEL: Record<string, string> = { birthday: 'Birthday', christmas: 'Christmas', anniversary: 'Anniversary', wedding: 'Wedding' };
const ord = (n: string) => `${n}${n.endsWith('1') && n !== '11' ? 'st' : n.endsWith('2') && n !== '12' ? 'nd' : n.endsWith('3') && n !== '13' ? 'rd' : 'th'}`;

function reelFromRun(run: any): Reel {
  const b = (run?.brief ?? {}) as Record<string, string>;
  const who = String(b.who ?? 'them');
  const age = String(b.age ?? '').replace(/\D/g, '');
  const occ = OCCASION_LABEL[String(b.occasion ?? '')] ?? String(b.occasion ?? '');
  const thing = String(b.thing ?? '').trim();
  const chips = [who, age && occ ? `${ord(age)} ${occ}` : occ, thing]
    .filter(Boolean)
    .map((t) => (t.length > 44 ? `${t.slice(0, 42)}…` : t));
  return {
    fronts: Array.isArray(run?.frontUrls) ? run.frontUrls : [],
    picked: typeof run?.picked_index === 'number' ? run.picked_index : 0,
    cameo: run?.cameoUrl ?? null, inside: run?.insideUrl ?? null, photo: run?.photoUrl ?? null,
    who, chips,
  };
}

/** Decode every image before the first loop, so no shot lands empty. */
function useReady(urls: string[]): boolean {
  const [ready, setReady] = useState(false);
  const key = urls.join('|');
  useEffect(() => {
    if (!urls.length) return;
    let off = false;
    Promise.all(urls.map((u) => new Promise<void>((res) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { (im.decode ? im.decode() : Promise.resolve()).then(() => res(), () => res()); };
      im.onerror = () => res();
      im.src = u;
    }))).then(() => { if (!off) setReady(true); });
    return () => { off = true; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return ready;
}

const card = 'overflow-hidden rounded-[6px] object-cover shadow-[2px_5px_16px_rgba(33,29,25,.18),10px_18px_38px_-14px_rgba(33,29,25,.28)]';

/** A card that opens on its left edge, like the catalogue tiles. */
function OpeningCard({ front, inside }: { front: string; inside: string | null }) {
  return (
    <div className="relative aspect-square w-[76%] max-w-[250px]" style={{ perspective: 1100 }}>
      <div className={`absolute inset-0 bg-[#FFFDF8] ${card}`}>
        {inside && <img src={inside} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />}
      </div>
      <motion.div className={`absolute inset-0 origin-left bg-white ${card}`}
        style={{ transformStyle: 'preserve-3d' }}
        initial={{ rotateY: -16 }} animate={{ rotateY: -158 }}
        transition={{ duration: 1.5, delay: 0.5, ease: EASE }}>
        <img src={front} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-black/10" />
      </motion.div>
    </div>
  );
}

export default function DemoLoopPage() {
  const [reel, setReel] = useState<Reel | null>(null);
  const [i, setI] = useState(0);
  const [take, setTake] = useState(0);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    let off = false;
    fetch('/api/demo-runs/featured', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!off && j?.run) setReel(reelFromRun(j.run)); })
      .catch(() => undefined);
    return () => { off = true; };
  }, []);

  const urls = useMemo(() => (reel ? [...reel.fronts, reel.cameo, reel.inside, reel.photo].filter(Boolean) as string[] : []), [reel]);
  const ready = useReady(urls);
  const shots = useMemo(() => SHOTS.filter((s) => s.only !== 'cameo' || !!(reel?.cameo && reel?.photo)), [reel]);
  const chosen = reel ? (reel.fronts[reel.picked] ?? reel.fronts[0]) : null;
  const final = reel ? (reel.cameo ?? chosen) : null;

  // The timeline: one shot after another, then round again.
  useEffect(() => {
    if (!reel || !ready || !shots.length) return;
    const clear = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };
    clear();
    setI(0);
    let t = 0;
    shots.forEach((s, n) => { timers.current.push(window.setTimeout(() => setI(n), t)); t += s.ms; });
    timers.current.push(window.setTimeout(() => setTake((k) => k + 1), t + GAP_MS));
    return clear;
  }, [reel, ready, shots, take]);

  const shot = shots[i] ?? SHOTS[0];

  // Tell the phone when to glow, and with what.
  useEffect(() => {
    if (!reel || !ready || window.parent === window) return;
    const lit = shot.k === 'three' || shot.k === 'pick' || shot.k === 'cameo' || shot.k === 'open' || shot.k === 'post';
    window.parent.postMessage({ type: EMBED_GLOW, color: lit ? '#e8dcc6' : null }, window.location.origin);
  }, [shot.k, reel, ready]);

  if (!reel || !ready || !chosen) return <div className="fixed inset-0 bg-keeper-paper" />;

  const body: Record<ShotKey, ReactNode> = {
    brief: (
      <div className="flex w-full flex-col items-center gap-2.5 px-7">
        <p className="mb-1 font-display text-[20px] font-bold text-keeper-ink">A card for {reel.who}</p>
        {reel.chips.map((c, n) => (
          <motion.span key={c} initial={{ opacity: 0, y: 12, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.25 + n * 0.28, duration: 0.4, ease: EASE }}
            className="rounded-full border border-brand/30 bg-brand-muted px-4 py-1.5 text-center text-[14px] font-medium text-brand-dark">{c}</motion.span>
        ))}
      </div>
    ),
    gen: (
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-7 w-7 animate-spin text-brand" strokeWidth={2.5} />
        <p className="-mt-1 max-w-[270px] text-center text-[17px] font-medium text-keeper-ink">Writing and drawing three for {reel.who}</p>
      </div>
    ),
    three: (
      <div className="flex w-full items-center justify-center gap-2 px-4">
        {reel.fronts.slice(0, 3).map((u, n) => (
          <motion.img key={u} src={u} alt="" crossOrigin="anonymous" className={`w-[30%] aspect-square ${card}`}
            initial={{ opacity: 0, y: 26, rotate: (n - 1) * 5 }}
            animate={{ opacity: 1, y: 0, rotate: (n - 1) * 4 }}
            transition={{ delay: 0.15 + n * 0.22, duration: 0.55, ease: EASE }} />
        ))}
      </div>
    ),
    pick: (
      <div className="relative aspect-square w-[70%] max-w-[240px]">
        <motion.img src={chosen} alt="" crossOrigin="anonymous" className={`h-full w-full ${card}`}
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5, ease: EASE }} />
        <motion.span className="absolute -inset-1.5 rounded-[10px] border-[3px] border-brand"
          initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.45, duration: 0.5, ease: EASE }} />
      </div>
    ),
    cameo: (
      <div className="relative aspect-square w-[70%] max-w-[240px]">
        {/* their photo, dissolving into the card with them in it */}
        <motion.img src={reel.photo ?? ''} alt="" crossOrigin="anonymous" className={`absolute inset-0 h-full w-full ${card}`}
          initial={{ opacity: 1, scale: 1.04 }} animate={{ opacity: 0, scale: 1 }} transition={{ delay: 0.9, duration: 0.8, ease: 'easeInOut' }} />
        <motion.img src={reel.cameo ?? ''} alt="" crossOrigin="anonymous" className={`absolute inset-0 h-full w-full ${card}`}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 0.8, ease: 'easeInOut' }} />
      </div>
    ),
    open: <OpeningCard front={final ?? chosen} inside={reel.inside} />,
    post: (
      <div className="relative h-full w-full">
        <motion.img src={final ?? chosen} alt="" crossOrigin="anonymous"
          className={`absolute left-1/2 top-1/2 w-[58%] max-w-[210px] aspect-square ${card}`}
          initial={{ x: '-50%', y: '-50%', rotate: -3 }}
          animate={{ x: ['-50%', '-50%', '44%'], y: ['-50%', '-46%', '-210%'], rotate: [-3, -5, 24], scale: [1, 1.02, 0.4], opacity: [1, 1, 0] }}
          transition={{ duration: 1.5, times: [0, 0.3, 1], ease: ['easeOut', [0.5, 0, 0.9, 0.4]] }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3.5 px-8 text-center">
          <motion.span className="flex h-16 w-16 items-center justify-center rounded-full bg-cta text-cta-foreground"
            initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 1.2, duration: 0.5, ease: EASE }}>
            <Check className="h-9 w-9" strokeWidth={3} />
          </motion.span>
          <motion.p className="font-display text-[21px] font-bold leading-tight text-keeper-ink"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.35, duration: 0.45 }}>
            On its way to {reel.who}.
          </motion.p>
          <motion.p className="text-[13.5px] text-keeper-body"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5, duration: 0.45 }}>
            Printed today, posted tracked
          </motion.p>
        </div>
      </div>
    ),
  };

  return (
    <div className="keeper-serif pointer-events-none fixed inset-x-0 bottom-[22px] top-[50px] overflow-hidden">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <div className="absolute left-5 top-4 z-20"><img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" /></div>

      {/* the step, in our voice */}
      <div className="absolute inset-x-0 top-[13%] z-20 flex justify-center px-6">
        <AnimatePresence mode="wait">
          <motion.p key={`${shot.k}${take}`} className="text-center font-display text-[15px] font-bold uppercase tracking-[0.1em] text-brand-dark"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            {shot.cap}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* the camera: it drifts for the whole shot, so the move never stops */}
      <motion.div key={`cam${i}${take}`} className="absolute inset-0 flex items-center justify-center"
        initial={{ scale: shot.cam[0].s, x: shot.cam[0].x ?? 0, y: shot.cam[0].y ?? 0 }}
        animate={{ scale: shot.cam[1].s, x: shot.cam[1].x ?? 0, y: shot.cam[1].y ?? 0 }}
        transition={{ duration: shot.ms / 1000, ease: DRIFT }}>
        <AnimatePresence mode="wait">
          <motion.div key={`${shot.k}${take}`} className="flex h-full w-full items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: FADE, ease: 'easeInOut' }}>
            {body[shot.k]}
          </motion.div>
        </AnimatePresence>
      </motion.div>

      {/* where we are */}
      <div className="absolute inset-x-0 bottom-6 z-20 flex items-center justify-center gap-1.5">
        {shots.map((s, n) => (
          <span key={s.k} className={`h-1.5 rounded-full transition-all duration-500 ${n === i ? 'w-5 bg-brand' : 'w-1.5 bg-keeper-hair'}`} />
        ))}
      </div>
    </div>
  );
}
