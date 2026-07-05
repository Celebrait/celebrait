// client/src/pages/landing-keeper.tsx (PREVIEW at /keeper)
//
// Becomes the live landing once the 13 asset slots hold real imagery.
// Kevin's verdict on the empty skeleton: "kinda poor" — the judge's
// predicted failure mode for placeholders in a proof-driven layout.
// The previous landing is restored on / meanwhile.
//
// THE KEEPER — the landing page as a warm-paper gallery (rebuilt
// 2026-07-04 from the 10-agent panel blueprint; full spec in memory
// next_lp_keeper_blueprint.md + the published artifact).
//
// Big idea: stop describing magic; hang it on a wall. Finished cards —
// real faces, real scenes — are the ONLY colour and the ONLY
// decoration. Every screen makes exactly one claim and proves it with
// one image.
//
// DESIGN LAWS (no exceptions — the page is a coherence machine):
//   • Palette: keeper.* gallery neutrals + ONE marigold accent.
//   • One typeface (Inter), three sizes only: display
//     clamp(44–76px)/600/-0.03em · body 17px/1.6 · labels 11px caps.
//   • Motion budget: ONE animated element per viewport; after its
//     entrance everything is static. The page's single signature move
//     is the hero snapshot→card crossfade (once assets land). No
//     loops, no idle rotation, NO SCROLL-SNAP (deleted — the CSS
//     re-invention of twice-rejected scroll-jacking).
//   • Zero "coming soon": build steps, chat mock, demo video, blog
//     teasers, emoji backdrop all unmounted (files kept on disk).
//   • One WebGL context, lazy: three.js leaves the eager bundle; the
//     3D card mounts near-view only, in section 6.
//
// ASSET SLOTS (Kevin generates in the Studio with consented photos —
// tags match the blueprint): A hero card + A2 source snapshot ·
// B proof card + B2 snapshot · D1–D6 gallery · E print macro photo
// (needs the paid Prodigi test print). Swap <AssetSlot> → <img> as
// each lands. The structure promises proof everywhere, so DON'T ship
// this page to real traffic until A/A2/B/B2/D1–6 are real.

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/hooks/use-auth';
import { useAuthModal } from '@/components/auth/auth-modal';
import { MarketingHeader } from '@/components/landing/marketing-header';
import { MarketingFooter } from '@/components/landing/marketing-footer';
import { FaqSection } from '@/components/landing/faq-section';
import { GestureHints } from '@/components/gesture-hints';
import heroCardFront from '@/assets/hero-card-front.jpg';
import heroCardInside from '@/assets/hero-card-inside.jpg';

// three.js stays OUT of the eager landing bundle (mobile audit: 1.4MB
// raw in the critical path). Loaded only when section 6 nears view.
const Card3DViewer = lazy(() =>
  import('@/components/card-3d-viewer').then((m) => ({ default: m.Card3DViewer })),
);

// ── Shared bits ──────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;

