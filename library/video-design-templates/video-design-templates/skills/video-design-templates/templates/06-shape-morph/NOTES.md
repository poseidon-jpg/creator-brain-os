# Shape Morph - build notes


Built: one shape becomes the next, with the background wiping in sync: ink drop (cream) to pen nib (cream), to half-filled coin (yellow, "half the price"), to paper plane (cobalt, "faster"), to a ball that splits into the letters of Sonnet on near black, then a coral dot is thrown into place on a trail of the story's colours.
Facts used (all from the brief, Artificial Analysis 30 Sep 2026): half the price of Opus 5.5 ($2 in, $10 out per 1M tokens) and 139 tokens a second. No other claims. The 56 vs 58 score is not shown.
Tech: Canvas 2D page (index.html, `window.renderAt(t)` from t alone). Every part is resampled to 240 points, start points aligned by best match, with sprouting and collapsing parts; Outfit SemiBold outlines flattened with fontTools (`build_glyphs.py` writes `assets/glyphs.js`); 25-sample sub-frame motion blur; paper grain, fibres, soft shadows, vignette; soft circle and sea-wave wipes.
Left out: Vincent's coffee, sunrise, sunset, gull, pin and heart beats (5 seconds fits four shapes and the wordmark), and his Chinese captions (chapter labels are short English).
Check sheets: `_check/mine_sheet.png` next to `_check/vincent_sheet.png`. Re-render with `python3 record.py .` (one browser, one worker, about 3 minutes). Scratch stills and patch scripts sit in `_check/scratch/`.
