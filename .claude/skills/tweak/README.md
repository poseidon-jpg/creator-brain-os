# tweak

A live controls panel for any single-file HTML your agent builds. It auto-scans the page, injects 5 (light) or 10 (max) sliders for the values that matter - speed, type sizes, density, glow, roundness, spacing - you drag until it feels right, then one click bakes your dialed values back into the source CSS and removes the panel.

## Install

Unzip the file, then copy the `tweak/` folder into your skills directory:

```bash
cp -r tweak ~/.claude/skills/
```

Or project-specific: `cp -r tweak your-project/.claude/skills/`

## Triggers

- `/tweak [file]` - light mode, 5 sliders
- `/tweak max [file]` - max mode, 10 sliders
- "bake tweak" - write the dialed values into the source CSS
- "tweak strip" - remove the panel without baking

## What's inside

- `SKILL.md` - the scan/inject/bake behaviour spec
- `panel.html` - the panel bundle that gets injected into your target HTML

## License

CC BY 4.0 - free to use and adapt with attribution.
