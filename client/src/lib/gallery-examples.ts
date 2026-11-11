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
    id: 'nana-budapest',
    title: "Nana's 80th · from Hannah",
    scene: 'By the Danube in Budapest at sunset',
    front: '/gallery-img/nana-front.webp',
    inside: '/gallery-img/nana-inside.webp',
    alt: 'Hannah and Nana on a Budapest riverside wall at sunset, wine in hand, the stone carved Happy 80th Nana',
    storySlug: 'nana-budapest',
  },
  // Aidan 2026-11-11: the gallery shows these two only. The other four
  // (Mum / Northern Lights, New York, Big Ben, Times Square) came off and
  // will be replaced with real-life photos of printed cards. Their art
  // still lives on /photo's scenes row and how-it-works.
];
