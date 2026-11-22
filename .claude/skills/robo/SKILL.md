---
name: robo
description: The ROBO slide/design style - static infographic visuals with dot-matrix (halftone) art, Outfit + Doto type, paper-white/black/orange palette. Routes to lite.md (quick/discardable HTML), slides.md (decks), apps.md (tools/UI), courses.md (course landing pages), or infographic.md (screenshot-ready infographics). Triggers on "/robo", "/robo lite", "/robo light", "robo lite", "robo slides", "robo design", "robo app", "robo course page", "robo infographic", "make robo slides", "make robo infographic", "robo style".
---

# /robo - The ROBO Visual Style

This house style, locked. Static, professional, infographic-heavy, dot-matrix art. Defined 2026-06-11 from the engine-bay exploration (now kept durably in this skill's `references/` folder).

**This file = the BASELINE.** Palette, type, the dot-matrix technique, and the shared components below apply to **every** robo build. Then read the one file that matches what you're making:

| Building... | Read | Covers |
|---|---|---|
| **Quick / discardable HTML** (summary, one-pager, comparison, scratch report) | **`lite.md`** | self-contained tokens - read ONLY that file, skip this baseline. Triggered by "/robo light", "/robo lite", "robo lite", or any robo HTML you call quick/throwaway |
| Slides, decks, presentations **in /robo static style** | **`slides.md`** | layout, scroll-snap, arrow-key nav, motion extension, slide workflow |
| Apps, tools, dashboards, web UI | **`apps.md`** | dark/light toggle (default), app-shell patterns |
| Course / curriculum landing pages | **`courses.md`** | volume+module spine, headshot hero, per-volume accents, the course-landing peg |
| **Infographic / one-pager visual** you'll screenshot (a take, a list, a concept) | **`infographic.md`** | pixel-sprite icons (NEVER line-art), agent sprites varied with A1 = orange lead, hex nugget, dot-matrix texture. Defaults to a normal scrollable page (square only if asked). Read this + the baseline. Triggered by "robo infographic", "/robo infographic", or any robo summary visual to screenshot |
| **Animated background** behind any build (hero, landing, deck) | **`backgrounds.md`** | 11 reusable animated dot-matrix backgrounds (SWELL, COMET, HONEYCOMB, SPRITE MARCH, MORPH MARK…) + the only-animate-visible engine. Live gallery: `references/dot-backgrounds.html` |
| **Dot-matrix from a PHOTO, or an animated SUBJECT** (not a math shape) | the **"Dot-matrix from a source"** section below | drop-in image→dots converter + a reusable animated-scene engine. Tools: `references/dot-source-image.html`, `references/dot-source-scene.html` |
| **Interactive text** (hero words made of dots that scatter around the mouse) | the **"Particle typography"** section below | reusable `particleText()` engine - text→dots, spring physics, mouse repulsion with momentum. Tool: `references/particle-text.html` |
| **Other interactive dot effects** (torch reveal, flow field, constellation, elastic grid, shape morph) | the **"Interactive dot effects"** section below | 5 approved mouse-driven effects, one copy-paste IIFE each. Tool: `references/interactive-effects.html` |
| **Print PDF guide** (A4, light mode, selectable text, copy-paste prompts) | - | hand-authored A4 pages, `.prompt` cards, Chrome `--print-to-pdf` |

Building both or unsure? The baseline alone carries the look - pull both routed files if the job spans them.

**Component library (added 2026-07-07):** `components/gallery.html` in this skill folder - 32 reusable /robo components, one self-contained HTML each + copy-paste snippets in the gallery. 22 core pieces (buttons, card, stat tiles, table, nav, hero, section header, callout, quote, timeline, pricing, progress, badges, bar/line/donut charts, footer, illustration frame, form input, checklist, agent row, dividers) + 10 SIGNATURE pieces unique to the house style (flip-dot ticker, thermal receipt card, mouse-driven light-play sphere, streak heatmap, radar chart, dot gauge, session ticket, leaderboard with agent sprites, agent terminal with typewriter, kinetic display marquee). All token-locked, dark/light toggle (`robo-theme`), hex favicon. Copy from here before hand-building any of these pieces.

**Improving this style:** update the skill and brand book together.

**Brand book (open FIRST):** [`brand-book.html`](brand-book.html) in this skill folder - the style documenting itself: colors, type ramp with locked weights, dot-matrix principles, shape recipe thumbnails, card + icon spec, layout rules. Built entirely in /robo style; match it.

**Other references** (in this skill's `references/` folder): `references/dot-backgrounds.html` (11 animated dot-matrix backgrounds - see `backgrounds.md`), `references/dot-source-image.html` + `references/dot-source-scene.html` (source-sampled dot-matrix: image converter + animated-scene engine - see "Dot-matrix from a source"), `references/dot-shading.html` + `references/dot-objects.html` (**shaded-illustration quality benchmark** - see the "illustrations must be shaded" rule), `references/dot-agents-bob.html` (sprites bobbing - solid sprites only; sprites never get a dot-matrix treatment), `references/particle-text.html` (interactive particle typography - text as dots that scatter around the mouse; see "Particle typography"), `references/interactive-effects.html` (the 5 approved interactive dot effects - torch reveal, flow field, constellation, elastic grid, shape morph; see "Interactive dot effects").

---

## Default mark - the Faceted Mark (locked 2026-06-29)

**Every /robo build's default brand mark is the Faceted Mark** - a solid low-poly gem. Use it as the hero/brand mark by default unless you name another. It's a clean `currentColor` SVG, so colour it orange by setting `color:#ff6b1a` on it. Supersedes the earlier dot-matrix "gradient fill" twin, the nugget-blob, and the dashboard cube for default use. ("hex nugget" refers to this mark.)

Inline it verbatim; set the wrapper `color` to orange:

```html
<svg class="mark" viewBox="0 0 80 80" aria-label="brand mark" style="width:80px;height:80px;color:#ff6b1a">
  <path d="M58 24 L62 28 L66 46 L62 42 Z" fill="currentColor" opacity="0.55" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M62 42 L66 46 L52 64 L48 60 Z" fill="currentColor" opacity="0.55" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M48 60 L52 64 L28 60 L24 56 Z" fill="currentColor" opacity="0.55" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
  <path d="M38 18 L58 24 L62 42 L48 60 L24 56 L18 34 Z" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/>
</svg>
```
Need a dot-matrix version for a deck visual instead? Its halftone twin is a hex `inPoly` brightness function with a top-left→bottom-right size gradient (see the halftone engine + recipe library below). The solid SVG above is the default.

## More defaults (locked 2026-06-29)

Apply these by default on /robo builds unless specified otherwise:

- **Line-art scenes** are a default for concrete visuals/vignettes (see "Line-art scenes" below). Vary the sprites.
- **Use the agent icons** (the 6 sprites) by default - they're the sprite set. Vary them across a build; A1 is the lead sprite / the one highlighted.
- **Cards = the block-card effect.** 3D stacked-depth card (two `::before`/`::after` offset layers in the accent colour), an SVG icon up top, and the hover: lift `transform:translate(-2px,-6px)` + solid accent shadow `box-shadow:10px 10px 0 var(--c)`, title → accent colour, topic letter-spacing widens, icon nudges `translateY(-3px) rotate(-8deg)`, plus a staggered in-view fade-up entrance.
- **Hex cursor.** Default the mouse to a custom hex pointer that GLOWS orange when it's over anything clickable (links, buttons, cards). Hide the native cursor; a JS follower tracks the mouse and brightens on clickable hover.
- **Orange buttons = white text.** Any orange-filled button has `#fff` text in front (never ink-on-orange by default).
- **Favicon ALWAYS (locked 2026-07-01).** Every /robo build ships with an inline SVG favicon so the browser tab is never blank. Default = the orange faceted hex; swap in a content-relevant minimalist glyph when there's an obvious one (a chart for a data page, a coin for money, a bolt for speed). Paste right after `<title>` (dark pages can wrap it on a rounded ink square, paper pages use the bare hex):
  ```html
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cpath d='M38 18 L58 24 L62 42 L48 60 L24 56 L18 34 Z' fill='%23ff6b1a'/%3E%3C/svg%3E">
  ```

## Colors (LOCKED)

| Role | Value | Use |
|---|---|---|
| Main background | `#f2efe8` (paper white; `#faf8f2` for cards on it) | default light bg |
| Secondary background | `#131311` (near-black) | emphasis slides, half-slide splits, dark sections, app dark mode |
| Ink (text on light) | `#1c1a16` | all text on paper |
| Cream (text on dark) | `#e8e2d2` | all text on black |
| Muted | `#6f6a5c` light / `#8d8775` dark | secondary text |
| **Highlight** | `#ff6b1a` orange | the ONLY accent. Emphasis words, key dots, hero shapes |
| Secondary highlight | `#f5a623` yellow | **ONLY when explicitly asked.** Never by default. When granted, keep it a cameo - 1-2 small appearances per deck (a stream, rare flecks), never a second co-equal accent. Precedent: brand-book.html hourglass stream + closer-wave flecks |

No other colors. No teal/violet/cyan in this style.

**Orange discipline (2026-06-12):** orange marks ONE deliberate highlight - the thing the slide is telling you to pick or look at (e.g. the recommended option in a list). If nothing on the slide needs highlighting, NO box/card/chip gets orange - everything stays ink on paper. Never orange elements just for visual variety or to "show" a detail the layout already shows (e.g. don't orange the split-word chips on a tokens slide - the split is visible by itself). Doto emphasis words in headings and orange stat numbers are fine; orange borders/shadows on boxes need a reason you could say out loud.

## Typography (LOCKED)

| Font | Role | Rules |
|---|---|---|
| **Outfit** | Everything by default | Headings **500** (corrected: 700-800 too thick), tight letter-spacing (-1 to -2px). Body **400** (corrected: 100-300 too thin). Kickers: weight 400, letterspaced 6px, uppercase. |
| **Doto** (Google Fonts, weight 900) | The pixel font | **Headers only**, to emphasize 1-2 words inside an Outfit heading (`The system is <span Doto>YOURS</span>`). Usually orange. Also OK for big standalone stats/numbers. Never body text. |
| **A bold display font of your choice** (self-host any you like) | Marquee | **Very sparingly** - big 1-3 word hero moments only. |

One display voice per slide: a slide uses Doto emphasis OR the display marquee, never both.

**Doto spacing rule (TOPLINE, LOCKED - updated 2026-06-29):** Doto glyphs sit tight against their box on BOTH edges, so inline Doto emphasis ALWAYS needs extra breathing room **before AND after** - not just before. Always include `.doto { margin: 0 0.18em; }` (both sides) so a Doto span never collides with the Outfit text around it. This is a topline rule: every /robo build with Doto applies it globally. Harmless on line-start/line-end spans. (Superseded the older `margin-left` only rule - the font is tight on both edges.)

Import block:
```html
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@100;200;300;400;500;600;700;800;900&family=Doto:wght@400;600;700;900&display=swap" rel="stylesheet">
```

## Visuals - dot-matrix halftone (THE house technique)

Every visual is rendered as a **variable-thickness dot matrix**: dots on a fixed grid where dot RADIUS comes from a brightness function - shapes emerge from dot size, like halftone print. Render on `<canvas>` with this engine (copy verbatim into every build):

```js
function halftone(id, w, h, step, maxR, color, fn, color2, fn2) {
  const c = document.getElementById(id); if (!c) return;
  const ctx = c.getContext('2d'); const dpr = window.devicePixelRatio || 1;
  c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px'; ctx.scale(dpr, dpr);
  for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
    const u = x / w, v = y / h;
    let b = fn(u, v), col = color;
    if (fn2) { const b2 = fn2(u, v); if (b2 > b) { b = b2; col = color2; } }
    if (b <= 0.02) continue;
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, Math.min(maxR, b * maxR), 0, Math.PI * 2); ctx.fill();
  }
}
function pn(x, y) { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); }   // deterministic noise
function inPoly(pts, u, v) { let s = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) if ((pts[i][1] > v) !== (pts[j][1] > v) && u < (pts[j][0] - pts[i][0]) * (v - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) s = !s; return s; }
```

Conventions:
- **Color-scheme guard (2026-06-12):** every deck/page gets `html { color-scheme: light; }` (plus `dark` on the dark-theme selector if there's a theme toggle) so Chrome's Auto Dark Mode never inverts the palette.
- **Text over dots rule (LOCKED):** if text sits on top of a dot-matrix area, the dots behind the text drop to ~20% opacity (80% transparent) - e.g. `rgba(255,107,26,0.2)`. Never full-strength dots under same-color text. Alternatives that also satisfy the rule: leave a hollow zone in the brightness function where the text sits (sunburst-style), or reduce the field's alpha in a radius around the text block.
- Two layers max per shape: ink/cream field + one orange feature layer (`fn2`).
- **Dot size - default to SMALL (locked 2026-06-29).** note: dots often run too big; whenever you do dot matrix, default to this calibration: `step` ~6px, `maxR` ≈ 0.3×step (~1.8px) - a fine, tight halftone (in the sampling tools this is "density 6, dot size 30"). Go bigger (`maxR` up to ~0.45×step) ONLY for a deliberate hero shape/subject that would otherwise read too dark or sparse. Use `pn()` for texture, never `Math.random()` (renders must be reproducible).
- **Illustrations MUST be shaded - the quality bar (locked 2026-06-29).** A dot-matrix *illustration* is only acceptable when **dot size VARIES to show form**: fat dots in the light, tiny dots in shadow. Flat fills (every dot the same size) are for flat icons/diagrams only - never for an object you're illustrating (that's why a flat-filled desk looks flat). Put the light & shade IN the source first: a canvas gradient, or a lambert lighting calc (`brightness = max(0, normal·lightDir)` + small ambient), then the dots follow. Quantized faces (top/left/right at 3 brightnesses) read as a solid; a gloss highlight reads as polished. **Benchmarks = the bar to hit:** `references/dot-shading.html` (flat-vs-shaded, sphere/cylinder/cube/cone, brain) and `references/dot-objects.html` (shaded bar chart, rocket, nugget, calendar).
- Light bg → ink dots `rgba(28,26,22,0.88)`. Dark bg → cream dots `rgba(232,226,210,0.85)`. Orange `#ff6b1a` for the feature.

**Recipe library** (worked brightness functions in the reference decks):
- **Sphere** - lambert shading: `z = sqrt(r²-d²)`, brightness from light vector. Optional facet/grid quantization (disco ball, globe).
- **Brand hexagon** - `inPoly(HEX, u, v)` + diagonal light; define your own polygon points.
- **Arrow** - shaft+head region test, brightness ramps toward tip.
- **Bar chart** - column index from `floor(u*n)`, dots appear above `1-height`, thicken upward. Data slides stay in-style.
- **Wave** - sine crest, dots thicken with depth below it.
- **Sunburst** - `sin(angle*rays)` × radial falloff, hollow center for type.
- **Mountain / hourglass / vortex / cube / lightning** - write a brightness function per shape.

**Banned shape: ring/orbit** (concentric circles with core + satellites). Rejected - don't suggest or build it. If you need a "core + parts" metaphor, use the pipeline cards, the cube, or the brand hexagon instead.

New shapes: write a new brightness function (10-30 lines). Cheap in tokens - never hand-place dots, never emit thousands of SVG circles.

## Dot-matrix from a SOURCE - photos + animated scenes (added 2026-06-29)

The engine above builds dots from **math** (`fn(u,v)` → brightness). There's a SECOND way to make the exact same dots: **sample a source.** Draw anything into a small hidden buffer - a real photo, or a live-animated scene - then size each grid dot by the brightness of the buffer pixel under it. Same look, different input. (Turn any image/video into dot art. Mapped into /robo 2026-06-29.)

**Which dot engine to reach for:**

| Need | Engine |
|---|---|
| abstract shape, icon, data viz, brand mark, **tiling background** | math `halftone(fn)` above + `backgrounds.md` - reproducible, weightless |
| **a real photo / artwork** as dots | `references/dot-source-image.html` |
| **a moving subject** (launch, loader, hero loop, equalizer) | `references/dot-source-scene.html` |

**`references/dot-source-image.html`** - drop / paste (Ctrl+V) / pick any image → dot matrix. Modes: **Source** (original colours, asciilab "keep colours"), **Mono** (all-orange halftone), **Duo** (ink/cream base + orange on warm pixels = the newsprint look). Sliders: density (cell px), dot size, contrast, brightness, invert; round-dots or square-grid; PNG export. **Defaults locked (2026-06-29): density 6, dot size 30** (fine, tight halftone). Deep-link / headless params: `?src=<file-or-url>&mode=&bg=&density=&contrast=`.

**`references/dot-source-scene.html`** - the reusable ANIMATED engine. A **scene is one function** `(bx, cols, rows, t, dt, api) => drawsIntoBuffer`; the engine clears, dot-passes, and loops it every frame. **Add a scene = add one function to `SCENES`** - nothing else changes. Ships with `rocket` (particle launch), `swell` (wave field), `bars` (equalizer). Modes Source/Mono/Paper, density + dot sliders, play/pause, `?scene=&seek=` for deep links. Copy the fenced ENGINE block + one scene into any build (hero loop, loading state, intro sting).

**Rules that carry over:** paper bg → ink dots, black bg → source/cream dots; **cell ~6px, `maxR` ≈ 0.3×cell - the locked small-dot default (see conventions above)**; text-over-dots still drops the field to ~20%. Two exceptions to the usual discipline, by nature: a full-image render isn't "one orange accent" (the whole picture is the subject), and **animated scenes MAY use `Math.random()`** for live motion - but a STATIC photo render and all math/background shapes stay deterministic (`pn()` only). A baked photo look is a live canvas that re-samples each load - **export the PNG** if a deck needs it as a fixed asset.

## Particle typography - interactive text (added 2026-07-08)

The THIRD dot input after math and source-sampling: **live text.** A phrase is drawn into a hidden buffer, sampled into ~1900-3200 square dots, and each dot becomes a particle that **springs to its letter position** while the **mouse repels it with momentum** (dots inherit cursor velocity, so fast swipes fling them). A faint idle "breath" keeps the field alive; phrases can cycle. Adapted to /robo tokens 2026-07-08.

**When to reach for it:** hero text on landing pages/decks, section titles you want interactive, "more visualisation" moments. It's an ANIMATED effect, so it lives in the same lane as `backgrounds.md` - one per page, usually the hero. Never body text; 1-4 short lines max (≤ ~26 chars each).

**Tool + engine:** `references/particle-text.html` - live demo (dark + paper stages, custom phrase input, Outfit/Doto font toggle) with the full copy-paste `particleText(canvas, opts)` engine in a fenced block. Returns `{ setText, setFont, destroy }`.

**Rules that carry over:**
- Palette: black bg → cream dots `#e8e2d2`, paper bg → ink dots `#1c1a16`; orange `#ff6b1a` flecks at ~7% (`accentFrac`) - keep it a fleck, orange discipline applies.
- Sampling font: **Outfit 600** default (fills well); **Doto 900** for a sparser double-dotted look. Wait for `document.fonts.ready` before sampling or the dots form in the fallback font.
- Square dots (`fillRect`), sizes ~1.4/2.4px desktop - consistent with the small-dot calibration.
- Honors `prefers-reduced-motion` (static render at targets). Physics constants are tuned - spring 0.012, damping 0.86, repulsion radius 110, mouse momentum 0.06 - change them only with a reason.
- This effect MAY use `Math.random()` (live motion, same exception as animated scenes).
- Canvas gotchas below still apply (explicit `width:100%;height:100%`, never `inset:0` alone).

## Interactive dot effects - the approved five (added 2026-07-08)

Five more mouse-driven effects in the particle-typography family. **Live demo + copy-paste source: `references/interactive-effects.html`** - each effect is one self-contained IIFE sharing a small `setup()` helper (canvas sizing + mouse-with-velocity); copy the helper block + the effect's IIFE into any build. All honor `prefers-reduced-motion` (static or skipped animation) and follow palette + small-dot rules.

| # | Effect | What it does | Reach for it when |
|---|---|---|---|
| 01 | **Torch reveal** | dark canvas; a shaded dot-matrix subject (lambert-lit, meets the shading quality bar) materialises only where the cursor sweeps, then slowly fades (decay memory leaves a trace) | "explore this" heroes, teasers - make the viewer earn the visual |
| 02 | **Flow field** | dot-dust drifts along a value-noise current with faint trails; cursor stirs and drags the field | the CALM ambient background - quiet enough to sit behind content |
| 03 | **Agent constellation** | drifting square nodes; near the cursor they link with lines and the closest go orange and swell | community / multi-agent / network-metaphor slides |
| 04 | **Elastic grid** | perfect halftone grid bows away from the cursor and springs back; displaced dots swell + flash orange; **click = shockwave ring** | disciplined texture behind section headers where wilder effects are too loud |
| 05 | **Shape morph** | one particle pool reforms between brand shapes (hex → bar chart → arrow → nugget), auto-cycle + click-to-advance, same spring/fling physics as particle text | storytelling transitions - "the idea becomes the product becomes the result" |

**Usage rules:**
- Still ONE animated effect per page (same lane as `backgrounds.md` + particle typography - these don't stack).
- Palette carries over: black bg → cream dots, paper bg → ink dots, orange as the reaction highlight only (flecks ≤ ~9%, or displacement/nearness flash).
- Torch-reveal subjects must be SHADED (the illustration quality bar applies - its sphere is lambert-lit, its hex 3-tone quantized).
- Interactive effects MAY use `Math.random()` (live motion exception); static renders stay `pn()`.
- Physics constants are tuned (springs 0.012-0.06, damping 0.82-0.94, mouse momentum ~0.05-0.06) - keep them unless there's a reason.

## Line-art scenes (the SECOND illustration technique - added 2026-06-29)

The house style has TWO illustration languages. Dot-matrix (above) is the default for **abstract / data / texture** visuals. **Line-art scenes** are the default when asked to **"visualize"** something concrete - a desk, money, a climb, a tool, a little illustrated vignette. (2026-06-29: use line-art scene style whenever asked to visualize something.)

**The look:** flat, stroked line drawings, like clean editorial spot illustrations. One inline `<svg>` with:
```
<svg viewBox="0 0 300 200" fill="none" stroke="var(--line)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"> … </svg>
```
Solid objects use `fill="var(--fillbg)"` (the slide's own bg) so they read as clean cut-outs with outlines. Orange (`var(--acc)`) marks the ONE highlight - same orange discipline as dot-matrix (one deliberate thing, never decoration).

**Palette via CSS vars** so a scene themes itself on paper vs black with no per-shape edits:
```css
.slide      { --line:#1c1a16; --fillbg:#f2efe8; --acc:#ff6b1a; }   /* paper */
.slide.dark { --line:#e8e2d2; --fillbg:#131311; }                   /* black */
```

**Agents live inside scenes.** Reuse the 6 agent pixel sprites as orange SVG rects, and **VARY them across a deck** - don't use A1 for everything (A1 is still the lead / the one to highlight). Self-contained helper:
```js
const AGENTS={
 a1:[[0,0,1,0],[1,1,1,1],[1,1,1,1],[1,0,1,1],[1,1,1,1],[1,1,1,1],[1,0,0,1],[0,0,0,0]],
 a2:[[0,0,1,0],[0,1,1,1],[1,1,1,1],[0,1,0,1],[0,1,1,1],[1,1,1,0],[0,0,1,0],[0,0,0,0]],
 a3:[[0,0,1,0],[0,0,1,1],[0,1,1,1],[0,1,0,1],[0,1,1,1],[1,1,1,1],[1,0,1,0],[0,0,0,0]],
 a4:[[1,0,0,0],[1,1,0,0],[0,1,1,1],[0,1,1,1],[1,1,0,1],[0,1,1,1],[0,1,0,1],[0,0,0,0]],
 a5:[[0,0,1,0],[0,0,1,1],[0,1,1,1],[1,1,0,1],[1,1,1,1],[1,1,1,1],[1,0,0,1],[0,0,0,0]],
 a6:[[0,0,1,1],[0,1,1,1],[1,1,1,1],[1,1,0,1],[1,1,1,1],[0,1,1,1],[0,0,1,1],[0,0,0,0]]
}; // 8 rows × 4 cols, mirrored to 8 wide
function agSvg(key,ox,oy,c){ const d=AGENTS[key]||AGENTS.a1; let s='<g fill="var(--acc)" stroke="none" shape-rendering="crispEdges">';
  for(let y=0;y<8;y++) for(let x=0;x<4;x++){ if(d[y][x]){
    s+=`<rect x="${ox+x*c}" y="${oy+y*c}" width="${c}" height="${c}"/>`;
    s+=`<rect x="${ox+(7-x)*c}" y="${oy+y*c}" width="${c}" height="${c}"/>`; } } return s+'</g>'; }
```

**Worked sources to copy from:**
- A worked desk scene - the `.os-desk` SVG (desk, monitor with an orange screen-dot grid, mug + steam, cactus). The origin of this technique.
- A worked levels deck - 5 context scenes: desk+A1, coin-stacks+`$`+A4, leaning slide-pile+clock+A3, sunburst slide+A2, staircase+flag+A6.

**Mixing:** a deck can use BOTH languages - line-art for story/context beats, dot-matrix for abstract/data/levels. Never mix the two inside one illustration. A moving dot-matrix background (`backgrounds.md`) can sit behind line-art scenes (keep it ~0.2 alpha so the linework stays crisp).

**Gotchas (learned 2026-06-29, all three bit me):**
1. **Colour via CSS classes, NOT `var()` in SVG attributes.** `stroke="var(--line)"` as an *attribute* does NOT resolve in Chrome - the shape renders with no stroke (invisible). Put `stroke:var(--line); fill:none` on `.scene svg` in CSS, then use classes on shapes: `.fb{fill:var(--fillbg)} .ac{stroke:var(--acc)} .acf{fill:var(--acc);stroke:none} .inkf{fill:var(--line);stroke:none}`. Same for agent groups - give `agSvg` a class, not a `fill="var(--acc)"` attribute.
2. **Inline `<svg>` collapses to 0 height in a flex column.** Set `aspect-ratio` (e.g. `3/2`) on `.scene svg` alongside `width:100%`, or it silently renders at zero height.
3. **Never reuse a `const` name in one script** (e.g. `dots` for both an eye-scene and `[...nav.children]`). A duplicate `const` is a PARSE error that silently kills the ENTIRE script - every JS-driven visual goes blank. Always headless-verify that JS-built visuals actually render (a quick `--dump-dom` + an `onerror` box catches it fast).

## Cards + pixel icons

**Card spec = "Ink Well Soft" (locked 2026-07-08 - REPLACES the old card everywhere).** The old dark-mode inversion (full-cream 2px border + cream shadow) is DEAD - it read as glaring white frames. New spec: 8px radius, light keeps the ink frame, **dark drops the border entirely** - the card is a raised warm surface on a hard black offset shadow. Interactions ship WITH the card and are identical in both modes.

```css
/* light */
.card { background:#faf8f2; border:2px solid #1c1a16; border-radius:8px;
        box-shadow:6px 6px 0 rgba(28,26,22,.9); padding:16px 18px;
        display:grid; grid-template-columns:52px 1fr; gap:16px; align-items:center;
        transition:transform .18s ease, box-shadow .18s ease; }
.card.hot { border-color:#ff6b1a; box-shadow:6px 6px 0 #ff6b1a; }
.card:hover { transform:translate(-2px,-4px); box-shadow:9px 9px 0 rgba(28,26,22,.9); }
.card.hot:hover { box-shadow:9px 9px 0 #ff6b1a; }
/* dark - NO border, surface does the work */
.dark .card { background:#24221c; border-color:#24221c; box-shadow:6px 6px 0 #000; }
.dark .card:hover { box-shadow:9px 9px 0 #000; }
.dark .card.hot { box-shadow:6px 6px 0 #ff6b1a; }   /* + title goes orange */
.dark .card.hot:hover { box-shadow:9px 9px 0 #ff6b1a; }
```

**Buttons + inputs follow the same physics (both modes identical):**
- Button rest = flat, no shadow. Hover = `translate(-2px,-2px)` + `5px 5px 0` shadow fades in (.15s; ink on light, #000 on dark). Click/active = `translate(1px,1px)`, shadow collapses to 0 with a fast `.06s` press.
- Input focus = orange offset shadow **fades in**: base `box-shadow:4px 4px 0 rgba(255,107,26,0)` → focus `rgba(255,107,26,1)`, `transition:box-shadow .3s`. Light mode ALSO turns its 2px border orange. (The fade trick: animate the shadow COLOR from transparent orange, never pop the shadow in.)
- Buttons/inputs r8 too. Dark ghost button/input = borderless `#24221c` surface, like the card.
- `::selection { background:#ff6b1a; color:#fff; }` on every build.

**Icons are pixel sprites, not vector SVGs.** Render on canvas from row-string grids (crisp at any scale via integer pixel cells):

```js
function sprite(canvasId, rows, palette, px) {
  const c = document.getElementById(canvasId); if (!c) return;
  const ctx = c.getContext('2d');
  c.width = rows[0].length * px; c.height = rows.length * px;
  rows.forEach((row, y) => [...row].forEach((k, x) => {
    if (k !== '.') { ctx.fillStyle = palette[k]; ctx.fillRect(x * px, y * px, px, px); }
  }));
}
// usage: 10x10 grid, '.'=empty, letter keys map to palette colors
sprite('icFolder', ['..........','.kkkk.....','k....k....','k....kkkkk','k........k','k........k','k........k','k........k','.kkkkkkkk.','..........'], { k:'#1c1a16' }, 4.5);
```

### The brand marks + icons (canonical - locked 2026-06-16)

Four marks recur across robo builds. Know which is which - they are NOT interchangeable. Each has a source/solid form and a dot-matrix twin.

| Mark | Belongs to | What it is | Source / solid form | Dot-matrix twin |
|---|---|---|---|---|
| **Cube hexagon** | **the dashboard** (the product) | command center for AI agents | orange outlined cube, viewBox `0 0 48 48`, path `M24 6l18 10v16L24 42 6 32V16Z` + two facet lines. In the app's design system + favicon. **Never recreate - copy the markup.** | halftone outline, dots fat on the stroke fading off it |
| **Faceted mark** | **the studio** (the maker) | creator of the dashboard, home of the sprite set | solid low-poly gem with bevel - inline SVG (above) | halftone gradient (big top-left → tiny bottom-right) |
| **Nugget logo** | **the brand** (brand / community) | the glossy nugget | your brand logo image | exact dotted copy in the logo's real colors; minimalist + faded-out variants exist |
| **Agent icons (6)** | **the sprite set** | A1 · A2 · A3 · A4 · A5 · A6 | 8×8 pixel sprites (mirrored 4-col arrays; see the AGENTS object above) | n/a - they ARE pixel sprites |

**Agent-icon rules:** recolor to /robo palette - ink `#1c1a16` on light (cream `#e8e2d2` on dark), with **A1 (the lead) in orange `#ff6b1a`** by default; orange moves to whichever sprite a slide highlights. Never the app's agent colors (blue/purple/teal/red) in /robo builds. A1 is the lead sprite - in a row of all six, A1 is the orange one.

**Nugget colors note:** the brand logo is the ONE place /robo uses colors beyond the palette (dark-teal outline, yellow rim, gold→orange body, white gloss) - only when reproducing the logo exactly. Any other nugget treatment stays orange-on-paper like the rest of the style.

**Agent icons: ALWAYS solid pixel sprites + BOB BY DEFAULT (locked 2026-06-29).** Two locked rules for agent sprites: (1) render them as **solid pixel sprites ONLY - never a shaded/dot-matrix/halftone version of an agent** (a dotted agent reads as a blob and loses the character; agents are the one thing in /robo that does NOT get a dot-matrix treatment). (2) They **bob by default** - whenever you place an agent sprite it hops, never static. Worked demo: `references/dot-agents-bob.html` (solid sprites, the exact hop).

**Only agent icons bob** - the brand marks (cube, faceted, nugget) stay static. The bob is the ONE exception to the zero-animation rule: a quick hop on the WHOLE sprite as one group - `@keyframes { 0%,100% translateY(0); 15% translateY(-0.6px); 30% translateY(0) }`, 1.2s ease-in-out infinite, staggered `0.2s × index`, with a **ground-shadow ellipse that squashes in time** (`opacity .12→.06`, `scaleX 1→.7` at 15%) under each sprite. Do NOT use a body/legs split - it leaves the bottom pixel row behind mid-bob (rejected; the sprites work because their last row is empty, so the whole sprite hops as one).

Icon rules:
- 10×10 or 12×12 grids, one color per icon: ink `#1c1a16` on light, cream `#e8e2d2` on dark, orange `#ff6b1a` ONLY for the highlight card's icon.
- Outline style preferred (hollow shapes) - matches the dot-matrix lightness. Solid fill reserved for the orange highlight icon.
- Set `image-rendering: pixelated` if the canvas is CSS-scaled.
- Common sprites: folder, chevron/skills, document/logs, engine block, down-arrow - render each from the `sprite()` helper above.

## Canvas gotchas (learned 2026-06-12, both bit us)

1. **`inset: 0` does NOT stretch a canvas.** Canvas is a replaced element - absolute positioning with `inset: 0` leaves it at its intrinsic 300x150. Always set explicit size: `width: 100%; height: 100%` (or `100vw/100vh` for fixed backgrounds). Symptom: the dot effect renders in a tiny patch at the top-left.
2. **Verifying slides headlessly:** anchor links (`#s3`) don't scroll reliably in headless Chrome with scroll-snap. To screenshot one slide, write a temp copy that hides the others: append `.slide{display:none!important} #s3{display:flex!important}` to the CSS. Don't slice sections out of the file - the shared JS dies on missing elements and every canvas goes blank.
3. **Declare `color-scheme` on any page with a light/dark toggle.** `html { color-scheme: light; }` + `html[data-theme="dark"] { color-scheme: dark; }`. Without it, Chrome's Auto Dark Mode can invert the palette on its own (dark cards can turn light, 2026-06-12).

## Arrow/connector rule (never break)

Never hand-place an arrow over HTML with absolute coordinates. Either:
1. arrows + endpoints live in the **same canvas/SVG coordinate system**, or
2. the arrow gets its **own grid cell** between boxes (`grid-template-columns: auto 1fr auto 1fr auto`), or
3. measure endpoints at runtime with `getBoundingClientRect()`.

## What this style is NOT

- Not multi-color (no teal/violet/cyan accents)
- Not text-heavy (no paragraph slides, no bullet walls)
- Not Source Serif 4 (that's the classic deck voice; /robo is Outfit-only + the two display fonts)
- No hex-mesh background, no pixel-agent scatter, no watermark - clean canvas
- For full-motion decks, /robo motion = sparing dot-matrix animation per the Motion Extension in `slides.md` only
