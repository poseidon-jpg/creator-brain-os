# Aurora Glassmorphism (style 10)

Frosted glass cards over a flowing aurora show Sonnet 5.5 beating Opus 5.5 on speed and price, then fold into a glass orb that becomes the o of the Sonnet wordmark.

## When to use it

Use it for AI assistants, fintech and premium app launches that should feel calm, light and futuristic.

## The look

A soft aurora gradient moves underneath while frosted, refractive glass panels float on top with bright edges and rainbow fringing.

## Techniques

- WebGL2 aurora shader (domain-warped gradient, filaments, drifting dust)
- Frosted glass pass per card: blurred backdrop, bevel refraction, RGB dispersion, 3D perspective homography
- Liquid-glass lens shader: slider knob, magnifying pill, glass orb, glass ring
- Sub-frame motion blur (up to 14 samples), bloom, film grain

## Palette (the most used colors in the page's code)

`#ffffff` `#04051a` `#c4b6ff` `#78dcff` `#8fdcff` `#cfe7ff` `#f2faff` `#5fd6ff`

## Fonts

- `inter.woff2` (in this folder)
- `outfit.woff2` (in this folder)

## How it was built

- Story: a "What's new in 5.5?" chat card answers "Faster than Opus 5.5. At half the price." Speed counts to 139 tokens/s (Opus 5.5: 92). Price slides from Opus 5.5's $4 / $20 to Sonnet's $2 / $10 with a liquid-glass knob. A glass lens sweeps the answer, the cards fold into a glass orb, and the orb lands as the o of "Sonnet" with a glass 5.5 tag and "Faster. Half the price."
- Facts used (Artificial Analysis, 30 Sep 2026): $2 / $10 vs $4 / $20, 139 vs 92 tokens/s. The Intelligence Index (56 vs 58) is left out on purpose.
- Render: `python3 record.py` (hidden Chrome, frames read from the WebGL buffer, piped to ffmpeg, BT.709 tagged, crf 14). `sink.js` is the frame receiver. Fonts (Inter, Outfit) are local in `assets/`.
- Left out: the original's toggle and chip content (replaced by the price slider and result chips), and the Chinese tagline line.

## Adapt it

Copy this folder into your project. Replace the on-screen words and the tag text with your topic, change the palette values, keep the timing and easing, check frames with `tools/record.py <folder> --stills ...`, then render. The page contract and the full steps are in the skill's `SKILL.md`.
