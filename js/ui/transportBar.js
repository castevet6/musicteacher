// Playback controls in Composer: play/stop, tempo, loop and click. The grid,
// mix, title, style and file buttons join this bar in later milestones.

import { ui } from './strings.js';

export function createTransportBar(container, { onPlay, onTempo, onLoop, onClickTrack }) {
  container.innerHTML = `
    <div class="transport" role="group" data-label="aria-label:group">
      <button type="button" class="btn play" data-act="play" aria-pressed="false"></button>
      <label class="field"><span data-label="bpm"></span> <input type="number" name="bpm" min="40" max="200" step="1" inputmode="numeric"></label>
      <label class="check"><input type="checkbox" name="loop"> <span data-label="loop"></span></label>
      <label class="check"><input type="checkbox" name="click"> <span data-label="click"></span></label>
    </div>`;

  const $ = (selector) => container.querySelector(selector);
  const play = $('[data-act=play]');
  const bpm = $('[name=bpm]');
  const loop = $('[name=loop]');
  const click = $('[name=click]');
  let renderedLang = null;

  function translate(lang) {
    const text = ui(lang).transport;
    for (const el of container.querySelectorAll('[data-label]')) {
      const [attr, id] = el.dataset.label.includes(':') ? el.dataset.label.split(':') : [null, el.dataset.label];
      if (attr) el.setAttribute(attr, text[id]);
      else el.textContent = text[id];
    }
    renderedLang = lang;
  }

  play.addEventListener('click', onPlay);
  bpm.addEventListener('change', () => onTempo(Number(bpm.value)));
  loop.addEventListener('change', () => onLoop(loop.checked));
  click.addEventListener('change', () => onClickTrack(click.checked));

  return {
    render(state) {
      if (state.lang !== renderedLang) translate(state.lang);
      const text = ui(state.lang).transport;
      const { playing } = state.playback;
      play.textContent = playing ? text.stop : text.play;
      play.setAttribute('aria-pressed', String(playing));
      play.disabled = !playing && !state.slots.some((s) => s.chord);
      if (document.activeElement !== bpm) bpm.value = String(state.playback.bpm);
      loop.checked = state.playback.loop;
      click.checked = state.playback.click;
    },
  };
}
