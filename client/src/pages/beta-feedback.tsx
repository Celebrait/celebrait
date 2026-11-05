// /beta/feedback — the two-minute form every beta CTA points at.
// Five questions; the one that matters most is "would you pay for it".
// Posts to /api/beta/feedback (server/routes/site-lock.ts) which stamps
// the tester's tag from their cookie, so /admin/feedback can group by
// where people came from. ?card=<id>&route=photo|maker arrive from the
// reveal screens and ride along as context.
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { ArrowRight, Check, Loader2, Star } from 'lucide-react';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { Rise } from '@/components/landing/rise';
import { DISPLAY, EYEBROW } from '@/pages/doorway';
import { useSeo, setRobotsMeta } from '@/lib/use-seo';
import { useBetaState } from '@/hooks/use-beta';
import { cardPrice } from '@shared/pricing';
import { formatMoney } from '@shared/market';

type Route = 'photo' | 'maker' | 'both' | 'looked';
type WouldPay = 'yes' | 'maybe' | 'no';

const ROUTES: Array<{ v: Route; l: string }> = [
  { v: 'photo', l: 'The photo route' },
  { v: 'maker', l: 'The three-card route' },
  { v: 'both', l: 'Both' },
  { v: 'looked', l: 'I only looked around' },
];

const field = 'mt-2 w-full rounded-2xl border border-keeper-hair bg-white px-4 py-3 text-[15px] leading-[1.5] text-keeper-ink placeholder:text-keeper-meta focus:border-keeper-gold focus:outline-none';
const pill = (on: boolean) =>
  `rounded-full border px-4 py-2 text-[14px] font-medium transition-colors ${on ? 'border-keeper-gold bg-keeper-gold text-white' : 'border-keeper-hair bg-white text-keeper-ink hover:border-keeper-gold'}`;

