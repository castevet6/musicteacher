import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChord, closeVoicing, diatonicChords, qualityOf, romanNumeral } from '../js/theory/chords.js';
import { noteName } from '../js/theory/notes.js';
import { SCALES, buildKey } from '../js/theory/scales.js';

const n = (letter, acc = 0) => ({ letter, acc });
const tones = (chord) => chord.tones.map((t) => noteName(t.note)).join(' ');

test('chords are spelled by stacking letters', () => {
  assert.equal(tones(buildChord(n('B', -1), 'dom7')), 'Bb D F Ab');
  assert.equal(tones(buildChord(n('F', 1), 'm7b5')), 'F# A C E');
  assert.equal(tones(buildChord(n('G', 1), 'dim7')), 'G# B D F');
  assert.equal(tones(buildChord(n('C'), 'aug')), 'C E G#');
  assert.equal(buildChord(n('E', -1), 'maj7').symbol, 'Ebmaj7');
});

test('qualityOf recognises stacked thirds', () => {
  assert.equal(qualityOf([n('D'), n('F'), n('A'), n('C')]), 'min7');
  assert.equal(qualityOf([n('B'), n('D'), n('F')]), 'dim');
  assert.equal(qualityOf([n('A'), n('C'), n('E'), n('G', 1)]), 'mMaj7');
});

test('diatonic chords of C major', () => {
  const chords = diatonicChords(buildKey(0, 'major'));
  assert.deepEqual(
    chords.map((e) => `${e.chord.symbol} ${e.roman}`),
    ['C I', 'Cmaj7 Imaj7', 'Dm ii', 'Dm7 ii7', 'Em iii', 'Em7 iii7', 'F IV', 'Fmaj7 IVmaj7',
      'G V', 'G7 V7', 'Am vi', 'Am7 vi7', 'Bdim vii°', 'Bm7b5 viiø7'],
  );
});

test('diatonic chords of A minor use unaltered numerals', () => {
  const chords = diatonicChords(buildKey(9, 'naturalMinor')).filter((e) => e.kind === 'triad');
  assert.deepEqual(chords.map((e) => `${e.chord.symbol} ${e.roman}`),
    ['Am i', 'Bdim ii°', 'C III', 'Dm iv', 'Em v', 'F VI', 'G VII']);
});

test('roman numerals mark chromatic roots against the parent scale', () => {
  assert.equal(romanNumeral(buildChord(n('A', -1), 'maj'), buildKey(0, 'major')), 'bVI');
  assert.equal(romanNumeral(buildChord(n('F', 1), 'min'), buildKey(9, 'naturalMinor')), '#vi');
  assert.equal(romanNumeral(buildChord(n('G', 1), 'dim7'), buildKey(9, 'naturalMinor')), '#vii°7');
  assert.equal(romanNumeral(buildChord(n('C'), 'aug'), buildKey(0, 'major')), 'I+');
});

test('closeVoicing stacks tones upward from the root', () => {
  assert.deepEqual(closeVoicing(buildChord(n('C'), 'maj7')), [48, 52, 55, 59]);
  assert.deepEqual(closeVoicing(buildChord(n('A'), 'min')), [57, 60, 64]);
  assert.deepEqual(closeVoicing(buildChord(n('B'), 'dom7')), [59, 63, 66, 69]);
});

test('no diatonic chord in any key has a double accidental', () => {
  for (let root = 0; root < 12; root++) {
    for (const scaleId of Object.keys(SCALES)) {
      for (const { chord } of diatonicChords(buildKey(root, scaleId))) {
        for (const t of chord.tones) assert.ok(Math.abs(t.note.acc) <= 1, `${chord.symbol}: ${tones(chord)}`);
      }
    }
  }
});
