# /robo lite - quick, discardable HTML

**Trigger:** "/robo light", "/robo lite", "robo lite", or any robo HTML you call quick / throwaway / scratch / summary.

**Token rule:** for lite jobs read **ONLY this file**. Do NOT read SKILL.md, slides.md, apps.md, or the references. Everything needed for a clean one-pager is below. (Pull SKILL.md only if you want the full dot-matrix canvas art.)

**Use for:** summaries, decision docs, one-pagers, comparison tables, quick reports. Output is disposable → save it wherever you keep build output, then auto-open in Chrome (`start chrome "C:\full\path.html"`).

## What lite drops vs full robo
- No `<canvas>` halftone engine (use the CSS dot-texture below for a hint of the look).
- No display marquee. Doto emphasis + Outfit only.
- Otherwise same palette, type, cards, and orange discipline.

## Drop-in template (copy, fill the `<main>`)
```html
<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TITLE</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'%3E%3Cpath d='M38 18 L58 24 L62 42 L48 60 L24 56 L18 34 Z' fill='%23ff6b1a'/%3E%3C/svg%3E">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&family=Doto:wght@700;900&display=swap" rel="stylesheet">
<style>
:root{--paper:#f2efe8;--card:#faf8f2;--ink:#1c1a16;--muted:#6f6a5c;--orange:#ff6b1a;}
html{color-scheme:light;} *{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--paper);color:var(--ink);font:400 16px/1.5 'Outfit',system-ui,sans-serif;
  /* subtle dot texture, lite stand-in for the halftone */
  background-image:radial-gradient(rgba(28,26,22,.05) 1px,transparent 1px);background-size:10px 10px;}
.wrap{max-width:980px;margin:0 auto;padding:56px 28px 80px;}
.kicker{font-weight:400;letter-spacing:6px;text-transform:uppercase;font-size:12px;color:var(--muted);}
h1{font-weight:500;letter-spacing:-1.5px;font-size:clamp(32px,5vw,52px);line-height:1.05;margin:8px 0 6px;}
h2{font-weight:500;letter-spacing:-1px;font-size:26px;margin:42px 0 16px;}
p{color:var(--ink);max-width:70ch;}.muted{color:var(--muted);}
.doto{font-family:'Doto',monospace;font-weight:900;color:var(--orange);margin-left:.15em;}
.lead{font-size:19px;color:var(--muted);max-width:68ch;}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px;margin-top:18px;}
.card{border:2px solid var(--ink);background:var(--card);padding:18px 20px;box-shadow:6px 6px 0 rgba(28,26,22,.9);}
.card.hot{border-color:var(--orange);box-shadow:6px 6px 0 var(--orange);}
.card h3{font-weight:600;font-size:17px;margin-bottom:6px;}
.big{font-family:'Doto',monospace;font-weight:900;font-size:30px;letter-spacing:1px;}
.big.orange{color:var(--orange);}
table{width:100%;border-collapse:collapse;margin-top:14px;font-size:15px;}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid rgba(28,26,22,.18);}
th{font-weight:600;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--muted);}
tr.hot td{background:rgba(255,107,26,.08);}
td.num{text-align:right;font-variant-numeric:tabular-nums;}
.tag{display:inline-block;border:1.5px solid var(--ink);padding:3px 9px;font-size:12px;font-weight:600;}
.tag.hot{border-color:var(--orange);color:var(--orange);}
.rule{height:2px;background:var(--ink);margin:40px 0;}
ol,ul{margin:10px 0 0 22px;}li{margin:6px 0;max-width:70ch;}
</style></head>
<body><div class="wrap"><main>
  <div class="kicker">KICKER</div>
  <h1>Heading with <span class="doto">EMPHASIS</span></h1>
  <!-- content -->
</main></div></body></html>
```

## Style rules (same as full robo)
- Palette is LOCKED: paper `#f2efe8`, card `#faf8f2`, ink `#1c1a16`, muted `#6f6a5c`, orange `#ff6b1a`. No other colours.
- **Orange = ONE highlight.** Mark only the thing the page is telling the reader to pick/look at (the recommended option, the key number). If nothing needs highlighting, keep it all ink on paper. No orange for decoration.
- Headings Outfit 500, tight letter-spacing. Body Outfit 400. Kickers 400 / 6px / uppercase.
- Doto (900, usually orange) for 1-2 emphasis words in a heading or a big standalone number. Never body text.
- Keep it light: short lines, cards and tables over paragraph walls.
- **Favicon ALWAYS (locked).** Every build gets an inline SVG favicon in the tab - it's in the template above (the orange faceted hex). Swap in a content-relevant minimalist glyph when there's an obvious one (a chart, a coin, a bolt); otherwise keep the hex. Never ship a build with the blank default tab icon.
