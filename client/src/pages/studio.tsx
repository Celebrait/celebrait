// client/src/pages/studio.tsx
//
// Studio Home — the dashboard landing surface.
//
// Three-state layout with a SHARED SPINE so the page never feels barren
// after day one (rebuild 2026-04-24, second pass):
//
//   Always visible (across all three states):
//     • Greeting header
//     • Demo video block (dismissible via localStorage)
//     • How it works (4-step strip)
//     • Invitations teaser ("What's next at Celebrait")
//
//   Per-state content in the middle:
//     1. Zero cards     — demo video as hero + "Start a card" CTA
//     2. Draft pending  — "pick back up" row (Option A: no card image)
//     3. Has activity   — latest-sent/ready hero + 3-column Drafts/
//                         Ready/Sent activity grid (drafts column
//                         pops when it holds items) + NewCardTile
//
// Drafts, Ready, and Sent each have their own filtered pages at
// /studio/drafts, /studio/ready, /studio/sent.

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { WorldSection } from '@/components/studio/world-section';
import { Link } from 'wouter';
import {
  ArrowRight,
  Sparkles,
  Wand2,
  Image as ImageIcon,
  Send,
  Package,
} from 'lucide-react';
import { CardGridSkeleton } from '@/components/studio/card-grid';
import { Card3DViewer } from '@/components/card-3d-viewer';
// Hero asset for the empty-state. Real Celebrait-rendered example
// (Father's Day occasion) — chosen to demonstrate the photoreal output
// to a brand-new user immediately, rather than showing a blank
// metaphor card. Swap if Kevin curates a different "first impression"
// occasion later.
import heroFrontSrc from '@/assets/fathers-day-front.jpg';
import heroInsideSrc from '@/assets/fathers-day-inside-new.jpg';
import { useAuth } from '@/hooks/use-auth';
import { bucketCards, collapseFamilies, deriveCardTitle } from '@/lib/studio-card-buckets';
import { getOccasionIcon } from '@/lib/occasion-icon';
import { getOccasionLabel } from '@/components/studio/scene-presets';
import { CARD_MAKER_STEPS } from '@shared/schema';
import type { CardGridItem } from '@shared/schema';

