// Chords for a melody: how well a slot's chord fits the melody inside it (the
// fit dot), a ranked list of chords for that melody, and a guess at the key
// from the notes and chords together.

import { analyzeChord, chordPalette, findCadences, nextChords } from './analysis.js';
import { diatonicChords } from './chords.js';
import { TICKS_PER_BEAT, segmentWeight, segments } from './composition.js';
import { TIER_SCORE, fitScore, laneFit } from './melodyFit.js';
import { mod12, pcOf } from './notes.js';
import { notesOverChord } from './overChord.js';
import { SCALES, buildKey } from './scales.js';

/** 'good' | 'ok' | 'clash' for a fit score, or null for none. */
export function fitLevel(score) {
  if (score == null) return null;
  return score >= 0.7 ? 'good' : score >= 0.3 ? 'ok' : 'clash';
}

/** The fit of the melody pieces that lie inside slot `slotIndex`, from a laneFit() result. */
export function slotFitScore(fit, slotIndex) {
  const segs = fit.flatMap((e) => e.segments.filter((s) => s.slot?.index === slotIndex));
  return fitScore(segs);
}

/** The fit dot for a filled slot: 'good' | 'ok' | 'clash', or null when the slot has no chord or no melody. */
export function slotFit(key, slots, lane, slotIndex, fit = laneFit(key, slots, lane)) {
  if (!slots[slotIndex]?.chord) return null;
  return fitLevel(slotFitScore(fit, slotIndex));
}

// ---------- Ranking ----------

const PRIMARY = { major: ['I', 'IV', 'V', 'V7'], minor: ['i', 'iv', 'v', 'V', 'V7'] };
const BONUS = { diatonic: 0.2, primary: 0.05, style: 0.1, cadence: 0.1, repeat: -0.1 };

/** The melody pieces of `lane` inside slot `slotIndex`, with their weights but no tier yet. */
function piecesIn(slots, lane, slotIndex) {
  return lane.notes.flatMap((note) => segments(slots, note)
    .filter((seg) => seg.slot?.index === slotIndex)
    .map((seg) => ({ midi: note.midi, weight: segmentWeight(seg) })));
}

/** The weight-averaged tier score of `pieces` over `chord`, from -1 to 1. */
function fitOver(key, chord, pieces) {
  const tiers = notesOverChord(key, chord, analyzeChord(key, chord));
  const total = pieces.reduce((sum, p) => sum + p.weight, 0);
  return pieces.reduce((sum, p) => sum + TIER_SCORE[tiers[p.midi % 12].tier] * p.weight, 0) / total;
}

/** The nearest filled slot before `index`, wrapping to the last one when looping. */
function previousChord(slots, index, loop) {
  const filled = slots.filter((s) => s.chord && s.index !== index);
  return [...filled].reverse().find((s) => s.index < index)?.chord ?? (loop ? filled.at(-1)?.chord ?? null : null);
}

/** Whether `chord` in slot `index` forms a cadence with the chord before or after it. */
function makesCadence(key, slots, index, chord, loop) {
  const trial = slots.map((s) => (s.index === index ? { ...s, chord } : s));
  return findCadences(key, trial, { loop }).some((c) => c.type !== 'half' && (c.to === index || c.from === index));
}

/**
 * Chords for the melody inside slot `slotIndex`, best first:
 * `[{ chord, roman, group, fit, score, reasons }]`. With no melody in the slot
 * the list is nextChords() of the previous chord (the tonic first when there
 * is none), with `fit` and `score` null.
 */
