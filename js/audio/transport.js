// Composer playback: a lookahead scheduler on AudioContext time. Every slot
// reads fresh state, so edits, tempo, mix and loop changes apply while playing.
// Inside each slot the melody and bass notes that start there are scheduled too, and
// tick() reports the playing position for the roll's playhead.

import { TICKS_PER_BEAT, isAudible, notesStarting, slotSpan } from '../theory/composition.js';
import { nextAddress } from '../theory/progression.js';
import { context, playBass, playChord, playClick, playLead, stopLeads } from './synth.js';

const TICK_MS = 25;
const LOOKAHEAD = 0.1; // seconds scheduled ahead of the audio clock
const LANE_VOICES = { melody: playLead, bass: playBass };

export function createTransport({ getState, onPlayhead, onSounding, onEnd }) {
  let timer = null;
  let timeouts = [];
  let position = null; // next slot to schedule, { bar, half }
  let nextTime = 0;
  let schedule = []; // slots already scheduled: { time, tick, end, ticksPerSecond }

  /** Run `fn` when the audio clock reaches `when`. */
  function at(when, fn) {
    const ctx = context();
    const id = setTimeout(() => {
      timeouts = timeouts.filter((t) => t !== id);
      fn();
    }, Math.max(0, (when - ctx.currentTime) * 1000));
    timeouts.push(id);
  }

  function scheduleLane(state, lane, slotStart, span, secPerTick) {
    const voice = LANE_VOICES[lane];
    if (!voice || !isAudible(state.mix, lane)) return;
    for (const note of notesStarting(state[lane], span.start, span.length)) {
      const when = slotStart + (note.start - span.start) * secPerTick;
      const duration = note.length * secPerTick;
      voice(note.midi, { when, duration });
      at(when, () => onSounding(lane, { midi: note.midi, start: note.start }));
      at(when + duration, () => onSounding(lane, null, note.start));
    }
  }

  function scheduleSlot(state) {
    const { progression, playback, instrument, slots, mix } = state;
    const slot = slots.find((s) => s.bar === position.bar && s.half === position.half);
    if (!slot) return false;
    const beat = 60 / playback.bpm;
    const secPerTick = beat / TICKS_PER_BEAT;
    const span = slotSpan(slot);
    if (slot.chord && isAudible(mix, 'chords')) playChord(slot.chord, { strum: instrument === 'guitar', when: nextTime });
    if (playback.click) {
      for (let b = 0; b < slot.beats; b++) playClick(nextTime + b * beat, slot.half === 0 && b === 0);
    }
    for (const lane of Object.keys(LANE_VOICES)) scheduleLane(state, lane, nextTime, span, secPerTick);
    const addr = { bar: slot.bar, half: slot.half };
    at(nextTime, () => onPlayhead(addr));
    schedule.push({ time: nextTime, tick: span.start, end: span.start + span.length, ticksPerSecond: 1 / secPerTick });

    nextTime += slot.beats * beat;
    position = nextAddress(progression, addr) ?? (playback.loop ? { bar: 0, half: 0 } : null);
    return true;
  }

  function pump() {
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
    /** Start at slot `from` ({ bar, half }), the first slot by default. */
    start(from = { bar: 0, half: 0 }) {
      this.stop();
      position = from;
      nextTime = context().currentTime + 0.05;
      timer = setInterval(pump, TICK_MS);
      pump();
    },
    stop() {
      clearInterval(timer);
      timer = null;
      timeouts.forEach(clearTimeout);
      timeouts = [];
      position = null;
      schedule = [];
      stopLeads();
    },
    /** The tick now sounding, for the playhead; null when nothing is scheduled. */
    tick() {
      if (!schedule.length) return null;
      const now = context().currentTime;
      while (schedule.length > 1 && schedule[1].time <= now) schedule.shift();
      const slot = schedule[0];
      if (slot.time > now) return slot.tick;
      return Math.min(slot.end, slot.tick + (now - slot.time) * slot.ticksPerSecond);
    },
  };
}
