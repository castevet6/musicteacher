import { test } from 'node:test';
import assert from 'node:assert/strict';
import { avoidReasonText, adviceText, cadenceText, functionText, guideToneText, LEVELS, noteOverChordText, reasonText, tierText } from '../js/theory/adviceText.js';
import { analyzeChord, chordPalette, findCadences, nextChords, progressionAdvice, slotFocus } from '../js/theory/analysis.js';
import { buildChord } from '../js/theory/chords.js';
import { noteName } from '../js/theory/notes.js';
import { guideTones, notesOverChord } from '../js/theory/overChord.js';
import { emptyProgression, flattenSlots, parseNumeral, presetProgression, setChordAt } from '../js/theory/progression.js';
import { buildKey } from '../js/theory/scales.js';

// Golden cases, checked by hand. See IMPLEMENTATION-PLAN.md §9.

const n = (name) => ({ letter: name[0], acc: name.length > 1 ? (name[1] === '#' ? 1 : -1) : 0 });
const C = buildKey(0, 'major');

/** Slots for one chord per bar, from numerals read in the key's mode. */
function slotsOf(key, numerals) {
  let p = emptyProgression(numerals.length);
  numerals.forEach((num, bar) => { p = setChordAt(p, { bar, half: 0 }, parseNumeral(num, key.parent)); });
  return flattenSlots(key, p);
}
const cadences = (key, slots, loop) =>
  findCadences(key, slots, { loop }).map((c) => `${c.type} ${c.from}>${c.to}${c.wrap ? ' wrap' : ''}`);
const kinds = (key, slots, loop) => progressionAdvice(key, slots, { loop }).map((a) => a.kind);

test('analyzeChord: source, numeral and function', () => {
  const a = (key, root, quality) => {
    const r = analyzeChord(key, buildChord(n(root), quality));
    return `${r.roman} ${r.source} ${r.function}`;
  };
  assert.equal(a(C, 'D', 'min7'), 'ii7 diatonic subdominant');
  assert.equal(a(C, 'G', 'dom7'), 'V7 diatonic dominant');
  assert.equal(a(C, 'D', 'dom7'), 'V7/V secondary dominant');
  assert.equal(a(C, 'A', 'maj'), 'V/ii secondary dominant');
  assert.equal(a(C, 'A', 'min'), 'vi diatonic tonic');
  assert.equal(a(C, 'F', 'min'), 'iv borrowed subdominant');
  assert.equal(a(C, 'A', 'maj7'), 'VImaj7 chromatic tonic');
  const aMinor = buildKey(9, 'naturalMinor');
  assert.equal(a(aMinor, 'E', 'dom7'), 'V7 borrowed dominant');
  assert.equal(a(aMinor, 'G', 'maj'), 'VII diatonic dominant');
  assert.equal(analyzeChord(aMinor, buildChord(n('E'), 'dom7')).sourceLabel, 'parallel major / harmonic minor');
});

test('12-bar blues in A: I7 is tonic but can act as V7/IV', () => {
  const key = buildKey(9, 'major');
  const slots = flattenSlots(key, presetProgression('blues'));
  const read = slots.map((s) => {
    const r = analyzeChord(key, s.chord);
    return `${s.chord.symbol} ${r.roman} ${r.function}`;
  });
  assert.deepEqual([read[0], read[4], read[8]], ['A7 I7 tonic', 'D7 IV7 subdominant', 'E7 V7 dominant']);
  assert.equal(analyzeChord(key, slots[0].chord).alsoActsAs, 'V7/IV');

  assert.deepEqual(cadences(key, slots, false), ['plagal 5>6', 'plagal 9>10', 'half 11>11']);
  assert.deepEqual(cadences(key, slots, true), ['plagal 5>6', 'plagal 9>10', 'authentic 11>0 wrap']);
  const end = progressionAdvice(key, slots, { loop: true }).find((a) => a.kind === 'ends-on-dominant');
  assert.equal(end.params.turnaround, true);
});

