# Music Teacher — Implementation Plan

Build plan for the app described in [PROJECT-PLAN.md](PROJECT-PLAN.md). Work through the milestones in order. Each milestone ends with a completion criterion, and it is not done until that criterion holds.

## 1. Scope decisions

| Topic | Decision |
|---|---|
| Instruments | Acoustic guitar neck (standard EADGBE, open + 15 frets, right-handed) and piano (C2–B5, scrollable, opens at C3) |
| Scales | Major, natural minor, major pentatonic, minor pentatonic, blues (1 b3 4 b5 5 b7) |
| Chord types | Triads: maj, min, dim, aug. Sevenths: maj7, 7, m7, m7b5, dim7, mMaj7 |
| Note in scale | Every diatonic triad and 7th that contains the note, with its Roman numeral and the note's role (R/3/5/7) |
| Pentatonic / blues | Chords come from the **parent scale**: major pentatonic → major, minor pentatonic and blues → natural minor |
| Blue note (b5) | Highlighted as a scale note. Its chords come from the out-of-scale logic. |
| Note out of scale | Borrowed chords (parallel key), secondary dominants, and a short explanation. If both lists are empty, chromatic triads rooted on the note are shown instead. |
| Chord click | Chord tones are highlighted on the instrument (every guitar position) with role labels, and the chord plays |
| Audio | Web Audio synth, with no sample files |
| Spelling | Key-correct: notes are spelled by letter, never from pitch class alone |
| Stack | Static HTML + native ES modules + CSS. No build step, no dependencies, no backend, no storage |
| Tests | `node --test` on `js/theory/*` |
| Layout | Responsive. The instruments scroll horizontally on narrow screens, and the chord panel stacks below them |

Out of scope: URL state, alternate tunings, left-handed mode, guitar chord-shape diagrams, sampled audio, deployment pipeline.

## 2. File layout

```
index.html
css/styles.css
js/main.js              bootstrap; subscribes views to state
js/state.js             store + actions
js/theory/notes.js      pitch classes, spelled notes, MIDI helpers
js/theory/scales.js     SCALES table, buildKey()
js/theory/chords.js     CHORD_QUALITIES, buildChord(), chordSymbol(), romanNumeral()
js/theory/suggest.js    suggestChords()
js/theory/explain.js    explanation texts for out-of-scale notes
js/theory/progression.js  relative chords, parseNumeral(), PRESETS, bar/slot helpers (§9)
js/theory/analysis.js   analyzeChord(), findCadences(), progressionAdvice(), nextChords(), slotFocus() (§9)
js/theory/overChord.js  chordScale(), notesOverChord(), guideTones() (§9)
js/theory/adviceText.js beginner / intermediate texts for the analysis (§9)
js/ui/controls.js       instrument toggle, root and scale selects
js/ui/piano.js          SVG keyboard
js/ui/guitar.js         SVG fretboard
js/ui/chordPanel.js     chord suggestion list
js/ui/dom.js            h(), prettyText(), prettySymbol() shared by the panels
js/ui/progressionStrip.js  bar strip, presets, transport controls
js/ui/progressionPanel.js  chord picker, notes over the chord, advice
js/audio/synth.js       Web Audio synth
js/audio/transport.js   lookahead scheduler for progression playback
test/notes.test.js
test/scales.test.js
test/chords.test.js
test/suggest.test.js
test/progression.test.js
test/overChord.test.js
test/analysis.test.js
package.json
README.md
AGENTS.md
```

Dependency direction: `ui/*` and `audio/*` → `theory/*`. `main.js` wires everything. `theory/*` imports nothing outside `theory/` and never touches `document`, `window` or `AudioContext`.

## 3. Theory layer

### 3.1 `notes.js`

