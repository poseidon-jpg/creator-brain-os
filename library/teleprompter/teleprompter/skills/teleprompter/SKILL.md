---
name: teleprompter
description: Sends scripts to the user's local teleprompter app so they can read them on their phone and computer while recording. Writes each script as a markdown file in the app's scripts folder, can put several scripts on one long page for a one-take batch recording, starts the app if it is not running, and gives the phone and desktop links. Use when the user says "send this to my teleprompter", "send my scripts to the teleprompter", "put these on the teleprompter", "/teleprompter", "teleprompter link", or wants to read a script on camera.
---

# Teleprompter

The user runs a small local teleprompter app. You put scripts in front of them by writing markdown files into its `scripts/` folder. The phone page and the desktop page pick a new file up on their own, and both stay on the same line while the user records.

**App folder:** `{{TELEPROMPTER_DIR}}`
(During setup, replace `{{TELEPROMPTER_DIR}}` with the full path of the folder that holds `server.mjs`. If it is still a placeholder, ask the user where they unzipped the teleprompter, then fix this line.)

**Default port:** 50013. If the user set another `PORT`, use that everywhere below.

## Steps

### 1. Make sure the app is running

Check `http://localhost:50013/api/info` (for example with `curl -s`). A JSON answer with `"app":"teleprompter"` means it is running.

If nothing answers, start it from the app folder as a background process that keeps running after your command ends:

```
cd "{{TELEPROMPTER_DIR}}"
node server.mjs
```

Wait about two seconds and check `/api/info` again. If it says the port is in use by something else, start it with another port (`PORT=50014 node server.mjs`, or `set PORT=50014` first on Windows cmd) and use that port in the links.

Node 18 or newer is the only requirement. If `node` is missing, tell the user to install it from nodejs.org and stop.

### 2. Name the file

Every file name carries a 2 to 3 word topic, in lowercase kebab-case, so the user can find it in the dropdown on a small phone screen:

- Good: `coffee-shop-hook.md`, `pricing-reels-batch.md`, `weekly-update-intro.md`
- Bad: `script.md`, `video.md`, `untitled.md`, `script-final-v2-new.md`

If the user works with project or ticket codes, put the code first: `EP12-goal-hook.md`. Only letters, numbers, spaces, dots, dashes and underscores work in a name, and it must end in `.md`.

Check the scripts folder first. If the name is taken by a different topic, pick another name. If it is the same topic, ask the user once: replace it or save a new version (`-v2`).

### 3. Write the script

Write the user's words exactly as they gave them. Do not fix grammar, wording or punctuation unless they ask, because they read their own words on camera. Format it for reading aloud:

```md
# Title of the video

## Section name (optional)

One beat per paragraph. Short paragraphs, a blank line between them, so the eye can pace itself.

Next beat here.
```

- `#` is shown in orange, `##` in yellow, `**bold**` in orange. Use them to mark where a new part starts.
- A line with only `---` draws a divider.
- Do not add blank lines at the top or bottom to pad it. The app already leaves space above and below the text.

### 4. Batch scripts for a one-take recording

When the user wants to record several scripts in one go (for example a week of reels), put them all in ONE file, in recording order:

```md
# Reels batch: <topic>

---

## Reel 1 - <title>

<script>

---

## Reel 2 - <title>

<script>
```

They read the whole page top to bottom in one continuous take, then cut it into separate videos later. Name the file for the batch, for example `pricing-reels-batch.md`. See `scripts/sample-three-reels.md` in the app folder for a worked example.

### 5. Put it on screen

Ask the open pages to switch to the new script:

```
curl -s -X POST http://localhost:50013/api/live -d "{\"file\": \"<file-name>.md\"}"
```

Any phone or desktop page that is open switches to it within two seconds. Pages that open later can pick it from the dropdown, where the newest script is listed first. If the user edits a script file later, the open pages update in place without losing their spot.

### 6. Give the user the links

Read the links from `/api/info` (`links.desktop` and `links.phone[0].url`) and reply in a few lines:

- **On this computer:** the desktop link, for example `http://localhost:50013/desktop`
- **On your phone:** the phone link, for example `http://192.168.1.20:50013/`. The phone must be on the same wifi as the computer. Open it in Chrome or Safari.
- The file name and folder you wrote it to.

If `links.phone` is empty, the app was started with `HOST=127.0.0.1`, which keeps it on this computer only. Tell the user to restart it without that setting to use their phone.

## Controls (tell the user if they ask)

- **Phone:** big Play / Pause button, speed slider beside it, Size slider for text size, Mirror for a mirror rig, Sync to keep the desktop page on the same line, a search box on top. Hold the orange reading line for half a second, then drag it to sit level with the camera lens.
- **Desktop:** Play, Speed, Size. Space bar plays and pauses, arrow keys scroll, + and - change speed. Drag the orange line to where your eyes sit.
- Whichever screen was touched last leads, and the other one follows.

## If the phone page will not load

1. Check the phone is on the same wifi as the computer (not a guest network, which often blocks devices from seeing each other) and not on mobile data.
2. Use the address from `/api/info`, never `localhost`, on the phone.
3. On the first run, the computer may ask whether to allow Node on the network. Allow it on private networks. On Windows, if that prompt was dismissed, allow Node.js in Windows Security, Firewall, Allow an app through firewall (Private ticked). On a Mac, allow incoming connections for node in System Settings, Network, Firewall.
4. If it loads on the computer but not the phone, it is almost always the firewall or the wifi, not the script.

## Changing the app

It is a simple personal tool, and the user is welcome to change it. The pages are `public/index.html` (phone) and `public/desktop.html` (desktop), the shared sync engine is `public/sync.js`, and the server is `server.mjs`. Restart the server after editing `server.mjs`; page changes show on a reload.
