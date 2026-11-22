# Video rubric (what `video-judge` grades, and the only reject codes it may use)

Rules come from `research/lane-a-creative-meta.md` (R-numbers) and are labeled with their evidence. Defaults are **starting hypotheses**: your verdicts in `TASTE.md` and your sales in `analytics/learnings.md` overrule them.

## Hard specs (checked by script, `tools/pipeline/check.sh`)
| Check | Pass | Code |
|---|---|---|
| Resolution / aspect | 1080x1920, 9:16 | `spec-res` |
| Frame rate | constant 30 (or 60) fps | `spec-fps` |
| Audio | present, integrated loudness -14 LUFS ±1.5, true peak ≤ -1 dBTP | `spec-audio` |
| Length | soft warning outside 15-60s, never a reject on length alone. Median selling video 31s, 30-60s best per view but bands differ only ~10% (Hubfluence, n=12,881 selling videos, M3, vendor sells creator software; research/corpus-measured.md) | `spec-length` (warn) |
| Colour | not washed out / grey (an HDR tone-map failure) | `spec-color` |

## Safe zones (R9, SAID + MIT `ecommerce-video-skills`)
Keep captions, headline text and the key product shot out of: the **right edge** (TikTok's like/comment/share buttons), the **bottom ~20%** (caption + product card), and the **top ~8%** (status bar / tabs). Exact pixel boxes: see `tools/pipeline/SPEC.md`. Code: `safe-zone`.

## Structure (R1-R7)
| Check | Pass | Code |
|---|---|---|
| Hook → key message → CTA order | all three present, in order (VERIFIED) | `no-structure` |
| Product visible by **1s** for physical products (reject line 3s), hook payload ≤ 6s | 76% of top product ads show it by 1s (Cut Marketing, n=705 paid ads, M3); TikTok: 50% of ad recall by second 2 (brand-lift) | `slow-hook` |
| At least 2 of face, product, on-screen text in the first second, and the product **in frame with the face**, not face alone | Person-only frames hurt sales; the product must sit in the face frame (Yang et al., Marketing Science 2025, n=2,685 Douyin videos matched to sales; Pan et al., n=3,426), peer-reviewed, China not US | `thin-hook` |
| Opening has spoken line + on-screen headline + visual | all three in first 3s (SAID) | `thin-hook` |
| CTA | spoken or on-screen at the end (VERIFIED structure) | `no-cta` |
| Hands-only stretch > ~20s | covered by voice/face or cut (SAID) | `passive` |

## Cuts and captions (R8-R10)
| Check | Pass | Code |
|---|---|---|
| No mid-word cuts | every cut lands on a word edge or silence | `mid-word` |
| No dead air | no unintended silence > 0.4s | `dead-air` |
| No repeated take | the same line never appears twice | `repeat-take` |
| Captions match the words | caption text = transcript, no typos | `caption-wrong` |
| Captions readable | ≤ ~3 words lit at once, big, high contrast | `caption-unreadable` |

## Product integrity and compliance (R11-R19, VERIFIED unless marked)
Flag, never silently fix.
| Check | Code |
|---|---|
| Real product shown in motion, matching the listing (no stock/AI product) | `fake-product` |
| ≥ 3s continuous dynamic footage; no slideshow/screen-recording as the main content | `static` |
| No filter/grade changing the product's colour, size or effect; before/after in the same light | `misleading-visual` |
| Banned language in captions or speech: "100%", "guaranteed", "instant results", "no side effects", cure/treat/prevent, weight-loss promises, GLP-1, "lowest/cheapest price", competitor bashing, links, handles, QR codes, phone numbers | `banned-claim` |
| Before/after or time-bound claim without "Results may vary" | `no-disclaimer` |
| Music baked in that isn't from the Commercial Music Library (default: no music baked in). A product link can be added after posting only within 30 days and only with CML audio (VERIFIED), so attach the product at post time | `music-license` |
| Any AI-generated voice, face or B-roll without the disclosure flag in the run report | `ai-undisclosed` |

## Originality (R20-R26)
TikTok's published "acceptable variation" examples (a trim, filters, new music) are lighter than the first two rows below. Those two are a **deliberate conservative choice** for this hub, not TikTok policy, because nobody outside TikTok knows how duplicate detection works (research/JUDGE-M1.md). Loosen them only with evidence from your own account.
| Check | Code |
|---|---|
| Each variant differs from its siblings in hook text **and** spoken hook **and** angle (story order, proof beat or reply framing), not just captions or colour | `near-duplicate` |
| Footage overlap with a sibling variant in the same order > 60% (start strict, tune with data) | `near-duplicate` |
| No mirroring, frame insertion, layered overlays or other "format disguise" used to make a reused video look new (TikTok bans these when used to conceal a violation, VERIFIED) | `disguise` |
| A clean master (no captions/watermark) exported next to each variant (for GMV Max authorization) | `no-master` |

## Anti-slop (owner's question #2)
| Check | Code |
|---|---|
| Headline or caption fails `tools/text-lint/slop_lint.py` (ad-speak, Title Case, em dashes, emoji/hashtag stuffing, stacked hype words) | `slop` |
| Reads as made by an AI or an agency rather than a real creator (judge's eye, compared against `studio/corpus/STATS.md`) | `slop` |

## Scores (0-5 each): hook, clarity, pacing, captions, craft, compliance
Taste is a note, not a gate. Nothing is hidden from the owner because the judge disliked it.
