// Progression playback: a lookahead scheduler on AudioContext time. Every
// slot reads fresh state, so edits, tempo and loop changes apply while playing.

import { nextAddress } from '../theory/progression.js';
import { context, playChord, playClick } from './synth.js';

const TICK_MS = 25;
const LOOKAHEAD = 0.1; // seconds scheduled ahead of the audio clock

export function createTransport({ getState, onPlayhead, onEnd }) {
  let timer = null;
  let timeouts = [];
  let position = null; // next slot to schedule, { bar, half }
  let nextTime = 0;

  /** Run `fn` when the audio clock reaches `when`. */
  function at(when, fn) {
    const ctx = context();
    const id = setTimeout(() => {
      timeouts = timeouts.filter((t) => t !== id);
      fn();
    }, Math.max(0, (when - ctx.currentTime) * 1000));
    timeouts.push(id);
  }

  function scheduleSlot(state) {
    const { progression, playback, instrument, slots } = state;
    const slot = slots.find((s) => s.bar === position.bar && s.half === position.half);
    if (!slot) return false;
    const beat = 60 / playback.bpm;
    if (slot.chord) playChord(slot.chord, { strum: instrument === 'guitar', when: nextTime });
    if (playback.click) {
      for (let b = 0; b < slot.beats; b++) playClick(nextTime + b * beat, slot.half === 0 && b === 0);
    }
    const addr = { bar: slot.bar, half: slot.half };
    at(nextTime, () => onPlayhead(addr));

    nextTime += slot.beats * beat;
    position = nextAddress(progression, addr) ?? (playback.loop ? { bar: 0, half: 0 } : null);
    return true;
  }

  function tick() {
    const ctx = context();
    while (position && nextTime < ctx.currentTime + LOOKAHEAD) {
      if (!scheduleSlot(getState())) position = null;
    }
    if (!position) {
      clearInterval(timer);
      timer = null;
      at(nextTime, onEnd);
    }
  }

  return {
    start() {
      this.stop();
      position = { bar: 0, half: 0 };
      nextTime = context().currentTime + 0.05;
      timer = setInterval(tick, TICK_MS);
      tick();
    },
    stop() {
      clearInterval(timer);
      timer = null;
      timeouts.forEach(clearTimeout);
      timeouts = [];
      position = null;
    },
  };
}
