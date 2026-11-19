// shared/card-language.ts: the glue between the SA phrasebook
// (shared/sa-languages.ts, research-owned) and the three-card route.
//
// Two jobs, both pure so client, server and bench share one answer:
// 1. OCCASION KEYS. The brief carries the client's slug ('thankyou',
//    'baby'), the engine carries a label ("60th Birthday", "Mother's Day").
//    The phrasebook is keyed by its own slugs ('thank_you', 'new_baby'), so
//    every caller goes through phraseOccasionKey() before phraseFor().
// 2. THE READ-BACK COMPARISON for rendered text (renderHandler's safety
//    net): both sides normalised the same way, the intended words must
//    appear in what a vision model read off the image.

import { LANGUAGE_MODE, phraseFor, type CardLanguage, type Phrase } from './sa-languages';

export const CARD_LANGUAGE_IDS: readonly CardLanguage[] = ['en', 'af', 'zu', 'xh'];
export const isCardLanguage = (v: unknown): v is CardLanguage => typeof v === 'string' && (CARD_LANGUAGE_IDS as readonly string[]).includes(v);

/** Occasions that run the classic (humour-off) pipeline, which has no
 *  language path: they are written in English whatever was asked. */
const ENGLISH_ONLY_OCCASIONS = new Set(['sympathy']);

const OCCASION_ALIAS: Record<string, string> = {
  thankyou: 'thank_you', thanks: 'thank_you',
  baby: 'new_baby', newbaby: 'new_baby',
  mothersday: 'mothers_day', motheringsunday: 'mothers_day',
  fathersday: 'fathers_day',
  getwell: 'get_well', getwellsoon: 'get_well',
  newyear: 'new_year', newyears: 'new_year',
  valentine: 'valentines', valentinesday: 'valentines',
  congrats: 'congratulations',
  xmas: 'christmas',
};

/** The phrasebook's occasion key for a slug, a label or the engine's key. */
export function phraseOccasionKey(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim().toLowerCase().replace(/['’]/g, '').replace(/[\s-]+/g, '_');
  if (!t) return null;
  if (/birthday/.test(t)) return 'birthday';
  return OCCASION_ALIAS[t] ?? OCCASION_ALIAS[t.replace(/_/g, '')] ?? t;
}

/** The confirmed phrase for this language on this occasion, or null. */
export function cardPhraseFor(lang: CardLanguage, occasion: string | null | undefined): Phrase | null {
  return phraseFor(lang, phraseOccasionKey(occasion));
}

/** Whether the brief may offer this language for this occasion. English
 *  always; Afrikaans on every occasion the v2 engine writes; isiZulu and
 *  isiXhosa only where the phrasebook has a confirmed phrase. */
export function cardLanguageAvailable(lang: CardLanguage, occasion: string | null | undefined): boolean {
  if (lang === 'en') return true;
  // Afrikaans is HELD (2026-10-16): the first bench wrote English-style split
  // compounds ("tuin sentrum"), an English loanword and one non-word on the
  // insides, which the read-back can't catch (it checks spelling against
  // what was intended, not grammar). Re-open after the af block gains its
  // compound/loanword clause and the af sense pass reads insides too, and a
  // bench passes. The code path stays intact behind this line.
  if (lang === 'af') return false;
  const key = phraseOccasionKey(occasion);
  if (key && ENGLISH_ONLY_OCCASIONS.has(key)) return false;
  if (LANGUAGE_MODE[lang] === 'full') return true;
  return cardPhraseFor(lang, occasion) !== null;
}

/** Text as compared by the read-back check: Unicode NFC, lower case,
 *  curly apostrophes made straight, punctuation (except apostrophes)
 *  turned to spaces, whitespace collapsed. Diacritics are KEPT: "ê" and
 *  "e" are different letters in Afrikaans. */
export function normaliseForTextCheck(s: string): string {
  return s.normalize('NFC').toLowerCase()
    .replace(/[‘’ʼ`´]/g, "'")
    // ASCII and Latin-1 punctuation, general punctuation (dashes, quotes,
    // ellipsis); letters, accents and digits untouched. (No \p{…}: the
    // TS target predates the u flag.)
    .replace(/[!-&(-\/:-@[-`{-~\u00A1-\u00BF\u00D7\u00F7\u2010-\u2027\u2030-\u205E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when the intended words appear in the transcription. A second,
 *  space-blind comparison absorbs line breaks the type was stacked on
 *  ("lokuza- / lwa"); letters, accents and their order still have to match. */
export function textCheckPasses(expected: string, transcription: string): boolean {
  const e = normaliseForTextCheck(expected);
  const t = normaliseForTextCheck(transcription);
  if (!e) return true;
  if (t.includes(e)) return true;
  return t.replace(/\s/g, '').includes(e.replace(/\s/g, ''));
}
