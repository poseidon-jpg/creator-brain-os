# SOP 18: drift guard (the drift-bots)

Trigger: any long or multi-agent task (research, design, writing, builds), and every subagent you spawn. Goal: agents stay deep, unhurried and true to the vision, and none of them can quietly skip their self-review.

## The three layers
1. **The skill** `.claude/skills/drift-guard/SKILL.md`: names the 8 drifts (rushing, shrinking, hedging into timidity, summarizing away, wandering, inventing, skipping, unlabeled certainty). Has the START / MIDPOINT / END checks, the preamble for subagent briefs, and the review rubric.
2. **The project anchor** `<project>/DRIFT_GUARD.md`: the user's own words that outrank everything, plus the drifts already caught in that project. This repo's own anchor is `DRIFT_GUARD.md` at the root.
3. **The automatic drift-bots**, project hooks in `.claude/settings.json` (scripts in `.claude/drift/`):
   - `SubagentStart → start.sh` injects `guard.md` into every real subagent before its first step. Internal agents (empty agent_type) are skipped.
   - `SubagentStop → stopcheck.sh`: if the subagent's final message lacks the `Drift check:` line, it is sent back once (`decision: block`) to run its END check. `stop_hook_active` prevents loops, and claude-code-guide and statusline-setup are exempt.

## Steps for an orchestrator
1. Write the START check for yourself (brief, ambition, anchor, finish line, outside judge).
2. Paste the drift-guard preamble into every subagent brief (the hook also injects it, so this is belt and braces).
3. When work returns: read the drift-check line, spot-check 2-3 claims against their sources, compare against the anchor. Verdict: ACCEPT / SEND BACK (name the axis) / ESCALATE. Log it in the project's judge log.
4. Before any pitch or deliverable to the user: run the END check on your own work.

## Turning it off or changing it
Edit or remove the two entries under `hooks` in `.claude/settings.json`. Edit the injected text in `.claude/drift/guard.md`.

## Done when
Every subagent's final message ends with a drift-check line, and nothing the user asked for shrank between brief and result.
