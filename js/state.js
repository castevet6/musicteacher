import { analyzeProgression, slotFocus } from './theory/analysis.js';
import { addNote, clampLane, emptyLane, removeNote, resizeNote, slotAtTick } from './theory/composition.js';
import {
  MAX_BARS, emptyProgression, flattenSlots, nextAddress, presetProgression, resizeProgression,
  sameAddress, setChordAt, toRelative, toggleSplit as splitBar,
} from './theory/progression.js';
import { buildKey } from './theory/scales.js';
import { suggestChords } from './theory/suggest.js';
import { DEFAULT_LANG } from './theory/text/index.js';

const listeners = new Set();

let state = derive({
  mode: 'explore', // 'explore' | 'composer'
  instrumentCollapsed: false, // composer only: the roll is the hero, the instrument can fold away
  level: 'intermediate', // 'beginner' | 'intermediate'
  instrument: 'guitar',
  lang: DEFAULT_LANG,
  rootPc: 0,
  scaleId: 'major',
  tonicLetter: null, // kept across scale changes, so Eb major → minor stays Eb
  selected: null, // { pc, midi } – midi is null when the exact position is unknown
  activeChord: null,
  progression: emptyProgression(4),
  selectedSlot: null, // { bar, half }
  grid: 8, // roll grid: 4, 8 or 16 cells per bar
  melody: emptyLane(), // absolute MIDI notes in ticks; chords are relative, lanes are not
  bass: emptyLane(),
  selectedNote: null, // { lane: 'melody' | 'bass', start }
  playback: { playing: false, bpm: 90, loop: true, click: true, playhead: null },
});

function derive(next) {
  const key = buildKey(next.rootPc, next.scaleId, next.tonicLetter);
  const suggestions = next.mode === 'explore' && next.selected ? suggestChords(key, next.selected.pc, next.lang) : null;
  const slots = flattenSlots(key, next.progression);
  const { loop } = next.playback;
  const analysis = analyzeProgression(key, slots, { loop });
  // While playing, the instrument follows the playhead; otherwise the selected bar.
  const focusAddr = next.playback.playing ? next.playback.playhead : next.selectedSlot;
  const focusSlot = focusAddr && slots.find((s) => sameAddress(s, focusAddr));
  const focus = focusSlot ? slotFocus(key, slots, focusSlot.index, { loop }) : null;
  // A selected note must still exist in its lane.
  const ref = next.selectedNote;
  const selectedNote = ref && next[ref.lane].notes.some((n) => n.start === ref.start) ? ref : null;
  return { ...next, key, suggestions, slots, analysis, focus, selectedNote };
}

function update(patch) {
  state = derive({ ...state, ...patch });
  for (const fn of listeners) fn(state);
}

const updatePlayback = (patch) => update({ playback: { ...state.playback, ...patch } });

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function setMode(mode) {
  if (mode === state.mode) return;
  update({ mode, selected: null, activeChord: null, selectedNote: null, playback: { ...state.playback, playing: false, playhead: null } });
}

export const setLevel = (level) => update({ level });
export const toggleInstrument = () => update({ instrumentCollapsed: !state.instrumentCollapsed });
export const setLang = (lang) => update({ lang });

export function setInstrument(instrument) {
  if (instrument === state.instrument) return;
  const selected = state.selected && { pc: state.selected.pc, midi: null };
  update({ instrument, selected, activeChord: null });
}

// The progression is stored relative to the tonic, so it follows the key.
export const setRoot = (rootPc) => update({ rootPc, tonicLetter: null, selected: null, activeChord: null });
export function setScale(scaleId) {
  update({ scaleId, tonicLetter: state.key.tonic.letter, selected: null, activeChord: null });
}
export const selectNote = ({ pc, midi }) => update({ selected: { pc, midi }, activeChord: null });
export const clearSelection = () => update({ selected: null, activeChord: null, selectedSlot: null, selectedNote: null });

export function toggleChord(suggestion) {
  const active = state.activeChord?.id === suggestion.id ? null : suggestion;
  update({ activeChord: active });
}

/** Keep the selected bar valid after the bars change. */
function clampSlot(progression, addr) {
  const bar = addr && progression.bars[addr.bar];
  if (!bar) return null;
  return { bar: addr.bar, half: Math.min(addr.half, bar.chords.length - 1) };
}

function setProgression(progression, selectedSlot = state.selectedSlot) {
  update({ progression, selectedSlot: clampSlot(progression, selectedSlot) });
}

export function setBarCount(count) {
  const progression = resizeProgression(state.progression, count);
  const bars = progression.bars.length;
  update({
    progression,
    selectedSlot: clampSlot(progression, state.selectedSlot),
    melody: clampLane(state.melody, bars),
    bass: clampLane(state.bass, bars),
  });
}
export const toggleSplit = (bar) => setProgression(splitBar(state.progression, bar));
export const loadPreset = (id) => setProgression(presetProgression(id), { bar: 0, half: 0 });
export const clearProgression = () => setProgression(emptyProgression(state.progression.bars.length), null);

export function selectSlot(addr) {
  update({ selectedSlot: addr && clampSlot(state.progression, addr), selected: null, selectedNote: null });
}

// ---------- Lanes (melody, bass) ----------

export const setGrid = (grid) => update({ grid });

/** Selecting a note also focuses the chord under it and lights its pitch on the instrument. */
function noteFocus(note) {
  const slot = slotAtTick(state.slots, note.start);
  return {
    selected: { pc: note.midi % 12, midi: note.midi },
    activeChord: null,
    selectedSlot: slot ? { bar: slot.bar, half: slot.half } : state.selectedSlot,
  };
}

export function addLaneNote(lane, note) {
  const next = addNote(state[lane], note);
  const added = next.notes.find((n) => n.start === Math.max(0, Math.round(note.start)));
  update({ [lane]: next, selectedNote: { lane, start: added.start }, ...noteFocus(added) });
}

export function removeLaneNote(lane, start) {
  update({ [lane]: removeNote(state[lane], start), selectedNote: null, selected: null });
}

export function resizeLaneNote(lane, start, length) {
  update({ [lane]: resizeNote(state[lane], start, length, state.progression.bars.length) });
}

export function selectLaneNote(ref) {
  if (!ref) {
    update({ selectedNote: null });
    return;
  }
  const note = state[ref.lane].notes.find((n) => n.start === ref.start);
  if (note) update({ selectedNote: ref, ...noteFocus(note) });
}

export const clearLane = (lane) => update({ [lane]: emptyLane(), selectedNote: null });

/** Put `chord` (absolute, or null to empty the slot) at `addr`, adding a bar if `addr` is one past the end. */
export function setSlotChord(addr, chord) {
  let { progression } = state;
  if (addr.bar >= progression.bars.length) {
    if (addr.bar >= MAX_BARS) return;
    progression = resizeProgression(progression, addr.bar + 1);
  }
  const rel = chord && toRelative(state.key, chord);
  setProgression(setChordAt(progression, addr, rel), addr);
}

/** The slot after `addr`, or a new bar after the last one. */
export function slotAfter(addr) {
  return nextAddress(state.progression, addr) ?? { bar: state.progression.bars.length, half: 0 };
}

export const setTempo = (bpm) => updatePlayback({ bpm: Math.max(40, Math.min(200, Math.round(bpm) || 90)) });
export const setLoop = (loop) => updatePlayback({ loop });
export const setClick = (click) => updatePlayback({ click });
export const setPlaying = (playing) => updatePlayback({ playing, playhead: playing ? { bar: 0, half: 0 } : null });
export const setPlayhead = (playhead) => updatePlayback({ playhead });
