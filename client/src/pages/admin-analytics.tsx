// /admin/analytics — first-party traffic + funnel in one screen.
// Answers the only marketing question that matters right now:
// "which source produced actual customers?"
//
// Data: /api/admin/analytics (30d default). Cookieless server-side visit
// log + first-touch attribution on signups, joined through to cards and
// paid orders. See server/visit-log.ts + client/src/lib/attribution.ts.
import { useQuery } from '@tanstack/react-query';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Loader2, TrendingUp, Users, CreditCard, Palette } from 'lucide-react';
import { formatMoney } from '@shared/market';

type DailyRow = {
  day: string;
  visits: number;
  signups: number;
  cards: number;
  paid: number;
  revenue: number;
};
type SourceRow = {
  source: string;
  visits: number;
  signups: number;
  cards: number;
  paid: number;
  revenue: number;
};
type PerfRow = {
  path: string; n: number;
  ttfb_p75: number | null; lcp_p50: number | null; lcp_p75: number | null;
  mobile_lcp_p75: number | null; mobile_n: number;
};
type PageRow = { path: string; visits: number; last_seen: string; real: boolean };
type RecentRow = { created_at: string; path: string; device: string | null; source: string; real: boolean };
type AnalyticsResponse = {
  days: number;
  totals: { visits: number; signups: number; cards: number; paid: number; revenue: number };
  daily: DailyRow[];
  sources: SourceRow[];
  pages?: PageRow[];
  recent?: RecentRow[];
  perf?: PerfRow[];
};

/** Google's LCP bands: good ≤2.5s, needs work ≤4s, poor beyond. */
function lcpTone(ms: number | null): string {
  if (ms == null) return 'text-keeper-meta';
  return ms <= 2500 ? 'text-cta-dark' : ms <= 4000 ? 'text-amber-600' : 'text-accent-red-dark';
}
const secs = (ms: number | null) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);
// UK clock, whatever the browser's own time zone is.
const when = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/** A path the counter no longer accepts (not a page the site serves, or
 *  one of our own tooling pages): shown, but marked as noise. */
const NotCounted = () => (
  <span className="ml-2 rounded-full border border-keeper-hair px-1.5 py-0.5 text-[10.5px] font-medium text-keeper-meta">
    no longer counted
  </span>
);

// Revenue in the active market's currency (shared/market).
const gbp = (minor: number) => formatMoney(minor);

