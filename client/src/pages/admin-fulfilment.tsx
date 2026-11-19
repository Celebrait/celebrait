// client/src/pages/admin-fulfilment.tsx
//
// /admin/fulfilment: the print queue when a human prints and couriers
// (STUDIO_PRINT_PROVIDER=manual, the SA launch). Every paid print order
// still to do, soonest need-by first: the print-ready file per card, the
// envelope address with a copy button, and two actions. "Printed" is a
// note to self; "Shipped" asks for courier + tracking and sends the
// customer the existing "in the post" email (server: applyFulfillmentUpdate).
// The print-job email links here with #order-<id>.

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Copy, Check, Download, Printer, Truck, AlertTriangle, ExternalLink } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface QueueCard {
  cardId: number;
  copies: number;
  frontImageUrl: string | null;
  printFileUrl: string | null;
}
interface QueueOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  recipientName: string;
  shipTo: 'sender' | 'recipient' | null;
  addressLines: string[];
  needByDate: string | null;
  needByLabel: string | null;
  giftMessage: string | null;
  envelopeSticker: boolean;
  shippingTier: string;
  fulfillmentStatus: string;
  printProvider: string | null;
  providerOrderId: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  paidAt: string | null;
  updatedAt: string | null;
  cards: QueueCard[];
}
interface QueueResponse {
  provider: string;
  queue: QueueOrder[];
  recentlyShipped: QueueOrder[];
}

const QUERY_KEY = ['/api/admin/fulfilment'];

const FULFIL_COLORS: Record<string, string> = {
  delivered: 'bg-green-100 text-green-800',
  shipped: 'bg-blue-100 text-blue-800',
  printed: 'bg-violet-100 text-violet-800',
  submitted: 'bg-amber-100 text-amber-800',
  pending: 'bg-stone-100 text-stone-600',
  failed: 'bg-red-100 text-red-800',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'not prepared',
  submitted: 'to print',
  printed: 'printed, to post',
  shipped: 'shipped',
  delivered: 'delivered',
  failed: 'failed',
};

