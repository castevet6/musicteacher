import { LETTERS, letterAt, mod, mod12, noteName, pcOf, prettyName, spellPcWithLetter } from './notes.js';

export const CHORD_QUALITIES = {
  maj: { symbol: '', intervals: [0, 4, 7] },
  min: { symbol: 'm', intervals: [0, 3, 7] },
  dim: { symbol: 'dim', intervals: [0, 3, 6] },
  aug: { symbol: 'aug', intervals: [0, 4, 8] },
  maj7: { symbol: 'maj7', intervals: [0, 4, 7, 11] },
  dom7: { symbol: '7', intervals: [0, 4, 7, 10] },
  min7: { symbol: 'm7', intervals: [0, 3, 7, 10] },
  m7b5: { symbol: 'm7b5', intervals: [0, 3, 6, 10] },
  dim7: { symbol: 'dim7', intervals: [0, 3, 6, 9] },
  mMaj7: { symbol: 'mMaj7', intervals: [0, 3, 7, 11] },
};

export const ROLES = ['R', '3', '5', '7'];

const QUALITY_BY_INTERVALS = Object.fromEntries(
  Object.entries(CHORD_QUALITIES).map(([id, q]) => [q.intervals.join(','), id]),
);

/** Build a chord by stacking letters on the root, so Bb7 is Bb–D–F–Ab. */
export function buildChord(root, qualityId) {
  const rootPc = pcOf(root);
  const tones = CHORD_QUALITIES[qualityId].intervals.map((iv, i) => ({
    note: spellPcWithLetter(mod12(rootPc + iv), letterAt(root.letter, i * 2)),
    role: ROLES[i],
  }));
  return {
    root,
    quality: qualityId,
    tones,
    pcs: tones.map((t) => pcOf(t.note)),
    symbol: noteName(root) + CHORD_QUALITIES[qualityId].symbol,
  };
}

/** Quality id for spelled notes stacked in thirds, root first. */
export function qualityOf(notes) {
  const rootPc = pcOf(notes[0]);
  const intervals = notes.map((note) => mod12(pcOf(note) - rootPc));
  const id = QUALITY_BY_INTERVALS[intervals.join(',')];
  if (!id) throw new Error(`Unknown chord quality: ${intervals}`);
  return id;
}

export function chordFromNotes(notes) {
  return buildChord(notes[0], qualityOf(notes));
}

/** Chord symbol for display, with accidental glyphs: "B♭7", or "B7" in Finnish. */
export const chordLabel = (chord, lang = 'en') =>
  prettyName(chord.root, lang) + CHORD_QUALITIES[chord.quality].symbol.replace('b5', '♭5');

export const containsPc = (chord, pc) => chord.pcs.includes(pc);

export function roleOf(chord, pc) {
  return chord.tones.find((t) => pcOf(t.note) === pc)?.role ?? null;
}

/** MIDI notes for a close-position voicing, root in the octave starting at `lowest`. */
export function closeVoicing(chord, lowest = 48) {
  const midis = [];
  for (const pc of chord.pcs) {
    let midi = lowest + mod12(pc - lowest);
    while (midis.length && midi <= midis.at(-1)) midi += 12;
    midis.push(midi);
  }
  return midis;
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
const UPPER_QUALITIES = new Set(['maj', 'aug', 'maj7', 'dom7']);
const NUMERAL_SUFFIX = {
  maj: '', min: '', dim: '°', aug: '+',
  maj7: 'maj7', dom7: '7', min7: '7', m7b5: 'ø7', dim7: '°7', mMaj7: '(maj7)',
};

/**
 * Roman numeral measured against the key's parent scale: the degree comes from
 * the letter distance, a b/# prefix marks a root outside the parent scale.
 */
export function romanNumeral(chord, key) {
  const degree = mod(LETTERS.indexOf(chord.root.letter) - LETTERS.indexOf(key.tonic.letter), 7);
  let diff = mod12(pcOf(chord.root) - pcOf(key.parentNotes[degree]));
  if (diff > 6) diff -= 12;
  const prefix = diff < 0 ? 'b'.repeat(-diff) : '#'.repeat(diff);
  const numeral = UPPER_QUALITIES.has(chord.quality) ? NUMERALS[degree] : NUMERALS[degree].toLowerCase();
  return prefix + numeral + NUMERAL_SUFFIX[chord.quality];
}

/** Triad and seventh chord on each degree of a 7-note scale, in degree order. */
export function chordsOfScale(notes, degrees = [0, 1, 2, 3, 4, 5, 6]) {
  const at = (i) => notes[i % 7];
  return degrees.flatMap((d) => [
    { degree: d, kind: 'triad', chord: chordFromNotes([at(d), at(d + 2), at(d + 4)]) },
    { degree: d, kind: 'seventh', chord: chordFromNotes([at(d), at(d + 2), at(d + 4), at(d + 6)]) },
  ]);
}

export function diatonicChords(key) {
  return chordsOfScale(key.parentNotes).map((entry) => ({
    ...entry,
    roman: romanNumeral(entry.chord, key),
  }));
}
