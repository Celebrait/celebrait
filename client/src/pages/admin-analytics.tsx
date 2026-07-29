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
type AnalyticsResponse = {
  days: number;
  totals: { visits: number; signups: number; cards: number; paid: number; revenue: number };
  daily: DailyRow[];
  sources: SourceRow[];
};

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

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

      <p className="text-[11.5px] leading-relaxed text-keeper-meta">
        Notes: visits count first page loads (SPA navigation isn't re-counted) with obvious bots
        filtered; "unknown" signups predate attribution capture; revenue uses the amount actually
        paid (discounts included). No cookies are set and no IPs are stored, which is why this
        needs no consent banner.
      </p>
    </div>
  );
}
