# Shape Morph (style 06)

One shape keeps becoming the next, an ink drop, a pen nib, a half-filled coin and a paper plane, until it lands as the Sonnet wordmark with a coral dot.

## When to use it

Use it for brand stories, product explainers or logo reveals where one idea should flow into the next without a cut.

## The look

A single solid shape tells the whole story by turning into each new object, while the background wipes to a new colour in sync.

## Techniques

- Canvas 2D
- custom polygon resampling and morph matching (240 points per part)
- Outfit SemiBold glyph outlines flattened with fontTools
- 25-sample sub-frame motion blur
- soft circle and sea-wave background wipes
- paper grain, fibres, soft contact shadows and vignette

## Palette (the most used colors in the page's code)

`#f1ece0` `#16151a` `#f3ba2e` `#ec3b2b` `#2630dd` `#121116` `#f7f3ea` `#e6e1d3`

## Fonts

- `jbmono-latin-700-normal.woff2` (in this folder)
- `outfit-latin-500-normal.woff` (in this folder)
- `outfit-latin-500-normal.woff2` (in this folder)
- `outfit-latin-600-normal.woff` (in this folder)
- `outfit-latin-600-normal.woff2` (in this folder)
- `outfit-latin-700-normal.woff` (in this folder)
- `outfit-latin-700-normal.woff2` (in this folder)

## How it was built

Built: one shape becomes the next, with the background wiping in sync: ink drop (cream) to pen nib (cream), to half-filled coin (yellow, "half the price"), to paper plane (cobalt, "faster"), to a ball that splits into the letters of Sonnet on near black, then a coral dot is thrown into place on a trail of the story's colours.
Facts used (all from the brief, Artificial Analysis 30 Sep 2026): half the price of Opus 5.5 ($2 in, $10 out per 1M tokens) and 139 tokens a second. No other claims. The 56 vs 58 score is not shown.
Tech: Canvas 2D page (index.html, `window.renderAt(t)` from t alone). Every part is resampled to 240 points, start points aligned by best match, with sprouting and collapsing parts; Outfit SemiBold outlines flattened with fontTools (`build_glyphs.py` writes `assets/glyphs.js`); 25-sample sub-frame motion blur; paper grain, fibres, soft shadows, vignette; soft circle and sea-wave wipes.
Left out: Vincent's coffee, sunrise, sunset, gull, pin and heart beats (5 seconds fits four shapes and the wordmark), and his Chinese captions (chapter labels are short English).
Check sheets: `_check/mine_sheet.png` next to `_check/vincent_sheet.png`. Re-render with `python3 record.py .` (one browser, one worker, about 3 minutes). Scratch stills and patch scripts sit in `_check/scratch/`.

## Adapt it

Copy this folder into your project. Replace the on-screen words and the tag text with your topic, change the palette values, keep the timing and easing, check frames with `tools/record.py <folder> --stills ...`, then render. The page contract and the full steps are in the skill's `SKILL.md`.
