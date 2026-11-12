// Chords for a melody: how well a slot's chord fits the melody inside it (the
// fit dot). Chord ranking and the key guess join this module in later milestones.

import { fitScore, laneFit } from './melodyFit.js';

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
