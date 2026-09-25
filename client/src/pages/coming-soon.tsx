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
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import celebraitLogo from '@/assets/celebrait.webp';

// The same card as the photo lander's hero (Aidan 2026-09-17), with the
// logo on its back.
const HERO_FRONT = '/hero-card-front.webp';
const HERO_INSIDE = '/hero-card-inside.webp';
// …and the everyday photo it was made from (before → after).
const HERO_SOURCE = '/hero-source-photo.webp';

// ── the page ─────────────────────────────────────────────────────────

const field = 'h-12 w-full rounded-full border border-keeper-hair bg-white/95 px-5 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

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
    <div className="keeper-serif relative min-h-screen overflow-x-hidden">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <main className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-8 pt-6 sm:px-8">
        <header className="flex items-center justify-between">
          <img src={celebraitLogo} alt="Celebrait" className="h-7 w-auto sm:h-8" />
          {hasPassword && !passOpen && (
            <button type="button" onClick={() => setPassOpen(true)} className="text-[13px] font-medium text-keeper-meta transition-colors hover:text-keeper-ink">
              Have a password?
            </button>
          )}
        </header>

        {/* PHONES: words, sign-up, THEN the card. The card used to come
            second and it is tall enough that the form — the only thing
            this page is for — sat a full screen below the fold, unseen
            unless you scrolled for it (Aidan 2026-09-25). The card is
            still the proof, so it keeps its size; it just stops standing
            between the reader and the box they came to fill in.
            DESKTOP is unchanged: every cell is placed explicitly, so DOM
            order does not reach it — card left, words over the sign-up
            on the right. */}
        <div className="grid flex-1 content-center gap-y-5 py-6 lg:grid-cols-2 lg:gap-x-16 lg:gap-y-0 lg:py-10">
          {/* Intro */}
          <div className="lg:col-start-2 lg:row-start-1 lg:self-end">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand-muted px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.12em] text-brand-dark">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cta" /> Early access
            </span>
            <h1 className="mt-4 font-display text-[44px] font-bold leading-[0.98] tracking-[-0.025em] text-keeper-ink sm:text-[60px] lg:text-[54px] xl:text-[64px]">
              <span className="bg-gradient-to-r from-[#7a76e8] via-[#5c57d4] to-[#211D19] bg-clip-text pb-1 text-transparent">Unbinnable</span>
              <br />greetings cards.
            </h1>
            <p className="mt-3.5 max-w-[440px] text-[16.5px] leading-relaxed text-keeper-body sm:text-[17px]">
              Celebrait creates personalised greetings cards that are so good they’ll probably never end up in the bin. We’re launching some time soon so add your details below and we’ll let you know when we do!
            </p>
          </div>

          {/* Sign-up */}
          <div className="lg:col-start-2 lg:row-start-2 lg:self-start lg:pt-7">
            {joined ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex max-w-[460px] items-center gap-3 rounded-2xl border border-brand/40 bg-brand-muted px-5 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cta text-cta-foreground"><Check className="h-5 w-5" strokeWidth={3} /></span>
                <span>
                  <span className="block font-semibold text-keeper-ink">You’re on the list{name.trim() ? `, ${name.trim()}` : ''}.</span>
                  <span className="block text-[14px] text-keeper-body">We’ll email you the moment we open.</span>
                </span>
              </motion.div>
            ) : (
              <form onSubmit={join} className="max-w-[460px] space-y-3">
                <div className="grid grid-cols-[0.8fr_1.2fr] gap-2.5">
                  <input value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="First name" autoComplete="given-name" aria-label="First name" className={field} />
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required placeholder="Email" autoComplete="email" aria-label="Email address" className={field} />
                </div>
                <button type="submit" disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-cta px-6 text-[15px] font-semibold text-cta-foreground shadow-sm transition-colors hover:bg-cta-hover disabled:opacity-60">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Get early access <ArrowRight className="h-4 w-4" /></>}
                </button>
                {err && <p className="px-1 text-[13px] font-medium text-accent-red-dark">{err}</p>}
                <label className="flex cursor-pointer items-start gap-2 px-1 text-[12.5px] leading-snug text-keeper-meta">
                  <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#7a76e8]" />
                  <span>Send me the odd card idea after launch too. We only email you about opening otherwise. <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-keeper-ink">Privacy</Link>.</span>
                </label>
              </form>
            )}

            {hasPassword && passOpen && (
              <form onSubmit={unlock} className="mt-5 flex max-w-[460px] gap-2 border-t border-keeper-hair pt-5">
                <input value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Password" aria-label="Early-access password" autoFocus className={field} />
                <button type="submit" disabled={passBusy || !pass.trim()} className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full border border-brand bg-brand-muted px-5 text-[15px] font-semibold text-brand-dark transition-colors hover:bg-brand-light disabled:opacity-50">
                  {passBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Let me in'}
                </button>
              </form>
            )}
            {passErr && <p className="mt-2 px-1 text-[13px] font-medium text-accent-red-dark">{passErr}</p>}
          </div>
          {/* On desktop the card's left edge lines up with the logo; it
              opens to the left and may run off screen. The canvas bleeds
              far past the square and only the card takes the pointer.
              The photo it was made from sits ABOVE the card, left — the
              open spread sweeps across the whole square, so anything
              placed over the square gets covered (Aidan 2026-09-22:
              "top left of the card and no overlap"). */}
          <div className="lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-center">
            <div className={`relative flex flex-col ${narrow ? 'mx-auto w-[74%]' : 'w-full max-w-[440px] lg:-translate-x-[2%]'}`}>
              <motion.figure
                initial={{ opacity: 0, y: 12, rotate: 0 }} animate={{ opacity: 1, y: 0, rotate: -4 }}
                transition={{ delay: 0.5, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-none relative z-10 mb-1 w-[30%] min-w-[88px] self-start lg:ml-[6%]">
                <div className="rounded-md border-[5px] border-white bg-white shadow-[0_14px_32px_-14px_rgba(33,29,25,0.45)]">
                  <img src={HERO_SOURCE} alt="The everyday photo this card was made from" className="block aspect-[4/5] w-full rounded-sm object-cover" style={{ objectPosition: '30% 50%' }} />
                </div>
                <figcaption className="mt-1.5 text-center text-[11px] font-medium text-keeper-meta">started as this</figcaption>
              </motion.figure>
              <div className="pointer-events-none relative aspect-square w-full lg:-mt-7">
                <motion.div className="pointer-events-none absolute inset-x-[-105%] inset-y-[-24%]"
                  initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
                  <Card3DViewer frontImageUrl={HERO_FRONT} insideImageUrl={HERO_INSIDE} open={open} onOpenChange={setOpen}
                    backLogo backCaption="Unbinnable greetings cards · launching soon"
                    enableRotate enableZoom={false}
                    closedAngle={-0.28} restYaw={-0.12} framingMargin={framing} minDistance={1.1} className="h-full w-full" />
                </motion.div>
              </div>
              <div className={`flex h-[52px] justify-center ${narrow ? 'mt-2 -mx-[20%]' : 'mt-2'}`}>
                <GestureHints open={open} mountDelayMs={1200} hideZoomHint openLabel={open ? 'Tap to close' : 'Tap to open'} />
              </div>
            </div>
          </div>

        </div>

        <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px] text-keeper-meta">
          <span>© {new Date().getFullYear()} Celebrait</span>
          <Link href="/privacy-policy" className="hover:text-keeper-ink">Privacy</Link>
          <Link href="/terms-of-service" className="hover:text-keeper-ink">Terms</Link>
          <Link href="/contact" className="hover:text-keeper-ink">Contact</Link>
        </footer>
      </main>
    </div>
  );
}
