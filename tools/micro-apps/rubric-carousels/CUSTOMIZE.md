# Make RUBRIC Carousels your own

This folder is the **base version**. It works as it is. Your agent can change a copy, and you can always come back to this one.

## How the app is organised

- `server.mjs` reads `env.local` first, then has four parts, in this order: the `CONFIG` block (folders, port, the Agentic OS address), **carousels** (finding the folders, reading `review.json` and `status.json`), **snapshots** (running `tools/export-cards.mjs`), and the HTTP routes at the bottom.
- `home.html` is the homepage. Styles at the top (colours are variables, dark by default, light on the toggle), then the page, then the script: data, `card()`, `render()`, hover flick-through, drag to reorder.
- `index.html` is the review page. Its script has blocks for **saving** (`saveReview`), **rows** (`render`, `tile`), **previews**, the **big view**, **exports for the agent** (`carouselText`), **events**, and the **features** setup at the bottom (cart, comments, sidebar, Apply).
- `template/index.html` is the card engine. Every carousel has its own copy beside its `deck.js`.
- Page files are read on every request, so a change to `home.html` or `index.html` shows on refresh. A change to `server.mjs` needs a restart.

Things that are easy to break, so ask your agent to keep them: the `version` number on every review save (a stale save is refused, so two tabs never erase each other), the shapes of `deck.js`, `export/manifest.json`, `review.json` and `status.json` in the README (add optional fields, never rename or remove one), the dark and light toggle, and the Security model in the README (every sentence must stay true).

## Change the port

Run `node server.mjs 50019`, or copy `env.example` to `env.local` and set `CAROUSELS_PORT=50019`. The default lives in the `CONFIG` block at the top of `server.mjs`. Apply all comments keeps working from the new port, since the Agentic OS takes requests from local pages on any port.

## Change the look

- **The app** (homepage and review page): the colour variables at the top of `home.html` and `index.html`, one set for dark (`:root, html[data-theme="dark"]`) and one for light. `--accent` is the orange. The fonts load from `assets/fonts.css`; swap the files in `assets/fonts/` and the names there to change them.
- **The cards**: in `template/index.html`, the `:root` variables at the top of the styles (`--beige` card, `--black` dark card, `--or` orange) and the `C` palette in the script (the colours the drawings use). Your handle comes from `handle` in each `deck.js`; the small mark after it is `HEX` in the script.
- Each carousel keeps its own copy of the engine, so old carousels keep their look. To move one to the new look, copy the new `template/index.html` over its `index.html` and run `node tools/export-cards.mjs carousels/<slug>`.

## Change the card size

The cards are 4:5 (1080 x 1350), Instagram's tallest feed size. For square 1:1 cards, change these together:

1. `template/index.html`: `aspect-ratio:4/5` on `.card`, and `const W = 540, H = 675` (make `H = 540`). Redraw the scenes to fit the new height.
2. `tools/export-cards.mjs`: every `w * 1.25` becomes `w`, and `CH = 675` becomes `540`.
3. `home.html`: `aspect-ratio:4/5` on `.cv`.
4. `index.html`: `aspect-ratio:4/5` on `.shot`, `.vcard`, `.pill img` and `.covpick .cp img`, and the `1.25` in `.vcard`'s height.
5. Copy the new engine into each carousel and make its snapshots again.

## Add a field

Example: alt text for each card, so the cart and copied comments carry it.

1. In `deck.js`, add `alt: 'A desk with a tray of paper'` to a card. The engine ignores fields it does not know.
2. In `tools/export-cards.mjs`, add `alt: c.alt || null` to the object pushed into `cards`, so it lands in `export/manifest.json`.
3. In `index.html`, read `cardOf(d, i).alt` where you want it: for example add `Alt: c.alt` to the `lines` in `tile()` so the cart carries it, or show it in `side()` under the title.
4. Add it to the README's format section as optional.

## Add a status

Example: `approved` between Ready and Scheduled.

1. `server.mjs`: add it to `STATUSES`.
2. `home.html`: add it to the `STATE` map with its label, to the filter list in `render()`, to the stats line, and give it a colour: a `--approved` variable in both themes and a `.d.approved` rule.
3. `tools/check.mjs`: add it to the list of valid values.
4. README: add it to the `status.json` section.

## A ready-to-paste prompt for your agent

Fill in the feature line, then paste it all.

```
Copy the folder first so you keep the base version. Copy the whole rubric-carousels folder to a new folder next to it called rubric-carousels-mine, and work only in the copy. Then read README.md and CUSTOMIZE.md in the copy.

I want this change: <describe it in one or two plain sentences>.

Rules:
- Node only for the app. No npm install for the server, no imports from other apps.
- Give my copy its own port (CAROUSELS_PORT in env.local) so it does not clash with the base version.
- Keep the CONFIG block at the top of server.mjs as the only place that names a folder, a port or an address.
- Keep deck.js, export/manifest.json, review.json and status.json compatible with the README. Only add optional fields.
- Keep the version number on every review save and the rule that an out-of-date save is refused.
- Keep the dark and light toggle, and keep the pages usable at 400px wide.
- Keep every sentence in the README's Security model true. Update it if you change what the server reads, writes or calls.
- Plain English in the screen text. No em dashes.
- When you finish, run node tools/check.mjs in the copy, check the change in a headless browser, then tell me the one command that starts it and the link to open.
```

If your copy ever goes wrong, delete it and copy the base folder again.
