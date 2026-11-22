# Creator Brain OS

A Claude Code second brain and **automated video studio for TikTok Shop affiliate creators**. You film raw clips on your iPhone. It logs them, picks your best takes and hooks, cuts and captions a few genuinely different variants, has a separate judge check them, and hands you post-ready videos with captions. It also learns from what actually sells.

Built for the **Claude desktop app (Code tab)** or the `claude` CLI, not regular chat.

---

## For Claude: install this (do these steps in order)

If someone pasted you this repo's link, set it up for them:

1. Ask them where to put it. Default: their home folder, in `~/Creator Brain OS`.
2. Clone it: `gh repo clone <owner>/creator-brain-os "~/Creator Brain OS"` (or `git clone <url>`). If `gh` isn't installed or signed in, walk them through `brew install gh` then `gh auth login`, one step at a time.
3. Tell them to open that folder in the Claude desktop app: **Code tab → open folder → Creator Brain OS**. (Or `cd` into it and run `claude`.) Project skills, agents, hooks and the output style load from `.claude/` automatically, only inside this folder.
4. In the new session, say **"set me up"**. That runs `.claude/skills/start-here/SKILL.md`.

Don't copy the skills into `~/.claude/skills`. They're meant to stay project-scoped.

---

## What's inside

| Part | Where | What it does |
|---|---|---|
| **Video pipeline** | `studio/` + `tools/pipeline/` + `/edit` skill | Raw iPhone clips → logged, transcribed, cut on word boundaries, captioned, variants, judged, post-ready |
| **Agent hierarchy** | `.claude/agents/` | `scout` (Haiku, reads), `builder` (Sonnet, does), `video-judge` + `critic` (Sonnet, grade and red-team); the main chat (Opus) decides |
| **Verification** | `video-judge`, `scripts/privacy-scan.sh`, `scripts/doctor.sh` | Nothing grades its own work; checks live outside the thing they check |
| **Drift guard** | `.claude/drift/` + hooks in `.claude/settings.json` + `drift-guard` skill + `DRIFT_GUARD.md` | Every subagent gets the anti-laziness brief injected and is sent back if it skips its self-check |
| **Serendipity max** | `serendipity-max` skill | Research that wanders on purpose, logs sparks with real sources, and lets a separate judge pick the rabbit holes |
| **Command Center** | `tools/rubric-second-brain/` | Local dashboard at localhost:5210: what needs you today, usage/spend, skills, routines, memory |
| **Second brain** | `memory/` + `brain.js` | One fact per file; `brain.js recall` answers "what did we decide about X" with zero tokens |
| **~50 skills** | `.claude/skills/` | Hooks, captions, HyperFrames video, humanizer, research (`last30days`, `latest`), design taste, slides and more |
| **Library** | `library/` | ~25 extra skills, staged and not installed. Read first |
| **Research** | `research/` | The deep research this was built from, every claim labeled with its evidence |

## Daily loop (once set up)
1. **Pick a product** → `shop/products/<product>/brief.md` (paste the link + selling points).
2. **Film** using `studio/SHOOTING-GUIDE.md` (clap, say "hook one…", B-roll list).
3. Clips sync via iCloud Photos → say **/edit**.
4. Watch the variants in `studio/ready/`, keep what you love, and tell Claude what you hate (it learns).
5. Post from your phone, paste the caption, **tap Add product**, post. *(TikTok doesn't let apps attach the product, so this tap stays yours.)*
6. Weekly: drop your sales numbers in `analytics/exports/` → "update learnings".

## Requirements
macOS (Apple Silicon recommended), a Claude Pro or Max plan, Homebrew, ffmpeg, Node, Python, uv. `bash scripts/doctor.sh` checks all of it.

## Privacy
Raw footage, renders and analytics exports are git-ignored. Run `bash scripts/privacy-scan.sh` before pushing anywhere. Keep this repo private: the library contains community packs whose licenses haven't all been checked for public sharing.