- `LETTERS = ['C','D','E','F','G','A','B']`, `LETTER_PC = {C:0, D:2, E:4, F:5, G:7, A:9, B:11}`.
- A spelled note is `{ letter, acc }`, where `acc` is an integer from −2 to +2 (−1 = ♭, +1 = ♯).
- `pcOf(note)` → `(LETTER_PC[letter] + acc + 12) % 12`.
- `noteName(note)` → `"Bb"`, `"F#"`, `"Ebb"`. Use ASCII `b`/`#` in data and render ♭/♯ in the UI through a `prettyName()` helper.
- `spellPcWithLetter(pc, letter)` → the `{letter, acc}` that reaches `pc` from that letter. This is the core of all letter-stacking.
- `letterAt(letter, steps)` → the letter `steps` positions up the alphabet (wraps).
- `defaultSpelling(pc, accidentals)` → spelling for chromatic notes with no chord context. `'sharps'`: C#, D#, F#, G#, A#. `'flats'`: Db, Eb, Gb, Ab, Bb. `'neutral'` (C major, A minor): the common names C#, Eb, F#, Ab, Bb.
- `midiToFreq(m)` = `440 * 2 ** ((m - 69) / 12)`. `midiToPc(m)` = `m % 12`.

### 3.2 `scales.js`

```js
export const SCALES = {
  major:          { label: 'Major',            parent: 'major',  degrees: [0,1,2,3,4,5,6] },
  naturalMinor:   { label: 'Natural minor',    parent: 'minor',  degrees: [0,1,2,3,4,5,6] },
  majorPentatonic:{ label: 'Major pentatonic', parent: 'major',  degrees: [0,1,2,4,5] },
  minorPentatonic:{ label: 'Minor pentatonic', parent: 'minor',  degrees: [0,2,3,4,6] },
  blues:          { label: 'Blues',            parent: 'minor',  degrees: [0,2,3,4,6], blueNote: true },
};
export const PARENT_INTERVALS = { major: [0,2,4,5,7,9,11], minor: [0,2,3,5,7,8,10] };
```

`degrees` index into the parent's 7 notes, so pentatonic spellings come straight from the parent. Blues adds the b5, spelled as the parent's 5th letter lowered (A blues → Eb, E blues → Bb).

`buildKey(rootPc, scaleId)` returns:

```js
{
  rootPc, scaleId,
  tonic: {letter, acc},
  parent: 'major' | 'minor',
  parentNotes: [7 spelled notes],          // letter-stacked from tonic
  scaleNotes:  [spelled notes of the selected scale, incl. blue note],
  scalePcs:    Set<pc>,
  parentPcs:   Set<pc>,
  blueNotePc:  pc | null,
  accidentals: 'sharps' | 'flats' | 'neutral',
}
```

