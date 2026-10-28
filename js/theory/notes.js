// Pitch classes, spelled notes and MIDI helpers.
// A spelled note is { letter: 'C'..'B', acc: -2..2 } where -1 = flat, +1 = sharp.

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export const mod = (n, m) => ((n % m) + m) % m;
export const mod12 = (n) => mod(n, 12);

export function pcOf({ letter, acc }) {
  return mod12(LETTER_PC[letter] + acc);
}

/** The spelling of `pc` that uses `letter`, e.g. (10, 'A') → A#, (10, 'B') → Bb. */
export function spellPcWithLetter(pc, letter) {
  let acc = mod12(pc - LETTER_PC[letter]);
  if (acc > 6) acc -= 12;
  return { letter, acc };
}

/** The letter `steps` letters above `letter`, wrapping G → A. */
export function letterAt(letter, steps) {
  return LETTERS[mod(LETTERS.indexOf(letter) + steps, 7)];
}

export function sameNote(a, b) {
  return a.letter === b.letter && a.acc === b.acc;
}

/** ASCII name used in data and tests: "Bb", "F#", "Ebb". */
export function noteName({ letter, acc }) {
  return letter + (acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc));
}

/**
 * Display name with real accidental glyphs: "B♭", "F♯", "F𝄪". In Finnish the
 * natural B is H and B♭ is B, so "B♭" shows as "B" and "B𝄫" as "B♭".
 */
export function prettyName({ letter, acc }, lang = 'en') {
  const glyphs = { '-2': '𝄫', '-1': '♭', 0: '', 1: '♯', 2: '𝄪' };
  if (lang === 'fi' && letter === 'B') {
    if (acc === -1) return 'B';
    if (acc === -2) return 'B♭';
    return 'H' + glyphs[acc];
  }
  return letter + (glyphs[acc] ?? noteName({ letter: '', acc }));
}

const n = (letter, acc = 0) => ({ letter, acc });

const DEFAULT_SPELLINGS = {
  sharps: [n('C'), n('C', 1), n('D'), n('D', 1), n('E'), n('F'), n('F', 1), n('G'), n('G', 1), n('A'), n('A', 1), n('B')],
  flats: [n('C'), n('D', -1), n('D'), n('E', -1), n('E'), n('F'), n('G', -1), n('G'), n('A', -1), n('A'), n('B', -1), n('B')],
  // Keys without accidentals (C major, A minor) use the most common names.
  neutral: [n('C'), n('C', 1), n('D'), n('E', -1), n('E'), n('F'), n('F', 1), n('G'), n('A', -1), n('A'), n('B', -1), n('B')],
};

/** Spelling for a pitch class with no key or chord context. */
export function defaultSpelling(pc, accidentals = 'neutral') {
  return DEFAULT_SPELLINGS[accidentals][mod12(pc)];
}

export const midiToPc = (midi) => mod12(midi);
export const midiToFreq = (midi) => 440 * 2 ** ((midi - 69) / 12);
