// Side panel in Composer. Its content follows the selection: a selected bar
// shows the Chord tab (chord picker, what to play over the chord, guide tones,
// next-chord ideas), nothing selected shows the Piece tab (cadences, advice).
// A tab click overrides that until the selection changes.

import {
  adviceText, avoidReasonText, cadenceText, critiqueName, critiqueText, functionText, ghostReasonText, guideToneText,
  noteOverChordText, reasonText, tierText,
} from '../theory/adviceText.js';
import { noteFit, noteTier } from '../theory/melodyFit.js';
import { chordPalette } from '../theory/analysis.js';
import { CHORD_QUALITIES, buildChord } from '../theory/chords.js';
import { LETTERS, prettyName } from '../theory/notes.js';
import { sameAddress } from '../theory/progression.js';
import { textFor } from '../theory/text/index.js';
import { h, prettySymbol, prettyText } from './dom.js';
import { displayName } from './highlight.js';
import { ui } from './strings.js';

const TIER_ORDER = ['chord', 'scale', 'parent', 'blue', 'avoid'];
const ACCIDENTALS = [{ acc: -1, label: '♭' }, { acc: 0, label: '♮' }, { acc: 1, label: '♯' }];
const QUALITY_LABELS = {
  dim: 'dim', aug: 'aug', maj7: 'maj7', dom7: '7', min7: 'm7', m7b5: 'm7♭5', dim7: 'dim7', mMaj7: 'm(maj7)',
};

const octaveOf = (midi) => Math.floor(midi / 12) - 1;

