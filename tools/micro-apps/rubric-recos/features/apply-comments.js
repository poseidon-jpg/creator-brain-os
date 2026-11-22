/* RoboApply - the "Apply all comments" button. One file, no dependencies, works from file:// and http.
   An orange button in the lower right corner opens a model x effort picker, and the picked model applies every open
   comment to the page's file through the Agentic OS runner (cfg.api, POST /api/apply-comments). When the run ends
   well, the comments it got turn "applied" and the page reloads, so the changes show. A card then says what changed.

   Use (after RoboHighlight / RoboComments init):
     <script src="apply-comments.js"></script>
     <script>RoboApply.init({ title:'My page', api:'http://localhost:50000', file:'/full/path/to/data.js', notes:'edit data.js, then reload' });</script>
   file: what the run edits. Leave it out on a single page opened from disk: the page itself is the file.
   An app page (http) names its source file, or the run hunts for it from the URL.
   notes: one line on how the page is built, whenever editing the HTML alone would be wrong.
   more: () => 'text' adds lines from anything else (a cart, a form) to what the run gets.
   Key a opens the picker, Enter runs, Esc closes. The pick is shared by every page (localStorage 'robo-apply-dials').
   The Comments and Cart buttons move into one bottom-right row with Apply in the corner, so no two buttons overlap.
   A reload mid-run picks the run back up. If the OS is not running, the comments are copied for you to paste into a chat.
   Theme: reads --bg --card --cardsolid --text --muted --accent --line --shadow --well (dark defaults). */
