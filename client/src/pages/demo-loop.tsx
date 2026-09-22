// client/src/pages/demo-loop.tsx — THE 9-SECOND REEL
//
// What plays in the home page's phone. NOT the full demo replayed
// (Aidan 2026-09-22: "WAY too long… like 7-10 second loop") — a made-
// for-purpose cut of the same journey, from the run an admin featured:
//
//   brief lands (1.5s) → generating (1.2s) → three fronts flick past and
//   one is picked (2.6s) → it opens on the message (2.2s) → it flies off,
//   "On the way" (1.6s) → beat → round again.
//
// The cards come from the saved run, so it costs nothing, can't fail
// live, and every loop is identical. Public, no chrome, ignores the
// pointer: it's a window, not a control. The card opens in CSS 3D (the
// AjarTile hinge) rather than the WebGL viewer — at this size it reads
// the same and starts instantly.

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Send } from 'lucide-react';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { EMBED_GLOW } from '@/components/phone-mockup';
import celebraitLogo from '@/assets/celebrait.webp';

interface Reel {
  fronts: string[]; picked: number; cameo: string | null; inside: string | null;
  who: string; chips: string[];
}

type Beat = 'brief' | 'gen' | 'options' | 'open' | 'sent';
const BEATS: Array<{ k: Beat; ms: number }> = [
  { k: 'brief', ms: 1400 },
  { k: 'gen', ms: 1000 },
  { k: 'options', ms: 2350 },
  { k: 'open', ms: 2000 },
  { k: 'sent', ms: 1550 },
];
const FLICK_MS = 560;  // how long each front holds while they flick past
const GAP_MS = 400;    // the beat before it starts again

const EASE = [0.22, 1, 0.36, 1] as const;
const OCCASION_LABEL: Record<string, string> = { birthday: 'Birthday', christmas: 'Christmas', anniversary: 'Anniversary', wedding: 'Wedding' };

function reelFromRun(run: any): Reel {
  const b = (run?.brief ?? {}) as Record<string, string>;
  const who = String(b.who ?? 'them');
  const age = String(b.age ?? '').replace(/\D/g, '');
  const occ = OCCASION_LABEL[String(b.occasion ?? '')] ?? String(b.occasion ?? '');
  const thing = String(b.thing ?? '').trim();
  const chips = [who, age && occ ? `${age}${age.endsWith('1') && age !== '11' ? 'st' : age.endsWith('2') && age !== '12' ? 'nd' : age.endsWith('3') && age !== '13' ? 'rd' : 'th'} ${occ}` : occ, thing]
    .filter(Boolean)
    .map((t) => (t.length > 46 ? `${t.slice(0, 44)}…` : t));
  return {
    fronts: Array.isArray(run?.frontUrls) ? run.frontUrls : [],
    picked: typeof run?.picked_index === 'number' ? run.picked_index : 0,
    cameo: run?.cameoUrl ?? null,
    inside: run?.insideUrl ?? null,
    who, chips,
  };
}

/** Decode every image before the first loop, so nothing lands empty. */
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

const CARD = 'w-[74%] max-w-[260px]';

/** A card that opens on its left edge, like the catalogue tiles. */
function OpeningCard({ front, inside, open }: { front: string; inside: string | null; open: boolean }) {
  return (
    <div className={`relative ${CARD} aspect-square`} style={{ perspective: 1100 }}>
      {/* the inside page */}
      <div className="absolute inset-0 overflow-hidden rounded-[6px] bg-[#FFFDF8] shadow-[0_18px_40px_-18px_rgba(33,29,25,.35)]">
        {inside && <img src={inside} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />}
      </div>
      {/* the cover, hinged left */}
      <motion.div className="absolute inset-0 origin-left overflow-hidden rounded-[6px] bg-white"
        style={{ transformStyle: 'preserve-3d', boxShadow: '2px 4px 14px rgba(33,29,25,0.18), 10px 16px 34px -12px rgba(33,29,25,0.3)' }}
        initial={{ rotateY: -18 }}
        animate={{ rotateY: open ? -158 : -18 }}
        transition={{ duration: open ? 1.1 : 0.5, ease: EASE }}>
        <img src={front} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/10 via-transparent to-black/10" />
      </motion.div>
    </div>
  );
}

