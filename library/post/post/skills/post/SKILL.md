---
name: post
description: Schedules or publishes finished short videos to Instagram, YouTube Shorts, TikTok and Threads through Blotato, at the user's own posting times, to the user's own accounts only. Takes video files, a folder or a render request from a video editor, plus captions (writes them in the user's voice with /tone when they are missing), builds a schedule from the next free slots, shows a plan table and a dry run of exactly what goes to each app, and posts only after the user says go. Use when the user says "/post", "post these clips", "schedule these", "post one a day", "post this reel", "publish to Instagram and TikTok", "schedule my shorts", "what's scheduled", or pastes finished clips with a posting ask. Not for editing or rendering the video itself.
---

# Post

Finished videos go out to the user's channels at the user's chosen times. This skill only holds the user's preferences (posting times, accounts, channels) and the safe way to send them. Blotato does the posting. The principle: **show exactly what will go out, then send it only after the user says go**, because a public post is seen the moment it is live, even if you delete it a minute later.

<!-- YOUR SETTINGS: the user edits these, in one place. Leave a value empty and the skill asks for it the first time, then offers to save the answer here. -->
- Time zone: (empty, ask on first run, for example America/New_York or Europe/London)
- Posting times: 9:00 am, 1:00 pm, 5:00 pm
- Posts per day: 3 (uses the first times in the list above; 1 a day or 5 a day is fine, add times to match)
- Default channels for shorts: Instagram, YouTube Shorts, TikTok
- Accounts (Blotato account IDs; the skill only ever posts to IDs listed here):
  - Instagram:
  - YouTube:
  - TikTok:
  - Threads:
- Key file: ~/.secrets/blotato.env (one line, BLOTATO_API_KEY='...'; the user pastes the key in themselves)
- Voice skill: /tone
- Caption check app: RUBRIC Scripts, only if it is installed (otherwise none)
- YouTube privacy: (empty, ask on first YouTube post: public, unlisted or private)
- YouTube notify subscribers: (empty, ask on first YouTube post: yes or no)
- TikTok privacy: (empty, ask on first TikTok post)
- TikTok comments, duets, stitches: (empty, ask on first TikTok post: on or off for each)
- TikTok "AI-generated" label: (empty, ask on first TikTok post)
<!-- END YOUR SETTINGS -->

The times are only defaults. Pick times when you are awake, so you can fix or delete a mistake fast. TikTok tends to show a new post to people in your own country first, so post when they are awake too.

## Rules

1. **Nothing goes out before the user says go.** [A live post can be deleted, but people have already seen it.] Every run shows the plan table and the dry run first. "Go", "yes, post it" or "schedule it" for that exact plan is the approval. A changed plan needs a new go.
2. **Only the user's own accounts.** [A Blotato login can see other accounts, such as a client's or a test account.] Post only to the account IDs in YOUR SETTINGS. If an ID is missing, ask for it. Never pick one from the account list on your own.
3. **The key never appears anywhere.** [Anyone with the key can post as the user.] It lives only in the key file. Never ask the user to paste it into chat, never print it, never write it into this skill, a script or a log. Read it from the file at the moment you send a request.
4. **Ask, never guess, on any app choice you don't know.** [TikTok and YouTube settings change who sees the post, and a TikTok post can't be edited after it goes out.] Privacy, comments, duets, stitches, the AI label, YouTube privacy and notifications come from YOUR SETTINGS or from the user. Ask once, then offer to save the answer in YOUR SETTINGS.
5. **Scheduled is not live.** [A post can be queued and still fail at its time.] Only call a post live once Blotato says `published` and its link opens. Until then it is "scheduled".
6. **Plain words, no long dash character.** Use " - " or a comma.

## Workflow

1. **Check setup.** Read YOUR SETTINGS. If the key file is missing, the time zone is empty, or a channel the user wants has no account ID, walk them through `references/setup.md` and stop there until it's done. Then check the key works with `GET /users/me`. Done when the key works and every channel in this run has an account ID.
2. **Gather the videos.** The user may give:
   - video files or a folder of them, or
   - a render request copied from a video editor (for example the Render all ask from RUBRIC Editor). Run or wait for that render first, then use the finished files it reports.
   Check each file opens and note its length. Done when you have a list of finished files, in the order they should go out.
3. **Gather the captions.** Use the captions the user gives, matched to each video. If a caption is missing, write one in the user's voice with the voice skill from YOUR SETTINGS, from what the video says (its transcript if you have one). If there is no voice skill, write it plainly and say so. YouTube also needs a title (100 characters at most). Keep each caption inside each app's limit (see `references/blotato-api.md`). Done when every video has a caption, and a title for YouTube.
4. **Optional caption check in RUBRIC Scripts.** Only if the user has RUBRIC Scripts installed and asks for more control: load each clip and its caption there, so the user can read and edit every caption and turn each channel on or off per clip before anything is scheduled. If their version has no channel switches yet, list the channels per clip in the plan table instead and let them turn them on or off there. Done when the user says the captions and channels are right.
5. **Build the schedule.** Read the ask ("one per day for 7 days", "post these now", "3 a day from tomorrow"). With no clear ask, use Posts per day and Posting times from YOUR SETTINGS. Take the next free slots in the user's time zone: skip any time already past, and skip any time that already has a post scheduled for the same account (`GET /schedules`). Each clip goes to every chosen channel at the same time. Check each video fits each channel (length and size, see the reference). A video that doesn't fit a channel skips that channel, and the plan says why. Done when every clip has a time and a channel list.
6. **Show the plan and the dry run.** First the plan table:

   ```text
   #  When (your time)        Clip              Channels
   1  Tue 14 Oct, 9:00 am     clip-01.mp4       Instagram, YouTube Shorts, TikTok
   2  Wed 15 Oct, 9:00 am     clip-02.mp4       Instagram, YouTube Shorts, TikTok
   ```

   Then the dry run: for each post, the app, the account name and ID, the time, the file, the caption word for word, the title (YouTube) and every setting (privacy, comments and so on). Ask any open app choice now (rule 4). Then stop. Done when the user has seen it and says go, or asks for changes.
7. **Upload and send.** Only after go. Upload each local file once (`POST /media/uploads`, then PUT the file) and reuse its public URL for every channel. Send one `POST /posts` per channel per clip, with `scheduledTime` at the root of the request, never inside `post`. Wait for each answer and check its status (`GET /posts/{postSubmissionId}`). Done when every post reads `scheduled` (or `published` for a post sent now). If one reads `failed`, show its error message, fix that one post and resend only that one.
8. **Report.** A short table: clip, channel, time in the user's time zone, status. Then point the user to the **Calendar** tab in Blotato, where every scheduled post shows up, to inspect, move or delete one. Done when the table matches what Blotato returned.
9. **Confirm live, when asked or after the time passes.** For each post, check `GET /posts/{postSubmissionId}` reads `published`, then open its link (`publicUrl`, or `postUrl` from `GET /published-posts`). Only then call it live and give the link. Done when every post is either live with a link that opens, or flagged with its error.

## Resources

- [references/setup.md](references/setup.md) - first-time setup: the Blotato account, the API key in a private file, connecting each social account and saving its ID. Read it in step 1 when anything is missing.
- [references/blotato-api.md](references/blotato-api.md) - the Blotato calls this skill uses, the fields each app needs, video limits per app, and the mistakes that cost a failed post. Read it before step 5 and step 7.
