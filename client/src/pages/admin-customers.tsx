// client/src/pages/admin-customers.tsx
//
// Admin CRM — the operational view. Three tabs:
//   • Customers — every registered user + lifetime aggregates; click one
//     for their full profile (cards + orders).
//   • Orders    — every order across customers, filterable by status.
//   • Leads     — marketing_leads (captured emails, not yet buyers).
//
// Read-only over existing data (see server/routes/admin-customers.ts).
// Spec: memory/next_admin_crm.md.

import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Search, ArrowLeft, ExternalLink, Users, Package, UserPlus, BarChart3, AlertTriangle } from 'lucide-react';
import { genCostUsdX100ToGbp } from '@shared/pricing';

interface GenSide { ok: number; fail: number }
interface CardGen { front: GenSide; inside: GenSide }

// ── Types (mirror the server payloads) ───────────────────────────────
interface CustomerRow {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  createdAt: string | null;
  marketingOptIn: boolean;
  isAdmin: boolean;
  cardCount: number;
  paidOrders: number;
  totalSpent: number;
  lastActivity: string | null;
}
interface OrderRow {
  id: string;
  cardId: number | null;
  userId: string | null;
  customerName: string;
  customerEmail: string;
  shipTo: string | null;
  shippingTier: string | null;
  shippingAddress: any;
  totalAmount: number;
  printAmount: number;
  shippingAmount: number;
  envelopeStickerAmount: number;
  currency: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  providerOrderId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  createdAt: string | null;
  paidAt: string | null;
}
interface CardRow {
  id: number;
  sceneType: string | null;
  cardType: string | null;
  status: string | null;
  frontImageUrl: string | null;
  insideImageUrl: string | null;
  price: number;
  viewToken: string | null;
  createdAt: string | null;
  gen: CardGen;
}
interface LeadRow {
  id: number;
  email: string;
  source: string;
  cardId: number | null;
  recipientName: string | null;
  occasionDate: string | null;
  marketingOptIn: boolean;
  createdAt: string | null;
}

