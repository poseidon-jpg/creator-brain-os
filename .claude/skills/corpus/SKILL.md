---
name: corpus
description: Builds and measures a corpus of real winning TikTok Shop videos in the user's category, so the editor's numbers (hook timing, length, cut rate, caption style, the words real creators use) are MEASURED instead of guessed. Writes studio/corpus/STATS.md, which the editor, the judge and the anti-slop check read. Use when the user says "/corpus", "study winning videos", "what do top videos in my niche do", "calibrate the editor", or drops winner videos in studio/corpus/inbox/.
---

# /corpus: learn from real winners

The user collects the videos; this skill measures them locally. The full protocol and sources are in `research/corpus-measured.md`.

## 1. Collect (the user does this, about 30 min, once per category)
1. Pick ~50-100 **top affiliate videos in your category from the last 90 days** (Kalodata or FastMoss top videos, Creative Center Top Ads, or the top videos on the products you promote). Your own posted videos count too, and they become the best corpus once you have 30+.
2. Put the files in `studio/corpus/inbox/`.
3. Fill `studio/corpus/links.csv`: `file,url,views,gmv,items_sold,category,source` (copy the numbers the tool shows, and leave unknowns blank).
**Sample size reality:** 50-100 videos give honest norms and big effects only. Telling apart 5-8% differences takes 1,000+ per group (derived from MediaLabs' intervals), so treat small gaps as noise.

## 2. Measure (automatic)
For each file run the pipeline's `analyze` on it as its own batch (`new corpus-<category> --product corpus`, then `ingest --from studio/corpus/inbox`, then `analyze`). That gives the per-video log: length, words with timestamps, words in the first 3s, speech rate, silences, scene cuts per second and loudness.
On-screen text timing needs a vision read (there's no OCR in the pipeline). Then a vision pass on the thumbs/contact sheet at 0, 0.5, 1, 2 and 3s per video (Sonnet is enough): product visible by when, face on screen yes/no, caption style (native stroke / box / none), text position, setting (home / car / bathroom / outdoors), hook shape (from `creative/banks/hooks.md`).
Write one row per video to `studio/corpus/measures.csv`.

## 3. Distill
`studio/corpus/STATS.md`: for each parameter the median, the interquartile range and n, split top-third vs bottom-third by GMV (or views if GMV is missing, and say so). Label everything MEASURED (n=…, category, date range). Add:
- **Phrase bank:** the openers and CTAs real creators actually said (from the transcripts). These become the voice reference for hooks and the anti-slop check.
- **Recalibration proposals** for `studio/RUBRIC.md` (length bands, hook timing, cut rate, caption style). Run the `critic` agent on them, then show the user before changing the rubric.

## 4. Keep it fresh
Re-run every ~60 days or when a category's results drop. Old STATS.md files move to `studio/corpus/archive/`.
