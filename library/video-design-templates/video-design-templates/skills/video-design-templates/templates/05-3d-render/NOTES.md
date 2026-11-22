# 3D Render - build notes

- Built: one Three.js r170 page (`index.html`, contract: `DURATION`, `ready`, `renderAt(t)` pure in t), recorded frame by frame by `record.py` into `sonnet-05-3d-render.mp4` (1920x1080, 30 fps, 5 s, h264, bt709).
- Story: macro on pink pearl beads, balloon letters S-o-n-n-e-t drop on the beat, a chrome ball smashes in as the full stop, the pill burst and a flip wave turn the peach carpet lavender, then the camera swings round to SONNET 5.5 / HALF THE PRICE OF OPUS 5.5 (the only fact used: $2/$10 is half of $4/$20).
- Techniques: instanced two-tone bead carpet (about 56k, far haze rows at double size), marching-cubes balloon letters with analytic normals, clearcoat + sheen + fresnel-deepened latex shader, bounce-glow and wave-front glow written into the bead shader, CubeCamera chrome, GTAO, own bokeh DOF with rack focus, 16-30 jittered sub-frames of motion blur, Hermite camera spline, haze blended in post so the far carpet is seamless.
- Left out: no audio, no generated images (everything is drawn in code), no Chinese subtitle (English caption only). Cost: 0 USD.
