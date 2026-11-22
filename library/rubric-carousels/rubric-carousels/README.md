![RUBRIC Carousels](assets/banner.png)

# RUBRIC Carousels

A local review app for Instagram carousels: see every carousel card by card, pin comments, approve, pick the cover, and hand the changes to your agent.

It comes with one sample carousel ("5 ways to keep your desk tidy") so you can try every feature right away. Your agent makes new carousels in the same folder format, and they show up on the next refresh.

It never posts to Instagram and never sets up keyword DMs. The `keyword`, `caption` and `status.json` are only shown in the app, so you can see each carousel's words and where it stands. You post the images yourself, or with your own tools.

**Apply all comments** works with the RUBRIC Agentic OS v2, a separate free download. It is optional: without it, Apply all comments copies the comments for you to paste into your agent.

## Quick start

You need Node.js 18 or newer. Nothing to install.

```bash
cd rubric-carousels
node server.mjs
```

Open http://localhost:50009. Port taken? Run `node server.mjs 50019` (any free port) and open that port instead.

To stop it, press `Ctrl+C` in the window where it runs (or stop it in your process manager).

To keep it running in the background, use any process manager (pm2, for example: `pm2 start server.mjs --name rubric-carousels`).

## Let your agent set it up

Paste this into your agent from inside this folder:

```
Read README.md in this folder, especially "The carousel folder format", "Snapshots" and "For the agent acting on a review".
Before you install, ask me:
- Do I post to Instagram myself, or with a scheduling tool? (This app never posts.)
- Do I have a tool that sends DMs when someone comments a keyword? (This app never sets one up.)
- Is Chrome or Edge installed on this computer?
- Is it OK to add one npm package (playwright-core) in this folder, so the app can make card snapshots?
- Should I keep the sample carousel or remove it?
Then start the app with node server.mjs. If port 50009 is taken, pick a free port (node server.mjs 50019) and tell me the link.
Tell me how to stop it (Ctrl+C in its window), and that a comment pin saves with the Save button or Enter.
Snapshots need Playwright, see Snapshots.
Then offer to make my first carousel: ask me for the topic, how many cards (10 at most, the cover counts),
my Instagram handle and a comment keyword. Copy the two files inside template/ into a new carousels/<slug>/ folder,
write its deck.js, run node tools/check.mjs on it, and make its snapshots.
```

## What you can do

- **The homepage** (`/`): one card per carousel with its cover (hover it to flick through the cards), its comment keyword, its Instagram status (Draft, Ready, Scheduled, Live), open comments and approvals. Filter by status, sort by My order, Last edited or Created, drag cards to reorder, press `/` to search. A click opens that carousel's review. **Review all** opens every carousel at once.
- **The review page** (`/review`, or `/review?c=<folder>` for one): one row per carousel, its cards in a sideways strip. The sidebar (`b`) lists the carousels and the open one's cards.
- **Click a card** to comment on that exact spot. A numbered pin drops and a comment box opens. Press **Save** or `Enter` to keep it.
- **Full view** (under each card) opens the card big. Arrows or `←` `→` step through the carousel, a click pins a comment, and "Your note on this card" holds a note for the whole card.
- **Approve** a card with `a` in the full view. Approved cards get a green edge.
- **Pick the cover** right on the row, or in the full view of the cover card.
- **Drag cards** in a strip to reorder the carousel.
- **Cart** (`c`): add single cards or a whole carousel, add a note to each, then **Copy for my agent**. Each pick carries its folder and its comments.
- **Copy comments** per carousel, or **Copy all comments** at the top.
- **Apply all comments** (`Shift+A`): the orange button in the lower right corner. Pick a model and effort, and the RUBRIC Agentic OS v2 (the separate, optional download) runs an agent that edits each commented carousel and re-makes its snapshots. The page then reloads with the comments marked applied. No Agentic OS running? The button copies the comments, the deck path and the steps for your agent instead, and says so in one line.
- **Video previews**: a card with a clip plays it over its snapshot while it is on screen. **Stop previews** (`p`) pauses them all. Carousels without clips work the same, just without motion.
- **Refresh snapshots** re-makes a carousel's card images after its deck changed. A tag on the row says when they are out of date. This needs Playwright once (see Snapshots).

Everything you do saves next to each carousel, in its `review.json`.

## The carousel folder format

A carousel is one folder inside `carousels/`. The folder name is its id in the app and in the address (`/review?c=tidy-desk`), so use lowercase letters, numbers and dashes. Folders starting with `_` or `.` are skipped.

