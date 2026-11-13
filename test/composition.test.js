import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CompositionError, TICKS_PER_BAR, TICKS_PER_BEAT, addNote, beatWeight, chordAtTick, clampLane, emptyLane,
  fileName, gridTicks, noteAt, parseComposition, removeNote, resizeNote, segmentWeight, segments,
  serializeComposition, slotSpan, transposeLane, LANES, defaultMix, isAudible, notesStarting, toggleMix, transposeDistance,
  emptyHistory, hasContent, popHistory, pushHistory, sameSnapshot, snapshotComposition,
} from '../js/theory/composition.js';
import { emptyProgression, flattenSlots, presetProgression, toggleSplit } from '../js/theory/progression.js';
import { buildKey } from '../js/theory/scales.js';

// Golden cases, checked by hand. See IMPLEMENTATION-PLAN.md §10.2.

const C = buildKey(0, 'major');
const Q = TICKS_PER_BEAT; // a quarter note
const note = (start, length, midi) => ({ start, length, midi });
const lane = (...notes) => notes.reduce((l, n) => addNote(l, n), emptyLane());

test('ticks: 12 per beat, 48 per bar, and the three grids', () => {
  assert.equal(TICKS_PER_BAR, 48);
  assert.deepEqual([4, 8, 16].map(gridTicks), [12, 6, 3]);
});

test('addNote keeps the lane sorted and monophonic', () => {
  const l = lane(note(Q, Q, 64), note(0, Q, 60));
  assert.deepEqual(l.notes.map((n) => n.start), [0, Q]);
  // A note placed over the second beat replaces the note there and nothing else.
  const replaced = addNote(l, note(Q, Q / 2, 67));
  assert.deepEqual(replaced.notes, [note(0, Q, 60), note(Q, Q / 2, 67)]);
  // A long note swallows every note it overlaps, even partially.
  const swallowed = addNote(l, note(Q / 2, 2 * Q, 62));
  assert.deepEqual(swallowed.notes, [note(Q / 2, 2 * Q, 62)]);
  // Lengths are at least one tick.
  assert.equal(addNote(emptyLane(), note(0, 0, 60)).notes[0].length, 1);
});

test('removeNote and noteAt address notes by their start', () => {
  const l = lane(note(0, Q, 60), note(2 * Q, Q, 64));
  assert.deepEqual(removeNote(l, 2 * Q).notes, [note(0, Q, 60)]);
  assert.equal(noteAt(l, Q - 1).midi, 60);
  assert.equal(noteAt(l, Q), null);
  assert.equal(noteAt(l, 2 * Q + 5).midi, 64);
});

test('resizeNote clamps to the next note and to the end of the last bar', () => {
  const l = lane(note(0, Q, 60), note(3 * Q, Q, 64));
  assert.equal(resizeNote(l, 0, 10 * Q, 1).notes[0].length, 3 * Q); // stops at the next note
  assert.equal(resizeNote(l, 3 * Q, 10 * Q, 1).notes[1].length, Q); // stops at the end of bar 1
  assert.equal(resizeNote(l, 3 * Q, 10 * Q, 2).notes[1].length, 5 * Q); // a second bar gives room
  assert.equal(resizeNote(l, 0, 0, 1).notes[0].length, 1);
  assert.equal(resizeNote(l, 7, 5, 1), l); // no note starts at 7
});

test('clampLane drops notes past the end and trims notes across it', () => {
  const crossing = lane(note(0, Q, 60), note(TICKS_PER_BAR - Q, 2 * Q, 62));
  assert.deepEqual(clampLane(crossing, 1).notes, [note(0, Q, 60), note(TICKS_PER_BAR - Q, Q, 62)]);
  const spread = lane(note(0, Q, 60), note(TICKS_PER_BAR, Q, 64), note(2 * TICKS_PER_BAR, Q, 65));
  assert.deepEqual(clampLane(spread, 2).notes.map((n) => n.midi), [60, 64]);
  assert.deepEqual(clampLane(spread, 1).notes.map((n) => n.midi), [60]);
});

test('transposeLane shifts every note', () => {
  assert.deepEqual(transposeLane(lane(note(0, Q, 60), note(Q, Q, 64)), 2).notes.map((n) => n.midi), [62, 66]);
  assert.deepEqual(transposeLane(lane(note(0, Q, 60)), -5).notes[0].midi, 55);
});

test('slot spans follow bars and halves', () => {
  const slots = flattenSlots(C, toggleSplit(presetProgression('pop'), 1)); // C | G · - | Am | F
  assert.deepEqual(slotSpan(slots[0]), { start: 0, length: 48 });
  assert.deepEqual(slotSpan(slots[1]), { start: 48, length: 24 });
  assert.deepEqual(slotSpan(slots[2]), { start: 72, length: 24 });
  assert.deepEqual(slotSpan(slots[3]), { start: 96, length: 48 });
});

