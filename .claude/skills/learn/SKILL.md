---
name: learn
description: The learning loop. Joins the user's TikTok sales and view exports (CSV or screenshots in analytics/exports/) to studio/ledger.csv, ranks hook shapes, angles, lengths and caption styles by GMV per video, and writes what sells into analytics/learnings.md and the hook bank so the next /edit uses it. Use when the user says "/learn", "update learnings", "what's working", "which hooks sell", "here are my numbers", or drops files in analytics/exports/.
---

# /learn: what actually sells

## 1. Read the numbers
- Files in `analytics/exports/`: CSVs read directly; screenshots read with vision. Transcribe each row, and say if a row was unreadable.
- Join them to `studio/ledger.csv` by posted URL, or by date + product when there's no URL. Fill the `views`, `gmv` and `items_sold` columns. Ask about rows that won't join instead of guessing.

## 2. Rank (be honest about sample size)
- The primary metric is **GMV per video**, with GMV per 1,000 views as the second. Views alone never decide anything.
- Group by hook shape, angle, length band (≤20s, 21-35s, 36s+), caption style and product category. Show n for every group.
- **Groups under 10 videos are a hunch, not a finding.** Say so in the text. Expect most videos to flop: one operator reports a 2-3% hit rate (SAID).
- Run the `critic` agent on your conclusions before writing them.

## 3. Write it down
- `analytics/learnings.md` → under "Current read": the top findings with n, what to do more and less of, and what to test next (one clean A/B: the same body with 2 hook shapes).
- `creative/banks/hooks.md` → add sold hooks under "Winners" (hook text, shape, video, GMV, date).
- A durable lesson ("reply-to-comment videos sell 3x for kitchen products, n=14") → `node "tools/rubric-second-brain/brain.js" store "<lesson>" --type project --name learn-<slug>`.

## 4. Close the loop
Tell the user in 3-5 lines what changed and the one test to film next.
