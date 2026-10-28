import { LANGS } from '../theory/text/index.js';
import { SCALES, rootLabel, scaleLabel } from '../theory/scales.js';
import { ui } from './strings.js';

const MODES = ['explore', 'progression'];
const INSTRUMENTS = ['guitar', 'piano'];
const LEVELS = ['beginner', 'intermediate'];
// Language names stay in their own language, so they are readable from either side.
const LANGUAGES = { en: 'English', fi: 'Suomi' };

const segmented = (name, ids) => `
  <fieldset class="segmented" data-group="${name}">
    ${ids.map((id) => `
      <label><input type="radio" name="${name}" value="${id}"><span data-label="${name}.${id}"></span></label>`).join('')}
  </fieldset>`;

export function createControls(container, { onMode, onInstrument, onRoot, onScale, onLevel, onLang }) {
  container.innerHTML = `
    ${segmented('mode', MODES)}
    ${segmented('instrument', INSTRUMENTS)}
    <label class="field"><span data-label="root"></span>
      <select name="root">
        ${Array.from({ length: 12 }, (_, pc) => `<option value="${pc}"></option>`).join('')}
      </select>
    </label>
    <label class="field"><span data-label="scale"></span>
      <select name="scale">
        ${Object.keys(SCALES).map((id) => `<option value="${id}"></option>`).join('')}
      </select>
    </label>
    ${segmented('level', LEVELS)}
    <fieldset class="segmented lang" data-group="lang">
      ${LANGS.map((id) => `
        <label><input type="radio" name="lang" value="${id}" lang="${id}"><span>${LANGUAGES[id]}</span></label>`).join('')}
    </fieldset>`;

  const root = container.querySelector('[name=root]');
  const scale = container.querySelector('[name=scale]');
  const levelGroup = container.querySelector('[data-group=level]');
  const radios = (name) => container.querySelectorAll(`[name=${name}]`);
  const handlers = { mode: onMode, instrument: onInstrument, level: onLevel, lang: onLang };

  for (const [name, handler] of Object.entries(handlers)) {
    radios(name).forEach((radio) => radio.addEventListener('change', () => handler(radio.value)));
  }
  root.addEventListener('change', () => onRoot(Number(root.value)));
  scale.addEventListener('change', () => onScale(scale.value));

  let renderedLang = null;
  function translate(lang) {
    const text = ui(lang).controls;
    for (const el of container.querySelectorAll('[data-label]')) {
      const [group, id] = el.dataset.label.split('.');
      el.textContent = id ? text[id] : text[group];
    }
    for (const name of ['mode', 'instrument', 'level']) {
      container.querySelector(`[data-group=${name}]`).setAttribute('aria-label', text[name]);
    }
    container.querySelector('[data-group=lang]').setAttribute('aria-label', text.language);
    for (const option of root.options) option.textContent = rootLabel(Number(option.value), lang);
    for (const option of scale.options) option.textContent = scaleLabel(option.value, lang);
    renderedLang = lang;
  }

  return {
    render(state) {
      if (state.lang !== renderedLang) translate(state.lang);
      root.value = String(state.rootPc);
      scale.value = state.scaleId;
      for (const name of Object.keys(handlers)) {
        radios(name).forEach((radio) => { radio.checked = radio.value === state[name]; });
      }
      levelGroup.hidden = state.mode !== 'progression';
    },
  };
}
