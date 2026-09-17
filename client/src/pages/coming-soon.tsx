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
import { CardDrift, useDriftCards } from '@/components/catalogue/card-drift';
import celebraitLogo from '@/assets/celebrait.webp';

// The same card as the photo lander's hero (Aidan 2026-09-17), with the
// logo on its back.
const HERO_FRONT = '/hero-card-front.webp';
const HERO_INSIDE = '/hero-card-inside.webp';

// ── the page ─────────────────────────────────────────────────────────

const field = 'h-12 w-full rounded-full border border-keeper-hair bg-white/95 px-5 text-[15px] text-keeper-ink placeholder:text-keeper-meta focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20';

export default function ComingSoonPage({ hasPassword = true, onUnlocked }: { hasPassword?: boolean; onUnlocked?: () => void }) {
  // The admin's carousel picks only, as on the gate.
  const picks = useDriftCards(20, null);
  // Phones place the card so its open spread stays on screen.
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  useEffect(() => {
    const f = () => setNarrow(window.innerWidth < 640);
    window.addEventListener('resize', f); return () => window.removeEventListener('resize', f);
  }, []);
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
      <main className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-4 pb-10 pt-6 sm:px-6">
        <header className="flex items-center justify-between">
          <img src={celebraitLogo} alt="Celebrait" className="h-8 w-auto" />
          <span className="rounded-full border border-keeper-hair bg-white/80 px-3 py-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-keeper-meta">Early access</span>
        </header>

        <div className="mt-4 grid flex-1 items-center gap-6 lg:grid-cols-[1.1fr_1fr] lg:gap-10">
          {/* The card */}
          <div className={`relative flex flex-col ${narrow ? 'ml-auto mr-[3%] w-[54%]' : 'ml-auto w-full max-w-[460px]'}`}>
            {/* The card stays put and opens fully to the left, never
                clipped (Aidan 2026-09-17): the canvas bleeds far past the
                square like the photo lander's hero, and ignores the pointer
                except over the card itself, so the form beside it still
                works. On phones the card sits a little right of centre so
                the open cover fits on screen. */}
            <div className="pointer-events-none relative aspect-square w-full">
              <motion.div className="pointer-events-none absolute inset-x-[-105%] inset-y-[-24%]"
                initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
                <Card3DViewer frontImageUrl={HERO_FRONT} insideImageUrl={HERO_INSIDE} open={open} onOpenChange={setOpen}
                  backLogo backCaption="Unbinnable greetings cards · launching soon"
                  enableRotate enableZoom={false}
                  closedAngle={-0.5} restYaw={-0.12} framingMargin={narrow ? 1.75 : 2.3} minDistance={1.2} className="h-full w-full" />
              </motion.div>
            </div>
            <div className={`flex h-[72px] justify-center ${narrow ? '-mx-[30%]' : ''}`}>
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

        {picks.cards.length > 0 && (
          <div className="mt-10">
            <p className="text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-keeper-meta">A few we’ve made</p>
            <div className="-mx-4 mt-2 sm:-mx-6">
              <CardDrift padFrom={null} peek peekCta={false} cards={picks.cards} />
            </div>
          </div>
        )}

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
