import { test } from 'node:test';
import assert from 'node:assert/strict';
import { critiqueName, critiqueText } from '../js/theory/adviceText.js';
import { TICKS_PER_BAR as BAR, TICKS_PER_BEAT as Q } from '../js/theory/composition.js';
import { RULES, critiqueLane } from '../js/theory/melodyCritique.js';
import { flattenSlots, presetProgression } from '../js/theory/progression.js';
import { buildKey } from '../js/theory/scales.js';
import { LANGS } from '../js/theory/text/index.js';

// Golden cases, checked by hand. See IMPLEMENTATION-PLAN.md §10.8. C major, chords C G Am F.

const C = buildKey(0, 'major');
const slots = flattenSlots(C, presetProgression('pop'));
const E = Q / 2; // an eighth
/** A lane from [start, length, midi] triples. */
const lane = (...notes) => ({ notes: notes.map(([start, length, midi]) => ({ start, length, midi })) });
/** "rule@noteIndex" for each item. */
const brief = (lane_, opts) => critiqueLane(C, slots, lane_, opts).map((it) => `${it.rule}@${it.noteIndex}`);
/** The note indexes where one rule fires; the golden rows each speak about one rule. */
const fires = (rule, lane_, opts) => critiqueLane(C, slots, lane_, opts).filter((it) => it.rule === rule).map((it) => it.noteIndex);

test('F on beat 1 over C passes when E follows, fires when A follows', () => {
  assert.deepEqual(fires('nct-strong-beat', lane([0, Q, 65], [Q, Q, 64])), []);
  assert.deepEqual(fires('nct-strong-beat', lane([0, Q, 65], [Q, Q, 69])), [0]);
  assert.deepEqual(fires('nct-strong-beat', lane([0, Q, 64], [Q, Q, 65], [2 * Q, Q, 67])), []); // F on beat 2 is weak
  const [item] = critiqueLane(C, slots, lane([0, Q, 65], [Q, Q, 69]));
  assert.deepEqual([item.data.note, item.data.chord.symbol, item.data.label, item.data.bar, item.data.beat], [{ letter: 'F', acc: 0 }, 'C', '11', 1, 1]);
});

test('a held F over C is an avoid note held; with E after it only rule 2 fires', () => {
  const held = lane([0, 2 * Q, 65]);
  assert.deepEqual(fires('avoid-held', held, { grid: 8 }), [0]);
  assert.deepEqual(fires('nct-strong-beat', held, { grid: 8 }), [0]);
  assert.deepEqual(fires('nct-strong-beat', lane([0, 2 * Q, 65], [2 * Q, Q, 64]), { grid: 8 }), []);
  // At grid 1/4 a quarter-note F is one grid step and is not "held"; at 1/8 it is.
  assert.deepEqual(fires('avoid-held', lane([0, Q, 65], [Q, Q, 64]), { grid: 4 }), []);
  assert.deepEqual(fires('avoid-held', lane([0, Q, 65], [Q, Q, 64]), { grid: 8 }), [0]);
});

test('F F# G eighths pass; F# then C is unresolved', () => {
  assert.deepEqual(brief(lane([0, E, 65], [E, E, 66], [2 * E, E, 67], [3 * E, Q, 64])), []); // nothing at all
  assert.deepEqual(fires('outside-unresolved', lane([0, Q, 66], [Q, Q, 60])), [0]);
  // Jazz lets an approach note pass when it is left by a half step, however it was reached.
  const approach = lane([0, Q, 60], [Q, E, 66], [Q + E, Q, 67]);
  assert.deepEqual(fires('outside-unresolved', approach, { style: 'jazz' }), []);
  assert.deepEqual(fires('outside-unresolved', approach, { style: 'pop' }), [1]);
});

