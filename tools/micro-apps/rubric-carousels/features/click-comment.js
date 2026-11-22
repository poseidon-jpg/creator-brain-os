/* RoboComments - the RUBRIC "click to comment" feature. One file, no dependencies, works from file:// and http.
   Built from the RUBRIC Storyboards pins (click a still, a numbered pin drops where you clicked, type the comment).

   Use:
     <div data-comment-id="card-3" data-comment-label="Card 3 · PhotoCraft">...</div>     (any element can be a target)
     <script src="click-comment.js"></script>
     <script>RoboComments.init({ key:'my-page-comments', title:'Adobe carousel' });</script>
   always:true = every click on a target opens the comment box (review apps; the button then opens the list). Buttons,
   links and [data-comment-ignore] inside a target keep their own click.
   Otherwise comment mode: the floating "Comment" button or the key m. In comment mode a click on a target drops a pin at that
   spot (x/y in % of the target) and opens a box: type, Enter saves, Esc cancels. Click a pin to edit or delete it.
   The same id can appear on several elements (a thumbnail and a big view): every copy shows the pins.
   A comment: { id, target, label, x, y, text, created, status?, appliedNote? }   x/y = null means a note on the whole target (no pin).
   status:'applied' (set by the agent in the saved file once it made the change) = a faded green tick pin, left out of the export.

   Saving: localStorage by default. An app that saves to disk passes
     store: { load: () => Promise<comments[]>, save: (comments) => Promise }
   API: refresh() after the DOM changes · list() · forTarget(id) · add({target,x,y,text}) · remove(id) · markApplied(ids, note) · setMode(bool)
        · note(target, text) sets the whole-target note · text(filter) builds the export · panel(true|false)
   Export ("Copy comments for my agent"):
     Comments on <title>: N
     <label>
       1. pin at 40% across, 22% down: <text>
       Note: <text>
   Theme: reads --bg, --card, --text, --muted, --accent, --line from the page (dark defaults if missing). */
