// client/src/pages/admin-costs.tsx
//
// Admin Cost Ledger — turns generation_log data into pricing decisions.
// Sibling page to /admin/prompts; both linked from each other so admins
// can hop between "what's running in production" and "what's it costing
// us." Spec: memory/next_cost_ledger_ui.md.
//
// Data model: one fetch to /api/admin/costs?window=… returns every
// aggregate the dashboard renders. Window switch refetches.

import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2, AlertCircle } from 'lucide-react';
import { genCostUsdX100ToGbp } from '@shared/pricing';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Window = 'today' | '7d' | '30d';

interface CostsResponse {
  window: Window;
  spendTotals: { todayCentsX100: number; weekCentsX100: number; monthCentsX100: number };
  overview: {
    totalCentsX100: number;
    totalRows: number;
    successRows: number;
    successRate: number;
    distinctCards: number;
  };
  perCard: { avgCentsX100: number; maxCentsX100: number; minCentsX100: number };
  regen: { avgRowsPerCard: number };
  byProvider: { provider: string; rows: number; centsX100: number }[];
  bySlot: { slot: string; rows: number; centsX100: number }[];
  /** Card-less LLM spend (photo analysis, scene helper, brainstorm).
   *  Already inside overview.totalCentsX100 — itemised so it can't hide
   *  inside the headline (audit 2026-07-29). */
  llmSpend: {
    totalCentsX100: number;
    bySlot: { slot: string; rows: number; centsX100: number }[];
  };
  topTemplates: {
    templateId: number;
    templateVersion: number | null;
    rows: number;
    centsX100: number;
  }[];
  daily: { day: string; centsX100: number; rows: number; cards: number }[];
  recentExpensive: { cardId: number; centsX100: number; rows: number; lastRowAt: string }[];
}

// Provider costs are stored in USD (costCentsX100 = USD cents × 100, so
// 1340 = $0.134). We operate in GBP, so display converts at a fixed
// approximate rate (see genCostUsdX100ToGbp / USD_TO_GBP in shared/pricing).
// Approximate by design — a rough £ read beats a precise $ one for Kevin.
function formatGbp(centsX100: number): string {
  const pounds = genCostUsdX100ToGbp(centsX100);
  if (pounds >= 100) return `£${pounds.toFixed(0)}`;
  if (pounds >= 1) return `£${pounds.toFixed(2)}`;
  return `£${pounds.toFixed(3)}`;
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10b981',
  gemini: '#8b5cf6',
  flux: '#f59e0b',
  default: '#94a3b8',
};

function colorForProvider(name: string): string {
  return PROVIDER_COLORS[name.toLowerCase()] ?? PROVIDER_COLORS.default;
}

const SLOT_COLORS: Record<string, string> = {
  front_scene: '#3b82f6',
  front_text: '#06b6d4',
  inside_write: '#ec4899',
  inside_blank: '#a855f7',
  default: '#94a3b8',
};

function colorForSlot(name: string): string {
  return SLOT_COLORS[name.toLowerCase()] ?? SLOT_COLORS.default;
}

export default function AdminCostsPage() {
  const [window, setWindow] = useState<Window>('7d');
  const { data, isLoading, error } = useQuery<CostsResponse>({
    queryKey: [`/api/admin/costs?window=${window}`],
    refetchInterval: 60_000, // refresh once a minute — cost data drifts slowly
  });

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Cost Ledger</h1>
          <p className="text-sm text-stone-500 mt-1">
            What every card actually costs. Data informs Sprint 4 pricing.
          </p>
        </div>
        <WindowTabs value={window} onChange={setWindow} />
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-brand" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          <AlertCircle className="w-4 h-4" />
          Couldn't load cost data. {(error as Error).message}
        </div>
      )}

      {data && <CostsView data={data} window={window} />}
    </div>
  );
}

