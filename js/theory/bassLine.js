// The bass lane: its range and the map behind the bass roll. The bass map is
// the melody map with the two notes a bass leans on most picked out: the chord
// root (tier `root`) and its fifth (tier `fifth`).

import { cellTiers, laneFit } from './melodyFit.js';

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
