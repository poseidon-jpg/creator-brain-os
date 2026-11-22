# robo

A complete static-infographic design system for your agent: dot-matrix (halftone) art, a paper/ink/orange palette, Outfit + Doto type, and a 32-piece component gallery. Includes copy-paste engines for animated dot backgrounds, particle typography, interactive dot effects, and photo-to-dots conversion.

It ships with a locked palette and type pairing so it works out of the box - swap those tokens for your own brand and every build inherits your house style. Fonts are CDN Google Fonts only; nothing to self-host.

## Install

Unzip the file, then copy the `robo/` folder into your skills directory:

```bash
cp -r robo ~/.claude/skills/
```

Or project-specific: `cp -r robo your-project/.claude/skills/`

## Triggers

- `/robo`, `/robo lite`
- "robo slides", "robo infographic", "robo app", "robo style"

## How it routes

Read `SKILL.md` first - it is the baseline (palette, type, the dot-matrix technique, cards, icons). Then it routes to the one sub-guide that matches what you are building:

| Building | Read |
|---|---|
| Quick / throwaway HTML | `lite.md` |
| Slides and decks | `slides.md` |
| Apps, tools, dashboards | `apps.md` |
| Course landing pages | `courses.md` |
| Screenshot-ready infographics | `infographic.md` |
| Animated dot backgrounds | `backgrounds.md` |

## What's inside

- `SKILL.md` + 6 routed sub-guides
- `brand-book.html` - the style documenting itself
- `components/` - 32 self-contained components + `gallery.html`
- `references/` - 8 live engine demos (backgrounds, particle text, interactive effects, shading benchmarks, image/scene-to-dots, sprite bob)

## License

CC BY 4.0 - free to use and adapt with attribution.