(function () {
  'use strict';
  if (window.RoboApply) return;
  var MODELS = ['HAIKU', 'SONNET', 'OPUS', 'FABLE'];
  var MODELCOL = ['#2aa88a', '#3f8fd4', '#9a66e0', '#ff6b1a'];
  var EFFORTS = ['LOW', 'MEDIUM', 'HIGH', 'XHIGH', 'MAX'];
  var LBL_W = 64, COL_W = 46, ROW_H = 34, HEAD_H = 34;
  var cfg = null, dock, btn, pop, mx, fill, elT, stT, tailEl, errEl, goB, sumEl, run = null, tick = null, poll = null, memory = {};
  var ls = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return memory[k] == null ? null : memory[k]; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { memory[k] = v; } },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { delete memory[k]; } }
  };
  function readJson(k) { try { return JSON.parse(ls.get(k)); } catch (e) { return null; } }
  var dials = readJson('robo-apply-dials') || { m: 2, e: 2, mem: {} };   // OPUS · HIGH, the deck's default card
  if (!dials.mem) dials.mem = {};

  var EASE = 'cubic-bezier(.3,1.2,.4,1)';
  var STYLE = '' +
    // row-reverse + wrap-reverse with Apply first: Apply holds the bottom-right corner, and on a narrow screen the other buttons wrap upward, not Apply
    '.rap-dock{position:fixed;right:18px;bottom:18px;z-index:9050;display:flex;flex-direction:row-reverse;flex-wrap:wrap-reverse;justify-content:flex-start;align-items:flex-end;gap:10px;max-width:calc(100vw - 36px);pointer-events:none}' +
    '.rap-dock>*{pointer-events:auto}' +
    '.rap-btn{display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:0;border-radius:8px;background:var(--accent,#ff6b1a);color:#fff;font:600 14px Outfit,system-ui,sans-serif;cursor:pointer;box-shadow:5px 5px 0 var(--shadow,#000);transition:transform .15s,opacity .15s}' +
    '.rap-btn:hover{transform:translate(-2px,-2px)}' +
    // no open comments: a solid quiet button, never see-through, so page art never shows through it
    '.rap-btn.zero{background:var(--card,#24221c);color:var(--muted,#8d8775)}.rap-btn.zero .n{background:var(--well,#1a1915);color:var(--muted,#8d8775)}.rap-btn.zero kbd{border-color:var(--line,#34312a)}' +
    '.rap-btn .n{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#fff;color:var(--accent,#ff6b1a);font-size:12px;line-height:20px;text-align:center}' +
    '.rap-btn kbd{font:600 11px Outfit,system-ui,sans-serif;border:1px solid rgba(255,255,255,.6);border-radius:4px;padding:0 5px;opacity:.85}' +
    '.rap-pop{position:fixed;right:18px;bottom:72px;z-index:9600;display:none;width:322px;box-sizing:border-box;background:var(--cardsolid,var(--card,#24221c));color:var(--text,#e8e2d2);' +
      'border-radius:10px;box-shadow:6px 6px 0 var(--shadow,#000);padding:12px 14px 14px;user-select:none;font:400 14px Outfit,system-ui,sans-serif}' +
    '.rap-pop.show{display:block}' +
    '.rap-pop .ahead{display:flex;align-items:center;gap:8px;margin-bottom:8px}' +
    '.rap-pop .t{font-size:10px;letter-spacing:2.5px;color:var(--muted,#8d8775)}.rap-pop .t b{color:var(--text,#e8e2d2);font-weight:600;letter-spacing:.5px}' +
    '.rap-pop .x{margin-left:auto;width:20px;height:20px;border:0;background:transparent;color:var(--muted,#8d8775);font-size:13px;cursor:pointer;font-family:Outfit,sans-serif}.rap-pop .x:hover{color:var(--accent,#ff6b1a)}' +
    '.rap-mx{position:relative;display:grid;grid-template-columns:64px repeat(5,46px);grid-auto-rows:34px;align-items:center}' +
    '.rap-mx .colh{font-size:8px;letter-spacing:1.2px;color:var(--muted,#8d8775);text-align:center;align-self:end;padding-bottom:5px}' +
    '.rap-mx .rowh{font-size:10.5px;letter-spacing:1.5px;color:var(--muted,#8d8775);font-weight:500;transition:color .2s}' +
    '.rap-mx .cell{position:relative;height:34px;cursor:pointer;z-index:3}' +
    '.rap-mx .cell i{position:absolute;left:50%;top:50%;width:5px;height:5px;margin:-2.5px;border-radius:50%;background:var(--muted,#8d8775);opacity:.55;transition:background .2s,opacity .2s}' +
    '.rap-mx .cell:hover i{opacity:1;background:var(--text,#e8e2d2)}.rap-mx .cell.inpill i{background:rgba(0,0,0,.35);opacity:1}' +
    '.rap-pill{position:absolute;height:28px;border-radius:99px;z-index:1;box-shadow:0 2px 8px rgba(0,0,0,.35);transition:left .22s ' + EASE + ',top .22s ' + EASE + ',width .22s ' + EASE + ',background .22s}' +
    '.rap-knob{position:absolute;width:26px;height:26px;border-radius:50%;background:#fff;z-index:2;cursor:grab;box-shadow:0 1px 4px rgba(0,0,0,.45);transition:left .22s ' + EASE + ',top .22s ' + EASE + '}' +
    '.rap-pop.dragging .rap-pill,.rap-pop.dragging .rap-knob{transition:none}' +
    '.rap-pop .sum{margin:10px 0 0;font-size:13px;line-height:1.4;color:var(--muted,#8d8775)}.rap-pop .sum b{color:var(--text,#e8e2d2);font-weight:600}' +
    '.rap-pop .row{display:flex;gap:6px;margin-top:10px}' +
    '.rap-b{font:600 13px Outfit,system-ui,sans-serif;padding:8px 12px;border-radius:7px;border:0;cursor:pointer;background:var(--well,#1a1915);color:var(--text,#e8e2d2)}' +
    '.rap-b.go{flex:1;background:var(--accent,#ff6b1a);color:#fff}.rap-b[disabled]{opacity:.5;cursor:default}' +
    '.rap-prog{display:none;margin-top:10px}.rap-pop.running .rap-prog{display:block}' +
    '.rap-prog .track{height:6px;border-radius:3px;background:var(--well,#1a1915);overflow:hidden}.rap-prog .track i{display:block;height:100%;width:0;background:var(--accent,#ff6b1a);transition:width .5s}' +
    '.rap-prog .tm{display:flex;justify-content:space-between;margin-top:6px;font-size:12px;color:var(--muted,#8d8775)}' +
    '.rap-prog pre,.rap-done pre{margin:6px 0 0;max-height:96px;overflow:auto;white-space:pre-wrap;font:400 11px/1.35 ui-monospace,Consolas,monospace;color:var(--muted,#8d8775);user-select:text}' +
    '.rap-err{display:none;margin-top:8px;font-size:13px;line-height:1.4;color:var(--accent,#ff6b1a)}' +
    '.rap-done{position:fixed;right:18px;bottom:72px;z-index:9550;width:min(380px,calc(100vw - 36px));box-sizing:border-box;background:var(--cardsolid,var(--card,#24221c));color:var(--text,#e8e2d2);' +
      'border-radius:10px;box-shadow:6px 6px 0 var(--shadow,#000);padding:12px 14px;font:400 14px Outfit,system-ui,sans-serif}' +
    '.rap-done .hd{display:flex;align-items:center;gap:8px}.rap-done .hd b{color:#2aa88a;font-weight:600}.rap-done .hd span{color:var(--muted,#8d8775);font-size:12px}' +
    '.rap-done pre{max-height:40vh;font:400 13px/1.45 Outfit,system-ui,sans-serif;color:var(--text,#e8e2d2)}' +
    '.rap-done pre b{font-weight:600;color:var(--text,#e8e2d2)}.rap-done pre code{font:400 12px ui-monospace,Consolas,monospace;color:var(--muted,#8d8775)}' +
    '.rap-done .x{margin-left:auto;border:0;background:transparent;color:var(--muted,#8d8775);font-size:18px;cursor:pointer}' +
    '@media print{.rap-dock,.rap-pop,.rap-done{display:none!important}}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(s) { return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0'); }
  function baseName(p) { return String(p || '').split(/[\\/]/).filter(Boolean).pop() || 'this page'; }
  function saveDials() { ls.set('robo-apply-dials', JSON.stringify(dials)); }

  // the open comments of every comment feature on the page, and the text the run gets
  function openComments() {
    var out = [];
    if (window.RoboHighlight && window.RoboHighlight.list) window.RoboHighlight.list().forEach(function (c) { if (c.status !== 'applied') out.push({ kind: 'hl', id: c.id }); });
    if (window.RoboComments && window.RoboComments.list) window.RoboComments.list().forEach(function (c) { if (c.status !== 'applied') out.push({ kind: 'cm', id: c.id }); });
    return out;
  }
  function extraText() { return cfg.more ? String(cfg.more() || '').trim() : ''; }
  function commentText(sent) {
    var parts = [];
    if (sent.some(function (k) { return k.kind === 'hl'; })) parts.push(window.RoboHighlight.text());
    if (sent.some(function (k) { return k.kind === 'cm'; })) parts.push(window.RoboComments.text());
    var extra = extraText(); if (extra) parts.push(extra);
    return parts.join('\n\n').trim();
  }

  function cellCenter(m, e) { return { x: LBL_W + e * COL_W + COL_W / 2, y: HEAD_H + m * ROW_H + ROW_H / 2 }; }
  function syncMx() {
    var s = cellCenter(dials.m, 0), e = cellCenter(dials.m, dials.e), pill = mx.querySelector('.rap-pill'), knob = mx.querySelector('.rap-knob');
    pill.style.left = (s.x - 14) + 'px'; pill.style.top = (s.y - 14) + 'px'; pill.style.width = (e.x - s.x + 28) + 'px'; pill.style.background = MODELCOL[dials.m];
    knob.style.left = (e.x - 13) + 'px'; knob.style.top = (e.y - 13) + 'px';
    Array.prototype.forEach.call(mx.querySelectorAll('.rowh'), function (r) { var on = +r.getAttribute('data-m') === dials.m; r.style.color = on ? MODELCOL[dials.m] : ''; });
    Array.prototype.forEach.call(mx.querySelectorAll('.cell'), function (c) {
      var m = +c.getAttribute('data-m'), e2 = +c.getAttribute('data-e'), mem = m !== dials.m && dials.mem[m] === e2, i = c.querySelector('i');
      c.classList.toggle('inpill', m === dials.m && e2 <= dials.e);
      i.style.background = mem ? MODELCOL[m] : ''; i.style.opacity = mem ? '.9' : '';
    });
    recount();
  }
  function setDial(m, e, remember) {
    if (remember && m !== dials.m) dials.mem[dials.m] = dials.e;   // each model keeps its last effort as a coloured dot
    dials.m = m; dials.e = e; saveDials(); syncMx();
  }
  // only a real drag kills the spring, so a plain click still slides the pill (same as the deck)
  function knobDrag(ev) {
    var x0 = ev.clientX, y0 = ev.clientY, dragging = false;
    function move(e2) {
      if (!dragging) { if (Math.hypot(e2.clientX - x0, e2.clientY - y0) < 4) return; dragging = true; pop.classList.add('dragging'); }
      var r = mx.getBoundingClientRect();
      var eff = Math.max(0, Math.min(4, Math.round((e2.clientX - r.left - LBL_W - COL_W / 2) / COL_W)));
      var row = Math.max(0, Math.min(3, Math.round((e2.clientY - r.top - HEAD_H - ROW_H / 2) / ROW_H)));
      if (eff !== dials.e || row !== dials.m) { if (row !== dials.m) dials.mem[dials.m] = dials.e; dials.m = row; dials.e = eff; saveDials(); syncMx(); }
    }
    function up() { pop.classList.remove('dragging'); removeEventListener('pointermove', move); removeEventListener('pointerup', up); }
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  }

  function recount() {
    if (!btn) return;
    var n = openComments().length, any = n > 0 || !!extraText();
    btn.classList.toggle('zero', !any && !run);
    var html = run ? 'Applying <span class="n">' + fmt((Date.now() - run.t0) / 1000) + '</span>'
      : 'Apply all comments <span class="n">' + n + '</span><kbd>' + esc(cfg.hotkey) + '</kbd>';
    if (btn.innerHTML !== html) btn.innerHTML = html;   // only on change, so a click never lands on a replaced span
    if (!pop || run) return;
    var where = esc(baseName(cfg.file || (location.protocol === 'file:' ? decodeURIComponent(location.pathname) : '')));
    sumEl.innerHTML = any
      ? '<b>' + n + ' comment' + (n === 1 ? '' : 's') + '</b> go to <b>' + where + '</b>. The page reloads when it is done.'
      : 'No open comments yet. Select some text and comment first.';
    goB.disabled = !any;
    goB.textContent = 'Apply with ' + MODELS[dials.m] + ' \u00b7 ' + EFFORTS[dials.e];
  }

  function showPop(on) {
    pop.classList.toggle('show', !!on);
    if (on) {
      if (window.RoboHighlight && window.RoboHighlight.panel) window.RoboHighlight.panel(false);   // both sit in the same corner
      syncMx();
    }
  }
  function err(msg) { errEl.textContent = msg || ''; errEl.style.display = msg ? 'block' : 'none'; }

  function start() {
    if (run) return;
    var sent = openComments(), text = commentText(sent);
    if (!text) { err('No open comments yet.'); return; }
    err(''); goB.disabled = true; goB.textContent = 'Starting...';
    var model = MODELS[dials.m], effort = EFFORTS[dials.e];
    fetch(cfg.api + '/api/apply-comments', {
      method: 'POST', headers: { 'Content-Type': 'text/plain' },   // text/plain = no CORS preflight from file:// or another port
      body: JSON.stringify({ page: location.href, file: cfg.file || '', notes: cfg.notes || '', title: cfg.title || document.title, comments: text, model: model, effort: effort })
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (!d.job) throw new Error(d.error || 'The run did not start.');
      run = { job: d.job, sent: sent, t0: Date.now(), model: model, effort: effort, file: d.file || '' };
      ls.set(cfg.key + '-run', JSON.stringify(run));
      watch();
    }).catch(function (e) {
      var off = /failed to fetch|networkerror|load failed/i.test(String(e.message));
      if (off) copyForAgent(text); else err(e.message);
      recount();
    });
  }
  // the Agentic OS did not answer: nothing ran, so hand the comments to the user's agent instead
  function copyForAgent(text) {
    var said = 'The Agentic OS is not running, so I copied your comments. Paste them into a chat with your agent.';
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { err(said); })
      .catch(function () { err('The Agentic OS is not running. Copy your comments from the box and paste them into a chat with your agent.'); window.prompt('Copy your comments:', text); });
  }
  function watch() {
    pop.classList.add('running'); tailEl.textContent = ''; stT.textContent = run.model + ' \u00b7 ' + run.effort;
    goB.disabled = true; goB.textContent = 'Applying...';
    clearInterval(tick); clearInterval(poll);
    tick = setInterval(function () {
      var el = (Date.now() - run.t0) / 1000;
      fill.style.width = Math.min(94, 100 * (1 - Math.exp(-el / 240))) + '%';
      elT.textContent = fmt(el); recount();
    }, 500);
    poll = setInterval(check, 2500); check();
  }
  function check() {
    if (!run) return;
    fetch(cfg.api + '/api/run-status?job=' + encodeURIComponent(run.job)).then(function (r) { return r.json(); }).then(function (st) {
      if (!run) return;
      if (st.error) return finish(false, 'The Agentic OS restarted during the run, so its result is lost. Check the page, then apply again if needed.');
      if (st.tail) tailEl.textContent = st.tail;
      if (st.status !== 'running') finish(st.status === 'done', st.result || st.tail || '');
    }).catch(function () {});   // an OS blip: keep polling
  }
  function finish(ok, text) {
    clearInterval(tick); clearInterval(poll);
    var r = run; run = null; ls.del(cfg.key + '-run');
    if (!ok) { pop.classList.remove('running'); showPop(true); err('The run failed, so nothing is marked applied. ' + String(text || '').slice(-400)); recount(); return; }
    fill.style.width = '100%'; elT.textContent = 'Done. Reloading...';
    var note = 'Applied by ' + r.model + ' \u00b7 ' + r.effort, hl = [], cm = [];
    r.sent.forEach(function (k) { (k.kind === 'hl' ? hl : cm).push(k.id); });
    Promise.all([
      hl.length && window.RoboHighlight && window.RoboHighlight.markApplied ? window.RoboHighlight.markApplied(hl, note) : null,
      cm.length && window.RoboComments && window.RoboComments.markApplied ? window.RoboComments.markApplied(cm, note) : null
    ]).catch(function () {}).then(function () {
      ls.set(cfg.key + '-last', JSON.stringify({ n: r.sent.length, model: r.model, effort: r.effort, secs: Math.round((Date.now() - r.t0) / 1000), result: String(text || '').slice(-2500), at: Date.now() }));
      setTimeout(function () { location.reload(); }, 600);
    });
  }

  // after the reload: one card with what the run says it changed, shown once
  function showLast() {
    var last = readJson(cfg.key + '-last'); if (!last) return;
    ls.del(cfg.key + '-last');
    if (Date.now() - last.at > 10 * 60 * 1000) return;
    var card = document.createElement('div'); card.className = 'rap-done';
    card.innerHTML = '<div class="hd"><b>\u2713 Applied ' + last.n + ' comment' + (last.n === 1 ? '' : 's') + '</b><span>' + esc(last.model + ' \u00b7 ' + last.effort + ' \u00b7 ' + fmt(last.secs)) +
      '</span><button class="x" aria-label="Close">\u00d7</button></div>' +
      (last.result ? '<pre>' + esc(last.result).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`\n]+)`/g, '<code>$1</code>') + '</pre>' : '');
    card.querySelector('.x').onclick = function () { card.remove(); };
    document.body.appendChild(card);
  }

  // one bottom-right row: the other features' buttons sit left of Apply, which keeps the corner
  function adopt() {
    ['.rhl-fab', '.rcm-fab', '.rcart-fab'].forEach(function (sel) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) {
        if (el.parentNode !== document.body) return;   // a button mounted in the page header stays there
        el.style.position = 'static'; el.style.right = 'auto'; el.style.bottom = 'auto';
        dock.appendChild(el);   // after Apply in the DOM = left of it on screen (row-reverse)
      });
    });
  }

  function build() {
    var st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
    dock = document.createElement('div'); dock.className = 'rap-dock'; document.body.appendChild(dock);
    btn = document.createElement('button'); btn.type = 'button'; btn.className = 'rap-btn'; btn.title = 'Apply all comments now (key ' + cfg.hotkey + ')';
    btn.onclick = function () { showPop(!pop.classList.contains('show')); };
    dock.appendChild(btn);

    pop = document.createElement('div'); pop.className = 'rap-pop';
    pop.innerHTML = '<div class="ahead"><span class="t"><b>APPLY ALL</b> \u00b7 MODEL \u00d7 EFFORT</span><button class="x" aria-label="Close">\u2715</button></div>' +
      '<div class="rap-mx"></div><p class="sum"></p>' +
      '<div class="row"><button class="rap-b go" data-a="run"></button><button class="rap-b" data-a="copy" title="Copy the comments to paste into a chat">Copy</button></div>' +
      '<div class="rap-prog"><div class="track"><i></i></div><div class="tm"><span class="el">0:00</span><span class="st"></span></div><pre class="tail"></pre></div>' +
      '<div class="rap-err"></div>';
    document.body.appendChild(pop);
    mx = pop.querySelector('.rap-mx'); fill = pop.querySelector('.track i'); elT = pop.querySelector('.el'); stT = pop.querySelector('.st');
    tailEl = pop.querySelector('.tail'); errEl = pop.querySelector('.rap-err'); goB = pop.querySelector('[data-a="run"]'); sumEl = pop.querySelector('.sum');

    mx.innerHTML = '<div></div>' + EFFORTS.map(function (e) { return '<div class="colh">' + e + '</div>'; }).join('') +
      MODELS.map(function (name, m) {
        return '<div class="rowh" data-m="' + m + '">' + name + '</div>' +
          EFFORTS.map(function (_, e) { return '<div class="cell" data-m="' + m + '" data-e="' + e + '"><i></i></div>'; }).join('');
      }).join('') + '<div class="rap-pill"></div><div class="rap-knob"></div>';
    Array.prototype.forEach.call(mx.querySelectorAll('.cell'), function (c) {
      c.addEventListener('pointerdown', function (ev) { ev.preventDefault(); ev.stopPropagation(); setDial(+c.getAttribute('data-m'), +c.getAttribute('data-e'), true); knobDrag(ev); });
    });
    mx.querySelector('.rap-knob').addEventListener('pointerdown', function (ev) { ev.preventDefault(); ev.stopPropagation(); knobDrag(ev); });

    pop.querySelector('.x').onclick = function () { showPop(false); };
    goB.onclick = start;
    pop.querySelector('[data-a="copy"]').onclick = function () {
      var t = commentText(openComments()); if (!t) { err('No open comments yet.'); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { err('Copied. Paste it into a chat.'); })
        .catch(function () { window.prompt('Copy your comments:', t); });
    };
    document.addEventListener('pointerdown', function (e) {
      if (pop.classList.contains('show') && !pop.contains(e.target) && !btn.contains(e.target)) showPop(false);
    });
    document.addEventListener('keydown', function (e) {
      var t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      var open = pop.classList.contains('show');
      if (e.key === cfg.hotkey) { e.preventDefault(); showPop(!open); }
      else if (open && e.key === 'Escape') showPop(false);
      else if (open && e.key === 'Enter' && !run && !goB.disabled) { e.preventDefault(); e.stopImmediatePropagation(); start(); }
    }, true);
  }

  window.RoboApply = {
    init: function (opts) {
      cfg = Object.assign({ key: 'robo-apply:' + location.pathname, title: '', file: '', notes: '', api: 'http://localhost:50000', hotkey: 'a', more: null }, opts || {});
      build(); adopt(); setTimeout(adopt, 0); setTimeout(adopt, 800);
      recount(); setInterval(recount, 800);
      showLast();
      var saved = readJson(cfg.key + '-run');   // a reload mid-run picks it back up
      if (saved && saved.job && Date.now() - saved.t0 < 3 * 3600 * 1000) { run = saved; setTimeout(function () { showPop(true); watch(); }, 800); }
      else if (saved) ls.del(cfg.key + '-run');
      return window.RoboApply;
    },
    open: function () { showPop(true); },
    close: function () { showPop(false); },
    refresh: function () { adopt(); recount(); },
    running: function () { return !!run; }
  };
})();