export function rankChords(key, slots, lane, slotIndex, { style = 'pop', loop = true } = {}) {
  const pieces = piecesIn(slots, lane, slotIndex);
  const prev = previousChord(slots, slotIndex, loop);

  if (!pieces.length) {
    const options = prev
      ? nextChords(key, prev).map((o) => ({ chord: o.chord, roman: o.roman, reason: o.reason }))
      : diatonicChords(key).filter((e) => e.kind === 'triad').map((e, i) => ({ chord: e.chord, roman: e.roman, reason: i === 0 ? 'start-on-tonic' : null }));
    return options.map((o) => ({ chord: o.chord, roman: o.roman, group: 'next', fit: null, score: null, reasons: o.reason ? [o.reason] : [] }));
  }

  const primary = PRIMARY[key.parent];
  const candidates = chordPalette(key).flatMap((g) => g.chords.map((c) => ({ ...c, group: g.id })));
  const scored = candidates.map((c) => {
    const fit = fitOver(key, c.chord, pieces);
    const reasons = [];
    let score = fit;
    if (fit >= 1) reasons.push('fit-all');
    else if (fit >= 0.7) reasons.push('fit-most');
    if (c.group === 'diatonic') score += BONUS.diatonic;
    else reasons.push(c.group);
    if (c.group === 'diatonic' && primary.includes(c.roman)) {
      score += BONUS.primary;
      reasons.push('primary');
    }
    const seventh = c.chord.tones.length === 4;
    // Jazz leans to seventh chords, pop and folk to plain triads (a diminished triad is no pop staple).
    if (style === 'jazz' ? seventh : !seventh && c.chord.quality !== 'dim') score += BONUS.style;
    if (prev && c.chord.symbol === prev.symbol) score += BONUS.repeat;
    if (makesCadence(key, slots, slotIndex, c.chord, loop)) {
      score += BONUS.cadence;
      reasons.push('cadence');
    }
    return { chord: c.chord, roman: c.roman, group: c.group, fit, score, reasons };
  });

  const bestDiatonic = Math.max(-Infinity, ...scored.filter((c) => c.group === 'diatonic').map((c) => c.fit));
  return scored
    .filter((c) => c.group === 'diatonic' || c.fit > bestDiatonic)
    .sort((a, b) => b.score - a.score || b.fit - a.fit);
}

// ---------- Key guess ----------

const KEY_BONUS = { endsOnTonic: 0.15, startsWell: 0.05, unused: 0.03 };

/** Pitch-class weights: lane notes by length, each chord tone of a filled slot as a quarter note. */
function pitchWeights(melody, slots, bass) {
  const weights = new Array(12).fill(0);
  for (const lane of [melody, bass]) for (const n of lane?.notes ?? []) weights[mod12(n.midi)] += n.length;
  for (const slot of slots) for (const tone of slot.chord?.tones ?? []) weights[pcOf(tone.note)] += TICKS_PER_BEAT;
  return weights;
}

/**
 * The three keys that explain the melody, bass and chords best:
 * `[{ rootPc, scaleId, score, coverage, reasons }]`. Coverage is the weighted
 * share of pitches inside the scale; a melody that ends on the tonic, or
 * starts on the tonic or 5th, scores extra (scaled by coverage², so a key
 * that misses notes earns less from them); every scale note the music never
 * touches costs a little. The blues scale is only in the running when its
 * blue note is actually played. Ties go to a key whose tonic is played.
 */
export function guessKeys(melody, slots, bass = { notes: [] }) {
  const weights = pitchWeights(melody, slots, bass);
  const total = weights.reduce((a, b) => a + b, 0);
  if (!total) return [];
  const first = melody.notes[0] && mod12(melody.notes[0].midi);
  const last = melody.notes.length ? mod12(melody.notes.at(-1).midi) : null;
  const chords = slots.filter((s) => s.chord).map((s) => s.chord);

  const results = [];
  for (let rootPc = 0; rootPc < 12; rootPc++) {
    for (const scaleId of Object.keys(SCALES)) {
      const key = buildKey(rootPc, scaleId);
      if (key.blueNotePc != null && !weights[key.blueNotePc]) continue;
      const covered = weights.reduce((sum, w, pc) => sum + (key.scalePcs.has(pc) ? w : 0), 0);
      const coverage = covered / total;
      const unused = [...key.scalePcs].filter((pc) => !weights[pc]).length;
      const endsOnTonic = last === rootPc;
      const startsWell = first != null && (first === rootPc || first === mod12(rootPc + 7));
      const chordsDiatonic = chords.length > 0 && chords.every((c) => analyzeChord(key, c).source === 'diatonic');
      const confidence = coverage * coverage;
      const score = coverage
        + (endsOnTonic ? KEY_BONUS.endsOnTonic * confidence : 0)
        + (startsWell ? KEY_BONUS.startsWell * confidence : 0)
        - unused * KEY_BONUS.unused;
      const reasons = [coverage >= 1 ? 'fits-all' : 'fits-most'];
      if (endsOnTonic) reasons.push('ends-on-tonic');
      if (chordsDiatonic) reasons.push('chords-diatonic');
      results.push({ rootPc, scaleId, score, coverage, reasons });
    }
  }
  return results
    .sort((a, b) => b.score - a.score || b.coverage - a.coverage
      || (weights[b.rootPc] > 0) - (weights[a.rootPc] > 0)
      || SCALES[b.scaleId].degrees.length - SCALES[a.scaleId].degrees.length)
    .slice(0, 3);
}
