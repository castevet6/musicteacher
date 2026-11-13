// The sound model for Composer: one patch per lane (chords, melody, bass), the
// presets they start from, the mixer levels, and the envelope and filter maths.
// Pure data and functions. Web Audio lives in js/audio/synth.js.

import { diatonicChords } from './chords.js';
import { mod12, pcOf } from './notes.js';

/**
 * @typedef {{ preset: string, wave: 'sine'|'triangle'|'square'|'sawtooth', warmth: number, octave: number,
 *   cutoff: number, resonance: number, attack: number, decay: number, sustain: number, release: number, reverb: number }} Patch
 */

export const WAVES = ['sine', 'triangle', 'square', 'sawtooth'];

/**
 * The patch parameters in modal order. `kind` is 'choice' (a value from
 * `values`) or 'number' (clamped to [min, max] and rounded to `step`).
 */
export const SOUND_PARAMS = [
  { param: 'wave', kind: 'choice', values: WAVES },
  { param: 'warmth', kind: 'number', min: 0, max: 25, step: 1, unit: 'cents' },
  { param: 'octave', kind: 'number', min: 0, max: 1, step: 0.01, unit: 'gain' },
  { param: 'cutoff', kind: 'number', min: 200, max: 8000, step: 1, unit: 'Hz' },
  { param: 'resonance', kind: 'number', min: 0, max: 15, step: 0.1, unit: 'dB' },
  { param: 'attack', kind: 'number', min: 0, max: 1, step: 0.001, unit: 's' },
  { param: 'decay', kind: 'number', min: 0.05, max: 2, step: 0.01, unit: 's' },
  { param: 'sustain', kind: 'number', min: 0, max: 1, step: 0.01, unit: 'x peak' },
  { param: 'release', kind: 'number', min: 0.02, max: 3, step: 0.01, unit: 's' },
  { param: 'reverb', kind: 'number', min: 0, max: 1, step: 0.01, unit: 'send' },
];

export const SOUND_LANES = ['chords', 'melody', 'bass'];
export const LEVEL_LANES = ['chords', 'melody', 'bass', 'click'];
export const DEFAULT_LEVEL = 75;

// Column order of each row: wave, warmth, octave, cutoff, resonance, attack, decay, sustain, release, reverb.
const values = (wave, warmth, octave, cutoff, resonance, attack, decay, sustain, release, reverb) => ({
  wave, warmth, octave, cutoff, resonance, attack, decay, sustain, release, reverb,
});

/** Presets per lane. Insertion order is the dropdown order. */
export const SOUND_PRESETS = {
  chords: {
    warmPad: values('triangle', 8, 0.15, 1800, 1, 0.04, 0.6, 0.7, 0.9, 0.3),
    epiano: values('sine', 4, 0.35, 3000, 0, 0.005, 1.2, 0.35, 0.6, 0.2),
    organ: values('sine', 2, 0.6, 4000, 0, 0.01, 0.1, 1, 0.12, 0.25),
    pluck: values('triangle', 0, 0.3, 2500, 2, 0.003, 0.9, 0, 0.3, 0.15),
    classic: values('triangle', 0, 0.3, 8000, 0, 0.005, 1.5, 0, 0.3, 0),
  },
  melody: {
    softLead: values('sawtooth', 5, 0, 1600, 1, 0.015, 0.4, 0.7, 0.15, 0.25),
    flute: values('sine', 3, 0.1, 3000, 0, 0.06, 0.2, 0.85, 0.15, 0.3),
    squareLead: values('square', 4, 0, 2000, 3, 0.01, 0.3, 0.6, 0.1, 0.2),
    brightSaw: values('sawtooth', 8, 0, 5000, 4, 0.01, 0.3, 0.6, 0.1, 0.15),
    classic: values('sawtooth', 0, 0, 3100, 0.7, 0.01, 0.75, 0.6, 0.15, 0),
  },
  bass: {
    classic: values('sine', 0, 0.35, 900, 0.5, 0.008, 1.0, 0.68, 0.2, 0),
    round: values('sine', 3, 0.15, 600, 0, 0.01, 0.8, 0.8, 0.15, 0.05),
    pluckBass: values('triangle', 0, 0.3, 1200, 3, 0.003, 0.6, 0.2, 0.12, 0.05),
    synthBass: values('sawtooth', 6, 0, 700, 6, 0.005, 0.4, 0.5, 0.1, 0.05),
  },
};

