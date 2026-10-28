import { test } from 'node:test';
import assert from 'node:assert/strict';
import { diatonicChords, romanNumeral } from '../js/theory/chords.js';
import {
  emptyProgression, flattenSlots, nextAddress, parseNumeral, presetProgression,
  resizeProgression, resolveChord, toRelative, toggleSplit,
} from '../js/theory/progression.js';
import { buildKey } from '../js/theory/scales.js';

// Golden cases, checked by hand. See IMPLEMENTATION-PLAN.md §9.

const symbols = (key, progression) => flattenSlots(key, progression).map((s) => s.chord?.symbol ?? '-');
const numerals = (key, progression) => flattenSlots(key, progression).map((s) => romanNumeral(s.chord, key));

test('I–V–vi–IV transposes with the root', () => {
  const p = presetProgression('pop');
  assert.deepEqual(symbols(buildKey(7, 'major'), p), ['G', 'D', 'Em', 'C']);
  assert.deepEqual(symbols(buildKey(3, 'major'), p), ['Eb', 'Bb', 'Cm', 'Ab']);
});

test('switching C major to C minor keeps the chords and re-reads them', () => {
  const p = presetProgression('pop');
  const minor = buildKey(0, 'naturalMinor');
  assert.deepEqual(symbols(minor, p), ['C', 'G', 'Am', 'F']);
  assert.deepEqual(numerals(minor, p), ['I', 'V', '#vi', 'IV']);
});

test('Eb major switched to minor keeps the Eb spelling', () => {
  const p = presetProgression('twoFiveOne');
  assert.deepEqual(symbols(buildKey(3, 'major'), p), ['Fm7', 'Bb7', 'Ebmaj7', 'Ebmaj7']);
  const minor = buildKey(3, 'naturalMinor', 'E');
  assert.deepEqual(symbols(minor, p), ['Fm7', 'Bb7', 'Ebmaj7', 'Ebmaj7']);
  assert.deepEqual(numerals(minor, p), ['ii7', 'V7', 'Imaj7', 'Imaj7']);
  // Without the kept letter, the tie rule picks D# minor and re-spells everything.
  assert.deepEqual(symbols(buildKey(3, 'naturalMinor'), p), ['E#m7', 'A#7', 'D#maj7', 'D#maj7']);
});

test('the Andalusian preset is read in minor, even in a major key', () => {
  const p = presetProgression('andalusian');
  const aMinor = buildKey(9, 'naturalMinor');
  assert.deepEqual(symbols(aMinor, p), ['Am', 'G', 'F', 'E']);
  assert.deepEqual(numerals(aMinor, p), ['i', 'VII', 'VI', 'V']);
  assert.deepEqual(symbols(buildKey(0, 'major'), p), ['Cm', 'Bb', 'Ab', 'G']);
});

test('split bars make two-beat slots', () => {
  const slots = flattenSlots(buildKey(0, 'major'), presetProgression('turnaround'));
  assert.deepEqual(slots.map((s) => `${s.bar}.${s.half} ${s.beats} ${s.chord.symbol}`),
    ['0.0 2 Cmaj7', '0.1 2 Am7', '1.0 2 Dm7', '1.1 2 G7']);
});

test('parseNumeral reads accidentals and suffixes', () => {
  assert.deepEqual(parseNumeral('bVII7', 'major'), { steps: 6, semis: 10, quality: 'dom7' });
  assert.deepEqual(parseNumeral('#vii°7', 'minor'), { steps: 6, semis: 11, quality: 'dim7' });
  assert.deepEqual(parseNumeral('iiø7', 'major'), { steps: 1, semis: 2, quality: 'm7b5' });
  assert.deepEqual(parseNumeral('III+', 'minor'), { steps: 2, semis: 3, quality: 'aug' });
  assert.throws(() => parseNumeral('VIII', 'major'));
  assert.throws(() => parseNumeral('Vsus', 'major'));
});

test('parseNumeral inverts romanNumeral for every diatonic chord', () => {
  for (let root = 0; root < 12; root++) {
    for (const scaleId of ['major', 'naturalMinor']) {
      const key = buildKey(root, scaleId);
      for (const { chord, roman } of diatonicChords(key)) {
        const back = resolveChord(key, parseNumeral(roman, key.parent));
        assert.equal(back.symbol, chord.symbol, `${root} ${scaleId} ${roman}`);
        assert.deepEqual(toRelative(key, chord), parseNumeral(roman, key.parent));
      }
    }
  }
});

test('resize, split and nextAddress', () => {
  const p = toggleSplit(resizeProgression(emptyProgression(2), 3), 1);
  assert.deepEqual(p.bars.map((b) => b.chords.length), [1, 2, 1]);
  assert.deepEqual(nextAddress(p, { bar: 1, half: 0 }), { bar: 1, half: 1 });
  assert.deepEqual(nextAddress(p, { bar: 1, half: 1 }), { bar: 2, half: 0 });
  assert.equal(nextAddress(p, { bar: 2, half: 0 }), null);
  assert.equal(resizeProgression(p, 40).bars.length, 16);
  assert.equal(resizeProgression(p, 0).bars.length, 1);
  assert.deepEqual(toggleSplit(p, 1).bars[1].chords, [null]);
});