// ── Helpers ──────────────────────────────────────────────────────────
function gbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}
function fullName(c: { firstName: string | null; lastName: string | null; email: string | null }): string {
  const n = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
  return n || c.email || '—';
}
function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PAY_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
  failed: 'bg-red-100 text-red-800',
  refunded: 'bg-stone-200 text-stone-700',
};
const FULFIL_COLORS: Record<string, string> = {
  delivered: 'bg-green-100 text-green-800',
  shipped: 'bg-blue-100 text-blue-800',
  printed: 'bg-violet-100 text-violet-800',
  submitted: 'bg-amber-100 text-amber-800',
  pending: 'bg-stone-100 text-stone-600',
  failed: 'bg-red-100 text-red-800',
};
function Pill({ label, color }: { label: string; color?: string }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${color ?? 'bg-stone-100 text-stone-600'}`}>
      {label}
    </span>
  );
}

// ── Page ─────────────────────────────────────────────────────────────
type Tab = 'customers' | 'orders' | 'leads';

export default function AdminCustomersPage() {
  const [tab, setTab] = useState<Tab>('customers');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-stone-900">Customers</h1>
        <p className="text-sm text-stone-500">Who's bought what, and where their orders are.</p>
      </div>

      {selectedCustomer ? (
        <CustomerDetail id={selectedCustomer} onBack={() => setSelectedCustomer(null)} />
      ) : (
        <>
          <OverviewHeader />
          <div className="mb-4 flex gap-1 border-b border-stone-200">
            <TabButton icon={Users} label="Customers" active={tab === 'customers'} onClick={() => setTab('customers')} />
            <TabButton icon={Package} label="Orders" active={tab === 'orders'} onClick={() => setTab('orders')} />
            <TabButton icon={UserPlus} label="Leads" active={tab === 'leads'} onClick={() => setTab('leads')} />
          </div>
          {tab === 'customers' && <CustomersTab onSelect={setSelectedCustomer} />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'leads' && <LeadsTab />}
        </>
      )}
    </div>
  );
}

function TabButton({ icon: Icon, label, active, onClick }: { icon: typeof Users; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
        active ? 'border-violet-600 text-violet-700 font-medium' : 'border-transparent text-stone-500 hover:text-stone-800'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16 text-stone-400">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );
}

// ── Overview header (health + needs-attention) ───────────────────────
interface AttentionOrder extends OrderRow { attentionReason: string }
function OverviewHeader() {
  const { data } = useQuery<{ totals: any; needsAttention: AttentionOrder[] }>({
    queryKey: ['/api/admin/overview'],
    refetchInterval: 60_000,
  });
  if (!data) return null;
  const t = data.totals;
  const attn = data.needsAttention ?? [];
  return (
    <div className="mb-5 space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MiniStat label="Customers" value={String(t.totalCustomers)} />
        <MiniStat label="Paid orders" value={String(t.paidOrders)} />
        <MiniStat label="Revenue (all-time)" value={gbp(t.revenueAllTime)} />
        <MiniStat label="This month" value={gbp(t.revenueMonth)} />
        <MiniStat label="Avg order" value={gbp(t.avgOrderValue)} />
      </div>

      {attn.length > 0 ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle className="w-4 h-4" /> Needs attention ({attn.length})
          </div>
          <div className="space-y-2">
            {attn.map((o) => (
              <OrderCard key={o.id} o={o} showCustomer reason={o.attentionReason} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          ✓ No orders need attention — everything's paid and moving.
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3">
      <div className="text-lg font-bold text-stone-900">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-stone-400">{label}</div>
    </div>
  );
}

// ── Customers tab ────────────────────────────────────────────────────
function CustomersTab({ onSelect }: { onSelect: (id: string) => void }) {
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery<{ customers: CustomerRow[] }>({
    queryKey: [`/api/admin/customers?q=${encodeURIComponent(q)}`],
  });

  return (
    <div>
      <div className="relative mb-3 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or email…"
          className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm focus:border-violet-400 focus:outline-none"
        />
      </div>

      {isLoading ? (
        <Spinner />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-400">
                <th className="px-3 py-2 font-medium">Customer</th>
                <th className="px-3 py-2 font-medium">Cards</th>
                <th className="px-3 py-2 font-medium">Orders</th>
                <th className="px-3 py-2 font-medium">Spent</th>
                <th className="px-3 py-2 font-medium">Last active</th>
              </tr>
            </thead>
            <tbody>
              {(data?.customers ?? []).map((c) => (
                <tr
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className="cursor-pointer border-b border-stone-100 last:border-0 hover:bg-stone-50"
                >
                  <td className="px-3 py-2">
                    <div className="font-medium text-stone-800">
                      {fullName(c)} {c.isAdmin && <Pill label="admin" color="bg-violet-100 text-violet-700" />}
                    </div>
                    <div className="text-xs text-stone-400">{c.email}</div>
                  </td>
                  <td className="px-3 py-2 text-stone-600">{c.cardCount}</td>
                  <td className="px-3 py-2 text-stone-600">{c.paidOrders}</td>
                  <td className="px-3 py-2 font-medium text-stone-800">{gbp(c.totalSpent)}</td>
                  <td className="px-3 py-2 text-stone-500">{fmtDate(c.lastActivity)}</td>
                </tr>
              ))}
              {(data?.customers ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-stone-400">
                    No customers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Customer detail ──────────────────────────────────────────────────
function CustomerDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data, isLoading } = useQuery<{ customer: any; cards: CardRow[]; orders: OrderRow[] }>({
    queryKey: [`/api/admin/customers/${id}`],
  });

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-stone-800">
        <ArrowLeft className="w-4 h-4" /> All customers
      </button>

      {isLoading || !data ? (
        <Spinner />
      ) : (
        <div className="space-y-6">
          {/* Profile summary */}
          <div className="rounded-lg border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-stone-900">{fullName(data.customer)}</h2>
                <p className="text-sm text-stone-500">{data.customer.email}</p>
              </div>
              <div className="flex gap-6 text-sm">
                <Stat label="Cards" value={String(data.customer.cardCount)} />
                <Stat label="Paid orders" value={String(data.customer.paidOrders)} />
                <Stat label="Lifetime spend" value={gbp(data.customer.totalSpent)} />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
              <span>Joined {fmtDate(data.customer.createdAt)}</span>
              <span>·</span>
              <span>Marketing opt-in: {data.customer.marketingOptIn ? 'Yes' : 'No'}</span>
              <span>·</span>
              <span>
                Generations: <span className="font-medium text-stone-700">{data.customer.gen.total}</span>
                {' '}(<span className="text-green-700">{data.customer.gen.ok} ✓</span>
                {data.customer.gen.failed > 0 && <span className="text-red-600"> · {data.customer.gen.failed} ✗</span>})
                {' '}· cost ~£{genCostUsdX100ToGbp(data.customer.gen.costCentsX100).toFixed(2)}
              </span>
              <Link
                href="/admin/costs"
                className="inline-flex items-center gap-1 text-violet-600 hover:underline"
              >
                <BarChart3 className="w-3 h-3" /> Cost Ledger
              </Link>
            </div>
          </div>

          {/* Orders */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-stone-700">Orders ({data.orders.length})</h3>
            {data.orders.length === 0 ? (
              <p className="text-sm text-stone-400">No orders yet.</p>
            ) : (
              <div className="space-y-2">
                {data.orders.map((o) => (
                  <OrderCard key={o.id} o={o} />
                ))}
              </div>
            )}
          </section>

          {/* Cards */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-stone-700">Cards ({data.cards.length})</h3>
            {data.cards.length === 0 ? (
              <p className="text-sm text-stone-400">No cards yet.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.cards.map((c) => (
                  <div key={c.id} className="rounded-lg border border-stone-200 bg-white p-2">
                    <div className="flex gap-1.5">
                      <CardSideThumb label="Front" url={c.frontImageUrl} />
                      <CardSideThumb label="Inside" url={c.insideImageUrl} />
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-stone-700">
                        #{c.id} · {c.sceneType ?? '—'}
                      </span>
                      <Pill label={c.status ?? '—'} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-stone-500">
                      <GenLine label="Front" side={c.gen.front} />
                      <GenLine label="Inside" side={c.gen.inside} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <div className="font-bold text-stone-900">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-stone-400">{label}</div>
    </div>
  );
}

function CardSideThumb({ label, url }: { label: string; url: string | null }) {
  return (
    <div className="relative aspect-square flex-1 overflow-hidden rounded bg-stone-100">
      {url ? (
        <img src={url} alt={label} crossOrigin="anonymous" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-stone-400">
          no {label.toLowerCase()}
        </div>
      )}
      <span className="absolute left-1 top-1 rounded bg-black/40 px-1 text-[9px] font-medium uppercase text-white">
        {label}
      </span>
    </div>
  );
}

// One side's generation tally: how many succeeded / failed. "—" when the
// side was never attempted.
function GenLine({ label, side }: { label: string; side: GenSide }) {
  const total = side.ok + side.fail;
  return (
    <span>
      {label}:{' '}
      {total === 0 ? (
        <span className="text-stone-400">—</span>
      ) : (
        <>
          <span className="text-green-700">{side.ok}✓</span>
          {side.fail > 0 && <span className="text-red-600"> {side.fail}✗</span>}
        </>
      )}
    </span>
  );
}

// ── Order card (shared by detail + orders tab) ───────────────────────
function OrderCard({ o, showCustomer, reason }: { o: OrderRow; showCustomer?: boolean; reason?: string }) {
  const addr = o.shippingAddress;
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {showCustomer && <span className="font-medium text-stone-800">{o.customerName}</span>}
          <Pill label={o.paymentStatus} color={PAY_COLORS[o.paymentStatus]} />
          <Pill label={o.fulfillmentStatus} color={FULFIL_COLORS[o.fulfillmentStatus]} />
          {o.envelopeStickerAmount > 0 && <Pill label="seal" color="bg-amber-50 text-amber-700" />}
          {reason && <Pill label={reason} color="bg-red-100 text-red-800" />}
        </div>
        <div className="font-semibold text-stone-900">{gbp(o.totalAmount)}</div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
        <span>Card #{o.cardId}</span>
        <span>{o.shipTo === 'sender' ? 'To sender' : 'To recipient'} · {o.shippingTier}</span>
        <span>{gbp(o.printAmount)} card + {gbp(o.shippingAmount)} ship{o.envelopeStickerAmount > 0 ? ` + ${gbp(o.envelopeStickerAmount)} seal` : ''}</span>
        <span>{fmtDate(o.paidAt ?? o.createdAt)}</span>
      </div>
      {addr && (
        <div className="mt-1 text-xs text-stone-400">
          {[addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean).join(', ')}
        </div>
      )}
      <div className="mt-1.5 flex flex-wrap gap-3 text-xs">
        {o.providerOrderId && <span className="text-stone-400">Prodigi: {o.providerOrderId}</span>}
        {o.trackingUrl ? (
          <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-violet-600 hover:underline">
            Track <ExternalLink className="w-3 h-3" />
          </a>
        ) : o.trackingNumber ? (
          <span className="text-stone-400">Tracking: {o.trackingNumber}</span>
        ) : null}
      </div>
    </div>
  );
}

// ── Orders tab ───────────────────────────────────────────────────────
function OrdersTab() {
  const [payment, setPayment] = useState('');
  const [fulfillment, setFulfillment] = useState('');
  const qs = new URLSearchParams();
  if (payment) qs.set('payment', payment);
  if (fulfillment) qs.set('fulfillment', fulfillment);
  const { data, isLoading } = useQuery<{ orders: OrderRow[] }>({
    queryKey: [`/api/admin/orders?${qs.toString()}`],
  });

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <select value={payment} onChange={(e) => setPayment(e.target.value)} className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm">
          <option value="">All payments</option>
          <option value="paid">Paid</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
        <select value={fulfillment} onChange={(e) => setFulfillment(e.target.value)} className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm">
          <option value="">All fulfilment</option>
          <option value="pending">Pending</option>
          <option value="submitted">Submitted</option>
          <option value="printed">Printed</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
        </select>
      </div>
      {isLoading ? (
        <Spinner />
      ) : (data?.orders ?? []).length === 0 ? (
        <p className="py-8 text-center text-sm text-stone-400">No orders match.</p>
      ) : (
        <div className="space-y-2">
          {data!.orders.map((o) => (
            <OrderCard key={o.id} o={o} showCustomer />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Leads tab ────────────────────────────────────────────────────────
function LeadsTab() {
  const { data, isLoading } = useQuery<{ leads: LeadRow[] }>({ queryKey: ['/api/admin/leads'] });
  if (isLoading) return <Spinner />;
  const leads = data?.leads ?? [];
  return (
    <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-400">
            <th className="px-3 py-2 font-medium">Email</th>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">For</th>
            <th className="px-3 py-2 font-medium">Occasion date</th>
            <th className="px-3 py-2 font-medium">Opt-in</th>
            <th className="px-3 py-2 font-medium">Captured</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((l) => (
            <tr key={l.id} className="border-b border-stone-100 last:border-0">
              <td className="px-3 py-2 text-stone-800">{l.email}</td>
              <td className="px-3 py-2 text-stone-500">{l.source}</td>
              <td className="px-3 py-2 text-stone-500">{l.recipientName ?? '—'}</td>
              <td className="px-3 py-2 text-stone-500">{l.occasionDate ?? '—'}</td>
              <td className="px-3 py-2">{l.marketingOptIn ? <Pill label="yes" color="bg-green-100 text-green-800" /> : '—'}</td>
              <td className="px-3 py-2 text-stone-500">{fmtDate(l.createdAt)}</td>
            </tr>
          ))}
          {leads.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-stone-400">No leads yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
