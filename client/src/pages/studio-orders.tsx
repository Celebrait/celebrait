// client/src/pages/studio-orders.tsx
//
// Orders & delivery — Week 1 is list-only. Each row shows recipient,
// what was ordered (print / digital / both), cost, status chip, and a
// share link for paid digital orders. No per-order detail page until
// Week 2 — most "where is Mum's card?" questions are answered by the
// status chip + tracking link right here.
//
// Status mapping lives in statusForDisplay() below. Any new values
// returned by studio_orders should be added there so they don't fall
// through as generic "Processing".

import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { getOccasionLabel } from '@/components/studio/scene-presets';
import {
  Wand2,
  Truck,
  ExternalLink,
  Image as ImageIcon,
  CheckCircle2,
  Package,
  Printer,
  Share2,
  XCircle,
} from 'lucide-react';
import type { StudioOrderListItem } from '@shared/schema';

export default function StudioOrders() {
  const { data, isLoading, error } = useQuery<StudioOrderListItem[]>({
    queryKey: ['/api/studio/orders'],
  });

  return (
    <>
      <PageHeader />

      {isLoading ? (
        <OrdersSkeleton />
      ) : error ? (
        <ErrorState message={error instanceof Error ? error.message : 'Please try again.'} />
      ) : (data?.length ?? 0) === 0 ? (
        <OrdersEmpty />
      ) : (
        <div className="space-y-3">
          {data!.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </div>
      )}
    </>
  );
}

function PageHeader() {
  return (
    <div className="mb-6 sm:mb-8">
      <h1 className="text-2xl sm:text-3xl font-semibold text-ink">
        Orders &amp; delivery
      </h1>
      <p className="text-sm text-stone-600 mt-1">
        Track what you've sent, and share the digital versions.
      </p>
    </div>
  );
}

function OrderRow({ order }: { order: StudioOrderListItem }) {
  const title = deriveTitle(order);
  const typeLabel = orderTypeLabel(order);
  const amount = formatAmount(order.totalAmount, order.currency);
  const when = order.paidAt || order.createdAt;

  return (
    <div
      className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
      data-testid={`order-row-${order.id}`}
    >
      {/* Thumb — links into the card detail/view. Non-essential visual;
          if it's missing, we swap in a neutral placeholder rather than
          an error state. */}
      <Link
        href={`/studio/card/${order.cardId}`}
        className="w-16 h-16 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-brand transition-all"
        aria-label={`View ${title}`}
      >
        {order.frontImageUrl ? (
          <img
            src={order.frontImageUrl}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-400">
            <ImageIcon className="w-6 h-6" />
          </div>
        )}
      </Link>

      {/* Body — title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink truncate">{title}</p>
        <p className="text-xs text-stone-500 mt-0.5">
          {typeLabel}
          {amount ? ` · ${amount}` : ''}
          {when ? ` · ${formatWhen(when)}` : ''}
        </p>
        <div className="mt-2">
          <StatusChip order={order} />
        </div>
      </div>

      {/* Actions — share link (digital only) + tracking link (print only).
          Both are optional per-row; a row with neither just shows the
          status chip and the card thumbnail link. */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
        {order.shareUrl && (
          <a
            href={order.shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-dark bg-brand-muted hover:bg-brand hover:text-white rounded-full px-3 py-1.5 transition-colors"
            data-testid={`order-share-${order.id}`}
          >
            <Share2 className="w-3.5 h-3.5" />
            Share link
          </a>
        )}
        {order.trackingUrl && (
          <a
            href={order.trackingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-full px-3 py-1.5 transition-colors"
            data-testid={`order-tracking-${order.id}`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Track
          </a>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Status chip. Priority rules:
//   1. Payment not paid    → "Awaiting payment" / "Payment failed"
//   2. Digital-only + paid → "Delivered" (digital is instant)
//   3. Print fulfillment   → maps fulfillmentStatus to warm label
// ─────────────────────────────────────────────────────────────────────

function StatusChip({ order }: { order: StudioOrderListItem }) {
  const view = statusForDisplay(order);
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 ${view.className}`}
    >
      <view.Icon className="w-3.5 h-3.5" />
      {view.label}
    </span>
  );
}

interface StatusView {
  label: string;
  className: string;
  Icon: typeof CheckCircle2;
}

function statusForDisplay(order: StudioOrderListItem): StatusView {
  // Payment issues take priority — nothing ships without confirmed payment.
  if (order.paymentStatus === 'failed') {
    return {
      label: 'Payment failed',
      className: 'bg-red-50 text-red-700',
      Icon: XCircle,
    };
  }
  if (order.paymentStatus === 'refunded') {
    return {
      label: 'Refunded',
      className: 'bg-stone-100 text-stone-600',
      Icon: XCircle,
    };
  }
  if (order.paymentStatus !== 'paid') {
    return {
      label: 'Awaiting payment',
      className: 'bg-amber-50 text-amber-800',
      Icon: Package,
    };
  }

  // Digital-only orders are "delivered" the moment payment confirms
  // (the share link is live). No fulfillment pipeline.
  if (!order.includesPrint && order.includesDigital) {
    return {
      label: 'Delivered (digital)',
      className: 'bg-green-50 text-green-700',
      Icon: CheckCircle2,
    };
  }

  // Print fulfillment. See studio-orders model for the full set.
  switch (order.fulfillmentStatus) {
    case 'delivered':
      return {
        label: 'Delivered',
        className: 'bg-green-50 text-green-700',
        Icon: CheckCircle2,
      };
    case 'shipped':
      return {
        label: 'In transit',
        className: 'bg-blue-50 text-blue-700',
        Icon: Truck,
      };
    case 'printed':
      return {
        label: 'Printed',
        className: 'bg-indigo-50 text-indigo-700',
        Icon: Printer,
      };
    case 'submitted':
      return {
        label: 'Printing',
        className: 'bg-indigo-50 text-indigo-700',
        Icon: Printer,
      };
    case 'failed':
      return {
        label: 'Fulfilment failed',
        className: 'bg-red-50 text-red-700',
        Icon: XCircle,
      };
    case 'pending':
    default:
      return {
        label: 'Processing',
        className: 'bg-stone-100 text-stone-700',
        Icon: Package,
      };
  }
}

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function deriveTitle(order: StudioOrderListItem): string {
  const name = order.recipientName;
  const occasion = order.occasion;
  // Use getOccasionLabel so 'thankyou' \u2192 'Thank you', 'valentines'
  // \u2192 "Valentine's Day" etc. — raw keys were leaking through.
  const occasionLabel = occasion ? getOccasionLabel(occasion) : '';
  if (name && occasionLabel) return `${name}'s ${occasionLabel.toLowerCase()} card`;
  if (name) return `Card for ${name}`;
  if (occasionLabel) return `${occasionLabel} card`;
  return 'Celebrait card';
}

function orderTypeLabel(order: StudioOrderListItem): string {
  if (order.includesPrint && order.includesDigital) return 'Print + digital';
  if (order.includesPrint) return 'Print';
  if (order.includesDigital) return 'Digital';
  return 'Card';
}

function formatAmount(minor: number, currency: string): string | null {
  if (typeof minor !== 'number' || Number.isNaN(minor)) return null;
  try {
    const fmt = new Intl.NumberFormat('en-GB', { style: 'currency', currency });
    return fmt.format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

function formatWhen(ts: Date | string): string {
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  const diffMs = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diffMs < day) return 'today';
  if (diffMs < 2 * day) return 'yesterday';
  if (diffMs < 7 * day) return `${Math.floor(diffMs / day)} days ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ─────────────────────────────────────────────────────────────────────
// Loading + error + empty states
// ─────────────────────────────────────────────────────────────────────

function OrdersSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="bg-white rounded-2xl border border-stone-200 p-5 flex gap-4 animate-pulse"
        >
          <div className="w-16 h-16 rounded-xl bg-stone-100" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-stone-100 rounded w-1/3" />
            <div className="h-3 bg-stone-100 rounded w-1/2" />
            <div className="h-6 bg-stone-100 rounded-full w-24 mt-2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function OrdersEmpty() {
  return (
    <div className="text-center py-16 px-4">
      <div className="w-14 h-14 rounded-full bg-brand-muted text-brand-dark flex items-center justify-center mx-auto mb-4">
        <Truck className="w-6 h-6" />
      </div>
      <p className="text-base font-semibold text-ink mb-1">No orders yet</p>
      <p className="text-sm text-stone-600 mb-6 max-w-sm mx-auto">
        Once you place an order — print or digital — you'll be able to
        track it right here.
      </p>
      <Link
        href="/studio/new-card"
        className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white rounded-full px-5 py-2.5 text-sm font-semibold transition-colors shadow-sm"
        data-testid="orders-empty-start-card"
      >
        <Wand2 className="w-4 h-4" />
        Start a card
      </Link>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="max-w-md mx-auto text-center py-12">
      <p className="text-sm text-red-600 mb-2">Couldn't load your orders.</p>
      <p className="text-xs text-stone-500">{message}</p>
    </div>
  );
}
