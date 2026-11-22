# Creator Brain OS: your hub

This folder is your second brain and video studio for **TikTok Shop affiliate content**. Open it in the Claude desktop app (Code tab), or run `claude` in this folder. Everything Claude knows about your business lives here, organized by what it's for.

> **First time here?** Say **"set me up"**. Claude runs [docs/START-HERE.md](docs/START-HERE.md): it asks you a few questions, writes your answers into memory, and checks that the tools work.

## Operating rules (apply to every task)

Read [docs/ai-ambition-thesis.md](docs/ai-ambition-thesis.md). In short:
- **Altitude:** before starting, state the goal beyond the goal in one line. For this business that's usually **more GMV per hour of filming**, not just "a video".
- **Depth:** work from raw material (your real clips, real winning videos, real numbers) with the methods a top pro editor or creative strategist would use.
- **Range:** on high-stakes work, bring in methods from other fields (about 5 experts, 2 adversarial). Use their methods, don't role-play them.
- **Outside judge:** never grade your own work on anything that matters. Use a metric, a tool, or a separate judge agent (`video-judge`, `critic`).
- **Serendipity max (always):** research and brainstorming run the `serendipity-max` loop: log sparks with real sources, follow the best 1-2 hops, a separate judge picks what goes deeper. Quality over speed.
- **Drift guard (always):** long tasks and every subagent brief use the `drift-guard` skill (START/MIDPOINT/END checks). The drift-bot hooks in `.claude/settings.json` enforce it on every subagent automatically. Read a project's `DRIFT_GUARD.md` first if it has one.
- **Live canvas updates (always):** on long work, give short updates as each finding lands, like watching a painter build a canvas. Don't save it all for one dump at the end.
- **Verify, never trust:** anything that matters is judged by a separate grader with a rubric, never by the agent that made it. A check can't be edited by the change it judges. Prefer evidence the owner can see (a rendered video, a screenshot) over claims. A check still failing after three fix rounds stops the work and goes to the owner.
- **Explain simply:** plain words, one step at a time, exact clicks. Confirm before deleting or overwriting anything. Read a file before changing it.

## Agent hierarchy (who does what)

| Role | Model | Used for |
|---|---|---|
| Orchestrator (the main chat) | Opus | Decisions, planning, QA/QC, putting it all together |
| `scout` agent | Haiku | Bulk reading, scanning folders, collecting examples |
| `builder` agent | Sonnet | Scoped edits, running the video pipeline steps |
| `video-judge` agent | Sonnet | Grades every rendered video against the rubric before you see it |
| `critic` agent | Sonnet | Red-teams plans, hooks and scripts. Finds what's wrong, fixes nothing |
| Hard calls | Fable (read-only reviewer) | The hardest architecture questions, final reviews |

**Video editing (/edit):** Opus plans the variants and gives the final accept; Sonnet (normal effort) writes cut lists, captions and runs `video-judge`; Haiku only for scouting and corpus frame labels. Haiku is **not supported** for /edit until a blind eval across model tiers proves otherwise (DRIFT_GUARD.md question 3).

Raise effort one level before switching to a bigger model. Keep the expensive model's context for decisions.

## The video pipeline (the core of this hub)

**Read [studio/PIPELINE.md](studio/PIPELINE.md) before any editing job.** In one line: raw iPhone clips land in `studio/inbox/` → Claude logs and transcribes them → picks the best takes and hooks → cuts and captions variants → `video-judge` grades them → passes go to `studio/ready/` with a caption + hashtags file → you post from your phone and tap **Add product**.
- Say **"/edit"** (or "edit today's clips") to run it.
- What you liked or hated about past edits lives in [studio/TASTE.md](studio/TASTE.md). Your verdicts outrank the judge.
- Measured norms from real winning videos in your category live in `studio/corpus/STATS.md` (built by **/corpus**). Editor and judge read it every batch. If it doesn't exist yet, say so and suggest running /corpus.
- Every headline and caption passes `tools/text-lint/slop_lint.py` before it ships.

## Map of the hub

| Folder | Department | What lives there |
|---|---|---|
| `shop/` | Shop & Products | `products/<product>/` (one folder per product: page info, selling points, commission, sample status), `product-tracker.md` |
| `studio/` | Video Studio | `inbox/` (raw clips land here), `projects/<date-product>/` (working files), `ready/` (post-ready videos), `PIPELINE.md`, `TASTE.md`, `SHOOTING-GUIDE.md` |
| `creative/` | Creative Lab | `banks/` (hooks, angles, scripts, captions that worked), `swipe/` (winning videos from others, analyzed), `lab/ideas/` |
| `analytics/` | Analytics | CSV exports from TikTok Studio / Creator Center, `learnings.md` (what sells and why) |
| `memory/` | HQ | One fact per file + `MEMORY.md` index |
| `docs/` | HQ | Thesis, START-HERE, SOPs in `docs/sops/` |
| `research/` | HQ | The research this system was built from (spark logs, sources) |
| `tools/` | HQ | Command Center (`rubric-second-brain`), micro-apps, pipeline scripts |
| `library/` | HQ | Extra skills, staged but **not installed**. Read before installing (see `library/README.md`) |
| `extras/` | HQ | Optional add-ons (a background theme mod) |

## Finding things

- **brain recall FIRST (MANDATORY for stored facts):** when asked about a stored fact (decisions, products, commissions, dates, preferences, "what did we decide about X"), the FIRST tool call is
  `node "tools/rubric-second-brain/brain.js" recall "question"` (run from this folder), before any Read or Grep. Answer from its output and cite the file. If recall misses, fall through to grep.
- `node "tools/rubric-second-brain/brain.js" ask "question"` builds a one-turn prompt with the evidence attached and copies it to the clipboard. brain.js never calls any API.

## Saving facts (default)

- `node "tools/rubric-second-brain/brain.js" store "fact" --type feedback|project|user|reference --name slug` writes the memory file + index line in one step.
- Memory for this hub lives in `memory/`, not in Claude's built-in per-project memory folder.

## Command Center

```bash
node "tools/rubric-second-brain/server.js"
```
Then open http://localhost:5210. It has nine views (keys 1–9): Home (what needs you now), Recos, Usage (spend + context), Skills, Routines, Artifacts, Timeline, Apps and Memory. ⌘K searches. In the desktop app you can also say "open the command center".
- Safety: the server only answers on localhost and refuses cross-site requests.

## Privacy

Before pushing this repo anywhere, run `bash scripts/privacy-scan.sh`. Add your own name, handles and emails to `scripts/.privacy-patterns` so they can never leak into a public file.
