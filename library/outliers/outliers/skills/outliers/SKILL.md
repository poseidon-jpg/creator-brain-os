---
name: outliers
description: Finds outlier posts in the user's niche on YouTube (long videos and Shorts), TikTok, Instagram, X and LinkedIn - posts beating their own account's normal by a multiplier, the outlier score tools like vidIQ show. YouTube runs on the free YouTube Data API, by keyword search and by peer channels the user picks; TikTok and X are free; Instagram and LinkedIn need a paid scraper key; LinkedIn shows no views, so it is measured by engagement. Everything lands in one local database that sharpens with every scan, shown on a results page that opens by default; it learns the user's taste from the picks they paste back. Use when the user says "/outliers", "outliers", "find outliers", "outlier score", "research the outliers in my niche", "outlier videos", "outlier shorts", "shorts outliers", "tiktok outliers", "instagram outliers", "x outliers", "linkedin outliers", "check my peers", pastes an idea cart that starts with "Idea cart:", or wants proven topics and formats before picking what to make next.
---

# Outliers

Finds posts that beat their own account's normal. An outlier does not need big numbers: 33K views on a channel that usually gets 4K is about 8x, a clear signal the topic worked, while 500K on a channel that usually gets 500K is just 1x. Raw view counts hide that; the multiplier shows it.

All paths below are relative to this skill folder. Run every command from here.

**Two numbers, both computed from public data.** They are not official platform metrics, so say so whenever they appear in public content.
- `multiplier` = views ÷ median views of that account's posts published **before** it, of the same kind: a YouTube Short against the channel's Shorts, a long video against its long videos, because the two earn views at very different rates. LinkedIn shows no view counts, so there it is engagement (reactions + comments + reposts) ÷ the account's median engagement; say "engagement" whenever a LinkedIn number appears.
- `vph` = views ÷ hours since publish.

## First run: set it up with the user

```text
Setup:
- [ ] 1 Node.js 22.13 or newer
- [ ] 2 YouTube key in .env
- [ ] 3 Niche written into scripts/keywords.json
- [ ] 4 Peers in data/peers.json (recommended)
- [ ] 5 Sources for the other platforms, if wanted
- [ ] 6 Self-test passes
```

