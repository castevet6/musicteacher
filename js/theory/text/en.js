// English words for the theory output, in two levels: 'beginner' avoids
// jargon, 'intermediate' uses theory terms with a short gloss. Names are ASCII
// (Bb, F#); the UI turns them into glyphs. text/fi.js mirrors this module.

import { diatonicChords } from '../chords.js';
import { noteName } from '../notes.js';

const ROLE_NAMES = { R: 'root', 3: '3rd', 5: '5th', 7: '7th' };

const pick = (level, texts) => texts[level] ?? texts.intermediate;
const tonicOf = (key) => diatonicChords(key)[0].chord;

/** What the chord does in the key. */
function functionText(analysis, key, level) {
  const { chord, roman } = analysis;
  const s = chord.symbol;
  const home = tonicOf(key).symbol;
  let text;
  if (analysis.source === 'secondary') {
    text = pick(level, {
      beginner: `${s} is a "pointer" chord: it pulls towards ${analysis.target.symbol}.`,
      intermediate: `${roman}: a secondary dominant. It borrows the pull of a V chord to lead into ${analysis.target.symbol}.`,
    });
  } else if (analysis.function === 'tonic') {
    text = pick(level, {
      beginner: `${s} feels like home.`,
      intermediate: `${roman}: tonic function, the point of rest.`,
    });
  } else if (analysis.function === 'subdominant') {
    text = pick(level, {
      beginner: `${s} moves away from home and sets up the next chord.`,
      intermediate: `${roman}: subdominant (predominant) function. It moves away from I and often leads to V.`,
    });
  } else if (analysis.function === 'dominant') {
    text = pick(level, {
      beginner: `${s} builds tension and wants to go home to ${home}.`,
      intermediate: `${roman}: dominant function. Its tension wants to resolve to I (${home}).`,
    });
  } else {
    text = pick(level, {
      beginner: `${s} comes from outside the key, so it sounds surprising.`,
      intermediate: `${roman}: a chromatic chord, outside the key and its usual borrowings.`,
    });
  }
  if (analysis.source === 'borrowed') {
    text += pick(level, {
      beginner: ' It is borrowed from a related key, which gives it a different colour.',
      intermediate: ` Borrowed from the ${analysis.sourceLabel}.`,
    });
  }
  if (analysis.alsoActsAs) {
    text += pick(level, {
      beginner: ` It can also lead strongly into ${analysis.target.symbol}.`,
      intermediate: ` As a dominant 7th it can also act as ${analysis.alsoActsAs}, leading into ${analysis.target.symbol}.`,
    });
  }
  return text;
}

