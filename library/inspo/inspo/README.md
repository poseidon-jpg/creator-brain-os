![Inspo](assets/banner.png)

# Inspo

Save any YouTube video to your own inspiration wall in one click. Click the Inspo button in your browser on a video, right-click a video and pick `/inspo`, or type `/inspo <link>` to your agent. Each video lands as a card with its thumbnail, title, channel, views and how long ago it went up, frozen at the moment you saved it. Months later you still see what the video had when it caught your eye, which is the signal you reacted to.

The wall is one plain JSON file on your computer, so your agent can read it too. Ask "what in my inspos fits a calm, visual video?" or "what should I make today?" and it searches what you saved.

## What's inside

```
inspo/
├── skills/inspo/          # the /inspo skill: your agent runs it
│   ├── SKILL.md
│   ├── scripts/add-inspo.mjs   # the helper: saves videos, removes them, lists and searches the wall
│   └── data/example-inspos.json   # what a saved wall looks like
├── extension/             # browser extension: a toolbar button and a right-click "/inspo"
├── bridge/                # tiny local server the extension talks to (runs the helper)
├── rubric-inspos/         # the Inspos tab for the RUBRIC console (also runs on its own)
├── page/inspos.html       # the wall as one page, for anyone without the console
├── assets/banner.png
└── LICENSE
```

All three ways in (skill, extension, console tab) read and write the same file: `inspos.json`, by default in `<your home folder>/inspos/`. Set `INSPOS_FILE` if you want it somewhere else, and set it the same for all three.

## Install

Only part 1 is required. Parts 2 to 4 are optional extras.

**Before you start:** Node.js 18 or newer (`node --version`). That is the only must-have. No API keys, no accounts, nothing to pay for.

**Recommended:** yt-dlp (`pip install yt-dlp`, or see github.com/yt-dlp/yt-dlp). Without it the helper reads YouTube's public page itself, which works but breaks more easily when YouTube changes its pages.

### 1. The skill (required)

1. Copy `skills/inspo/` into your agent's skills folder.
2. Test it: run `node <that folder>/scripts/add-inspo.mjs "https://www.youtube.com/watch?v=jNQXAC9IVRw"`. You should see `Added: Me at the zoo` with the views and the path of your new `inspos.json`.
3. Test search: `node <that folder>/scripts/add-inspo.mjs --list`. It prints your wall, one short entry per video.
4. If yt-dlp is installed somewhere odd, set `YTDLP_PATH` to its full path.

### 2. The browser extension (optional)

The extension can't run scripts itself, so a tiny local server (the bridge) runs the helper for it.

1. **Start the bridge.** In the `bridge/` folder run `node server.mjs`. It prints `Inspo bridge on http://127.0.0.1:5299`.
   - If you moved the skill in step 1, copy `bridge/env.example` to `bridge/env.local` and set `INSPO_HELPER` to the new path of `scripts/add-inspo.mjs`. Then the zip's folder can go.
   - The extension only works while the bridge runs. Set it to start when the computer starts, with whatever your system uses (pm2: `pm2 start server.mjs --name inspo-bridge && pm2 save`, a Startup shortcut on Windows, or a LaunchAgent on Mac).
   - Check it: open `http://127.0.0.1:5299/api/health`. It should say `"ok": true` and `"helperFound": true`.
2. **Load the extension.** In a Chromium browser (Chrome, Edge, Brave, Arc), open the extensions page (`chrome://extensions`), turn on **Developer mode**, click **Load unpacked**, and pick the `extension/` folder. Pin the Inspo button to the toolbar so it is one click away.
3. **Use it.** On a YouTube video, click the Inspo button. Or right-click a video thumbnail and pick **⭐ /inspo → linked video**, or right-click anywhere on a video's page and pick **⭐ /inspo → this video**. A notification confirms the save.

If you change the bridge port, change `BRIDGE` in `extension/background.js` and the `host_permissions` line in `extension/manifest.json` to match, then reload the extension.

### 3. The RUBRIC console tab (optional)

If you run the RUBRIC console, this adds an **Inspos** tab to it.

1. Copy the `rubric-inspos/` folder next to your console's `scaffold/` folder (so they are siblings).
2. In `rubric-inspos/`, run `node integrate.js` once. It patches the console to load add-on tabs, saves `.bak` backups first, and is safe to run twice.
3. Restart the console (`node server.js` in `scaffold/`). The Inspos tab appears in the sidebar.

The console starts the tab's own small server for you on port 5059 and forwards `/api/inspos` to it. Details are in `rubric-inspos/README.md`.

### 4. The wall without the console (optional)

- **With the bridge running:** open `http://127.0.0.1:5299/`. It shows your live wall and refreshes when you come back to the tab.
- **Without anything running:** open `page/inspos.html` in your browser and click **Open file** to pick your `inspos.json`.

Until you save your first video, every view shows two example cards tagged "example".

## Use it

- Click the Inspo button on a YouTube video, or right-click a video and choose `/inspo`.
- Or tell your agent `/inspo <youtube link>` (several links at once is fine). Add why you are saving it, and it keeps that as a note on the card.
- Ask your agent to find ideas: "what in my inspos is about X", "pick 3 inspos for a short, punchy video", "what should I make today?"
- Save the same video again to refresh its numbers and move it to the top. Its note stays.
- Ask your agent to "remove <link> from inspos" to take one off.

## Good to know

- **The numbers are a snapshot.** Views and "how long ago" are frozen at save time on purpose. Saving again updates them.
- **Subscribers sit next to views** so you can see when a video beat its channel's usual reach.
- **Thumbnails load from YouTube** by video id, so the wall needs an internet connection to show pictures. To keep your own copies, set `INSPO_THUMBS_DIR` and each save also downloads the full-size thumbnail there.
- **Your data stays on your computer.** One JSON file, no cloud, no account.

## Security model

- The bridge and the console tab listen on `127.0.0.1` only, so nothing outside your computer can reach them.
- Neither sends CORS headers. The bridge also refuses any POST sent from a web page, so a website you visit can't add videos behind your back. Only the extension (or a terminal) can.
- Request bodies are capped: 10 KB on the bridge, 1 MB on the console tab.
- The bridge runs exactly one program, the helper, with Node and no shell, and only after checking the video id is 11 safe characters.
- The console tab supports an optional shared secret (`RUBRIC_TOKEN` in `rubric-inspos/env.local`).
- The extension asks for the fewest permissions it can: a right-click menu, notifications, the open tab's address only when you click its button, and the bridge's address. It can't read your pages.
- The only outside calls are to YouTube: the helper reads the video's public details (with yt-dlp or from the public video page), and the pages load thumbnails from YouTube's image server. No keys or passwords are stored anywhere.

## License

CC BY 4.0. Use it, change it, share it, even commercially. Just give credit to RoboNuggets. Full text in `LICENSE`.
