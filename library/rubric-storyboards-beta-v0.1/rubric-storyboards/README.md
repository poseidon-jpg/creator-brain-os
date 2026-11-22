![RUBRIC Storyboards (beta)](assets/banner.png)

# RUBRIC Storyboards (beta)

Plan a video as a storyboard, then fix it with pinned comments before anything gets built. Every shot is a still on a board. Click a still to pin a note on the exact spot, drag the cuts on the timeline to change how long each shot runs, and hand every comment to your agent in one copy. Connect your agent and it can also sketch a playable wireframe from a one-line request, then build the final motion-graphics video and export it as an MP4.

Version 0.1, a beta release. A members-only toolkit for the RoboNuggets community (https://www.skool.com/robonuggets), where all the full beta toolkits live. Members-only license: use it for your own and your clients' work; please don't share or resell the kit (see LICENSE).

## What's inside

```
rubric-storyboards/
├── server.mjs         # the app: a small local server plus the page. Start it with node server.mjs
├── app.html           # the page (board, timeline, comments)
├── player.js          # plays a wireframe as a grey-box animatic
├── config.mjs         # reads env.local
├── agent.mjs          # runs your agent (AGENT_CMD). node agent.mjs check prints what it would run
├── prompts.mjs        # what the app asks your agent for, in the wireframe and final steps
├── make-pitch.mjs     # turns a folder of images plus a short spec into a pitch board
├── import-video.mjs   # turns a finished MP4 into a board of stills to review (needs ffmpeg)
├── export.py          # exports a final video to MP4 (needs Python, Playwright and ffmpeg)
├── gen-mcp.mjs        # optional image tool for the final step (off by default)
├── env.example        # settings. Copy it to env.local
├── projects/
│   └── sample-pitch/  # a 20-second sample pitch, 4 shots, with two example comments
├── examples/
│   └── sample-pitch/  # how the sample was made: frames.html, render.py, pitch.json, frames/
├── skills/
│   └── rubric-storyboards/SKILL.md   # teaches your agent to read and act on your comments
└── assets/banner.png
```

## Quick start (about 3 minutes)

You need Node.js 18 or newer (check with `node --version`, get it at https://nodejs.org). There is nothing to `npm install`: the app has no dependencies.

1. Unzip the folder anywhere you like.
2. Copy `env.example` to `env.local`. You can leave every line blank for now.
3. Open a terminal in the `rubric-storyboards` folder and run `node server.mjs`. Leave that window open.
4. Open http://127.0.0.1:5303/ in your browser. The sample pitch opens on its board.

The terminal tells you on start whether your agent is connected. Not connected is fine: boards, comments and shot times all work without it.

## Setup (for your agent)

If you are an agent setting this up for someone, do this in order:

1. Check `node --version` is 18 or newer. If it isn't, tell them how to install Node.js and stop.
2. Copy `env.example` to `env.local`. Change `PORT` only if 5303 is taken.
3. Copy `skills/rubric-storyboards/` into your own skills folder, so you know how to read and act on their comments later.
4. Start the app with `node server.mjs` from this folder and keep it running. Open http://127.0.0.1:5303/ for them and check the sample pitch shows 4 stills.
5. Ask whether they want the wireframe and final-video steps. If yes, fill in `AGENT_CMD` with the command that runs you once, headless (see "Connect your agent" below), set `AGENT_DRY_RUN=1`, restart the app and run `node agent.mjs check`. Show them the command and explain that each real run costs money on their plan or API account. Turn the dry run off only when they say go.
6. Tell them in one line that it's running, and where their projects live (`projects/`).

## Using the board

- **Click a still** to pin a comment on that spot. Type, and it saves as you go.
- **Double-click a still** (or its enlarge button) to open it large. The arrow keys move between shots, Esc goes back.
- **Overall comments** sit at the top of the right panel: notes on the whole video, not one shot. Enter adds one.
- **The Brief** strip above the board holds the working title, the length and the shot count. Click it to open the treatment.
- **Drag the edge** between two shots on the timeline to move the cut. It snaps to 0.1 s, no shot goes under 0.5 s, and the last edge can make the video longer. Ctrl+Z and Ctrl+Y undo and redo.
- **Fit all / Medium / Large** under the board set the size of the stills. The ◐ button switches dark and light.
- Each tile shows its quick bullets: a bold short label, then one short sentence on what happens in the shot (See, Moves, Timing, Sound, Try first). Hover a bullet to read all of it.

Keys: Space plays, A adds a comment, Enter opens the current shot large, 1 and 2 switch views, F is full screen, N shows the wireframe's notes.

Everything saves to disk straight away: comments in `projects/<id>/comments.json`, shot times in `projects/<id>/project.json`. Reload the page and it's all still there.

## Hand your comments to your agent

Two ways, pick either:

- **Copy comments** (top right) puts every open comment on your clipboard: the overall notes first, then each shot's with its number, time, pin position and still. Paste it into your agent.
- Or tell your agent the project's folder. `projects/<id>/comments.json` holds every comment, and `project.json` holds the shots. The skill in `skills/rubric-storyboards/` teaches your agent the format and how to mark a comment as applied when it's done.

## Make your own pitch

A pitch is a board of planned stills, one per shot, before anything is produced. The stills can come from anywhere: frames from an HTML mock-up, screenshots, sketches, generated images.

1. Put your images in a folder, one per shot (`.jpg`, `.png` or `.webp`, all the same shape: 16:9, 9:16 or 1:1).
2. Write a spec next to them. `examples/sample-pitch/pitch.json` is a full example: the id, the title, the treatment, and per shot the title, the image, its length in seconds, a caption and quick bullets.
3. Run `node make-pitch.mjs path/to/pitch.json`. The pitch shows up in the app's list within a few seconds.

Run it again after you change the spec. Your comments stay, and so do the shot times you dragged in the app (as long as the shots are the same ones); add `--reset-times` to use the spec's times instead.

The sample's stills were made from `examples/sample-pitch/frames.html` by `render.py`, which screenshots each shot with Playwright for Python. Your agent can follow the same pattern: draw each shot as a simple HTML mock-up, screenshot it, then make the pitch.

## Review a finished video

`node import-video.mjs spec.json` turns an MP4 into a board of stills, one per shot, plus the video itself to play. The spec names the video and the times of the shots (see the top of `import-video.mjs`). It needs ffmpeg (https://ffmpeg.org/download.html). Re-run it after changing a time and the comments stay.

## Connect your agent (wireframe and final video)

These two steps are optional and off until you set `AGENT_CMD` in `env.local`:

1. **Wireframe.** "+ New video" takes a one-line request, a length and a shape. Your agent returns a storyboard that plays as a grey-box animatic: scenes, timing, on-screen words, camera moves and transitions. Comment on it and press Revise wireframe as often as you like. It's quick and cheap.
2. **Final video.** Make final video sends the storyboard and your comments to your agent, which writes the real motion graphics as one HTML page. It plays and scrubs in the app, you comment on it, Revise final applies the comments, and Export MP4 renders it frame by frame.

`AGENT_CMD` is the one command that runs your agent once, with no one at the keyboard. The app sends the prompt on standard input and runs the command in a fresh, empty folder in your computer's temp folder.

- For the wireframe, your agent only has to print the storyboard as JSON. The app finds the JSON even with notes around it, or inside a JSON reply.
- For the final video, your agent writes `index.html` into its folder. It must be allowed to create and edit files there **without asking you first**, or it stops and waits for an answer that never comes. Most agents have a flag for that.
- Placeholders the app fills in: `{model}`, `{effort}`, `{step}` (wireframe or final) and `{mcp_config}` (the image tool). A placeholder that is empty for a run is left out, together with the flag right before it.
- `WIREFRAME_MODELS` and `FINAL_MODELS` fill the model menus for `{model}`. Leave them blank and your agent uses its own default. A fast model is plenty for wireframes; use your strongest for finals.

Not sure what your command is? Ask your agent: "what command runs you once, non-interactively, reading the prompt from standard input, allowed to write files in the current folder without asking?"

If your agent is Claude Code, use: `AGENT_CMD=claude -p --model {model} --effort {effort} --permission-mode acceptEdits --permission-prompts none --allowedTools "Read,Glob,Grep,WebFetch,WebSearch,mcp__imagegen__generate_image" --output-format stream-json --verbose --no-session-persistence --strict-mcp-config --mcp-config {mcp_config}` (and if Claude Code started this app for you, also `AGENT_ENV_UNSET=CLAUDECODE,CLAUDE_CODE_*,CLAUDE_EFFORT,CLAUDE_PID,CLAUDE_AGENT_SDK*,AI_AGENT`).

Then check it before you spend anything:

1. `node agent.mjs check` prints the exact command each step would run, and runs nothing.
2. Set `AGENT_DRY_RUN=1` and restart. Make wireframe then writes the command and the full prompt to `projects/<id>/logs/` and runs nothing.
3. Turn the dry run off for a real run. Every run's full output is saved in `projects/<id>/logs/`, and the Cancel button stops it.

**Cost and time.** A wireframe is usually a minute or two with a fast model. A final video is the long step, often 10 to 40 minutes with a strong model, and it's billed by your agent like any other work. Add your agent's own budget flag to `AGENT_CMD` if it has one. `AGENT_TIMEOUT_MINUTES` (90 by default) stops a run that goes on too long.

**If your agent won't start** because it thinks it's inside another session (this happens when your agent started the app from its own terminal), list that session's environment variables in `AGENT_ENV_UNSET` and restart the app.

### The final video's contract

The final page exposes `window.__reel = { duration, fps, width, height, seek(t), play(), pause(), time(), audio(sampleRate) }`. Every frame is a pure function of time, so the app can scrub it and export it frame by frame. Sound, if any, comes from the Web Audio API through `audio()`. The full wording is in `prompts.mjs`.

## Export MP4 (optional)

Export MP4 needs Python 3.9 or newer with Playwright, and ffmpeg:

1. `pip install playwright`, then `python -m playwright install chromium`
2. Install ffmpeg (https://ffmpeg.org/download.html) so the `ffmpeg` command works in a terminal.
3. If Python isn't `python` on your computer, set `PYTHON` in `env.local` (for example `python3` or `py -3`).

## AI images in the final step (optional, off)

Your agent can get a `generate_image` tool (GPT Image 2.5 on fal.ai) during a final-video run, with a budget you pick in the Make final video dialog (up to $2, $5 or $10). It needs all three: `IMAGE_TOOL=on`, your `FAL_KEY` (https://fal.ai/dashboard/keys) in `env.local`, and `{mcp_config}` in `AGENT_CMD` so your agent loads the tool (the flag name depends on your agent). The tool refuses any call that would cross the budget, and saves images inside the run's own folder.

## Settings (env.local)

| Key | Default | What it does |
|---|---|---|
| `PORT` | 5303 | Where the app listens. You can also run `node server.mjs 5310`. |
| `PROJECTS_DIR` | `projects` | Where projects live. |
| `AGENT_CMD` | blank (off) | The command that runs your agent once. See "Connect your agent". |
| `WIREFRAME_MODELS`, `FINAL_MODELS` | blank | Model menus for `{model}`: `id` or `id=Label`, comma separated. |
| `AGENT_TIMEOUT_MINUTES` | 90 | Stops a run that takes longer. |
| `AGENT_ENV_UNSET` | blank | Environment variables to remove before your agent starts (`NAME` or `PREFIX*`). |
| `AGENT_DRY_RUN` | off | `1` writes the command and prompt to the project's logs and runs nothing. |
| `PYTHON` | `python` (Windows), `python3` | The Python that runs `export.py`. |
| `IMAGE_TOOL`, `FAL_KEY` | off, blank | The optional image tool. |
| `RUBRIC_TOKEN` | blank (off) | Optional shared secret for the API. |

## Keep it running (optional)

`node server.mjs` is all you need, and it has to be running while you use the app. To start it with your computer, any process manager works. With pm2, for example: `npm install -g pm2`, then in this folder `pm2 start server.mjs --name rubric-storyboards`, then `pm2 save`, and `pm2 startup` once. Or ask your agent to set up an autostart that fits your computer.

## Security model

- The app listens on `127.0.0.1` only, so nothing else on your network can reach it.
- It sends no CORS headers. API calls from any other website are refused (403), so only the app's own page can use the API.
- Requests addressed to any host name other than `127.0.0.1` or `localhost` are refused. This blocks DNS rebinding, a trick where a website points its own name at your computer.
- `POST`, `PUT` and `PATCH` calls must be JSON (`Content-Type: application/json`), so a plain web form on another site can't post to it.
- Optional `RUBRIC_TOKEN`: when set, every `/api` call needs the matching `x-rubric-token` header. The app's own page gets it automatically.
- Request bodies are capped at 1 MB (bigger ones get a 413 error).
- It serves only its own page, `player.js`, and files inside a project's folder (`/p/<id>/...`). Project ids are checked, and a path that would leave the project's folder is refused. Every other address is a 404.
- Text from projects and comments is escaped before it goes into the page.
- It reads `env.local` and writes only inside `projects/` and a `rubric-storyboards` folder in your computer's temp folder, where agent runs work.
- The server makes no network calls of its own and has no tracking. The page loads the Outfit font from Google Fonts. The optional image tool calls fal.ai, and a final video your agent writes may load libraries from a CDN.
- Your agent runs only when you press Make, Revise or Build, through the `AGENT_CMD` you set. The prompt goes in on standard input, never on the command line. Model and effort values come only from your own lists in `env.local` and a fixed list. Where the prompt goes next depends on your agent.
- Export MP4 runs `export.py` with your Python only when you press Export.
- It stores no credentials. The only secrets are `FAL_KEY` and `RUBRIC_TOKEN`, if you set them, in `env.local`. Neither is passed to your agent or to Python; the image tool reads `FAL_KEY` from `env.local` itself and sends it only to fal.ai.
- A final video is a web page your agent wrote. The app plays it in a frame from its own address, so it runs with the same access as the app's page. Treat it like any other code your agent writes.

## How it's built (for your agent)

```
browser ── app.html + player.js ── fetch /api/... ── server.mjs ── projects/<id>/
                                                         │            project.json   the project, its board and shot times
                                                         │            comments.json  every comment
                                                         │            board/         the stills
                                                         │            wireframe-vN.json, final-vN/, logs/
                                                         ├── agent.mjs ── AGENT_CMD (prompt on stdin, fresh temp folder)
                                                         └── export.py ── Playwright + ffmpeg ── final-vN/export.mp4
```

| Route | What it does |
|---|---|
| `GET /` | The app |
| `GET /p/<id>/<file>` | A project's own files (stills, clips, video, finals) |
| `GET /api/meta` | Version, projects folder, model menus, whether your agent is connected |
| `GET /api/projects` | Every project, newest first |
| `POST /api/projects` | New video from `{request, duration, aspect, model, effort}` (starts a wireframe run) |
| `GET /api/projects/<id>` | `{project, comments}` |
| `PATCH /api/projects/<id>` | Rename: `{title}` |
| `PATCH /api/projects/<id>/timing` | A pitch's shot times: `[{id, start, end, t}]` for every shot, back to back from 0 |
| `GET /api/projects/<id>/wireframe/<v>` | A wireframe storyboard |
| `POST /api/projects/<id>/wireframe` | Revise the wireframe from its open comments |
| `POST /api/projects/<id>/final` | Build the final (`{model, effort, imageBudget, revise}`) |
| `POST /api/projects/<id>/export` | Export final `{v}` to MP4 |
| `POST /api/projects/<id>/cancel` | Stop the run |
| `POST /api/projects/<id>/comments` | Add a comment: `{target, panel, t, x, y, text}` |
| `PUT /api/projects/<id>/comments/<cid>` | Edit `text`, `status` (`open` or `applied`) or `appliedIn` |
| `DELETE /api/projects/<id>/comments/<cid>` | Remove a comment |

A comment has `id, target, panel, v, t, x, y, text, created, status, appliedIn`. `target` is `board` (pinned on a still: `panel` is the shot id, `x` and `y` are % of the still), `video` (on an imported video; with `t`, `x`, `y` all null it's an overall comment), `wf` or `final` (on a wireframe or final version `v`, at time `t`).

## Troubleshooting

- **The page says the app server is not answering:** start it with `node server.mjs` in this folder and reload.
- **"Port 5303 is already in use":** set `PORT` in `env.local`, or run `node server.mjs 5310`.
- **Make wireframe is greyed out:** set `AGENT_CMD` in `env.local` and restart the app.
- **"your agent did not return the storyboard as JSON":** open the run's log in `projects/<id>/logs/`. Most often the command is waiting for input or printing something else. Try it by hand: `node agent.mjs check`, then run that command in a terminal and paste a short prompt.
- **A final run ends without index.html:** your agent wasn't allowed to write files without asking. Add its flag for that to `AGENT_CMD`.
- **Export fails:** check that `python -c "import playwright"` and `ffmpeg -version` both work, or set `PYTHON`.

## License

Members-only license: use it for your own and your clients' work; please don't share or resell the kit. You can change it for your own use, and the videos and storyboards you make with it are yours. Full terms in LICENSE. From RoboNuggets (https://www.skool.com/robonuggets).
