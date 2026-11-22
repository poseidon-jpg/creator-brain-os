---
name: excalidraw
description: Create Excalidraw diagrams (hand-drawn whiteboard style). Default path builds the scene locally with the landing pad's lib.js and registers it on the Landing Pad, where the user clicks Copy and pastes onto their live canvas without replacing what is already there. Triggers on "/excalidraw", "excalidraw", "draw this in excalidraw", "excalidraw diagram", "whiteboard diagram", "hand-drawn diagram", "sketch this as a diagram".
---

# Excalidraw Diagrams

## Trigger Phrases
- "/excalidraw [what to draw]"
- "draw this in excalidraw" / "excalidraw diagram"
- "whiteboard diagram", "hand-drawn diagram", "sketch this"

## The landing pad - the DEFAULT for every build

**Build the scene locally, register it on the landing pad, open the pad. That is the whole flow.** The user clicks Copy there and pastes onto whatever canvas they are working on.

**Why it is the default, not just an option:** opening or dragging a `.excalidraw` file REPLACES the whole scene, so it destroys whatever is already on the board. Pasting adds. The pad is the path that neither destroys nor strands - and it accumulates a reusable library instead of scattering one-off files.

The `landing-pad/` folder (shipped with this resource) holds the whole system:

| File | Does |
|---|---|
| `index.html` | the pad - previews + one-click copy, dark default |
| `lib.js` | element builders - `rect` `ellipse` `textAt/L/R` `arrow` `poly` `box` `title` `kicker` `grouped` `scene` `levelGrid` + the `C` palette |
| `add-build.js` | registers one scene onto the pad |
| `register-all.js` | re-registers everything listed in `manifest.json` |

**Build with `lib.js`, never hand-written element JSON.** It handles ids, seeds, text measurement, and grouping. Coordinates are plain pixels; keep a scene inside roughly 1000 x 550.

```js
const { C, rect, textAt, arrow, box, title, grouped, scene } = require('./lib.js');
```

### The LEVELS template - `levelGrid()`

A proven layout for any "3 levels of X" beat:

```js
levelGrid({
  header: 'SKILLS',
  sub: 'SOPs. Do a task twice, make it into a skill.',
  levels: [
    { title: 'Level 1:', body: 'Use pre-built skills,\nor build your own' },
    { title: 'Level 2:', body: 'Skills with their own\nfile sets' },
    { title: 'Level 3:', body: 'Trigger skills outside\nof chat - headlessly' },
  ],
})
```

