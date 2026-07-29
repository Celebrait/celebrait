// client/src/pages/blog-content.tsx
//
// The blog post BODIES, keyed by slug. Metadata (titles, descriptions,
// dates) lives in shared/seo.ts so the server can inject it without
// importing JSX. Voice rules: warm, wry, UK, honest — every factual
// claim (£8.99, 72h production, postage tiers, 280gsm, UK-only,
// photo-privacy) must match the product. No invented stats, no fake
// urgency. Each post earns its keep with real advice, then ends with
// ONE clear CTA.
import { Link } from 'wouter';
import type { ReactNode } from 'react';

const P = ({ children }: { children: ReactNode }) => (
  <p className="mt-5 text-[17px] leading-[1.75] text-keeper-body">{children}</p>
);
const H2 = ({ children }: { children: ReactNode }) => (
  <h2 className="mt-10 font-display text-2xl font-semibold tracking-tight text-keeper-ink md:text-3xl">
    {children}
  </h2>
);
const LI = ({ children }: { children: ReactNode }) => (
  <li className="mt-3 text-[17px] leading-[1.7] text-keeper-body">{children}</li>
);
const Strong = ({ children }: { children: ReactNode }) => (
  <span className="font-medium text-keeper-ink">{children}</span>
);

/** The one-per-post CTA block. */
function Cta({ line }: { line: string }) {
  return (
    <div className="mt-12 rounded-2xl border border-keeper-hair bg-white p-6 text-center shadow-sm">
      <p className="font-display text-xl font-semibold text-keeper-ink">{line}</p>
      <p className="mt-2 text-sm text-keeper-meta">
        Free to make — you only pay if you print &amp; post. £8.99 + postage.
      </p>
      <Link
        href="/studio/new-card"
        className="mt-4 inline-flex items-center justify-center rounded-full bg-go px-6 py-3 text-[15px] font-semibold text-go-foreground transition-colors hover:bg-go-hover"
      >
        Make a card — it's free
      </Link>
    </div>
  );
}

