// client/src/pages/admin-site.tsx — the pre-launch lock switch.
//
// On: visitors get the launching-soon page and the early-access list;
// the share password (or an admin sign-in) lets people through.
// Off: the full site. Sign-ups land in Customers → Leads, source
// "early-access".

import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, CheckCircle2, Circle, FlaskConical, Gift, LayoutGrid, Loader2, Lock, LockOpen, Sparkles, XCircle } from 'lucide-react';
import { cardPrice } from '@shared/pricing';
import { formatMoney } from '@shared/market';
import { publicOrigin } from '@shared/market';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Lock { locked: boolean; password: string; rackEnabled: boolean; makerEnabled: boolean; betaMode: boolean; betaCode: string; freeFirstCard?: boolean; freeFirstCardTotal?: number; freeFirstCardDaily?: number; freeFirstCardUsage?: { open: boolean; usedTotal: number; usedToday: number } }
interface LaunchCheck { id: string; group: string; label: string; ok: boolean | null; detail: string; warn?: boolean }
interface LaunchReport { checks: LaunchCheck[]; blocking: number; manual: number; env: string }

/** The launch-readiness panel: Render's env list, read by code, shown as
 *  rows. Red = a real customer would be let down; grey = only a human can
 *  tell. Aidan is hands-off on dev, so this is the one page to open. */
