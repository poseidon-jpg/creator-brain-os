---
name: video-design-templates
description: Ten ready-made motion styles (hand-drawn frame by frame, isometric, flat vector, line art, 3D render, shape morph, collage, aurora glass, Bauhaus, liquid). Use when the member wants a short animation, title, intro, sting or explainer clip in one of these looks, or wants to reuse a look for their own topic. Each template is a working web page that draws a 5 second 1080p clip from code, with a style spec to read first.
---

# Video Design Templates

Ten styles, each a finished 5 second, 1920x1080, 30 fps animation built as one web page. No video model is involved: every frame is drawn by code, so you can change the words, colors and timing and render again.

## When to use it

- The member asks for a motion graphic, title card, intro, sting or short explainer in a specific look.
- The member shows a look they like and you need a proven starting point.
- The member wants "the same look, my topic".

## The ten styles

| Folder | Style | Use it for |
|---|---|---|
| `templates/01-frame-by-frame` | Frame by Frame | Use it for friendly brand stories, mascots and anything that should feel crafted rather than computer-made. |
| `templates/02-isometric` | Isometric 2.5D | Use it for explaining systems, products or places where you want every part visible at once. |
| `templates/03-flat-vector` | Flat Vector | Use it for brand explainers, app promos and friendly product intros. |
| `templates/04-line-art` | Line Art | Use it for premium brands, architecture, jewellery and any story about craft. |
| `templates/05-3d-render` | 3D Render | Use it for product launches and brand reveals where the material itself sells the mood. |
| `templates/06-shape-morph` | Shape Morph | Use it for brand stories, product explainers or logo reveals where one idea should flow into the next without a cut. |
| `templates/09-collage` | Collage / Cut-out | Use it for editorial openers, podcast and magazine promos, or any story about ideas and creativity. |
| `templates/10-aurora-glass` | Aurora Glassmorphism | Use it for AI assistants, fintech and premium app launches that should feel calm, light and futuristic. |
| `templates/11-bauhaus` | Geometric Bauhaus | Use it for brand intros, event posters or any message that should feel precise, confident and designed. |
| `templates/14-liquid` | Liquid Motion | Use it for drinks, beauty and playful consumer brands where the product should feel juicy and touchable. |

Open `index.html` (the library, beside this file) to watch all ten, or read a style's `DESIGN.md` for its look, techniques, palette and fonts.

## How to build a video in a style

1. **Pick a style.** Match the mood and the subject to the table above. When two fit, show the member both previews (`templates/<folder>/preview.mp4`) and let them choose.
2. **Copy, never edit.** Copy `templates/<folder>/` into the member's project. The kit's own templates stay as they are, so the next video starts clean.
3. **Read before you write.** Read the copy's `DESIGN.md`, then its `index.html`. The page contract is small:
   - `window.DURATION` - the clip length in seconds
   - `window.renderAt(t)` - draws the exact frame for time `t`, as a function of `t` only
   - `window.ready` - optional promise that resolves when fonts and images are loaded
4. **Change the content, keep the craft.**
   - Replace the on-screen words with the member's topic. The samples are about a model release, so every headline, tag and caption changes. Keep the word lengths close so the layout holds.
   - Change colors in the palette values at the top of the page's script (the palette is listed in `DESIGN.md`). Keep the contrast.
   - Keep the timing and easing. Change the story beats only where the topic needs it.
   - Fonts sit in `assets/` or `fonts/` beside the page. Add a font the same way. Never load one from the network, because a render must work offline.
   - Keep the clip silent. Sound is added afterwards.
5. **Check frames before you render.** From the kit's `tools/` folder run `python record.py <your-folder> --stills 0.5,1.5,2.5,3.5,4.5` and look at every PNG. Fix what you see: clipped text, a wrong color, an empty frame at a scene change.
6. **Render.** `python record.py <your-folder>` writes `render.mp4` (1920x1080, 30 fps, no audio) next to the page. It needs Python 3, `pip install playwright`, `playwright install chromium`, and ffmpeg on the PATH. Set `CHROME_PATH` to use an installed Chrome or Edge instead.

## Rules that keep a template working

- `renderAt(t)` must draw the same pixels for the same `t`, in any order. No real-time clock, no random numbers without a seed, no state that only builds up as time runs forward.
- Do not add network requests (fonts, scripts, images). Everything the page needs sits in its folder.
- A longer clip changes `DURATION` and needs the pacing checked again: a 5 second rhythm stretched to 15 seconds feels slow.
- Credit: the ten looks come from Vincent Wei's motion style showcase (https://x.com/VincentWei93/status/2104957548797604116). These are new remakes, not his clips.

## Files

- `index.html`, `data/styles.js` - the library page
- `templates/<folder>/index.html` - the animation page; `DESIGN.md` - the style spec; `NOTES.md` - how it was built; `preview.mp4`, `poster.jpg` - the finished clip and its thumbnail; `assets/` or `fonts/` - what the page needs
- `tools/record.py` - the recorder