export default function BetaFeedbackPage() {
  const [location] = useLocation();
  useSeo(location);
  useEffect(() => { setRobotsMeta('noindex, nofollow'); }, []);
  const search = useSearch();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const cardId = params.get('card');
  const routeParam = params.get('route');
  const { betaMode, loaded } = useBetaState();
  const price = formatMoney(cardPrice('photo'));

  const [route, setRoute] = useState<Route | ''>(routeParam === 'photo' || routeParam === 'maker' ? routeParam : '');
  const [rating, setRating] = useState(0);
  const [wouldPay, setWouldPay] = useState<WouldPay | ''>('');
  const [best, setBest] = useState('');
  const [worst, setWorst] = useState('');
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const canSend = !busy && (rating > 0 || wouldPay !== '' || best.trim() || worst.trim() || notes.trim());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true); setErr('');
    try {
      const body: Record<string, unknown> = {
        route: route || undefined,
        cardId: cardId && /^\d+$/.test(cardId) ? Number(cardId) : undefined,
        rating: rating || undefined,
        wouldPay: wouldPay || undefined,
        best: best.trim() || undefined,
        worst: worst.trim() || undefined,
        notes: notes.trim() || undefined,
        email: email.trim() || undefined,
        path: window.location.pathname + window.location.search,
      };
      const r = await fetch('/api/beta/feedback', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || 'That didn’t send. Try again.');
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (ex) {
      setErr((ex as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="keeper-serif min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="mx-auto max-w-2xl px-6 pb-24 pt-36 md:pt-40">
        {done ? (
          <Rise className="rounded-3xl border border-emerald-200 bg-emerald-50/60 px-7 py-12 text-center md:px-12" >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-6 w-6" strokeWidth={2} /></span>
            <h1 className={`mt-5 text-[clamp(28px,4vw,40px)] leading-[1.08] ${DISPLAY}`} data-testid="beta-feedback-done">Thank you. That helps.</h1>
            <p className="mx-auto mt-3 max-w-[44ch] text-[16px] leading-[1.65] text-keeper-body">Every answer is read by a person. If you fancy another go, the doors are still open.</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/beta#routes" className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-keeper-gold px-7 text-[15px] font-semibold text-white transition-colors hover:bg-keeper-gold-deep">Make another <ArrowRight className="h-4 w-4" /></Link>
              <Link href="/gallery" className="inline-flex h-12 items-center justify-center rounded-full border border-keeper-hair bg-white px-7 text-[15px] font-semibold text-keeper-ink transition-colors hover:bg-keeper-paper">See the gallery</Link>
            </div>
          </Rise>
        ) : (
          <>
            <Rise className="text-center">
              <p className={EYEBROW}>Beta test · two minutes</p>
              <h1 className={`mt-3 text-[clamp(30px,5vw,48px)] leading-[1.04] ${DISPLAY}`}>What did you think?</h1>
              <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-[1.65] text-keeper-body">Blunt is the most useful thing you can be. Nothing here is charged and nothing is printed.</p>
              {loaded && !betaMode && (
                <p className="mt-4 text-[14px] text-accent-red-dark" data-testid="beta-feedback-closed">Beta testing is closed right now, so this form is off.</p>
              )}
            </Rise>

            <Rise delay={0.05}>
              <form onSubmit={submit} className="mt-10 space-y-8 rounded-3xl border border-keeper-hair bg-white/80 p-6 md:p-8" data-testid="beta-feedback-form">
                <fieldset>
                  <legend className="text-[15px] font-semibold text-keeper-ink">Which route did you try?</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {ROUTES.map((r) => (
                      <button key={r.v} type="button" onClick={() => setRoute(r.v)} className={pill(route === r.v)} aria-pressed={route === r.v} data-testid={`beta-route-${r.v}`}>{r.l}</button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-[15px] font-semibold text-keeper-ink">How good was the card?</legend>
                  <p className="mt-0.5 text-[13px] text-keeper-body">1 = wouldn’t send it. 5 = better than anything in the shop.</p>
                  <div className="mt-3 flex gap-1.5" role="radiogroup" aria-label="Rating out of five">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} out of 5`} onClick={() => setRating(n)}
                        className={`flex h-11 w-11 items-center justify-center rounded-full border transition-colors ${n <= rating ? 'border-keeper-gold bg-keeper-gold-wash text-keeper-gold' : 'border-keeper-hair bg-white text-keeper-meta hover:border-keeper-gold'}`}
                        data-testid={`beta-rating-${n}`}>
                        <Star className="h-5 w-5" strokeWidth={1.75} fill={n <= rating ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="text-[15px] font-semibold text-keeper-ink">Would you pay {price} for it, printed and posted?</legend>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {([['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']] as Array<[WouldPay, string]>).map(([v, l]) => (
                      <button key={v} type="button" onClick={() => setWouldPay(v)} className={pill(wouldPay === v)} aria-pressed={wouldPay === v} data-testid={`beta-pay-${v}`}>{l}</button>
                    ))}
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="fb-best" className="text-[15px] font-semibold text-keeper-ink">What was the best bit?</label>
                  <textarea id="fb-best" value={best} onChange={(e) => setBest(e.target.value.slice(0, 1500))} rows={3} className={field} placeholder="The moment it looked like them? The inside message? Nothing?" />
                </div>
                <div>
                  <label htmlFor="fb-worst" className="text-[15px] font-semibold text-keeper-ink">What was off, confusing or slow?</label>
                  <textarea id="fb-worst" value={worst} onChange={(e) => setWorst(e.target.value.slice(0, 1500))} rows={3} className={field} placeholder="Be specific. “The face wasn’t right”, “I didn’t know what to type”, “the wait felt long”." />
                </div>
                <div>
                  <label htmlFor="fb-notes" className="text-[15px] font-semibold text-keeper-ink">Anything else?</label>
                  <textarea id="fb-notes" value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 3000))} rows={3} className={field} placeholder="Who would you make one for? What would make you say yes?" />
                </div>
                <div>
                  <label htmlFor="fb-email" className="text-[15px] font-semibold text-keeper-ink">Email <span className="font-normal text-keeper-meta">(optional, only if we may ask a follow-up)</span></label>
                  <input id="fb-email" type="email" value={email} onChange={(e) => setEmail(e.target.value.slice(0, 200))} className={field} autoComplete="email" placeholder="you@example.com" />
                </div>

                {err && <p className="text-[14px] text-accent-red-dark" role="alert">{err}</p>}
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <button type="submit" disabled={!canSend || (loaded && !betaMode)} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-keeper-gold px-7 text-[15px] font-semibold text-white transition-colors hover:bg-keeper-gold-deep disabled:cursor-not-allowed disabled:opacity-40" data-testid="beta-feedback-submit">
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send feedback
                  </button>
                  <p className="text-[13px] text-keeper-meta">Answer whatever you like. One line is enough.</p>
                </div>
              </form>
            </Rise>
          </>
        )}
      </main>
      <MarketingFooter />
    </div>
  );
}
