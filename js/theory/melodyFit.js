// How a melody sits over the chords: every note is cut at slot boundaries and
// each piece gets the tier (chord tone, scale tone, also fits, blue, avoid,
// outside) of its pitch over the slot's chord, from notesOverChord(). The roll
// paints its fit map and colours its notes from this.

import { analyzeChord } from './analysis.js';
import { segmentWeight, segments } from './composition.js';
import { defaultSpelling, pcOf } from './notes.js';
import { notesOverChord } from './overChord.js';

/** How good each tier is, from a chord tone at 1 to an outside note at -1. */
// `root` and `fifth` are the chord tones the bass map singles out (bassLine.js).
export const TIER_SCORE = { root: 1, fifth: 1, chord: 1, scale: 0.4, parent: 0.3, blue: 0.3, avoid: -0.5, outside: -1 };

/** Tier for each pitch class in a slot with no chord: scale membership only. */
export function emptySlotTiers(key) {
  return Array.from({ length: 12 }, (_, pc) => {
    const note = key.scaleNotes.find((n) => pcOf(n) === pc)
      ?? key.parentNotes.find((n) => pcOf(n) === pc)
      ?? defaultSpelling(pc, key.accidentals);
    const tier = pc === key.blueNotePc ? 'blue'
      : key.scalePcs.has(pc) ? 'scale'
        : key.parentPcs.has(pc) ? 'parent'
          : 'outside';
    return { pc, tier, label: '', note };
  });
}

/**
 * For each slot, the 12 entries ({ pc, tier, label, note }) the roll paints its
 * map with. `analyses` may carry analyzeChord() results per slot to save work.
 */
export function cellTiers(key, slots, analyses = []) {
  const empty = emptySlotTiers(key);
  return slots.map((slot, i) => (slot.chord ? notesOverChord(key, slot.chord, analyses[i] ?? analyzeChord(key, slot.chord)) : empty));
}

/**
 * One entry per note of `lane`: `{ note, segments }`, each segment a piece of the
 * note inside one slot with `{ start, length, slot, chord, tier, label, note, reason, weight }`.
 * Pieces past the last bar read as an empty slot. `tiers` (from cellTiers()
 * or bassTiers()) defaults to the melody map.
 */
export function laneFit(key, slots, lane, analyses, tiers = cellTiers(key, slots, analyses)) {
  const empty = emptySlotTiers(key);
  return lane.notes.map((note) => ({
    note,
    segments: segments(slots, note).map((seg) => {
      const info = (seg.slot ? tiers[seg.slot.index] : empty)[note.midi % 12];
      return {
        start: seg.start,
        length: seg.length,
        slot: seg.slot,
        chord: seg.slot?.chord ?? null,
        tier: info.tier,
        label: info.label,
        note: info.note,
        reason: info.reason ?? null,
        weight: segmentWeight(seg),
      };
    }),
  }));
}

/** The weight-averaged tier score of `segments`, from -1 to 1; null for none. */
export function fitScore(segs) {
  const total = segs.reduce((sum, s) => sum + s.weight, 0);
  if (!total) return null;
  return segs.reduce((sum, s) => sum + TIER_SCORE[s.tier] * s.weight, 0) / total;
}

/** How well one note of laneFit() sits over its chords, from -1 to 1. */
export const noteFit = (entry) => fitScore(entry.segments);

/** The tier that covers most of the note, for its colour; ties go to the earlier piece. */
export function noteTier(entry) {
  const best = new Map();
  for (const s of entry.segments) best.set(s.tier, (best.get(s.tier) ?? 0) + s.length);
  return [...best.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'outside';
}
