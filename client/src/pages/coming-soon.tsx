// client/src/pages/coming-soon.tsx — THE PRE-LAUNCH PAGE
//
// What a visitor sees while the site is locked (Aidan 2026-09-16: "a
// cool 3d Greetings card with my logo on the rear which says Unbinnable
// Greetings cards launching soon with a cool message inside"). The card
// is the real Card3DViewer — its back already carries the logo — with a
// front and an inside drawn here on a canvas, so no generation and no
// image files. Below it: the early-access list (marketing_leads, source
// 'early-access') and a quiet "got the password?" door.

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { GestureHints } from '@/components/gesture-hints';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import celebraitLogo from '@/assets/celebrait.webp';

const VIOLET = '#7a76e8';
const VIOLET_DARK = '#5c57d4';
const PAPER = '#FAF8F4';
const INK = '#211D19';
const GREEN = '#5fd94a';

// ── the two faces ────────────────────────────────────────────────────

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []; let line = '';
  for (const w of text.split(' ')) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

function grain(ctx: CanvasRenderingContext2D, S: number, alpha: number) {
  // A light paper tooth so the faces read as printed, not flat fills.
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  ctx.save(); ctx.globalAlpha = alpha;
  for (let i = 0; i < 9000; i++) { ctx.fillStyle = rnd() > 0.5 ? '#ffffff' : '#000000'; ctx.fillRect(rnd() * S, rnd() * S, 1.4, 1.4); }
  ctx.restore();
}

function drawFront(S = 1024): string {
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, VIOLET); g.addColorStop(1, VIOLET_DARK);
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  grain(ctx, S, 0.05);

  // Confetti: a few paper and green marks, placed by hand so it never
  // lands on the words.
  const bits: Array<[number, number, number, number, string]> = [
    [150, 170, 0.5, 26, PAPER], [860, 150, -0.4, 22, GREEN], [900, 330, 0.9, 16, PAPER],
    [110, 420, -0.8, 14, GREEN], [820, 860, 0.3, 24, PAPER], [180, 880, -0.2, 18, GREEN], [520, 120, 1.1, 12, PAPER],
  ];
  for (const [x, y, r, s, col] of bits) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.fillStyle = col; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.roundRect(-s, -s * 0.38, s * 2, s * 0.76, s * 0.3); ctx.fill(); ctx.restore();
  }

  ctx.fillStyle = PAPER; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const x = 96;
  ctx.font = '600 44px Figtree, system-ui, sans-serif';
  ctx.globalAlpha = 0.85; ctx.fillText('celebrait presents', x, 318); ctx.globalAlpha = 1;
  // "Unbinnable" on one line, as big as the face allows.
  let size = 176;
  do { ctx.font = `800 ${size}px Fraunces, Georgia, serif`; size -= 4; } while (ctx.measureText('Unbinnable').width > S - x * 2 && size > 80);
  ctx.fillText('Unbinnable', x - 4, 330 + size);
  ctx.font = 'italic 600 112px Fraunces, Georgia, serif';
  ctx.fillText('greetings', x, 470 + size);
  ctx.fillText('cards.', x, 580 + size);

  // The pill: launching soon.
  ctx.font = '700 38px Figtree, system-ui, sans-serif';
  const label = 'LAUNCHING SOON';
  const w = ctx.measureText(label).width + 72;
  ctx.fillStyle = PAPER; ctx.beginPath(); ctx.roundRect(x, 850, w, 78, 39); ctx.fill();
  ctx.fillStyle = GREEN; ctx.beginPath(); ctx.arc(x + 34, 889, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = VIOLET_DARK; ctx.fillText(label, x + 56, 903);
  return c.toDataURL('image/png');
}

