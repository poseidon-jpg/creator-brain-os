# LANE D: End-to-end workflow ops (iPhone -> Mac -> TikTok Shop -> feedback)

Goal beyond the goal: more GMV per hour of filming. Ops must be boring, folder-based and nearly zero-click so the creator only films, approves, and posts.
Date of research: 2026-11-21. Labels: MEASURED (run on this Mac), VERIFIED (read on an official page), SAID (third-party / forum claim), INFERRED (my reasoning), UNVERIFIED (not confirmed, test it).

---

## 1. SPARK LOG

Gate = my first judge pass (FIRE / interesting / dead). A separate judge agent should re-grade (see Open Threads).

### A. Ingest

| # | What | Where | Why it pulls | Gate | Label |
|---|---|---|---|---|---|
| A1 | Apple: HEVC/HEIF may be converted to H.264/JPEG on transfer to Photos, Image Capture, a PC, and when shared by AirDrop/Messages/email if the receiver lacks support. Fix: iPhone Settings > Photos > Keep Originals. | https://support.apple.com/en-us/116944 | This is THE ingest gotcha. Quality loss is silent. A one-time toggle removes it. | FIRE | VERIFIED (page read; page names "Keep Originals", not the older "Transfer to Mac or PC" wording) |
| A2 | Apple: iPhone records HDR (Dolby Vision) video by default on supported models; Settings > Camera > Record Video > HDR Video is the switch. Non-HDR devices get an SDR version when shared. | https://support.apple.com/en-by/102241 and https://support.apple.com/guide/iphone/change-video-recording-settings-iphc1827d32f/15.0/ios | Turning HDR Video OFF at the source removes the whole "washed out after ffmpeg" class of bug for a non-technical user. | FIRE | VERIFIED that the switch exists. UNVERIFIED that the exact menu wording is unchanged on her iOS version. |
| A3 | Apple dev doc: iPhone Dolby Vision is Profile 8, cross-compatibility ID 4 (HLG base layer), so non-DV decoders fall back to HLG. | https://developer.apple.com/av-foundation/Incorporating-HDR-video-with-Dolby-Vision-into-your-apps.pdf (surfaced via search snippet; PDF not opened) | Explains why ffmpeg sees `arib-std-b67` (HLG) / BT.2020, not "Dolby Vision", and why a plain re-encode looks grey. | interesting | SAID (search snippet of Apple PDF; not opened) |
| A4 | Tone-map recipe for HDR -> SDR: `zscale=transfer=linear:npl=100,format=gbrpf32le,zscale=primaries=bt709,tonemap=tonemap=hable:desat=0,zscale=transfer=bt709:matrix=bt709:range=tv,format=yuv420p`. The article gives it for PQ (HDR10) input only, and says HLG must be tested. | https://dev.to/masonwritescode/ffmpeg-hdr-to-sdr-tone-mapping-that-doesnt-look-washed-out-2026-24ie | Gives Claude a concrete chain. But see A5. | interesting | SAID (blog); HLG behaviour UNVERIFIED |
| A5 | **This Mac's ffmpeg 8.1.1 (Homebrew) has NO `zscale` and NO `libplacebo`.** It has `tonemap`, `colorspace`, `libx264`, `libx265`, `hevc_videotoolbox`, no libzimg in its configure line. | local: `ffmpeg -filters`, `ffmpeg -version` | The recipe in A4 would fail on her likely setup. Strongest argument for fixing HDR at the source (A2) or shipping a verified fallback path. | FIRE | MEASURED (on the owner's Mac; a creator's Mac may differ, so the setup script must probe and report) |
| A6 | Forum thread: Apple-produced HLG can look blown out (opposite symptom) depending on player/profile; another: wrong colour tags cause "washed out in Chrome, fine in QuickTime". Always `ffprobe` tags first. | https://ffmpeg.org/pipermail/ffmpeg-user/2023-October/057042.html and https://discussions.apple.com/thread/255803798 | Justifies a QA step: compare tags in and out, and eyeball a frame. | interesting | SAID |
| A7 | osxphotos: `osxphotos export <dest> --update --only-movies` is incremental (keeps `.osxphotos_export.db`), MIT, installs with `uv tool install osxphotos` or Homebrew. `--download-missing` pulls iCloud-only items via AppleScript but README calls Photos' AppleScript "somewhat buggy". `--added-in-last "1 week"` exists. Cannot read shared albums on macOS 26.x. | https://github.com/RhetTbull/osxphotos | Best "zero-click" path if she uses iCloud Photos: one command exports only new videos, with metadata, into a watched folder. | FIRE | VERIFIED (README, first 100k of 143k chars read; permission-prompt details not covered) |
| A8 | launchd `WatchPaths` runs a script when a folder changes, but does not say which file, and may fire while a file is still copying. fswatch (FSEvents) is the alternative (Homebrew). Folder Actions are described as ageing. | https://dev.to/mayeu/how-to-trigger-any-action-when-a-file-or-folder-changes-on-macos-on-the-cheap-3dcp, https://eclecticlight.co/2018/02/09/watching-folders-1-for-users/ | Defines the watcher design: launchd job -> script that lists new files, waits until size is stable, then processes. `fswatch` is not installed here (MEASURED). | FIRE | SAID (blogs); fswatch absence MEASURED |
| A9 | Dropbox: its "+" upload sends the original HEVC; sharing from Photos transcodes to lower-bitrate H.264; Camera Uploads can convert HEVC to non-HEVC MOV (setting "Save HEIC Photos as"). | https://help.dropbox.com/installs-integrations/mobile/ios-formats and https://www.dropboxforum.com/discussions/101001014/changes-bitrate-and-file-size-after-sync-/244375/replies/244579 | Shows that cloud paths have silent transcode switches. Same class of trap likely applies to Drive. | interesting | VERIFIED (Dropbox help page) + SAID (forum staff reply) |
| A10 | Google Drive for desktop: Stream vs Mirror. Google says video-editing apps are faster with Mirror; Stream uses Apple File Provider and undownloaded files are not accessible; deleting the old local folder when switching modes before sync completes loses files. | https://support.google.com/drive/answer/13401938?hl=en | A watcher on a Stream folder can see placeholder files, which breaks ffmpeg. Mirror works but duplicates every raw clip on disk. | interesting | VERIFIED (search excerpt of Google help page) |
| A11 | Google Drive iPhone app upload fidelity: one Apple Community user reports Drive offers "automatic" or "unmodified" upload and automatic shifted colours (no replies). Nothing official found on HEVC or Dolby Vision handling. | https://discussions.apple.com/thread/255495471 | The risk is real but unquantified. | dead-end for evidence (kept as a warning) | SAID, single anecdote; official behaviour UNVERIFIED |
| A12 | File sizes (4K, HEVC vs H.264 per minute): about 170 MB/min 4K30 HEVC, about 375 MB/min 4K30 H.264, about 400 MB/min 4K60 HEVC (one table, Mar 2026); older Apple-era figures ~350-400 MB/min H.264. Sources disagree. | https://ios-apps-website.web.app/blog/iphone-video-codec-comparison (via search snippet) | Sizing: a 90-minute shoot day at 4K30 HEVC is roughly 15 GB (INFERRED from 170 MB/min). Disk and cloud-quota planning. | interesting | SAID (single table; measure her own phone) |
| A13 | AirDrop: community reports it sends the original unless the receiver needs a compatible format; Share Options > "All Photos Data" is cited as the way to force the original. No source on whether Dolby Vision metadata survives. | https://forums.macrumors.com/threads/all-photos-data-when-airdropping.2205847 and A1 | AirDrop is the lowest-friction manual path but its fidelity rules are murky. | interesting | SAID (forums); DV survival UNVERIFIED |

