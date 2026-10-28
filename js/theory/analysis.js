// Harmonic analysis of a progression: what each chord does, where the
// cadences are, how the progression ends, and which chords could come next.

import { chordsOfScale, diatonicChords, romanNumeral } from './chords.js';
import { LETTERS, mod, mod12, pcOf } from './notes.js';
import { guideTones, notesOverChord } from './overChord.js';
import { PARENT_INTERVALS, spellParentScale } from './scales.js';
import { borrowedChords, harmonicMinorChords, secondaryDominants } from './suggest.js';
import { toRelative } from './progression.js';

// Function of a chord rooted on each unaltered degree of the parent scale.
const T = 'tonic';
const S = 'subdominant';
const D = 'dominant';
const DEGREE_FUNCTION = {
  major: [T, S, T, S, D, T, D],
  minor: [T, S, T, S, D, S, D],
};
// Roots a half step off the parent scale, keyed by degree: bIII, bVI, bVII in
// major (from the parallel minor), #vii° in minor (from harmonic minor).
const ALTERED_FUNCTION = {
  major: { '-1': { 1: S, 2: T, 5: S, 6: D } },
  minor: { 1: { 6: D } },
};

const DOMINANT_QUALITIES = new Set(['maj', 'dom7']);
const TONIC_QUALITIES = new Set(['maj', 'min', 'maj7', 'min7', 'mMaj7', 'dom7']);

/** Degree (0–6) of the chord root by letter, and its offset from the parent scale note. */
function degreeOf(key, chord) {
  const degree = mod(LETTERS.indexOf(chord.root.letter) - LETTERS.indexOf(key.tonic.letter), 7);
  let offset = mod12(pcOf(chord.root) - pcOf(key.parentNotes[degree]));
  if (offset > 6) offset -= 12;
  return { degree, offset };
}

function functionOf(key, chord) {
  const { degree, offset } = degreeOf(key, chord);
  if (offset === 0) return DEGREE_FUNCTION[key.parent][degree];
  return ALTERED_FUNCTION[key.parent][offset]?.[degree] ?? null;
}

const isTonicRooted = (key, chord) => pcOf(chord.root) === key.rootPc && chord.root.letter === key.tonic.letter;
const isTonic = (key, chord) => isTonicRooted(key, chord) && TONIC_QUALITIES.has(chord.quality);
const rel = (key, chord) => toRelative(key, chord);
const isDominant = (key, chord) => {
  const r = rel(key, chord);
  return r.steps === 4 && r.semis === 7 && DOMINANT_QUALITIES.has(chord.quality);
};

/**
 * Roman numeral, origin and function of `chord` in `key`. Lookup order:
 * diatonic, secondary dominant, borrowed, chromatic. A tonic-rooted dom7 (the
 * blues I7) stays I7 with tonic function and notes that it can act as V7/IV.
 */
export function analyzeChord(key, chord) {
  const base = { chord, function: functionOf(key, chord), roman: romanNumeral(chord, key) };

  const diatonic = diatonicChords(key).find((e) => e.chord.symbol === chord.symbol);
  if (diatonic) return { ...base, roman: diatonic.roman, source: 'diatonic', sourceLabel: 'diatonic' };

  const secondary = secondaryDominants(key).find((e) => e.chord.symbol === chord.symbol);
  if (secondary && isTonicRooted(key, chord)) {
    return { ...base, source: 'chromatic', sourceLabel: 'chromatic', alsoActsAs: secondary.roman, target: secondary.target };
  }
  if (secondary) {
    return { ...base, roman: secondary.roman, source: 'secondary', sourceLabel: 'secondary dominant', function: D, target: secondary.target };
  }

  const borrowed = borrowedChords(key).filter((e) => e.chord.symbol === chord.symbol);
  if (borrowed.length) {
    return { ...base, source: 'borrowed', sourceLabel: [...new Set(borrowed.map((e) => e.source))].join(' / ') };
  }
  return { ...base, source: 'chromatic', sourceLabel: 'chromatic' };
}

/** The filled slots in order; with `loop`, the first one again after the last. */
function chordPairs(slots, loop) {
  const filled = slots.filter((s) => s.chord);
  const pairs = filled.slice(0, -1).map((s, i) => [s, filled[i + 1], false]);
  if (loop && filled.length > 1) pairs.push([filled.at(-1), filled[0], true]);
  return { filled, pairs };
}

/**
 * Cadences between neighbouring chords: authentic (V → I), plagal (IV → I),
 * deceptive (V → vi/VI), half (V ending a 4-bar phrase or the progression with
 * no tonic after it) and ii–V–I. With `loop`, the last → first pair counts too.
 */
