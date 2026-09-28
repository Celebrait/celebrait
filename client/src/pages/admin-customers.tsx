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
import { Loader2, Search, ArrowLeft, ExternalLink, Users, Package, UserPlus, BarChart3, AlertTriangle, Download, UserX } from 'lucide-react';
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
  amountPaid: number | null;
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
interface StudioPhoto {
  id: number;
  missing?: boolean;
  originalFilename?: string;
  thumbnailPath?: string;
  storagePath?: string;
  croppedStoragePath?: string | null;
  width?: number;
  height?: number;
  cropBounds?: { x: number; y: number; width: number; height: number } | null;
  /** % of the ORIGINAL frame kept by the crop. Small = tight = good for
   *  likeness. Large = the face is tiny once the provider downscales. */
  cropAreaPct?: number | null;
  personCount?: number | null;
  visualSummary?: string | null;
}
/** What the customer actually did in the studio. Read straight off the
 *  draft we already store — this is the trail for "why doesn't this card
 *  look like them?". */
interface StudioTrail {
  photoMode: string | null;
  sceneDescription: string | null;
  sceneSource:
    | 'manual'
    | 'suggestion'
    | 'suggestion_edited'
    | 'brainstorm'
    | 'brainstorm_edited'
    | null;
  occasion: string | null;
  recipientName: string | null;
  insideMode: string | null;
  frontMode: string | null;
  frontText: string | null;
  insideWrite: {
    salutation: string | null;
    message: string | null;
    signoff: string | null;
  } | null;
  lastStep: number | null;
  templates: Array<{ slot: string; templateId: number; templateVersion: number | null; model: string }>;
  photos: StudioPhoto[];
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
  studio: StudioTrail;
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

// Build a CSV from headers + rows and trigger a download. Quotes any cell
// containing a comma/quote/newline. Amounts are exported as plain £ decimals.
function downloadCsv(filename: string, headers: string[], rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function pounds(pence: number): string {
  return (pence / 100).toFixed(2);
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
type Tab = 'customers' | 'orders' | 'leads' | 'dropoffs';

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
            <TabButton icon={UserX} label="Drop-offs" active={tab === 'dropoffs'} onClick={() => setTab('dropoffs')} />
          </div>
          {tab === 'customers' && <CustomersTab onSelect={setSelectedCustomer} />}
          {tab === 'orders' && <OrdersTab />}
          {tab === 'leads' && <LeadsTab />}
          {tab === 'dropoffs' && <DropoffsTab />}
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

function ExportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 hover:bg-stone-50 disabled:opacity-40"
    >
      <Download className="w-4 h-4" /> Export CSV
    </button>
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

  const customers = data?.customers ?? [];
  const exportCsv = () =>
    downloadCsv(
      'celebrait-customers.csv',
      ['Name', 'Email', 'Cards', 'Paid orders', 'Total spent (£)', 'Joined', 'Last active', 'Marketing opt-in'],
      customers.map((c) => [
        fullName(c),
        c.email ?? '',
        c.cardCount,
        c.paidOrders,
        pounds(c.totalSpent),
        fmtDate(c.createdAt),
        fmtDate(c.lastActivity),
        c.marketingOptIn ? 'yes' : 'no',
      ]),
    );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email…"
            className="w-full rounded-lg border border-stone-200 py-2 pl-9 pr-3 text-sm focus:border-violet-400 focus:outline-none"
          />
        </div>
        <ExportButton onClick={exportCsv} disabled={customers.length === 0} />
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
  const { data, isLoading } = useQuery<{
    customer: any;
    cards: CardRow[];
    orders: OrderRow[];
    moments: Array<{
      id: number;
      occasion: string;
      date: string | null;
      personName: string;
      relationship: string | null;
    }>;
    freeCard: { keyDates: number; redeemed: boolean; eligible: boolean };
  }>({
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

          {/* Dates + free card — the retention engine's raw material.
              Shows the same numbers the checkout eligibility gate uses,
              so this screen can never disagree with what the customer
              is offered. */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-stone-700">
              Dates &amp; free card
              {data.freeCard && (
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    data.freeCard.redeemed
                      ? 'bg-stone-100 text-stone-500'
                      : data.freeCard.eligible
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {data.freeCard.redeemed
                    ? 'Free card used'
                    : data.freeCard.eligible
                      ? 'Free card ready to claim'
                      : `${data.freeCard.keyDates}/3 dates — not yet unlocked`}
                </span>
              )}
            </h3>
            {(data.moments ?? []).length === 0 ? (
              <p className="text-sm text-stone-400">No dates added yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 text-stone-500">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Person</th>
                      <th className="px-3 py-1.5 font-medium">Occasion</th>
                      <th className="px-3 py-1.5 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {data.moments.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-1.5 text-stone-800">
                          {m.personName}
                          {m.relationship && (
                            <span className="text-stone-400"> · {m.relationship}</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 capitalize text-stone-600">
                          {m.occasion.replace(/_/g, ' ')}
                        </td>
                        <td className="px-3 py-1.5 text-stone-600">
                          {m.date ? fmtDate(m.date) : (
                            <span className="text-amber-600">no date yet</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

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
                      <a
                        href={`/studio/card/${c.id}`}
                        className="truncate text-xs font-medium text-violet-600 hover:underline"
                      >
                        #{c.id} · {c.sceneType ?? '—'}
                      </a>
                      <Pill label={c.status ?? '—'} />
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-stone-500">
                      <GenLine label="Front" side={c.gen.front} />
                      <GenLine label="Inside" side={c.gen.inside} />
                      {/* Digital link — present whenever a token has been
                          minted (free share or paid order). Opens the
                          exact link the recipient gets, so support
                          questions ("she says the link is broken") can be
                          checked first-hand. Absent = never shared. */}
                      {c.viewToken && (
                        <a
                          href={`/c/${encodeURIComponent(c.viewToken)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-violet-600 hover:underline"
                          data-testid={`admin-digital-link-${c.id}`}
                        >
                          <ExternalLink className="h-3 w-3" />
                          Digital link
                        </a>
                      )}
                    </div>
                    <StudioTrailPanel trail={c.studio} />
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

/** "What they did" — the studio inputs behind one card.
 *
 *  Exists because a card that doesn't look like its subject is almost
 *  always an INPUT problem, and until now none of the inputs reached
 *  this screen. Collapsed by default so the card grid stays scannable.
 *
 *  The crop overlay is the point of the whole panel: seeing how much of
 *  the frame the customer kept tells you in one glance whether the face
 *  had enough pixels to survive the provider's 1024px downscale. */
function StudioTrailPanel({ trail }: { trail: StudioTrail | undefined }) {
  if (!trail) return null;
  const modeLabel =
    trail.photoMode === 'one_person'
      ? 'Just them (single)'
      : trail.photoMode === 'group'
        ? 'Group'
        : trail.photoMode ?? '—';

  return (
    <details className="mt-2 border-t border-stone-100 pt-1.5">
      <summary className="cursor-pointer list-none text-[11px] font-medium text-stone-500 hover:text-stone-700">
        What they did ▸
      </summary>

      <dl className="mt-2 space-y-1 text-[11px]">
        <Row label="Photo mode" value={modeLabel} emphasis />
        <Row label="Occasion" value={trail.occasion ?? '—'} />
        <Row label="Recipient" value={trail.recipientName ?? '—'} />
        <Row label="Inside" value={trail.insideMode ?? '—'} />
      </dl>

      {trail.sceneDescription && (
        <div className="mt-2">
          <div className="flex items-center gap-2">
            <div className="text-[10px] uppercase tracking-wide text-stone-400">Scene they asked for</div>
            {trail.sceneSource && <SceneSourceChip source={trail.sceneSource} />}
          </div>
          <p className="mt-0.5 rounded bg-stone-50 p-1.5 text-[11px] italic leading-snug text-stone-700">
            “{trail.sceneDescription}”
          </p>
        </div>
      )}

      {trail.frontText && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wide text-stone-400">Front text they typed</div>
          <p className="mt-0.5 rounded bg-stone-50 p-1.5 text-[11px] italic leading-snug text-stone-700">
            “{trail.frontText}”
          </p>
        </div>
      )}

      {trail.insideWrite &&
        (trail.insideWrite.salutation || trail.insideWrite.message || trail.insideWrite.signoff) && (
          <div className="mt-2">
            <div className="text-[10px] uppercase tracking-wide text-stone-400">Inside message they typed</div>
            {/* Three fields shown as one piece, the way the card renders
                them — but salutation/signoff keep a faint tint so a
                missing sign-off is visible as such rather than reading
                as a short message. */}
            <div className="mt-0.5 space-y-0.5 rounded bg-stone-50 p-1.5 text-[11px] leading-snug text-stone-700">
              {trail.insideWrite.salutation && (
                <p className="text-stone-500">{trail.insideWrite.salutation}</p>
              )}
              {trail.insideWrite.message && (
                <p className="whitespace-pre-wrap italic">“{trail.insideWrite.message}”</p>
              )}
              {trail.insideWrite.signoff && (
                <p className="text-stone-500">{trail.insideWrite.signoff}</p>
              )}
            </div>
          </div>
        )}

      {trail.photos.length > 0 && (
        <div className="mt-2 space-y-2">
          <div className="text-[10px] uppercase tracking-wide text-stone-400">
            Photo{trail.photos.length > 1 ? 's' : ''} they used
          </div>
          {trail.photos.map((p) => (
            <PhotoTrail key={p.id} photo={p} />
          ))}
        </div>
      )}

      {trail.templates.length > 0 && (
        <div className="mt-2">
          <div className="text-[10px] uppercase tracking-wide text-stone-400">Prompt version that ran</div>
          <ul className="mt-0.5 space-y-0.5">
            {trail.templates.map((t, i) => (
              <li key={i} className="text-[11px] text-stone-600">
                {t.slot} → <span className="font-medium">#{t.templateId} v{t.templateVersion ?? '?'}</span>
                <span className="text-stone-400"> · {t.model}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}

function PhotoTrail({ photo: p }: { photo: StudioPhoto }) {
  if (p.missing) {
    return <p className="text-[11px] text-stone-400">Photo #{p.id} — deleted</p>;
  }
  const cb = p.cropBounds;
  // cropBounds are in ORIGINAL pixel coordinates (server-authoritative,
  // see crop-dialog) — convert to % so the box lands correctly whatever
  // size the thumbnail renders at.
  const box =
    cb && p.width && p.height
      ? {
          left: `${(cb.x / p.width) * 100}%`,
          top: `${(cb.y / p.height) * 100}%`,
          width: `${(cb.width / p.width) * 100}%`,
          height: `${(cb.height / p.height) * 100}%`,
        }
      : null;
  // What actually predicts a weak likeness is the crop's PIXEL size, not
  // what fraction of the frame it kept. A 73% crop of a 3390px photo is
  // still ~2900px of face detail; the same 73% of a 720px screenshot is
  // ~270px, which the provider then upscales to 1024 and invents the
  // difference. Flagging on percentage marked almost everything (the
  // default centred crop is 80% wide, so ~64% area) — useless noise.
  const cropPx =
    cb && cb.width && cb.height ? { w: Math.round(cb.width), h: Math.round(cb.height) } : null;
  const lowDetail = cropPx ? Math.min(cropPx.w, cropPx.h) < 600 : false;

  return (
    <div className="flex gap-2">
      <div className="relative w-20 shrink-0 overflow-hidden rounded border border-stone-200 bg-stone-50">
        <img
          src={`/images/${p.storagePath}`}
          alt={`Photo ${p.id} as uploaded`}
          className="block w-full"
          loading="lazy"
        />
        {box && (
          <div
            className="pointer-events-none absolute border-2 border-violet-500/90 bg-violet-500/10"
            style={box}
          />
        )}
      </div>
      <div className="min-w-0 flex-1 text-[11px] leading-snug text-stone-600">
        <div>
          <span className="text-stone-400">#{p.id}</span>{' '}
          {p.width}×{p.height}
        </div>
        {cropPx && (
          <div className={lowDetail ? 'font-medium text-amber-700' : 'text-stone-500'}>
            Crop {cropPx.w}×{cropPx.h}
            {typeof p.cropAreaPct === 'number' && (
              <span className="text-stone-400"> ({p.cropAreaPct}% of frame)</span>
            )}
            {lowDetail && ' — low detail, upscaled'}
          </div>
        )}
        {p.personCount != null && (
          <div className="text-stone-500">
            Vision saw {p.personCount === 3 ? '3+' : p.personCount} person
            {p.personCount === 1 ? '' : 's'}
          </div>
        )}
        {p.visualSummary && (
          <p className="mt-0.5 italic text-stone-400">{p.visualSummary}</p>
        )}
      </div>
    </div>
  );
}

/** How the scene description came to be — the signal that says whether
 *  the suggester and brainstorm are actually earning their keep. */
function SceneSourceChip({ source }: { source: NonNullable<StudioTrail['sceneSource']> }) {
  const map: Record<string, { label: string; cls: string }> = {
    manual: { label: 'Typed it themselves', cls: 'bg-stone-100 text-stone-600' },
    suggestion: { label: 'Used a suggestion', cls: 'bg-indigo-100 text-indigo-700' },
    suggestion_edited: { label: 'Suggestion, then edited', cls: 'bg-indigo-50 text-indigo-600' },
    brainstorm: { label: 'Used brainstorm', cls: 'bg-violet-100 text-violet-700' },
    brainstorm_edited: { label: 'Brainstorm, then edited', cls: 'bg-violet-50 text-violet-600' },
  };
  const m = map[source] ?? { label: source, cls: 'bg-stone-100 text-stone-600' };
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold ${m.cls}`}>
      {m.label}
    </span>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-stone-400">{label}</dt>
      <dd className={`truncate text-right ${emphasis ? 'font-medium text-stone-800' : 'text-stone-600'}`}>
        {value}
      </dd>
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
          {o.amountPaid != null && o.amountPaid !== o.totalAmount && (
            <Pill label="discounted" color="bg-violet-100 text-violet-700" />
          )}
        </div>
        <div className="text-right">
          <div className="font-semibold text-stone-900">{gbp(o.amountPaid ?? o.totalAmount)}</div>
          {o.amountPaid != null && o.amountPaid !== o.totalAmount && (
            <div className="text-[11px] text-stone-400 line-through">{gbp(o.totalAmount)}</div>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500">
        {o.cardId != null ? (
          <a href={`/studio/card/${o.cardId}`} className="text-violet-600 hover:underline">
            Card #{o.cardId}
          </a>
        ) : (
          <span>Card #{o.cardId}</span>
        )}
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
  const [q, setQ] = useState('');
  const qs = new URLSearchParams();
  if (payment) qs.set('payment', payment);
  if (fulfillment) qs.set('fulfillment', fulfillment);
  if (q) qs.set('q', q);
  const { data, isLoading } = useQuery<{ orders: OrderRow[] }>({
    queryKey: [`/api/admin/orders?${qs.toString()}`],
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, name, order ref, Prodigi id, card #…"
            className="w-72 rounded-lg border border-stone-200 py-1.5 pl-8 pr-3 text-sm focus:border-violet-400 focus:outline-none"
          />
        </div>
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
        <ExportButton
          onClick={() =>
            downloadCsv(
              'celebrait-orders.csv',
              ['Order ref', 'Customer', 'Email', 'Card', 'Ship to', 'Tier', 'Charged (£)', 'List (£)', 'Payment', 'Fulfilment', 'Prodigi', 'Tracking', 'Created', 'Paid'],
              (data?.orders ?? []).map((o) => [
                o.id,
                o.customerName,
                o.customerEmail,
                o.cardId ?? '',
                o.shipTo ?? '',
                o.shippingTier ?? '',
                pounds(o.amountPaid ?? o.totalAmount),
                pounds(o.totalAmount),
                o.paymentStatus,
                o.fulfillmentStatus,
                o.providerOrderId ?? '',
                o.trackingNumber ?? '',
                fmtDate(o.createdAt),
                fmtDate(o.paidAt),
              ]),
            )
          }
          disabled={(data?.orders ?? []).length === 0}
        />
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

// ── Drop-offs tab ────────────────────────────────────────────────────
// Everyone who asked for a login code and never finished signing up.
// The user row is only written on verify, so "in otp_codes, not in
// users" is exactly that set.
//
// `sendFailures > 0` means the email never left the building — that's a
// deliverability failure, not someone changing their mind, and it's the
// column to watch while OTP delivery is still on Brevo.
interface DropoffRow {
  email: string;
  firstRequested: string;
  lastRequested: string;
  attempts: number;
  sendFailures: number;
}

function DropoffsTab() {
  const { data, isLoading } = useQuery<{
    summary: { requested: number; signedUp: number; stuck: number; stuck30d: number; conversionPct: number };
    dropoffs: DropoffRow[];
  }>({ queryKey: ['/api/admin/signup-dropoffs'] });

  if (isLoading) return <Spinner />;
  const s = data?.summary;
  const rows = data?.dropoffs ?? [];
  const undelivered = rows.filter((r) => r.sendFailures > 0).length;

  return (
    <div className="space-y-4">
      {s && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Asked for a code" value={String(s.requested)} />
          <MiniStat label="Got through" value={`${s.signedUp} (${s.conversionPct}%)`} />
          <MiniStat label="Never signed up" value={String(s.stuck)} />
          <MiniStat label="Stuck, last 30d" value={String(s.stuck30d)} />
        </div>
      )}

      {undelivered > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>{undelivered}</strong> of these never received an email — the send itself failed.
            That's deliverability, not drop-off.
          </span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-[11px] uppercase tracking-wide text-stone-400">
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Codes sent</th>
              <th className="px-3 py-2 font-medium">Undelivered</th>
              <th className="px-3 py-2 font-medium">First asked</th>
              <th className="px-3 py-2 font-medium">Last asked</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.email} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2 text-stone-800">{r.email}</td>
                <td className="px-3 py-2 text-stone-500">{r.attempts}</td>
                <td className="px-3 py-2">
                  {r.sendFailures > 0
                    ? <Pill label={String(r.sendFailures)} color="bg-amber-100 text-amber-800" />
                    : <span className="text-stone-400">—</span>}
                </td>
                <td className="px-3 py-2 text-stone-500">{fmtDate(r.firstRequested)}</td>
                <td className="px-3 py-2 text-stone-500">{fmtDate(r.lastRequested)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-stone-400">
                  Nobody's stuck — everyone who asked for a code signed up.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
