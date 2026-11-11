// client/src/pages/admin-codes.tsx — gift codes for creators (2026-11-11).
//
// The comp-code system has existed on the server since the influencer
// plan (server/routes/admin-comp-codes.ts, server/studio/comp-code.ts):
// a code typed at checkout under "Got a code?" zeroes the postage, the
// card, or both, and a fully covered order skips Stripe and goes straight
// to print. What it never had was a screen — codes could only be minted
// with a hand-made request. This is that screen: make codes, see who has
// used theirs and what it cost, switch one off.
//
// One code per person is the point. A shared code that leaks costs a run
// on the print account; a named single-use code costs one card, and the
// list says whose it was.
import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Gift, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { formatMoney } from '@shared/market';
import { cardPrice, shippingPrice } from '@shared/pricing';

interface Code {
  code: string; label: string; coversShipping: boolean; coversCard: boolean;
  maxUses: number; uses: number; active: boolean; expiresAt: string | null;
  notes: string | null; createdAt: string | null; giftedValue: number; lastUsed: string | null;
}

function coversLabel(c: Pick<Code, 'coversCard' | 'coversShipping'>): string {
  return c.coversCard && c.coversShipping ? 'Card and postage' : c.coversCard ? 'Card only' : 'Postage only';
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); window.setTimeout(() => setDone(false), 1600); } catch { /* the text is selectable beside it */ }
      }}
      className="inline-flex items-center gap-1 rounded-full border border-keeper-hair bg-white px-2.5 py-1 text-[12px] font-medium text-keeper-ink hover:border-brand"
    >
      {done ? <Check className="h-3.5 w-3.5 text-green-700" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? 'Copied' : label}
    </button>
  );
}

