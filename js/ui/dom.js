// Small DOM helpers shared by the panels.

import { chordLabel } from '../theory/chords.js';

/** Small DOM builder: h('span', { class: 'x' }, 'text', childEl). */
export function h(tag, props = {}, ...children) {
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

export const prettySymbol = chordLabel;
