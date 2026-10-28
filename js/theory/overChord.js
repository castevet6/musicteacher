// What to play over a chord: every pitch class gets a tier (chord tone, scale
// tone, also fits, avoid, blue note, outside) and a label relative to the root.

import { LETTERS, defaultSpelling, mod, mod12, pcOf } from './notes.js';
import { spellParentScale } from './scales.js';

const DEGREE_NAMES = ['1', '9', '3', '11', '5', '13', '7'];
const NATURAL_SEMIS = [0, 2, 4, 5, 7, 9, 11];

/** "9", "b13", "#11": the interval of `note` above the chord root, named by letter. */
export function tensionLabel(root, note) {
  const steps = mod(LETTERS.indexOf(note.letter) - LETTERS.indexOf(root.letter), 7);
  let diff = mod12(pcOf(note) - pcOf(root)) - NATURAL_SEMIS[steps];
  if (diff > 6) diff -= 12;
  if (diff < -6) diff += 12;
  return (diff < 0 ? 'b'.repeat(-diff) : '#'.repeat(diff)) + DEGREE_NAMES[steps];
}

function harmonicMinor(key) {
  return key.parentNotes.map((note, i) => (i === 6 ? { ...note, acc: note.acc + 1 } : note));
}

/** The 7-note scale a borrowed chord comes from. Harmonic minor wins in a minor key. */
function sourceScale(key, sourceLabel) {
  const sources = sourceLabel.split(' / ');
  if (sources.includes('harmonic minor')) return harmonicMinor(key);
  if (sources.includes('parallel major')) return spellParentScale(key.tonic, 'major');
  if (sources.includes('parallel minor')) return spellParentScale(key.tonic, 'minor');
  return key.parentNotes;
}

/**
 * The chord's scale: its source scale (the key's parent unless the chord is
 * borrowed) with each letter that the chord uses replaced by the chord tone.
 * D7 in C gives D Mixolydian; E7 in A minor gives E Phrygian dominant.
 */
export function chordScale(key, chord, analysis) {
  const base = analysis?.source === 'borrowed' ? sourceScale(key, analysis.sourceLabel) : key.parentNotes;
  return base.map((note) => chord.tones.find((t) => t.note.letter === note.letter)?.note ?? note);
}

/**
 * A scale note a half step above a chord tone is an avoid note, except the b9
 * and b13 over a dominant 7th, which are common tensions.
 */
function avoidedBy(chord, pc) {
  return chord.tones.find((t) =>
    mod12(pcOf(t.note) + 1) === pc && !(chord.quality === 'dom7' && (t.role === 'R' || t.role === '5')));
}

/** Tier and label for each of the 12 pitch classes over `chord`, indexed by pc. */
export function notesOverChord(key, chord, analysis) {
  const scale = chordScale(key, chord, analysis);
  return Array.from({ length: 12 }, (_, pc) => {
    const tone = chord.tones.find((t) => pcOf(t.note) === pc);
    if (tone) return { pc, tier: 'chord', label: tone.role, note: tone.note };

    if (pc === key.blueNotePc) {
      const note = key.scaleNotes.find((n) => pcOf(n) === pc);
      return { pc, tier: 'blue', label: tensionLabel(chord.root, note), note };
    }

    const scaleNote = scale.find((n) => pcOf(n) === pc);
    if (scaleNote) {
      const label = tensionLabel(chord.root, scaleNote);
      const under = avoidedBy(chord, pc);
      if (under) return { pc, tier: 'avoid', label, note: scaleNote, reason: { kind: 'half-step', tone: under } };
      const tier = key.scalePcs.has(pc) || !key.parentPcs.has(pc) ? 'scale' : 'parent';
      return { pc, tier, label, note: scaleNote };
    }

    // A note of the selected scale that the chord has altered, e.g. G over E7 in A minor.
    const keyNote = key.scaleNotes.find((n) => pcOf(n) === pc);
    if (keyNote) {
      const clash = chord.tones.find((t) => t.note.letter === keyNote.letter);
      return {
        pc, tier: 'avoid', label: tensionLabel(chord.root, keyNote), note: keyNote,
        reason: clash ? { kind: 'clash', tone: clash } : { kind: 'outside' },
      };
    }
    return { pc, tier: 'outside', label: '', note: defaultSpelling(pc, key.accidentals) };
  });
}

/** Signed semitones from pc `a` to pc `b`, between -6 and 5. */
function motion(a, b) {
  const up = mod12(b - a);
  return up > 5 ? up - 12 : up;
}

/**
 * Guide tones: the 3rd and 7th of `from`, each moved to the nearest tone of
 * `to` within a whole step. A common tone beats a half step, and a tie moves down.
 */
export function guideTones(from, to) {
  return from.tones
    .filter((t) => t.role === '3' || t.role === '7')
    .flatMap((t) => {
      const moves = to.tones
        .map((u) => ({ from: t.note, fromRole: t.role, to: u.note, toRole: u.role, motion: motion(pcOf(t.note), pcOf(u.note)) }))
        .filter((m) => Math.abs(m.motion) <= 2)
        .sort((a, b) => Math.abs(a.motion) - Math.abs(b.motion) || a.motion - b.motion);
      return moves.slice(0, 1);
    });
}
