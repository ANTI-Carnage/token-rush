# Token Rush

A top-down treasure-hunt game for the browser. Crack open chests, dodge monsters and bad loot, stay inside the storm circle, and find the **golden token** hidden in one chest on every level.

**Play it:** https://anti-carnage.github.io/token-rush/ (also at https://token-rush.sites.tab.bot/)

Works on phones (touch) and on computers and Chromebooks (keyboard). No install, no downloads.

## Controls

| | Keyboard | Phone / touch |
|---|---|---|
| Move | WASD or arrow keys | Drag anywhere on the screen (joystick) |
| Open a chest | Hold SPACE or E next to it | Hold the OPEN button |
| Pause | P or Esc | II button (top right) |
| Sound on/off | M | Speaker button |

## How it plays

- Chests glow by rarity: grey, green, blue, purple, gold. Better rarity means better loot and fewer traps, but they take a little longer to open.
- **Good loot:** shield (blocks one hit), speed boost, extra life, token radar (an arrow points to the token), freeze blast, gold for points.
- **Bad loot:** trap bombs (run!), slime that slows you, storm surge, fake "mimic" tokens that come alive, and ambushes.
- Purple blobs chase you, red spiky dashers charge at you. Touching one costs a life (a shield takes the hit instead). Trap explosions take out monsters too.
- The storm shrinks in phases and closes in near the token. Outside the circle you lose a life every couple of seconds, and shields don't help.
- Each level adds more chests, more monsters, more bad loot and a faster storm. Clear level 10 to become a Token Legend, then keep going. Your best score is saved in the browser.

## Files

`index.html`, `style.css`, `game.js`, `icon.svg`. Plain HTML5 canvas and JavaScript, no libraries and no build step. All the art is drawn in code and the sounds are made with WebAudio, so everything here is original.

## GitHub Pages

Settings > Pages > Deploy from a branch > `main` / root.