**Tonic spelling:** when the scale changes, the state passes the current tonic letter as `tonicLetter`, and `buildKey` keeps it if its parent scale has no double accidentals (Eb major → Eb minor, not D# minor). A root change clears it. Otherwise, for each enharmonic candidate of `rootPc` (e.g. C# and Db), build the parent scale and count the accidentals. Choose the spelling with the fewest accidentals and no double accidentals. On a tie, sharps win. Results: Db major, F# major, C# minor, D# minor, Eb major, Bb minor, G# minor. `accidentals` is `'flats'` when the parent scale contains a flat, `'sharps'` when it contains a sharp, and `'neutral'` otherwise.

Root picker labels: `C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, G#/Ab, A, A#/Bb, B`.

### 3.3 `chords.js`

```js
export const CHORD_QUALITIES = {
  maj:   { symbol: '',     intervals: [0,4,7] },
  min:   { symbol: 'm',    intervals: [0,3,7] },
  dim:   { symbol: 'dim',  intervals: [0,3,6] },
  aug:   { symbol: 'aug',  intervals: [0,4,8] },
  maj7:  { symbol: 'maj7', intervals: [0,4,7,11] },
  dom7:  { symbol: '7',    intervals: [0,4,7,10] },
  min7:  { symbol: 'm7',   intervals: [0,3,7,10] },
  m7b5:  { symbol: 'm7b5', intervals: [0,3,6,10] },
  dim7:  { symbol: 'dim7', intervals: [0,3,6,9] },
  mMaj7: { symbol: 'mMaj7',intervals: [0,3,7,11] },
};
export const ROLES = ['R', '3', '5', '7'];
```

- `buildChord(root, qualityId)` → `{ root, quality, tones: [{note, role}], pcs: Set, symbol }`. The tones are spelled by letter stacking: the 3rd is `letterAt(root.letter, 2)`, the 5th is `+4` and the 7th is `+6`, each passed through `spellPcWithLetter`. This gives Bb–D–F–Ab rather than A#–D–F–G#.
- `qualityFromPcs(intervals)` → qualityId. It is used when stacking thirds inside a scale.
- `chordSymbol(chord)` → `"Bb7"`, `"F#m7b5"`.
- `romanNumeral(chord, key)`:
  - The degree comes from the letter distance between the tonic letter and the chord-root letter (I–VII).
  - The accidental is the chord root's pc compared with the parent-scale note at that degree: lower → `b` prefix, higher → `#` prefix.
  - Case: upper case for maj/aug/dom7/maj7, lower case for min/dim/m7/m7b5/dim7/mMaj7.
  - Suffix: dim → `°`, aug → `+`, m7b5 → `ø7`, dim7 → `°7`, maj7 → `maj7`, dom7 and min7 → `7`, mMaj7 → `(maj7)`.
  - Examples: `I`, `ii7`, `viiø7`, `V7`, `bVI` (in a major key), `#vi` (F#m in A minor).
- `diatonicChords(key)` → for each of the 7 parent degrees, a triad and a 7th made by stacking `parentNotes[i], [i+2], [i+4], [i+6]`, each with `{chord, degree, roman}`.

### 3.4 `suggest.js`

`suggestChords(key, pc)` returns:

```js
{
  note: {letter, acc},          // display spelling of the selected note
  inScale: boolean,             // pc ∈ key.scalePcs
  inParent: boolean,            // pc ∈ key.parentPcs
  isBlueNote: boolean,
  groups: [{ id, title, chords: [Suggestion] }],   // empty groups omitted
  explanation: string | null,
}
Suggestion = { symbol, roman, source, tones, roleOfSelected, fitsScale, chord }
```

The algorithm:

Every group leaves out chords whose symbol is already in the key's diatonic set: G7 in C major is V7, not a secondary dominant. The **secondary dominants** are V/x and V7/x for each diatonic triad target x (not the tonic, and not diminished): the major triad and the dom7 a fifth above x's root. The root letter is `letterAt(x.root.letter, 4)`, and the pc is x's root pc + 7. They are labelled `V/ii`, `V7/ii` and so on, using the target's triad numeral.

1. **pc ∈ parentPcs (a scale note):**
   - **`diatonic` group.** Every diatonic triad and 7th containing pc, in degree order with the triad before the 7th. `fitsScale` is true when all of the chord's pcs are in `scalePcs`; this matters for pentatonic and blues. If pc is in the parent scale but not in the selected scale (a gap note in a pentatonic), give an explanation: "Not in the {scale}, but it belongs to the parent {major|minor} scale, so these chords still fit."
   - **`borrowed` group (minor keys only).** The harmonic-minor V, V7 and vii°7 that contain pc. This is how E7 shows up when you click D in A minor.
   - **`secondary` group.** The secondary dominants that contain pc, e.g. D and D7 (V/V) for D in C major.
2. **Otherwise (chromatic or blue note):**
   - **`borrowed` group.** In a major key, take the diatonic chords of the parallel natural minor (same tonic). In a minor key, take the diatonic chords of the parallel major, plus the harmonic-minor chords V, V7 and vii°7. Keep the chords that contain pc. If a chord appears in both sources, keep one entry and join the source labels ("parallel major / harmonic minor"). The roman numeral is computed against the current key.
   - **`secondary` group.** The secondary dominants that contain pc.
   - **`chromatic` fallback group**, only if both groups above are empty: the major and minor triads rooted on the note. With the current scales, every chromatic note is covered by a borrowed chord or a secondary dominant, so this is a safety net for future scales. Test it through an exported helper rather than a real key.
   - **Explanation** comes from `explain.js`.
3. **Spelling of the selected note:** if pc is in `scaleNotes`, use that spelling. Otherwise, use the spelling from the first suggested chord that contains it. If no chord does, use `defaultSpelling(pc, key.accidentals)`.

### 3.5 `explain.js`

`explain(key, pc, {isBlueNote})` builds a text from the interval above the tonic, `d = (pc - rootPc + 12) % 12`, and the parent mode.

| Parent | d | Text (template) |
|---|---|---|
| major | 1 | b2: outside the major scale. It is usually a chromatic passing tone, or the 3rd of V/ii. |
| major | 3 | b3: borrowed from the parallel minor. It is also the "blue" minor 3rd over a major key. |
| major | 6 | #4/b5: the tritone above the tonic. As #4 it is the leading tone to V (heard in V/V). As b5 it is the blue note. |
| major | 8 | b6: borrowed from the parallel minor. It gives iv and bVI their darker colour. |
| major | 10 | b7: borrowed from the parallel minor (bVII), or the 7th of I7 acting as V/IV. |
| minor | 1 | b2: the Phrygian/Neapolitan note, usually a chromatic passing tone. |
| minor | 4 | Major 3rd: comes from the parallel major (a "Picardy third"). It is also the 3rd of V/iv. |
| minor | 6 | #4/b5: the tritone. As #4 it leads to v (V/v). As b5 it is the blue note of the blues scale. |
| minor | 9 | Major 6th: comes from the parallel major (the Dorian sound) and makes IV major. |
| minor | 11 | Major 7th: the leading tone of harmonic minor. It makes V major and vii° diminished. |

When `isBlueNote` is true, prefix the text with "Blue note:". Use the key's own spelled note names in the text where it helps (e.g. "F# leads up to G").

### 3.6 Golden test cases

These were checked by hand. Each line lists exactly the chords to expect.

| Key | Note | Expected |
|---|---|---|
| C major | E | Diatonic: C (I, 3), Cmaj7 (Imaj7, 3), Em (iii, R), Em7 (iii7, R), Fmaj7 (IVmaj7, 7), Am (vi, 5), Am7 (vi7, 5). Secondary: A, A7 (V/ii), C7 (V7/IV; the C triad is diatonic), E, E7 (V/vi) |
| C major | D | Diatonic includes G7 (V7). Secondary: D, D7 (V/V), E7 (V7/vi) |
| A minor | D | Diatonic includes Em7 (v7). Borrowed: E7 (V7), G#dim7 (#vii°7), both harmonic minor. Secondary: D, D7 (V/VII); G and G7 are diatonic VII. |
| A minor | B | Borrowed: E, E7 (V, V7), G#dim7 (#vii°7) |
| C major | F# | No borrowed chords. Secondary: B, B7 (V/iii), D, D7 (V/V) |
| C major | Ab | Borrowed: Ddim, Dm7b5 (ii°, iiø7), Fm, Fm7 (iv, iv7), Ab, Abmaj7 (bVI, bVImaj7), Bb7 (bVII7). Secondary: E, E7 (V/vi), where the note is spelled G# inside the chord. The panel heading spells it Ab. |
| A minor | G# | Borrowed: Amaj7 (Imaj7), C#m, C#m7 (#iii), E, E7 (V, V7), G#dim, G#m7b5 (#vii°, #viiø7) from the parallel major, and G#dim7 (#vii°7, harmonic minor). No secondary chords. |
| A minor | Bb | No borrowed chords. Secondary: C7 (V7/VI) |
| F major | — | The scale is spelled F G A Bb C D E |
| E blues | Bb | `inScale` is true, `isBlueNote` is true, the groups come from the out-of-scale logic, and the explanation starts with "Blue note:" |
| C maj. pent. | F | `inScale` is false and `inParent` is true. The diatonic group is present, and its explanation mentions the parent scale. |
| Sweep | — | For all 12 roots × 5 scales: no double accidentals in the parent scale or in any diatonic chord, and every scale uses 7 distinct letters |
| Tie rule | — | Root pc 6 in major → F#. Root pc 3 in minor → D#. Root pc 1 in major → Db, in minor → C#. |
| Kept tonic letter | — | `buildKey(rootPc, scaleId, tonicLetter)` keeps the letter when its parent scale has no double accidentals: (3, minor, 'E') → Eb minor. Otherwise the tie rule decides: (6, minor, 'G') → F#, (1, minor, 'D') → C#, (3, major, 'D') → Eb. |

## 4. State (`state.js`)

```js
state = {
  instrument: 'guitar' | 'piano',
  rootPc: 0, scaleId: 'major',
  key,                       // derived: buildKey(rootPc, scaleId)
  selected: { pc, midi } | null,
  suggestions,               // derived: suggestChords(key, selected.pc) | null
  activeChord: Suggestion | null,
}
```

Actions: `setInstrument`, `setRoot`, `setScale`, `selectNote({pc, midi})`, `toggleChord(suggestion)`, `clearSelection`. Each action recomputes the derived fields and notifies subscribers once. When the root or scale changes, `selected` and `activeChord` are cleared. When the instrument changes, the selected pc is kept and `activeChord` is cleared. Views re-render from the whole state, and no view holds state of its own.

## 5. UI

### 5.1 Page structure (`index.html`)

```
<header>  title · instrument toggle (2 radio buttons styled as a segmented control) · root <select> · scale <select>
<main>
  <section id="instrument">   scroll container holding the SVG
  <aside id="chords">         selected note heading, explanation, groups
```

Desktop (≥ 900px): the instrument and the panel sit side by side, or the panel goes under a wide guitar neck if that works better. Narrow screens: one column, and the instrument container has `overflow-x: auto`. Touch targets are at least 44 px.

### 5.2 Highlight model (shared by both instruments)

Every clickable note element carries `data-pc` and `data-midi` plus state classes, which are recomputed on each render:

| Class | Meaning |
|---|---|
| `in-scale` | pc ∈ key.scalePcs |
| `root` | pc === key.rootPc |
| `blue-note` | pc === key.blueNotePc |
| `selected` | the clicked position (same midi) |
| `selected-pc` | other positions of the selected pc (lighter) |
| `chord-tone` + `data-role` | pc is a tone of activeChord. The role label (R/3/5/7) is shown on the note. |
| `muted` | an active chord exists and this note is not a chord tone |

Labels show the key-correct spelling. A chromatic note uses `suggestions.note` when it is the selected note, and `defaultSpelling` otherwise. All colours are CSS custom properties in `:root`.

### 5.3 Piano (`piano.js`)

- Render MIDI 36–83 (C2–B5) as SVG: white keys about 36 px wide, black keys about 22 px, overlaid in the usual pattern.
- The container width shows about 2 octaves. After the first render, set `scrollLeft` to the x position of C3 (MIDI 48).
- One delegated `click` listener on the SVG reads `data-midi` and calls `selectNote`.

### 5.4 Guitar (`guitar.js`)

- 6 strings with open MIDI `[64, 59, 55, 50, 45, 40]` from top to bottom (high e on top, as in tab view). Fret 0 (open) is drawn left of the nut, then frets 1–15.
- Fret widths follow equal temperament, `w(n) ∝ 2^(-n/12)`, but are clamped to a minimum width so that fret 15 still fits a note dot. Fret markers at 3, 5, 7, 9 and 15, and a double marker at 12.
- Each string × fret position is a `<g>` with an invisible hit rectangle and a circle + text that appear according to the highlight classes. Notes that are out of scale and not selected are not drawn, but they stay clickable.
- Set a minimum SVG width (about 900 px) so the neck scrolls on phones rather than shrinking.

### 5.5 Chord panel (`chordPanel.js`)

- Empty state: "Click a note on the {instrument} to see chords."
- Heading: the note name, "in {key label}" or "not in {key label}", and a blue-note badge if it applies.
- The explanation paragraph, if there is one.
- Groups in this order: Diatonic, Borrowed, Secondary dominants, Chromatic. Each group is a `<details open>` element with a `<summary>` title.
- Each chord is a `<button>` row showing the symbol, the Roman numeral, the spelled tones, a "{note} = {role}" badge, and a "fits {scale}" tag when `fitsScale` is set. Clicking it calls `toggleChord` and plays the chord. The active row gets `aria-pressed="true"`.

## 6. Audio (`synth.js`)

- `getContext()` creates the `AudioContext` lazily inside the first user gesture and calls `resume()` if it is suspended.
- Each voice is a triangle oscillator plus a sine one octave up at 0.3 gain, through a gain envelope: attack 5 ms, decay to 0.4 over 300 ms, release over 1.2 s. Stop the oscillators after the release.
- A master `GainNode` at about 0.3 avoids clipping on 4-note chords.
- `playNote(midi)` plays the exact clicked position.
- `playChord(chord, {strum})` voices the chord in close position, with the root as the lowest note whose pc matches, at MIDI 48 or above. Tones are stacked upward. On guitar, `strum` staggers the tones by 25 ms. On piano the tones start together.

## 7. Milestones

| # | Work | Done when |
|---|---|---|
| 1 | Scaffold: `index.html` loading `js/main.js` as a module, `css/styles.css`, `package.json` (`"type": "module"`, scripts `test` and `serve`), README | `npm run serve` shows the page with no console errors, and `npm test` runs (0 tests) |
| 2 | `notes.js`, `scales.js` + tests | All scale rows in §3.6 pass, including the sweep and the tie rule |
| 3 | `chords.js`, `suggest.js`, `explain.js` + tests | Every row in §3.6 passes |
| 4 | `state.js`, `controls.js`, `piano.js` | Changing the root or scale updates the piano highlights. Clicking a key sets `selected` (check through a temporary console log or the panel stub). |
| 5 | `guitar.js` | The instrument toggle switches views. G major highlights F# on all six strings, and E blues shows Bb as a blue note. |
| 6 | `chordPanel.js` + chord-tone highlighting | The §3.6 cases look right in the UI. Clicking a chord shows R/3/5/7 on every position, and clicking it again clears them. |
| 7 | `synth.js` | Notes and chords sound, with no clicks or pops, and there is no audio before the first interaction |
| 8 | Responsive polish, README usage section | At 375 px wide: no page-level horizontal scroll, the instruments scroll inside their container, and the panel is stacked and easy to tap |

## 8. Verification (end to end)

1. `npm test`: everything is green.
2. `npm run serve`, then open http://localhost:8000.
3. For each scale, switch through a few roots (C, F, F#, Bb, E) on both instruments and check the spelling and highlights.
4. Click an in-scale note, a pentatonic gap note, a blue note and a chromatic note, and compare the results with §3.6.
5. Click chords: check the tones and role labels, the audio, and that clicking again clears the chord.
6. In the browser devtools, set the width to 375 px and re-check steps 3–5 by tapping.

## 9. Progression mode

A header toggle switches between **Explore** (§1–§8) and **Progression**. Key, scale and instrument are shared.

### 9.1 Model (`progression.js`)

- A progression chord is stored relative to the tonic: `RelChord = { steps, semis, quality }` (letter steps and semitones above the tonic). `resolveChord(key, rel)` spells the root as `spellPcWithLetter(rootPc + semis, letterAt(tonic.letter, steps))`, so a new root transposes the progression. A new scale keeps the chords where they are and re-analyses them (C–G–Am–F in C minor reads I V #vi IV). The tonic letter is kept across the change, so Fm7–Bb7–Ebmaj7 in Eb major keeps that spelling in Eb minor instead of becoming E#m7–A#7–D#maj7.
- `progression = { bars: [{ chords: [RelChord|null] }] }`, 1–16 bars of 4/4, each bar 1 chord or 2 halves. `flattenSlots()` gives `{ index, bar, half, beats, rel, chord }`. Slots are addressed by `{ bar, half }`.
- `parseNumeral(text, mode)` is the inverse of `romanNumeral()`. `PRESETS` are written as numerals in their own mode, so a minor preset in a major key comes out as borrowed chords.

### 9.2 Analysis (`analysis.js`)

- `analyzeChord` matches by symbol in the order diatonic → secondary dominant → borrowed → chromatic. A tonic-rooted dom7 (blues I7) stays `I7`, tonic function, `alsoActsAs: 'V7/IV'`.
- Function by unaltered degree. Major: I iii vi tonic, ii IV subdominant, V vii° dominant. Minor: i III tonic, ii° iv VI subdominant, v V VII vii° dominant. Altered roots: bIII T, bII and bVI S, bVII D in major. #vii° D in minor. Secondary dominants are D with a `target`.
- Cadences: authentic (V/V7 → tonic-rooted), plagal (degree 4 → tonic-rooted), deceptive (V → vi / VI), half (V ending a 4-bar phrase or the progression, no tonic after it), ii–V–I. With loop on, the last → first pair is checked and marked `wrap`.
- Advice items: `starts-away-from-tonic`, `secondary-resolves`, `secondary-unresolved`, `ends-on-tonic`, `ends-on-dominant` (a turnaround when looping into a tonic bar 1), `ends-on-subdominant`, `ends-on-other`, `empty-bars`. `adviceText.js` words them at two levels.
- `nextChords`: a secondary dominant's target first, then a per-degree table. A 7th chord gets 7th chords.

### 9.3 Notes over a chord (`overChord.js`)

- Chord scale: the key's parent scale (or, for a borrowed chord, its source scale, with harmonic minor taking precedence), with every letter the chord uses replaced by the chord tone. D7 in C → D Mixolydian, E7 in A minor → Phrygian dominant.
- Tiers per pc: `chord` (R/3/5/7), `blue`, `avoid` (a chord-scale note a half step above a chord tone, except b9/b13 over a dom7; or a selected-scale note the chord alters), `scale`, `parent` (in the parent but not the pentatonic/blues scale), `outside`. Labels come from letter distance: 9, 11, 13, 7 with b/#.
- Guide tones: the 3rd and 7th of a chord each move to the nearest tone of the next chord within a whole step. A common tone wins, ties move down.

### 9.4 Golden cases

| Case | Expected |
|---|---|
| I–V–vi–IV in G / Eb major | G D Em C / Eb Bb Cm Ab |
| C–G–Am–F in C minor | I V #vi IV |
| Andalusian in A minor / C major | Am G F E (i VII VI V) / Cm Bb Ab G |
| Over C in C major | chord C E G · scale D(9) A(13) B(7) · avoid F(11) |
| Over G7 in C | scale A(9) E(13) · avoid C(11) |
| Over Dm7 in C | scale E(9) G(11) B(13), no avoid |
| Over Em7 in C | scale A(11) · avoid F(b9) C(b13) |
| Over D7 in C | scale E(9) B(13) · avoid F(b3, clashes with F#) G(11) |
| Over E7 in A minor | scale F(b9) C(b13) · avoid G(b3, clashes with G#) A(11) |
| Over A7 in C | scale B(9) F(b13) · avoid C(b3) D(11) |
| Over Am in A minor pentatonic | scale D(11) G(b7) · parent B(9) · avoid F(b13) |
| Over Am in A blues | blue Eb(b5) |
| Guide tones | G7→C: B→C +1, F→E −1. Dm7→G7: F held, C→B −1. G7→Cmaj7: B held, F→E. E7→D7: G#→A, D held |
| C G Am F | deceptive G→Am. With loop: plagal F→C (wrap). Ends on subdominant |
| Dm7 G7 Cmaj7 | ii–V–I and authentic G7→Cmaj7 |
| 12-bar blues in A | A7 = I7 (tonic, also V7/IV), D7 = IV7, E7 = V7. Plagal D7→A7 in bars 6→7 and 10→11. Bar 12: half cadence, or with loop an authentic wrap and a turnaround |
| C, D7, Em | D7 (V7/V) unresolved |
| nextChords in C | G7 → Cmaj7, Am7. G → C, Am. D7 → G7 first. Ab → Bb, G |

### 9.5 State and playback

- New state: `mode`, `level`, `progression`, `selectedSlot`, `playback { playing, bpm, loop, click, playhead }`. Derived: `slots`, `analysis`, and `focus` (the playhead slot while playing, otherwise the selected slot) from `slotFocus()`.
- `transport.js` schedules on `AudioContext` time with a 25 ms timer and 100 ms lookahead. It reads fresh state for each slot, plays the chord on its downbeat (strummed on guitar) and an optional click on every beat, and moves the playhead with a `setTimeout` aligned to the audio clock.

