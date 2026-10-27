import { mod12, noteName } from './notes.js';

// Keyed by parent mode, then by semitones above the tonic. Only notes outside
// the parent scale need an entry.
const TEXTS = {
  major: {
    1: 'b2: outside the major scale. It is usually a chromatic passing tone, or the 3rd of V/ii.',
    3: 'b3: borrowed from the parallel minor. It is also the "blue" minor 3rd over a major key.',
    6: '#4/b5: the tritone above the tonic. As #4 it is the leading tone to V (heard in V/V). As b5 it is the blue note.',
    8: 'b6: borrowed from the parallel minor. It gives iv and bVI their darker colour.',
    10: 'b7: borrowed from the parallel minor (bVII), or the 7th of I7 acting as V/IV.',
  },
  minor: {
    1: 'b2: the Phrygian/Neapolitan note, usually a chromatic passing tone.',
    4: 'Major 3rd: comes from the parallel major (a "Picardy third"). It is also the 3rd of V/iv.',
    6: '#4/b5: the tritone. As #4 it leads to v (V/v). As b5 it is the blue note of the blues scale.',
    9: 'Major 6th: comes from the parallel major (the Dorian sound) and makes IV major.',
    11: 'Major 7th: the leading tone of harmonic minor. It makes V major and vii° diminished.',
  },
};

/** Why `pc` is outside the key's parent scale, and how it is usually used. */
export function explain(key, pc, { isBlueNote = false, note } = {}) {
  const distance = mod12(pc - key.rootPc);
  const text = TEXTS[key.parent][distance] ?? 'A chromatic note outside the key.';
  const name = note ? `${noteName(note)} is the ` : '';
  const body = name ? text.charAt(0).toLowerCase() + text.slice(1) : text;
  return (isBlueNote ? 'Blue note: ' : '') + name + body;
}
