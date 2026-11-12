// Next-note ghosts: two or three pitches for the cell right after a note,
// scored by how they sit over the chord there and how they move from the
// note before. Suggestions only; nothing is placed until the user clicks.

import { analyzeChord } from './analysis.js';
import { diatonicChords } from './chords.js';
import { TICKS_PER_BAR, chordAtTick, gridTicks, noteAt, slotSpan } from './composition.js';
import { emptySlotTiers } from './melodyFit.js';
import { mod12, pcOf } from './notes.js';
import { notesOverChord } from './overChord.js';

export const GHOST_REASONS = ['resolves', 'chord-tone', 'step', 'leap-to-chord-tone', 'scale-tone'];
const STEP = 2;
const LEAP = 7; // more than a fifth
const OPENING_OCTAVE = 60; // the first three notes come out around C4

const tiersAt = (key, slots, tick) => {
  const chord = chordAtTick(slots, tick);
  return { chord, tiers: chord ? notesOverChord(key, chord, analyzeChord(key, chord)) : emptySlotTiers(key) };
};

/** Root, 3rd and 5th of `chord` (or the key's tonic chord) in the octave above middle C. */
function openingNotes(key, chord) {
  const triad = (chord ?? diatonicChords(key)[0].chord).tones.filter((t) => ['R', '3', '5'].includes(t.role));
  const root = pcOf(triad[0].note);
  const rootMidi = OPENING_OCTAVE + root;
  return triad.map((t) => ({ midi: rootMidi + mod12(pcOf(t.note) - root), reason: 'chord-tone' }));
}

/**
 * Up to three `{ midi, reason, score }` for the grid cell after the note at
 * `afterStart` (the last note by default), each one grid step long at `tick`.
 * Empty when the cell lies past the last bar or already holds a note.
 */
export function suggestNextNotes(key, slots, lane, afterStart, { style = 'pop', grid = 8 } = {}) {
  const step = gridTicks(grid);
  const end = slots.length ? (() => { const s = slotSpan(slots.at(-1)); return s.start + s.length; })() : TICKS_PER_BAR;
  const prev = afterStart == null ? lane.notes.at(-1) : lane.notes.find((n) => n.start === afterStart);

  if (!prev) {
    if (lane.notes.length) return { tick: 0, ghosts: [] };
    const { chord } = tiersAt(key, slots, 0);
    return { tick: 0, ghosts: openingNotes(key, chord) };
  }

  const tick = prev.start + prev.length;
  if (tick + step > end || noteAt(lane, tick)) return { tick, ghosts: [] };

  const here = tiersAt(key, slots, tick);
  const before = tiersAt(key, slots, prev.start + prev.length - 1);
  const prevInfo = before.tiers[prev.midi % 12];
  const prevIsSeventh = before.chord && prevInfo.tier === 'chord' && prevInfo.label === '7';
  const prevIsLeading = mod12(prev.midi) === mod12(key.rootPc - 1) && key.scalePcs.has(mod12(key.rootPc - 1));
  const prevIsAvoid = prevInfo.tier === 'avoid';
  const sameRepeat = style === 'jazz' ? -2 : -1;
  const downbeat = tick % TICKS_PER_BAR === 0;

  const candidates = [];
  for (let midi = prev.midi - 12; midi <= prev.midi + 12; midi++) {
    const info = here.tiers[midi % 12];
    const inKey = key.scalePcs.has(midi % 12);
    if (info.tier !== 'chord' && !inKey) continue;
    const diff = midi - prev.midi;
    const size = Math.abs(diff);
    const isStep = size > 0 && size <= STEP;
    const resolves = (prevIsSeventh && diff < 0 && size <= STEP)
      || (prevIsLeading && diff === 1 && midi % 12 === key.rootPc)
      || (prevIsAvoid && diff < 0 && size <= STEP);

    let score = 0;
    if (info.tier === 'chord') score += 3;
    if (inKey) score += 1;
    if (info.tier === 'avoid') score -= 1;
    if (isStep) score += 2;
    if (resolves) score += 3;
    if (size > LEAP) score -= 2;
    if (size === 0) score += sameRepeat;
    if (downbeat && info.tier === 'chord' && (info.label === 'R' || info.label === '3')) score += 1;

    const reason = resolves ? 'resolves'
      : info.tier === 'chord' ? (size > STEP ? 'leap-to-chord-tone' : 'chord-tone')
        : isStep ? 'step' : 'scale-tone';
    candidates.push({ midi, reason, score, size });
  }

  candidates.sort((a, b) => b.score - a.score || a.size - b.size || a.midi - b.midi);
  // The top three, preferring a reason not yet shown when it scores within a point of the best.
  const picked = [];
  while (picked.length < 3 && candidates.length) {
    const used = new Set(picked.map((g) => g.reason));
    const best = candidates[0];
    const fresh = candidates.find((c) => !used.has(c.reason) && c.score >= best.score - 1) ?? best;
    picked.push(fresh);
    candidates.splice(candidates.indexOf(fresh), 1);
  }
  return { tick, ghosts: picked.map(({ midi, reason, score }) => ({ midi, reason, score })) };
}
