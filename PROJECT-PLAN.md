# Music Teacher

## Intent

The intent of the project is to provide a web app which teaches chord progressions and scales for guitar and piano. The app is presented to user as a web page where user selects the instrument, either guitar and piano. User can select also root note / key and scale. The notes on the selected scale are highlighted, and user can select a note, and the app shows that which chords are suitable for that note given the root and the scale.

## Technology stack

Plain web page compiled with HTML and Vanilla Javascript. No backend, no database, no user management. The session is not persisted, but a composition can be exported to and imported from a JSON file (see Composer below).

## Features

- The main view in UI shows selected instrument: an acoustic guitar neck or a piano roll. This is based on user selection.  
- On the instrument selected scale is presented.
    - On a piano roll keys which belong to the scale are highlighted
    - On guitar neck the scale is highlighted by strings and frets
- When user clicks on a note, the app shows that which chords are suitable for that note based on the selected scale
- It is possible for user to select also note outside of the scale, and the app should also give chord recommendations to that note
## Composer

The second aim is a composing assistant. In the Composer view the user enters a chord progression and a melody, and the app helps with whichever one is missing or weak.

- Enter chords into bars and draw a melody on a piano roll with an adjustable grid. The roll shows, for every bar, which pitches are chord tones, which fit, and which to avoid over the chord in force.
- Melody help: the app marks notes that rub against the chords (an avoid note held long, an unresolved outside note, a bar that never lands on a chord tone, a leap left hanging) and explains why. It suggests likely next notes after the last note written.
- Chord help: for a melody without chords, each bar gets a ranked list of chords that fit the notes in it, and the user picks. The app can also suggest the most likely key for an entered melody.
- Bass help, after the two above: a bass roll with the same fit colouring, style patterns (root, root–fifth, alternating, walking) and warnings where the bass clashes with the melody.
- A style setting (pop/rock, jazz, folk) changes what the assistant prefers and what it warns about.
- A composition can be saved to and loaded from a JSON file. Nothing is stored in the browser; the session still resets on reload.
- Playback lights the sounding notes on the instrument. A guitar shows the bass an octave up on its four low strings, where a bass guitar's notes sit.

All of the above is built. The detailed decisions are in [IMPLEMENTATION-PLAN.md](IMPLEMENTATION-PLAN.md) §10, and the end-to-end check is in §8. Still out of scope: polyphony, triplets and swing, sections and repeats, melody generation, MIDI files and sharing a composition by URL.

## Sound

The Composer's three sounds (chords, melody and bass) can be shaped and balanced. Each lane has a 🎛 button that opens a sound editor. It offers presets (Warm pad, E-piano, Soft lead, Flute and so on) and simple controls: waveform, warmth, brightness, attack/decay/sustain/release and reverb. Changes are heard live, OK keeps them and Cancel reverts them. The Mix group has a level fader per lane and for the metronome. Chords now hold for their whole bar and then fade with an adjustable release. Sounds and levels are saved in the composition file. The design and milestones are in IMPLEMENTATION-PLAN.md §11.