```
carousels/<slug>/
  deck.js        everything about this carousel (you or your agent write this)
  index.html     the card engine: copy template/index.html unchanged
  review.json    your review, written only by the app (optional, starts empty)
  status.json    where it stands on Instagram (optional, no file = Draft)
  cover/         optional cover images (1080 x 1350 PNG, keep the top third empty for the title)
  items/         optional pictures or clips the cards use
  export/        the snapshots: made by tools/export-cards.mjs, never by hand
```

**Make a new one:** make a new folder `carousels/<slug>/` and copy the two files inside `template/` (`index.html` and `deck.js`) into it. Then edit `deck.js`, run `node tools/check.mjs carousels/<slug>`, then `node tools/export-cards.mjs carousels/<slug>`, and refresh the app. A carousel with no snapshots yet still shows up, with a **Make snapshots** button.

### deck.js

`deck.js` sets one object, `window.DECK`. It is JavaScript, because each card's drawing is a small function. `template/deck.js` lists every field with a comment, and `carousels/tidy-desk/deck.js` is a full working example.

```js
window.DECK = {
  page: 'Tidy desk carousel',          // title; the app drops a trailing " carousel"
  lede: 'One line about it.',          // shown on the storyboard page
  handle: '@yourhandle',               // on every card and on the phone mock
  keyword: 'TIDY',                     // optional comment keyword, shown on the homepage
  caption: 'The Instagram caption.',   // shown under the phone mock
  coverDefault: 'drawn',               // which cover option starts chosen
  covers: {                            // 'drawn' = the cover card's own drawing; others are images
    drawn: { label: 'Drawn desk' },
    sun:   { label: 'Orange sunrise', src: 'cover/cover-sun.png', dark: false }
  },
  cards: [                             // in order, 10 at most including the cover (Instagram's limit)
    { cover: true, scene: 'desk', style: '32bit', kind: 'photo', name: 'Cover', h: '5 ways to keep<br>your desk <b class="acc">tidy</b>' },
    { num: '01', scene: 'tray', style: 'dot', kind: 'photo', name: 'One tray', h: 'One <b class="acc">tray</b>', p: 'One short sentence.' },
    { num: '02', scene: 'cables', style: '32bit', dark: true, kind: 'photo', name: 'Cable clips', h: '...', p: '...' }
  ],
  scenes: {                            // drawings on a 540 x 675 canvas; keep the top third clear for the title
    desk() { box(40, 476, 460, 24, 6, C.D2, C.INK, 8); /* ... */ }
  }
};
```

**How many cards:** 10 at most, and the cover counts as one. A closing card ("save this" or "comment KEYWORD") is a common habit, not a rule.

Card fields: `cover` (the one cover card), `num` (any short text shown in orange above the title, like `'01'`; leave it out and the card shows no number, while the app labels it by its position), `name` (short label in the app), `h` (title: `<b>` bold, `<b class="acc">` orange, `<br>` new line), `p` (one or two short sentences), `scene` (a drawing in `scenes`, or `blank`), `style` (`32bit` pixel or `dot` dot matrix), `dark` (a black card), `kind` (`photo` or `video`), `anim` (redraw every frame), `still` (the moment in seconds an animated card is snapped at), `imgs` (pictures placed on the card), `labels` (text placed on the art). For a real clip on a card: `item`, `real: 'video'`, `realClip: 'items/clip.mp4'`, `realPoster: 'items/clip.jpg'`, and `DECK.realBox` for the box it plays in.

### Scenes

A scene is a function in `scenes`, called as `scene(t, api)`. `t` is the time in seconds: it moves only on cards with `anim: true`, and a snapshot uses `still` (or 0). `api.sprite(...)` places a pixel sprite. A scene draws on a 540 x 675 canvas; keep the top third clear for the title. The engine then turns the drawing into the card's `32bit` or `dot` look.

```js
scenes: {
  sun() { circ(270, 450, 110, C.OR, C.INK, 10); },
  pulse(t) { circ(270, 450, 80 + 20 * Math.sin(t * 3), C.OR); },      // needs anim: true on the card
  friends(t, api) { api.sprite('bot', 150, 420, 10, C.INK, true); api.sprite('heart', 330, 420, 10, C.OR, true); }
}
```

Helpers (all numbers are canvas pixels):

