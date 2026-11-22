# Frame by Frame (style 01)

A match scrapes the Sonnet matchbox in the dark, a little flame hops off, dances, spins and bursts into a red Sonnet 5.5 stamp that a spark writes by hand.

## When to use it

Use it for friendly brand stories, mascots and anything that should feel crafted rather than computer-made.

## The look

Every drawing is redrawn at 12 per second with trembling ink lines and slightly off-register flat fills, so it keeps the warmth of the hand.

## Techniques

- Canvas 2D
- animated on twos (15 drawings per second) with line boil
- procedural brush strokes with pressure and taper
- off-register flat fills
- SVG displacement wobble per drawing
- stroke-drawn lettering with a pen spark
- paper tooth and watercolour disc texture

## Palette (the most used colors in the page's code)

`#cc3a2e` `#d9362a` `#b8483c` `#f4b53c` `#1d1514` `#e4dcc3` `#1e140f` `#d12c2b`

## Fonts

- `caveat-var.woff2` (in this folder)
- `luckiestguy.woff2` (in this folder)

## How it was built

- Built: a 5 s hand-drawn cartoon in Canvas 2D. A match scrapes a SONNET 5.5 matchbox in a dark red-line frame, a comic flash cuts to day, a flame character is born on the match, hops off, squashes, dances, spins and bursts into clouds. A red scalloped stamp appears and a spark writes "Sonnet" stroke by stroke, then a white 5.5 tag, a handwritten line and a red-pen circle.
- Techniques: every wobble is seeded by the drawing number, drawings held two frames (15 per second; flash and spin on ones, the hold on threes) so lines boil; brush strokes with pressure and taper; flat fills off-register; SVG displacement filter (12 seeds); paper from layered noise and fibres, watercolour sun disc, tooth, worn-stamp speckle; corner tags (SC. 5.5, on 2s / No. 001 drawing counter).
- Left out: Vincent's pull-back to a pinned notepad with a pencil hand (no room in 5 s). No audio, no paid images; only two local font files in assets/.

## Adapt it

Copy this folder into your project. Replace the on-screen words and the tag text with your topic, change the palette values, keep the timing and easing, check frames with `tools/record.py <folder> --stills ...`, then render. The page contract and the full steps are in the skill's `SKILL.md`.
