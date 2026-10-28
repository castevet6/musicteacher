import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeChord } from '../js/theory/analysis.js';
import { buildChord } from '../js/theory/chords.js';
import { noteName } from '../js/theory/notes.js';
import { chordScale, guideTones, notesOverChord } from '../js/theory/overChord.js';
import { buildKey } from '../js/theory/scales.js';

// Golden cases, checked by hand. See IMPLEMENTATION-PLAN.md §9.

const n = (name) => ({ letter: name[0], acc: name.length > 1 ? (name[1] === '#' ? 1 : -1) : 0 });

/** { chord: 'C(R) E(3) G(5)', scale: …, parent: …, avoid: …, blue: … } in pc order from the chord root. */
function tiers(rootPc, scaleId, root, quality) {
  const key = buildKey(rootPc, scaleId);
  const chord = buildChord(n(root), quality);
  const notes = notesOverChord(key, chord, analyzeChord(key, chord));
  const rootIndex = notes.findIndex((info) => info.label === 'R');
  const ordered = [...notes.slice(rootIndex), ...notes.slice(0, rootIndex)];
  const out = {};
  for (const info of ordered) {
    if (info.tier === 'outside') continue;
    (out[info.tier] ??= []).push(`${noteName(info.note)}(${info.label})`);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join(' ')]));
}

test('over C in C major: F is the avoid note', () => {
  assert.deepEqual(tiers(0, 'major', 'C', 'maj'), {
    chord: 'C(R) E(3) G(5)', scale: 'D(9) A(13) B(7)', avoid: 'F(11)',
  });
});

test('over G7 in C major: C (11) is avoided', () => {
  assert.deepEqual(tiers(0, 'major', 'G', 'dom7'), {
    chord: 'G(R) B(3) D(5) F(7)', scale: 'A(9) E(13)', avoid: 'C(11)',
  });
});

test('over Dm7 in C major: Dorian, no avoid notes', () => {
  assert.deepEqual(tiers(0, 'major', 'D', 'min7'), {
    chord: 'D(R) F(3) A(5) C(7)', scale: 'E(9) G(11) B(13)',
  });
});

test('over Em7 in C major: Phrygian b9 and b13 are avoided', () => {
  assert.deepEqual(tiers(0, 'major', 'E', 'min7'), {
    chord: 'E(R) G(3) B(5) D(7)', scale: 'A(11)', avoid: 'F(b9) C(b13)',
  });
});

test('over D7 in C major: D Mixolydian, F clashes with F#', () => {
  assert.deepEqual(tiers(0, 'major', 'D', 'dom7'), {
    chord: 'D(R) F#(3) A(5) C(7)', scale: 'E(9) B(13)', avoid: 'F(b3) G(11)',
  });
});

test('over E7 in A minor: Phrygian dominant from harmonic minor', () => {
  const key = buildKey(9, 'naturalMinor');
  const e7 = buildChord(n('E'), 'dom7');
  assert.deepEqual(chordScale(key, e7, analyzeChord(key, e7)).map(noteName), ['A', 'B', 'C', 'D', 'E', 'F', 'G#']);
  assert.deepEqual(tiers(9, 'naturalMinor', 'E', 'dom7'), {
    chord: 'E(R) G#(3) B(5) D(7)', scale: 'F(b9) C(b13)', avoid: 'G(b3) A(11)',
  });
  const g = notesOverChord(key, e7, analyzeChord(key, e7))[7];
  assert.equal(g.reason.kind, 'clash');
  assert.equal(noteName(g.reason.tone.note), 'G#');
});

test('over A7 in C major (V7/ii): b13 is a tension on a dominant', () => {
  assert.deepEqual(tiers(0, 'major', 'A', 'dom7'), {
    chord: 'A(R) C#(3) E(5) G(7)', scale: 'B(9) F(b13)', avoid: 'C(b3) D(11)',
  });
});

test('over Am in A minor pentatonic: B is a parent-scale extra', () => {
  assert.deepEqual(tiers(9, 'minorPentatonic', 'A', 'min'), {
    chord: 'A(R) C(3) E(5)', parent: 'B(9)', scale: 'D(11) G(b7)', avoid: 'F(b13)',
  });
});

test('over Am in A blues: Eb is the blue note', () => {
  const t = tiers(9, 'blues', 'A', 'min');
  assert.equal(t.blue, 'Eb(b5)');
  assert.equal(t.chord, 'A(R) C(3) E(5)');
});

const moves = (from, to) => guideTones(from, to)
  .map((m) => `${noteName(m.from)}(${m.fromRole})>${noteName(m.to)}(${m.toRole}) ${m.motion}`);

test('guide tones G7 → C and Dm7 → G7', () => {
  assert.deepEqual(moves(buildChord(n('G'), 'dom7'), buildChord(n('C'), 'maj')), ['B(3)>C(R) 1', 'F(7)>E(3) -1']);
  assert.deepEqual(moves(buildChord(n('D'), 'min7'), buildChord(n('G'), 'dom7')), ['F(3)>F(7) 0', 'C(7)>B(3) -1']);
  assert.deepEqual(moves(buildChord(n('E'), 'dom7'), buildChord(n('D'), 'dom7')), ['G#(3)>A(5) 1', 'D(7)>D(R) 0']);
});
