import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TICKS_PER_BAR as BAR, TICKS_PER_BEAT as Q } from '../js/theory/composition.js';
import { fitLevel, slotFit } from '../js/theory/harmonize.js';
import { cellTiers, emptySlotTiers, laneFit, noteFit, noteTier } from '../js/theory/melodyFit.js';
import { emptyProgression, flattenSlots, parseNumeral, setChordAt } from '../js/theory/progression.js';
import { buildKey } from '../js/theory/scales.js';

// Golden cases, checked by hand. See IMPLEMENTATION-PLAN.md §10.8.

const C = buildKey(0, 'major');
/** Slots for a list of numerals, one per bar, read in major; '' leaves a bar empty. */
function slotsFor(key, numerals) {
  let p = emptyProgression(numerals.length);
  numerals.forEach((n, bar) => { if (n) p = setChordAt(p, { bar, half: 0 }, parseNumeral(n, 'major')); });
  return flattenSlots(key, p);
}
const lane = (...notes) => ({ notes: notes.map(([start, length, midi]) => ({ start, length, midi })) });
const brief = (entry) => entry.segments.map((s) => `${s.tier} ${s.label} ${s.length}`);

test('E quarter on beat 1 over C is a chord tone with weight 36', () => {
  const [e] = laneFit(C, slotsFor(C, ['I']), lane([0, Q, 64]));
  assert.deepEqual(e.segments.map((s) => [s.tier, s.label, s.weight]), [['chord', '3', 36]]);
  assert.equal(noteFit(e), 1);
  assert.equal(noteTier(e), 'chord');
});

test('F over C is an avoid note', () => {
  const [f] = laneFit(C, slotsFor(C, ['I']), lane([0, 2 * Q, 65]));
  assert.deepEqual(brief(f), ['avoid 11 24']);
  assert.equal(noteFit(f), -0.5);
});

test('C over G and G7 is avoid, over Dm it is the b7 scale tone, over Dm7 a chord tone', () => {
  const tiers = (numeral) => cellTiers(C, slotsFor(C, [numeral]))[0][0];
  assert.deepEqual([tiers('V').tier, tiers('V').label], ['avoid', '11']);
  assert.equal(tiers('V7').tier, 'avoid');
  assert.deepEqual([tiers('ii').tier, tiers('ii').label], ['scale', 'b7']);
  assert.deepEqual([tiers('ii7').tier, tiers('ii7').label], ['chord', '7']);
});

test('a whole note across C → G splits into two chord-tone pieces', () => {
  const slots = slotsFor(C, ['I', 'V']);
  const [g] = laneFit(C, slots, lane([0, 2 * BAR, 67]));
  assert.deepEqual(brief(g), ['chord 5 48', 'chord R 48']);
  assert.deepEqual(g.segments.map((s) => s.slot.index), [0, 1]);
});

test('an empty slot shows scale membership only', () => {
  const slots = slotsFor(C, ['']);
  const [d, cSharp] = laneFit(C, slots, lane([0, Q, 62], [Q, Q, 61]));
  assert.equal(d.segments[0].tier, 'scale');
  assert.equal(cSharp.segments[0].tier, 'outside');
  assert.equal(d.segments[0].chord, null);
  const aMinorPent = buildKey(9, 'minorPentatonic');
  assert.equal(emptySlotTiers(aMinorPent)[11].tier, 'parent'); // B: in A minor, not in the pentatonic
  assert.equal(emptySlotTiers(buildKey(9, 'blues'))[3].tier, 'blue'); // Eb is the blue note
});

test('a note that runs past the last bar reads as an empty slot there', () => {
  const [note] = laneFit(C, slotsFor(C, ['I']), lane([BAR - Q, 2 * Q, 65]));
  assert.deepEqual(brief(note), ['avoid 11 12', 'scale  12']);
  assert.equal(note.segments[1].slot, null);
});

test('noteTier picks the tier that covers most of the note', () => {
  const slots = slotsFor(C, ['I', 'V']);
  const [note] = laneFit(C, slots, lane([3 * Q, 3 * Q, 65])); // F: avoid over C for 12, scale (b7) over G for 24
  assert.deepEqual(brief(note), ['avoid 11 12', 'scale b7 24']);
  assert.equal(noteTier(note), 'scale');
});

test('slotFit: E and G over C is good, F whole over C clashes, no melody is null', () => {
  const slots = slotsFor(C, ['I', 'I']);
  assert.equal(slotFit(C, slots, lane([0, 2 * Q, 64], [2 * Q, 2 * Q, 67]), 0), 'good');
  assert.equal(slotFit(C, slots, lane([0, BAR, 65]), 0), 'clash');
  assert.equal(slotFit(C, slots, lane([0, 2 * Q, 64]), 1), null);
  assert.equal(slotFit(C, slotsFor(C, ['']), lane([0, Q, 64]), 0), null); // no chord
  // D (9) and E (3) halves over C: (0.4 * 36 + 1 * 24) / 60 = 0.64 → ok
  assert.equal(slotFit(C, slots, lane([0, 2 * Q, 62], [2 * Q, 2 * Q, 64]), 0), 'ok');
  assert.deepEqual([fitLevel(0.7), fitLevel(0.3), fitLevel(0.29), fitLevel(null)], ['good', 'ok', 'clash', null]);
});