export default function StudioHome() {
  const { user } = useAuth();
  const displayName = user?.firstName || user?.email?.split('@')[0] || 'there';

  const { data, isLoading, error } = useQuery<CardGridItem[]>({
    queryKey: ['/api/user/cards'],
  });

  if (isLoading) {
    return (
      <>
        <DashboardHeader name={displayName} />
        <CardGridSkeleton />
      </>
    );
  }

  if (error) {
    return (
      <>
        <DashboardHeader name={displayName} />
        <div className="max-w-md mx-auto text-center py-12">
          <p className="text-sm text-accent-red-dark mb-2">Couldn't load your cards.</p>
          <p className="text-xs text-keeper-meta">
            {error instanceof Error ? error.message : 'Please try again.'}
          </p>
        </div>
      </>
    );
  }

  const cards = data ?? [];
  const { drafts, ready, sent } = bucketCards(cards);

  // State selection. Empty > Draft > Has-activity.
  // Redesign step B (2026-08-01): "your world" leads the home for every
  // state — greeting, next moment, the free-card band, a two-item river.
  // The per-state content follows without its own greeting header, and
  // without the old UpcomingWidget (the river replaces it).
  const stateView =
    ready.length > 0 || sent.length > 0 ? (
      <HasActivityView name={displayName} drafts={drafts} ready={ready} sent={sent} />
    ) : drafts.length > 0 ? (
      <DraftPendingView name={displayName} draft={drafts[0]} />
    ) : (
      <EmptyView name={displayName} />
    );
  return (
    <>
      <WorldSection name={displayName} showRiver={cards.length === 0} />
      {stateView}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// State 1 — zero cards
//
// Hero Card pattern per HERO_CARD.md + next_studio_dashboard_scope.md
// §1. Iterations:
//   • 2026-04-24 first pass: demo video block as hero. Reverted —
//     `VIDEO_SRC` was null (stub), the empty state was hollow.
//   • 2026-04-28 first attempt: 3D card with card-blank.svg + side
//     copy. Mobile was poor (card swallowed the screen, CTA below the
//     fold) and showed metaphor not product.
//   • 2026-04-28 SECOND attempt (this one): real photoreal example
//     card (Father's Day) in the 3D viewer. Mobile-first responsive:
//     copy + CTA above the fold; card sits below as the proof beat.
//     On lg+ desktop, classic split layout — copy left, card right at
//     the same vertical level so eye lands on the product.
//
// Mobile-first is non-negotiable here — this is a brand-new user's
// FIRST authenticated screen. CTA must be above the fold. Three.js on
// mobile is fine for a slow autoRotate (low frame budget); we cap card
// height at 36vh on phones so it sits as a proof beat below the CTA,
// not the dominant visual.
//
// The "Watch how it works (30s)" secondary link is gated on a real
// VIDEO_SRC being set in DemoVideoBlock. Today VIDEO_SRC is null, so
// the link is hidden. When Kevin wires a real video, set the export
// in demo-video-block.tsx and the link appears here automatically.
// ─────────────────────────────────────────────────────────────────────

function EmptyView({ name }: { name: string }) {
  return (
    <>

      {/* Hero — split on lg+, stacked on smaller. lg breakpoint chosen
          deliberately: at md (768px) the card is too narrow for the 3D
          viewer to read. Stack until 1024px. */}
      <section className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center mb-14 lg:mb-20">
        {/* Copy column.
            On mobile (default): text-center, full-width, comes FIRST
            (order-1) so headline + CTA land above the fold.
            On lg+: text-left, card sits to the right at the same
            vertical level. */}
        <div className="order-1 lg:order-1 text-center lg:text-left max-w-md mx-auto lg:mx-0 lg:max-w-none">
          <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] font-semibold text-brand-dark bg-brand-muted/60 rounded-full px-2.5 py-1 mb-5">
            <Sparkles className="w-3 h-3" />
            Your first card
          </p>
          <h2 className="text-[2.25rem] leading-[1.05] sm:text-5xl lg:text-6xl font-semibold text-keeper-ink tracking-tight mb-4 lg:mb-5">
            Made-by-heart
            <br />
            <em className="italic text-brand-dark font-normal">cards.</em>
          </h2>
          <p className="text-base sm:text-lg text-keeper-body leading-relaxed mb-7">
            Like the one below — built around someone you love. Upload a photo, tell us the moment, and we'll render a card with them in it. Print it and post it — with a free digital link to share.
          </p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-center lg:items-start gap-3 sm:gap-4 justify-center lg:justify-start">
            <Link
              href="/studio/new-card"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-go hover:bg-go-hover text-white rounded-full px-7 py-3.5 text-base font-semibold transition-colors shadow-sm"
              data-testid="empty-start-card"
            >
              <Wand2 className="w-4 h-4" />
              Start your first card
            </Link>
          </div>
        </div>

        {/* 3D card column.
            Sits BELOW the copy on mobile (order-2). Height capped to
            36vh on phones (proof beat, not dominant visual) and
            allowed to grow into 50–58vh on larger viewports.
            Wrapped in a brand-tinted soft gradient backdrop so the
            card has somewhere to "sit" instead of floating against
            page background — picks up the same warm tone the
            invitations teaser uses for visual coherence with the rest
            of the studio. */}
        <div className="order-2 relative w-full h-[36vh] min-h-[280px] sm:h-[44vh] lg:h-[58vh] rounded-3xl bg-gradient-to-br from-brand-muted/40 via-white to-brand-muted/20 border border-keeper-hair/80 overflow-hidden">
          <Card3DViewer
            frontImageUrl={heroFrontSrc}
            insideImageUrl={heroInsideSrc}
            backCredit="Made with Celebrait"
            framingMargin={1.5}
            minDistance={2.1}
            /* Was autoRotate — the spinning card was the "fancy
               gadget" Kevin removed site-wide 2026-07-07. Rests ajar
               in the standard pose instead. */
            enableRotate={false}
            enableZoom={false}
            closedAngle={-0.38}
            restYaw={-0.12}
            className="w-full h-full"
          />
        </div>
      </section>

      {/* Upcoming widget — only renders if the user has at least one
          recipient with a date in the next 60 days. For most brand-new
          empty-state users it'll be invisible (no recipients yet);
          appears the moment they add someone via the address book or
          finish a card. */}

      {/* Promo blocks removed from the home (Kevin 2026-08-01) — the
          world-led home explains itself. */}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// State 2 — one or more drafts, zero generated/sent
//
// "Pick back up" row. Text-first on purpose — a half-finished card
// has no safe image to show. Progress is implied by the step label +
// Continue CTA. Shared spine (video + how-it-works + invitations)
// follows so the page isn't a single row floating on whitespace.
// ─────────────────────────────────────────────────────────────────────

function DraftPendingView({ name, draft }: { name: string; draft: CardGridItem }) {
  const title = deriveCardTitle(draft);

  return (
    <>

      <div className="bg-white rounded-2xl border border-keeper-hair p-6 sm:p-8 mb-8 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
        <div className="w-12 h-12 rounded-full bg-brand-muted text-brand-dark flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-keeper-meta uppercase tracking-wider mb-1">
            In progress
          </p>
          <p className="text-lg sm:text-xl font-semibold text-keeper-ink truncate">
            Finishing {title}
          </p>
          <p className="text-sm text-keeper-body mt-0.5">
            Come back whenever — your draft is saved.
          </p>
        </div>
        <Link
          href={`/studio/card/${draft.id}/edit`}
          className="inline-flex items-center justify-center gap-2 bg-go hover:bg-go-hover text-white rounded-full px-5 py-2.5 text-sm font-semibold transition-colors shadow-sm whitespace-nowrap"
          data-testid="draft-continue"
        >
          Continue
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Secondary CTA — start another. Softer than Continue so the
          primary path stays obvious. */}
      <div className="text-center mb-12">
        <Link
          href="/studio/new-card"
          className="inline-flex items-center gap-2 text-sm text-keeper-body hover:text-brand-dark underline underline-offset-4 decoration-stone-300"
        >
          <Wand2 className="w-4 h-4" />
          Or start a new card
        </Link>
      </div>


      {/* Promo blocks removed (Kevin 2026-08-01). */}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// State 3 — has at least one generated (ready) or sent card
//
// Rich activity view. Hero = freshest sent-or-ready card as a status
// row. Below = 3-column Drafts/Ready/Sent summary (drafts column has
// a brand-violet accent when it holds items so it's visually louder).
// Shared spine follows.
// ─────────────────────────────────────────────────────────────────────

function HasActivityView({
  name,
  drafts,
  ready,
  sent,
}: {
  name: string;
  drafts: CardGridItem[];
  ready: CardGridItem[];
  sent: CardGridItem[];
}) {
  // Hero priority: Ready > Sent. Ready = revenue waiting; Sent =
  // nostalgic "look how pretty." Action beats status, so Ready cards
  // carousel through the hero. If no Ready, we fall back to the
  // latest Sent card.
  // Take-families collapse to their newest take so five rolls of one
  // card don't dominate the hero carousel + Ready column.
  const readyCovers = collapseFamilies(ready).covers;
  const heroCards: CardGridItem[] =
    readyCovers.length > 0 ? readyCovers : sent[0] ? [sent[0]] : [];
  const heroBucket: 'ready' | 'sent' = readyCovers.length > 0 ? 'ready' : 'sent';

  const recentDrafts = drafts.slice(0, 3);
  const recentReady = readyCovers.slice(0, 3);
  const recentSent = sent.slice(0, 3);

  return (
    <>

      {heroCards.length > 0 && (
        <HeroCarousel cards={heroCards} bucket={heroBucket} />
      )}

      {/* Upcoming — sits high in the returning-user view because this
          IS the engine the founder is investing in for retention. The
          audit's discoverability fix: don't bury it below the activity
          columns. Renders nothing when no upcoming items in 60 days,
          so users with recipients-but-nothing-soon don't see clutter. */}

      {/* Three-column activity summary. Accent hierarchy reflects
          priority: Ready gets the loudest CTA-green treatment (revenue
          waiting), Drafts gets a softer brand-violet (action item but
          lower stakes), Sent is neutral (no action needed). */}
      <div className="grid md:grid-cols-3 gap-6 mb-10">
        <ActivityColumn
          label="Drafts"
          icon={<Sparkles className="w-4 h-4" />}
          cards={recentDrafts}
          seeAllHref="/studio/drafts"
          emptyCopy="Nothing in progress."
          accentTone={recentDrafts.length > 0 ? 'brand' : null}
          rowVariant="draft"
        />
        <ActivityColumn
          label="Ready"
          icon={<Package className="w-4 h-4" />}
          cards={recentReady}
          seeAllHref="/studio/ready"
          emptyCopy="Nothing waiting to send."
          accentTone={recentReady.length > 0 ? 'cta' : null}
        />
        <ActivityColumn
          label="Sent"
          icon={<Send className="w-4 h-4" />}
          cards={recentSent}
          seeAllHref="/studio/sent"
          emptyCopy="Sent cards will show up here."
        />
      </div>

      {/* Promo blocks removed (Kevin 2026-08-01). */}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// HeroCarousel — the top-of-activity hero. Prefers Ready cards; if
// multiple Ready cards exist, auto-rotates every ~6s with a pause on
// hover/focus and manual dot navigation. Falls back to a static card
// when there's only one (no point cycling).
// ─────────────────────────────────────────────────────────────────────

const HERO_ROTATE_MS = 6000;

function HeroCarousel({
  cards,
  bucket,
}: {
  cards: CardGridItem[];
  bucket: 'ready' | 'sent';
}) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const shouldRotate = cards.length > 1 && !paused;

  useEffect(() => {
    if (!shouldRotate) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % cards.length);
    }, HERO_ROTATE_MS);
    return () => window.clearInterval(t);
  }, [shouldRotate, cards.length]);

  // Clamp index if the cards array changes under us (new card, delete).
  useEffect(() => {
    if (idx >= cards.length) setIdx(0);
  }, [cards.length, idx]);

  const current = cards[idx] ?? cards[0]!;
  const title = deriveCardTitle(current);
  const isSent = bucket === 'sent';

  return (
    <div
      className="mb-10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <Link
        href={`/studio/card/${current.id}`}
        className="block bg-white rounded-2xl border border-keeper-hair p-6 sm:p-8 hover:border-brand hover:shadow-lg transition-all"
        data-testid={isSent ? 'home-hero-sent' : 'home-hero-ready'}
        data-hero-card-id={current.id}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          <div className="w-20 h-20 rounded-xl bg-stone-100 overflow-hidden flex-shrink-0">
            {current.frontImageUrl ? (
              <img
                key={current.id}
                src={current.frontImageUrl}
                crossOrigin="anonymous"
                alt={title}
                className="w-full h-full object-cover animate-in fade-in-0 duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-keeper-meta">
                <ImageIcon className="w-8 h-8" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            {isSent ? (
              <p className="text-xs font-medium text-keeper-gold uppercase tracking-wider mb-1">
                On its way
                <span className="ml-1">✨</span>
              </p>
            ) : (
              <p className="text-xs font-medium text-cta-hover uppercase tracking-wider mb-1">
                Ready to send
              </p>
            )}
            <p
              key={`title-${current.id}`}
              className="text-lg sm:text-xl font-semibold text-keeper-ink truncate animate-in fade-in-0 slide-in-from-bottom-1 duration-500"
            >
              {title}
            </p>
            <p className="text-sm text-keeper-body mt-0.5">
              {isSent
                ? 'Track delivery in Orders & delivery.'
                : 'Ready to print and post.'}
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-keeper-meta flex-shrink-0 hidden sm:block" />
        </div>
      </Link>

      {/* Dots — only when we have more than one card. Hover/focus pauses
          rotation; the dots let the user pick a specific one. */}
      {cards.length > 1 && (
        <div
          className="flex items-center justify-center gap-2 mt-4"
          role="tablist"
          aria-label="Switch hero card"
        >
          {cards.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === idx}
              aria-label={`Show card ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === idx
                  ? 'w-6 bg-brand'
                  : 'w-1.5 bg-stone-300 hover:bg-stone-400'
              }`}
              data-testid={`hero-dot-${i}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// ActivityColumn — one of Drafts / Ready / Sent on the activity row.
// `accentTone` sets the visual loudness of the column:
//   • 'cta'   = green top-bar + green count badge. Used for Ready
//               (revenue waiting — loudest voice).
//   • 'brand' = brand-violet top-bar + violet count badge. Used for
//               Drafts (action item, lower stakes than Ready).
//   • null    = neutral stone border + stone count badge. Used for Sent
//               and for any column that's currently empty.
// `rowVariant="draft"` swaps CompactCardRow for the richer DraftRow
// which shows step progress + relative time + pen-on-cream placeholder.
// ─────────────────────────────────────────────────────────────────────

type AccentTone = 'brand' | 'cta' | null;

function ActivityColumn({
  label,
  icon,
  cards,
  seeAllHref,
  emptyCopy,
  accentTone = null,
  rowVariant = 'default',
}: {
  label: string;
  icon: React.ReactNode;
  cards: CardGridItem[];
  seeAllHref: string;
  emptyCopy: string;
  accentTone?: AccentTone;
  rowVariant?: 'default' | 'draft';
}) {
  const toneClass =
    accentTone === 'cta'
      ? {
          border: 'border-cta/60 bg-cta-light/40',
          accentBar: 'bg-cta',
          iconColor: 'text-cta-hover',
          badge: 'bg-cta text-white',
        }
      : accentTone === 'brand'
        ? {
            border: 'border-brand/60 bg-brand-muted/40',
            accentBar: 'bg-brand',
            iconColor: 'text-brand-dark',
            badge: 'bg-brand text-white',
          }
        : {
            border: 'border-keeper-hair',
            accentBar: '',
            iconColor: 'text-keeper-meta',
            badge: 'bg-stone-200 text-keeper-body',
          };

  return (
    <div
      className={`relative bg-white rounded-2xl border p-5 transition-colors ${toneClass.border}`}
    >
      {toneClass.accentBar && (
        <div
          aria-hidden
          className={`absolute top-0 left-4 right-4 h-0.5 rounded-b-full ${toneClass.accentBar}`}
        />
      )}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-keeper-ink">
          <span className={toneClass.iconColor}>{icon}</span>
          {label}
          {cards.length > 0 && (
            <span
              className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold ${toneClass.badge}`}
            >
              {cards.length}
            </span>
          )}
        </div>
        <Link
          href={seeAllHref}
          className="text-xs text-keeper-meta hover:text-brand-dark underline-offset-4 hover:underline"
          data-testid={`see-all-${label.toLowerCase()}`}
        >
          See all
        </Link>
      </div>
      {cards.length === 0 ? (
        <p className="text-sm text-keeper-meta py-6 text-center">{emptyCopy}</p>
      ) : (
        <div className="space-y-2">
          {cards.map((c) =>
            rowVariant === 'draft' ? (
              <DraftRow key={c.id} card={c} />
            ) : (
              <CompactCardRow key={c.id} card={c} />
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// CompactCardRow — generic tile row for the Ready/Sent activity
// columns. Thumbnail + title, one line, click-through to the viewer
// (or the maker if it's unexpectedly a draft).
// ─────────────────────────────────────────────────────────────────────

function CompactCardRow({ card }: { card: CardGridItem }) {
  const title = deriveCardTitle(card);
  const href =
    card.status === 'draft' || card.status === 'generating' || card.status === 'failed'
      ? `/studio/card/${card.id}/edit`
      : `/studio/card/${card.id}`;
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-stone-50 transition-colors"
      data-testid={`compact-card-${card.id}`}
    >
      <div className="w-10 h-10 rounded bg-stone-100 overflow-hidden flex-shrink-0">
        {card.frontImageUrl ? (
          <img
            src={card.frontImageUrl}
            crossOrigin="anonymous"
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-keeper-meta">
            <ImageIcon className="w-4 h-4" />
          </div>
        )}
      </div>
      <p className="text-sm text-keeper-ink truncate flex-1">{title}</p>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────
// DraftRow — richer row for the Drafts activity column. Shows step
// progress + relative time; uses a warm pen-on-cream placeholder
// instead of the generic image-off. Prevents the column reading as
// "empty filename slots" when drafts haven't rendered any images.
// ─────────────────────────────────────────────────────────────────────

function DraftRow({ card }: { card: CardGridItem }) {
  const title = deriveCardTitle(card);
  const progress = formatDraftProgress(card.draftStep);
  const when = formatRelativeTime(card.createdAt);
  const metaLine =
    progress && when ? `${progress} · ${when}` : progress || when || null;
  // Occasion-aware icon when we know it (Cake for birthday, Gem for
  // wedding, etc.); PenLine fallback otherwise. Much cleaner read than
  // the cream-filled placeholder box that sat here before — the icon
  // tells the user at a glance what kind of card this is.
  const Icon = getOccasionIcon(card.occasion);

  return (
    <Link
      href={`/studio/card/${card.id}/edit`}
      className="flex items-start gap-3 p-2 -mx-2 rounded-lg hover:bg-white/70 transition-colors"
      data-testid={`draft-row-${card.id}`}
    >
      <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center text-brand-dark">
        {card.frontImageUrl ? (
          <img
            src={card.frontImageUrl}
            crossOrigin="anonymous"
            alt={title}
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <Icon className="w-5 h-5" strokeWidth={1.75} />
        )}
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <p className="text-sm font-medium text-keeper-ink truncate">{title}</p>
        {metaLine && (
          <p className="text-[11px] text-keeper-meta truncate mt-0.5">
            {metaLine}
          </p>
        )}
      </div>
    </Link>
  );
}

/** Map a 0-indexed step number to a user-facing "Step X of 6 · Label"
 *  string. Review (index 6) is the final "Ready to review" state — no
 *  step count, just a cue. Null if step is missing. */
function formatDraftProgress(step: number | null): string | null {
  if (step == null) return null;
  const total = CARD_MAKER_STEPS.length - 1; // exclude Review
  if (step < 0 || step >= CARD_MAKER_STEPS.length) return null;
  if (step >= total) return 'Ready to review';
  const label = CARD_MAKER_STEPS[step]?.label ?? '';
  return label ? `Step ${step + 1} of ${total} · ${label}` : null;
}

/** Human-friendly relative time for dashboard rows. "Today" / "Yesterday"
 *  / "3 days ago" / "12 Apr" — matches the Orders page's formatWhen so
 *  the dashboard feels coherent. */
function formatRelativeTime(ts: Date | string | null): string | null {
  if (!ts) return null;
  const d = typeof ts === 'string' ? new Date(ts) : ts;
  const diffMs = Date.now() - d.getTime();
  const day = 86_400_000;
  if (diffMs < day) return 'Started today';
  if (diffMs < 2 * day) return 'Started yesterday';
  if (diffMs < 7 * day) return `Started ${Math.floor(diffMs / day)} days ago`;
  return `Started ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
}

// ─────────────────────────────────────────────────────────────────────
// Shared header used across all three states. Greeting + optional
// subtitle. Matches the warm tone previously set in studio-layout.tsx.
// ─────────────────────────────────────────────────────────────────────
function DashboardHeader({
  name,
  subtitle,
}: {
  name: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6 sm:mb-8">
      <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-[-0.015em] text-keeper-ink">
        Hi {name} <span className="text-keeper-gold">✨</span>
      </h1>
      {subtitle && <p className="text-sm text-keeper-body mt-1">{subtitle}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Upcoming widget — first move from the retention-engine audit
// (next_address_book_reminders_retention.md). Surfaces the next few
// dates the user shouldn't forget, right on Studio Home, where it
// fixes the discoverability hole the audit named: before this, the
// People/Reminders engine was invisible from the page users actually
// land on after login. Without this surface the audit's prediction
// stood: "users will look at retention metrics in month three and
// conclude reminders don't work — when really the surfaces haven't
// yet asked the user to care."
//
// Conditional: renders nothing when there are no upcoming dates in
// the next 60 days. Zero-clutter for never-added-anyone users.
//
// Each row taps through to /studio/people/reminders rather than
// jumping into the maker. The widget's V1 job is DISCOVERY of the
// feature, not a direct call to action — that's a later iteration
// (e.g. "make a card for Mum now" inline button).
// ─────────────────────────────────────────────────────────────────────

interface UpcomingReminder {
  occasionId: number;
  entryId: number;
  recipientName: string;
  relationship: string | null;
  occasion: string;
  occurrenceDate: string;
  daysUntil: number;
  suppressed: boolean;
  suppressedUntil: string | null;
}

const UPCOMING_WINDOW_DAYS = 60;
const UPCOMING_MAX_ITEMS = 3;

function UpcomingWidget() {
  const { data, isLoading } = useQuery<UpcomingReminder[]>({
    queryKey: ['/api/user/reminders'],
  });

  if (isLoading) return null;

  const items = (data ?? [])
    .filter(
      (r) => !r.suppressed && r.daysUntil >= 0 && r.daysUntil <= UPCOMING_WINDOW_DAYS,
    )
    .slice(0, UPCOMING_MAX_ITEMS);

  if (items.length === 0) return null;

  return (
    <section
      className="bg-white rounded-2xl border border-keeper-hair p-5 sm:p-6 mb-8 sm:mb-10"
      aria-labelledby="upcoming-heading"
      data-testid="studio-upcoming"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2
          id="upcoming-heading"
          className="text-sm font-semibold text-keeper-ink uppercase tracking-wide"
        >
          Coming up
        </h2>
        <Link
          href="/studio/people/reminders"
          className="text-xs text-brand hover:text-brand-dark font-medium"
          data-testid="studio-upcoming-see-all"
        >
          See all →
        </Link>
      </div>
      <ul className="space-y-1">
        {items.map((r) => (
          <UpcomingRow key={r.occasionId} reminder={r} />
        ))}
      </ul>
    </section>
  );
}

function UpcomingRow({ reminder }: { reminder: UpcomingReminder }) {
  const Icon = getOccasionIcon(reminder.occasion);
  const label = getOccasionLabel(reminder.occasion);
  const isOther = reminder.occasion === 'other' || label === 'Other';
  // "Mum's birthday" / "Sarah's anniversary". For 'other' we omit the
  // (ugly) "'s other" suffix — just the name + the day text carries
  // enough.
  const title = isOther
    ? reminder.recipientName
    : `${reminder.recipientName}'s ${label.toLowerCase()}`;
  const dayText =
    reminder.daysUntil === 0
      ? 'Today'
      : reminder.daysUntil === 1
        ? 'Tomorrow'
        : `In ${reminder.daysUntil} days`;

  return (
    <li>
      <Link
        href="/studio/people/reminders"
        className="flex items-center gap-3 px-2 py-2 -mx-2 rounded-lg hover:bg-stone-50 transition-colors"
        data-testid={`studio-upcoming-${reminder.occasionId}`}
      >
        <span className="w-9 h-9 rounded-full bg-brand-muted/50 text-brand-dark flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" strokeWidth={1.75} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-keeper-ink truncate">{title}</p>
          <p className="text-xs text-keeper-meta">{dayText}</p>
        </div>
      </Link>
    </li>
  );
}
