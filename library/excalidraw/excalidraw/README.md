# Excalidraw skill + Landing Pad

Have your agent draw hand-drawn whiteboard diagrams as code - then collect every one on a local Landing Pad where you hit Copy and paste the scene straight onto your live canvas, without replacing what is already there.

Two pieces:

1. **The skill** (`skills/excalidraw/`) - teaches your agent the whole flow: build scenes with the element library, the proven "3 levels" layout, the colour standard that makes levels readable, real logos and maps as embedded images, and the dark-mode colour gotchas that ruin diagrams.
2. **The Landing Pad** (`landing-pad/`) - a single local page that previews every scene your agent has built, with one-click Copy (paste adds to your canvas, never replaces it) and Download per scene.

## Install

1. Copy `skills/excalidraw/` into your agent's skills folder.
2. Put `landing-pad/` wherever you keep local tools, and tell your agent where it lives.
3. Say `/excalidraw [what to draw]` - for example `/excalidraw the 3 levels of skills` or "draw my content pipeline as a whiteboard diagram".
4. Open `landing-pad/index.html` in your browser, hit Copy on the scene, and paste onto your canvas (Ctrl+V).

Needs Node.js for the register step (`add-build.js`). The pad itself is one static HTML file - no server, no internet.

## What is in the box

- `skills/excalidraw/SKILL.md` - the skill: default flow, levels template, colour rules, image embedding
- `skills/excalidraw/references/excalidraw-format.md` - the .excalidraw JSON schema + element templates
- `landing-pad/index.html` - the pad (dark default, light toggle)
- `landing-pad/lib.js` - the element builders your agent codes scenes with
- `landing-pad/add-build.js` - registers one scene onto the pad
- `landing-pad/register-all.js` + `manifest.json` - re-register a standing set in one command
- `landing-pad/builds.js` - the pad's data file (starts empty; your agent fills it)

## License

CC BY 4.0 - use it, share it, adapt it. See LICENSE.