function Pill({ label, color }: { label: string; color?: string }) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${color ?? 'bg-stone-100 text-stone-600'}`}>
      {label}
    </span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Days from today to a YYYY-MM-DD need-by date (negative = past). */
function daysUntil(ymd: string | null): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const today = new Date();
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const [y, m, d] = ymd.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - t) / 86_400_000);
}

export default function AdminFulfilmentPage() {
  const { data, isLoading, error } = useQuery<QueueResponse>({ queryKey: QUERY_KEY, refetchInterval: 60_000 });

  // The print-job email deep-links to #order-<id>: bring it into view.
  useEffect(() => {
    if (!data || typeof window === 'undefined' || !window.location.hash) return;
    const el = document.getElementById(window.location.hash.slice(1));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [data]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-stone-900">Fulfilment</h1>
        <p className="text-sm text-stone-500">
          Paid cards waiting to be printed and posted. Soonest need-by date first.
        </p>
      </div>

      {data && data.provider !== 'manual' && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Printing is set to <strong>{data.provider}</strong>, not manual. New orders won't send you a print job
            until STUDIO_PRINT_PROVIDER=manual.
          </span>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-stone-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : error ? (
        <p className="py-8 text-center text-sm text-red-600">Couldn't load the print queue.</p>
      ) : (
        <>
          <h2 className="mb-2 text-sm font-semibold text-stone-700">To do ({data!.queue.length})</h2>
          {data!.queue.length === 0 ? (
            <p className="rounded-lg border border-stone-200 bg-white py-8 text-center text-sm text-stone-400">
              Nothing to print. Every paid card is in the post.
            </p>
          ) : (
            <div className="space-y-3">
              {data!.queue.map((o) => (
                <QueueItem key={o.id} o={o} />
              ))}
            </div>
          )}

          {data!.recentlyShipped.length > 0 && (
            <>
              <h2 className="mb-2 mt-8 text-sm font-semibold text-stone-700">Shipped in the last 14 days</h2>
              <div className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white text-sm">
                {data!.recentlyShipped.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                    <span className="font-medium text-stone-800">{o.recipientName}</span>
                    <Pill label={o.fulfillmentStatus} color={FULFIL_COLORS[o.fulfillmentStatus]} />
                    <span className="text-xs text-stone-500">{o.addressLines.slice(1, -1).join(', ')}</span>
                    {o.trackingUrl ? (
                      <a href={o.trackingUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
                        {o.trackingNumber ?? 'Track'} <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-stone-400">{o.trackingNumber}</span>
                    )}
                    <span className="ml-auto text-xs text-stone-400">{fmtDate(o.updatedAt)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function QueueItem({ o }: { o: QueueOrder }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState<null | 'printed' | 'shipped' | 'prepare'>(null);
  const [shipOpen, setShipOpen] = useState(false);
  const [courier, setCourier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const days = daysUntil(o.needByDate);
  const urgent = days != null && days <= 3;
  const highlighted = typeof window !== 'undefined' && window.location.hash === `#order-${o.id}`;
  const canPrepare = !o.providerOrderId && (o.fulfillmentStatus === 'pending' || o.fulfillmentStatus === 'failed');

  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const mark = async (body: Record<string, string>) => {
    setBusy(body.status as 'printed' | 'shipped');
    try {
      await apiRequest('POST', `/api/admin/orders/${o.id}/fulfilment`, body);
      toast({
        title: body.status === 'shipped' ? `Shipped. ${o.customerName.split(' ')[0]} has been emailed.` : 'Marked printed.',
      });
      setShipOpen(false);
      await refresh();
    } catch (err: any) {
      toast({ title: "Couldn't update the order", description: err?.message ?? 'Try again.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const prepare = async () => {
    setBusy('prepare');
    try {
      await apiRequest('POST', `/api/admin/orders/${o.id}/resubmit-print`);
      toast({ title: 'Print files prepared.' });
      await refresh();
    } catch (err: any) {
      toast({ title: "Couldn't prepare the print files", description: err?.message ?? 'Try again.', variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(o.addressLines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Couldn't copy. Select the address and copy it by hand." });
    }
  };

  return (
    <div
      id={`order-${o.id}`}
      className={`scroll-mt-4 rounded-lg border bg-white p-4 text-sm ${highlighted ? 'border-violet-400 ring-1 ring-violet-200' : 'border-stone-200'}`}
    >
      {/* Who, status, when */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-stone-900">{o.recipientName}</span>
            <Pill label={STATUS_LABEL[o.fulfillmentStatus] ?? o.fulfillmentStatus} color={FULFIL_COLORS[o.fulfillmentStatus]} />
            {o.envelopeSticker && <Pill label="seal sticker" color="bg-amber-50 text-amber-700" />}
            <Pill label={o.shipTo === 'sender' ? 'post to buyer' : 'post to recipient'} />
          </div>
          <div className="mt-0.5 text-xs text-stone-500">
            Order <span className="font-mono">{o.id.slice(0, 8)}</span> · paid {fmtDate(o.paidAt)} · {o.customerName} &lt;{o.customerEmail}&gt;
          </div>
        </div>
        <div
          className={`rounded-md border px-2.5 py-1 text-right text-xs ${
            urgent ? 'border-violet-300 bg-violet-50 text-violet-800' : 'border-stone-200 bg-stone-50 text-stone-600'
          }`}
        >
          <div className="font-medium">{o.needByLabel ? `Needed by ${o.needByLabel}` : 'No need-by date'}</div>
          {days != null && (
            <div>{days < 0 ? `${-days} day${days === -1 ? '' : 's'} late` : days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}</div>
          )}
        </div>
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-[1fr_260px]">
        {/* Cards + print files */}
        <div className="space-y-2">
          {o.cards.map((c, i) => (
            <div key={c.cardId} className="flex items-center gap-3">
              {c.frontImageUrl ? (
                <img src={c.frontImageUrl} crossOrigin="anonymous" alt={`Card ${c.cardId}`} className="h-16 w-16 rounded border border-stone-200 object-cover" />
              ) : (
                <div className="h-16 w-16 rounded border border-stone-200 bg-stone-50" />
              )}
              <div>
                <div className="text-stone-800">
                  {i + 1}. Card #{c.cardId} <span className="text-stone-400">× {c.copies}</span>
                </div>
                {c.printFileUrl ? (
                  <a href={c.printFileUrl} target="_blank" rel="noreferrer" download className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
                    <Download className="h-3 w-3" /> Print-ready file
                  </a>
                ) : (
                  <span className="text-xs text-stone-400">No print file yet</span>
                )}
              </div>
            </div>
          ))}
          {canPrepare && (
            <button
              onClick={prepare}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              {busy === 'prepare' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
              {o.fulfillmentStatus === 'failed' ? 'Try preparing the print files again' : 'Prepare print files'}
            </button>
          )}
          {o.giftMessage && (
            <div className="text-xs text-stone-600">
              <span className="font-medium">Gift note:</span> {o.giftMessage}
            </div>
          )}
        </div>

        {/* Address */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-stone-600">Ship to</span>
            <button onClick={copyAddress} className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="whitespace-pre-line rounded-md border border-stone-200 bg-stone-50 px-3 py-2 font-mono text-xs leading-relaxed text-stone-800">
            {o.addressLines.join('\n') || 'No address on this order'}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 border-t border-stone-100 pt-3">
        {!shipOpen ? (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => mark({ status: 'printed' })}
              disabled={busy !== null || o.fulfillmentStatus === 'printed'}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50 disabled:opacity-40"
            >
              {busy === 'printed' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              {o.fulfillmentStatus === 'printed' ? 'Printed' : 'Mark printed'}
            </button>
            <button
              onClick={() => setShipOpen(true)}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
            >
              <Truck className="h-4 w-4" /> Mark shipped
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const body: Record<string, string> = { status: 'shipped', courier, trackingNumber };
              if (trackingUrl.trim()) body.trackingUrl = trackingUrl.trim();
              void mark(body);
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <label className="flex flex-col text-xs text-stone-600">
              Courier
              <input
                required
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                placeholder="e.g. The Courier Guy"
                className="mt-0.5 w-48 rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
              />
            </label>
            <label className="flex flex-col text-xs text-stone-600">
              Tracking number
              <input
                required
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="mt-0.5 w-44 rounded-lg border border-stone-200 px-2 py-1.5 font-mono text-sm focus:border-violet-400 focus:outline-none"
              />
            </label>
            <label className="flex flex-col text-xs text-stone-600">
              Tracking link (optional)
              <input
                type="url"
                value={trackingUrl}
                onChange={(e) => setTrackingUrl(e.target.value)}
                placeholder="https://"
                className="mt-0.5 w-64 rounded-lg border border-stone-200 px-2 py-1.5 text-sm focus:border-violet-400 focus:outline-none"
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-40"
            >
              {busy === 'shipped' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
              Shipped: email the customer
            </button>
            <button type="button" onClick={() => setShipOpen(false)} className="px-2 py-1.5 text-sm text-stone-500 hover:text-stone-800">
              Cancel
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
