# SOP 13: wrap-up and handoff when a chat is running out of context

Trigger: you say "we're at ~90% context, wrap up" (or you notice long history, summaries, repeated re-reading). Goal: the next chat starts cold and loses nothing. Do not start new work; consolidate.

## Steps (in this order)
1. **Say the state in one line** (what's done, what's proven, what's not). No spin: if a test failed, say it failed.
2. **Write or update the handoff doc** for the project, in the project's folder (`<project>/HANDOFF.md`; for a video batch: `studio/projects/<batch>/HANDOFF.md`). Use the template below. It must be enough on its own.
3. **Update the memory**: one `project_*` memory with what exists / what's left, one `feedback_*` memory per durable lesson (with **Why** and **How to apply**), and the `memory/MEMORY.md` index lines. Facts that are already in a file stay in the file.
3b. **If the session carried your verdicts on videos** ("this hook works", "never do X caption style"), write each one into `studio/TASTE.md` first, then into memory as feedback.
4. **Update pointers**: `CLAUDE.md` (only if a new top-level system or rule), the SOP index, and any "superseded" notes in older docs.
5. **Record every failure** as a row in the relevant failure map (`studio/failure-map.md`), even unfixed ones (status `open`).
6. **Clean waste (only waste)**: look first (sizes, references, checksums). Delete only: OS junk (`.DS_Store`), caches (`__pycache__`), regenerable intermediates, rejected scratch renders, byte-identical duplicates. Keep: anything you chose between, anything referenced by a doc, evidence images, sources, the venv. List what you kept as "archive candidates" in the handoff. Log what was deleted in the handoff and in the affected folder's log.
7. **Verify before you stop**: run the project's selftest, check every path named in the handoff exists, JSON parses, any API credit balance is current.
8. **Final message to you**: what changed, what's verified vs not, the file to start from, and the one-line paste for the new chat. No questions unless a decision truly blocks.

## Handoff template (sections, in order)
1. Title + date + "read this first".
2. **Paste-this starter prompt** for the new chat (3 lines: what to read, what to do first, the rules for output).
3. What it is (one paragraph) and how it fits in the master brain (folders, SOPs, skills, memory).
4. File map (tree with one-line purposes).
5. IDs, credentials-free references, credits and deadlines.
6. Commands (copy-paste).
7. State: built and tested / validated results / not tested.
8. Decisions already made (so the new chat does not reopen them) and open questions only the user can answer.
9. Next steps in order, each concrete enough to run.
10. Gotchas learned (tool limits, bugs, costly mistakes).
11. Cleanup record + archive candidates.
12. Rules that never bend.

## Done when
A new chat given only the starter prompt can run Next step 1 without asking anything, and nothing important lives only in this chat.

## Common mistakes
- Writing the handoff from memory instead of re-checking the files and the credit balance.
- Burying a failed test (put it in State, plainly).
- Deleting rejected variants the user chose between; ask or archive instead.
- Starting new generations "while wrapping up" (credits and context).
