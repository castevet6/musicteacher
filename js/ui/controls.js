import { ROOT_LABELS, SCALES } from '../theory/scales.js';

const INSTRUMENTS = [
  { id: 'guitar', label: 'Guitar' },
  { id: 'piano', label: 'Piano' },
];

export function createControls(container, { onInstrument, onRoot, onScale }) {
  container.innerHTML = `
    <fieldset class="segmented" aria-label="Instrument">
      ${INSTRUMENTS.map((i) => `
        <label><input type="radio" name="instrument" value="${i.id}"><span>${i.label}</span></label>`).join('')}
    </fieldset>
    <label class="field">Root
      <select name="root">
        ${ROOT_LABELS.map((label, pc) => `<option value="${pc}">${label.replace(/#/g, '♯').replace(/b/g, '♭')}</option>`).join('')}
      </select>
    </label>
    <label class="field">Scale
      <select name="scale">
        ${Object.entries(SCALES).map(([id, s]) => `<option value="${id}">${s.label}</option>`).join('')}
      </select>
    </label>`;

  const root = container.querySelector('[name=root]');
  const scale = container.querySelector('[name=scale]');
  const radios = container.querySelectorAll('[name=instrument]');

  radios.forEach((radio) => radio.addEventListener('change', () => onInstrument(radio.value)));
  root.addEventListener('change', () => onRoot(Number(root.value)));
  scale.addEventListener('change', () => onScale(scale.value));

  return {
    render(state) {
      root.value = String(state.rootPc);
      scale.value = state.scaleId;
      radios.forEach((radio) => { radio.checked = radio.value === state.instrument; });
    },
  };
}
