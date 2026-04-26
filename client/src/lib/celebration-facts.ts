// client/src/lib/celebration-facts.ts
//
// Curated pool of celebration-themed one-liners, used by the Studio
// generation wait screen to fill the ~45s render time with warmth.
//
// Originally written 2026-04-24 by a copy-agent run briefed against
// Celebrait's tone bible — warm, crafted, human; no breathless
// "Did you know?!", no clichés. Replaced an even earlier Wikipedia
// "on this day" feed.
//
// Refreshed 2026-04-26 after Kevin's test pass: the original pool
// leaned hard on TIL/trivia register ("the wedding ring sits on
// the fourth finger because…") which read as detached from the
// gift moment. ~30 facts swapped to a moment-led / observational
// register: third-person, sensory, occasionally playful, never
// breathless. The shift is from "did you know" to "you know how
// it is."
//
// To refresh again: re-run the copy-agent brief in the session
// notes, swap the relevant lines below.

export type CelebrationCategory =
  | 'birthday'
  | 'anniversary'
  | 'graduation'
  | 'christmas'
  | 'valentines'
  | 'sympathy'
  | 'general';

export interface CelebrationFact {
  text: string;
}

export const CELEBRATION_FACTS: Record<CelebrationCategory, CelebrationFact[]> = {
  birthday: [
    { text: "Blowing out candles began in 18th-century Germany, where a child's cake was lit at dawn and kept burning till supper." },
    { text: 'In Japan, a 60th birthday is called kanreki — a symbolic rebirth, celebrated in a red vest and hat.' },
    { text: 'The round birthday cake traces back to ancient Greece, where moon-shaped honey cakes were baked for Artemis.' },
    { text: 'Most birthday wishes are passed across kitchen counters. A few make it into the air. Almost none make it onto a card.' },
    { text: "The cards that get kept aren't usually the funniest. They're the ones where someone clearly stopped, thought, and started again." },
    { text: "In Mexico, quinceañeras mark a girl's 15th with a ceremony that swaps flat shoes for heels — childhood to womanhood in one change." },
    { text: "A birthday is mostly an excuse — to say the thing you've been meaning to say since roughly last March." },
    { text: "There's a particular kind of birthday card — the one that arrives a day late, opened in pyjamas with cold tea, and read twice." },
    { text: 'The good birthday cards tend to sit propped on a shelf for weeks, then quietly migrate to a drawer no one throws out.' },
    { text: "It's a strange small privilege — being the person who remembered, and remembered properly, and on time." },
    { text: 'Most years, the cake is forgotten by Tuesday. The card, if it\'s any good, is still on the windowsill in March.' },
    { text: "Sweden's birthday child is woken with song, candles and a tray of coffee brought to bed before the household is allowed to speak." },
    { text: "Birthdays have a way of reminding you who actually pays attention — and who's been quietly clocking the date all along." },
    { text: "The hardest part of any birthday card isn't the message. It's catching the version of someone you actually mean." },
    { text: 'Round-number birthdays do something odd to people — they go quiet, and then they reread the cards more carefully than usual.' },
  ],
  anniversary: [
    { text: "A good anniversary card knows what it's competing with: forty years of inside jokes you can't fit in a sentence." },
    { text: "Most of an anniversary lives in small, unphotographed evenings — the kettle, the radio, someone's foot on the sofa." },
    { text: 'Ancient Greek brides wore ivy in their hair as a symbol of fidelity — a plant that clings and never lets go.' },
    { text: "Long marriages have their own private grammar. Outsiders catch maybe a tenth of it, and that's usually the funny tenth." },
    { text: 'Victorian couples kept the top tier of the wedding cake for their first anniversary, or for the christening of a first child.' },
    { text: "There's no real way to summarise a decade together on a card. The trick is picking the one detail that proves you noticed." },
    { text: "In rural Greece, friends still write their names on the soles of the bride's shoes; the last name left unworn is said to marry next." },
    { text: 'The honeymoon once meant a literal month of mead — hydromel — drunk by the couple to encourage fertility.' },
    { text: 'Queen Victoria carried a small bouquet of myrtle in 1840; every royal bride since has tucked a sprig from the same garden into hers.' },
    { text: 'Anniversary cards age differently to other cards. The good ones get reread on quiet anniversaries, years after the round numbers.' },
  ],
  graduation: [
    { text: "A graduation card is mostly a quiet way of saying: I watched the unglamorous bits, and I'm proud of those too." },
    { text: "The photos from the day fade. The card on the desk through three flatshares somehow doesn't." },
    { text: 'Most graduates won\'t remember the speeches. They tend to remember exactly who showed up, and who wrote something real.' },
    { text: "In the Philippines, parents traditionally pin paper money to the graduate's sash during the ceremony — a blessing made visible." },
    { text: 'The word graduate comes from the Latin gradus — a step; the ceremony literally marks one stair climbed.' },
  ],
  christmas: [
    { text: 'Christmas cards have a habit of being read twice — once on arrival, once when they\'re taken down in January.' },
    { text: "There's a quiet hierarchy on the mantelpiece by Boxing Day — the cards that say something specific drift to the front." },
    { text: 'Most December post is a flurry. A handful of cards a year cut through the flurry — usually the ones that mention something only the sender would remember.' },
    { text: 'The Icelandic Jólabókaflóð — Yule Book Flood — has families exchanging books on Christmas Eve and reading them into the night.' },
    { text: 'Christmas is mostly a long string of small gestures. The card is one of the few that survives the week.' },
  ],
  valentines: [
    { text: "The best Valentine's cards aren't the most romantic. They're the ones that prove someone has been paying close, slightly amused attention." },
    { text: "The red rose became Valentine's flower thanks to Louis XVI's wife Marie, who kept one pressed in her prayer book." },
    { text: 'Saying it out loud is one thing. Writing it down — and meaning it the same way the next morning — is another.' },
    { text: "A Valentine's card lives or dies on the second sentence. The first is easy; the second is where someone gives themselves away." },
    { text: "The heart shape — two curves meeting at a point — may come from the silphium seed, an ancient Libyan herb used as a love token." },
  ],
  sympathy: [
    { text: "A sympathy card doesn't need to find the right words. It needs to land on the right day, and say nothing more than it has to." },
    { text: 'The cards that get kept after a loss are rarely the ones that try hardest. They\'re usually the shortest, and the most specific.' },
    { text: 'In Jewish tradition, visitors to a shiva house bring no gifts and say nothing first — presence alone is the offering.' },
    { text: 'The Irish wake gathers friends around tea and stories; laughter at a memory is considered the truest form of tribute.' },
    { text: 'Sometimes the kindest thing a card can do is remember a name out loud, when the room has gone quiet around it.' },
  ],
  general: [
    { text: 'Neuroscientists have measured the same oxytocin response from reading a handwritten note as from a ten-second hug.' },
    { text: 'Most cards are read once. The good ones get pinned to the fridge, and quietly outlast the occasion they were sent for.' },
    { text: "There's a small, specific pleasure in writing someone's name at the top of a card and meaning every word that follows it." },
    { text: 'The average person in the UK still sends 17 cards a year, a number that has barely shifted in three decades.' },
    { text: "Japanese origami began as ceremonial wrapping — noshi — folded around a gift to show the giver's hand had touched it." },
    { text: 'In a 2019 Harvard study, the people who gave gifts reported a longer mood lift than the people who received them.' },
    { text: 'Researchers at Kent found that writing three sentences of thanks, just once a week, measurably lifts mood for months afterwards.' },
    { text: 'The Romans exchanged strenae on New Year — sprigs of laurel and figs — believing a gift at the turn of the year shaped the next one.' },
    { text: 'The phrase drop me a line comes from the Victorian era, when even a single sentence on a postcard counted as a warm visit.' },
    { text: 'Confetti began as real sweets — sugared almonds thrown at Italian weddings, later swapped for paper when the throwing got rowdy.' },
    { text: "Britain's pillar-box red was chosen in 1874 to replace the original olive green, which blended too well into the countryside." },
    { text: 'The Edwardian language of stamps placed upside-down meant I love you — a small rebellion hidden on the corner of an envelope.' },
    { text: "A UCLA study found that naming a feeling in writing — even privately — calms the brain's fear centre within minutes." },
    { text: 'The Welsh love spoon, carved from a single piece of wood since the 17th century, was a suitor\'s proof he could provide and whittle.' },
    { text: 'Anthropologists call gift-giving the oldest human technology — older than writing, older than farming, older than the wheel.' },
  ],
};

