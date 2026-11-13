// The bass lane: its range and the map behind the bass roll. The bass map is
// the melody map with the two notes a bass leans on most picked out: the chord
// root (tier `root`) and its fifth (tier `fifth`).

import { TICKS_PER_BAR, TICKS_PER_BEAT, addNote, noteAt, slotAtTick, slotSpan } from './composition.js';
import { cellTiers, emptySlotTiers, laneFit } from './melodyFit.js';
import { mod12, pcOf } from './notes.js';

/** The bass roll's range, E1 to G3, whatever the instrument. */
export const BASS_LOW = 28;
export const BASS_HIGH = 55;

const FIFTH_ROLES = new Set(['5', 'b5', '#5']);

/** Promote the root and the fifth of a slot's tier entries. */
function promote(entries) {
  return entries.map((entry) => {
    if (entry.tier !== 'chord') return entry;
    if (entry.label === 'R') return { ...entry, tier: 'root' };
    if (FIFTH_ROLES.has(entry.label)) return { ...entry, tier: 'fifth' };
    return entry;
  });
}

/**
 * For each slot, the 12 entries ({ pc, tier, label, note }) the bass roll
 * paints: cellTiers() with the chord root as `root` and its 5th as `fifth`.
 * An empty slot keeps scale membership only.
 */
export function bassTiers(key, slots, analyses = []) {
  return cellTiers(key, slots, analyses).map((entries, i) => (slots[i].chord ? promote(entries) : entries));
}

/** laneFit() for the bass lane, measured on the bass map. */
export const bassFit = (key, slots, lane, analyses, tiers = bassTiers(key, slots, analyses)) =>
  laneFit(key, slots, lane, analyses, tiers);

/** The tier a bass tier reads as in the melody's words: root and fifth are chord tones. */
export const plainTier = (tier) => (tier === 'root' || tier === 'fifth' ? 'chord' : tier);

// ---------- Patterns ----------

/** The bass patterns, each with the style it belongs to. See IMPLEMENTATION-PLAN.md §10.7. */
export const BASS_PATTERNS = [
  { id: 'root', style: 'pop' },
  { id: 'rootFifth', style: 'pop' },
  { id: 'rootOctave', style: 'pop' },
  { id: 'alternating', style: 'folk' },
  { id: 'walking', style: 'jazz' },
];

// Every root sits in C2–C3, so a fifth above (G3 at most) stays on the roll.
// The first chord's root starts in C2–B2.
const ROOT_LOW = 36;
const ROOT_HIGH = 48;

const rootPc = (chord) => pcOf(chord.root);

/** The interval from the root up to the chord tone with `role`, or `fallback` when the chord has none. */
function intervalOf(chord, role, fallback) {
  const tone = chord.tones.find((t) => t.role === role);
  return tone ? mod12(pcOf(tone.note) - rootPc(chord)) : fallback;
}

/** The MIDI note of `pc` nearest to `from` within C2–C3; the lower one on a tie. */
function nearestRoot(pc, from) {
  let best = null;
  for (let midi = ROOT_LOW; midi <= ROOT_HIGH; midi++) {
    if (mod12(midi) === pc && (best === null || Math.abs(midi - from) < Math.abs(best - from))) best = midi;
  }
  return best;
}

/** The root of the first chord: C2–B2. */
const firstRoot = (pc) => ROOT_LOW + pc;

/** The chord after slot `i`: the next slot's chord, wrapping to the first when looping; null if that slot is empty. */
function nextChord(slots, i, loop) {
  const next = i + 1 < slots.length ? slots[i + 1] : loop ? slots[0] : null;
  return next?.chord ?? null;
}

/** The quarters of a walking bar: root, 3rd, 5th and an approach a half step from the next root. */
function walk(chord, root, beats, next) {
  const third = root + intervalOf(chord, '3', 4);
  const fifth = root + intervalOf(chord, '5', 7);
  let approach;
  if (next) {
    // Aim at the next root where the line would place it, coming from this one.
    const target = nearestRoot(rootPc(next), root);
    approach = target - 1 < BASS_LOW ? target + 1 : target - 1;
  } else {
    approach = third; // nothing follows: walk back down to the 3rd
  }
  return beats === 2 ? [root, approach] : [root, third, fifth, approach];
}

/** The pitches of one slot, split evenly over its span. */
function slotPitches(patternId, chord, root, beats, next) {
  const fifthUp = root + intervalOf(chord, '5', 7);
  switch (patternId) {
    case 'root': return [root];
    case 'rootFifth': return [root, fifthUp];
    case 'rootOctave': return root + 12 > BASS_HIGH ? [root, root - 12] : [root, root + 12];
    case 'alternating': {
      const below = fifthUp - 12 < BASS_LOW ? fifthUp : fifthUp - 12;
      return Array.from({ length: beats }, (_, i) => (i % 2 ? below : root));
    }
    case 'walking': return walk(chord, root, beats, next);
    default: throw new Error(`Unknown bass pattern ${patternId}`);
  }
}

/**
 * A bass lane for `slots` played in `patternId`: notes in every filled slot,
 * none in an empty one. Each root is the one nearest the previous chord's root
 * within C2–C3 (the first chord's within C2–B2), so a fifth above still fits.
 */
