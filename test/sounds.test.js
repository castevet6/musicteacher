import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chordLabel } from '../js/theory/chords.js';
import {
  DEFAULT_PRESET, LEVEL_LANES, SOUND_LANES, SOUND_PRESETS, SOUND_PARAMS, DEFAULT_LEVEL, TRACK_REF,
  cutoffFromSlider, defaultLevels, defaultSounds, envelopeSchedule, levelGain, parseLevels, parseSounds,
  presetPatch, previewPhrase, sliderFromCutoff, trackedCutoff, withParam,
} from '../js/theory/sounds.js';
import { buildKey } from '../js/theory/scales.js';

// Golden cases, checked by hand. See IMPLEMENTATION-PLAN.md §11.9.

const throwing = (path) => {
  throw new Error(path);
};
const fails = (fn, path) => assert.throws(fn, (err) => err.message === path);
const round9 = (x) => Math.round(x * 1e9) / 1e9;
const plain = (events) => events.map((e) => {
  const out = { type: e.type, value: e.value, time: round9(e.time) };
  if (e.tau !== undefined) out.tau = round9(e.tau);
  return out;
});

test('defaults: warm pad, soft lead and classic bass', () => {
  const s = defaultSounds();
  assert.equal(s.chords.preset, 'warmPad');
  assert.equal(s.melody.preset, 'softLead');
  assert.equal(s.bass.preset, 'classic');
  assert.deepEqual(defaultLevels(), { chords: 75, melody: 75, bass: 75, click: 75 });
  assert.equal(DEFAULT_LEVEL, 75);
  assert.deepEqual(SOUND_LANES, ['chords', 'melody', 'bass']);
  assert.deepEqual(LEVEL_LANES, ['chords', 'melody', 'bass', 'click']);
  assert.deepEqual(SOUND_PARAMS.map((p) => p.param), ['wave', 'warmth', 'octave', 'cutoff', 'resonance', 'attack', 'decay', 'sustain', 'release', 'reverb']);
});

test('every preset passes parseSounds as a lane block', () => {
  for (const lane of SOUND_LANES) {
    for (const id of Object.keys(SOUND_PRESETS[lane])) {
      const patch = presetPatch(lane, id);
      assert.equal(patch.preset, id);
      const back = parseSounds({ [lane]: patch }, 'sounds', throwing);
      assert.deepEqual(back[lane], patch, `${lane}.${id}`);
    }
  }
  assert.equal(SOUND_PRESETS.chords.classic.cutoff, 8000);
  assert.equal(Object.keys(SOUND_PRESETS.chords).length + Object.keys(SOUND_PRESETS.melody).length + Object.keys(SOUND_PRESETS.bass).length, 14);
  for (const lane of SOUND_LANES) assert.ok(DEFAULT_PRESET[lane] in SOUND_PRESETS[lane]);
});

test('withParam clamps, rounds and marks the patch custom', () => {
  const p = presetPatch('chords', 'warmPad');
  assert.equal(withParam(p, 'cutoff', 99999).cutoff, 8000);
  assert.equal(withParam(p, 'attack', -1).attack, 0);
  const epiano = presetPatch('chords', 'epiano');
  assert.equal(withParam(epiano, 'warmth', 7.6).warmth, 8);
  assert.equal(withParam(epiano, 'warmth', 7.6).preset, 'custom');
  assert.equal(withParam(p, 'wave', 'noise').wave, p.wave);
  assert.equal(withParam(p, 'wave', 'square').wave, 'square');
  assert.equal(withParam(p, 'wave', 'square').preset, 'custom');
  // The same value gives back the identical object, preset and all.
  assert.equal(withParam(p, 'warmth', p.warmth), p);
  assert.equal(withParam(p, 'cutoff', 1800.2), p);
  // The input is never mutated.
  assert.equal(p.preset, 'warmPad');
});

test('levelGain: 75 is unity, 0 is silent, 100 is about 1.78', () => {
  assert.equal(levelGain(75), 1);
  assert.equal(levelGain(0), 0);
  assert.ok(Math.abs(levelGain(100) - 1.778) < 0.001);
});

test('brightness slider maps to 200 Hz - 8 kHz on a log scale', () => {
  assert.equal(cutoffFromSlider(0), 200);
  assert.equal(cutoffFromSlider(100), 8000);
  assert.equal(cutoffFromSlider(50), 1265);
  // The slider keeps one decimal, so the round trip is close but not exact.
  // This lands exactly 2 Hz from 1800 (see the report).
  assert.ok(Math.abs(cutoffFromSlider(sliderFromCutoff(1800)) - 1800) <= 2);
});

test('trackedCutoff: half-octave tracking from each lane reference, clamped', () => {
  assert.equal(TRACK_REF.chords, 60);
  assert.equal(trackedCutoff(1000, 60, 'chords'), 1000);
  assert.ok(Math.abs(trackedCutoff(1000, 72, 'chords') - 1414.2) < 0.05);
  assert.equal(trackedCutoff(1000, 40, 'bass'), 1000);
  assert.equal(trackedCutoff(8000, 120, 'chords'), 16000);
});