function drawInside(S = 1024): string {
  const c = document.createElement('canvas'); c.width = S; c.height = S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#FFFDF9'; ctx.fillRect(0, 0, S, S);
  grain(ctx, S, 0.035);
  const x = 110; const maxW = S - x * 2;
  ctx.textAlign = 'left';

  ctx.fillStyle = VIOLET_DARK; ctx.font = '800 104px Fraunces, Georgia, serif';
  ctx.fillText('Psst.', x, 250);
  ctx.fillStyle = INK; ctx.font = '700 72px Fraunces, Georgia, serif';
  ctx.fillText('You’re early.', x, 340);

  ctx.font = '400 40px Figtree, system-ui, sans-serif'; ctx.fillStyle = '#3A342E';
  let y = 440;
  for (const para of [
    'We’re making cards so personal nobody bins them.',
    'Written for one person, drawn for them, printed and posted to their door.',
  ]) {
    for (const l of wrap(ctx, para, maxW)) { ctx.fillText(l, x, y); y += 56; }
    y += 22;
  }
  ctx.font = '600 40px Figtree, system-ui, sans-serif'; ctx.fillStyle = INK;
  ctx.fillText('Doors open soon. You’ll be first in.', x, y + 10);

  ctx.font = 'italic 600 58px Fraunces, Georgia, serif'; ctx.fillStyle = VIOLET_DARK;
  ctx.fillText('Love, Celebrait x', x, 880);
  return c.toDataURL('image/png');
}

function useFaces(): { front: string; inside: string } | null {
  const [faces, setFaces] = useState<{ front: string; inside: string } | null>(null);
  useEffect(() => {
    let off = false;
    const fonts = ['800 100px Fraunces', 'italic 600 60px Fraunces', '700 60px Fraunces', '400 40px Figtree', '700 40px Figtree'];
    // Draw once the type is in; if fonts are slow, draw anyway after a beat.
    Promise.race([
      Promise.all(fonts.map((f) => document.fonts.load(f))).catch(() => undefined),
      new Promise((r) => setTimeout(r, 2500)),
    ]).then(() => { if (!off) setFaces({ front: drawFront(), inside: drawInside() }); });
    return () => { off = true; };
  }, []);
  return faces;
}

// ── the page ─────────────────────────────────────────────────────────

