import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteName } from '../js/theory/notes.js';
import { SCALES, buildKey, keyLabel } from '../js/theory/scales.js';

const names = (notes) => notes.map(noteName).join(' ');

test('major and minor keys are spelled one letter per degree', () => {
  assert.equal(names(buildKey(5, 'major').scaleNotes), 'F G A Bb C D E');
  assert.equal(names(buildKey(2, 'major').scaleNotes), 'D E F# G A B C#');
  assert.equal(names(buildKey(9, 'naturalMinor').scaleNotes), 'A B C D E F G');
  assert.equal(names(buildKey(2, 'naturalMinor').scaleNotes), 'D E F G A Bb C');
});

test('tonic spelling uses fewest accidentals, ties go to sharps', () => {
  assert.equal(noteName(buildKey(6, 'major').tonic), 'F#');
  assert.equal(noteName(buildKey(3, 'naturalMinor').tonic), 'D#');
  assert.equal(noteName(buildKey(1, 'major').tonic), 'Db');
  assert.equal(noteName(buildKey(1, 'naturalMinor').tonic), 'C#');
  assert.equal(noteName(buildKey(3, 'major').tonic), 'Eb');
  assert.equal(noteName(buildKey(10, 'naturalMinor').tonic), 'Bb');
  assert.equal(noteName(buildKey(8, 'naturalMinor').tonic), 'G#');
});

test('a preferred tonic letter is kept when its scale has no double accidentals', () => {
  assert.equal(noteName(buildKey(3, 'naturalMinor', 'E').tonic), 'Eb');
  assert.deepEqual(buildKey(3, 'naturalMinor', 'E').parentNotes.map(noteName), ['Eb', 'F', 'Gb', 'Ab', 'Bb', 'Cb', 'Db']);
  // Gb minor needs Bbb, Db minor needs Bbb, D# major needs F##: the tie rule decides.
  assert.equal(noteName(buildKey(6, 'naturalMinor', 'G').tonic), 'F#');
  assert.equal(noteName(buildKey(1, 'naturalMinor', 'D').tonic), 'C#');
  assert.equal(noteName(buildKey(3, 'major', 'D').tonic), 'Eb');
  assert.equal(noteName(buildKey(3, 'major', 'E').tonic), 'Eb');
});

test('pentatonic and blues scales use the parent spelling', () => {
  assert.equal(names(buildKey(0, 'majorPentatonic').scaleNotes), 'C D E G A');
  assert.equal(names(buildKey(9, 'minorPentatonic').scaleNotes), 'A C D E G');
  assert.equal(names(buildKey(9, 'blues').scaleNotes), 'A C D Eb E G');
  assert.equal(names(buildKey(4, 'blues').scaleNotes), 'E G A Bb B D');
});

test('blue note is in the scale but not the parent', () => {
  const key = buildKey(4, 'blues');
  assert.equal(key.blueNotePc, 10);
  assert.ok(key.scalePcs.has(10));
  assert.ok(!key.parentPcs.has(10));
  assert.equal(key.parent, 'minor');
});

test('accidental preference follows the key signature', () => {
  assert.equal(buildKey(0, 'major').accidentals, 'neutral');
  assert.equal(buildKey(9, 'naturalMinor').accidentals, 'neutral');
  assert.equal(buildKey(5, 'major').accidentals, 'flats');
  assert.equal(buildKey(2, 'naturalMinor').accidentals, 'flats');
  assert.equal(buildKey(7, 'major').accidentals, 'sharps');
});

test('every root and scale has 7 distinct parent letters and no double accidentals', () => {
  for (let root = 0; root < 12; root++) {
    for (const scaleId of Object.keys(SCALES)) {
      const key = buildKey(root, scaleId);
      const label = keyLabel(key);
      assert.equal(new Set(key.parentNotes.map((n) => n.letter)).size, 7, label);
      for (const note of key.parentNotes) assert.ok(Math.abs(note.acc) <= 1, `${label}: ${noteName(note)}`);
    }
  }
});