| Helper | What it draws |
|---|---|
| `box(x, y, w, h, r, fill, stroke, lineWidth)` | a rounded box; `r` can be a number or a list of 4 |
| `circ(x, y, r, fill, stroke, lineWidth)` | a circle |
| `ln([x1, y1, x2, y2, ...], colour, lineWidth)` | a line through the points |
| `poly([x1, y1, x2, y2, ...], fill)` | a filled shape |
| `win(x, y, w, h, fill, barColour)` | a window with a title bar and a shadow |
| `shBox(x, y, w, h, r)`, `shCirc(x, y, r)`, `shPoly([points])` | a hard ink shadow; draw it first, a little down and right of the shape (skipped on dark cards) |
| `lg(x0, y0, x1, y1, [colours])`, `rgr(x, y, r, [colours], offsetX, offsetY)` | a straight or round gradient to use as a fill |
| `pxText(text, x, y, cell, colour)` | pixel letters; only A D F M O P S exist |
| `api.sprite(name, x, y, cell, colour, bob)` | a pixel sprite, `'bot'` or `'heart'`, 8 cells wide; `bob: true` makes it hop on animated cards |
| `g` | the canvas 2D context, for anything else (`g.save()`, `g.rotate()`, ...) |

Colours: `C.INK`, `C.D2`, `C.MID`, `C.LT`, `C.CR`, `C.SAND`, `C.OR` (orange), `C.ORD`, `C.ORL`. `C.BG` paints a hole. On a dark card the engine flips the inks to cream, so draw with the same colours either way.

### export/manifest.json

Written by `tools/export-cards.mjs`. The app reads it to draw every card. Shape:

```json
{
  "title": "Tidy desk carousel", "lede": "...", "caption": "...", "keyword": "TIDY",
  "coverKey": "drawn", "coverIndex": 0,
  "covers": [ { "key": "drawn", "label": "Drawn desk", "thumb": "export/cover-drawn.jpg" } ],
  "cards": [
    { "i": 0, "num": null, "name": "Cover", "title": "5 ways to keep your desk tidy", "cover": true, "dark": false,
      "kind": "photo", "style": "32bit", "clip": null, "media": null,
      "file": "export/card-01.png", "thumb": "export/thumb-01.jpg" }
  ],
  "exportedAt": "2026-01-01T00:00:00.000Z"
}
```

`card-NN.png` is 1080 x 1350 (ready to post), `thumb-NN.jpg` is 432 x 540, and there is one `cover-<key>.jpg` per cover option. A card with a clip gets `media: { src, fit, rect }` (rect in percent of the card), which the app uses for the preview. If you make snapshots another way, write the same files and the same manifest shape.

### review.json

Written only by the app. Shape:

```json
{
  "version": 3,
  "cover": "sun",
  "order": [0, 1, 2, 4, 3, 5, 6],
  "approved": { "2": true },
  "comments": [
    { "id": "cm123", "target": "tidy-desk#1", "label": "Tidy desk carousel · 01 One tray",
      "x": 50, "y": 70, "text": "Make the arrow bigger", "created": "2026-01-01T00:00:00.000Z" }
  ],
  "saved": "2026-01-01T00:00:00.000Z"
}
```

Card numbers are the card's index in `deck.js`, starting at 0. `target` is `<folder>#<index>`. `x` and `y` are the pin in percent across and down the card; both `null` means a note on the whole card. An applied comment gets `"status": "applied"` and an `appliedNote`. `version` goes up on every save, and a save with an old version is refused, so two tabs never overwrite each other.

### status.json

Optional. There is no status button in the app: you or your agent edit this file when the carousel moves on, and the homepage shows it on refresh. No file, or an unknown value, means Draft. Nothing here posts anything.

```json
{ "status": "scheduled", "at": "2026-01-15T09:00:00+10:00", "url": "https://www.instagram.com/p/..." }
```

`status` is `draft`, `ready`, `scheduled` or `live`. `at` is shown for scheduled and live posts. `url` (web links only) adds an Instagram link on the homepage.

## For the agent acting on a review

1. Read `carousels/<slug>/review.json`: the cover pick, the approved cards, the new order and every comment with its card and pin position.
2. Leave approved cards alone. Make each comment's change in `deck.js` (or swap the cover image). If the order changed, reorder the `cards` list to match.
3. Run `node tools/export-cards.mjs carousels/<slug>` so the snapshots match, then `node tools/check.mjs carousels/<slug>`.
4. Do not edit `review.json`. The page marks comments applied itself after an Apply run. When you work from copied comments, tell the user which ones you applied.
5. Never edit the app files (`server.mjs`, `home.html`, `index.html`, `features/`) while acting on a review. Only the carousel's own folder changes.

## Snapshots

The app runs without any install. Making snapshots needs Playwright. The exporter looks for `playwright` or `playwright-core` in `node_modules` in this folder or any folder above it, the way Node always looks. If neither is there, install it once, in this folder:

```bash
npm install playwright-core
```

That drives the Chrome or Edge you already have. With no Chrome or Edge, use `npm install playwright` and `npx playwright install chromium` instead. Then **Refresh snapshots** works in the app, and so does:

