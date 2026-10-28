# AGENTS.md

Music Teacher is a static web page that teaches scales and chords on a guitar neck and on a piano. The intent is in [PROJECT-PLAN.md](PROJECT-PLAN.md). Read [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) before building a feature or changing music-theory behaviour. It holds the theory algorithms, the golden test cases and the milestone criteria.

## Running

- `npm test` runs the theory tests with Node's built-in runner.
- `npm run serve` serves the page at http://localhost:8000. ES modules do not load from `file://`, so always serve the page over HTTP.

## Stack

Plain HTML, CSS and native ES modules, loaded directly by the browser. The page is complete without a build step, a framework, a backend or a runtime dependency: write the feature in vanilla JS inside this repo. Use JSDoc comments where types help. Session state lives in memory only and resets on reload.

## Architecture

`js/theory/` is the pure core: functions of plain data, importable by Node, with no `document`, `window` or `AudioContext`. `js/ui/` and `js/audio/` call into theory, and theory imports only from `js/theory/`. Every change to state goes through the actions in `js/state.js`, and views re-render from the full state they are given. When a UI feature needs a music fact, add it to `js/theory/` with a test, then read it from the UI.

## Languages

The page is English and Finnish (`state.lang`, `'en' | 'fi'`). Words the theory produces live in `js/theory/text/en.js` and `fi.js`, which must have the same shape (a test checks it); `adviceText.js` and `text/index.js` are the entry points, and every text function takes `lang` last. Interface text lives in `js/ui/strings.js`. Static text in `index.html` is marked `data-i18n`. A new user-visible string needs both languages. Chord and note names for display go through `prettyName(note, lang)` and `chordLabel(chord, lang)`, never `noteName` (ASCII, for data and tests), because Finnish writes B natural as H and B♭ as B.

## Music-theory conventions

- Pitch class `pc` is an integer from 0 to 11, with C = 0. Instrument positions and audio use MIDI numbers (A4 = 69).
- A spelled note is `{ letter, acc }`. A displayed name always comes from a spelled note that has key or chord context: the scale spelling, the chord's letter-stacked spelling, or `defaultSpelling(pc, key.accidentals)` as the last resort.
- Chords are spelled by stacking letters (root, +2, +4, +6 letters). This is what makes Bb7 come out as Bb–D–F–Ab.
- Scales are defined only in the `SCALES` table in `js/theory/scales.js`. Pentatonic and blues scales take their chords from their `parent` scale.
- Roman numerals are measured against the key's parent scale: case shows quality, a `b`/`#` prefix shows a chromatic root, and the suffixes are `°`, `+`, `ø7` and `°7`.

## Done means

- Every change to `js/theory/` comes with tests. A new scale, chord quality or suggestion rule adds hand-checked golden cases next to the ones in `test/suggest.test.js`.
- `npm test` is green.
- For UI changes: serve the page and check both instruments, a chromatic note click and a chord click, at desktop width and at 375 px.

## Style

ES modules with named exports. Small pure functions. Colours and sizes are CSS custom properties in `css/styles.css`. JS sets classes and data attributes, and writes inline styles only for computed SVG geometry.
