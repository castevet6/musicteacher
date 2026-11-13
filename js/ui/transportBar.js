// Composer's top bars: the file row (title, undo, export, import) and the
// playback row (play/stop, tempo, loop, click, grid, style, key guess, mix).

import { GRIDS, STYLES, isAudible } from '../theory/composition.js';
import { ui } from './strings.js';

const MIX_LANES = ['chords', 'melody', 'bass'];
// The click lane has a fader only: no mute, solo or sound editor.
const LEVEL_LANES = [...MIX_LANES, 'click'];
const DEFAULT_LEVEL = 75;

export function createTransportBar(container, {
  onPlay, onPlayFrom, onTempo, onLoop, onClickTrack, onGrid, onStyle, onMute, onSolo, onSuggestKey,
  onTitle, onUndo, onExport, onImport, onMixLevel, onEditSound,
}) {
  const fader = (lane) => `<input type="range" class="mix-level" name="level-${lane}" min="0" max="100" step="1">`;
  container.innerHTML = `
    <div class="file-bar" role="group" data-label="aria-label:fileGroup">
      <label class="field title-field"><span data-label="title"></span>
        <input type="text" name="title" maxlength="120" autocomplete="off" spellcheck="false">
      </label>
      <button type="button" class="btn" data-act="undo" data-label="undo"></button>
      <button type="button" class="btn" data-act="export" data-label="export"></button>
      <button type="button" class="btn" data-act="import" data-label="import"></button>
      <input type="file" name="import" accept=".json,application/json" hidden>
    </div>
    <div class="transport" role="group" data-label="aria-label:group">
      <button type="button" class="btn play" data-act="play" aria-pressed="false"></button>
      <button type="button" class="btn play-from" data-act="play-from" hidden></button>
      <label class="field"><span data-label="bpm"></span> <input type="number" name="bpm" min="40" max="200" step="1" inputmode="numeric"></label>
      <label class="check"><input type="checkbox" name="loop"> <span data-label="loop"></span></label>
      <label class="check"><input type="checkbox" name="click"> <span data-label="click"></span></label>
      <label class="field"><span data-label="grid"></span>
        <select name="grid">${GRIDS.map((g) => `<option value="${g}">1/${g}</option>`).join('')}</select>
      </label>
      <label class="field"><span data-label="style"></span>
        <select name="style">${STYLES.map((id) => `<option value="${id}" data-label="styles.${id}"></option>`).join('')}</select>
      </label>
      <button type="button" class="btn" data-act="suggest-key" data-label="suggestKey"></button>
      <div class="mix" role="group" data-label="aria-label:mix">
        ${MIX_LANES.map((lane) => `
          <span class="mix-lane" data-lane="${lane}">
            <span class="mix-name" data-label="lanes.${lane}"></span>
            <button type="button" class="btn mix-btn" data-mix="mute" aria-pressed="false" data-label="mute"></button>
            <button type="button" class="btn mix-btn" data-mix="solo" aria-pressed="false" data-label="solo"></button>
            ${fader(lane)}
            <button type="button" class="btn mix-btn mix-edit" data-act="sound">🎛</button>
          </span>`).join('')}
        <span class="mix-lane" data-lane="click">
          <span class="mix-name" data-label="lanes.click"></span>
          ${fader('click')}
        </span>
      </div>
    </div>`;

  const $ = (selector) => container.querySelector(selector);
  const play = $('[data-act=play]');
  const playFrom = $('[data-act=play-from]');
  const bpm = $('[name=bpm]');
  const loop = $('[name=loop]');
  const click = $('[name=click]');
  const grid = $('[name=grid]');
  const style = $('[name=style]');
  const suggestKey = $('[data-act=suggest-key]');
  const allLanes = [...container.querySelectorAll('.mix-lane')];
  // Mute and solo exist only on the sound lanes; the click lane is skipped below.
  const mixLanes = allLanes.filter((el) => el.dataset.lane !== 'click');
  const faders = Object.fromEntries(LEVEL_LANES.map((lane) => [lane, $(`[name=level-${lane}]`)]));
  const title = $('[name=title]');
  const undo = $('[data-act=undo]');
  const exportButton = $('[data-act=export]');
  const importButton = $('[data-act=import]');
  const importFile = $('input[name=import]');
  let renderedLang = null;

  const lookup = (text, path) => path.split('.').reduce((obj, key) => obj[key], text);

  function translate(lang) {
    const text = ui(lang).transport;
    for (const el of container.querySelectorAll('[data-label]')) {
      const [attr, id] = el.dataset.label.includes(':') ? el.dataset.label.split(':') : [null, el.dataset.label];
      if (attr) el.setAttribute(attr, lookup(text, id));
      else el.textContent = lookup(text, id);
    }
    for (const el of mixLanes) {
      const name = text.lanes[el.dataset.lane];
      el.querySelector('[data-mix=mute]').setAttribute('aria-label', text.muteLane(name));
      el.querySelector('[data-mix=solo]').setAttribute('aria-label', text.soloLane(name));
      el.querySelector('[data-act=sound]').setAttribute('aria-label', text.editSound(name));
    }
    for (const [lane, el] of Object.entries(faders)) {
      el.setAttribute('aria-label', text.levelLane(text.lanes[lane]));
    }
    renderedLang = lang;
  }

  play.addEventListener('click', onPlay);
  playFrom.addEventListener('click', onPlayFrom);
  bpm.addEventListener('change', () => onTempo(Number(bpm.value)));
  loop.addEventListener('change', () => onLoop(loop.checked));
  click.addEventListener('change', () => onClickTrack(click.checked));
  grid.addEventListener('change', () => onGrid(Number(grid.value)));
  style.addEventListener('change', () => onStyle(style.value));
  suggestKey.addEventListener('click', onSuggestKey);
  title.addEventListener('change', () => onTitle(title.value));
  title.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') title.blur();
    if (event.key === 'Escape') {
      title.value = lastTitle;
      title.blur();
    }
  });
  undo.addEventListener('click', onUndo);
  exportButton.addEventListener('click', onExport);
  importButton.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', () => {
    const [file] = importFile.files;
    importFile.value = ''; // picking the same file again still fires change
    if (file) onImport(file);
  });
  let lastTitle = '';
  for (const el of mixLanes) {
    el.querySelector('[data-mix=mute]').addEventListener('click', () => onMute(el.dataset.lane));
    el.querySelector('[data-mix=solo]').addEventListener('click', () => onSolo(el.dataset.lane));
    el.querySelector('[data-act=sound]').addEventListener('click', () => onEditSound(el.dataset.lane));
  }
  for (const [lane, el] of Object.entries(faders)) {
    el.addEventListener('input', () => onMixLevel(lane, Number(el.value)));
    el.addEventListener('dblclick', () => {
      el.value = String(DEFAULT_LEVEL);
      onMixLevel(lane, DEFAULT_LEVEL);
    });
  }

  // A fader is being dragged while it has focus and the pointer is held on it.
  // Only then is its value left alone; otherwise state wins.
  const dragging = (el) => document.activeElement === el && el.matches(':active');

  return {
    render(state) {
      if (state.lang !== renderedLang) translate(state.lang);
      const text = ui(state.lang).transport;
      const { playing } = state.playback;
      const from = state.selectedSlot;
      const nothing = !state.slots.some((s) => s.chord) && state.melody.notes.length === 0;
      play.textContent = playing ? text.stop : text.play;
      play.setAttribute('aria-pressed', String(playing));
      play.disabled = !playing && nothing;
      suggestKey.disabled = nothing && state.bass.notes.length === 0;
      suggestKey.setAttribute('aria-pressed', String(Boolean(state.keyGuess)));
      // Play always starts at bar 1; a selected bar offers its own start button.
      playFrom.hidden = playing || !from || from.bar === 0 || nothing;
      if (from) {
        playFrom.textContent = text.fromBar(from.bar + 1);
        playFrom.setAttribute('aria-label', text.playFrom(from.bar + 1));
      }
      if (document.activeElement !== bpm) bpm.value = String(state.playback.bpm);
      lastTitle = state.title;
      if (document.activeElement !== title) title.value = state.title;
      title.placeholder = text.untitled;
      undo.disabled = state.history.entries.length === 0;
      loop.checked = state.playback.loop;
      click.checked = state.playback.click;
      grid.value = String(state.grid);
      style.value = state.style;
      for (const el of mixLanes) {
        const lane = el.dataset.lane;
        el.classList.toggle('silent', !isAudible(state.mix, lane));
        el.querySelector('[data-mix=mute]').setAttribute('aria-pressed', String(state.mix[lane] === 'mute'));
        el.querySelector('[data-mix=solo]').setAttribute('aria-pressed', String(state.mix[lane] === 'solo'));
        el.querySelector('[data-act=sound]').setAttribute('aria-pressed', String(state.soundEditor?.lane === lane));
      }
      for (const [lane, el] of Object.entries(faders)) {
        if (!dragging(el)) el.value = String(state.levels[lane]);
      }
    },
  };
}
