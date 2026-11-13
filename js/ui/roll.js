// A piano roll for one lane (melody or bass): rows are pitches, columns are
// grid cells inside bars laid out at --bar-width, so the roll lines up with the
// chord strip above it in the same horizontal scroller. Click a cell to add a
// note, drag to lengthen it, click a note to select it, click again to delete.

import { TICKS_PER_BAR, TICKS_PER_BEAT, gridTicks, noteAt, slotSpan } from '../theory/composition.js';
import { h } from './dom.js';
import { critiqueText } from '../theory/adviceText.js';
import { noteTier } from '../theory/melodyFit.js';
import { SVG_NS, displayName, svgEl } from './highlight.js';
import { ui } from './strings.js';

const MIN_LABEL_WIDTH = 22;

const octaveOf = (midi) => Math.floor(midi / 12) - 1;

// The colour key under each roll's title: [swatch class, key in strings' legend].
const LEGENDS = {
  melody: [
    ['chord', 'chordTone'], ['scale', 'scaleTone'], ['parent', 'alsoFits'], ['blue', 'blueNote'],
    ['avoid', 'avoid'], ['out', 'outOfScale'], ['ghost', 'ghost'], ['sounding', 'playing'],
  ],
  bass: [
    ['root', 'chordRoot'], ['fifth', 'bassFifth'], ['chord', 'chordTone'], ['scale', 'scaleTone'],
    ['parent', 'alsoFits'], ['blue', 'blueNote'], ['avoid', 'avoid'], ['out', 'outOfScale'],
    ['ghost', 'ghost'], ['sounding', 'playing'],
  ],
};

