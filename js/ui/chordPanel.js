import { CHORD_QUALITIES } from '../theory/chords.js';
import { prettyName } from '../theory/notes.js';
import { isGapScale, keyLabel } from '../theory/scales.js';

const ROLE_NAMES = { R: 'root', 3: '3rd', 5: '5th', 7: '7th' };
// Borrowed chords say where they come from; other groups' titles already do.
const SOURCE_TAGGED = /parallel|harmonic/;

/** Small DOM builder: h('span', { class: 'x' }, 'text', childEl). */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name.startsWith('on')) el.addEventListener(name.slice(2), value);
    else if (value !== false && value != null) el.setAttribute(name, value);
  }
  el.append(...children.flat().filter((c) => c != null && c !== false));
  return el;
}

/** Accidental glyphs in note names (Bb), degrees (b6) and numerals (bVI, V/bVI). */
export function prettyText(text) {
  return text
    .replace(/([A-G])b(?![a-z])/g, '$1♭')
    .replace(/(^|[\s/(])b(?=[0-9IViv])/g, '$1♭')
    .replace(/#/g, '♯');
}

export function prettySymbol(chord) {
  return prettyName(chord.root) + CHORD_QUALITIES[chord.quality].symbol.replace('b5', '♭5');
}

export function createChordPanel(container, { onChordClick }) {
  const collapsed = new Set();

  function chordRow(suggestion, state) {
    const active = state.activeChord?.id === suggestion.id;
    const noteName = prettyName(state.suggestions.note);
    const showFits = isGapScale(state.key) && suggestion.fitsScale;
    return h('li', {},
      h('button', {
        class: 'chord',
        type: 'button',
        'aria-pressed': String(active),
        'data-id': suggestion.id,
        onclick: () => onChordClick(suggestion),
      },
      h('span', { class: 'chord-symbol' }, prettySymbol(suggestion.chord)),
      h('span', { class: 'chord-roman' }, prettyText(suggestion.roman)),
      h('span', { class: 'chord-tones' }, suggestion.tones.map((t) => prettyName(t.note)).join(' · ')),
      h('span', { class: 'chord-meta' },
        h('span', { class: 'tag role-tag' }, `${noteName} = ${ROLE_NAMES[suggestion.roleOfSelected]}`),
        SOURCE_TAGGED.test(suggestion.source) && h('span', { class: 'tag' }, suggestion.source),
        showFits && h('span', { class: 'tag fits-tag' }, 'fits scale'),
      )));
  }

  function render(state) {
    const focusedId = container.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    draw(state);
    if (focusedId) container.querySelector(`[data-id="${CSS.escape(focusedId)}"]`)?.focus();
  }

  function draw(state) {
    const { suggestions, key } = state;
    if (!suggestions) {
      container.replaceChildren(
        h('h2', {}, 'Chords'),
        h('p', { class: 'hint' }, `Click a note on the ${state.instrument} to see the chords that suit it in ${prettyText(keyLabel(key))}.`),
      );
      return;
    }

    const label = prettyText(keyLabel(key));
    const status = suggestions.inScale ? `In ${label}` : `Not in ${label}`;
    container.replaceChildren(
      h('h2', {},
        h('span', { class: `note-badge ${suggestions.inScale ? 'in' : 'out'}` }, prettyName(suggestions.note)),
        ' ', status,
        suggestions.isBlueNote && h('span', { class: 'tag blue-tag' }, 'blue note')),
      suggestions.explanation ? h('p', { class: 'explanation' }, prettyText(suggestions.explanation)) : '',
      ...suggestions.groups.map((group) => {
        const details = h('details', { open: !collapsed.has(group.id) },
          h('summary', {}, group.title, h('span', { class: 'count' }, String(group.chords.length))),
          h('ul', { class: 'chord-list' }, group.chords.map((s) => chordRow(s, state))));
        details.addEventListener('toggle', () => {
          if (details.open) collapsed.delete(group.id);
          else collapsed.add(group.id);
        });
        return details;
      }),
      h('p', { class: 'hint small' }, 'Click a chord to show its notes on the instrument and hear it.'),
    );
  }

  return { render };
}
