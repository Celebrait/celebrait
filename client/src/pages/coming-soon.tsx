// client/src/pages/coming-soon.tsx — THE PRE-LAUNCH PAGE
//
// What a visitor sees while the site is locked (Aidan 2026-09-16). The
// card is the real Card3DViewer showing the photo lander's hero card,
// the logo on its back (2026-09-17: "use the same card with the photo").
// Beside it: the early-access list (marketing_leads, source
// 'early-access') and a quiet "got the password?" door. Below: the
// drifting wall of the cards picked for the main site.

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { Card3DViewer } from '@/components/card-3d-viewer';
import { GestureHints } from '@/components/gesture-hints';
import celebraitLogo from '@/assets/celebrait.webp';

// The same card as the photo lander's hero (Aidan 2026-09-17), with the
// logo on its back.
const HERO_FRONT = '/hero-card-front.webp';
const HERO_INSIDE = '/hero-card-inside.webp';
// …and the everyday photo it was made from (before → after).
const HERO_SOURCE = '/hero-source-photo.webp';

// ── the page ─────────────────────────────────────────────────────────

const field = 'h-12 min-w-0 rounded-full border border-keeper-hair bg-white/95 px-5 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function ComingSoonPage({ hasPassword = true, onUnlocked }: { hasPassword?: boolean; onUnlocked?: () => void }) {
  // Phones place the card so its open spread stays on screen.
  // The card may open off screen (Aidan 2026-09-17), so it stays big.
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1440));
  useEffect(() => {
    const f = () => setVw(window.innerWidth);
    window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);
  const narrow = vw < 640;
  // The rendered card spans ≈ min(canvasW, canvasH) / framingMargin, and
  // the canvas bleeds well past the square — so a small-looking margin
  // here produces a very big card. 1.6 had it filling ~92% of the square
  // (Aidan 2026-09-22: "the card is huge"). These land it near 70%.
  const framing = narrow ? 2.2 : 2.0;
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
    <div className="keeper-serif relative min-h-screen overflow-x-hidden bg-keeper-paper">
      {/* THE GROUND. Paper and one violet bloom, nothing else.
          The shared CelebrationBackdrop's pastel cake/ring/present/heart
          used to sit here, and on a page whose whole job is to look
          worth waiting for, 3D clipart is the cheapest thing on screen —
          it also parked a large present directly behind the opt-in line.
          The bloom does the same job (the frame has a light source, the
          corners have weight) without putting a picture of a cake next
          to the words. */}
      <div className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: 'linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 58%, #F3F0E9 100%)' }} />
      <div className="pointer-events-none fixed inset-0 -z-10"
        style={{ background: 'radial-gradient(ellipse 70% 48% at 76% 8%, rgba(122,118,232,0.11), transparent 66%), radial-gradient(ellipse 58% 44% at 4% 96%, rgba(122,118,232,0.07), transparent 70%)' }} />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1160px] flex-col px-6 sm:px-10">
        {/* Two hairlines, top and bottom, are the only structure the page
            needs — and they give everything a left edge to sit on. The
            old layout had the words floating with no relationship to the
            logo above them. */}
        <header className="flex items-center justify-between py-6">
          <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto sm:h-[30px]" />
          {hasPassword && !passOpen && (
            <button type="button" onClick={() => setPassOpen(true)}
              className="text-[13px] font-medium text-keeper-meta underline decoration-keeper-hair underline-offset-4 transition-colors hover:text-keeper-ink">
              Have a password?
            </button>
          )}
        </header>
        <div className="h-px w-full bg-keeper-hair" />

        <div className="grid flex-1 items-center gap-y-14 py-10 lg:grid-cols-12 lg:gap-x-12 lg:py-14">
          {/* ── the words, and the one thing to do ─────────────────── */}
          <div className="lg:col-span-6">
            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-dark">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cta" /> Early access
            </span>
            {/* One weight, one colour, tight. The gradient across
                "Unbinnable" was doing the work a good face should do on
                its own, and it fought the violet eyebrow above it. */}
            <h1 className="mt-5 font-display text-[clamp(40px,8.4vw,58px)] font-bold leading-[0.96] tracking-[-0.03em] text-keeper-ink lg:text-[clamp(40px,3.9vw,54px)]">
              Unbinnable<br />greetings cards.
            </h1>
            <p className="mt-5 max-w-[38ch] text-[16px] leading-[1.6] text-keeper-body">
              Celebrait creates personalised greetings cards that are so good they’ll probably never end up in the bin. We’re launching some time soon so add your details below and we’ll let you know when we do!
            </p>

            {joined ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="mt-8 flex max-w-[430px] items-center gap-3 rounded-2xl border border-brand/40 bg-brand-muted px-5 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground"><Check className="h-5 w-5" strokeWidth={3} /></span>
                <span>
                  <span className="block font-semibold text-keeper-ink">You’re on the list{name.trim() ? `, ${name.trim()}` : ''}.</span>
                  <span className="block text-[14px] text-keeper-body">We’ll email you the moment we open.</span>
                </span>
              </motion.div>
            ) : (
              <form onSubmit={join} className="mt-8 max-w-[430px]">
                <div className="flex gap-2.5">
                  <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="First name" autoComplete="given-name" aria-label="First name" className={`${field} basis-[38%]`} />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email" autoComplete="email" aria-label="Email address" className={`${field} grow`} />
                </div>
                {/* Sized to its words, not to the column. A full-width
                    slab of lime was the loudest thing on a page that is
                    meant to read as an invitation. */}
                <button type="submit" disabled={busy}
                  className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-cta px-7 text-[15px] font-semibold text-cta-foreground shadow-[0_10px_24px_-12px_rgba(95,217,74,0.9)] transition-colors hover:bg-cta-hover disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Get early access <ArrowRight className="h-4 w-4" /></>}
                </button>
                {err && <p className="mt-2 px-1 text-[13px] font-medium text-accent-red-dark">{err}</p>}
                <label className="mt-4 flex cursor-pointer items-start gap-2 text-[12.5px] leading-snug text-keeper-meta">
                  <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#7a76e8]" />
                  <span>Send me the odd card idea after launch too. We only email you about opening otherwise. <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-keeper-ink">Privacy</Link>.</span>
                </label>
              </form>
            )}

            {hasPassword && passOpen && (
              <form onSubmit={unlock} className="mt-6 flex max-w-[430px] gap-2 border-t border-keeper-hair pt-6">
                <input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Password" aria-label="Early-access password" autoFocus className={`${field} w-full`} />
                <button type="submit" disabled={passBusy || !pass.trim()} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-brand bg-brand-muted px-5 text-[15px] font-semibold text-brand-dark transition-colors hover:bg-brand-light disabled:opacity-50">
                  {passBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Let me in'}
                </button>
              </form>
            )}
            {passErr && <p className="mt-2 px-1 text-[13px] font-medium text-accent-red-dark">{passErr}</p>}
          </div>

          {/* ── the proof: one photograph became one card ───────────── */}
          {/* Labelled as a before and an after, because that IS the
              product and it was previously an 11px caption under a
              stranded polaroid. No overlap — the open spread sweeps the
              whole square and would cover anything laid over it. */}
          <div className="lg:col-span-6">
            <figure className={`relative mx-auto flex flex-col ${narrow ? 'w-[82%]' : 'w-full max-w-[520px]'}`}>
              <div className="relative aspect-square w-full">
                {/* The snapshot sits ON the card's top corner, with its
                    label set vertically down the spine (Aidan 2026-09-25:
                    "photo top corner with the words along the left side
                    vertical, overlap slightly"). This supersedes the
                    2026-09-22 "no overlap" call — it was made when the
                    photo was a loose polaroid floating over the square;
                    pinned to the corner it reads as one composed object.
                    Worth knowing: the open spread sweeps the whole square,
                    so it passes behind the photo when the card opens.
                    pointer-events-none throughout, so the card still takes
                    every tap and drag underneath. */}
                <div className="pointer-events-none absolute left-[-3%] top-[-1%] z-20 flex w-[31%] min-w-[100px] items-stretch gap-2 lg:left-[-8%] lg:top-[-2%]">
                  <span className="shrink-0 self-stretch text-[10px] font-semibold uppercase tracking-[0.2em] text-keeper-meta"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>Started as this</span>
                  <motion.div
                    initial={{ opacity: 0, y: 10, rotate: 0 }} animate={{ opacity: 1, y: 0, rotate: -3.5 }}
                    transition={{ delay: 0.45, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                    className="min-w-0 flex-1">
                    <div className="rounded-[3px] border-[5px] border-white bg-white shadow-[0_16px_34px_-16px_rgba(33,29,25,0.55)]">
                      <img src={HERO_SOURCE} alt="The everyday photo this card was made from" className="block aspect-[4/5] w-full object-cover" style={{ objectPosition: '30% 50%' }} />
                    </div>
                  </motion.div>
                </div>

                <motion.div className="pointer-events-none absolute inset-x-[-105%] inset-y-[-24%]"
                  initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
                  <Card3DViewer frontImageUrl={HERO_FRONT} insideImageUrl={HERO_INSIDE} open={open} onOpenChange={setOpen}
                    backLogo backCaption="Unbinnable greetings cards · launching soon"
                    enableRotate enableZoom={false}
                    closedAngle={-0.28} restYaw={-0.12} framingMargin={framing} minDistance={1.1} className="h-full w-full" />
                </motion.div>
              </div>

              <div className={`flex h-[48px] justify-center ${narrow ? '-mx-[20%] mt-1' : 'mt-1'}`}>
                <GestureHints open={open} mountDelayMs={1200} hideZoomHint openLabel={open ? 'Tap to close' : 'Tap to open'} />
              </div>
            </figure>
          </div>
        </div>

        <div className="h-px w-full bg-keeper-hair" />
        <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-5 text-[12px] text-keeper-meta">
          <span>© {new Date().getFullYear()} Celebrait</span>
          <span className="flex flex-wrap gap-x-4">
            <Link href="/privacy-policy" className="hover:text-keeper-ink">Privacy</Link>
            <Link href="/terms-of-service" className="hover:text-keeper-ink">Terms</Link>
            <Link href="/contact" className="hover:text-keeper-ink">Contact</Link>
          </span>
        </footer>
      </main>
    </div>
  );
}