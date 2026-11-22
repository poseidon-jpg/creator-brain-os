---
name: rubricscripts
description: Runs RUBRIC Scripts, the small local app where you review short-video scripts before you record. It starts the app, turns your ideas (typed after the command, or the open lines on your shortlist) into scripts with three hook options and an AEO-friendly caption each, written with your /hooks and /tone skills, and loads them into the app for review. It then applies the comments you leave in the app and, by default, folds what they teach about your voice into /tone. If you have no /hooks or /tone skill yet, it still writes the scripts and shows you how to make them. Use when the user says "/rubricscripts", "rubric scripts", "open my scripts", "write scripts from my shortlist", "script these ideas", "review my scripts", "apply my script comments", or pastes text that starts with "# RUBRIC Scripts comments".
argument-hint: "[your ideas | from my shortlist | apply | open]"
---

# RUBRIC Scripts

You write the scripts, the app shows them, the user highlights words and comments, and you apply the comments and learn from them. The app has no AI inside: it is a window on two files. `data/scripts.json` is yours to write. `data/state.json` is the user's work (hook picks, highlights and comments, edits, notes, order), and you only read it, except to mark comments applied.

<!-- YOUR DEFAULTS: change these values here, in one place. Set the app folder to its full path when you install. -->
- App folder: `rubric-scripts/app/` (the folder that holds `server.mjs` and `data/scripts.json`). At install, replace this with its full path. If it is not there, search for a `server.mjs` that sits next to `data/scripts.json`.
- Address: `http://localhost:50011` (start the server with another port number, or set `RUBRIC_SCRIPTS_PORT`, to change it)
- Shortlist: `data/shortlist.md` in the app folder, one idea per line, open ideas start with `- [ ]`
- Skills to write with: /hooks for the hooks, /tone for the voice (and /script for the body, when the user has one)
- Hooks per script: 3
- Caption: AEO friendly (see Workflow B step 3)
- Spoken pace: about 3.8 words a second (a 40 second short is about 150 words)
- Teach /tone from comments: on. The app's "Teach my /tone" switch turns it off for one hand-off.
<!-- END YOUR DEFAULTS -->

## Universal rules

1. **The user's own skills write the words; this skill files them.** [Their voice lives in one place, so it gets better every time they improve it, and RUBRIC Scripts gets better with it.] Look for /hooks and /tone first: /hooks for the hook shapes, /tone for how every line sounds, and /script for the body if they have one. When /hooks or /tone is missing, write plainly, keep going, and end your report with the short guide in `references/make-hooks-and-tone.md` so they can build the missing one. Never copy their rules into this file.
2. **Never invent a fact, a number or a link.** [The app shows references as facts, and the user says them on camera.] Every claim in a script comes from a page you opened. Every reference is a link you opened, or a one-line note saying where the fact came from.
3. **Three hooks that really differ.** [H1, H2 and H3 exist to be compared side by side.] Each one opens a different way, ideally a different shape from /hooks, and the body never repeats the hook, because the app shows the hook above the body.
4. **Never rewrite a script that has open comments.** [Each comment points at exact words; new words strand it.] Apply the comments first (Workflow C).
5. **The user's work is theirs.** Only the app writes `data/state.json`, except Workflow C, which marks comments applied and adds 1 to `rev`. Never delete a script that has saved work without asking. Never open a browser unless the user asks; give the link.
6. **No long dash character anywhere.** Use " - " or a comma. `check.mjs` refuses it, because it reads as AI.
7. **The app is theirs to change.** [It is a plain local app built to be edited by an agent.] When the user asks for a change (four hooks instead of three, shorter captions, a new sort, removing a window they never use), change the defaults above or the files in `public/`, keep `node check.mjs` passing, and tell them to refresh the page.

## Workflow A: open the app

1. Run `curl -s http://localhost:50011/api/health`. If it answers, go to step 3.
2. From the app folder run `node server.mjs` in its own terminal, or `pm2 start server.mjs --name rubric-scripts` when pm2 is installed (it keeps running after the terminal closes). Done when the health check answers.
3. Give the address `http://localhost:50011`. Done.

## Workflow B: write scripts

