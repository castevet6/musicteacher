// The composition model behind Composer: time in ticks, monophonic lanes of
// absolute MIDI notes (melody, bass), the span each chord slot covers, and the
// JSON file a composition is saved as. Pure data; nothing here knows the DOM.

import { CHORD_QUALITIES } from './chords.js';
import { LETTERS } from './notes.js';
import { MAX_BARS } from './progression.js';
import { SCALES } from './scales.js';

// Twelve ticks per beat leave room for triplets later without renumbering.
export const TICKS_PER_BEAT = 12;
export const TICKS_PER_BAR = 4 * TICKS_PER_BEAT;
export const GRIDS = [4, 8, 16];
export const STYLES = ['pop', 'jazz', 'folk'];
export const FILE_VERSION = 1;

/** Ticks in one cell of the grid: a quarter (12), an eighth (6) or a sixteenth (3). */
export const gridTicks = (grid) => TICKS_PER_BAR / grid;

export const emptyLane = () => ({ notes: [] });

const byStart = (a, b) => a.start - b.start;
const overlaps = (a, b) => a.start < b.start + b.length && b.start < a.start + a.length;

/** A lane with `note` added. Notes it overlaps are removed: a lane is monophonic. */
export function addNote(lane, note) {
  const length = Math.max(1, Math.round(note.length));
  const next = { start: Math.max(0, Math.round(note.start)), length, midi: note.midi };
  return { notes: [...lane.notes.filter((n) => !overlaps(n, next)), next].sort(byStart) };
}

export function removeNote(lane, start) {
  return { notes: lane.notes.filter((n) => n.start !== start) };
}

/** The note at `tick`, or null between notes. */
export function noteAt(lane, tick) {
  return lane.notes.find((n) => n.start <= tick && tick < n.start + n.length) ?? null;
}

/**
 * The note starting at `start` resized to `length` ticks, clamped between one
 * tick and the start of the next note or the end of bar `barCount`.
 */
export function resizeNote(lane, start, length, barCount) {
  const index = lane.notes.findIndex((n) => n.start === start);
  if (index < 0) return lane;
  const next = lane.notes[index + 1];
  const limit = (next ? next.start : barCount * TICKS_PER_BAR) - start;
  const clamped = Math.max(1, Math.min(limit, Math.round(length)));
  return { notes: lane.notes.map((n, i) => (i === index ? { ...n, length: clamped } : n)) };
}

/** Drop notes that start at or past the end of bar `barCount`, trim notes that cross it. */
export function clampLane(lane, barCount) {
  const end = barCount * TICKS_PER_BAR;
  return {
    notes: lane.notes
      .filter((n) => n.start < end)
      .map((n) => (n.start + n.length > end ? { ...n, length: end - n.start } : n)),
  };
}

export function transposeLane(lane, semis) {
  return { notes: lane.notes.map((n) => ({ ...n, midi: n.midi + semis })) };
}

/** The notes of `lane` that start inside `[start, start + length)`, in order. */
export const notesStarting = (lane, start, length) =>
  lane.notes.filter((n) => n.start >= start && n.start < start + length);

/** The shortest signed way from pitch class `from` to `to`, in semitones from -6 to 5. */
export function transposeDistance(from, to) {
  const up = (((to - from) % 12) + 12) % 12;
  return up >= 6 ? up - 12 : up;
}

// ---------- Mix ----------

export const LANES = ['chords', 'melody', 'bass'];
export const MIX_STATES = ['on', 'mute', 'solo'];

export const defaultMix = () => ({ chords: 'on', melody: 'on', bass: 'on' });

/** Whether `lane` sounds: a solo on any lane silences the rest, otherwise mute decides. */
export function isAudible(mix, lane) {
  const anySolo = Object.values(mix).includes('solo');
  return anySolo ? mix[lane] === 'solo' : mix[lane] !== 'mute';
}

/** Press mute or solo on `lane`: pressing the active one again returns the lane to 'on'. */
export const toggleMix = (mix, lane, mode) => ({ ...mix, [lane]: mix[lane] === mode ? 'on' : mode });

/** The ticks a slot from flattenSlots() covers: `{ start, length }`. */
export function slotSpan(slot) {
  const half = slot.half * (TICKS_PER_BAR / 2);
  return { start: slot.bar * TICKS_PER_BAR + half, length: slot.beats * TICKS_PER_BEAT };
}

/** The slot in force at `tick`, or null past the last bar. */
export function slotAtTick(slots, tick) {
  return slots.find((slot) => {
    const { start, length } = slotSpan(slot);
    return start <= tick && tick < start + length;
  }) ?? null;
}

/** The chord in force at `tick`: null in an empty slot or past the end. */
export const chordAtTick = (slots, tick) => slotAtTick(slots, tick)?.chord ?? null;

/**
 * `note` cut at slot boundaries: `[{ start, length, slot }]`, where `slot` is
 * null for any part that lies past the last bar.
 */
export function segments(slots, note) {
  const pieces = [];
  let tick = note.start;
  const end = note.start + note.length;
  while (tick < end) {
    const slot = slotAtTick(slots, tick);
    const slotEnd = slot ? slotSpan(slot).start + slotSpan(slot).length : end;
    const stop = Math.min(end, slotEnd);
    pieces.push({ start: tick, length: stop - tick, slot });
    tick = stop;
  }
  return pieces;
}

