import { playChord, playNote } from './audio/synth.js';
import { createTransport } from './audio/transport.js';
import * as store from './state.js';
import { LANGS } from './theory/text/index.js';
import { createChordPanel } from './ui/chordPanel.js';
import { createControls } from './ui/controls.js';
import { createGuitar } from './ui/guitar.js';
import { detectLang, translatePage } from './ui/pageText.js';
import { ui } from './ui/strings.js';
import { createChordStrip } from './ui/chordStrip.js';
import { createComposerPanel } from './ui/composerPanel.js';
import { createPiano } from './ui/piano.js';
import { createRoll } from './ui/roll.js';
import { createTransportBar } from './ui/transportBar.js';
import { createTransposePrompt } from './ui/transposePrompt.js';

const strum = () => store.getState().instrument === 'guitar';

function onNoteClick(position) {
  store.selectNote(position);
  playNote(position.midi);
}

function onChordClick(suggestion) {
  const state = store.getState();
  const wasActive = state.activeChord?.id === suggestion.id;
  store.toggleChord(suggestion);
  if (!wasActive) playChord(suggestion.chord, { strum: strum() });
}

const transport = createTransport({
  getState: store.getState,
  onPlayhead: store.setPlayhead,
  onSounding: store.setSounding,
  onEnd: () => store.setPlaying(false),
});

function stopPlayback() {
  transport.stop();
  if (store.getState().playback.playing) store.setPlaying(false);
}

/** Play toggles playback from bar 1; the "from bar N" button starts at the selected bar. */
function onPlay() {
  if (store.getState().playback.playing) {
    stopPlayback();
    return;
  }
  startPlayback({ bar: 0, half: 0 });
}

function onPlayFrom() {
  const from = store.getState().selectedSlot;
  if (from) startPlayback({ bar: from.bar, half: 0 });
}

function startPlayback(from) {
  stopPlayback();
  store.setPlaying(true, from);
  transport.start(from);
}

function onSelectSlot(addr, chord) {
  store.selectSlot(addr);
  if (chord && !store.getState().playback.playing) playChord(chord, { strum: strum() });
}

function onPickChord(addr, chord) {
  store.setSlotChord(addr, chord);
  if (chord) playChord(chord, { strum: strum() });
}

/** A next-chord idea fills an empty focused slot, or the slot after a filled one. */
function onNextChord(chord, focus) {
  const here = { bar: focus.slot.bar, half: focus.slot.half };
  onPickChord(focus.chord ? store.slotAfter(here) : here, chord);
}

const controls = createControls(document.querySelector('#controls'), {
  onMode: (mode) => {
    stopPlayback();
    store.setMode(mode);
  },
  onInstrument: store.setInstrument,
  onRoot: store.setRoot,
  onScale: store.setScale,
  onLevel: store.setLevel,
  onLang: store.setLang,
});
const instruments = {
  guitar: createGuitar(document.querySelector('#guitar'), { onNoteClick }),
  piano: createPiano(document.querySelector('#piano'), { onNoteClick }),
};
const strip = createChordStrip({ toolbar: document.querySelector('#strip-toolbar'), bars: document.querySelector('#bars') }, {
  onBarCount: store.setBarCount,
  onPreset: store.loadPreset,
  onClear: () => {
    stopPlayback();
    store.clearProgression();
  },
  onSelectSlot,
  onToggleSplit: store.toggleSplit,
});
const transportBar = createTransportBar(document.querySelector('#transport'), {
  onPlay,
  onPlayFrom,
  onTempo: store.setTempo,
  onLoop: store.setLoop,
  onClickTrack: store.setClick,
  onGrid: store.setGrid,
  onMute: store.toggleMute,
  onSolo: store.toggleSolo,
});
const transposePrompt = createTransposePrompt(document.querySelector('#transpose-prompt'), {
  onConfirm: store.confirmTranspose,
  onDismiss: store.dismissTranspose,
});
// The melody roll shows the selected instrument's range (guitar E2–G5, piano C2–B5).
const INSTRUMENT_RANGE = { guitar: [40, 79], piano: [36, 83] };
const melodyRoll = createRoll(document.querySelector('#melody-roll'), {
  lane: 'melody',
  range: (state) => INSTRUMENT_RANGE[state.instrument],
  onAdd: (note) => store.addLaneNote('melody', note),
  onRemove: (start) => store.removeLaneNote('melody', start),
  onResize: (start, length) => store.resizeLaneNote('melody', start, length),
  onSelect: (start) => store.selectLaneNote({ lane: 'melody', start }),
  onAudition: (midi) => midi != null && playNote(midi),
  onClear: () => store.clearLane('melody'),
  onToggleMap: store.toggleMap,
  currentTick: () => transport.tick(),
});
const panel = createChordPanel(document.querySelector('#chords'), { onChordClick });
const composerPanel = createComposerPanel(document.querySelector('#chords'), { onPickChord, onNextChord });
const legends = {
  explore: document.querySelector('#legend-explore'),
  composer: document.querySelector('#legend-composer'),
};
const composerSection = document.querySelector('#composer');
const instrumentHead = document.querySelector('#instrument-head');
const instrumentBody = document.querySelector('#instrument-body');
const collapseButton = document.querySelector('#collapse-instrument');
collapseButton.addEventListener('click', store.toggleInstrument);

let pageLang = null;

store.setLang(detectLang(LANGS));
store.subscribe((state) => {
  if (state.lang !== pageLang) {
    translatePage(state.lang);
    pageLang = state.lang;
  }
  const composer = state.mode === 'composer';
  controls.render(state);
  composerSection.hidden = !composer;
  if (composer) {
    transposePrompt.render(state);
    transportBar.render(state);
    strip.render(state);
    melodyRoll.render(state);
  }
  const collapsed = composer && state.instrumentCollapsed;
  instrumentHead.hidden = !composer;
  instrumentBody.hidden = collapsed;
  collapseButton.setAttribute('aria-expanded', String(!collapsed));
  collapseButton.textContent = collapsed ? ui(state.lang).composer.showInstrument : ui(state.lang).composer.hideInstrument;
  for (const [id, view] of Object.entries(instruments)) {
    view.show(id === state.instrument);
    view.render(state);
  }
  for (const [mode, legend] of Object.entries(legends)) legend.hidden = mode !== state.mode;
  (composer ? composerPanel : panel).render(state);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') store.clearSelection();
  const typing = /^(input|select|textarea)$/i.test(event.target.tagName);
  const { selectedNote } = store.getState();
  if ((event.key === 'Delete' || event.key === 'Backspace') && selectedNote && !typing) {
    event.preventDefault();
    store.removeLaneNote(selectedNote.lane, selectedNote.start);
  }
});
