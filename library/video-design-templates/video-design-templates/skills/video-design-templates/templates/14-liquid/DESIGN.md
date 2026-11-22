# Liquid Motion (style 14)

A glossy drop falls with a flipped Sonnet inside it, splashes, stretches into seven taffy beads and flows into the jelly word Sonnet 5.5.

## When to use it

Use it for drinks, beauty and playful consumer brands where the product should feel juicy and touchable.

## The look

Glossy, squeezable liquid that sticks, stretches, merges and bounces, with strong highlights and a mirror floor.

## Techniques

- WebGL2 raymarching, SDF metaballs (smooth-min)
- Refractive jelly: IOR 1.4, dispersion, absorption, inner glow, trapped bubbles
- Font to SDF text (Fraunces Black) with a radial flow-out reveal
- Mirror floor with ripples and coloured light pools
- 20x supersampled motion blur and depth of field
- Bloom, ACES tone map, grain

## Palette (the most used colors in the page's code)

`#14041c` `#ff5326` `#ff6a10` `#ff4a1c` `#ff2c46` `#ff2a80` `#c42cee` `#7a30ff`

## Fonts

- System fonts only; the page draws its own lettering.

## How it was built

Built: `index.html` (one WebGL2 page, contract: DURATION, ready, renderAt(t)) rendered by `record.py` to `sonnet-14-liquid.mp4`. `poster.jpg` is t=4.2 s.
Story: a drop pinches off with a lens-flipped "Sonnet" inside it, splashes into a crown, a jet throws a blob (macro push-in with pink flush), the blob stretches into a seven-bead taffy necklace, and the beads flow into the jelly word Sonnet plus a gold 5.5 tag by 3.0 s. Hold: glint sweep, drips, ripples, floating droplets, tagline "every token starts with a drop" streaming in left to right.
Techniques: raymarched SDF metaballs, real refraction with dispersion, absorption, inner glow and marbling, trapped bubbles, Fraunces text SDF with radial reveal, mirror floor with coloured light pools, 20x motion blur and depth of field (70x in the macro), defocus-aware highlights, bloom, ACES, grain.
Left out: no audio, no model facts or numbers on screen (only the name and the version tag), no HyperFrames.
Weaker than the original: Vincent's iridescent swirl inside the sphere is only a subtle marbling here, and the frame right at impact (0.55 s) is a motion-blurred smear by design.

## Adapt it

Copy this folder into your project. Replace the on-screen words and the tag text with your topic, change the palette values, keep the timing and easing, check frames with `tools/record.py <folder> --stills ...`, then render. The page contract and the full steps are in the skill's `SKILL.md`.
