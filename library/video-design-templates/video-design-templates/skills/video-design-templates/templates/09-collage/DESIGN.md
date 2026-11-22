# Collage / Cut-out (style 09)

A halftone gentleman has his head snipped open, a book of verse, a stopwatch and a rocket burst out, a ransom-note band spells SONNET 5.5, then the red circle floods the frame into a magazine cover.

## When to use it

Use it for editorial openers, podcast and magazine promos, or any story about ideas and creativity.

## The look

Scissor-cut paper, kraft board, halftone print and torn newspaper, all moving on choppy 12 fps steps so it feels hand-animated under a rostrum camera.

## Techniques

- Canvas 2D
- 12 fps stepped animation
- Seeded stop-motion jitter
- Python halftone and cut-paper prep
- GPT Image 2.5 Flare source art
- Motion-smear ghost frames

## Palette (the most used colors in the page's code)

`#c8161e` `#efe9da` `#141212` `#f3eee2` `#1b1a1a` `#f7f1e3` `#1c0908` `#f1ece0`

## Fonts

- System fonts only; the page draws its own lettering.

## How it was built

- Built: 5 s, 1920x1080, 30 fps canvas page (`index.html`, recorded by `record.py`). A halftone gentleman is snipped open, a book of verse, quill, stopwatch, rocket and nebula burst out, a ransom-note band spells SONNET 5.5, the red circle floods into a red cover (stencil SONNET masthead, Nº5.5 tag, a counter sticker that ticks to 139, a $2 / $10 label, he says HELLO).
- Techniques: every pixel from t, snapped to 12 fps with seeded jitter; two-pass paper shadows; per-step grain, dust and flicker; camera punch and thump; smear ghosts; the jaw is a real even-odd hole in the body layer.
- Facts on screen: only the brief's ($2 in, $10 out per 1M tokens; 139 tokens a second against Opus 5.5's 92). Left out: the AHEM jaw gag, to give the SONNET 5.5 band time.
- Rebuild: `_build/gen_ws.mjs`, `_build/prep2.py`, then `python3 record.py`.

## Adapt it

Copy this folder into your project. Replace the on-screen words and the tag text with your topic, change the palette values, keep the timing and easing, check frames with `tools/record.py <folder> --stills ...`, then render. The page contract and the full steps are in the skill's `SKILL.md`.
