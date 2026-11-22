# Lane C: The Underground
Researched 2026-11-21. Anchor read first: `DRIFT_GUARD.md` (goal: more GMV per hour of filming; owner films raw iPhone clips; no invented stats).

Label key: MEASURED = I pulled the number from an API/file myself. VERIFIED = I read the primary source (repo file, post, thread). SAID = a seller/operator claims it, unproven. INFERRED = my reasoning. UNVERIFIED = seen only in a search snippet or title, not opened.

## Altitude line
The goal beyond the goal: one filming session becomes many distinct, policy-safe, post-ready edits, and the system learns which hook sold. So every finding below is judged on three questions. Does it start from REAL footage? Does it make each variant genuinely different (not a re-skin)? Is it checkable by an outside judge?

## Headline findings (read these if nothing else)
1. No repo or operator found that does the full job (raw affiliate clip in, many on-meta variants out, learning loop closed). The pieces exist separately. The closest end-to-end TikTok Shop repo (`Vanszs/tiktok-viral-factory`, 44 stars) is vaporware: its `agents/`, `tools/`, `workflows/`, `mcp_bridge/` packages are all 0-byte files; only the README, a 41 KB `plan.md`, and config/schema exist. (VERIFIED, file sizes from the git tree)
2. The strongest transferable engineering is in three small places: `browser-use/video-use` (word-boundary cutting, per-segment lossless concat, 30 ms audio fades, self-eval of the render), `nateherkai/herk-edit-kit` (a measured reel style and a "every note becomes a rule" loop), and `kajisho5/ffmpeg-skill` (probe, edit, verify with measured loudness/duration, contact sheet). (VERIFIED)
3. The volume pattern that actually shows up across independent operators is: one hooks.json, a small bank of real/clean clips, a matcher, an ffmpeg assembler, then kill the bottom 80%. Variation is in the first 1 to 3 seconds and the text, not hashtags. (VERIFIED, x.com/danielhangan_ article; SAID for the results)
4. The policy ground moved against re-skinned volume. Since 25 Sep 2025 TikTok Shop penalizes near-identical uploads, product-only/hand-only videos with no face or voice, generic TTS plus text overlays, and cross-account duplication (SAID via a BigSeller summary; TikTok's own text not read). A 2 Jun 2026 enforcement policy removes e-commerce permissions after 6 of the same violation in 90 days (SAID via PPC Land summary). This favors the owner: she films herself. (see Red Flags and Operator Playbooks)
5. X access: the cheapest working path is the TinyFish connector already in this session: `search` with `site:x.com ...` then `fetch_content` on the x.com URL. No login, no key, no cookie. It returned full X Articles and tweets. (VERIFIED, I used it this session)

---

## 1. SPARK LOG
Columns: What / Where / Why it pulls / Gate (fire, interesting, dead: my pre-judge, to be confirmed by a separate judge agent) / Label.

| # | What | Where | Why it pulls | Gate | Label |
|---|---|---|---|---|---|
| S1 | video-use: LLM never watches video; reads a packed word-level transcript (`takes_packed.md`, ~12 KB) plus on-demand filmstrip/waveform PNGs at decision points. 12 hard rules (cut on word boundaries, pad 30-200 ms, 30 ms afades, subtitles LAST in filter chain, per-segment extract then `-c copy` concat) | https://github.com/browser-use/video-use | Cheapest token path to a precise cut. The hard rules are silent-failure fixes we would otherwise rediscover | FIRE | VERIFIED (README, SKILL.md, render.py grep) |
| S2 | herk-edit-kit EDITING-PLAYBOOK: measured numbers from 27 of the author's own top reels (shot avg 1.1-1.4 s, none >2.8 s, first cut at 0.6-1.0 s, split/full-b-roll/punch-in mix 30-42/50-55/5-15%, captions 1-3 words, one look per reel, -14 LUFS, bed ~11 dB under voice) | https://github.com/nateherkai/herk-edit-kit (docs/EDITING-PLAYBOOK.md) | A concrete style spec an agent can obey, plus the loop "note, fix, write the fix into the skill as a rule". Numbers are for his educational talking-head reels, not product UGC, so treat as a starting prior | FIRE | VERIFIED (read file). Numbers are SAID by author about his own channel |
| S3 | ffmpeg-skill: 42 typed ffmpeg tools, probe-first, then verify (duration, size, codec, LUFS) and a contact sheet to look at frames; TikTok template puts captions above the description bar and clear of the like column; MCP advertises 12 of 42 tools to save context | https://github.com/kajisho5/ffmpeg-skill | Our "outside judge" for edits needs measurable checks; this ships them. Also solves the TikTok UI safe zone | FIRE | VERIFIED (README, npm); star count MEASURED 9,287; reliability numbers (92/92) are the author's own |
| S4 | 2bft reframe.py: face-tracked 9:16 crop with a deadzone (crop holds still until face moves >4% of crop width), gap fill 2 s, median 5, two Gaussian passes | https://github.com/2boysfromtown/2bft-video-editor (skills/2bft-video-editor/scripts/reframe.py) | Owner films iPhone vertical so reframe matters less; but the same smoothing is what makes punch-in zooms on a face look intentional | INTERESTING | VERIFIED (read header and constants) |
| S5 | silent-ugc "Performance Profile": extract every frame of a winning hook, score gesture/gaze/intensity; claims winning hooks are ONE frozen gesture plus eye micro-acting around 30% intensity, not an emotional arc | https://github.com/jasonlee-breadcrumb/silent-ugc | A teardown method (frame-level hook analysis) we can apply to the owner's own winners without any AI actor | FIRE (method), DEAD (face-swap clone flow: needs Arcads MCP, clones other creators' format) | VERIFIED (README). The 30% claim is SAID |
| S6 | clipspal-hooks-skill: spend on 5 character clips once, pair each with 6 hook lines + round-robin b-roll via ffmpeg = 30 variants; bundles TikTok Sans Bold, 820-template hook library JSON, `state.py` for resumable runs | https://github.com/Kronop/clipspal-hooks-skill | Cleanest example of the matrix pattern (N clips x M hooks). Cost claim ~$0.09 per finished video | INTERESTING (pattern), DEAD for us as-is (AI character stills, 11 stars, 1 commit day) | VERIFIED (README, tree). Cost is SAID |
| S7 | hooks.json as the unit of work: each reel = one object (hook text frame 1/2, reaction clip, demo clip, music). Gemini watches all clips and ranks top 30 combos with usage caps (no reaction >3x, no hook >2x). Claude Code writes `reaction_demo.py` to ffmpeg-assemble | https://x.com/danielhangan_/article/2044346237239894229 | The data model for variants. Directly portable: swap "UGC reaction" for the owner's own hook-takes | FIRE | VERIFIED (read in full). Results (31/47 campaigns, 14% retention lift) SAID by a seller of the UGC he recommends |
| S8 | Native text look: TikTok Sans Display Bold, 56 px, white, 4 px black stroke, no shadow, no bar, upper position | same article | Concrete caption spec. Conflicts with herk (dark box). Needs A/B on the owner's niche | INTERESTING | SAID |
| S9 | Brooke Lacey: edit lives in a TSV cut list (start, end, shot size wide/mid/close, label); silence detect + Whisper word timing + face tracking; app inserts placed using per-cut measured empty space; re-cuts to 30/60 s and landscape from same file | https://www.chatprd.ai/how-i-ai/brooke-lacey-claude-code-video-editing | The inspectable-EDL idea. A text cut list is the thing the judge agent can diff | FIRE | VERIFIED (read page). Scripts not published, so SAID for performance (15 s run, 441 frames) |
| S10 | Himanshu Bamoria's B-roll routing table: HyperFrames HTML for text cuts, Pexels stock filler, Nano Banana stills for product-in-context, still + Sora for hero motion, Seedance ref-to-video for talking UGC, Veo for physics | https://x.com/0xhbam/status/2061912167440675148 | A decision rule per moment type for B-roll sourcing | INTERESTING | VERIFIED (tweet read); agency claim "hundreds of ads" SAID |
| S11 | Thani/HyperFrames: "teach the edit skill taste": feed 2 creators you love, your 5 highest-retention videos and 10 bad AI edits; extract 1 frame per second, Keep/Kill each frame with a reason; package into an `edit` skill | https://x.com/HeyThani/status/2121446647389372526 | Calibration method for a style skill using the owner's own winners as ground truth | FIRE | VERIFIED (tweet); outcome SAID |
| S12 | Alexis Hedley: "You can reuse footage. You cannot reuse the cut. Vary every edit even when the core clips are identical." Also: most "shadowbans" are cold accounts, flagged keywords, duplicate edits, or bad hooks; a real hidden restriction exists since ~Mar 2026 labeled "Abnormal Interaction Behaviors" | https://x.com/alexishedley_/article/2085375756834611591 | Gives the variant rule in one line | FIRE (rule), interesting (claims) | VERIFIED (read); claims SAID |
| S13 | Phone-farm operator (Sulfur): 10 old iPhones, 20 accounts, EXIF rewriting to look like camera roll, DNS/WebRTC patching, "same clip with a different hook counts as a new video once run through the pipeline"; best post 1.1M, median ~5,000; 2,000 views per install | https://x.com/sulfurscales/status/2083953297333870914 | Real operator numbers (median 5k vs best 1.1M is the honest shape of the distribution). The evasion machinery itself is a ban magnet for a Shop affiliate | DEAD for us (evasion), INTERESTING (distribution shape) | VERIFIED (read); numbers SAID. Context: app installs, not Shop GMV |
| S14 | Tjay's "No BS Guide": 12 personas at $22-266/mo; cost table (Nano Banana $0.039/image, Kling 2.6 motion control $0.07/s, Seedance 2.0 $0.30/s, Veo 3 $0.75/s); cap 2-3 accounts per device, warm-up (day 1 no posting), dedicated static IP, never repost identical MP4 ("same script through different personas is fine") | https://x.com/type_kshitij/article/2049286061105483868 | Most detailed account-hygiene list found. Also the honest PS: scraped-image slideshows are saturated | INTERESTING | VERIFIED (read); SaaS context, plugs Ghostfeed |
| S15 | Andrei Shemet stack: Apify scrape top 50 outlier videos, Gemini breaks down hook/pacing/shots, Claude writes 20 scripts, Seedance ~$0.02/s, ffmpeg/Remotion stitch, scheduler for 5-10 posts/day, "20 more versions of every winner" | https://x.com/jammer3k/status/2111793060896186435 | The loop shape: outlier scrape, teardown, scripts, variants, track, repeat | INTERESTING; he sells services ("DM me UGC"); "$0.30 per 15 s" is SAID | VERIFIED (read) |
| S16 | Reddit: affiliate on 100% AI video hit "Low Quality AIGC" account restrictions repeatedly despite varied hooks/backgrounds/text and AI toggle on; one commenter reports 2 accounts permabanned with <10 videos even with pre-check tool and 100% disclosure; another says 40+ AI videos, 0 violations | https://www.reddit.com/r/TikTokshop/comments/1wh1b36/anyone_else_getting_repeated_low_quality_aigc/ | Best evidence that account-level scoring (not per-video) is what bites fully synthetic accounts. Mixed real b-roll or real voice suggested by a commenter | FIRE (as a warning) | VERIFIED (read thread, ~2 months old); anecdotes |
| S17 | Reddit: creator with real stock and original videos had Creator E-Commerce permissions removed for "multiple identical or near-identical videos / repetitive low-effort promotional content"; appeal rejected for several commenters; advice: 3-4 videos/week, hybrid, avoid claims | https://reddit.com/r/TikTokshop/comments/1tcm6uf/tiktok_just_wiped_out_my_entire_income_overnight | Even real footage with a consistent style got flagged. Cadence and template sameness are the risk, not just AI | FIRE (as a warning) | VERIFIED (read); anecdotes, author is UK |
| S18 | Maverick Creative playbook: AI UGC accounts (3-5 per brand, different persona angle each) test 15-20 hooks/week, human creators then execute the winners; 10K views in 48 h triggers Spark Code request; weekly Monday review; tracker columns | https://x.com/maverickecom/article/2064856810410905923 | Best written test-and-promote loop and the tracker schema (hook used, views 48 h, 7 d, GMV, Spark code) | INTERESTING; it is an agency lead-gen article, claims ($500K in 90 days, 550 videos/day) are SAID | VERIFIED (read in full) |
| S19 | New VEED `open-edit` (1,845 stars), `vargHQ/skills` (83 skills), `FavioVazquez/showtime` (343) | github links in Best Repos | Newer agent-first editors; not opened in depth | OPEN THREAD | MEASURED stats only; contents UNVERIFIED |
| S20 | Mixed-source cost basis: Reddit/X numbers for AI clips range $0.07-0.75 per second; real-human UGC $8 per video on a marketplace | S14, S7 | Gives the owner the "should I even generate" math: her own filming is $0 | INTERESTING | SAID |

Sparks followed 1-2 hops: S1 to render.py (read); S3 to repo health and npm maintainer (checked); S7 to its source claims (traced to seller); S12/S14 to the TikTok policy summaries (BigSeller, PPC Land, TokPortal) to separate operator folklore from stated policy; S16/S17 to the thread comments. Judge pass should be done by a separate agent (not me).

---

## 2. BEST REPOS (table)
Stars/dates are MEASURED via GitHub API on 2026-11-21. "Clever" is from reading the README and named source files. Safety column is about what installing it asks of the owner.

| Repo | Stars | Last push | License | What is actually clever | Fit for us | Safety notes |
|---|---|---|---|---|---|---|
| browser-use/video-use | 31,403 | 2026-10-08 | MIT | Packed word-level transcript as the LLM's reading view; 12 hard production rules; per-segment lossless concat; self-eval at every cut boundary; `project.md` session memory; parallel sub-agents for animation slots | Core of cut/caption engine. Only needs ElevenLabs Scribe key (swap for local Whisper: INFERRED easy) | Org-owned, MIT. Needs one API key in `.env` |
| nateherkai/herk-edit-kit | 3,048 | 2026-10-14 | MIT file at repo root (GitHub API reports NOASSERTION; LICENSE text read, plus a brand-asset note) | 15 skills: cut-silences, cut-mistakes (retake detection), short-form-edit, make-a-video, beat-sync validation, caption contrast checks; EDITING-PLAYBOOK with measured style | Style spec + QA ideas; talking-head education bias | Individual with large following. Check brand-asset clause before copying assets |
| kajisho5/ffmpeg-skill | 9,287 | 2026-11-21 | MIT | 42 typed tools with a machine-readable contract; probe, edit, verify (LUFS, duration, size), `look.py` contact sheet; `render.py --template tiktok`; MCP advertises 12 of 42 | The "judge tool" layer. No cloud, no keys | Mature CI (OpenSSF Scorecard, Dependabot, npm 4.5.2, one maintainer). Stars grew to 9.3k in under 3 months from a Sep 2026 start: plausible but UNVERIFIED organic (stargazer history fetch failed). Pin the version; read `npx` installer before running |
| 2boysfromtown/2bft-video-editor | 0 | 2026-10-28 | MIT | Face-tracked reframe with deadzone; energy-reactive shake; offline denoise/stems; trending-music finder | Reframe + SFX ideas. Brand new, 0 stars | Unknown maintainers; README says run scripts with `python -I`. Read before use |
| heygen-com/hyperframes | 87,858 | 2026-11-22 | Apache-2.0 | HTML-to-MP4 deterministic render, agent-authored | Already in owner's stack as an option | Company-owned. Very high star count (MEASURED); not audited |
| digitalsamba/claude-code-video-toolkit | 2,697 | 2026-11-20 | MIT | Script, voiceover, music, clips, render on open models | Generic explainer; not UGC | UNVERIFIED beyond metadata |
| charlesdove977/UGC-Factory | 105 | 2026-10-23 | MIT | Interview then beat sheet (hook, problem, reveal, demo, CTA) with approval gate; Seedance writes a script per clip (never blank prompts); 15 genre style skills (07-ecommerce-ad, 11-social-hook) | Beat-sheet + approval gate pattern; generation half needs Higgsfield MCP | README pushes the author's paid Skool program and an affiliate-style MCP link. Treat as funnel. Style SKILL.md files are 40-98 KB each |
| jasonlee-breadcrumb/silent-ugc | 111 | 2026-08-19 | MIT | Face swap on still then animate (identity solved at image layer); Performance Profile; account mode: 1 source becomes 10-20 variants in different rooms | Frame-teardown method only | Requires Arcads MCP (paid). Clones other creators' video format. Skip the clone flow |
| Kronop/clipspal-hooks-skill | 11 | 2026-05-11 | MIT | N clips x M hooks matrix; 820-template hook library; resumable `state.py` | Matrix assembler pattern | Writes fal.ai key to `~/.clipspal/fal_key`; `install_permissions.py` edits Claude permissions: read before running |
| vargHQ/skills | 42 | 2026-11-18 | MIT | 83 video skills incl. UGC ads, captions, ffmpeg edits, one-key cloud mode | Catalog to mine | UNVERIFIED contents; "one key" implies their paid gateway |
| veedstudio/open-edit | 1,845 | 2026-11-11 | Apache-2.0 | "Agent-driven video creation and editing, powered by VEED" | Look later | Vendor-backed, cloud. UNVERIFIED |
| FavioVazquez/showtime | 343 | 2026-10-17 | MIT | Local video studio for coding agent | Look later | UNVERIFIED |
| gyoridavid/short-video-maker | 1,516 | 2025-06-21 | MIT | MCP + REST short video generator | Stale (last push Jun 2025); faceless | Skip |
| Vanszs/tiktok-viral-factory | 44 | 2026-06-22 | none | README describes 7 LangGraph agents and a stock + Kling mixed pipeline ("pure AI gets throttled") | Nothing to reuse | VAPORWARE: all package `__init__.py` are 0 bytes; no license; plan.md only |
| sirambrosio/tiktok-shop-affiliate | 2 | 2026-04-21 | none | Kalodata scrape, Claude script, Veo 3.1 persona video, ElevenLabs, auto post per persona with per-region proxies | Reveals what the AI-persona operators wire up | Persona accounts plus regional proxies = exactly what enforcement targets. Do not adopt |
| FastMoss/fastmoss-skills, kalowave-hz/kalodata-skill, liangdabiao/fastmoss-rpa-skills | 8 / 2 / 76 | 2026 | apache / none / none | Research-data skills for Claude (product/creator research) | Belongs to another lane (research) | The RPA one drives the user's real browser session: security risk |

Search coverage note: I ran about 28 GitHub repo searches plus 6 site:github.com web searches. The gh search API rate-limited partway (several queries returned empty, not zero results). So "not found" claims are weak. Specifically not covered: GitHub code search, topic pages, awesome-lists beyond the titles (`vargHQ/awesome-ai-video-agents`, `sasateguh/awesome-ai-video-for-creators`, `zhuyansen/awesome-claude-code-skills-collections` appeared but were not opened).

---

## 3. OPERATOR PLAYBOOKS
Each playbook: what they do, who says so, what to steal, what to ignore.

### P1. The hooks.json matrix (volume without re-skinning)
- Source: https://x.com/danielhangan_/article/2044346237239894229 (VERIFIED read; results SAID). Mirror: Kronop/clipspal (VERIFIED).
- Steps: collect clips (his: 100 reactions x 20 demos); put 10-20 proven hooks in `hooks.json`, ask Claude for 100 variations of the winners (same structure, different wording); a video-capable model ranks combos with usage caps; a Python/ffmpeg script renders all; post across 3-5 accounts; read CTR at 72 h; kill bottom 80%; expand the top 10 hooks.
- Steal: the per-reel JSON object as the contract between brain and renderer; usage caps so the same clip/hook does not repeat; the kill-80% loop.
- Adapt for owner: the "reaction" slot becomes her own filmed hook takes (she films 5-10 hook openers per product), the "demo" slot becomes her product-in-use footage. Costs $0 in generation.
- Ignore: the "$8 UGC marketplace" plug; the 14% retention claim (23 reels, seller bias).

### P2. Agent-layer hook swap on one shoot (multi-cut from one filming)
- Evidence: Alexis Hedley "reuse footage, not the cut" (VERIFIED, SAID); Tjay "same script through different personas is fine, same MP4 twice is not" (VERIFIED, SAID); TokPortal vendor guide: 5-15 variants per core video, change opening seconds, caption, cover frame, length, sound, CTA; rewriting the first sentence is higher leverage than hashtags (vendor article, no evidence; flagged by my fetch as unsupported on thresholds).
- Consistent across 3 independent sources: the first 1-3 seconds + text + sound are what to vary. TikTok publishes no duplicate threshold (WebSearch summary of sources; PPC Land piece gives none) so any "5-15" or "3 changed layers" number is folklore. (INFERRED)
- Practical rule for the build: every variant must differ in at least hook line (spoken or text), opening frame/shot, and cut structure; keep the same filmed footage underneath. QA gate = a script that compares variants (first-2s frame hash + transcript of first sentence) and rejects pairs that are too alike. (INFERRED, our own design)

### P3. Outlier teardown then script loop
- Evidence: Andrei Shemet stack (S15); Noah Frydberg weekly loop (S18); Thani: frame-per-second Keep/Kill (S11); silent-ugc frame teardown (S5).
- Steal: scrape top outliers in niche, have a vision model break down hook/pacing/shots, store as a "hook library" with the structure not the words; weekly review updates it.
- Caveat: Frydberg's own Oct 2026 post describes "finds winning TikTok Shop videos, remakes them with AI, and posts across creator-style affiliate accounts" (https://x.com/maverickecom/status/2115137544429932772, VERIFIED read). That is cloning others' videos across many accounts, both policy-risky and ethically poor. Take the analysis step, not the remake step.

### P4. Test accounts, then promote winners (how 5-20 accounts are used)
- Maverick: 3-5 AI persona accounts per brand with different angles (skeptic, deal finder, lifestyle); 20 accounts per operator for up to 60 videos/day; warm-up with 5-10 trending organic videos before products; 1,000 followers required before affiliate program; uses AI label on upload. (VERIFIED read; SAID)
- Tjay: cap 2-3 accounts per phone, fresh Gmail/Apple ID per account, dedicated static IP, day 1 no posting (scroll 15-30 min), first post day 3+, never only post (mix browsing). (VERIFIED read; SaaS context)
- Sulfur: 10 phones, 20 accounts, 30-40 posts/day, EXIF rewrite. Median post ~5,000 views, best 1.1M. (VERIFIED read; SAID)
- Contradiction to flag: TikTok Shop's 2 Jun 2026 creator enforcement lists "using multiple accounts to avoid enforcement" as manipulation (SAID via PPC Land). Affiliate companion accounts are "widely described as legitimate" by vendors (SAID, Conbersa), while duplicate content across accounts is penalized (SAID, BigSeller). Net (INFERRED): multiple accounts are not banned by themselves; identical or near-identical content across them, and evasion tactics, are.
- For the owner: one real account with a posting cadence and genuinely distinct variants. Second account only after the first is healthy, with different angle/niche, not mirrored content.

### P5. AI avatar / voice usage (what operators actually use)
- Stacks seen: HeyGen ($29/mo) + ElevenLabs + CapCut + Captions.ai (Maverick); Seedance 2.0/2.5 reference-to-video for lip-synced talking UGC and Kling 3.0 for product shots (jammer3k, 0xhbam); Arcads MCP (silent-ugc, Dan Kulkov's "five UGC ads", https://x.com/DanKulkov/article/2067530124845875309 UNVERIFIED not opened); Higgsfield + Seedance (UGC-Factory, and the Reddit poster who got Low Quality AIGC restrictions).
- Evidence on risk: S16 and S17 above, plus the Reddit line "Affiliates will get hit with violations for unoriginal content if the same video is reposted" (snippet only, UNVERIFIED), and a Sep 2025 poster banned with "24 points" after AI affiliate videos (snippet only, UNVERIFIED: https://reddit.com/r/TikTokshop/comments/1n8kjgm/my_affiliates_account_revenue_is_down).
- Steal for owner: voice cleanup, noise removal, and optionally AI B-roll for non-person moments. Do not default to an AI avatar of the owner.

### P6. Real-footage-in, many-edits-out (closest to owner's brief)
- Brooke Lacey: TSV cut list, Whisper timing, face tracking, shot sizes, app inserts; 30/60 s and landscape versions from the same take. (VERIFIED, SAID perf)
- Nate Herk: Edit loop with the agent checking lip sync frames vs raw, frame strips across each cut, caption contrast measurement, first 2.5 s checked frame by frame. (VERIFIED)
- video-use: cut candidates from speech boundaries; strategy confirmation before executing; self-eval of rendered output. (VERIFIED)
- Combined design hint (INFERRED): cut plan as a text file (EDL/TSV), a different EDL per variant, ffmpeg renders each, an outside script judges each render (loudness, duration, caption contrast, first-2s similarity to siblings, transcript compare).

### P7. Cost anchors (SAID unless noted)
- AI clip: Kling 2.6 motion control $0.07/s, Grok Imagine $0.07/s, Seedance 2.0 $0.30/s, Veo 3 $0.75/s (Tjay). Seedance ~$0.02/s (jammer3k) conflicts with $0.30/s on fal: different providers/tiers, not reconciled.
- Real human UGC $8/video via marketplace (danielhangan_).
- Owner's own filming and local ffmpeg/Whisper: $0 marginal (INFERRED).

---

## 4. X ACCESS PATH (tested)

Goal: read X posts and X Articles cheaply from inside Claude Code.

| Option | Worked? | Cost/Token | Needs from owner | Safety |
|---|---|---|---|---|
| TinyFish connector `search` with `site:x.com <terms>` then `fetch_content` on the URL | YES (VERIFIED, ran ~8 searches, 9 x.com fetches) | Search returns 10 results with snippets and dates (~1.5k tokens). Fetch returns full text; a 17-min-read X Article was ~6k tokens, a tweet ~0.5k. Fetch latency 0.5-5 s | Nothing new: connector is already attached in this session. Credits: TinyFish account has some usage meter; I did not check balance (the usage call dumped 403k characters and I did not read it) | Remote hosted service: it sees every query and URL. Do not send private info in queries. Page text is untrusted data. |
| Same connector on Reddit threads | YES (VERIFIED, full thread incl. comments; ads appear in text) | ~3k tokens per thread | none | same |
| WebSearch with `site:x.com` | Partly (VERIFIED): returned no x.com URLs on 1 of 1 try; surfaced aggregator articles instead | cheap | none | n/a |
| WebFetch on xcancel.com mirror | NO (VERIFIED): HTTP 451 | n/a | n/a | n/a. Mirrors are unreliable and add a third party |
| `last30days` skill (installed v3.27.1) | NOT RUN. Read its SKILL.md and config only. X path needs one of: `X_BEARER_TOKEN` (official X API v2, paid tier), `XAI_API_KEY` (Grok), `AUTH_TOKEN` + `CT0` (X session cookies), explicit browser-cookie consent (`FROM_BROWSER`), or `xurl` CLI. Owner's `~/.config/last30days/.env` has `SCRAPECREATORS_API_KEY` set and a comment "Browser cookies declined. Do not enable without asking the owner" | n/a | A paid key, or cookies. Cookies mean giving a script your logged-in X session | Repo `mvanhorn/last30days-skill`, MIT, vendors a "bird-search" X client (SKILL.md). Cookie routes are higher risk (account takeover if the script misbehaves; also against X ToS). Not audited. Whether ScrapeCreators covers X: UNVERIFIED |
| X API / MCP server | NOT TESTED | Official API is paid; X posts also cost per read | A bearer token | Any third-party X MCP asks for the same token or your cookies; treat as high risk unless the maintainer is known |

Recommendation: use TinyFish `search` + `fetch_content` for ad-hoc and weekly "what's new" scans, and write the X URLs we trust into the repo's research notes. For a scheduled routine, TinyFish `create_monitor` exists in the connector list (not tested here, UNVERIFIED) and would avoid handing over keys. Only add X API credentials if the owner wants guaranteed full-archive search; the cost and the key are her decision.

Limits seen: search results include a lot of vendors/agencies since they post "steal this guide" articles. Dates appear on only about half of results; stats on tweets (views, likes) arrive inside the fetched text.

---

## 5. RED FLAGS
Adversarial pass. Calls are mine (INFERRED) unless a source is cited.

1. Vaporware repo with a pitch: `Vanszs/tiktok-viral-factory` (44 stars). Agents/tools/workflows are 0-byte files; README promises 100 videos/month for ~$50. (VERIFIED)
2. Results from sellers: danielhangan_ (sells dansugc.com and a TikTok VPN), maverickecom (sells agency service: "if you want it built and run for you"), jammer3k ("DM me UGC"), TokPortal (sells posting/account service; its own "stats" were flagged as unverified by my fetch pass), Ghostfeed plug in Tjay's guide. Every headline number from these (31/47 campaigns, $500K in 90 days, 550 videos/day, 150,000+ accounts, 14% retention) is SAID and unaudited.
3. Course-funnel repos: UGC-Factory README leads with a paid Skool program and "first AI client in 90 days or your money back" plus a Higgsfield referral link. The code is still real, but treat star counts and install links as marketing.
4. Own-data caveats: herk-edit-kit's numbers are the author's 27 top reels about AI/tutorials. They do not prove those cuts sell products.
5. Fake-sounding claims in search snippets: a DEV.to article cites "2.3x higher 3-second retention for AI hooks, leaked via The Information"; the search tool itself could not verify the attribution. Do not use. (UNVERIFIED)
6. "Claude Opus 5.5 / ChatGPT 6 Astra" YouTube titles about fully automating TikTok Shop edits (e.g. https://www.youtube.com/watch?v=ah6Um1IY_pw, https://youtube.com/watch?v=68yx8pipcSk): I did not watch them. Titles and snippets only. (UNVERIFIED). Large view counts in snippets are not evidence of results.
7. Income-in-title content ("Claude + Clothes = $24,568/month", https://youtube.com/watch?v=_gNW8LgGwfQ): title only, UNVERIFIED, typical course-funnel signature.
8. Ban-bait tactics presented as growth hacks: phone farms with EXIF rewriting and DNS/WebRTC patches (S13), persona accounts with regional proxies (sirambrosio repo), "remake winning videos across affiliate accounts" (Frydberg). These collide with the stated 2 Jun 2026 rule on multiple accounts used to avoid enforcement and the Sep 2025 cross-account duplication rule (both via secondary summaries). Do not build features around them.
9. Disclosure advice that could backfire: a Reddit commenter says a barely visible "AI generated content" line is accepted; another reports permabans with 100% disclosure. TikTok's help page says it can auto-apply an AI label that creators cannot remove (via search summary; page not opened). Do not build "hide the AI label" into the pipeline.
10. Policy sources are secondary. BigSeller, PPC Land, TokPortal, Delzonic, Conbersa, Multilogin are vendor/news summaries; I did not read TikTok Shop Academy text (login-gated). Verify the 6-in-90-days rule, daily shoppable-video limits (effective 11 May 2026 US per PPC Land), and "Account Health Rating replacing violation points (July 2026)" in Seller/Creator Center before building limits into the tool.
11. Small-repo risk: 2bft-video-editor (0 stars, new, publishes scripts that run with local files), clipspal (edits permissions file), RPA FastMoss repo (drives your logged-in browser). Read install scripts first; run with least permissions.
12. Health claims: Maverick's supplements section is sensible compliance copy (no cure/treat claims, FDA line). Still SAID and from an agency, not legal advice.

---

## 6. OPEN THREADS
Not done or not verified. Listed so they are not mistaken for conclusions.

1. Separate judge pass on this spark log (fire / interesting / dead) has not been run; the Gate column above is my pre-judge.
2. TikTok official text: Creator Enforcement Policy (2 Jun 2026), Content Quality Guidelines, Account Health Rating, the "unoriginal content" definition. Need an owner login to TikTok Shop Academy or a screenshot.
3. Does TikTok's duplicate detection fingerprint video or audio? Nobody provided evidence; all thresholds are folklore. A cheap experiment (post 3 distinct variants, watch 48 h views) is the only way. (INFERRED)
4. YouTube builders: 6-8 TikTok Shop + Claude Code videos found, none watched or transcribed. Next step: pull transcripts for 2-3 and check whether the workflow has real post-level proof.
5. Skool posts found (Oleg's AI Lab "Claude Code System For Viral TikTok Videos", AI Automation Society "skill that edits my YouTube shorts", Cult Content TikTok Shop community) not opened: likely gated and funnel-shaped.
6. Not opened: veedstudio/open-edit, vargHQ/skills, showtime, social-video-agent, jump-cut, short-form-video-editor-mcp, Kronop hook-library.json contents, awesome lists. Worth a second pass for cut-logic and hook libraries.
7. Discord write-ups: no access path tested (invite-gated); nothing found.
8. Reddit coverage: r/TikTokshop and r/ClaudeAI hits only. Not searched: r/UGCcreators, r/ffmpeg, r/TikTokshopaffiliate (a similarly named `r/tiktokshopsaffiliates` thread appeared). Not read: r/ClaudeAI "I open-sourced the Claude Code skill I use to edit my own videos" (https://reddit.com/r/ClaudeAI/comments/1w935ob/i_opensourced_the_claude_code_skill_i_use_to_edit) and "End-to-End AI Video Production Pipeline" (r/ClaudeWorkflows 1t6zmb6): both concrete leads, include face-tracked reframe code per snippet.
9. ffmpeg-skill star-history authenticity (stargazer fetch failed). Check before putting it in the headline recommendation.
10. TinyFish credit balance and whether `create_monitor` can run a weekly X/Reddit watch for the Command Center.
11. Hook-library licensing: clipspal's 820-template library and TikTok Sans Bold font license were not checked before reuse.

Side ideas (off-brief, logged only): (a) A first-2-seconds similarity checker as a reusable QA tool. (b) A per-variant ledger tying `hooks.json` id to post id to GMV, mirroring Maverick's tracker columns. (c) Brooke Lacey's "lanes" memory pattern (corrections routed back to persistent instructions) fits our drift-guard.

---

Drift check: depth 2, vision 2, truth 2, complete 1, specific 2, focus 2, craft 2. Not fixed: gh search rate-limit gaps, YouTube/Skool/Discord/X-API items unverified, and no separate judge agent run.
