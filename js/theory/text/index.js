// Language bundles for the words the theory modules produce.

import { en } from './en.js';
import { fi } from './fi.js';

export const LANGS = ['en', 'fi'];
export const DEFAULT_LANG = 'en';

const BUNDLES = { en, fi };

/** The text bundle for `lang`; unknown languages fall back to English. */
export const textFor = (lang) => BUNDLES[lang] ?? en;

/** "parallel major / harmonic minor" in `lang`; the ids come from suggest.js and analysis.js. */
export const sourceLabel = (label, lang) =>
  label.split(' / ').map((id) => textFor(lang).sourceLabels[id] ?? id).join(' / ');
