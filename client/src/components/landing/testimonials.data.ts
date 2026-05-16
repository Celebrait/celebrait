// client/src/components/landing/testimonials.data.ts
//
// Source of truth for the landing-page testimonial carousel.
// Adding a new recipient = one entry in this array. The carousel
// chrome (arrows + dots) appears automatically once length > 1.
//
// Asset shapes (locked 2026-05-07):
//   - videoSrc: 9:16 portrait, mp4, with sound, 30-60s (cap 90s)
//   - frontPhoto / insidePhoto / backPhoto: 1:1 square, ≥1500x1500
//   - vibePhoto (optional): 1:1 square, used in the bottom-right slot
//     when a recipient also captures a reaction/setting still

export type Testimonial = {
  id: string;
  recipientFirstName: string;
  occasion: string;
  videoSrc: string;
  videoPoster: string;
  frontPhoto: string;
  insidePhoto: string;
  backPhoto: string;
  vibePhoto?: string;
};

export const testimonials: Testimonial[] = [
  {
    id: 'sil-congrats-g',
    recipientFirstName: 'G',
    occasion: 'Congratulations',
    videoSrc: '',
    videoPoster: '',
    frontPhoto: '',
    insidePhoto: '',
    backPhoto: '',
  },
  // STUB ENTRIES — delete once real recipient packages land. Only here
  // so Kevin can see the peek carousel + chrome with >1 slide.
  {
    id: 'stub-2',
    recipientFirstName: 'Placeholder',
    occasion: 'Birthday',
    videoSrc: '',
    videoPoster: '',
    frontPhoto: '',
    insidePhoto: '',
    backPhoto: '',
  },
  {
    id: 'stub-3',
    recipientFirstName: 'Placeholder',
    occasion: 'Anniversary',
    videoSrc: '',
    videoPoster: '',
    frontPhoto: '',
    insidePhoto: '',
    backPhoto: '',
  },
];
