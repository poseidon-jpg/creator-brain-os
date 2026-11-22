# Collage / Cut-out - build notes

- Built: 5 s, 1920x1080, 30 fps canvas page (`index.html`, recorded by `record.py`). A halftone gentleman is snipped open, a book of verse, quill, stopwatch, rocket and nebula burst out, a ransom-note band spells SONNET 5.5, the red circle floods into a red cover (stencil SONNET masthead, Nº5.5 tag, a counter sticker that ticks to 139, a $2 / $10 label, he says HELLO).
- Techniques: every pixel from t, snapped to 12 fps with seeded jitter; two-pass paper shadows; per-step grain, dust and flicker; camera punch and thump; smear ghosts; the jaw is a real even-odd hole in the body layer.
- Facts on screen: only the brief's ($2 in, $10 out per 1M tokens; 139 tokens a second against Opus 5.5's 92). Left out: the AHEM jaw gag, to give the SONNET 5.5 band time.
- Rebuild: `_build/gen_ws.mjs`, `_build/prep2.py`, then `python3 record.py`.
