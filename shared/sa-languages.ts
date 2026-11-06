// shared/sa-languages.ts: the languages a South African card can be written in.
//
// Aidan 2026-10-16: "I don't need native speakers to review, I'll trust you
// to make it work." So the design keeps the risky parts deterministic:
//
// - AFRIKAANS ('af'): the writer composes front and inside in Afrikaans.
// - isiZULU ('zu') and isiXHOSA ('xh'): BILINGUAL cards. The front's greeting
//   and the inside's opening line come VERBATIM from the phrasebook below and
//   are placed by CODE, never invented by the writer; the rest of the card is
//   English (code-switching is ordinary in South Africa).
// - Every phrase is cross-checked against at least two independent published
//   sources (URLs kept next to it). A phrase that could not be confirmed is
//   simply absent, and that occasion falls back to English for that language.
// - Rendered fronts in a non-English language are read back by a vision model
//   and compared with the intended words (server side); see the render route.
//
// Only used when the market is ZA.

export type CardLanguage = 'en' | 'af' | 'zu' | 'xh';

export const CARD_LANGUAGES: Array<{ id: CardLanguage; label: string; sub: string }> = [
  { id: 'en', label: 'English', sub: 'The whole card in English' },
  { id: 'af', label: 'Afrikaans', sub: 'The whole card in Afrikaans' },
  { id: 'zu', label: 'isiZulu', sub: 'The greeting in isiZulu, the message in English' },
  { id: 'xh', label: 'isiXhosa', sub: 'The greeting in isiXhosa, the message in English' },
];

/** How a language is used on the card. */
export const LANGUAGE_MODE: Record<CardLanguage, 'full' | 'greeting'> = {
  en: 'full',
  af: 'full',
  zu: 'greeting',
  xh: 'greeting',
};

/** Occasion keys match the engine's occasion slugs (lowercase, underscores). */
export type PhraseOccasion =
  | 'birthday'
  | 'anniversary'
  | 'wedding'
  | 'mothers_day'
  | 'fathers_day'
  | 'christmas'
  | 'new_year'
  | 'graduation'
  | 'congratulations'
  | 'thank_you'
  | 'get_well'
  | 'sympathy'
  | 'new_baby'
  | 'valentines';

export interface Phrase {
  /** Short greeting for the FRONT, exactly as it must be printed. */
  greeting: string;
  /** Opening line for the INSIDE, exactly as it must be printed. */
  opener: string;
  /** Plain English meaning, for the admin and the writer's context. */
  meaning: string;
  /** At least two independent sources that confirm the wording. */
  sources: string[];
}

/** Phrasebook: language → occasion → phrase. Filled by research; an absent
 *  entry means "not confirmed, fall back to English". */