```bash
node tools/export-cards.mjs carousels/<slug>            # every card, every cover option
node tools/export-cards.mjs carousels/<slug> --thumbs-only
```

Already have Playwright installed somewhere else? Point Node at that `node_modules` folder instead of installing again: set `NODE_PATH` to it before starting the app (for example `NODE_PATH=/path/to/node_modules node server.mjs`, or `set NODE_PATH=C:\path\to\node_modules` first on Windows). The same works for running the exporter by hand.

Without Playwright the button shows a one-line install instruction and nothing breaks. Your agent can also make the snapshots with any headless browser: open `carousels/<slug>/index.html?solo=<index>&still=1&cover=<key>` at 1080 x 1350, wait for `html[data-ready="1"]`, and screenshot it, then write the manifest above.

## Settings

Copy `env.example` to `env.local` and set any of these. All are optional.

| Setting | Default | What it does |
|---|---|---|
| `CAROUSELS_PORT` | `50009` | The port. A number after `node server.mjs` wins over it. |
| `CAROUSELS_DIR` | `carousels` | The folder of carousels, relative to this folder or absolute. |
| `CAROUSELS_OS_ADDRESS` | `http://localhost:50000` | Where the RUBRIC Agentic OS runs, for Apply all comments. |
| `RUBRIC_TOKEN` | not set | A shared secret every `/api` call must carry. |

## Security model

- The server listens on `127.0.0.1` only, so nothing else on your network can reach it.
- It sends no CORS headers. An `/api` call that comes from another website, or from a page on another port, is refused (403).
- Requests addressed to any host name other than `localhost` or `127.0.0.1` are refused (403). This blocks DNS rebinding, where a website points its own name at your computer.
- `PUT` and `POST` calls must be JSON, so a plain web form on another site can't post to it (415).
- Optional `RUBRIC_TOKEN`: when set, every `/api` call needs the matching `x-rubric-token` header (401 otherwise). The app's own pages get it automatically.
- Request bodies are capped at 1 MB (413).
- It serves only its two pages, the `features/` and `assets/` folders, and files inside a carousel's folder (`/c/<slug>/...`). A carousel must be a real folder in `carousels/`, and any path that would leave its folder is refused (404).
- Text from carousels and comments is escaped before it goes into the app pages.
- A carousel's `deck.js` is code. It runs in your browser when you open that carousel's storyboard or full view, and inside the snapshot browser. Only put carousels you trust in the `carousels/` folder.
- It writes only `review.json` in a carousel's folder, `carousels/_home.json` (the homepage order), and, when you press Refresh snapshots, that carousel's `export/` folder. It reads `env.local` if you made one.
- It starts a program only when you press Refresh or Make snapshots: Node runs `tools/export-cards.mjs` on that one carousel folder. The snapshot browser blocks every request that is not a local file.
- The server makes no network calls of its own, and the pages load nothing from the internet (the fonts ship in `assets/`). There is no tracking.
- The one call to another address: **Apply all comments**, when you press "Apply with", sends the open comments, the carousel's folder path and the steps to the Agentic OS address (default `http://localhost:50000`, on your computer). If nothing answers, the comments are copied to your clipboard instead.
- It stores no credentials. The only secret is `RUBRIC_TOKEN`, if you set it, in `env.local`.
- Your browser keeps small conveniences in local storage: the cart, the theme, the sidebar, the preview switch and the Apply model pick.

## Folder map

| Path | What |
|---|---|
| `server.mjs` | The app. Node built-ins only. The CONFIG block at the top names every folder, the port and the Agentic OS address. |
| `home.html` | The homepage at `/`. Read on every request, so a change shows on refresh. |
| `index.html` | The review page at `/review`. Also read on every request. |
| `features/` | The cart, click-to-comment, sidebar and Apply button the review page uses. |
| `assets/` | The banner, the fonts (Outfit and Doto, SIL Open Font License) and `fonts.css`. |
| `carousels/` | Your carousels. `tidy-desk/` is the sample. |
| `template/` | The card engine (`index.html`) and a starter `deck.js` to copy for a new carousel. |
| `tools/export-cards.mjs` | Makes a carousel's snapshots and `export/manifest.json`. |
| `tools/check.mjs` | Checks a carousel folder against the format above. Reads only. |
| `env.example` | The optional settings. Copy it to `env.local`. |
| `CUSTOMIZE.md` | How to change the port, the look, the card size, add a field or a status. |

## License

MIT. See `LICENSE`. Copyright (c) 2026 Jay E | RoboNuggets (robonuggets.com). The fonts in `assets/fonts/` are under the SIL Open Font License 1.1 (`assets/fonts/OFL.txt`).
