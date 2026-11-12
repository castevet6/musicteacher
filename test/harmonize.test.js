import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextChords } from '../js/theory/analysis.js';
import { TICKS_PER_BAR as BAR, TICKS_PER_BEAT as Q } from '../js/theory/composition.js';
import { keyReasonText, rankReasonText } from '../js/theory/adviceText.js';
import { guessKeys, rankChords, slotFit } from '../js/theory/harmonize.js';
import { emptyProgression, flattenSlots, parseNumeral, rekeyProgression, setChordAt } from '../js/theory/progression.js';
import { buildKey } from '../js/theory/scales.js';
import { LANGS } from '../js/theory/text/index.js';

// Golden cases, checked by hand. See IMPLEMENTATION-PLAN.md §10.8. C major.

const C = buildKey(0, 'major');
function slotsFor(key, numerals) {
  let p = emptyProgression(numerals.length);
  numerals.forEach((n, bar) => { if (n) p = setChordAt(p, { bar, half: 0 }, parseNumeral(n, 'major')); });
  return flattenSlots(key, p);
}
const lane = (...notes) => ({ notes: notes.map(([start, length, midi]) => ({ start, length, midi })) });
const symbols = (ranking) => ranking.map((r) => r.chord.symbol);
const rank = (ranking, symbol) => symbols(ranking).indexOf(symbol);
const H = 2 * Q;

test('E and G halves: C first with fit 1, Em second, Am below both', () => {
  const ranking = rankChords(C, slotsFor(C, ['']), lane([0, H, 64], [H, H, 67]), 0);
  assert.deepEqual(symbols(ranking).slice(0, 2), ['C', 'Em']);
  assert.equal(ranking[0].fit, 1);
  assert.ok(ranking[0].reasons.includes('fit-all') && ranking[0].reasons.includes('primary'));
  assert.ok(rank(ranking, 'Am') > 1);
  assert.ok(rank(ranking, 'Am') >= 0);
});

test('F and A halves in jazz: Fmaj7 and Dm7 above F and Dm', () => {
  const jazz = rankChords(C, slotsFor(C, ['']), lane([0, H, 65], [H, H, 69]), 0, { style: 'jazz' });
  assert.ok(rank(jazz, 'Fmaj7') < rank(jazz, 'F'), symbols(jazz).join(' '));
  assert.ok(rank(jazz, 'Dm7') < rank(jazz, 'F'), symbols(jazz).join(' '));
  assert.ok(rank(jazz, 'Dm7') < rank(jazz, 'Dm'));
  const pop = rankChords(C, slotsFor(C, ['']), lane([0, H, 65], [H, H, 69]), 0, { style: 'pop' });
  assert.ok(rank(pop, 'F') < rank(pop, 'Fmaj7'), symbols(pop).join(' '));
});

test('B D F D quarters: G7 first, Bdim second', () => {
  const ranking = rankChords(C, slotsFor(C, ['']), lane([0, Q, 71], [Q, Q, 62], [H, Q, 65], [3 * Q, Q, 62]), 0);
  assert.deepEqual(symbols(ranking).slice(0, 2), ['G7', 'Bdim']);
  assert.equal(ranking[0].fit, 1);
  assert.equal(ranking[1].fit, 1);
});

test('an Ab whole note: no diatonic chord fits, Fm and Ab are offered with Fm first', () => {
  const ranking = rankChords(C, slotsFor(C, ['']), lane([0, BAR, 68]), 0);
  assert.ok(ranking.filter((r) => r.group === 'diatonic').every((r) => r.fit === -1));
  assert.ok(ranking.slice(0, 3).every((r) => r.group !== 'diatonic' && r.fit === 1));
  // Diatonic chords sink below every borrowed chord that fits better than they do.
  assert.ok(ranking.findIndex((r) => r.group === 'diatonic') > ranking.findIndex((r) => r.chord.symbol === 'Bb'));
  assert.deepEqual(symbols(ranking).slice(0, 2), ['Fm', 'Ab']);
  assert.ok(ranking[0].reasons.includes('borrowed'));
});

test('slot 4 with a D whole note after C Am F, loop on: G above Dm thanks to the cadence into bar 1', () => {
  const slots = slotsFor(C, ['I', 'vi', 'IV', '']);
  const looped = rankChords(C, slots, lane([3 * BAR, BAR, 62]), 3, { loop: true });
  assert.ok(rank(looped, 'G') < rank(looped, 'Dm'), symbols(looped).join(' '));
  const g = looped.find((r) => r.chord.symbol === 'G');
  assert.ok(g.reasons.includes('cadence'));
  const unlooped = rankChords(C, slots, lane([3 * BAR, BAR, 62]), 3, { loop: false });
  assert.ok(!unlooped.find((r) => r.chord.symbol === 'G').reasons.includes('cadence'));
});

test('an empty-melody slot after C lists the nextChords order for C with fit null', () => {
  const slots = slotsFor(C, ['I', '']);
  const ranking = rankChords(C, slots, lane([0, Q, 64]), 1);
  assert.deepEqual(symbols(ranking), nextChords(C, slots[0].chord).map((o) => o.chord.symbol));
  assert.ok(ranking.every((r) => r.fit === null && r.score === null));
  assert.ok(ranking[0].reasons.length === 1);
  // Nothing before it: the tonic first.
  const first = rankChords(C, slotsFor(C, ['', '']), lane(), 0, { loop: false });
  assert.equal(first[0].chord.symbol, 'C');
  assert.deepEqual(first[0].reasons, ['start-on-tonic']);
});

