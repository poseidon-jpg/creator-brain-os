# Blotato API, the parts /post uses

Checked against Blotato's own help pages (help.blotato.com, index at help.blotato.com/llms.txt). If a call fails in a way this file doesn't explain, read the matching page there first, because Blotato changes faster than this file.

## Contents

- Auth and base URL
- Accounts
- Uploading a video
- Posting and scheduling
- Fields each app needs
- Video limits per app
- Caption limits
- Checking and changing what's scheduled
- Rate limits and common mistakes

## Auth and base URL

- Base URL `https://backend.blotato.com/v2`. Every request sends the header `blotato-api-key: <key>` and `Content-Type: application/json`.
- Read the key from the key file at the moment you send the request. Never print it. In a POSIX shell, for example: `set -a; . ~/.secrets/blotato.env; set +a`, then `-H "blotato-api-key: $BLOTATO_API_KEY"`.
- Some keys end in `=`. Keep it. A 401 "invalid API key" is nearly always a dropped `=`.
- Check the key with `GET /users/me`.
- If your agent has Blotato's own MCP tools connected (names like `blotato_create_post`), you can use those instead. They map one to one onto the calls below.

## Accounts

| Call | Gives |
|---|---|
| `GET /users/me/accounts` | every connected account: `id` (use as `accountId`), `platform`, `username`, `fullname`. Filter with `?platform=instagram` |
| `GET /users/me/accounts/:accountId/subaccounts` | Facebook Pages, LinkedIn company Pages, and YouTube playlists (`id` goes in `playlistIds`) |

Only use the IDs saved in YOUR SETTINGS. The list can hold accounts that are not the user's.

## Uploading a video

A local file needs a public URL before it can be posted.

1. `POST /media/uploads` with `{"filename": "clip-01.mp4"}`. The answer has `presignedUrl` and `publicUrl`.
2. `PUT` the raw file to `presignedUrl` (for example `curl -X PUT -H "Content-Type: video/mp4" --upload-file clip-01.mp4 "<presignedUrl>"`). Raw bytes, not JSON, not a form.
3. Check the upload worked, then use `publicUrl` in `mediaUrls`. Upload once, reuse the same URL for every app.

Never share the `presignedUrl`. A video that already has a public download link can skip the upload.

## Posting and scheduling

`POST /posts`:

```jsonc
{
  "post": {
    "accountId": "<id from YOUR SETTINGS>",
    "content": { "text": "<caption>", "mediaUrls": ["<publicUrl>"], "platform": "instagram" },
    "target": { "targetType": "instagram" }
  },
  "scheduledTime": "2030-06-15T09:00:00-04:00"
}
```

- `content.platform` and `target.targetType` must be the same value.
- `scheduledTime` (ISO 8601 with a time zone offset) sits at the root, next to `post`. **Inside `post` it is ignored and the post goes live at once.** Leave it out to post now.
- Instead of `scheduledTime` you can send `useNextFreeSlot: true`, which uses the posting slots set up in Blotato's calendar. This skill normally picks the times itself from YOUR SETTINGS, so the dry run shows exact times. Never send both.
- A time in the past is not a schedule. Pick the next free slot instead.
- The answer is `{ "postSubmissionId": "...", "scheduledTime": "<UTC>" }`. Blotato works in UTC: convert it back to the user's time zone when you report it.

Check a post with `GET /posts/{postSubmissionId}` (wait at least 10 seconds between checks):

| `status` | Means |
|---|---|
| `in-progress` | still working. Also returned for an ID Blotato doesn't know, so keep the ID from the create answer |
| `scheduled` | queued for `scheduledTime`. Not live yet |
| `published` | done, with `publicUrl` when the app returned one |
| `failed` | stopped, see `errorMessage`. Fix the cause, then resend only that post |

## Fields each app needs

All go in `target`, next to `targetType`.

| App | Required | Useful optional |
|---|---|---|
| Instagram (`instagram`) | nothing else | `mediaType` ("reel" is the default for video, or "story"), `coverImageUrl` (reels, a picture uploaded first, 8 MB max), `shareToFeed`, `collaborators`, `altText` |
| YouTube (`youtube`) | `title`, `privacyStatus` ("public", "unlisted" or "private"), `shouldNotifySubscribers` (true or false) | `isMadeForKids`, `containsSyntheticMedia`, `playlistIds`. The description is `content.text` |
| TikTok (`tiktok`) | all seven: `privacyLevel`, `disabledComments`, `disabledDuet`, `disabledStitch`, `isBrandedContent`, `isYourBrand`, `isAiGenerated` | `videoCoverTimestamp` (milliseconds into the video for the cover frame), `isDraft` |
| Threads (`threads`) | nothing else | `replyControl` ("everyone", "accounts_you_follow" or "mentioned_only") |
| Facebook (`facebook`) | `pageId`, and `mediaType` "reel" for a video | `link` |

Blotato also posts to LinkedIn, X, Bluesky and Pinterest. Read their pages on help.blotato.com before adding one.

Example TikTok target, with the values the user chose (never these by default):

```jsonc
"target": { "targetType": "tiktok", "privacyLevel": "<the user's choice>", "disabledComments": false,
            "disabledDuet": false, "disabledStitch": false, "isBrandedContent": false,
            "isYourBrand": false, "isAiGenerated": false }
```

## Video limits per app

| App | Length | Size | Notes |
|---|---|---|---|
| Instagram reel | 3 s to 15 min | 300 MB | MP4 or MOV, 9:16 at 1080x1920 or 720x1280 |
| TikTok | up to 10 min | up to 1 GB, but 400 MB on Blotato's Starter plan | MP4 with H.264 is safest. Blotato does not convert TikTok files |
| YouTube Shorts | 3 min or less, and vertical | 400 MB on Starter, 1 GB on higher plans | a vertical video over 3 min posts as a normal video, not a Short |
| Threads | up to 60 s | 1 GB | one video per post |
| Facebook reel | 3 s and up | 512 MB | 9:16 |

A video that doesn't fit an app skips that app. Don't cut a shorter version unless the user asks.

## Caption limits

- Instagram: 2,200 characters.
- TikTok: 2,200 characters. Line breaks can come out as one block on TikTok, so write the TikTok caption as plain sentences.
- YouTube: title 100 characters, description 5,000.
- Threads: 500 characters.

## Checking and changing what's scheduled

- `GET /schedules` lists future scheduled posts (`id`, `scheduledAt`, `account`), 20 at a time (`limit` up to 50, `cursor` for the next page).
- `PATCH /schedules/:id` with `{ "patch": { "scheduledTime": "<new future ISO time>" } }` moves one.
- `DELETE /schedules/:id` cancels one. It can't be undone, so confirm with the user first.
- `GET /published-posts?platform=instagram` lists live posts with `postUrl` (the public link) and `content` (the caption).
- The user can see and change all of this by hand in the **Calendar** tab in Blotato.

## Rate limits and common mistakes

- About 30 requests a minute for creating posts and 60 for reads. Space out a big batch.
- A failed video post is usually the file (shape, codec, length, size), not the API. Check those before resending.
- Don't resend a post blindly after an unclear answer: check its status first, or it may go out twice.
- Blotato also does DM automations, comments and analytics. This skill doesn't use them.