export function findCadences(key, slots, { loop = false } = {}) {
  const { filled, pairs } = chordPairs(slots, loop);
  const sixth = PARENT_INTERVALS[key.parent][5];
  const cadences = [];

  pairs.forEach(([a, b, wrap], i) => {
    const ra = rel(key, a.chord);
    const rb = rel(key, b.chord);
    const add = (type, from = a) => cadences.push({ type, from: from.index, to: b.index, wrap });

    const prev = i > 0 ? pairs[i - 1][0] : loop && filled.length > 2 ? filled.at(-1) : null;
    if (prev && prev !== b && isDominant(key, a.chord) && isTonic(key, b.chord)) {
      const rp = rel(key, prev.chord);
      if (rp.steps === 1 && rp.semis === 2 && ['min', 'min7', 'dim', 'm7b5'].includes(prev.chord.quality)) {
        add('ii-V-I', prev);
      }
    }
    if (isDominant(key, a.chord) && isTonic(key, b.chord)) add('authentic');
    else if (ra.steps === 3 && ra.semis === 5 && isTonic(key, b.chord)) add('plagal');
    else if (isDominant(key, a.chord) && rb.steps === 5 && rb.semis === sixth) add('deceptive');
  });

  // A half cadence: V at the end of a 4-bar phrase or of the whole progression.
  filled.forEach((slot, i) => {
    if (!isDominant(key, slot.chord)) return;
    const next = filled[i + 1] ?? (loop ? filled[0] : null);
    if (next && isTonic(key, next.chord)) return;
    const endsPhrase = (slot.bar + 1) % 4 === 0 && slot.half === slots.filter((s) => s.bar === slot.bar).length - 1;
    if (endsPhrase || i === filled.length - 1) cadences.push({ type: 'half', from: slot.index, to: slot.index, wrap: false });
  });

  return cadences.sort((x, y) => x.from - y.from);
}

/** The tonic triad of the key, for "wants to resolve to …" advice. */
const tonicChord = (key) => diatonicChords(key)[0].chord;

/**
 * Structured advice about the whole progression, turned into words by
 * adviceText.js. Each item is { kind, slot?, params }.
 */
export function progressionAdvice(key, slots, { loop = false } = {}) {
  const { filled } = chordPairs(slots, loop);
  if (!filled.length) return [];
  const items = [];
  const first = filled[0];
  const last = filled.at(-1);
  const firstIsTonic = isTonicRooted(key, first.chord);

  if (!firstIsTonic) items.push({ kind: 'starts-away-from-tonic', slot: first.index, params: { chord: first.chord, tonic: tonicChord(key) } });

  filled.forEach((slot, i) => {
    const analysis = analyzeChord(key, slot.chord);
    if (analysis.source !== 'secondary') return;
    const next = filled[i + 1] ?? (loop && filled.length > 1 ? filled[0] : null);
    const resolves = next && pcOf(next.chord.root) === pcOf(analysis.target.root);
    items.push({
      kind: resolves ? 'secondary-resolves' : 'secondary-unresolved',
      slot: slot.index,
      params: { chord: slot.chord, roman: analysis.roman, target: analysis.target, next: next?.chord ?? null },
    });
  });

  const ending = analyzeChord(key, last.chord);
  const endParams = { chord: last.chord, roman: ending.roman, tonic: tonicChord(key), loop, firstIsTonic };
  if (isTonicRooted(key, last.chord)) items.push({ kind: 'ends-on-tonic', slot: last.index, params: endParams });
  else if (ending.function === D) {
    items.push({ kind: 'ends-on-dominant', slot: last.index, params: { ...endParams, target: ending.target ?? tonicChord(key), turnaround: loop && firstIsTonic } });
  } else if (ending.function === S) items.push({ kind: 'ends-on-subdominant', slot: last.index, params: endParams });
  else items.push({ kind: 'ends-on-other', slot: last.index, params: endParams });

  const emptyBars = [...new Set(slots.filter((s) => !s.chord).map((s) => s.bar + 1))];
  if (emptyBars.length) items.push({ kind: 'empty-bars', params: { bars: emptyBars } });
  return items;
}

// Where each degree likes to go next, as [degree, reason]. 'V' is the major
// dominant: diatonic in major, from harmonic minor in a minor key.
const NEXT = {
  major: [
    [[3, 'to-predominant'], [4, 'to-dominant'], [5, 'tonic-substitute'], [1, 'to-predominant']],
    [[4, 'to-dominant'], [6, 'to-dominant']],
    [[5, 'circle'], [3, 'to-predominant']],
    [[4, 'to-dominant'], [0, 'plagal'], [1, 'to-predominant']],
    [[0, 'resolve'], [5, 'deceptive']],
    [[1, 'circle'], [3, 'to-predominant'], [4, 'to-dominant']],
    [[0, 'resolve']],
  ],
  minor: [
    [[3, 'to-predominant'], [5, 'to-predominant'], ['V', 'to-dominant'], [6, 'step']],
    [['V', 'to-dominant']],
    [[5, 'circle'], [3, 'to-predominant']],
    [['V', 'to-dominant'], [0, 'plagal'], [6, 'step']],
    [[0, 'resolve'], [5, 'deceptive']],
    [['V', 'to-dominant'], [6, 'step'], [3, 'to-predominant']],
    [[2, 'circle'], [0, 'resolve']],
  ],
};
// Borrowed roots in a major key: bVI → bVII → I.
const NEXT_ALTERED_MAJOR = {
  5: [['bVII', 'step'], [4, 'to-dominant']],
  6: [[0, 'resolve']],
  2: [[3, 'to-predominant']],
};

