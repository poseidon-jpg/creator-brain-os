![RUBRIC Recos](assets/banner.png)

# RUBRIC Recos

Your agent looks at your own setup and writes the changes that would help you most, on one page you can sort, skip and hand back.

The recos are sorted by **ARMS**: Apps, Routines, Memory and Skills. Each one says what you gain, what your agent would do, how much work it is, and whether it saves tokens.

## Quick start

1. **Check Node.** Run `node -v`. You need 18 or newer. If it is missing or older, get it from nodejs.org. Nothing else to install.
2. **Move the folder to a permanent place first**, for example `Documents/apps/rubric-recos` (not Downloads). The app and the `/recos` skill both write into its `data/` folder, so it has to stay where you put it. Run everything from there.
3. **Start it:**

   ```bash
   cd Documents/apps/rubric-recos
   node server.mjs
   ```

   It prints one line with its address, for example `RUBRIC Recos on http://localhost:50013/`.
4. **Open** http://localhost:50013 (or the address it printed).

The page starts empty: "No recos yet. Ask your agent to run /recos." The `/recos` skill fills it.

**The Agentic OS is optional.** It is the separate, free RUBRIC Agentic OS v2 download, and most people won't have it yet. Without it, everything works, and **Apply all comments** copies your comments for you to paste into your agent. To hide the Home and Apply buttons, start with an empty address: `AGENTIC_OS= node server.mjs` (on Windows PowerShell: `$env:AGENTIC_OS=''; node server.mjs`), or set `agenticOs: ''` in the CONFIG block of `server.mjs`.

## Keep it running

The page only works while `node server.mjs` is running. Pick one:

- **Your agent's usual way.** If your agent already keeps local apps running (a process manager, a startup task), it can add this one the same way.
- **A background start.** Your agent can start it in the background so it keeps running after the chat ends, and start it again after a restart.
- **Start it yourself each time.** Run `node server.mjs` in the folder whenever you want the page.

Whichever you pick, the agent should remember the port the app runs on, so `/recos` gives you the right link.

## Let your agent set it up

Paste this into your agent, after you move the unzipped `rubric-recos` folder to its permanent place:

```
Set up RUBRIC Recos from the rubric-recos folder.
1. Read README.md, then skills/recos/SKILL.md.
2. Check node -v is 18 or newer. If not, tell me to install it from nodejs.org and stop.
3. Copy the skills/recos folder into your skills folder, so I can type /recos. Ask me if you're not sure where that is.
4. Start the app with: node server.mjs (in the rubric-recos folder). Keep it running the way the README "Keep it running" section says, and ask me which way if you have no usual one.
5. Note the app folder and the port wherever you keep notes about me, so /recos finds them next time.
6. Run /recos once, so my first visit to the page already shows my own recos.
7. Offer me the weekly routine from the skill. Set it up only if I say yes.
Tell me in 3 lines what you did and give me the link.
```

## What you can do

- **Priority** comes first: the recos your agent ranked as high priority, in order. They also show in their ARMS group below.
- **The ARMS column** on the left lists Priority, Apps, Routines, Memory and Skills with a count each. A click jumps there. The button at the far left of the header shows or hides it (`b`).
- **Cards or List** (top right, or `v`). The choice is remembered in this browser.
- **Filters**: Area, Effort, Priority, Token Savings, and search (`/`, Esc clears).
- **Every reco** shows **What's the benefit** (the gain for you) and **What I can do** (your agent, first person), with Effort and Priority (Low, Mid or High), a green **Token Savings** bar when the change cuts token use (hover for how), and up to 3 bubbles naming the files it changes. Then three buttons:
  - **Add to cart** for your agent. `c` opens the cart, and Copy gives you one message to paste into a chat. Each pick carries its evidence.
  - **Done** greys it out.
  - **Skip** hides it for good, with an Undo for 7 seconds.
- **Comments**: highlight any text to pin a comment (`h` opens the list, with a Copy button).
- **Apply all comments** (`a`): the orange button in the lower right corner. If you run the RUBRIC Agentic OS (the separate free v2 download), it picks a model and effort, and that model rewrites the recos you commented on. If the Agentic OS is not running, it copies your comments so you can paste them into a chat with your agent.
- **Dark and light** with the toggle in the header.

Skips, done marks and comments save to `data/state.json`, so they survive a reload, another browser, and every refresh of the recos.

