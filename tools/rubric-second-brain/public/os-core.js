/* os-core.js - helpers, data loading, router, overlays, command palette and the built-in performance
   sampler. Views live in os-views.js. No dependencies. */
'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n));
  const money = n => n >= 100 ? '$' + Math.round(n) : n >= 10 ? '$' + n.toFixed(1) : '$' + n.toFixed(2);
  const bytes = b => b > 1e9 ? (b / 1e9).toFixed(1) + ' GB' : b > 1e6 ? Math.round(b / 1e6) + ' MB' : b > 1e3 ? Math.round(b / 1e3) + ' KB' : b + ' B';
  const ago = ms => { if (!ms) return 'never'; const s = (Date.now() - ms) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.round(s / 60) + 'm ago'; if (s < 86400) return Math.round(s / 3600) + 'h ago'; if (s < 86400 * 30) return Math.round(s / 86400) + 'd ago'; return Math.round(s / 86400 / 30) + 'mo ago'; };
  const dur = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm'; };

  const ICON = {
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>',
    usage: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    skills: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    routines: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    artifacts: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
    timeline: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    apps: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    memory: '<path d="M9 3a3 3 0 00-3 3v1a3 3 0 00-2 5 3 3 0 002 5v1a3 3 0 006 0V3"/><path d="M15 3a3 3 0 013 3v1a3 3 0 012 5 3 3 0 01-2 5v1a3 3 0 01-6 0"/>',
    coin: '<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.6-.9-1.5-1.3-2.5-1.3-1.5 0-2.6.8-2.6 2s1 1.6 2.6 1.9c1.6.3 2.7.8 2.7 2s-1.1 2.1-2.7 2.1c-1.1 0-2-.5-2.6-1.4M12 6.5v1.7M12 15.9v1.6"/>',
    build: '<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6"/>', data: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    visual: '<path d="M12 3l9 9-9 9-9-9z"/><circle cx="12" cy="12" r="2.5"/>', pulse: '<path d="M3 12h3l3-7 4 14 3-7h5"/>', book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5"/>',
    pen: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>', people: '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/>', api: '<path d="M8 8l-4 4 4 4M16 8l4 4-4 4"/>',
    play: '<path d="M7 5l12 7-12 7z" fill="currentColor"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>', spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
    brain: '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="17" cy="19" r="2"/><path d="M7 7l3 3M17 8l-3 2.5M15.5 17.5L13.5 14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', ask: '<path d="M9 9a3 3 0 115 2c-1 .6-2 1.2-2 2.5M12 17v.5"/><circle cx="12" cy="12" r="9"/>',
    reco: '<path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z"/>',
    cost: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>', cache: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', skill: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', routine: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5h4"/>',
    backlog: '<path d="M5 4h14v16H5z"/><path d="M9 9h6M9 13h6M9 17h3"/>', decide: '<path d="M12 3v18M5 8l7-5 7 5"/>', start: '<path d="M5 12h14M13 6l6 6-6 6"/>', momentum: '<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>', stale: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5"/><path d="M12 16v.5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', plug: '<path d="M9 2v5M15 2v5M6 7h12v4a6 6 0 01-12 0zM12 17v5"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 012-2h9"/>',
    note: '<path d="M5 4h14v16l-4-3H5z"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  };
  const svg = (k, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICON[k] || ICON.file}</svg>`;

  const S = { OS: null, U: null, X: null, fetchedAt: 0, view: 'home', dirty: new Set(), views: {}, openEl: null };
  const api = async (p, opts) => { const r = await fetch(p, opts); const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j; };
  const post = (p, body) => api(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const deptBy = k => (S.OS && S.OS.departments.find(d => d.key === k)) || { color: '#8a90a3', label: k, icon: 'folder' };
  const store = { get(k, d) { try { const v = localStorage.getItem('brainos.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('brainos.' + k, JSON.stringify(v)); } catch { } } };

  function toast(msg, color) {
    if (/^Copied/i.test(msg) && Date.now() - (copy.failAt || 0) < 800) { msg = 'Could not copy to the clipboard. Select the text and copy it yourself.'; color = 'var(--bad)'; }
    const t = $('#toast'); t.querySelector('span').textContent = msg; t.querySelector('i').style.background = color || 'var(--good)';
    t.classList.add('on'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('on'), 3200);
  }
  const tipEl = $('#tip');
  function tip(e, html) {
    if (!html) { tipEl.classList.remove('on'); return; }
    tipEl.innerHTML = html; tipEl.classList.add('on');
    const x = Math.min(e.clientX + 14, innerWidth - tipEl.offsetWidth - 8), y = Math.min(e.clientY + 14, innerHeight - tipEl.offsetHeight - 8);
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
  }
  async function copy(text) { try { await navigator.clipboard.writeText(text); copy.failAt = 0; return true; } catch { const ta = el('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { } ta.remove(); if (!ok) copy.failAt = Date.now(); return ok; } }
  async function reveal(path) { try { await post('/api/reveal', { path }); toast('Opened in Finder · ' + path); } catch (e) { toast(e.message, 'var(--bad)'); } }
  async function openFile(path) { try { await post('/api/open', { path }); toast('Opening ' + path.split('/').pop()); } catch (e) { toast(e.message, 'var(--bad)'); } }

  /* ---------- data ---------- */
  async function loadAll(fresh, silent) {
    const [OS, U, X, RC] = await Promise.all([
      api('/api/os' + (fresh ? '?fresh=1' : '')),
      api('/api/usage').catch(() => null),
      api('/api/os2').catch(() => null),
      fetch('/api/recos').then(r => r.json()).catch(() => null),
    ]);
    S.OS = OS; S.U = U; S.X = X; S.R = RC; S.fetchedAt = Date.now();
    S.dirty = new Set(Object.keys(S.views).filter(k => !(silent && S.views[k].sticky)));
    if (silent) for (const k of Object.keys(S.views)) if (S.views[k].sticky) S.views[k].stale = true;   // re-draw it the next time you come back to it
    renderHud(); renderCurrent();
    if (silent && S.views[S.view] && S.views[S.view].sticky && S.views[S.view].refresh) S.views[S.view].refresh(); if (window.OSX.badges) window.OSX.badges();
  }


  /* ---------- keyboard reach: every clickable div becomes a real, focusable button ---------- */
  function actionable(root) {
    const nat = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/, groups = new Map();
    (root || document.body).querySelectorAll('*').forEach(e => {
      if (typeof e.onclick !== 'function' || nat.test(e.tagName) || e.hasAttribute('tabindex') || e.closest('.sphere,.pods,svg') || e.querySelector('button,a,input,select,textarea,summary')) return;
      e.setAttribute('role', 'button');
      const p = e.parentElement; if (!groups.has(p)) groups.set(p, []); groups.get(p).push(e);
    });
    groups.forEach((list, p) => {
      if (list.length >= 3) { p.setAttribute('data-rove', ''); list.forEach((e, i) => e.setAttribute('tabindex', i ? '-1' : '0')); }
      else list.forEach(e => e.setAttribute('tabindex', '0'));
    });
  }
  addEventListener('keydown', e => {
    const t = e.target; if (!t || t.getAttribute('role') !== 'button' || /INPUT|TEXTAREA|SELECT/.test(t.tagName)) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); return; }
    const p = t.parentElement; if (!p || !p.hasAttribute('data-rove')) return;
    const sibs = [...p.children].filter(c => c.getAttribute('role') === 'button'), i = sibs.indexOf(t);
    const to = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? sibs[i + 1] : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? sibs[i - 1] : e.key === 'Home' ? sibs[0] : e.key === 'End' ? sibs[sibs.length - 1] : null;
    if (to) { e.preventDefault(); t.setAttribute('tabindex', '-1'); to.setAttribute('tabindex', '0'); to.focus(); to.scrollIntoView({ block: 'nearest' }); }
  });

  /* ---------- router ---------- */
  const NAV = [['home', 'Home', 'home'], ['recos', 'Recos', 'reco'], ['usage', 'Usage', 'usage'], ['skills', 'Skills', 'skills'], ['routines', 'Routines', 'routines'], ['artifacts', 'Artifacts', 'artifacts'], ['timeline', 'Timeline', 'timeline'], ['apps', 'Apps', 'apps'], ['memory', 'Memory', 'memory']];
  function buildRail() {
    const rail = $('#rail');
    rail.innerHTML = `<a class="mark" href="#/home" aria-label="Home"><svg viewBox="0 0 24 24" fill="none" stroke="#1c0b02" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="#1c0b02"/></svg></a>` +
      NAV.map(([k, label, ic], i) => `<a class="nav" data-v="${k}" href="#/${k}" aria-label="${label}">${svg(ic)}<span class="tipn">${label} <kbd>${i + 1}</kbd></span></a>`).join('') +
      `<div class="rail-sp"></div><a class="nav" href="/brain" aria-label="Brain map">${svg('brain')}<span class="tipn">Brain map <kbd>M</kbd></span></a>`;
  }
  function go(name) {
    if (!S.views[name]) name = 'home';
    if (location.hash !== '#/' + name) { location.hash = '#/' + name; return; }
    setView(name);
  }
  function setView(name) {
    if (!S.views[name]) name = 'home';
    const prev = S.view; S.view = name;
    if (S.views[name].stale && prev !== name) { S.dirty.add(name); S.views[name].stale = false; }
    const apply = () => {
      document.querySelectorAll('.view').forEach(v => v.classList.toggle('on', v.id === 'v-' + name));
      document.querySelectorAll('.nav[data-v]').forEach(n => n.classList.toggle('on', n.dataset.v === name));
      $('#stage').scrollTop = 0; window.scrollTo(0, 0);
      if (S.OS) renderCurrent();
      if (S.views[prev] && S.views[prev].leave && prev !== name) S.views[prev].leave();
      if (window.OSX && window.OSX.afterView) window.OSX.afterView(name);
    };
    apply(); // the .view.on fade-in (CSS, transform+opacity) is the transition; no snapshot API needed
  }
  /* a rebuilt view must not eat what you were typing: remember inputs by position, put them back, keep focus and caret */
  function snapInputs(root) {
    const list = [...root.querySelectorAll('input,textarea,select')];
    return { n: list.length, vals: list.map(e => ({ v: e.value, c: e.checked, f: document.activeElement === e, a: e.selectionStart, b: e.selectionEnd })) };
  }
  function restoreInputs(root, snap) {
    const list = [...root.querySelectorAll('input,textarea,select')]; if (!snap || list.length !== snap.n) return;
    list.forEach((e, i) => { const t = snap.vals[i]; if (e.type === 'checkbox' || e.type === 'radio') e.checked = t.c; else if (t.v !== '' && e.value !== t.v) { e.value = t.v; e.dispatchEvent(new Event('input', { bubbles: true })); } if (t.f) { e.focus(); try { e.setSelectionRange(t.a, t.b); } catch { } } });
  }
  const typing = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
  function renderCurrent() {
    const v = S.views[S.view]; if (!v || !S.OS) return;
    if (S.dirty.has(S.view) || !v.rendered) { const root = $('#v-' + S.view), keep = snapInputs(root); v.render(root); restoreInputs(root, keep); v.rendered = true; S.dirty.delete(S.view); actionable($('#v-' + S.view)); if (window.OSX.fx) window.OSX.fx($('#v-' + S.view)); }
    if (v.enter) v.enter();
  }
  addEventListener('hashchange', () => setView((location.hash.match(/^#\/(\w+)/) || [])[1] || 'home'));

  /* ---------- HUD (top right): spend windows, context and cache, always visible ---------- */
  function ctxState() {
    const U = S.U; if (!U || !U.sessions || !U.sessions.length) return null;
    const s = U.sessions[0], left = s.coldInMs - (Date.now() - S.fetchedAt);
    return { s, left, warm: left > 0 };
  }
  function renderHud() {
    const U = S.U, h = $('#hud'); if (!h) return;
    const c = ctxState();
    const cls = !c ? '' : c.s.ctx > 800000 ? 'bad' : c.s.ctx > 500000 ? 'warn' : '';
    h.innerHTML =
      (U ? `<span class="chip hide-sm" title="API-equivalent estimate over the last 5 hours">5h <b class="num">${money(U.windows.h5.usd)}</b></span><span class="chip hide-sm" title="API-equivalent estimate over the last 7 days">7d <b class="num">${money(U.windows.d7.usd)}</b></span>` : '') +
      (c ? `<span class="chip" id="hud-ctx" title="Context size of your most recent chat, and its prompt-cache window"><i class="dot ${cls}"></i>ctx <b class="num">${fmt(c.s.ctx)}</b> · <span id="hud-cache">${c.warm ? 'warm ' + dur(c.left) : 'cold'}</span></span>` : '') +
      `<button class="btn sm hide-sm" id="btn-rescan" title="Rescan (R)">${svg('spark')}Rescan</button>`;
    const nv = NAV.find(n => n[0] === S.view); $('#subtitle').textContent = S.OS ? `${nv ? nv[1] + ' · ' : ''}${fmt(S.OS.totals.files)} files · ${S.OS.totals.projects} projects · synced ${ago(S.OS.generatedAt)}` : 'Command Center';
    const b = $('#btn-rescan'); if (b) b.onclick = rescan;
  }
  setInterval(() => {
    const c = ctxState(), n = $('#hud-cache'); if (c && n) n.textContent = c.warm ? 'warm ' + dur(c.left) : 'cold';
    if (S.views[S.view] && S.views[S.view].tick) S.views[S.view].tick();
  }, 5000);
  async function rescan() { toast('Rescanning workspace…', 'var(--warn)'); try { await post('/api/rescan'); await loadAll(true); toast('Rescanned · ' + fmt(S.OS.totals.files) + ' files'); } catch (e) { toast(e.message, 'var(--bad)'); } }

  /* ---------- overlays ---------- */
  function show(sel) { hideAll(); S.openEl = $(sel); S.openEl.classList.add('on'); $('#scrim').classList.add('on'); setTimeout(() => actionable(S.openEl), 0); }
  function hideAll() { document.querySelectorAll('.palette.on,.modal.on,.drawer.on').forEach(x => x.classList.remove('on')); $('#scrim').classList.remove('on'); S.openEl = null; tip(); if (S.views.home && S.views.home.focus) S.views.home.focus(null, true); }
  $('#scrim').onclick = hideAll;
  document.addEventListener('click', e => { if (e.target.closest('[data-close]')) hideAll(); });

  /* ---------- run skill ---------- */
  let runSkill = null;
  function openRun(s) {
    runSkill = s; $('#rm-name').textContent = '/' + s.name; $('#rm-desc').textContent = s.desc || 'No description.';
    $('#rm-args').value = '';
    $('#rm-out').innerHTML = S.OS.runner.claude ? '' : `<div class="code" style="color:var(--muted)">The claude command-line tool isn't installed, so Run copies the exact command to paste into Claude Code.</div>`;
    $('#rm-go').textContent = S.OS.runner.claude ? 'Run ▶' : 'Copy command';
    show('#run-modal'); $('#rm-args').focus();
  }
  $('#rm-go').onclick = async () => {
    try {
      const r = await post('/api/run', { skill: runSkill.dir, args: $('#rm-args').value, model: $('#rm-model').value });
      if (r.mode === 'copy') { await copy(r.prompt); $('#rm-out').innerHTML = `<div class="code">${esc(r.prompt)}</div>`; toast('Copied ' + r.prompt.split(' ')[0] + '. Paste it into Claude Code.'); }
      else { toast('Running /' + runSkill.name + ' headless'); hideAll(); }
    } catch (e) { toast(e.message, 'var(--bad)'); }
  };
  $('#rm-args').addEventListener('keydown', e => { if (e.key === 'Enter') $('#rm-go').click(); });

  /* ---------- command palette ---------- */
  let pItems = [], pSel = 0, pTimer = null, pAnswer = null;
  function baseItems() {
    const OS = S.OS;
    const acts = [
      ...NAV.map(([k, label, ic], i) => ({ t: 'Go to ' + label, s: 'View ' + (i + 1), i: ic, k: String(i + 1), run: () => { hideAll(); go(k); } })),
      { t: 'Open brain map', s: 'Every file as a graph', i: 'brain', k: 'M', run: () => location.href = '/brain' },
      { t: 'Rescan workspace', s: 'Re-read every file', i: 'spark', k: 'R', run: () => { hideAll(); rescan(); } },
      { t: 'Capture a memory', s: 'Save one fact', i: 'pen', k: 'C', run: () => { hideAll(); go('memory'); setTimeout(() => { const t = document.querySelector('.view.on .cap-text'); if (t) t.focus(); }, 60); } },
      { t: 'Show performance meter', s: 'Live frame time', i: 'pulse', k: 'P', run: () => { hideAll(); perf.toggle(); } },
    ];
    const depts = OS.departments.map(d => ({ t: d.label, s: 'Department · ' + fmt(d.files) + ' files', i: d.icon, color: d.color, run: () => S.openDrawer && S.openDrawer(d.key) }));
    const projs = OS.departments.flatMap(d => d.projects.map(p => ({ t: p.name, s: 'Project · ' + p.path, i: 'folder', color: d.color, run: () => { reveal(p.path); hideAll(); } })));
    const skills = OS.skills.map(s => ({ t: '/' + s.name, s: 'Run skill · ' + s.desc.slice(0, 90), i: 'skills', run: () => openRun(s) }));
    const mem = OS.memory.map(m => ({ t: m.fact.slice(0, 80), s: 'Memory · ' + m.file, i: 'book', run: () => { reveal(m.file); hideAll(); } }));
    const arts = ((S.X && S.X.artifacts.items) || []).slice(0, 60).map(a => ({ t: a.name, s: 'Artifact · ' + a.path, i: 'artifacts', color: deptBy(a.dept).color, run: () => { openFile(a.path); hideAll(); } }));
    const RC = S.R && S.R.items ? S.R : null;
    const recos = RC ? RC.items.filter(i => !RC.state.done[i.id] && !RC.state.skipped[i.id]).map(i => ({ t: i.title, s: 'Reco · ' + ((RC.letters[i.letter] || {}).name || ''), i: 'reco', run: () => { hideAll(); go('recos'); } })) : [];
    return { acts, depts, projs, skills, mem, arts, recos };
  }
  const score = (q, s) => { s = s.toLowerCase(); if (s.startsWith(q)) return 3; if (s.includes(' ' + q) || s.includes('/' + q)) return 2; if (s.includes(q)) return 1; let i = 0; for (const ch of s) if (ch === q[i]) i++; return i === q.length ? 0.4 : 0; };
  async function paletteQuery() {
    const raw = $('#p-input').value, q = raw.trim().toLowerCase(), B = baseItems(), secs = []; pAnswer = null;
    if (q.startsWith('?')) {
      const question = raw.trim().slice(1).trim();
      secs.push(['Ask your brain', [{ t: question ? 'Recall: ' + question : 'Type a question after ?', s: 'brain.js recall · deterministic · 0 tokens', i: 'ask', run: () => { } }]]);
      if (question.length > 2) { clearTimeout(pTimer); pTimer = setTimeout(async () => { try { const r = await api('/api/recall?q=' + encodeURIComponent(question)); pAnswer = r.hits || []; drawPalette(secs); } catch { } }, 160); }
    } else if (q.startsWith('>')) { const qq = q.slice(1).trim(); secs.push(['Actions', B.acts.filter(a => !qq || score(qq, a.t) > 0)]); }
    else if (!q) secs.push(['Go to', B.acts.slice(0, 8)], ['Departments', B.depts], ['Skills', B.skills.slice(0, 5)]);
    else {
      const rank = arr => arr.map(x => [score(q, x.t) * 2 + score(q, x.s) * 0.5, x]).filter(x => x[0] > 0).sort((a, b) => b[0] - a[0]).map(x => x[1]);
      for (const [n, arr, lim] of [['Actions', B.acts, 4], ['Recos', B.recos, 4], ['Departments', B.depts, 6], ['Projects', B.projs, 6], ['Skills', B.skills, 6], ['Artifacts', B.arts, 6], ['Memory', B.mem, 4]]) { const r = rank(arr).slice(0, lim); if (r.length) secs.push([n, r]); }
      secs.push(['Workspace', [{ t: 'Search ' + fmt(S.OS.totals.files) + ' files for “' + raw.trim() + '”', s: 'Full-text path search', i: 'search', run: () => wsSearch(raw.trim()) }]]);
      secs.push(['Ask', [{ t: 'Ask your brain: ' + raw.trim(), s: 'brain.js recall · 0 tokens', i: 'ask', run: () => { $('#p-input').value = '?' + raw.trim(); paletteQuery(); } }]]);
    }
    pSel = 0; drawPalette(secs);
  }
  async function wsSearch(q) {
    try { const r = await api('/api/search?q=' + encodeURIComponent(q)); drawPalette([['Files matching “' + q + '”', (r.results || []).slice(0, 30).map(h => ({ t: h.name || h.path, s: h.path, i: h.type === 'dir' ? 'folder' : 'file', color: deptBy(h.dept).color, run: () => { reveal(h.path); hideAll(); } }))]]); }
    catch (e) { toast(e.message, 'var(--bad)'); }
  }
  function drawPalette(secs) {
    const box = $('#p-list'); box.innerHTML = ''; pItems = [];
    for (const [name, items] of secs) {
      if (!items.length) continue;
      box.appendChild(el('div', 'label p-sec', esc(name)));
      for (const it of items) {
        const idx = pItems.length; pItems.push(it);
        const b = el('button', 'p-item', `<span class="pi" ${it.color ? `style="color:${it.color}"` : ''}>${svg(it.i)}</span><div style="min-width:0"><b>${esc(it.t)}</b><small>${esc(it.s)}</small></div>${it.k ? `<kbd>${it.k}</kbd>` : ''}`);
        b.onmouseenter = () => { pSel = idx; mark(); }; b.onclick = () => it.run(); box.appendChild(b);
      }
    }
    if (pAnswer) {
      if (!pAnswer.length) box.appendChild(el('div', 'answer', 'No stored fact matched. Try other words, or search the workspace.'));
      for (const h of pAnswer) { const a = el('div', 'answer', `<div class="src">${esc(h.file)} · score ${esc(h.score)}</div>${esc((h.slice || '').replace(/^---[\s\S]*?---\s*/, '').replace(/\*Saved [^*]*\*/g, '').trim().slice(0, 900))}`); a.style.cursor = 'pointer'; a.onclick = () => reveal(h.file); a.setAttribute('role', 'button'); a.tabIndex = 0; box.appendChild(a); }
    }
    if (!pItems.length && !pAnswer) box.appendChild(el('div', 'answer', 'No matches. Try fewer words, or start with ? to ask your brain.'));
    mark();
  }
  function mark() { document.querySelectorAll('.p-item').forEach((b, i) => { b.classList.toggle('on', i === pSel); if (i === pSel) b.scrollIntoView({ block: 'nearest' }); }); }
  function openPalette(prefix) { show('#palette'); $('#p-input').value = prefix || ''; $('#p-input').focus(); paletteQuery(); }
  $('#open-palette').onclick = () => openPalette();
  $('#p-input').addEventListener('input', paletteQuery);
  $('#p-input').addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { pSel = Math.min(pItems.length - 1, pSel + 1); mark(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { pSel = Math.max(0, pSel - 1); mark(); e.preventDefault(); }
    else if (e.key === 'Enter') { const it = pItems[pSel]; if (it) it.run(); e.preventDefault(); }
  });

  /* ---------- keyboard ---------- */
  addEventListener('keydown', e => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); S.openEl && S.openEl.id === 'palette' ? hideAll() : openPalette(); return; }
    if (e.key === 'Escape') { hideAll(); document.activeElement.blur(); return; }
    if (typing || S.openEl || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === '/') { e.preventDefault(); openPalette(); }
    else if (e.key === '?') { e.preventDefault(); openPalette('?'); }
    else if (/^[1-9]$/.test(k)) go(NAV[+k - 1][0]);
    else if (k === '[' || k === ']') { const i = NAV.findIndex(n => n[0] === S.view); go(NAV[(i + (k === ']' ? 1 : NAV.length - 1)) % NAV.length][0]); }
    else if (k === 'm') location.href = '/brain';
    else if (k === 'r') rescan();
    else if (k === 'p') perf.toggle();
    else if (k === 'c') { e.preventDefault(); go('memory'); setTimeout(() => { const t = document.querySelector('.view.on .cap-text'); if (t) t.focus(); }, 80); }
  });

  /* ---------- performance sampler: real frame times, long tasks, layout shift, errors ---------- */
  const perf = (() => {
    let on = false, raf = 0, last = 0, d = [], long = 0, cls = 0, errs = 0, t0 = 0, hud = null;
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) long += e.duration > 50 ? 1 : 0; }).observe({ entryTypes: ['longtask'] }); } catch { }
    try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ entryTypes: ['layout-shift'] }); } catch { }
    addEventListener('error', () => errs++); addEventListener('unhandledrejection', () => errs++);
    const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))] : 0; };
    function frame(t) {
      if (!document.hidden && last) { d.push(t - last); if (d.length > 1800) d.shift(); }
      last = t; raf = requestAnimationFrame(frame);
    }
    function report() {
      const n = d.length, avg = n ? d.reduce((a, b) => a + b, 0) / n : 0;
      return { frames: n, fps: avg ? +(1000 / avg).toFixed(1) : 0, p50: +q(d, .5).toFixed(2), p95: +q(d, .95).toFixed(2), p99: +q(d, .99).toFixed(2), over20ms: d.filter(x => x > 20).length, longTasks: long, cls: +cls.toFixed(4), errors: errs, heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null, seconds: +((performance.now() - t0) / 1000).toFixed(1) };
    }
    return {
      start() { if (on) return; on = true; d = []; long = 0; cls = 0; last = 0; t0 = performance.now(); raf = requestAnimationFrame(frame); },
      stop() { on = false; cancelAnimationFrame(raf); },
      reset() { d = []; long = 0; cls = 0; last = 0; t0 = performance.now(); },
      report,
      toggle() {
        hud = hud || $('#perfhud');
        if (hud.classList.toggle('on')) { this.start(); this._i = setInterval(() => { const r = report(); hud.textContent = `${r.fps} fps   p95 ${r.p95} ms   long ${r.longTasks}   cls ${r.cls}${r.heapMB ? '   ' + r.heapMB + ' MB' : ''}`; }, 500); }
        else { clearInterval(this._i); this.stop(); }
      },
    };
  })();

  window.OSX = { renderHud, actionable, $, el, esc, fmt, money, bytes, ago, dur, svg, ICON, S, api, post, store, deptBy, toast, tip, copy, reveal, openFile, show, hideAll, openRun, go, loadAll, rescan, perf, NAV, setView };
  window.__perf = perf;
  buildRail();

  // views register themselves, then we boot
  window.addEventListener('DOMContentLoaded', () => { });
  window.OSX.boot = async () => {
    const first = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'home', sv = $('#v-' + first);
    if (sv && !sv.children.length) sv.innerHTML = first === 'home' ? '<div class="grid g12"><div class="card sk c8" style="height:560px"></div><div class="c4" style="display:grid;gap:16px;align-content:start"><div class="card sk" style="height:300px"></div><div class="card sk" style="height:240px"></div></div></div>' : '<div class="grid g12"><div class="card sk c12" style="height:200px"></div><div class="card sk c6" style="height:300px"></div><div class="card sk c6" style="height:300px"></div></div>';
    setView((location.hash.match(/^#\/(\w+)/) || [])[1] || 'home');
    try { await loadAll(false); } catch (e) { toast('Could not load: ' + e.message, 'var(--bad)'); }
    setInterval(() => { if (!document.hidden && !S.openEl && !typing()) loadAll(false, true).catch(() => { }); }, 60000);
  };
})();