const field = 'h-12 w-full rounded-full border border-keeper-hair bg-white/95 px-5 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function ComingSoonPage({ hasPassword = true, onUnlocked }: { hasPassword?: boolean; onUnlocked?: () => void }) {
  const faces = useFaces();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState(false);
  const [err, setErr] = useState('');
  const [passOpen, setPassOpen] = useState(false);
  const [pass, setPass] = useState('');
  const [passErr, setPassErr] = useState('');
  const [passBusy, setPassBusy] = useState(false);

  useEffect(() => {
    document.title = 'Celebrait — unbinnable greetings cards, launching soon';
    // Cards open themselves once, a beat after they land.
    const t = window.setTimeout(() => setOpen(true), 2200);
    return () => window.clearTimeout(t);
  }, []);

  const join = async (e: React.FormEvent) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setErr('');
    try {
      const r = await fetch('/api/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'early-access', recipientName: name.trim() || undefined, marketingOptIn: optIn }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'Please try again.');
      setJoined(true);
    } catch (x) {
      setErr(x instanceof Error ? x.message : 'Please try again.');
    } finally { setBusy(false); }
  };

  const unlock = async (e: React.FormEvent) => {
    e.preventDefault(); if (passBusy) return;
    setPassBusy(true); setPassErr('');
    try {
      const r = await fetch('/api/site-lock/unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pass }) });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'That’s not the password.');
      onUnlocked?.();
    } catch (x) {
      setPassErr(x instanceof Error ? x.message : 'That’s not the password.');
    } finally { setPassBusy(false); }
  };

  return (
    <div className="keeper-serif relative min-h-screen overflow-x-hidden">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-10 pt-6 sm:px-6">
        <header className="flex items-center justify-between">
          <img src={celebraitLogo} alt="Celebrait" className="h-8 w-auto" />
          <span className="rounded-full border border-keeper-hair bg-white/80 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-keeper-meta">Early access</span>
        </header>

        <div className="mt-4 grid flex-1 items-center gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          {/* The card */}
          <div className="relative flex flex-col items-center">
            <div className="relative aspect-square w-full max-w-[560px]">
              {faces ? (
                // The canvas bleeds past the square so the opening cover
                // never clips; drag turns it to show the logo on the back.
                // It slides right by half a card as it opens, so the open
                // spread sits centred instead of hanging off the left.
                <motion.div className="absolute -inset-x-[16%] -inset-y-[6%]" initial={{ opacity: 0, y: 24, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1, x: open ? '20%' : '0%' }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], x: { duration: 0.9, ease: [0.45, 0, 0.2, 1] } }}>
                  <Card3DViewer frontImageUrl={faces.front} insideImageUrl={faces.inside} open={open} onOpenChange={setOpen}
                    backLogo backCaption="Unbinnable greetings cards · launching soon"
                    enableRotate enableZoom={false}
                    closedAngle={-0.38} restYaw={-0.12} framingMargin={2} minDistance={1.4} className="h-full w-full" />
                </motion.div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-keeper-meta" /></div>
              )}
            </div>
            <div className="h-[72px]">
              <GestureHints open={open} mountDelayMs={1200} hideZoomHint openLabel={open ? 'Tap to close' : 'Tap to open'} />
            </div>
          </div>

          {/* The words and the list */}
          <section className="mx-auto w-full max-w-[480px] text-center lg:text-left">
            <h1 className="font-display text-[40px] font-bold leading-[1.02] tracking-[-0.02em] text-keeper-ink sm:text-[56px]">
              Unbinnable<br />greetings cards.
            </h1>
            <p className="mt-4 text-[17px] leading-relaxed text-keeper-body">
              Written for one person, drawn for them, printed and posted to their door. We’re opening the doors soon. Get on the list and you’re first in.
            </p>

            {joined ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-7 flex items-center gap-3 rounded-2xl border border-brand/40 bg-brand-muted px-5 py-4 text-left">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground"><Check className="h-5 w-5" strokeWidth={3} /></span>
                <span>
                  <span className="block font-semibold text-keeper-ink">You’re on the list.</span>
                  <span className="block text-[14px] text-keeper-body">We’ll email you the moment the doors open.</span>
                </span>
              </motion.div>
            ) : (
              <form onSubmit={join} className="mt-7 space-y-3 text-left">
                <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
                  <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="First name" autoComplete="given-name" aria-label="First name" className={field} />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email address" autoComplete="email" aria-label="Email address" className={field} />
                </div>
                <label className="flex cursor-pointer items-start gap-2.5 px-1 text-[13px] leading-snug text-keeper-body">
                  <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#7a76e8]" />
                  <span>Also send me the odd card idea and offer after launch. Unsubscribe any time.</span>
                </label>
                <button type="submit" disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-cta px-6 text-[15px] font-semibold text-cta-foreground shadow-sm transition-colors hover:bg-cta-hover disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Get early access <ArrowRight className="h-4 w-4" /></>}
                </button>
                {err && <p className="px-1 text-[13px] font-medium text-accent-red-dark">{err}</p>}
                <p className="px-1 text-[12px] text-keeper-meta">
                  We’ll only use your email to tell you when we open{optIn ? ' and for the occasional idea' : ''}. See our <Link href="/privacy-policy" className="underline underline-offset-2">privacy policy</Link>.
                </p>
              </form>
            )}

            {hasPassword && (
              <div className="mt-8 border-t border-keeper-hair pt-5">
                {passOpen ? (
                  <form onSubmit={unlock} className="flex flex-col gap-2 sm:flex-row">
                    <input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Early-access password" aria-label="Early-access password" autoFocus className={field} />
                    <button type="submit" disabled={passBusy || !pass.trim()} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-brand bg-brand-muted px-6 text-[15px] font-semibold text-brand-dark transition-colors hover:bg-brand-light disabled:opacity-50">
                      {passBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Let me in'}
                    </button>
                  </form>
                ) : (
                  <button type="button" onClick={() => setPassOpen(true)} className="text-[14px] font-medium text-keeper-meta underline decoration-keeper-hair underline-offset-4 hover:text-keeper-ink">Got an early-access password?</button>
                )}
                {passErr && <p className="mt-2 px-1 text-[13px] font-medium text-accent-red-dark">{passErr}</p>}
              </div>
            )}
          </section>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] text-keeper-meta">
          <span>© {new Date().getFullYear()} Celebrait</span>
          <Link href="/privacy-policy" className="hover:text-keeper-ink">Privacy</Link>
          <Link href="/terms-of-service" className="hover:text-keeper-ink">Terms</Link>
          <Link href="/contact" className="hover:text-keeper-ink">Contact</Link>
        </footer>
      </main>
    </div>
  );
}