export default function AdminCodesPage() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');
  // The form. Names: one per line makes one code each.
  const [names, setNames] = useState('');
  const [covers, setCovers] = useState<'both' | 'postage'>('both');
  const [maxUses, setMaxUses] = useState(1);
  const [custom, setCustom] = useState('');
  const [making, setMaking] = useState(false);
  const [formErr, setFormErr] = useState('');
  const [fresh, setFresh] = useState<Code[]>([]);

  const load = () =>
    apiRequest('GET', '/api/admin/comp-codes')
      .then((r) => r.json())
      .then((j) => setCodes(j.compCodes ?? []))
      .catch(() => setErr('Could not load the codes.'))
      .finally(() => setBusy(false));
  useEffect(() => { void load(); }, []);

  const list = useMemo(() => names.split('\n').map((n) => n.trim()).filter(Boolean), [names]);
  const costEach = (covers === 'both' ? cardPrice('photo') : 0) + shippingPrice();
  const totals = useMemo(() => ({
    made: codes.length,
    used: codes.reduce((a, c) => a + c.uses, 0),
    gifted: codes.reduce((a, c) => a + c.giftedValue, 0),
  }), [codes]);

  const make = async () => {
    setFormErr('');
    if (list.length === 0) { setFormErr('Add at least one name, so you know later who the code was for.'); return; }
    if (custom.trim() && list.length > 1) { setFormErr('A custom code only works with one name. Clear it, or add the names one at a time.'); return; }
    setMaking(true);
    const made: Code[] = [];
    try {
      for (const label of list) {
        const r = await apiRequest('POST', '/api/admin/comp-codes', {
          label,
          coversShipping: true,
          coversCard: covers === 'both',
          maxUses,
          ...(custom.trim() ? { code: custom.trim() } : {}),
        });
        const j = await r.json();
        if (j?.compCode) made.push({ ...j.compCode, giftedValue: 0, lastUsed: null });
      }
      setNames(''); setCustom('');
    } catch (e) {
      const m = String((e as Error)?.message ?? '');
      setFormErr(/409|already exists/i.test(m) ? 'That code already exists. Pick another.' : 'One of the codes could not be made. The ones below were.');
    } finally {
      setFresh(made);
      setMaking(false);
      void load();
    }
  };

  const toggle = async (c: Code) => {
    try {
      await apiRequest('PATCH', `/api/admin/comp-codes/${encodeURIComponent(c.code)}`, { active: !c.active });
      void load();
    } catch { setErr('Could not change that code.'); }
  };

  const dm = (c: Pick<Code, 'code' | 'coversCard' | 'coversShipping'>) =>
    `Here's your Celebrait gift code: ${c.code}\n\nMake your card at celebrait.co.uk (it's free to make). At checkout, tap "Got a code?" and enter it. ${c.coversCard && c.coversShipping ? 'The card and the postage are on us.' : 'The postage is on us.'}`;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-display text-3xl font-semibold text-keeper-ink">Gift codes</h1>
      <p className="mt-2 max-w-[70ch] text-[15px] leading-relaxed text-keeper-body">
        A code someone types at checkout under “Got a code?”. Make one per person: if it leaks it costs one card, and this
        list shows whose it was. A code is only used up when the order goes through, never by just trying it.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          ['Codes made', String(totals.made)],
          ['Times used', String(totals.used)],
          ['Given away so far', formatMoney(totals.gifted)],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-keeper-hair bg-white p-4">
            <p className="text-[12px] uppercase tracking-[0.12em] text-keeper-meta">{l}</p>
            <p className="mt-1 text-[20px] font-semibold text-keeper-ink">{v}</p>
          </div>
        ))}
      </div>

      {/* ── Make codes ── */}
      <div className="mt-8 rounded-2xl border border-brand/40 bg-brand-muted p-5">
        <p className="flex items-center gap-2 text-[15px] font-semibold text-keeper-ink">
          <Gift className="h-4 w-4 text-brand-dark" /> Make codes
        </p>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div>
            <label htmlFor="code-names" className="text-[13px] font-medium text-keeper-ink">Who are they for?</label>
            <p className="text-[12px] text-keeper-meta">One per line. Each line gets its own code. A name and handle is ideal.</p>
            <textarea
              id="code-names"
              value={names}
              onChange={(e) => setNames(e.target.value)}
              rows={5}
              placeholder={'Laura Dove @fivelittledoves\nSam Reid @samreidhome'}
              className="mt-2 w-full rounded-lg border border-keeper-hair bg-white px-3 py-2 text-sm text-keeper-ink placeholder:text-keeper-meta/60"
              data-testid="code-names"
            />
          </div>
          <div className="space-y-4">
            <fieldset>
              <legend className="text-[13px] font-medium text-keeper-ink">What does it cover?</legend>
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-[13.5px] text-keeper-body">
                <input type="radio" name="covers" checked={covers === 'both'} onChange={() => setCovers('both')} className="mt-1" data-testid="covers-both" />
                <span><b className="text-keeper-ink">Card and postage.</b> They pay nothing, and need no dates. Best for creators.</span>
              </label>
              <label className="mt-2 flex cursor-pointer items-start gap-2 text-[13.5px] text-keeper-body">
                <input type="radio" name="covers" checked={covers === 'postage'} onChange={() => setCovers('postage')} className="mt-1" data-testid="covers-postage" />
                <span><b className="text-keeper-ink">Postage only.</b> The card is still {formatMoney(cardPrice('photo'))}, or free if they add three dates.</span>
              </label>
            </fieldset>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label htmlFor="code-uses" className="text-[13px] font-medium text-keeper-ink">Uses per code</label>
                <input
                  id="code-uses"
                  type="number" min={1} max={50} value={maxUses}
                  onChange={(e) => setMaxUses(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                  className="mt-1 block h-9 w-24 rounded-lg border border-keeper-hair bg-white px-2.5 text-sm text-keeper-ink"
                />
              </div>
              <div>
                <label htmlFor="code-custom" className="text-[13px] font-medium text-keeper-ink">Your own code <span className="font-normal text-keeper-meta">(optional)</span></label>
                <input
                  id="code-custom"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value.toUpperCase())}
                  placeholder="e.g. LAURA-XMAS"
                  maxLength={32}
                  className="mt-1 block h-9 w-48 rounded-lg border border-keeper-hair bg-white px-2.5 text-sm uppercase text-keeper-ink placeholder:normal-case placeholder:text-keeper-meta/60"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={make}
            disabled={making}
            className="inline-flex items-center gap-2 rounded-full bg-go px-5 py-2.5 text-[14px] font-semibold text-go-foreground hover:bg-go-hover disabled:opacity-60"
            data-testid="make-codes"
          >
            {making && <Loader2 className="h-4 w-4 animate-spin" />}
            {list.length > 1 ? `Make ${list.length} codes` : 'Make the code'}
          </button>
          <p className="text-[12.5px] text-keeper-body">
            If every use is taken, this gives away up to{' '}
            <b className="text-keeper-ink">{formatMoney(costEach * maxUses * Math.max(1, list.length))}</b> at list price
            ({formatMoney(costEach)} per use).
          </p>
        </div>
        {formErr && <p className="mt-3 text-[13px] text-red-600" role="alert">{formErr}</p>}

        {fresh.length > 0 && (
          <div className="mt-5 rounded-xl border border-keeper-hair bg-white p-4" data-testid="fresh-codes">
            <p className="text-[13px] font-semibold text-keeper-ink">Just made. Send each person theirs.</p>
            <ul className="mt-3 space-y-2.5">
              {fresh.map((c) => (
                <li key={c.code} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13.5px] text-keeper-body">
                  <code className="select-all rounded bg-keeper-paper px-2 py-1 font-mono text-[14px] font-semibold text-keeper-ink">{c.code}</code>
                  <span className="min-w-0 flex-1 truncate">{c.label} · {coversLabel(c)}</span>
                  <CopyButton text={c.code} label="Copy code" />
                  <CopyButton text={dm(c)} label="Copy a message to send" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── Every code ── */}
      <div className="mt-8 overflow-x-auto rounded-2xl border border-keeper-hair bg-white">
        <div className="border-b border-keeper-hair px-4 py-3">
          <p className="text-[12px] uppercase tracking-[0.12em] text-keeper-meta">Every code, newest first</p>
        </div>
        {busy ? (
          <p className="flex items-center gap-2 px-4 py-6 text-sm text-keeper-meta"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
        ) : err ? (
          <p className="px-4 py-6 text-sm text-red-600">{err}</p>
        ) : codes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-keeper-meta">No codes yet. Make the first one above.</p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-keeper-paper text-[12px] uppercase tracking-[0.1em] text-keeper-meta">
              <tr>{['Code', 'For', 'Covers', 'Used', 'Given away', 'Last used', ''].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-keeper-hair text-keeper-body">
              {codes.map((c) => (
                <tr key={c.code} className={c.active ? '' : 'opacity-50'} data-testid={`code-row-${c.code}`}>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <code className="select-all font-mono text-[13px] font-semibold text-keeper-ink">{c.code}</code>
                      <CopyButton text={c.code} />
                    </span>
                  </td>
                  <td className="px-3 py-2.5">{c.label}</td>
                  <td className="px-3 py-2.5">{coversLabel(c)}</td>
                  <td className="px-3 py-2.5">{c.uses} of {c.maxUses}</td>
                  <td className="px-3 py-2.5">{c.giftedValue ? formatMoney(c.giftedValue) : '–'}</td>
                  <td className="px-3 py-2.5">{c.lastUsed ? new Date(c.lastUsed).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '–'}</td>
                  <td className="px-3 py-2.5 text-right">
                    <button type="button" onClick={() => toggle(c)} className="text-[12.5px] font-medium text-keeper-ink underline underline-offset-2 hover:text-brand-dark">
                      {c.active ? 'Switch off' : 'Switch back on'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
