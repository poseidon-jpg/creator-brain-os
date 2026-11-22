---
name: edit
description: Runs the TikTok Shop video pipeline end to end. Raw iPhone clips become a few genuinely different, captioned, judged, post-ready variants with captions and a posting checklist. The model chooses, the code cuts. Use when the user says "/edit", "edit today's clips", "edit my videos", "cut this", "make videos for <product>", "new batch", or drops clips in studio/inbox.
---

# /edit: clips to post-ready videos

Read `studio/PIPELINE.md` once per session. Commands are `python3 tools/pipeline/pipeline.py <cmd>` from the repo root (the interface is in `tools/pipeline/SPEC.md`).

**The rule that makes this work:** you choose which words, takes and hooks; the code does all timing. Never write seconds for speech, never hand-edit ffmpeg commands, never grade your own render.

## 0. START check (drift-guard, 3 lines in chat)
Brief: product + how many variants. Anchor: `studio/TASTE.md` + `analytics/learnings.md`. Finish line: N variants pass `qa` and `video-judge`, and they're in `studio/ready/`.

## 1. Set up the batch
- Which product? If `shop/products/<slug>/brief.md` doesn't exist, make it from `shop/products/_TEMPLATE.md` with the user (paste-in only, no scraping).
- Batch name `YYYY-MM-DD-<slug>`. Run `new <batch> --product <slug>`.
- Clips: if `studio/inbox/` is empty, offer `bash tools/pipeline/import-from-photos.sh` (pulls the last 2 days of videos from iCloud Photos). Then `ingest <batch>`. Report HDR or variable-frame-rate warnings plainly.

## 2. Read the footage
- `analyze <batch>`, then read `log/packed.md` (phrase lines with word indexes, gaps, retake groups, flags).
- Look at thumbs or contact sheets only at decision points (which take is better lit, is the product visible), not as a scan.
- Map the shoot: hooks found (the user said "hook one…"), body takes, proof moments, CTA takes, B-roll, and dead or bad takes. Write it to `plan/shoot-map.md`.

## 3. Plan the variants (decide, then get a second opinion)
- Read `studio/TASTE.md` (their verdicts win), `analytics/learnings.md`, `creative/banks/hooks.md` and `studio/RUBRIC.md`.
- Plan **3-5 variants** (fewer if the footage is thin). Each must differ in **hook shape and spoken hook and angle** (story order, proof beat, reply framing). Use the 5 beats HOOK, PROBLEM, SOLUTION, PROOF, CTA, with the hook payload in the first 3s. Pick lengths per format from RUBRIC.md.
- Write `plan/variants.json`: per variant, id, hook shape, angle, target length, the headline text for the first 3s, and why.
- High-stakes batch (a new product, or the user asked)? Send the plan to the `critic` agent first and fix anything fatal.

## 4. Cut
- For each variant write `cuts/<variant>.cutlist.json` (word-indexed, the `quote` must match the words exactly), with `"headline": {"text": "…", "t_out": 2.5}` (the on-screen hook text, max 6s, in the creator's voice) and `"caption": "…"` (the post caption). Then `compile <batch> <variant>`.
- Compiler errors are facts, not suggestions. Fix and recompile. **Three failed rounds on the same variant: stop and ask the user.**

## 5. Render and check
- `render <batch> <variant>` for each, then `qa <batch> <variant>` and `similarity <batch>`.
- A hard `qa` fail goes back to step 4 (it counts toward the 3 rounds). A `near-duplicate` means change the angle, not the captions.
- **Anti-slop gate on every word you wrote:** run `python3 tools/text-lint/slop_lint.py "<headline>"` for each on-screen headline, and `--file` on each post caption. Any fail means rewrite in the creator's own voice: lowercase-casual, specific, a little imperfect, the way they actually talked in the clip (steal their phrases from the transcript). Write the result to `qa/<variant>/slop.json`. Then run the `humanizer` skill in Detect mode on the caption as a second opinion.

## 6. Outside judge
- Spawn the `video-judge` agent once for the batch. Give it the batch path and the variant list, and nothing about your reasoning. It writes `qa/<variant>/judge.json` for each, with the QA report's hash. **Never write or edit judge.json yourself**: `deliver` rejects any pass without the judge's hash.
- `reject` goes back to step 4 with its `one_fix`. `unknown` gets shown to the user and decided by them.

## 7. Deliver and learn
- `deliver <batch>` copies the passes to `studio/ready/<batch>/` with captions and `POSTING-CHECKLIST.md`.
- Show the user: one line per variant (hook shape, length, the judge's one-line why) plus the contact sheets. Offer to open the folder.
- Ask for their verdicts. Every reaction ("love the caption", "too fast") goes into `studio/TASTE.md` in their words. If it's a rule a script can check, also park it with `/note` for the pipeline (rule + check + negative test, per `tools/pipeline/SPEC.md`).
- Append one row per delivered variant to `studio/ledger.csv`: date, batch, variant, product, hook shape, angle, length, caption style, posted_url (blank).

## 8. END check
The drift-guard 7-axis score in one line, plus anything that didn't pass and why.
