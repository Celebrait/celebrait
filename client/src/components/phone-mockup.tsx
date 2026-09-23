// client/src/components/phone-mockup.tsx — THE HANDHELD PHONE
//
// An iPhone-sized frame around an iframe, alive: it sways in 3D as if
// held, breathes, has a reflection on the surface below, paper flecks
// behind, dips on every tap, and glows with the colour of the card on
// screen. No shine on the glass, and no drifting colour behind it
// either: the violet and green clouds washed the whole frame and read
// as a weird sheen on camera (Aidan 2026-09-23). Built for /demo
// (2026-09-18, Aidan: "feels really static and 1D") and now shared with
// the home page's looping demo (2026-09-21).
//
// The page inside talks to it by postMessage (same origin):
//   { type: 'celebrait-demo-embed-tap' }            → the phone dips
//   { type: 'celebrait-demo-embed-glow', color }    → the glow takes that colour
// Anything else is handed to `onMessage`.
//
// `fit`: 'viewport' fills the window (the /demo builder's run screen);
// 'inline' sizes to its container's width (the home page hero).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';

export const PHONE_W = 393, PHONE_H = 852, BEZEL = 14;
export const EMBED_TAP = 'celebrait-demo-embed-tap';
export const EMBED_GLOW = 'celebrait-demo-embed-glow';

/** Paper flecks behind the phone — seeded, so every recording drifts the same. */
const FLECKS = Array.from({ length: 18 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  const colors = ['#7a76e8', '#5fd94a', '#FAF8F4', '#e5e4f9', '#c9c6f4'];
  return { left: 4 + r(1) * 92, w: 5 + r(2) * 7, h: 3 + r(3) * 5, color: colors[i % colors.length], dur: 26 + r(4) * 22, delay: r(5) * 40, dx: (r(6) - 0.5) * 220, rot: 360 + r(7) * 720, o: 0.35 + r(8) * 0.4 };
});

const MOTION_CSS = `
  @keyframes demo-sway { 0% { transform: rotateX(2.6deg) rotateY(-4deg) translate3d(0,0,0) } 25% { transform: rotateX(-2deg) rotateY(3deg) translate3d(7px,-8px,0) } 50% { transform: rotateX(2.4deg) rotateY(4.4deg) translate3d(-5px,6px,0) } 75% { transform: rotateX(-2.8deg) rotateY(-2.4deg) translate3d(5px,9px,0) } 100% { transform: rotateX(2.6deg) rotateY(-4deg) translate3d(0,0,0) } }
  @keyframes demo-shadow { 0% { transform: translate(-30px, 0) scaleX(1) } 25% { transform: translate(24px, 8px) scaleX(1.06) } 50% { transform: translate(34px, -4px) scaleX(0.96) } 75% { transform: translate(-18px, 10px) scaleX(1.05) } 100% { transform: translate(-30px, 0) scaleX(1) } }
  @keyframes demo-breathe { 0% { transform: scale(1) translateY(0) } 50% { transform: scale(1.035) translateY(-6px) } 100% { transform: scale(1) translateY(0) } }
  @keyframes demo-nudge { 0% { transform: none } 35% { transform: translateY(5px) rotateX(-2.6deg) scale(0.99) } 100% { transform: none } }
  @keyframes demo-fleck { 0% { transform: translate3d(0, 0, 0) rotate(0deg); opacity: 0 } 8% { opacity: var(--o) } 92% { opacity: var(--o) } 100% { transform: translate3d(var(--dx), var(--rise), 0) rotate(var(--rot)); opacity: 0 } }
  .demo-breathe { animation: demo-breathe 22s ease-in-out infinite; transform-style: preserve-3d; }
  .demo-nudge { animation: demo-nudge 320ms ease-out; transform-style: preserve-3d; }
  .demo-fleck { position: absolute; bottom: -4%; border-radius: 2px; animation: demo-fleck var(--d) linear infinite; animation-delay: var(--delay); will-change: transform; }
  .demo-sway { animation: demo-sway 11s ease-in-out infinite; transform-style: preserve-3d; will-change: transform; }
  .demo-shadow { animation: demo-shadow 11s ease-in-out infinite; }
`;

