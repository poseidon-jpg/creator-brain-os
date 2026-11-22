---
name: thumb
description: Your best practices for YouTube thumbnails, kept as a small database your agent reads before it makes a thumbnail and grows from every thumbnail you approve, reject or save. Use when the user says "/thumb", "make thumbnails", "thumbnails for this video", "thumb ideas", "thumbnail text", "make a thumb", "rework this thumbnail", gives feedback on a thumbnail, or sends "/thumb" followed by a YouTube link or an image path to save a thumbnail into their library ("save this thumbnail", "add to my thumbnail library"). Not for video titles.
---

# /thumb

Your thumbnail know-how, written down so each new set starts from what already worked for you. The skill is a small database: the agent reads it before making thumbnails and adds to it whenever you approve, reject or save one.

## Where everything lives

- **Your principles** (this file, below): what makes a thumbnail work for your channel. Short on purpose.
- **Your thumbnail library**: [references/library.md](references/library.md). Every thumbnail you liked or shipped, with its layout and why it worked, plus your image model setup.
- **The making method**: [references/making.md](references/making.md). How to plan a set, brief an image model, fix a miss and hand it over.
- **The downloader**: `scripts/download_youtube_thumbnail.py` saves any public YouTube video's thumbnail with its title and channel. Run it, no need to read it.

## First run (when the library is empty)

1. **Collect 5 to 10 thumbnails** the user likes or has shipped. Ask for YouTube links or image files. Mix their own with other channels they admire.
2. **Save each one** with the add steps below.
3. **Write the first principles.** Look at the saved set side by side and write 3 to 6 principles under "Your principles", each with its reason (for example "Two to three words at most, because every thumbnail in the set reads in one glance at phone size"). Only write what the set shows.
4. **Ask 3 quick questions**, numbered, in one message: which image model they use (or want), whether their face appears on thumbnails, and any colours, fonts or looks they always or never use.
5. **Show the principles** in chat, fix anything that's off, then start the real task.

## Add a thumbnail to the library

1. **YouTube link or video ID**: run `python -I <this skill's folder>/scripts/download_youtube_thumbnail.py "<url>" --out-dir <this skill's folder>/library`. Use the full path, because a relative one only works after you cd into the skill folder. It tries the largest size first, saves the image and a `.json` with the title and channel, and prints the image path.
2. **Image file**: copy it into `library/` beside this file.
3. **Look at the image** before describing it. Describe what you see, not what you expect.
4. **Add one entry** to `references/library.md` using its entry shape: title, image path or link, layout, why it worked, and whether it was shipped, liked or rejected.
5. Only add what the user gives or asks for. Never scan folders for more.

## Make thumbnails

Read `references/making.md`, then your principles below and the library entries whose layout fits the video. Start from what the user already shipped or liked, because a layout their audience has proven beats a fresh guess.

## Learn from every round

When the user approves, rejects or fixes a thumbnail, update this skill in the same turn, before the next image:

1. Log it in `library.md`: approved and shipped ones as entries, rejected ones under "Rejected" with the user's reason.
2. Find the principle that explains the feedback, then rewrite the principle it refines below. Write the reason, not the date.
3. Delete what the new principle replaces. The file should not grow with every round.
4. When a thumbnail the user shipped breaks a principle here, the shipped one wins. Rewrite the principle and say so in the reply.

## Your principles

Empty until the first run. Each line is a principle plus its reason.

- (empty)

## Thumbnail text

Empty until the first run. How many words, case, fonts and where the text sits, with reasons.

- (empty)
