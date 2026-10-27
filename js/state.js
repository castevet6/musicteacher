import { buildKey } from './theory/scales.js';
import { suggestChords } from './theory/suggest.js';

const listeners = new Set();

let state = derive({
  instrument: 'guitar',
  rootPc: 0,
  scaleId: 'major',
  selected: null, // { pc, midi } – midi is null when the exact position is unknown
  activeChord: null,
});

function derive(next) {
  const key = buildKey(next.rootPc, next.scaleId);
  const suggestions = next.selected ? suggestChords(key, next.selected.pc) : null;
  return { ...next, key, suggestions };
}

function update(patch) {
  state = derive({ ...state, ...patch });
  for (const fn of listeners) fn(state);
}

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function setInstrument(instrument) {
  if (instrument === state.instrument) return;
  const selected = state.selected && { pc: state.selected.pc, midi: null };
  update({ instrument, selected, activeChord: null });
}

export const setRoot = (rootPc) => update({ rootPc, selected: null, activeChord: null });
export const setScale = (scaleId) => update({ scaleId, selected: null, activeChord: null });
export const selectNote = ({ pc, midi }) => update({ selected: { pc, midi }, activeChord: null });
export const clearSelection = () => update({ selected: null, activeChord: null });

export function toggleChord(suggestion) {
  const active = state.activeChord?.id === suggestion.id ? null : suggestion;
  update({ activeChord: active });
}