export default function AdminAnalyticsPage() {
  const { data, isLoading, error } = useQuery<AnalyticsResponse>({
    queryKey: ['/api/admin/analytics'],
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="p-8 text-sm text-red-600">
        Couldn't load analytics: {(error as Error)?.message ?? 'unknown error'}
      </div>
    );
  }

  const { totals, daily, sources } = data;
  const conv = (a: number, b: number) => (b > 0 ? `${((a / b) * 100).toFixed(0)}%` : '—');

  const stats = [
    { label: `Visits (${data.days}d)`, value: totals.visits, icon: TrendingUp, hint: 'HTML page loads, bots filtered' },
    { label: 'Signups', value: totals.signups, icon: Users, hint: `${conv(totals.signups, totals.visits)} of visits` },
    { label: 'Cards completed', value: totals.cards, icon: Palette, hint: `${conv(totals.cards, totals.signups)} of signups` },
    { label: 'Paid orders', value: totals.paid, icon: CreditCard, hint: `${gbp(totals.revenue)} revenue` },
  ];

  return (
    <div className="space-y-8 p-6 md:p-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-keeper-ink">Analytics</h1>
        <p className="mt-1 text-sm text-keeper-meta">
          First-party, cookieless. Sources come from UTM tags (
          <code className="rounded bg-stone-100 px-1">?utm_source=sophie</code> on any link you
          share) or the referring site; attribution sticks at first touch and follows through to
          purchase.
        </p>
      </div>

      {/* Headline stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-keeper-hair bg-white p-4">
            <div className="flex items-center gap-2 text-keeper-meta">
              <s.icon className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">{s.label}</span>
            </div>
            <div className="mt-2 font-display text-2xl font-semibold text-keeper-ink">
              {s.value}
            </div>
            <div className="mt-0.5 text-[11.5px] text-keeper-meta">{s.hint}</div>
          </div>
        ))}
      </div>

      {/* Daily chart: visits as bars, signups + paid as lines */}
      <div className="rounded-xl border border-keeper-hair bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-keeper-ink">Daily</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={daily} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5DFD4" />
              <XAxis
                dataKey="day"
                tick={{ fontSize: 10, fill: '#645C53' }}
                tickFormatter={(d: string) => d.slice(5)}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10, fill: '#645C53' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5DFD4' }}
              />
              <Bar dataKey="visits" fill="#e5e4f9" radius={[3, 3, 0, 0]} name="Visits" />
              <Line
                type="monotone"
                dataKey="signups"
                stroke="#5c57d4"
                strokeWidth={2}
                dot={false}
                name="Signups"
              />
              <Line
                type="monotone"
                dataKey="paid"
                stroke="#4ac437"
                strokeWidth={2}
                dot={false}
                name="Paid"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Real-user speed (server/rum.ts) */}
      <div className="rounded-xl border border-keeper-hair bg-white">
        <h2 className="border-b border-keeper-hair px-4 py-3 text-sm font-semibold text-keeper-ink">
          Speed, as real visitors saw it — largest paint (p50 / p75), first byte (p75)
        </h2>
        {!data.perf || data.perf.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-keeper-meta">
            No samples yet — every public page load sends one from now on.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[11px] uppercase tracking-wide text-keeper-meta">
                <tr>
                  <th className="px-4 py-2">Route</th>
                  <th className="px-4 py-2 text-right">Loads</th>
                  <th className="px-4 py-2 text-right">LCP p50</th>
                  <th className="px-4 py-2 text-right">LCP p75</th>
                  <th className="px-4 py-2 text-right">Mobile LCP p75</th>
                  <th className="px-4 py-2 text-right">TTFB p75</th>
                </tr>
              </thead>
              <tbody>
                {data.perf.map((r) => (
                  <tr key={r.path} className="border-t border-keeper-hair">
                    <td className="px-4 py-2 font-mono text-[12px] text-keeper-ink">{r.path}</td>
                    <td className="px-4 py-2 text-right text-keeper-body">{r.n}</td>
                    <td className={`px-4 py-2 text-right font-medium ${lcpTone(r.lcp_p50)}`}>{secs(r.lcp_p50)}</td>
                    <td className={`px-4 py-2 text-right font-medium ${lcpTone(r.lcp_p75)}`}>{secs(r.lcp_p75)}</td>
                    <td className={`px-4 py-2 text-right ${lcpTone(r.mobile_lcp_p75)}`}>{secs(r.mobile_lcp_p75)}{r.mobile_n ? <span className="ml-1 text-[11px] text-keeper-meta">({r.mobile_n})</span> : null}</td>
                    <td className="px-4 py-2 text-right text-keeper-body">{r.ttfb_p75 == null ? '—' : `${r.ttfb_p75}ms`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Source funnel */}
      <div className="rounded-xl border border-keeper-hair bg-white">
        <h2 className="border-b border-keeper-hair px-4 py-3 text-sm font-semibold text-keeper-ink">
          By source — visits → signups → cards → paid
        </h2>
        {sources.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-keeper-meta">
            Nothing yet. Share a link with <code>?utm_source=yourname</code> and watch it land
            here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-keeper-meta">
                  <th className="px-4 py-2.5">Source</th>
                  <th className="px-3 py-2.5 text-right">Visits</th>
                  <th className="px-3 py-2.5 text-right">Signups</th>
                  <th className="px-3 py-2.5 text-right">Cards</th>
                  <th className="px-3 py-2.5 text-right">Paid</th>
                  <th className="px-4 py-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {sources.map((s) => (
                  <tr key={s.source} className="border-t border-keeper-hair/60">
                    <td className="px-4 py-2.5 font-medium text-keeper-ink">{s.source}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.visits}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.signups}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.cards}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.paid}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {s.revenue > 0 ? gbp(s.revenue) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Which pages */}
      <div className="rounded-xl border border-keeper-hair bg-white">
        <h2 className="border-b border-keeper-hair px-4 py-3 text-sm font-semibold text-keeper-ink">
          Pages opened ({data.days} days)
        </h2>
        {!data.pages || data.pages.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-keeper-meta">No visits in this window.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-keeper-meta">
                  <th className="px-4 py-2.5">Page</th>
                  <th className="px-3 py-2.5 text-right">Visits</th>
                  <th className="px-4 py-2.5 text-right">Last visit</th>
                </tr>
              </thead>
              <tbody>
                {data.pages.map((p) => (
                  <tr key={p.path} className="border-t border-keeper-hair/60">
                    <td className={`px-4 py-2.5 font-mono text-[12px] ${p.real ? 'text-keeper-ink' : 'text-keeper-meta'}`}>
                      {p.path}
                      {p.real ? null : <NotCounted />}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{p.visits}</td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-keeper-body">{when(p.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Latest visits, one by one */}
      <div className="rounded-xl border border-keeper-hair bg-white">
        <h2 className="border-b border-keeper-hair px-4 py-3 text-sm font-semibold text-keeper-ink">
          Latest visits
        </h2>
        {!data.recent || data.recent.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-keeper-meta">No visits yet.</p>
        ) : (
          <div className="max-h-[420px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="text-left text-[11px] uppercase tracking-wide text-keeper-meta">
                  <th className="px-4 py-2.5">When (UK time)</th>
                  <th className="px-3 py-2.5">Page</th>
                  <th className="px-3 py-2.5">Source</th>
                  <th className="px-4 py-2.5">Device</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r, i) => (
                  <tr key={`${r.created_at}-${i}`} className="border-t border-keeper-hair/60">
                    <td className="whitespace-nowrap px-4 py-2 tabular-nums text-keeper-body">{when(r.created_at)}</td>
                    <td className={`px-3 py-2 font-mono text-[12px] ${r.real ? 'text-keeper-ink' : 'text-keeper-meta'}`}>
                      {r.path}
                      {r.real ? null : <NotCounted />}
                    </td>
                    <td className="px-3 py-2 text-keeper-body">{r.source}</td>
                    <td className="px-4 py-2 text-keeper-body">{r.device ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11.5px] leading-relaxed text-keeper-meta">
        Notes: visits count first page loads (SPA navigation isn't re-counted) with obvious bots
        filtered. Since 26 November 2026 a visit also has to be to a page the site really serves,
        from something that behaves like a browser opening a page; older rows that would no longer
        count are marked "no longer counted" above and are still in the totals; "unknown" signups predate attribution capture; revenue uses the amount actually
        paid (discounts included). No cookies are set and no IPs are stored, which is why this
        needs no consent banner.
      </p>
    </div>
  );
}
