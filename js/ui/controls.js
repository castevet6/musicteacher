import { ROOT_LABELS, SCALES } from '../theory/scales.js';

const MODES = [
  { id: 'explore', label: 'Explore' },
  { id: 'progression', label: 'Progression' },
];
const INSTRUMENTS = [
  { id: 'guitar', label: 'Guitar' },
  { id: 'piano', label: 'Piano' },
];
const LEVELS = [
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
];

const segmented = (name, label, options) => `
  <fieldset class="segmented" aria-label="${label}" data-group="${name}">
    ${options.map((o) => `
      <label><input type="radio" name="${name}" value="${o.id}"><span>${o.label}</span></label>`).join('')}
  </fieldset>`;

export function createControls(container, { onMode, onInstrument, onRoot, onScale, onLevel }) {
  container.innerHTML = `
    ${segmented('mode', 'Mode', MODES)}
    ${segmented('instrument', 'Instrument', INSTRUMENTS)}
    <label class="field">Root
      <select name="root">
        ${ROOT_LABELS.map((label, pc) => `<option value="${pc}">${label.replace(/#/g, '♯').replace(/b/g, '♭')}</option>`).join('')}
      </select>
    </label>
    <label class="field">Scale
      <select name="scale">
        ${Object.entries(SCALES).map(([id, s]) => `<option value="${id}">${s.label}</option>`).join('')}
      </select>
    </label>
    ${segmented('level', 'Explanation level', LEVELS)}`;

  const root = container.querySelector('[name=root]');
  const scale = container.querySelector('[name=scale]');
  const levelGroup = container.querySelector('[data-group=level]');
  const radios = (name) => container.querySelectorAll(`[name=${name}]`);
  const handlers = { mode: onMode, instrument: onInstrument, level: onLevel };

  for (const [name, handler] of Object.entries(handlers)) {
    radios(name).forEach((radio) => radio.addEventListener('change', () => handler(radio.value)));
  }
  root.addEventListener('change', () => onRoot(Number(root.value)));
  scale.addEventListener('change', () => onScale(scale.value));

  return {
    render(state) {
      root.value = String(state.rootPc);
      scale.value = state.scaleId;
      for (const name of Object.keys(handlers)) {
        radios(name).forEach((radio) => { radio.checked = radio.value === state[name]; });
      }
      levelGroup.hidden = state.mode !== 'progression';
    },
  };
}
