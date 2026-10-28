# Music Teacher

A static web page for learning scales, chords and chord progressions on guitar and piano.

Pick an instrument, a root and a scale, and the scale lights up on the guitar neck or the keyboard. Click any note to see the chords that suit it:

- **Notes in the scale** list every diatonic triad and 7th chord that contains the note, with its Roman numeral and the note's role (root, 3rd, 5th or 7th).
- **Notes outside the scale** list chords borrowed from the parallel key and secondary dominants, with a short explanation of why the note is out of key.

Click a chord to see its tones on the instrument and hear it.

Scales: major, natural minor, major pentatonic, minor pentatonic, blues.

### Progression mode

Switch the header to **Progression** to build a chord progression of 1–16 bars in 4/4 (a bar holds one chord, or two with **½**). Load a preset (I–V–vi–IV, ii–V–I, 12-bar blues, Andalusian and more) or click a bar and pick a chord: the key's diatonic chords, borrowed chords, secondary dominants, or any custom chord.

Select a bar, or press **Play**, and the instrument shows what to play over that chord: chord tones (R 3 5 7), scale tones labelled as tensions (9, 11, 13), "also fits" notes from the parent scale when a pentatonic or blues scale is selected, the blue note, and avoid notes. The panel explains the chord's function, the guide tones that lead into the next chord, likely next chords (one click to insert), and the cadences and ending of the whole progression. A **Beginner / Intermediate** switch changes how the explanations are worded.

Chords are stored relative to the key, so changing the root transposes the progression. Changing the scale keeps the chords and re-analyses them.

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
