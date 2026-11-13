import { analyzeProgression, slotFocus } from './theory/analysis.js';
import {
  addNote, clampLane, defaultMix, emptyHistory, emptyLane, hasContent, popHistory, pushHistory, removeNote, resizeNote,
  sameSnapshot, slotAtTick, snapshotComposition, toggleMix, transposeDistance, transposeLane,
} from './theory/composition.js';
import {
  MAX_BARS, emptyProgression, flattenSlots, nextAddress, presetProgression, rekeyProgression, resizeProgression,
  sameAddress, setChordAt, toRelative, toggleSplit as splitBar,
} from './theory/progression.js';
import { fitLevel, guessKeys, rankChords, slotFitScore } from './theory/harmonize.js';
import { critiqueLane } from './theory/melodyCritique.js';
import { cellTiers, laneFit } from './theory/melodyFit.js';
import { suggestNextNotes } from './theory/nextNote.js';
import { buildKey } from './theory/scales.js';
import { suggestChords } from './theory/suggest.js';
import { DEFAULT_LANG } from './theory/text/index.js';

const listeners = new Set();

// The playhead sits on a slot; `sounding` is the lane note under it, { midi, start } or null.
const STOPPED = { playing: false, playhead: null, sounding: { melody: null, bass: null } };

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
  style: 'pop', // 'pop' | 'jazz' | 'folk': weights and thresholds, never the chord vocabulary
  title: '', // the composition's name and its file name on export; empty shows a placeholder
  grid: 8, // roll grid: 4, 8 or 16 cells per bar
  melody: emptyLane(), // absolute MIDI notes in ticks; chords are relative, lanes are not
  bass: emptyLane(),
  selectedNote: null, // { lane: 'melody' | 'bass', start }
  showMap: true, // paint the fit map behind the roll
  mix: defaultMix(), // per lane: 'on' | 'mute' | 'solo'
  pendingTranspose: null, // { fromPc, semis }: the root moved while a lane had notes
  history: emptyHistory(), // { entries: snapshots to undo to, tag of the last edit }
  pendingImport: null, // a parsed composition file waiting for "replace?" to be answered
  fileError: null, // { code, path } from the last failed import
  keyGuess: null, // results of the last Suggest key, [{ rootPc, scaleId, score, coverage, reasons }], until applied or dismissed
  playback: { playing: false, bpm: 90, loop: true, click: true, ...STOPPED },
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
  // How the melody sits over the chords: the roll's map and note colours, the strip's fit dots.
  const tiers = cellTiers(key, slots, analysis.chords);
  const melodyFit = laneFit(key, slots, next.melody, analysis.chords);
  const slotFits = slots.map((slot) => (slot.chord ? fitLevel(slotFitScore(melodyFit, slot.index)) : null));
  const critique = critiqueLane(key, slots, next.melody, { style: next.style, level: next.level, grid: next.grid, fit: melodyFit });
  // Ghosts: next-note ideas after the selected melody note, or after the last one.
  const after = selectedNote?.lane === 'melody' ? selectedNote.start : null;
  const ghosts = { lane: 'melody', ...suggestNextNotes(key, slots, next.melody, after, { style: next.style, grid: next.grid }) };
  // Chords for the melody inside the selected slot; null when the slot has no melody (the Chord tab's next-chord ideas cover that).
  const sel = next.selectedSlot && slots.find((s) => sameAddress(s, next.selectedSlot));
  const rankingList = sel ? rankChords(key, slots, next.melody, sel.index, { style: next.style, loop }) : [];
  const ranking = rankingList.length && rankingList[0].fit !== null ? rankingList : null;
  return { ...next, key, suggestions, slots, analysis, focus, selectedNote, tiers, melodyFit, slotFits, critique, ghosts, ranking };
}

function update(patch) {
  state = derive({ ...state, ...patch });
  for (const fn of listeners) fn(state);
}

const updatePlayback = (patch) => update({ playback: { ...state.playback, ...patch } });

/**
 * An undoable edit: remember the composition as it was, then apply `patch`.
 * Edits sharing a `tag` (one drag on the roll) undo together; an edit that
 * changes nothing leaves no entry.
 */
function commit(patch, tag = null) {
  const before = snapshotComposition(state);
  const after = snapshotComposition({ ...state, ...patch });
  const history = sameSnapshot(before, after) ? state.history : pushHistory(state.history, before, tag);
  update({ ...patch, history });
}

/** The state fields a snapshot or a loaded file sets, with the selection reset around them. */
function compositionPatch(c) {
  return {
    title: c.title, rootPc: c.rootPc, scaleId: c.scaleId, tonicLetter: c.tonicLetter, style: c.style,
    progression: c.progression, melody: c.melody, bass: c.bass,
    playback: { ...state.playback, bpm: c.bpm },
    selectedSlot: clampSlot(c.progression, state.selectedSlot),
    selected: null, activeChord: null, pendingTranspose: null, keyGuess: null,
  };
}

export const getState = () => state;

export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export function setMode(mode) {
  if (mode === state.mode) return;
  update({ mode, selected: null, activeChord: null, selectedNote: null, playback: { ...state.playback, ...STOPPED } });
}

export const setLevel = (level) => update({ level });
export const toggleInstrument = () => update({ instrumentCollapsed: !state.instrumentCollapsed });
export const setLang = (lang) => update({ lang });

export function setInstrument(instrument) {
  if (instrument === state.instrument) return;
  const selected = state.selected && { pc: state.selected.pc, midi: null };
  update({ instrument, selected, activeChord: null });
}