test('C G Am F: deceptive cadence, plagal across the loop', () => {
  const slots = slotsOf(C, ['I', 'V', 'vi', 'IV']);
  assert.deepEqual(cadences(C, slots, false), ['deceptive 1>2']);
  assert.deepEqual(cadences(C, slots, true), ['deceptive 1>2', 'plagal 3>0 wrap']);
  assert.deepEqual(kinds(C, slots, true), ['ends-on-subdominant']);
});

test('Dm7 G7 Cmaj7: ii–V–I and an authentic cadence', () => {
  const slots = slotsOf(C, ['ii7', 'V7', 'Imaj7']);
  assert.deepEqual(cadences(C, slots, false), ['ii-V-I 0>2', 'authentic 1>2']);
  assert.deepEqual(kinds(C, slots, false), ['starts-away-from-tonic', 'ends-on-tonic']);
});

test('secondary dominants: resolved and unresolved', () => {
  assert.deepEqual(kinds(C, slotsOf(C, ['I', 'II7', 'iii']), false),
    ['secondary-unresolved', 'ends-on-other']);
  assert.deepEqual(kinds(C, slotsOf(C, ['I', 'II7', 'V', 'I']), false), ['secondary-resolves', 'ends-on-tonic']);
});

test('ending on V wants to resolve; empty bars are reported', () => {
  let p = setChordAt(emptyProgression(4), { bar: 0, half: 0 }, parseNumeral('I', 'major'));
  p = setChordAt(p, { bar: 2, half: 0 }, parseNumeral('V7', 'major'));
  const slots = flattenSlots(C, p);
  const advice = progressionAdvice(C, slots);
  assert.deepEqual(advice.map((a) => a.kind), ['ends-on-dominant', 'empty-bars']);
  assert.equal(advice[0].params.target.symbol, 'C');
  assert.deepEqual(advice[1].params.bars, [2, 4]);
  assert.deepEqual(cadences(C, slots, false), ['half 2>2']);
});

test('nextChords follows the function, and 7ths lead to 7ths', () => {
  const next = (key, root, quality) => nextChords(key, buildChord(n(root), quality)).map((o) => o.symbol);
  assert.deepEqual(next(C, 'G', 'dom7'), ['Cmaj7', 'Am7']);
  assert.deepEqual(next(C, 'G', 'maj'), ['C', 'Am']);
  assert.equal(next(C, 'D', 'dom7')[0], 'G7');
  assert.equal(next(C, 'D', 'maj')[0], 'G');
  assert.equal(next(C, 'A', 'maj')[0], 'Dm');
  assert.deepEqual(next(C, 'Ab', 'maj'), ['Bb', 'G']);
  assert.deepEqual(next(buildKey(9, 'naturalMinor'), 'D', 'min'), ['E', 'Am', 'G']);
});

test('chordPalette lists borrowed and secondary chords once, outside the diatonic set', () => {
  const palette = chordPalette(C);
  assert.equal(palette[0].chords.length, 14);
  const all = palette.flatMap((g) => g.chords.map((c) => c.chord.symbol));
  assert.equal(new Set(all).size, all.length);
  assert.ok(palette[1].chords.some((c) => c.chord.symbol === 'Fm' && c.roman === 'iv'));
  assert.ok(palette[2].chords.some((c) => c.chord.symbol === 'D7' && c.roman === 'V7/V'));
});

