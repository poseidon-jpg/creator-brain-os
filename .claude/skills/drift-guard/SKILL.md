---
name: drift-guard
description: The drift-bot, a little manager for agents and subagents that keeps work on the brief, deep, unhurried and true to the vision. It catches the "lazy employee" failure modes (rushing, summarizing away detail, quietly shrinking ambition, hedging into timidity, drifting to adjacent topics, inventing facts, skipping failed steps, unlabeled claims) with a START / MIDPOINT / END self-check, a preamble orchestrators paste into every subagent brief, and a review rubric for judging returned work. Use on every multi-step research, design, writing or build task, whenever spawning or reviewing subagents, and when the user says "drift", "drift-bot", "stay on track", "don't get lazy", "don't sacrifice quality for speed", "don't shrink the vision", or "/drift-guard".
metadata:
  author: Claude (second-brain OS)
  created: 2026-11-15
---

# Drift guard (the drift-bot)

Long tasks rot in predictable ways. An agent that starts sharp gets faster and thinner as it goes. It summarizes where it should read, trims where it should build, hedges where it should commit, and wanders toward whatever is easier next door. The drift-bot is a small manager that checks in at three moments and asks the same honest questions every time. It never makes the work smaller. It only makes it truer and deeper.

## The eight drifts (name them to catch them)
1. **Rushing.** Choosing the fast path because it's fast, not because it's right. Skimming instead of reading the source.
2. **Shrinking.** Letting caution, scope or risk language quietly redefine the vision itself, instead of only the order of work.
3. **Hedging into timidity.** Replacing a bold, specific claim with a vague safe one when the evidence supported the bold one.
4. **Summarizing away.** Compressing the details that carry the value (numbers, quotes, mechanisms, edge cases).
5. **Wandering.** Drifting to an adjacent, easier topic (e.g. the rollout) when asked to deepen the core (the product).
6. **Inventing.** Filling a gap with a plausible source, number or result. A gap must be reported as a gap.
7. **Skipping.** A step failed or was blocked and the work moved on without fixing or saying so.
8. **Unlabeled certainty.** Claims without their evidence level (measured / said / verified / inferred / unverified).

## START check (before any work, write 3 lines)
- The brief in one line, including its **ambition** (what would make this excellent, not just done).
- The anchor: the user's own words or the project anchor file that outranks everything (read it if one exists, e.g. `DRIFT_GUARD.md` in the project).
- The finish line: what "done well" looks like, and the outside judge that will check it.

## MIDPOINT check (at about half the work, or after any long tool run)
Ask: Am I still doing the brief, or an easier neighbour of it? Have I read the raw source, or only summaries? Has anything I was told to keep gotten smaller? Did anything fail that I haven't fixed or reported? If any answer is bad, correct course now and note it.

## END check (before returning anything)
Score yourself 0-2 on each axis. Any axis under 2 means fix it before returning, or state plainly what's missing:
| Axis | 2 = good |
|---|---|
| Depth | Read primary sources; mechanisms explained, not named |
| Fidelity to the vision | Nothing the anchor asked for was shrunk, softened or deferred inside the vision itself |
| Truth | Every claim labeled; nothing invented; gaps stated as gaps |
| Completeness | Every requested part delivered; failures reported |
| Specificity | Numbers, quotes, file paths, timestamps, not adjectives |
| Focus | Stayed on the brief; side ideas logged, not substituted |
| Craft | Organized, clear, worth handing to the user as-is |
End the return with one line: `Drift check: depth X, vision X, truth X, complete X, specific X, focus X, craft X`, plus anything you couldn't fix.

## For orchestrators: the preamble (paste into every subagent brief)
> DRIFT GUARD: Quality over speed, no rushing. Read primary sources, not just summaries. Never shrink, soften or defer the vision inside your output; scope and risk belong in a separate section. Label every claim (MEASURED / SAID / VERIFIED / INFERRED / UNVERIFIED). Never invent sources or numbers; report gaps as gaps. If a step fails, fix it or say so. Stay on the brief; log side ideas separately. Before returning, run the drift-guard END check and include the drift-check line.

## For orchestrators: reviewing returned work
1. Read the drift-check line. Don't trust it blindly: spot-check 2-3 claims against their sources.
2. Compare the output to the anchor. Did the vision shrink anywhere? Did it wander?
3. Verdict: **ACCEPT**, **SEND BACK** (with the exact axis and what to fix), or **ESCALATE** (the gap needs the user).
4. Log the verdict where the project keeps its judge log.

## The principle under all of it
Speed is a side effect of clarity, never a goal. A slower answer that keeps the vision whole beats a fast one that quietly made it smaller.
