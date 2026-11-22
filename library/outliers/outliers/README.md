# Outliers

Find the posts that beat their own account's normal. An outlier doesn't need millions: 33K views on a channel that usually gets 4K is about 8x, and that tells you the topic worked. Outliers works out that score for you on YouTube (long videos and Shorts), TikTok, Instagram, X and LinkedIn, ranks the hits, and opens them on a results page in your browser: search, filter, add the best ideas to a cart and copy them back to your agent, which learns your taste from them.

## What you need

| | Cost | Setup |
|---|---|---|
| An agent that can run commands on your computer and read a skill folder | - | If your agent has no skills folder, keep this folder anywhere and tell your agent to read `SKILL.md` in it. A chat-only window that can't run commands won't work. |
| Node.js 22.13 or newer | free | nodejs.org. Nothing to `npm install`: the scripts use Node's built-in SQLite. |
| YouTube, long videos and Shorts | free | One YouTube Data API key (steps below). 100 keyword searches a day. |
| TikTok | free | yt-dlp, installed once. TikTok can block it on some days. |
| X | free | Nothing. It reads public posts through FxTwitter, a free public API that needs no account. It can slow down or stop on some days; an Apify token or X's own API then takes over (paid, below). |
| Instagram | paid | No free source exists. An Apify token ($5 of free usage a month, no card) or a ScrapeCreators key (100 free credits, then about $47 for 25,000 credits that never expire). |
| LinkedIn | paid | No free source exists. An Apify token (about $0.60 to scan 10 accounts) or a ScrapeCreators key. LinkedIn shows no views, so posts are measured by engagement (reactions + comments + reposts) against that account's normal. |

Being straight about the paid platforms: Instagram, LinkedIn and the paid X routes pass a synthetic test, but they have not yet been run against a live key. Scan 2 accounts first and check the table makes sense. YouTube, Shorts, TikTok and free X have been run live.

Never connect your own X or LinkedIn login to any scraping tool: the platforms can flag the account. Outliers never asks for it.

## What's inside

```
skills/outliers/
├── SKILL.md                 # how your agent sets it up and runs it
├── env.example              # your keys go here (copy it to .env)
├── data/
│   └── peers.example.json   # the accounts to watch (copy it to peers.json)
├── references/
│   └── social-sources.md    # every way to get TikTok, Instagram, X and LinkedIn data, with prices and risks
└── scripts/
    ├── scan.mjs             # YouTube: keyword search plus your peer channels, Shorts and long videos
    ├── scan-social.mjs      # TikTok, Instagram, X and LinkedIn: your peer accounts
    ├── top.mjs              # best outliers across platforms
    ├── keywords.json        # your niche: keyword sets, niche words, channels to skip
    ├── selftest-social.mjs  # a no-key, no-cost test
    ├── fill.mjs, taste.mjs  # write the results page; save what you liked
    ├── assets/              # the results page and its fonts (Outfit and Doto, SIL Open Font License)
    └── ...                  # the database and source code the scans use
```

Your database (`data/outliers.db`), idea notes (`data/ideas.json`), results page (`output/outliers.html`) and taste file (`taste.md`) are made inside the skill folder as you use it. Nothing leaves your computer except the calls to YouTube and the platforms you scan. The page carries its own fonts, so it works offline.

## Install

1. Copy `skills/outliers/` into your agent's skills folder.
2. Check Node: `node --version` should say v22.13 or higher.
3. In the skill folder, copy `env.example` to a new file named `.env`. Your keys go there, never into a chat.
4. **YouTube key (free).** Go to console.cloud.google.com, create a project, search for "YouTube Data API v3" and turn it on, then go to Credentials > Create credentials > API key. Paste it after `YOUTUBE_API_KEY=` in `.env`. It is read-only and needs no sign-in.
5. **TikTok (free, optional).** Install yt-dlp: `pip install yt-dlp`, or see github.com/yt-dlp/yt-dlp for other ways.
6. **Instagram or LinkedIn (paid, optional).** Paste an `APIFY_API_TOKEN` (apify.com) or a `SCRAPECREATORS_API_KEY` (scrapecreators.com) into `.env`.
7. Ask your agent to run `/outliers`. On the first run it asks for your niche and your channel name, and helps you list your peers: about 10 accounts a platform, creators or businesses in your niche that you want to learn from. You pick them; it can suggest.
8. Check it works with no key and no spend: `node scripts/selftest-social.mjs` from the skill folder.

## Use it

Ask your agent to "research the outliers in my niche", or "/outliers". It scans YouTube, works out each video's multiplier against its own channel's normal, gives you the top 5 in chat, and opens the full results page (`output/outliers.html`) in your browser.

On the page:

- **Find:** search (press `/`), filter by platform, account, format, how far a post beat its normal, and your taste. Sort by multiplier, newest, views or views an hour.
- **Read:** open a card for the thumbnail, the multiplier spelled out (views ÷ the account's normal), why it worked and your version of it. Expand all opens every card.
- **Pick:** press Add on the ideas you like. In the cart, drag them into order and write a note on each, then press **Copy for my agent** and paste it back. Download .md saves the list as a file.

Ask for "outlier Shorts" to scan YouTube Shorts, each measured against the channel's other Shorts. Add "TikTok", "Instagram", "X" or "LinkedIn" to the ask to scan your peers there too. A paid scan estimates its cost first and refuses to start if it would go over $1 (you can change that).

Don't want the page to open by itself? Set `OPEN_PAGE = false` in `scripts/paths.mjs`. The page is still written.

## Teach it your taste

When you paste your cart back, your agent saves what you liked (topics, formats, accounts, angles) to `taste.md` in the skill folder. The next run marks the outliers that fit with a "Your taste" tag and writes "Your version" in the formats you pick. Open `taste.md` any time to read or edit it.

## Tips

- **Too few results?** Go to a bigger niche or a broader topic. Or cast a wider net: run /latest over 14 or 28 days, or add more peer accounts to /outliers.
- **Be creative with topics,** not just your industry or job. Go from broad to narrow: AI, then local AI. Claude in general, then Claude for 3D work in Blender.
- **Teach it your taste.** Add the ideas you like to the cart, press Copy for my agent and paste it back to your agent. It saves what you liked to the skill's taste file and uses it to rank and shape your next run.

## Good to know

- **The multiplier is not an official number.** It is views (engagement on LinkedIn) divided by the median of that account's earlier posts of the same kind (Shorts against Shorts), worked out from public data. Say so if you show it publicly.
- **It gets sharper over time.** The database grows every scan, so baselines get better and repeat winners start pointing at formats, not flukes.
- **Quota-friendly.** A default YouTube scan uses 10 of your 100 daily searches. Peer channels use no searches at all.

## License

CC BY 4.0. Use it, change it, share it, even commercially. Just give credit. Full text in `LICENSE`. The bundled Outfit and Doto fonts are under the SIL Open Font License; their license files sit beside them in `scripts/assets/fonts/`.
