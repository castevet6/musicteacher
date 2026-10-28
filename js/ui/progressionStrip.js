// The bar strip above the instrument in progression mode: bar count, presets,
// transport, and one cell per bar holding one or two chord slots.

import { MAX_BARS, PRESETS, presetLabel, sameAddress } from '../theory/progression.js';
import { h, prettySymbol, prettyText } from './dom.js';
import { ui } from './strings.js';

export function createProgressionStrip(container, handlers) {
  const {
    onBarCount, onPreset, onClear, onPlay, onTempo, onLoop, onClickTrack, onSelectSlot, onToggleSplit,
  } = handlers;

  container.innerHTML = `
    <div class="strip-toolbar">
      <div class="stepper" role="group" data-label="aria-label:barsGroup">
        <button type="button" class="btn icon" data-act="fewer" data-label="aria-label:fewer">−</button>
        <output class="bar-count" aria-live="polite"></output>
        <button type="button" class="btn icon" data-act="more" data-label="aria-label:more">+</button>
      </div>
      <label class="field"><span data-label="preset"></span>
        <select name="preset">
          <option value="" data-label="choose"></option>
          ${Object.keys(PRESETS).map((id) => `<option value="${id}"></option>`).join('')}
        </select>
      </label>
      <button type="button" class="btn" data-act="clear" data-label="clear"></button>
      <div class="transport">
        <button type="button" class="btn play" data-act="play" aria-pressed="false"></button>
        <label class="field"><span data-label="bpm"></span> <input type="number" name="bpm" min="40" max="200" step="1" inputmode="numeric"></label>
        <label class="check"><input type="checkbox" name="loop"> <span data-label="loop"></span></label>
        <label class="check"><input type="checkbox" name="click"> <span data-label="click"></span></label>
      </div>
    </div>
    <ol class="bars" data-label="aria-label:bars"></ol>`;

  const $ = (selector) => container.querySelector(selector);
  const count = $('.bar-count');
  const preset = $('[name=preset]');
  const play = $('[data-act=play]');
  const bpm = $('[name=bpm]');
  const loop = $('[name=loop]');
  const click = $('[name=click]');
  const bars = $('.bars');
  let barCount = 0;
  let renderedLang = null;

  function translate(lang) {
    const text = ui(lang).strip;
    for (const el of container.querySelectorAll('[data-label]')) {
      const [attr, id] = el.dataset.label.includes(':') ? el.dataset.label.split(':') : [null, el.dataset.label];
      if (attr) el.setAttribute(attr, text[id]);
      else el.textContent = text[id];
    }
    for (const option of preset.options) if (option.value) option.textContent = prettyText(presetLabel(option.value, lang));
    renderedLang = lang;
  }

  $('[data-act=fewer]').addEventListener('click', () => onBarCount(barCount - 1));
  $('[data-act=more]').addEventListener('click', () => onBarCount(barCount + 1));
  $('[data-act=clear]').addEventListener('click', onClear);
  play.addEventListener('click', onPlay);
  preset.addEventListener('change', () => {
    if (preset.value) onPreset(preset.value);
    preset.value = '';
  });
  bpm.addEventListener('change', () => onTempo(Number(bpm.value)));
  loop.addEventListener('change', () => onLoop(loop.checked));
  click.addEventListener('change', () => onClickTrack(click.checked));

  function slotButton(slot, state) {
    const analysis = state.analysis.chords[slot.index];
    const addr = { bar: slot.bar, half: slot.half };
    const playing = state.playback.playing && sameAddress(state.playback.playhead, addr);
    const text = ui(state.lang).strip;
    const label = slot.chord ? text.slotFilled(slot.bar + 1, prettySymbol(slot.chord, state.lang)) : text.slotEmpty(slot.bar + 1);
    return h('button', {
      type: 'button',
      class: `slot${slot.chord ? '' : ' empty'}`,
      'data-id': `slot-${slot.bar}-${slot.half}`,
      'data-function': analysis?.function ?? false,
      'data-playing': playing ? 'true' : false,
      'aria-pressed': String(sameAddress(state.selectedSlot, addr)),
      'aria-label': label,
      onclick: () => onSelectSlot(addr, slot.chord),
    },
    h('span', { class: 'slot-symbol' }, slot.chord ? prettySymbol(slot.chord, state.lang) : '+'),
    analysis && h('span', { class: 'slot-roman' }, prettyText(analysis.roman)));
  }

  function renderBars(state) {
    const focusedId = bars.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    const text = ui(state.lang).strip;
    bars.replaceChildren(...state.progression.bars.map((bar, i) => {
      const split = bar.chords.length === 2;
      return h('li', { class: 'bar', 'data-split': String(split) },
        h('div', { class: 'bar-head' },
          h('span', { class: 'bar-number' }, String(i + 1)),
          h('button', {
            type: 'button',
            class: 'split-toggle',
            'data-id': `split-${i}`,
            'aria-pressed': String(split),
            'aria-label': split ? text.join(i + 1) : text.split(i + 1),
            title: split ? text.oneChord : text.twoChords,
            onclick: () => onToggleSplit(i),
          }, split ? '1' : '½')),
        h('div', { class: 'bar-slots' }, state.slots.filter((s) => s.bar === i).map((s) => slotButton(s, state))));
    }));
    if (focusedId) bars.querySelector(`[data-id="${CSS.escape(focusedId)}"]`)?.focus();
  }

  return {
    render(state) {
      if (state.lang !== renderedLang) translate(state.lang);
      const text = ui(state.lang).strip;
      barCount = state.progression.bars.length;
      count.value = text.barCount(barCount);
      $('[data-act=fewer]').disabled = barCount <= 1;
      $('[data-act=more]').disabled = barCount >= MAX_BARS;
      const { playing } = state.playback;
      play.textContent = playing ? text.stop : text.play;
      play.setAttribute('aria-pressed', String(playing));
      play.disabled = !playing && !state.slots.some((s) => s.chord);
      if (document.activeElement !== bpm) bpm.value = String(state.playback.bpm);
      loop.checked = state.playback.loop;
      click.checked = state.playback.click;
      renderBars(state);
    },
    show(visible) {
      container.hidden = !visible;
    },
  };
}
