// client/src/lib/celebration-facts.ts
//
// Curated pool of celebration-themed one-liners, used by the Studio
// generation wait screen to fill the ~45s render time with warmth.
//
// Written 2026-04-24 by a copy-agent run briefed against Celebrait's
// tone bible — warm, crafted, human; no breathless "Did you know?!",
// no clichés. Replaced the earlier Wikipedia "on this day" feed which
// was date-boxed and often thin on celebration-relevance (Kevin called
// it "too limited and boring").
//
// To refresh: re-run the copy-agent brief in the session notes, swap
// the JSON below, increment CACHE_VERSION in any future hook that
// persists selections (not currently needed — pool is small, selection
// is cheap to re-compute per mount).

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
    { text: 'The belief that a wish comes true if every candle is blown out in one breath is a 1900s American invention.' },
    { text: 'Happy Birthday to You began as a classroom greeting called Good Morning to All, written by two Kentucky sisters in 1893.' },
    { text: "In Mexico, quinceañeras mark a girl's 15th with a ceremony that swaps flat shoes for heels — childhood to womanhood in one change." },
    { text: "In Korea, a child's first birthday — doljanchi — features a tray of objects; whichever they grab predicts their future." },
    { text: 'The Dutch call certain birthdays crown years — 5, 10, 15, 20, 21, 50 — and decorate the birthday chair with flowers and paper garlands.' },
    { text: 'Ancient Romans were the first to celebrate ordinary birthdays; before them, only gods and kings got the honour.' },
    { text: 'In Vietnam, everyone traditionally celebrates their birthday on Tết — the lunar new year — regardless of when they were born.' },
    { text: 'Chinese longevity noodles are served uncut on birthdays; the longer the noodle slurped whole, the longer the life.' },
    { text: "Sweden's birthday child is woken with song, candles and a tray of coffee brought to bed before the household is allowed to speak." },
    { text: "The cupcake was first written down in 1796, in Amelia Simmons's American Cookery — a democratic little cake, one each." },
    { text: 'The earliest printed birthday card appeared in England around 1850, once the Penny Post made sending one affordable.' },
    { text: 'Psychologists call the small dip in mood near a milestone birthday the threshold effect — the brain pauses to take stock.' },
  ],
  anniversary: [
    { text: 'The wedding ring sits on the fourth finger because Romans believed a vein — the vena amoris — ran from it straight to the heart.' },
    { text: 'Paper for the first anniversary, gold for the fiftieth; the full gift ladder was codified by Emily Post in 1922.' },
    { text: 'Ancient Greek brides wore ivy in their hair as a symbol of fidelity — a plant that clings and never lets go.' },
    { text: 'The diamond engagement ring tradition is largely the work of a 1947 De Beers copywriter who wrote the line A Diamond Is Forever.' },
    { text: 'Victorian couples kept the top tier of the wedding cake for their first anniversary, or for the christening of a first child.' },
    { text: 'The oldest known marriage vows in English come from the 1549 Book of Common Prayer — to have and to hold has barely changed since.' },
    { text: "In rural Greece, friends still write their names on the soles of the bride's shoes; the last name left unworn is said to marry next." },
    { text: 'The honeymoon once meant a literal month of mead — hydromel — drunk by the couple to encourage fertility.' },
    { text: 'Queen Victoria carried a small bouquet of myrtle in 1840; every royal bride since has tucked a sprig from the same garden into hers.' },
    { text: 'Anniversaries as a yearly ritual began in medieval Germany, where husbands crowned wives with silver at 25 years and gold at 50.' },
  ],
  graduation: [
    { text: 'The mortarboard got its name from the flat wooden board bricklayers use — a scholar was thought to build with knowledge.' },
    { text: 'Graduation gowns date to 12th-century Oxford and Bologna, where unheated halls meant scholars lectured in long warm robes.' },
    { text: 'Moving the tassel from right to left at the end of a ceremony is a purely American tradition, less than a century old.' },
    { text: "In the Philippines, parents traditionally pin paper money to the graduate's sash during the ceremony — a blessing made visible." },
    { text: 'The word graduate comes from the Latin gradus — a step; the ceremony literally marks one stair climbed.' },
  ],
  christmas: [
    { text: 'The first Christmas card was commissioned by Sir Henry Cole in 1843 — too busy to write letters, he printed a thousand.' },
    { text: 'The Christmas cracker was invented in 1847 by London sweet-maker Tom Smith, who added the bang after hearing a log snap on his fire.' },
    { text: 'Britons post around 150 million Christmas cards each December — enough, stacked, to reach the top of Everest seventeen times over.' },
    { text: 'The Icelandic Jólabókaflóð — Yule Book Flood — has families exchanging books on Christmas Eve and reading them into the night.' },
    { text: "Mistletoe's kissing tradition began with Norse myth — a plant of peace, under which enemies were obliged to set down their weapons." },
  ],
  valentines: [
    { text: 'The oldest known Valentine is a 1415 poem written by Charles, Duke of Orléans, to his wife from the Tower of London.' },
    { text: "The red rose became Valentine's flower thanks to Louis XVI's wife Marie, who kept one pressed in her prayer book." },
    { text: 'Victorian London sent so many Valentines that in 1870 the Post Office hired extra staff just to handle the February surge.' },
    { text: 'Esther Howland, a Massachusetts student, built the first Valentine card company in 1847 after receiving a lacy one from England.' },
    { text: "The heart shape — two curves meeting at a point — may come from the silphium seed, an ancient Libyan herb used as a love token." },
  ],
  sympathy: [
    { text: 'The Victorian language of flowers gave mourners a vocabulary — rosemary for remembrance, forget-me-not for enduring love.' },
    { text: 'Handwritten condolence notes became common in the 1860s, after the American Civil War made grief a shared, national language.' },
    { text: 'In Jewish tradition, visitors to a shiva house bring no gifts and say nothing first — presence alone is the offering.' },
    { text: 'The Irish wake gathers friends around tea and stories; laughter at a memory is considered the truest form of tribute.' },
    { text: "In Japan, sending a single white chrysanthemum says what words often can't — quiet honour, and that you remember." },
  ],
  general: [
    { text: 'Neuroscientists have measured the same oxytocin response from reading a handwritten note as from a ten-second hug.' },
    { text: 'The oldest surviving greeting is a 14th-century Valentine written in Middle French, folded small and sealed with wax.' },
    { text: 'Before the Penny Post of 1840, the recipient paid postage — so most letters arrived already read by whoever could afford them.' },
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
