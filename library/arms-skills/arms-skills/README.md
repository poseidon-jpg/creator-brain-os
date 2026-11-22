![ARMS Skills Pack](assets/banner.png)

# ARMS Skills Pack

Seven skills from the Agentic OS v2 lesson, ready for your agent. They cover three of the four ARMS parts (apps, memory and skills): a voice and a thumbnail database your agent builds for you, a backlog for your feedback, a way to teach your agent lessons it keeps, a Chrome extension builder, a surprise third version of anything, and a fast grammar check.

Built by Jay E at RoboNuggets. License: MIT (see LICENSE).

## What's inside

| Skill | Type it as | What it does | ARMS |
|---|---|---|---|
| `tone` | `/tone` | A database of how YOU write. Your agent reads it before it writes anything for you, and adds to it each time you correct a draft. Starts empty. | Skills |
| `thumb` | `/thumb` | A database of your thumbnail best practices: what you liked, what you shipped, and why. Your agent reads it before it briefs an image model. Starts empty. | Skills |
| `wildcard` | `/wildcard` | One surprise version of anything: same voice or colours, a different structure. Good as the third option of every draft. | Skills |
| `grammar` | `/grammar` | Real grammar and spelling mistakes only, one line each with the fix. No style notes. Runs best on your smallest, cheapest model. | Skills |
| `note` | `/note` | A backlog for your feedback. `/note <skill> <text>` parks a note for one skill, and nothing changes until you say `/note apply <skill>`. | Memory |
| `calibrate` | `/calibrate` | Teaches your agent a lasting lesson. It checks memory first, saves one linked memory file, fixes the skill that owns the behaviour, then proves it can find it again. | Memory |
| `chromify` | `/chromify` | Builds and fixes Chrome extensions (Manifest V3), and keeps a registry of the ones you have, so it never builds the same thing twice. | Apps |

`/tone` and `/thumb` start empty on purpose. A database skill is only as good as what's in it, and what's in it should be yours. On first use, each one has your agent fill it from your own past work plus a few quick questions.

## Install (let your agent do it)

Hand this README to your agent and say:

> Read this pack. Tell me in plain words which of these seven skills would help me most, and ask me which ones to install. Then copy each one I pick into your skills folder, and run the first-use setup for /tone and /thumb if I picked them.

### For the agent: the install steps

1. **Find your skills folder.** It's the folder where you keep skills, each one a folder with a `SKILL.md` inside. If you're not sure where yours is, ask your user. If your agent has no skills folder, keep each `SKILL.md` as a reference file and add one line to your instructions file pointing at it, with its trigger words. For example: `When the user types /grammar or asks for a grammar check, read skills/grammar/SKILL.md and follow it.`
2. **Copy only the skills your user picks.** Copy each `skills/<name>/` folder whole (some have a `references/` folder or a registry file). Don't copy the `assets/` folder; it's only this README's banner.
3. **Check for clashes.** If a skill with the same name already exists, show your user both and ask which to keep. Never overwrite one without asking.
4. **Small-model skills.** `/grammar` and `/note` are small jobs. If your agent lets a skill choose its model (often a `model:` line in the skill's frontmatter; check your agent's docs for the exact name), set these two to your smallest, cheapest one. If it doesn't, skip this step: they still work on any model.
5. **First use of `/tone` and `/thumb`.** Follow the first-run step in each `SKILL.md`. It fills the database from your user's own writing or thumbnails, and asks them only what you can't find.
6. **Where `/note` keeps its notes.** It keeps one feedback folder in your user's workspace, outside the skills folders. The default, `feedback/`, is fine. To use another folder, change it once in the Setup block of `skills/note/SKILL.md`.
7. **Where `/calibrate` saves.** It saves to your own memory folder and its index. If you have neither, it makes `memory/` with a `MEMORY.md` index. Optional: if your user runs the RUBRIC Agentic OS v2 or the RUBRIC Second Brain (separate free downloads from the same classroom), its `brain.js recall` and `brain.js store` commands do the recall and store. Without them, `/calibrate` works on plain files.
8. **Say what you installed.** Tell your user in one line per skill what you installed and how to start it.

## How they work together

- **Skills that learn.** `/tone` and `/thumb` hold knowledge, not just steps. Each correction your user gives is folded back into the database, so the next draft starts closer.
- **Feedback with a backlog.** `/note` parks feedback until your user says apply, so a skill changes once, on purpose, not after every passing comment. `/note sweep` catches corrections that never got parked.
- **Lessons that stick.** `/calibrate` is for anything that should outlive the chat: a rule, a preference, a fact. It links each memory to related ones, so a memory map shows how they connect.
- **No overfitting.** `/wildcard` gives you one version that breaks your own pattern. Keep the ones that work and add them to your database.

## Folder map

```
arms-skills/
  README.md        this file
  LICENSE          MIT
  assets/          the banner for this README
  skills/
    calibrate/     SKILL.md
    chromify/      SKILL.md, registry.md (your extensions), scripts/ (icon maker)
    grammar/       SKILL.md
    note/          SKILL.md
    thumb/         SKILL.md, references/ (your library, making), scripts/ (YouTube thumbnail download)
    tone/          SKILL.md, references/ (your samples, formats)
    wildcard/      SKILL.md
```

## License

MIT. Use them, change them, share them. Keep the copyright line in LICENSE.
