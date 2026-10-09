// client/src/components/landing/faq-section.tsx
//
// Frequently-asked-questions accordion. Uses the Radix accordion
// primitive already wrapped in the shadcn ui/accordion.tsx wrapper.
// Copy is placeholder — Kevin to revise per his voice. Ten Q&As cover
// the most-likely pre-signup objections; ranked highest-impact first.

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { SUPPORT_EMAIL } from '@/lib/legal';
import { useRackEnabled } from '@/hooks/use-rack';
import {
  cardPriceGBP,
  firstOrderPriceGBP,
  UK_SHIPPING_STANDARD_GBP,
  HONEST_LEAD_LINE,
} from '@shared/pricing';

const gbp = (pence: number) => `£${(pence / 100).toFixed(2)}`;

interface FaqEntry {
  q: string;
  a: string;
}

// The photo door's answers (/photo).
// A function of the rack switch: the £4.99 rung only while stock cards sell.
const photoFaqs = (rack: boolean): FaqEntry[] => [
  {
    q: 'How does Celebrait work?',
    a: "You describe what you want — recipient, occasion, scene, the small details that make it personal. We write and illustrate it in minutes — about 3–5 for a made-for-them card, 7–10 from a photo. Free to make, free to keep digital. Pay only if you want to print and post.",
  },
  {
    q: 'Whose words go inside the card?',
    a: "Yours. Always. We just style them in the same look as the front. Or leave the inside blank for handwriting — we'll lay out a beautiful blank page either way.",
  },
  {
    q: "What if I don't like the card we generate?",
    a: "Start again with the same details for a brand-new take — free, as many times as you need before you buy. Every draft is kept, so you can compare and send the one you love.",
  },
  {
    q: 'Can I print and post the card?',
    a: `Yes. A 280gsm gloss-coated card, HP Indigo digital print, posted in a kraft envelope. From ${gbp(cardPriceGBP(rack ? 'rack' : 'maker'))} plus postage (${rack ? `${gbp(cardPriceGBP('rack'))} off the shelf, ` : ''}${gbp(cardPriceGBP('maker'))} made for them, ${gbp(cardPriceGBP('photo'))} from your photo), with a free digital version included. Our cards are one-off prints — please allow at least a week from order to arrival.`,
  },
  {
    q: 'How fast is delivery?',
    a: 'Our cards are one-off prints — please allow at least a week from order to arrival. Right now they\'re printed to order by a partner printer, which takes up to three working days, then posted Royal Mail 24, tracked (£2.95), usually the next working day. At checkout you can tell us the date and we\'ll say straight away whether it\'ll make it. The free digital link arrives instantly either way.',
  },
  {
    q: 'What paper do you print on?',
    a: '280gsm gloss-coated art card, printed on an HP Indigo press for crisp, vivid colour. Sustainably sourced, vegan-friendly, plastic-free and recyclable — right down to the packaging.',
  },
  {
    q: 'Where do you ship to?',
    a: "United Kingdom today. We're working on the rest of Europe, South Africa, and the US — sign up and we'll let you know when your country is live.",
  },
  {
    q: 'How do reminders work?',
    a: "Add the people who matter to your address book once, with their birthdays, anniversaries and any other occasions. We'll email you three weeks, ten days and a week ahead — the last one is the last safe day to order, because every card is printed to order by our partner printer, then posted. Too late for this one? Add the date now and next year we'll remind you in good time.",
  },
  {
    q: 'Does my card come with a digital version?',
    a: "Yes — every printed Celebrait includes a free private link to share too. Recipients open it in any browser (no app, no signup), watch the envelope animate open, and can replay it forever.",
  },
  {
    q: 'Is my photo private?',
    a: "Yes. Photos you upload are used only for your card. We never share them, never sell them, and never train models on them. You can delete any photo from your account at any time.",
  },
];

// The three-card door's answers (/create, 2026-10-09). Shorter list: the
// visitor has just seen the six questions and the rack, so these are the
// objections left standing. Prices and the lead-time line come from
// shared/pricing so they cannot drift from the bill or the banner.
const MAKER_FAQS: FaqEntry[] = [
  {
    q: 'How does it work?',
    a: "Six quick questions — who it's for, the occasion, what they're like. From your answers we write and draw three cards, in under a minute. Pick the one that's them. Keep our words inside, change them, or leave it blank to handwrite. Then it's printed and posted, or shared as a free digital link.",
  },
  {
    q: "What if I don't like any of the three?",
    a: "Deal again — another three is free. Change a detail first if something was off (the occasion, the in-joke, the tone) and the next three will follow it. There's nothing to pay until you print one.",
  },
  {
    q: 'Can I put their photo in?',
    a: "Yes, once you've picked a card. It's optional: one clear photo of them, and we check it's usable before we start. If it isn't, we'll say so and tell you what would work better.",
  },
  {
    q: 'Can I change the message inside?',
    a: "Yes. Ours is a starting point — change a word, rewrite the lot, or start from blank. Or leave the inside blank and we'll post the card to you to handwrite.",
  },
  {
    q: 'What does it cost?',
    a: `${gbp(cardPriceGBP('maker'))} a card, plus ${gbp(UK_SHIPPING_STANDARD_GBP)} postage, with a free digital link to share included. Tell us three dates that matter and your first card is half price — ${gbp(firstOrderPriceGBP('maker'))}. Making and previewing is free; you only pay when you print one.`,
  },
  {
    q: 'How long does delivery take?',
    a: `${HONEST_LEAD_LINE} Right now they're printed to order by a partner printer, which takes up to three working days, then posted Royal Mail 24, tracked (${gbp(UK_SHIPPING_STANDARD_GBP)}), usually the next working day. At checkout you can tell us the date and we'll say straight away whether it'll make it. The free digital link arrives instantly either way.`,
  },
];

/** `door` picks the answer set: the photo door's ten (default, /photo) or
 *  the three-card door's six (/create). Same chrome either way. */
export function FaqSection({ door = 'photo' }: { door?: 'photo' | 'maker' } = {}) {
  const rack = useRackEnabled() === true;
  const FAQS = door === 'maker' ? MAKER_FAQS : photoFaqs(rack);
  return (
    <section id="faq" className="snap-center relative scroll-mt-32 py-24 md:py-32">
      {/* FAQPage structured data — generated FROM the visible FAQS array
          so it can never drift from what's on screen (Google requires
          schema content to match visible content). Rendered client-side;
          Google's crawler executes JS and reads injected JSON-LD. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: FAQS.map((f) => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }),
        }}
      />
      <div className="max-w-3xl mx-auto px-6 md:px-10">
        <div className="text-center mb-12 md:mb-16">
          <p className="text-[11px] uppercase tracking-[0.22em] text-accent-coral-dark font-semibold mb-4">
            FAQ
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold text-ink tracking-tight">
            The questions we hear most.
          </h2>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {FAQS.map((faq, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="border-b border-stone-200"
            >
              <AccordionTrigger className="text-left text-base md:text-lg font-semibold text-ink hover:no-underline py-5 hover:text-brand transition-colors">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-base text-ink-soft leading-relaxed pb-5 pr-4">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        <p className="text-center text-sm text-ink-soft mt-12">
          Still wondering?{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-brand hover:text-brand-dark font-medium"
          >
            Drop us a line
          </a>
          .
        </p>
      </div>
    </section>
  );
}
