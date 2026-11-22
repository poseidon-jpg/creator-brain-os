#!/usr/bin/env node
/* Builds the RUBRIC References wall: data/index.html (next to this file)
 *
 * One static file with the data inlined, so it works two ways with no changes:
 *   - served by the bridge at http://127.0.0.1:5298/ (live: remove buttons, auto refresh)
 *   - opened straight from disk or hosted as a static site (read only; the remove
 *     buttons hide themselves when no bridge answers)
 *
 * Look: modelled on getrubric.app. Wave dot-matrix behind everything, glowing cube
 * mark, big Outfit wordmark, hard-edged orange button, CSS hex cursors. The wall
 * itself is a CSS-columns masonry of cards.
 *
 * Standalone rebuild:  node build.js
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DATA = path.join(DATA_DIR, "references.json");
const OUT = path.join(DATA_DIR, "index.html");
// Keep this list the same as TAGS in extension/popup.js.
const TAGS = ["Landing page", "Portfolio", "SaaS", "Dashboard", "Typography", "Motion",
              "Illustration", "3D", "Minimal", "Bold", "E-commerce", "Docs"];

function build(list) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const data = JSON.stringify(list || []).replace(/</g, "\\u003c");
  fs.writeFileSync(OUT, template(data), "utf8");
  return OUT;
}

function template(dataJson) {
  return `<!doctype html>
<html lang="en" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RUBRIC References</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Cpath d='M24 6l18 10v16L24 42 6 32V16Z' fill='none' stroke='%23ff6b1a' stroke-width='3' stroke-linejoin='round'/%3E%3Cpath d='M24 6v16l18 10M24 22L6 32M6 16l18 10 18-10' fill='none' stroke='%23ff6b1a' stroke-width='3' stroke-linejoin='round'/%3E%3C/svg%3E">
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  html { color-scheme: dark; scroll-behavior: smooth; }
  html[data-theme="light"] { color-scheme: light; }
  :root, html[data-theme="dark"] { --bg:#131311; --card:#24221c; --text:#e8e2d2; --muted:#8d8775; --accent:#ff6b1a; --shadow:#000; --line:transparent; --bar:rgba(19,19,17,.82); }
  html[data-theme="light"] { --bg:#f2efe8; --card:#faf8f2; --text:#1c1a16; --muted:#6f6a5c; --accent:#ff6b1a; --shadow:rgba(28,26,22,.9); --line:#1c1a16; --bar:rgba(242,239,232,.85); }
  :root {
    --cur-hex: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M14 3l9.5 5.5v11L14 25 4.5 19.5v-11z' fill='none' stroke='%23ff6b1a' stroke-width='2.6' stroke-linejoin='round'/%3E%3C/svg%3E") 14 14;
    --cur-hex-fill: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M14 3l9.5 5.5v11L14 25 4.5 19.5v-11z' fill='%23ff6b1a' stroke='%23131311' stroke-width='2' stroke-linejoin='round'/%3E%3C/svg%3E") 14 14;
  }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font:15px/1.5 'Outfit',system-ui,sans-serif; -webkit-font-smoothing:antialiased; overflow-x:hidden; transition:background .25s, color .25s; cursor:var(--cur-hex), auto; }
  a, button, .card, .chip, #themeToggle, label { cursor:var(--cur-hex-fill), pointer; }
  input, textarea { cursor:var(--cur-hex), text; }
  ::selection { background:var(--accent); color:#fff; }

  /* wave dot-matrix behind everything (same function as getrubric.app) */
  #dotBg { position:fixed; inset:0; width:100%; height:100%; z-index:0; pointer-events:none; }
  .above { position:relative; z-index:1; }

  /* fixed corners */
  .brand-corner { position:fixed; top:16px; left:20px; z-index:100; display:flex; align-items:center; gap:10px; font-weight:500; letter-spacing:-0.5px; font-size:17px; text-decoration:none; color:var(--text); }
  .brand-corner svg { display:block; }
  #themeToggle { position:fixed; top:18px; right:18px; z-index:100; width:42px; height:42px; border:2px solid var(--text); background:var(--card); color:var(--text); border-radius:0; font-size:18px; line-height:1; font-family:'Outfit',sans-serif; box-shadow:3px 3px 0 var(--shadow); transition:background .25s, color .25s, box-shadow .12s, transform .12s; }
  #themeToggle:active { box-shadow:1px 1px 0 var(--shadow); transform:translate(2px,2px); }

  /* hero */
  .hero { min-height:clamp(520px,72dvh,780px); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:96px 24px 40px; }
  .hero-hex { margin-bottom:26px; }
  .hero-hex svg { display:block; filter:drop-shadow(0 0 34px rgba(255,107,26,.35)) drop-shadow(0 0 70px rgba(255,107,26,.12)); }
  .hero-title { font-size:clamp(56px,11vw,128px); font-weight:500; letter-spacing:6px; line-height:.9; margin:0 0 6px; padding-left:6px; }
  .hero-title2 { font-size:clamp(26px,4.4vw,50px); font-weight:500; letter-spacing:-1.5px; line-height:1.05; color:var(--accent); margin:0 0 36px; }
  .hero-tagline { font-size:clamp(15px,2.4vw,20px); font-weight:400; letter-spacing:-0.3px; margin:0 0 12px; }
  .hero-sub { font-size:clamp(15px,2vw,18px); color:var(--muted); max-width:560px; line-height:1.6; margin:0 auto 38px; }
  .hero-sub b { color:var(--text); font-weight:600; letter-spacing:-0.01em; }
  .btn { display:inline-flex; align-items:center; gap:10px; padding:15px 30px; font-family:'Outfit',sans-serif; font-size:16px; font-weight:500; letter-spacing:-0.2px; border:2px solid var(--accent); border-radius:0; background:var(--accent); color:#fff; text-decoration:none; box-shadow:5px 5px 0 var(--shadow); transition:transform .15s, box-shadow .15s; }
  .btn:hover { transform:translate(-2px,-2px); box-shadow:8px 8px 0 var(--shadow); }
  .btn:hover svg { transform:translateX(3px); }
  .btn:active { transform:translate(1px,1px); box-shadow:2px 2px 0 var(--shadow); transition-duration:.06s; }
  .btn svg { transition:transform .15s; }

  /* sticky toolbar: search + filter chips */
  .bar { position:sticky; top:0; z-index:50; background:var(--bar); backdrop-filter:blur(10px); -webkit-backdrop-filter:blur(10px); border-top:1px solid rgba(141,135,117,.18); border-bottom:1px solid rgba(141,135,117,.18); }
  .bar-in { margin:0 auto; padding:14px 28px; display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
  .search { width:280px; background:var(--card); color:var(--text); border:2px solid var(--line); border-radius:0; padding:10px 14px; font:14px 'Outfit',sans-serif; outline:none; box-shadow:4px 4px 0 rgba(255,107,26,0); transition:box-shadow .3s, border-color .3s; }
  .search:focus { box-shadow:4px 4px 0 rgba(255,107,26,1); border-color:var(--accent); }
  .chips { display:flex; flex-wrap:wrap; gap:8px; }
  .chip { border:1.5px solid var(--muted); color:var(--muted); background:transparent; border-radius:0; padding:6px 13px; font:13px 'Outfit',sans-serif; transition:all .12s; }
  .chip:hover { border-color:var(--text); color:var(--text); }
  .chip.on { background:var(--accent); border-color:var(--accent); color:#fff; }
  .chip b { font-weight:600; letter-spacing:-0.01em; opacity:.75; margin-left:5px; }
  .kick { font-size:11px; letter-spacing:6px; text-transform:uppercase; color:var(--accent); margin-right:4px; }

  /* masonry wall (CSS columns) */
  .wall { margin:0 auto; padding:34px 28px 40px; columns:300px; column-gap:22px; }   /* auto column count: zoom out = more columns */
  .card { break-inside:avoid; display:block; margin:0 0 22px; background:var(--card); border:2px solid var(--line); border-radius:8px; overflow:hidden; box-shadow:6px 6px 0 var(--shadow); text-decoration:none; color:inherit; position:relative; transition:transform .18s ease, box-shadow .18s ease; opacity:0; transform:translateY(10px); animation:up .4s ease forwards; }
  @keyframes up { to { opacity:1; transform:translateY(0);} }
  .card:hover { transform:translate(-2px,-4px); box-shadow:9px 9px 0 var(--shadow); }
  .card:hover .title { color:var(--accent); }
  .card img { display:block; width:100%; height:auto; max-height:520px; object-fit:cover; object-position:top; background:#0c0c0b; }
  .card .body { padding:14px 16px 16px; }
  .title { font-weight:500; font-size:16px; letter-spacing:-0.3px; margin:0 0 2px; transition:color .15s; padding-right:20px; }
  .domain { font-size:12px; color:var(--muted); margin-bottom:8px; display:flex; align-items:center; gap:6px; }
  .domain img { width:14px; height:14px; border-radius:3px; background:none; }
  .desc { font-size:14px; line-height:1.45; margin:0 0 10px; }
  .desc.pending { color:var(--muted); font-style:italic; }
  .note { font-size:13px; color:var(--muted); border-left:2px solid var(--accent); padding-left:10px; margin:0 0 10px; }
  .tags { display:flex; flex-wrap:wrap; gap:5px; padding-right:74px; }
  .tag { font-size:11px; letter-spacing:.5px; text-transform:uppercase; color:var(--muted); border:1px solid var(--muted); padding:2px 8px; }
  .date { position:absolute; right:14px; bottom:14px; font-size:11px; color:var(--muted); }
  .x { position:absolute; top:10px; right:10px; width:28px; height:28px; border:0; border-radius:0; background:var(--card); color:var(--text); font:16px/1 'Outfit',sans-serif; opacity:0; transition:opacity .15s, background .15s; box-shadow:3px 3px 0 var(--shadow); }
  .card:hover .x { opacity:1; }
  .x:hover { background:var(--accent); color:#fff; }
  body:not(.live) .x { display:none; }

  /* empty state */
  .empty { max-width:720px; margin:30px auto 60px; text-align:center; padding:0 28px; }
  .empty canvas { display:block; margin:0 auto 22px; }
  .empty h2 { font-weight:500; font-size:26px; letter-spacing:-0.8px; margin:0 0 8px; }
  .empty p { color:var(--muted); margin:0; }

  footer { text-align:center; padding:30px 24px 60px; color:var(--muted); font-size:13px; }
  footer span { color:var(--accent); }
  footer a { color:inherit; }

  @media (prefers-reduced-motion: reduce) { .card { animation:none; opacity:1; transform:none; } }
  @media (max-width:640px) {
    .hero { min-height:60dvh; padding-top:84px; }
    .bar-in { padding:12px 16px; } .search { width:100%; } .wall { padding-left:16px; padding-right:16px; }
    .brand-corner span { display:none; }
  }
</style>
</head>
<body>
  <canvas id="dotBg"></canvas>

  <a class="brand-corner" href="https://getrubric.app" target="_blank" rel="noopener">
    <svg viewBox="0 0 48 48" width="26" height="26" fill="none" stroke="#ff6b1a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M24 6l18 10v16L24 42 6 32V16Z"/><path d="M24 6v16l18 10" opacity="0.5"/><path d="M24 22L6 32" opacity="0.5"/><path d="M6 16l18 10 18-10"/></svg>
    <span>RUBRIC</span>
  </a>
  <button id="themeToggle" aria-label="Toggle dark / light mode">◐</button>

  <section class="hero above">
    <div class="hero-hex">
      <svg viewBox="0 0 48 48" width="96" height="96" fill="none" stroke="#ff6b1a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M24 6l18 10v16L24 42 6 32V16Z"/><path d="M24 6v16l18 10" opacity="0.5"/><path d="M24 22L6 32" opacity="0.5"/><path d="M6 16l18 10 18-10"/></svg>
    </div>
    <h1 class="hero-title">RUBRIC</h1>
    <div class="hero-title2">References</div>
    <a class="btn" href="#wall">Browse the wall <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>
  </section>

  <div class="bar" id="wall">
    <div class="bar-in">
      <span class="kick">Filter</span>
      <div class="chips" id="chips"></div>
      <input class="search" id="q" type="search" placeholder="Search sites, words, domains" style="margin-left:auto">
    </div>
  </div>

  <main class="wall above" id="wallGrid"></main>
  <section class="empty above" id="empty" hidden>
    <canvas id="emptyArt"></canvas>
    <h2>Nothing on the wall yet</h2>
    <p>Open any site you like the look of and click the RUBRIC References icon in Chrome. It lands here with a screenshot, a short description, and your tags.</p>
  </section>

  <footer class="above">RUBRIC References <span>·</span> a RoboLabs tool <span>·</span> shared free by <a href="https://www.skool.com/robonuggets" target="_blank" rel="noopener">RoboNuggets</a></footer>

  <script id="data" type="application/json">${dataJson}</script>
  <script>
  (function () {
    // Live mode only when the bridge itself serves this page (same origin, so no CORS needed).
    const SERVED = location.protocol === "http:" || location.protocol === "https:";
    const TOKEN = window.RUBRIC_TOKEN || "";
    const AUTH = TOKEN ? { "x-rubric-token": TOKEN } : {};
    const TAGS = ${JSON.stringify(TAGS)};
    let refs = JSON.parse(document.getElementById("data").textContent || "[]");
    let active = "All", query = "";
    const $ = (id) => document.getElementById(id);
    const root = document.documentElement;
    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ---- theme ----
    const apply = (t) => { root.setAttribute("data-theme", t); root.style.colorScheme = t; if (window.roboRedraw) window.roboRedraw(); };
    let saved = "dark"; try { saved = localStorage.getItem("rubric-references-theme") || "dark"; } catch (_) {}
    apply(saved);
    $("themeToggle").addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      try { localStorage.setItem("rubric-references-theme", next); } catch (_) {}
      apply(next);
    });

    // ---- wave dot-matrix background (getrubric.app's function, unchanged) ----
    const bg = $("dotBg"); const bctx = bg.getContext("2d");
    let BW, BH;
    function bgResize() { const d = window.devicePixelRatio || 1; BW = innerWidth; BH = innerHeight; bg.width = BW * d; bg.height = BH * d; bctx.setTransform(d, 0, 0, d, 0, 0); }
    bgResize(); addEventListener("resize", () => { bgResize(); if (reduced) bgDraw(2000); });
    function bgFn(u, v, t) {
      const TAU = Math.PI * 2;
      const base = 0.78 + 0.05 * Math.sin(u * 3 + t * TAU / 12);
      const ripple = 0.018 * Math.sin(u * 22 + t * TAU / 4) + 0.012 * Math.sin(u * 35 - t * TAU / 3 + 2);
      const crest = base + ripple;
      const d = v - crest;
      if (d < 0) return 0;
      if (d < 0.008) return 1;
      return Math.min(1, 0.4 + d * 3);
    }
    const BG_STEP = 12, BG_MAXR = 2.4;
    function bgDraw(ms) {
      const t = ms / 1000;
      if (bg.offsetWidth !== BW || bg.offsetHeight !== BH) bgResize();
      bctx.clearRect(0, 0, BW, BH);
      bctx.fillStyle = getComputedStyle(root).getPropertyValue("--text").trim() || "#e8e2d2";
      bctx.globalAlpha = 0.2;
      for (let y = BG_STEP / 2; y < BH; y += BG_STEP) for (let x = BG_STEP / 2; x < BW; x += BG_STEP) {
        const b = bgFn(x / BW, y / BH, t);
        if (b <= 0.02) continue;
        bctx.beginPath(); bctx.arc(x, y, Math.min(BG_MAXR, b * BG_MAXR), 0, Math.PI * 2); bctx.fill();
      }
      bctx.globalAlpha = 1;
    }
    if (reduced) bgDraw(2000);
    else { const loop = (ms) => { if (!document.hidden) bgDraw(ms); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }

    // ---- helpers ----
    const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const fmt = (iso) => { try { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); } catch (_) { return ""; } };
    const sorted = () => refs.slice().sort((a, b) => String(b.created).localeCompare(String(a.created)));

    function visible() {
      const q = query.trim().toLowerCase();
      return sorted().filter((r) => {
        if (active !== "All" && !(r.tags || []).includes(active)) return false;
        if (!q) return true;
        return [r.title, r.domain, r.description, r.note, (r.tags || []).join(" ")].join(" ").toLowerCase().includes(q);
      });
    }

    function renderChips() {
      const counts = {};
      for (const r of refs) for (const t of r.tags || []) counts[t] = (counts[t] || 0) + 1;
      const used = TAGS.filter((t) => counts[t]);
      const box = $("chips");
      box.innerHTML = "";
      const mk = (label, n) => {
        const b = document.createElement("button");
        b.className = "chip" + (active === label ? " on" : "");
        b.innerHTML = esc(label) + "<b>" + n + "</b>";
        b.addEventListener("click", () => { active = label; renderChips(); renderWall(); });
        box.appendChild(b);
      };
      mk("All", refs.length);
      for (const t of used) mk(t, counts[t]);
      if (active !== "All" && !used.includes(active)) { active = "All"; renderChips(); }
    }

    function renderWall() {
      const list = visible();
      const wall = $("wallGrid");
      wall.innerHTML = "";
      const n = refs.length;
      $("empty").hidden = n > 0;
      if (!n) drawEmpty();
      list.forEach((r, i) => {
        const a = document.createElement("a");
        a.className = "card";
        if (/^https?:\\/\\//i.test(String(r.url || ""))) { a.href = r.url; a.target = "_blank"; a.rel = "noopener"; }
        a.style.animationDelay = Math.min(i, 12) * 40 + "ms";
        const pending = r.status === "describing" && !r.description;
        a.innerHTML =
          (r.shot ? '<img loading="lazy" src="' + esc(r.shot) + '" alt="">' : "") +
          '<button class="x" title="Remove from the wall" data-id="' + esc(r.id) + '">×</button>' +
          '<div class="body">' +
            '<div class="title">' + esc(r.title || r.domain) + "</div>" +
            '<div class="domain">' + (/^https?:\\/\\//i.test(String(r.favicon || "")) ? '<img src="' + esc(r.favicon) + '" alt="" onerror="this.remove()">' : "") + esc(r.domain) + "</div>" +
            '<p class="desc' + (pending ? " pending" : "") + '">' + esc(pending ? "Writing a plain-English one-liner..." : (r.description || "")) + "</p>" +
            (r.note ? '<p class="note">' + esc(r.note) + "</p>" : "") +
            '<div class="tags">' + (r.tags || []).map((t) => '<span class="tag">' + esc(t) + "</span>").join("") + "</div>" +
            '<div class="date">' + esc(fmt(r.created)) + "</div>" +
          "</div>";
        a.querySelector(".x").addEventListener("click", async (e) => {
          e.preventDefault(); e.stopPropagation();
          if (!confirm("Remove " + (r.title || r.domain) + " from the wall?")) return;
          try {
            const res = await fetch("/api/refs/" + encodeURIComponent(r.id), { method: "DELETE", headers: AUTH });
            if (!res.ok) { alert("Couldn't remove it. The bridge answered " + res.status + "."); return; }
          } catch (_) { alert("Couldn't reach the bridge. Is node server.js still running?"); return; }
          refs = refs.filter((x) => x.id !== r.id);
          renderChips(); renderWall();
        });
        wall.appendChild(a);
      });
    }

    // ---- empty-state art: shaded masonry tiles in dot matrix ----
    function halftone(id, w, h, step, maxR, color, fn) {
      const c = document.getElementById(id); if (!c) return;
      const ctx = c.getContext("2d"); const dpr = window.devicePixelRatio || 1;
      c.width = w * dpr; c.height = h * dpr; c.style.width = w + "px"; c.style.height = h + "px"; ctx.scale(dpr, dpr);
      for (let y = step / 2; y < h; y += step) for (let x = step / 2; x < w; x += step) {
        const b = fn(x / w, y / h); if (b <= 0.02) continue;
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, Math.min(maxR, b * maxR), 0, Math.PI * 2); ctx.fill();
      }
    }
    const TILES = [[0.02, 0.02, 0.30, 0.56], [0.02, 0.62, 0.30, 0.36], [0.35, 0.02, 0.30, 0.34], [0.35, 0.40, 0.30, 0.58], [0.68, 0.02, 0.30, 0.46], [0.68, 0.52, 0.30, 0.46]];
    function drawEmpty() {
      const dark = root.getAttribute("data-theme") !== "light";
      const ink = dark ? "rgba(232,226,210,0.85)" : "rgba(28,26,22,0.88)";
      halftone("emptyArt", 300, 200, 6, 1.9, ink, (u, v) => {
        for (const [x, y, w, h] of TILES) {
          if (u >= x && u <= x + w && v >= y && v <= y + h) {
            const lx = (u - x) / w, ly = (v - y) / h;          // light from top-left, so dots shrink toward bottom-right
            return 0.25 + 0.75 * Math.max(0, 1 - (lx * 0.55 + ly * 0.75));
          }
        }
        return 0;
      });
    }
    window.roboRedraw = () => { if (!refs.length) drawEmpty(); if (reduced) bgDraw(2000); };

    // ---- search ----
    $("q").addEventListener("input", (e) => { query = e.target.value; renderWall(); });

    renderChips(); renderWall();

    // ---- live mode: if the bridge answers, use its fresh data + show delete buttons ----
    async function sync() {
      if (!SERVED) return;
      try {
        const res = await fetch("/api/refs", { cache: "no-store", headers: AUTH });
        if (!res.ok) return;
        const fresh = await res.json();
        document.body.classList.add("live");
        if (JSON.stringify(fresh) !== JSON.stringify(refs)) { refs = fresh; renderChips(); renderWall(); }
      } catch (_) {}
    }
    sync();
    window.addEventListener("focus", sync);
    setInterval(() => { if (document.body.classList.contains("live") && refs.some((r) => r.status === "describing")) sync(); }, 3000);
  })();
  </script>
</body>
</html>`;
}

module.exports = { build, TAGS, DATA_DIR };

if (require.main === module) {
  let list = [];
  try { list = JSON.parse(fs.readFileSync(DATA, "utf8")); } catch (_) {}
  console.log("built " + build(list) + " (" + list.length + " refs)");
}
