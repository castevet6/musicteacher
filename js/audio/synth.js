import { closeVoicing } from '../theory/chords.js';
import { midiToFreq } from '../theory/notes.js';

const STRUM_DELAY = 0.025;
let ctx = null;
let master = null;

// Created inside the first click so browsers allow audio.
export function context() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.3;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function voice(midi, start, level) {
  const freq = midiToFreq(midi);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, start);
  env.gain.linearRampToValueAtTime(level, start + 0.005);
  env.gain.exponentialRampToValueAtTime(level * 0.4, start + 0.3);
  env.gain.exponentialRampToValueAtTime(0.0001, start + 1.5);
  env.connect(master);

  const body = ctx.createOscillator();
  body.type = 'triangle';
  body.frequency.value = freq;
  body.connect(env);

  const overtone = ctx.createOscillator();
  const overtoneGain = ctx.createGain();
  overtone.type = 'sine';
  overtone.frequency.value = freq * 2;
  overtoneGain.gain.value = 0.3;
  overtone.connect(overtoneGain).connect(env);

  for (const osc of [body, overtone]) {
    osc.start(start);
    osc.stop(start + 1.6);
  }
}

export function playNote(midi) {
  const c = context();
  voice(midi, c.currentTime, 1);
}

/** Play `chord` now, or at audio time `when` for scheduled playback. */
export function playChord(chord, { strum = false, when } = {}) {
  const c = context();
  const start = when ?? c.currentTime;
  const midis = closeVoicing(chord);
  midis.forEach((midi, i) => voice(midi, start + (strum ? i * STRUM_DELAY : 0), 0.7));
}

/** A short metronome blip at audio time `when`, higher on the downbeat. */
export function playClick(when, accent = false) {
  const c = context();
  const env = c.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  env.connect(master);
  const osc = c.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = accent ? 1760 : 1320;
  osc.connect(env);
  osc.start(when);
  osc.stop(when + 0.06);
}