function WindowTabs({ value, onChange }: { value: Window; onChange: (w: Window) => void }) {
  const opts: { id: Window; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: '7d', label: '7 days' },
    { id: '30d', label: '30 days' },
  ];
  return (
    <div className="inline-flex bg-stone-100 rounded-lg p-1">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            value === o.id ? 'bg-white text-ink shadow-sm' : 'text-stone-500 hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function CostsView({ data, window }: { data: CostsResponse; window: Window }) {
  return (
    <div className="space-y-6">
      {/* Spend at a glance — three big numbers, always all three windows */}
      <section className="grid grid-cols-3 gap-4">
        <SpendCard label="Today" centsX100={data.spendTotals.todayCentsX100} />
        <SpendCard label="Last 7 days" centsX100={data.spendTotals.weekCentsX100} />
        <SpendCard label="Last 30 days" centsX100={data.spendTotals.monthCentsX100} />
      </section>

      {/* Window-scoped headline metrics */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Avg cost / card"
          value={formatGbp(data.perCard.avgCentsX100)}
          hint={`across ${data.overview.distinctCards.toLocaleString()} cards`}
          tone="primary"
        />
        <MetricCard
          label="Avg generations / card"
          value={data.regen.avgRowsPerCard.toFixed(2)}
          hint="proxy for regen rate — > 5 hurts margin"
          tone="warning"
        />
        <MetricCard
          label="Success rate"
          value={`${(data.overview.successRate * 100).toFixed(1)}%`}
          hint={`${data.overview.totalRows.toLocaleString()} attempts`}
        />
        <MetricCard
          label="Total spend"
          value={formatGbp(data.overview.totalCentsX100)}
          hint={`window: ${window}`}
        />
      </section>

      {/* Trend charts — daily lines for spend, cards, regen-rate */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Daily spend (~£)" subtitle="Spike here = investigate. Converted from USD.">
          {data.daily.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.daily.map((d) => ({ day: d.day, gbp: genCostUsdX100ToGbp(d.centsX100) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="day" tickFormatter={shortDay} fontSize={11} stroke="#78716c" />
                <YAxis fontSize={11} stroke="#78716c" tickFormatter={(v) => `£${v.toFixed(2)}`} />
                <Tooltip formatter={(v: number) => `£${v.toFixed(3)}`} labelFormatter={shortDay} />
                <Line
                  type="monotone"
                  dataKey="gbp"
                  stroke="#7a76e8"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard
          title="Generations per card (daily avg)"
          subtitle="Killer metric. > 5 = unit economics in trouble."
        >
          {data.daily.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={data.daily.map((d) => ({
                  day: d.day,
                  rate: d.cards > 0 ? d.rows / d.cards : 0,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="day" tickFormatter={shortDay} fontSize={11} stroke="#78716c" />
                <YAxis fontSize={11} stroke="#78716c" />
                <Tooltip formatter={(v: number) => v.toFixed(2)} labelFormatter={shortDay} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="#ec4899"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {/* Provider + slot breakdowns */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Spend by provider">
          {data.byProvider.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.byProvider.map((p) => ({
                    name: p.provider,
                    value: genCostUsdX100ToGbp(p.centsX100),
                  }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  label={(entry) => `${entry.name}: £${entry.value.toFixed(2)}`}
                  labelLine={false}
                >
                  {data.byProvider.map((p) => (
                    <Cell key={p.provider} fill={colorForProvider(p.provider)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `£${v.toFixed(3)}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Spend by slot">
          {data.bySlot.length === 0 ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.bySlot.map((s) => ({ slot: s.slot, gbp: genCostUsdX100ToGbp(s.centsX100) }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="slot" fontSize={11} stroke="#78716c" />
                <YAxis fontSize={11} stroke="#78716c" tickFormatter={(v) => `£${v.toFixed(2)}`} />
                <Tooltip formatter={(v: number) => `£${v.toFixed(3)}`} />
                <Bar dataKey="gbp" radius={[6, 6, 0, 0]}>
                  {data.bySlot.map((s) => (
                    <Cell key={s.slot} fill={colorForSlot(s.slot)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {/* Card-less LLM spend — the text/vision surfaces. These bill on
          every use and produce no card, so they were invisible in this
          ledger until 2026-07-29. Shown separately because they behave
          differently from image gen: brainstorm bills per chat TURN, and
          photo analysis fires on every upload including photos that never
          become a card. */}
      <section>
        <ChartCard
          title="AI helper spend (no card attached)"
          subtitle="Photo analysis, the scene helper and the brainstorm chat. Included in the totals above, itemised here."
        >
          {data.llmSpend.bySlot.length === 0 ? (
            <div className="py-6 text-center text-sm text-stone-500">
              No helper spend in this window.
            </div>
          ) : (
            <>
              <p className="mb-3 text-sm text-stone-600">
                <span className="font-semibold text-stone-900">
                  £{genCostUsdX100ToGbp(data.llmSpend.totalCentsX100).toFixed(3)}
                </span>{' '}
                across {data.llmSpend.bySlot.reduce((n, s) => n + s.rows, 0)} calls
                {data.overview.totalCentsX100 > 0 && (
                  <>
                    {' '}·{' '}
                    {(
                      (data.llmSpend.totalCentsX100 / data.overview.totalCentsX100) *
                      100
                    ).toFixed(1)}
                    % of total spend
                  </>
                )}
              </p>
              <table className="w-full text-sm">
                <thead className="border-b border-stone-200 text-left text-xs uppercase text-stone-500">
                  <tr>
                    <th className="py-2">Surface</th>
                    <th className="py-2 text-right">Calls</th>
                    <th className="py-2 text-right">Spend</th>
                    <th className="py-2 text-right">Avg / call</th>
                  </tr>
                </thead>
                <tbody>
                  {data.llmSpend.bySlot.map((s) => (
                    <tr key={s.slot} className="border-b border-stone-100 last:border-0">
                      <td className="py-2 font-medium text-stone-900">{s.slot}</td>
                      <td className="py-2 text-right tabular-nums">{s.rows}</td>
                      <td className="py-2 text-right tabular-nums">
                        £{genCostUsdX100ToGbp(s.centsX100).toFixed(3)}
                      </td>
                      <td className="py-2 text-right tabular-nums text-stone-500">
                        £{genCostUsdX100ToGbp(s.rows > 0 ? s.centsX100 / s.rows : 0).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </ChartCard>
      </section>

      {/* Top expensive (template, version) pairs */}
      <section>
        <ChartCard
          title="Top 10 expensive template versions"
          subtitle="Find the prompt that's bleeding money."
        >
          {data.topTemplates.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="py-2">Template id</th>
                  <th className="py-2">Version</th>
                  <th className="py-2 text-right">Rows</th>
                  <th className="py-2 text-right">Spend</th>
                </tr>
              </thead>
              <tbody>
                {data.topTemplates.map((t) => (
                  <tr key={`${t.templateId}-${t.templateVersion}`} className="border-b border-stone-100">
                    <td className="py-2 font-mono text-xs text-stone-700">#{t.templateId}</td>
                    <td className="py-2 font-mono text-xs text-stone-700">
                      v{t.templateVersion ?? '—'}
                    </td>
                    <td className="py-2 text-right text-stone-700">{t.rows.toLocaleString()}</td>
                    <td className="py-2 text-right font-medium text-ink">
                      {formatGbp(t.centsX100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ChartCard>
      </section>

      {/* Recent high-cost cards (sanity check for outliers) */}
      <section>
        <ChartCard
          title="Recent expensive cards"
          subtitle="Top 20 cards in this window by total spend."
        >
          {data.recentExpensive.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-stone-500 border-b border-stone-200">
                <tr>
                  <th className="py-2">Card id</th>
                  <th className="py-2 text-right">Rows</th>
                  <th className="py-2 text-right">Spend</th>
                  <th className="py-2 text-right">Last attempt</th>
                </tr>
              </thead>
              <tbody>
                {data.recentExpensive.map((c) => (
                  <tr key={c.cardId} className="border-b border-stone-100">
                    <td className="py-2">
                      <Link
                        href={`/studio/card/${c.cardId}`}
                        className="font-mono text-xs text-brand hover:text-brand-dark"
                      >
                        #{c.cardId}
                      </Link>
                    </td>
                    <td className="py-2 text-right text-stone-700">{c.rows}</td>
                    <td className="py-2 text-right font-medium text-ink">
                      {formatGbp(c.centsX100)}
                    </td>
                    <td className="py-2 text-right text-xs text-stone-500">
                      {new Date(c.lastRowAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ChartCard>
      </section>
    </div>
  );
}

// ── Card primitives ─────────────────────────────────────────────────
function SpendCard({ label, centsX100 }: { label: string; centsX100: number }) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <p className="text-xs uppercase tracking-wider text-stone-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-ink">{formatGbp(centsX100)}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'primary' | 'warning';
}) {
  const toneClass =
    tone === 'primary'
      ? 'bg-brand-muted border-brand-light'
      : tone === 'warning'
        ? 'bg-amber-50 border-amber-200'
        : 'bg-white border-stone-200';
  return (
    <div className={`rounded-xl border p-5 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wider text-stone-500 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="text-[11px] text-stone-500 mt-1">{hint}</p>}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-5">
      <div className="mb-4">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-12 text-xs text-stone-400">
      No data in this window
    </div>
  );
}

// "2026-04-20" → "Apr 20"
function shortDay(d: string): string {
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
