import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatParam } from '../js/ui/soundEditor.js';

test('cutoff shows kHz from 1 kHz up and Hz below, with a Finnish decimal comma', () => {
  assert.equal(formatParam('cutoff', 1800, 'en'), '1.8 kHz');
  assert.equal(formatParam('cutoff', 1800, 'fi'), '1,8 kHz');
  assert.equal(formatParam('cutoff', 650, 'en'), '650 Hz');
});

test('times show ms below one second and s from one second up', () => {
  assert.equal(formatParam('attack', 0.04, 'en'), '40 ms');
  assert.equal(formatParam('release', 1.2, 'en'), '1.2 s');
});

test('sustain, octave and reverb show a percentage', () => {
  assert.equal(formatParam('sustain', 0.7, 'en'), '70 %');
  assert.equal(formatParam('reverb', 0.25, 'en'), '25 %');
});

test('warmth shows cents and resonance one decimal place of dB', () => {
  assert.equal(formatParam('warmth', 8, 'en'), '8 ct');
  assert.equal(formatParam('resonance', 3, 'en'), '3.0 dB');
  assert.equal(formatParam('resonance', 0.7, 'fi'), '0,7 dB');
});
