![RUBRIC Scripts](assets/banner.png)

# RUBRIC Scripts

A small app you run on your own computer to review short-video scripts before you record them. You type `/rubricscripts` with your ideas, your agent writes each script with your /hooks and /tone skills (three hooks per script, plus a caption), and loads them into the app. You pick a hook, highlight any words and comment on them, then hand every comment back in one go. Your agent fixes the scripts and, by default, teaches your /tone skill what your comments say about your voice, so every round sounds more like you.

It opens in your browser on localhost (your own computer). Node only: no `npm install`, no account, no keys, nothing leaves your computer.

## What's in this package

| Path | What it is |
|---|---|
| `app/` | the app: `server.mjs`, the two pages in `public/`, your data in `data/` |
| `app/data/scripts.json` | the scripts. Three sample scripts come with it, so you can try the app straight away |
| `app/data/state.json` | your work in the app (hook picks, comments, edits, order). Starts empty |
| `app/data/shortlist.md` | ideas waiting for a script, with two sample ideas open |
| `app/check.mjs` | checks the scripts file; your agent runs it after every write |
| `skills/rubricscripts/` | the `/rubricscripts` skill, plus a guide to making /hooks and /tone if you don't have them yet |
| `LICENSE` | CC BY 4.0 |

## Set it up (5 minutes)

For your agent, in this order:

1. Check Node is installed: `node --version` needs 18 or newer. If it is missing, tell the user how to install it from nodejs.org and stop.
2. Move this whole `rubric-scripts` folder somewhere permanent, such as the user's project folder (not Downloads).
3. Copy `skills/rubricscripts` into your skills folder, so you end up with `rubricscripts/SKILL.md` next to your other skills.
4. In the copied `SKILL.md`, set "App folder" in the YOUR DEFAULTS block to the full path of the `app` folder from step 2.
5. Start the app from the `app` folder: `node server.mjs`. Keep it running in its own terminal, or use pm2 if it is installed: `pm2 start server.mjs --name rubric-scripts`.
6. Check it: `curl -s http://localhost:50011/api/health` answers with `"ok":true`. Then open http://localhost:50011 in the user's browser, or give them the link if you can't open one.
7. Check whether the user has /hooks and /tone skills. If either is missing, show them `skills/rubricscripts/references/make-hooks-and-tone.md` and offer to build it with them.

Port 50011 busy? Run `node server.mjs 4000` (any free port) and change the address in the skill's defaults to match.

## Use it

1. **Give it ideas.** Type `/rubricscripts` followed by your ideas, as sparse or as detailed as you like. More detail gives your agent more to work with. Or add ideas to `app/data/shortlist.md` (one per line, starting with `- [ ]`) and type `/rubricscripts from my shortlist`.
2. **Your agent writes and loads them.** It researches each idea, writes three hooks and the script with your /hooks and /tone skills, adds the caption, and gives you the link to each script in the app.
3. **Review.** Open a script. Click H1, H2 or H3 (or press 1, 2, 3) to pick a hook. Each hook can be edited by hand too.
4. **Comment.** Highlight any words in the hook, the script or the caption, press **Comment**, type, press Enter. Every comment goes into your comments cart, the list in the bottom right corner.
5. **Hand it back.** Leave **Teach my /tone** on, press **Copy comments for ALL scripts**, and paste it to your agent (or just say `/rubricscripts apply`, it reads your comments from disk). Your agent fixes every script in one go, marks the comments applied and folds the voice lessons into /tone.

## Everything on the pages

- **Homepage:** every script as a card with its own drawing. Search (press `/`), filter by tag or "With comments", sort by My order, Last edited, Newest, Shortest or A to Z. Drag cards to change My order. Switch between Cards and List view top right. The **New script** button reminds you that new scripts come from the skill.
- **Script page:** your scripts on the left to click through (`j` and `k` also work). The script window with the three hooks on top, then the Caption, the Video window and References at the bottom. Drag the lines between windows to resize them (double-click a line to reset). Edit turns a window into plain text you can type in.
- **Caption:** written for AEO (answer engine optimisation, so AI search tools can find and quote it): it says plainly what the video answers and what it covers.
- **Video and Channels:** placeholders for now. Your finished video and the channels it posts to (TikTok, Instagram, Threads, YouTube Shorts) come in Week 4.
- **References:** the links behind each script, one line each, so you can check the facts. Press Add to keep your own.
- **Keys:** `j` and `k` move between scripts, `1` `2` `3` pick a hook, `h` cycles hooks, `c` comments on selected words, `Esc` closes things.
- **Dark and light:** the button at the top right. Dark is the default.

## Make it yours

Everything here is meant to be changed by your agent. Some examples to ask for:

- "Give me four hooks per script instead of three."
- "Make my captions shorter every time."
- "Remove the Video window, I don't use it."
- "Add a sort by tag" or "group my scripts by week."
- "Use my /script skill for the body too."

Small settings live in the YOUR DEFAULTS block at the top of `skills/rubricscripts/SKILL.md`. The pages are plain HTML, CSS and JavaScript in `app/public/`, read fresh on every request, so a change there only needs a page refresh. A change to `server.mjs` needs a restart.

## How it's built

| File | What it does |
|---|---|
| `app/server.mjs` | a small Node web server. `GET /` homepage, `GET /s/<id>` one script, `GET /api/data` scripts plus your saved work, `POST /api/state` saves your work, `GET /api/health` status |
| `app/public/index.html` | the homepage |
| `app/public/script.html` | the script page |
| `app/public/common.js` | shared code: loading, saving, the copy-comments text |
| `app/public/app.css` | shared styles and the dark and light colours |
| `app/check.mjs` | checks `scripts.json` and `state.json`, prints OK or one line per problem |
| `skills/rubricscripts/references/data.md` | the exact shape of both data files |

`data/scripts.json` is written by your agent. `data/state.json` is written by the app. Both are plain JSON. Back up `app/data/` and you have backed up everything. To start clean, ask your agent to delete the three sample scripts.

## Security model

- The server listens on 127.0.0.1 only, so other computers on your network can't reach it.
- It sends no CORS headers, and it refuses a save that comes from a page on another website, so a website you visit can't write to your scripts.
- It only serves files from `app/public/`; any path that tries to step outside that folder gets a 404.
- A save request over 1 MB is cut off.
- It needs no keys and makes no outside calls. The only links it shows are the references in your scripts, and they open only when you click them.
- Text from your scripts is escaped before it is shown. The one exception is each script's drawing (`icon`), which is shown as an SVG drawing: the page strips script tags and event handlers from it, and `check.mjs` refuses any drawing that holds them. Only let your agent write `scripts.json`.

## If something looks wrong

- **The page says it can't reach the app:** the server is not running. Run `node server.mjs` in the `app` folder.
- **A yellow line on the homepage:** the scripts file has a problem. Run `node check.mjs` and ask your agent to fix what it names.
- **"Someone saved this first":** you had the app open in two tabs. The page loaded the newer version; make your last change again.

## License

CC BY 4.0. Built by Jay E at RoboNuggets (https://skool.com/robonuggets). Share it, change it, use it for anything, just keep the credit.