export function createComposerPanel(container, { onPickChord, onNextChord, onSelectNote, onPlaceGhost }) {
  // View-only UI state: which picker tab is shown and whether the picker is open.
  let activeTab = 'diatonic';
  let pickerOpen = false;
  let custom = { letter: 'C', acc: 0, quality: 'maj' };
  let tab = 'piece';
  let lastSelection = null; // the selected slot the tab last followed

  function picker(state, slot) {
    const { lang } = state;
    const text = ui(lang).composer;
    const qualityLabels = { ...QUALITY_LABELS, maj: text.major, min: text.minor };
    const palette = chordPalette(state.key);
    const tabs = [...palette.map((g) => ({ id: g.id, title: textFor(lang).paletteTitles[g.id] })), { id: 'custom', title: text.custom }];
    const addr = { bar: slot.bar, half: slot.half };
    const pickButton = ({ chord, roman }) => h('button', {
      type: 'button',
      class: 'pick',
      'data-id': `pick-${chord.symbol}`,
      'aria-pressed': String(slot.chord?.symbol === chord.symbol),
      onclick: () => onPickChord(addr, chord),
    }, h('span', { class: 'pick-symbol' }, prettySymbol(chord, lang)), h('span', { class: 'pick-roman' }, prettyText(roman)));

    let body;
    if (activeTab === 'custom') {
      const select = (name, options, value, onchange) => h('select', { name, 'aria-label': name, onchange },
        options.map((o) => {
          const option = h('option', { value: String(o.value) }, o.label);
          option.selected = String(o.value) === String(value);
          return option;
        }));
      body = h('div', { class: 'custom-picker' },
        select(text.rootLetter, LETTERS.map((l) => ({ value: l, label: l })), custom.letter, (e) => { custom.letter = e.target.value; }),
        select(text.accidental, ACCIDENTALS.map((a) => ({ value: a.acc, label: a.label })), custom.acc, (e) => { custom.acc = Number(e.target.value); }),
        select(text.quality, Object.keys(CHORD_QUALITIES).map((q) => ({ value: q, label: qualityLabels[q] })), custom.quality, (e) => { custom.quality = e.target.value; }),
        h('button', {
          type: 'button',
          class: 'btn',
          'data-id': 'custom-set',
          onclick: () => onPickChord(addr, buildChord({ letter: custom.letter, acc: custom.acc }, custom.quality)),
        }, text.setChord));
    } else {
      body = h('div', { class: 'pick-grid' }, palette.find((g) => g.id === activeTab).chords.map(pickButton));
    }

    const details = h('details', { class: 'picker', open: !slot.chord || pickerOpen },
      h('summary', {}, slot.chord ? text.change : text.choose),
      h('div', { class: 'tabs', role: 'tablist' }, tabs.map((t) => h('button', {
        type: 'button',
        role: 'tab',
        class: 'tab',
        'data-id': `tab-${t.id}`,
        'aria-selected': String(t.id === activeTab),
        onclick: () => { activeTab = t.id; pickerOpen = true; render(state); },
      }, t.title))),
      body,
      slot.chord && h('button', { type: 'button', class: 'btn subtle', 'data-id': 'remove', onclick: () => onPickChord(addr, null) }, text.remove));
    details.addEventListener('toggle', () => { if (slot.chord) pickerOpen = details.open; });
    return details;
  }

  function notesSection(state) {
    const { focus, level, lang } = state;
    const text = ui(lang).composer;
    const groups = TIER_ORDER
      .map((tier) => ({ tier, notes: focus.notes.filter((info) => info.tier === tier) }))
      .filter((g) => g.notes.length);
    const selected = state.selected && focus.notes[state.selected.pc];
    return h('section', { class: 'over-chord' },
      h('h3', {}, text.overChord(prettySymbol(focus.chord, lang))),
      groups.map(({ tier, notes }) => h('div', { class: 'tier', 'data-tier': tier },
        h('h4', {}, h('span', { class: `swatch swatch-${tier}` }), tierText(tier, level, lang)),
        h('ul', { class: 'note-chips' }, notes.map((info) => h('li', {
          class: 'note-chip',
          title: tier === 'avoid' ? prettyText(avoidReasonText(info, level, lang)) : false,
        }, h('b', {}, prettyName(info.note, lang)), ' ', h('span', {}, prettyText(info.label))))))),
      selected && h('p', { class: 'note-line' },
        prettyText(noteOverChordText(selected, focus.chord, level, lang)),
        selected.tier === 'avoid' && ` (${prettyText(avoidReasonText(selected, level, lang))})`),
      focus.guideTones.length > 0 && h('div', { class: 'guide' },
        h('h4', {}, h('span', { class: 'swatch swatch-guide' }), text.into(prettySymbol(focus.nextChord, lang))),
        h('ul', {}, focus.guideTones.map((move) => h('li', {}, prettyText(guideToneText(move, focus.chord, focus.nextChord, level, lang)))))));
  }

  function nextSection(state) {
    const { focus, level, lang } = state;
    const text = ui(lang).composer;
    if (!focus.next.length) return null;
    return h('section', { class: 'next' },
      h('h3', {}, focus.chord ? text.next : text.ideas),
      h('div', { class: 'pick-grid' }, focus.next.map((option) => h('button', {
        type: 'button',
        class: 'pick next-pick',
        'data-id': `next-${option.symbol}`,
        onclick: () => onNextChord(option.chord, focus),
      },
      h('span', { class: 'pick-symbol' }, prettySymbol(option.chord, lang)),
      h('span', { class: 'pick-roman' }, prettyText(option.roman)),
      h('span', { class: 'pick-reason' }, reasonText(option.reason, level, lang))))));
  }

  function aboutSection(state) {
    const { analysis, slots, level, lang } = state;
    const lines = [
      ...analysis.cadences.map((c) => ({ text: cadenceText(c, slots, level, lang), kind: 'cadence' })),
      ...analysis.advice.map((a) => ({ text: adviceText(a, level, lang), kind: 'advice' })),
    ];
    if (!lines.length) return null;
    return h('section', { class: 'about' },
      h('h3', {}, ui(lang).composer.about),
      h('ul', { class: 'advice' }, lines.map((l) => h('li', { 'data-kind': l.kind }, prettyText(l.text)))));
  }

  const show = (...sections) => container.replaceChildren(...sections.filter(Boolean));

  function tabBar(state) {
    const text = ui(state.lang).composer;
    return h('div', { class: 'tabs panel-tabs', role: 'tablist', 'aria-label': text.tabsAria },
      Object.entries(text.tabs).map(([id, title]) => h('button', {
        type: 'button',
        role: 'tab',
        class: 'tab',
        'data-id': `panel-tab-${id}`,
        'aria-selected': String(id === tab),
        onclick: () => { tab = id; render(state); },
      }, title)));
  }

  function chordTab(state) {
    const { focus, level, lang } = state;
    const text = ui(lang).composer;
    if (!focus) {
      const hasChords = state.slots.some((s) => s.chord);
      return [
        h('h2', {}, text.chordTitle),
        h('p', { class: 'hint' }, hasChords ? text.hintWithChords : text.hintEmpty),
      ];
    }
    const { slot, chord, analysis } = focus;
    const where = slot.beats === 2 ? text.barHalf(slot.bar + 1, slot.half) : text.bar(slot.bar + 1);
    const editable = sameAddress(state.selectedSlot, slot);
    return [
      h('h2', {},
        chord ? h('span', { class: 'note-badge chord-badge' }, prettySymbol(chord, lang)) : text.empty,
        analysis && h('span', { class: 'chord-roman' }, prettyText(analysis.roman)),
        analysis?.function && h('span', { class: 'tag function-tag', 'data-function': analysis.function }, textFor(lang).functionNames[analysis.function]),
        h('span', { class: 'bar-label' }, where)),
      analysis && h('p', { class: 'function-text' }, prettyText(functionText(analysis, state.key, level, lang))),
      editable && picker(state, slot),
      chord && notesSection(state),
      nextSection(state),
    ];
  }

  /** One critique item as a list entry; clicking it selects the note on the roll. */
  function remarkItem(state, item, { withBar = false } = {}) {
    const { level, lang } = state;
    const note = state.melody.notes[item.noteIndex];
    return h('li', { 'data-rule': item.rule },
      h('button', {
        type: 'button',
        class: 'remark',
        'data-id': `remark-${item.noteIndex}-${item.rule}`,
        onclick: () => onSelectNote({ lane: 'melody', start: note.start }),
      },
      h('span', { class: 'remark-name' }, critiqueName(item.rule, level, lang)),
      withBar && h('span', { class: 'remark-where' }, ui(lang).composer.remarkAt(item.data.bar)),
      h('span', { class: 'remark-text' }, prettyText(critiqueText(item, level, lang)))));
  }

  /** The next-note ideas as buttons; clicking one places that note. */
  function ghostSection(state) {
    const { level, lang, ghosts } = state;
    const text = ui(lang).composer;
    if (ghosts.lane !== 'melody' || !ghosts.ghosts.length) return null;
    const bar = Math.floor(ghosts.tick / 48) + 1;
    return h('section', { class: 'ghost-ideas' },
      h('h3', {}, text.nextNotes(bar)),
      h('div', { class: 'pick-grid' }, ghosts.ghosts.map((ghost) => h('button', {
        type: 'button',
        class: 'pick ghost-pick',
        'data-id': `ghost-${ghost.midi}`,
        'data-reason': ghost.reason,
        onclick: () => onPlaceGhost(ghost),
      },
      h('span', { class: 'pick-symbol' }, `${displayName(state, ghost.midi % 12)}${octaveOf(ghost.midi)}`),
      h('span', { class: 'pick-reason' }, ghostReasonText(ghost.reason, level, lang))))));
  }

  function melodyTab(state) {
    const { level, lang, selectedNote } = state;
    const text = ui(lang).composer;
    const index = selectedNote?.lane === 'melody' ? state.melody.notes.findIndex((n) => n.start === selectedNote.start) : -1;
    if (index < 0) return [h('h2', {}, text.melodyTitle), h('p', { class: 'hint' }, text.hintMelody), ghostSection(state)];
    const note = state.melody.notes[index];
    const entry = state.melodyFit[index];
    const tier = noteTier(entry);
    const first = entry.segments.find((s) => s.chord) ?? entry.segments[0];
    const name = `${prettyName(first.note, lang)}${octaveOf(note.midi)}`;
    const bar = Math.floor(note.start / 48) + 1;
    const remarks = state.critique.filter((it) => it.noteIndex === index);
    const fit = noteFit(entry);
    return [
      h('h2', {},
        h('span', { class: `note-badge tier-badge`, 'data-tier': tier }, name),
        h('span', { class: 'bar-label' }, text.noteHead(name, bar).replace(`${name}, `, ''))),
      h('p', { class: 'note-line', 'data-fit': fit == null ? false : fit.toFixed(2) },
        first.chord
          ? [prettyText(noteOverChordText({ ...first, note: first.note }, first.chord, level, lang)),
            first.tier === 'avoid' && first.reason && ` (${prettyText(avoidReasonText(first, level, lang))})`]
          : text.noteOverNothing(name)),
      h('section', { class: 'remarks' },
        h('h3', {}, text.remarks),
        remarks.length
          ? h('ul', { class: 'remark-list' }, remarks.map((it) => remarkItem(state, it)))
          : h('p', { class: 'hint' }, text.noRemarks)),
      ghostSection(state),
    ];
  }

  function remarksSection(state) {
    const text = ui(state.lang).composer;
    if (!state.melody.notes.length) return null;
    return h('section', { class: 'remarks' },
      h('h3', {}, text.pieceRemarks),
      state.critique.length
        ? h('ul', { class: 'remark-list' }, state.critique.map((it) => remarkItem(state, it, { withBar: true })))
        : h('p', { class: 'hint' }, text.allGood));
  }

  function pieceTab(state) {
    const text = ui(state.lang).composer;
    const about = aboutSection(state);
    const remarks = remarksSection(state);
    return [
      h('h2', {}, text.pieceTitle),
      remarks,
      about ?? (remarks ? null : h('p', { class: 'hint' }, text.hintPiece)),
    ];
  }

  const TABS = { chord: chordTab, melody: melodyTab, piece: pieceTab };

  /** The tab follows the selection: a note shows Melody, a bar shows Chord, nothing shows Piece. */
  function draw(state) {
    const { selectedNote: note, selectedSlot: slot } = state;
    const selection = note ? `note-${note.lane}-${note.start}` : slot ? `slot-${slot.bar}-${slot.half}` : null;
    if (selection !== lastSelection) {
      tab = note ? 'melody' : slot ? 'chord' : 'piece';
      lastSelection = selection;
    }
    show(tabBar(state), ...TABS[tab](state));
  }

  function render(state) {
    const focusedId = container.contains(document.activeElement) ? document.activeElement.dataset.id : null;
    draw(state);
    if (focusedId) container.querySelector(`[data-id="${CSS.escape(focusedId)}"]`)?.focus();
  }

  return { render };
}
