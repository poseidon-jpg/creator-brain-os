---
name: start-here
description: First-run setup for this hub. Asks the owner a few questions, writes their answers into memory, protects their personal info with the privacy scan, checks and installs the video tools, and opens the Command Center. Use when the user says "set me up", "start here", "/start-here", "first time", "onboard me", or when memory/MEMORY.md has no User entries yet.
---

# Start here (first-run setup)

Go one step at a time, in plain words, and wait for each answer. Never install anything without saying what it is and getting a yes.

## 1. Meet them (ask, one message, numbered)
1. What should I call you?
2. Your TikTok handle(s)? (Only used to keep them out of anything public.)
3. Which product categories do you post in, or want to? (beauty, home, kitchen, tech, fitness, fashion, pets…)
4. Where are you now: brand new, posting but no sales yet, or already earning? Rough GMV per month if you know it.
5. Your goal for the next 90 days, in one sentence.
6. Do you film your face, your hands, or both? Any voice or face you'd rather not show?
7. Which Claude plan are you on (Pro or Max)? (This sets how hard we push the heavy agents.)

## 2. Write it down
- One `user` memory per fact with `node "tools/rubric-second-brain/brain.js" store "<fact>" --type user --name <slug>`. Their name, categories, stage, goal and camera comfort each get their own file.
- Fill in "Your why" at the bottom of `docs/ai-ambition-thesis.md` in their own words.
- Add their name, handles and email (if they gave one) as new lines in `scripts/.privacy-patterns`, then run `bash scripts/privacy-scan.sh` and say it passes. Explain: "this stops your personal info from ever going into a public file."

## 3. Check the tools (run, then report in one short table)
`bash scripts/doctor.sh`. It checks Homebrew, ffmpeg, Node, Python, the transcriber and osxphotos, and says what's missing. For anything missing, show the one install command, say what it does, and run it only after a yes.

## 4. Phone settings
Walk them through the "One-time iPhone settings" block in `studio/SHOOTING-GUIDE.md`, one setting at a time. Ask them to confirm each one.

## 5. Show them around
- Start the Command Center (`preview_start` with name `command-center`, or `node tools/rubric-second-brain/server.js`) and open http://localhost:5210.
- In 5 lines: where clips go, how to say "/edit", where finished videos appear (`studio/ready/`), how they teach it their taste ("I hated that caption", which gets logged to `studio/TASTE.md`), and how to feed it sales numbers weekly.

## 6. Done when
The `user` memories exist, the privacy scan passes with their name in it, the doctor shows all green (or lists exactly what's left), and they know the one command: **/edit**.