test('envelopeSchedule: attack, decay to sustain, then release', () => {
  const { events, stopAt } = envelopeSchedule({ attack: 0.1, decay: 0.5, sustain: 0.5, release: 1 }, 2, 1, 0.8);
  assert.deepEqual(plain(events), [
    { type: 'set', value: 0, time: 2 },
    { type: 'linear', value: 0.8, time: 2.1 },
    { type: 'target', value: 0.4, time: 2.1, tau: 0.1 },
    { type: 'target', value: 0, time: 3, tau: 0.2 },
  ]);
  assert.ok(Math.abs(stopAt - 4.05) < 1e-9);
});

test('envelopeSchedule: a short note ramps to a partial peak and has no decay', () => {
  const { events, stopAt } = envelopeSchedule({ attack: 0.2, decay: 0.5, sustain: 0.5, release: 0.5 }, 0, 0.1, 1);
  assert.deepEqual(plain(events), [
    { type: 'set', value: 0, time: 0 },
    { type: 'linear', value: 0.5, time: 0.1 },
    { type: 'target', value: 0, time: 0.1, tau: 0.1 },
  ]);
  assert.ok(Math.abs(stopAt - 0.65) < 1e-9);
});

test('envelopeSchedule: a duration below 0.05 s is lengthened to 0.05 s', () => {
  const { events, stopAt } = envelopeSchedule({ attack: 0.2, decay: 0.5, sustain: 0.5, release: 0.5 }, 0, 0.01, 1);
  assert.equal(round9(events.at(-1).time), 0.05);
  assert.equal(round9(stopAt), 0.6);
});

test('parseSounds: missing block gives defaults, a partial block fills the rest', () => {
  assert.deepEqual(parseSounds(undefined), defaultSounds());
  const flute = presetPatch('melody', 'flute');
  const partial = parseSounds({ melody: flute });
  assert.deepEqual(partial.melody, flute);
  assert.deepEqual(partial.chords, defaultSounds().chords);
  assert.deepEqual(partial.bass, defaultSounds().bass);
});

test('parseSounds rejects bad lanes and names the field', () => {
  const flute = presetPatch('melody', 'flute');
  const classic = presetPatch('bass', 'classic');
  const warm = presetPatch('chords', 'warmPad');
  fails(() => parseSounds({ melody: { ...flute, cutoff: 'banana' } }, 'sounds', throwing), 'sounds.melody.cutoff');
  fails(() => parseSounds({ bass: { ...classic, preset: 'warmPad' } }, 'sounds', throwing), 'sounds.bass.preset');
  fails(() => parseSounds({ chords: { ...warm, wave: 'noise' } }, 'sounds', throwing), 'sounds.chords.wave');
  fails(() => parseSounds({ chords: { ...warm, reverb: 1.5 } }, 'sounds', throwing), 'sounds.chords.reverb');
  fails(() => parseSounds({ chords: { ...warm, sustain: NaN } }, 'sounds', throwing), 'sounds.chords.sustain');
  fails(() => parseSounds({ chords: 'warm' }, 'sounds', throwing), 'sounds.chords');
  fails(() => parseSounds(7, 'sounds', throwing), 'sounds');
  // A custom patch with valid numbers is fine.
  assert.equal(parseSounds({ bass: { ...classic, preset: 'custom', cutoff: 333 } }).bass.preset, 'custom');
});

test('parseLevels: defaults, a missing lane, and range checks', () => {
  assert.deepEqual(parseLevels(undefined), defaultLevels());
  assert.deepEqual(parseLevels({ click: 40 }), { chords: 75, melody: 75, bass: 75, click: 40 });
  fails(() => parseLevels({ melody: 101 }, 'levels', throwing), 'levels.melody');
  fails(() => parseLevels({ melody: 30.5 }, 'levels', throwing), 'levels.melody');
  fails(() => parseLevels({ bass: '50' }, 'levels', throwing), 'levels.bass');
});

test('previewPhrase: melody climbs five scale notes and comes back down', () => {
  const phrase = previewPhrase(buildKey(0, 'major'), 'melody');
  assert.deepEqual(phrase.map((e) => e.midi), [60, 62, 64, 65, 67, 65, 64, 62, 60]);
  assert.deepEqual(phrase.map((e) => round9(e.at)), [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4]);
  assert.ok(phrase.every((e) => e.duration === 0.28));
});

test('previewPhrase: bass walks root, fifth and octave', () => {
  const phrase = previewPhrase(buildKey(0, 'major'), 'bass');
  assert.deepEqual(phrase.map((e) => e.midi), [36, 43, 48, 43, 36]);
  assert.deepEqual(phrase.map((e) => round9(e.at)), [0, 0.4, 0.8, 1.2, 1.6]);
});

test('previewPhrase: chords are the triads on I, IV, V, I', () => {
  const cMajor = previewPhrase(buildKey(0, 'major'), 'chords');
  assert.deepEqual(cMajor.map((e) => [e.at, e.duration]), [[0, 0.9], [1, 0.9], [2, 0.9], [3, 0.9]]);
  assert.deepEqual(cMajor.map((e) => chordLabel(e.chord, 'en')), ['C', 'F', 'G', 'C']);
  assert.ok(cMajor.every((e) => e.chord.quality === 'maj'));
  const aMinor = previewPhrase(buildKey(9, 'naturalMinor'), 'chords');
  assert.deepEqual(aMinor.map((e) => chordLabel(e.chord, 'en')), ['Am', 'Dm', 'Em', 'Am']);
});
