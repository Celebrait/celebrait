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

interface FaqEntry {
  q: string;
  a: string;
}

const FAQS: FaqEntry[] = [
  {
    q: 'How does Celebrait work?',
    a: "You describe what you want — recipient, occasion, scene, the small details that make it personal. We illustrate and animate the card in seconds. Free to make, free to keep digital. Pay only if you want to print and post.",
  },
  {
    q: 'Whose words go inside the card?',
    a: "Yours. Always. We just style them in the same look as the front. Or leave the inside blank for handwriting — we'll lay out a beautiful blank page either way.",
  },
  {
    q: "What if I don't like the card we generate?",
    a: 'Regenerate or tweak any part for free until you do — front, inside, scene, style. No card limits while you iterate.',
  },
  {
    q: 'Can I print and post the card?',
    a: "Yes. Premium uncoated 350gsm card, posted in a kraft envelope. £8.99 plus postage, with a free digital version included. Tracked delivery, with overnight available if you order before 2pm.",
  },
  {
    q: 'How fast is delivery?',
    a: 'Standard delivery is 3–5 working days, tracked. Overnight available for £15.99 if you order before 2pm.',
  },
  {
    q: 'What paper do you print on?',
    a: 'Premium uncoated 350gsm — heavier than the supermarket standard, with a soft tactile finish. Archival quality so it keeps its colour for years.',
  },
  {
    q: 'Where do you ship to?',
    a: "United Kingdom today. We're working on the rest of Europe, South Africa, and the US — sign up and we'll let you know when your country is live.",
  },
  {
    q: 'How do reminders work?',
    a: "Add the people who matter to your address book once, with their birthdays, anniversaries and any other occasions. We'll email you 21, 7 and 3 days ahead so you never miss a date — and if you've left it late, order before 2pm for next-day delivery.",
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

export function FaqSection() {
  return (
    <section id="faq" className="relative py-24 md:py-32">
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
            href="mailto:hello@celebrait.co.uk"
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
