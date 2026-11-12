// The chord strip in Composer: a toolbar (bar count, presets, clear) and one
// cell per bar inside the timeline, holding one or two chord slots.

import { MAX_BARS, PRESETS, presetLabel, sameAddress } from '../theory/progression.js';
import { h, prettySymbol, prettyText } from './dom.js';
import { ui } from './strings.js';

export function createChordStrip({ toolbar, bars }, handlers) {
  const { onBarCount, onPreset, onClear, onSelectSlot, onToggleSplit } = handlers;

  toolbar.innerHTML = `
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
    <button type="button" class="btn" data-act="clear" data-label="clear"></button>`;

  const $ = (selector) => toolbar.querySelector(selector);
  const count = $('.bar-count');
  const preset = $('[name=preset]');
  let barCount = 0;
  let renderedLang = null;

  function translate(lang) {
    const text = ui(lang).strip;
    for (const el of toolbar.querySelectorAll('[data-label]')) {
      const [attr, id] = el.dataset.label.includes(':') ? el.dataset.label.split(':') : [null, el.dataset.label];
      if (attr) el.setAttribute(attr, text[id]);
      else el.textContent = text[id];
    }
    bars.setAttribute('aria-label', text.bars);
    for (const option of preset.options) if (option.value) option.textContent = prettyText(presetLabel(option.value, lang));
    renderedLang = lang;
  }

  $('[data-act=fewer]').addEventListener('click', () => onBarCount(barCount - 1));
  $('[data-act=more]').addEventListener('click', () => onBarCount(barCount + 1));
  $('[data-act=clear]').addEventListener('click', onClear);
  preset.addEventListener('change', () => {
    if (preset.value) onPreset(preset.value);
    preset.value = '';
  });

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
      renderBars(state);
    },
  };
}
