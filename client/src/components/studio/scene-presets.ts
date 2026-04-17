// client/src/components/studio/scene-presets.ts
//
// Curated scene-prompt starters, one set per occasion. Users click a
// preset to fill the scene textarea, then edit it — presets are
// fill-ins, not cages. Written in the voice of a real user describing
// a moment, not in the voice of an AI prompt engineer.
//
// Kept in code for launch; move to the DB once the list stabilises
// (ROADMAP_IDEAS.md has the note). Each preset should:
//   - Read like something a user would actually type
//   - Fit inside an 80-char textarea comfortably
//   - Work well with the current front_scene template
//
// The occasion key matches the select options in the Recipient step
// (lowercase). An 'other' fallback covers anything unusual.

export interface OccasionPresets {
  occasion: string;
  label: string;
  /** Hint shown under the textarea's rotating placeholder. */
  placeholders: string[];
  presets: {
    category: string;
    scenes: string[];
  }[];
}

export const OCCASION_PRESETS: Record<string, OccasionPresets> = {
  birthday: {
    occasion: 'birthday',
    label: 'Birthday',
    placeholders: [
      'Blowing out candles at the kitchen table surrounded by family',
      'Laughing with friends at a beach bonfire, string lights above',
      'Clinking pints at a cosy pub, warm evening light',
      "Hiking to a sunrise viewpoint on their birthday morning",
      'Dancing in a living room with balloons everywhere',
    ],
    presets: [
      {
        category: 'Classic moments',
        scenes: [
          'Blowing out candles on a birthday cake, family gathered around the table',
          'Opening presents on the sofa with loved ones watching',
          'Holding a sparkler cake as everyone sings',
          'Making a wish with eyes closed before cutting the cake',
        ],
      },
      {
        category: 'With friends',
        scenes: [
          'Clinking glasses at a lively pub, friends around the table',
          'Laughing by a beach bonfire under string lights at golden hour',
          'Dancing together at a house party with confetti in the air',
          'Gathered around a restaurant table, dessert arriving with a sparkler',
        ],
      },
      {
        category: 'Adventures',
        scenes: [
          'Hiking to a mountain viewpoint at sunrise, arms raised in celebration',
          'On a sailing boat at sunset, glass of champagne in hand',
          'Road trip stop at a scenic overlook, balloons tied to the car',
          'Jumping into a lake from a jetty on a warm summer day',
        ],
      },
      {
        category: 'Cosy',
        scenes: [
          'Curled up by a fireplace with a mug of hot chocolate and cake',
          'Morning coffee in pyjamas with a single candle on a cupcake',
          'Reading a book in a sunlit armchair, birthday flowers on the table',
        ],
      },
    ],
  },
  anniversary: {
    occasion: 'anniversary',
    label: 'Anniversary',
    placeholders: [
      'Slow dancing in the kitchen by candlelight',
      'Clinking glasses on a balcony overlooking the sea',
      'Walking hand in hand on an empty beach at sunset',
      'Sharing a slice of wedding cake, laughing together',
    ],
    presets: [
      {
        category: 'Romantic moments',
        scenes: [
          'Slow dancing together in the kitchen by candlelight',
          'Clinking wine glasses over a candlelit dinner at home',
          'Sharing a dessert in a softly lit restaurant, foreheads touching',
          'Reading side by side in bed with a tray of breakfast',
        ],
      },
      {
        category: 'Outdoor',
        scenes: [
          'Walking hand in hand on an empty beach at sunset',
          'Picnic blanket in a wildflower meadow, wine and fruit spread out',
          'On a Venetian gondola at golden hour, laughing',
          'Under a string of fairy lights in a garden, toasting each other',
        ],
      },
      {
        category: 'Throwback',
        scenes: [
          'Recreating their wedding photo in the same spot, decades later',
          'Dancing at their wedding venue, still dressed up',
          'Looking through an old photo album together on the sofa',
        ],
      },
    ],
  },
  wedding: {
    occasion: 'wedding',
    label: 'Wedding',
    placeholders: [
      'First dance under twinkling fairy lights, confetti in the air',
      'Walking down the aisle in a sunlit garden',
      'Toasting with guests at a candlelit reception',
      'Cutting the cake together, laughing',
    ],
    presets: [
      {
        category: 'The ceremony',
        scenes: [
          'Walking down a sunlit garden aisle, petals scattered on the path',
          'Exchanging vows under a wooden arch draped with wildflowers',
          'First kiss as a married couple, guests applauding in the background',
          'Walking back down the aisle hand in hand, confetti raining down',
        ],
      },
      {
        category: 'The reception',
        scenes: [
          'First dance under a canopy of fairy lights, guests watching from the side',
          'Cutting the wedding cake together, laughing at each other',
          'Clinking champagne glasses at the head of a candlelit banquet table',
          'Speeches moment — raising a toast with the wedding party beside them',
        ],
      },
      {
        category: 'Beyond the venue',
        scenes: [
          'On a cliff edge at sunset in full wedding attire, sea behind them',
          'Driving away in a vintage car decorated with ribbons and tin cans',
          'Quiet moment in a wildflower field, just the two of them',
        ],
      },
    ],
  },
  engagement: {
    occasion: 'engagement',
    label: 'Engagement',
    placeholders: [
      'One down on a clifftop at sunset, ring in hand',
      'Reaction moment — hands over mouth in happy shock',
      'Showing off the ring to cheering friends and family',
      'Popping champagne on a candlelit balcony',
    ],
    presets: [
      {
        category: 'The proposal',
        scenes: [
          'One down on a clifftop at sunset, ring box open, partner laughing through tears',
          'Proposing in a candlelit restaurant, other diners watching and smiling',
          'Surprise proposal in a wildflower field at golden hour',
          'In a snowy forest, ring box in hand, breath visible in the cold air',
        ],
      },
      {
        category: 'The celebration',
        scenes: [
          'Showing off the ring, hands out, to cheering friends and family',
          'Popping champagne on a candlelit balcony at night, city lights behind them',
          'Dancing in their living room after getting engaged, confetti in the air',
        ],
      },
    ],
  },
  baby: {
    occasion: 'baby',
    label: 'New baby',
    placeholders: [
      'Cradling a newborn in a sunlit nursery',
      'New parents smiling down at their sleeping baby',
      'Tiny feet in a parent\'s hand, soft focus',
      'First bath time, warm towels and soft lighting',
    ],
    presets: [
      {
        category: 'New arrival',
        scenes: [
          'New parents cradling their newborn in a softly lit nursery',
          "Grandparent holding the baby for the first time, tears in their eyes",
          "A pair of tiny feet cupped in an adult's hands, soft focus background",
          "The baby asleep on a parent's chest, sunlight streaming through the window",
        ],
      },
      {
        category: 'Early moments',
        scenes: [
          "First bath in a warm bathroom, towels and smiles",
          "Tummy time on a soft rug surrounded by plush toys",
          'Bedtime story being read to the baby in a rocking chair',
          'Family portrait with the new sibling meeting the baby',
        ],
      },
    ],
  },
  graduation: {
    occasion: 'graduation',
    label: 'Graduation',
    placeholders: [
      'Throwing the graduation cap in the air with classmates',
      'Receiving the diploma on stage, beaming',
      'Posing with family in cap and gown outside the hall',
      'Celebration dinner at a favourite restaurant in full regalia',
    ],
    presets: [
      {
        category: 'The day',
        scenes: [
          'Throwing the graduation cap in the air, classmates in the background',
          'On stage receiving the diploma, handshake with the dean',
          'Walking through the university quad in cap and gown, sun behind them',
          'Family huddle for a photo outside the graduation hall',
        ],
      },
      {
        category: 'The celebration',
        scenes: [
          'Celebration dinner at a restaurant in full graduation regalia',
          'Champagne toast with parents, diploma propped against the wine bottle',
          'Jumping into a swimming pool in cap and gown with friends',
        ],
      },
    ],
  },
  christmas: {
    occasion: 'christmas',
    label: 'Christmas',
    placeholders: [
      'Opening presents by the tree in pyjamas on Christmas morning',
      'Family gathered around the dinner table, crackers pulled',
      'Carrying a freshly cut tree home through snowy streets',
      'Drinking mulled wine by the fireplace, stockings hanging',
    ],
    presets: [
      {
        category: 'Christmas morning',
        scenes: [
          'Opening presents by the tree in matching pyjamas',
          'Child running downstairs to see the tree, stockings full',
          'Family hugging in front of a lit tree, snow falling outside the window',
        ],
      },
      {
        category: 'The feast',
        scenes: [
          'Pulling crackers at a candlelit Christmas dinner table',
          'Carving the turkey at the head of the table, family applauding',
          'Dessert moment — flaming Christmas pudding carried into a dim room',
        ],
      },
      {
        category: 'Wintry scenes',
        scenes: [
          'Carrying a freshly cut tree home through snowy streets',
          'Ice skating together on a frozen lake, string lights overhead',
          'Mulled wine by the fireplace, stockings hanging on the mantel',
        ],
      },
    ],
  },
  valentines: {
    occasion: 'valentines',
    label: "Valentine's Day",
    placeholders: [
      'Breakfast in bed with flowers and a handwritten note',
      'Slow dancing in the kitchen at 2am',
      'Sharing a dessert in a candlelit restaurant',
      'Walking hand in hand through a rainy city, one umbrella',
    ],
    presets: [
      {
        category: 'At home',
        scenes: [
          'Breakfast in bed with a single rose and a handwritten note',
          'Slow dancing in the kitchen at 2am in pyjamas',
          'Sharing a dessert on the sofa, blanket and candles',
        ],
      },
      {
        category: 'Out',
        scenes: [
          'Walking hand in hand through a rainy city, sharing one umbrella',
          "Dinner for two at a candlelit restaurant, hands touching across the table",
          'Cinema date, sharing popcorn in the soft glow of the screen',
        ],
      },
    ],
  },
  thankyou: {
    occasion: 'thankyou',
    label: 'Thank you',
    placeholders: [
      'Delivering a bunch of fresh flowers on the doorstep',
      'Handing over a gift bag with a huge grateful smile',
      'Hugging tightly, both faces happy',
      'Sitting across a café table, warm cups of coffee between them',
    ],
    presets: [
      {
        category: 'Warm gestures',
        scenes: [
          'Handing over a bouquet of fresh flowers on the doorstep, both smiling',
          'Tight grateful hug, both faces visible and happy',
          'Handing over a wrapped gift with a genuine smile',
        ],
      },
      {
        category: 'Shared moments',
        scenes: [
          "Sitting across a café table, warm cups of coffee and grateful conversation",
          'Walking together in a park on a crisp day, deep in conversation',
          'Dinner at home, toasting with water glasses, candlelight',
        ],
      },
    ],
  },
  sympathy: {
    occasion: 'sympathy',
    label: 'Sympathy',
    placeholders: [
      'Sitting together on a quiet bench in a leafy park',
      'Hands held across a café table, soft afternoon light',
      'A single candle lit on a windowsill at dusk',
      'Gentle hug at a front door, kindness in both faces',
    ],
    presets: [
      {
        category: 'Quiet presence',
        scenes: [
          'Sitting together on a quiet bench in a leafy park, soft conversation',
          'Hands held across a café table in soft afternoon light',
          'Walking side by side through autumn trees, unhurried',
        ],
      },
      {
        category: 'Gentle gestures',
        scenes: [
          'A single candle lit on a windowsill at dusk',
          'Bunch of wildflowers placed gently on a kitchen table',
          'Gentle hug at a front door, kindness in both faces',
        ],
      },
    ],
  },
  other: {
    occasion: 'other',
    label: 'Something else',
    placeholders: [
      'Tell us the moment — who, where, what\'s happening',
      'The more specific the better — lighting, mood, setting',
      'Describe it like a photograph you wish you had',
      'What would make this unmistakably about them?',
    ],
    presets: [
      {
        category: 'Starters',
        scenes: [
          'In their favourite place, doing what they love best',
          'Around a table with the people they love most',
          'A quiet moment that captures who they really are',
          "Out in nature, golden hour, a big genuine smile",
        ],
      },
    ],
  },
};

/** Occasion options shown in the Recipient step dropdown. Order is
 *  roughly "most common first". */
export const OCCASION_OPTIONS = [
  'birthday',
  'anniversary',
  'wedding',
  'engagement',
  'baby',
  'graduation',
  'christmas',
  'valentines',
  'thankyou',
  'sympathy',
  'other',
] as const;

export function getOccasionLabel(occasion: string | undefined): string {
  if (!occasion) return '';
  return OCCASION_PRESETS[occasion]?.label ?? occasion;
}