1. **Pick the ideas.** Ideas typed after the command, sparse or detailed, one or many, are the list: add each to the shortlist as an open `- [ ]` line first, so nothing gets lost. "from my shortlist" means every open line there. Done when you hold the list. If it is empty, say so and stop.
2. **Research each idea.** Open the source the idea came from and the maker's page for every tool, number or claim. Keep each as a reference: `label`, `url`, and a `note` of a few words. Done when every fact you plan to say has a reference (rule 2).
3. **Write each script.** Ask /hooks for three hook shapes that fit, write one hook in each, then the body (with /script if they have it), then run all of it past /tone. Add the caption, the comment keyword, a title, 1 to 3 tags, and an icon (block below). The caption follows AEO (answer engine optimisation, so AI search tools can quote it): the first line says plainly what the video answers, it names the tools and the topic in plain words, two or three short lines sum up what the video covers, then a few relevant hashtags. Leave out any `Comment "KEYWORD"` first line; the app hides it. Done when the body reads in about the target time at the spoken pace.
4. **Save.** Add the new scripts to the end of `data/scripts.json`, keeping every existing script exactly as it is, and write the whole file in one go. Set `"hook"` to the one you would record. Done when the file is saved.
5. **Check.** Run `node check.mjs` in the app folder. Fix every PROBLEM line it names and run it again. Done when it prints `OK`.
6. **Tick the shortlist.** Change each written line to `- [x] <idea> (written: <id>)`. Done when no written idea is still open.
7. **Report.** Run Workflow A so the app is up. Then give `http://localhost:50011/s/<id>` for each new script, its title, its three hook first lines, and its word count. If /hooks or /tone was missing, add the guide from `references/make-hooks-and-tone.md`. End on what to do next: open it and comment.

## Workflow C: apply comments and teach /tone

Runs when the user says apply, or pastes text that starts with `# RUBRIC Scripts comments`. Read `data/state.json` either way: it holds everything, the paste only covers what was copied.

1. **Read the work.** For each script in `state.items`: comments without `applied`, `note`, `edits`, `refs`, and `hook` (the hook the user chose). Also the top-level `note` (across all scripts) and `tone`. Full shapes in `references/data.md`. Done when you have a list per script.
2. **Apply.** A comment's `region` says where it points (`hook` with its `hook` id, `body`, `caption`, `refs`), `quote` holds the exact words, and `note` says what to change. A hand edit in `edits` becomes the new text. The chosen hook becomes the script's `"hook"`. Added `refs` join `references`. Rewrite only the words a comment covers, unless the note asks for more. Done when `node check.mjs` prints `OK`.
3. **Mark applied.** In `state.json`, give each applied comment `"applied": "YYYY-MM-DD"`, remove the `edits` and `refs` you moved into `scripts.json`, and add 1 to `rev`. Write the whole file in one go. The app shows applied comments dimmed and leaves them out of the next hand-off. Done when the file is saved.
4. **Teach /tone** (when `tone` is true, the default). Go back over the comments and notes for what they say about how the user talks: words they cut or swap, sentence length, how they open, what they never say. Skip comments about facts, links or layout. Fold each lesson into their /tone skill by finding the principle and rewriting the guidance around it, so the file gets clearer, not longer. If there is no /tone skill, add the lessons to `data/tone-notes.md`, say so, and offer the guide in `references/make-hooks-and-tone.md`. Done when every voice lesson lives in /tone once.
5. **Report.** Per script, what changed in one line. Then the /tone lines you added or rewrote, quoted. Then any comment you skipped and why. End on the next step: refresh the app to see the new text.

## Drop-in block: one script in `data/scripts.json`

```json
{
  "id": "rank",
  "keyword": "RANK",
  "title": "3 plugins that turn your AI agent into an SEO expert",
  "tags": ["AI agents", "SEO"],
  "icon": "<path d=\"M5 41h26\"/><path d=\"M10 36v-7\"/><path d=\"M17 36v-12\"/><path d=\"M24 36v-17\"/><circle class=\"a\" cx=\"34\" cy=\"15\" r=\"8\"/><path class=\"a\" d=\"M40 21l5 5\"/>",
  "created": "2026-09-22T10:00:00",
  "hooks": [
    { "id": "h1", "note": "Contrarian", "text": "You don't need an expensive SEO subscription anymore. These three plugins turn your AI agent into an SEO tool." },
    { "id": "h2", "note": "Problem, then promise", "text": "You don't need to pay for expensive SEO tools anymore, because these three plugins turn your AI agent into an SEO expert." },
    { "id": "h3", "note": "Title style", "text": "Three plugins that turn your AI agent into an SEO expert." }
  ],
  "hook": "h2",
  "body": "The first is GEO Optimizer...\n\nSo if you want to try all three, just comment RANK down below.",
  "caption": "Three free plugins that turn your AI agent into an SEO expert...\n\n#seo #aiagents",
  "references": [ { "label": "GEO Optimizer", "url": "https://github.com/Auriti-Labs/geo-optimizer-skill", "note": "free, scores your site 0 to 100" } ],
  "video": null,
  "channels": ["tiktok", "instagram", "threads", "youtube-shorts"]
}
```

**The icon** is how the user finds a script by shape on the homepage and in the sidebar, so it shows THIS idea, not its category: a magnifier over rising bars for SEO plugins, a speech bubble with a lightning bolt for power words, a briefcase with a prompt arrow for business prompts. Draw 1 to 4 stroked shapes on a 48 x 48 grid with no fill or stroke attributes (the app styles them), and put `class="a"` on the one part that should be orange.

**Video and channels** stay `null` and the four defaults until posting opens in Week 4. The app shows them as placeholders.
