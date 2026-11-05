// /beta — THE BETA DOOR (Aidan 2026-11-05: "super clear, Beta testing…
// a landing page BETA — but NO payments — testing only").
//
// One page that does three jobs: says plainly what Celebrait is and that
// nothing is charged; hands the visitor a tester cookie (POST
// /api/beta/join — optionally behind a code set at /admin/site, tagged
// by ?t=<where they came from>); and opens both routes. While the site
// is locked this page still shows (site-gate.tsx OPEN list) and the join
// also lets them through the lock. Every Buy button on the site becomes
// "give feedback" while beta mode is on (use-beta.ts).
//
// Share links: /beta?t=fb-pod-1   (+ &code=… when a code is set).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Camera, Check, Loader2, MessageSquareHeart, Sparkles, X } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { Rise } from '@/components/landing/rise';
import { DISPLAY, EYEBROW } from '@/pages/doorway';
import { GALLERY_EXAMPLES } from '@/lib/gallery-examples';
import { useSeo, setRobotsMeta } from '@/lib/use-seo';
import { useBetaState, betaFeedbackHref } from '@/hooks/use-beta';
import { cardPrice } from '@shared/pricing';
import { formatMoney } from '@shared/market';

const primary = 'inline-flex h-12 items-center justify-center gap-2 rounded-full bg-keeper-gold px-7 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-keeper-gold-deep disabled:cursor-not-allowed disabled:opacity-40';
const secondary = 'inline-flex h-12 items-center justify-center gap-2 rounded-full border border-keeper-hair bg-white px-7 text-[15px] font-semibold text-keeper-ink transition-colors hover:bg-keeper-paper disabled:cursor-not-allowed disabled:opacity-40';

