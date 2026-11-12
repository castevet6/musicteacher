// Words for the progression analysis, in two levels ('beginner' and
// 'intermediate') and two languages. The wording lives in text/en.js and
// text/fi.js; these are the entry points the UI and tests use.

import { textFor } from './text/index.js';

export const LEVELS = ['beginner', 'intermediate'];

export const functionText = (analysis, key, level, lang) => textFor(lang).functionText(analysis, key, level);
export const adviceText = (item, level, lang) => textFor(lang).adviceText(item, level);
export const cadenceText = (cadence, slots, level, lang) => textFor(lang).cadenceText(cadence, slots, level);
export const reasonText = (reason, level, lang) => textFor(lang).reasonText(reason, level);
export const tierText = (tier, level, lang) => textFor(lang).tierText(tier, level);
export const avoidReasonText = (info, level, lang) => textFor(lang).avoidReasonText(info, level);
export const guideToneText = (move, from, to, level, lang) => textFor(lang).guideToneText(move, from, to, level);
export const noteOverChordText = (info, chord, level, lang) => textFor(lang).noteOverChordText(info, chord, level);
export const critiqueName = (rule, level, lang) => textFor(lang).critiqueName(rule, level);
export const critiqueText = (item, level, lang) => textFor(lang).critiqueText(item, level);
export const ghostReasonText = (reason, level, lang) => textFor(lang).ghostReasonText(reason, level);
export const rankReasonText = (reason, level, lang) => textFor(lang).rankReasonText(reason, level);
