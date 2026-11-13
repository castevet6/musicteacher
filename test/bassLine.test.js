import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BASS_HIGH, BASS_LOW, BASS_PATTERNS, applyPattern, bassFit, bassPattern, bassTiers, plainTier,
} from '../js/theory/bassLine.js';
import { TICKS_PER_BAR as BAR } from '../js/theory/composition.js';
import { cellTiers, noteFit, noteTier } from '../js/theory/melodyFit.js';
import { emptyProgression, flattenSlots, parseNumeral, setChordAt, toggleSplit } from '../js/theory/progression.js';
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

// Bass patterns, C | G7 looping (IMPLEMENTATION-PLAN.md §10.8). MIDI: C2 36, G1 31, G2 43, D2 38, D3 50, G3 55.
const Q = BAR / 4;
const H = BAR / 2;
const notesOf = (lane) => lane.notes.map((n) => [n.start, n.length, n.midi]);
const cg7 = slotsFor(C, ['I', 'V7']);
const pattern = (id, slots = cg7, loop = true) => notesOf(bassPattern(C, slots, id, { loop }));
const quarters = (bar, ...midis) => midis.map((m, i) => [bar * BAR + i * Q, Q, m]);

test('pattern list: three pop patterns, one folk, one jazz', () => {
  assert.deepEqual(BASS_PATTERNS.map((p) => `${p.id}:${p.style}`),
    ['root:pop', 'rootFifth:pop', 'rootOctave:pop', 'alternating:folk', 'walking:jazz']);
});

test('root: C2 whole, G2 whole', () => {
  assert.deepEqual(pattern('root'), [[0, BAR, 36], [BAR, BAR, 43]]);
});

test('rootFifth: C2 G2 halves, G2 D3 halves', () => {
  assert.deepEqual(pattern('rootFifth'), [[0, H, 36], [H, H, 43], [BAR, H, 43], [BAR + H, H, 50]]);
});

test('rootOctave: C2 C3 halves, G2 G3 halves', () => {
  assert.deepEqual(pattern('rootOctave'), [[0, H, 36], [H, H, 48], [BAR, H, 43], [BAR + H, H, 55]]);
});

test('alternating: C2 G1 C2 G1, G2 D2 G2 D2 quarters', () => {
  assert.deepEqual(pattern('alternating'), [...quarters(0, 36, 31, 36, 31), ...quarters(1, 43, 38, 43, 38)]);
});

test('walking: C2 E2 G2 F#2, G2 B2 D3 B2 (B2 approaches C3 in the loop)', () => {
  assert.deepEqual(pattern('walking'), [...quarters(0, 36, 40, 43, 42), ...quarters(1, 43, 47, 50, 47)]);
});

test('walking without the loop: the last bar walks back down to its 3rd', () => {
  assert.deepEqual(pattern('walking', cg7, false).slice(4), quarters(1, 43, 47, 50, 47));
  const [, , , last] = pattern('walking', slotsFor(C, ['I']), false);
  assert.deepEqual(last, [3 * Q, Q, 40]);
});

test('walking a ii–V–I: Dm7 G7 Cmaj7 each lead into the next root', () => {
  const slots = slotsFor(C, ['ii7', 'V7', 'Imaj7']);
  // D2 F2 A2 F#2 | G2 B2 D3 B2 | C3 E3 G3 B2→… : C3 is the C nearest G2, then no next chord, back to E3.
  assert.deepEqual(pattern('walking', slots, false),
    [...quarters(0, 38, 41, 45, 42), ...quarters(1, 43, 47, 50, 47), ...quarters(2, 48, 52, 55, 52)]);
});

test('a two-beat slot walks root and approach; other patterns split it the same way', () => {
  let p = emptyProgression(1);
  p = setChordAt(p, { bar: 0, half: 0 }, parseNumeral('I', 'major'));
  p = toggleSplit(p, 0);
  p = setChordAt(p, { bar: 0, half: 1 }, parseNumeral('V', 'major'));
  const slots = flattenSlots(C, p);
  assert.deepEqual(pattern('walking', slots, false), [[0, Q, 36], [Q, Q, 42], [H, Q, 43], [H + Q, Q, 47]]);
  assert.deepEqual(pattern('root', slots, false), [[0, H, 36], [H, H, 43]]);
  assert.deepEqual(pattern('alternating', slots, false), [[0, Q, 36], [Q, Q, 31], [H, Q, 43], [H + Q, Q, 38]]);
});

test('empty slots stay empty and the root voice-leads across them', () => {
  const slots = slotsFor(C, ['I', '', 'IV']);
  // F nearest C2 within C2–C3 is F2 (41).
  assert.deepEqual(pattern('root', slots, false), [[0, BAR, 36], [2 * BAR, BAR, 41]]);
});

test('the first root sits in C2–B2: in A minor, Am starts on A2 and Bdim on B2', () => {
  const Am = buildKey(9, 'naturalMinor');
  assert.equal(bassPattern(Am, slotsFor(Am, ['i'], 'minor'), 'root').notes[0].midi, 45);
  assert.equal(bassPattern(Am, slotsFor(Am, ['ii°'], 'minor'), 'root').notes[0].midi, 47);
});

test('a diminished chord takes its flat fifth', () => {
  assert.deepEqual(pattern('rootFifth', slotsFor(C, ['vii°']), false), [[0, H, 47], [H, H, 53]]);
});

test('applyPattern: all slots replaces the filled slots and keeps notes in empty ones', () => {
  const slots = slotsFor(C, ['I', '', 'V7']);
  const drawn = lane([0, Q, 40], [BAR, Q, 33], [2 * BAR + Q, Q, 30]);
  const result = applyPattern(drawn, bassPattern(C, slots, 'root'), slots);
  assert.deepEqual(notesOf(result), [[0, BAR, 36], [BAR, Q, 33], [2 * BAR, BAR, 43]]);
});

test('applyPattern: one slot only touches that slot', () => {
  const slots = slotsFor(C, ['I', 'V7']);
  const drawn = lane([0, Q, 40], [BAR, Q, 33]);
  const result = applyPattern(drawn, bassPattern(C, slots, 'rootFifth'), slots, 1);
  assert.deepEqual(notesOf(result), [[0, Q, 40], [BAR, H, 43], [BAR + H, H, 50]]);
});
