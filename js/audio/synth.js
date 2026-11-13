// Web Audio for Composer and Explore. Every voice is built from the lane's patch
// when it is scheduled (js/theory/sounds.js); the graph is built once, on the
// first click, so browsers allow audio. Imports nothing from state.js.
import { closeVoicing } from '../theory/chords.js';
import { midiToFreq } from '../theory/notes.js';
import {
  defaultLevels, defaultSounds, envelopeSchedule, levelGain, LEVEL_LANES, SOUND_LANES, trackedCutoff,
} from '../theory/sounds.js';

const STRUM_DELAY = 0.025;
const WAVE_GAIN = { sine: 1, triangle: 0.9, square: 0.45, sawtooth: 0.55 };
const LANE_PEAK = { chords: 0.7, melody: 1.6, bass: 1.1 };
const STOP_FADE = 0.1;

let ctx = null;
let master = null;
let reverb = null;
const bus = {}; // per mixer lane (plus click): gain = levelGain(level)
const send = {}; // per sound lane: gain = patch.reverb, into the shared reverb
let sounds = defaultSounds();
let levels = defaultLevels();

// Voices sounding or scheduled: { env, oscs }. Stop cuts them all.
const voices = new Set();

/** A 2 s stereo noise tail that decays with the cube of time. */
function impulse(c) {
  const length = Math.round(c.sampleRate * 2);
  const buffer = c.createBuffer(2, length, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  return buffer;
}

/** Push the current levels and reverb sends to the graph; ramped when playing, at once when building. */
function applyMix(ramp) {
  const now = ctx.currentTime;
  const set = (param, value) => (ramp ? param.setTargetAtTime(value, now, 0.02) : (param.value = value));
  for (const lane of LEVEL_LANES) set(bus[lane].gain, levelGain(levels[lane]));
  for (const lane of SOUND_LANES) set(send[lane].gain, sounds[lane].reverb);
}

// Created inside the first click so browsers allow audio.
export function context() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx);
    reverb.normalize = true;
    reverb.connect(master);
    for (const lane of LEVEL_LANES) {
      bus[lane] = ctx.createGain();
      bus[lane].connect(master);
    }
    for (const lane of SOUND_LANES) {
      send[lane] = ctx.createGain();
      send[lane].connect(reverb);
    }
    applyMix(false);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/**
 * Store the sound patches and mixer levels. Voices scheduled from now on use
 * them; the bus gains and reverb sends follow at once if the graph exists.
 * @param {Record<string, object>} nextSounds per lane: a Patch
 * @param {Record<string, number>} nextLevels per mixer lane: 0–100
 */
export function setSoundConfig(nextSounds, nextLevels) {
  sounds = nextSounds;
  levels = nextLevels;
  if (ctx) applyMix(true);
}

/**
 * One note of `lane` from audio time `start`, held for `duration` seconds, then
 * released with the patch's release time. `peakScale` scales the note's loudness.
 */
function voice(lane, midi, start, duration, peakScale = 1) {
  const c = context();
  const patch = sounds[lane];
  const freq = midiToFreq(midi);
  const { events, stopAt } = envelopeSchedule(patch, start, duration, LANE_PEAK[lane] * WAVE_GAIN[patch.wave] * peakScale);

  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = trackedCutoff(patch.cutoff, midi, lane);
  filter.Q.value = patch.resonance;

  const oscs = [];
  for (const detune of [-patch.warmth / 2, patch.warmth / 2]) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = patch.wave;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.value = 0.5;
    osc.connect(gain).connect(filter);
    oscs.push(osc);
  }
  if (patch.octave > 0) {
    const upper = c.createOscillator();
    const upperGain = c.createGain();
    upper.type = 'sine';
    upper.frequency.value = freq * 2;
    upperGain.gain.value = patch.octave;
    upper.connect(upperGain).connect(filter);
    oscs.push(upper);
  }

  const env = c.createGain();
  for (const e of events) {
    if (e.type === 'set') env.gain.setValueAtTime(e.value, e.time);
    else if (e.type === 'linear') env.gain.linearRampToValueAtTime(e.value, e.time);
    else env.gain.setTargetAtTime(e.value, e.time, e.tau);
  }
  filter.connect(env);
  env.connect(bus[lane]);
  env.connect(send[lane]);

  const entry = { env, oscs };
  voices.add(entry);
  oscs[0].onended = () => voices.delete(entry);
  for (const osc of oscs) {
    osc.start(start);
    osc.stop(stopAt);
  }
}

/** Cut every voice that is sounding or scheduled; used by Stop. */
export function stopAll() {
  if (!ctx) return;
  const now = ctx.currentTime;
  for (const { env, oscs } of voices) {
    try {
      env.gain.cancelScheduledValues(now);
      env.gain.setValueAtTime(env.gain.value, now);
      env.gain.setTargetAtTime(0, now, 0.02);
    } catch {
      // A voice that cannot be ramped is cut by its stop time below.
    }
    for (const osc of oscs) {
      try {
        osc.stop(now + STOP_FADE);
      } catch {
        // Already stopped.
      }
    }
  }
  voices.clear();
}

/**
 * A single note in the chord sound, struck at `when` (now by default) and held
 * for `duration` seconds. It is as loud as a whole chord was before the sound
 * editor (1 / LANE_PEAK.chords), since it sounds alone.
 */
export function playNote(midi, { when, duration = 1 } = {}) {
  const start = when ?? context().currentTime;
  voice('chords', midi, start, duration, 1 / LANE_PEAK.chords);
}

/** Play `chord` now, or at audio time `when`, held for `duration` seconds. */
export function playChord(chord, { strum = false, when, duration = 1 } = {}) {
  const start = when ?? context().currentTime;
  closeVoicing(chord).forEach((midi, i) => {
    const offset = strum ? i * STRUM_DELAY : 0;
    voice('chords', midi, start + offset, duration - offset);
  });
}

/** A melody note from `when` (now by default), held for `duration` seconds. */
export function playLead(midi, { when, duration = 0.5 } = {}) {
  const start = when ?? context().currentTime;
  voice('melody', midi, start, duration);
}

/** A bass note from `when` (now by default), held for `duration` seconds. */
export function playBass(midi, { when, duration = 0.5 } = {}) {
  const start = when ?? context().currentTime;
  voice('bass', midi, start, duration);
}

/** A short metronome blip at audio time `when`, higher on the downbeat. */
export function playClick(when, accent = false) {
  const c = context();
  const env = c.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  env.connect(bus.click);
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = accent ? 1760 : 1320;
  osc.connect(env);
  osc.start(when);
  osc.stop(when + 0.06);
}

/**
 * The Preview button: `events` from previewPhrase(key, lane), with `at` in
 * seconds from now.
 */
export function playPreview(lane, events) {
  const now = context().currentTime;
  for (const e of events) {
    const when = now + e.at;
    if (lane === 'chords') playChord(e.chord, { when, duration: e.duration });
    else if (lane === 'melody') playLead(e.midi, { when, duration: e.duration });
    else playBass(e.midi, { when, duration: e.duration });
  }
}
