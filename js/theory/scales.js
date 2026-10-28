import { LETTERS, letterAt, mod12, pcOf, prettyName, spellPcWithLetter } from './notes.js';
import { textFor } from './text/index.js';

export const PARENT_INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
};

// `degrees` index into the 7 notes of the parent scale, so every scale inherits
// the parent's spelling. `blueNote` adds the lowered 5th of the parent.
export const SCALES = {
  major: { parent: 'major', degrees: [0, 1, 2, 3, 4, 5, 6] },
  naturalMinor: { parent: 'minor', degrees: [0, 1, 2, 3, 4, 5, 6] },
  majorPentatonic: { parent: 'major', degrees: [0, 1, 2, 4, 5] },
  minorPentatonic: { parent: 'minor', degrees: [0, 2, 3, 4, 6] },
  blues: { parent: 'minor', degrees: [0, 2, 3, 4, 6], blueNote: true },
};

const ROOT_NOTES = [
  [{ letter: 'C', acc: 0 }],
  [{ letter: 'C', acc: 1 }, { letter: 'D', acc: -1 }],
  [{ letter: 'D', acc: 0 }],
  [{ letter: 'D', acc: 1 }, { letter: 'E', acc: -1 }],
  [{ letter: 'E', acc: 0 }],
  [{ letter: 'F', acc: 0 }],
  [{ letter: 'F', acc: 1 }, { letter: 'G', acc: -1 }],
  [{ letter: 'G', acc: 0 }],
  [{ letter: 'G', acc: 1 }, { letter: 'A', acc: -1 }],
  [{ letter: 'A', acc: 0 }],
  [{ letter: 'A', acc: 1 }, { letter: 'B', acc: -1 }],
  [{ letter: 'B', acc: 0 }],
];

/** Choice in the root menu: "C♯/D♭" (Finnish "C♯/D"; B is H). */
export const rootLabel = (pc, lang) => ROOT_NOTES[pc].map((note) => prettyName(note, lang)).join('/');

/** The 7 notes of a major or natural minor scale, one letter per degree. */
export function spellParentScale(tonic, parent) {
  const tonicPc = pcOf(tonic);
  return PARENT_INTERVALS[parent].map((iv, i) =>
    spellPcWithLetter(mod12(tonicPc + iv), letterAt(tonic.letter, i)),
  );
}

const accidentalCount = (notes) => notes.reduce((sum, note) => sum + Math.abs(note.acc), 0);

/**
 * Pick the tonic spelling whose parent scale has the fewest accidentals and no
 * double accidentals. Ties go to sharps (F# major, D# minor). A `preferred`
 * letter wins whenever it gives such a scale, so Eb major switched to minor
 * stays Eb minor.
 */
function chooseTonic(rootPc, parent, preferred) {
  if (preferred) {
    const tonic = spellPcWithLetter(rootPc, preferred);
    const notes = spellParentScale(tonic, parent);
    if (notes.every((note) => Math.abs(note.acc) <= 1)) return { tonic, notes };
  }
  let best = null;
  for (const letter of LETTERS) {
    const tonic = spellPcWithLetter(rootPc, letter);
    if (Math.abs(tonic.acc) > 1) continue;
    const notes = spellParentScale(tonic, parent);
    if (notes.some((note) => Math.abs(note.acc) > 1)) continue;
    const count = accidentalCount(notes);
    const sharp = notes.some((note) => note.acc > 0);
    if (!best || count < best.count || (count === best.count && sharp && !best.sharp)) {
      best = { tonic, notes, count, sharp };
    }
  }
  return best;
}

/** The key on `rootPc`. `tonicLetter` keeps an existing spelling of the tonic when it still works. */
export function buildKey(rootPc, scaleId, tonicLetter = null) {
  const scale = SCALES[scaleId];
  const { tonic, notes: parentNotes } = chooseTonic(mod12(rootPc), scale.parent, tonicLetter);

  const scaleNotes = scale.degrees.map((i) => parentNotes[i]);
  let blueNote = null;
  if (scale.blueNote) {
    const fifth = parentNotes[4];
    blueNote = { letter: fifth.letter, acc: fifth.acc - 1 };
    // Sits between the 4th and the 5th.
    scaleNotes.splice(scaleNotes.indexOf(fifth), 0, blueNote);
  }

  let accidentals = 'neutral';
  if (parentNotes.some((note) => note.acc < 0)) accidentals = 'flats';
  else if (parentNotes.some((note) => note.acc > 0)) accidentals = 'sharps';

  return {
    rootPc: mod12(rootPc),
    scaleId,
    tonic,
    parent: scale.parent,
    parentNotes,
    scaleNotes,
    scalePcs: new Set(scaleNotes.map(pcOf)),
    parentPcs: new Set(parentNotes.map(pcOf)),
    blueNotePc: blueNote ? pcOf(blueNote) : null,
    accidentals,
  };
}

/** Name of a scale, from the language's text bundle. */
export const scaleLabel = (scaleId, lang) => textFor(lang).scaleLabels[scaleId];

/** "C major" (Finnish "C-duuri"), with display glyphs in the note name. */
export function keyLabel(key, lang) {
  return textFor(lang).keyLabel(prettyName(key.tonic, lang), key.scaleId);
}

/** The key as a phrase for "in": "in C major" ("C-duurissa"). */
export function keyIn(key, lang) {
  return textFor(lang).keyIn(prettyName(key.tonic, lang), key.scaleId);
}

/** Heading for a clicked note: "In C major" or "Not in C major". */
export function noteStatus(inScale, key, lang) {
  return textFor(lang).noteStatus(inScale, prettyName(key.tonic, lang), key.scaleId);
}

export function isGapScale(key) {
  return SCALES[key.scaleId].degrees.length < 7;
}
