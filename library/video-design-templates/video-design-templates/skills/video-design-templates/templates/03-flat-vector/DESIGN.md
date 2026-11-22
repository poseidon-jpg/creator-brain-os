# Flat Vector (style 03)

One coral dot bounces into the sun over a pop-up city, dives into a lit window where a ping arrives, snaps into four fact panels, then lands as the o of Sonnet 5.5.

## When to use it

Use it for brand explainers, app promos and friendly product intros.

## The look

Solid colour shapes with zero shadows, where bounce and rhythm carry the whole story in one unbroken take.

## Techniques

- SVG
- Plain JS timeline
- Closed-form spring physics
- Squash and stretch
- Sub-frame motion blur

## Palette (the most used colors in the page's code)

`#2a1ef4` `#0c0b26` `#ff9c92` `#4b42f6` `#6259f9` `#f14b4f` `#d63a40` `#3afeac`

## Fonts

- `Fredoka-500.woff2` (in this folder)
- `Fredoka-600.woff2` (in this folder)
- `Fredoka-700.woff2` (in this folder)

## How it was built

- One SVG page, every frame drawn by renderAt(t) from t alone (closed-form springs, seeded noise, no clock). Palette sampled from Vincent's frames.
- Story: dot falls and squashes, a shockwave springs the city up, the dot bounces into the sun, the camera dives into a lit tower window (the whole room is drawn inside it, so the zoom is continuous), a ping hits the person's phone, the bell grows into a coral wipe, four panels land clockwise (speed 92 vs 139 tokens/s, $4 crossed out to $2, dial at 56, NEW), they round into circles and collapse into the dot, which leaps in as the o of Sonnet. A 5.5 pill, "THINK FAST. SPEND LESS." and a two-hop idle hold the last 1.8 s.
- Only the facts in the brief are used (139 vs 92 tokens/s, $2 vs $4, Intelligence Index 56). The framed poem has 14 lines, a sonnet.
- Real motion blur: record.py averages 4 to 24 sub-frames per frame (page exposes samplesAt and shutterAt); wide shutter on the dive and the dot, narrow where flat edges sweep.
- Left out: Vincent's clock icon and heart, his bilingual tagline. Not captured: sound (the clip is silent).
- Rebuild: python3 record.py (final MP4), python3 record.py --stills 1.0,2.7 [--blur] (checks in _work/stills), python3 record.py --poster 1.02.

## Adapt it

Copy this folder into your project. Replace the on-screen words and the tag text with your topic, change the palette values, keep the timing and easing, check frames with `tools/record.py <folder> --stills ...`, then render. The page contract and the full steps are in the skill's `SKILL.md`.
