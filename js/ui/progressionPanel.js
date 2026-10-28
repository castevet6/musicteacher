// Side panel in progression mode: the selected bar's chord, a chord picker,
// what to play over the chord, guide tones, next-chord ideas and advice.

import {
  adviceText, avoidReasonText, cadenceText, functionText, guideToneText, noteOverChordText, reasonText, tierText,
} from '../theory/adviceText.js';
import { chordPalette } from '../theory/analysis.js';
import { CHORD_QUALITIES, buildChord } from '../theory/chords.js';
import { LETTERS, prettyName } from '../theory/notes.js';
import { sameAddress } from '../theory/progression.js';
import { h, prettySymbol, prettyText } from './dom.js';

const TIER_ORDER = ['chord', 'scale', 'parent', 'blue', 'avoid'];
const ACCIDENTALS = [{ acc: -1, label: '♭' }, { acc: 0, label: '♮' }, { acc: 1, label: '♯' }];
const QUALITY_LABELS = {
  maj: 'major', min: 'minor', dim: 'dim', aug: 'aug', maj7: 'maj7', dom7: '7', min7: 'm7', m7b5: 'm7♭5', dim7: 'dim7', mMaj7: 'm(maj7)',
};

export function createProgressionPanel(container, { onPickChord, onNextChord }) {
  // View-only UI state: which picker tab is shown and whether the picker is open.
  let activeTab = 'diatonic';
  let pickerOpen = false;
  let custom = { letter: 'C', acc: 0, quality: 'maj' };

  function picker(state, slot) {
    const palette = chordPalette(state.key);
    const tabs = [...palette.map((g) => ({ id: g.id, title: g.title })), { id: 'custom', title: 'Custom' }];
    const addr = { bar: slot.bar, half: slot.half };
    const pickButton = ({ chord, roman }) => h('button', {
      type: 'button',
      class: 'pick',
      'data-id': `pick-${chord.symbol}`,
      'aria-pressed': String(slot.chord?.symbol === chord.symbol),
      onclick: () => onPickChord(addr, chord),
    }, h('span', { class: 'pick-symbol' }, prettySymbol(chord)), h('span', { class: 'pick-roman' }, prettyText(roman)));

    let body;
    if (activeTab === 'custom') {
      const select = (name, options, value, onchange) => h('select', { name, 'aria-label': name, onchange },
        options.map((o) => {
          const option = h('option', { value: String(o.value) }, o.label);
          option.selected = String(o.value) === String(value);
          return option;
        }));
      body = h('div', { class: 'custom-picker' },
        select('Root letter', LETTERS.map((l) => ({ value: l, label: l })), custom.letter, (e) => { custom.letter = e.target.value; }),
        select('Accidental', ACCIDENTALS.map((a) => ({ value: a.acc, label: a.label })), custom.acc, (e) => { custom.acc = Number(e.target.value); }),
        select('Quality', Object.keys(CHORD_QUALITIES).map((q) => ({ value: q, label: QUALITY_LABELS[q] })), custom.quality, (e) => { custom.quality = e.target.value; }),
        h('button', {
          type: 'button',
          class: 'btn',
          'data-id': 'custom-set',
          onclick: () => onPickChord(addr, buildChord({ letter: custom.letter, acc: custom.acc }, custom.quality)),
        }, 'Set chord'));
    } else {
      body = h('div', { class: 'pick-grid' }, palette.find((g) => g.id === activeTab).chords.map(pickButton));
    }

    const details = h('details', { class: 'picker', open: !slot.chord || pickerOpen },
      h('summary', {}, slot.chord ? 'Change chord' : 'Choose a chord'),
      h('div', { class: 'tabs', role: 'tablist' }, tabs.map((t) => h('button', {
        type: 'button',
        role: 'tab',
        class: 'tab',
        'data-id': `tab-${t.id}`,
        'aria-selected': String(t.id === activeTab),
        onclick: () => { activeTab = t.id; pickerOpen = true; render(state); },
      }, t.title))),
      body,
      slot.chord && h('button', { type: 'button', class: 'btn subtle', 'data-id': 'remove', onclick: () => onPickChord(addr, null) }, 'Remove chord'));
    details.addEventListener('toggle', () => { if (slot.chord) pickerOpen = details.open; });
    return details;
  }

  function notesSection(state) {
    const { focus, level } = state;
    const groups = TIER_ORDER
      .map((tier) => ({ tier, notes: focus.notes.filter((info) => info.tier === tier) }))
      .filter((g) => g.notes.length);
    const selected = state.selected && focus.notes[state.selected.pc];
    return h('section', { class: 'over-chord' },
      h('h3', {}, `What to play over ${prettySymbol(focus.chord)}`),
      groups.map(({ tier, notes }) => h('div', { class: 'tier', 'data-tier': tier },
        h('h4', {}, h('span', { class: `swatch swatch-${tier}` }), tierText(tier, level)),
        h('ul', { class: 'note-chips' }, notes.map((info) => h('li', {
          class: 'note-chip',
          title: tier === 'avoid' ? prettyText(avoidReasonText(info, level)) : false,
        }, h('b', {}, prettyName(info.note)), ' ', h('span', {}, prettyText(info.label))))))),
      selected && h('p', { class: 'note-line' },
        prettyText(noteOverChordText(selected, focus.chord, level)),
        selected.tier === 'avoid' && ` (${prettyText(avoidReasonText(selected, level))})`),
      focus.guideTones.length > 0 && h('div', { class: 'guide' },
        h('h4', {}, h('span', { class: 'swatch swatch-guide' }), `Into ${prettySymbol(focus.nextChord)}`),
        h('ul', {}, focus.guideTones.map((move) => h('li', {}, prettyText(guideToneText(move, focus.chord, focus.nextChord, level)))))));
  }

  function nextSection(state) {
    const { focus, level } = state;
    if (!focus.next.length) return null;
    return h('section', { class: 'next' },
      h('h3', {}, focus.chord ? 'What could come next' : 'Ideas for this bar'),
      h('div', { class: 'pick-grid' }, focus.next.map((option) => h('button', {
        type: 'button',
        class: 'pick next-pick',
        'data-id': `next-${option.symbol}`,
        onclick: () => onNextChord(option.chord, focus),
      },
      h('span', { class: 'pick-symbol' }, prettySymbol(option.chord)),
      h('span', { class: 'pick-roman' }, prettyText(option.roman)),
      h('span', { class: 'pick-reason' }, reasonText(option.reason, level))))));
  }

  function aboutSection(state) {
    const { analysis, slots, level } = state;
    const lines = [
      ...analysis.cadences.map((c) => ({ text: cadenceText(c, slots, level), kind: 'cadence' })),
      ...analysis.advice.map((a) => ({ text: adviceText(a, level), kind: 'advice' })),
    ];
    if (!lines.length) return null;
    return h('section', { class: 'about' },
      h('h3', {}, 'About the progression'),
      h('ul', { class: 'advice' }, lines.map((l) => h('li', { 'data-kind': l.kind }, prettyText(l.text)))));
  }

  const show = (...sections) => container.replaceChildren(...sections.filter(Boolean));

  function draw(state) {
    const { focus, level } = state;
    const hasChords = state.slots.some((s) => s.chord);
    if (!focus) {
      show(
        h('h2', {}, 'Progression'),
        h('p', { class: 'hint' }, hasChords
          ? 'Click a bar to see what to play over its chord, or press Play.'
          : 'Pick a preset or click a bar to add a chord.'),
        aboutSection(state));
      return;
    }

    const { slot, chord, analysis } = focus;
    const where = slot.beats === 2 ? `Bar ${slot.bar + 1}, ${slot.half ? 'second' : 'first'} half` : `Bar ${slot.bar + 1}`;
    const editable = sameAddress(state.selectedSlot, slot);
    show(
      h('h2', {},
        chord ? h('span', { class: 'note-badge chord-badge' }, prettySymbol(chord)) : 'Empty',
        analysis && h('span', { class: 'chord-roman' }, prettyText(analysis.roman)),
        analysis?.function && h('span', { class: 'tag function-tag', 'data-function': analysis.function }, analysis.function),
        h('span', { class: 'bar-label' }, where)),
      analysis && h('p', { class: 'function-text' }, prettyText(functionText(analysis, state.key, level))),
      editable && picker(state, slot),
      chord && notesSection(state),
      nextSection(state),
      aboutSection(state));
  }

  function render(state) {
    const focusedId = container.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    draw(state);
    if (focusedId) container.querySelector(`[data-id="${CSS.escape(focusedId)}"]`)?.focus();
  }

  return { render };
}
