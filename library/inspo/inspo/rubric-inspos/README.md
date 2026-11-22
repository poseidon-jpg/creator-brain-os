# RUBRIC Inspos

A wall of YouTube videos saved for inspiration, as a tab in the RUBRIC console or as a page of its own.

---

## Intent Guide

**This README is written for you, the agent.** You read it, adapt it to your user's setup, and handle the installation. The user shouldn't need to read this file.

RUBRIC Inspos shows every video the user saved with `/inspo` as a grid of cards: thumbnail, title, channel, views and how long ago it was published, frozen at the moment of saving. The goal: one place to look back at the videos that inspired them.

Before installing anything:

1. Find the user's RUBRIC console. Look for a `scaffold/` folder with `server.js` and `index.html`. If there is none, this tab runs standalone (`node server.js`), or the user can use `page/inspos.html` from the main package instead.
2. Find where the user's `inspos.json` lives. The inspo skill and bridge default to `<home folder>/inspos/inspos.json`. If they set `INSPOS_FILE` elsewhere, set the same value here.
3. Check whether an Inspos tab is already installed. Don't create a duplicate.

For each step, **suggest an answer based on what you find**, then confirm with the user. This is a base template. Adapt it, don't follow it blindly.

---

## Quick Start

1. Put this `rubric-inspos/` folder next to the console's `scaffold/` folder.
2. Run `node integrate.js` here once.
3. Restart the console (`node server.js` in `scaffold/`) and click the **Inspos** tab.

## Setup Steps

1. **Place the folder.** The console looks for add-on tabs in sibling folders that have a `manifest.json`. This folder's manifest names the tab `inspos`, labels it "Inspos", and gives it port 5059.
2. **Patch the console once.** `node integrate.js` adds add-on tab support to `scaffold/server.js` and `scaffold/index.html`. It saves `.bak` backups before the first change and skips anything already patched, so running it twice is safe. If your scaffold is not a sibling, pass `--scaffold <path>`. If it says an anchor was not found, the console version differs. Read the error, find the matching spot in your scaffold, and adapt.
3. **Restart the console.** On start it launches this tab's server on port 5059 and forwards `/api/inspos` to it. The tab loads the first time it is clicked.
4. **Point it at the data (only if needed).** Copy `env.example` to `env.local` and set `INSPOS_FILE` if the wall lives somewhere other than the default.

Standalone, without the console: `node server.js` here, then open `http://127.0.0.1:5059`.

## Configuration

| File | What it holds |
|---|---|
| `manifest.json` | Tab name, label, port, which API paths to forward, which part of the page becomes the tab |
| `env.local` | Optional settings, copied from `env.example` |
| `data/example-inspos.json` | Two example cards, shown until the first real save |

If you change the port, change it in both `manifest.json` and `env.local`.

## Features

- Grid of saved videos, newest first, same look as the rest of the console
- Each card shows the channel's subscribers next to the views, so videos that beat their channel's usual reach stand out, plus the user's note when there is one
- Thumbnails load by video id, with a fallback for older videos that have no max-res image
- Example cards (tagged "example") until the first save, so the tab is never empty
- Refreshes when the tab is opened, when Refresh is clicked, and when the window gets focus again, so videos saved from the extension appear without reloading

## API Endpoints

| Method | Path | Body | Does |
|---|---|---|---|
| GET | `/api/inspos` | | The wall. Adds `examplesOnly: true` while showing the examples |
| POST | `/api/inspos` | `{"inspos": [...]}` | Replace the whole wall |
| POST | `/api/inspos` | a video object with `id` and `title` | Add it to the top (one card per video) |
| POST | `/api/inspos` | `{"delete": "<video id>"}` | Remove one video |

Adding videos with full details (views, age) is the inspo skill's job: `node scripts/add-inspo.mjs "<link>"`.

## Environment Variables

| Name | Default | Purpose |
|---|---|---|
| `PORT` | `5059` | This tab's server port (the console sets it from `manifest.json`) |
| `INSPOS_FILE` | `<home folder>/inspos/inspos.json` | Where the wall's data lives |
| `RUBRIC_TOKEN` | unset | Optional shared secret. When set, `/api` requests need the header `x-rubric-token` |

## Requirements

Node.js 18 or newer. No npm packages.

## Security model

- Binds to `127.0.0.1` only.
- Sends no CORS headers.
- Optional `RUBRIC_TOKEN` shared secret on every `/api` route. The page sends `window.RUBRIC_TOKEN` when set.
- Request bodies are capped at 1 MB.
- Reads and writes one JSON file (`INSPOS_FILE`). Makes no outside calls. The browser loads thumbnails from YouTube's image server.
- Every value shown on the page is HTML-escaped, and only valid 11-character video ids are rendered or stored.
- No credentials stored.

## Version

1.1.0

## License

CC BY 4.0 - free to use and adapt with attribution. See [LICENSE](./LICENSE).
