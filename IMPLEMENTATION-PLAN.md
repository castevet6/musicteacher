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
js/theory/composition.js  ticks, lanes, chordAtTick(), composition file (§10)
js/theory/melodyFit.js    laneFit(), cellTiers() (§10)
js/theory/melodyCritique.js critiqueLane() (§10)
js/theory/nextNote.js     suggestNextNotes() (§10)
js/theory/harmonize.js    rankChords(), slotFit(), guessKeys() (§10)
js/theory/bassLine.js     bassTiers(), bassPattern(), critiqueBass() (§10)
js/ui/controls.js       instrument toggle, root and scale selects
js/ui/piano.js          SVG keyboard
js/ui/guitar.js         SVG fretboard
js/ui/chordPanel.js     chord suggestion list
js/ui/dom.js            h(), prettyText(), prettySymbol() shared by the panels
js/ui/chordStrip.js     bar strip with chord slots and fit dots (§10, was progressionStrip.js)
js/ui/roll.js           piano roll, used for melody and bass (§10)
js/ui/transportBar.js   play, tempo, grid, mix, title, style, files (§10)
js/ui/composerPanel.js  selection-driven tabs: chord, melody, bass, piece (§10)
js/audio/synth.js       Web Audio synth
js/audio/transport.js   lookahead scheduler for progression playback
test/notes.test.js
test/scales.test.js
test/chords.test.js
test/suggest.test.js
test/progression.test.js
test/overChord.test.js
test/analysis.test.js
test/composition.test.js
test/melodyFit.test.js
test/melodyCritique.test.js
test/nextNote.test.js
test/harmonize.test.js
test/bassLine.test.js
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


## 10. Composer

Composer replaces Progression mode. The header toggle is **Explore** | **Composer**; key, scale, instrument, level and language are shared. Composer keeps everything §9 built (chord strip, presets, analysis, advice, playback) and adds a melody roll, a bass roll, melody and bass assistance, chord ranking for a melody, key guessing, styles and JSON files. Requirements were settled in the design interview of 2026-11-12; this section is the result.

### 10.1 Scope decisions

| Topic | Decision |
|---|---|
| Modes | Explore and Composer. Progression mode's features move into Composer and the mode id `'progression'` disappears. |
| Time | 4/4 only, 1–16 bars (`MAX_BARS`), one linear loop. Grid of 1/4, 1/8 or 1/16. No triplets, no swing. Changing the grid never moves or deletes notes. |
| Lanes | Melody and bass, each monophonic, each its own roll. Chords stay in the strip. |
| Entry | Draw on the roll only. Click adds a note one grid step long and auditions it, clicking a note deletes it, dragging its right edge lengthens it, a note placed over an existing one replaces it. No step entry, no typing, no MIDI input. |
| Pitch storage | Melody and bass are absolute MIDI notes. Chords stay relative to the key. Moving the root picker offers a one-click transpose of the lanes; a key chosen from the key guess never transposes. A scale change never transposes. |
| Roll range | The selected instrument's range (guitar E2–G5, piano C2–B5), vertical scroll opening around C4. Bass roll E1–G3 regardless of instrument. Notes outside the range extend the roll and are drawn in the out-of-range style. |
| Assistance | Melody: fit map, six critique rules, next-note ghosts. Harmony: per-slot chord ranking, fit dot on filled slots, key guess on demand. Bass: fit map with root emphasis, style patterns, critique against the melody, ghosts. No generation. |
| Styles | `pop` (default), `jazz`, `folk`. A style changes ranking weights, critique thresholds and bass patterns, never the chord vocabulary. |
| Level | Beginner shows critique rules 1, 3 and 5 and the short texts; intermediate shows all six with their names. |
| Playback | Chords, melody and bass through the transport, separate timbre per lane, mute and solo per lane, play from the selected slot, loop toggle kept. The playhead lights the sounding melody note on the instrument (every guitar position). |
| Instrument clicks | Play the note and highlight its roll row. Nothing is placed. |
| Panel | Content follows the selection (slot → chord tools, note → melody or bass tools, nothing → piece overview), with a tab bar as override. |
| Files | JSON export and import with title, version, key, style, bpm, chords, melody, bass. Editable title becomes the file name. Import confirms before replacing a non-empty composition. No localStorage, no MIDI. URL sharing later. |
| Layout | Roll is the hero. Instrument above it, collapsible. Chord strip and rolls share one horizontal scroller so bars line up. |

