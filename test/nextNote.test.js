import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ghostReasonText } from '../js/theory/adviceText.js';
import { TICKS_PER_BAR as BAR, TICKS_PER_BEAT as Q } from '../js/theory/composition.js';
import { GHOST_REASONS, suggestNextNotes } from '../js/theory/nextNote.js';
import { emptyProgression, flattenSlots, parseNumeral, presetProgression, setChordAt } from '../js/theory/progression.js';
import { buildKey } from '../js/theory/scales.js';
import { LANGS } from '../js/theory/text/index.js';

// Golden cases, checked by hand. See IMPLEMENTATION-PLAN.md §10.8.

const C = buildKey(0, 'major');
function slotsFor(key, numerals) {
  let p = emptyProgression(numerals.length);
  numerals.forEach((n, bar) => { if (n) p = setChordAt(p, { bar, half: 0 }, parseNumeral(n, 'major')); });
  return flattenSlots(key, p);
}
const lane = (...notes) => ({ notes: notes.map(([start, length, midi]) => ({ start, length, midi })) });
const brief = (result) => result.ghosts.map((g) => `${g.midi}:${g.reason}`);

test('after B4 over G, C5 resolves the leading tone first', () => {
  const slots = slotsFor(C, ['I', 'V', 'I']);
  const result = suggestNextNotes(C, slots, lane([BAR + 3 * Q, Q, 71]), BAR + 3 * Q, { grid: 4 });
  assert.equal(result.tick, 2 * BAR);
  assert.equal(brief(result)[0], '72:resolves');
  assert.equal(result.ghosts.length, 3);
});

test('after F4 over C (an avoid note), E4 resolves first', () => {
  const slots = slotsFor(C, ['I']);
  const result = suggestNextNotes(C, slots, lane([0, Q, 65]), 0, { grid: 4 });
  assert.equal(result.tick, Q);
  assert.equal(brief(result)[0], '64:resolves');
});

test('after E4 over C, G4 and D4 are among the three and D4 is a step', () => {
  const result = suggestNextNotes(C, slotsFor(C, ['I']), lane([0, Q, 64]), 0, { grid: 4 });
  const got = brief(result);
  assert.ok(got.some((g) => g.startsWith('67:')), got.join(' '));
  assert.ok(got.includes('62:step'), got.join(' '));
  assert.equal(got.length, 3);
  assert.equal(new Set(result.ghosts.map((g) => g.reason)).size, 3, 'three different reasons');
});

test('with no notes yet, bar 1 over C offers C4 E4 G4; over an empty bar the tonic triad', () => {
  assert.deepEqual(brief(suggestNextNotes(C, slotsFor(C, ['I']), lane(), null)), ['60:chord-tone', '64:chord-tone', '67:chord-tone']);
  assert.deepEqual(brief(suggestNextNotes(C, slotsFor(C, ['V']), lane(), null)).map((g) => g.split(':')[0]), ['67', '71', '74']);
  assert.deepEqual(brief(suggestNextNotes(C, slotsFor(C, ['']), lane(), null)), ['60:chord-tone', '64:chord-tone', '67:chord-tone']);
  const aMinor = buildKey(9, 'naturalMinor');
  assert.deepEqual(brief(suggestNextNotes(aMinor, slotsFor(aMinor, ['']), lane(), null)).map((g) => g.split(':')[0]), ['69', '72', '76']);
});

test('the seventh of a chord resolves down; a repeated note costs more in jazz', () => {
  const slots = slotsFor(C, ['V7', 'I']);
  const afterF = suggestNextNotes(C, slots, lane([3 * Q, Q, 65]), 3 * Q, { grid: 4 }); // F is the 7th of G7
  assert.equal(brief(afterF)[0], '64:resolves');
  const pop = suggestNextNotes(C, slotsFor(C, ['I']), lane([0, Q, 60]), 0, { style: 'pop', grid: 4 });
  const jazz = suggestNextNotes(C, slotsFor(C, ['I']), lane([0, Q, 60]), 0, { style: 'jazz', grid: 4 });
  const score = (r, midi) => r.ghosts.find((g) => g.midi === midi)?.score ?? null;
  assert.equal(score(pop, 60) - 1, score(jazz, 60) ?? score(pop, 60) - 1);
});