export const BLOG_BODIES: Record<string, ReactNode> = {
  // ── 1 · the intent keyword ─────────────────────────────────────────
  'how-to-turn-a-photo-into-a-greeting-card': (
    <>
      <P>
        There are two ways to turn a photo into a greeting card. The one
        you've seen — upload a photo, it gets dropped into a template with a
        border and some Comic Sans-adjacent lettering — and the one where the
        person in your photo <Strong>becomes the artwork itself</Strong>:
        illustrated into a scene you chose, on the front of a card that
        doesn't look like it took ninety seconds. This guide is about the
        second kind, because the first kind ends up in the bin with all the
        others.
      </P>

      <H2>Step 1: pick a photo (an ordinary one is fine)</H2>
      <P>
        You don't need a professional shot. A phone photo from the pub, a
        slightly chaotic holiday selfie, the one where your mum's mid-laugh —
        these work <Strong>better</Strong> than posed portraits, because the
        card keeps their real expression and the person receiving it
        recognises themselves instantly. The only real rules: their face
        should be clearly visible, in focus, and reasonably front-on. And it
        should be a photo you have the right to use — ideally yours, of
        someone who'd be delighted, not horrified.
      </P>

      <H2>Step 2: decide the scene — this is the whole trick</H2>
      <P>
        This is where a photo card becomes a keepsake. Instead of "photo in a
        frame with balloons", you describe where they should be:{' '}
        <Strong>abseiling off Big Ben. Under the Northern Lights. On a New
        York rooftop at sunset.</Strong> The scene is the gift — it says{' '}
        <em>I thought about you specifically</em>, which is the one thing a
        supermarket card can never say. Match it to the person: a dream
        destination, a running joke, the thing they always said they'd do.
      </P>

      <H2>Step 3: the words inside</H2>
      <P>
        A soppy essay or a one-liner — both legal. The trick most people
        miss: the inside can carry the <Strong>payload</Strong>. "Happy
        anniversary" is fine; "Pack a bag — we're going to New York" is a
        moment. If the card is announcing something, let the inside do the
        announcing.
      </P>

      <H2>Step 4: print it — actually print it</H2>
      <P>
        A digital card is a message. A printed one is an object — it goes on
        the mantelpiece, the fridge, the shelf of things that survived a house
        move. Look for proper card stock (ours is{' '}
        <Strong>280gsm gloss-coated</Strong>, printed to order in the UK) and
        honest delivery expectations: printed-to-order takes a day or three —
        anyone promising a personalised printed card "tomorrow" is cutting a
        corner somewhere.
      </P>

      <H2>What it costs</H2>
      <P>
        With Celebrait, designing is free — you can re-roll the artwork as
        many times as you like before buying. A printed card is{' '}
        <Strong>£8.99 plus postage (from £3.95)</Strong>, posted anywhere in
        the UK, straight to them or to you to hand over. A free digital
        version is included with every printed card.
      </P>

      <Cta line="Got a photo in mind already?" />
    </>
  ),

  // ── 2 · the AI keyword, handled honestly ───────────────────────────
  'ai-generated-greeting-cards': (
    <>
      <P>
        "AI-generated greeting card" can mean two very different things, and
        one of them deserves its reputation. This is an honest guide from
        people who make them — including the question everyone actually wants
        to ask, which is whether sending one makes you lazy.
      </P>

      <H2>What an AI greeting card actually is</H2>
      <P>
        The bad version: a machine writes a generic poem and slaps it on
        clip-art. Nobody's nan wants that. The good version:{' '}
        <Strong>you provide the thinking</Strong> — the photo of someone you
        love, the scene that means something, your own words — and the AI
        provides the <em>craft</em>: illustrating that person into that scene
        with a skill most of us don't have. Think of it as commissioning an
        artist with a very fast turnaround, not outsourcing the sentiment.
      </P>

      <H2>"Isn't it a bit soulless?"</H2>
      <P>
        Fair question. Here's the test: could the card have been sent to
        anyone else? A supermarket card with a pun about wine could go to
        literally any adult in Britain — that's soulless, and a human
        designed it. A card where <Strong>your mum is the painting</Strong>,
        standing under the Northern Lights because she's always wanted to see
        them, with your words inside, could only ever have gone to her. The
        soul isn't in who held the paintbrush. It's in who did the thinking.
      </P>

      <H2>What to look for (and what to avoid)</H2>
      <ul className="mt-5 list-disc pl-6">
        <LI>
          <Strong>Likeness that holds up.</Strong> The person should be
          recognisably themselves — not a stranger with similar hair. Look
          for real before/after examples, not just polished outputs.
        </LI>
        <LI>
          <Strong>Your words, untouched.</Strong> The best services style
          your message beautifully; the worst rewrite it into greeting-card
          mush. The words should stay yours.
        </LI>
        <LI>
          <Strong>A real printed product.</Strong> Proper card stock, a real
          envelope, posted. If it only exists on a screen, it's a nice
          image, not a card.
        </LI>
        <LI>
          <Strong>Photo privacy, in writing.</Strong> Your photos should be
          used for your card and nothing else — never sold, never used to
          train models. (That's our policy, verbatim.) If a service doesn't
          say this plainly, assume the opposite.
        </LI>
        <LI>
          <Strong>Free re-rolls.</Strong> Generative art has taste. You
          should be able to try again for free until it's right, and only
          pay when you love it.
        </LI>
      </ul>

      <H2>Where it's all heading</H2>
      <P>
        Cards were personal once — handwritten, specific, kept. Mass printing
        made them convenient and generic. The interesting thing about this
        technology isn't novelty; it's that it makes cards{' '}
        <Strong>specific again</Strong>, at convenient-card effort. The
        average card gets displayed, then binned. One with the recipient in
        the artwork tends to get kept — which is, honestly, the entire point
        of sending one.
      </P>

      <Cta line="See what your photo turns into." />
    </>
  ),

  // ── 3 · birthday intent, brand voice ───────────────────────────────
  'personalised-birthday-card-ideas': (
    <>
      <P>
        The average birthday card is £4.29 of glitter and a pun about
        prosecco, displayed for five days, then quietly recycled. If you'd
        rather send the card that gets kept — the one where{' '}
        <Strong>they're the artwork</Strong> — here are nine scenes that
        work, tested on real mums, dads, nans and best mates.
      </P>

      <H2>For the ones who raised you</H2>
      <ul className="mt-5 list-disc pl-6">
        <LI>
          <Strong>1. Nan on the moon.</Strong> First nan in space, helmet
          tucked under one arm, Earth in the background. Works because the
          more dignified the nan, the funnier — and somehow the lovelier —
          it is.
        </LI>
        <LI>
          <Strong>2. Mum under the Northern Lights.</Strong> For the mum
          who's "always wanted to go". The card says: I know. One day. Until
          then.
        </LI>
        <LI>
          <Strong>3. Dad the gladiator.</Strong> In the Colosseum,
          mid-triumph. Especially correct if his actual hobbies are the
          dishwasher and falling asleep at 9pm.
        </LI>
      </ul>

      <H2>For the ones you chose</H2>
      <ul className="mt-5 list-disc pl-6">
        <LI>
          <Strong>4. Best mates abseiling off Big Ben.</Strong> No reason.
          That's the point. The inside can simply say "not sure why we're
          abseiling off Big Ben but it's funny."
        </LI>
        <LI>
          <Strong>5. Going viral in Times Square.</Strong> Their face on
          every billboard for their 16th, 21st, 30th. The main-character
          birthday card.
        </LI>
        <LI>
          <Strong>6. Winning the Grand National.</Strong> For the friend
          whose horse never comes in. This year it does.
        </LI>
      </ul>

      <H2>For the romantics</H2>
      <ul className="mt-5 list-disc pl-6">
        <LI>
          <Strong>7. A rooftop at sunset in New York.</Strong> The classic —
          and if there's a trip planned, let the inside break the news:
          "pack a bag."
        </LI>
        <LI>
          <Strong>8. The place you met, painted.</Strong> The pub, the bus
          stop, the terrible nightclub — rendered like it's the most
          romantic place on earth. Because to you two, it is.
        </LI>
        <LI>
          <Strong>9. Them at every age at once.</Strong> Use an old photo
          instead of a new one — them at seven, on the front of their 70th
          birthday card. Bring tissues.
        </LI>
      </ul>

      <H2>The two rules that make any of these land</H2>
      <P>
        <Strong>Specific beats spectacular</Strong> — Big Ben is good;
        Big Ben because of that one trip in 2019 is better. And{' '}
        <Strong>print it</Strong> — the entire magic of a card like this is
        that it ends up framed, on the fridge, kept. Ours are 280gsm, printed
        to order in the UK, £8.99 plus postage, straight to their door or
        yours.
      </P>

      <Cta line="Whose birthday is next?" />
    </>
  ),
};