### B. Shooting protocol (no official source; mostly rules derived from the pipeline's needs)

| # | What | Where | Why it pulls | Gate | Label |
|---|---|---|---|---|---|
| B1 | TikTok Content Posting API accepts MP4/WebM/MOV, H.264 (recommended) or H.265, 23-60 fps, each side 360-4096 px, up to 4 GB, up to 10 min via API (app trims to the account's max, 3 min for all creators, 5 or 10 for some). | https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide | Hard output limits for the pipeline: 4K frame (3840) fits under 4096; 60 fps is allowed. Vertical 1080x1920 is the safe delivery. | FIRE | VERIFIED |
| B2 | Slate/clap + verbal tag protocol, one-take-many-hooks, B-roll checklist, lighting/audio minimums. | none (design) | The pipeline can cut automatically from transcripts if each take says "hook one ... hook two ... body ... CTA" and a clap gives a sync/cut marker. Detect the verbal tag via word-level transcription; detect the clap via audio peak. | FIRE (design) | INFERRED. No source claims this protocol works; must be tested on real clips. |

Recommended shooting rules (INFERRED, not sourced): 1080p vertical 30 fps default (smaller, matches output; 4K only if she wants post-crop reframing); keep fps constant (shoot in the Camera app, not a screen recorder, to avoid variable frame rate; the pipeline also normalises to constant 30 fps on ingest); lav or phone-mic within 30 cm in a quiet room is the audio minimum; window or ring light facing the face and product; per product record: hook takes x3, product demo close-up, in-hand use, before/after, texture/detail, packaging/unboxing, a clean 5 s product-only plate, one "reaction" line, CTA take.

### C. Product intake

| # | What | Where | Why it pulls | Gate | Label |
|---|---|---|---|---|---|
| C1 | TikTok Shop affiliate APIs (Partner Center) cover open/targeted campaigns, creator search, open-collaboration product search by category/commission/keywords, product promotion links, and affiliate order retrieval. It is a developer/partner-registered program (register as an Affiliate app developer in Partner Center). | https://developers.tiktok.com/blog/2024-tiktok-shop-affiliate-apis-launch-developer-opportunity | The only first-party route to structured product and commission data. But it is an app-developer path, not a "creator logs in" path; a solo non-technical creator probably cannot or should not get this approved. | interesting | VERIFIED (post read); creator eligibility UNVERIFIED (post does not define it) |
| C2 | Kalodata vs FastMoss pricing: Kalodata about $49.99/mo Starter, $109.99/mo Professional (Capterra: $49 start); FastMoss about $47-139/mo across Basic/Pro/Ultimate with annual discount (older TrustRadius figures $59/$109/$399). Sources conflict; neither has a permanent free plan. Both offer CSV or contact exports on higher tiers. | https://www.hubfluence.io/blog/kalodata-vs-fastmoss, https://delzonic.com/blogs/fastmoss-pricing-2026/, https://creatify.ai/zh/blog/kalodata-pricing-plans-and-what-you-ll-actually-pay-in-2026, https://www.capterra.com/p/10013207/Kalodata/ | Product picking is where GMV is decided. A human-in-the-loop CSV export dropped into a folder is allowed and easy; scraping is not (C4). | FIRE | SAID (third-party price tables). Vendor price pages not accessible without login. |
| C3 | Sample request: "Get Sample" on the product detail page when the seller enabled it; open-request caps exist; US eligibility reportedly 18+, US-based, over 1,000 followers, ID verification; post within 14 days, video live 3+ days or a 10 min LIVE. Rules tightened in 2026. | https://www.sirency.com/blog/tiktok-shop-free-samples, https://www.hollyland.com/?p=562078, https://merchize.com/how-to-get-free-samples-on-tiktok-shop/ | The product-intake loop must track sample status and the 14-day clock, since a missed deadline can restrict the account (as claimed). | interesting | SAID (third-party; no official page found; verify in her Creator Center) |
| C4 | TikTok Terms of Service (US): prohibits using "automated scripts to collect information from or otherwise interact with the Services"; the EEA text bars screen scraping for commercial purposes. Page is dated 2019/2020 in sections read. | https://www.tiktok.com/legal/page/global/terms-of-service/en | Rules out building a scraper of TikTok Shop pages or her own Creator Center. Design consequence: intake is paste-in (she pastes the product URL and selling points) or CSV-export-in. | FIRE (as a constraint) | VERIFIED (quoted text) but terms may have been updated; second half of page unread (85k chars) |
| C5 | Commission rates are seller-set (one source: 1%-80%, US average about 13%); typical working range about 2-20% by category. | https://www.hamstergarage.com/article/tiktok-shop-affiliate-commission-rates-fees-payouts, https://ttcalculator.net/learn/tiktok-shop-commission-rates/ | The scoring formula for "which product to film" needs commission x price x demand, not demand alone. | interesting | SAID (third-party; no official number found) |

### D. Publishing

| # | What | Where | Why it pulls | Gate | Label |
|---|---|---|---|---|---|
| D1 | Direct Post `post_info` fields: privacy_level, title (max 2200 UTF-16 runes), disable_duet/stitch/comment, video_cover_timestamp_ms, brand_content_toggle, brand_organic_toggle, is_aigc. **No field for product, shop, anchor or link.** 6 requests/min per user token; daily cap about 15 posts/creator. | https://developers.tiktok.com/doc/content-posting-api-reference-direct-post | Answers the core question: the API cannot attach a Shop product. Therefore the API alone can never produce a shoppable post. | FIRE | VERIFIED (page read in full by fetch tool) |
| D2 | Unaudited API clients: all posts forced to private (`SELF_ONLY`), up to 5 users per 24 h, account must be private at posting time; an audit is required to publish publicly; audit expects a client for a wide audience, "not only test or internal use". | https://developers.tiktok.com/doc/content-sharing-guidelines and https://developers.tiktok.com/doc/content-posting-api-get-started | A personal-use app is unlikely to pass audit, so Direct Post cannot publicly publish for her. This kills "fully automatic posting" as a v1 goal. | FIRE | VERIFIED |
| D3 | Inbox/draft upload: `/v2/post/publish/inbox/video/init/` with `video.upload` scope; creator must tap the inbox notification and finish editing and posting in the TikTok app. Draft endpoint documented without title/caption fields for video. One search summary says at most 5 pending shares per 24 h and TikTok app 31.8+. | https://developers.tiktok.com/doc/content-posting-api-get-started-upload-content | Closest to "drafts": the file lands in the TikTok app ready for her to add the product link and post. Still needs an approved developer app. | interesting | VERIFIED (page); 5/24 h and 31.8 are SAID (search summary) |
| D4 | Official product-link steps: in the TikTok app Post screen tap Add Link > Products > pick from Showcase > Add > Post. Linked videos go through an additional review; link shows above the username. Markets include the US. The page does not say anything about TikTok Studio desktop or adding after posting. | https://ads.tiktok.com/help/article?aid=10005137 | The anchor is a manual app step in all official material found. | FIRE | VERIFIED for the app flow; desktop/after-post UNVERIFIED |
| D5 | Third-party guides (Hollyland, Tolstoy) say a link can be added after posting within 30 days from Creator Center / TikTok Studio "Add Link" on videos without a product; a vendor page (Pippit) says it cannot. Conflict. | https://store.hollyland.com/blogs/creator-hub/add-a-product-to-a-tiktok-video, https://help.gotolstoy.com/en/articles/12822013-how-to-use-shoppable-videos-on-tiktok-shop, https://pippit.capcut.com/tools/add-product-link-to-tiktok-video | If true it decouples upload from linking, so desktop upload could happen first and linking later in one batch. Must be tested live. | interesting | SAID (conflicting third parties); UNVERIFIED |
| D6 | TikTok Studio desktop: Hootsuite describes Upload from the left sidebar with caption, hashtags, mentions, cover. Does not confirm a product-link option on desktop. Digiday reported a limited test of third-party affiliate links (Amazon, Walmart, Target). | https://blog.hootsuite.com/tiktok-desktop, https://digiday.com/marketing/tiktok-quietly-tests-product-links-in-posts-as-it-looks-to-boost-its-reputation-for-shopping/ | Desktop upload from a Finder folder is the least-friction manual path, if the link option exists there. | interesting | SAID; UNVERIFIED in her account |
| D7 | Eligibility thresholds conflict across 2026 blogs (1,000 followers vs 10,000 to add a link). Trust the TikTok help centre. | https://virlo.ai/blog/tiktok-shop-affiliate-program | A setup checklist item: confirm her own eligibility in-app before building anything. | interesting | SAID, conflicting |

### E. Feedback loop

| # | What | Where | Why it pulls | Gate | Label |
|---|---|---|---|---|---|
| E1 | Creator Center (Shop): Today's Data > Overview > Video List shows GMV, views, items sold per video for videos in the last 90 days; detail page shows trends and a video diagnosis; custom range capped 30 days; GMT-8. The page read does not mention CTR/CTOR or export. | https://seller-us.tiktok.com/university/essay?knowledge_id=2081999273527086 | This is the right data (per-video GMV) in the right place. Without export, she must copy it in. | FIRE | VERIFIED (page read) that views/GMV/items-sold are shown per video; export UNVERIFIED |
| E2 | A search summary of a different Seller University page claims the creator video detail page also shows CTR and CTOR. | https://seller-us.tiktok.com/university/essay?knowledge_id=5833424661628715&lang=en | CTR per video is what ties hooks to sales. | interesting | SAID (search summary of a page I did not open); UNVERIFIED |
| E3 | TikTok Studio desktop Analytics has "Export Data" (CSV); sources say 60-day windows, per-video data included, desktop only, Creator/Business account. No TikTok-owned page found. | https://blog.coupler.io/how-to-export-data-from-tiktok/ and https://www.graphed.com/blog/how-to-export-tiktok-analytics | This gives views/watch-time/retention per video for hook testing, though no GMV. The GMV side comes from E1 or E4. | FIRE | SAID (third-party); UNVERIFIED on official page |
| E4 | Seller-side (not hers): Affiliate Center > Analytics > Performance has Export on creator/product/video/LIVE lists; Data Compass video details has an Export button. Affiliate API includes affiliate order retrieval and video performance endpoints (per Celigo connector list). | https://docs.celigo.com/hc/en-us/articles/18704697472667, https://ads.tiktok.com/help/article/about-affiliate-creatives-for-tiktok-shop-ads | Shows that the data exists via API for sellers/partners, but a solo affiliate is not the audience. | interesting | SAID (connector docs); creator access UNVERIFIED |
| E5 | Third-party exporters (EchoTik, CommentPicker, Coupler.io) can pull analytics for a fee or free tier (e.g. 1 daily/3 monthly exports, 20 videos). | https://commentpicker.com/export-tiktok-analytics.php, https://www.echotik.live/blog/how-to-export-tiktok-shop-data/ | Fallback only; handing her login to a third party is a security and ToS risk. | dead for v1 (security) | SAID |

### F. Cost

| # | What | Where | Why it pulls | Gate | Label |
|---|---|---|---|---|---|
| F1 | Claude: Pro $20/mo monthly or $17/mo billed annually ($200 up front), Claude Code included; Max $100/mo; Free has no Claude Code. Plans have a 5-hour session limit and a weekly limit shared across Claude and Claude Code. Max plan API credits cannot be used in Claude Code or the Claude apps. | https://claude.com/pricing and https://support.claude.com/en/articles/11145838 | Sets the baseline: Pro covers a light user; heavy daily video batch work (many transcription/vision calls) may hit limits and force Max. | FIRE | VERIFIED (pricing page as fetched; API per-token table was cut off) |
| F2 | Claude Desktop includes Claude Code under the Code tab; no separate install. | https://support.claude.com/en/articles/11145838 (via search summary) | Matches her setup. | interesting | SAID (search summary) |

---

## 2. COMPARISON: HOW CLIPS GET FROM IPHONE TO MAC

Common precondition for every option: on the iPhone set Settings > Photos > Keep Originals (A1), and decide HDR (A2). INFERRED recommendation: turn **HDR Video OFF** (Settings > Camera > Record Video), keep **High Efficiency** (HEVC). Result: 8-bit SDR HEVC, half the size of H.264 (A12) and no tone-mapping needed. Cost: loses HDR highlights, which TikTok does not meaningfully need for a talking-head product video (INFERRED; TikTok HDR playback behaviour not researched, UNVERIFIED).

| Method | Friction | Fidelity | Automatable | Verdict |
|---|---|---|---|---|
| AirDrop (Photos > Share > Options > All Photos Data) | Lowest to start; manual per batch; both devices awake and nearby | Original reported kept (SAID); DV metadata survival UNVERIFIED | Lands in Downloads, not a chosen folder; not scriptable from the phone | Good "I need it now" fallback. Not the daily path. |
| iCloud Photos + `osxphotos export --update --only-movies` into a watched folder | Zero taps after setup (phone uploads on Wi-Fi; Mac exports on schedule) | iCloud keeps original format/resolution/fps (SAID, Apple page snippet); osxphotos exports the original file plus a sidecar | Best: one command, incremental, metadata in sidecars, launchd-friendly | **Recommended primary.** Caveats: needs Photos library on this Mac fully downloaded ("Download Originals", not Optimize Storage), `--download-missing` is flaky per README, needs macOS Photos permission prompt (UNVERIFIED), iCloud storage plan cost (not researched). |
| Image Capture / Photos import over cable | Cable, manual | Can convert HEVC to H.264 unless Keep Originals is on (VERIFIED) | Not scriptable by non-technical user | Backup path for a dead network. |
| Google Drive iPhone app -> Drive for desktop | Medium: remember to upload each batch; upload mode may be "automatic" vs "unmodified" (SAID) | Unknown; one colour-shift anecdote (SAID) | Folder appears on Mac, but in Stream mode files can be placeholders (VERIFIED) | **A mild trap.** Not forbidden, but adds a second quota, a transcoding unknown and a placeholder-file failure mode. Use only if she already lives in Drive and sets Mirror, "unmodified". Test before trusting. |
| Dropbox | Similar to Drive | Original HEVC via "+" upload; Camera Uploads may convert (VERIFIED/SAID) | Sync folder watchable | Same cautions as Drive; paid once over free quota (not researched). |
| Shortcuts automation on iPhone ("Save Video Files to folder in iCloud Drive / Files") | Can be a one-tap or personal automation | UNVERIFIED (not researched) | iCloud Drive folder syncs to a Mac path | Open thread: test whether it preserves the original container. |

Drive verdict (answers the owner's question directly): not a disaster, but it is the only option where I found NO official statement about HEVC/Dolby Vision handling on iPhone upload (A11), and where Stream mode can hand the watcher a not-yet-downloaded file (A10). Prefer iCloud Photos + osxphotos. If Drive is used, choose Mirror and verify one clip with `ffprobe` (codec, `color_transfer`, bitrate) before trusting it.

### HDR/VFR rules the ingest step must apply (INFERRED from A1-A6, MEASURED on A5)
1. `ffprobe -select_streams v:0 -show_entries stream=codec_name,pix_fmt,color_transfer,color_primaries,avg_frame_rate,r_frame_rate` on every clip; log it.
2. If `color_transfer` is `arib-std-b67` (HLG) or `smpte2084` (PQ): tone-map. This Mac's ffmpeg lacks `zscale`/`libplacebo` (MEASURED), so either install an ffmpeg build with zimg/libplacebo (UNVERIFIED which brew formula or tap provides it) or tell her to switch HDR Video off at the source. The setup script must probe for `zscale` and print a plain-English instruction.
3. If `avg_frame_rate` differs from `r_frame_rate`, the clip is variable frame rate (iPhone clips can be); re-encode to constant 30 fps (`-fps_mode cfr -r 30`) before any frame-accurate cutting. VFR on iPhone: SAID/INFERRED, not researched with a source.
4. Compare input/output colour tags after render; spot-check one frame image by eye (A6).

---

## 3. RECOMMENDED DAILY WORKFLOW (step by step)

One-time setup (about 30 min, with Claude Code guiding):
1. iPhone: Settings > Photos > Keep Originals; Settings > Camera > Formats > High Efficiency; Settings > Camera > Record Video > HDR Video OFF; 1080p at 30 fps (or 4K 30 if she wants reframing).
2. Mac: Photos > Settings > iCloud > Download Originals; install osxphotos (`uv tool install osxphotos`), fswatch optional; run the pipeline's setup check (ffmpeg has zscale? disk space? Photos permission?).
3. Create folders: `inbox/` (raw clips), `products/<slug>/` (intake), `work/`, `out/` (post-ready), `analytics/` (CSV drops), `ledger.csv`.
4. Confirm in her own TikTok app: she can see Add Link > Products on the Post screen, and test whether linking after posting works (D4, D5) and whether TikTok Studio on desktop shows Add Link (D6).

Per product (about 10 min plus the shoot):
1. Pick the product. She exports a Kalodata or FastMoss CSV (human click, allowed) or pastes the product page URL and the 3-5 selling points, commission %, price, and sample status into `products/<slug>/brief.md`. Claude scores candidates by commission x price x trend (C2, C5). No scraping of TikTok (C4).
2. Request the sample in-app; the system writes the 14-day deadline into the ledger (C3, SAID).

Film (per product):
1. Slate: clap, say "product <slug>, take N".
2. Say "hook one" ... then the hook; "hook two" ...; body; CTA. B-roll checklist per product from section 1B.

Ingest and edit (automatic):
1. iCloud Photos uploads from the phone on Wi-Fi/power.
2. A launchd job runs `osxphotos export inbox/ --update --only-movies --added-in-last "2 days"` (A7, A8), writes only new videos, waits until file sizes are stable, then calls the pipeline.
3. Pipeline probes colour/fps (section 2), normalises, transcribes, splits on verbal tags and clap, assembles hook variants (Lanes A to C own the cut/caption stack) into `out/<slug>/<variant>.mp4` at 1080x1920, H.264/AAC MP4, 30 fps, within API limits (B1).
4. Independent QA agent grades each output against a rubric (tags, duration, audio, caption legibility); failing variants never reach `out/`.

Publish (human, about 2 minutes per video):
1. She opens `out/` in Finder and picks variants. Upload via TikTok app (or TikTok Studio desktop if D6 checks out).
2. Caption and hashtags come from a `caption.txt` Claude wrote per variant (copy/paste).
3. She taps Add Link > Products > the product > Post (D4). Then she types the post URL or the date/time back into the ledger (or a one-line Claude command).
4. Optional later: draft-upload through the Content Posting API (D3) once she has an approved developer app; it still ends with her finishing in the TikTok app.

Feedback (weekly, about 5 minutes):
1. Creator Center > Video List: she screenshots or copies GMV, views, items sold, CTR per video (E1/E2) into `analytics/` (CSV if export exists, otherwise a screenshot Claude reads with vision, INFERRED feasible).
2. TikTok Studio desktop > Analytics > Export Data CSV (60-day windows, so run it at least every 8 weeks) (E3, SAID).
3. Claude joins them with `ledger.csv` on video ID or date+product, ranks hook types and edit variants by GMV per 1,000 views and CTR, and writes `learnings.md`, which the hook skill reads next time. Minimum sample before conclusions: INFERRED, state it in the report so it does not overfit to 3 videos.

---

## 4. WHAT STAYS MANUAL

| Step | Why | Source |
|---|---|---|
| Add the product link (the yellow basket) | No `post_info` field for products; official steps are in-app; linked videos get extra review | D1, D4 (VERIFIED) |
| Final Post tap | Draft/inbox upload requires finishing in the TikTok app; Direct Post is private-only until audit | D2, D3 (VERIFIED) |
| Sample requests, affiliate eligibility, ID verification | Account and compliance actions on her behalf; third-party claims on caps | C3 (SAID) |
| Sample received to filming | Physical | n/a |
| Exporting Kalodata/FastMoss CSV | Needs her login; scraping prohibited | C2, C4 |
| Creator Center analytics copy/export | No confirmed creator-side API or export; Terms forbid automation of TikTok pages | C4, E1 (VERIFIED), E3 (SAID) |
| FTC/commerce disclosure toggles | Required UX on any API client; she must choose | https://developers.tiktok.com/doc/content-sharing-guidelines (VERIFIED) |
| Approving which variants to post | Outside-judge principle: she is the taste judge; QA agent only filters hard failures | INFERRED |

---

## 5. COST PER MONTH (labels as shown)

| Item | Low | Likely | High | Label |
|---|---|---|---|---|
| Claude Pro with Claude Code | $17 (annual) | $20 | | VERIFIED (claude.com/pricing) |
| Claude Max (if limits bite) | | | $100 | VERIFIED |
| Kalodata or FastMoss (one, optional) | $0 (skip, use in-app product lists) | about $47-50 entry | about $110-139 | SAID; vendor pages not readable without login |
| iCloud storage for raw clips (about 170 MB/min at 4K30 HEVC; 1080p less) | free 5 GB is too small | paid tier | | Apple pricing NOT researched: UNVERIFIED |
| TikTok Shop / Content Posting API | $0 listed; no fee found | | | UNVERIFIED (no pricing page read; docs show no fee) |
| ffmpeg, osxphotos, fswatch | $0 (MIT/open source for osxphotos; ffmpeg already installed) | | | VERIFIED for osxphotos license; ffmpeg licence not researched |
| Anthropic API (pay-per-token) | not needed if everything runs inside Claude Code on her plan | | | INFERRED. Max API credits cannot be used in Claude Code (SAID, support page). |

Rough totals (INFERRED arithmetic): lean $20; with one product-research tool about $70; heavy about $150-240 plus iCloud. Not a bill estimate for transcription or generation tools from other lanes.

---

## 6. OPEN THREADS (what I could not settle; each needs a test or a second source)

1. Does Add Link > Products exist on TikTok Studio desktop upload, and can it be added after posting (30-day window)? (D4-D6 conflict). Test in her account. Highest-value open question for a Mac-first workflow.
2. Does Google Drive iPhone upload preserve HEVC/HDR? No official statement found. Test one clip with ffprobe.
3. Does Dolby Vision/HLG survive AirDrop and iCloud Photos export? UNVERIFIED. Test one clip.
4. Does osxphotos need extra macOS permissions (Photos, Full Disk Access)? README read to 100k of 143k chars; permission wording not found. Read the remaining 43k chars (offset 100000).
5. HLG tone-map behaviour. The only chain found is for PQ. ffmpeg `zscale` is missing on this Mac (MEASURED); which Homebrew formula/tap provides zimg and libplacebo is UNVERIFIED. Easiest answer: HDR Video OFF at source.
6. Creator-side export of per-video GMV/CTR: no official CSV or API confirmed for a solo creator. Check Creator Center UI for "export"; confirm CTR/CTOR fields (E2 came from an unopened page).
7. TikTok app audit chance for a personal developer app: audit asks for a wide audience (D2). Low chance, so v1 skips the Content Posting API.
8. Sample caps and 2026 eligibility (C3) and commission benchmarks (C5): no official source found. Read Seller University "Creator" articles.
9. Verify the Kalodata/FastMoss exact current price on vendor pages (login walls).
10. iPhone Shortcuts automation to auto-save new videos to an iCloud Drive folder: not researched.
11. TikTok ToS second half (85k chars unread) and Shop-specific creator terms on automation.
12. Whether the verbal-tag + clap slate protocol actually segments reliably with word-level transcription; needs a dry run (INFERRED design).
13. VFR behaviour on iPhone camera clips was not sourced; verify with `ffprobe` on a real clip.
14. Per-minute size table is one source; measure her phone.

Side ideas logged (off-brief): a "sample deadline" ledger with reminders; a QA agent that compares HDR clip tags before/after render; a weekly "which hook shapes sell" report.

---

Drift check: depth 1, vision 2, truth 2, complete 1, specific 2, focus 2, craft 2. Gaps I could not fix: several claims are third-party only (labelled), the official TikTok creator-side export and Studio-desktop link behaviour are unconfirmed, iCloud/Drive fidelity not tested on real clips, no real iPhone sample was available to run the recipe, and no separate judge agent graded these sparks.
