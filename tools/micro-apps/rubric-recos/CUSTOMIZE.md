# Make RUBRIC Recos your own

This folder is the **base version**. It works as it is. Your agent can change a copy, and you can always come back to this one.

## How the app is organised

- `server.mjs` has four parts, in this order: the `CONFIG` block (port, data folder, Agentic OS address, token), small helpers, **your choices** (reading and writing `state.json`), and the HTTP routes at the bottom.
- `index.html` has three parts: the styles at the top (colours are variables, dark by default, light on the toggle), the page, then the script. The script has these blocks: **cards** (`cardHtml`), **the ARMS column** (`renderRail`), **filters** (`apply`), **render**, **Skip and Done**, **views**, **your agent** (the sprite) and **start**.
- `features/` holds the cart, comments, Apply all comments and Home button. Each is one file with no dependencies.
- `index.html` is read on every request, so a page change needs only a reload. A `server.mjs` change needs a restart.

Things that are easy to break, so ask your agent to keep them: the `id` rule (an id never changes, so skips stay skipped), the shape of `recos.js` and `state.json` (add optional fields, never rename or remove one), the phone layout, the dark and light toggle, and the `esc()` and `cleanSvg()` calls wherever data goes into the page.

## Common changes

**Change the port.** Start it with `node server.mjs 50113`, or change the default `port` in the CONFIG block of `server.mjs`. If the skill tells you the link, tell your agent the new port too.

**Change the ARMS colours.** In `index.html`, find `--cA:#3f8fd4; --cR:#d99a1f; --cM:#9a66e0; --cS:#ff6b1a;` and swap the hex codes. Cards, the column, the counts and the drawings all follow. Change the names in `letters` in `data/recos.js` (keep the letters A, R, M and S).

**Point Apply all comments somewhere else, or hide it.** Change `agenticOs` in the CONFIG block. Set it to `''` to hide both Apply all comments and the Home button; the comments panel still has Copy.

**Add a filter.** Three places in `index.html`: put a `data-` value on each card in `cardHtml` (like `data-effort`), add a row of chips where the filters are built (search for `fh +=`), and add one condition to the `ok` line in `apply()`. Add a reset for it in `resetFilters()`.

**Add a field to every reco.** Add it to a few recos in `data/recos.js` (it is optional, so old files still work), show it in `cardHtml` through `esc()`, add a line to the header comment of `recos.js` that says what it is, and add a check to `check.mjs` if it has rules. Then tell your agent to fill it in on the next `/recos`.

**Change the empty state.** In `index.html`, find the `nodata` block. Change its words there. Its styles are under `/* no recos yet */`.

## Starter ideas

1. **A Doing pile.** A third mark between nothing and Done, with its own filter. Add `doing: {}` to the state in `emptyState` and a route like `/api/done`.
2. **Sort by Token Savings.** A sort switch that puts the biggest savings first inside each ARMS group.
3. **A history line.** The `/recos` skill adds `added: "20 Oct 2026"` to new recos, and the card shows "new" for a week.
4. **Download the cart.** A button beside Copy that saves the cart as a Markdown file.

## A ready-to-paste prompt for your agent

Fill in the line after "I want this change", then paste it all.

```
Copy the rubric-recos folder to a new folder next to it called rubric-recos-mine, and work only in the copy, so I keep the base version. Read README.md and CUSTOMIZE.md in the copy.

I want this change: <describe it in one or two plain sentences>.

Rules:
- Node only. No npm install.
- Give my copy its own port so it does not clash with the base version.
- Keep the CONFIG block at the top of server.mjs as the only place that names a folder, a port or an address.
- Keep data/recos.js and data/state.json compatible with the README. Only add optional fields.
- Keep esc() and cleanSvg() wherever data goes into the page, and keep the README Security model true.
- Keep it usable at 400px wide with no sideways scroll, and keep the dark and light toggle.
- Plain English in the screen text. No em dashes.
- When you finish, run node check.mjs in the copy and show me the result, check the change in a headless browser, then give me the one command that starts it and the link.
```

If your copy ever goes wrong, delete it and copy the base folder again.