/** One item from progressionAdvice(). */
function adviceText(item, level) {
  const p = item.params;
  switch (item.kind) {
    case 'starts-away-from-tonic':
      return pick(level, {
        beginner: `The progression starts on ${p.chord.symbol}, away from home (${p.tonic.symbol}). The ear waits to hear ${p.tonic.symbol}.`,
        intermediate: `Starts away from the tonic: ${p.chord.symbol} first, so I (${p.tonic.symbol}) is delayed and the key is set up gradually.`,
      });
    case 'ends-on-tonic':
      return pick(level, {
        beginner: `It ends on ${p.chord.symbol}, home, so it sounds finished.`,
        intermediate: `Ends on the tonic (${p.roman}): the progression is resolved.`,
      });
    case 'ends-on-dominant':
      if (p.turnaround) {
        return pick(level, {
          beginner: `The last chord, ${p.chord.symbol}, wants to go to ${p.target.symbol}. When the loop starts again it gets there, so the loop keeps moving.`,
          intermediate: `Ends on ${p.roman}: a turnaround. It resolves into bar 1 when the progression loops; to finish, end on ${p.target.symbol}.`,
        });
      }
      return pick(level, {
        beginner: `The last chord, ${p.chord.symbol}, wants to go home to ${p.target.symbol}. End on ${p.target.symbol}, or loop back to the start.`,
        intermediate: `Ends on ${p.roman} (dominant): unresolved. Resolve to ${p.target.symbol}, or keep it as a turnaround into bar 1.`,
      });
    case 'ends-on-subdominant':
      return pick(level, {
        beginner: `It ends on ${p.chord.symbol}, which sounds open, as if a chord is missing. Add ${p.tonic.symbol} to finish${p.loop && p.firstIsTonic ? ', or loop back to the start' : ''}.`,
        intermediate: `Ends on ${p.roman} (subdominant): open. ${p.roman} → I is a plagal ("amen") cadence${p.loop && p.firstIsTonic ? ', which the loop back to bar 1 provides' : `; add ${p.tonic.symbol} to finish`}.`,
      });
    case 'ends-on-other':
      return pick(level, {
        beginner: `It ends on ${p.chord.symbol}, which doesn't sound like home. End on ${p.tonic.symbol} for a finished sound.`,
        intermediate: `Ends on ${p.roman}: no clear resolution. End on I (${p.tonic.symbol}), or precede it with V.`,
      });
    case 'secondary-resolves':
      return pick(level, {
        beginner: `${p.chord.symbol} points to ${p.target.symbol}, and it goes there next.`,
        intermediate: `${p.chord.symbol} (${p.roman}) resolves to its target ${p.target.symbol}.`,
      });
    case 'secondary-unresolved':
      return pick(level, {
        beginner: `${p.chord.symbol} points to ${p.target.symbol}, but ${p.next ? `${p.next.symbol} comes next` : 'nothing follows'}. That's a surprise, which can work, or try ${p.target.symbol} next.`,
        intermediate: `${p.chord.symbol} (${p.roman}) does not resolve to ${p.target.symbol}${p.next ? `; it moves to ${p.next.symbol}` : ''}. Its resolution is deferred.`,
      });
    case 'empty-bars':
      return pick(level, {
        beginner: `Bar${p.bars.length > 1 ? 's' : ''} ${p.bars.join(', ')} ${p.bars.length > 1 ? 'are' : 'is'} still empty.`,
        intermediate: `Empty: bar${p.bars.length > 1 ? 's' : ''} ${p.bars.join(', ')}.`,
      });
    default:
      throw new Error(`Unknown advice: ${item.kind}`);
  }
}

const CADENCE_TEXT = {
  authentic: {
    beginner: (a, b) => `${a} → ${b}: tension released, home reached.`,
    intermediate: (a, b) => `Authentic cadence: ${a} → ${b} (V → I), the strongest resolution.`,
  },
  plagal: {
    beginner: (a, b) => `${a} → ${b}: a soft way home, the "amen" ending.`,
    intermediate: (a, b) => `Plagal cadence: ${a} → ${b} (IV → I).`,
  },
  deceptive: {
    beginner: (a, b) => `${a} → ${b}: sounds like it's going home, then takes a turn.`,
    intermediate: (a, b) => `Deceptive cadence: ${a} → ${b}. V moves to vi instead of I.`,
  },
  half: {
    beginner: (a) => `Pause on ${a}: the phrase stops on a tense chord, like a question.`,
    intermediate: (a) => `Half cadence on ${a}: the phrase ends on V.`,
  },
  'ii-V-I': {
    beginner: (a, b) => `${a} … ${b}: the classic three-step move home.`,
    intermediate: (a, b) => `ii–V–I from ${a} to ${b}: predominant → dominant → tonic.`,
  },
};

/** A cadence from findCadences(); `slots` gives the chord symbols. */
function cadenceText(cadence, slots, level) {
  const a = slots[cadence.from].chord.symbol;
  const b = slots[cadence.to].chord.symbol;
  const text = pick(level, CADENCE_TEXT[cadence.type])(a, b);
  return cadence.wrap ? `${text} ${pick(level, { beginner: '(when looping)', intermediate: '(across the loop)' })}` : text;
}

