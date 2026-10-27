import { test } from 'node:test';
import assert from 'node:assert/strict';
import { noteName } from '../js/theory/notes.js';
import { buildKey } from '../js/theory/scales.js';
import { chromaticChords, suggestChords } from '../js/theory/suggest.js';

// Golden cases, checked by hand. See IMPLEMENTATION-PLAN.md §3.6.

const suggest = (rootPc, scaleId, pc) => suggestChords(buildKey(rootPc, scaleId), pc);
const group = (result, id) =>
  result.groups.find((g) => g.id === id)?.chords.map((c) => `${c.symbol} ${c.roman} ${c.roleOfSelected}`) ?? [];

test('C major, E: every diatonic chord containing E', () => {
  const r = suggest(0, 'major', 4);
  assert.equal(r.inScale, true);
  assert.equal(r.explanation, null);
  assert.deepEqual(group(r, 'diatonic'),
    ['C I 3', 'Cmaj7 Imaj7 3', 'Em iii R', 'Em7 iii7 R', 'Fmaj7 IVmaj7 7', 'Am vi 5', 'Am7 vi7 5']);
  // C (V/IV) is already diatonic as I, so only C7 is listed for IV.
  assert.deepEqual(group(r, 'secondary'),
    ['A V/ii 5', 'A7 V7/ii 5', 'C7 V7/IV 3', 'E V/vi R', 'E7 V7/vi R']);
});

test('C major, D: G7 is diatonic, D7 is a secondary dominant', () => {
  const r = suggest(0, 'major', 2);
  assert.ok(group(r, 'diatonic').includes('G7 V7 5'));
  assert.deepEqual(group(r, 'borrowed'), []);
  assert.deepEqual(group(r, 'secondary'), ['D V/V R', 'D7 V7/V R', 'E7 V7/vi 7']);
});

test('A minor, D: harmonic-minor E7 is offered for a scale note', () => {
  const r = suggest(9, 'naturalMinor', 2);
  assert.ok(group(r, 'diatonic').includes('Em7 v7 7'));
  assert.deepEqual(group(r, 'borrowed'), ['E7 V7 7', 'G#dim7 #vii°7 5']);
  assert.equal(r.groups.find((g) => g.id === 'borrowed').chords[0].source, 'harmonic minor');
  // G and G7 (V/III) are already diatonic as VII and VII7.
  assert.deepEqual(group(r, 'secondary'), ['D V/VII R', 'D7 V7/VII R']);
});

test('A minor, B: harmonic-minor E and E7 are offered', () => {
  const r = suggest(9, 'naturalMinor', 11);
  assert.deepEqual(group(r, 'borrowed'), ['E V 5', 'E7 V7 5', 'G#dim7 #vii°7 3']);
});

test('C major, F#: secondary dominants only', () => {
  const r = suggest(0, 'major', 6);
  assert.equal(r.inScale, false);
  assert.equal(noteName(r.note), 'F#');
  assert.deepEqual(group(r, 'borrowed'), []);
  assert.deepEqual(group(r, 'secondary'), ['B V/iii 5', 'B7 V7/iii 5', 'D V/V 3', 'D7 V7/V 3']);
  assert.match(r.explanation, /^F# is the #4\/b5/);
});

test('C major, Ab: borrowed from C minor plus V/vi', () => {
  const r = suggest(0, 'major', 8);
  assert.equal(noteName(r.note), 'Ab');
  assert.deepEqual(group(r, 'borrowed'), [
    'Ddim ii° 5', 'Dm7b5 iiø7 5', 'Fm iv 3', 'Fm7 iv7 3', 'Ab bVI R', 'Abmaj7 bVImaj7 R', 'Bb7 bVII7 7',
  ]);
  assert.deepEqual(group(r, 'secondary'), ['E V/vi 3', 'E7 V7/vi 3']);
  const e = r.groups.find((g) => g.id === 'secondary').chords[0];
  assert.equal(noteName(e.tones[1].note), 'G#');
});

test('A minor, G#: parallel major and harmonic minor', () => {
  const r = suggest(9, 'naturalMinor', 8);
  assert.deepEqual(group(r, 'borrowed'), [
    'Amaj7 Imaj7 7', 'C#m #iii 5', 'C#m7 #iii7 5', 'E V 3', 'E7 V7 3',
    'G#dim #vii° R', 'G#m7b5 #viiø7 R', 'G#dim7 #vii°7 R',
  ]);
  assert.deepEqual(group(r, 'secondary'), []);
  const e = r.groups[0].chords.find((c) => c.symbol === 'E');
  assert.equal(e.source, 'parallel major / harmonic minor');
});

test('A minor, Bb: V7/VI', () => {
  const r = suggest(9, 'naturalMinor', 10);
  assert.deepEqual(group(r, 'borrowed'), []);
  assert.deepEqual(group(r, 'secondary'), ['C7 V7/VI 7']);
  assert.equal(noteName(r.note), 'Bb');
});

test('E blues, Bb: blue note uses the out-of-scale groups', () => {
  const r = suggest(4, 'blues', 10);
  assert.equal(r.inScale, true);
  assert.equal(r.inParent, false);
  assert.equal(r.isBlueNote, true);
  assert.equal(noteName(r.note), 'Bb');
  assert.ok(!r.groups.some((g) => g.id === 'diatonic'));
  assert.ok(r.groups.length > 0);
  assert.match(r.explanation, /^Blue note:/);
});

test('C major pentatonic, F: gap note gets parent-scale chords', () => {
  const r = suggest(0, 'majorPentatonic', 5);
  assert.equal(r.inScale, false);
  assert.equal(r.inParent, true);
  assert.equal(r.groups[0].id, 'diatonic');
  assert.match(r.explanation, /parent major scale/);
});

test('fitsScale marks chords made only of pentatonic notes', () => {
  const r = suggest(0, 'majorPentatonic', 4);
  const fits = Object.fromEntries(r.groups[0].chords.map((c) => [c.symbol, c.fitsScale]));
  assert.equal(fits.C, true);
  assert.equal(fits.Am7, true);
  assert.equal(fits.Em, false);
});

test('every chromatic note in every key gets at least one chord', () => {
  for (let root = 0; root < 12; root++) {
    for (const scaleId of ['major', 'naturalMinor', 'blues']) {
      for (let pc = 0; pc < 12; pc++) {
        const r = suggest(root, scaleId, pc);
        assert.ok(r.groups.length > 0, `${root} ${scaleId} ${pc}`);
        assert.ok(r.groups.every((g) => g.id !== 'chromatic'), `fallback used: ${root} ${scaleId} ${pc}`);
      }
    }
  }
});

test('chromatic fallback builds major and minor triads on the note', () => {
  assert.deepEqual(chromaticChords({ letter: 'D', acc: -1 }).map((c) => c.symbol), ['Db', 'Dbm']);
});
