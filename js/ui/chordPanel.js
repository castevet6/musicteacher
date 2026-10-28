import { prettyName } from '../theory/notes.js';
import { isGapScale, keyIn, noteStatus } from '../theory/scales.js';
import { sourceLabel, textFor } from '../theory/text/index.js';
import { h, prettySymbol, prettyText } from './dom.js';
import { ui } from './strings.js';

// Borrowed chords say where they come from; other groups' titles already do.
const SOURCE_TAGGED = /parallel|harmonic/;

export function createChordPanel(container, { onChordClick }) {
  const collapsed = new Set();

  function chordRow(suggestion, state) {
    const active = state.activeChord?.id === suggestion.id;
    const { lang } = state;
    const text = ui(lang).chords;
    const noteName = prettyName(state.suggestions.note, lang);
    const roleNames = textFor(lang).roleNames;
    const showFits = isGapScale(state.key) && suggestion.fitsScale;
    return h('li', {},
      h('button', {
        class: 'chord',
        type: 'button',
        'aria-pressed': String(active),
        'data-id': suggestion.id,
        onclick: () => onChordClick(suggestion),
      },
      h('span', { class: 'chord-symbol' }, prettySymbol(suggestion.chord, lang)),
      h('span', { class: 'chord-roman' }, prettyText(suggestion.roman)),
      h('span', { class: 'chord-tones' }, suggestion.tones.map((t) => prettyName(t.note, lang)).join(' · ')),
      h('span', { class: 'chord-meta' },
        h('span', { class: 'tag role-tag' }, text.roleTag(noteName, roleNames[suggestion.roleOfSelected])),
        SOURCE_TAGGED.test(suggestion.source) && h('span', { class: 'tag' }, sourceLabel(suggestion.source, lang)),
        showFits && h('span', { class: 'tag fits-tag' }, text.fitsScale),
      )));
  }

  function render(state) {
    const focusedId = container.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    draw(state);
    if (focusedId) container.querySelector(`[data-id="${CSS.escape(focusedId)}"]`)?.focus();
  }

  function draw(state) {
    const { suggestions, key, lang } = state;
    const text = ui(lang).chords;
    if (!suggestions) {
      container.replaceChildren(
        h('h2', {}, text.title),
        h('p', { class: 'hint' }, text.hint(state.instrument, prettyText(keyIn(key, lang)))),
      );
      return;
    }

    const status = prettyText(noteStatus(suggestions.inScale, key, lang));
    container.replaceChildren(
      h('h2', {},
        h('span', { class: `note-badge ${suggestions.inScale ? 'in' : 'out'}` }, prettyName(suggestions.note, lang)),
        ' ', status,
        suggestions.isBlueNote && h('span', { class: 'tag blue-tag' }, text.blueNote)),
      suggestions.explanation ? h('p', { class: 'explanation' }, prettyText(suggestions.explanation)) : '',
      ...suggestions.groups.map((group) => {
        const details = h('details', { open: !collapsed.has(group.id) },
          h('summary', {}, textFor(lang).groupTitles[group.id], h('span', { class: 'count' }, String(group.chords.length))),
          h('ul', { class: 'chord-list' }, group.chords.map((s) => chordRow(s, state))));
        details.addEventListener('toggle', () => {
          if (details.open) collapsed.delete(group.id);
          else collapsed.add(group.id);
        });
        return details;
      }),
      h('p', { class: 'hint small' }, text.footer),
    );
  }

  return { render };
}