const REASONS = {
  'secondary-target': { beginner: 'where this chord points', intermediate: 'resolves the secondary dominant' },
  resolve: { beginner: 'goes home', intermediate: 'resolves to the tonic' },
  deceptive: { beginner: 'a surprise turn', intermediate: 'deceptive resolution' },
  plagal: { beginner: 'a soft way home', intermediate: 'plagal cadence' },
  'to-dominant': { beginner: 'builds tension', intermediate: 'moves to the dominant' },
  'to-predominant': { beginner: 'moves away from home', intermediate: 'moves to a predominant chord' },
  'tonic-substitute': { beginner: 'a sadder home', intermediate: 'tonic substitute' },
  circle: { beginner: 'a natural next step', intermediate: 'root falls a 5th' },
  step: { beginner: 'moves one step', intermediate: 'stepwise root motion' },
  'start-on-tonic': { beginner: 'start at home', intermediate: 'establish the tonic' },
};

const reasonText = (reason, level) => pick(level, REASONS[reason]);

const TIERS = {
  chord: { beginner: 'Safest notes: the chord itself', intermediate: 'Chord tones' },
  scale: { beginner: 'Also good: they add colour', intermediate: 'Scale tones (tensions)' },
  parent: { beginner: 'Fit too, outside the selected scale', intermediate: 'Also fits (parent scale)' },
  avoid: { beginner: 'Careful: they rub against the chord', intermediate: 'Avoid notes' },
  blue: { beginner: 'Blue note: bluesy when passed through', intermediate: 'Blue note' },
};

const tierText = (tier, level) => pick(level, TIERS[tier]);

/** Why an avoid note is avoided. */
function avoidReasonText(info, level) {
  const tone = info.reason?.tone;
  if (!tone) return '';
  const t = noteName(tone.note);
  if (info.reason.kind === 'clash') {
    return pick(level, {
      beginner: `clashes with ${t} in the chord`,
      intermediate: `clashes with the chord's ${ROLE_NAMES[tone.role]} (${t})`,
    });
  }
  return pick(level, {
    beginner: `a half step above ${t}; use it only in passing`,
    intermediate: `a half step above the ${ROLE_NAMES[tone.role]} (${t})`,
  });
}

const MOTION = {
  1: 'rises a half step to',
  2: 'rises a whole step to',
  '-1': 'resolves down a half step to',
  '-2': 'falls a whole step to',
};

/** One guide-tone move from guideTones(). */
function guideToneText(move, from, to, level) {
  const a = noteName(move.from);
  const b = noteName(move.to);
  if (level === 'beginner') {
    if (move.motion === 0) return `Hold ${a} as the chord changes to ${to.symbol}: it fits both chords.`;
    return `Slide ${a} ${move.motion < 0 ? 'down' : 'up'} to ${b} as the chord changes to ${to.symbol}.`;
  }
  const source = `${a} (${ROLE_NAMES[move.fromRole]} of ${from.symbol})`;
  if (move.motion === 0) return `Guide tone: ${source} stays and becomes the ${ROLE_NAMES[move.toRole]} of ${to.symbol}.`;
  return `Guide tone: ${source} ${MOTION[move.motion]} ${b} (${ROLE_NAMES[move.toRole]} of ${to.symbol}).`;
}

/** "F over C: 11, an avoid note." for a clicked note. */
function noteOverChordText(info, chord, level) {
  const name = noteName(info.note);
  const label = info.tier === 'chord' ? ROLE_NAMES[info.label] : info.label;
  const what = {
    chord: pick(level, { beginner: 'a chord tone, always safe', intermediate: 'chord tone' }),
    scale: pick(level, { beginner: 'adds colour', intermediate: 'tension' }),
    parent: pick(level, { beginner: 'fits, though it is outside the selected scale', intermediate: 'parent-scale tone' }),
    avoid: pick(level, { beginner: 'rubs against the chord', intermediate: 'avoid note' }),
    blue: pick(level, { beginner: 'the bluesy note, good in passing', intermediate: 'blue note' }),
    outside: pick(level, { beginner: 'outside the key and the chord', intermediate: 'outside note' }),
  }[info.tier];
  return info.tier === 'outside' ? `${name} over ${chord.symbol}: ${what}.` : `${name} over ${chord.symbol}: ${label}, ${what}.`;
}

