// client/src/lib/gallery-examples.ts
//
// The gallery (/gallery): every finished card we can show, scannable.
// Each is a front + inside pair; a tile flips between them. Some have a
// story (/stories/:slug, see gallery-stories.ts) and say so under the
// caption. Add a card = add an entry; shots live in client/public/.
// Order = order on the wall (newest, best first).

export interface GalleryExample {
  id: string;
  /** Who and what: "Adam's 8th · from Dad". */
  title: string;
  /** The scene, as the sender might have typed it. */
  scene: string;
  front: string;
  inside: string;
  alt: string;
  /** Slug of its story on /stories, when it has one. */
  storySlug?: string;
}

export const GALLERY_EXAMPLES: GalleryExample[] = [
  {
    id: 'wembley',
    title: "Adam's 8th · from Dad",
    scene: 'Outside Wembley on England match day',
    front: '/gallery-img/wembley-front.webp',
    inside: '/gallery-img/wembley-inside.webp',
    alt: "Mark and Adam outside Wembley in England scarves, holding a flag that reads We're going to Wembley!",
    storySlug: 'wembley',
  },
  {
    id: 'mum-northern-lights',
    title: "Mum's 60th",
    scene: 'Under the Northern Lights',
    front: '/proof-card-front.webp',
    inside: '/proof-card-inside.webp',
    alt: 'Mum in a parka under the Northern Lights, the front reading Happy 60th Mum',
  },
  {
    id: 'new-york-anniversary',
    title: '10 years · for Sarah',
    scene: 'On a rooftop in New York at sunset',
    front: '/hero-card-front.webp',
    inside: '/hero-card-inside.webp',
    alt: 'A couple toasting on a New York rooftop at sunset, the front reading Happy Anniversary Baby',
  },
  {
    id: 'big-ben',
    title: 'Best friends',
    scene: 'Abseiling off Big Ben',
    front: '/proof-bigben-front.webp',
    inside: '/proof-bigben-inside.webp',
    alt: 'Two friends abseiling down the face of Big Ben',
  },
  {
    id: 'times-square',
    title: 'For Sarah',
    scene: 'Going viral in Times Square',
    front: '/proof-timessquare-front.webp',
    inside: '/proof-timessquare-inside.webp',
    alt: 'Sarah filming herself in the middle of Times Square',
  },
];
