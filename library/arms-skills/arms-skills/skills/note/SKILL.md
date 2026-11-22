---
name: note
description: "Parks the user's feedback for a skill or a product in its own file in a feedback folder, applies nothing until the user says apply, and ends every park with how many notes are pending. Also sweeps a chat for corrections the user made but never captured, and fixes the safe ones. Use when the user says \"/note\", \"note this\", \"park this for <skill>\", \"add to the <skill> feedback\", \"/note <skill> <text>\", pastes a feedback export from a review page, \"/note show\", \"what notes are open\", \"/note apply\", \"apply my notes\", \"/note sweep\", \"what did we learn\" or \"tune up\". Also sweep on your own when the user signals the session is done (\"that's it\", \"wrap up\", a handoff). Never parks on the agent's own judgment."
---

# Note

A parking lot for feedback, one file per skill or product. The principle: **the user decides when feedback becomes behaviour.** A parked note changes nothing until they say apply. So they can jot things down mid-review without a skill edit, a redo or a question coming back at them. The sweep is the net under the other path: corrections they gave in chat that nothing captured.

This skill runs on your smallest, cheapest model. Parking a line, showing a list and counting lines need speed, not depth. If your agent lets a skill choose its model, set this skill to your smallest one.

## Setup (once)

**Feedback folder:** `feedback/` at the root of the user's workspace, unless they name another place. The default is fine to keep. If you change it, write the new folder here, so every run uses the same one:

```text
FEEDBACK_DIR = feedback/
```

Keep it outside the skill folders. Skills get copied and shared, and a feedback file inside one would travel with it.

## Rules (never skipped)