/** How much a tick position counts: beat 1 → 3, beat 3 → 2, beats 2 and 4 → 1, off the beat → 0.5. */
export function beatWeight(tick) {
  const inBar = tick % TICKS_PER_BAR;
  if (inBar % TICKS_PER_BEAT !== 0) return 0.5;
  const beat = inBar / TICKS_PER_BEAT;
  return beat === 0 ? 3 : beat === 2 ? 2 : 1;
}

/** `beatWeight` times length: the weight of one segment of a note. */
export const segmentWeight = (segment) => beatWeight(segment.start) * segment.length;

// ---------- Files ----------

/** The plain object saved as a composition file. */
export function serializeComposition({ title, key, style, playback, progression, melody, bass }) {
  return {
    version: FILE_VERSION,
    title,
    rootPc: key.rootPc,
    scaleId: key.scaleId,
    tonicLetter: key.tonic.letter,
    style,
    bpm: playback.bpm,
    progression: { bars: progression.bars.map((bar) => ({ chords: bar.chords.map((c) => (c ? { ...c } : null)) })) },
    melody: { notes: melody.notes.map((n) => ({ ...n })) },
    bass: { notes: bass.notes.map((n) => ({ ...n })) },
  };
}

/** "my-song.json" from a title; an empty title gives "composition.json". */
export function fileName(title) {
  const slug = String(title ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug || 'composition'}.json`;
}

export class CompositionError extends Error {
  constructor(code, path = '') {
    super(path ? `Invalid composition: ${code} at ${path}` : `Invalid composition: ${code}`);
    this.name = 'CompositionError';
    this.code = code; // 'not-json' | 'version' | 'field'
    this.path = path;
  }
}

const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const fail = (path) => { throw new CompositionError('field', path); };
const expect = (ok, path) => { if (!ok) fail(path); };

function parseLane(raw, path, barCount) {
  expect(raw && typeof raw === 'object' && Array.isArray(raw.notes), path);
  const end = barCount * TICKS_PER_BAR;
  const notes = raw.notes.map((n, i) => {
    const at = `${path}.notes[${i}]`;
    expect(n && typeof n === 'object', at);
    expect(isInt(n.start, 0, end - 1), `${at}.start`);
    expect(isInt(n.length, 1, end - n.start), `${at}.length`);
    expect(isInt(n.midi, 0, 127), `${at}.midi`);
    return { start: n.start, length: n.length, midi: n.midi };
  }).sort(byStart);
  notes.forEach((n, i) => {
    if (i > 0 && overlaps(notes[i - 1], n)) fail(`${path}.notes[${i}]`);
  });
  return { notes };
}

function parseProgression(raw) {
  expect(raw && typeof raw === 'object' && Array.isArray(raw.bars), 'progression');
  expect(raw.bars.length >= 1 && raw.bars.length <= MAX_BARS, 'progression.bars');
  return {
    bars: raw.bars.map((bar, b) => {
      const at = `progression.bars[${b}]`;
      expect(bar && typeof bar === 'object' && Array.isArray(bar.chords), at);
      expect(bar.chords.length === 1 || bar.chords.length === 2, `${at}.chords`);
      return {
        chords: bar.chords.map((c, h) => {
          if (c === null) return null;
          const here = `${at}.chords[${h}]`;
          expect(c && typeof c === 'object', here);
          expect(isInt(c.steps, 0, 6), `${here}.steps`);
          expect(isInt(c.semis, 0, 11), `${here}.semis`);
          expect(c.quality in CHORD_QUALITIES, `${here}.quality`);
          return { steps: c.steps, semis: c.semis, quality: c.quality };
        }),
      };
    }),
  };
}

/**
 * A composition from file text or an already parsed object. Throws a
 * CompositionError naming the first bad field; it never loads half a file.
 */
export function parseComposition(input) {
  let raw = input;
  if (typeof input === 'string') {
    try {
      raw = JSON.parse(input);
    } catch {
      throw new CompositionError('not-json');
    }
  }
  expect(raw && typeof raw === 'object', 'root');
  if (raw.version !== FILE_VERSION) throw new CompositionError('version', 'version');
  expect(typeof raw.title === 'string' && raw.title.length <= 120, 'title');
  expect(isInt(raw.rootPc, 0, 11), 'rootPc');
  expect(raw.scaleId in SCALES, 'scaleId');
  expect(raw.tonicLetter === null || LETTERS.includes(raw.tonicLetter), 'tonicLetter');
  expect(STYLES.includes(raw.style), 'style');
  expect(isInt(raw.bpm, 40, 200), 'bpm');
  const progression = parseProgression(raw.progression);
  const barCount = progression.bars.length;
  return {
    version: FILE_VERSION,
    title: raw.title,
    rootPc: raw.rootPc,
    scaleId: raw.scaleId,
    tonicLetter: raw.tonicLetter,
    style: raw.style,
    bpm: raw.bpm,
    progression,
    melody: parseLane(raw.melody, 'melody', barCount),
    bass: parseLane(raw.bass, 'bass', barCount),
  };
}
