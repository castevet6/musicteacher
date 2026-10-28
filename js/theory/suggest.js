import { buildChord, chordsOfScale, containsPc, diatonicChords, roleOf, romanNumeral } from './chords.js';
import { explain } from './explain.js';
import { defaultSpelling, letterAt, mod12, pcOf, spellPcWithLetter } from './notes.js';
import { SCALES, spellParentScale } from './scales.js';

const GROUP_TITLES = {
  diatonic: 'Diatonic chords',
  borrowed: 'Borrowed chords',
  secondary: 'Secondary dominants',
  chromatic: 'Chromatic chords',
};

function toSuggestion(chord, roman, source, key, pc) {
  return {
    id: `${source}:${chord.symbol}:${roman}`,
    symbol: chord.symbol,
    roman,
    source,
    tones: chord.tones,
    roleOfSelected: roleOf(chord, pc),
    fitsScale: chord.pcs.every((p) => key.scalePcs.has(p)),
    chord,
  };
}

/**
 * Parallel-key chords: a major key borrows from the parallel natural minor;
 * a minor key from the parallel major plus harmonic minor's V, V7 and vii°7.
 */
export function borrowedChords(key) {
  const otherParent = key.parent === 'major' ? 'minor' : 'major';
  const parallel = chordsOfScale(spellParentScale(key.tonic, otherParent)).map((e) => ({
    chord: e.chord,
    source: `parallel ${otherParent}`,
  }));
  if (key.parent === 'major') return parallel;
  return [...parallel, ...harmonicMinorChords(key)];
}

/** The raised 7th of harmonic minor gives a minor key its V, V7 and vii°7. */
export function harmonicMinorChords(key) {
  if (key.parent !== 'minor') return [];
  const harmonic = key.parentNotes.map((note, i) => (i === 6 ? { ...note, acc: note.acc + 1 } : note));
  return chordsOfScale(harmonic, [4, 6])
    .filter((e) => !(e.degree === 6 && e.kind === 'triad'))
    .map((e) => ({ chord: e.chord, source: 'harmonic minor' }));
}

/** V/x and V7/x for every diatonic major or minor triad x except the tonic. */
export function secondaryDominants(key) {
  return diatonicChords(key)
    .filter((e) => e.kind === 'triad' && e.degree !== 0 && ['maj', 'min'].includes(e.chord.quality))
    .flatMap((target) => {
      const targetRoot = target.chord.root;
      const root = spellPcWithLetter(mod12(pcOf(targetRoot) + 7), letterAt(targetRoot.letter, 4));
      return [
        { chord: buildChord(root, 'maj'), roman: `V/${target.roman}`, target: target.chord },
        { chord: buildChord(root, 'dom7'), roman: `V7/${target.roman}`, target: target.chord },
      ];
    });
}

/** Last resort when no borrowed or secondary chord contains the note. */
export function chromaticChords(note) {
  return [buildChord(note, 'maj'), buildChord(note, 'min')];
}

function mergeBySymbol(entries) {
  const bySymbol = new Map();
  for (const entry of entries) {
    const existing = bySymbol.get(entry.chord.symbol);
    if (existing) existing.source += ` / ${entry.source}`;
    else bySymbol.set(entry.chord.symbol, { ...entry });
  }
  return [...bySymbol.values()];
}

function spellingInChords(chords, pc) {
  for (const chord of chords) {
    const tone = chord.tones.find((t) => pcOf(t.note) === pc);
    if (tone) return tone.note;
  }
  return null;
}

/** Chords that suit the note `pc` in `key`, grouped by where they come from. */
export function suggestChords(key, pc) {
  pc = mod12(pc);
  const inScale = key.scalePcs.has(pc);
  const inParent = key.parentPcs.has(pc);
  const isBlueNote = pc === key.blueNotePc;
  const groups = [];
  const addGroup = (id, chords) => {
    if (chords.length) groups.push({ id, title: GROUP_TITLES[id], chords });
  };

  const scaleNote = key.scaleNotes.find((note) => pcOf(note) === pc);
  let note;
  let explanation = null;

  const diatonic = diatonicChords(key);
  const diatonicSymbols = new Set(diatonic.map((e) => e.chord.symbol));
  const fitsNote = (e) => containsPc(e.chord, pc) && !diatonicSymbols.has(e.chord.symbol);
  const secondary = secondaryDominants(key).filter(fitsNote);
  const toBorrowed = (e) => toSuggestion(e.chord, romanNumeral(e.chord, key), e.source, key, pc);
  const toSecondary = (e) => toSuggestion(e.chord, e.roman, 'secondary dominant', key, pc);

  if (inParent) {
    // Scale notes get the key's own chords first, then the common chromatic
    // ones that still contain the note: harmonic-minor dominants and V/x.
    const harmonic = harmonicMinorChords(key).filter(fitsNote);
    addGroup('diatonic', diatonic.filter((e) => containsPc(e.chord, pc))
      .map((e) => toSuggestion(e.chord, e.roman, 'diatonic', key, pc)));
    addGroup('borrowed', harmonic.map(toBorrowed));
    addGroup('secondary', secondary.map(toSecondary));
    note = scaleNote ?? key.parentNotes.find((n) => pcOf(n) === pc);
    if (!inScale) {
      const scaleName = SCALES[key.scaleId].label.toLowerCase();
      explanation = `Not in the ${scaleName}, but it belongs to the parent ${key.parent} scale, so these chords still fit.`;
    }
  } else {
    const borrowed = mergeBySymbol(borrowedChords(key)).filter(fitsNote);
    addGroup('borrowed', borrowed.map(toBorrowed));
    addGroup('secondary', secondary.map(toSecondary));

    note = scaleNote
      ?? spellingInChords([...borrowed, ...secondary].map((e) => e.chord), pc)
      ?? defaultSpelling(pc, key.accidentals);

    if (!groups.length) {
      addGroup('chromatic', chromaticChords(note).map((c) => toSuggestion(c, romanNumeral(c, key), 'chromatic', key, pc)));
    }
    explanation = explain(key, pc, { isBlueNote, note });
  }

  return { pc, note, inScale, inParent, isBlueNote, groups, explanation };
}
