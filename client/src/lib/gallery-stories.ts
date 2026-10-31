// client/src/lib/gallery-stories.ts
//
// The gallery's cards, told as stories. ONE list drives three places:
//   • /stories          — the index (client/src/pages/stories.tsx)
//   • /stories/:slug    — the story (client/src/pages/gallery-story.tsx)
// (/gallery is every card at a glance: gallery-examples.ts.)
//   • /photo            — the "Real stories" section
// Add a card = add an entry here, three shots in client/public/
// gallery-img/, and a title + description for its slug in
// shared/seo.ts (GALLERY_STORY_SEO) so the page has its own metadata.
//
// `provenance` is the small-print line under the review. A card the
// team made to show the route says so; a real customer's card carries
// their permission line instead. Fake reviews presented as genuine
// are banned (DMCC Act 2024), so this stays honest.

export interface GalleryStory {
  slug: string;
  /** On the card's chip: "Adam's 8th · from Dad". */
  chip: string;
  /** One line for the tile on the wall and the landing. */
  hook: string;
  heading: string;
  /** The story, in short paragraphs. */
  story: string[];
  photo: { src: string; alt: string; caption: string };
  /** What the sender typed on the photo route: the moment, the inside. */
  typed: { moment: string; inside: string };
  front: { src: string; alt: string };
  inside: { src: string; alt: string };
  review: { quote: string; by: string; stars: number };
  facts: string[];
  provenance: string;
}

export const GALLERY_STORIES: GalleryStory[] = [
  {
    slug: 'wembley',
    chip: "Adam's 8th · from Dad",
    hook: 'The tickets were the present. The card was the reveal.',
    heading: 'The tickets were the present. The card was the reveal.',
    story: [
      "Mark and Jo had England tickets for Adam's eighth birthday and one problem: how do you hand an eight-year-old two tickets and make it land? An envelope with a printout wasn't going to do it.",
      "So the card did the telling. Mark took a selfie of the two of them from a cold Tuesday night at their local ground, typed where he wanted them to be instead, and the card put them outside Wembley on match day, scarves on, arch behind them, flag in hand.",
      'Adam opened it at breakfast on his birthday. He read the front, opened it, read the inside twice, and then the house heard about it.',
    ],
    photo: {
      src: '/gallery-img/wembley-source.webp',
      alt: 'A selfie of Mark and Adam in the stands at a floodlit football ground',
      caption: 'One phone selfie from a Tuesday night at the football. That was the whole upload.',
    },
    typed: {
      moment:
        "Me and Adam outside Wembley on England match day, scarves and face paint, the arch behind us, holding a flag that says We're going to Wembley!",
      inside:
        "Dear Adam, Happy 8th birthday mate, we're off to Wembley to watch England! Love you so much, Mum & Dad x",
    },
    front: {
      src: '/gallery-img/wembley-front.webp',
      alt: "The printed card standing on a kitchen table: Mark and Adam outside Wembley in England scarves, holding a flag that reads We're going to Wembley!",
    },
    inside: {
      src: '/gallery-img/wembley-inside.webp',
      alt: "The card open, held in Dad's hand: Wembley Way at sunset with the message Dear Adam, Happy 8th birthday mate, we're off to Wembley to watch England! Love you so much, Mum & Dad x",
    },
    review: {
      quote:
        "He read it twice, looked at me, then screamed. It's him. It's actually him, in the shirt, outside Wembley. We'd have paid double. It's on the fridge until we go.",
      by: 'Mark, Adam’s dad',
      stars: 5,
    },
    facts: ['Made from one selfie', 'Typed in about ten minutes', 'Printed once, posted Royal Mail 24'],
    provenance:
      'Made by the Celebrait team with our own photo, to show the route from selfie to doormat. The names are ours too.',
  },
];

export const storyBySlug = (slug: string) => GALLERY_STORIES.find((s) => s.slug === slug);
