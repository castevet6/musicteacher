import { playChord, playNote } from './audio/synth.js';
import { createTransport } from './audio/transport.js';
import * as store from './state.js';
import { LANGS } from './theory/text/index.js';
import { createChordPanel } from './ui/chordPanel.js';
import { createControls } from './ui/controls.js';
import { createGuitar } from './ui/guitar.js';
import { detectLang, translatePage } from './ui/pageText.js';
import { createPiano } from './ui/piano.js';
import { createProgressionPanel } from './ui/progressionPanel.js';
import { createProgressionStrip } from './ui/progressionStrip.js';

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
  onEnd: () => store.setPlaying(false),
});

function stopPlayback() {
  transport.stop();
  if (store.getState().playback.playing) store.setPlaying(false);
}

function onPlay() {
  if (store.getState().playback.playing) {
    stopPlayback();
    return;
  }
  store.setPlaying(true);
  transport.start();
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
const strip = createProgressionStrip(document.querySelector('#progression'), {
  onBarCount: store.setBarCount,
  onPreset: store.loadPreset,
  onClear: () => {
    stopPlayback();
    store.clearProgression();
  },
  onPlay,
  onTempo: store.setTempo,
  onLoop: store.setLoop,
  onClickTrack: store.setClick,
  onSelectSlot,
  onToggleSplit: store.toggleSplit,
});
const panel = createChordPanel(document.querySelector('#chords'), { onChordClick });
const progressionPanel = createProgressionPanel(document.querySelector('#chords'), { onPickChord, onNextChord });
const legends = {
  explore: document.querySelector('#legend-explore'),
  progression: document.querySelector('#legend-progression'),
};

let pageLang = null;

store.setLang(detectLang(LANGS));
store.subscribe((state) => {
  if (state.lang !== pageLang) {
    translatePage(state.lang);
    pageLang = state.lang;
  }
  const progression = state.mode === 'progression';
  controls.render(state);
  strip.show(progression);
  if (progression) strip.render(state);
  for (const [id, view] of Object.entries(instruments)) {
    view.show(id === state.instrument);
    view.render(state);
  }
  for (const [mode, legend] of Object.entries(legends)) legend.hidden = mode !== state.mode;
  (progression ? progressionPanel : panel).render(state);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') store.clearSelection();
});
