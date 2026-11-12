// Critique of a melody over its chords: six rules that flag notes, from a
// non-chord tone on a strong beat to a piece that ends off the chord. Each
// item names the note it is about; the texts live in text/en.js and fi.js.

import { TICKS_PER_BAR, TICKS_PER_BEAT, gridTicks } from './composition.js';
import { laneFit } from './melodyFit.js';

export const RULES = ['nct-strong-beat', 'avoid-held', 'outside-unresolved', 'big-leap', 'bar-no-chord-tone', 'ends-off-chord'];
export const BEGINNER_RULES = new Set(['nct-strong-beat', 'outside-unresolved', 'bar-no-chord-tone']);

/** The largest leap a style lets pass without a stepwise recovery, in semitones. */
export const LEAP_LIMIT = { pop: 9, jazz: 9, folk: 7 };

const STEP = 2;
const isStep = (a, b) => a != null && b != null && Math.abs(a.midi - b.midi) <= STEP;
const strongBeat = (tick) => tick % (2 * TICKS_PER_BEAT) === 0;
const beatOf = (tick) => Math.floor((tick % TICKS_PER_BAR) / TICKS_PER_BEAT) + 1;
const barOf = (tick) => Math.floor(tick / TICKS_PER_BAR) + 1;

/** The fact-filled payload the texts are written from. */
function facts(entry, seg) {
  return {
    note: seg.note, midi: entry.note.midi, chord: seg.chord, label: seg.label, tier: seg.tier,
    bar: barOf(seg.start), beat: beatOf(seg.start),
  };
}

/**
 * `[{ rule, noteIndex, data }]` for `lane` over `slots`, in note order. `fit`
 * may pass a laneFit() result already computed for the same lane.
 */
export function critiqueLane(key, slots, lane, { style = 'pop', level = 'intermediate', grid = 8, fit } = {}) {
  const entries = fit ?? laneFit(key, slots, lane);
  const notes = lane.notes;
  const items = [];
  const flag = (rule, noteIndex, data) => items.push({ rule, noteIndex, data });
  const step = gridTicks(grid);
  const limit = LEAP_LIMIT[style] ?? LEAP_LIMIT.pop;

  entries.forEach((entry, i) => {
    const prev = notes[i - 1];
    const next = notes[i + 1];
    const chorded = entry.segments.filter((s) => s.chord);

    // 1. A non-chord tone that starts on beat 1 or 3 and does not step onward.
    const strong = chorded.find((s) => strongBeat(s.start) && s.tier !== 'chord');
    if (strong && !isStep(entry.note, next)) flag('nct-strong-beat', i, facts(entry, strong));

    // 2. An avoid note held past one grid step.
    const held = chorded.find((s) => s.tier === 'avoid' && s.length > step);
    if (held) flag('avoid-held', i, facts(entry, held));

    // 3. A chromatic note not both approached and left by step. Jazz passes
    //    an approach note that is left by a half step, however it was reached.
    const chromatic = entry.segments.find((s) => s.tier === 'outside' || (s.tier === 'avoid' && s.reason?.kind === 'clash'));
    if (chromatic) {
      const approached = isStep(prev, entry.note);
      const left = isStep(entry.note, next);
      const halfStepOut = next && Math.abs(next.midi - entry.note.midi) === 1;
      const ok = (approached && left) || (style === 'jazz' && halfStepOut);
      if (!ok) flag('outside-unresolved', i, facts(entry, chromatic));
    }

    // 4. A leap beyond the style's limit that the next note does not answer by step back.
    if (prev) {
      const leap = entry.note.midi - prev.midi;
      const recovers = next && isStep(entry.note, next) && Math.sign(next.midi - entry.note.midi) === -Math.sign(leap);
      if (Math.abs(leap) > limit && !recovers) {
        flag('big-leap', i, { ...facts(entry, entry.segments[0]), interval: Math.abs(leap), up: leap > 0, limit });
      }
    }
  });

  // 5. A bar with notes over a chord but no chord tone, flagged on its first note.
  const bars = new Map(); // bar → { first: noteIndex, chordTone: bool, chord }
  entries.forEach((entry, i) => {
    for (const seg of entry.segments) {
      if (!seg.chord) continue;
      const bar = barOf(seg.start);
      const info = bars.get(bar) ?? { first: i, firstSeg: seg, chordTone: false, entry };
      if (seg.tier === 'chord') info.chordTone = true;
      bars.set(bar, info);
    }
  });
  for (const info of bars.values()) {
    if (!info.chordTone) flag('bar-no-chord-tone', info.first, facts(info.entry, info.firstSeg));
  }

  // 6. The last note is not a chord tone of the chord under its end.
  const last = entries.at(-1);
  const ending = last?.segments.at(-1);
  if (ending?.chord && ending.tier !== 'chord') flag('ends-off-chord', entries.length - 1, facts(last, ending));

  const kept = level === 'beginner' ? items.filter((it) => BEGINNER_RULES.has(it.rule)) : items;
  return kept.sort((a, b) => a.noteIndex - b.noteIndex || RULES.indexOf(a.rule) - RULES.indexOf(b.rule));
}
