![/post](assets/banner.png)

# /post

Give your agent your finished short videos and it schedules them to Instagram, YouTube Shorts and TikTok (Threads too, if you want it) at your posting times, through Blotato. For example: "/post these clips one per day from today until 7 days from now across my usual channels".

It's a baseline you tweak for yourself. The skill only stores your preferences: when you like to post, which accounts are yours, and where each kind of video goes. It always shows you a plan and exactly what goes to each app before anything is scheduled, and it only posts after you say go.

## What's inside

```
skills/
└── post/
    ├── SKILL.md               # the /post skill: your settings, rules, the 9 steps
    └── references/
        ├── setup.md           # first-time setup: Blotato, your API key, your accounts
        └── blotato-api.md     # the Blotato calls, what each app needs, video limits
assets/banner.png
LICENSE                        # CC BY 4.0
```

## Set it up

About 15 minutes, once.

**For the agent doing the setup:** the user may be new to this. Explain each step in one plain sentence and check it worked before the next one.

1. **Copy the skill.** Copy `skills/post/` into your agent's skills folder. Keep the folder name `post`.
2. **Blotato account.** The user needs a Blotato account on a paid plan, because the free trial doesn't include the API. Sign up at https://blotato.com/?ref=robonuggets (RoboNuggets members get 30% off all plans). Walk them through `skills/post/references/setup.md`.
3. **API key.** The user copies their key from Blotato's Settings, then API, and pastes it into a private key file themselves (step 2 of `setup.md`). Never into chat, never into the skill.
4. **Connect accounts.** The user connects each social account once in Blotato (Accounts, then Connect account) and gives you each account ID. Save them in the YOUR SETTINGS block at the top of `SKILL.md`. These are the only accounts the skill will ever post to.
5. **Time zone and times.** Ask for the user's time zone and save it. The default times are 9:00 am, 1:00 pm and 5:00 pm in their time zone, 3 a day. Change them if they like.
6. **Try it.** Type `/post` with one finished video and say "just show me the plan". Nothing goes out until the user says go.

## Use it

- `/post these clips one per day from today until 7 days from now across my usual channels` - a week of posts, one a day
- `/post clip-01.mp4 now to Instagram and TikTok` - straight out, after the plan and your go
- `/post` then paste the Render all ask from your video editor - it waits for the render, then plans the posts
- `/post` with a folder - every finished video in it, in order, at your next free times
- `what's scheduled?` - lists what's queued, or check the **Calendar** tab in Blotato

No captions? It writes them in your voice with your /tone skill if you have one, and you check them in the dry run.

**More control:** if you have RUBRIC Scripts installed, ask your agent to load the clips there first. You read every caption, edit it, and turn channels on or off per clip before anything is scheduled.

## Make it yours

- **Your times.** Post when you're awake, so you can fix or delete a mistake fast. TikTok tends to show your posts to people in your own country first, so their waking hours matter too. 1 a day or 5 a day is fine: change Posting times and Posts per day in YOUR SETTINGS.
- **Your channels.** Change Default channels for shorts. Blotato also posts to Facebook, LinkedIn, X, Bluesky and Pinterest; ask your agent to add one.
- **Your app choices.** The first time you post to TikTok or YouTube, the skill asks about privacy, comments and the rest, then offers to save your answers so it never asks again.

Blotato also does DM automations (comment a word, get a DM). That isn't part of this skill.

## Credits

Skill by Jay E | RoboNuggets. Blotato API details from help.blotato.com.

## License

CC BY 4.0. Share and adapt it, even commercially, with credit. See `LICENSE`.
