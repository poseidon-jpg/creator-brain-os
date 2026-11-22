# /robo infographic - screenshot-ready infographics

**Trigger:** "robo infographic", "/robo infographic", "make a robo infographic", or any /robo visual that summarises something you'll **screenshot** (a tweet take, a list, a concept, a breakdown).

**Read this file + the SKILL.md baseline** (palette, type, halftone engine, the agent + nugget defaults). This file is the recipe; the baseline is the look.

## What an infographic is here
A standalone visual that packs one idea into a screenshot. Not a deck (that's `slides.md`), not a throwaway one-pager (that's `lite.md`, light-mode + no art). Infographics get the full art treatment: pixel icons, agent sprites, the nugget, dot-matrix texture.

## Hard rules (the stuff that bites)

1. **Icons = pixel sprites, NEVER line-art.** Every archetype/concept icon is a pixel grid rendered as crisp SVG rects (see renderer below). Do NOT use stroked line-art SVG scenes for the icons. Line-art scenes are a separate /robo language for "visualize a concrete scene" jobs - they are not the infographic icon style. (Locked 2026-06-29 after a build wrongly used line-art; the pixel icon svg rule must hold.)
2. **Default to a normal, scrollable page** you screenshot yourself. Only build a fixed square (viewport-locked, everything must fit) when asked for "square" / "so I can screenshot it as one image". A square that tries to fit 5+ rows + header + footer clips the footer every time - avoid unless asked. (Locked 2026-06-29: default to a normal html page to screenshot.)
3. **Use the agent sprites, vary them, A1 is the orange lead.** One sprite per item/card (A2, A3, A4, A5, A6 in cream), with A1 in orange in the header and/or a full lineup. Don't use A1 for everything.
4. **Hex nugget = the brand mark.** Drop the halftone hex nugget (the default mark, code in SKILL.md) top-right or in the footer.
5. **Dot-matrix texture on the background** - a faint dot grid so it reads as /robo (CSS stand-in below, or the canvas halftone for the hero).
6. **Orange discipline.** Orange for: the nugget, Doto numbers, the one highlight word, A1. Keep icons cream with at most one orange accent pixel each. Don't flood it.

## Palette + type (same as baseline)
- Dark (default for infographics you screenshot for social): bg `#131311`, card `#1a1a16`, cream `#e8e2d2`, muted `#8d8775`, orange `#ff6b1a`. Light = paper `#f2efe8` if asked.
- `html{color-scheme:dark}` (or `light`) so Chrome never inverts it.
- Outfit (headings 500, body 400, kickers 400/uppercase/letterspaced). Doto 900 orange for numbers + 1 emphasis word. No display marquee unless a 1-3 word hero.
- Cards: 2px border, solid offset shadow (`7px 7px 0` cream-low-alpha on dark), rounded.

## Canonical structure
The "5 archetypes of building now" pattern: header with the A1 lead sprite + nugget, 5 cards each with a pixel icon + a different agent sprite + Doto number, dot texture, agent lineup footer. Copy that structure.

## Drop-in renderers (copy verbatim)

```js
// 1) pixel icon: grid of strings, '.'=empty, 'k'=cream, 'o'=orange accent
const CREAM='#e8e2d2', ORANGE='#ff6b1a';
function pixelSVG(grid, pal){ const n=grid.length,m=grid[0].length; let r='';
  for(let y=0;y<n;y++)for(let x=0;x<m;x++){const ch=grid[y][x]; if(ch==='.')continue;
    r+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${pal[ch]}"/>`;}
  return `<svg viewBox="0 0 ${m} ${n}" shape-rendering="crispEdges">${r}</svg>`; }
// usage: pixelSVG(ICON, {k:CREAM,o:ORANGE}); CSS: svg{width:90px;image-rendering:pixelated}

// 2) agent sprite (8x8, 4 cols mirrored). A1 orange (lead), rest cream.
const AGENTS={
 a1:[[0,0,1,0],[1,1,1,1],[1,1,1,1],[1,0,1,1],[1,1,1,1],[1,1,1,1],[1,0,0,1],[0,0,0,0]],
 a2:[[0,0,1,0],[0,1,1,1],[1,1,1,1],[0,1,0,1],[0,1,1,1],[1,1,1,0],[0,0,1,0],[0,0,0,0]],
 a3:[[0,0,1,0],[0,0,1,1],[0,1,1,1],[0,1,0,1],[0,1,1,1],[1,1,1,1],[1,0,1,0],[0,0,0,0]],
 a4:[[1,0,0,0],[1,1,0,0],[0,1,1,1],[0,1,1,1],[1,1,0,1],[0,1,1,1],[0,1,0,1],[0,0,0,0]],
 a5:[[0,0,1,0],[0,0,1,1],[0,1,1,1],[1,1,0,1],[1,1,1,1],[1,1,1,1],[1,0,0,1],[0,0,0,0]],
 a6:[[0,0,1,1],[0,1,1,1],[1,1,1,1],[1,1,0,1],[1,1,1,1],[0,1,1,1],[0,0,1,1],[0,0,0,0]]};
function agentSVG(key,color){ const d=AGENTS[key]||AGENTS.a1; let r='';
  for(let y=0;y<8;y++)for(let x=0;x<4;x++){ if(d[y][x]){
    r+=`<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`;
    r+=`<rect x="${7-x}" y="${y}" width="1" height="1" fill="${color}"/>`; } }
  return `<svg viewBox="0 0 8 8" shape-rendering="crispEdges">${r}</svg>`; }

// 3) hex nugget halftone + dot-texture bg: build the halftone twin per SKILL.md;
//    bg: background-image:radial-gradient(rgba(232,226,210,.05) 1px,transparent 1px);background-size:11px 11px;
```

### Designing a pixel icon
12×12 grid, cream body + one orange accent pixel-cluster (the "point" of the icon). Keep shapes simple and recognisable (bulb, stacked blocks, broom, rising bars, shield). Symmetry where it helps. Example (lightbulb, orange filament):
```
["....kkkk....","..kk....kk..",".k........k.","k....oo....k",
 "k...o..o...k","k...o..o...k",".k..o..o..k.",".k...oo...k.",
 "..k......k..","...kkkkkk...","...k....k...","...kkkkkk..."]
```

## Workflow
1. Build the page (normal scrollable, or square only if asked). Save it wherever you keep build output.
2. **Verify before delivering** - headless screenshot in Chrome (`--headless --screenshot --window-size=...`), Read the PNG, check nothing clips and the icons render crisp. Fix, re-shoot. Delete the scratch PNG.
3. Auto-open in Chrome (`start chrome "C:\full\path.html"`). It's ready to screenshot.
