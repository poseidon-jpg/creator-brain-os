---
name: inspo
description: Saves YouTube videos to the user's Inspos wall, a plain JSON library of frozen snapshots (title, channel, subscribers, views, age, tags, description, the user's note), and searches that library for ideas later. Use when the user says "/inspo", "inspo [link]", "add this to inspos", "save this for inspiration", sends a YouTube link with an inspiration intent, asks to remove a video from inspos, or asks what in their inspos fits a topic, format or mood ("find me an inspo for today", "what have I saved about X", "what should I make next").
---

# /inspo - save YouTube videos, then find them again

The Inspos wall is the user's own library of videos worth learning from, often outliers that did far better than their channel's usual. Each save is a snapshot with the numbers frozen at the moment of saving, because what the video had when it caught the user's eye is the signal they reacted to. The library is one plain JSON file, so you can read and search it like any other file.

The helper is `scripts/add-inspo.mjs` in this skill's folder. Run it by its full path, because your working folder is usually somewhere else.

## Save a video

1. Run `node <this skill's folder>/scripts/add-inspo.mjs "<link>"`. Several links in one call is fine. Shorts, youtu.be links and bare 11-character ids all work. If the user says why they are saving it, add `--note "<their words>"` (one link per call when there is a note).
2. Relay one line per video from the output: title, views, how long ago, length, channel. Then stop.

This is one script call with no judgement, so hand it to a smaller, cheaper model if you can. Saving a video again refreshes its numbers, keeps its note and moves it to the top. To take one off: `--remove "<link>"`.

## Find ideas in the wall

When the user asks what to make, or for saved videos that fit a topic, format or mood:

1. Start with `node <this skill's folder>/scripts/add-inspo.mjs --list`, before looking for the file yourself. The helper knows where the wall is (the user may have moved it with `INSPOS_FILE`), prints that path, and gives every video as a short entry. `--list <words>` keeps the videos matching any of the words, best matches first.
2. Pick the 3 to 5 that fit best, matching on meaning, not only on words: "something calm and visual" can fit a video whose tags never say calm. Give each one line on why it fits, plus its link. Views far above the channel's subscriber count are a sign the video beat its normal, so say so when it helps.
3. For the full description, tags or published date of one video, read its entry in the file `--list` printed.

## Where the wall lives

- **Data:** `<home folder>/inspos/inspos.json`, or wherever `INSPOS_FILE` points. The skill, the browser extension's bridge and the RUBRIC console tab must use the same file, or they show different walls.
- **Shape:** `{ "inspos": [ { id, url, title, channel, subscribers, views, viewsText, published, ago, duration, tags, description, note, capturedAt } ] }`, newest first. `data/example-inspos.json` shows two entries. Editing the file by hand is fine: the helper keeps any field it does not fill itself.
- **Seeing it:** the Inspos tab in the RUBRIC console, the bridge page at `http://127.0.0.1:5299/`, or `page/inspos.html` opened directly (its Open file button reads the JSON).

## Settings (environment variables, all optional)

| Setting | What it does |
|---|---|
| `INSPOS_FILE` | Where the wall's data is saved |
| `YTDLP_PATH` | Full path to yt-dlp, if it is installed but not on the PATH |
| `INSPO_THUMBS_DIR` | Also keep a full-size copy of each thumbnail in this folder, as design references |

## If it fails

The helper reads a video with yt-dlp when it is installed, because yt-dlp keeps up when YouTube changes its pages. Without it, the helper reads YouTube's public page itself. So Node.js 18 or newer is the only must-have.

- **"Could not read this video from its YouTube page"**: the video is private or removed, or YouTube changed its page. Suggest installing yt-dlp (`pip install yt-dlp`) and try again.
- **"yt-dlp could not read this video"**: the video is private, removed or age-restricted, or yt-dlp is out of date (`pip install -U yt-dlp`). Tell the user the exact message.
- **"Your wall file is not valid JSON"**: a hand edit broke the file. Fix the JSON, or move the file aside and start a fresh wall.

## Pairs well with

An outliers scan (videos beating their channel's usual views). Save the ones worth studying with /inspo, and the wall becomes the shortlist of what is working in the niche.