Out of scope for this section: polyphony, triplets, sections and repeats, melody generation, MIDI import or export, URL state, a bass fretboard.

### 10.2 Model (`theory/composition.js`)

- Time is in ticks: `TICKS_PER_BEAT = 12`, `TICKS_PER_BAR = 48`. The grid id is the subdivision (`4 | 8 | 16`) and `gridTicks(grid) = TICKS_PER_BAR / grid`. Twelve ticks per beat leave room for triplets later without renumbering.
- A lane note is `{ start, length, midi }` in ticks. A lane is `{ notes: Note[] }`, sorted by `start`, never overlapping.
- `addNote(lane, note)` removes every note that overlaps `[start, start + length)` and inserts the new one. `removeNote(lane, start)`. `resizeNote(lane, start, length)` clamps `length` to at least one tick and at most the next note's start or the end of the last bar. `noteAt(lane, tick)`. `clampLane(lane, barCount)` drops notes starting at or past the end and trims notes that cross it. `transposeLane(lane, semis)`.
- `chordAtTick(slots, tick)` → the slot whose span covers `tick`, or `null` (slot spans come from `beats`). `segments(slots, note)` splits a note at slot boundaries into `{ start, length, slot }` pieces.
- `beatWeight(start)`: beat 1 → 3, beat 3 → 2, beats 2 and 4 → 1, any off-beat → 0.5. A segment's weight is `beatWeight(segment.start) * segment.length`.
- Composition file (`serializeComposition(state)`, `parseComposition(text)`):

```js
{
  version: 1, title: 'Untitled', rootPc: 0, scaleId: 'major', tonicLetter: 'C',
  style: 'pop', bpm: 90,
  progression: { bars: [{ chords: [RelChord | null] }] },
  melody: { notes: [{ start, length, midi }] },
  bass:   { notes: [...] },
}
```

`parseComposition` validates every field (unknown scale, quality, out-of-range midi, overlapping notes, more than 16 bars) and throws a `CompositionError` with `code` (`not-json`, `version`, `field`) and the `path` of the first bad field, which the UI words in both languages; it never half-loads. `fileName(title)` is the title slugged plus `.json`. `slotSpan(slot)` and `slotAtTick(slots, tick)` back `chordAtTick` and `segments`; `GRIDS` and `STYLES` are the allowed values.

### 10.3 Melody fit (`theory/melodyFit.js`)

- `laneFit(key, slots, lane)` → one entry per note: `{ note, segments: [{ start, length, slot, chord, tier, label, weight }] }`. The tier and label come from `notesOverChord(key, chord, analysis)` for the slot's chord (computed once per slot). With no chord in the slot: `scale` when the pc is in `key.scalePcs`, `parent` when only in `key.parentPcs`, `blue`, else `outside`.
- `cellTiers(key, slots)` → for each slot, the 12-entry tier array the roll paints its map with. An empty slot paints scale membership only.
- `tierScore`: `chord` 1, `scale` 0.4, `parent` 0.3, `blue` 0.3, `avoid` −0.5, `outside` −1. `noteFit(entry)` is the weight-averaged tier score of its segments, in −1…1.

### 10.4 Melody critique (`theory/melodyCritique.js`)

`critiqueLane(key, slots, lane, { style, level, grid })` → `[{ rule, noteIndex, data }]`, in note order. The six rules:

| # | id | Fires when |
|---|---|---|
| 1 | `nct-strong-beat` | A segment starting on beat 1 or 3 is not a chord tone, and the next note is not a step (≤ 2 semitones) away. |
| 2 | `avoid-held` | A segment in the `avoid` tier is longer than one grid step. |
| 3 | `outside-unresolved` | A note in the `outside` tier (or a chromatic `avoid` with reason `clash`) is not both approached and left by a half or whole step. |
| 4 | `big-leap` | The interval to the previous note exceeds the leap limit and the next note does not move back by step in the opposite direction. Limit: a sixth (9 semitones) in pop and jazz, a fifth (7) in folk. |
| 5 | `bar-no-chord-tone` | A bar that has notes but no segment in the `chord` tier. Fires once per bar, on the bar's first note. |
| 6 | `ends-off-chord` | The last note of the piece is not a chord tone of the chord in force under it. |