test('chordAtTick: the chord in force, null in an empty slot or past the end', () => {
  const slots = flattenSlots(C, toggleSplit(presetProgression('pop'), 1));
  assert.equal(chordAtTick(slots, 0).symbol, 'C');
  assert.equal(chordAtTick(slots, 47).symbol, 'C');
  assert.equal(chordAtTick(slots, 48).symbol, 'G');
  assert.equal(chordAtTick(slots, 72), null); // the empty second half of bar 2
  assert.equal(chordAtTick(slots, 100).symbol, 'Am');
  assert.equal(chordAtTick(slots, 4 * 48), null);
});

test('segments cut a note at slot boundaries', () => {
  const slots = flattenSlots(C, presetProgression('pop'));
  const whole = note(2 * Q, 4 * Q, 67); // G from beat 3 of bar 1 to beat 3 of bar 2
  const parts = segments(slots, whole);
  assert.deepEqual(parts.map((p) => [p.start, p.length, p.slot.chord.symbol]), [[24, 24, 'C'], [48, 24, 'G']]);
  // A note inside one slot is one segment; one past the end gets a null slot.
  assert.equal(segments(slots, note(0, Q, 60)).length, 1);
  assert.deepEqual(segments(slots, note(4 * 48 - Q, 2 * Q, 60)).map((p) => p.slot?.chord.symbol ?? null), ['F', null]);
});

test('beat weights: 3 on beat 1, 2 on beat 3, 1 on beats 2 and 4, 0.5 off the beat', () => {
  assert.deepEqual([0, Q, 2 * Q, 3 * Q, Q / 2, 48 + 2 * Q].map(beatWeight), [3, 1, 2, 1, 0.5, 2]);
  assert.equal(segmentWeight({ start: 0, length: Q }), 36);
  assert.equal(segmentWeight({ start: 2 * Q, length: 2 * Q }), 48);
});

const state = () => ({
  title: 'Tune',
  key: buildKey(3, 'major'),
  style: 'jazz',
  playback: { bpm: 120 },
  progression: toggleSplit(presetProgression('twoFiveOne'), 3),
  melody: lane(note(0, Q, 67), note(Q, 2 * Q, 70)),
  bass: lane(note(0, 48, 41)),
});

test('a composition survives a round trip through its file', () => {
  const file = serializeComposition(state());
  assert.equal(file.version, 1);
  assert.deepEqual([file.rootPc, file.scaleId, file.tonicLetter, file.style, file.bpm], [3, 'major', 'E', 'jazz', 120]);
  const back = parseComposition(JSON.stringify(file));
  assert.deepEqual(back, file);
  // Parsing an object works too, and unknown extra fields are dropped.
  assert.deepEqual(parseComposition({ ...file, extra: 1 }), file);
});

test('fileName slugs the title', () => {
  assert.equal(fileName('My Song'), 'my-song.json');
  assert.equal(fileName('  Sävel – Nº 2! '), 'savel-no-2.json');
  assert.equal(fileName(''), 'composition.json');
});

test('parseComposition rejects every bad field and names it', () => {
  const good = serializeComposition(state());
  const bad = (patch) => {
    const raw = JSON.parse(JSON.stringify(good));
    patch(raw);
    return raw;
  };
  const rejects = (raw, path, code = 'field') => {
    assert.throws(() => parseComposition(raw), (err) => err instanceof CompositionError && err.code === code && err.path === path);
  };
  rejects('not json', '', 'not-json');
  rejects(bad((r) => { r.version = 2; }), 'version', 'version');
  rejects(bad((r) => { r.title = 5; }), 'title');
  rejects(bad((r) => { r.rootPc = 12; }), 'rootPc');
  rejects(bad((r) => { r.scaleId = 'dorian'; }), 'scaleId');
  rejects(bad((r) => { r.tonicLetter = 'H'; }), 'tonicLetter');
  rejects(bad((r) => { r.style = 'metal'; }), 'style');
  rejects(bad((r) => { r.bpm = 300; }), 'bpm');
  rejects(bad((r) => { r.progression.bars = []; }), 'progression.bars');
  rejects(bad((r) => { r.progression.bars = Array(17).fill({ chords: [null] }); }), 'progression.bars');
  rejects(bad((r) => { r.progression.bars[0].chords = [null, null, null]; }), 'progression.bars[0].chords');
  rejects(bad((r) => { r.progression.bars[1].chords[0].quality = 'sus4'; }), 'progression.bars[1].chords[0].quality');
  rejects(bad((r) => { r.progression.bars[1].chords[0].semis = 12; }), 'progression.bars[1].chords[0].semis');
  rejects(bad((r) => { r.melody = {}; }), 'melody');
  rejects(bad((r) => { r.melody.notes[0].midi = 128; }), 'melody.notes[0].midi');
  rejects(bad((r) => { r.melody.notes[0].start = 4 * 48; }), 'melody.notes[0].start');
  rejects(bad((r) => { r.melody.notes[1].length = 4 * 48; }), 'melody.notes[1].length');
  rejects(bad((r) => { r.melody.notes[0].length = 2 * Q; }), 'melody.notes[1]'); // overlaps the next note
  rejects(bad((r) => { r.bass.notes[0].start = 1.5; }), 'bass.notes[0].start');
  // An empty progression with empty lanes is a valid file.
  const empty = parseComposition(serializeComposition({ ...state(), progression: emptyProgression(1), melody: emptyLane(), bass: emptyLane() }));
  assert.equal(empty.progression.bars.length, 1);
});

