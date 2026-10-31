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
  /** One line beside the open card: what ties the inside to the front. */
  insideNote: string;
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
    insideNote: 'Same light, same Wembley. The message is set in the card\u2019s own hand, so the inside belongs with the front.',
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
  {
    slug: 'nana-budapest',
    chip: "Nana's 80th · from Hannah",
    hook: 'Eighty years old, and the next adventure already booked.',
    heading: 'Eighty years old, and the next adventure already booked.',
    story: [
      "Hannah and her Nana have walked the Lakes together every autumn since Hannah was small. For Nana's eightieth, Hannah booked the two of them a long weekend in Budapest, the one city Nana always said she'd get to.",
      "She wanted the card to be the first glimpse of it. So she took the selfie from their last walk, above Derwentwater, and typed where they'd be in a fortnight: a wall by the Danube at sunset, Parliament lit up behind them, a glass of wine each.",
      'Nana read the inside, looked at the front again, and asked if that was really her. It is. The card is going in her handbag for the flight.',
    ],
    photo: {
      src: '/gallery-img/nana-source.webp',
      alt: 'A selfie of Hannah and her Nana on a fell above Derwentwater, the lake and hills behind them',
      caption: 'One selfie from a walk above Derwentwater. Big coats, grey sky, two big smiles.',
    },
    typed: {
      moment:
        'Me and Nana sitting on a riverside wall in Budapest at sunset, Parliament and the Chain Bridge lit up behind us, a glass of white wine each',
      inside:
        'Nana, wishing you all the joy in the world today on your 80th birthday, and this will be us in Budapest in 2 weeks! Love from your favourite grand daughter! xx',
    },
    front: {
      src: '/gallery-img/nana-front.webp',
      alt: 'The printed card standing on a mantelpiece: Hannah and Nana on a Budapest riverside wall at sunset, wine in hand, Parliament behind them, the stone carved Happy 80th Nana',
    },
    inside: {
      src: '/gallery-img/nana-inside.webp',
      alt: "The card open in Nana's hands: the Danube at sunset with the message Nana, wishing you all the joy in the world today on your 80th birthday, and this will be us in Budapest in 2 weeks! Love from your favourite grand daughter! xx",
    },
    insideNote: 'Same sunset, same river, the wine glasses gone and the message in their place. The inside belongs with the front.',
    review: {
      quote:
        "She kept asking if that was really her. The scarf, the smile, all of it. She's eighty and she's taking a birthday card to Budapest in her handbag.",
      by: 'Hannah, Nana\u2019s granddaughter',
      stars: 5,
    },
    facts: ['Made from one selfie', 'Typed in about ten minutes', 'Printed once, posted Royal Mail 24'],
    provenance:
      'Made by the Celebrait team to show the route from selfie to doormat. The names are ours.',
  },
];

export const storyBySlug = (slug: string) => GALLERY_STORIES.find((s) => s.slug === slug);
