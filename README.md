# Music Teacher

A static web page for learning scales and chords on guitar and piano.

Pick an instrument, a root and a scale, and the scale lights up on the guitar neck or the keyboard. Click any note to see the chords that suit it:

- **Notes in the scale** list every diatonic triad and 7th chord that contains the note, with its Roman numeral and the note's role (root, 3rd, 5th or 7th).
- **Notes outside the scale** list chords borrowed from the parallel key and secondary dominants, with a short explanation of why the note is out of key.

Click a chord to see its tones on the instrument and hear it.

Scales: major, natural minor, major pentatonic, minor pentatonic, blues.

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