test('slotFit: C with E G is good, C with an F whole note clashes', () => {
  const slots = slotsFor(C, ['I']);
  assert.equal(slotFit(C, slots, lane([0, H, 64], [H, H, 67]), 0), 'good');
  assert.equal(slotFit(C, slots, lane([0, BAR, 65]), 0), 'clash');
});

test('a repeated chord is nudged down; every reason has texts in both languages', () => {
  const slots = slotsFor(C, ['I', '']);
  const ranking = rankChords(C, slots, lane([BAR, H, 64], [BAR + H, H, 67]), 1);
  // C still fits perfectly but Em (no repeat penalty, same fit) edges closer: C keeps the lead on the primary bonus.
  const c = ranking.find((r) => r.chord.symbol === 'C');
  const em = ranking.find((r) => r.chord.symbol === 'Em');
  assert.ok(Math.abs(c.score - em.score) < 0.1);
  for (const lang of LANGS) {
    for (const level of ['beginner', 'intermediate']) {
      for (const reason of ['fit-all', 'fit-most', 'cadence', 'primary', 'borrowed', 'secondary', 'start-on-tonic', 'resolve']) {
        assert.ok(rankReasonText(reason, level, lang).length > 3, `${lang} ${level} ${reason}`);
      }
    }
  }
});

// Key guess golden rows.

const quarters = (...midis) => lane(...midis.map((m, i) => [i * Q, Q, m]));
const keyNames = (results) => results.map((r) => `${r.rootPc}:${r.scaleId}`);

test('C D E F G A B C: C major, then A minor', () => {
  const results = guessKeys(quarters(60, 62, 64, 65, 67, 69, 71, 72), slotsFor(C, ['', '']));
  assert.deepEqual(keyNames(results).slice(0, 2), ['0:major', '9:naturalMinor']);
  assert.deepEqual(results[0].reasons, ['fits-all', 'ends-on-tonic']);
  assert.ok(results[0].score > results[1].score);
});

test('A C D E G A ending on A: A minor pentatonic, A minor, C major pentatonic', () => {
  const results = guessKeys(quarters(69, 72, 74, 76, 79, 81), slotsFor(C, ['', '']));
  assert.deepEqual(keyNames(results), ['9:minorPentatonic', '9:naturalMinor', '0:majorPentatonic']);
});

test('F G A Bb C D E F: F major, then D minor', () => {
  const results = guessKeys(quarters(65, 67, 69, 70, 72, 74, 76, 77), slotsFor(C, ['', '']));
  assert.deepEqual(keyNames(results).slice(0, 2), ['5:major', '2:naturalMinor']);
});

test('D E F# G over G D Em C: G major first, E minor second, both with diatonic chords', () => {
  const G = buildKey(7, 'major');
  const slots = slotsFor(G, ['I', 'V', 'vi', 'IV']);
  const results = guessKeys(quarters(62, 64, 66, 67), slots);
  assert.deepEqual(keyNames(results).slice(0, 2), ['7:major', '4:naturalMinor']);
  assert.ok(results[0].reasons.includes('chords-diatonic'));
  assert.ok(results[1].reasons.includes('chords-diatonic'));
});

test('E G A Bb B D E: E blues first, E minor pentatonic second; blues needs its blue note', () => {
  const results = guessKeys(quarters(64, 67, 69, 70, 71, 74, 76), slotsFor(C, ['', '']));
  assert.deepEqual(keyNames(results).slice(0, 2), ['4:blues', '4:minorPentatonic']);
  assert.equal(results[1].reasons[0], 'fits-most');
  assert.ok(results[1].coverage > 0.85 && results[1].coverage < 0.86);
  const noBlue = guessKeys(quarters(64, 67, 69, 71, 74, 76), slotsFor(C, ['', '']));
  assert.ok(!noBlue.some((r) => r.scaleId === 'blues'));
  assert.deepEqual(guessKeys(lane(), slotsFor(C, [''])), []);
});

test('the bass counts too, and chords alone give a guess', () => {
  const slots = slotsFor(C, ['I', 'IV', 'V', 'I']);
  const fromChords = guessKeys(lane(), slots);
  assert.equal(keyNames(fromChords)[0], '0:major');
  const bass = lane([0, BAR, 46], [BAR, BAR, 46]); // Bb pedal pulls towards F
  assert.ok(guessKeys(lane(), slotsFor(C, ['IV']), bass)[0].rootPc === 5);
});

test('rekeyProgression keeps every chord and renames it', () => {
  const G = buildKey(7, 'major');
  let p = emptyProgression(4);
  ['V', 'II', 'iii', 'I'].forEach((n, bar) => { p = setChordAt(p, { bar, half: 0 }, parseNumeral(n, 'major')); });
  const before = flattenSlots(C, p).map((s) => s.chord.symbol);
  assert.deepEqual(before, ['G', 'D', 'Em', 'C']);
  const rekeyed = rekeyProgression(C, G, p);
  assert.deepEqual(flattenSlots(G, rekeyed).map((s) => s.chord.symbol), before);
  assert.deepEqual(rekeyed.bars.map((b) => b.chords[0].steps), [0, 4, 5, 3]);
  for (const lang of LANGS) {
    for (const level of ['beginner', 'intermediate']) {
      for (const reason of ['fits-all', 'fits-most', 'ends-on-tonic', 'chords-diatonic']) {
        assert.ok(keyReasonText(reason, 0.857, level, lang).length > 3);
      }
    }
  }
  assert.equal(keyReasonText('fits-most', 0.857, 'beginner', 'en'), '86% of the notes fit');
});