**No boxes.** Columns are 590px apart, far wider than they look like they need to be - the air is what makes it read on camera. Header and subtitle sit over column ONE, not centred across all three. Each level is a title, a 200px hairline, and body copy tucked in close beneath (the vertical rhythm is encoded in `levelGrid`'s `Y` table - do not loosen it).

**Colour standard (this helps the eyes):**
- Level 1 = neutral `C.black` (displays white on a dark board), muted hairline.
- Level 2 = `C.blue2` (#1971c2) - title, hairline, AND body all blue.
- Level 3 = `C.hot` title + hairline, `C.orange` body.
- **Illustrations colour-code to the level that ADDS the element.** Whatever carried over from an earlier level goes neutral (`C.black` strokes, `C.muted` connector lines); only the elements new at this level wear its colour. That is what makes the eye track "what's new" instantly.

Per-level `illus` hooks take `(cx, iy)` and draw beneath the copy - anchor (chip/folder) centre at `iy-60`, children fan to `iy+62`, same fan geometry each time so sibling scenes rhyme. Icon builders in `lib.js`: `tag` `fileIcon` `boltIcon` `folderIcon` `eyeIcon`, all wordless except `tag`.

Body copy takes literal `\n` - standalone excalidraw text does not wrap on its own. Two short lines max; the tightened spacing has no room for a third.

Then register and open:

```bash
cd landing-pad && node add-build.js "<path to scene>.excalidraw" <slug> "<Title>" "<one-line note>" [project]
```

Open `landing-pad/index.html` in a browser. Same slug overwrites, so iterating never duplicates.

### Real images inside scenes

The pad pipeline carries embedded images end to end: `add-build.js` stores a scene's `files` (dataURL images) into builds.js, and the pad's Copy, Download, and SVG preview all pass them through. Use excalidraw `image` elements (`type:"image"`, `fileId`, `status:"saved"`, `scale:[1,1]`) + a `files` dict entry (`mimeType`, `dataURL` base64, `created`).

- **Maps and logos are REAL assets, never approximated shapes.** Blob "maps" and letter-circle "logos" read as fake instantly. Fetch actual SVGs: brand logos from `cdn.simpleicons.org/{name}/{hex}` (colored for a dark canvas), missing ones from Wikimedia Commons (`Special:FilePath/{File}.svg` via the commons search API). Public-domain maps from Wikimedia.
- **Recolor dark-fill logos light** (inject `fill` on the svg root) so they render true on a dark canvas.
- Pixel-art content (grids of cells) can ship as ONE embedded SVG image instead of hundreds of rect elements - far lighter to paste.

**Rules that carry:**
- **Group every scene** via `grouped(slug, elements)` so one paste behaves as one draggable object.
- **Placement belongs to the user.** Paste lands at their cursor, so absolute coordinates do not survive. If a build MUST sit at exact coordinates beside existing elements, have them export their board (menu, then Export to file), merge into that file's `elements` array, and hand the merged file back.
- **Scenes save flat** in one scenes folder as `<what-it-shows>.excalidraw` - short descriptive kebab-case, never `diagram1`.
- **Dark-mode inversion gotcha:** Excalidraw's dark mode inverts lightness at render time (hue survives, so oranges stay orange). The consequence that catches you out: excalidraw's own default black `#1e1e1e` **displays WHITE** on a dark board. That is `C.black` in `lib.js` - reach for it when you want white text, never a light hex. Saturated colours (`orange` `hot` `blue` `gold` `purple` `rust`) and mid greys (`muted`) survive the flip unchanged.
- **Look at it before handing it over.** Screenshot the pad headlessly and actually view the image. The pad's SVG preview approximates two ways: it uses a standard font (not the hand font), AND it does not invert colours - `C.black` elements render as near-invisible dark strokes on the dark preview even though they display white on the real canvas. Judge structure and layout from the screenshot, not colour; a faint-looking scene is normal. Tell the user this in one line when handing over a scene that previews faint.

### Checklist
- [ ] Scene built with `lib.js`, saved to the scenes folder, all elements grouped
- [ ] `node add-build.js ...` run - pad refreshed
- [ ] Headless screenshot taken and actually looked at
- [ ] Pad opened in the browser, path printed in the reply

## Shareable links (optional MCP)

Excalidraw runs a free public MCP server at `https://mcp.excalidraw.com/mcp` (HTTP, no auth, stateless). If your agent supports MCP servers, add it and use `export_to_excalidraw` - it takes serialized scene JSON and returns a shareable, editable excalidraw.com URL. Use this only when you want a fresh shareable board with nothing to preserve; the landing pad stays the default. The server is also plain JSON-RPC over HTTP, so a `curl` POST to the endpoint works without any MCP client (build the request body with a small script, never inline - the scene JSON needs escaping; the response is SSE and the URL is in the `data:` line).

## Style quick reference

Excalidraw palette - strokes: `#1e1e1e` (default black), `#e03131` red, `#2f9e44` green, `#1971c2` blue, `#f08c00` orange, `#9c36b5` violet. Backgrounds: `#ffc9c9`, `#b2f2bb`, `#a5d8ff`, `#ffec99`. Keep diagrams lowercase-casual, few colors, black default.

## Resources
- [references/excalidraw-format.md](references/excalidraw-format.md) - .excalidraw JSON schema + working element templates
