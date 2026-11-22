# Geometric Bauhaus (style 11)

A Bauhaus poster for Sonnet 5.5 snaps together on a 120 BPM grid, swings 90 degrees about a dot, bursts into tiles, shows its three numbers on a black plate and lands as a vertical SONNET poster.

## When to use it

Use it for brand intros, event posters or any message that should feel precise, confident and designed.

## The look

Primary colours, pure geometry and a hard grid, with every move locked to the beat and stopping dead on a hard ease.

## Techniques

- Canvas 2D shapes
- WebGL print-finish shader
- 120 px grid, 120 BPM beat clock
- adaptive sub-frame motion blur (up to 128 samples)
- multiply ink overprint on cream paper
- mosaic cell cuts on half-frame boundaries

## Palette (the most used colors in the page's code)

`#f5efe1` `#dc2f35` `#f6c60c` `#2552a3` `#121111` `#ffffff`

## Fonts

- `jost-latin.woff2` (in this folder)

## How it was built

Story, 10 beats at 120 BPM: red circle and guide lines, bar slam, triangle hinge, blue square, the whole composition swings 90 degrees about the dot, tile mosaic floods out from the dot, a black plate shows Sonnet's three numbers (139 tok/s, $2 in, $10 out, Artificial Analysis 30 Sep 2026), the plate clears into the poster, vertical SONNET lands, 5.5 stamps into the circle.
Tech: Canvas 2D ink layer with multiply overprint, WebGL print-finish shader (torn ink edges, mottle, paper, crisp micro type), adaptive 1 to 128 sample motion blur, mosaic cuts quantised to half-frame boundaries, small thud shakes on the heavy hits.
Left out: the original's 20 beats (10 fit in 5 s). The tile field is only fully formed for about 0.15 s.
Scratch folders _frames, _stills and _work hold review PNGs and helper scripts; they are not part of the deliverable.

## Adapt it

Copy this folder into your project. Replace the on-screen words and the tag text with your topic, change the palette values, keep the timing and easing, check frames with `tools/record.py <folder> --stills ...`, then render. The page contract and the full steps are in the skill's `SKILL.md`.
