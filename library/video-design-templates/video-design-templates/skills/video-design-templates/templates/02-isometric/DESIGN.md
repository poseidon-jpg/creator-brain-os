# Isometric 2.5D (style 02)

A navy seed drops onto a blueprint grid, a clay city builds itself tile by tile, bursts into colour with three stat cards for Sonnet 5.5, then signs its name on the floor.

## When to use it

Use it for explaining systems, products or places where you want every part visible at once.

## The look

Isometric means no perspective: an orthographic camera looks down at 35 degrees, so everything reads like a tidy tabletop model.

## Techniques

- Three.js r170
- Orthographic isometric camera
- RoundedBox clay tiles with domino flip-in
- Clip-plane building growth
- Procedural window shader
- GTAO + soft shadows
- Post-AO card overlay
- Extruded TextGeometry wordmark
- 8-sub-frame motion blur

## Palette (the most used colors in the page's code)

`#ffffff` `#f5a283` `#f6dd7e` `#b9a8f5` `#9fe3bf` `#a8cdf6` `#fbf9ff` `#8fb6f4`

## Fonts

- System fonts only; the page draws its own lettering.

## How it was built

New choreography: navy seed crown, tiles, buildings on a 12-beat grid, tower with climbing rings and token sparks, colour wave with sparkles, then three stat cards, pull-back and a floor wordmark "Sonnet" + coral "5.5".
Cards are drawn after the AO pass (own overlay scene), so ambient occlusion never ghosts them; card digits use the frame time, not the sub-frame.
Left out vs Vincent: his exact tiered towers and balconies, boats beyond two, the 10 s pacing (this is 5 s, build compressed to about 1.7 s).

## Adapt it

Copy this folder into your project. Replace the on-screen words and the tag text with your topic, change the palette values, keep the timing and easing, check frames with `tools/record.py <folder> --stills ...`, then render. The page contract and the full steps are in the skill's `SKILL.md`.