export function bassPattern(key, slots, patternId, { loop = false } = {}) {
  const notes = [];
  let previous = null;
  slots.forEach((slot, i) => {
    const { chord } = slot;
    if (!chord) return;
    const root = previous === null ? firstRoot(rootPc(chord)) : nearestRoot(rootPc(chord), previous);
    previous = root;
    const { start, length } = slotSpan(slot);
    const pitches = slotPitches(patternId, chord, root, slot.beats, nextChord(slots, i, loop));
    const step = length / pitches.length;
    pitches.forEach((midi, j) => notes.push({ start: start + j * step, length: step, midi }));
  });
  return { notes };
}

/**
 * `bass` with `pattern` written into the filled slots (all of them, or only
 * slot `slotIndex`): pattern notes replace whatever they overlap, and notes in
 * the other slots stay.
 */
export function applyPattern(bass, pattern, slots, slotIndex = null) {
  const targets = slots.filter((s) => s.chord && (slotIndex === null || s.index === slotIndex)).map(slotSpan);
  const inTarget = (n) => targets.some((t) => t.start <= n.start && n.start < t.start + t.length);
  let lane = { notes: bass.notes.filter((n) => !inTarget(n)) };
  for (const note of pattern.notes.filter(inTarget)) lane = addNote(lane, note);
  return lane;
}

// ---------- Critique ----------

/** The bass rules, in the order they are listed. See IMPLEMENTATION-PLAN.md §10.7. */
export const BASS_RULES = ['clash-with-melody', 'not-chord-tone-at-change', 'parallel-octaves'];

const isChordTone = (entry) => plainTier(entry.tier) === 'chord';

/** 'm9' for a minor 9th (or wider by octaves), 'tritone' for a tritone, else null. */
function clashOf(bassMidi, melodyMidi) {
  const size = Math.abs(melodyMidi - bassMidi);
  if (size >= 13 && size % 12 === 1) return 'm9';
  if (size % 12 === 6) return 'tritone';
  return null;
}

/**
 * `[{ rule, noteIndex, data }]` for the bass lane against its chords and the
 * melody, in bass-note order (noteIndex counts bass notes). Each rule flags a
 * bass note once. `tiers` may pass bassTiers() already computed.
 */
export function critiqueBass(key, slots, bass, melody, { analyses, tiers = bassTiers(key, slots, analyses) } = {}) {
  const empty = emptySlotTiers(key);
  const at = (tick) => {
    const slot = slotAtTick(slots, tick);
    return { chord: slot?.chord ?? null, entries: slot ? tiers[slot.index] : empty };
  };
  const items = [];
  const seen = new Set();
  const flag = (rule, note, tick, data) => {
    const noteIndex = bass.notes.indexOf(note);
    if (seen.has(`${rule}@${noteIndex}`)) return;
    seen.add(`${rule}@${noteIndex}`);
    const { chord, entries } = at(tick);
    const entry = entries[note.midi % 12];
    items.push({
      rule,
      noteIndex,
      data: {
        note: entry.note, midi: note.midi, chord, label: entry.label, tier: plainTier(entry.tier),
        bar: Math.floor(tick / TICKS_PER_BAR) + 1, beat: Math.floor((tick % TICKS_PER_BAR) / TICKS_PER_BEAT) + 1,
        ...data,
      },
    });
  };
  const melodyNote = (tick, midi) => ({ melodyNote: at(tick).entries[midi % 12].note, melodyMidi: midi });
  const end = bass.notes.reduce((max, n) => Math.max(max, n.start + n.length), 0);

  // A minor 9th or a tritone between bass and melody on beat 1 or 3. Over a
  // dom7 the tritone between its 3rd and 7th is the point, so chord tones pass.
  for (let tick = 0; tick < end; tick += 2 * TICKS_PER_BEAT) {
    const low = noteAt(bass, tick);
    const high = noteAt(melody, tick);
    const interval = low && high && clashOf(low.midi, high.midi);
    if (!interval) continue;
    const { chord, entries } = at(tick);
    if (chord?.quality === 'dom7' && isChordTone(entries[low.midi % 12]) && isChordTone(entries[high.midi % 12])) continue;
    flag('clash-with-melody', low, tick, { interval, ...melodyNote(tick, high.midi) });
  }

  // The bass note sounding as a chord arrives should belong to that chord.
  for (const slot of slots) {
    if (!slot.chord) continue;
    const { start } = slotSpan(slot);
    const note = noteAt(bass, start);
    if (note && !isChordTone(tiers[slot.index][note.midi % 12])) flag('not-chord-tone-at-change', note, start, {});
  }

  // Bass and melody an octave or two apart moving by the same interval.
  bass.notes.forEach((note, i) => {
    const prev = bass.notes[i - 1];
    if (!prev || prev.midi === note.midi) return;
    const before = noteAt(melody, prev.start);
    const after = noteAt(melody, note.start);
    if (!before || !after) return;
    const gap = after.midi - note.midi;
    if (gap !== before.midi - prev.midi || gap === 0 || gap % 12 !== 0) return;
    flag('parallel-octaves', note, note.start, { interval: 'octave', ...melodyNote(note.start, after.midi) });
  });

  return items.sort((a, b) => a.noteIndex - b.noteIndex || BASS_RULES.indexOf(a.rule) - BASS_RULES.indexOf(b.rule));
}
