---
name: feedback-read-before-overwrite
description: Never overwrite a file without reading it first; merge, don't replace
metadata:
  type: feedback
---

Before writing over any file that already exists, read it first, then merge your change into it. Never rebuild a file from a guess. Applies most to shared config: .claude/settings.json, launch.json, .env, CLAUDE.md, MEMORY.md.

**Why:** several chats share these files, and a blind overwrite in one silently breaks another.

**How to apply:** read → add your entry next to the existing ones → write.
