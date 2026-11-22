# JUDGE-M1: separate judge on the four research lanes

Judged 2026-11-21 by an agent that wrote none of the lanes. Anchor read first: `DRIFT_GUARD.md` (M1 = each lane returns a spark log with real URLs; judge says fire / interesting / dead).
Labels: CONFIRMED / WEAKENED / REFUTED for claim checks. Evidence labels: MEASURED (I ran it this session) / VERIFIED (I read the primary page this session) / INFERRED / UNVERIFIED.
Method: `gh api` for repo facts, npm API for downloads, WebFetch on primary TikTok / Anthropic / Remotion / HyperFrames pages, raw GitHub files for README/SKILL text, local `ffmpeg -filters`. TikTok Seller University pages were fetched through a summarizing fetch tool, so quotes below are the tool's extraction, not a line-by-line read; where wording matters I say so.

---

## 1. CLAIM CHECKS

| # | Claim (lane) | Verdict | Evidence (what I read / ran) |
|---|---|---|---|
| 1 | HyperFrames 87,855 stars vs Remotion 74,760 (B, C) | CONFIRMED | `gh api`: hyperframes 87,858 (Apache-2.0, created 2026-03-10, pushed 2026-11-22); remotion 74,760 (license NOASSERTION, created 2020-06-23, pushed 2026-11-20). Three-star drift is just time. MEASURED. |
| 2 | npm last-week downloads: hyperframes 1,506,221 vs remotion 4,728,369 (B) | CONFIRMED | `api.npmjs.org/downloads/point/last-week/...` returned exactly those numbers for 2026-11-14 to 11-20. MEASURED. The lane's own caveat holds: downloads include CI/transitive installs. Lane B's verdict ("Remotion not dead; HyperFrames not dominant") is sound. |
| 3 | HeyGen's comparison page admits Remotion is older, more established, with more templates; no "Remotion is dead" claim (B) | CONFIRMED | Page says Remotion "is older and much more established", "more templates, more tutorials, more answered questions". It gives no counts and does not call Remotion dead. The 12:30 vs 11:50 figure is end-to-end including the agent writing code, and the page says one run "decides nothing about quality". Lane B's S13 phrase is accurate. VERIFIED. |
| 4 | Remotion free up to 3 people; Creators $25/seat/mo; Automators $0.01/render, $100/mo min (B) | CONFIRMED | remotion.dev/docs/license/pricing.md: "individuals and companies of up to 3 people"; "$25 per month per seat"; "$0.01 per render ... increments of 1000 renders ($10) ... minimum $100 per month". VERIFIED. |
| 5 | video-use: 31,403 stars, MIT (B, C) | CONFIRMED | `gh api`: 31,403, MIT, created 2026-04-12, pushed 2026-10-08. MEASURED. |
| 6 | video-use hard rules: word-boundary cuts, 30-200 ms pad, 30 ms fades, subtitles last, per-segment extract then `-c copy` concat, 3-pass self-eval cap, "12 hard rules" (B, C) | CONFIRMED | Raw SKILL.md has a "Hard Rules" section numbered 1-12 exactly as described (rule 3 = 30 ms afades; rule 6 = never cut inside a word; rule 7 = pad 30-200 ms, "Scribe timestamps drift 50-100ms"; step 7 self-eval "Cap at 3 self-eval passes"). VERIFIED. Two things the lanes under-state: (a) SKILL.md rule 11 and workflow steps 3-4 make it conversational ("Never touch the cut until the user has confirmed the strategy"), so it is not unattended as shipped; (b) README requires an ElevenLabs Scribe key. Lane B notes the key and the swap; neither lane flags that the confirm-first rule must be replaced. Also: it says nothing vertical-specific (grep for 9:16 / vertical in README returned nothing), matching Lane B. |
| 7 | TikTok Content Posting API Direct Post has no product/shop/anchor field (D) | CONFIRMED | `post_info` fields on the reference page: privacy_level, title, disable_duet, disable_stitch, disable_comment, video_cover_timestamp_ms, brand_content_toggle, brand_organic_toggle, is_aigc. Product/shop/anchor: none. VERIFIED. |
| 8 | Unaudited API client = private only, 5 users / 24 h, account must be private at posting (D) | CONFIRMED | content-sharing-guidelines: "all content uploaded via this endpoint will be restricted to private viewing mode"; "Unaudited API Clients can allow up to 5 users to post in a 24 hour window"; accounts "must be set to private at posting time"; audit required to lift. 6 requests/min per token also confirmed. VERIFIED. |
| 9 | Direct Post "daily cap about 15 posts/creator" (D, D1) | WEAKENED | The reference page I read gives no numeric daily cap. It names the error `spam_risk_too_many_posts` and `reached_active_user_cap` with no numbers. The "15" may come from other docs but is not on the cited page. Treat as UNVERIFIED and do not hard-code. |
| 10 | Commercial Music Library: link added after posting only if within 30 days AND audio is CML-only; cannot edit links (A) | CONFIRMED | seller-us essay 5178002307598122: "posted in the last 30 days"; audio "must come only from the Commercial Music Library"; creators "NOT able to edit or update existing product links". VERIFIED. This also resolves Lane D's D5 conflict (see section 3, ruling 6). Open: whether her own spoken/original audio counts as "CML only" is not answered by the page. |
| 11 | TikTok originality/duplicate wording (A, C) | CONFIRMED with a caveat that changes how it should be used | UK course page: duplicates = other creators' content with "a few creative changes"; reposting your own earlier content treated as duplication; multi-account: only the first account is "authentic". Acceptable variations: trim "a few seconds", alter start/end points, add filters, different background music, re-edit for a different focus, testimonial into "reply-to-comment style". The other UK essay page (7841352058554114) did NOT mention trim/focus at all; the variation list is only on the course page. US wording not read (lane already flags this). Caveat: the "acceptable variation" list is light (trim, filters, music). Lane A's R20 (variant must differ in hook AND angle) is stricter than anything TikTok published. That is a legitimate conservative design choice, but it is INFERRED, not policy. |
| 12 | New creators capped at 3 e-commerce videos/day; eligible accounts 30 shoppable videos + 60 photo posts/day (A) | CONFIRMED, scope WEAKENED | US Policy Pulse: "up to 3 e-commerce videos per day" for newly onboarded "Official and Marketing Creators" in the Early-Stage Control Pilot until "bound for at least 30 days, reach 1,000 followers, and pass ... checks"; eligible accounts "30 shoppable short videos and 60 shoppable photo posts per day". The page text I got says Official and Marketing Creators; Lane A generalizes to "affiliate creators under 5,000 followers" (that second sentence was not in my extraction; page was truncated at 100k of 119k chars). Whether the pilot applies to HER account type is UNVERIFIED. |
| 13 | "Layered videos, frame insertion, format disguise are prohibited" as an editor hard no-go (A) | WEAKENED (overbroad, mis-dated) | Page text: "Any attempt to conceal policy violations through video editing is strictly prohibited", then Layered Videos = "top/bottom bars or unrelated content to hide prohibited content"; Frame Insertion = "irrelevant frames ('sandwich frames') to bypass detection"; Format Disguise = "altering aspect ratios, color layers, or overlays to conceal violations". All three are defined by intent to conceal. Ordinary captions, pillarbox fills or overlays are not the target. Also the page labels it a Sept 2025 update; Lane A says July 2025. R22 is safe to keep, but word it as "never use any of these to hide content" so the editor is not forbidden from normal overlays. |
| 14 | Passive / no-face creators flagged; vs "1.8x" faceless claim (A) | CONFIRMED (TikTok side) / REFUTED-as-evidence (1.8x) | US Content Success Guide: "Visuals with little-to-no human presence or activity" counts as still-frame content that "may lead to reduced visibility"; recommends "people on camera, adding camera movement, ... spoken or signed communication"; "Write new scripts and ideas for each video". It does NOT call such creators "unoriginal" (that wording is Lane A's third-party storika source). "50-70%" is "may help increase views by up to 50-70%", no source for the number. The 1.8x faceless figure was never fetched by Lane A and has no method. |
| 15 | xianyu110/ecommerce-video-skills: MIT, 152 stars, pushed 2026-10-05, 13 skills, -14 LUFS, safe zones (A) | CONFIRMED | `gh api`: MIT, 152 stars, created 2026-10-04 (created ONE DAY before last push, so it is a one-day-old repo: add to maturity risk), pushed 2026-10-05. LICENSE file begins "MIT License / Copyright (c) 2026 xianyu110". README (Chinese) lists 13 skills, two-pass loudnorm "≈ -14 LUFS", captions that avoid the bottom product card and right buttons. README credits other projects "only borrowed structure". Edge-tts dependency is LGPL-3.0. MEASURED/VERIFIED. Lane A did not mention the repo is 1 day old at last push, nor that README is Chinese-first. |
| 16 | clipforge is AGPL-3.0, 1,369 stars (A) | CONFIRMED | `gh api`: AGPL-3.0, 1,369, pushed 2026-11-20. Lane A's "do not copy AGPL code into a distributed template" is correct. |
| 17 | Claude API vision is images only, no video (B) | CONFIRMED | Fetched vision page (Opus 5.5 / Sonnet 5.5 etc. listed): title "send images to Claude"; grep of the full text for "video" returned zero hits. Limits: "100 for each request on the API, for models with a 200k-token context window; 600 ... for all other models"; 8000x8000 px max; 128 MB first-party request limit. Absence-of-evidence on this one page, but the page is the canonical vision doc. VERIFIED. Does not cover other surfaces (e.g. Files API with video) - not checked. |
| 18 | Vanszs/tiktok-viral-factory is vaporware (C) | CONFIRMED | Git tree: `agents/__init__.py`, `tools/__init__.py`, `workflows/__init__.py`, `mcp_bridge/__init__.py` all 0 bytes; README 12.6 KB, plan.md 41 KB; but `utils/llm.py` (1 KB), `config/settings.py` (4 KB), `models/schemas.py` (10 KB) exist. Lane C's "agents/tools/workflows/mcp_bridge are 0-byte" is exact; "everything is empty" would be too strong. 44 stars, no license, created and last pushed same day (2026-06-22). MEASURED. |
| 19 | Mac's ffmpeg 8.1.1 has no `zscale` / `libplacebo` (D) | CONFIRMED (on this machine) | `ffmpeg -filters | grep zscale|libplacebo|tonemap` returned only `tonemap`. MEASURED. Applies to the owner's Mac, not hers; lane already says the setup script must probe. |
| 20 | Bullseye census: videos per shop rise with GMV tier, "more videos and higher GMV per video both rise with shop size" (A, headline 2 and Deep Dive 2) | WEAKENED | Table fetched: videos/shop 76 / 255 / 148 / 501 / 573; GMV per video $18.87 / $64.27 / $232.56 / $143.63 / $305.49; affiliate share 57.5 / 79.2 / 64.3 / 71.7 / 75.8%. Neither series is monotonic (T3 has fewer videos than T2; T4 has lower GMV per video than T3). Author's own words: "directional benchmarks". The numbers Lane A quoted are right; the "both rise" summary is not. 121 shops, 28 days ending Aug 2026 confirmed. Brand-side, not creator-side. |
| 21 | Academy structure: hook = first 3-6 s, product-related; 4 styles (A) | CONFIRMED (secondary) | ppc.land (dated June 8, 2026) says hook = "first 3 to 6 seconds", "must be related to the featured product", four styles as listed, Academy guide dated May 20, 2026. VERIFIED via secondary source only; original Academy page still unread by anyone. |
| 22 | VoC thresholds conflict (1.5 vs 2.5 vs 3) (A, open thread 7) | REFUTED as a conflict | Same US Policy Pulse page contains both versions: April 2026 "above 2.5 may become disqualified"; May 2026 (effective May 7) "must maintain below 1.5 to qualify" and ">3 disqualified". It is a version history, not a source conflict. Lane A attributed the 2.5 to "one third-party source"; it is on the primary page. |
| 23 | Remotion "is dead" trending claim (DRIFT_GUARD Never-list) | REFUTED | Items 1-4. Latest Remotion release 4.0.545 on 2026-11-18, push 2026-11-20 (lane B, not re-run by me; push date I did confirm). |
| 24 | herk-edit-kit license (C) | CONFIRMED | GitHub API says NOASSERTION, but root LICENSE is MIT ("Copyright (c) 2026 Nate Herk"). Lane C's description is right. The "brand-asset clause" Lane C mentions was not re-checked. |

Not re-checked by me (carry their original labels): Kalodata e.l.f. 8.06 percent (lane says unread), Helium10 podcast numbers, adlibrary hook-rate numbers, Tryselects 578 s test, Gemini video doc figures, Creator Center "Video List" fields (D E1), osxphotos behaviour, X-access test (C section 4), TikTok ToS scraping clause (D C4, quote not re-read), commission and sample-cap claims.

---

## 2. SPARK VERDICTS

Format: id, verdict, one line of why. FIRE = build into the pipeline (or into the QA/ops layer). INTERESTING = park with a note. DEAD = cut. "(rule)" = FIRE as a constraint/rule, not a tool.

### Lane A (creative meta)

| Spark | Verdict | Why |
|---|---|---|
| A1 Academy hook/key message/CTA, 4 formats | FIRE | Only platform-authored structure; fixes hook window and format taxonomy. |
| A2 Posting limits, 3/day pilot, 30/60 caps | FIRE (rule) | Verified on primary page; but whether the pilot applies to her account is open (check 12). Make the cap a config value, default conservative. |
| A3 Layered/frame-insertion/format-disguise ban | FIRE (rule), reworded | Intent-to-conceal, see check 13. |
| A4 Duplicate-content policy, acceptable variation | FIRE (rule) | Verified on UK pages; US text unread. |
| A5 Helium10 50x5x3 modular batch | FIRE for the schema only | Hook x body x CTA is the right data model; the "150 videos" end is capped by A2/A4. Source is a brand-side seller, SAID. |
| A6 HACK structure, 20-40 s, minimal edit | INTERESTING | SAID; useful prior, not a rule. |
| A7 Bullseye census | INTERESTING | Real number, wrong layer (shop-side), non-monotonic (check 20). Keep as a footnote; do not let it justify a volume target. |
| A8 Academy quality guide / still-frame | FIRE (rule) | Primary page; it is why captions-over-b-roll-only cuts are a risk. |
| A9 Hook-rate benchmarks | DEAD | Unfetched vendor figures with conflicting definitions; paid ads, not organic affiliate. Do not put numbers in the QA rubric. |
| A10 "10,114-video study" phantom / 8,758 memo | DEAD as evidence, keep the lesson | Lane A correctly flags it as phantom; its lesson (rotate archetypes, do not rank) is already R3. |
| A11 Z Media 8 formats | INTERESTING (taxonomy only) | Evidence-free. |
| A12 Rend.ai lengths and safe zone | FIRE for safe-zone defaults, INTERESTING for lengths | Safe zone logic is corroborated by xianyu110's renderer (verified); lengths are SAID. |
| A13 Link Products + CML | FIRE (rule) | Verified (check 10). Drives "no baked-in general-library music". |
| A14 Affiliate content into GMV Max ads | FIRE | Cheap and valuable: always keep a clean master (R25). |
| A15 Photo-post carousels | INTERESTING | Real volume lane, but may be penalized as "still frame"; test later. |
| A16 Reply-to-comment videos | FIRE | The one variant type TikTok itself names; best genuine-difference generator. |
| A17 Green-screen price comparison | INTERESTING | Needs product-in-hand rule; not v1. |
| A18 Trifecta hook | INTERESTING | Conflicts with "hook must relate to product"; keep as one A/B archetype. |
| A19 Open-source e-commerce skills | FIRE (as references; clipforge DEAD for code reuse) | xianyu110 (MIT, 1 day old, Chinese README): mine structure only. clipforge (AGPL): read, do not copy. aronhy needs a paid MCP: INTERESTING. |
| A20 AI-content disclosure rules | FIRE (rule) | Pipeline flags any AI step. Beauty Oct 19 item and dates are UNVERIFIED. |
| A21 Disclose commercial content toggle | FIRE (rule) | Verified; goes on the posting checklist. |
| A22 CML broader terms | FIRE | Same as A13; the broader terms come from a vendor guide, so keep the instruction minimal (no music baked in). |
| A23 Prohibited-claim lint | FIRE | Cheapest, most protective check. Needs a phrase list sourced from the US guide, not from Lane A's paraphrase. |
| A24 Enforcement thresholds | INTERESTING; "run Pre-Check" step FIRE | Thresholds are secondary-source and the 31 July vs 2 June dates conflict across Lane A and Lane C. |
| A25 VoC gate | INTERESTING | Real and primary; a product-picker filter, not an editing feature. Park for product intake. |
| A26 e.l.f. 8.06 percent | DEAD | Never read on page (403); snippet only. |
| A27 Syncly top-30 audit | DEAD as evidence | Snippet only; the "sort by GMV, not views" idea is already R27. |
| A28 FastMoss RPA / Bright Data sample | INTERESTING (park) | Drives her real browser session; ToS and security risk; she must opt in. |
| A29 Other scrapers | DEAD | Product-level only, off-brief; lane agrees. |
| A30 Creative Center Top Ads | INTERESTING | Free and primary but JS-rendered and ads not Shop organic. |
| A31 Faceless 1.8x vs TikTok policy | FIRE as a risk rule (face or voice on by default) | See ruling 1. |
| A32 Different angle, not pixel-shuffle | FIRE (design principle) | INFERRED but consistent with the policy text read. |
| A33 Sound-first hook | INTERESTING | Free (ambient audio exists), SAID. |
| A34 ASMR stats | DEAD | Unsourced. |

### Lane B (editing stack)

| Spark | Verdict | Why |
|---|---|---|
| B-S1 video-use | FIRE (design, not adoption) | All twelve rules verified; shipped skill is conversational and needs Scribe, so lift the rules and render skeleton. |
| B-S2 Claude vision images-only | FIRE (constraint) | Confirmed, and it is the reason the pipeline is transcript + frames. |
| B-S3 Gemini video understanding | INTERESTING (optional, off by default) | Only model here that "sees" motion and hears audio, but ranking quality is untested, it uploads her footage to a third party, and a transcript + contact-sheet path covers v1. Test on 10-20 labeled takes before enabling. |
| B-S4 tryselects "Opus can't edit" test | INTERESTING | Vendor with a competing product, n=1, no method. Directionally consistent with video-use's design, but do not cite the 93 percent as fact. |
| B-S5 media-use `transcript-cut.mjs` | FIRE | The deterministic compiler the design needs. Never run by Lane B: Milestone M4 must run it with a hand-marked accuracy check before it is claimed. |
| B-S6 Parakeet transcription | INTERESTING | Author's self-reported WER; local, free; keep ASR swappable. |
| B-S7 whisperX | INTERESTING | Fallback; strong maintenance. |
| B-S8 auto-editor | INTERESTING | `silencedetect` in ffmpeg already covers dead air; value is the EDL export for hand polish. |
| B-S9 MakeMyClip/editor `remove-retakes` | INTERESTING (test one feature) | 26 stars, pre-1.0. Retake removal is a real raw-clip problem; test it, do not depend on it. |
| B-S10 CapCut automation | DEAD for automation | Export impossible headless on current versions (SAID, search summary); also the owner brief says Claude Code, not CapCut. |
| B-S11 Remotion license | INTERESTING | Verified; makes the HyperFrames vs Remotion debate cost-neutral for solo use. |
| B-S12 Matte-caption CPU cost | FIRE (constraint) | ~2 fps CPU from the skill's own text; keeps matte opt-in. Not measured by anyone. |
| B-S13 HyperFrames render norms | INTERESTING | Self-reported speed. |
| B-S14 Descript API | DEAD | Could not open the doc; cloud credits; footage upload. |
| B-S15 OpusClip/Submagic/Captions APIs | DEAD as core | Wrong input shape, conflicting prices; keep as a look benchmark. |
| B-S16 Face-tracked reframe | INTERESTING | Fallback for landscape; iPhone portrait needs none. |
| B-S17 FableCut / headless NLEs | INTERESTING | Young, small; watchlist. |
| B-S18 `reverse-any-video` | DEAD for v1 | Pro-gated per README; Lane B itself lists this as open. (Not re-verified.) |
| B-S19 iPhone HDR/VFR ingest | FIRE | Marked INTERESTING by its author, but it is the step most likely to silently break every downstream stage. Promote to FIRE and make normalization stage 0 with a probe. |

### Lane C (underground)

| Spark | Verdict | Why |
|---|---|---|
| C-S1 video-use packed transcript | FIRE | Same as B-S1; both lanes independently converge. |
| C-S2 herk EDITING-PLAYBOOK | FIRE for the "every correction becomes a rule" loop; INTERESTING for the numbers | Numbers are from the author's own educational reels (SAID), not product UGC. |
| C-S3 kajisho5/ffmpeg-skill | FIRE for the verify tools (probe, LUFS, contact sheet); INTERESTING for adoption | MIT confirmed; 9,287 stars in ~11 weeks, authenticity unchecked (my stargazer call returned 404, so I could not check either). Pin version and read installer first. |
| C-S4 2bft reframe | INTERESTING | 0 stars; same smoothing idea as B-S16. |
| C-S5 silent-ugc Performance Profile | FIRE (method only) | Frame-level hook teardown applied to HER winners; skip the face-swap flow. Claim "30 percent intensity" is SAID. |
| C-S6 clipspal hooks matrix | INTERESTING | Pattern equals S7; AI-character source, 11 stars; also edits Claude permissions (risk). |
| C-S7 hooks.json matrix | FIRE | The data model: per-reel JSON, usage caps, kill-bottom-80 loop. Results are SAID by a seller (lane says so). Subject to the duplicate policy (ruling 2). |
| C-S8 TikTok Sans 56 px / stroke caption spec | INTERESTING | SAID; conflicts with herk's box. A/B. |
| C-S9 Brooke Lacey TSV cut list | FIRE | An inspectable cut list is what a judge can diff; scripts unpublished. |
| C-S10 B-roll routing table | INTERESTING | Agency claim; AI B-roll is a compliance risk (A20). |
| C-S11 Thani keep/kill taste calibration | FIRE | Uses her own winners as ground truth: cheap, and she has no dataset otherwise. |
| C-S12 "reuse footage, not the cut" | FIRE (rule) | One-line variant rule; consistent with policy and A32. |
| C-S13 Phone-farm / EXIF rewriting | DEAD | Evasion machinery; collides with A3 and creator enforcement. Distribution shape (median ~5k vs best 1.1M) is the only keep, SAID. |
| C-S14 Tjay guide | INTERESTING (parts) | Account hygiene is mostly irrelevant to a single real account; plugs a product. |
| C-S15 Shemet outlier loop | INTERESTING | Loop shape is fine; seller; remake step is risky. |
| C-S16 Reddit Low-Quality AIGC | FIRE (warning) | Anecdotes (verified as threads by lane), but the account-level-scoring signal is consistent with A8. |
| C-S17 Reddit permissions removed, real footage | FIRE (warning) | Same; supports cadence cap and distinct variants. |
| C-S18 Maverick tracker | INTERESTING; tracker schema FIRE | Agency lead-gen article; columns (hook used, 48 h views, 7 d, GMV, Spark code) are still the right ledger. |
| C-S19 VEED open-edit, vargHQ, showtime | INTERESTING (unread) | Lane did not open them; should not be counted as findings. |
| C-S20 Cost basis | INTERESTING | SAID; confirms her own filming is the cheap input. |

### Lane D (ops)

| Spark | Verdict | Why |
|---|---|---|
| D-A1 Keep Originals | FIRE | Primary Apple page; zero-cost fix to a silent quality loss. |
| D-A2 HDR Video OFF | FIRE | Removes the tone-map problem at source; menu wording UNVERIFIED on her iOS. |
| D-A3 DV Profile 8 / HLG | INTERESTING | Search snippet of a PDF not opened. |
| D-A4 Hable tonemap recipe | DEAD for this machine | Needs `zscale`, which this ffmpeg lacks (check 19); also PQ-only, HLG untested. |
| D-A5 ffmpeg lacks zscale | FIRE | MEASURED; ships as a setup-probe requirement. |
| D-A6 HLG look forum threads | INTERESTING | Justifies tag comparison in QA. |
| D-A7 osxphotos incremental export | FIRE (untested) | Best zero-click ingest if she uses iCloud Photos; permissions text unread (lane's own open thread 4). |
| D-A8 launchd WatchPaths / file-stable wait | FIRE | Standard design; small. |
| D-A9 Dropbox transcode switches | INTERESTING | Warning only. |
| D-A10 Drive Stream vs Mirror | INTERESTING | Warning only. |
| D-A11 Drive colour-shift anecdote | DEAD | Single anecdote, no replies. |
| D-A12 File-size table | INTERESTING | One table; measure her phone. |
| D-A13 AirDrop original | INTERESTING | Fallback path. |
| D-B1 Posting API media specs | FIRE | Primary; output spec (H.264/AAC MP4, 1080x1920, 30 fps). |
| D-B2 Slate/clap + verbal tags | FIRE (design, unproven) | No source says it works; it is the cheapest way to make ingest deterministic. Must be dry-run on real clips. |
| D-C1 Affiliate APIs (Partner Center) | DEAD for v1 | Developer-registered path; creator eligibility unknown. |
| D-C2 Kalodata/FastMoss prices | INTERESTING | Conflicting third-party prices; optional. |
| D-C3 Sample rules | INTERESTING | Third-party; deadline ledger idea is nice but unsourced. |
| D-C4 TikTok ToS bars automated scripts | FIRE (constraint) | Quote not re-read by me; page is partially read by the lane (85k chars unread). Design consequence (paste/CSV intake, no scraping) is cheap and safe. |
| D-C5 Commission rate ranges | INTERESTING | Third-party. |
| D-D1 Direct Post no product field | FIRE | Confirmed (check 7). |
| D-D2 Unaudited = private | FIRE | Confirmed (check 8); kills auto-post for v1. |
| D-D3 Inbox/draft upload | INTERESTING (park) | Requires approved developer app; her payoff is small. |
| D-D4 Add Link in the app, manual | FIRE | Official; plus A13 for after-the-fact linking. |
| D-D5 Add link after posting conflict | FIRE (resolved) | Resolved by A13's primary page, see ruling 6. |
| D-D6 TikTok Studio desktop | INTERESTING | Unverified in her account; highest-value test (lane's thread 1). |
| D-D7 Eligibility thresholds conflict | INTERESTING | Setup checklist item. |
| D-E1 Creator Center per-video GMV | FIRE (not re-verified) | The right data; lane says it read the page, I did not. |
| D-E2 CTR/CTOR claim | INTERESTING | Search summary of an unopened page. |
| D-E3 Studio Export Data CSV | FIRE-test | Third-party only; this is the only plausible CSV path to retention data. |
| D-E4 Seller-side exports | DEAD | Not hers. |
| D-E5 Third-party exporters | DEAD | Hands over credentials. |
| D-F1 Claude plan pricing | FIRE | Sizing; plan limits shared across Claude and Code. |
| D-F2 Desktop includes Code tab | INTERESTING | Search summary only. |

---

## 3. CONTRADICTIONS RULED

1. **Faceless "converts 1.8x" vs TikTok penalizing low human presence (Lane A, spark 31).** RULING: TikTok's own wording (US Content Success Guide) is that content with "little-to-no human presence" is "still frame content" with "reduced visibility", and it recommends people on camera plus spoken communication. That is primary. The 1.8x number has no source, no method and was not fetched; it is dead. Default every cut to face or voice on; hands-only product beats may be inserted, but not as the main content, and never silent for long. A faceless A/B is allowed later with her own data, not as a default. (Lane A's phrase "flagged as unoriginal" is a third-party paraphrase; TikTok's page says visibility, not originality.)

2. **Volume matrix (Lane C P1, Lane A A5, hooks x bodies) vs duplicate policy (Lane A Deep Dive 1).** RULING: both are right about different layers. The matrix is the correct data model; it is not a license to post every combination. TikTok's variation list (check 11) is lighter than Lane A's R20, so the policy risk of swapping a hook onto an identical body is unquantified, and nobody has evidence on how duplicates are detected (Lane C open thread 3). Adopt R20 as a conservative internal rule (variant = different hook and different body angle), treat R21's similarity gate as mandatory, and make the per-session export cap a config value that starts small (3-6 distinct cuts, posting cadence below the 3/day pilot limit while she is new). Label R20/R21 as design choices, not TikTok rules, in every doc. Lane C's own S17 anecdote (real footage still got permissions removed for near-identical videos) is the empirical reason to start strict.

3. **Lane A R22 vs normal overlays (check 13).** RULING: keep the ban, rewrite it as "do not use layering, sandwich frames or aspect/overlay tricks to hide content". A caption rail and a blurred pillarbox are not violations; do not forbid them.

4. **Lane B "re-encode, do not stream-copy" vs video-use rule 2 (per-segment extract then lossless concat).** RULING: no true conflict inside the cut (extract-and-encode each segment with identical settings, then copy-concat), but Lane B's architecture has an unflagged second generation: `cut.mp4` is then re-encoded again by the HyperFrames render, which is exactly the double-encode video-use's rule 2 exists to avoid. Decide at M3: either make the cut intermediate near-lossless (low CRF, or ProRes/FFV1 intermediate) so the final HyperFrames pass is the only visible generation, or do overlays in ffmpeg. Not settled by any lane.

5. **Lane D "HDR OFF at the source" vs Lane B "normalize with tone-map".** RULING: do both, in order. Primary: HDR Video OFF (verified menu, wording unverified). Fallback: probe; if `color_transfer` is HLG/PQ and `zscale` is missing (true on the owner's Mac), either stop with a plain-English instruction or use ffmpeg's built-in `tonemap` path if a test shows acceptable output. No lane tested HLG on iPhone footage; do not claim the fallback works until M4.

6. **Lane D D5 (can a link be added after posting?) vs a vendor page that says no.** RULING: the primary Seller University page says yes, with conditions: within 30 days, CML-only audio, matching product, no editing of existing links. The vendor page that says "cannot" is probably describing the non-CML case. Still unresolved and test-in-her-account: whether her own voice and ambient sound count as "CML-only" audio. Design consequence: she should pick a Commercial Sound in the app at post time or the post cannot be linked later.

7. **VoC thresholds (Lane A thread 7).** RULING: not a conflict, a version history on one primary page (April: >2.5 disqualified; May: below 1.5 to qualify, >3 disqualified). Use the May text and read the live Seller Center before filming.

8. **Enforcement dates (Lane A: stricter creator policy from July 31, 2026, 12-point/7-day; Lane C: June 2, 2026, 6 violations in 90 days).** RULING: unresolved, both secondary. Pipeline does not need either number; it needs the pre-check step and a conservative cadence. Do not publish either threshold in the repo.

9. **Caption style (herk: dark box; Lane C S8: 56 px white with 4 px black stroke, upper position; Lane A/rend.ai: avoid bottom fifth and right edge).** RULING: these are not mutually exclusive on placement; stroke vs box is taste. Default = safe-zone placement from xianyu110's renderer logic plus one caption identity (`anchor` from the local skill); A/B stroke vs box in her own data. Do not cite any of these as "native TikTok look" without a primary source.

10. **Posting automation (Lane D: manual final tap; Lane C P4/P1: 3-5 accounts, 5-10 posts per day schedulers).** RULING: Lane D's boundary holds (API cannot attach a product; unaudited = private). Lane C's multi-account scale patterns are out of scope: they collide with the multi-account and duplicate-across-account language on the UK page (first account is the "authentic" one) and add nothing for a single real creator. One account.

11. **"Opus is a great video editor" (user claim) vs Lane B S4.** RULING: neither extreme. The vision page proves Claude has no video input; the tryselects test is directionally negative but vendor n=1. What the evidence supports is the design: Opus chooses, scripts do timing and arithmetic. Keep it as a design principle, label S4 SAID.

---

## 4. BIGGEST GAPS (what would most change the pipeline design)

1. **Nothing has been run.** Every speed, accuracy and quality claim in Lane B and D is SAID or INFERRED (both lanes say so). The single most design-changing missing fact is a dry run on one real raw iPhone clip: ingest probe (codec, color_transfer, VFR), transcribe, `transcript-cut` against hand-marked cut points, loudnorm, HyperFrames caption render, decode check. It decides the intermediate-codec question (ruling 4), whether the HLG fallback is needed, and whether cut accuracy is acceptable. M4 must make this a gate, not a nice-to-have.

2. **How different is "different enough" and how TikTok detects it.** TikTok's published variation examples are light; internal rule R20/R21 are conservative guesses; there is no evidence on fingerprinting (video, audio or transcript). This sets how many variants per session the pipeline should emit and whether a hook-only swap is safe. Needs a small posted experiment (e.g. 3 variants of one session at spaced times, watch distribution and any Creator Health notices) and a read of the US duplicate-content page. Until then default small.

3. **The performance data path back into the loop.** Lane D has per-video GMV visible in Creator Center and a third-party-only claim of CSV export from Studio, with no verified join key between her posts and the ledger. If the join is manual (she types/pastes), the learning loop's cadence and sample size are set by her patience. No lane quantified how many posts per week she can realistically label, which decides whether hook-archetype tagging (R3, R27) can ever reach a useful sample.

4. **No hook/format/length statistics from top affiliate videos.** Lane A says it plainly: no public large-N data. The design currently encodes SAID defaults (15-45 s, three hook layers, word counts). Without a transcript-and-frame teardown of, say, 30-50 winning videos in her niche (the Thani / silent-ugc method applied to her competitors, done by her own manual selection, within ToS), the "meta" the editor encodes is folklore. Her own first 20 posts are the only dataset that will answer it, which argues for shipping A/B scaffolding early rather than polishing defaults.

5. **Original-audio vs CML.** Whether her own recorded voice or ambient sound counts as "CML only" for the link-after-posting path (ruling 6) changes whether she can upload first and link later, or must always link at post time. One test in her account resolves it.

6. **Does Add Link exist on TikTok Studio desktop?** Lane D's open thread 1. If yes, a Mac-first batch workflow (upload from `ready/` in Finder, link later) is possible; if no, every post is a phone tap and `ready/` must be phone-reachable (AirDrop or iCloud return path), which Lane D did not design.

7. **Gemini take-ranking untested and a privacy tradeoff.** If it is bad, the best-take step falls back to transcript + frames only (acceptable). If it is good, it is the only way to judge motion and audio. Needs the 10-20 labeled takes Lane B proposed.

8. **Verbal-slate segmentation untested.** The whole ingest-by-speech approach (hook one / hook two / body / CTA) is INFERRED. If real clips do not segment reliably, stage 1-2 need a visual fallback (scene detection plus a manual marker file).

9. **Unread primary text.** TikTok Academy "Content Styles" original, Music Terms, US duplicate-content page, TikTok ToS second half, the live Creator Center UI. The compliance linter and the posting checklist should be finalized only after these are read once.

10. **Coverage holes in the underground lane.** Lane C hit a GitHub search rate limit; several repos were not opened (open-edit, vargHQ/skills, showtime), YouTube and Skool were not transcribed, X was only via one connector. "Nobody does the full job" is plausible but weakly supported; the claim is "I did not find one".

11. **Cost, quota and disk.** Claude plan limits under a daily batch, iCloud storage for raw clips, and any per-token cost of a vision judge on every variant were not sized (Lane D says so for iCloud; Lane B for matting time).

12. **License hygiene is partial.** Reusable: video-use, ffmpeg-skill, herk-edit-kit, xianyu110 (MIT; README credits other projects and one dependency is LGPL). Not reusable as code: clipforge (AGPL). Not checked: clipspal hook-library and the TikTok Sans font license.

---

## Summary table of verdict counts (judge's count)

- Claim checks: 24 rows. CONFIRMED clean 16, CONFIRMED with qualification 3 (rows 11, 12, 14), WEAKENED 3 (rows 9, 13, 20), REFUTED 2 (rows 22 as a conflict, 23).
- Sparks graded: Lane A 34, Lane B 19, Lane C 20, Lane D 41. See tables; FIRE = build, INTERESTING = park, DEAD = cut.

Drift check: depth 2, vision 2, truth 2, complete 1, specific 2, focus 2, craft 2. Could not fix: I did not re-fetch the US Academy originals, Creator Center, Kalodata, Helium10, Gemini or osxphotos sources, and TikTok pages were read through a summarizing fetch tool (not raw text); the page-truncation on Policy Pulse (last ~19k chars) left the "affiliate under 5,000 followers" sentence unchecked; my stargazer-history check on ffmpeg-skill failed (HTTP 404).
