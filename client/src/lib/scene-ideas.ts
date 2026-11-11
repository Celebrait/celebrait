// client/src/lib/scene-ideas.ts — the landing page's "steal a scene" list.
//
// EDIT THESE FREELY (Aidan): each line is exactly what lands in the
// maker's scene box when someone taps it. First drafts by Claude,
// 2026-11-12.
//
// THE RULES every idea must pass, because the product has to be able to
// draw it and the page must not promise what the maker refuses:
//   • A PERSON FROM A PHOTO, IN A PLACE, DOING SOMETHING. Never a scene
//     with nobody in it ("the place you met, painted").
//   • No celebrities, no brands, no logos, no named teams, no trademarked
//     events (so "a packed stadium", not a named cup final; "the big
//     race", not a named one). Real PLACES are fine.
//   • No "them as a child" ideas — that needs a child's photo.
//   • No pronouns (his/her): the same line has to work for anyone.
//   • British, specific, a bit daft. One line, under ~60 characters.
//
// `name` pre-fills "Who's this card for?" in the maker when the group is
// one a customer would actually type ("Mum", "Dad"). Left out where
// they'd type a real name instead.

export interface SceneIdeaGroup {
  id: string;
  /** The filter pill. */
  label: string;
  /** Pre-filled recipient name, when the label IS the name. */
  name?: string;
  ideas: string[];
}

export const SCENE_IDEA_GROUPS: SceneIdeaGroup[] = [
  {
    id: 'mum',
    label: 'Mum',
    name: 'Mum',
    ideas: [
      'On a gondola in Venice, glass of fizz in hand',
      'Winning best in show at the village flower show',
      'Headlining the main stage at a summer festival',
      'On the red carpet at a film premiere, cameras flashing',
    ],
  },
  {
    id: 'dad',
    label: 'Dad',
    name: 'Dad',
    ideas: [
      'Lifting the trophy in front of a packed stadium',
      'Landing the catch of a lifetime on a Scottish loch',
      'Behind the decks at a beach club in Ibiza',
      'Manning the barbecue on the deck of a superyacht',
    ],
  },
  {
    id: 'grandparent',
    label: 'Nan or Grandad',
    ideas: [
      'Riding a motorbike along the seafront, scarf flying',
      'Skydiving over the Lake District, thumbs up',
      'Winning big at the bingo, confetti everywhere',
      'Waltzing across the Blackpool Tower Ballroom',
    ],
  },
  {
    id: 'mate',
    label: 'Best mate',
    ideas: [
      'Crowd-surfing at a festival, pint somehow unspilled',
      'On a flamingo lilo in a Las Vegas pool',
      'Riding a camel past the pyramids at sunrise',
      'Winning the pub quiz, trophy held high',
    ],
  },
  {
    id: 'partner',
    label: 'Other half',
    ideas: [
      'On a Paris rooftop, the Eiffel Tower lit up behind',
      'In a rowing boat on Lake Como',
      'Sharing chips on Brighton pier at sunset',
      'Drifting over the Cotswolds in a hot-air balloon',
    ],
  },
];

/** The maker link for one idea: the scene (and the name, where the group
 *  has one) ride in the query string; photo-maker.tsx reads them. */
export function sceneIdeaHref(group: SceneIdeaGroup, idea: string): string {
  const qp = new URLSearchParams();
  if (group.name) qp.set('recipient', group.name);
  qp.set('scene', idea);
  return `/photo/make?${qp.toString()}`;
}