export const DEFAULT_PRESET = { chords: 'warmPad', melody: 'softLead', bass: 'classic' };

/** Reference pitch (MIDI) of each lane, where the brightness setting is exact. */
export const TRACK_REF = { chords: 60, melody: 72, bass: 40 };

const TRACK_MIN_HZ = 80;
const TRACK_MAX_HZ = 16000;

/** The patch for `id` in `lane`, as a new object with its `preset` set. */
export function presetPatch(lane, id) {
  return { preset: id, ...SOUND_PRESETS[lane][id] };
}

/** Every lane's patch from its default preset. */
export function defaultSounds() {
  return Object.fromEntries(SOUND_LANES.map((lane) => [lane, presetPatch(lane, DEFAULT_PRESET[lane])]));
}

/** Every mixer level at its default. */
export function defaultLevels() {
  return Object.fromEntries(LEVEL_LANES.map((lane) => [lane, DEFAULT_LEVEL]));
}

/**
 * A copy of `patch` with `param` set to `value`. Numbers are clamped and
 * rounded, an unknown wave keeps the old one, and a change marks the patch
 * 'custom'. An unchanged value returns `patch` itself.
 * @param {Patch} patch
 * @param {string} param
 * @param {unknown} value
 * @returns {Patch}
 */
export function withParam(patch, param, value) {
  const spec = SOUND_PARAMS.find((s) => s.param === param);
  if (!spec) return patch;
  const next = spec.kind === 'choice' ? chooseWave(spec, value, patch[param]) : clampNumber(spec, value, patch[param]);
  if (next === patch[param]) return patch;
  return { ...patch, [param]: next, preset: 'custom' };
}

const chooseWave = (spec, value, current) => (spec.values.includes(value) ? value : current);

function clampNumber(spec, value, current) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return current;
  const clamped = Math.min(spec.max, Math.max(spec.min, value));
  const rounded = Math.round(clamped / spec.step) * spec.step;
  return Number(Math.min(spec.max, Math.max(spec.min, rounded)).toFixed(6));
}

/** Mixer gain for a fader level: 75 is unity, the curve is squared. */
export const levelGain = (level) => (level / DEFAULT_LEVEL) ** 2;

const CUTOFF_MIN = 200;
const CUTOFF_MAX = 8000;

/** Brightness slider (0–100) to cutoff in Hz, on a log scale from 200 Hz to 8 kHz. */
export const cutoffFromSlider = (x) => Math.round(CUTOFF_MIN * (CUTOFF_MAX / CUTOFF_MIN) ** (x / 100));

/** The inverse of cutoffFromSlider, rounded to 0.1. */
export const sliderFromCutoff = (hz) =>
  Math.round(((100 * Math.log(hz / CUTOFF_MIN)) / Math.log(CUTOFF_MAX / CUTOFF_MIN)) * 10) / 10;

/**
 * The cutoff a note of `midi` in `lane` gets: half-octave tracking, so one
 * octave above the reference opens the filter by √2.
 */
export function trackedCutoff(cutoff, midi, lane) {
  const hz = cutoff * 2 ** ((midi - TRACK_REF[lane]) / 24);
  return Math.min(TRACK_MAX_HZ, Math.max(TRACK_MIN_HZ, hz));
}

/**
 * The gain automation for one voice: `{ events, stopAt }`. Events are
 * `{ type: 'set'|'linear'|'target', value, time, tau? }`, times in seconds.
 */