// Afrikaans capitalisation (lead review 2026-10-16): in standard Afrikaans
// orthography only the first word and proper nouns take a capital. Named
// days (Kersfees, Nuwejaar, Moedersdag, Vadersdag, Valentynsdag) are proper
// nouns; "verjaarsdag" is not, so it is lower case even though some printed
// posters title-case it the English way.
export const PHRASEBOOK: Partial<Record<Exclude<CardLanguage, 'en'>, Partial<Record<PhraseOccasion, Phrase>>>> = {
  // ── AFRIKAANS: 10/14 confirmed. Omitted (no two independent sources with a
  //    set phrase): anniversary, wedding, graduation, new_baby. 'af' is a FULL
  //    language, so these are front-greeting anchors only; each opener is the
  //    greeting itself (the writer composes the inside in Afrikaans).
  //    Researched 2026-10-16.
  af: {
    // Variant: "Gelukkige verjaardag" (Maroela Media headline) is equally valid
    // Afrikaans; "verjaarsdag" is the majority form. Title case as printed by
    // Omniglot, Depicta and Country Crafts (Wiktionary lists it in lowercase).
    birthday: {
      greeting: 'Gelukkige verjaarsdag',
      opener: 'Gelukkige verjaarsdag',
      meaning: 'Happy birthday',
      sources: [
        'https://www.omniglot.com/language/phrases/afrikaans.php',
        'https://www.depicta.co.za/products/verjaarsdagkaart-voels',
        'https://country-crafts.co.za/product/gelukkige-verjaarsdag/',
        'https://en.wiktionary.org/wiki/happy_birthday',
      ],
    },
    mothers_day: {
      greeting: 'Gelukkige Moedersdag',
      opener: 'Gelukkige Moedersdag',
      meaning: "Happy Mother's Day",
      sources: [
        'https://maroelamedia.co.za/nuus/nuuskommentaar/tekenprent-gelukkige-moedersdag/',
        'https://country-crafts.co.za/product/gelukkige-moedersdag/',
        'https://easyonthetongue.com/moedersdag-boodskappe/',
        'https://aanlyn.solidariteit.co.za/publieke/artikel/aan-my-liefste-moeder',
      ],
    },
    fathers_day: {
      greeting: 'Gelukkige Vadersdag',
      opener: 'Gelukkige Vadersdag',
      meaning: "Happy Father's Day",
      sources: [
        'https://maroelamedia.co.za/nuus/wereld/britse-koninklikes-gelukkige-vadersdag-pa/',
        'https://country-crafts.co.za/product/gelukkige-vadersdag/',
        'https://easyonthetongue.com/gelukkige-vadersdag-boodskappe/',
      ],
    },
    // Kersfees always takes a capital (AWS 9.3, per Maroela Media's language desk).
    christmas: {
      greeting: 'Geseënde Kersfees',
      opener: 'Geseënde Kersfees',
      meaning: 'Merry Christmas (literally "blessed Christmas")',
      sources: [
        'https://www.omniglot.com/language/phrases/afrikaans.php',
        'https://face2faceafrica.com/article/here-are-25-african-ways-of-saying-merry-christmas',
        'https://maroelamedia.co.za/afrikaans/taalgebruik/n-geseende-en-voorspoedige/',
        'https://aanlyn.solidariteit.co.za/publieke/artikel/kersfees-christus-ons-verlosser',
      ],
    },
    // Variant: "Gelukkige Nuwe Jaar" (Omniglot, Linguanaut, News24). Chose
    // "Nuwejaar": the festival is a proper noun written as one word (AWS, per
    // Maroela Media's language desk), and it is the form in Wiktionary and in
    // Afrikaans media (Solidariteit headline, Maroela Media).
    new_year: {
      greeting: 'Gelukkige Nuwejaar',
      opener: 'Gelukkige Nuwejaar',
      meaning: 'Happy New Year',
      sources: [
        'https://aanlyn.solidariteit.co.za/publieke/artikel/gelukkige-nuwejaar-n-nuwe-jaar-bring-vir-ons-die-kans-om-nuut-te-begin-n-nuwe-begin-gevul-met-hoop-en-geleenthede',
        'https://maroelamedia.co.za/goeiegoed/goeie-nuus/gebed-vir-my-moeder/',
        'https://en.wiktionary.org/wiki/happy_New_Year',
      ],
    },
    // Variant: "Veels geluk!" (North West Dept of Education Gr 10 lessons) is
    // equally standard; "Baie geluk!" has more sources.
    congratulations: {
      greeting: 'Baie geluk!',
      opener: 'Baie geluk!',
      meaning: 'Congratulations!',
      sources: [
        'https://www.omniglot.com/language/phrases/afrikaans.php',
        'https://www.netwerk24.com/huisgenoot/nuus/gesogte-veertjies-beloon-diegene-wat-die-afrikaanse-beiteltjies-help-slyp-20170528',
        'https://country-crafts.co.za/product/baie-geluk/',
      ],
    },
    thank_you: {
      greeting: 'Baie dankie',
      opener: 'Baie dankie',
      meaning: 'Thank you very much',
      sources: [
        'https://www.omniglot.com/language/phrases/afrikaans.php',
        'https://dsae.co.za/entry/dankie/e01909',
        'https://en.wiktionary.org/wiki/thank_you',
        'https://country-crafts.co.za/product/baie-dankie/',
      ],
    },
    get_well: {
      greeting: 'Word gou gesond',
      opener: 'Word gou gesond',
      meaning: 'Get well soon',
      sources: [
        'https://www.omniglot.com/language/phrases/getwellsoon.htm',
        'https://maroelamedia.co.za/nuus/sa-nuus/steve-hofmeyr-wonderwerk-dat-ek-leef/',
      ],
    },
    // Variant: "Innige meegevoel" (Country Crafts stamp) is also standard.
    sympathy: {
      greeting: 'Innige simpatie',
      opener: 'Innige simpatie',
      meaning: 'Heartfelt sympathy',
      sources: [
        'https://maroelamedia.co.za/nuus/sa-nuus/bloem-se-inspirasievrou-sterf/',
        'https://www.citizen.co.za/rekord/457847/affies-meisie-17-oorlede-aan-hartkondisie/',
        'https://www.netwerk24.com/huisgenoot/nuus/jou-storie/leser-skryf-aan-hg-innige-simpatie-aan-maj-tolla-pieterse-se-vrou-20240821',
        'https://www.litnet.co.za/piet-rympies-swanepoel-huldeblyk-aan-pa/',
      ],
    },
    valentines: {
      greeting: 'Gelukkige Valentynsdag',
      opener: 'Gelukkige Valentynsdag',
      meaning: "Happy Valentine's Day",
      sources: [
        'https://www.netwerk24.com/netwerk24/nuus/aktueel/groot-baklei-en-toe-gelukkige-valentynsdag-meneer-20240215',
        'https://www.litnet.co.za/valentynsdagkompetisie-finaliste-en-wenner-aangekondig/',
        'https://aanlyn.solidariteit.co.za/publieke/artikel/n-liefdesgids-vir-die-perfekte-valentynsdag',
      ],
    },
  },

  // ── isiZULU: 5/14 confirmed (birthday, christmas, new_year, congratulations,
  //    thank_you). Omitted: anniversary, wedding, mothers_day, fathers_day,
  //    graduation, valentines, new_baby (no attested set phrase); get_well
  //    ("Phila masinya" is in Omniglot only; the other pages that show it copy
  //    Omniglot's table); sympathy ("Ngiyakuzwela impela" is in Unisa's course
  //    only, and the stem is glossed "what a pity" elsewhere). Openers equal the
  //    greeting except thank_you. Researched 2026-10-16.
  zu: {
    birthday: {
      greeting: 'Halala ngosuku lokuzalwa',
      opener: 'Halala ngosuku lokuzalwa',
      meaning: 'Happy birthday (literally "congratulations on the day of birth")',
      sources: [
        'https://www.omniglot.com/language/phrases/zulu.php',
        'https://www.linguanaut.com/learn-zulu/phrases.php',
        'http://www.omegawiki.org/Expression:halala_ngosuku_lokuzalwa',
      ],
    },
    // Variants: "Ukhisimusi omuhle" (The Citizen / Caxton "Season's greetings
    // in all 11 languages"), "uKhisimusi oMuhle" (Wiktionary). Same words; chose
    // the capitalisation of standard Zulu orthography for a sentence-initial
    // proper noun (prefix and stem both capitalised, cf. Wiktionary's lemma
    // uKhisimusi).
    christmas: {
      greeting: 'UKhisimusi omuhle',
      opener: 'UKhisimusi omuhle',
      meaning: 'Merry Christmas (literally "a good Christmas")',
      sources: [
        'https://www.linguanaut.com/learn-zulu/phrases.php',
        'https://face2faceafrica.com/article/here-are-25-african-ways-of-saying-merry-christmas',
      ],
    },
    new_year: {
      greeting: 'Unyaka omusha omuhle',
      opener: 'Unyaka omusha omuhle',
      meaning: 'Happy New Year (literally "a good new year")',
      sources: [
        'https://www.omniglot.com/language/phrases/zulu.php',
        'https://www.linguanaut.com/learn-zulu/phrases.php',
      ],
    },
    congratulations: {
      greeting: 'Halala!',
      opener: 'Halala!',
      meaning: 'Congratulations!',
      sources: [
        'https://www.unisa.ac.za/static/corporate_web/Content/UnisaOpen/freeOnlineCourse/PDF/Zulu/Learn%20online%20Zulu%20-%20Theme%207.pdf',
        'https://dsae.co.za/entry/halala/e10089',
        'https://en.wiktionary.org/wiki/congratulations',
      ],
    },
    thank_you: {
      greeting: 'Ngiyabonga',
      opener: 'Ngiyabonga kakhulu',
      meaning: 'Thank you (opener: "Thank you very much")',
      sources: [
        'https://www.unisa.ac.za/static/corporate_web/Content/UnisaOpen/freeOnlineCourse/PDF/Zulu/Learn%20online%20Zulu%20-%20Theme%201.pdf',
        'https://www.omniglot.com/language/phrases/zulu.php',
        'https://en.wiktionary.org/wiki/ngiyabonga',
        'https://en.wikivoyage.org/wiki/Zulu_phrasebook',
      ],
    },
  },

  // ── isiXHOSA: 3/14 confirmed (christmas, congratulations, thank_you).
  //    Omitted: birthday (sources genuinely disagree on the written form:
  //    "Min'emnandi kuwe" / "Umin' emnandi kuwe" / "'Mini emnandi kuwe" /
  //    "Mini emnandi kuwe" / "Imini emandi kuwe"); new_year (no standalone
  //    greeting attested twice; only inside longer Christmas+New Year lines);
  //    get_well ("Uphile kamsinyane" in Omniglot only); sympathy ("Ndiyavelana
  //    nawe" in Unisa's course only); anniversary, wedding, mothers_day,
  //    fathers_day, graduation, valentines, new_baby (no attested set phrase).
  //    Openers equal the greeting except thank_you. Researched 2026-10-16.
  xh: {
    // Variants: "iKrisimesi emnandi" (Omniglot, with the noun prefix) and
    // "Krismesi emnandi" (face2faceafrica). "Krisimesi" is the majority spelling.
    christmas: {
      greeting: 'Krisimesi emnandi',
      opener: 'Krisimesi emnandi',
      meaning: 'Merry Christmas (literally "a pleasant Christmas")',
      sources: [
        'https://www.citizen.co.za/review-online/news-headlines/2017/12/24/seasons-greetings-11-languages/',
        'https://xhosa.mofeko.com/phrases.html',
        'https://www.omniglot.com/language/phrases/xhosa.php',
      ],
    },
    // Variant: Omniglot gives "Huntshu!"; Unisa, IsiXhosa.click and DSAE all give "Halala!".
    congratulations: {
      greeting: 'Halala!',
      opener: 'Halala!',
      meaning: 'Congratulations!',
      sources: [
        'https://www.unisa.ac.za/static/corporate_web/Content/UnisaOpen/freeOnlineCourse/PDF/Xhosa/Learn%20online%20Xhosa%20-%20Theme%207.pdf',
        'https://isixhosa.click/word/187',
        'https://dsae.co.za/entry/halala/e10089',
      ],
    },
    // "Ndiyabulela" (Unisa, Omniglot) is the other standard "thank you";
    // "Enkosi" is the more common everyday form.
    thank_you: {
      greeting: 'Enkosi',
      opener: 'Enkosi kakhulu',
      meaning: 'Thank you (opener: "Thank you very much")',
      sources: [
        'https://isixhosa.click/word/774',
        'https://dsae.co.za/entry/enkosi/e02264',
        'https://www.omniglot.com/language/phrases/xhosa.php',
        'https://en.wikivoyage.org/wiki/Xhosa_phrasebook',
      ],
    },
  },
};

/** The confirmed phrase for a language + occasion, or null (→ English). */
export function phraseFor(lang: CardLanguage, occasion: string | null | undefined): Phrase | null {
  if (lang === 'en' || !occasion) return null;
  const key = occasion.trim().toLowerCase().replace(/['’]/g, '').replace(/[\s-]+/g, '_') as PhraseOccasion;
  return PHRASEBOOK[lang]?.[key] ?? null;
}

/** True when this language + occasion can be offered (full languages always
 *  can; greeting languages only with a confirmed phrase). */
export function languageAvailable(lang: CardLanguage, occasion: string | null | undefined): boolean {
  if (LANGUAGE_MODE[lang] === 'full') return true;
  return phraseFor(lang, occasion) !== null;
}
