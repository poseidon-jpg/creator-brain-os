# Element Picker

Element Picker is a small tool that runs on your own computer. You open any animation made with HTML or JavaScript, pause it or scrub through it, and point at a piece of it. It outlines that piece, lets you show it on its own, and saves it so you can reuse it later.

It works on any page that draws an animation: web page parts, SVG, CSS, GSAP (a popular animation library), a canvas, or WebGL (3D drawing in the browser). You do not edit your page. The picker reads it.

## Run it

You need Python 3 and a browser. Nothing else to install.

1. Unzip the folder.
2. Open a terminal in the folder and run `python serve.py`. (On Windows, if `python` is not found, try `py serve.py`.) That serves the five examples. For your own video, give it the folder: `python serve.py my-video`.
3. Open the link it prints, for example `http://localhost:8765/__picker/index.html?page=gsap-launch/index.html`. With no `?page=` the picker lists the pages it found.

Use another port with `python serve.py my-video 9000`. Press Ctrl+C in the terminal to stop.

The server only answers on your own computer (127.0.0.1). It serves your video folder and nothing outside it.

## The three modes

The picker chooses a mode for each page and tells you which one in the **Mode** box under the picture. It also says why. You can switch by hand with the three buttons in that box. A button is greyed out when that mode does not fit the page.

**DOM mode** is for pages built from normal web page parts: text, boxes, images, SVG shapes. ("DOM" is the browser's name for the page's tree of parts.) Hover over the picture and the picker outlines the part under your mouse. Click to select it. The breadcrumb row widens your pick to its parent, then its grandparent. Solo hides everything outside your pick. A save keeps its CSS selector, a short piece of its HTML, its box and the time. This is the default for any page with parts to read.

**Element API mode** is for a canvas page that tells the picker what it is drawing. A canvas is one flat picture, so the picker cannot see inside it on its own. If the page offers `window.SM` (see "The element API" below), the picker uses it. You get exact outlines, thumbnails, groups, and when each element is on screen. `examples/shape-morph.html` is the worked example.

**Region mode** is the fallback for a canvas or WebGL page that has no element API and no parts to read. You drag a rectangle on the picture. The picker asks the page to draw the current frame, cuts that rectangle out of every canvas, and saves a PNG thumbnail with the box and the time. Download PNG saves the cut at full size.

How to tell which mode you are in: read the orange badge in the **Mode** box. DOM, Element API or Region. The line under it gives the reason. In Region mode the instructions on the right say "Drag a rectangle on the frame".

## How time is controlled

To pause and scrub, the picker needs to move the page to a chosen moment. It tries these four ways in order and uses the first one that works. The **Time** box names the one in use.

1. **`window.renderAt(t)` with `window.DURATION`.** The page draws any frame on request. This is exact. The sample videos in the lesson use it. (`window.SM.render(t)` also counts when there is no `renderAt`.)
2. **The GSAP global timeline.** The picker pauses GSAP and seeks it. It reads the length from the tweens on the timeline.
3. **CSS animations and Web Animations.** The picker pauses every one on the page (`document.getAnimations()`) and sets their time.
4. **Live only.** If the page has none of those, it runs on its own clock. Scrubbing and frame step turn off and the picker says so. Pause holds the picture where it can, by stopping the page's animation frames.

Frame step is 1/30 s. A page can set `window.FPS` to change that.

The picker adds `?capture` to your page address. Pages made for recording read that and stop playing on their own. Add `&nocapture=1` to the picker address to leave it off.

The picker also catches GSAP and CSS animations while the page loads, so a short one that is already finished by the time you look can still be scrubbed back.

### Options in the address

Add these after `?page=...`, joined with `&`:

- `size=1080x1920` sets the page size in pixels. The picker reads it from the page when it can (a fixed-size body or one big canvas). Otherwise it uses 1920x1080. You can also type a new size in the boxes next to **Time**.
- `dur=8` sets the length in seconds when the page does not say.
- `t=1.5` sets the time the picker opens at. By default it opens near the end, where most things have arrived.
- `mode=dom`, `mode=api` or `mode=region` forces a mode (ignored if the page cannot do it).
- `nocapture=1` leaves `?capture` off.

## Make your own page pickable

You do not have to. A normal DOM page works as it is. To make a canvas page scrub exactly, add two things:

```js
window.DURATION = 5;                    // how long it is, in seconds
window.renderAt = (t) => draw(t);       // draw the frame at time t (it may return a promise)
```

Optional: `window.ready` is a promise that resolves when fonts and images have loaded. If your page plays by itself, skip that loop when the address has `?capture`.

Read pixels from a WebGL canvas only right after `renderAt` has drawn. The browser clears a WebGL canvas after it shows it, so the picker asks the page to draw just before it reads.

Everything the page loads must sit inside the video folder. The picker does not use the network.

### The element API

To get exact picks on a canvas page, add `window.SM`. This is the smallest working version, about 15 lines:

```html
<canvas id="c" width="1920" height="1080"></canvas>
<script>
const g = document.getElementById('c').getContext('2d');
const things = (t) => [{ id: 'title', name: 'Title', cat: 'Text', bounds: { x: 200, y: 100, w: 700, h: 120 } },
                       { id: 'box', name: 'Blue box', cat: 'Shape', bounds: { x: 200 + 300 * t, y: 300, w: 400, h: 300 } }];
window.DURATION = 3;
window.renderAt = (t) => {
  g.fillStyle = '#111'; g.fillRect(0, 0, 1920, 1080);
  g.fillStyle = '#fff'; g.font = '100px sans-serif'; g.fillText('Hello', 200, 200);
  const b = things(t)[1].bounds; g.fillStyle = '#36f'; g.fillRect(b.x, b.y, b.w, b.h);
};
window.SM = {
  elementsAt: (t) => things(t),
  hit: (t, x, y) => things(t).reverse().find((e) => x >= e.bounds.x && x <= e.bounds.x + e.bounds.w && y >= e.bounds.y && y <= e.bounds.y + e.bounds.h) || null,
};
</script>
```