test('no ghosts past the last bar or on top of an existing note', () => {
  const slots = slotsFor(C, ['I']);
  assert.deepEqual(suggestNextNotes(C, slots, lane([3 * Q, Q, 64]), 3 * Q, { grid: 4 }).ghosts, []);
  assert.deepEqual(suggestNextNotes(C, slots, lane([0, Q, 64], [Q, Q, 65]), 0, { grid: 4 }).ghosts, []);
  // The default is after the last note.
  assert.equal(suggestNextNotes(C, slotsFor(C, ['I', 'I']), lane([0, Q, 64], [Q, Q, 65]), null, { grid: 4 }).tick, 2 * Q);
  // A ghost stays inside the key: C# is never offered over C.
  const all = suggestNextNotes(C, slots, lane([0, Q, 60]), 0, { grid: 4 });
  assert.ok(all.ghosts.every((g) => g.midi % 12 !== 1));
});

test('every reason has a text in both languages and levels', () => {
  for (const lang of LANGS) {
    for (const level of ['beginner', 'intermediate']) {
      for (const reason of GHOST_REASONS) assert.ok(ghostReasonText(reason, level, lang).length > 3, `${lang} ${level} ${reason}`);
    }
  }
  assert.equal(ghostReasonText('resolves', 'intermediate', 'en'), 'resolves the tendency');
  assert.equal(ghostReasonText('step', 'beginner', 'fi'), 'liikkuu yhden askeleen');
});

test('the pop preset melody of milestone 3 gets a ghost after Twinkle', () => {
  const slots = flattenSlots(C, presetProgression('pop'));
  const twinkle = lane([0, Q, 60], [Q, Q, 60], [2 * Q, Q, 67], [3 * Q, Q, 67]);
  const result = suggestNextNotes(C, slots, twinkle, null, { grid: 4 });
  assert.equal(result.tick, BAR);
  assert.ok(result.ghosts.length >= 2);
});

// ---------- Bass ghosts (milestone 13) ----------

const bass = (r) => suggestNextNotes(C, r.slots, r.lane, r.after ?? null, { voice: 'bass', grid: 4, loop: r.loop ?? false });

test('bass: with no notes yet, bar 1 over C offers C2 first, then G2 and E2', () => {
  assert.deepEqual(brief(bass({ slots: slotsFor(C, ['I']), lane: lane() })), ['36:root', '43:chord-tone', '40:chord-tone']);
  assert.deepEqual(brief(bass({ slots: slotsFor(C, ['V']), lane: lane() })).map((g) => g.split(':')[0]), ['43', '50', '47']);
});

test('bass: after a whole C2, the next bar over G7 starts on a G root', () => {
  const result = bass({ slots: slotsFor(C, ['I', 'V7']), lane: lane([0, BAR, 36]) });
  assert.equal(result.tick, BAR);
  const [first] = result.ghosts;
  assert.equal(first.midi % 12, 7);
  assert.equal(first.reason, 'root');
});

test('bass: on beat 4 before G7, F#2 is offered as a chromatic approach', () => {
  const slots = slotsFor(C, ['I', 'V7']);
  const result = bass({ slots, lane: lane([0, Q, 36], [Q, Q, 43], [2 * Q, Q, 40]), after: 2 * Q });
  assert.equal(result.tick, 3 * Q);
  assert.ok(brief(result).includes('42:approach'), brief(result).join(' '));
  // Not earlier in the bar, and not before an empty bar.
  assert.ok(!brief(bass({ slots, lane: lane([0, Q, 36], [Q, Q, 40]), after: Q })).some((g) => g.endsWith(':approach')));
  const open = slotsFor(C, ['I', '']);
  assert.ok(!brief(bass({ slots: open, lane: lane([0, Q, 36], [Q, Q, 43], [2 * Q, Q, 40]), after: 2 * Q })).some((g) => g.endsWith(':approach')));
  // At the end of the piece the loop decides: back into C in bar 1.
  const last = bass({ slots, lane: lane([BAR, Q, 43], [BAR + Q, Q, 47], [BAR + 2 * Q, Q, 50]), after: BAR + 2 * Q, loop: true });
  assert.ok(brief(last).includes('47:approach'), brief(last).join(' '));
});

test('bass: ghosts stay inside E1–G3', () => {
  const low = bass({ slots: slotsFor(C, ['vi']), lane: lane([0, Q, 28]), after: 0 });
  const high = bass({ slots: slotsFor(C, ['V']), lane: lane([0, Q, 55]), after: 0 });
  for (const g of [...low.ghosts, ...high.ghosts]) assert.ok(g.midi >= 28 && g.midi <= 55, String(g.midi));
  assert.equal(low.ghosts.length, 3);
  assert.equal(high.ghosts.length, 3);
});