export interface PhoneMockupProps {
  /** What plays on the phone. */
  src: string;
  title?: string;
  /** Sway, glow, reflection, flecks. */
  alive?: boolean;
  fit?: 'viewport' | 'inline';
  /** 'inline' only: the tallest the phone may be, in px. */
  maxHeight?: number;
  /** 'viewport' only: draw the site's floating icons behind. */
  backdrop?: boolean;
  /** Multiplies the fitted size, so a recording can be framed for the
   *  platform it's going to: under 1 leaves room for the caption and
   *  the like rail, over 1 fills a 9:16 crop (Aidan 2026-09-23). */
  zoom?: number;
  /** Same-origin messages from the page inside that aren't tap/glow. */
  onMessage?: (e: MessageEvent, frame: HTMLIFrameElement | null) => void;
  className?: string;
  children?: ReactNode;
}

export function PhoneMockup({ src, title = 'Celebrait demo', alive = true, fit = 'viewport', maxHeight, backdrop = fit === 'viewport', zoom = 1, onMessage, className = '' }: PhoneMockupProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const nudgeRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [glow, setGlow] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const W = PHONE_W + BEZEL * 2, H = PHONE_H + BEZEL * 2;

  useEffect(() => {
    const fit_ = () => {
      if (fit === 'viewport') setScale(Math.min(1, (window.innerHeight - 40) / H, (window.innerWidth - 32) / W) * zoom);
      else { const w = boxRef.current?.clientWidth ?? W; setScale(Math.min(1, w / W, maxHeight ? maxHeight / H : 1) * zoom); }
    };
    fit_();
    window.addEventListener('resize', fit_);
    const ro = fit === 'inline' && boxRef.current ? new ResizeObserver(fit_) : null;
    if (ro && boxRef.current) ro.observe(boxRef.current);
    let nudgeT = 0;
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.source && frameRef.current && e.source !== frameRef.current.contentWindow) return;
      if (e.data?.type === EMBED_TAP) {
        if (!alive) return;
        // A tap dips the phone, like pressing a real screen.
        const el = nudgeRef.current; if (!el) return;
        el.classList.remove('demo-nudge'); void el.offsetWidth; el.classList.add('demo-nudge');
        window.clearTimeout(nudgeT); nudgeT = window.setTimeout(() => el.classList.remove('demo-nudge'), 340);
        return;
      }
      if (e.data?.type === EMBED_GLOW) { setGlow(alive ? (e.data.color ?? null) : null); return; }
      onMessage?.(e, frameRef.current);
    };
    window.addEventListener('message', onMsg);
    return () => { window.removeEventListener('resize', fit_); window.removeEventListener('message', onMsg); ro?.disconnect(); };
  }, [fit, alive, onMessage, W, H, maxHeight, zoom]);

  const outer = fit === 'viewport'
    ? 'fixed inset-0 flex items-center justify-center overflow-hidden'
    : 'relative flex items-start justify-center overflow-visible';
  const rise = fit === 'viewport' ? '-115vh' : `-${Math.round(H * scale + 60)}px`;

  return (
    <div ref={boxRef} className={`${outer} ${className}`}
      style={{ background: fit === 'viewport' && !alive ? 'linear-gradient(180deg, #F6F3EE 0%, #EFEBE4 100%)' : undefined, perspective: 1400, height: fit === 'inline' ? H * scale : undefined }}>
      {alive && (
        <>
          <style>{MOTION_CSS}</style>
          {backdrop && fit === 'viewport' && <CelebrationBackdrop background="linear-gradient(180deg, #F6F3EE 0%, #EFEBE4 100%)" permanentFade />}
          {/* paper confetti, rising slowly behind the phone */}
          <div aria-hidden className={`pointer-events-none absolute overflow-hidden ${fit === 'viewport' ? 'inset-0' : '-inset-x-[30%] -inset-y-[12%]'}`}
            style={fit === 'inline' ? { maskImage: 'radial-gradient(closest-side, black 55%, transparent 100%)', WebkitMaskImage: 'radial-gradient(closest-side, black 55%, transparent 100%)' } : undefined}>
            {FLECKS.map((f, i) => (
              <span key={i} className="demo-fleck" style={{ left: `${f.left}%`, width: f.w, height: f.h, background: f.color, ['--d' as string]: `${f.dur}s`, ['--delay' as string]: `-${f.delay}s`, ['--dx' as string]: `${f.dx}px`, ['--rot' as string]: `${f.rot}deg`, ['--o' as string]: f.o, ['--rise' as string]: rise }} />
            ))}
          </div>
        </>
      )}
      {/* Sizing and breathing are separate layers: a CSS animation's
          transform replaces an inline one, so scaling here and animating
          here would cancel the scale (caught 2026-09-22 — the hero phone
          rendered full size). */}
      <div style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: fit === 'inline' ? 'top center' : 'center' }} className="relative shrink-0">
        <div className={`relative h-full w-full ${alive ? 'demo-breathe' : ''}`}>
        {/* the card's light spilling out behind the phone */}
        {alive && <div aria-hidden className="pointer-events-none absolute -inset-[22%] rounded-full blur-[60px]" style={{ background: glow ? `radial-gradient(ellipse at 50% 45%, ${glow} 0%, transparent 62%)` : 'transparent', opacity: glow ? 0.55 : 0, transition: 'opacity 1.4s ease, background 1.4s ease' }} />}
        {/* the shadow moves with the sway */}
        {alive && <div aria-hidden className="demo-shadow pointer-events-none absolute inset-x-[6%] bottom-[-3%] h-[10%] rounded-[50%] bg-[#211D19] opacity-[0.28] blur-[26px]" />}
        <div ref={nudgeRef} className="relative h-full w-full" style={{ transformStyle: 'preserve-3d' }}>
          <div style={{ padding: BEZEL, boxShadow: `0 50px 90px -40px rgba(33,29,25,.55), inset 0 0 0 2px rgba(255,255,255,.08)${glow ? `, 0 0 70px -10px ${glow}` : ''}`, transition: 'box-shadow 1.4s ease',
              // The reflection: the phone mirrored on the surface below, fading fast.
              ...(alive ? { WebkitBoxReflect: 'below 10px linear-gradient(transparent 74%, rgba(0,0,0,.22))' } : {}) }}
            className={`relative h-full w-full rounded-[66px] bg-[#1d1a17] ${alive ? 'demo-sway' : ''}`}>
            <div className="relative h-full w-full overflow-hidden rounded-[52px] bg-keeper-paper">
              <iframe ref={frameRef} src={src} title={title} className="absolute inset-0 h-full w-full border-0" />
              {/* status bar */}
              <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[50px] items-center justify-between px-[34px] pt-[4px] text-[16px] font-semibold text-keeper-ink" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <span>9:41</span>
                <span className="flex items-center gap-[6px]">
                  <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1" fill="currentColor" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="currentColor" /><rect x="10" y="3" width="3" height="9" rx="1" fill="currentColor" /><rect x="15" y="0" width="3" height="12" rx="1" fill="currentColor" /></svg>
                  <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0L8 11.5Zm-4.2-4.3L2.3 5.7a8 8 0 0 1 11.4 0l-1.5 1.5a5.9 5.9 0 0 0-8.4 0ZM.9 4.3-.6 2.8a12 12 0 0 1 17.2 0l-1.5 1.5a9.9 9.9 0 0 0-14.2 0Z" fill="currentColor" /></svg>
                  <svg width="26" height="12" viewBox="0 0 26 12" aria-hidden="true"><rect x="0.5" y="0.5" width="22" height="11" rx="3.5" fill="none" stroke="currentColor" opacity=".4" /><rect x="2" y="2" width="19" height="8" rx="2" fill="currentColor" /><rect x="24" y="4" width="1.6" height="4" rx=".8" fill="currentColor" opacity=".45" /></svg>
                </span>
              </div>
              {/* dynamic island + home bar */}
              <div className="pointer-events-none absolute left-1/2 top-[11px] h-[35px] w-[124px] -translate-x-1/2 rounded-full bg-[#0c0b0a]" />
              <div className="pointer-events-none absolute bottom-[8px] left-1/2 h-[5px] w-[136px] -translate-x-1/2 rounded-full bg-keeper-ink/85" />
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
