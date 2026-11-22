![Teleprompter](assets/banner.png)

# Teleprompter

Read your scripts off your phone and your computer while you record. Your agent sends a script, it shows up on both screens, and the two stay on the same line at the same speed, so you can glance at either one mid-take.

This is a simple personal tool, built for one job and not polished beyond that. If you want it to work differently, ask your agent to change it. Everything is plain HTML and one small server file.

## What you get

- **Phone page** that opens in your phone's browser: a big Play / Pause button, a speed slider, text size, mirror mode, search, and a reading line you can drag level with your camera lens.
- **Desktop page** with the same script on your computer: Play, Speed and Size, plus keyboard shortcuts.
- **Sync both ways.** Press play on either screen and both scroll together. Pause, scroll or change speed on one and the other follows.
- **One long page for batch recording.** Put several scripts in one file and record them all in one continuous take, then cut them apart later.
- **A skill for your agent** (`skills/teleprompter/`) so "send this to my teleprompter" just works.
- **A sample script** (`scripts/sample-three-reels.md`), a three-reel batch to try it with.

No accounts, no API keys, no npm packages, and nothing leaves your network.

## Quick start (2 minutes)

You need **Node.js 18 or newer** (check with `node --version`, get it from nodejs.org).

1. Open a terminal in this folder and run:
   ```
   node server.mjs
   ```
2. It prints two links:
   - **Desktop page:** `http://localhost:50013/desktop` - open it on this computer.
   - **Phone page:** something like `http://192.168.1.20:50013/` - type it into your phone's browser. The phone must be on the **same wifi** as the computer.
3. Pick `sample-three-reels` from the dropdown and press Play.

The first time it runs, your computer may ask whether to let Node use the network. Allow it on private networks, or the phone cannot reach it.

## Set up the skill

1. Copy the `skills/teleprompter/` folder into your agent's skills folder.
2. In the copied `SKILL.md`, replace `{{TELEPROMPTER_DIR}}` with the full path of this folder (the one holding `server.mjs`).
3. Now tell your agent "send this script to my teleprompter". It writes the file into `scripts/`, starts the app if it is not running, switches the open screens to the new script and gives you both links.

You can also skip the skill and drop any `.md` file into `scripts/` yourself. It appears in the dropdown on the next reload.

## Writing scripts

Scripts are plain markdown files in `scripts/`. Give each one a 2 to 3 word topic in the name (`coffee-shop-hook.md`), so it is easy to find on a phone.

```md
# Title of the video

## Section

One beat per paragraph, with a blank line between paragraphs.

---

## Next part
```

`#` headings show in orange, `##` in yellow, `**bold**` in orange, and `---` draws a divider. To batch-record, put every script in one file in recording order, each under its own `## Reel 1 - Title` heading with `---` between them. See the sample.

If a script file changes while it is open, both screens update in place and keep your spot.

## Controls

| Where | Control | What it does |
|---|---|---|
| Phone | Play / Pause | Starts and stops the scroll |
| Phone | Speed | 0.1 to 5, remembered on that phone |
| Phone | Size | Text size, remembered; the desktop copies its line breaks |
| Phone | Mirror | Flips the text for a mirror rig |
| Phone | Sync | On by default; reads "Synced" while a desktop page is open |
| Phone | Search | Type any words from a script name, heading or text |
| Phone | Orange line | Hold half a second, then drag it level with your camera; double-tap the grip to reset |
| Desktop | Space | Play / pause |
| Desktop | Arrows, Page Up / Down | Scroll |
| Desktop | + and - | Speed up and down |
| Desktop | Size | How big the text is on your monitor |
| Desktop | Orange line | Drag to where your eyes sit; double-click to reset |

Whichever screen you touched last leads, and the other follows.

## Settings

Set these as environment variables before `node server.mjs` (for example `PORT=50014 node server.mjs`, or `set PORT=50014` first on Windows cmd):

| Setting | Default | What it does |
|---|---|---|
| `PORT` | `50013` | The port the app listens on |
| `HOST` | `0.0.0.0` | `0.0.0.0` lets your phone on the same wifi reach it. `127.0.0.1` keeps it on this computer only |
| `SCRIPTS_DIR` | `./scripts` | Read scripts from another folder |

`npm start` runs the same thing as `node server.mjs`.

## How it's built

| File | Job |
|---|---|
| `server.mjs` | The whole server: serves the two pages, lists and reads scripts, and runs the sync channel. Built on Node's own modules only |
| `public/index.html` | Phone page |
| `public/desktop.html` | Desktop page |
| `public/sync.js` | Sync engine shared by both pages |
| `public/md.js` | Small markdown renderer, so the pages work offline |
| `scripts/` | Your scripts, one `.md` file each |
| `skills/teleprompter/SKILL.md` | The agent skill |

Routes:

| Route | What it does |
|---|---|
| `GET /` | Phone page |
| `GET /desktop` | Desktop page |
| `GET /api/scripts` | List of scripts, newest first |
| `GET /scripts/<name>.md` | One script's text |
| `GET /api/live` | Which script was last sent to the screens, plus change times |
| `POST /api/live` | `{"file": "<name>.md"}` switches the open pages to that script |
| `GET /api/info` | Port, number of scripts, and the desktop and phone links |
| `WebSocket /api/sync` | Keeps the phone and desktop on the same line |

How sync works: position is measured as "paragraph number plus how far through it", not in pixels, so it matches on screens of any size. The page you touched last sends its position, speed and play state; the server numbers each message and passes it on; the other page eases onto the same line. The phone also sends its text width and size, so the desktop lays out its lines the same way.

## Security model

- The app only answers devices on your own network: this computer, home and office wifi ranges (192.168.x.x, 10.x.x.x, 172.16 to 172.31), and private overlay networks such as Tailscale (100.64 to 100.127). Anything else gets a 403.
- `HOST=127.0.0.1` makes it listen on this computer only.
- It can read only `.md` files directly inside the scripts folder. Names are checked, and any path that leaves the folder is refused.
- The pages cannot write or delete files. The only change you can make over the network is which script the open pages show (`POST /api/live`), and only to a script that already exists.
- The script switch (`POST /api/live`) and the sync channel refuse requests sent by another website open in your browser (the Origin header must match). The app sends no CORS headers, so other websites cannot read your scripts either.
- Request bodies are capped at 1 MB and sync messages at 64 KB.
- Script text is escaped before it is shown, so a script cannot inject code into the pages.
- There is no login. Anyone on your wifi who knows the address can view your scripts while the app runs. Stop it (Ctrl+C) when you are done, or use `HOST=127.0.0.1`, on shared networks.

## Troubleshooting

- **Phone page will not load, desktop works:** check the phone is on the same wifi (not a guest network, not mobile data), use the address the app printed (never `localhost` on the phone), and allow Node through your firewall on private networks. On Windows: Windows Security, Firewall, Allow an app through firewall, tick Private for Node.js. On a Mac: System Settings, Network, Firewall.
- **"Port 50013 is already in use":** it is probably already running, so open the desktop link. Or start it on another port with `PORT=50014`.
- **Desktop shows "No phone open":** open the phone page, and check Sync is on (orange) on the phone.
- **The address changed:** your router can give the computer a new address. Run your agent's teleprompter skill again, or check `http://localhost:50013/api/info`.

## License

CC BY 4.0. You can use, change and share it, including commercially, as long as you credit RoboNuggets with a link back (https://www.skool.com/robonuggets) and say if you changed it. Full text in `LICENSE`.
