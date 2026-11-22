# Library: extra skills, staged and NOT installed

These skills came with the system but aren't switched on. Each folder has a `QUARANTINE.md` saying where it came from and an automatic count of risky patterns in its scripts (network calls, shell commands). That count is a reminder to read before installing, not a malware verdict.

**To install one:** ask Claude "install <name> from the library". Claude reads its SKILL.md and scripts first, tells you what it touches (network, files, API keys), and only after your yes copies the inner skill folder into `.claude/skills/`.

| Skill | What it does | Watch out for |
|---|---|---|
| outliers | Finds outlier posts in your niche (YouTube, TikTok, Instagram, X, LinkedIn): posts beating their account's normal by a wide margin. Great for finding what to copy the *structure* of. | Calls social APIs; may need keys |
| inspo | Saves videos to an Inspos wall: a JSON library of snapshots (title, channel, views, tags) to study. | Fetches web pages, local server |
| post | Schedules or publishes finished short videos to TikTok, Reels, Shorts and Threads through Blotato. | Needs a Blotato account + key; the TikTok Shop product link still goes on in the app |
| rubric-scripts | A small local app to review short-video scripts before you record. | Local server |
| teleprompter | Sends scripts to a local teleprompter you read on your phone or computer while filming. | Local server |
| rubric-storyboards-beta-v0.1 | Plan a video as a board of stills and review it with pinned comments. | Local server, runs scripts |
| rubric-carousels | Photo-carousel posts (useful for TikTok photo mode). | Local server, runs scripts |
| rubric-references | Reference board for visual inspiration. | Local server |
| arms-skills | Your tone of voice, kept as a small database your agent reads before it writes in your name, growing every time you correct it. | Light: a few web links |
| generate / rubric-generations | Image and video generation through AI model APIs, with saved styles. | Spends credits on paid APIs, needs keys |
| video-design-templates | Ten ready-made motion styles (hand-drawn, isometric, flat vector, 3D, collage, liquid…). | Runs scripts |
| robo-style | A static, infographic-heavy visual style (halftone art, paper/black/orange). | None |
| surprise-me | Max-effort visual mode for design work. | None |
| excalidraw | Hand-drawn whiteboard diagrams. | Local |
| agentic-os-v2 | The original RUBRIC Agentic OS pack this hub grew from (reference only, since the hub already includes its ideas). | Runs many scripts; don't install over the hub |
| rubric-docs / rubric-links / rubric-sprint | Local docs, links and sprint-board templates. | Local servers |
| vercel | Deploy a static site to Vercel with a pre-flight checklist. | Needs a Vercel account |
| design-systems / color-palettes-toolkit / rubric-icons-50 | Asset packs: design systems, palettes and 50 icons. No SKILL.md, just material. | Big folders |
| creative-engine-template / element-picker / robo-capture / youtube-gemini-summarizer | Templates and capture tools without a ready SKILL.md (the YouTube one summarizes videos with Gemini). | Read first; Gemini key for the summarizer |

**Licensing:** most of these came from the RoboNuggets community classroom. Keep this repo **private** (shared only with invited people) unless you've checked that each pack's license allows public sharing.
