# .excalidraw File Format (working template)

Verified working 2026-07-30 (higgsfield-models-map). Excalidraw's importer fills missing fields with defaults, but include the full set below - it imports clean.

## File shell

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://excalidraw.com",
  "elements": [ ... ],
  "appState": { "gridSize": null, "viewBackgroundColor": "#ffffff" },
  "files": {}
}
```

## Base fields (every element)

```json
{
  "id": "unique-string", "type": "...", "x": 0, "y": 0, "width": 100, "height": 100,
  "angle": 0, "strokeColor": "#1e1e1e", "backgroundColor": "transparent",
  "fillStyle": "hachure", "strokeWidth": 2, "strokeStyle": "solid", "roughness": 1,
  "opacity": 100, "groupIds": [], "frameId": null, "roundness": null,
  "seed": 101, "version": 1, "versionNonce": 101, "isDeleted": false,
  "boundElements": null, "updated": 1, "link": null, "locked": false
}
```

- `seed`/`versionNonce`: any fixed ints, unique-ish per element. Never use Math.random - fixed numbers are fine.
- `roughness`: 0 sharp, 1 normal hand-drawn, 2 extra sketchy.

## Element types

**Shapes**: `"rectangle"`, `"ellipse"`, `"diamond"`. Rounded rect: `"roundness": { "type": 3 }`.
Filled shape: set `backgroundColor` (e.g. `#ffec99`) + `fillStyle` `"hachure"` (diagonal sketch lines), `"cross-hatch"`, or `"solid"`.

**Text** - add on top of base:

```json
"text": "🍌 nano banana", "fontSize": 24, "fontFamily": 1, "textAlign": "left",
"verticalAlign": "top", "baseline": 21, "containerId": null,
"originalText": "🍌 nano banana", "lineHeight": 1.25
```

- `fontFamily`: 1 = Virgil (hand-drawn - default choice), 2 = normal, 3 = code.
- `baseline` ≈ fontSize * 0.85. Width ≈ chars * fontSize * 0.6 (rough is fine).
- Emoji render fine - cheap icons: 🍌 🎬 🎥 🌊 ✨ ⚡ 🧑 🤖 📦 🔗.

**Arrow** - add on top of base:

```json
"points": [[0, 0], [250, -65]], "lastCommittedPoint": null,
"startBinding": null, "endBinding": null,
"startArrowhead": null, "endArrowhead": "arrow"
```

- `points` are RELATIVE to the element's `x,y`. `width`/`height` = abs of the delta.
- Curvy arrow: `"roundness": { "type": 2 }` + intermediate points.
- `"line"` = same but no arrowhead.

## Layout tips

- Canvas is infinite; keep scenes roughly within 0-1400 x 0-800 so the first zoom-to-fit looks right.
- Leave 60-100px gap between a shape edge and an arrow start/end (unbound arrows don't snap).
- Standalone text next to shapes beats container-bound text (bindings need `boundElements` bookkeeping - skip it).

## Palette

Strokes: `#1e1e1e` black (default), `#e03131` red, `#2f9e44` green, `#1971c2` blue, `#f08c00` orange, `#9c36b5` violet.
Backgrounds: `#ffc9c9` red, `#b2f2bb` green, `#a5d8ff` blue, `#ffec99` yellow, `"transparent"`.
