---
name: calibrate
description: Teaches the agent a lasting lesson. Saves what the user taught into the agent's memory as one linked memory file, and fixes the skill it belongs to, so every future session remembers it. Use when the user types "/calibrate", "/calibrate" plus what to remember, "calibrate", "remember this next session", "remember this for next time", "make sure you remember", or "teach yourself this". With text, saves that text. Bare /calibrate saves the last thing the user said or decided plus their biggest feedback of the session.
---

# Calibrate

The user says `/calibrate` when something should outlive this chat. Anything left only in the chat is gone next session. So it goes into memory in the same turn, before anything else.

## The memory store

The agent's own memory folder plus its index file. One memory per file, one line per memory in the index. If the user has no memory folder yet, make `memory/` at the root of their workspace with an index file `memory/MEMORY.md`, and say where it is in the reply.

If the user runs the RUBRIC Agentic OS v2 or the RUBRIC Second Brain, its `brain.js recall "<question>"` and `brain.js store` commands do the recall and store steps below. Find the path to `brain.js` in your own setup.

Memories link to each other with `[[slug]]` lines. A memory map (or any search that follows links) uses them to connect one memory to the next. A memory with no links is an island nothing leads to, so every save links in.

## What to save

- **`/calibrate <text>`** = that text.
- **Bare `/calibrate`** = two things. (1) The last thing the user said, decided or corrected. (2) Their **biggest feedback of the session**: the correction that would cost them the most to give again. Look for what they repeated, what they pushed back on hardest (caps, "ugh", "again", "always"), and what changes the most future work. A rule a skill runs every week beats a one-off fix. If (1) and (2) are the same, save one. If the biggest feedback is already in memory from earlier in the session, check it says what they meant and leave it.

## How to save each one

1. **Recall first.** Without `brain.js`, recall is a plain text search over the memory folder and its index, so it only finds the exact words. Search with two or three different wordings of the gist, and keep the 5 closest hits. If a memory already covers it, edit that file instead of adding a second one, because two copies drift apart and the next search finds the wrong one.
2. **Pick the type.** How the agent should work = `feedback`. A fact about the user = `user`. The state of a piece of work = `project`. Where something lives (a link, a path, a tool) = `reference`.
3. **Store it.** One fact per file, named `<type>_<short-slug>.md`. The type sits in both the file name and the `type:` line on purpose: the name groups files when you list the folder, and the `type:` line lets a search or a tool read it without parsing names. Keep them the same. The why is the user's own words, with the real date (never "tomorrow"):

   ```markdown
   ---
   name: <Short Title>
   type: feedback
   ---
   <The fact, in plain words. One idea.>

   Why: "<the user's own words>" (2026-03-04)

   Related: [[feedback_closest-memory]], [[project_other-close-one]]
   ```

   Then add one line to the index: `- [Short Title](<file name>) - <one line on what it says>`.
4. **Link it.** The `Related:` line names the closest memories from step 1, so the map connects it. If one of them should point back, add the new slug to its `Related:` line too. For the very first memory in a store, write `Related: none yet`.
5. **Fix the owner.** If the lesson changes how a skill works, edit that skill in the same turn. The skill is what runs next time, and a memory alone can be missed. Rewrite the rule it changes; don't append a dated note under the last one.
6. **Check it lands.** Search again with the words the user would use to ask about it. The new file should come up first. If it doesn't, put those words into the fact or the slug and check again.

## Reply

One line per thing saved: `Remembered: <the gist>`, the file, and the skill if one changed. For bare `/calibrate`, label which one was the biggest feedback. Then carry on with whatever else the user asked.

Never park a `/calibrate` for later, and never ask the user to repeat it.

Not the same as `/note sweep` (in the `note` skill): the sweep hunts the chat for corrections the user never captured, at session end. `/calibrate` saves what the user points at, when they say it.
