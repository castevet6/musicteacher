# Music Teacher

A static web page for learning scales, chords and chord progressions on guitar and piano.

Pick an instrument, a root and a scale, and the scale lights up on the guitar neck or the keyboard. Click any note to see the chords that suit it:

- **Notes in the scale** list every diatonic triad and 7th chord that contains the note, with its Roman numeral and the note's role (root, 3rd, 5th or 7th).
- **Notes outside the scale** list chords borrowed from the parallel key and secondary dominants, with a short explanation of why the note is out of key.

Click a chord to see its tones on the instrument and hear it.

Scales: major, natural minor, major pentatonic, minor pentatonic, blues.

### Composer

Switch the header to **Composer** to write a short piece (1–16 bars in 4/4) with chords, a melody and a bass line. The app helps with whichever part is missing or weak; it never writes the music for you.

- **Chords.** Load a preset (I–V–vi–IV, ii–V–I, 12-bar blues, Andalusian and more) or click a bar and pick a chord: the key's diatonic chords, borrowed chords, secondary dominants, or any custom chord. A bar holds one chord, or two with **½**. With a bar selected, the instrument shows what to play over its chord: chord tones (R 3 5 7), tensions (9 11 13), "also fits" notes, the blue note and avoid notes. The panel explains the chord's function, the guide tones into the next chord and likely next chords.
- **Melody.** Draw on the melody roll: click to add a note, drag to lengthen it, click a note to select it and again to delete it. The grid is 1/4, 1/8 or 1/16. The map behind the notes colours each pitch by how it sits over the chord. The app flags notes that rub (a held avoid note, an unresolved outside note, a big leap left hanging, a bar with no chord tone, an ending off the chord) and offers next-note ideas you can click to place.
- **Harmonising.** For a bar that has melody, the Chord tab ranks the chords that fit it; a dot on each bar shows how well its chord fits. **Suggest key** guesses the key from the notes and applies it without moving them.
- **Bass.** The bass roll works the same way, with a map that marks each chord's root and fifth. Patterns (root, root–fifth, octaves, alternating, walking) fill all bars or the selected one, and the app warns where the bass clashes with the melody, misses the chord at a change or moves in octaves with it.
- **Playback.** **Play** starts at bar 1, and **▶ Bar N** starts at the selected bar. Each lane has its own sound with mute and solo. The instrument lights the sounding notes; a guitar shows the bass an octave up on its four low strings.
- **Style and level.** The style (pop, jazz, folk) changes the chord ranking, the warnings and the bass patterns. **Beginner / Intermediate** changes how much is explained.
- **Files and undo.** Export saves the piece as a JSON file named after its title, and Import loads one back. **Undo** steps back through edits. Nothing is stored in the browser.

Chords are stored relative to the key, so a new root moves them with it; the melody and bass are actual pitches, and the app offers to transpose them. The panel's tabs (Chord, Melody, Bass, Piece) follow what you click. The instrument can be hidden to give the rolls more room.

### Languages

The page is available in English and Finnish. A toggle in the header switches between them, and the page starts in the browser's language (`?lang=fi` or `?lang=en` overrides it). The choice is not stored, so a reload goes back to the browser's language. In Finnish the notes follow the Finnish convention: B natural is **H** and B♭ is **B**, so B♭7 shows as B7.

## Run

The page uses native ES modules, so serve it over HTTP. Opening `index.html` directly from disk will not work.

```sh
npm run serve        # python3 scripts/serve.py 8000 (no browser caching)
```

Then open http://localhost:8000. Any static file server works.

## Test

```sh
npm test             # node --test, no dependencies
```

## Project docs

- [PROJECT-PLAN.md](PROJECT-PLAN.md): the original idea
- [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md): design, theory rules and golden test cases
- [AGENTS.md](AGENTS.md): working rules for coding agents