Style: jazz skips rule 2 for tensions over a dom7 (already not avoid) and lets rule 3 pass a chromatic note approached by step from either side and left by a half step. Level: beginner keeps rules 1, 3 and 5 only. Texts live in `text/en.js` and `fi.js` under `critique`, two levels each.

### 10.5 Next-note ghosts (`theory/nextNote.js`)

`suggestNextNotes(key, slots, lane, afterStart, { style, grid })` → up to three `{ midi, reason }` for the cell right after the note at `afterStart` (or after the last note). Candidates: every pitch within an octave of the previous note that is in the key or a chord tone of the chord in force at that cell. Score per candidate:

| Feature | Score |
|---|---|
| Chord tone at that cell | +3 |
| Scale tone | +1 |
| Step from the previous note | +2 |
| Resolves a tendency: 7th of the previous chord down a step, leading tone up to the tonic, an `avoid` note down a step | +3, reason `resolves` |
| Leap larger than a fifth | −2 |
| Same pitch as the previous note | −1 (jazz −2) |
| Beat 1 of a bar and this is the chord root or 3rd | +1 |

Return the top three with distinct reasons where possible (`chord-tone`, `step`, `resolves`, `leap-to-chord-tone`). With no previous note: the tonic, 3rd and 5th of the chord in force. Duration is one grid step.

### 10.6 Chord ranking and key guess (`theory/harmonize.js`)

- `rankChords(key, slots, lane, slotIndex, { style, loop })` → `[{ chord, roman, fit, score, reasons }]`. Candidates: `chordPalette(key)` (diatonic, borrowed, secondary). `fit` is the weight-averaged tier score of the melody segments inside the slot, each tier computed with `notesOverChord` for the candidate. `score = fit + bonuses`:
  - diatonic +0.2, primary degree (I, IV, V and V7, i, iv, v, V in minor) +0.05
  - style: jazz +0.1 for a 7th chord, pop and folk +0.1 for a triad
  - context: +0.1 when the previous chord → candidate or candidate → next chord forms a cadence in `findCadences` (loop-aware), −0.1 when the candidate equals the previous chord
  - a non-diatonic candidate is listed only if its `fit` beats every diatonic candidate's `fit`
  - an empty-melody slot ranks by `nextChords` of the previous chord (or the tonic first), with `fit = null`
- `slotFit(key, slots, lane, slotIndex)` → the current chord's `fit` for the fit dot: `good` ≥ 0.7, `ok` ≥ 0.3, otherwise `clash`; `null` when the slot has no melody.
- `guessKeys(melody, slots, bass)` → top three `{ rootPc, scaleId, score, reasons }` over the 60 combinations of 12 roots × 5 scales. Pitch classes are weighted by note length (chord tones from filled slots count as a quarter note each). `coverage` is the weighted share of notes inside the scale. `score = coverage + 0.15 if the melody ends on the tonic + 0.05 if it starts on the tonic or 5th − 0.02 per scale note the melody never uses`. Reasons: `fits-all`, `fits-most(n)`, `ends-on-tonic`, `chords-diatonic`.

### 10.7 Bass (`theory/bassLine.js`)

- Range `BASS_LOW = 28` (E1) to `BASS_HIGH = 55` (G3). `bassTiers(key, slots)` is `cellTiers` with the chord root promoted to tier `root` and the 5th to `fifth`.
- `bassPattern(key, slots, patternId, { loop })` → a lane for every filled slot (empty slots stay empty). The root octave for a slot is the instance of the root pc nearest to the previous slot's last note, within 28–48 so a 5th above still fits; the first slot uses C2–B2.

| id | Style | Per slot of `n` beats |
|---|---|---|
| `root` | pop | root held for the slot |
| `rootFifth` | pop | root for the first half, 5th above for the second |
| `rootOctave` | pop | root for the first half, root an octave up for the second |
| `alternating` | folk | quarters: root, 5th below (above if below E1), root, 5th below |
| `walking` | jazz | quarters: root, 3rd, 5th, approach note a half step below the next slot's root (above when below the range); a 2-beat slot gets root and approach |

- `critiqueBass(key, slots, bass, melody, { style })`:

