# Music Teacher

## Intent

The intent of the project is to provide a web app which teaches chord progressions and scales for guitar and piano. The app is presented to user as a web page where user selects the instrument, either guitar and piano. User can select also root note / key and scale. The notes on the selected scale are highlighted, and user can select a note, and the app shows that which chords are suitable for that note given the root and the scale.

## Technology stack

Plain web page compiled with HTML and Vanilla Javascript. No backend, no database, no persistence of sessions or user management. 

## Features

- The main view in UI shows selected instrument: an acoustic guitar neck or a piano roll. This is based on user selection.  
- On the instrument selected scale is presented.
    - On a piano roll keys which belong to the scale are highlighted
    - On guitar neck the scale is highlighted by strings and frets
- When user clicks on a note, the app shows that which chords are suitable for that note based on the selected scale
- It is possible for user to select also note outside of the scale, and the app should also give chord recommendations to that note