function LaunchReadiness() {
  const { data, isLoading } = useQuery<LaunchReport>({
    queryKey: ['/api/admin/launch-check'],
    queryFn: async () => { const r = await fetch('/api/admin/launch-check', { credentials: 'include' }); if (!r.ok) throw new Error('load'); return r.json(); },
  });
  if (isLoading || !data) return null;
  const groups = Array.from(new Set(data.checks.map((c) => c.group)));
  const ready = data.blocking === 0;
  return (
    <section className={`mt-8 rounded-2xl border p-5 ${ready ? 'border-emerald-300 bg-emerald-50' : 'border-brand/40 bg-brand-muted'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-bold text-keeper-ink">Launch readiness</h2>
        <p className="text-[13px] text-keeper-body">
          {ready ? 'Every automatic check passes.' : `${data.blocking} thing${data.blocking === 1 ? '' : 's'} would let a customer down.`}
          {data.manual > 0 && ` ${data.manual} need a human to confirm.`}
          {data.env !== 'production' && ' (You are looking at a dev server — expect red here.)'}
        </p>
      </div>
      {groups.map((g) => (
        <div key={g} className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-keeper-meta">{g}</p>
          <ul className="mt-1.5 divide-y divide-keeper-hair rounded-xl border border-keeper-hair bg-white">
            {data.checks.filter((c) => c.group === g).map((c) => (
              <li key={c.id} className="flex gap-3 px-4 py-3">
                {c.ok === true ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  : c.warn ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent-red" />
                  : c.ok === false ? <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-red-dark" />
                  : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-keeper-meta" />}
                <div className="min-w-0">
                  <p className={`text-[14px] font-medium ${c.ok === false ? 'text-keeper-ink' : 'text-keeper-ink'}`}>{c.label}</p>
                  <p className="mt-0.5 break-words text-[12.5px] leading-relaxed text-keeper-body">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

export default function AdminSitePage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Lock>({
    queryKey: ['/api/admin/site-lock'],
    queryFn: async () => { const r = await fetch('/api/admin/site-lock', { credentials: 'include' }); if (!r.ok) throw new Error('load'); return r.json(); },
  });
  const [password, setPassword] = useState('');
  const [betaCode, setBetaCode] = useState('');
  const [capTotal, setCapTotal] = useState('');
  const [capDaily, setCapDaily] = useState('');
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { if (data) { setPassword(data.password); setBetaCode(data.betaCode ?? ''); } }, [data]);

  const save = async (patch: Partial<Lock>) => {
    setSaving(true); setNote('');
    try {
      const r = await fetch('/api/admin/site-lock', { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      if (!r.ok) throw new Error('save');
      qc.setQueryData(['/api/admin/site-lock'], await r.json());
      void qc.invalidateQueries({ queryKey: ['/api/site-lock'] });
      setNote('Saved.');
    } catch { setNote('Could not save — try again.'); } finally { setSaving(false); }
  };

  if (isLoading || !data) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-keeper-meta" /></div>;
  const share = typeof window !== 'undefined' ? window.location.origin : publicOrigin();

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="font-display text-2xl font-bold text-keeper-ink">Site lock</h1>
      <p className="mt-1 text-sm text-keeper-body">Before launch, visitors see the launching-soon page and can join the early-access list. You always get through while signed in as admin.</p>

      <div className={`mt-6 flex items-center justify-between gap-4 rounded-2xl border p-5 ${data.locked ? 'border-brand/40 bg-brand-muted' : 'border-keeper-hair bg-white'}`}>
        <div className="flex items-center gap-3">
          {data.locked ? <Lock className="h-6 w-6 text-brand-dark" /> : <LockOpen className="h-6 w-6 text-keeper-meta" />}
          <div>
            <p className="font-semibold text-keeper-ink">{data.locked ? 'Locked — launching-soon page is showing' : 'Open — the full site is live'}</p>
            <p className="text-[13px] text-keeper-body">{data.locked ? 'Only people with the password (and admins) see the site.' : 'Everyone sees the full site.'}</p>
          </div>
        </div>
        <button type="button" disabled={saving} onClick={() => save({ locked: !data.locked })}
          className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${data.locked ? 'border border-keeper-hair bg-white text-keeper-ink hover:border-keeper-ink' : 'bg-cta text-cta-foreground hover:bg-cta-hover'}`}>
          {data.locked ? 'Open the site' : 'Lock the site'}
        </button>
      </div>

      {/* THE RACK (Aidan 2026-10-09): parked until there is stock — a thin
          rack reads as a failed shop. Same switch style as the lock. */}
      <div className={`mt-4 flex items-center justify-between gap-4 rounded-2xl border p-5 ${data.rackEnabled ? 'border-emerald-300 bg-emerald-50' : 'border-keeper-hair bg-white'}`}>
        <div className="flex items-center gap-3">
          <LayoutGrid className={`h-6 w-6 ${data.rackEnabled ? 'text-emerald-600' : 'text-keeper-meta'}`} />
          <div>
            <p className="font-semibold text-keeper-ink">{data.rackEnabled ? 'The rack — live' : 'The rack — parked'}</p>
            <p className="text-[13px] text-keeper-body">{data.rackEnabled ? `Live — stock cards are for sale at ${formatMoney(cardPrice('rack'))}.` : 'Parked — no stock cards anywhere on the site; the carousel shows real cards as proof.'}</p>
          </div>
        </div>
        <button type="button" disabled={saving} onClick={() => save({ rackEnabled: !data.rackEnabled })}
          className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${data.rackEnabled ? 'border border-keeper-hair bg-white text-keeper-ink hover:border-keeper-ink' : 'bg-cta text-cta-foreground hover:bg-cta-hover'}`}>
          {data.rackEnabled ? 'Park the rack' : 'Open the rack'}
        </button>
      </div>

      {/* THE THREE-CARD ROUTE (Aidan 2026-10-29): photo route only for
          launch. Off = /create and /make send customers to /photo and
          the /api/make doors refuse them; admins keep it either way. */}
      <div className={`mt-4 flex items-center justify-between gap-4 rounded-2xl border p-5 ${data.makerEnabled ? 'border-emerald-300 bg-emerald-50' : 'border-keeper-hair bg-white'}`}>
        <div className="flex items-center gap-3">
          <Sparkles className={`h-6 w-6 ${data.makerEnabled ? 'text-emerald-600' : 'text-keeper-meta'}`} />
          <div>
            <p className="font-semibold text-keeper-ink">{data.makerEnabled ? 'Three-card route: live' : 'Three-card route: parked'}</p>
            <p className="text-[13px] text-keeper-body">{data.makerEnabled ? 'Live: both ways of making a card are open.' : 'Parked: only the photo route is open. /create and /make send people to /photo.'}</p>
          </div>
        </div>
        <button type="button" disabled={saving} onClick={() => save({ makerEnabled: !data.makerEnabled })}
          className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${data.makerEnabled ? 'border border-keeper-hair bg-white text-keeper-ink hover:border-keeper-ink' : 'bg-cta text-cta-foreground hover:bg-cta-hover'}`}>
          {data.makerEnabled ? 'Park the route' : 'Open the route'}
        </button>
      </div>

      {/* BETA TESTING (Aidan 2026-11-05): a landing page for testers,
          both routes open to them, NO payments anywhere while it's on.
          Share /beta?t=<where> so /admin/feedback can group by source. */}
      <div className={`mt-4 rounded-2xl border p-5 ${data.betaMode ? 'border-emerald-300 bg-emerald-50' : 'border-keeper-hair bg-white'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <FlaskConical className={`h-6 w-6 ${data.betaMode ? 'text-emerald-600' : 'text-keeper-meta'}`} />
            <div>
              <p className="font-semibold text-keeper-ink">{data.betaMode ? 'Beta testing: on' : 'Beta testing: off'}</p>
              <p className="text-[13px] text-keeper-body">{data.betaMode ? 'Testers join at /beta, see both routes and get through the lock. Checkout refuses everyone but you.' : 'Off: /beta says the beta is closed; Buy buttons and checkout work as normal.'}</p>
            </div>
          </div>
          <button type="button" disabled={saving} onClick={() => save({ betaMode: !data.betaMode })}
            className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${data.betaMode ? 'border border-keeper-hair bg-white text-keeper-ink hover:border-keeper-ink' : 'bg-cta text-cta-foreground hover:bg-cta-hover'}`}>
            {data.betaMode ? 'Stop the beta' : 'Start the beta'}
          </button>
        </div>
        <div className="mt-4 border-t border-keeper-hair/70 pt-4">
          <label htmlFor="beta-code" className="block text-sm font-semibold text-keeper-ink">Beta code <span className="font-normal text-keeper-meta">(optional)</span></label>
          <p className="mt-0.5 text-[13px] text-keeper-body">Leave blank and anyone with the link is in. Set one and /beta asks for it (a link with ?code= skips the question). Changing it signs testers out.</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input id="beta-code" value={betaCode} onChange={(e) => setBetaCode(e.target.value.slice(0, 40))} autoCapitalize="none"
              className="h-11 flex-1 rounded-full border border-keeper-hair px-4 text-[15px] text-keeper-ink focus:border-brand focus:outline-none" />
            <button type="button" disabled={saving || betaCode.trim() === (data.betaCode ?? '')} onClick={() => save({ betaCode: betaCode.trim() })}
              className="h-11 rounded-full bg-keeper-ink px-5 text-sm font-semibold text-keeper-paper disabled:opacity-40">Save code</button>
          </div>
          <p className="mt-3 text-[13px] text-keeper-body">
            Share link: <code className="rounded bg-keeper-paper px-1.5 py-0.5 text-[12px] text-keeper-ink">{share}/beta?t=fb-pod-1{data.betaCode ? `&code=${encodeURIComponent(data.betaCode)}` : ''}</code>
            <span className="block mt-1">Change <code className="text-[12px]">t=</code> per group so the <Link href="/admin/feedback" className="font-medium text-brand-dark underline underline-offset-2">feedback</Link> says where each tester came from.</span>
          </p>
        </div>
      </div>

      {/* THE LAUNCH OFFER (Aidan 2026-11-06, the social ad): the first PHOTO
          card is on us — £0, postage paid by the customer — one per account
          (three dates), one per address, UK only, under these caps. */}
      <div className={`mt-4 rounded-2xl border p-5 ${data.freeFirstCard ? 'border-emerald-300 bg-emerald-50' : 'border-keeper-hair bg-white'}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Gift className={`h-6 w-6 ${data.freeFirstCard ? 'text-emerald-600' : 'text-keeper-meta'}`} />
            <div>
              <p className="font-semibold text-keeper-ink">{data.freeFirstCard ? 'First card on us: on' : 'First card on us: off'}</p>
              <p className="text-[13px] text-keeper-body">
                {data.freeFirstCard
                  ? `The first photo card is £0 at checkout (customer pays postage) after three dates. ${data.freeFirstCardUsage?.open ? 'Open now.' : 'CAP HIT — the site has fallen back to half price.'} Used: ${data.freeFirstCardUsage?.usedTotal ?? 0} of ${data.freeFirstCardTotal ?? 0} total, ${data.freeFirstCardUsage?.usedToday ?? 0} of ${data.freeFirstCardDaily ?? 0} today.`
                  : 'Off: the standing offer is half price on the first card. Switch on to match the ad ("your first card’s on us, seriously").'}
              </p>
            </div>
          </div>
          <button type="button" disabled={saving} onClick={() => save({ freeFirstCard: !data.freeFirstCard })}
            className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 ${data.freeFirstCard ? 'border border-keeper-hair bg-white text-keeper-ink hover:border-keeper-ink' : 'bg-cta text-cta-foreground hover:bg-cta-hover'}`}>
            {data.freeFirstCard ? 'Switch off' : 'Switch on'}
          </button>
        </div>
        <div className="mt-4 grid gap-3 border-t border-keeper-hair/70 pt-4 sm:grid-cols-2">
          <div>
            <label htmlFor="cap-total" className="block text-sm font-semibold text-keeper-ink">Total free cards</label>
            <p className="mt-0.5 text-[13px] text-keeper-body">Counts paid orders where the card was £0. At the cap, the site says half price instead.</p>
            <input id="cap-total" inputMode="numeric" value={capTotal} onChange={(e) => setCapTotal(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={String(data.freeFirstCardTotal ?? 500)}
              className="mt-2 h-11 w-full rounded-full border border-keeper-hair px-4 text-[15px] text-keeper-ink focus:border-brand focus:outline-none" />
          </div>
          <div>
            <label htmlFor="cap-daily" className="block text-sm font-semibold text-keeper-ink">Per day</label>
            <p className="mt-0.5 text-[13px] text-keeper-body">A brake if a post goes big. Resets at midnight UTC.</p>
            <input id="cap-daily" inputMode="numeric" value={capDaily} onChange={(e) => setCapDaily(e.target.value.replace(/\D/g, '').slice(0, 5))} placeholder={String(data.freeFirstCardDaily ?? 50)}
              className="mt-2 h-11 w-full rounded-full border border-keeper-hair px-4 text-[15px] text-keeper-ink focus:border-brand focus:outline-none" />
          </div>
          <div className="sm:col-span-2">
            <button type="button" disabled={saving || (!capTotal && !capDaily)}
              onClick={() => { const patch: Partial<Lock> = {}; if (capTotal) patch.freeFirstCardTotal = Number(capTotal); if (capDaily) patch.freeFirstCardDaily = Number(capDaily); void save(patch).then(() => { setCapTotal(''); setCapDaily(''); }); }}
              className="h-11 rounded-full bg-keeper-ink px-5 text-sm font-semibold text-keeper-paper disabled:opacity-40">Save caps</button>
            <span className="ml-3 text-[13px] text-keeper-body">Photo route only. Three-card and rack stay at half price.</span>
          </div>
        </div>
      </div>

      <LaunchReadiness />

      <div className="mt-6 rounded-2xl border border-keeper-hair bg-white p-5">
        <label htmlFor="site-pass" className="block font-semibold text-keeper-ink">Early-access password</label>
        <p className="mt-0.5 text-[13px] text-keeper-body">Share this with people you want to let in. Not case-sensitive. Changing it signs everyone else out of the preview.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input id="site-pass" value={password} onChange={(e) => setPassword(e.target.value.slice(0, 60))}
            className="h-11 flex-1 rounded-full border border-keeper-hair px-4 text-[15px] text-keeper-ink focus:border-brand focus:outline-none" />
          <button type="button" disabled={saving || password.trim() === data.password} onClick={() => save({ password: password.trim() })}
            className="h-11 rounded-full bg-keeper-ink px-5 text-sm font-semibold text-keeper-paper disabled:opacity-40">Save password</button>
        </div>
        {!password.trim() && <p className="mt-2 text-[13px] text-accent-red-dark">With no password, only admins can get past the page.</p>}
      </div>

      {note && <p className="mt-3 text-sm text-keeper-body">{note}</p>}
      <p className="mt-6 text-sm text-keeper-body">
        Sign-ups: <Link href="/admin/customers" className="font-medium text-brand-dark underline underline-offset-2">Customers → Leads</Link>, source “early-access”. Preview the page in a private window at {share}.
      </p>
    </div>
  );
}
