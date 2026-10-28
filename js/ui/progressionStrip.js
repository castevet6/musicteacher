// The bar strip above the instrument in progression mode: bar count, presets,
// transport, and one cell per bar holding one or two chord slots.

import { MAX_BARS, PRESETS, sameAddress } from '../theory/progression.js';
import { h, prettySymbol, prettyText } from './dom.js';

export function createProgressionStrip(container, handlers) {
  const {
    onBarCount, onPreset, onClear, onPlay, onTempo, onLoop, onClickTrack, onSelectSlot, onToggleSplit,
  } = handlers;

  container.innerHTML = `
    <div class="strip-toolbar">
      <div class="stepper" role="group" aria-label="Number of bars">
        <button type="button" class="btn icon" data-act="fewer" aria-label="Fewer bars">−</button>
        <output class="bar-count" aria-live="polite"></output>
        <button type="button" class="btn icon" data-act="more" aria-label="More bars">+</button>
      </div>
      <label class="field">Preset
        <select name="preset">
          <option value="">Choose…</option>
          ${Object.entries(PRESETS).map(([id, p]) => `<option value="${id}">${p.label}</option>`).join('')}
        </select>
      </label>
      <button type="button" class="btn" data-act="clear">Clear</button>
      <div class="transport">
        <button type="button" class="btn play" data-act="play" aria-pressed="false"></button>
        <label class="field">BPM <input type="number" name="bpm" min="40" max="200" step="1" inputmode="numeric"></label>
        <label class="check"><input type="checkbox" name="loop"> Loop</label>
        <label class="check"><input type="checkbox" name="click"> Click</label>
      </div>
    </div>
    <ol class="bars" aria-label="Bars"></ol>`;

  const $ = (selector) => container.querySelector(selector);
  const count = $('.bar-count');
  const preset = $('[name=preset]');
  const play = $('[data-act=play]');
  const bpm = $('[name=bpm]');
  const loop = $('[name=loop]');
  const click = $('[name=click]');
  const bars = $('.bars');
  let barCount = 0;

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
    const label = slot.chord ? `Bar ${slot.bar + 1}: ${slot.chord.symbol}` : `Bar ${slot.bar + 1}: empty, add a chord`;
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
    h('span', { class: 'slot-symbol' }, slot.chord ? prettySymbol(slot.chord) : '+'),
    analysis && h('span', { class: 'slot-roman' }, prettyText(analysis.roman)));
  }

  function renderBars(state) {
    const focusedId = bars.contains(document.activeElement) ? document.activeElement.dataset.id : null;
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
            'aria-label': split ? `Join bar ${i + 1} into one chord` : `Split bar ${i + 1} into two chords`,
            title: split ? 'One chord in this bar' : 'Two chords in this bar',
            onclick: () => onToggleSplit(i),
          }, split ? '1' : '½')),
        h('div', { class: 'bar-slots' }, state.slots.filter((s) => s.bar === i).map((s) => slotButton(s, state))));
    }));
    if (focusedId) bars.querySelector(`[data-id="${CSS.escape(focusedId)}"]`)?.focus();
  }

  return {
    render(state) {
      barCount = state.progression.bars.length;
      count.value = `${barCount} bar${barCount === 1 ? '' : 's'}`;
      $('[data-act=fewer]').disabled = barCount <= 1;
      $('[data-act=more]').disabled = barCount >= MAX_BARS;
      const { playing } = state.playback;
      play.textContent = playing ? '■ Stop' : '▶ Play';
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
