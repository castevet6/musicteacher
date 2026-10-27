// Shared highlight logic for the instrument views. Each clickable position is
// an element with data-pc / data-midi, a .label text and a .role text.

import { defaultSpelling, pcOf, prettyName } from '../theory/notes.js';

/** The name to show for `pc`, using the most specific context available. */
export function displayName(state, pc) {
  const { key, activeChord, suggestions } = state;
  const tone = activeChord?.tones.find((t) => pcOf(t.note) === pc);
  if (tone) return prettyName(tone.note);
  const scaleNote = key.scaleNotes.find((note) => pcOf(note) === pc);
  if (scaleNote) return prettyName(scaleNote);
  if (suggestions?.pc === pc) return prettyName(suggestions.note);
  return prettyName(defaultSpelling(pc, key.accidentals));
}

export function applyHighlights(positions, state) {
  const { key, selected, activeChord } = state;
  const roles = new Map(activeChord?.tones.map((t) => [pcOf(t.note), t.role]) ?? []);
  const names = Array.from({ length: 12 }, (_, pc) => displayName(state, pc));

  for (const el of positions) {
    const pc = Number(el.dataset.pc);
    const midi = Number(el.dataset.midi);
    const isSelectedPc = selected?.pc === pc;
    const role = roles.get(pc);
    const cl = el.classList;

    cl.toggle('in-scale', key.scalePcs.has(pc));
    cl.toggle('root', pc === key.rootPc);
    cl.toggle('blue-note', pc === key.blueNotePc);
    cl.toggle('selected', isSelectedPc && selected.midi === midi);
    cl.toggle('selected-pc', isSelectedPc && selected.midi !== midi);
    cl.toggle('out-of-scale', isSelectedPc && !key.scalePcs.has(pc));
    cl.toggle('chord-tone', role !== undefined);
    cl.toggle('muted', Boolean(activeChord) && role === undefined);

    el.querySelector('.label').textContent = names[pc];
    el.querySelector('.role').textContent = role ?? '';
    el.setAttribute('aria-label', names[pc]);
  }
}

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl(tag, attrs = {}, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  parent?.appendChild(el);
  return el;
}

/** A focusable note position: optional hit shape, dot, note label, role label. */
export function notePosition(parent, { midi, cx, cy, r, className = '' }) {
  const g = svgEl('g', {
    class: `pos ${className}`.trim(),
    'data-midi': midi,
    'data-pc': midi % 12,
    tabindex: 0,
    role: 'button',
  }, parent);
  const hit = svgEl('g', { class: 'hit' }, g);
  svgEl('circle', { class: 'dot', cx, cy, r }, g);
  svgEl('text', { class: 'label', x: cx, y: cy, 'font-size': Math.round(r * 0.85) }, g);
  svgEl('text', { class: 'role', x: cx + r * 0.65, y: cy - r * 0.65 }, g);
  return { g, hit };
}

/** One delegated click listener: finds the clicked position and reports it. */
export function onPositionClick(svg, handler) {
  svg.addEventListener('click', (event) => {
    const pos = event.target.closest('[data-midi]');
    if (pos) handler({ pc: Number(pos.dataset.pc), midi: Number(pos.dataset.midi) });
  });
  svg.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const pos = event.target.closest('[data-midi]');
    if (!pos) return;
    event.preventDefault();
    handler({ pc: Number(pos.dataset.pc), midi: Number(pos.dataset.midi) });
  });
}
