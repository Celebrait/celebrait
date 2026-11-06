// client/src/components/landing/inside-section.tsx — THE PRINT STATEMENT
//
// "The magic's digital. The card isn't." This section's job is the one
// thing the landing pages never say outright: the digital process ends
// as a PHYSICAL object (the visual beside it is a real card on a table).
//
// ONE pair — the same card shot closed (front) and open (inside). The pair
// IS the argument the copy makes, "a front and an inside that belong
// together", so the two photos always travel together; but one example is
// enough to make it (Kevin 2026-07-17 — the carousel here is gone, and with
// it the 4 extra lifestyle shots it would have needed).
//
// Extracted from landing-keeper.tsx 2026-10-09 so /create can carry it
// too. Door-agnostic copy (a prompt, an image, a card — true of both
// doors), so no `door` prop.

import { useReducedMotion } from 'framer-motion';
import { Rise } from '@/components/landing/rise';
import { ShimmerWord } from '@/components/landing/shimmer-word';
import { DISPLAY } from '@/pages/doorway';

// Panel C lifestyle shots — same scene, front card + open card.
const keeperCardClosed = '/keeper-card-closed.webp';
const keeperCardOpen = '/keeper-card-open.webp';

/** Two lifestyle photos — the front card and the open inside — sat
 *  straight, close but NOT overlapping (Kevin 2026-07-11). Stacked and
 *  staggered off-centre at every width: first hugs left, second hugs
 *  right, so it reads casual rather than dead-centred. */
function CardPair({
  first,
  second,
  alt,
}: {
  first: string;
  second: string;
  alt: string;
}) {
  // Corner radius matches the 3D card's, so the photographed card and the
  // rendered one read as the same object (Kevin 2026-07-14). The viewer
  // rounds by CARD_CORNER/CARD_W = 0.025/1.45 ≈ 1.7% of the card's width;
  // at the hero's ~433px on-screen card that's ~7.5px, and 1.7% of these
  // ~490px images is ~8.4px — so 8px lands on both the absolute and the
  // proportional match. (Was rounded-2xl = 16px: twice as round.)
  const img =
    'w-[92%] sm:w-[55%] rounded-[8px] shadow-[0_18px_42px_-22px_rgba(33,29,25,0.42)] ring-1 ring-black/5';
  // width/height are the INTRINSIC pixels (all proof art is square
  // 900×900), not a display size — the CSS width still governs. They
  // exist so the browser reserves the right box before the bytes land.
  // Without them these two auto-height images popped in one after the
  // other and shoved the section around as they decoded: the exact
  // "staggering, looks cheap" Kevin called out (2026-07-29).
  return (
    <div className="flex flex-col gap-5">
      <img
        src={first}
        alt=""
        loading="lazy"
        decoding="async"
        width={900}
        height={900}
        className={`${img} self-start`}
      />
      <img
        src={second}
        alt={alt}
        loading="lazy"
        decoding="async"
        width={900}
        height={900}
        className={`${img} self-end`}
      />
    </div>
  );
}

export function InsideSection() {
  const reduced = useReducedMotion();

  return (
    <section className="px-6 py-24 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[0.85fr_1.15fr] md:gap-16">
        <Rise>
          {/* NB: this copy originally held BACK on the bin/keep beat because
              StatementSection ("This is the unbinnable kind") landed it right
              below. That section is gone (2026-07-17), so nothing on the page
              carries that punch now except the hero eyebrow — if it's ever
              wanted back, here is where it belongs.
              NB2: the old "in the card's own hand" implied handwriting; the
              inside is SET TYPE (see project_inside_message_is_typography). */}
          <h2 className={`text-[clamp(30px,4.4vw,44px)] leading-[1.08] [text-wrap:balance] ${DISPLAY}`}>
            The <ShimmerWord reduced={!!reduced}>magic's</ShimmerWord> digital. The card isn't.
          </h2>
          {/* NB: kraft is the ENVELOPE, not the card — the card is a 280gsm
              gloss-coated art card (HP Indigo). See faq-section, pricing.tsx,
              checkout.tsx, shared/pricing.ts. Don't describe the stock as
              kraft: it's brown and uncoated, and the gloss is exactly what
              makes the artwork print vividly. */}
          <p className="mt-4 max-w-[46ch] text-[17px] leading-[1.6] text-keeper-body">
            It's 2026, anyone can write a prompt and conjure up an image.
            But a custom greetings card with a front and inside that belong
            together, pressed onto 280gsm
            gloss and posted to someone you care about.{' '}
            <strong className="font-semibold">
              <ShimmerWord reduced={!!reduced}>That's Celebrait</ShimmerWord>.
            </strong>{' '}
            Thoughtful, funny, gloriously daft: that's you.
          </p>
        </Rise>
        <Rise delay={0.1}>
          <CardPair
            first={keeperCardClosed}
            second={keeperCardOpen}
            alt="A Celebrait card held open on a table, showing the inside message and the front"
          />
        </Rise>
      </div>
    </section>
  );
}