1. **One file per thing, in one folder.** `<FEEDBACK_DIR>/<name>.md`, for example `newsletter.md`, `thumbnails.md`, `review-page.md`. A skill or product gets its file on its first note, from the template below. A product is anything built that keeps running after the job: a dashboard, an app, a page template. Never keep a second feedback file for the same thing anywhere else. **A product's file opens with the path of its one source**, and every new copy of that product is made from that source, never from a sibling copy, because an old copy can predate fixes already applied.
2. **Parked means parked until the user releases it.** Nothing in the Inbox is applied to a skill, a file or any work until they say apply. Not at session end, not by the sweep, not because it looks obviously right. On release, every line is applied by the Apply steps below, except a line with a big open question. That one stays parked and ends the reply as a ⚠️ bullet.
3. **Chat is still chat.** A correction the user gives in conversation gets acted on in conversation. `/note` is for what they want kept, not done. When it's unclear which they mean, act on it in chat. Never park on a guess.
4. **Every note is mapped to the skill or product it most likely belongs to, and the mapping is written on the line**, so the user can scan a file later and see what each note will change. A skill named in the note wins ("/note newsletter ..."). Otherwise pick by subject. Feedback about a thing on screen the user works in (a review page, a dashboard, an app) maps to that product, not to the skill that built it. The test: which file has to change for the fix to hold next time. Two equally likely owners: park under the stronger one, name both, and say so in the reply rather than asking.
5. **Every parked line keeps its date, its source and its owner.** `- 2026-03-04 (user, chat) → /newsletter: the subject line is too long`. With a second skill: `→ /newsletter (also /thumbnails): ...`. A line from a pasted export says so: `(user, review page export)`. In a build session, add the project tag to the source, `(user, chat, spring-launch)`, so `/note show spring-launch` can print one session's feedback back across every file.
6. **Only the user adds notes.** A line goes into a feedback file only when the user says `/note`, "note this", or pastes a feedback export. Never park from your own judgment: no corrections captured on the side, no sweep findings, no flags from a research pass. The Inbox is the user's review queue, and every line they didn't ask for is one more they must read before they can say apply. When they do say `/note`, park it in that turn, before other work, because long sessions get compacted and a note that only lives in chat is lost.
7. **A note that arrives twice stops the work.** The second time the user says the same thing, the fix moves to the source that would stop it coming back (the skill, the template, the product's reusable file), and every open piece of work is checked against it. Mark the row `repeat`.

A review page you build for the user can export its feedback in the rule 5 line format, so a paste lands in the Inbox as-is. Its general lines ("for next time", "as a rule", anything that changes how the next one is built) park from the paste. Fixes to one specific item are work, done in chat.

## Workflow

**Park** (`/note [skill] <text>`, or any "note this" phrasing):
1. Map the note to its owner by rule 4 and pick that file. If the file doesn't exist yet, create it (and the folder) from the template under Templates first. Done when the owner's file exists.
2. Search that file's Processed table for the same words first. A match is a repeat: the line says `repeat of row N` and rule 7 applies.
3. Append one line under `## Inbox` in the rule 5 format, the user's words verbatim after the mapping, no rewriting.
4. Run the pending count below and end the reply with it: `Parked in /newsletter · 4 pending there · 19 across all notes`. The count is how the user knows how much is waiting for review.

**Show** (`/note show [skill | project tag]`): print the Inbox lines of that file (or every line with that tag) with their dates and owners, grouped by owner. With no argument, print one row per file: Inbox count and oldest date, oldest first, so a growing backlog is easy to see.

**Apply** (`/note apply <skill>` or `apply all`):
1. Read the Inbox. For each line, name the principle behind it in one sentence (why the user wants it, not just what) and the file it will change. If the user wants to check before you apply, every question names that file, so they see where each note lands.
2. If another session might be editing the same file, check first. Two writers on one file overwrite each other.
3. **Absorb, don't layer.** Find the rule in the skill that the note changes and rewrite that rule around the principle. Delete what the change makes redundant. Never append a dated block under the last one. A good apply often makes the skill shorter.
4. For a product, the fix lands in the reusable source (the template or builder the next project starts from), never only in one job's copy, because a fix that lives in a copy is lost on the next project.
5. If a note also asks for work (a redo, a re-render, a resend), do the work only if the apply message says so. Otherwise apply to the skill and list the work as the next step.
6. Move each line from Inbox to the Processed table: number, date, the user's words, the principle, where it was applied. Done when the Inbox is empty (or holds only lines the user said to leave), and the reply ends with the pending count.

**Sweep** (`/note sweep`, "what did we learn", "tune up", and unasked when the user signals the session is done, because forgetting is the usual miss). It catches one thing nothing else does: a correction the user made in chat that never became a stored rule, a parked note, or a fix in the file that owns it. It reads the Inbox but never writes to it or releases it (rules 2 and 6).
1. Scan the chat for the user's corrections: "no", "wrong", "not that", "don't", a redo, a reversed pick. If the chat was compacted, search the saved transcript for those words if your agent keeps one, because early corrections may survive only as a summary line.
2. Check the file each correction belongs to (the skill, the product's source, memory) and the Inbox. If it's already there, drop it without mention. A rule fixed in the last week and broken again gets louder (higher in its file, stronger wording), not a second copy. A skill that covered the chat's main task but was never opened needs better trigger words.
3. Fix up to 5 by Apply steps 3 and 4, one reply line each: the file and the change. Anything risky (deleting, posting, paid work, production settings), anything to build, or a finding with an open question ends the reply as a ⚠️ bullet instead. "Clean, nothing to sweep." is a full answer.

## Decisions behind the design

- **The sweep neither parks nor releases.** Its findings are the agent's judgment, not the user's notes. It fixes them by its own steps or lists them, and never writes them into a feedback file.
- **"calibrate" is not a sweep trigger.** It belongs to the `calibrate` skill, which saves what the user points at, when they say it. The sweep hunts for what they never pointed at.

## Templates

New feedback file:

```markdown
# Feedback for /<skill>

The user's parking lot for this skill. Write anything under **Inbox**, any format, any time (`/note <skill> ...` does the same from chat).
Nothing here is applied until the user says apply (`/note apply <skill>`). Then each Inbox line becomes a row in the table
below with its principle, gets absorbed into the skill (absorb, never layer), and leaves the Inbox.

Source (products only): <path to the one source every copy is made from>

## Inbox (parked, not applied)

- 

## Processed (each row says where it went)

| # | Date | User said | Principle | Applied in |
|---|---|---|---|---|
```

Pending count (Inbox lines per file, then the total), run after every park and every apply. Set `FEEDBACK_DIR` to your folder. Any shell with `awk` works; without one, count the `- <date>` lines under each `## Inbox` by hand.

```bash
FEEDBACK_DIR=feedback; t=0; for f in "$FEEDBACK_DIR"/*.md; do [ -f "$f" ] || continue; n=$(awk '/^## Inbox/{f=1;next} /^## /{f=0} f && /^- [0-9]/' "$f" | wc -l); [ "$n" -gt 0 ] && echo "$n $(basename "$f" .md)"; t=$((t+n)); done; echo "$t total"
```

An empty or missing folder prints `0 total`.