/**
 * Likely next chords after `chord`, best first. A secondary dominant leads to
 * its target; otherwise the degree tables apply. A 7th chord gets 7th chords.
 */
export function nextChords(key, chord) {
  const kind = chord.tones.length === 4 ? 'seventh' : 'triad';
  const diatonic = diatonicChords(key);
  const atDegree = (d) => diatonic.find((e) => e.degree === d && e.kind === kind).chord;
  const dominant = () => {
    if (key.parent === 'major') return atDegree(4);
    return harmonicMinorChords(key).find((e) => e.chord.quality === (kind === 'seventh' ? 'dom7' : 'maj')).chord;
  };
  const parallelSubtonic = () => chordsOfScale(spellParentScale(key.tonic, 'minor'))
    .find((e) => e.degree === 6 && e.kind === kind).chord;
  const pick = (token) => {
    if (token === 'V') return dominant();
    if (token === 'bVII') return parallelSubtonic();
    return atDegree(token);
  };

  const analysis = analyzeChord(key, chord);
  const { degree, offset } = degreeOf(key, chord);
  let row;
  if (offset === 0) row = NEXT[key.parent][degree];
  else if (key.parent === 'major' && offset === -1) row = NEXT_ALTERED_MAJOR[degree];
  else if (key.parent === 'minor' && offset === 1 && degree === 6) row = [[0, 'resolve']];
  row ??= [[0, 'resolve'], ['V', 'to-dominant']];

  const options = [];
  if (analysis.target) {
    const target = diatonic.find((e) => e.kind === kind && pcOf(e.chord.root) === pcOf(analysis.target.root));
    options.push({ chord: target?.chord ?? analysis.target, reason: 'secondary-target' });
  }
  for (const [token, reason] of row) options.push({ chord: pick(token), reason });

  const seen = new Set([chord.symbol]);
  return options
    .filter((o) => !seen.has(o.chord.symbol) && seen.add(o.chord.symbol))
    .map((o) => ({ ...o, symbol: o.chord.symbol, roman: analyzeChord(key, o.chord).roman }));
}

/** Chords to pick from: the key's own, then borrowed and secondary ones that aren't diatonic. */
export function chordPalette(key) {
  const diatonic = diatonicChords(key);
  const seen = new Set(diatonic.map((e) => e.chord.symbol));
  const fresh = (entries) => entries.filter((e) => !seen.has(e.chord.symbol) && seen.add(e.chord.symbol));
  return [
    { id: 'diatonic', chords: diatonic.map((e) => ({ chord: e.chord, roman: e.roman })) },
    { id: 'borrowed', chords: fresh(borrowedChords(key)).map((e) => ({ chord: e.chord, roman: romanNumeral(e.chord, key) })) },
    { id: 'secondary', chords: fresh(secondaryDominants(key)).map((e) => ({ chord: e.chord, roman: e.roman })) },
  ];
}

export function analyzeProgression(key, slots, { loop = false } = {}) {
  return {
    chords: slots.map((s) => (s.chord ? analyzeChord(key, s.chord) : null)),
    cadences: findCadences(key, slots, { loop }),
    advice: progressionAdvice(key, slots, { loop }),
  };
}

/**
 * Everything the panel and instruments need for one slot: the chord, its
 * analysis, the notes over it, guide tones into the next chord and next-chord
 * ideas. An empty slot gets ideas that follow the chord before it.
 */
export function slotFocus(key, slots, index, { loop = false } = {}) {
  const slot = slots[index];
  if (!slot) return null;
  const filled = slots.filter((s) => s.chord);
  const after = filled.find((s) => s.index > index) ?? (loop ? filled.find((s) => s.index !== index) : null);
  const before = [...filled].reverse().find((s) => s.index < index) ?? (loop ? filled.at(-1) : null);

  if (!slot.chord) {
    const start = { chord: tonicChord(key), reason: 'start-on-tonic', symbol: tonicChord(key).symbol, roman: diatonicChords(key)[0].roman };
    const next = before ? nextChords(key, before.chord) : [start];
    return { slot, chord: null, analysis: null, notes: null, guideTones: [], nextChord: null, next, fillTarget: slot };
  }

  const analysis = analyzeChord(key, slot.chord);
  const nextChord = after && after.index !== index ? after.chord : null;
  return {
    slot,
    chord: slot.chord,
    analysis,
    notes: notesOverChord(key, slot.chord, analysis),
    guideTones: nextChord ? guideTones(slot.chord, nextChord) : [],
    nextChord,
    next: nextChords(key, slot.chord),
    fillTarget: slots[index + 1] ?? null,
  };
}
