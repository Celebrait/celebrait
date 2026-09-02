// client/src/pages/landing-three.tsx — LP3, THE SHOP WINDOW (mock, on site)
//
// The rethink after LP2's audit (2026-09-02): one home page, one promise,
// one action. The three routes stop being three products and become three
// depths of the same answer to "who's it for?" — off the shelf (one we
// already made for someone like them), made for them (three we'll write
// now), with them in it (from a photo). The old LP's hero photograph and
// the photo-route carousel are reused verbatim; the rack is shown as
// EVIDENCE of the engine, not as a store. Wireframe labels mark what's
// owed. Palette: tailwind.config.ts, nothing else.

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { FaqSection } from '@/components/landing/faq-section';
import { CelebrationBackdrop } from '@/pages/hero-scroll-poc';
import { AjarTile } from '@/components/catalogue/ajar-tile';
import { DISPLAY, HeroProof, ProofSection, InsideSection } from '@/pages/landing-keeper';
import { useSeo } from '@/lib/use-seo';
import { cardPriceGBP, SHIPPING_TIERS } from '@shared/pricing';
import logoUrl from '@/assets/celebrait.webp';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;
// Typography discipline (Aidan, 2026-09-02: "too much?"): ONE display
// moment per screen, one body size, one meta size. Eyebrows only where
// they label a price. Nothing else shouts.
const H2 = `${DISPLAY} text-[clamp(24px,3vw,34px)] leading-[1.1]`;

function Wire({ label }: { label: string }) {
  return (
    <span className="rounded border border-dashed border-brand-dark/40 bg-brand-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-dark">
      wireframe · {label}
    </span>
  );
}

// ── 0. Header: the standing promise + occasion nav + ONE verb ─────────
function ShopHeader() {
  const standard = SHIPPING_TIERS.find((t) => t.id === 'standard');
  const nav = [
    { label: 'Christmas', href: '/cards/christmas' },
    { label: 'Birthdays', href: '/cards/birthday' },
    { label: 'Kids', href: '/cards/birthday/kids' },
    { label: 'From your photo', href: '/studio' },
  ];
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="border-b border-keeper-hair bg-keeper-paper/95 text-center text-[12px] text-keeper-meta backdrop-blur">
        <span className="inline-block py-1.5"><span className="hidden sm:inline">Printed to order in the UK · </span>Posted first class · <b className="text-keeper-ink">{standard ? gbp(standard.price) : '£2.95'}</b> postage<span className="hidden sm:inline"> per order</span></span>
      </div>
      <div className="mx-auto mt-3 max-w-6xl px-4 sm:px-6">
        <div className="flex items-center justify-between gap-3 rounded-full border border-keeper-hair bg-white/90 py-2 pl-5 pr-2 shadow-[0_1px_2px_rgba(33,29,25,0.05),0_10px_30px_-16px_rgba(33,29,25,0.25)] backdrop-blur">
          <Link href="/lp3" className="flex items-center" aria-label="Celebrait home"><img src={logoUrl} alt="Celebrait" className="h-6 w-auto" /></Link>
          <nav className="hidden items-center gap-6 md:flex">
            {nav.map((l) => <Link key={l.href} href={l.href} className="text-[14px] font-medium text-keeper-body hover:text-keeper-ink">{l.label}</Link>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/studio" className="hidden px-3 text-[14px] font-medium text-keeper-body hover:text-keeper-ink sm:inline">Sign in</Link>
            <a href="#who" className="rounded-full bg-keeper-ink px-4 py-2.5 text-[14px] font-semibold text-keeper-paper hover:bg-black">Make one for them</a>
          </div>
        </div>
      </div>
    </header>
  );
}

// ── 1. Hero: one promise, one action, one proof ───────────────────────
const WHO = ['Mum', 'Dad', 'Nan', 'Grandad', 'Sister', 'Brother', 'Daughter', 'Son', 'Partner', 'Best mate', 'Friend', 'Colleague', 'Someone else'];
const field = 'h-12 w-full rounded-full border border-keeper-hair bg-white px-4 text-[15px] text-keeper-ink outline-none focus:border-transparent focus:ring-2 focus:ring-brand-dark';

function WhoPill() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState('Mum');
  const [occasion, setOccasion] = useState('birthday');
  const submit = (e: FormEvent) => { e.preventDefault(); navigate(`/make?occasion=${occasion}&who=${encodeURIComponent(who)}`); };
  return (
    <div id="who" className="scroll-mt-40">
      {/* Mobile: one pill. Tap it and the two facts appear. */}
      <button type="button" onClick={() => setOpen(true)} className={`${open ? 'hidden' : 'flex'} h-14 w-full items-center justify-between rounded-full border border-keeper-hair bg-white pl-5 pr-2 text-left shadow-[0_10px_30px_-16px_rgba(33,29,25,0.35)] md:hidden`}>
        <span><span className="block text-[10.5px] font-semibold uppercase tracking-[0.14em] text-keeper-meta">Start here</span><span className="text-[16px] font-semibold text-keeper-ink">Who's it for?</span></span>
        <span className="rounded-full bg-go px-4 py-2.5 text-[14px] font-semibold text-go-foreground">Go</span>
      </button>
      <form onSubmit={submit} className={`${open ? 'grid' : 'hidden md:grid'} gap-2 md:grid-cols-[1fr_1fr_auto]`}>
        <label className="sr-only" htmlFor="who-sel">Who it's for</label>
        <select id="who-sel" className={field} value={who} onChange={(e) => setWho(e.target.value)}>
          {WHO.map((w) => <option key={w} value={w}>{w === 'Someone else' ? 'Someone else…' : `For ${w}`}</option>)}
        </select>
        <label className="sr-only" htmlFor="occ-sel">The occasion</label>
        <select id="occ-sel" className={field} value={occasion} onChange={(e) => setOccasion(e.target.value)}>
          <option value="birthday">Their birthday</option>
          <option value="christmas">Christmas</option>
        </select>
        <button type="submit" className="h-12 rounded-full bg-go px-6 text-[15px] font-bold text-go-foreground shadow-[0_6px_18px_-6px_rgba(92,87,212,0.5)] hover:bg-go-hover">
          Make their three cards
        </button>
      </form>
      <p className="mt-3 text-[12.5px] text-keeper-meta">
        Written and drawn in about a minute · nothing to pay until you print · from <b className="text-keeper-ink">{gbp(cardPriceGBP('rack'))}</b>
      </p>
    </div>
  );
}

