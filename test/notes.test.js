import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSpelling, letterAt, midiToFreq, midiToPc, noteName, pcOf, prettyName, spellPcWithLetter,
} from '../js/theory/notes.js';

test('pcOf handles accidentals and wraps', () => {
  assert.equal(pcOf({ letter: 'C', acc: 0 }), 0);
  assert.equal(pcOf({ letter: 'B', acc: 1 }), 0);
  assert.equal(pcOf({ letter: 'C', acc: -1 }), 11);
  assert.equal(pcOf({ letter: 'F', acc: 2 }), 7);
});

test('spellPcWithLetter picks the accidental for a given letter', () => {
  assert.equal(noteName(spellPcWithLetter(10, 'B')), 'Bb');
  assert.equal(noteName(spellPcWithLetter(10, 'A')), 'A#');
  assert.equal(noteName(spellPcWithLetter(0, 'B')), 'B#');
  assert.equal(noteName(spellPcWithLetter(7, 'A')), 'Abb');
});

test('letterAt wraps around the alphabet', () => {
  assert.equal(letterAt('G', 1), 'A');
  assert.equal(letterAt('B', 2), 'D');
  assert.equal(letterAt('C', 6), 'B');
});

test('names render in ASCII and with glyphs', () => {
  assert.equal(noteName({ letter: 'E', acc: -2 }), 'Ebb');
  assert.equal(prettyName({ letter: 'F', acc: 1 }), 'F♯');
  assert.equal(prettyName({ letter: 'B', acc: -1 }), 'B♭');
});

test('defaultSpelling follows the accidental preference', () => {
  assert.equal(noteName(defaultSpelling(6, 'flats')), 'Gb');
  assert.equal(noteName(defaultSpelling(6, 'sharps')), 'F#');
  assert.deepEqual([1, 3, 6, 8, 10].map((pc) => noteName(defaultSpelling(pc, 'neutral'))),
    ['C#', 'Eb', 'F#', 'Ab', 'Bb']);
});

test('MIDI helpers', () => {
  assert.equal(midiToFreq(69), 440);
  assert.ok(Math.abs(midiToFreq(60) - 261.6256) < 1e-3);
  assert.equal(midiToPc(61), 1);
});
