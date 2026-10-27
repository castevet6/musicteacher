import { applyHighlights, notePosition, onPositionClick, svgEl } from './highlight.js';

const FIRST_MIDI = 36; // C2
const LAST_MIDI = 83; // B5
const START_MIDI = 48; // C3, scrolled into view on load
const VISIBLE_WHITE_KEYS = 14; // two octaves
const HEIGHT = 180;
const BLACK_PCS = new Set([1, 3, 6, 8, 10]);

export function createPiano(container, { onNoteClick }) {
  const scroller = document.createElement('div');
  scroller.className = 'instrument-scroll';
  container.appendChild(scroller);

  let svg = null;
  let whiteWidth = 0;
  let lastState = null;

  function build() {
    const available = scroller.clientWidth || 600;
    whiteWidth = Math.max(30, Math.min(64, available / VISIBLE_WHITE_KEYS));
    const blackWidth = whiteWidth * 0.62;
    const blackHeight = HEIGHT * 0.62;

    const keys = [];
    let whiteIndex = 0;
    for (let midi = FIRST_MIDI; midi <= LAST_MIDI; midi++) {
      const black = BLACK_PCS.has(midi % 12);
      keys.push({ midi, black, x: black ? whiteIndex * whiteWidth - blackWidth / 2 : whiteIndex * whiteWidth });
      if (!black) whiteIndex++;
    }
    const width = whiteIndex * whiteWidth;

    const next = svgEl('svg', {
      class: 'piano',
      viewBox: `0 0 ${width} ${HEIGHT}`,
      width,
      height: HEIGHT,
      role: 'group',
      'aria-label': 'Piano keyboard',
    });

    // White keys first so black keys sit on top.
    for (const key of [...keys.filter((k) => !k.black), ...keys.filter((k) => k.black)]) {
      const w = key.black ? blackWidth : whiteWidth;
      const h = key.black ? blackHeight : HEIGHT;
      const r = Math.min(13, w * (key.black ? 0.42 : 0.34));
      const { hit } = notePosition(next, {
        midi: key.midi,
        cx: key.x + w / 2,
        cy: h - r - 8,
        r,
        className: key.black ? 'key black' : 'key white',
      });
      svgEl('rect', { class: 'key-body', x: key.x, y: 0, width: w, height: h, rx: 3 }, hit);
      if (key.midi % 12 === 0) {
        svgEl('text', { class: 'octave-label', x: key.x + 4, y: 14 }, next).textContent = `C${key.midi / 12 - 1}`;
      }
    }

    onPositionClick(next, onNoteClick);
    if (svg) svg.replaceWith(next);
    else scroller.appendChild(next);
    svg = next;
    if (lastState) render(lastState);
  }

  function scrollToStart() {
    const whiteKeysBefore = [...Array(START_MIDI - FIRST_MIDI).keys()]
      .filter((i) => !BLACK_PCS.has((FIRST_MIDI + i) % 12)).length;
    scroller.scrollLeft = whiteKeysBefore * whiteWidth;
  }

  function render(state) {
    lastState = state;
    applyHighlights(svg.querySelectorAll('.pos'), state);
  }

  // Rebuild when the visible width changes so two octaves always fit.
  // Width is 0 while hidden; the first real width scrolls to C3.
  let lastWidth = 0;
  new ResizeObserver(() => {
    const width = scroller.clientWidth;
    if (width === 0 || Math.abs(width - lastWidth) < 8) return;
    const scrolledKeys = lastWidth ? scroller.scrollLeft / whiteWidth : null;
    lastWidth = width;
    build();
    if (scrolledKeys === null) scrollToStart();
    else scroller.scrollLeft = scrolledKeys * whiteWidth;
  }).observe(scroller);

  build();

  return {
    render,
    show(visible) {
      container.hidden = !visible;
    },
  };
}
