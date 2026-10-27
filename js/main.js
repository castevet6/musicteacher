import { playChord, playNote } from './audio/synth.js';
import * as store from './state.js';
import { createChordPanel } from './ui/chordPanel.js';
import { createControls } from './ui/controls.js';
import { createGuitar } from './ui/guitar.js';
import { createPiano } from './ui/piano.js';

function onNoteClick(position) {
  store.selectNote(position);
  playNote(position.midi);
}

function onChordClick(suggestion) {
  const state = store.getState();
  const wasActive = state.activeChord?.id === suggestion.id;
  store.toggleChord(suggestion);
  if (!wasActive) playChord(suggestion.chord, { strum: state.instrument === 'guitar' });
}

const controls = createControls(document.querySelector('#controls'), {
  onInstrument: store.setInstrument,
  onRoot: store.setRoot,
  onScale: store.setScale,
});
const instruments = {
  guitar: createGuitar(document.querySelector('#guitar'), { onNoteClick }),
  piano: createPiano(document.querySelector('#piano'), { onNoteClick }),
};
const panel = createChordPanel(document.querySelector('#chords'), { onChordClick });

store.subscribe((state) => {
  controls.render(state);
  for (const [id, view] of Object.entries(instruments)) {
    view.show(id === state.instrument);
    view.render(state);
  }
  panel.render(state);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') store.clearSelection();
});
