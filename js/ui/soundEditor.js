// The sound editor: a native <dialog> with one lane's patch (preset, waveform
// and the number params). Every control writes through a callback, and render(state)
// alone opens and closes the dialog, so state stays the single source of truth.

import { SOUND_PARAMS, SOUND_PRESETS, WAVES, cutoffFromSlider, sliderFromCutoff } from '../theory/sounds.js';
import { h } from './dom.js';
import { ui } from './strings.js';

const NUMBER_PARAMS = SOUND_PARAMS.filter((spec) => spec.kind === 'number');

/**
 * A patch value as the modal shows it: "1.8 kHz", "650 Hz", "40 ms", "1.2 s",
 * "70 %", "8 ct", "3.0 dB". Pure: no DOM, so Node can test it.
 * @param {string} param
 * @param {number} value
 * @param {'en'|'fi'} lang
 * @returns {string}
 */
export function formatParam(param, value, lang) {
  const locale = lang === 'fi' ? 'fi-FI' : 'en-US';
  const format = (n, maximumFractionDigits = 0, minimumFractionDigits = 0) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits, minimumFractionDigits }).format(n);
  switch (param) {
    case 'cutoff':
      return value >= 1000 ? `${format(value / 1000, 1)} kHz` : `${format(value)} Hz`;
    case 'attack':
    case 'decay':
    case 'release':
      return value < 1 ? `${format(value * 1000)} ms` : `${format(value, 1)} s`;
    case 'sustain':
    case 'octave':
    case 'reverb':
      return `${format(value * 100)} %`;
    case 'warmth':
      return `${format(value)} ct`;
    case 'resonance':
      return `${format(value, 1, 1)} dB`;
    default:
      return String(value);
  }
}

// The brightness slider runs 0–100 on a log scale; every other number is linear.
function sliderSpec(spec) {
  if (spec.param === 'cutoff') {
    return { min: 0, max: 100, step: 0.1, toPatch: cutoffFromSlider, toSlider: sliderFromCutoff };
  }
  return { min: spec.min, max: spec.max, step: spec.step, toPatch: (x) => x, toSlider: (x) => x };
}

/** A fader or slider is being dragged while it has focus and the pointer is held on it. */
const dragging = (el) => document.activeElement === el && el.matches(':active');

/**
 * Builds the modal once inside `container` (pass document.body). Callbacks:
 * onParam(param, value), onPreset(id), onReset(), onConfirm(), onCancel(),
 * onPreview(lane).
 */
export function createSoundEditor(container, { onParam, onPreset, onReset, onConfirm, onCancel, onPreview }) {
  let currentLane = null;
  let optionsKey = null; // lane, language and custom flag the labels and options were built for

  const title = h('h2', { class: 'sound-title', id: 'sound-editor-title' });
  const presetLabel = h('label', { class: 'sound-label', for: 'sound-preset' });
  const presetSelect = h('select', {
    id: 'sound-preset',
    name: 'sound-preset',
    onchange: () => onPreset(presetSelect.value),
  });
  const waveLabel = h('label', { class: 'sound-label', for: 'sound-wave' });
  const waveSelect = h('select', {
    id: 'sound-wave',
    name: 'wave',
    onchange: () => onParam('wave', waveSelect.value),
  });

  const rows = NUMBER_PARAMS.map((spec) => {
    const id = `sound-${spec.param}`;
    const slider = sliderSpec(spec);
    const label = h('label', { class: 'sound-label', for: id });
    const input = h('input', {
      type: 'range',
      id,
      name: spec.param,
      class: 'sound-slider',
      min: slider.min,
      max: slider.max,
      step: slider.step,
      oninput: () => onParam(spec.param, slider.toPatch(Number(input.value))),
    });
    const output = h('output', { class: 'sound-value', for: id });
    return { spec, slider, label, input, output };
  });

  const hint = h('p', { class: 'sound-hint', hidden: true });
  const preview = h('button', { type: 'button', class: 'btn', onclick: () => onPreview(currentLane) });
  const reset = h('button', { type: 'button', class: 'btn', onclick: onReset });
  const cancel = h('button', { type: 'button', class: 'btn', onclick: onCancel });
  const ok = h('button', { type: 'button', class: 'btn sound-ok', onclick: onConfirm });

  const dialog = h('dialog', {
    class: 'sound-editor',
    'aria-labelledby': 'sound-editor-title',
    // Escape: keep the dialog open here; state closes it through render().
    oncancel: (event) => {
      event.preventDefault();
      onCancel();
    },
    // The padding lives in .sound-body, so a click on the dialog itself is the backdrop.
    onclick: (event) => {
      if (event.target === dialog) onCancel();
    },
  },
  h('div', { class: 'sound-body' },
    title,
    h('div', { class: 'sound-grid' },
      presetLabel, presetSelect,
      waveLabel, waveSelect,
      ...rows.flatMap((row) => [row.label, row.input, row.output])),
    hint,
    h('div', { class: 'sound-actions' }, preview, reset, cancel, ok)));
  container.append(dialog);

  function translate(lang, lane, custom) {
    const text = ui(lang).sound;
    title.textContent = text.title[lane];
    presetLabel.textContent = text.preset;
    presetSelect.replaceChildren(
      ...Object.keys(SOUND_PRESETS[lane]).map((id) => h('option', { value: id }, text.presets[lane][id])),
      ...(custom ? [h('option', { value: 'custom' }, text.custom)] : []),
    );
    waveLabel.textContent = text.params.wave;
    waveLabel.title = text.tips.wave;
    waveSelect.replaceChildren(...WAVES.map((wave) => h('option', { value: wave }, text.waves[wave])));
    for (const row of rows) {
      row.label.textContent = text.params[row.spec.param];
      row.label.title = text.tips[row.spec.param];
    }
    hint.textContent = text.playingHint;
    preview.textContent = text.preview;
    reset.textContent = text.reset;
    cancel.textContent = text.cancel;
    ok.textContent = text.ok;
  }

  return {
    render(state) {
      const editing = state.soundEditor;
      if (editing && !dialog.open) dialog.showModal();
      else if (!editing && dialog.open) dialog.close();
      if (!editing) return;

      const { lang } = state;
      const { lane } = editing;
      const patch = state.sounds[lane];
      const custom = patch.preset === 'custom';
      currentLane = lane;
      const key = `${lang}|${lane}|${custom}`;
      if (key !== optionsKey) {
        translate(lang, lane, custom);
        optionsKey = key;
      }

      presetSelect.value = patch.preset;
      waveSelect.value = patch.wave;
      const { playing } = state.playback;
      preview.disabled = playing;
      hint.hidden = !playing;

      for (const { spec, slider, input, output } of rows) {
        const busy = dragging(input);
        if (!busy) input.value = String(slider.toSlider(patch[spec.param]));
        const shown = busy ? slider.toPatch(Number(input.value)) : patch[spec.param];
        output.textContent = formatParam(spec.param, shown, lang);
      }
    },
  };
}