## The recos file

Your agent writes `data/recos.js` when it runs `/recos`. The full shape is described at the top of that file. In short:

```js
window.RECOS = {
  built: "20 Oct 2026",
  footer: "one line on when and how this was made",
  letters: { A: { name: "Apps" }, R: { name: "Routines" }, M: { name: "Memory" }, S: { name: "Skills" } },
  items: [
    { id: "s-split-posts", letter: "S", pri: "high", rank: 1, effort: "mid",
      saves: "mid", savesNote: "where the saving comes from",
      touches: ["skills/write-posts/SKILL.md"],
      title: "Split the posts skill in two",
      benefit: "the gain for you, then the evidence",
      action: "I ... (your agent, first person)",
      source: "exact paths and numbers",
      svg: '<path d="..."/>' }
  ]
};
```

An `id` never changes on a refresh, so a skip stays a skip. `node check.mjs --data` checks the file against this shape.

## The /recos skill

`skills/recos/` is the skill your agent runs. It reads your memory files, skills, connected apps and routines (only as much as it needs), looks for the workflows you repeat that no skill covers yet, and writes 8 to 20 recos with evidence from your own setup. It changes nothing else. At the end of the first run it offers a weekly routine, so fresh recos are waiting for you each week.

## Settings

Everything that names a folder, a port or an address is in the `CONFIG` block at the top of `server.mjs`:

| Setting | Default | Change it with |
|---|---|---|
| Port | 50013 | `node server.mjs 50113`, or `RECOS_PORT` |
| Data folder | `data/` in this folder | `RECOS_DATA` |
| Agentic OS address (Apply all comments and the Home button) | http://localhost:50000 | `AGENTIC_OS`, or `''` in CONFIG to hide both |
| Optional token | off | `RUBRIC_TOKEN` (see Security model) |

## Security model

Every sentence here is true of the code in this folder.

- The server listens on 127.0.0.1 only, so nothing on your network can reach it.
- It sends no CORS headers, so other websites cannot read anything from it.
- Requests for any host name other than localhost or 127.0.0.1 are refused, which blocks a website that points its own name at your computer.
- Every write must be JSON. A plain form on another website cannot send JSON without the browser asking first, and this app never says yes.
- Anything posted to it is capped at 1 MB.
- File routes serve only from `features/` and `assets/`, with a check that the resolved path stays inside the folder.
- Optional token: start it with `RUBRIC_TOKEN=yoursecret node server.mjs` and every `/api` call needs that token in an `x-rubric-token` header. Open the page once as `http://localhost:50013/#token=yoursecret` and this browser keeps it. The page and `recos.js` stay readable without it.
- Everything on the page is escaped before it is shown. The drawings in `recos.js` pass through a filter that keeps only plain shapes and their sizes.
- What it reads and writes: it reads `data/recos.js` and writes only `data/state.json` (your skips, done marks and comments).
- The page is given the full path of `data/recos.js`, because Apply all comments sends it to the Agentic OS so the run knows which file to edit. Nothing else uses it.
- `data/recos.js` is a script the page runs. Only your agent should write it, like any other code in this folder.
- It makes no outside requests. The font is in `assets/fonts/`. The one other address the page calls is your Agentic OS, and only when you press Apply all comments.
- It stores no keys, passwords or accounts.
- No npm packages: Node built-ins only.

## Checks

```bash
node check.mjs          # checks data/recos.js, then tests every route on a spare port with a throwaway data folder
node check.mjs --data   # checks data/recos.js only
```

## Folder map

| Path | What |
|---|---|
| `server.mjs` | the app. CONFIG at the top |
| `index.html` | the page, read on every request, so a page change needs only a reload |
| `data/recos.js` | your recos, written by `/recos`. Ships empty |
| `data/state.json` | your skips, done marks and comments, written only by the app |
| `features/` | the cart, highlight comments, Apply all comments and Home button |
| `assets/` | the banner and the Outfit font (SIL Open Font License, in `assets/fonts/`) |
| `skills/recos/` | the `/recos` skill. Copy it into your agent's skills folder; ask the user if you're not sure where that is |
| `check.mjs` | the checks above |
| `CUSTOMIZE.md` | how to change the port, the colours, the filters and more |

## License

MIT. See [LICENSE](LICENSE). Made by Jay E | RoboNuggets (robonuggets.com).
