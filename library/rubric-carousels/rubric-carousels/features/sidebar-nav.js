/* RoboNav - the RUBRIC sidebar navigator. One file, no dependencies, works from file:// and http.
   A sticky left column, numbered rows, the one in view outlined in orange.

   Use:
     <section data-nav="desk" data-nav-label="Tidy desk" data-nav-sub="7 cards" data-nav-badge="3">
       ... <div data-nav-child="desk#4" data-nav-label="Cable clips">...</div> ...
     </section>
     <script src="sidebar-nav.js"></script>
     <script>RoboNav.init({ title:'Carousels', key:'my-page-nav' });</script>
   Every element with data-nav becomes a row (label, small sub line, orange badge). Elements inside it with data-nav-child
   become its sub-rows, shown under the row that is in view (or the one you open). A click scrolls there smoothly;
   a child scrolls its strip sideways too and flashes. The row in view lights up as you scroll.
   Keys: b shows or hides the sidebar (remembered). Search box filters rows when there are more than 6.
   API: refresh() after the page re-renders · open(false|true) · go(id).
   Theme: reads --bg, --card, --text, --muted, --accent, --line, --well from the page (dark defaults if missing). */
(function () {
  'use strict';
  if (window.RoboNav) return;
  var cfg = null, side = null, listEl = null, q = '', active = null, expanded = null, io = null, memory = {};
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return memory[k] == null ? null : memory[k]; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { memory[k] = v; } }
  };
  var CSS = '' +
    ':root{--robo-nav-w:256px}' +
    'html.rnav-open body{padding-left:var(--robo-nav-w)}' +
    '.rnav{position:fixed;left:0;top:0;bottom:0;z-index:400;width:var(--robo-nav-w);display:flex;flex-direction:column;background:var(--bg,#131311);color:var(--text,#e8e2d2);' +
      'border-right:1px solid var(--line,#34312a);font:400 14px/1.35 Outfit,system-ui,sans-serif;transform:translateX(-100%);transition:transform .2s ease}' +
    'html.rnav-open .rnav{transform:none}' +
    '.rnav-hd{display:flex;align-items:center;gap:8px;padding:18px 12px 10px 16px}.rnav-hd b{font-weight:600;font-size:15px;letter-spacing:.2px}' +
    '.rnav-hd span{color:var(--muted,#8d8775);font-size:12px}' +
    '.rnav-x{margin-left:auto;border:0;background:transparent;color:var(--muted,#8d8775);width:30px;height:30px;border-radius:7px;cursor:pointer;font-size:15px}.rnav-x:hover{color:var(--text,#e8e2d2);background:var(--well,#1a1915)}' +
    '.rnav-q{margin:0 12px 8px 14px;font:400 13px Outfit,system-ui,sans-serif;padding:7px 10px;border-radius:8px;border:1px solid var(--line,#34312a);background:var(--well,#1a1915);color:var(--text,#e8e2d2);outline:none}' +
    '.rnav-q:focus{border-color:var(--accent,#ff6b1a)}' +
    '.rnav-list{list-style:none;margin:0;padding:0 10px 40px 12px;overflow-y:auto;flex:1;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:var(--accent,#ff6b1a) transparent}' +
    '.rnav-row{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:6px;align-items:center;padding:7px 6px;border-radius:8px;border:1px solid transparent;cursor:pointer}' +
    '.rnav-row:hover{background:var(--well,#1a1915)}.rnav-row.on{background:var(--well,#1a1915);border-color:var(--accent,#ff6b1a)}' +
    '.rnav-n{font-weight:600;color:var(--accent,#ff6b1a);font-variant-numeric:tabular-nums;text-align:center;font-size:13px}' +
    '.rnav-t{min-width:0}.rnav-t b{display:block;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.rnav-t small{display:block;color:var(--muted,#8d8775);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.rnav-b{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--accent,#ff6b1a);color:#fff;font:600 11px/20px Outfit,system-ui,sans-serif;text-align:center}' +
    '.rnav-kids{list-style:none;margin:2px 0 8px 30px;padding:0 0 0 8px;border-left:1px solid var(--line,#34312a)}' +
    '.rnav-kid{padding:4px 8px;border-radius:6px;color:var(--muted,#8d8775);font-size:12.5px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.rnav-kid:hover{color:var(--text,#e8e2d2);background:var(--well,#1a1915)}' +
    '.rnav-tab{position:fixed;left:12px;top:14px;z-index:399;display:none;border:0;border-radius:8px;padding:7px 10px;background:var(--card,#24221c);color:var(--text,#e8e2d2);font:600 13px Outfit,system-ui,sans-serif;cursor:pointer;box-shadow:4px 4px 0 var(--shadow,#000)}' +
    'html:not(.rnav-open) .rnav-tab{display:block}' +
    '.rnav-flash{animation:rnavFlash 1.1s ease}@keyframes rnavFlash{30%{box-shadow:0 0 0 4px var(--accent,#ff6b1a)}}' +
    '[data-nav]{scroll-margin-top:16px}' +
    '@media (max-width:900px){html.rnav-open body{padding-left:0}.rnav{box-shadow:8px 0 0 var(--shadow,#000)}}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cssq(s) { return String(s).replace(/["\\]/g, '\\$&'); }
  function sections() { return Array.prototype.slice.call(document.querySelectorAll('[data-nav]')); }
  function byId(id) { return document.querySelector('[data-nav="' + cssq(id) + '"]'); }

  function build() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    if (cfg.width) document.documentElement.style.setProperty('--robo-nav-w', cfg.width + 'px');
    side = document.createElement('nav'); side.className = 'rnav'; side.setAttribute('aria-label', cfg.title);
    side.innerHTML = '<div class="rnav-hd"><b>' + esc(cfg.title) + '</b><span class="rnav-c"></span><button class="rnav-x" title="Hide the sidebar (b)" aria-label="Hide the sidebar">\u2190</button></div>' +
      '<input class="rnav-q" type="search" placeholder="Filter" aria-label="Filter" hidden><ul class="rnav-list"></ul>';
    document.body.appendChild(side);
    listEl = side.querySelector('.rnav-list');
    var tab = document.createElement('button'); tab.className = 'rnav-tab'; tab.textContent = '\u2630 ' + cfg.title; tab.title = 'Show the sidebar (b)';
    tab.onclick = function () { open(true); }; document.body.appendChild(tab);
    side.querySelector('.rnav-x').onclick = function () { open(false); };
    side.querySelector('.rnav-q').oninput = function (e) { q = e.target.value.trim().toLowerCase(); render(); };
    listEl.addEventListener('click', function (e) {
      var kid = e.target.closest('.rnav-kid'); if (kid) { goChild(kid.getAttribute('data-id')); return; }
      var row = e.target.closest('.rnav-row'); if (row) { var id = row.getAttribute('data-id'); expanded = id; active = id; go(id); render(); }
    });
    document.addEventListener('keydown', function (e) {
      var t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === cfg.hotkey) open(!document.documentElement.classList.contains('rnav-open'));
    });
    var saved = store.get(cfg.key + ':open');
    var narrow = window.matchMedia('(max-width:900px)').matches;
    open(saved == null ? !narrow : saved === '1', true);
  }

  function watch() {
    if (io) io.disconnect();
    if (!('IntersectionObserver' in window)) return;
    var seen = {};
    io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { seen[en.target.getAttribute('data-nav')] = en.intersectionRatio; });
      var best = null, bestR = 0;
      sections().forEach(function (s) { var id = s.getAttribute('data-nav'), r = seen[id] || 0; if (r > bestR) { bestR = r; best = id; } });
      if (active && (seen[active] || 0) >= bestR) best = active;   // a tie keeps the row you clicked (short pages show several rows whole)
      if (best && best !== active) { active = best; render(); }
    }, { threshold: [0, .15, .35, .6, .85, 1] });
    sections().forEach(function (s) { io.observe(s); });
  }

  function render() {
    if (!listEl) return;
    var secs = sections();
    side.querySelector('.rnav-c').textContent = secs.length;
    side.querySelector('.rnav-q').hidden = secs.length <= 6;
    var openId = expanded || active;
    listEl.innerHTML = secs.map(function (s, i) {
      var id = s.getAttribute('data-nav'), label = s.getAttribute('data-nav-label') || id, sub = s.getAttribute('data-nav-sub') || '', badge = s.getAttribute('data-nav-badge');
      if (q && (label + ' ' + sub).toLowerCase().indexOf(q) < 0) return '';
      var kids = id === openId ? Array.prototype.slice.call(s.querySelectorAll('[data-nav-child]')) : [];
      return '<li><div class="rnav-row' + (id === active ? ' on' : '') + '" data-id="' + esc(id) + '"><span class="rnav-n">' + (i + 1) + '</span>' +
        '<span class="rnav-t"><b>' + esc(label) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
        (badge && badge !== '0' ? '<span class="rnav-b">' + esc(badge) + '</span>' : '<span></span>') + '</div>' +
        (kids.length ? '<ul class="rnav-kids">' + kids.map(function (k) {
          return '<li class="rnav-kid" data-id="' + esc(k.getAttribute('data-nav-child')) + '">' + esc(k.getAttribute('data-nav-label') || k.getAttribute('data-nav-child')) + '</li>';
        }).join('') + '</ul>' : '') + '</li>';
    }).join('');
  }

  function flash(el) { el.classList.remove('rnav-flash'); void el.offsetWidth; el.classList.add('rnav-flash'); }
  function go(id) { var el = byId(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function goChild(cid) {
    var el = document.querySelector('[data-nav-child="' + cssq(cid) + '"]'); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }); flash(el);
  }
  function open(on, quiet) {
    document.documentElement.classList.toggle('rnav-open', !!on);
    if (!quiet) store.set(cfg.key + ':open', on ? '1' : '0');
    if (cfg.onToggle) cfg.onToggle(!!on);
  }

  window.RoboNav = {
    init: function (opts) {
      cfg = Object.assign({ title: 'Contents', key: 'robo-nav', hotkey: 'b', width: 256, onToggle: null }, opts || {});
      build(); watch(); render();
      return window.RoboNav;
    },
    refresh: function () { watch(); render(); },
    open: function (on) { open(on !== false); },
    go: go, goChild: goChild
  };
})();