test('a leap is fine when the next note steps back the other way', () => {
  assert.deepEqual(fires('big-leap', lane([0, Q, 60], [Q, Q, 72], [2 * Q, Q, 74])), [1]);
  assert.deepEqual(fires('big-leap', lane([0, Q, 60], [Q, Q, 72], [2 * Q, Q, 71])), []);
  // Folk draws the line at a fifth, pop at a sixth.
  assert.deepEqual(fires('big-leap', lane([0, Q, 60], [Q, Q, 69], [2 * Q, Q, 71]), { style: 'folk' }), [1]);
  assert.deepEqual(fires('big-leap', lane([0, Q, 60], [Q, Q, 69], [2 * Q, Q, 71]), { style: 'pop' }), []);
  const [item] = critiqueLane(C, slots, lane([0, Q, 60], [Q, Q, 72], [2 * Q, Q, 74]));
  assert.deepEqual([item.data.interval, item.data.up, item.data.limit], [12, true, 9]);
});

test('D F D F over C has no chord tone in the bar', () => {
  assert.deepEqual(fires('bar-no-chord-tone', lane([0, Q, 62], [Q, Q, 65], [2 * Q, Q, 62], [3 * Q, Q, 65])), [0]);
  assert.deepEqual(fires('bar-no-chord-tone', lane([0, Q, 62], [Q, Q, 64])), []);
  // A bar with no chord raises nothing (bar 5 lies past the progression).
  assert.deepEqual(brief(lane([4 * BAR, Q, 62])), []);
});

test('ending on D over F is off the chord, ending on A is not', () => {
  assert.deepEqual(fires('ends-off-chord', lane([3 * BAR, Q, 69], [3 * BAR + Q, Q, 62])), [1]);
  assert.deepEqual(fires('ends-off-chord', lane([3 * BAR, Q, 62], [3 * BAR + Q, Q, 69])), []);
  // Items come back in note order, rule order within a note.
  assert.deepEqual(brief(lane([BAR, Q, 67], [BAR + Q, 2 * Q, 72])), ['avoid-held@1', 'ends-off-chord@1']); // G then a held C over G ends the piece
});

test('beginner level keeps rules 1, 3 and 5 only', () => {
  const everything = lane(
    [0, 2 * Q, 65], [2 * Q, Q, 66], [3 * Q, Q, 78], // held F (1, 2), F# (3), leap (4)
    [BAR, Q, 62], [BAR + Q, Q, 65], // bar 2 over G: no chord tone (5)
    [3 * BAR, Q, 62], // ends on D over F (6)
  );
  const all = brief(everything);
  for (const rule of RULES) assert.ok(all.some((it) => it.startsWith(rule)), `${rule} in ${all.join(' ')}`);
  const beginner = brief(everything, { level: 'beginner' });
  assert.deepEqual([...new Set(beginner.map((it) => it.split('@')[0]))].sort(), ['bar-no-chord-tone', 'nct-strong-beat', 'outside-unresolved']);
});

test('every rule has a name and a sentence in both languages and levels', () => {
  const items = critiqueLane(C, slots, lane(
    [0, 2 * Q, 65], [2 * Q, Q, 66], [3 * Q, Q, 78], [BAR, Q, 62], [BAR + Q, Q, 65], [3 * BAR, Q, 62],
  ));
  for (const lang of LANGS) {
    for (const level of ['beginner', 'intermediate']) {
      for (const rule of RULES) assert.ok(critiqueName(rule, level, lang).length > 3);
      for (const item of items) {
        const text = critiqueText(item, level, lang);
        assert.ok(text.length > 10 && !text.includes('undefined'), `${lang} ${level} ${item.rule}: ${text}`);
      }
    }
  }
  const dOverF = items.find((it) => it.rule === 'ends-off-chord');
  assert.match(critiqueText(dOverF, 'intermediate', 'en'), /ends on D, a non-chord tone \(13\) over F/);
  assert.match(critiqueText(dOverF, 'intermediate', 'fi'), /päättyy säveleen D/);
});
