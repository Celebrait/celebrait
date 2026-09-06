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

// Empty until real recipient packages land. An empty array unmounts the
// whole testimonials section (see the section component) — which is
// correct: better no section than "Placeholder" grey tiles on the public
// page under "Real cards. Real reactions." (audit 2026-07-02).
//
// To add the first real one (the SIL "Congratulations, G" slide), drop
// its assets in and add an entry like:
//   {
//     id: 'sil-congrats-g',
//     recipientFirstName: 'G',
//     occasion: 'Congratulations',
//     videoSrc: '/testimonials/sil-g.mp4',  videoPoster: '…',
//     frontPhoto: '…', insidePhoto: '…', backPhoto: '…',
//   }
export const testimonials: Testimonial[] = [];