1. **Node.** `node --version` must be 22.13 or newer, because the scripts use Node's built-in SQLite and need nothing else installed. If it is older, the user updates from nodejs.org.
2. **YouTube key.** If `.env` is missing or has no `YOUTUBE_API_KEY`, copy `env.example` to `.env` and walk the user through the free key (the steps are in `env.example` and the README). The user pastes the key into `.env` themselves, never into the chat. Done when a scan starts without a key error.
3. **Niche.** If `scripts/keywords.json` still has its `_niche_note` (it starts with `EXAMPLE`), ask the user what their niche is and what their channel is called, then write `_niche` (a few words; it titles the results page), `_own_channel` (so their own videos stay off the page), `sets.default` and `sets.shorts` (5 to 10 phrases their audience would type into YouTube) and `niche_terms` (specific words a relevant video's title or description would contain, matched as whole words), and delete `_niche_note`. Done when `_niche_note` is gone.
4. **Peers.** Copy `data/peers.example.json` to `data/peers.json` and ask the user for the accounts they want to learn from, about 10 a platform: creators or businesses in their niche, their size or a step ahead. The user picks them, because only they know who their audience also watches; you may suggest. Remove the placeholders for platforms they don't use.
5. **Other platforms.** TikTok needs yt-dlp (`yt-dlp --version`; if missing, `pip install yt-dlp`). X needs nothing. Instagram and LinkedIn need a paid key (below), so set one up only if the user wants them. Done when `node scripts/scan-social.mjs --platform <each one they want> --peers --dry-run` shows a source.
6. **Self-test:** `node scripts/selftest-social.mjs` passes with no key and no spend.

If a step fails, fix that step before moving on.

## Run it

```text
Outliers run:
- [ ] 1 Scan with --no-open. Done when it prints "This run" and the Page line.
- [ ] 2 Angles written for every hit that lacks one, taste fits marked
- [ ] 3 Page rebuilt with --report-only, which opens it
- [ ] 4 Reported in chat, short
```

1. **Scan** YouTube long videos by default; Shorts when the user asks for Shorts; the other platforms when the user names them or says "all platforms". Add `--no-open` to every scan in this step, because step 3 rebuilds the page and opens it once.

```bash
node scripts/scan.mjs --no-open                             # keyword set + YouTube peers, last 14 days
node scripts/scan.mjs --shorts --no-open                    # Shorts run: the "shorts" set + YouTube peers, Shorts only
node scripts/scan.mjs --channels @handle,@other --no-open   # just these channels, no searches
node scripts/scan.mjs --report-only --new-only              # zero quota, only what the user hasn't seen
node scripts/scan-social.mjs --platform all --peers --no-open     # TikTok, Instagram, X and LinkedIn peers
node scripts/scan-social.mjs --platform x --peers --no-open
node scripts/scan-social.mjs --platform all --peers --dry-run     # cost estimate only
```

   The window is 14 days unless the user names another, because fresh ideas are the ones they can still ride. Keyword search returns long videos unless the run is a Shorts run, because Shorts search results are full of #viral spam channels beating tiny normals by 100x. A Shorts run asks YouTube for short videos and holds the spam back two ways: a Short found by search needs a channel of 10,000 or more subscribers, and a title stacking two catch-all hashtags (#viral, #fyp and the like) is dropped. Peer channels return both kinds. A Short is a vertical or square video of 3 minutes or less, read from the same API call at no extra cost.
2. **Angles.** Read `taste.md` first when it exists. Give every hit on the page that lacks one an entry in `data/ideas.json`, keyed by the post id (a YouTube video id, or `<platform>:<id>` such as `x:123`). The angle says what the title promised and why it beat that account's normal; the idea says how the user would make it for their own audience, in the formats the taste file says they pick. A hit that matches the taste file also gets a `fit`: one line on why, shown on the page as a "Your taste" tag. Example: `{ "abc123": { "angle": "One narrow profession plus a live demo. Small audience, but nobody else serves it.", "idea": "Same format for your niche: one customer type per video, with a live demo.", "fit": "One customer type per video, the format you picked twice." } }`
3. **Rebuild** with `node scripts/scan.mjs --report-only`. It writes `output/outliers-results.json`, fills the results page `output/outliers.html` and opens it in the browser. To only write it, add `--no-open`; `OPEN_PAGE = false` in `scripts/paths.mjs` turns opening off for good.
4. **Report** short, because the page holds the detail: the top 5 as a table (multiplier, views or engagement, kind, account, title), the page path and how many hits fit the taste file. Leave out company, news, product-launch and off-niche channels the filters missed (a launch video, or a farming hack that says "AI" in its title, is not an idea to copy) and offer to add them to `exclude_channels`.

If a run returns too little or junk, adjust with "Why the filters exist" below and go back to step 1.

The results page holds every hit in the window, ranked by multiplier: a run summary (what was scanned, what wasn't and why, today's quota), search (press `/`), filters for platform, account, format, multiplier floor and taste fit, sort, and cards that open to the thumbnail, the multiplier spelled out as views ÷ the account's normal, the angle and Your version. Its idea cart lets the user add picks, reorder them, write a note on each, then press **Copy for my agent** (or Download .md). The cart lives in their browser and survives every rebuild. Both scanners rebuild the page. The fonts are inside the page, so it works offline.

For one list as data: `node scripts/top.mjs --platform all --per-platform 5` (a table) or add `--json`. YouTube multipliers run higher than the other platforms', so `--per-platform` keeps the list mixed. `all` leaves LinkedIn out, because its numbers are engagement, not views; name it to include it (`--platform x,linkedin`). `top.mjs` only reads the database.

## Peers

`data/peers.json` lists the accounts to watch, per platform.
- `youtube`: channel handles (`@name`) or channel ids. Every `scan.mjs` run reads them alongside the keyword search, at about 3 units a channel and no searches. Peer videos skip the language, niche, skip-list, podcast and subscriber filters, because the user picked them.
- `tiktok`, `instagram`, `x`: handles. `linkedin`: `in/name` for a person, `company/name` for a page (a full profile link works too). Read by `scan-social.mjs --peers`. Business accounts work as well as creators: a shop that rides trends shows up the same way.

A scan names any account with no post in 60 days: suggest dropping it.

## Quota (YouTube)

The free quota has two daily buckets and neither can be bought: 100 keyword searches (1 unit each) and 10,000 units for every other call. A default 10-keyword run uses 10 searches plus about 500 units the first time, then about 50, because every channel's uploads are cached for 7 days. `--searches` caps a run's searches (default 50) and `--budget` its other units (default 3000). If a cap runs out, the scan stops early and still reports what it has. If YouTube reports a quota error these numbers don't explain, check [the quota cost page](https://developers.google.com/youtube/v3/determine_quota_cost): the costs have changed before.

## TikTok, Instagram, X and LinkedIn

- **Free:** TikTok through yt-dlp, X through FxTwitter, a free public API that needs no account. Either can slow down or stop on some days; a paid key then takes over.
- **Paid, needed for Instagram and LinkedIn:** an `APIFY_API_TOKEN` (Apify, $5 of free usage a month, no card) covers all four platforms. A `SCRAPECREATORS_API_KEY` (100 free credits, then about $47 for 25,000) covers TikTok, Instagram and LinkedIn. An `X_BEARER_TOKEN` (X's own API, pay per use, about $0.005 a post) is the official route for X. About 10 accounts with 30 posts each: X $0 free or about $0.08 on Apify, LinkedIn about $0.60 on Apify.
- **Not yet run against a live key:** the Instagram and LinkedIn paths and both paid X routes have passed a synthetic test only, so read the first table (scan 2 accounts) before trusting it.
- **Never use the user's own X or LinkedIn login** for scanning: the account could get flagged.
- **Source order** is set per platform in the block at the top of `scripts/social.mjs`. Prices, risks and every option checked: [references/social-sources.md](references/social-sources.md).
- **Cost guard:** a paid scan estimates first and refuses to start if the worst case is over `--budget-usd` (default 1). Never raise the budget without the user's go. An account scanned in the last day is skipped, so a repeat run is free.
- **Guards:** 5 or more earlier posts, a baseline of 500 or more, 1,000 or more views, and at least a day old. LinkedIn uses engagement-sized floors (100 or more, against a baseline of 20 or more). Baselines use every post stored so far, so they sharpen with each scan.
- **What counts:** public accounts only. TikTok and Instagram count videos and reels; X and LinkedIn count the account's own posts, never replies or reposts. If a scan returns nothing for accounts that clearly post, say so rather than guessing.

## Why the filters exist

Raw multipliers are full of junk. Each default guard kills a specific failure. Peer accounts skip the ones marked *search only*.

| Guard | Default | Kills |
|---|---|---|
| `--format` / `--shorts` | long from search, all from peers | Shorts spam: tiny #viral channels whose Shorts beat a 300-view normal by 100x |
| Shorts from search | 10,000+ subscribers, under two catch-all hashtags | the same spam inside a Shorts run |
| `--lang` (search only) | `en` | videos in other languages. Pass `--lang any` to switch it off |
| `niche_terms` (search only) | whole words | general news that happens to match a keyword |
| `--min-baseline` | 500 | a channel with a 40-view median faking a 400x. A small niche can lower it with care |
| `--min-baseline-ratio` | 0.005 | brand accounts whose median sits near zero because they post product clips. Real creators land 2% to 50% |
| `--min-confidence` | `ok` | baselines built from fewer than 5 past posts |
| `--max-subs` (search only) | 3,000,000 | news-sized general channels |
| `exclude_channels` (search only) | list | anything that keeps showing up and never helps, plus official company channels: a launch clip is not an idea a creator can copy |
| podcasts (search only) | on | interviews and podcast clips, for the same reason |

If a run returns too little, loosen in this order: `--min-mult 1.5`, then `--min-confidence low`, then ask the user before widening `--days`. If it returns junk, tighten `--min-baseline-ratio` first, then add the channel to `exclude_channels`.

## Tuning the niche

`scripts/keywords.json` holds the keyword sets (`default` and `shorts`), niche terms and channels to skip, and is read fresh every run. When the user names a new lane ("do one for home workouts"), add a named set rather than passing `--keywords` each time.

## What to do with the results

Read the pattern, not the video: the angles are that read. The database compounds: after a few weeks, repeat winners across accounts point at a format rather than a fluke.

## Learn from my picks (the taste loop)

The page's **Copy for my agent** button copies the user's picks as plain text that starts with `Idea cart:` and asks for this step. When the user pastes it and a `From:` line names `/outliers`:

1. Send the whole pasted text to `node scripts/taste.mjs add -` on standard input, or save it to a file outside the skills folder and pass that path instead of `-`. [Agents often guard their own skills folder, so the script does every write there.] It adds this skill's picks to `taste.md` with their counts, then prints them and the current "What you like" list. Picks whose `From:` line names another skill stay for that skill.
2. Rewrite the "What you like" list: the topics, formats, accounts and angles the picks share, merged with what is already there, 8 lines at most, in plain words. A note the user wrote beats your guess. Send it, one line per item, to `node scripts/taste.mjs like -` the same way. When the list names a topic no keyword set covers, offer to add a set for it.
3. Tell the user in one line what you saved and that the next run's ideas and "Your taste" tags follow it. Then help with what they asked for, such as picking the next topic or drafting title options.

```bash
node scripts/taste.mjs add - <<'CART'
Idea cart: 2 picks, in my order.
(the rest of the pasted text)
CART
```

Done when `taste.md` holds the new picks and the rewritten list.

## Tips

The same three tips sit in a Tips panel on every results page.

- **Too few results?** Go to a bigger niche or a broader topic. Or cast a wider net: run /latest over 14 or 28 days, or add more peer accounts to /outliers.
- **Be creative with topics,** not just your industry or job. Go from broad to narrow: AI, then local AI. Claude in general, then Claude for 3D work in Blender.
- **Teach it your taste.** Add the ideas you like to the cart, press Copy for my agent and paste it back to your agent. It saves what you liked to the skill's taste file and uses it to rank and shape your next run.

## Files

| File | What it is |
|---|---|
| `scripts/scan.mjs` | the YouTube scanner: keywords, peer channels, Shorts vs long |
| `scripts/scan-social.mjs`, `scripts/social.mjs`, `scripts/social-db.mjs` | the TikTok, Instagram, X and LinkedIn scanner, its sources (one block of defaults to edit) and its tables |
| `scripts/top.mjs` | best outliers across platforms, a table or JSON |
| `scripts/board.mjs`, `scripts/fill.mjs` | pick the page's rows, write `output/outliers-results.json`, put the data and fonts into the page and open it |
| `scripts/assets/results.html`, `scripts/assets/fonts/` | the results page, and the Outfit and Doto fonts under the SIL Open Font License (`OFL-outfit.txt`, `OFL-doto.txt`) |
| `scripts/taste.mjs`, `taste.md` | the taste loop: the script does every write, `taste.md` (made on the first pasted cart) holds what the user likes |
| `scripts/keywords.json` | your niche: keyword sets, niche terms, your channel, channels to skip |
| `scripts/paths.mjs` | every file location, all inside this folder |
| `scripts/db.mjs`, `scripts/text.mjs`, `scripts/podcast.mjs`, `scripts/quiet.mjs` | the database, title clean-up, the podcast rule, a warning mute |
| `scripts/selftest-social.mjs`, `scripts/fixtures/` | the no-key test and its synthetic saved responses |
| `.env` (from `env.example`) | your keys |
| `data/peers.json` (from `peers.example.json`) | the accounts to watch |
| `data/outliers.db`, `data/ideas.json` | the database (made on the first scan) and the angle and idea per post |
| `output/outliers.html`, `output/outliers-results.json` | the results page and its data |

## Rules

- Keys live in `.env` only. Never ask the user to paste one into the chat, and never print one.
- Only `scan.mjs` and `scan-social.mjs` call outside services.
- The step 3 rebuild opens the results page by default; the step 1 scans pass `--no-open` so it opens once. Open nothing else unless the user asks.
- Cache is 7 days per channel. Force a refresh with `--refresh-days 0` only when a channel's recent uploads matter.
