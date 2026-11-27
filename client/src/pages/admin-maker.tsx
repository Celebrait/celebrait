// /admin/maker — what people make on the three-card route, and where
// they stop (Aidan 2026-11-27). Data: GET /api/admin/maker, from
// server/make-insights.ts. The funnel is counts per step (no person is
// followed); the sets list is every customer set with what they typed,
// the three fronts we wrote, which one they picked, and whether it sold.
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

type FunnelRow = { step: string; n: number; fromMeta: number | null };
type SetRow = {
  set_id: string; created_at: string; occasion: string | null; tone: string | null;
  recipient: string | null; interest: string | null; dislike: string | null;
  fronts: Array<{ front_text: string; art_direction?: string; tone?: string }>;
  flagged: string[] | null; picked: string | null; card_id: number | null; paid: boolean;
};
type MakerResponse = { days: number; occasion: string | null; funnel: FunnelRow[]; sets: SetRow[] };

const STEP_LABEL: Record<string, string> = {
  landed: 'Landed on the page',
  started: 'Tapped Get started',
  questions: 'Answered the questions',
  drawn: 'Got their three cards',
  picked: 'Picked one',
  finished: 'Finished the card',
  buy: 'Tapped Buy',
  paid: 'Paid',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function AdminMakerPage() {
  const [days, setDays] = useState(7);
  const [occasion, setOccasion] = useState<'christmas' | ''>('christmas');
  const { data, isLoading, error } = useQuery<MakerResponse>({
    queryKey: ['/api/admin/maker', days, occasion],
    queryFn: async () => {
      const r = await fetch(`/api/admin/maker?days=${days}${occasion ? `&occasion=${occasion}` : ''}`, { credentials: 'include' });
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message ?? 'Could not load');
      return r.json();
    },
  });

  const top = data?.funnel.find((f) => f.n > 0)?.n ?? 0;

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-keeper-ink">Card maker</h1>
        <p className="mt-1 max-w-2xl text-sm text-keeper-meta">
          Where people stop on the three-card route, and what they make. Counts only: nobody is followed from step to step.
          Paid comes from the orders themselves. Counting started 27 November 2026.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {([['christmas', 'Christmas'], ['', 'All occasions']] as const).map(([v, l]) => (
            <button key={l} type="button" onClick={() => setOccasion(v)}
              className={`rounded-full border px-3 py-1.5 text-sm ${occasion === v ? 'border-brand bg-brand-muted font-semibold text-brand-dark' : 'border-keeper-hair bg-white text-keeper-body'}`}>
              {l}
            </button>
          ))}
          <span className="mx-1 w-px bg-keeper-hair" />
          {[1, 7, 30].map((d) => (
            <button key={d} type="button" onClick={() => setDays(d)}
              className={`rounded-full border px-3 py-1.5 text-sm ${days === d ? 'border-brand bg-brand-muted font-semibold text-brand-dark' : 'border-keeper-hair bg-white text-keeper-body'}`}>
              {d === 1 ? 'Last 24 hours' : `Last ${d} days`}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand" /></div>
      ) : error || !data ? (
        <p className="text-sm text-red-600">{(error as Error)?.message ?? 'Could not load'}</p>
      ) : (
        <>
          <div className="rounded-xl border border-keeper-hair bg-white">
            <h2 className="border-b border-keeper-hair px-4 py-3 text-sm font-semibold text-keeper-ink">The journey</h2>
            <div className="divide-y divide-keeper-hair">
              {data.funnel.map((f) => {
                const pct = top ? Math.round((f.n / top) * 100) : 0;
                return (
                  <div key={f.step} className="flex items-center gap-4 px-4 py-2.5 text-sm">
                    <span className="w-52 shrink-0 text-keeper-body">{STEP_LABEL[f.step] ?? f.step}</span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                      <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-14 text-right font-semibold tabular-nums text-keeper-ink">{f.n}</span>
                    <span className="w-24 text-right text-xs tabular-nums text-keeper-meta">
                      {f.fromMeta == null ? '' : `${f.fromMeta} from Meta`}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="border-t border-keeper-hair px-4 py-2.5 text-xs text-keeper-meta">
              "Landed", "Tapped Get started" and "Answered the questions" are counted on the Christmas page and the everyday /create page. "From Meta" needs utm_source=meta on the ad's link.
            </p>
          </div>

          <div className="rounded-xl border border-keeper-hair bg-white">
            <h2 className="border-b border-keeper-hair px-4 py-3 text-sm font-semibold text-keeper-ink">
              What people made <span className="font-normal text-keeper-meta">({data.sets.length}{data.sets.length === 150 ? ', newest 150' : ''})</span>
            </h2>
            {data.sets.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-keeper-meta">No sets yet in this window.</p>
            ) : (
              <div className="divide-y divide-keeper-hair">
                {data.sets.map((s) => (
                  <div key={`${s.set_id}-${s.created_at}`} className="px-4 py-4">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                      <span className="text-xs tabular-nums text-keeper-meta">{when(s.created_at)}</span>
                      <span className="font-semibold text-keeper-ink">{s.recipient || 'Anyone'}</span>
                      {s.occasion && <span className="text-keeper-body">{s.occasion}</span>}
                      {s.tone && <span className="rounded-full border border-keeper-hair px-2 py-0.5 text-xs text-keeper-meta">{s.tone}</span>}
                      {s.paid ? (
                        <span className="rounded-full bg-cta-light px-2 py-0.5 text-xs font-semibold text-cta-dark">Paid</span>
                      ) : s.card_id ? (
                        <span className="rounded-full bg-brand-muted px-2 py-0.5 text-xs font-semibold text-brand-dark">Finished, not paid</span>
                      ) : s.picked ? (
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-keeper-body">Picked, didn't finish</span>
                      ) : (
                        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-keeper-meta">Didn't pick</span>
                      )}
                    </div>
                    <p className="mt-1.5 text-sm text-keeper-body">
                      <span className="text-keeper-meta">Typed: </span>
                      <span className="font-medium text-keeper-ink">{s.interest || '(nothing)'}</span>
                      {s.dislike && <><span className="text-keeper-meta"> · Can't stand: </span><span className="text-keeper-ink">{s.dislike}</span></>}
                    </p>
                    <ol className="mt-2 grid gap-2 md:grid-cols-3">
                      {s.fronts.map((f, i) => {
                        const isPick = s.picked === String(i + 1);
                        return (
                          <li key={i} className={`rounded-lg border p-3 text-[13px] ${isPick ? 'border-brand bg-brand-muted' : 'border-keeper-hair'}`}>
                            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-keeper-meta">
                              Card {i + 1}{isPick ? ' · picked' : ''}{f.tone ? ` · ${f.tone}` : ''}
                            </div>
                            <div className="whitespace-pre-line font-medium text-keeper-ink">{f.front_text}</div>
                            {f.art_direction && <div className="mt-1.5 text-xs leading-snug text-keeper-meta">{f.art_direction}</div>}
                          </li>
                        );
                      })}
                    </ol>
                    {s.flagged && s.flagged.length > 0 && (
                      <details className="mt-2 text-xs text-keeper-meta">
                        <summary className="cursor-pointer">Shipped with {s.flagged.length} rule{s.flagged.length === 1 ? '' : 's'} still broken</summary>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5">{s.flagged.map((v, i) => <li key={i}>{v}</li>)}</ul>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