| id | Fires when |
|---|---|
| `clash-with-melody` | On a beat-1 or beat-3 tick, bass and melody sound a minor 9th (13 mod 12 = 1 above an octave or more) or a tritone, unless the chord is a dom7 and both notes are chord tones. |
| `not-chord-tone-at-change` | The bass note sounding at a slot's first tick is not a chord tone of that slot's chord. |
| `parallel-octaves` | Two consecutive bass notes and the melody notes sounding over them move by the same interval while an octave (or two) apart. |

- Bass ghosts reuse `suggestNextNotes` with bass weights: root +4, 5th +2, approach into the next slot's root +3, range clamped to the bass roll.

### 10.8 Golden cases

Melody fit, C major, one chord per bar unless noted, grid 1/8:

| Case | Expected |
|---|---|
| E quarter on beat 1 over C | tier `chord`, label 3, weight 36 |
| F half on beat 1 over C | tier `avoid`, label 11 |
| C quarter over G | tier `avoid`, label 11; over G7 `avoid` too; over Dm7 `scale`, label b7 |
| G whole note across C → G | two segments: `chord` 5 (48 ticks) and `chord` R (48 ticks) |
| D and C# over an empty slot | D `scale`; C# `outside` |
| Empty slot in A minor pentatonic: B | `parent` |

Critique, C major, chords C G Am F:

| Case | Expected |
|---|---|
| Bar 1: F quarter on beat 1, then E | nothing |
| Bar 1: F quarter on beat 1, then A | `nct-strong-beat` on F |
| Bar 1: F half note, grid 1/8 | `avoid-held` on F (and rule 1 unless E follows) |
| Bar 1: F, F#, G eighths | nothing |
| Bar 1: F# quarter then C | `outside-unresolved` on F# |
| C4, C5, D5 | `big-leap` on C5. C4, C5, B4: nothing |
| Folk style: C4, A4, B4 | `big-leap` on A4; pop: nothing |
| Bar 1: D F D F quarters | `bar-no-chord-tone` on the first D |
| Last note D over F (bar 4) | `ends-off-chord`; last note A: nothing |
| Beginner level, all of the above | only rules 1, 3 and 5 reported |

Next-note ghosts, C major:

| Case | Expected |
|---|---|
| After B4 over G, next cell over C | C5 first, reason `resolves` |
| After F4 over C (avoid), next cell over C | E4 first, reason `resolves` |
| After E4 over C, next cell over C | G4 and D4 among the three, D4 reason `step` |
| No notes yet, bar 1 over C | C4, E4, G4 |

Chord ranking, C major:

| Case | Expected |
|---|---|
| Slot: E, G halves | C first (fit 1, both chord tones), Em second; Am below both |
| Slot: F, A halves, jazz style | Fmaj7 and Dm7 above F and Dm |
| Slot: B, D, F, D quarters | G7 first, Bdim second (both fit 1; G7 is primary) |
| Slot: Ab whole | no diatonic chord fits; Fm (iv) and Ab (bVI) listed, Fm first |
| Slot 4: D whole, slots 1–3 C Am F, loop on | G above Dm (cadence into bar 1) |
| Empty melody in slot 2 after C | the `nextChords` order for C, `fit` null |
| `slotFit`: C with melody E G | `good`; C with F whole: `clash` |

Key guess:

| Melody (and chords) | Top results |
|---|---|
| C D E F G A B C, quarters | C major, then A minor |
| A C D E G A, ends on A | A minor pentatonic, A minor, C major pentatonic |
| F G A Bb C D E F | F major, then D minor |
| D E F# G with chords G D Em C | G major first, E minor second (`chords-diatonic`) |
| E G A Bb B D E | E blues first, E minor pentatonic second |

Bass, C | G7 looping:

| Pattern | Expected |
|---|---|
| `root` | C2 whole, G2 whole |
| `rootFifth` | C2 half G2 half, G2 half D3 half |
| `rootOctave` | C2 half C3 half, G2 half G3 half |
| `alternating` | C2 G1 C2 G1, G2 D2 G2 D2 quarters |
| `walking` | C2 E2 G2 F#2, G2 B2 D3 B2 (B2 approaches C3 in the loop) |
| Critique: bass E2, melody F4 on beat 1 over C | `clash-with-melody` |
| Critique: bass B1, melody F4 over G7 | nothing; over C: `clash-with-melody` |
| Critique: bass D2 on beat 1 of a C bar | `not-chord-tone-at-change` |
| Critique: melody C4 D4, bass C2 D2 on beats 1 and 2 | `parallel-octaves` |