test('slotFocus: guide tones into the next chord; an empty slot gets ideas', () => {
  const slots = slotsOf(C, ['ii7', 'V7', 'Imaj7']);
  const focus = slotFocus(C, slots, 1);
  assert.equal(focus.chord.symbol, 'G7');
  assert.equal(focus.nextChord.symbol, 'Cmaj7');
  // B is held: the 3rd of G7 is the 7th of Cmaj7.
  assert.deepEqual(focus.guideTones.map((m) => `${noteName(m.to)} ${m.motion}`), ['B 0', 'E -1']);
  assert.equal(focus.notes[0].tier, 'avoid');

  const p = setChordAt(emptyProgression(2), { bar: 0, half: 0 }, parseNumeral('V7', 'major'));
  const empty = slotFocus(C, flattenSlots(C, p), 1);
  assert.equal(empty.chord, null);
  assert.equal(empty.next[0].symbol, 'Cmaj7');
  assert.equal(slotFocus(C, flattenSlots(C, emptyProgression(1)), 0).next[0].symbol, 'C');
});

test('every advice and cadence kind has text at both levels', () => {
  const key = buildKey(9, 'major');
  const cases = [
    slotsOf(C, ['I', 'V', 'vi', 'IV']), slotsOf(C, ['ii7', 'V7', 'Imaj7']), slotsOf(C, ['I', 'II7', 'iii']),
    slotsOf(C, ['I', 'II7', 'V', 'I']), slotsOf(C, ['I', 'V7']), slotsOf(C, ['I', 'iii']),
    flattenSlots(C, setChordAt(emptyProgression(2), { bar: 0, half: 0 }, parseNumeral('I', 'major'))),
    flattenSlots(key, presetProgression('blues')),
  ];
  const seen = new Set();
  for (const slots of cases) {
    for (const loop of [false, true]) {
      for (const level of LEVELS) {
        for (const item of progressionAdvice(C, slots, { loop })) {
          seen.add(item.kind);
          assert.ok(adviceText(item, level).length > 10);
        }
        for (const cadence of findCadences(C, slots, { loop })) {
          seen.add(cadence.type);
          assert.ok(cadenceText(cadence, slots, level).length > 10);
        }
      }
    }
  }
  for (const kind of ['starts-away-from-tonic', 'ends-on-tonic', 'ends-on-dominant', 'ends-on-subdominant', 'ends-on-other',
    'secondary-resolves', 'secondary-unresolved', 'empty-bars', 'authentic', 'plagal', 'deceptive', 'half', 'ii-V-I']) {
    assert.ok(seen.has(kind), kind);
  }
});

test('texts for chords, tiers, reasons and guide tones', () => {
  const g7 = buildChord(n('G'), 'dom7');
  const cmaj = buildChord(n('C'), 'maj');
  for (const level of LEVELS) {
    for (const chord of [g7, cmaj, buildChord(n('D'), 'dom7'), buildChord(n('F'), 'min'), buildChord(n('F', 1), 'maj')]) {
      assert.ok(functionText(analyzeChord(C, chord), C, level).length > 10);
    }
    for (const tier of ['chord', 'scale', 'parent', 'avoid', 'blue']) assert.ok(tierText(tier, level));
    for (const reason of ['secondary-target', 'resolve', 'deceptive', 'plagal', 'to-dominant', 'to-predominant',
      'tonic-substitute', 'circle', 'step', 'start-on-tonic']) assert.ok(reasonText(reason, level));
  }
  const [b, f] = guideTones(g7, cmaj);
  assert.equal(guideToneText(f, g7, cmaj, 'intermediate'), 'Guide tone: F (7th of G7) resolves down a half step to E (3rd of C).');
  assert.equal(guideToneText(f, g7, cmaj, 'beginner'), 'Slide F down to E as the chord changes to C.');
  assert.match(guideToneText(b, g7, cmaj, 'intermediate'), /rises a half step to C \(root of C\)/);

  const notes = notesOverChord(C, cmaj, analyzeChord(C, cmaj));
  assert.equal(noteOverChordText(notes[5], cmaj, 'intermediate'), 'F over C: 11, avoid note.');
  assert.equal(avoidReasonText(notes[5], 'intermediate'), 'a half step above the 3rd (E)');
  assert.equal(noteOverChordText(notes[4], cmaj, 'intermediate'), 'E over C: 3rd, chord tone.');
});

