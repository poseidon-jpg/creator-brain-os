# Line Art (style 04)

One gold line grows from a seed into a city, loops up into a golden moon with an S, and signs off as Sonnet 5.5 while the city's doorways light up.

## When to use it

Use it for premium brands, architecture, jewellery and any story about craft.

## The look

A single continuous line is the whole picture, and the empty space around it matters just as much.

## Techniques

- Canvas 2D
- One SVG path sampled once and drawn by arc length
- Heat-aged gold stroke with two-level bloom
- Tip-tracking camera with parallax dust
- Mirror ground reflection
- Radial gold reveal and per-letter wordmark in Cormorant Garamond

## Palette (the most used colors in the page's code)

`#060912` `#1a2744` `#101a30` `#f9e8bc` `#e4c482` `#a47737` `#0a101f` `#16203a`

## Fonts

- `CormorantGaramond-400.woff2` (in this folder)
- `CormorantGaramond-500.woff2` (in this folder)
- `CormorantGaramond-600.woff2` (in this folder)
- `Inter-300.woff2` (in this folder)
- `Inter-400.woff2` (in this folder)

## How it was built

- A single gold line enters from the left, sprouts a seedling, runs through a skyline, curls up and closes as a moon. The moon fills with gold from the point where the pen stops, the city's doorways and stars light up, and SONNET / 5.5 settle in. Silent, 1920x1080, 30 fps, 5.0 s.
- Built in `index.html` (canvas 2D, `renderAt(t)` contract). One SVG path is sampled once and drawn by arc length. Tip speed is keyed per segment: slow sprout, fast city, whip around the moon.
- Left out: no facts or numbers about Sonnet 5.5 (price, speed, score), no audio, no generated images. Cost: 0 USD.
- Re-render: `python3 record.py` (about 2 to 3 minutes). Stills: `python3 record.py --stills 1.0,2.7,4.6`.

## Adapt it

Copy this folder into your project. Replace the on-screen words and the tag text with your topic, change the palette values, keep the timing and easing, check frames with `tools/record.py <folder> --stills ...`, then render. The page contract and the full steps are in the skill's `SKILL.md`.