### 10.9 State

```js
mode: 'explore' | 'composer',
style: 'pop' | 'jazz' | 'folk',
title: 'Untitled',
grid: 8,
melody: Lane, bass: Lane,
activeLane: 'chords' | 'melody' | 'bass',    // which roll was touched last
selectedNote: { lane, start } | null,
showMap: true,
instrumentCollapsed: false,
mix: { chords: 'on' | 'mute' | 'solo', melody: ..., bass: ... },
pendingTranspose: { semis } | null,         // set by setRoot when a lane has notes
playback: { ..., playhead: { bar, half }, sounding: { melody: midi | null, bass: midi | null } },
history: Composition[]                       // undo snapshots, milestone 10
```

Derived: `melodyFit`, `bassFit`, `cellTiers`, `bassTiers`, `critique`, `bassCritique`, `ghosts` (for the selected note's lane), `slotFits`, and `ranking` for the selected slot. Actions: `setStyle`, `setTitle`, `setGrid`, `addLaneNote`, `removeLaneNote`, `resizeLaneNote`, `selectNote`, `setShowMap`, `setMix`, `applyKey` (no transpose), `confirmTranspose`, `dismissTranspose`, `loadComposition`, `applyBassPattern`, `undo`, `setSounding`, `toggleInstrument`.

`setRoot` in Composer with notes in any lane sets `pendingTranspose` to the shortest signed distance (−6…5) and leaves the lanes alone; `confirmTranspose` applies `transposeLane` to both lanes. `setBarCount` runs `clampLane` on both lanes. `setMode` to `explore` stops playback.

### 10.10 UI

- `ui/roll.js`: `createRoll(container, { lane, low, high, onAdd, onRemove, onResize, onSelect, onAudition })`, rendered as SVG. The map is one rect per row per slot (not per cell), grid lines are one group, notes are rects with a resize handle, ghosts are dashed rects, the selected note has a class, critique markers are small triangles on the note. A single pointer listener on the SVG converts coordinates to `(row, tick)` and snaps `tick` to the grid. Bar width is `--bar-width` so the chord strip and both rolls line up inside `.timeline` (one `overflow-x: auto` wrapper). Row labels sit in a sticky left column and use `displayName`. Rows outside the scale are shaded, the tonic row is marked.
- `ui/chordStrip.js` is `progressionStrip.js` renamed, minus the transport, plus the fit dot per slot.
- `ui/transportBar.js`: play, bpm, loop, click, grid selector, mix buttons per lane, title field, style select, Suggest key, Export, Import, Undo.
- `ui/composerPanel.js` replaces `progressionPanel.js`: a tab bar (Chord, Melody, Bass, Piece) whose active tab follows the selection unless the user pinned one. Chord tab: the existing picker and notes-over-chord list, with the ranking list on top when the slot's bar has melody. Melody tab: the selected note's fit, its critique items, ghosts. Bass tab: pattern buttons (apply to all or to the selected slot), fit, critique. Piece tab: the whole critique list, progression advice, key guess results.
- Instruments: in Composer `render` lights `playback.sounding.melody` (every position) and the hovered roll row; a click calls `onAudition` and sets a `hoverRow` highlight on the roll. The instrument section gets a collapse button.
- Legend: a composer legend with the map tiers, root and fifth for bass, and the fit dot states.
- All new strings in `ui/strings.js` and `theory/text/{en,fi}.js`, both languages, and the `data-i18n` attributes for new static markup.

### 10.11 Audio

- `synth.js` gains `playLead(midi, { when, duration })` (sawtooth through a low-pass filter, slightly louder than the chord voice) and `playBass(midi, { when, duration })` (sine plus a triangle an octave up, low-passed). Notes stop at their length with a short release.
- `transport.js` schedules per slot as now, and inside each slot also schedules every melody and bass note whose `start` falls in the slot's span, honouring `mix` (solo wins, then mute). Each note start also schedules `onSounding(lane, midi)` and its end `onSounding(lane, null)`. `transport.start(from)` starts at the selected slot. `transport.tick()` returns the current tick for the roll's playhead line, which the roll draws with `requestAnimationFrame` while playing.

### 10.12 Milestones

Each milestone is a commit, `npm test` green, both languages checked. "Try" is what to do in the browser to validate it.

| # | Work | Done when | Try |
|---|---|---|---|
| 1 | Rename Progression to Composer: mode id, toggle label, `chordStrip.js`, `composerPanel.js` skeleton with tabs, `.timeline` wrapper, collapsible instrument, composer legend. No roll yet. | Everything §9 did still works under the Composer label, tests green, Finnish labels present. | Load a preset, play it, collapse the instrument, switch language. |
| 2 | `composition.js`: ticks, lane ops, `chordAtTick`, `segments`, `beatWeight`, `clampLane`, `transposeLane`, `serializeComposition`, `parseComposition` + tests. | Tests cover add-replaces-overlap, resize clamps, clamp on bar removal, parse rejects every invalid field. | Nothing visible yet. |
| 3 | `roll.js` for the melody: draw, delete, resize, audition, selection, grid selector, row labels and shading, instrument range, alignment with the strip, instrument click highlights the row. State actions for the lane. | Twinkle Twinkle entered in C at 1/4 survives switching the grid to 1/8 and 1/16 and back, removing a bar trims it, and the roll scrolls with the strip at 375 px. | Enter a tune on both instruments, resize notes, change bars, change grid. |
| 4 | Playback: `playLead`, transport schedules melody notes, `sounding` lights the instrument, playhead line, mix buttons, play from the selected slot, transpose prompt on root change. | The tune plays in time with the chords from bar 1 or the selected bar, mute and solo work, and moving the root offers a transpose that moves the notes. | Play Twinkle over C F C G; solo the melody; change the root to D and accept. |
| 5 | Fit map: `melodyFit.js` + tests, map painting, saturated note colours, map toggle, fit dot on slots (`slotFit`). | The fit golden cases pass and the roll shows them. | Put F on beat 1 over C and watch it turn avoid-coloured; see the slot's dot go to clash. |
| 6 | Critique: `melodyCritique.js` + tests, markers on notes, Melody and Piece tabs, level gating, style selector with its texts. | The critique golden cases pass; markers and texts show in both languages and both levels. | Reproduce each golden row by drawing it. |
| 7 | Ghosts: `nextNote.js` + tests, dashed ghost notes after the selected note, click to place. | The ghost golden cases pass; placing a ghost adds a note of one grid step. | Write a phrase one ghost at a time. |
| 8 | Chord ranking: `rankChords` and `slotFit` in `harmonize.js` + tests, ranking list in the Chord tab, pick fills the slot. | The ranking golden cases pass; picking from the list fills the strip and updates the dot. | Enter a melody with no chords and harmonise it slot by slot. |
| 9 | Key guess: `guessKeys` + tests, Suggest key button, result list that applies root and scale without transposing. | The key guess golden cases pass and the melody stays put when a key is applied. | Enter the A minor pentatonic riff and pick a suggested key. |
| 10 | Files and undo: title field, Export, Import with confirm, `history` and Undo. | A round trip through a file reproduces chords, melody, title, style and bpm; undo reverts a deleted note. | Export, clear, import; delete a note and undo. |
| 11 | Bass roll: second roll instance with the bass range, `playBass`, bass in the transport and mix, `bassTiers` map with root and fifth. | Bass notes draw, play and show the root-emphasised map. | Draw a root-note bass under the chords. |
| 12 | Bass patterns: `bassPattern` + tests, pattern buttons for all slots or the selected slot. | The bass pattern golden cases pass; applying a pattern fills the bass roll. | Apply walking over a ii–V–I and listen. |
| 13 | Bass critique and ghosts: `critiqueBass` + tests, bass tab, bass ghosts. | The bass critique golden cases pass and the markers show. | Put F4 over E2 on beat 1 and see the clash. |
| 14 | Polish: guitar shows bass an octave up on the low strings, 375 px pass of every tab, README and PROJECT-PLAN updates, §8 verification extended with a composer walkthrough. | The verification list runs clean on both instruments at desktop and 375 px. | Full walkthrough. |

Milestones 1–4 build the roll, 5–7 the melody assistant, 8–9 the harmoniser, 10 the files, 11–13 the bass, 14 the finish. Each theory milestone adds its golden rows to the test file named after the module.