/** Map from an occasion key (as stored on the card draft) to the
 *  primary category in our facts pool. Unknown occasions fall back to
 *  'general'. Keep in sync with OCCASION_OPTIONS in scene-presets.ts. */
const OCCASION_TO_CATEGORY: Record<string, CelebrationCategory> = {
  birthday: 'birthday',
  anniversary: 'anniversary',
  wedding: 'anniversary',
  engagement: 'anniversary',
  graduation: 'graduation',
  christmas: 'christmas',
  valentines: 'valentines',
  sympathy: 'sympathy',
  // thankyou / baby / other → general fallback
};

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

/**
 * Build a shuffled feed of celebration facts for the wait stage,
 * biased toward the user's occasion. Occasion-specific facts (birthday
 * facts for a birthday card) lead; general facts follow. De-duped
 * by text.
 */
export function buildCelebrationFeed(
  occasion: string | null,
  limit = 20,
): CelebrationFact[] {
  const key = (occasion ?? '').toLowerCase();
  const primary = OCCASION_TO_CATEGORY[key];
  const head = primary ? shuffle(CELEBRATION_FACTS[primary]) : [];
  const tail = shuffle(CELEBRATION_FACTS.general);

  const seen = new Set<string>();
  const out: CelebrationFact[] = [];
  for (const fact of [...head, ...tail]) {
    if (seen.has(fact.text)) continue;
    seen.add(fact.text);
    out.push(fact);
    if (out.length >= limit) break;
  }
  return out;
}
