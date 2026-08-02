// client/src/components/studio/studio-hints.tsx
//
// First-run "studio hints" — small anchored coachmarks that point at the
// key touchpoints of the studio, one at a time, the first time a user
// lands. NOT a blocking wizard: each hint is dismissible, remembered, and
// only appears when its target is actually on screen. The user can skip
// the whole set at any point.
//
// How it anchors: each touchpoint carries a `data-hint="<id>"` attribute
// (the sidebar "New card" CTA + the mobile FAB share `new-card`; the
// Drafts and Address-book links carry `drafts` / `people`). The engine
// finds the FIRST VISIBLE element for the current hint, positions a
// fixed popover beside it (placement auto-derived from where the target
// sits in the viewport), and a soft ring over the target.
//
// Seen-ledger: a localStorage array (per-device V1, like the welcome
// greeting + photo consent). Server-backed is the durable upgrade and is
// where this should converge with the Tier-2 bell/inbox "seen" model.
//
// Sequencing: starts a few seconds after mount so it lands AFTER the
// welcome toast, and is suppressed on the maker / viewer / checkout
// surfaces where a coachmark would distract from the task.
//
// Premium feel here is mostly timing + placement polish — expect to tune
// copy, order, and which touchpoints are worth a hint once it's on screen.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { Lightbulb, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

interface HintDef {
  id: string;
  title: string;
  body: string;
}

// Order = the sequence they're offered in. A hint only shows once its
// target is visible, so on mobile (sidebar tucked in a sheet) the
// sidebar-anchored ones simply wait rather than misfire.
// Rewritten for the world-led home (Kevin 2026-08-01). Three beats,
// in the order the page argues them: the gift, the year, the craft.
// The old first tip anchored the New-card button and physically covered
// the hero headline — the new first tip anchors the free-card band,
// which sits below the hero and IS the thing worth coaching.
const HINTS: HintDef[] = [
  {
    id: 'free-card',
    title: 'A gift to start',
    body: 'Add three dates that matter — birthdays, anniversaries, any day — and your first card is free.',
  },
  {
    id: 'moments',
    title: 'Your year, watched',
    body: 'Every date you add lives in Moments. We nudge you before each one — no more last-minute scrambles.',
  },
  {
    id: 'new-card',
    title: 'When a moment comes',
    body: 'Pick the person, add a photo, and we make a card they’ll keep.',
  },
];

// v2 (2026-08-01): key bumped so everyone sees the rewritten tour ONCE —
// the old one described the pre-Moments studio.
const STORAGE_KEY = 'celebrait:hints:v2';
// Start after the welcome greeting (1.2s) has had its moment.
const START_DELAY_MS = 2800;
// Routes where a coachmark would distract from the task at hand.
const HIDE_ON: RegExp[] = [
  /^\/studio\/new-card(?:\/|$)/,
  /^\/studio\/card\//,
  /^\/checkout\//,
];

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeSeen(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* best-effort */
  }
}

/** First on-screen element carrying this hint id (handles the duplicate
 *  desktop-aside / mobile-sheet markers by skipping zero-size / off-screen
 *  ones). */
function findVisibleTarget(id: string): DOMRect | null {
  const els = document.querySelectorAll<HTMLElement>(`[data-hint="${id}"]`);
  for (const el of Array.from(els)) {
    const r = el.getBoundingClientRect();
    const onScreen =
      r.width > 0 &&
      r.height > 0 &&
      r.bottom > 0 &&
      r.right > 0 &&
      r.top < window.innerHeight &&
      r.left < window.innerWidth;
    if (onScreen) return r;
  }
  return null;
}

type Placement = 'right' | 'left' | 'top' | 'bottom';

function placementFor(r: DOMRect): Placement {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (r.left < w * 0.33) return 'right'; // left rail → point right
  if (r.right > w * 0.66) return 'left'; // right side (FAB) → point left
  return r.top < h * 0.5 ? 'bottom' : 'top';
}