function HeroSection() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr] md:gap-12">
        <div>
          <h1 className={`${DISPLAY} max-w-[15ch] text-[clamp(32px,4.6vw,52px)] leading-[1.06] text-balance`}>
            A card made <em className="not-italic text-brand-dark">for them</em>. Not picked for them.
          </h1>
          <p className="mt-4 max-w-[44ch] text-[16px] leading-relaxed text-keeper-body">
            Tell us who it's for and one thing they love. We write and illustrate three original cards
            for that one person. You pick, add your words, and it's printed and in the post.
          </p>
          <div className="mt-7"><WhoPill /></div>
        </div>
        <div className="relative">
          <HeroProof />
          <p className="mt-10 text-[12.5px] text-keeper-meta sm:mt-12">
            A real one, from a phone photo and the words <i>Happy Birthday Mummy</i>.
          </p>
        </div>
      </div>
    </section>
  );
}

// ── 2. The shelf: evidence of the engine, not a store ─────────────────
interface RackCard { id: number; front_text: string; imageUrl: string; recipient?: string | null; interest?: string | null; age?: number | null }
interface Hub { count: number; cards: RackCard[] }

function briefFor(c: RackCard, occasion: string): string {
  const who = c.recipient ? c.recipient.charAt(0).toUpperCase() + c.recipient.slice(1) : occasion === 'christmas' ? 'Christmas' : 'a birthday';
  const bits = [who, c.age ? `turning ${c.age}` : null, c.interest].filter(Boolean);
  return bits.join(' · ');
}

function ShelfSection() {
  const [xmas, setXmas] = useState<Hub | null>(null);
  const [bday, setBday] = useState<Hub | null>(null);
  useEffect(() => {
    fetch('/api/catalogue/christmas').then((r) => (r.ok ? r.json() : null)).then(setXmas).catch(() => {});
    fetch('/api/catalogue/birthday').then((r) => (r.ok ? r.json() : null)).then(setBday).catch(() => {});
  }, []);
  const rail = useMemo(() => {
    const a = (xmas?.cards ?? []).slice(0, 6).map((c) => ({ ...c, occ: 'christmas' }));
    const b = (bday?.cards ?? []).slice(0, 6).map((c) => ({ ...c, occ: 'birthday' }));
    const out: Array<RackCard & { occ: string }> = [];
    for (let i = 0; i < 6; i++) { if (b[i]) out.push(b[i]); if (a[i]) out.push(a[i]); }
    return out;
  }, [xmas, bday]);
  const total = (xmas?.count ?? 0) + (bday?.count ?? 0);
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-dark">Off the shelf · {gbp(cardPriceGBP('rack'))}</p>
          <h2 className={`${H2} mt-1`}>Every card here was made for someone.</h2>
          <p className="mt-2 max-w-[56ch] text-keeper-body">Each began as a brief like yours. Send it as it is, or put your own words inside. {total ? `${total} on the shelf today.` : ''}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/cards/christmas" className="rounded-full border border-keeper-hair bg-white px-4 py-2 text-[13.5px] font-semibold text-keeper-ink hover:border-brand-dark">Christmas{xmas ? ` · ${xmas.count}` : ''}</Link>
          <Link href="/cards/birthday" className="rounded-full border border-keeper-hair bg-white px-4 py-2 text-[13.5px] font-semibold text-keeper-ink hover:border-brand-dark">Birthdays{bday ? ` · ${bday.count}` : ''}</Link>
          <Link href="/cards/birthday/kids" className="rounded-full border border-keeper-hair bg-white px-4 py-2 text-[13.5px] font-semibold text-keeper-ink hover:border-brand-dark">Kids</Link>
        </div>
      </div>
      <div className="-mx-4 mt-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="grid w-max grid-flow-col auto-cols-[46vw] gap-3 sm:w-auto sm:grid-flow-row sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
          {(rail.length ? rail : Array.from({ length: 12 }, (_, i) => null as null | (RackCard & { occ: string }))).map((c, i) =>
            c ? (
              <Link key={c.id} href={`/card/${c.id}`} className="group block">
                <AjarTile imageUrl={c.imageUrl} alt={c.front_text} />
                <p className="mt-2 truncate text-[12.5px] text-keeper-meta">{briefFor(c, c.occ)}</p>
              </Link>
            ) : <div key={i} className="aspect-square animate-pulse rounded-lg bg-keeper-hair/50" />,
          )}
        </div>
      </div>
    </section>
  );
}

