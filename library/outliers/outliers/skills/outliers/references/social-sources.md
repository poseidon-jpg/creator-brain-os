# Where TikTok, Instagram, X and LinkedIn posts come from

Prices move, so re-check the pages in the Sources list before relying on a number. TikTok and Instagram were checked 2026-10-01, X and LinkedIn 2026-10-09.
Labels: **[DOC]** = the vendor's own docs or pricing page, opened that day. **[TESTED]** = run for real. **[SECONDARY]** = a search result or someone else's article, not the vendor.

## Contents
- The question
- TikTok and Instagram
- X
- LinkedIn
- What was and was not checked live
- Sources

## The question

For a public account, give me its recent posts with a count and a post date. Then `scan-social.mjs` turns that into a multiplier (the count divided by the median count of the account's earlier posts). The count is views everywhere except LinkedIn, which shows no views publicly, so there it is engagement: reactions + comments + reposts. Nothing here uses a login to your own accounts, on purpose: scraping with your own X or LinkedIn session can get that account flagged.

All costs below assume 10 accounts a platform and 30 posts each (300 posts a scan).

## TikTok and Instagram

| Source | Views + date | Cost per 1,000 posts | Reliability | Setup | Verdict |
|---|---|---|---|---|---|
| **ScrapeCreators** | Yes both [DOC] | about $0.16 Instagram, $0.19 TikTok (1 credit a request, $47 buys 25,000 credits) | One small vendor. Instagram play counts "can sometimes be inaccurate" for reels also posted to Facebook [DOC] | One key, 100 free credits, no card | **First** |
| **Apify** (two Actors) | Yes both [DOC] | Free plan $2.60 Instagram, $3.70 TikTok; Starter $2.30 / $3.00 | Instagram Actor is Apify's own; TikTok Actor is third party, both widely used | One token, $5 free a month, no card | **Second** |
| **yt-dlp** (TikTok only) | Yes [TESTED] | $0 | Worked on 24 of 49 handles tried; TikTok can block it any day. Instagram: broken [TESTED] | Install yt-dlp | Free TikTok source, tried last |
| Instagram Graph API | Not confirmed for other accounts' reels [DOC] | $0 | Official | A Meta developer app and your own professional account | Not for members |
| TikTok Research API | Yes [DOC] | $0 | Official | Academic and non-profit only [DOC] | Not allowed for creators |
| Instaloader | Instagram only | $0 | Rate limited without a login [DOC] | Needs your login, which risks the account | Not used |

Why ScrapeCreators first: a 20-peer TikTok plus Instagram scan is about $0.13 there against $1.89 on Apify's free plan. Apify stays second because it is a large, long-standing platform and one scraper breaking then does not stop the scan. The same `SCRAPECREATORS_API_KEY` also powers the last30days research tool. The "from $1.50" headline prices on Apify pages are the $999-a-month Business plan; a free account pays the Free row.

## X

| Source | Views + date | Cost a scan | Reliability and risk | Setup | Verdict |
|---|---|---|---|---|---|
| **FxTwitter API** | Yes: the latest 20 posts a call with `views`, plus a cursor [TESTED] | **$0** | A free public API run by the volunteers behind the fxtwitter.com link embeds. No login, no key. It can slow down or stop at any time, so it is paced and tried last | Nothing | **Free source, works today** |
| **Apify X Actor** (kaitoeasyapi tweet scraper) | `viewCount` and `createdAt` [DOC] | about $0.08 (Free plan $0.25 per 1,000; $0.18 on higher plans) [DOC] | Third party, 6,200 users in 30 days. "free users are restricted in the number of tweets they can scrape" [DOC]; at least 20 posts per account asked | One Apify token | **First when a token is set** |
| **X API** (X's own, pay per use) | `public_metrics.impression_count` | about $1.60 ($0.005 a post read, plus an account lookup each) [SECONDARY: several 2026 guides agree] | Official, so no terms risk. Prepaid credits; calls stop when they run out | An X developer account, credits bought in the Developer Console, a bearer token | **Second: the clean paid route** |
| Apify Tweet Scraper V2 (apidojo) | Yes [DOC] | $0.40 per 1,000 | Free plan: 5 runs a month, 10 posts a run; each query must return 50 or more posts [DOC] | Apify token | Not built: the Free plan can't scan 10 accounts |
| ScrapeCreators | User posts endpoint has `views.count` [DOC] | 1 credit an account | "Twitter publicly only returns 100 of the users most popular tweets" [DOC], so there is no normal to measure against; its search is Google-indexed posts | One key | Not built for X |
| X embed timeline (syndication.twitter.com) | Was used by embeds | $0 | Answered HTTP 429 (blocked) on the first call [TESTED] | Nothing | Not usable |
| Your own login (cookie tools) | Yes | $0 | Puts your own account at risk | Your session | Never |

## LinkedIn

LinkedIn shows reactions, comments and reposts on public posts, but no views. The scan measures engagement (the sum of the three) against the account's median engagement, with its own floors: 100 or more engagement, a baseline of 20 or more, and no follower ratio.

| Source | Engagement + date | Cost a scan | Reliability and risk | Setup | Verdict |
|---|---|---|---|---|---|
| **Apify LinkedIn Profile Posts** (harvestapi) | `engagement.likes`, `.comments`, `.shares`, `postedAt` [DOC] | about $0.60 ($2 per 1,000 posts on Free and Starter, $1.50 on higher plans, plus $0.00005 a run) [DOC] | Third party, 10,500 users in 30 days, no cookies or account needed [DOC]. Reactions and comments scraping stay off, each is a separate charge | One Apify token; the free $5 a month covers about 8 scans | **First** |
| **ScrapeCreators** | The profile call lists recent post links; one call per post gives `likeCount` and `commentCount`, no reposts [DOC] | about $0.58 (1 credit for the profile, 1 per post) | Only the posts the public profile lists. Engagement here leaves out reposts, so mixing the two sources on one account blurs its normal | One key, 100 free credits | **Second** |
| LinkedIn's own APIs | Only pages and members you manage | $0 | Official | Partner approval | Cannot read other people's posts |
| Your own login (cookie tools) | Yes | $0 | LinkedIn restricts accounts that scrape | Your session | Never |

## What was and was not checked live

- **Live and working:** yt-dlp on TikTok (2026-10-01, 3 accounts, then 2 more in the member test); FxTwitter on X (2026-10-09, 10 accounts, the top post 127x its account's normal, $0).
- **Synthetic only:** ScrapeCreators, Apify and the X API on every platform. Field names come from each vendor's docs and published samples. `selftest-social.mjs` checks every source on every platform from saved responses (70 checks, no key, no spend). The first real scan on a new key should use 2 accounts and have its table read by a person.
- **No key on this machine yet** for ScrapeCreators, Apify or the X API, so Instagram and LinkedIn return nothing until one is set.

## Sources

- ScrapeCreators docs: docs.scrapecreators.com (Instagram user posts and profile, TikTok profile videos, Twitter user tweets and search, LinkedIn profile, company posts and post; 1 credit a request). Pricing: scrapecreators.com/blog/pay-as-you-go-scraping.
- Apify: apify.com/pricing (plans and tiers); each Actor's public record at api.apify.com/v2/acts/ apify~instagram-reel-scraper, clockworks~tiktok-scraper, kaitoeasyapi~twitter-x-data-tweet-scraper-pay-per-result-cheapest, apidojo~tweet-scraper, harvestapi~linkedin-profile-posts (prices by tier, user counts); each Actor's page for inputs and limits; docs.apify.com/api/v2/act-runs-post (`maxTotalChargeUsd`, `usageTotalUsd`).
- X API: docs.x.com (users by username, user posts timeline, rate limits); pay-per-use rates from 2026 guides (bundle.social, opentweet.io).
- FxTwitter: api.fxtwitter.com, profile and statuses endpoints, run 2026-10-09.
- Instagram: developers.facebook.com business_discovery reference. TikTok: developers.tiktok.com research-api FAQ. Instaloader: instaloader.github.io/troubleshooting.html.
- yt-dlp: run on 2026-10-01, version 2026.07.04.
