---
name: cut
description: Cuts a raw talking-head recording into clean clips and puts them on the RUBRIC Editor for review. Transcribes it with a time for every word (AssemblyAI by default, ElevenLabs Scribe or local Whisper on request), keeps the last clean take of every line, removes false starts and long pauses, then applies the reviewer's comments and learns how they like their cuts. Use when the user says "/cut", "cut this recording", "edit my video", "cut my reels", "put this on the RUBRIC Editor", pastes comments copied from the RUBRIC Editor, pastes an export ask ("Render clip 01 of ..."), or wants to switch the transcriber.
---

# /cut

You give it a raw recording (an mp4, mkv or mov path) and, if you like, a line of context ("7 reels, one per script, titles below"). It transcribes the recording with a time for every word, decides what to keep, cuts it, and puts the cut on the RUBRIC Editor so the user can review it in Chrome. Their fixes come back as comments, and each round teaches this skill how they talk and what they want cut.

Paths in this file are relative to this skill's folder. `<editor>` is the RUBRIC Editor folder (the one with `server.mjs`).

## Setup (once)

1. **Tools:** Node.js 18+ (`node --version`) and ffmpeg (`ffmpeg -version`). If one is missing, tell the user how to install it and stop.
2. **Where the editor lives:** if this skill was copied out of the RUBRIC Editor folder, put that folder's full path in `"editor"` in `settings.json`.
3. **The editor is running:** `node server.mjs` in `<editor>` (or the user's autostart). The homepage is `http://127.0.0.1:50002/`.
4. **A transcription key.** The default is AssemblyAI. Ask the user to open https://www.assemblyai.com/dashboard, sign up, and copy their API key from API Keys. Then ask how they want to hand it over: they can paste it into `<editor>/env.local` themselves as `ASSEMBLYAI_API_KEY=...` (copy `env.example` to `env.local` first), or give it to you to write there. Never print a key back, never put it in another file.

### Switching the transcriber

Set `"transcriber"` in `settings.json` (or pass `--engine` for one run). Tell the user the trade-off in one line before switching.

| Transcriber | Speed for 1 hour of video | Cost | Setup |
|---|---|---|---|
| `assemblyai` (default) | about 33 seconds | paid per hour of audio, the cheapest of the paid two | `ASSEMBLYAI_API_KEY` from assemblyai.com/dashboard |
| `elevenlabs` (Scribe) | about the same as AssemblyAI | a bit more | `ELEVENLABS_API_KEY` from elevenlabs.io/app/settings/api-keys. Best when the user already pays for ElevenLabs. If the model name in `"elevenlabsModel"` is retired, check ElevenLabs' speech-to-text docs for the current one |
| `whisper` | 15 to 50 minutes, on the user's own computer (a faster CPU is quicker) | free | Python 3.9+, then `pip install -U openai-whisper`. `"whisperModel"`: `small` by default, `medium` is slower and more accurate |

## Workflow

1. **Brief.** Get the recording's path and any context: one whole clip, or one clip per section (a reel, a script, a lesson part) with titles. Context helps it split sections right the first time; it isn't required.
2. **Transcribe.** `node scripts/transcribe.mjs "<recording>"` writes the work folder `<editor>/work/<recording name>/`: `words.json` (every word with start and end) and `sentences.txt` (one timed line per sentence; a new line starts after any gap over 1.2 s, which is where retakes start). Done when `sentences.txt` exists.
3. **Plan.** Read `my-style.md` first (it wins over the defaults below), then all of `sentences.txt`. Write `<work>/plan.json`:
   ```json
   { "title": "My video", "sections": [
     { "title": "Intro", "keep": [[1.3, 4.4], [16.6, 20.35]], "why": { "7.0": "false start, said again at 16.7 s" } } ] }
   ```
   `keep` is the raw seconds to keep, in play order: start a range just before the first word you want and end it just after the last. `why` gives the reason for a cut, keyed by a time inside it; start it with `check:` where the words look garbled, so the user knows where to listen. `node scripts/words.mjs <work> 12-20` prints the exact words and pauses in a window. Done when every line of the recording is either kept or knowingly cut with a reason.
4. **Dry run.** `node scripts/cut.mjs <work> --dry` moves every edge into a real pause on the audio (with about 0.1 s of air) and writes `cut-review.md`: each kept and cut part with its words, the KEPT TEXT, and CHECK lines. Read the whole KEPT TEXT the way a viewer will hear it: a phrase said twice is a retake left in; a sentence missing its start is a range that starts late. Fix the plan and re-run until it reads cleanly.
5. **Cut.** `node scripts/cut.mjs <work>` cuts a 720p review copy of each section (`--full` keeps the recording's own size), writes `spec.json` and builds the editor project. Hand over the link it prints (`http://127.0.0.1:50002/projects/<id>/`), the kept minutes against the raw minutes, and the CHECK places to listen. Open the link in the user's browser only when they ask.
6. **Apply the comments.** The user reviews in the editor and pastes what Copy comments gives you. Read each item:
   - `EXTEND`, `TRIM`, `DELETE` come with the clip's new kept ranges as JSON. Put that list in the section's `keep` in `plan.json` and set `"exact": true` on it, because the user's ear wins: the edges they set are used as given.
   - `ADD` marks something to add at that moment (a raw span when it says "ADD raw Xs to Ys"); `PIN` is a comment on one spot of the picture; `Overall` and the across-all note apply to the whole clip or project. Act on each.
   - `APPROVED` means leave that clip alone unless a line asks for a change.
   Set the section's `"note"` to one line on what changed, run `cut.mjs` again (a changed section becomes V2 beside V1 in the editor), and hand the link back with what you changed.
7. **Teach my /cut.** If the pasted comments end with "Teach my /cut", fold what they show about how the user likes cuts into `my-style.md` after applying them: the principle behind the fix ("keeps a beat of silence after a punchline"), not a dated log entry. Rewrite the file around it so it stays short, and tell the user in one line what you learned. "Leave my /cut skill as it is" means don't touch it. "Teach my /animate" only applies if they have an /animate skill; otherwise skip it and say so in one line.
8. **Render.** An ask like "Render clip 01 of <project> at 1080x1920 using my RUBRIC Editor trims" comes from the editor's Export button. Run `node <editor>/tools/render-export.mjs --id <id>` and hand over the file paths it prints. It cuts the raw recording at the trims, crops to the size's shape, levels the sound, and checks every file.

## What stays and what goes

The rule: **remove what was repeated (the last clean saying stays) and false takes. Keep everything else that was said.** How much stays is an outcome, never a target.

- **The last clean take wins, played whole,** from its first word to its last, even when an earlier take reads better. Never join the start of one take to the end of another: the pitch and breath change at the join and it sounds wrong. When only a clause was redone, keep the final clause whole after the untouched lead-in.
- **False takes go:** an abandoned start ("make your- um, sorry, let me start again"), slates and retake markers ("cut", "one more", "take two"), and self-direction ("okay, recording", a lone "all right"). A note to the editor ("keep both takes so I can choose") is an instruction: follow it, and cut the spoken note.
- **Pauses:** a gap over about 0.6 s between lines goes, with about 0.1 s of air kept before the first word and after the last. A quiet stretch while something is being shown on screen stays, because the picture is the content.
- **Everything else stays,** including signposts ("I'll show you in a bit"), asides, caveats and the speaker's own examples. A short first word ("So", "And") stays when it flows into its sentence.
- **When unsure, keep it and flag it.** A trim is one drag in the editor; bringing back cut footage means hunting for it.
- **Say why for every cut,** and flag `check:` where the transcript's timing looks stretched or garbled. Transcripts miss words and run word ends early, which is why `cut.mjs` places every edge on the audio, never on a word time.

## Files

- `scripts/transcribe.mjs` - step 2, all three transcribers.
- `scripts/cut.mjs` - steps 4 and 5: edges on the audio, `cut-review.md`, the review copies, versions (`cuts/history.json`), `spec.json`, the editor project.
- `scripts/words.mjs` - the words and pauses in a time window.
- `settings.json` - transcriber, editor folder, language, air at each edge (`air`), the pause level (`quietDb`, worked out from the room noise when `null`), review copy height.
- `my-style.md` - how this user likes their cuts. Read before every plan, rewritten by step 7.
- `<editor>/sample/` - a ready-made work folder (a 58-second recording, its transcript, `plan.json`, the cut). `node scripts/cut.mjs <editor>/sample --dry` shows the whole flow without a key.

Using another editor (Premiere Pro, DaVinci Resolve, Final Cut Pro)? The kept ranges in `spec.json` are the cut. A connector for that editor (an MCP server, a plugin that lets the agent drive the app) can lay them out on its timeline; it is optional and not part of this kit.
