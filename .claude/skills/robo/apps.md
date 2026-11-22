# /robo - Apps

Robo style applied to apps, tools, dashboards, and any interactive web UI. The **baseline** (palette, type, dot-matrix, cards, pixel icons, canvas gotchas) in `SKILL.md` applies here too - this file adds the app-only rules. When you want "/robo app", a "robo tool", or a tool/dashboard in robo style, build with the baseline + everything below.

## Dark / light mode toggle - DEFAULT (locked 2026-06-16)

**Every robo application ships with a dark/light mode toggle button by default.** The user always gets to choose. Don't wait to be asked - build it in from the start.

- **First-load default = dark** (the style defaults to dark on screen). The toggle flips to the paper-white light mode.
- **Orange `#ff6b1a` stays the accent in BOTH modes** - it never changes between themes.
- **The two themes map onto the locked palette** (no new colors):

| Token | Dark mode (default) | Light mode |
|---|---|---|
| `--bg` | `#131311` near-black | `#f2efe8` paper |
| `--card` | `#1c1a16` | `#faf8f2` |
| `--text` | `#e8e2d2` cream | `#1c1a16` ink |
| `--muted` | `#8d8775` | `#6f6a5c` |
| `--accent` | `#ff6b1a` | `#ff6b1a` |

- **Persist the choice** in `localStorage` so it survives reloads.
- **Respect the color-scheme guard** (baseline canvas gotcha #3): sync `html { color-scheme }` to the active theme so Chrome's Auto Dark Mode never fights the toggle.
- **Re-render any dot-matrix canvases on theme flip** - the ink/cream dot color changes with the mode (baseline: light bg → ink dots, dark bg → cream dots). Keep a redraw function and call it inside the toggle handler.

**Drop-in pattern** (button top-right, CSS variables flipped via `[data-theme]`):

```html
<button id="themeToggle" aria-label="Toggle dark / light mode">◐</button>
<style>
  html { color-scheme: dark; }
  html[data-theme="light"] { color-scheme: light; }
  :root, html[data-theme="dark"] {
    --bg:#131311; --card:#1c1a16; --text:#e8e2d2; --muted:#8d8775; --accent:#ff6b1a;
  }
  html[data-theme="light"] {
    --bg:#f2efe8; --card:#faf8f2; --text:#1c1a16; --muted:#6f6a5c; --accent:#ff6b1a;
  }
  body { background:var(--bg); color:var(--text); transition:background .25s, color .25s; }
  #themeToggle {
    position:fixed; top:16px; right:16px; z-index:100;
    width:40px; height:40px; border:2px solid var(--text); background:var(--card);
    color:var(--text); border-radius:0; cursor:pointer; font-size:18px; line-height:1;
    font-family:'Outfit',sans-serif; box-shadow:3px 3px 0 var(--text);
  }
  #themeToggle:active { box-shadow:1px 1px 0 var(--text); transform:translate(2px,2px); }
</style>
<script>
  (function () {
    const root = document.documentElement;
    const saved = localStorage.getItem('robo-theme') || 'dark';   // default dark
    const apply = t => {
      root.setAttribute('data-theme', t);
      root.style.colorScheme = t;
      if (window.roboRedraw) window.roboRedraw();   // re-render dot-matrix canvases
    };
    apply(saved);
    document.getElementById('themeToggle').addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      localStorage.setItem('robo-theme', next);
      apply(next);
    });
  })();
</script>
```

If the app draws dot-matrix art, define `window.roboRedraw = () => { /* re-run halftone() for each canvas with the current --text dot color */ }` so the toggle repaints them. Read `var(--text)` / `var(--accent)` off `getComputedStyle(document.body)` inside the redraw so the dots track the theme.

## App-shell defaults

- **Hard edges, no rounded corners.** Buttons, cards, panels use the baseline card recipe - 2px border in `--text`, solid `3px/6px` offset shadow, `border-radius:0`. Match the brand book.
- **Outfit for all UI text** (baseline type rules). Doto only for a hero stat or a 1-2 word emphasis; never for labels or body.
- **Orange is the single action accent** - primary button, active state, the one thing you want clicked. Same orange-discipline rule as slides: if nothing needs highlighting, nothing gets orange.
- **Pixel-sprite icons, not vector icon fonts** (baseline `sprite()` engine). Recolor to `var(--text)`, orange only for the primary action.
- **Dot-matrix art is welcome as hero/empty-state/loading visuals** - it's the house technique. Keep it to one feature visual per view, two layers max, redraw on theme flip.
- Single HTML file with no build step when the tool is small enough; otherwise follow your project's stack conventions.

## App workflow

1. Parse the brief → screens/views and the one primary action per view.
2. Scaffold the shell: theme toggle (above) + Outfit type + baseline card/border system. Output to an output folder for ad-hoc tools, or the project folder for real ones.
3. Build views; lead with the data/action, decorate sparingly with dot-matrix art.
4. Wire `window.roboRedraw` if any canvas art is present.
5. Open in Chrome (`start chrome "<path>"`) when done - verify BOTH modes via the toggle before calling it finished.
