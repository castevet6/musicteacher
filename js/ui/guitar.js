import { applyHighlights, notePosition, onPositionClick, svgEl } from './highlight.js';

const STRINGS = [64, 59, 55, 50, 45, 40]; // high e on top, as in tab
const FRETS = 15;
const OPEN_WIDTH = 50;
const STRING_GAP = 36;
const TOP = 26;
const MIN_FRET_WIDTH = 40;
const MIN_NECK_WIDTH = 880;
const MARKERS = [3, 5, 7, 9, 15];

/** Equal-tempered fret widths, scaled to fill `neckWidth`, never narrower than a note dot. */
function fretWidths(neckWidth) {
  const raw = Array.from({ length: FRETS }, (_, i) => 2 ** (-i / 12) - 2 ** (-(i + 1) / 12));
  const scale = neckWidth / raw.reduce((a, b) => a + b, 0);
  return raw.map((w) => Math.max(MIN_FRET_WIDTH, w * scale));
}

export function createGuitar(container, { onNoteClick }) {
  const scroller = document.createElement('div');
  scroller.className = 'instrument-scroll';
  container.appendChild(scroller);

  let svg = null;
  let lastState = null;

  function build() {
    const available = Math.max(MIN_NECK_WIDTH, scroller.clientWidth || MIN_NECK_WIDTH);
    const widths = fretWidths(available - OPEN_WIDTH - 4);
    const fretX = [OPEN_WIDTH]; // fretX[n] = x of the wire at the end of fret n
    for (const w of widths) fretX.push(fretX.at(-1) + w);
    const width = Math.ceil(fretX.at(-1) + 4);
    const bottom = TOP + (STRINGS.length - 1) * STRING_GAP;
    const height = bottom + 44;
    const stringY = (s) => TOP + s * STRING_GAP;

    const next = svgEl('svg', {
      class: 'guitar',
      viewBox: `0 0 ${width} ${height}`,
      width,
      height,
      role: 'group',
      'aria-label': 'Guitar fretboard',
    });

    svgEl('rect', { class: 'fretboard', x: OPEN_WIDTH, y: TOP - 14, width: fretX.at(-1) - OPEN_WIDTH, height: bottom - TOP + 28 }, next);

    const midY = (TOP + bottom) / 2;
    for (let fret = 1; fret <= FRETS; fret++) {
      const cx = (fretX[fret - 1] + fretX[fret]) / 2;
      if (MARKERS.includes(fret)) svgEl('circle', { class: 'inlay', cx, cy: midY, r: 7 }, next);
      if (fret === 12) {
        svgEl('circle', { class: 'inlay', cx, cy: stringY(1.5), r: 7 }, next);
        svgEl('circle', { class: 'inlay', cx, cy: stringY(3.5), r: 7 }, next);
      }
      svgEl('line', { class: 'fret', x1: fretX[fret], x2: fretX[fret], y1: TOP - 14, y2: bottom + 14 }, next);
      svgEl('text', { class: 'fret-number', x: cx, y: bottom + 34 }, next).textContent = fret;
    }
    svgEl('line', { class: 'nut', x1: OPEN_WIDTH, x2: OPEN_WIDTH, y1: TOP - 14, y2: bottom + 14 }, next);

    STRINGS.forEach((_, s) => {
      svgEl('line', {
        class: 'string', x1: 4, x2: fretX.at(-1), y1: stringY(s), y2: stringY(s), 'stroke-width': 1 + s * 0.4,
      }, next);
    });

    const r = Math.min(14, STRING_GAP * 0.4);
    STRINGS.forEach((openMidi, s) => {
      for (let fret = 0; fret <= FRETS; fret++) {
        const x0 = fret === 0 ? 0 : fretX[fret - 1];
        const x1 = fret === 0 ? OPEN_WIDTH : fretX[fret];
        const { hit } = notePosition(next, {
          midi: openMidi + fret,
          cx: (x0 + x1) / 2,
          cy: stringY(s),
          r,
          className: fret === 0 ? 'fretpos open' : 'fretpos',
        });
        svgEl('rect', { class: 'hit-area', x: x0, y: stringY(s) - STRING_GAP / 2, width: x1 - x0, height: STRING_GAP }, hit);
      }
    });

    onPositionClick(next, onNoteClick);
    if (svg) svg.replaceWith(next);
    else scroller.appendChild(next);
    svg = next;
    if (lastState) render(lastState);
  }

  function render(state) {
    lastState = state;
    applyHighlights(svg.querySelectorAll('.pos'), state);
  }

  let lastWidth = 0;
  new ResizeObserver(() => {
    const width = scroller.clientWidth;
    if (width === 0 || Math.abs(width - lastWidth) < 8) return;
    lastWidth = width;
    build();
  }).observe(scroller);

  build();

  return {
    render,
    show(visible) {
      container.hidden = !visible;
    },
  };
}