export default function DemoLoopPage() {
  const [reel, setReel] = useState<Reel | null>(null);
  const [beat, setBeat] = useState<Beat>('brief');
  const [flick, setFlick] = useState(0);
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

  const urls = useMemo(() => (reel ? [...reel.fronts, reel.cameo, reel.inside].filter(Boolean) as string[] : []), [reel]);
  const ready = useReady(urls);
  const chosen = reel ? (reel.cameo ?? reel.fronts[reel.picked] ?? reel.fronts[0]) : null;

  // The timeline: fixed beats, then round again.
  useEffect(() => {
    if (!reel || !ready) return;
    const clear = () => { timers.current.forEach(window.clearTimeout); timers.current = []; };
    clear();
    let t = 0;
    setBeat('brief'); setFlick(0);
    for (const b of BEATS) {
      const at = t;
      timers.current.push(window.setTimeout(() => setBeat(b.k), at));
      if (b.k === 'options') {
        for (let i = 1; i < 3; i++) timers.current.push(window.setTimeout(() => setFlick(i), at + i * FLICK_MS));
        timers.current.push(window.setTimeout(() => setFlick(reel.picked), at + 3 * FLICK_MS));
      }
      t += b.ms;
    }
    timers.current.push(window.setTimeout(() => setTake((n) => n + 1), t + GAP_MS));
    return clear;
  }, [reel, ready, take]);

  // Tell the phone what colour to glow.
  useEffect(() => {
    if (!reel || !ready) return;
    const url = beat === 'options' ? reel.fronts[flick] : beat === 'open' || beat === 'sent' ? chosen : null;
    if (window.parent === window) return;
    window.parent.postMessage({ type: EMBED_GLOW, color: url ? '#e8dcc6' : null }, window.location.origin);
  }, [beat, flick, reel, ready, chosen]);

  if (!reel || !ready) return <div className="fixed inset-0 bg-keeper-paper" />;

  return (
    <div className="keeper-serif pointer-events-none fixed inset-x-0 bottom-[22px] top-[50px] overflow-hidden">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <div className="absolute left-5 top-5 z-10"><img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto" /></div>

      <AnimatePresence mode="wait">
        {/* 1 · what we were told */}
        {beat === 'brief' && (
          <motion.section key={`brief${take}`} className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-7"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <p className="mb-1 font-display text-[19px] font-bold text-keeper-ink">A card for {reel.who}</p>
            {reel.chips.map((c, i) => (
              <motion.span key={c} initial={{ opacity: 0, y: 10, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.12 + i * 0.16, duration: 0.3, ease: EASE }}
                className="rounded-full border border-brand/30 bg-brand-muted px-4 py-1.5 text-center text-[14px] font-medium text-brand-dark">{c}</motion.span>
            ))}
          </motion.section>
        )}

        {/* 2 · making them */}
        {beat === 'gen' && (
          <motion.section key={`gen${take}`} className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-7"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <Loader2 className="h-7 w-7 animate-spin text-brand" strokeWidth={2.5} />
            <p className="-mt-1 max-w-[280px] text-center text-[17px] font-medium text-keeper-ink">Generating your 3 options for {reel.who}</p>
          </motion.section>
        )}

        {/* 3 · three of them, one picked */}
        {beat === 'options' && (
          <motion.section key={`opt${take}`} className="absolute inset-0 flex flex-col items-center justify-center gap-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <div className={`relative ${CARD} aspect-square`}>
              {reel.fronts.map((u, i) => (
                <motion.img key={u} src={u} alt="" crossOrigin="anonymous"
                  className="absolute inset-0 h-full w-full rounded-[6px] object-cover shadow-[2px_6px_18px_rgba(33,29,25,.2),10px_18px_38px_-14px_rgba(33,29,25,.3)]"
                  initial={false}
                  animate={flick === i ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: flick > i ? -26 : 26, scale: 0.97 }}
                  transition={{ duration: 0.3, ease: EASE }} />
              ))}
              {/* the pick */}
              <motion.span key={`ring${take}`} className="absolute -inset-1.5 rounded-[10px] border-[3px] border-brand"
                initial={{ opacity: 0, scale: 1.06 }}
                animate={{ opacity: [0, 1, 1], scale: [1.06, 1, 1] }}
                transition={{ delay: 3 * (FLICK_MS / 1000), duration: 0.5, ease: EASE }} />
            </div>
            <p className="text-[13px] text-keeper-meta">Option {flick + 1} of 3</p>
          </motion.section>
        )}

        {/* 4 · it opens */}
        {beat === 'open' && chosen && (
          <motion.section key={`open${take}`} className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <OpeningCard front={chosen} inside={reel.inside} open />
          </motion.section>
        )}

        {/* 5 · posted */}
        {beat === 'sent' && chosen && (
          <motion.section key={`sent${take}`} className="absolute inset-0 overflow-hidden"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
            <motion.img src={chosen} alt="" crossOrigin="anonymous"
              className="absolute left-1/2 top-1/2 w-[62%] max-w-[230px] rounded-[6px] object-cover shadow-[0_20px_44px_-18px_rgba(33,29,25,.45)]"
              initial={{ x: '-50%', y: '-50%', rotate: -3, opacity: 1 }}
              animate={{ x: ['-50%', '40%'], y: ['-50%', '-190%'], rotate: [-3, 22], scale: [1, 0.42], opacity: [1, 1, 0] }}
              transition={{ duration: 0.95, ease: [0.5, 0, 0.9, 0.4], times: [0, 0.75, 1] }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
              <motion.span className="flex h-16 w-16 items-center justify-center rounded-full bg-cta text-cta-foreground"
                initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.75, duration: 0.45, ease: EASE }}>
                <Check className="h-9 w-9" strokeWidth={3} />
              </motion.span>
              <motion.p className="font-display text-[22px] font-bold leading-tight text-keeper-ink"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.4 }}>
                Posted to {reel.who}.
              </motion.p>
              <motion.p className="flex items-center gap-1.5 text-[13.5px] text-keeper-body"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.05, duration: 0.4 }}>
                <Send className="h-3.5 w-3.5 text-cta" /> Printed today, sent tracked
              </motion.p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