// The progression is stored relative to the tonic, so it follows the key. The
// lanes are absolute, so a new root offers to move them by the same distance,
// measured from the root they were written in if a prompt is already open.
export function setRoot(rootPc) {
  const hasNotes = state.melody.notes.length + state.bass.notes.length > 0;
  const fromPc = state.pendingTranspose?.fromPc ?? state.rootPc;
  const semis = transposeDistance(fromPc, rootPc);
  const pendingTranspose = hasNotes && semis !== 0 ? { fromPc, semis } : null;
  commit({ rootPc, tonicLetter: null, selected: null, activeChord: null, pendingTranspose });
}

export function confirmTranspose() {
  const pending = state.pendingTranspose;
  if (!pending) return;
  const melody = transposeLane(state.melody, pending.semis);
  const bass = transposeLane(state.bass, pending.semis);
  const ref = state.selectedNote;
  const note = ref && { melody, bass }[ref.lane].notes.find((n) => n.start === ref.start);
  commit({ melody, bass, pendingTranspose: null, ...(note ? noteFocus(note) : {}) });
}

export const dismissTranspose = () => update({ pendingTranspose: null });

// ---------- Key guess ----------

export const suggestKey = () => update({ keyGuess: guessKeys(state.melody, state.slots, state.bass) });
export const dismissKeyGuess = () => update({ keyGuess: null });

/**
 * Use a suggested key: the notes stay where they are and the chords keep
 * their sound; only the key, its spellings and the numerals change.
 */
export function applyKey(rootPc, scaleId) {
  const to = buildKey(rootPc, scaleId);
  commit({
    rootPc, scaleId, tonicLetter: null,
    progression: rekeyProgression(state.key, to, state.progression),
    keyGuess: null, pendingTranspose: null, selected: null, activeChord: null,
  });
}
export function setScale(scaleId) {
  commit({ scaleId, tonicLetter: state.key.tonic.letter, selected: null, activeChord: null });
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
  commit({ progression, selectedSlot: clampSlot(progression, selectedSlot) });
}

export function setBarCount(count) {
  const progression = resizeProgression(state.progression, count);
  const bars = progression.bars.length;
  commit({
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
export const setStyle = (style) => commit({ style });
export const setTitle = (title) => commit({ title: String(title).trim().slice(0, 120) });
export const toggleMap = () => update({ showMap: !state.showMap });

/** Selecting a note also focuses the chord under it and lights its pitch on the instrument. */
function noteFocus(note) {
  const slot = slotAtTick(state.slots, note.start);
  return {
    selected: { pc: note.midi % 12, midi: note.midi },
    activeChord: null,
    selectedSlot: slot ? { bar: slot.bar, half: slot.half } : state.selectedSlot,
  };
}

// `tag` names the roll gesture an edit belongs to, so a click-and-drag undoes in one step.
export function addLaneNote(lane, note, tag = null) {
  const next = addNote(state[lane], note);
  const added = next.notes.find((n) => n.start === Math.max(0, Math.round(note.start)));
  commit({ [lane]: next, selectedNote: { lane, start: added.start }, ...noteFocus(added) }, tag);
}

export function removeLaneNote(lane, start) {
  commit({ [lane]: removeNote(state[lane], start), selectedNote: null, selected: null });
}

export function resizeLaneNote(lane, start, length, tag = null) {
  commit({ [lane]: resizeNote(state[lane], start, length, state.progression.bars.length) }, tag);
}

export function selectLaneNote(ref) {
  if (!ref) {
    update({ selectedNote: null });
    return;
  }
  const note = state[ref.lane].notes.find((n) => n.start === ref.start);
  if (note) update({ selectedNote: ref, ...noteFocus(note) });
}

export const clearLane = (lane) => commit({ [lane]: emptyLane(), selectedNote: null });

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

export const setTempo = (bpm) =>
  commit({ playback: { ...state.playback, bpm: Math.max(40, Math.min(200, Math.round(bpm) || 90)) } });
export const setLoop = (loop) => updatePlayback({ loop });
export const setClick = (click) => updatePlayback({ click });
export const toggleMute = (lane) => update({ mix: toggleMix(state.mix, lane, 'mute') });
export const toggleSolo = (lane) => update({ mix: toggleMix(state.mix, lane, 'solo') });

/** Start playing from slot `from` (the first slot by default), or stop. */
export function setPlaying(playing, from = { bar: 0, half: 0 }) {
  updatePlayback(playing ? { ...STOPPED, playing: true, playhead: from } : STOPPED);
}
export const setPlayhead = (playhead) => updatePlayback({ playhead });

/**
 * The transport reports a lane note starting (`note` = { midi, start }) or
 * ending (`note` = null with `endedStart`). An end only clears the note it
 * belongs to, so a note that follows straight on is not wiped by it.
 */
export function setSounding(lane, note, endedStart) {
  const { playing, sounding } = state.playback;
  if (!playing) return;
  if (note === null && sounding[lane]?.start !== endedStart) return;
  updatePlayback({ sounding: { ...sounding, [lane]: note } });
}

// ---------- Files and undo ----------

/** Step back to the composition before the last edit. */
export function undo() {
  const popped = popHistory(state.history);
  if (popped) update({ ...compositionPatch(popped.snapshot), history: popped.history });
}

/** Load a parsed file as one undoable edit. */
export function loadComposition(composition) {
  commit({ ...compositionPatch(composition), selectedSlot: null, selectedNote: null, pendingImport: null, fileError: null });
}

/** A parsed file: load it straight away into an empty composition, otherwise ask first. */
export function offerComposition(composition) {
  if (hasContent(state)) update({ pendingImport: composition, fileError: null });
  else loadComposition(composition);
}

export const confirmImport = () => state.pendingImport && loadComposition(state.pendingImport);
export const cancelImport = () => update({ pendingImport: null });
export const setFileError = (error) => update({ fileError: error && { code: error.code, path: error.path }, pendingImport: null });