// ── 3. One question, three depths ─────────────────────────────────────
function DepthsSection() {
  const depths = [
    { k: 'Off the shelf', price: cardPriceGBP('rack'), h: 'One we already made for someone like them', p: 'Real cards, ready now. Add your words inside and it\'s printed today if you order by 3pm.', cta: 'Browse the shelf', href: '/cards/christmas' },
    { k: 'Made for them', price: cardPriceGBP('maker'), h: 'Three we write and draw right now', p: 'Who it\'s for and one thing they love. Three originals in about a minute. You pick the winner.', cta: 'Start with who it\'s for', href: '#who', hot: true },
    { k: 'With them in it', price: cardPriceGBP('photo'), h: 'From a photo — they become the artwork', p: 'Describe the scene, we make it real. Big Ben, the Northern Lights, their kitchen. First one\'s on us.', cta: 'Start with a photo', href: '/studio' },
  ];
  return (
    <section id="price" className="mx-auto max-w-6xl px-4 sm:px-6">
      <h2 className={H2}>One question. Three depths.</h2>
      <p className="mt-3 max-w-[56ch] text-keeper-body">Same card at the end: 280gsm, kraft envelope, printed to order in the UK, posted first class. Pay for the depth you want.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {depths.map((d) => (
          <div key={d.k} className={`flex flex-col rounded-2xl border p-5 ${d.hot ? 'border-brand-dark bg-brand-muted' : 'border-keeper-hair bg-white/70'}`}>
            <div className="flex items-baseline justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-dark">{d.k}</span><span className={`${DISPLAY} text-2xl`}>{gbp(d.price)}</span></div>
            <h3 className="mt-3 font-display text-[19px] font-bold leading-snug text-keeper-ink">{d.h}</h3>
            <p className="mt-2 flex-1 text-[14px] leading-relaxed text-keeper-body">{d.p}</p>
            {d.href.startsWith('#')
              ? <a href={d.href} className={`mt-5 inline-flex h-11 items-center justify-center rounded-full text-[14px] font-semibold ${d.hot ? 'bg-keeper-ink text-keeper-paper' : 'border border-keeper-hair bg-white text-keeper-ink'}`}>{d.cta}</a>
              : <Link href={d.href} className={`mt-5 inline-flex h-11 items-center justify-center rounded-full text-[14px] font-semibold ${d.hot ? 'bg-keeper-ink text-keeper-paper' : 'border border-keeper-hair bg-white text-keeper-ink hover:border-brand-dark'}`}>{d.cta}</Link>}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 4. With them in it: the starboy, verbatim ─────────────────────────
function PhotoBridge() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-2 sm:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-dark">With them in it · {gbp(cardPriceGBP('photo'))} · first one's on us</p>
    </div>
  );
}

// ── 5. Trust band (owed) ──────────────────────────────────────────────
function TrustWire() {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <div className="grid gap-3 rounded-2xl border border-dashed border-keeper-hair p-5 text-sm text-keeper-meta md:grid-cols-[auto_1fr_auto] md:items-center">
        <span className={`${DISPLAY} text-2xl text-keeper-ink`}>★ 4.9</span>
        <span>Rated by real senders — number and three quotes land here when we have them. Until then this band is hidden in production.</span>
        <Wire label="reviews" />
      </div>
    </section>
  );
}

export default function LandingThree() {
  useSeo('/lp3');
  return (
    <div className="keeper-serif relative min-h-screen overflow-x-clip">
      <CelebrationBackdrop background="linear-gradient(180deg, #FFFDF9 0%, #FAF8F4 100%)" permanentFade />
      <ShopHeader />
      <main className="space-y-16 pb-24 pt-32 md:space-y-24 md:pt-36">
        <HeroSection />
        <ShelfSection />
        <DepthsSection />
        <div><PhotoBridge /><ProofSection /></div>
        <InsideSection />
        <TrustWire />
        <FaqSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
