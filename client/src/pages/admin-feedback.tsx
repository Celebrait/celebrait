// client/src/pages/admin-feedback.tsx — what the beta testers said.
//
// Reads /api/admin/feedback: every join and every form, newest first.
// The summary row answers "how is it going" at a glance (joins, forms,
// average rating, would-pay split); the table is the detail, grouped by
// the tag each tester arrived with (/beta?t=…). CSV export for a
// spreadsheet when Aidan wants to share it with a partner.
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Download, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Row {
  id: number; createdAt: string; kind: 'join' | 'session' | 'builder' | 'card' | 'feedback'; tag: string | null; visitor?: string | null; route: string | null;
  cardId: number | null; userId: string | null; rating: number | null; wouldPay: string | null; price: string | null;
  best: string | null; worst: string | null; notes: string | null; email: string | null; path: string | null; userAgent: string | null;
}

const ROUTE_LABEL: Record<string, string> = { photo: 'Photo', maker: 'Three-card', both: 'Both', looked: 'Looked only' };

function csvEscape(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function AdminFeedbackPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState('');
  const [tag, setTag] = useState<string>('all');
  useEffect(() => {
    apiRequest('GET', '/api/admin/feedback').then((r) => r.json()).then((j) => setRows(j.rows ?? [])).catch(() => setErr('Could not load feedback.')).finally(() => setBusy(false));
  }, []);

  const tags = useMemo(() => Array.from(new Set(rows.map((r) => r.tag ?? '(untagged)'))).sort(), [rows]);
  const shown = useMemo(() => rows.filter((r) => tag === 'all' || (r.tag ?? '(untagged)') === tag), [rows, tag]);
  const joins = shown.filter((r) => r.kind === 'join');
  const forms = shown.filter((r) => r.kind === 'feedback');
  const rated = forms.filter((r) => r.rating != null);
  const avg = rated.length ? (rated.reduce((a, r) => a + (r.rating ?? 0), 0) / rated.length).toFixed(1) : '–';
  const pay = { yes: 0, maybe: 0, no: 0 } as Record<string, number>;
  for (const r of forms) if (r.wouldPay && r.wouldPay in pay) pay[r.wouldPay] += 1;

  // The funnel: PEOPLE (distinct per-browser ids) at each stage, per
  // group. Rows from before the id existed count as their own person.
  const funnel = useMemo(() => {
    const stages = ['join', 'builder', 'card', 'feedback'] as const;
    const byTag = new Map<string, Record<string, Set<string>>>();
    for (const r of rows) {
      if (!(stages as readonly string[]).includes(r.kind)) continue;
      const t = r.tag ?? '(untagged)';
      if (!byTag.has(t)) byTag.set(t, Object.fromEntries(stages.map((s) => [s, new Set<string>()])));
      byTag.get(t)![r.kind].add(r.visitor ?? `row-${r.id}`);
    }
    const all = Object.fromEntries(stages.map((s) => [s, new Set<string>()])) as Record<string, Set<string>>;
    Array.from(byTag.values()).forEach((sets) => { for (const s of stages) Array.from(sets[s]).forEach((v) => all[s].add(v)); });
    const line = (t: string, sets: Record<string, Set<string>>) => ({ tag: t, join: sets.join.size, builder: sets.builder.size, card: sets.card.size, feedback: sets.feedback.size });
    return { groups: Array.from(byTag.entries()).map(([t, sets]) => line(t, sets)).sort((a, b) => b.join - a.join), all: line('All', all) };
  }, [rows]);

  const exportCsv = () => {
    const head = ['id', 'created_at', 'kind', 'tag', 'visitor', 'route', 'card_id', 'rating', 'would_pay', 'best', 'worst', 'notes', 'email', 'path'];
    const lines = [head.join(','), ...rows.map((r) => [r.id, r.createdAt, r.kind, r.tag, r.visitor ?? '', r.route, r.cardId, r.rating, r.wouldPay, r.best, r.worst, r.notes, r.email, r.path].map(csvEscape).join(','))];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `celebrait-beta-feedback-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };

  if (busy) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-keeper-meta" /></div>;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-keeper-ink">Beta feedback</h1>
          <p className="mt-1 text-sm text-keeper-body">Everyone who joined at <Link href="/beta" className="underline underline-offset-2">/beta</Link> and everything they sent back. Switch the beta on and share the link from <Link href="/admin/site" className="underline underline-offset-2">Site lock</Link>.</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="fb-tag" className="text-sm text-keeper-body">Tag</label>
          <select id="fb-tag" value={tag} onChange={(e) => setTag(e.target.value)} className="h-10 rounded-full border border-keeper-hair bg-white px-3 text-sm text-keeper-ink">
            <option value="all">All</option>
            {tags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button type="button" onClick={exportCsv} disabled={!rows.length} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-keeper-hair bg-white px-4 text-sm font-medium text-keeper-ink hover:border-keeper-ink disabled:opacity-40">
            <Download className="h-4 w-4" strokeWidth={1.75} /> CSV
          </button>
        </div>
      </div>
      {err && <p className="mt-4 text-sm text-accent-red-dark">{err}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Joined', String(joins.length)],
          ['Sent feedback', String(forms.length)],
          ['Average rating', rated.length ? `${avg} / 5` : '–'],
          ['Would pay', forms.length ? `${pay.yes} yes · ${pay.maybe} maybe · ${pay.no} no` : '–'],
        ].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-keeper-hair bg-white p-4">
            <p className="text-[12px] uppercase tracking-[0.12em] text-keeper-meta">{l}</p>
            <p className="mt-1 text-[20px] font-semibold text-keeper-ink">{v}</p>
          </div>
        ))}
      </div>

      {funnel.all.join > 0 && (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-keeper-hair bg-white">
          <div className="border-b border-keeper-hair px-4 py-3">
            <p className="text-[12px] uppercase tracking-[0.12em] text-keeper-meta">Funnel by group</p>
            <p className="mt-0.5 text-[13px] text-keeper-body">People, not rows: one browser counts once at each stage. Opened = reached a builder; Made = saw a finished card.</p>
          </div>
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="bg-keeper-paper text-[12px] uppercase tracking-[0.1em] text-keeper-meta">
              <tr>{['Group', 'Joined', 'Opened a builder', 'Made a card', 'Gave feedback'].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-keeper-hair text-keeper-body">
              {[...funnel.groups, ...(funnel.groups.length > 1 ? [funnel.all] : [])].map((g) => (
                <tr key={g.tag} className={g.tag === 'All' ? 'font-semibold text-keeper-ink' : ''} data-testid={`funnel-${g.tag}`}>
                  <td className="px-3 py-2.5">{g.tag}</td>
                  <td className="px-3 py-2.5">{g.join}</td>
                  <td className="px-3 py-2.5">{g.builder}{g.join ? <span className="ml-1.5 text-keeper-meta">{Math.round((g.builder / g.join) * 100)}%</span> : null}</td>
                  <td className="px-3 py-2.5">{g.card}{g.join ? <span className="ml-1.5 text-keeper-meta">{Math.round((g.card / g.join) * 100)}%</span> : null}</td>
                  <td className="px-3 py-2.5">{g.feedback}{g.join ? <span className="ml-1.5 text-keeper-meta">{Math.round((g.feedback / g.join) * 100)}%</span> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {forms.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-keeper-hair p-8 text-center text-sm text-keeper-body">No feedback yet{joins.length ? ` — ${joins.length} ${joins.length === 1 ? 'person has' : 'people have'} joined` : ''}.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-keeper-hair bg-white">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-keeper-paper text-[12px] uppercase tracking-[0.1em] text-keeper-meta">
              <tr>
                {['When', 'Tag', 'Route', 'Rating', 'Pay?', 'Best bit', 'What was off', 'Anything else', 'Email', 'Card'].map((h) => <th key={h} className="px-3 py-2.5 font-medium">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-keeper-hair align-top text-keeper-body">
              {forms.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-3 text-keeper-meta">{new Date(r.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-3 py-3">{r.tag ?? <span className="text-keeper-meta">–</span>}</td>
                  <td className="px-3 py-3">{r.route ? ROUTE_LABEL[r.route] ?? r.route : <span className="text-keeper-meta">–</span>}</td>
                  <td className="px-3 py-3 font-semibold text-keeper-ink">{r.rating ?? '–'}</td>
                  <td className="px-3 py-3">{r.wouldPay ?? '–'}</td>
                  <td className="max-w-[220px] px-3 py-3 whitespace-pre-wrap">{r.best ?? ''}</td>
                  <td className="max-w-[220px] px-3 py-3 whitespace-pre-wrap">{r.worst ?? ''}</td>
                  <td className="max-w-[220px] px-3 py-3 whitespace-pre-wrap">{r.notes ?? ''}</td>
                  <td className="px-3 py-3">{r.email ?? ''}</td>
                  <td className="px-3 py-3">{r.cardId ? <Link href={`/studio/card/${r.cardId}`} className="underline underline-offset-2">#{r.cardId}</Link> : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
