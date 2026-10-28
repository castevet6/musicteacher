// Chord progressions. A progression chord is stored relative to the tonic as
// { steps, semis, quality }: letter steps and semitones above the tonic. A new
// root transposes it, and spelling still comes from letters.

import { buildChord } from './chords.js';
import { LETTERS, letterAt, mod, mod12, pcOf, spellPcWithLetter } from './notes.js';
import { PARENT_INTERVALS } from './scales.js';
import { textFor } from './text/index.js';

export const MAX_BARS = 16;

/** The absolute chord for a relative chord in `key`. */
export function resolveChord(key, rel) {
  const root = spellPcWithLetter(mod12(key.rootPc + rel.semis), letterAt(key.tonic.letter, rel.steps));
  return buildChord(root, rel.quality);
}

/** The relative form of an absolute chord, measured from the key's tonic. */
export function toRelative(key, chord) {
  return {
    steps: mod(LETTERS.indexOf(chord.root.letter) - LETTERS.indexOf(key.tonic.letter), 7),
    semis: mod12(pcOf(chord.root) - key.rootPc),
    quality: chord.quality,
  };
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const UPPER_SUFFIX = { '': 'maj', 7: 'dom7', maj7: 'maj7', '+': 'aug' };
const LOWER_SUFFIX = { '': 'min', 7: 'min7', '°': 'dim', '°7': 'dim7', 'ø7': 'm7b5', '(maj7)': 'mMaj7' };

/**
 * A Roman numeral such as "bVII7", "#vi" or "viiø7" as a relative chord. The
 * degree is measured against the major or minor scale `mode`; the inverse of
 * romanNumeral() in chords.js.
 */
export function parseNumeral(text, mode) {
  const match = /^([b#]*)([IViv]+)(.*)$/.exec(text);
  const degree = match && NUMERALS.indexOf(match[2].toUpperCase());
  if (!match || degree < 0) throw new Error(`Unknown numeral: ${text}`);
  const [, accidentals, numeral, suffix] = match;
  const upper = numeral === numeral.toUpperCase();
  if (!upper && numeral !== numeral.toLowerCase()) throw new Error(`Mixed case numeral: ${text}`);
  const quality = (upper ? UPPER_SUFFIX : LOWER_SUFFIX)[suffix];
  if (!quality) throw new Error(`Unknown numeral suffix: ${text}`);
  const shift = [...accidentals].reduce((sum, c) => sum + (c === '#' ? 1 : -1), 0);
  return { steps: degree, semis: mod12(PARENT_INTERVALS[mode][degree] + shift), quality };
}

// A bar is one numeral, or two for a bar split into halves. Each preset is
// read in its own mode, so a minor preset in a major key comes out borrowed.
export const PRESETS = {
  pop: { mode: 'major', bars: ['I', 'V', 'vi', 'IV'] },
  doowop: { mode: 'major', bars: ['I', 'vi', 'IV', 'V'] },
  twoFiveOne: { mode: 'major', bars: ['ii7', 'V7', 'Imaj7', 'Imaj7'] },
  turnaround: { mode: 'major', bars: [['Imaj7', 'vi7'], ['ii7', 'V7']] },
  blues: {
    mode: 'major',
    bars: ['I7', 'I7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
  },
  andalusian: { mode: 'minor', bars: ['i', 'VII', 'VI', 'V'] },
  minorPop: { mode: 'minor', bars: ['i', 'VI', 'III', 'VII'] },
};

export const presetLabel = (id, lang) => textFor(lang).presetLabels[id];

export function presetProgression(id) {
  const { mode, bars } = PRESETS[id];
  return {
    bars: bars.map((bar) => ({ chords: [bar].flat().map((numeral) => parseNumeral(numeral, mode)) })),
  };
}

export function emptyProgression(barCount = 4) {
  return { bars: Array.from({ length: barCount }, () => ({ chords: [null] })) };
}

/** Add empty bars or drop bars from the end, keeping 1 to MAX_BARS. */
export function resizeProgression(progression, barCount) {
  const count = Math.max(1, Math.min(MAX_BARS, barCount));
  const bars = progression.bars.slice(0, count);
  while (bars.length < count) bars.push({ chords: [null] });
  return { bars };
}

/** Split a bar into two halves, or join the halves back into one chord. */
export function toggleSplit(progression, barIndex) {
  return {
    bars: progression.bars.map((bar, i) => {
      if (i !== barIndex) return bar;
      return { chords: bar.chords.length === 1 ? [bar.chords[0], null] : [bar.chords[0] ?? bar.chords[1]] };
    }),
  };
}

/** A copy of the progression with the chord at `addr` replaced. */
export function setChordAt(progression, { bar, half }, rel) {
  return {
    bars: progression.bars.map((b, i) =>
      (i === bar ? { chords: b.chords.map((c, h) => (h === half ? rel : c)) } : b)),
  };
}

/** The slot after `addr`, or null at the end of the progression. */
export function nextAddress(progression, { bar, half }) {
  if (half + 1 < (progression.bars[bar]?.chords.length ?? 0)) return { bar, half: half + 1 };
  return bar + 1 < progression.bars.length ? { bar: bar + 1, half: 0 } : null;
}

export const sameAddress = (a, b) => Boolean(a && b) && a.bar === b.bar && a.half === b.half;

/** Every chord slot in order, with its length in beats (4/4) and its chord in `key`. */
export function flattenSlots(key, progression) {
  return progression.bars.flatMap((bar, barIndex) =>
    bar.chords.map((rel, half) => ({
      bar: barIndex,
      half,
      beats: 4 / bar.chords.length,
      rel,
      chord: rel ? resolveChord(key, rel) : null,
    })))
    .map((slot, index) => ({ ...slot, index }));
}