export function StudioHints() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();
  const [seen, setSeen] = useState<Set<string>>(() => readSeen());
  const [ready, setReady] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const dismiss = useCallback((id: string) => {
    setSeen((prev) => {
      const next = new Set(prev);
      next.add(id);
      writeSeen(next);
      return next;
    });
  }, []);

  const skipAll = useCallback(() => {
    setSeen(() => {
      const next = new Set(HINTS.map((h) => h.id));
      writeSeen(next);
      return next;
    });
  }, []);

  const suppressed = HIDE_ON.some((rx) => rx.test(location));
  const enabled = isAuthenticated && !isLoading && !suppressed;

  // Delay start so the welcome toast lands first.
  useEffect(() => {
    if (!enabled) return;
    const t = window.setTimeout(() => setReady(true), START_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [enabled]);

  // Find the active hint (first unseen whose target is visible) and track
  // its rect. Polls on a light interval so a target that mounts after
  // navigation is picked up, and repositions on scroll / resize.
  useEffect(() => {
    if (!ready || !enabled) {
      setActiveId(null);
      setRect(null);
      return;
    }

    const evaluate = () => {
      // Wait for the first-arrival welcome to be dismissed before any
      // coachmarks appear — otherwise a hint could surface behind the
      // welcome's backdrop. (welcome-moment.tsx sets this flag on close.)
      let welcomed = true;
      try {
        welcomed = localStorage.getItem('celebrait:welcome:v1') === '1';
      } catch {
        welcomed = true; // storage blocked — don't block hints on it
      }
      if (!welcomed) {
        setActiveId(null);
        setRect(null);
        return;
      }
      for (const h of HINTS) {
        if (seen.has(h.id)) continue;
        const r = findVisibleTarget(h.id);
        if (r) {
          setActiveId(h.id);
          setRect(r);
          return;
        }
      }
      setActiveId(null);
      setRect(null);
    };

    evaluate();
    const interval = window.setInterval(evaluate, 500);
    window.addEventListener('resize', evaluate);
    window.addEventListener('scroll', evaluate, true);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('resize', evaluate);
      window.removeEventListener('scroll', evaluate, true);
    };
  }, [ready, enabled, seen]);

  // Engaging with the target itself (e.g. clicking "Drafts") counts as
  // acknowledging its hint — attach a one-shot click listener while active.
  useEffect(() => {
    if (!activeId) return;
    const els = document.querySelectorAll<HTMLElement>(
      `[data-hint="${activeId}"]`,
    );
    const onClick = () => dismiss(activeId);
    els.forEach((el) => el.addEventListener('click', onClick, { once: true }));
    return () =>
      els.forEach((el) => el.removeEventListener('click', onClick));
  }, [activeId, dismiss]);

  if (!ready || !enabled || !activeId || !rect) return null;
  const hint = HINTS.find((h) => h.id === activeId);
  if (!hint) return null;

  const placement = placementFor(rect);
  const index = HINTS.findIndex((h) => h.id === activeId);

  return createPortal(
    <HintPopover
      hint={hint}
      rect={rect}
      placement={placement}
      step={index + 1}
      total={HINTS.length}
      onDismiss={() => dismiss(activeId)}
      onSkip={skipAll}
    />,
    document.body,
  );
}

const GAP = 12;
const POP_W = 264;

function HintPopover({
  hint,
  rect,
  placement,
  step,
  total,
  onDismiss,
  onSkip,
}: {
  hint: HintDef;
  rect: DOMRect;
  placement: Placement;
  step: number;
  total: number;
  onDismiss: () => void;
  onSkip: () => void;
}) {
  // Anchor point + transform per placement. The popover is position:fixed
  // in viewport coords (rects are already viewport-relative).
  let left = 0;
  let top = 0;
  let translate = '';
  switch (placement) {
    case 'right':
      left = rect.right + GAP;
      top = rect.top + rect.height / 2;
      translate = 'translateY(-50%)';
      break;
    case 'left':
      left = rect.left - GAP;
      top = rect.top + rect.height / 2;
      translate = 'translate(-100%, -50%)';
      break;
    case 'top':
      left = rect.left + rect.width / 2;
      top = rect.top - GAP;
      translate = 'translate(-50%, -100%)';
      break;
    case 'bottom':
      left = rect.left + rect.width / 2;
      top = rect.bottom + GAP;
      translate = 'translateX(-50%)';
      break;
  }
  // Keep within the viewport horizontally for the left/right cases.
  const clampedLeft = Math.min(
    Math.max(left, GAP + (placement === 'left' ? POP_W : 0)),
    window.innerWidth - GAP - (placement === 'right' ? POP_W : 0),
  );

  return (
    <>
      {/* Soft ring over the target. pointer-events-none so the target
          stays clickable (clicking it also dismisses the hint). */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-[90] rounded-xl ring-2 ring-brand/60 ring-offset-2 ring-offset-transparent transition-all"
        style={{
          left: rect.left - 4,
          top: rect.top - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
      />
      <div
        role="dialog"
        aria-label={hint.title}
        className="fixed z-[91] w-[264px] rounded-2xl bg-brand-dark p-4 text-white shadow-[0_18px_44px_-16px_rgba(60,52,137,0.6)]"
        style={{ left: clampedLeft, top, transform: translate }}
        data-testid={`studio-hint-${hint.id}`}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
            <Lightbulb className="h-[18px] w-[18px]" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">{hint.title}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-white/85">
              {hint.body}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="-mr-1 -mt-1 rounded-md p-1 text-white/60 transition-colors hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="text-[11px] text-white/60">
            Tip {step} of {total}
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onSkip}
              className="text-[12px] text-white/70 transition-colors hover:text-white"
            >
              Skip tips
            </button>
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-full bg-white px-3.5 py-1.5 text-[12px] font-semibold text-brand-dark transition-colors hover:bg-white/90"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