export function createRoll(container, handlers) {
  const { lane, range, center = 60, onAdd, onRemove, onResize, onSelect, onAudition, onClear, onToggleMap, currentTick } = handlers;

  container.classList.add('roll');
  container.dataset.lane = lane;
  const head = h('div', { class: 'roll-head' },
    h('span', { class: 'roll-title' }),
    h('span', { class: 'roll-hint' }),
    h('button', { type: 'button', class: 'btn subtle roll-map', 'aria-pressed': 'true', onclick: onToggleMap }),
    h('button', { type: 'button', class: 'btn subtle roll-clear', onclick: onClear }),
    h('ul', { class: 'legend roll-legend' }, LEGENDS[lane].map(([swatch, key]) =>
      h('li', { 'data-key': key }, h('span', { class: `swatch swatch-${swatch}` }), h('span', { class: 'legend-text' })))));
  const labels = h('div', { class: 'roll-labels' });
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('roll-svg');
  svg.setAttribute('tabindex', '0'); // so Delete and Backspace reach the selected note
  const body = h('div', { class: 'roll-body' }, labels, svg);
  container.append(head, body);

  // The head is sticky in the timeline; the labels sit inside the vertical
  // scroller, so they follow the sideways scroll by hand.
  const scroller = container.closest('.timeline');
  scroller?.addEventListener('scroll', () => {
    labels.style.transform = `translateX(${scroller.scrollLeft}px)`;
  }, { passive: true });
  const fitHead = () => { if (scroller) head.style.width = `${scroller.clientWidth}px`; };
  window.addEventListener('resize', fitHead);

  let geometry = null; // { barW, gap, rowH, low, high, bars }
  let lastState = null;
  let scrolledTo = null;
  let drag = null;
  let playhead = null; // the SVG line, redrawn with the grid
  let frame = 0; // requestAnimationFrame id while playing

  function measure(state) {
    const css = getComputedStyle(container);
    const barW = parseFloat(css.getPropertyValue('--bar-width')) || 150;
    const gap = parseFloat(css.getPropertyValue('--bar-gap')) || 8;
    const rowH = parseFloat(css.getPropertyValue('--roll-row')) || 16;
    const [rangeLow, rangeHigh] = range(state);
    const midis = state[lane].notes.map((n) => n.midi);
    const low = Math.min(rangeLow, ...midis);
    const high = Math.max(rangeHigh, ...midis);
    return { barW, gap, rowH, low, high, rangeLow, rangeHigh, bars: state.progression.bars.length };
  }

  const xOf = (tick) => {
    const { barW, gap } = geometry;
    const bar = Math.floor(tick / TICKS_PER_BAR);
    return bar * (barW + gap) + ((tick % TICKS_PER_BAR) / TICKS_PER_BAR) * barW;
  };
  /** The x where a note ending at `tick` stops: a bar's end, not the start of the next bar. */
  const xEnd = (tick) => (tick > 0 && tick % TICKS_PER_BAR === 0 ? xOf(tick - TICKS_PER_BAR) + geometry.barW : xOf(tick));
  const yOf = (midi) => (geometry.high - midi) * geometry.rowH;

  /** The tick and midi under a pointer event, or null outside the bars. */
  function locate(event) {
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const { barW, gap, rowH, bars, high, low } = geometry;
    const bar = Math.min(bars - 1, Math.max(0, Math.floor(x / (barW + gap))));
    const within = Math.min(barW, Math.max(0, x - bar * (barW + gap)));
    const tick = bar * TICKS_PER_BAR + (within / barW) * TICKS_PER_BAR;
    const midi = high - Math.floor(y / rowH);
    if (midi < low || midi > high) return null;
    return { tick, midi };
  }

  const snap = (tick, grid) => Math.floor(tick / gridTicks(grid)) * gridTicks(grid);

  let gesture = 0;
  const gestureTag = () => `roll:${lane}:${gesture}`;

  svg.addEventListener('pointerdown', (event) => {
    if (!lastState || event.button !== 0) return;
    const at = locate(event);
    if (!at) return;
    const step = gridTicks(lastState.grid);
    const under = noteAt(lastState[lane], at.tick);
    const existing = under && under.midi === at.midi ? under : null; // another row means a new note
    svg.setPointerCapture(event.pointerId);
    svg.focus({ preventScroll: true });
    gesture += 1; // one press-drag-release: its add and resizes undo together
    if (existing) {
      drag = { start: existing.start, length: existing.length, existing: true, moved: false };
    } else {
      const start = Math.min(snap(at.tick, lastState.grid), geometry.bars * TICKS_PER_BAR - step);
      onAdd({ start, length: step, midi: at.midi }, gestureTag());
      onAudition(at.midi);
      drag = { start, length: step, existing: false, moved: false };
    }
    event.preventDefault();
  });

  svg.addEventListener('pointermove', (event) => {
    if (!drag || !lastState) return;
    const at = locate(event);
    if (!at) return;
    const step = gridTicks(lastState.grid);
    const length = Math.max(step, snap(at.tick, lastState.grid) + step - drag.start);
    if (length !== drag.length) {
      drag.length = length;
      drag.moved = true;
      onResize(drag.start, length, gestureTag());
    }
  });

  function endDrag() {
    if (!drag) return;
    const { start, existing, moved } = drag;
    drag = null;
    if (!existing || moved) return;
    const selected = lastState.selectedNote;
    if (selected && selected.lane === lane && selected.start === start) onRemove(start);
    else {
      onSelect(start);
      onAudition(noteAt(lastState[lane], start)?.midi);
    }
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', () => { drag = null; });

  function rowClass(state, midi) {
    const pc = midi % 12;
    const classes = [];
    if (midi < geometry.rangeLow || midi > geometry.rangeHigh) classes.push('out-of-range');
    else if (!state.key.scalePcs.has(pc)) classes.push('out');
    if (pc === state.key.rootPc) classes.push('tonic');
    if (state.selected?.midi === midi) classes.push('highlight');
    return classes.join(' ');
  }

  function drawLabels(state) {
    const rows = [];
    for (let midi = geometry.high; midi >= geometry.low; midi--) {
      rows.push(h('div', { class: `roll-label ${rowClass(state, midi)}`, 'data-midi': midi },
        `${displayName(state, midi % 12)}${octaveOf(midi)}`));
    }
    labels.replaceChildren(...rows);
  }

  function drawGrid(state) {
    const { barW, gap, rowH, low, high, bars } = geometry;
    const rows = high - low + 1;
    const width = bars * barW + (bars - 1) * gap;
    const height = rows * rowH;
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const frag = document.createDocumentFragment();

    const rowsG = svgEl('g', { class: 'rows' }, frag);
    for (let midi = high; midi >= low; midi--) {
      svgEl('rect', { class: `row ${rowClass(state, midi)}`, x: 0, y: yOf(midi), width, height: rowH, 'data-midi': midi }, rowsG);
    }

    // The fit map: one rect per row per filled slot, in the muted tier colour.
    // Empty slots show scale membership through the row shading alone. The bass
    // map also picks out each chord's root and fifth.
    const tiers = lane === 'bass' ? state.bassTiers : state.tiers;
    if (state.showMap) {
      const map = svgEl('g', { class: 'map' }, frag);
      state.slots.forEach((slot, i) => {
        if (!slot.chord) return;
        const span = slotSpan(slot);
        const x = xOf(span.start);
        const w = xEnd(span.start + span.length) - x;
        for (let midi = high; midi >= low; midi--) {
          const { tier } = tiers[i][midi % 12];
          svgEl('rect', { class: `cell tier-${tier}`, x, y: yOf(midi), width: w, height: rowH, 'data-tier': tier }, map);
        }
      });
    }

    const lines = svgEl('g', { class: 'lines' }, frag);
    const step = gridTicks(state.grid);
    for (let bar = 0; bar < bars; bar++) {
      const x0 = bar * (barW + gap);
      if (bar > 0) svgEl('rect', { class: 'bar-gap', x: x0 - gap, y: 0, width: gap, height }, lines);
      for (let tick = 0; tick <= TICKS_PER_BAR; tick += step) {
        const x = x0 + (tick / TICKS_PER_BAR) * barW;
        const kind = tick % TICKS_PER_BAR === 0 ? 'bar-line' : tick % TICKS_PER_BEAT === 0 ? 'beat-line' : 'cell-line';
        svgEl('line', { class: kind, x1: x, x2: x, y1: 0, y2: height }, lines);
      }
    }

    const notes = svgEl('g', { class: 'notes' }, frag);
    const selected = state.selectedNote;
    const sounding = state.playback.sounding[lane];
    const fits = new Map((state[`${lane}Fit`] ?? []).map((entry) => [entry.note.start, entry]));
    const remarksByStart = new Map();
    for (const item of (lane === 'melody' ? state.critique : state.bassCritique) ?? []) {
      const start = state[lane].notes[item.noteIndex]?.start;
      remarksByStart.set(start, [...(remarksByStart.get(start) ?? []), item]);
    }
    for (const note of state[lane].notes) {
      const x = xOf(note.start);
      const w = xEnd(note.start + note.length) - x;
      const isSelected = selected?.lane === lane && selected.start === note.start;
      const isSounding = sounding?.start === note.start;
      const fit = fits.get(note.start);
      const tier = fit && noteTier(fit);
      const remarks = remarksByStart.get(note.start) ?? [];
      const flagged = remarks.length ? ' flagged' : '';
      const classes = `note${isSelected ? ' selected' : ''}${isSounding ? ' sounding' : ''}${tier ? ` tier-${tier}` : ''}${flagged}`;
      const g = svgEl('g', {
        class: classes, 'data-start': note.start, 'data-tier': tier ?? false, 'data-rules': remarks.length ? remarks.map((it) => it.rule).join(' ') : false,
      }, notes);
      svgEl('rect', { class: 'note-body', x, y: yOf(note.midi) + 1, width: w, height: rowH - 2, rx: 3 }, g);
      // A note that crosses into another chord shows each piece in its own tier.
      if (fit && fit.segments.length > 1) {
        for (const seg of fit.segments) {
          const sx = xOf(seg.start);
          const sw = xEnd(seg.start + seg.length) - sx;
          svgEl('rect', { class: `note-piece tier-${seg.tier}`, x: sx, y: yOf(note.midi) + 1, width: sw, height: rowH - 2 }, g);
        }
      }
      if (w >= MIN_LABEL_WIDTH) {
        svgEl('text', { class: 'note-label', x: x + 4, y: yOf(note.midi) + rowH / 2 }, g)
          .textContent = displayName(state, note.midi % 12);
      }
      svgEl('rect', { class: 'note-handle', x: x + w - 5, y: yOf(note.midi) + 1, width: 5, height: rowH - 2 }, g);
      if (remarks.length) {
        // A small flag in the note's top-left corner; the panel has the words.
        const y0 = yOf(note.midi) + 1;
        svgEl('path', { class: 'marker', d: `M${x} ${y0} h7 l-7 7 z`, 'data-rule': remarks[0].rule }, g);
        svgEl('title', {}, g).textContent = remarks.map((it) => critiqueText(it, state.level, state.lang)).join(' ');
      }
    }

    // Ghosts: dashed next-note ideas after the selected or last note. They take
    // no pointer events, so clicking one is the ordinary click on that cell.
    const ghosts = state.ghosts;
    if (ghosts?.lane === lane && ghosts.ghosts.length) {
      const layer = svgEl('g', { class: 'ghosts' }, frag);
      const gx = xOf(ghosts.tick);
      const gw = xEnd(ghosts.tick + step) - gx;
      ghosts.ghosts.forEach((ghost, i) => {
        if (ghost.midi < low || ghost.midi > high) return;
        const g = svgEl('g', { class: 'ghost', 'data-midi': ghost.midi, 'data-reason': ghost.reason, 'data-rank': i + 1 }, layer);
        svgEl('rect', { class: 'ghost-body', x: gx + 1, y: yOf(ghost.midi) + 2, width: Math.max(4, gw - 2), height: rowH - 4, rx: 3 }, g);
        if (gw >= MIN_LABEL_WIDTH) {
          svgEl('text', { class: 'ghost-label', x: gx + 4, y: yOf(ghost.midi) + rowH / 2 }, g).textContent = displayName(state, ghost.midi % 12);
        }
      });
    }

    playhead = svgEl('line', { class: 'playhead', x1: 0, x2: 0, y1: 0, y2: height, visibility: 'hidden' }, frag);
    svg.replaceChildren(frag);
    movePlayhead();
  }

  /** Put the playhead line at the transport's tick, following it sideways when it leaves view. */
  function movePlayhead() {
    const tick = lastState?.playback.playing ? currentTick?.() : null;
    if (!playhead) return;
    if (tick == null) {
      playhead.setAttribute('visibility', 'hidden');
      return;
    }
    const x = xOf(tick);
    playhead.setAttribute('x1', x);
    playhead.setAttribute('x2', x);
    playhead.removeAttribute('visibility');
    if (scroller) {
      const gutter = labels.offsetWidth;
      const left = scroller.scrollLeft;
      const visible = scroller.clientWidth - gutter;
      if (x < left || x > left + visible - 2) scroller.scrollLeft = Math.max(0, x - 8);
    }
  }

  function animate() {
    movePlayhead();
    frame = requestAnimationFrame(animate);
  }

  function followPlayback(state) {
    if (state.playback.playing && !frame) frame = requestAnimationFrame(animate);
    if (!state.playback.playing && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }

  function scrollIntoView(state) {
    const key = `${geometry.low}-${geometry.high}-${state.instrument}`;
    if (scrolledTo === key) return;
    scrolledTo = key;
    body.scrollTop = Math.max(0, yOf(center) - body.clientHeight / 2);
  }

  return {
    render(state) {
      lastState = state;
      geometry = measure(state);
      fitHead();
      const text = ui(state.lang).roll;
      head.querySelector('.roll-title').textContent = text.lane[lane];
      head.querySelector('.roll-hint').textContent = text.hint[lane];
      const clear = head.querySelector('.roll-clear');
      clear.textContent = text.clear;
      clear.setAttribute('aria-label', text.clearLane(text.lane[lane]));
      clear.disabled = state[lane].notes.length === 0;
      const map = head.querySelector('.roll-map');
      map.textContent = text.map;
      map.setAttribute('aria-pressed', String(state.showMap));
      map.title = state.showMap ? text.hideMap : text.showMap;
      svg.setAttribute('aria-label', text.rollAria(text.lane[lane]));
      const legendText = ui(state.lang).legend;
      const legend = head.querySelector('.roll-legend');
      legend.setAttribute('aria-label', ui(state.lang).legendAria);
      for (const li of legend.children) li.lastChild.textContent = legendText[li.dataset.key];
      drawLabels(state);
      drawGrid(state);
      scrollIntoView(state);
      followPlayback(state);
    },
  };
}
