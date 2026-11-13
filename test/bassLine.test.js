import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASS_HIGH, BASS_LOW, bassFit, bassTiers, plainTier } from '../js/theory/bassLine.js';
import { TICKS_PER_BAR as BAR } from '../js/theory/composition.js';
import { cellTiers, noteFit, noteTier } from '../js/theory/melodyFit.js';
import { emptyProgression, flattenSlots, parseNumeral, setChordAt } from '../js/theory/progression.js';
import { buildKey } from '../js/theory/scales.js';

// Bass map cases, checked by hand. See IMPLEMENTATION-PLAN.md §10.7.

const C = buildKey(0, 'major');
function slotsFor(key, numerals, mode = 'major') {
  let p = emptyProgression(numerals.length);
  numerals.forEach((n, bar) => { if (n) p = setChordAt(p, { bar, half: 0 }, parseNumeral(n, mode)); });
  return flattenSlots(key, p);
}
const lane = (...notes) => ({ notes: notes.map(([start, length, midi]) => ({ start, length, midi })) });
const tierOf = (tiers, pc) => tiers[pc].tier;

test('the bass range is E1 to G3', () => {
  assert.equal(BASS_LOW, 28);
  assert.equal(BASS_HIGH, 55);
});

test('over C the root is C, the fifth is G, E stays a chord tone', () => {
  const [c] = bassTiers(C, slotsFor(C, ['I']));
  assert.equal(tierOf(c, 0), 'root');
  assert.equal(tierOf(c, 7), 'fifth');
  assert.equal(tierOf(c, 4), 'chord');
  assert.equal(tierOf(c, 5), 'avoid');
  assert.equal(tierOf(c, 2), 'scale');
  assert.equal(tierOf(c, 1), 'outside');
});

test('over G7 the root is G, the fifth is D, F is a chord tone', () => {
  const [g7] = bassTiers(C, slotsFor(C, ['V7']));
  assert.equal(tierOf(g7, 7), 'root');
  assert.equal(tierOf(g7, 2), 'fifth');
  assert.equal(tierOf(g7, 11), 'chord');
  assert.equal(tierOf(g7, 5), 'chord');
});

test('the diminished fifth of Bdim is its fifth', () => {
  const [b] = bassTiers(C, slotsFor(C, ['vii°']));
  assert.equal(tierOf(b, 11), 'root');
  assert.equal(tierOf(b, 5), 'fifth');
});

test('an empty slot shows scale membership only, like the melody map', () => {
  const slots = slotsFor(C, ['']);
  assert.deepEqual(bassTiers(C, slots), cellTiers(C, slots));
});

test('the bass map differs from the melody map only in root and fifth', () => {
  const slots = slotsFor(C, ['I', 'IV', 'V7', 'vi']);
  const bass = bassTiers(C, slots);
  cellTiers(C, slots).forEach((entries, i) => entries.forEach((entry, pc) => {
    assert.equal(plainTier(bass[i][pc].tier), entry.tier);
    assert.equal(bass[i][pc].label, entry.label);
  }));
});

test('bass fit: C2 over C is a root, G2 a fifth, both score 1; a C held across C → G7 is root, then avoid', () => {
  const slots = slotsFor(C, ['I', 'V7']);
  const [c, g] = bassFit(C, slots, lane([0, BAR / 2, 36], [BAR / 2, BAR / 2, 43]));
  assert.equal(noteTier(c), 'root');
  assert.equal(noteTier(g), 'fifth');
  assert.equal(noteFit(c), 1);
  assert.equal(noteFit(g), 1);
  const [held] = bassFit(C, slots, lane([0, 2 * BAR, 36]));
  assert.deepEqual(held.segments.map((s) => s.tier), ['root', 'avoid']);
});
