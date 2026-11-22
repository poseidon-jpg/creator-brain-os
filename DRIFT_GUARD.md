# DRIFT_GUARD.md: the build anchor (outranks every shortcut)

Every agent working on this repo reads this first.

## The brief, in the owner's words (condensed)
Build a "somewhat barebones but functional" version of a working Claude Code second-brain OS for a **TikTok Shop affiliate creator**, using **Claude Code (desktop app Code tab + CLI)**, not chat or cowork. Include **all the tools and skills** (agent hierarchy, verification systems, drift guards, serendipity maxing), with nothing personal: no music folder, no VST folder, no one's name, brands or partners. Her main job is **TikTok Shop affiliate videos**, so the repo's core is a **fully automated, high-quality editing pipeline** built from deep research (underground repos, top operators, published teardowns of the best-performing affiliate/UGC videos), and not a generic template.

## Goal beyond the goal (altitude)
The goal isn't "a repo". It's **more GMV per hour of filming**: the creator films raw iPhone clips, and the system turns them into many post-ready, on-meta variations and learns from what sells.

## Milestones and what the drift guard checks at each one
| # | Milestone | Done when | Outside judge |
|---|---|---|---|
| M0 | Anchor + plan | This file exists | Owner reads it |
| M1 | Research lanes run in parallel (meta, editing stack, underground, ops) | Each lane returns a spark log with real URLs | Separate judge agent: fire / interesting / dead |
| M2 | Scrubbed skeleton (skills, hooks, Command Center, memory, SOPs) | Repo boots; zero personal strings | `scripts/privacy-scan.sh` (grep gate) + reviewer agent |
| M3 | Research synthesis → pipeline design | One recommended stack with evidence labels, alternatives noted | Adversarial critic agent |
| M4 | Pipeline built into repo (skills + scripts + SOP) | `ingest → analyze → cut → caption → variants → QA` documented and runnable to the extent tools allow | Dry-run on a sample clip + judge |
| M5 | Final QA + push | Fresh-clone check, privacy scan clean, README onboarding works | Separate reviewer agent; owner approves visibility |

## Sub-milestone drift checks
- **START** (each milestone): brief in one line, the anchor, the finish line + judge.
- **MIDPOINT**: am I building the pipeline or polishing the template? Did any skill get dropped "for simplicity"? (Not allowed. Barebones means fewer personal folders, not fewer capabilities.)
- **END**: 7-axis score; anything under 2 gets fixed or reported.

## The final judge's questions (owner's words come first; they outrank the rest)
1. **Is this actually optimized and trained on real TikTok Shop affiliate and UGC content?** Every editing number (hook timing, length, cut density, caption style) must trace to MEASURED data from real winning videos, not just advice posts. If it doesn't, the answer is "no", said plainly.
2. **Did we drift-guard hard enough to avoid anything that even remotely looks like AI slop?** That covers on-screen text, post captions, caption styling, pacing and visuals. The test is whether it reads like a real creator made it.
3. **Can the cheapest models (Haiku, low-effort Sonnet) run the video editing and get it right?** Only an eval proves it: the same footage edited by each model tier, judged blind.
4. (Orchestrator's, for the second brain) Does a fresh clone boot for a non-technical person: skills load project-scoped, hooks fire, Command Center starts, brain recall answers, no dangling references to missing files, and the privacy scan is clean?

## Never
- Ship a personal string (names, emails, brands, paths under a real home folder, private memories).
- Invent a stat about TikTok performance. Every number carries its source and label.
- Treat a trending claim ("Remotion is dead") as fact without checking it.
