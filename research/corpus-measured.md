# corpus-measured: turning the rubric's SAID numbers into measured ones

Researched 2026-11-21 by one executor (budget: one agent). Anchor read first: `DRIFT_GUARD.md` (final judge question #1), `studio/RUBRIC.md`, `research/JUDGE-M1.md`, `research/lane-a-creative-meta.md`.

## Read this first (the plain answer to judge question #1)

**Is the pipeline "trained on real winning TikTok Shop affiliate content"? Not yet.** What exists now is third-party measured data, read at the primary page, that replaces several SAID numbers with numbers that have a sample size and a method. None of it was measured by us on our own corpus, none of it is causal, and almost all of it comes from vendors that sell something. The rubric can be recalibrated against it today (section b). A corpus we measure ourselves needs the collection protocol in section (c), which needs the creator's decision on one legal gray area.

**Label key (stricter than the lanes, on purpose)**
- **M3** = MEASURED by a third party: a number a study computed from observed data, which I read on the primary page this session. I did not recompute it.
- **VERIFIED** = I read the primary page and the page says exactly this (policy text, a published recommendation, a method statement).
- **SAID** = advice with no stated method. **INFERRED** = my reasoning. **UNVERIFIED** = seen only in a snippet, or I could not open the source.
- Every M3 row also carries a **bias note**. "Top sellers only" means survivor bias: the sample contains only winners, so it describes what winners look like, not what makes a video win.

**Two things to keep in mind about every number below**
1. All TikTok-Shop-specific numbers are associations among top sellers or listed top ads. Their authors say so themselves.
2. Views are not sales. The one source that counted views (Playhead, 19 videos) and the one that counted sales per view (MediaLabs) disagree on demo-first openings (see spark 5).

---

## (a) MEASURED FINDINGS

### A1. TikTok's own research (brand-lift studies, not sales)

| parameter | value | n | source URL | date | label | bias note |
|---|---|---|---|---|---|---|
| Share of ad-recall impact captured by second 6 | 90% (awareness ~80%); 50% of impact by second 2 | n not published | https://ads.tiktok.com/business/en-US/blog/resonance-key-factor-ad-effectiveness (cites "TikTok Marketing Science US Value of a View 2021, MediaScience") | 2023-09-26 | M3 (TikTok-reported, n unstated) | TikTok sells ads. Measures **brand ad recall**, not purchase. |
| Hook must land in first 6 s; introduce the proposition in first 3 s | recommendation, 5-10 words/s of text overlay recommended | none stated | https://ads.tiktok.com/resources/help/article/creative-best-practices?lang=en | "Last updated June 2025" | VERIFIED (it is advice, no data) | Platform advice. |
| Suspense hook: watch time | +16% | n not published | https://tiktok.com/business/library/Creative_Codes_One_Pager.pdf (source: "US SMB Creative Effectiveness Study 2021, Lumen") | May 2023 one-pager | M3 (TikTok-reported) | n and baseline unstated. |
| Surprise hook: view-through rate; emotion hook: awareness | 1.7x VTR; 1.7x awareness lift | n not published | same PDF | May 2023 | M3 (TikTok-reported) | same |
| "TikTok-first" (lo-fi, 9:16, people, category norms) vs not: actions (clicks/shares) | ~3.3x | n not published ("Global Entertaining Ads Study 2022, Marketcast") | same PDF and https://ads.tiktok.com/business/en-US/blog/creative-best-practices-top-performing-ads | 2022-2024 | M3 (TikTok-reported) | self-serving definition of "TikTok-first". |
| Creative coding analysis behind "Creative Codes" | 3,500 TikTok ads, 1 Jan-1 Oct 2021, all verticals, coded by Kantar | 3,500 | Creative Codes one-pager above | 2022 | M3 (sample size is real; per-feature effects mostly not published) | Brand-ad era data; pre-TikTok-Shop. |
| Real people on screen, trend remix, creative story: watch time | +9%, +14%, +16% | n not published ("US SMB Creative Effectiveness 2022, Lumen") | resonance blog above | 2023 | M3 (TikTok-reported) | n unstated. |
| Product on screen: brand affinity / recall; CTA card: recall / likeability | +65% / +25%; +45% / +19% | n not published (Lumen 2021; "Top-Performing BLS Creative Analysis 2020") | https://ads.tiktok.com/business/en-US/blog/creative-best-practices-top-performing-ads | page dated 2024-09-25 | SAID (TikTok-reported, underlying study not public) | Lane A called the CTA-card figure "phantom". It is real TikTok wording with a named but non-public source. Brand recall, not sales. |
| Sound on: "stop and look" / vital to experience | 73% / 90% of users | n not stated (Kantar 2021) | Creative Codes one-pager | 2023 | M3 (survey, n unstated) | survey of self-report. |
| Creative Center Top Ads per-second CTR or keyframe data | **not publicly shown.** The public page shows only likes, a "Top X% CTR" label and "High budget" per ad | n/a | https://ads.tiktok.com/business/creativecenter/insight/creativeinsight/pad/en (fetched page) | 2026-11-21 | VERIFIED (absence on the public page) | I could not log in, so a logged-in keyframe view is UNVERIFIED. |

### A2. Peer-reviewed papers (video features vs sales or engagement)

| parameter | value | n | source URL | date | label | bias note |
|---|---|---|---|---|---|---|
| Engagement is not sales: the most engaging pixels in influencer video ads are faces, not the product. A "product engagement score" (engagement-weighted product placement) predicts sales lift better than likes, follower count or ad spend | engagement-weighted product placement predicts sales lift; face presence positively correlated with pixel engagement; engagement rises with human presence, happy/sad faces, novel activities | 16,951 video ads to build the model (10,000 train / 3,500 val / 3,451 test); 2,685 videos matched to Taobao sales; sales lift via difference-in-differences on 259 treated products | https://pubsonline.informs.org/doi/10.1287/mksc.2021.0107 (full text read via https://artefacts-discovery.researcher.life/... , CC BY-NC) and press release https://www.eurekalert.org/news-releases/1076068 | Marketing Science 44(2), 2025; data Mar-Jun 2019 videos, Taobao sales May-Nov 2019 | M3 (peer-reviewed, observational + DiD) | **China TikTok (Douyin), 2019, Taobao sales, not US TikTok Shop.** I did not extract the effect-size coefficients (page text has them stripped), so I report direction only. |
| Presenter-dominant frames vs product frames vs product-in-context frames | functional (product-only) frames: positive for engagement and sales. contextual (person+product): positive for sales only. social (person-only): positive for engagement, **negative for sales**. More transitions between framing types: negative for both. Functional framing has an inverted-U for sales (too much hurts) | 3,426 Douyin book-promotion videos; 249,043 frames at 1 frame/s, CNN-labelled (trained on 6,000 frames, 3 coders each) | https://www.mdpi.com/0718-1876/21/7/200 | published 2026 (J. Theor. Appl. Electron. Commerce 21(7)); videos from Jan-Mar 2024, collected 2024-04-10 | M3 (peer-reviewed, econometric) | **Books on Douyin.** Coefficients not extracted (stripped in the page text); direction only. |
| Share of videos using each framing | 91.0% include product-only frames, 69.2% product+person, 73.5% person-only; 50.7% use all three, 17.0% only one | 3,348 videos | same MDPI paper | 2026 | M3 | same |
| Framing transitions per video | mean 10.4, median 7, max 193 | 3,348 videos (1 fps) | same | 2026 | M3 | Videos' length not reported with this stat, so cuts/second cannot be derived. |
| Viewing duration of e-commerce short videos: drivers and prediction | abstract only: builds a large-scale e-commerce short-video dataset, analyzes drivers of viewing duration, predicts it | not extracted | https://dl.acm.org/doi/10.1145/3690393 (Guo et al., ACM TMIS 15, Dec 2024) | 2024-12 | UNVERIFIED (full text not opened; two fetches were blocked) | Listed so the next pass can read it. No number taken from it. |

### A3. Industry datasets with a stated method (seller bias marked)

**Sales-linked, TikTok Shop US, 2026.** These are the closest thing to "real winning affiliate videos with sales attached."

| parameter | value | n | source URL | date | label | bias note |
|---|---|---|---|---|---|---|
| Product visible in first second | videos with it: 1.02x market sales per view (0.99-1.05), 82.4% of sales; without: 0.91x (0.85-0.98). Later paper, larger sample: 1.03x vs 0.90x | 2,433 with / 466 without (2,899 first-second labelled); later 9,285 analysed | https://medialabs-co.com/research/the-first-second ; https://medialabs-co.com/research/ugc-product-demonstrations | 2 Sep-1 Oct 2026; 19 Sep-18 Oct 2026 | M3 | MediaLabs is a TikTok Shop agency. Top sellers only. AI-labelled by an analyst that did not see sales. Sales/views are estimates merged from several commercial trackers, not TikTok figures. Paid promotion not controlled. |
| Face in first second | 1.05x (1.01-1.09), 58.7% of sales vs 0.94x (0.90-0.98) without. Creator on camera at all: face-in-first-second 1.06x (n=1,560) vs not on camera 0.89x (n=944) in the other table | 1,610 / 1,289 | same + https://medialabs-co.com/research/creator-on-camera and the MediaLabs summary page https://medialabs-co.com/blog/tiktok-shop-statistics | Oct 2026 | M3 | same. **Conflicts with Pan et al. (A2) and Playhead (below).** |
| On-screen text in first second | 1.01x (0.98-1.05) vs 0.97x (0.92-1.02): ranges overlap, weakest signal | 1,962 / 937 | the-first-second paper | Oct 2026 | M3 | same |
| Stacking first-second elements (face + text + product) | all 3: 1.08x (1.02-1.14), 31% of sales; two: 1.01x; one: 0.88x (0.82-0.95), 19% of sales; none: 0.76x (n=22, range includes 1). Later paper: 1.07x vs 0.92x | n per group not tabulated | same | Oct 2026 | M3 | The same paper says the model built on these features has AUC 0.64 (range 0.57-0.70): "modest ranking power". The first second is a small lever. |
| Hook type: sales per view vs market | price/deal 1.53x (1.37-1.71, n=193); bold claim 1.28x (1.20-1.37, n=478); question 1.27x (1.13-1.43, n=184); "straight into the demo" 0.89x (0.80-0.98, n=242); borrowed TV/film/viral clips 0.76x | 3,340 videos analysed | https://medialabs-co.com/blog/tiktok-shop-statistics (table); https://medialabs-co.com/research/openings-that-sell | 2 Sep-1 Oct 2026 | M3 | same. Hook type was labelled by AI. |
| Format: sales per view | demo/tutorial 0.92-0.96x (largest format, 34-36% of sales, n=1,183-3,163); voice-over B-roll 1.24x (n=561); unboxing 1.20-1.37x; review/testimonial 1.17-1.2x (14.1% of sales); photo slideshow 0.8x (0.78-0.89); filmed live action 1.0x with 89.5% of sales; AI avatar presenters 2.1x on 14 videos (0.2% of sales, do not read) | 9,285 analysed | https://medialabs-co.com/research/ugc-production-style ; ugc-product-demonstrations | 19 Sep-18 Oct 2026 | M3 | same. |
| Angle: sales per view | urgency/scarcity 1.35x (n=235); value/deal 1.26x (n=1,325, 15.8% of sales); curiosity-only 0.71x (0.65-0.77), lowest | 9,285 analysed | https://medialabs-co.com/research/ugc-calls-to-action | Oct 2026 | M3 | same |
| Call to action | orange-cart prompt 1.07-1.08x (n=1,782; 53.9-58% of sales); no CTA 0.90x (n=1,137); comment prompt 1.39x (n=45, range 1.14-1.70, tiny group) | 3,342-9,285 | same + statistics page | Oct 2026 | M3 | "orange cart prompt" is MediaLabs' label and the fetched pages do not define it. |
| Voice | speaking on camera 1.13x vs voice-over 1.05x; trending sound 0.80x (0.76-0.83); enthusiastic tone 1.08x (67.5% of sales); AI voice-over 0.95x (20.4% of sales); "visible AI" lowers odds (odds ratio 1.7 for no visible AI) | 9,285 | https://medialabs-co.com/research/ugc-voiceover-strategy ; https://medialabs-co.com/research/ai-video-on-tiktok-shop | Oct 2026 | M3 | same |
| Video shelf life | revenue-weighted median age of a selling top video 11 days; videos under 2 weeks old earned 56% of top-video revenue; 27.6% from videos older than 30 days | 14,200 videos | https://medialabs-co.com/blog/tiktok-shop-statistics | 3 Sep-2 Oct 2026 | M3 | survivorship: older videos are survivors. |
| Concentration | top 10% of video-weeks took 24.6-44% of category revenue | 16,541 videos | statistics page | Sep-Oct 2026 | M3 | |
| Length vs GMV per 1,000 views (selling videos) | <15 s: 18.1% of videos, $120; 15-30 s: 27.2%, $129; 30-60 s: 38.5%, **$134**; 1-3 min: 12.7%, $127; >3 min: 0.6%, $90. Median selling video 31 s | 12,881 videos from 6,449 creators, posted 6-12 Oct 2026, measured 3-4 weeks later; weighted to 84,830 tracked | https://hubfluence.io/blog/tiktok-shop-benchmarks | published 2026-11-05 | M3 | Hubfluence sells creator-management software. Videos with zero sales excluded. Differences between bands are about 10%, with no intervals given, so they are weak. |
| Concentration of sales | top 1% of videos = 20.1% of GMV; top 10% = 54.3%; 51.3% sold fewer than 10 units | same | same | same | M3 | selling videos only, so a "hit rate" cannot be computed. |
| Ad-boosted vs organic | 86.8% of selling videos ran as paid ads and carried 88.5% of GMV, **but GMV per 1,000 views was about $130 for both**. MediaLabs: organic $16.58 vs paid-led $15.51 per 1,000 views | 12,881; 14,200 | hubfluence page; statistics page | Nov 2026 | M3 | different metrics and samples. Supports "creative sets conversion; ad spend scales it". |
| Length (second source, snippet only) | "every length band from under 15 s to 1 to 2 min earns about $19 per 1,000 views"; 30-60 s is 40% of 4,909 selling videos | 4,909 videos, 60 products | https://tokconnect.com/trends/tiktok-shop/insights/how-long-should-a-tiktok-shop-video-be | 2026-10-21 | UNVERIFIED (search snippet; the page redirected to an index) | TokConnect sells data. |

**Views-based and small-n (what they share, not what sells).**

| parameter | value | n | source URL | date | label | bias note |
|---|---|---|---|---|---|---|
| Top TikTok Creative Center ads: length | median 26 s (US 20 s, n=86; product ads 23 s). 20% under 15 s; 37% 15-30 s; 30% 30-60 s; 13% over 60 s. Middle half 15-44 s | 705 unique top ads (from 2,506 list entries), 28 countries, 12 Nov 2026 | https://cutmarketing.app/blog/tiktok-top-ads-study-2026 | 2026-11-12 | M3 (descriptive) | Cut Marketing sells an AI ad tool. **These are paid ads on TikTok's top-ads lists, not affiliate videos.** TikTok does not publish how ads are ranked. AI-labelled from 3 frames, no audio. |
| Same: product visible by 1 s | 76% of product ads (n=452); 89% show product or face; 42% show a face; first frame: face 39%, hands/body 27%, product alone 19%, scene 10%, text card 6% | 452 product ads | same | same | M3 | same |
| Same: first-frame text | 54% overall, **US 36%**, Japan 74%; only 4% open with a question; 28% show a discount/price in the post caption; median post caption 80 characters | 662 labelled / 705 | same | same | M3 | same |
| Same: format and cuts | 37% of product ads are a person showing/using the product; 21% product-only footage; 11% talking to camera; 6% slideshow; **50% of product ads cut within 2.5 s** (43% among those on the 6-second-view-rate list vs 54% not) | 452 | same | same | M3 | same. Likes: median 24 with a face in first second vs 10 without (likes depend on spend and reach). |
| 97% of top ads are 9:16 | 97% (21 of 705 not) | 705 | same | same | M3 | same |
| 19 most-viewed TikTok Shop videos (3.8-39.2 M views) | product visible within 1.0 s in 15 of 19 (median first sight 0.07 s); 11 of 18 never showed a face (median length 12 s vs 44 s for the 7 with a face; median views 6.9 M vs 5.7 M); 16 of 19 hooks used 2+ channels; 14 of 19 make sense with sound off; 7 asked for anything and 6 of those 7 asked in the last 12% of the video; median length of all 19: 20 s | 19 (20 read, 1 failed) | https://tryplayhead.com/blog/tiktok-shop-hooks | 2026-10-08 (face counts corrected 2026-11-12) | M3 but **n=19 and views, not sales** | Playhead sells video-analysis software. One per account, hashtag pages. Direction only. |
| Hook retention curves, CTR-by-length from "24,000 ads" | claims winners cluster at 15-25 s, "below 40% at second 3 means rework", click spike at 15-20 s | no method for the second-by-second claims | https://mintec.co/blog/tiktok-ad-creative-data-2026 | 2026-07-30 | **UNVERIFIED, not used.** Sourced to another agency's blog plus "internal data". Per-second retention curves are not public on Creative Center. | agency marketing |

---

## (b) RUBRIC RECALIBRATION

Every row of `studio/RUBRIC.md` that carries a number or a pass rule. "Change" proposals are INFERRED from the rows above. Taste and her own sales overrule all of this, per RUBRIC's own header.

| RUBRIC item | current | verdict | what the measured data says |
|---|---|---|---|
| Resolution 1080x1920, 9:16 | hard spec | **keep** | 97% of 705 top ads are 9:16 (M3). TikTok's own help page says at least 720P and 9:16 (VERIFIED), so 1080x1920 is a stricter-than-TikTok choice. Fine. |
| Frame rate 30/60, colour check | hard spec | **no measured data** | Nothing found on frame rate or colour grading vs sales. |
| Loudness -14 LUFS +-1.5, true peak <= -1 dBTP | hard spec | **no measured data** | Only survey figures that sound matters (90% say vital, n unstated). No study of loudness vs sales. Keep as a technical delivery spec, not a performance claim. |
| Length 15-45 s default | `spec-length` rejects outside range | **change to 15-60 s as a soft default, warn instead of reject** | Median selling video 31 s; 30-60 s is the biggest band (38.5%, n=12,881) and the best GMV/1,000 views ($134), but the bands differ by about 10% with no intervals (Hubfluence). Only >3 min clearly drops ($90). Top US ads: median 20 s (n=86). A reject at 45 s contradicts the largest measured band. |
| Per-format lengths (demo 15-30, before/after 15-25, problem-fix 20-40, review/unboxing 30-60) | SAID | **no measured data** | Nobody published length by format with sales. Weak hint: faceless demos in the 19-video set ran a median 12 s, face-led videos 44 s (n=19, views). Keep as SAID defaults, label them so. |
| Hook -> key message -> CTA order | VERIFIED structure | **keep** | TikTok recommends hook/body/close (VERIFIED). No-CTA videos sold at 0.90x vs 1.07-1.08x with a cart prompt (n=1,137 vs 1,782). |
| Product or result visible by 3 s; hook payload <= 6 s | `slow-hook` | **tighten to 1 s for physical-product videos; keep 3 s as the reject line** | 76% of top product ads (n=452) and 82.4% of watched top-seller sales show the product in the first second; without it: 0.91x vs 1.02x (n=466 vs 2,433). 6 s matches TikTok's own advice (VERIFIED) but TikTok's own "50% of impact by 2 s" is brand-recall data. |
| Opening has spoken line + on-screen headline + visual in first 3 s | `thin-hook`, SAID | **change: require >= 2 of {face, product, text} in the first second; all three preferred. Drop the headline-text requirement** | Stack of 3: 1.08x; 2: 1.01x; 1: 0.88x. Text alone is the weakest signal (1.01x vs 0.97x, ranges overlap). Only 36% of US top ads put text on the first frame. 16 of 19 viral hooks used 2+ channels (picture + speech/text/sound), which is a looser rule than "headline required". |
| CTA spoken or on-screen at the end | `no-cta`, VERIFIED structure | **keep, and add placement** | No CTA 0.90x. 6 of the 7 viral videos that asked for anything asked in the last 12% (n=19). Mintec's "CTA at 75-80%" is UNVERIFIED. |
| Hands-only stretch > ~20 s needs voice/face | `passive`, SAID | **no measured data for the 20 s; evidence conflicts on faces** | Creator not on camera 0.89x (n=944) and face-first-second 1.05x (MediaLabs) vs. presenter-only frames *negative* for sales on Douyin books (Pan) vs. 11 of 18 viral videos had no face (Playhead, views). Resolve with our own per-second frame tags (functional/contextual/social, section c) rather than picking a side. |
| Cuts: no explicit count (R8 says log cuts/s) | unspecified | **still no target; add two measured guards** | 50% of product ads cut by 2.5 s (n=452); the fastest-cut ads are not the best at holding past 6 s (43% vs 54%). Framing transitions: median 7, more transitions lowers sales and engagement (Pan, books). So: do not set a minimum cut rate; flag only extreme framing churn once our corpus gives a baseline. |
| No mid-word cuts, dead air > 0.4 s, repeat takes | craft rules | **no measured data** | Nobody measured these against sales. Keep as craft, not performance. |
| Caption readability: <= ~3 words lit at once | SAID | **no measured data; one conflicting guideline** | TikTok recommends "5-10 words per second" of text (VERIFIED, advice). Different thing (all text vs words lit), but unresolved. No study of caption chunk size or style vs sales. |
| Safe zones (right edge, bottom ~20%, top ~8%) | SAID + MIT repo | **no measured data** | TikTok says to respect its UI safe space (VERIFIED) but the fetched docs give no pixel boxes. |
| Real product in motion; >= 3 s dynamic footage; no slideshow | `fake-product`, `static` | **keep** | Slideshow: 0.8x (0.78-0.89) and 6% of top product ads. Filmed live action carries 89.5% of sales; borrowed/stock opening 0.76x; AI avatar groups too small to read. Matches policy rows. |
| No music baked in, CML only | policy | **no change; policy not performance** | Trending sounds sold below market (0.80x, n large), consistent with no-music default. Not causal. |
| AI disclosure flag | policy | **keep** | "No visible AI" odds ratio 1.7 in MediaLabs' model (association). |
| Originality: variants differ in hook text, spoken hook and angle; footage overlap > 60% | deliberate conservative choice | **no measured data** | Policy, not performance. Shelf life supports the volume idea: median top-video age is 11 days and under-2-week videos earn 56% of revenue (n=14,200), so fresh variants matter. |
| Hook archetypes: rotate, do not rank (R3) | rotate, SAID | **change: seed priors from measured sales per view, still rotate** | price/deal 1.53x, bold claim 1.28x, question 1.27x, urgency angle 1.35x, value angle 1.26x; curiosity-only angle 0.71x; demo-first hook 0.89x; borrowed clips 0.76x. Wide intervals for small groups (n=45 gives roughly -18%/+22%; n=193 about +-11%). Treat as test order, not rules. |
| Hit rate "2-3%" (R28, SAID by a guest) | SAID | **no measured data** | Hubfluence: top 10% of selling videos = 54.3% of GMV, 51.3% sold under 10 units. Zero-sale videos are excluded, so a hit rate cannot be computed. |

---

## (c) CORPUS PROTOCOL (legal collection + the metrics schema)

### What the rules say (so the protocol is built around them)

| fact | label | source |
|---|---|---|
| TikTok US Terms forbid you to "scrape, crawl, export or otherwise extract any data or content in any form, for any purpose, from the Platform using any automated system or software, including automated 'bots,' except as approved in writing". | VERIFIED (read in the page source, page JSON publishedAt 2026-07-21) | https://www.tiktok.com/legal/page/us/terms-of-service/en |
| TikTok content is licensed for "personal, non-commercial use"; it "may not be downloaded, copied, reproduced, distributed ... or otherwise exploited for any purpose whatsoever without our ... prior written consent". | VERIFIED (global/ROW terms, fetch-tool extraction) | https://www.tiktok.com/legal/page/row/terms-of-service/en |
| TikTok states unauthorized scraping violates its Terms and uses CAPTCHAs and other measures against it. | VERIFIED | https://tiktok.com/privacy/blog/how-we-combat-scraping/en (2024-10-25) |
| The official TikTok Research API is for researchers who work on a not-for-profit basis (US and Europe) and are independent of commercial interests. She does not qualify. | UNVERIFIED (search snippets from developers.tiktok.com and tiktok.com/transparency; I did not open the full eligibility page) | https://developers.tiktok.com/products/research-api |
| Creative Center Top Ads is free to browse; signed-out visitors see a limited list (one third-party says five ads; Cut Marketing read the first page of up to 20 per list). | UNVERIFIED for the exact signed-out number | https://admapix.com/blog/ad-intelligence/tiktok-creative-center-tutorial ; Cut Marketing method section |
| Kalodata and FastMoss offer a 7-day free trial and plan-limited exports (FastMoss's own comparison page lists Basic 10 / Pro 100 / Ultimate 600 exports a month at up to 50 / 300 / 500 records each). I have not read either tool's terms. | SAID (vendor comparison pages, competitor bias) | https://fastmoss.com/blog/kalodata-pricing |

**Decision for the creator, stated plainly (not legal advice).** Saving other people's TikTok videos to her disk is the one gray step. The Terms license her to view for personal non-commercial use and say content may not be downloaded or copied. The protocol therefore has three tiers, safest first. Use tier 1 and 2 first; tier 3 only if she decides she accepts the risk, and then in measure-then-delete form.

**Tier 1: zero TikTok content downloaded (do this now).**
1. Ingest published, labelled datasets as reference. Cut Marketing publishes a per-ad CSV (705 rows, ad IDs, industry, length, labels; no videos): https://cutmarketing.app/samples/research/tiktok-top-ads-2026.csv. I did **not** download it (no instruction to). License terms: UNVERIFIED. Use it to sanity-check our labeler's distributions (for example: do we also find ~76% product-by-1s?). These are paid ads, not affiliate videos, so use it as a check only.
2. Cite, do not copy, the MediaLabs / Hubfluence tables in section (a) as priors.

**Tier 2: her own content (cleanest, and the real goal: R27 learning loop).**
1. Her own posted videos: download from her own account (TikTok's own "save video" on her own posts, or from her original camera files).
2. Seller Center per-video export (GMV, units, views) matched by video ID into the links CSV.
3. Videos brands or creators sent her as briefs with the right to use them.
4. Our pipeline measures these like any other file, and her results become the corpus that actually answers "what sells for her".

**Tier 3: category winners (her decision; measure-then-delete).**
1. She picks the category and 4 price bands, and opens Kalodata or FastMoss on a free trial (Kalodata: 7 days no card, FastMoss: 7 days; SAID). She reads their terms for personal use of the exports.
2. By hand, with her own login, she filters to the last 30 days, US, her category, sorted by estimated GMV (or sales per view if shown). She records **about 50-100 videos** into `corpus/links.csv`: one row each, with the tool's numbers copied or exported (views, estimated GMV, units, creator followers, post date, paid flag if shown).
3. Optional, for the files: she saves each video using TikTok's own save-to-device button where the creator allows it (UNVERIFIED how many allow it) into `corpus/raw/`, named `<video_id>.mp4`. No bots, no scripts, no headless browser, no scraping tool anywhere, and none of our code ever contacts tiktok.com.
4. Our local pipeline reads `raw/` and `links.csv`, writes one metrics row per video to `corpus/metrics.csv`, then deletes the video file (`--delete-after`). We keep the URL and the derived numbers only. Derived facts such as cut count or length are not the video's expression (INFERRED; a lawyer should confirm if this ever becomes a product). Never redistribute the videos or publish per-video rows tied to a creator's name.
5. Report distributions (median, quartiles), not per-video rankings. Rank only inside her own account.

**What sample size can and cannot answer (M3-derived).** MediaLabs' 90% ranges show how wide intervals get: n=1,560 gives about +-4% on sales per view, n=478 about +-6.5%, n=193 about +-11%, n=45 about -18%/+22%. A corpus of 50-100 videos split by two or more features therefore cannot detect the 5-8% differences in the first-second tables. It **can** give honest descriptive norms (median length, median cuts/s, % product by 1 s, % with captions burned) and detect big effects, and it can compare against the published priors. The ranking of what sells for her comes from her own account over time (Tier 2), not from this corpus.

### Exact metrics schema, one row per video (`corpus/metrics.csv`)

| group | field | how it is measured | what our analyzer does today |
|---|---|---|---|
| id | video_id, url, source_tool (`kalodata`/`fastmoss`/`own`/`dataset`), capture_date, category, price_band | typed by the human from the tool | n/a |
| outcome (typed from the tool or Seller Center) | views, est_gmv, est_units, followers, post_date, paid_flag, gmv_per_1k_views, **sales_per_view_vs_category_median** | arithmetic. Use empirical-Bayes shrinkage and 90% intervals like MediaLabs for any group comparison | n/a |
| file facts | duration_s, width, height, fps | ffprobe | already in the clip log (`master`) |
| **auto: cuts** | cuts_total, cuts_per_s, first_cut_s, cuts_in_first_3s, median_shot_len_s | ffmpeg scene detection | `scene_cuts()` in `tools/pipeline/analyze.py` (scdet threshold 10). Note: it keeps only the top 100 by score and records `scene_cuts_total`. Calibrate the threshold on a few clips by hand first (UNVERIFIED accuracy). |
| **auto: speech** | words_total, speech_rate_wpm (words / speech seconds), words_in_first_3s, time_to_first_word_s, speech_ratio, head_silence_s, mean_pause_s | transcript word times (Parakeet or whisper.cpp) + silence detection | words, phrases, silences, `speech_ratio` already exist. wpm, words_in_first_3s, time_to_first_word are one-line derivations from `transcript.words`. |
| **auto: audio** | integrated_lufs, true_peak_db, noise_floor_db, music_present (needs a classifier; leave blank in v1) | ebur128 | `audio` block already exists. |
| **auto but NOT in analyze.py today: on-screen text** | time_to_first_text_s, text_in_first_1s (bool), text_chars_first_3s, caption_words_per_s, caption_lit_words_max | OCR on frames at 4 fps (Apple Vision, tesseract or similar; no LLM needed for presence and timing) | **not implemented.** My earlier assumption that captions can be timed from the file alone is wrong: the audio gives words, only OCR or vision gives what is printed on screen. |
| **vision pass (per video, 1 frame/s, Haiku or Sonnet with a written rubric)** | frame_type per second in {functional = product only, contextual = person+product, social = person only, other} (Pan et al.); product_first_visible_s; face_in_first_1s; face_share_of_frames; opening_first_frame in {face, hands_body, product, scene, text_card} (Cut Marketing categories); creator_on_camera; hands_only_longest_stretch_s | image labelling | **not implemented.** `labels` has stub fields (`kind`, `product_visible`, `face_box`). Extend those. Spot-check 10% by hand, as Cut Marketing and Pan et al. did. |
| vision/audio-read labels (one per video) | hook_type in {price_deal, bold_claim, question, demo_first, unboxing, review, story, other}; angle in {urgency, value, curiosity, other}; format in {demo, voiceover_broll, unboxing, review, slideshow, talking_head, other}; production in {filmed, borrowed_clip, ai_visible}; cta_type in {cart_prompt, comment_prompt, none}; cta_time_pct (position in the video, 0-100); offer_named_s | classify from the transcript + frames | **not implemented.** These are exactly MediaLabs' categories, so our numbers can be laid next to theirs. |

Quality rule for every labelled field: write the label, the model that wrote it, and a `checked_by_human` flag. Per `DRIFT_GUARD.md`, the model that labels a video does not judge the result.

---

## (d) SPARK LOG

Sparks are logged with real sources. **The judge column is me** (budget was one agent), which breaks the repo's "separate judge" rule. A separate judge pass is still owed (see GAPS).

| # | spark | source | why it pulls | gate (self-judged) |
|---|---|---|---|---|
| 1 | "Engagement is not sales." The most engaging regions of influencer videos are faces. Sales track whether the **product sits in the engaging regions**, not whether engagement is high | https://pubsonline.informs.org/doi/10.1287/mksc.2021.0107 | explains why face-first videos and product-first videos both "win". Gives a metric we can approximate: share of face frames that also contain the product | FIRE: add `face_with_product_share` to the vision pass |
| 2 | Three frame types per second (product-only, person+product, person-only) and the **number of transitions** between them. Person-only is good for engagement, bad for sales | https://www.mdpi.com/0718-1876/21/7/200 | cheap to label (1 fps), and it turns the rubric's vague "hands-only stretch" into a measurable thing | FIRE (but books on Douyin, so verify on our corpus) |
| 3 | MediaLabs' scoring method: sales per view relative to market, shrunk toward the average (empirical Bayes), with 90% intervals, and they refuse to read ranges that include 1 | https://medialabs-co.com/research/the-first-second | stops us from ranking 100 videos on noise. Copy the method, not the vendor's data | FIRE |
| 4 | Conflict: Playhead's 19 viral videos mostly open "straight into the demo" and 11 of 18 show no face, while MediaLabs finds demo-first hooks at 0.89x sales per view and face-first at 1.05x. One counts views, the other sales per view | https://tryplayhead.com/blog/tiktok-shop-hooks vs https://medialabs-co.com/blog/tiktok-shop-statistics | a "viral" sample teaches the wrong lesson for a seller. Never calibrate the rubric on views-only teardowns | FIRE as a rule: sales or GMV must be in the row |
| 5 | Same video metrics, different winners: ad-boosted and organic selling videos earn the same GMV per 1,000 views (about $130), so conversion is set by the creative and creator, and spend only scales it | https://hubfluence.io/blog/tiktok-shop-benchmarks | supports "make many variants, find what converts organically, then boost" and the clean-master rule | INTERESTING |
| 6 | Shelf life: the typical selling top video is 11 days old, and videos under 2 weeks earn 56% of revenue | https://medialabs-co.com/blog/tiktok-shop-statistics | argues for a weekly variant cadence over polishing one video | FIRE for pipeline planning |
| 7 | The "phantom" CTA-card stat from Lane A traces to a named TikTok source ("Top-Performing BLS Creative Analysis 2020", +45% recall, +19% likeability) but the study is not public | https://ads.tiktok.com/business/en-US/blog/creative-best-practices-top-performing-ads | corrects Lane A: SAID by TikTok, not invented, and still not usable as evidence of sales | INTERESTING (correction) |
| 8 | Cut Marketing publishes its per-ad label CSV (ad IDs + labels). Rare. | https://cutmarketing.app/samples/research/tiktok-top-ads-2026.csv (not downloaded) | a free check on our own labeler | INTERESTING |
| 9 | The Creative Center landing page shows only likes, "Top X% CTR" and budget per ad, nothing per second | https://ads.tiktok.com/business/creativecenter/insight/creativeinsight/pad/en | closes the "per-second CTR" path for the public view: it does not exist there | DEAD for per-second data (logged-in view UNVERIFIED) |
| 10 | Mintec's "24,000 ads" retention curves and CTR-by-length claims | https://mintec.co/blog/tiktok-ad-creative-data-2026 | would be ideal if real, but no method and the second-by-second curves are not public | DEAD (do not cite) |
| 11 | TikTok Research API | https://developers.tiktok.com/products/research-api | official data pipe, but not-for-profit researchers only | DEAD for us |
| 12 | Channel split disagrees by source: MediaLabs says video carried 64.9% of US Shop revenue (Sept 2026, top sellers); Momentum Works (quoted by Hubfluence) says Shop tab 51.4% vs video 40.4% (H1 2026) | https://medialabs-co.com/blog/tiktok-shop-statistics ; https://hubfluence.io/blog/tiktok-shop-benchmarks | per-video GMV probably understates a video's full effect, because some buyers convert later via the shop tab or search | INTERESTING caveat |
| 13 | TikTok's own text guidance (5-10 words per second) vs the rubric's "<= ~3 words lit" | https://ads.tiktok.com/resources/help/article/creative-best-practices?lang=en | an unmeasured conflict at the heart of "does it look like a real creator made it" | INTERESTING: test with our own caption-density metric |

---

## (e) GAPS (stated as gaps)

1. **Our own corpus does not exist.** No video was measured by our pipeline. Judge question #1 stays "no, not yet" until Tier 2 data exists, and Tier 3 data if she chooses it.
2. **No measured data found for**: cut rate vs sales, caption style or chunk size vs sales, speech rate vs sales, loudness vs sales, music vs no music, per-format length, time-to-payload beyond "first second", on-screen text style. MediaLabs says it records "length, pacing" but I did not find a published length or pacing result: I only filtered 74 research-page names by keyword and read 5 of them in part, so a relevant paper may exist unread.
3. **Nothing causal.** Every sales-linked number is an association among top sellers. The vendors say so themselves.
4. **Seller bias everywhere in section A3.** MediaLabs (agency), Hubfluence (creator software), Cut Marketing (ad tool), Playhead (video analysis), TokConnect (data). Their sales and view numbers are estimates merged from commercial trackers, not TikTok figures. Two of them disagree in places (spark 4, 12).
5. **The Yang et al. and Pan et al. effect sizes** were not extracted (the page text strips the coefficients). Direction and sample size only. Both are China/Douyin, and one is books.
6. **Guo et al. (ACM TMIS 2024)** on viewing duration of e-commerce short videos: two fetches were blocked, nothing taken from it.
7. **Logged-in Creative Center views** (keyframe or per-second analysis for advertisers) were not inspected. I could not log in.
8. **Legal items not read**: Kalodata and FastMoss terms of service; TikTok Research API eligibility page in full; whether TikTok's save-to-device button is enabled on typical category-winner videos; license of the Cut Marketing CSV. None of this is legal advice.
9. **TikTok Shop Academy / Seller University measured guidance** (priority 1 asked for it): I did not open it this pass. JUDGE-M1 already read parts via a summarizer. Nothing measured came from it.
10. **Separate judge pass is owed.** I judged my own sparks because the budget was one agent. Run a separate checker over this file's M3 rows (re-open 5 of the primary pages and compare).
11. **Not downloaded, on purpose:** the Cut Marketing CSV and any TikTok video. No file was fetched to disk apart from the research tool's own cache.
12. **Possible rubric rows I recommend editing** (not edited, per the brief: output only this file): `spec-length`, `slow-hook`, `thin-hook`. Edit `RUBRIC.md` only after the creator reads section (b).