/** Entrance-only fade — the ONLY motion pattern outside the hero. */
function Rise({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/** Tagged placeholder for a not-yet-generated asset. Swap for <img>
 *  as Kevin's Studio-generated assets land. Deliberately looks like a
 *  labelled frame, not a broken image. */
function AssetSlot({
  tag,
  note,
  ratio,
  className,
}: {
  tag: string;
  note: string;
  ratio: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-[1.5px] border-dashed border-keeper-hair bg-white/60 p-4 text-center ${className ?? ''}`}
      style={{ aspectRatio: ratio }}
    >
      <span className="rounded bg-keeper-gold-wash px-2 py-0.5 font-mono text-[11px] font-semibold text-keeper-gold">
        {tag}
      </span>
      <span className="max-w-[26ch] text-[11.5px] leading-snug text-keeper-stone">{note}</span>
    </div>
  );
}

/** One CTA to rule them all. */
function PrimaryCta({ large = false }: { large?: boolean }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const authed = !isLoading && isAuthenticated;
  const cls = `inline-flex items-center justify-center rounded-full bg-keeper-ink font-semibold text-keeper-paper transition-colors hover:bg-black ${
    large ? 'px-9 py-4 text-base' : 'px-7 py-3 text-[15px]'
  }`;
  return authed ? (
    <Link href="/studio/new-card" className={cls} data-testid="keeper-cta">
      Make a card — it's free
    </Link>
  ) : (
    <button type="button" onClick={() => openAuth('/studio/new-card')} className={cls} data-testid="keeper-cta">
      Make a card — it's free
    </button>
  );
}

const TRUST_CHIPS = [
  'Regenerate free until you love it',
  '280gsm · kraft envelope · printed in the UK',
  'Your photos stay private — never used to train AI',
];

function TrustChips({ center = false }: { center?: boolean }) {
  return (
    <div className={`mt-5 flex flex-wrap gap-2 ${center ? 'justify-center' : ''}`}>
      {TRUST_CHIPS.map((c) => (
        <span
          key={c}
          className="rounded-full border border-keeper-hair bg-white/70 px-3 py-1 text-[11px] text-keeper-stone"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

// ── 1. HERO — The Transformation ─────────────────────────────────────

const PERSONAS = ['your mum', 'your best mate', 'the birthday girl', 'grandad'];

function HeroSection() {
  const reduced = useReducedMotion();
  const [persona, setPersona] = useState(0);
  const [visible, setVisible] = useState(true);
  const sectionRef = useRef<HTMLElement>(null);

  // Rotating persona word — 3.5s crossfade timer, paused when the hero
  // is off-screen, static under prefers-reduced-motion. This + the
  // (future) snapshot→card crossfade are the hero's ONE motion moment.
  useEffect(() => {
    if (reduced) return;
    const el = sectionRef.current;
    if (!el) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && timer === undefined) {
          timer = window.setInterval(() => {
            setVisible(false);
            window.setTimeout(() => {
              setPersona((p) => (p + 1) % PERSONAS.length);
              setVisible(true);
            }, 260);
          }, 3500);
        } else if (!e.isIntersecting && timer !== undefined) {
          window.clearInterval(timer);
          timer = undefined;
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [reduced]);

  return (
    <section ref={sectionRef} className="px-6 pb-20 pt-28 md:pt-36 md:pb-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.1fr_0.9fr] md:gap-16">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-keeper-gold">
            Personalised printed cards
          </p>
          <h1 className="mt-4 text-[clamp(44px,7vw,76px)] font-semibold leading-[1.02] tracking-[-0.03em] text-keeper-ink [text-wrap:balance]">
            Put{' '}
            <span
              className="text-keeper-gold transition-opacity duration-300"
              style={{ opacity: visible ? 1 : 0 }}
            >
              {PERSONAS[persona]}
            </span>
            <br />
            in the picture.
          </h1>
          <p className="mt-6 max-w-[46ch] text-[17px] leading-[1.6] text-keeper-stone">
            Upload a photo. Celebrait paints the person you love into their own
            scene — on a real printed card they'll keep. £8.99 posted, free
            digital link included.
          </p>
          <div className="mt-8">
            <PrimaryCta large />
            <p className="mt-3 text-[12px] text-keeper-stone">
              Free to make. No payment details needed.
            </p>
          </div>
          <TrustChips />
        </div>

        {/* The money shot: finished card with the source snapshot
            "paperclipped" to its corner. When A/A2 land, the snapshot
            crossfades once into the card art on load — the page's
            signature motion. Until then: labelled slots. */}
        <Rise className="relative">
          <AssetSlot
            tag="A"
            ratio="4/5"
            note="Finished card front — a recognisable face mid-scene (grandad on a fishing boat, golden hour)"
            className="shadow-[0_28px_60px_-24px_rgba(33,29,25,0.25)]"
          />
          <div className="absolute -left-3 -top-3 w-[34%] -rotate-6">
            <AssetSlot tag="A2" ratio="3/4" note="Source snapshot — same person" className="bg-white" />
          </div>
        </Rise>
      </div>
    </section>
  );
}

// In-flow value strip — the honest 72h line, scrolls away with the
// page (replaces the fixed PromoStrip chrome).
function ValueStrip() {
  return (
    <div className="border-y border-keeper-hair bg-white/50">
      <p className="mx-auto max-w-6xl px-6 py-3 text-center text-[12.5px] text-keeper-stone">
        Every card is printed to order, just for them — allow up to 72 hrs, then
        posted. £8.99 + delivery.
      </p>
    </div>
  );
}

// ── 2. PROOF — One photo. One line. ──────────────────────────────────

function ProofSection() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-4xl text-center">
        <Rise>
          <h2 className="text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.06] tracking-[-0.03em] text-keeper-ink [text-wrap:balance]">
            One photo. One line. That's all we need.
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[17px] leading-[1.6] text-keeper-stone">
            You give us a snapshot and a sentence. We paint the moment. Don't
            love it? Regenerate free until you do.
          </p>
        </Rise>
        <Rise delay={0.1} className="mt-12 flex flex-col items-center justify-center gap-6 sm:flex-row">
          <AssetSlot tag="B2" ratio="3/4" note="Source snapshot" className="w-36" />
          <p className="max-w-[22ch] font-mono text-[13px] leading-relaxed text-keeper-stone">
            “Mum, 60, on the Plett cliffs with her labrador” →
          </p>
          <AssetSlot
            tag="B"
            ratio="4/5"
            note="The card that exact sentence produced (generate it for real — setup must equal payoff)"
            className="w-56"
          />
        </Rise>
      </div>
    </section>
  );
}

// ── 2b. THE INSIDE — the second half of the USP ──────────────────────
// Most cards are blank or plain-type inside; Celebrait paints the
// message in the front's own style. One claim, one provable image
// (Kevin 2026-07-04: "a big USP is the fact the inside is custom text
// with artwork styled to match the front").

function InsideSection() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[0.85fr_1.15fr] md:gap-16">
        <Rise>
          <h2 className="text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.06] tracking-[-0.03em] text-keeper-ink [text-wrap:balance]">
            Your words, in the card's own hand.
          </h2>
          <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.6] text-keeper-stone">
            Tell us what to write and we set it inside — lettering and artwork
            styled to match the front, same palette, same brush. Or leave it
            blank and write it yourself.
          </p>
        </Rise>
        <Rise delay={0.1}>
          <AssetSlot
            tag="C"
            ratio="2/1"
            note="Open card spread — the inside message in matching typography + artwork (compose from a real Studio inside render; left panel blank for handwriting)"
          />
        </Rise>
      </div>
    </section>
  );
}

// ── 3. STATEMENT — The pause ─────────────────────────────────────────

function StatementSection() {
  return (
    <section className="flex min-h-[70vh] items-center justify-center px-6">
      <Rise className="text-center">
        <h2 className="text-[clamp(38px,6vw,64px)] font-semibold leading-[1.05] tracking-[-0.03em] text-keeper-ink [text-wrap:balance]">
          Everyone gets cards.
          <br />
          Nobody <em className="font-normal italic">gets</em> them.
        </h2>
        <p className="mt-5 text-[15px] text-keeper-stone">This is the unbinnable kind.</p>
      </Rise>
    </section>
  );
}

// ── 4. RANGE — The gallery wall ──────────────────────────────────────

const GALLERY: Array<{ tag: string; what: string; brief: string }> = [
  { tag: 'D1', what: "Kid's birthday", brief: '“Leo, 7, dinosaur mad”' },
  { tag: 'D2', what: 'Anniversary', brief: '“25 years since Positano”' },
  { tag: 'D3', what: 'New baby', brief: '“Welcome, little Ada”' },
  { tag: 'D4', what: 'Graduation', brief: '“Dr. Patel, at last”' },
  { tag: 'D5', what: "Father's Day", brief: '“Dad, 60, mad about fishing”' },
  { tag: 'D6', what: 'Retirement', brief: '“36 years of Mrs. H”' },
];

function GallerySection() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Rise className="text-center">
          <h2 className="text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.06] tracking-[-0.03em] text-keeper-ink">
            Any face. Any occasion.
          </h2>
          <p className="mt-3 text-[15px] text-keeper-stone">
            Made in the Studio this month — each from one photo and one line.
          </p>
        </Rise>
        <div className="mt-12 grid grid-cols-2 gap-5 md:grid-cols-3 md:gap-7">
          {GALLERY.map((g, i) => (
            <Rise key={g.tag} delay={i * 0.08}>
              <AssetSlot tag={g.tag} ratio="4/5" note={g.what} />
              <div className="mt-2 flex items-center gap-2">
                {/* Source-photo thumbnail (graft #5): provenance you can
                    see — six mini before/afters. */}
                <span className="h-6 w-6 shrink-0 rounded-full border border-dashed border-keeper-hair bg-white/60" />
                <span className="text-[12px] text-keeper-stone">{g.brief}</span>
              </div>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 5. THE OBJECT — Paper you can feel ───────────────────────────────

function ObjectSection() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[1.15fr_0.85fr] md:gap-16">
        <Rise>
          <AssetSlot
            tag="E"
            ratio="3/2"
            note="Macro photo — hands holding the printed card, gloss catching light, the face visible. Shot from the real Prodigi test print."
          />
        </Rise>
        <Rise delay={0.1}>
          <h2 className="text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.06] tracking-[-0.03em] text-keeper-ink">
            Made to be kept.
          </h2>
          <ul className="mt-6 space-y-2 text-[16px] text-keeper-ink">
            <li>✓ 280gsm gloss art card, HP Indigo press</li>
            <li>✓ Kraft envelope, recyclable materials</li>
            <li>✓ Printed in the UK</li>
          </ul>
          <p className="mt-6 border-l-2 border-keeper-hair pl-4 text-[13.5px] leading-relaxed text-keeper-stone">
            Every card is printed to order, just for them — allow up to 72
            hours, then it's in the post. Standard £1.95 (Royal Mail 24) ·
            Express £5.95 · Overnight £10.95.
          </p>
          <p className="mt-4 font-mono text-[12px] text-keeper-stone">
            Today you make it → within 72 hrs it's printed → then posted from £1.95
          </p>
          {/* Delivery, your way — direct or hand-it-over (DIR vs BLA;
              Kevin: "the user can choose to deliver direct to recipient
              OR to them to hand over"). Quiet row, not a new screen. */}
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-keeper-hair bg-white/70 p-4">
              <p className="text-[13px] font-semibold text-keeper-ink">Straight to them</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-keeper-stone">
                Posted tracked in a kraft envelope, your message printed inside.
              </p>
            </div>
            <div className="rounded-xl border border-keeper-hair bg-white/70 p-4">
              <p className="text-[13px] font-semibold text-keeper-ink">Or to you first</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-keeper-stone">
                Sealed with a spare envelope, ready to hand over in person.
              </p>
            </div>
          </div>
        </Rise>
      </div>
    </section>
  );
}

// ── 6. THE FREE PART — the one earned WebGL moment ───────────────────

function FreePartSection() {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);

  // Lazy-mount the 3D card (and three.js itself) only when the section
  // is within ~1 viewport. Flat card image is the instant stand-in.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: '100% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const flatFallback = (
    <img
      src={heroCardFront}
      alt="Celebrait card"
      className="mx-auto h-full w-auto rounded-2xl object-cover shadow-[0_28px_60px_-24px_rgba(33,29,25,0.3)]"
    />
  );

  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-4xl text-center">
        <Rise>
          <h2 className="text-[clamp(30px,4.4vw,44px)] font-semibold leading-[1.06] tracking-[-0.03em] text-keeper-ink [text-wrap:balance]">
            And this comes free with every card.
          </h2>
          <p className="mx-auto mt-4 max-w-[52ch] text-[17px] leading-[1.6] text-keeper-stone">
            A link they can open in any browser — the same card, in 3D, no app.
            Send it the moment you order, while the real one's in the post.
          </p>
        </Rise>
        <div ref={ref} className="relative mx-auto mt-10 h-[52vh] min-h-[380px] max-w-2xl">
          {near && !reduced ? (
            <Suspense fallback={flatFallback}>
              <div className="absolute inset-x-[-14vw] inset-y-[-8vh]">
                <Card3DViewer
                  frontImageUrl={heroCardFront}
                  insideImageUrl={heroCardInside}
                  open={cardOpen}
                  onOpenChange={setCardOpen}
                  enableRotate={false}
                  enableZoom={false}
                  framingMargin={1.7}
                  minDistance={1.6}
                  dprMax={1.5}
                  closedAngle={-0.3}
                  restYaw={-0.1}
                  className="h-full w-full"
                />
              </div>
            </Suspense>
          ) : (
            flatFallback
          )}
        </div>
        <div className="mt-3 flex h-14 items-start justify-center">
          {near && !reduced && <GestureHints open={cardOpen} hideZoomHint hideRotateHint />}
        </div>
      </div>

      {/* Slim reminders beat (graft #7) — the retention hook. */}
      <Rise className="mx-auto mt-16 max-w-3xl text-center">
        <div className="flex justify-center gap-2">
          {['21 days', '7 days', '3 days'].map((d) => (
            <span
              key={d}
              className="rounded-full border border-keeper-hair bg-white/70 px-4 py-1.5 font-mono text-[12px] text-keeper-ink"
            >
              {d}
            </span>
          ))}
        </div>
        <p className="mt-4 text-[15px] text-keeper-stone">
          Add their birthday once. We'll remember, so you're never the one who
          forgot.
        </p>
      </Rise>
    </section>
  );
}

// ── 7. PRICE — one number ────────────────────────────────────────────

function PriceSection() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto max-w-3xl text-center">
        <Rise>
          <div className="text-[clamp(56px,9vw,96px)] font-semibold tracking-[-0.03em] text-keeper-ink">
            £8.99
          </div>
          <p className="mx-auto mt-3 max-w-[56ch] text-[17px] leading-[1.6] text-keeper-stone">
            Printed, posted, and free to share. Make and preview unlimited
            cards free — pay only when you post one. Postage from £1.95 ·
            printed to order, allow up to 72 hours.
          </p>
          <div className="mt-8">
            <PrimaryCta large />
          </div>
          <TrustChips center />
        </Rise>
      </div>
    </section>
  );
}

// ── 8. FINALE — wordmark band ────────────────────────────────────────

function FinaleSection() {
  return (
    <section className="bg-keeper-ink px-6 py-20 text-center md:py-28">
      <Rise>
        <p className="text-[17px] text-keeper-paper/80">
          You bring the person. We paint the moment.
        </p>
        <div className="mt-6 text-[clamp(56px,12vw,140px)] font-semibold leading-none tracking-[-0.03em] text-keeper-paper">
          Celebrait
        </div>
        <div className="mt-10">
          <PrimaryCtaInverted />
        </div>
        <p className="mt-4 text-[12.5px] text-keeper-paper/60">
          Free to make. £8.99 to print and post. We'll even remind you before
          the next birthday.
        </p>
      </Rise>
    </section>
  );
}

function PrimaryCtaInverted() {
  const { isAuthenticated, isLoading } = useAuth();
  const { openAuth } = useAuthModal();
  const authed = !isLoading && isAuthenticated;
  const cls =
    'inline-flex items-center justify-center rounded-full bg-keeper-paper px-9 py-4 text-base font-semibold text-keeper-ink transition-colors hover:bg-white';
  return authed ? (
    <Link href="/studio/new-card" className={cls}>
      Make a card — it's free
    </Link>
  ) : (
    <button type="button" onClick={() => openAuth('/studio/new-card')} className={cls}>
      Make a card — it's free
    </button>
  );
}

// ── Floating CTA pill (graft #3) — appears after the hero ────────────

function FloatingPill() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      // Visible after ~1 viewport, retires near the finale band (the
      // last 1.5 viewports) where the big inverted CTA takes over.
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setShow(y > window.innerHeight * 0.9 && y < max - window.innerHeight * 1.5);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <div
      className="fixed bottom-6 right-6 z-40 transition-all duration-300"
      style={{
        opacity: show ? 1 : 0,
        transform: show ? 'translateY(0)' : 'translateY(12px)',
        pointerEvents: show ? 'auto' : 'none',
      }}
    >
      <PrimaryCta />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function Landing() {
  return (
    <div className="relative min-h-screen bg-keeper-paper">
      <MarketingHeader />
      <main className="pt-20">
        <HeroSection />
        <ValueStrip />
        <ProofSection />
        <InsideSection />
        <StatementSection />
        <GallerySection />
        <ObjectSection />
        <FreePartSection />
        <PriceSection />
        <FaqSection />
        <FinaleSection />
      </main>
      <MarketingFooter />
      <FloatingPill />
    </div>
  );
}