const SCALE_LABELS = {
  major: 'Major',
  naturalMinor: 'Natural minor',
  majorPentatonic: 'Major pentatonic',
  minorPentatonic: 'Minor pentatonic',
  blues: 'Blues',
};

const keyLabel = (tonic, scaleId) => `${tonic} ${SCALE_LABELS[scaleId].toLowerCase()}`;

// Keyed by parent mode, then by semitones above the tonic. Only notes outside
// the parent scale need an entry.
const EXPLAIN_TEXTS = {
  major: {
    1: 'b2: outside the major scale. It is usually a chromatic passing tone, or the 3rd of V/ii.',
    3: 'b3: borrowed from the parallel minor. It is also the "blue" minor 3rd over a major key.',
    6: '#4/b5: the tritone above the tonic. As #4 it is the leading tone to V (heard in V/V). As b5 it is the blue note.',
    8: 'b6: borrowed from the parallel minor. It gives iv and bVI their darker colour.',
    10: 'b7: borrowed from the parallel minor (bVII), or the 7th of I7 acting as V/IV.',
  },
  minor: {
    1: 'b2: the Phrygian/Neapolitan note, usually a chromatic passing tone.',
    4: 'Major 3rd: comes from the parallel major (a "Picardy third"). It is also the 3rd of V/iv.',
    6: '#4/b5: the tritone. As #4 it leads to v (V/v). As b5 it is the blue note of the blues scale.',
    9: 'Major 6th: comes from the parallel major (the Dorian sound) and makes IV major.',
    11: 'Major 7th: the leading tone of harmonic minor. It makes V major and vii° diminished.',
  },
};

export const en = {
  noteName,
  roleNames: ROLE_NAMES,
  functionNames: { tonic: 'tonic', subdominant: 'subdominant', dominant: 'dominant' },
  scaleLabels: SCALE_LABELS,
  keyLabel,
  keyIn: (tonic, scaleId) => `in ${keyLabel(tonic, scaleId)}`,
  noteStatus: (inScale, tonic, scaleId) => `${inScale ? 'In' : 'Not in'} ${keyLabel(tonic, scaleId)}`,
  notInScale: (scaleId, parent) =>
    `Not in the ${SCALE_LABELS[scaleId].toLowerCase()}, but it belongs to the parent ${parent} scale, so these chords still fit.`,
  explain: {
    texts: EXPLAIN_TEXTS,
    fallback: 'A chromatic note outside the key.',
    blue: 'Blue note: ',
    is: (name, text) => `${name} is the ${text.charAt(0).toLowerCase()}${text.slice(1)}`,
  },
  sourceLabels: {
    diatonic: 'diatonic',
    chromatic: 'chromatic',
    'secondary dominant': 'secondary dominant',
    'parallel minor': 'parallel minor',
    'parallel major': 'parallel major',
    'harmonic minor': 'harmonic minor',
  },
  groupTitles: {
    diatonic: 'Diatonic chords',
    borrowed: 'Borrowed chords',
    secondary: 'Secondary dominants',
    chromatic: 'Chromatic chords',
  },
  paletteTitles: { diatonic: 'Diatonic', borrowed: 'Borrowed', secondary: 'Secondary' },
  presetLabels: {
    pop: 'I–V–vi–IV',
    doowop: 'I–vi–IV–V',
    twoFiveOne: 'ii–V–I',
    turnaround: 'I–vi–ii–V turnaround',
    blues: '12-bar blues',
    andalusian: 'i–VII–VI–V (Andalusian)',
    minorPop: 'i–VI–III–VII',
  },
  functionText,
  adviceText,
  cadenceText,
  reasonText,
  tierText,
  avoidReasonText,
  guideToneText,
  noteOverChordText,
};