All coordinates are in page pixels (the stage), and `t` is in seconds. The contract:

| Part | Needed? | What it does |
|---|---|---|
| `SM.elementsAt(t)` | yes | Returns the elements on screen at `t`. Each has `id` (a stable string), `name` (what it looks like right now) and `bounds` `{x, y, w, h}`. |
| `SM.hit(t, x, y, tol)` | yes | Returns the element under a point, or `null`. `tol` is a few pixels of slack. |
| a way to draw `t` | yes | `window.renderAt(t)` (best) or `SM.render(t)`. |
| element `cat` | no | A category word: Shape, Text, Background, Effect. Fills the Category list. |
| element `what` | no | One sentence about it. |
| element `items`, `holes` | no | The true outline. Items are `{k:'poly', pts:[[x,y],...]}`, `{k:'rect',x,y,w,h}`, `{k:'disc',cx,cy,r}`, `{k:'ring',cx,cy,r,w}` or `{k:'line',pts,w}`. `holes` are polygons cut out of it. Without them the picker outlines `bounds`. |
| element `group`, `members` | no | A group lists the ids of its members. Its outline is all of them. |
| element `look` | no | A morphing shape keeps one `id` but changes `name` and `look`. Each look is its own pick. |
| `SM.meta` | no | `id` to `{ name, cat, parent, members, fn, assets, what, hover }`. Gives the breadcrumb (`parent`), the Layers row (groups, and anything with `hover: false`), and the source notes saved with a pick. |
| `SM.acts` | no | `[{ id, num, name, from, to }]`. Labels the timeline in chapters. |
| `SM.renderSolo(t, ids, { blur, bg })` | no | Draws only the named elements. `bg` is `grey`, `ink`, `paper` or `none`. Turns on the Solo button. |
| `SM.thumb(t, ids, { bounds })` | no | Returns `{ url, crop }`, a PNG of one element. Gives picks a picture. |
| `SM.measure()` | no | Returns when each element is on screen: `{ id: [[from, to], ...], 'id\u0001name': [[from, to]] }`. Gives the "On screen" range and Replay. |
| `SM.W`, `SM.H`, `SM.ready` | no | The stage size (default is read from the page) and a flag that is `false` until the page is ready. |

The Shape Morph example in `examples/shape-morph.html` fills in all of them. Give your agent that file and ask it to add the same API to your page.

## Where your picks go

- In this browser, so a reload keeps them.
- In `picks.json`, next to `serve.py`. `serve.py` writes it for you. It is never written inside your video folder. The file looks like `{ "keys": { "element-picker:<page>": "<json text>" } }`. The value is a JSON string whose `picks` list is in the order you dragged them. Thumbnails sit under the key ending `:thumbs`.

A pick holds the name, a category and note you chose, the time, how long it is on screen when the picker could measure it, the box, and the mode. A DOM pick also has its CSS selector and an HTML snippet. An Element API pick has the element id. A Region pick has the box and a PNG thumbnail.

**Copy for your agent** copies a clean list and draft entries as JSON. Paste that into your agent and ask it to turn the picks into reusable pieces. Each entry says how to find the piece again.

Keys: Space play or pause, Left and Right step a frame (Shift jumps a second), P pick mode (outline while it plays), S solo, B motion blur for the solo (Element API), R replay the entrance, L loop, Esc clear.

## Good to know

- DOM mode outlines a part by its box. A rotated web page part gets the box that fits around it. A rotated SVG shape gets its true corners. A part clipped by its parent is outlined where it is really visible, with the hidden rest dotted.
- Solo works by hiding every other part (CSS `visibility`) while the part you picked stays as the page draws it. Nothing in your files changes. The picker adds one style tag and one attribute at run time and removes them when you leave solo.
- A part with `pointer-events: none` that covers the whole picture (a grain or vignette layer) is skipped when you hover. A thin line is found even if your mouse is a few pixels off.
- DOM picks have no thumbnail, except images and canvases. The list shows a small sketch of where the part sits.
- The picker controls what the browser can control: renderAt, GSAP, CSS animations. An animation driven by your own timers or by script code you wrote can only be run live.
- Shadow DOM and frames inside your page are treated as one part.

## What is in this folder

- `serve.py` - the small local server. Python 3 standard library only.
- `picker/` - the picker (`index.html`, `picker.js`, `adapters.js`, `fonts/`). It lives at `/__picker/`.
- `examples/` - five pages to try:
  - `shape-morph.html` - Element API mode (a canvas that describes its own parts).
  - `gsap-launch/` - DOM mode, GSAP timeline.
  - `css-cards/` - DOM mode, CSS animations, no script at all.
  - `dom-renderat/` - DOM mode, SVG with `renderAt` and `DURATION`.
  - `canvas-aurora/` - Region mode, a WebGL canvas under a 2D canvas.
- `checks/` - the tests and their results (`CHECKS.md`). You do not need them to use the picker.
- `picks.json` - created the first time you save a pick.
