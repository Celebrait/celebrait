// client/src/pages/make.tsx — /make, DOOR 2 AS A CUSTOMER SURFACE
//
// Phase A placeholder (UX_LP2.md §6): the booking bar lands here with
// the brief in the URL. Phase B replaces this body with the real flow
// — guest gate, straight-to-generate, the wait screen with progressive
// reveal, the results screen (promise bar, made-for-them, tone chips,
// ready-now rail, photo strip), pick → cameo → inside. Until then this
// page proves the contract: the brief arrives intact, refresh-safe.

import { Link } from 'wouter';
import { KeeperHeader } from '@/components/landing/keeper-header';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { useSeo } from '@/lib/use-seo';

function readBrief() {
  const q = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  return {
    occasion: q.get('occasion') ?? 'birthday',
    who: q.get('who') ?? '',
    thing: q.get('thing') ?? '',
    by: q.get('by') ?? '',
    age: q.get('age') ?? '',
    name: q.get('name') ?? '',
    cant: q.get('cant') ?? '',
  };
}

export default function MakePage() {
  useSeo('/make');
  const b = readBrief();
  const rows: Array<[string, string]> = [
    ['Occasion', b.occasion], ['For', b.who], ['They love', b.thing || '—'],
    ['Needed by', b.by || '—'], ['Turning', b.age || '—'], ['Name', b.name || '—'], ["Can't stand", b.cant || '—'],
  ];
  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <KeeperHeader />
      <main className="mx-auto max-w-2xl px-4 pb-24 pt-36 sm:px-6">
        <span className="rounded border border-dashed border-brand-dark/40 bg-brand-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-dark">
          wireframe · phase B lands here
        </span>
        <h1 className="mt-4 font-display text-3xl font-bold text-keeper-ink">Writing three cards for your {b.who.toLowerCase() || 'person'}…</h1>
        <p className="mt-3 text-keeper-body">
          This is where the wait screen, the three cards, the promise line and the shelf will live.
          The brief arrived intact from the bar:
        </p>
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-2xl border border-keeper-hair bg-white/70 p-5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-semibold uppercase tracking-[0.12em] text-[11px] text-keeper-meta">{k}</dt>
              <dd className="text-keeper-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 text-sm text-keeper-meta">
          Meanwhile the shelf is real: <Link href={`/cards/${b.occasion}`} className="font-semibold text-brand-dark hover:underline">browse {b.occasion} cards →</Link>
        </p>
      </main>
    </div>
  );
}
