# The /generate Skill

Give your AI agent one command that creates images and videos on demand, always picks the cheapest capable model, never surprises you with a bill, and files every output in one place.

Works with Claude Code and any agent that reads skill files.

## What's inside

```
.claude/skills/generate/
├── SKILL.md              the brain: routing, rules, upload recipes, logging
├── log-gen.mjs           sidecar prompt logger (records how every file was made)
└── models/               one API recipe per model
    ├── nano-banana-2.md      images, cheap default (Google / fal.ai)
    ├── gpt-image-2.md        images, best for text and typography (fal.ai)
    ├── kling-3.0.md          video, default (Kie AI)
    ├── veo-3.1.md            video, higher quality (Google)
    └── seedance-2.0-fast.md  video from reference images (fal.ai)
```

## Install

1. Copy the `.claude/skills/generate/` folder into your workspace so it sits at `your-workspace/.claude/skills/generate/`.
2. Create a `.env` file at your workspace root with the keys for the providers you want (you don't need all of them on day one):

```
GOOGLE_AI_STUDIO_KEY=your_key_here
KIE_API_KEY=your_key_here
FAL_KEY=your_key_here
```

Get them at aistudio.google.com, kie.ai, and fal.ai. Add `.env` to your `.gitignore`.

3. Create your media folder at the workspace root:

```
generations/
└── refs/
```

Every output saves flat into `generations/`. Logos, faces, and style references you reuse live in `generations/refs/`.

4. Type `/generate` followed by what you want. Your agent reads SKILL.md, picks the model, and follows its recipe file.

## Start with two models

Wire up **Nano Banana 2 Lite** (images) and **Kling 3.0** (video) first. Between them they handle most requests, they're the cheapest in their lane, and they teach both API patterns - one sync, one async. Add the other three when a job demands them.

## The rules that save you money

These are written into SKILL.md, so your agent enforces them on every run:

- **Video always gets a cost quote first**, and the agent waits for your explicit go. One approval covers one run.
- **Drafts run on the cheap image model.** Only a picked favourite reruns on a quality model.
- **Logos and faces are never described in text** - the real file gets passed as a reference image.
- **Every generation writes a sidecar JSON** (same filename, .json extension) recording the exact prompt, model, refs, and settings that made it. You will thank yourself in three weeks.

## License

CC BY 4.0. Use it, adapt it, share it - credit appreciated.