(function () {
  'use strict';
  if (window.RoboComments) return;
  var cfg = null, list = [], mode = false, memory = {}, pop = null, saveT = null;
  var lstore = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return memory[k] == null ? null : memory[k]; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { memory[k] = v; } }
  };
  var CSS = '' +
    ':where([data-comment-id]){position:relative}' +   /* zero specificity: a page rule that positions a target still wins */
    'body.rcm-on [data-comment-id]{cursor:crosshair;outline:2px dashed var(--accent,#ff6b1a);outline-offset:3px}' +
    'body.rcm-always [data-comment-id]{cursor:crosshair}' +
    '.rcm-pin{position:absolute;z-index:50;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50% 50% 50% 4px;background:var(--accent,#ff6b1a);color:#fff;' +
      'font:700 12px/24px Outfit,system-ui,sans-serif;text-align:center;box-shadow:2px 2px 0 rgba(0,0,0,.55);cursor:pointer;transform:rotate(-45deg)}' +
    '.rcm-pin span{display:inline-block;transform:rotate(45deg)}' +
    '.rcm-pin.small{width:16px;height:16px;margin:-8px 0 0 -8px;font-size:9px;line-height:16px}' +
    '.rcm-pin.done{background:var(--green,#5fbf6e);opacity:.6}' +   /* applied by the agent: kept for the record, out of the export */
    '.rcm-panel .it.done{opacity:.5}.rcm-panel .it.done i{color:var(--green,#5fbf6e)}' +
    '.rcm-pin.flash{animation:rcmFlash .9s ease 2}@keyframes rcmFlash{50%{box-shadow:0 0 0 8px rgba(255,107,26,.35)}}' +
    '.rcm-pop{position:fixed;z-index:9600;width:280px;background:var(--card,#24221c);color:var(--text,#e8e2d2);border-radius:8px;padding:10px;box-shadow:6px 6px 0 var(--shadow,#000);font:400 14px Outfit,system-ui,sans-serif}' +
    '.rcm-pop b{display:block;font-weight:600;font-size:12px;color:var(--muted,#8d8775);margin:0 0 6px;letter-spacing:.3px}' +
    '.rcm-pop textarea{width:100%;min-height:70px;resize:vertical;font:400 14px Outfit,system-ui,sans-serif;color:var(--text,#e8e2d2);background:var(--well,#1a1915);border:2px solid var(--accent,#ff6b1a);border-radius:6px;padding:7px 8px;outline:none;box-sizing:border-box}' +
    '.rcm-pop .row{display:flex;gap:6px;margin-top:8px}.rcm-pop .sp{flex:1}' +
    '.rcm-b{font:600 13px Outfit,system-ui,sans-serif;padding:7px 11px;border-radius:7px;border:0;cursor:pointer;background:var(--well,#1a1915);color:var(--text,#e8e2d2)}' +
    '.rcm-b.go{background:var(--accent,#ff6b1a);color:#fff}.rcm-b.del{color:var(--muted,#8d8775)}.rcm-b.del:hover{color:var(--accent,#ff6b1a)}' +
    '.rcm-fab{position:fixed;right:18px;bottom:70px;z-index:9000;display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:0;border-radius:8px;background:var(--card,#24221c);' +
      'color:var(--text,#e8e2d2);font:600 14px Outfit,system-ui,sans-serif;cursor:pointer;box-shadow:5px 5px 0 var(--shadow,#000);transition:transform .15s,box-shadow .15s}' +
    '.rcm-fab:hover{transform:translate(-2px,-2px)}.rcm-fab.on{background:var(--accent,#ff6b1a);color:#fff}' +
    '.rcm-fab .n{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--well,#1a1915);color:var(--text,#e8e2d2);font-size:12px;line-height:20px;text-align:center}' +
    '.rcm-panel{position:fixed;left:18px;bottom:18px;z-index:9001;width:min(360px,calc(100vw - 36px));max-height:min(70vh,560px);display:none;flex-direction:column;background:var(--bg,#131311);color:var(--text,#e8e2d2);' +
      'border-radius:10px;box-shadow:6px 6px 0 var(--shadow,#000);font:400 14px/1.4 Outfit,system-ui,sans-serif}' +
    '.rcm-panel.show{display:flex}.rcm-panel .hd{display:flex;align-items:center;gap:8px;padding:12px 14px 6px}.rcm-panel .hd b{font-weight:600;font-size:16px}' +
    '.rcm-panel .hd span{color:var(--muted,#8d8775);font-size:12px}.rcm-panel .x{margin-left:auto;border:0;background:transparent;color:var(--muted,#8d8775);font-size:22px;cursor:pointer}' +
    '.rcm-panel .bd{overflow-y:auto;padding:0 14px 8px}.rcm-panel .grp{margin:8px 0 2px;font-weight:600;font-size:13px}' +
    '.rcm-panel .it{display:grid;grid-template-columns:22px 1fr 22px;gap:6px;padding:5px 0;border-bottom:1px solid var(--line,#3a372f);cursor:pointer}' +
    '.rcm-panel .it i{font-style:normal;color:var(--accent,#ff6b1a);font-weight:700}.rcm-panel .it button{border:0;background:transparent;color:var(--muted,#8d8775);cursor:pointer}' +
    '.rcm-panel .ft{display:flex;gap:6px;padding:10px 14px 14px}.rcm-panel .empty{color:var(--muted,#8d8775);padding:8px 0}' +
    '.rcm-toast{position:fixed;left:50%;bottom:24px;z-index:9700;transform:translateX(-50%);background:var(--accent,#ff6b1a);color:#fff;font:600 14px Outfit,system-ui,sans-serif;padding:9px 16px;border-radius:8px;opacity:0;transition:opacity .2s;pointer-events:none}' +
    '.rcm-toast.show{opacity:1}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function uid() { return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function labelOf(id) { var el = document.querySelector('[data-comment-id="' + cssq(id) + '"]'); return (el && el.getAttribute('data-comment-label')) || id; }
  function cssq(s) { return String(s).replace(/["\\]/g, '\\$&'); }
  function pinsOf(t) { return list.filter(function (c) { return c.target === t && c.x != null; }); }

  function saveNow() {
    clearTimeout(saveT);
    if (cfg.store && cfg.store.save) return Promise.resolve(cfg.store.save(list.slice())).catch(function () { toast('Could not save, try again'); });
    lstore.set(cfg.key, JSON.stringify(list)); return Promise.resolve();
  }
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(saveNow, 250);
    render(); if (cfg.onChange) cfg.onChange(list.slice());
  }
  // Apply all comments (apply-comments.js) marks what it sent once the run worked; saved at once, because the page reloads next
  function markApplied(ids, note) {
    var at = new Date().toISOString();
    list.forEach(function (c) { if (ids.indexOf(c.id) >= 0) { c.status = 'applied'; c.appliedAt = at; if (note) c.appliedNote = note; } });
    render(); if (cfg.onChange) cfg.onChange(list.slice());
    return saveNow();
  }
  function loadAll() {
    if (cfg.store && cfg.store.load) return Promise.resolve(cfg.store.load()).then(function (v) { list = Array.isArray(v) ? v : []; render(); });
    try { var v = JSON.parse(lstore.get(cfg.key)); list = Array.isArray(v) ? v : []; } catch (e) { list = []; }
    render(); return Promise.resolve();
  }

  var fab, panel, toastEl, toastT;
  function build() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    toastEl = document.createElement('div'); toastEl.className = 'rcm-toast'; document.body.appendChild(toastEl);
    if (cfg.button !== false) {
      fab = document.createElement('button'); fab.type = 'button'; fab.className = 'rcm-fab'; fab.title = 'Comment mode (key m). Right-click for the list.';
      fab.innerHTML = (cfg.always ? 'Comments' : 'Comment') + ' <span class="n">0</span>';
      fab.onclick = function () { if (cfg.always) showPanel(!panel.classList.contains('show')); else setMode(!mode); };   // always-on pages: the button opens the list
      if (cfg.always) fab.title = 'All comments (a click on anything opens the comment box)';
      fab.oncontextmenu = function (e) { e.preventDefault(); showPanel(!panel.classList.contains('show')); };
      (cfg.mount ? document.querySelector(cfg.mount) : document.body).appendChild(fab);
      if (cfg.mount) fab.style.position = 'static';
    }
    panel = document.createElement('div'); panel.className = 'rcm-panel';
    panel.innerHTML = '<div class="hd"><b>Comments</b><span class="c"></span><button class="x" aria-label="Close">\u00d7</button></div><div class="bd"></div>' +
      '<div class="ft"><button class="rcm-b go" data-a="copy">Copy comments for my agent</button><button class="rcm-b" data-a="clear">Clear</button></div>';
    document.body.appendChild(panel);
    panel.querySelector('.x').onclick = function () { showPanel(false); };
    panel.querySelector('.ft').onclick = function (e) {
      var a = e.target.getAttribute('data-a');
      if (a === 'copy') copy();
      if (a === 'clear' && list.length && confirm('Delete every comment on this page?')) { list = []; persist(); }
    };
    panel.querySelector('.bd').onclick = function (e) {
      var del = e.target.closest('[data-del]'); if (del) { remove(del.getAttribute('data-del')); return; }
      var it = e.target.closest('[data-go]'); if (it) goTo(it.getAttribute('data-go'));
    };

    // a click on a pin edits it; in comment mode a click on a target drops a new pin
    document.addEventListener('click', function (e) {
      var pin = e.target.closest('.rcm-pin');
      if (pin) { e.preventDefault(); e.stopPropagation(); editBox(pin.getAttribute('data-cid'), e.clientX, e.clientY); return; }
      if (!(mode || cfg.always) || (pop && pop.contains(e.target))) return;
      if (e.target.closest('.rcm-fab,.rcm-panel,.rcart,.rcart-fab,.rnav')) return;
      var t = e.target.closest('[data-comment-id]'); if (!t) return;
      var ui = e.target.closest('button,a,input,textarea,select,label,[data-comment-ignore]');   // a button inside a target keeps its own job
      if (ui && t.contains(ui)) return;
      e.preventDefault(); e.stopPropagation();
      var r = t.getBoundingClientRect();
      var x = Math.round((e.clientX - r.left) / r.width * 1000) / 10, y = Math.round((e.clientY - r.top) / r.height * 1000) / 10;
      newBox(t.getAttribute('data-comment-id'), x, y, e.clientX, e.clientY);
    }, true);
    document.addEventListener('keydown', function (e) {
      var t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (e.key === 'Escape') { if (pop) closePop(); else if (mode) setMode(false); return; }
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === cfg.modeKey) setMode(!mode);
    });
    window.addEventListener('resize', render);
  }

  function boxAt(cx, cy, html) {
    closePop();
    pop = document.createElement('div'); pop.className = 'rcm-pop'; pop.innerHTML = html; document.body.appendChild(pop);
    var w = 280, h = pop.offsetHeight || 160;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, cx + 14)) + 'px';
    pop.style.top = Math.max(8, Math.min(window.innerHeight - h - 8, cy + 10)) + 'px';
    var ta = pop.querySelector('textarea'); if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    return pop;
  }
  function closePop() { if (pop) pop.remove(); pop = null; }
  function newBox(target, x, y, cx, cy) {
    var p = boxAt(cx, cy, '<b>' + esc(labelOf(target)) + ' \u00b7 new comment</b><textarea placeholder="Your comment"></textarea>' +
      '<div class="row"><span class="sp"></span><button class="rcm-b" data-a="no">Cancel</button><button class="rcm-b go" data-a="ok">Save</button></div>');
    var ta = p.querySelector('textarea');
    var ok = function () { var v = ta.value.trim(); if (v) add({ target: target, x: x, y: y, text: v }); closePop(); };
    p.querySelector('[data-a="ok"]').onclick = ok; p.querySelector('[data-a="no"]').onclick = closePop;
    ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ok(); } };
  }
  function editBox(cid, cx, cy) {
    var c = list.find(function (k) { return k.id === cid; }); if (!c) return;
    var p = boxAt(cx, cy, '<b>' + esc(c.label || labelOf(c.target)) + '</b><textarea>' + esc(c.text) + '</textarea>' +
      '<div class="row"><button class="rcm-b del" data-a="del">Delete</button><span class="sp"></span><button class="rcm-b" data-a="no">Cancel</button><button class="rcm-b go" data-a="ok">Save</button></div>');
    var ta = p.querySelector('textarea');
    var ok = function () { var v = ta.value.trim(); if (v) { c.text = v; persist(); } else remove(cid); closePop(); };
    p.querySelector('[data-a="ok"]').onclick = ok; p.querySelector('[data-a="no"]').onclick = closePop;
    p.querySelector('[data-a="del"]').onclick = function () { remove(cid); closePop(); };
    ta.onkeydown = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ok(); } };
  }

  function render() {
    document.querySelectorAll('.rcm-pin').forEach(function (n) { n.remove(); });
    document.querySelectorAll('[data-comment-id]').forEach(function (el) {
      var t = el.getAttribute('data-comment-id'), small = el.getBoundingClientRect().width < 260;
      pinsOf(t).forEach(function (c, i) {
        var done = c.status === 'applied';
        var d = document.createElement('div'); d.className = 'rcm-pin' + (small ? ' small' : '') + (done ? ' done' : ''); d.setAttribute('data-cid', c.id);
        d.title = (done ? 'Applied' + (c.appliedNote ? ': ' + c.appliedNote : '') + ' · ' : '') + c.text;
        d.style.left = c.x + '%'; d.style.top = c.y + '%'; d.innerHTML = '<span>' + (done ? '✓' : (i + 1)) + '</span>';
        el.appendChild(d);
      });
    });
    if (fab) fab.querySelector('.n').textContent = list.filter(function (c) { return c.status !== 'applied'; }).length;   // open comments only
    if (panel) renderPanel();
  }
  function renderPanel() {
    panel.querySelector('.c').textContent = list.length + (list.length === 1 ? ' comment' : ' comments');
    var groups = {}, order = [];
    list.forEach(function (c) { if (!groups[c.target]) { groups[c.target] = []; order.push(c.target); } groups[c.target].push(c); });
    panel.querySelector('.bd').innerHTML = list.length ? order.map(function (t) {
      var pins = 0;
      return '<div class="grp">' + esc(groups[t][0].label || labelOf(t)) + '</div>' + groups[t].map(function (c) {
        var done = c.status === 'applied', tag = done ? '\u2713' : (c.x != null ? String(++pins) : 'N');
        return '<div class="it' + (done ? ' done' : '') + '" data-go="' + esc(c.id) + '"><i>' + tag + '</i><span>' + esc(c.text) + '</span><button data-del="' + esc(c.id) + '" aria-label="Delete">\u00d7</button></div>';
      }).join('');
    }).join('') : '<div class="empty">No comments yet. Press m (or Comment), then click on anything to pin a note.</div>';
  }
  function showPanel(on) { panel.classList.toggle('show', !!on); if (on) renderPanel(); }
  function goTo(cid) {
    var c = list.find(function (k) { return k.id === cid; }); if (!c) return;
    var el = document.querySelector('[data-comment-id="' + cssq(c.target) + '"]'); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    var pin = el.querySelector('.rcm-pin[data-cid="' + cssq(cid) + '"]'); if (pin) { pin.classList.remove('flash'); void pin.offsetWidth; pin.classList.add('flash'); }
    if (cfg.onGo) cfg.onGo(c);
  }
  function toast(msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1600); }

  function text(filter) {
    var all = list.filter(filter || function () { return true; });
    var rows = all.filter(function (c) { return c.status !== 'applied'; });   // applied comments stay on the page, never in the export again
    var groups = {}, order = [];
    rows.forEach(function (c) { if (!groups[c.target]) { groups[c.target] = []; order.push(c.target); } groups[c.target].push(c); });
    var doneN = all.length - rows.length;
    var out = ['Comments on ' + (cfg.title || document.title) + ': ' + rows.length + ' open' + (doneN ? ' (' + doneN + ' already applied, left out)' : '')];
    order.forEach(function (t) {
      var pins = 0;
      out.push('', groups[t][0].label || labelOf(t));
      groups[t].forEach(function (c) {
        out.push(c.x != null ? '  ' + (++pins) + '. pin at ' + Math.round(c.x) + '% across, ' + Math.round(c.y) + '% down: ' + c.text : '  Note: ' + c.text);
      });
    });
    return out.join('\n') + '\n';
  }
  function copy(filter) {
    var t = text(filter); if (!list.length) { toast('No comments yet'); return; }
    var done = function () { toast('Copied comments for your agent'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, function () { fallback(t); done(); });
    else { fallback(t); done(); }
  }
  function fallback(t) { var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }

  function add(c) {
    var row = { id: uid(), target: c.target, label: c.label || labelOf(c.target), x: c.x == null ? null : c.x, y: c.y == null ? null : c.y, text: c.text, created: new Date().toISOString() };
    list.push(row); persist(); toast('Comment saved'); return row;
  }
  function remove(id) { list = list.filter(function (c) { return c.id !== id; }); persist(); }
  function note(target, textv) {
    var c = list.find(function (k) { return k.target === target && k.x == null; });
    if (!textv || !textv.trim()) { if (c) remove(c.id); return; }
    if (c) { c.text = textv.trim(); persist(); } else add({ target: target, x: null, y: null, text: textv.trim() });
  }
  function setMode(on) { mode = !!on; document.body.classList.toggle('rcm-on', mode); if (fab) fab.classList.toggle('on', mode); if (cfg.onMode) cfg.onMode(mode); }

  window.RoboComments = {
    init: function (opts) {
      cfg = Object.assign({ key: 'robo-comments-v1', title: '', modeKey: 'm', always: false, button: true, mount: null, store: null, onChange: null, onMode: null, onGo: null }, opts || {});
      build(); loadAll();
      if (cfg.always) document.body.classList.add('rcm-always');
      return window.RoboComments;
    },
    refresh: render, list: function () { return list.slice(); },
    forTarget: function (t) { return list.filter(function (c) { return c.target === t; }); },
    add: add, remove: remove, note: note, markApplied: markApplied, setMode: setMode, isOn: function () { return mode; },
    text: text, copy: copy, panel: showPanel, reload: loadAll, goTo: goTo
  };
})();
