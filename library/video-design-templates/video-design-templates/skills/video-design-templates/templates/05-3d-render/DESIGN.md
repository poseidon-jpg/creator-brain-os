# 3D Render (style 05)

Puffy pink balloon letters spell Sonnet onto a carpet of glossy peach beads, a chrome ball smashes in as the full stop and a lavender wave flips the whole carpet before SONNET 5.5 lands.

## When to use it

Use it for product launches and brand reveals where the material itself sells the mood.

## The look

Physically based 3D: glossy clearcoat materials, soft studio light, real shadows, ambient occlusion, depth of field and motion blur, so objects feel like they have weight.

## Techniques

- Three.js r170 + WebGL2
- InstancedMesh bead carpet (about 56k two-tone capsules, plus 600 flying pills)
- Marching-cubes balloon letters (convolution surface)
- MeshPhysicalMaterial clearcoat + sheen, custom bounce-glow shader
- CubeCamera chrome ball reflections
- GTAO + custom bokeh depth of field
- 14-sample motion blur
- Hermite spline camera path with rack focus

## Palette (the most used colors in the page's code)

`#321a4f` `#efcfdc` `#f7d3b9` `#9d7df6` `#ee1a92` `#ee6a98` `#d9b0e0` `#f6cdd6`

## Fonts

- System fonts only; the page draws its own lettering.

## How it was built

- Built: one Three.js r170 page (`index.html`, contract: `DURATION`, `ready`, `renderAt(t)` pure in t), recorded frame by frame by `record.py` into `sonnet-05-3d-render.mp4` (1920x1080, 30 fps, 5 s, h264, bt709).
- Story: macro on pink pearl beads, balloon letters S-o-n-n-e-t drop on the beat, a chrome ball smashes in as the full stop, the pill burst and a flip wave turn the peach carpet lavender, then the camera swings round to SONNET 5.5 / HALF THE PRICE OF OPUS 5.5 (the only fact used: $2/$10 is half of $4/$20).
- Techniques: instanced two-tone bead carpet (about 56k, far haze rows at double size), marching-cubes balloon letters with analytic normals, clearcoat + sheen + fresnel-deepened latex shader, bounce-glow and wave-front glow written into the bead shader, CubeCamera chrome, GTAO, own bokeh DOF with rack focus, 16-30 jittered sub-frames of motion blur, Hermite camera spline, haze blended in post so the far carpet is seamless.
- Left out: no audio, no generated images (everything is drawn in code), no Chinese subtitle (English caption only). Cost: 0 USD.

## Adapt it

Copy this folder into your project. Replace the on-screen words and the tag text with your topic, change the palette values, keep the timing and easing, check frames with `tools/record.py <folder> --stills ...`, then render. The page contract and the full steps are in the skill's `SKILL.md`.
