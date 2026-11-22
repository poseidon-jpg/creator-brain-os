![RUBRIC References](assets/banner.png)

# RUBRIC References

Save any site you love to your own inspiration wall. Click the extension's icon on a page and it saves a screenshot of what's on screen, plus the page's title and description, to a masonry wall that runs on your own computer. Add tags and a note while you're there. Connect your agent and it writes a plain-English one-liner and picks the tags for you.

The more great design you see, the better your taste gets. This keeps everything you liked in one place, for you and for your agent.

Shared free by [RoboNuggets](https://www.skool.com/robonuggets). License: CC BY 4.0 (see LICENSE).

## What's inside

```
rubric-references/
├── server.js        # the bridge: a small local server the extension saves to
├── build.js         # builds the wall page (data/index.html) from your saved sites
├── env.example      # settings. Copy it to env.local
├── extension/       # the Chrome extension. Load this folder in Chrome
│   ├── manifest.json, popup.html, popup.js
│   ├── config.js    # where the extension finds the bridge (+ optional token)
│   └── fonts/, icons
├── assets/banner.png
└── data/            # created on first run: index.html (the wall), shots/, references.json
```

## Quick start (about 5 minutes)

You need Node.js 18 or newer (check with `node --version`, get it at https://nodejs.org) and Google Chrome. There is nothing to `npm install`: the bridge has no dependencies.

1. Unzip the folder anywhere you like.
2. Copy `env.example` to `env.local`. You can leave every line blank for now.
3. Open a terminal in the `rubric-references` folder and run `node server.js`. Leave that window open.
4. In Chrome, open `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked** and pick the `extension` folder inside `rubric-references`.
5. Pin the icon (puzzle piece, then the pin) so it's one click away.
6. Go to a website you like the look of and click the icon. Then open http://127.0.0.1:5298/ to see your wall.

The terminal tells you on start whether the AI one-liner is on or off. Off is fine: see the next section to turn it on.

## Using it

- **Clicking the icon is the save.** The popup shows the screenshot. Fix the title, rewrite the description, toggle tags or add a note ("why I saved it, what to steal from it"). Every change saves straight away.
- **It captures exactly what's on screen.** Scroll to the part you want first.
- **Same site again** refreshes the screenshot and keeps your tags and note.
- **The grid icon** in the popup's top bar opens the wall from any page.
- **On the wall** you can search, filter by tag, switch dark or light mode, and hover a card to remove it.
- **Read only copy:** `data/index.html` also opens straight from disk, with no remove buttons. You can host the `data` folder as a plain static site if you want to share your wall.

## Let your agent write the one-liner and tags (optional)

Out of the box, each saved site keeps the page's own description and gets no tags until you pick some. Set `AGENT_CMD` in `env.local` and the bridge asks your agent instead, in the background, right after each save.

`AGENT_CMD` is any command that runs your agent once: it reads a prompt from standard input and prints the answer. The bridge sends the site's address, title, description and the first 1,600 characters of its text, and asks for one plain-English sentence plus 1 to 3 tags from the fixed list.

- If your agent is Claude Code, you can use: `AGENT_CMD=claude -p --model haiku --tools "" --no-session-persistence`
- For any other agent, use its non-interactive (one-shot) mode that reads the prompt from standard input. Ask your agent: "what command runs you once, with the prompt on standard input, printing plain text?"
- Pick a small, cheap model. The job is one sentence. Turn tools off if your agent allows it.

Restart the bridge after changing `env.local`. If your agent fails or takes longer than `AGENT_TIMEOUT_SECONDS` (90 by default), the card keeps the page's own description, the popup says so, and the terminal shows why. The bridge never crashes over it.

## Use your wall as a reference library for your agent

Everything lives in the `data` folder: `references.json` (one entry per site with its address, title, description, tags and note) and `shots/` (the screenshots). Point your agent at it when you start a new design, for example: "Look at the sites in rubric-references/data/references.json tagged Minimal, open their screenshots, and use them as references for this landing page."

## Settings (env.local)

| Key | Default | What it does |
|---|---|---|
| `PORT` | 5298 | Where the bridge listens. If you change it, also change `bridge` in `extension/config.js` and the two `host_permissions` lines in `extension/manifest.json`, then reload the extension. |
| `AGENT_CMD` | blank (off) | Your agent's one-shot command for the one-liner and tags. See above. |
| `AGENT_TIMEOUT_SECONDS` | 90 | How long to wait for your agent before keeping the page's own description. |
| `RUBRIC_TOKEN` | blank (off) | Optional shared secret for the API. Put the same value in `token` in `extension/config.js`. |

Tags are a fixed list: Landing page, Portfolio, SaaS, Dashboard, Typography, Motion, Illustration, 3D, Minimal, Bold, E-commerce, Docs. To change it, edit `TAGS` in both `build.js` and `extension/popup.js` (keep the two lists the same), then restart the bridge and reload the extension.

## Keep it running (optional)

`node server.js` is all you need. It has to be running when you click the icon. If you'd rather it starts with your computer, any process manager works. With pm2, for example:

1. `npm install -g pm2`
2. In the `rubric-references` folder: `pm2 start server.js --name rubric-references`
3. `pm2 save`, then `pm2 startup` once so it comes back after a restart.

Or ask your agent to set up an autostart that fits your computer.

## Security model

- The bridge listens on `127.0.0.1` only, so nothing else on your network can reach it.
- It sends no CORS headers. API calls that come from any other website are refused. Only the extension and the wall page the bridge serves itself can use the API.
- `POST` and `PATCH` calls must be JSON (`Content-Type: application/json`), so a plain web form on another site can't post to it.
- Requests addressed to any host name other than `127.0.0.1` or `localhost` are refused. This blocks DNS rebinding, a trick where a website points its own name at your computer.
- Optional `RUBRIC_TOKEN`: when set, every `/api` call needs the matching `x-rubric-token` header. The extension sends the token from `config.js`, and the wall page the bridge serves gets it automatically. Unset, nothing changes.
- Request size is capped: 12 MB for a save (it carries one screenshot) and 1 MB for everything else. Bigger requests get a 413 error.
- The bridge serves only the wall page and screenshots named like `shots/<id>.jpg` or `.png` from `data/shots`. Every other address is a 404, so no other file on your computer can be read through it.
- Everything a saved site provides (title, description, note, tags) is escaped or set as plain text before it shows on the wall or in the popup, and only `http` and `https` links are used.
- It reads `env.local` and the `data` folder, and writes only inside the `data` folder. It stores no credentials; the only secret is `RUBRIC_TOKEN`, if you set one, in `env.local`.
- The bridge makes no network calls of its own and has no tracking. The wall page loads the Outfit font from Google Fonts and each saved site's small icon from that site.
- If you set `AGENT_CMD`, the bridge runs that command after each new save, in your computer's temp folder, with a time limit. The page details go in on standard input, never into the command line, and the prompt tells your agent to treat them as data only. Where they go next depends on your agent. On Windows the bridge uses `taskkill` to stop a command that runs too long. It starts no other programs.
- The extension asks for `activeTab` and `scripting`, plus access to the bridge's address only. It reads a page only when you click the icon: a screenshot of the visible area, the title, description, site name, icon address, window size and the first 1,600 characters of text.

## How it's built (for your agent)

```
any site ── click the toolbar icon (the popup opening = the save)
   │
   ▼
extension/popup.js ── screenshot (chrome.tabs.captureVisibleTab, jpeg)
                   ── page info (title, description, icon, first 1,600 characters of text)
                   ── POST http://127.0.0.1:5298/api/capture
                               │
                               ▼
                        server.js (the bridge)
                          1. saves data/shots/<id>.jpg
                          2. adds a record to data/references.json
                          3. if AGENT_CMD is set: runs it in the background,
                             then adds the one-liner + tags to the record
                          4. build.js rebuilds data/index.html after every change
```

| Route | What it does |
|---|---|
| `GET /` | The wall page (live: remove buttons, refreshes while a one-liner is being written) |
| `GET /shots/<id>.jpg` | One screenshot |
| `GET /api/health` | `{ ok, count, agent }` (agent = whether `AGENT_CMD` is set) |
| `GET /api/refs` | Every saved site |
| `POST /api/capture` | Save a screenshot + page info (sent by the extension) |
| `GET /api/refs/<id>` | One saved site |
| `PATCH /api/refs/<id>` | Edit `title`, `description`, `note` or `tags` |
| `DELETE /api/refs/<id>` | Remove a site and its screenshot |

Each record in `references.json` has: `id, url, domain, title, description, rawDescription, tags, note, shot, favicon, w, h, created, updated, status`.

## Troubleshooting

- **Popup says "Bridge isn't running":** open a terminal in the `rubric-references` folder and run `node server.js`, then click the icon again.
- **"Port 5298 is already in use":** set `PORT` in `env.local` and follow the note in Settings.
- **"Can't capture this page":** Chrome blocks extensions on `chrome://` pages, the Web Store and local files. Nothing to fix.
- **"Token doesn't match":** `RUBRIC_TOKEN` in `env.local` and `token` in `extension/config.js` must be the same. Reload the extension after editing `config.js`.
- **A card keeps saying "Writing a plain-English one-liner...":** check the bridge's terminal. After `AGENT_TIMEOUT_SECONDS` it gives up and keeps the page's own description.
- **Changed a file in `extension/`:** click the reload arrow on the RUBRIC References card in `chrome://extensions`.

## License

CC BY 4.0. Use it, change it, share it, and keep the credit to RoboNuggets (https://www.skool.com/robonuggets). The fonts in `extension/fonts/` use the SIL Open Font License (see `OFL.txt` there).