export default function BetaPage() {
  const [location] = useLocation();
  useSeo(location);
  useEffect(() => { setRobotsMeta('noindex, nofollow'); }, []);

  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const codeParam = (params.get('code') ?? '').trim();
  const tag = (params.get('t') ?? params.get('utm_campaign') ?? '').trim();

  const { betaMode, tester, needsCode, loaded } = useBetaState();
  const qc = useQueryClient();
  const [code, setCode] = useState(codeParam);
  const [joining, setJoining] = useState(false);
  const [err, setErr] = useState('');
  const tried = useRef(false);

  const join = useCallback(async (c: string) => {
    setJoining(true); setErr('');
    try {
      const r = await fetch('/api/beta/join', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c, tag, path: window.location.pathname + window.location.search }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || 'That didn’t work. Try again.');
      await qc.invalidateQueries({ queryKey: ['/api/site-lock'] });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setJoining(false);
    }
  }, [qc, tag]);

  // Walk in: a code in the link, or no code needed → join on arrival.
  useEffect(() => {
    if (!loaded || !betaMode || tester || tried.current) return;
    if (codeParam || !needsCode) { tried.current = true; void join(codeParam); }
  }, [loaded, betaMode, tester, needsCode, codeParam, join]);

  const open = tester;
  const price = formatMoney(cardPrice('photo'));

  return (
    <div className="keeper-serif min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-36 md:pt-40">
        {/* ── Hero ── */}
        <Rise className="mx-auto max-w-3xl text-center">
          <p className={EYEBROW}>Beta test · nothing is charged</p>
          <h1 className={`mt-3 text-[clamp(36px,6vw,64px)] leading-[1.02] ${DISPLAY}`}>Help us test Celebrait.</h1>
          <p className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-[1.6] text-keeper-body md:text-[18px]">
            Celebrait makes a greetings card that is all about one person. Give it a photo of them and it draws them into the scene you describe, then writes the inside. When we launch, every card is printed and posted. Right now we want you to make one and tell us the truth about it.
          </p>
        </Rise>

        {/* ── Join state ── */}
        <Rise className="mx-auto mt-8 max-w-xl" delay={0.05}>
          {!loaded ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-keeper-hair bg-white/70 px-5 py-4 text-[14px] text-keeper-meta"><Loader2 className="h-4 w-4 animate-spin" /> Checking the beta…</div>
          ) : !betaMode ? (
            <div className="rounded-2xl border border-keeper-hair bg-white/70 px-5 py-4 text-center text-[15px] text-keeper-body" data-testid="beta-closed">
              Beta testing is closed right now. <Link href="/photo" className="font-semibold text-keeper-gold underline underline-offset-2">See Celebrait</Link>.
            </div>
          ) : tester ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-[15px] text-emerald-900" data-testid="beta-joined">
              <Check className="h-5 w-5 text-emerald-600" strokeWidth={2} /> You’re in. Nothing you do here costs anything.
            </div>
          ) : joining ? (
            <div className="flex items-center justify-center gap-2 rounded-2xl border border-keeper-hair bg-white/70 px-5 py-4 text-[14px] text-keeper-meta"><Loader2 className="h-4 w-4 animate-spin" /> Letting you in…</div>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); void join(code); }}
              className="rounded-2xl border border-keeper-gold/30 bg-white/80 px-5 py-5"
              data-testid="beta-code-form"
            >
              <label htmlFor="beta-code" className="block text-[15px] font-semibold text-keeper-ink">Beta code</label>
              <p className="mt-0.5 text-[13px] text-keeper-body">It’s in the post or message that brought you here.</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input id="beta-code" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="none" autoComplete="off"
                  className="h-12 flex-1 rounded-full border border-keeper-hair bg-white px-4 text-[15px] text-keeper-ink focus:border-keeper-gold focus:outline-none" data-testid="beta-code-input" />
                <button type="submit" disabled={!code.trim()} className={primary} data-testid="beta-code-submit">Let me in</button>
              </div>
              {err && <p className="mt-2 text-[13px] text-accent-red-dark" role="alert">{err}</p>}
            </form>
          )}
          {err && tester === false && betaMode && !joining && !needsCode && (
            <p className="mt-2 text-center text-[13px] text-accent-red-dark" role="alert">{err} <button type="button" className="underline" onClick={() => void join(codeParam)}>Try again</button></p>
          )}
        </Rise>

        {/* ── The two routes ── */}
        <section className="mt-20 md:mt-28" id="routes">
          <Rise className="text-center">
            <p className={EYEBROW}>Two ways in</p>
            <h2 className={`mt-3 text-[clamp(28px,4vw,44px)] leading-[1.06] ${DISPLAY}`}>Make one card. Either way, or both.</h2>
          </Rise>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <Rise className="flex flex-col rounded-3xl border border-keeper-hair bg-white/80 p-7 md:p-8">
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-keeper-gold-wash text-keeper-gold"><Camera className="h-5 w-5" strokeWidth={1.75} /></span>
                <span className="rounded-full bg-keeper-gold-wash px-3 py-1 text-[12px] font-semibold text-keeper-gold">Pro choice</span>
              </div>
              <h3 className={`mt-5 text-[26px] leading-[1.1] ${DISPLAY}`}>I’ve got a photo of them</h3>
              <p className="mt-2 text-[15px] leading-[1.6] text-keeper-body">Upload one clear photo. Tell us where to put them and what the front should say. We check the likeness, draw the front at print quality, then write the inside.</p>
              <p className="mt-4 text-[13px] text-keeper-meta">About 10 minutes · one card · the model we’ll launch with</p>
              <div className="mt-6">
                {open ? (
                  <Link href="/photo/make" className={primary} data-testid="beta-door-photo">Test the photo route <ArrowRight className="h-4 w-4" /></Link>
                ) : (
                  <button type="button" disabled className={primary}>Test the photo route</button>
                )}
              </div>
            </Rise>
            <Rise className="flex flex-col rounded-3xl border border-keeper-hair bg-white/80 p-7 md:p-8" delay={0.05}>
              <div className="flex items-center justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-keeper-gold-wash text-keeper-gold"><Sparkles className="h-5 w-5" strokeWidth={1.75} /></span>
                <span className="rounded-full border border-keeper-hair px-3 py-1 text-[12px] font-semibold text-keeper-body">Quickest</span>
              </div>
              <h3 className={`mt-5 text-[26px] leading-[1.1] ${DISPLAY}`}>I’ll tell you about them</h3>
              <p className="mt-2 text-[15px] leading-[1.6] text-keeper-body">No photo. Answer a few questions about who they are and what the occasion is. You get three card concepts at once and pick the one that’s most them.</p>
              <p className="mt-4 text-[13px] text-keeper-meta">About 2 minutes · three concepts · the quicker model</p>
              <div className="mt-6">
                {open ? (
                  <Link href="/create" className={secondary} data-testid="beta-door-maker">Test the three-card route <ArrowRight className="h-4 w-4" /></Link>
                ) : (
                  <button type="button" disabled className={secondary}>Test the three-card route</button>
                )}
              </div>
            </Rise>
          </div>
          {!open && loaded && betaMode && (
            <p className="mt-4 text-center text-[13px] text-keeper-meta">The doors open once you’re in.</p>
          )}
        </section>

        {/* ── What it makes ── */}
        <section className="mt-20 md:mt-28">
          <Rise className="text-center">
            <p className={EYEBROW}>What it makes</p>
            <h2 className={`mt-3 text-[clamp(28px,4vw,44px)] leading-[1.06] ${DISPLAY}`}>One photo in. A whole card out.</h2>
          </Rise>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { src: '/hero-real-source.webp', label: '1 · The photo they send', alt: 'The source photo, a phone snap of the person' },
              { src: '/hero-real-card.webp', label: '2 · The front, drawn around them', alt: 'The finished card front, printed and standing on a table' },
              { src: '/hero-real-open.webp', label: '3 · The inside, written for them', alt: 'The card open, showing the inside message' },
            ].map((s, i) => (
              <Rise key={s.src} delay={i * 0.05}>
                <figure className="overflow-hidden rounded-2xl border border-keeper-hair bg-white">
                  <img src={s.src} alt={s.alt} loading="lazy" decoding="async" className="aspect-square w-full object-cover" />
                  <figcaption className="px-4 py-3 text-[13px] font-medium text-keeper-ink">{s.label}</figcaption>
                </figure>
              </Rise>
            ))}
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {GALLERY_EXAMPLES.slice(0, 6).map((e, i) => (
              <Rise key={e.id} delay={i * 0.03}>
                <Link href={e.storySlug ? `/stories/${e.storySlug}` : '/gallery'} className="group block overflow-hidden rounded-xl border border-keeper-hair bg-white">
                  <img src={e.front} alt={e.alt} loading="lazy" decoding="async" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                  <span className="block truncate px-3 py-2 text-[12px] text-keeper-body">{e.title}</span>
                </Link>
              </Rise>
            ))}
          </div>
          <p className="mt-5 text-center text-[14px] text-keeper-body">
            <Link href="/gallery" className="font-semibold text-keeper-gold underline underline-offset-2">Every card in the gallery</Link>
            <span className="mx-2 text-keeper-meta">·</span>
            <Link href="/stories" className="font-semibold text-keeper-gold underline underline-offset-2">The stories behind them</Link>
          </p>
        </section>

        {/* ── What we need ── */}
        <section className="mt-20 md:mt-28">
          <Rise className="text-center">
            <p className={EYEBROW}>What we need from you</p>
            <h2 className={`mt-3 text-[clamp(28px,4vw,44px)] leading-[1.06] ${DISPLAY}`}>Make one, then two minutes of honesty.</h2>
          </Rise>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { n: '1', t: 'Make a card', d: 'Pick a route above. Use a real person and a real occasion, the way you would if it were going in the post.' },
              { n: '2', t: 'Look at it properly', d: 'Open it, read the inside, imagine it on their mantelpiece. Would it make them smile? Would you be proud to have sent it?' },
              { n: '3', t: 'Tell us', d: `Five quick questions, including the one we most want answered: would you pay ${price} for it, printed and posted?` },
            ].map((s, i) => (
              <Rise key={s.n} delay={i * 0.05}>
                <li className="h-full rounded-3xl border border-keeper-hair bg-white/80 p-7">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-keeper-gold text-[14px] font-semibold text-white">{s.n}</span>
                  <h3 className={`mt-4 text-[22px] leading-[1.15] ${DISPLAY}`}>{s.t}</h3>
                  <p className="mt-2 text-[15px] leading-[1.6] text-keeper-body">{s.d}</p>
                </li>
              </Rise>
            ))}
          </ol>
        </section>

        {/* ── On / off ── */}
        <section className="mt-20 md:mt-28">
          <div className="grid gap-5 md:grid-cols-2">
            <Rise className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-7">
              <h3 className={`text-[22px] leading-[1.15] ${DISPLAY}`}>On during the beta</h3>
              <ul className="mt-4 space-y-2.5 text-[15px] text-keeper-body">
                {['Making cards on both routes, free, a few a day', 'Saving them to your studio and coming back', 'The likeness check on your photo before anything is drawn', 'Deleting a card, which deletes the photo with it'].map((t) => (
                  <li key={t} className="flex gap-2.5"><Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600" strokeWidth={2} /> {t}</li>
                ))}
              </ul>
            </Rise>
            <Rise className="rounded-3xl border border-keeper-hair bg-white/80 p-7" delay={0.05}>
              <h3 className={`text-[22px] leading-[1.15] ${DISPLAY}`}>Off during the beta</h3>
              <ul className="mt-4 space-y-2.5 text-[15px] text-keeper-body">
                {['Payments. There is nothing to buy and no card details are asked for', 'Printing and posting. Cards stay on screen for now', 'Stock cards and anything that isn’t made for one person'].map((t) => (
                  <li key={t} className="flex gap-2.5"><X className="mt-1 h-4 w-4 shrink-0 text-keeper-meta" strokeWidth={2} /> {t}</li>
                ))}
              </ul>
              <p className="mt-4 text-[13px] text-keeper-meta">Your photo is only used to make your card. <Link href="/privacy-policy" className="underline underline-offset-2">Privacy</Link>.</p>
            </Rise>
          </div>
        </section>

        {/* ── Feedback band ── */}
        <section className="mt-20 md:mt-28">
          <Rise className="rounded-3xl border border-keeper-gold/30 bg-white/80 px-7 py-10 text-center md:px-12 md:py-14">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-keeper-gold-wash text-keeper-gold"><MessageSquareHeart className="h-6 w-6" strokeWidth={1.75} /></span>
            <h2 className={`mt-5 text-[clamp(28px,3.8vw,40px)] leading-[1.08] ${DISPLAY}`}>Made one? Tell us what you think.</h2>
            <p className="mx-auto mt-3 max-w-[46ch] text-[16px] leading-[1.65] text-keeper-body">Blunt is useful. “It was fine” is not. Two minutes.</p>
            <div className="mt-7 flex justify-center">
              <Link href={betaFeedbackHref()} className={primary} data-testid="beta-cta-feedback">Give feedback <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </Rise>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
