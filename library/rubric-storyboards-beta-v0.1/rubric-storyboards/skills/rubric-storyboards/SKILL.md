---
name: rubric-storyboards
description: Work with RUBRIC Storyboards (beta), the local app where a video is planned as a board of stills and reviewed with pinned comments. Use it to read and act on the user's storyboard comments, make a pitch board from images, import a finished video for review, or explain the wireframe and final-video steps. Triggers on "storyboard", "my comments on the board", "apply the storyboard comments", "make a pitch", "RUBRIC Storyboards".
---

# RUBRIC Storyboards (beta)

A local app (`node server.mjs`, default http://127.0.0.1:5303/) that shows a video as a board of stills, one per shot. The user clicks a still to pin a comment, writes overall notes about the whole video, and drags shot times on the timeline. Everything lives on disk, so you can read it directly.

Find the app folder first: it holds `server.mjs`, `env.local` and `projects/`. If you don't know where it is, ask once.

## Where things live

- `projects/<id>/project.json` - the project. `kind` is `board` (a pitch or a board of frames), `video` (an imported MP4) or missing (a wireframe project). `board` is the shot list: `id`, `file` (the still, relative to the project), `t` (where the still sits), `start` and `end` (the shot's span), `title`, `caption`, `animate`, `bullets` (`[{label, text}]`). `request` or `briefBullets` hold the treatment.
- `projects/<id>/comments.json` - every comment: `id, target, panel, v, t, x, y, text, created, status, appliedIn`.
  - `target: "board"` is pinned on a still: `panel` is the shot's `id`, `x` and `y` are % across and down the still.
  - `target: "video"` with `t`, `x`, `y` all null is an **overall comment** about the whole video.
  - `target: "video"` with a time is a pin on an imported video. `wf` and `final` are pins on wireframe or final version `v`, at time `t` seconds.
  - `status` is `open` or `applied`. Only act on `open` ones. A comment with `simulated: true` was written by an agent playing the reviewer, not by the user; treat it as a suggestion.
- `projects/<id>/board/` - the stills. Look at the still a comment is pinned on before you act on it: the pin's `x`, `y` say where on it.

The user may also paste the output of the app's **Copy comments** button. It lists the overall notes first, then each shot's comments with the shot number, time, pin position and still file, and starts with the project's folder.

## Act on the comments

1. Read `project.json` and `comments.json`. Group the open comments by shot, overall notes first.
2. Say back in plain words what you'll change, one line per comment, and ask before anything expensive.
3. Make the change where the shot comes from. For a pitch built with `make-pitch.mjs`, edit its spec (captions, bullets, lengths) and its images, then run `node make-pitch.mjs <spec.json>` again. Comments stay attached because each shot keeps its `id`.
4. Mark each comment you handled as applied. With the app running, use the API: `PUT http://127.0.0.1:<port>/api/projects/<id>/comments/<comment id>` with the JSON body `{"status": "applied", "appliedIn": "stills v2"}` and the header `Content-Type: application/json` (plus `x-rubric-token` if `RUBRIC_TOKEN` is set in `env.local`). If the app isn't running, edit `comments.json` directly: set `status` and `appliedIn`, keep everything else, and write valid JSON.
5. Never delete the user's comments, and never edit their `text`.

Shot times the user dragged are in `project.json` (`start`, `end`, `t` per shot, and `duration`). Treat them as decisions: keep them unless a comment asks for a change.

## Make a pitch

A pitch is a board of planned stills before anything is produced.

1. Make one image per shot, all the same shape (16:9, 9:16 or 1:1). A simple way: draw each shot as an HTML mock-up and screenshot it (see `examples/sample-pitch/frames.html` and `render.py`).
2. Write a spec like `examples/sample-pitch/pitch.json`: `id`, `title`, `request` (the treatment, one `Label: text` per line), optional `briefBullets`, and `shots` with `id`, `title`, `image`, `length` (seconds), `t`, `caption`, `animate` and 3 to 5 `bullets`.
3. Run `node make-pitch.mjs <spec.json>`. It shows up in the app within a few seconds. `--reset-times` drops the user's dragged times.

Bullets are what happens on screen in plain words: a bold short label (See, Moves, Timing, Sound, Try first), then one short sentence.

## Import a finished video

`node import-video.mjs <spec.json>` with `{ id, title, request, video, shots: [{ t, title, caption }] }` pulls one still per shot with ffmpeg and makes a `kind: "video"` project. Re-running it keeps the comments.

## The wireframe and final steps

When `AGENT_CMD` is set in `env.local`, the app runs an agent headless for two steps: a wireframe storyboard (JSON that plays as a grey-box animatic) and the final video (one HTML page following the `window.__reel` seek contract in `prompts.mjs`), which Export MP4 renders frame by frame. The user starts these from the app. `node agent.mjs check` prints the exact command each step would run without running it. Each run's output is in `projects/<id>/logs/`.