test('notesStarting picks the notes that begin inside a span', () => {
  const lane = { notes: [{ start: 0, length: 24, midi: 60 }, { start: 24, length: 24, midi: 62 }, { start: 48, length: 12, midi: 64 }] };
  assert.deepEqual(notesStarting(lane, 0, 48).map((n) => n.midi), [60, 62]);
  assert.deepEqual(notesStarting(lane, 24, 24).map((n) => n.midi), [62]);
  assert.deepEqual(notesStarting(lane, 48, 48).map((n) => n.midi), [64]);
  assert.deepEqual(notesStarting(lane, 96, 48), []);
});

test('transposeDistance takes the shorter way round', () => {
  assert.equal(transposeDistance(0, 2), 2); // C → D
  assert.equal(transposeDistance(0, 9), -3); // C → A
  assert.equal(transposeDistance(9, 0), 3); // A → C
  assert.equal(transposeDistance(0, 6), -6); // a tritone goes down
  assert.equal(transposeDistance(0, 5), 5);
  assert.equal(transposeDistance(7, 7), 0);
});

test('mix: solo wins over mute, pressing again releases', () => {
  const mix = defaultMix();
  assert.ok(LANES.every((lane) => isAudible(mix, lane)));
  const muted = toggleMix(mix, 'chords', 'mute');
  assert.equal(isAudible(muted, 'chords'), false);
  assert.equal(isAudible(muted, 'melody'), true);
  const solo = toggleMix(muted, 'melody', 'solo');
  assert.deepEqual(LANES.map((lane) => isAudible(solo, lane)), [false, true, false]);
  const twoSolos = toggleMix(solo, 'bass', 'solo');
  assert.deepEqual(LANES.map((lane) => isAudible(twoSolos, lane)), [false, true, true]);
  assert.deepEqual(toggleMix(solo, 'melody', 'solo'), { ...muted });
  assert.deepEqual(toggleMix(muted, 'chords', 'mute'), mix);
  // Solo on a muted lane replaces the mute.
  assert.equal(toggleMix(muted, 'chords', 'solo').chords, 'solo');
});

// ---------- Undo history ----------

const session = () => ({
  title: 'Tune', rootPc: 3, scaleId: 'major', tonicLetter: 'E', style: 'jazz',
  playback: { bpm: 120, playing: false }, progression: presetProgression('twoFiveOne'),
  melody: lane(note(0, Q, 67)), bass: emptyLane(), grid: 8,
});

test('a snapshot keeps the composition fields and shares the lanes', () => {
  const s = session();
  const snap = snapshotComposition(s);
  assert.deepEqual(Object.keys(snap).sort(),
    ['bass', 'bpm', 'melody', 'progression', 'rootPc', 'scaleId', 'style', 'title', 'tonicLetter']);
  assert.equal(snap.bpm, 120);
  assert.equal(snap.melody, s.melody);
  assert.ok(sameSnapshot(snap, snapshotComposition({ ...s, grid: 16 })), 'view settings are not undoable');
  assert.ok(!sameSnapshot(snap, snapshotComposition({ ...s, melody: removeNote(s.melody, 0) })));
});

test('history: undo returns the newest entry, a repeated tag folds into one entry', () => {
  const a = { n: 'a' };
  const b = { n: 'b' };
  const c = { n: 'c' };
  let h = pushHistory(emptyHistory(), a);
  h = pushHistory(h, b, 'roll:melody:1');
  h = pushHistory(h, c, 'roll:melody:1'); // same drag: folded
  assert.deepEqual(h.entries, [a, b]);
  h = pushHistory(h, c, 'roll:melody:2');
  assert.deepEqual(h.entries, [a, b, c]);
  const popped = popHistory(h);
  assert.equal(popped.snapshot, c);
  assert.deepEqual(popped.history, { entries: [a, b], tag: null });
  // After an undo the next edit with the old tag still records.
  assert.equal(pushHistory(popped.history, c, 'roll:melody:2').entries.length, 3);
  assert.equal(popHistory(emptyHistory()), null);
});

test('history keeps the newest entries up to its limit', () => {
  let h = emptyHistory();
  for (let i = 0; i < 5; i++) h = pushHistory(h, i, null, 3);
  assert.deepEqual(h.entries, [2, 3, 4]);
});

test('hasContent: any chord or lane note', () => {
  const empty = { progression: emptyProgression(4), melody: emptyLane(), bass: emptyLane() };
  assert.equal(hasContent(empty), false);
  assert.equal(hasContent({ ...empty, bass: lane(note(0, Q, 40)) }), true);
  assert.equal(hasContent({ ...empty, progression: presetProgression('twoFiveOne') }), true);
});