export function envelopeSchedule({ attack, decay, sustain, release }, start, duration, peak) {
  const end = start + Math.max(0.05, duration);
  const attackEnd = start + Math.max(0.003, attack);
  const rampEnd = Math.min(attackEnd, end);
  const rampPeak = (peak * (rampEnd - start)) / (attackEnd - start);
  const releaseTime = Math.max(release, 0.01);
  const events = [
    { type: 'set', value: 0, time: start },
    { type: 'linear', value: rampPeak, time: rampEnd },
  ];
  if (rampEnd < end) events.push({ type: 'target', value: peak * sustain, time: rampEnd, tau: decay / 5 });
  events.push({ type: 'target', value: 0, time: end, tau: releaseTime / 5 });
  return { events, stopAt: end + releaseTime + 0.05 };
}

const defaultFail = (path) => {
  throw new Error(path);
};

const expect = (ok, path, fail) => {
  if (!ok) fail(path);
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function parseSoundLane(raw, lane, path, fail) {
  if (raw === undefined) return presetPatch(lane, DEFAULT_PRESET[lane]);
  expect(isObject(raw), path, fail);
  expect(raw.preset === 'custom' || Object.hasOwn(SOUND_PRESETS[lane], raw.preset), `${path}.preset`, fail);
  const patch = { preset: raw.preset };
  for (const spec of SOUND_PARAMS) {
    const v = raw[spec.param];
    const ok = spec.kind === 'choice'
      ? spec.values.includes(v)
      : typeof v === 'number' && Number.isFinite(v) && v >= spec.min && v <= spec.max;
    expect(ok, `${path}.${spec.param}`, fail);
    patch[spec.param] = v;
  }
  return patch;
}

/**
 * The sounds block of a file, with defaults for a missing block or lane.
 * Calls `fail(path)` on the first malformed field.
 */
export function parseSounds(raw, path = 'sounds', fail = defaultFail) {
  if (raw === undefined) return defaultSounds();
  expect(isObject(raw), path, fail);
  return Object.fromEntries(SOUND_LANES.map((lane) => [lane, parseSoundLane(raw[lane], lane, `${path}.${lane}`, fail)]));
}

/**
 * The levels block of a file: integers 0–100 per lane, defaults for anything
 * missing. Calls `fail(path)` on the first malformed field.
 */
export function parseLevels(raw, path = 'levels', fail = defaultFail) {
  if (raw === undefined) return defaultLevels();
  expect(isObject(raw), path, fail);
  return Object.fromEntries(LEVEL_LANES.map((lane) => {
    const v = raw[lane];
    if (v === undefined) return [lane, DEFAULT_LEVEL];
    expect(Number.isInteger(v) && v >= 0 && v <= 100, `${path}.${lane}`, fail);
    return [lane, v];
  }));
}

const PREVIEW_MELODY_STEPS = 5;
const PREVIEW_BASS_PATTERN = [0, 7, 12, 7, 0];
const PREVIEW_CHORD_DEGREES = [0, 3, 4, 0];

/**
 * The notes of the Preview button for `lane`, with `at` in seconds from now.
 * Chords are the triads on I, IV, V, I. The melody climbs five scale notes
 * from the tonic and comes back down. The bass walks root, fifth, octave.
 * @returns {Array<{ at: number, duration: number, midi?: number, chord?: object }>}
 */
export function previewPhrase(key, lane) {
  if (lane === 'chords') {
    const triads = diatonicChords(key).filter((e) => e.kind === 'triad');
    return PREVIEW_CHORD_DEGREES.map((degree, i) => ({
      at: i * 1.0,
      duration: 0.9,
      chord: triads.find((e) => e.degree === degree).chord,
    }));
  }
  if (lane === 'melody') {
    const pcs = key.scaleNotes.map(pcOf);
    const up = [60 + key.rootPc];
    for (let i = 1; i < PREVIEW_MELODY_STEPS; i++) {
      const pc = pcs[i % pcs.length];
      let midi = up[i - 1] + 1;
      while (mod12(midi) !== pc) midi += 1;
      up.push(midi);
    }
    const midis = [...up, ...up.slice(0, -1).reverse()];
    return midis.map((midi, i) => ({ at: i * 0.3, duration: 0.28, midi }));
  }
  const root = 36 + key.rootPc;
  return PREVIEW_BASS_PATTERN.map((offset, i) => ({ at: i * 0.4, duration: 0.35, midi: root + offset }));
}
