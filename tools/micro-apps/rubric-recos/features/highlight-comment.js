/* RoboHighlight - the "highlight to comment" feature. One file, no dependencies, works from file:// and http.
   Built from the Content Accelerator classroom copy review: select any text, click Comment, type, and every comment
   exports with the page. The page text is never rewrapped, because highlights use the CSS Custom Highlight API.

   Use:
     <div data-hl-id="paid-B-body" data-hl-label="Paid post B · body">...text...</div>     (any element holding text)
     <script src="highlight-comment.js"></script>
     <script>RoboHighlight.init({ key:'my-page-hl', title:'My page', source:'my-page', product:'my-product' });</script>
   Select text inside a target and a Comment button appears over it. Click it (or press Enter) and type: Enter saves,
   Shift+Enter is a new line, Esc cancels a new one. Click a highlight to edit or delete it. Key h opens the list.
   A comment: { id, target, label, quote, nth, text, created, status?, appliedAt? }. nth = which copy of the quote inside
   the target, so a repeated phrase finds the right spot again after a reload or a re-render. status:'applied' (set by
   Apply all comments once the run worked) = no highlight, out of the export and the count, faded at the panel's bottom.
   Saving: localStorage by default; an app that saves to disk passes store: { load: () => Promise<[]>, save: (list) => Promise }.
   API: refresh() after the page re-renders · list() · count(prefix) · text() builds the export · markApplied(ids, note) · panel(true|false)
   Export: with source and product set, one feedback line per comment:
     - DATE (review page, <source>) → <product>: <label> > "<quote>": <text>
   otherwise "Comments on <title>: N" and one numbered line per comment.
   Theme: reads --bg, --card, --text, --muted, --accent, --line, --shadow, --well from the page (dark defaults if missing). */
(function () {
  'use strict';
  if (window.RoboHighlight) return;
  var cfg = null, list = [], ranges = {}, memory = {}, pending = null, saveT = null, fab, panel, pop, flt, toastEl, toastT;
  var lstore = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return memory[k] == null ? null : memory[k]; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { memory[k] = v; } }
  };
  var hasHL = typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined';
  var STYLE = '' +
    ':where([data-hl-id]){cursor:text}' +
    '::highlight(rhl){background-color:rgba(255,107,26,.3)}::highlight(rhl-on){background-color:rgba(255,107,26,.75);color:#fff}' +
    '.rhl-float{position:absolute;z-index:9500;display:none;border:0;border-radius:8px;padding:7px 12px;background:var(--accent,#ff6b1a);color:#fff;' +
      'font:600 13px Outfit,system-ui,sans-serif;cursor:pointer;box-shadow:4px 4px 0 var(--shadow,#000);transform:translateX(-50%)}' +
    '.rhl-pop{position:fixed;z-index:9600;width:300px;background:var(--card,#24221c);color:var(--text,#e8e2d2);border-radius:8px;padding:10px;box-shadow:6px 6px 0 var(--shadow,#000);font:400 14px Outfit,system-ui,sans-serif}' +
    '.rhl-pop b{display:block;font-weight:600;font-size:12px;color:var(--muted,#8d8775);margin:0 0 4px;letter-spacing:.3px}' +
    '.rhl-pop q{display:block;font-size:13px;color:var(--muted,#8d8775);margin:0 0 6px;max-height:3.6em;overflow:hidden}' +
    '.rhl-pop textarea{width:100%;min-height:70px;resize:vertical;font:400 14px Outfit,system-ui,sans-serif;color:var(--text,#e8e2d2);background:var(--well,#1a1915);border:2px solid var(--accent,#ff6b1a);border-radius:6px;padding:7px 8px;outline:none;box-sizing:border-box}' +
    '.rhl-pop .row{display:flex;gap:6px;margin-top:8px}.rhl-pop .sp{flex:1}' +
    '.rhl-b{font:600 13px Outfit,system-ui,sans-serif;padding:7px 11px;border-radius:7px;border:0;cursor:pointer;background:var(--well,#1a1915);color:var(--text,#e8e2d2)}' +
    '.rhl-b.go{background:var(--accent,#ff6b1a);color:#fff}.rhl-b.del{color:var(--muted,#8d8775)}.rhl-b.del:hover{color:var(--accent,#ff6b1a)}' +
    '.rhl-fab{position:fixed;right:18px;bottom:18px;z-index:9000;display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:0;border-radius:8px;background:var(--card,#24221c);' +
      'color:var(--text,#e8e2d2);font:600 14px Outfit,system-ui,sans-serif;cursor:pointer;box-shadow:5px 5px 0 var(--shadow,#000);transition:transform .15s,box-shadow .15s}' +
    '.rhl-fab:hover{transform:translate(-2px,-2px)}' +
    '.rhl-fab .n{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--accent,#ff6b1a);color:#fff;font-size:12px;line-height:20px;text-align:center}' +
    '.rhl-panel{position:fixed;right:18px;bottom:70px;z-index:9001;width:min(380px,calc(100vw - 36px));max-height:min(70vh,580px);display:none;flex-direction:column;background:var(--bg,#131311);color:var(--text,#e8e2d2);' +
      'border:1px solid var(--line,#34312a);border-radius:10px;box-shadow:6px 6px 0 var(--shadow,#000);font:400 14px/1.4 Outfit,system-ui,sans-serif}' +
    '.rhl-panel.show{display:flex}.rhl-panel .hd{display:flex;align-items:center;gap:8px;padding:12px 14px 6px}.rhl-panel .hd b{font-weight:600;font-size:16px}' +
    '.rhl-panel .hd span{color:var(--muted,#8d8775);font-size:12px}.rhl-panel .x{margin-left:auto;border:0;background:transparent;color:var(--muted,#8d8775);font-size:22px;cursor:pointer}' +
    '.rhl-panel .bd{overflow-y:auto;padding:0 14px 8px}.rhl-panel .grp{margin:10px 0 2px;font-weight:600;font-size:13px}' +
    '.rhl-panel .it{display:grid;grid-template-columns:1fr 22px;gap:6px;padding:6px 0;border-bottom:1px solid var(--line,#3a372f);cursor:pointer}' +
    '.rhl-panel .it q{display:block;color:var(--muted,#8d8775);font-size:12.5px}.rhl-panel .it span{display:block}' +
    '.rhl-panel .it button{border:0;background:transparent;color:var(--muted,#8d8775);cursor:pointer;font-size:16px}' +
    '.rhl-panel .it.ap{opacity:.5;cursor:default}.rhl-panel .grp.ap{color:#2aa88a}' +
    '.rhl-panel .ft{display:flex;gap:6px;padding:10px 14px 14px}.rhl-panel .empty{color:var(--muted,#8d8775);padding:8px 0}' +
    '.rhl-flash{animation:rhlFlash 1.1s ease}@keyframes rhlFlash{30%{box-shadow:0 0 0 4px var(--accent,#ff6b1a)}}' +
    '.rhl-toast{position:fixed;left:50%;bottom:24px;z-index:9700;transform:translateX(-50%);background:var(--accent,#ff6b1a);color:#fff;font:600 14px Outfit,system-ui,sans-serif;padding:9px 16px;border-radius:8px;opacity:0;transition:opacity .2s;pointer-events:none}' +
    '.rhl-toast.show{opacity:1}';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function cssq(s) { return String(s).replace(/["\\]/g, '\\$&'); }
  function uid() { return 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function targetEl(id) { return document.querySelector('[data-hl-id="' + cssq(id) + '"]'); }
  function toast(t) { toastEl.textContent = t; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1600); }

  function isOpen(c) { return c.status !== 'applied'; }
  function saveNow() {
    clearTimeout(saveT);
    if (cfg.store && cfg.store.save) return Promise.resolve(cfg.store.save(list.slice())).catch(function () { toast('Could not save, try again'); });
    lstore.set(cfg.key, JSON.stringify(list)); return Promise.resolve();
  }
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(saveNow, 200);
    paint(); renderPanel(); if (cfg.onChange) cfg.onChange(list.slice());
  }
  // Apply all comments (apply-comments.js) marks what it sent once the run worked; saved at once, because the page reloads next
  function markApplied(ids, note) {
    var at = new Date().toISOString();
    list.forEach(function (c) { if (ids.indexOf(c.id) >= 0) { c.status = 'applied'; c.appliedAt = at; if (note) c.appliedNote = note; } });
    paint(); renderPanel(); if (cfg.onChange) cfg.onChange(list.slice());
    return saveNow();
  }

  // the text range of the nth copy of quote inside container
  function findRange(container, quote, nth) {
    var walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT), nodes = [], text = '', n;
    while ((n = walker.nextNode())) { nodes.push([n, text.length]); text += n.data; }
    var idx = -1, from = 0;
    for (var k = 0; k <= (nth || 0); k++) { idx = text.indexOf(quote, from); if (idx < 0) return null; from = idx + 1; }
    var end = idx + quote.length, r = document.createRange(), started = false;
    for (var i = 0; i < nodes.length; i++) { var nd = nodes[i]; if (idx >= nd[1] && idx <= nd[1] + nd[0].data.length) { r.setStart(nd[0], idx - nd[1]); started = true; break; } }
    if (!started) return null;
    for (var j = 0; j < nodes.length; j++) { var ne = nodes[j]; if (end >= ne[1] && end <= ne[1] + ne[0].data.length) { r.setEnd(ne[0], end - ne[1]); return r; } }
    return null;
  }
  function resolve() {
    ranges = {};
    list.forEach(function (c) { var t = targetEl(c.target); if (t) { var r = findRange(t, c.quote, c.nth); if (r) ranges[c.id] = r; } });
  }
  function paint(activeId) {
    if (!hasHL) return;
    var all = [], on = [];
    list.forEach(function (c) { var r = ranges[c.id]; if (r && isOpen(c)) (c.id === activeId ? on : all).push(r); });
    CSS.highlights.set('rhl', new Highlight(...all));
    CSS.highlights.set('rhl-on', new Highlight(...on));
  }

  function order() {
    var ids = Array.prototype.slice.call(document.querySelectorAll('[data-hl-id]')).map(function (e) { return e.getAttribute('data-hl-id'); });
    return list.slice().sort(function (a, b) { return (ids.indexOf(a.target) - ids.indexOf(b.target)) || (a.created - b.created); });
  }
  function renderPanel() {
    if (!panel) return;
    var open = order().filter(isOpen), done = order().filter(function (c) { return !isOpen(c); });
    fab.querySelector('.n').textContent = open.length;
    panel.querySelector('.c').textContent = open.length ? open.length + ' on this page' : '';
    var bd = panel.querySelector('.bd');
    if (!list.length) { bd.innerHTML = '<p class="empty">Select any text on the page, then click Comment. Your comments show here; a click jumps back to the spot.</p>'; return; }
    var last = null;
    function row(c, go) {
      return '<div class="it' + (go ? '" data-go="' + c.id : ' ap') + '"><div><q>' + esc(c.quote.length > 120 ? c.quote.slice(0, 120) + '...' : c.quote) + '</q><span>' +
        esc(c.text || '(highlighted, no comment)') + '</span></div><button data-del="' + c.id + '" aria-label="Delete">\u00d7</button></div>';
    }
    // applied comments leave the export and the count, and wait faded at the bottom until deleted
    bd.innerHTML = open.map(function (c) {
      var head = c.label !== last ? '<div class="grp">' + esc(c.label) + '</div>' : ''; last = c.label;
      return head + row(c, true);
    }).join('') + (done.length ? '<div class="grp ap">\u2713 Applied (' + done.length + ')</div>' + done.map(function (c) { return row(c, false); }).join('') : '');
  }
  function showPanel(on) { panel.classList.toggle('show', !!on); }

  function placePop(x, y) {
    var w = 300, h = pop.offsetHeight || 190;
    pop.style.left = Math.max(10, Math.min(window.innerWidth - w - 10, x - w / 2)) + 'px';
    pop.style.top = (y + h + 20 > window.innerHeight ? Math.max(10, y - h - 14) : y + 14) + 'px';
  }
  function closePop(cancelNew) {
    if (!pop) return;
    var id = pop.getAttribute('data-cid'), c = list.filter(function (x) { return x.id === id; })[0];
    if (cancelNew && c && pop.getAttribute('data-new') === '1' && !c.text) { list = list.filter(function (x) { return x.id !== id; }); delete ranges[id]; persist(); }
    pop.remove(); pop = null; paint();
  }
  function editBox(id, x, y, isNew) {
    if (pop) closePop(false);
    var c = list.filter(function (q) { return q.id === id; })[0]; if (!c) return;
    pop = document.createElement('div'); pop.className = 'rhl-pop'; pop.setAttribute('data-cid', id); pop.setAttribute('data-new', isNew ? '1' : '0');
    pop.innerHTML = '<b>' + esc(c.label) + '</b><q>' + esc(c.quote) + '</q><textarea placeholder="Your comment">' + esc(c.text || '') + '</textarea>' +
      '<div class="row"><button class="rhl-b del" data-a="del">Delete</button><span class="sp"></span><button class="rhl-b" data-a="cancel">Cancel</button><button class="rhl-b go" data-a="save">Save</button></div>';
    document.body.appendChild(pop); placePop(x, y); paint(id);
    var ta = pop.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    function save() { c.text = ta.value.trim(); persist(); closePop(false); }
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.preventDefault(); closePop(true); }
    });
    pop.querySelector('.row').onclick = function (e) {
      var a = e.target.getAttribute('data-a');
      if (a === 'save') save();
      if (a === 'cancel') closePop(true);
      if (a === 'del') { list = list.filter(function (q) { return q.id !== id; }); delete ranges[id]; pop.remove(); pop = null; persist(); }
    };
  }

  function addFromPending() {
    if (!pending) return;
    var c = { id: uid(), target: pending.target, label: pending.label, quote: pending.quote, nth: pending.nth, text: '', created: Date.now() };
    list.push(c); ranges[c.id] = pending.range;
    var rect = pending.range.getBoundingClientRect();
    flt.style.display = 'none'; pending = null;
    try { window.getSelection().removeAllRanges(); } catch (e) {}
    persist(); editBox(c.id, rect.left + rect.width / 2, rect.bottom, true);
  }

  function jump(id) {
    var r = ranges[id]; if (!r) { toast('That text changed, so it is not on the page now'); return; }
    var el = r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' }); paint(id); setTimeout(function () { paint(); }, 1600);
  }

  function exportText() {
    var all = order().filter(isOpen);
    if (cfg.source && cfg.product) {
      var day = new Date().toISOString().slice(0, 10);
      return all.map(function (c) {
        return '- ' + day + ' (review page, ' + cfg.source + ') \u2192 ' + cfg.product + ': ' + c.label + ' > "' + c.quote.replace(/\s+/g, ' ').slice(0, 160) + '": ' +
          (c.text || '(highlighted, no comment)').replace(/\n+/g, ' ');
      }).join('\n');
    }
    return 'Comments on ' + cfg.title + ': ' + all.length + '\n' + all.map(function (c, i) {
      return (i + 1) + '. ' + c.label + ' > "' + c.quote.replace(/\s+/g, ' ').slice(0, 160) + '": ' + (c.text || '(highlighted, no comment)').replace(/\n+/g, ' ');
    }).join('\n');
  }
  function copy() {
    var t = exportText(), n = list.filter(isOpen).length;
    if (!n) { toast('No open comments'); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { toast('Copied ' + n + ' comment' + (n > 1 ? 's' : '')); })
      .catch(function () { window.prompt('Copy your comments:', t); });
  }

  function build() {
    var st = document.createElement('style'); st.textContent = STYLE; document.head.appendChild(st);
    toastEl = document.createElement('div'); toastEl.className = 'rhl-toast'; document.body.appendChild(toastEl);
    flt = document.createElement('button'); flt.type = 'button'; flt.className = 'rhl-float'; flt.textContent = '\ud83d\udcac Comment'; document.body.appendChild(flt);
    flt.addEventListener('mousedown', function (e) { e.preventDefault(); });   // keep the selection alive
    flt.onclick = addFromPending;
    fab = document.createElement('button'); fab.type = 'button'; fab.className = 'rhl-fab'; fab.title = 'All comments (key h)';
    fab.innerHTML = 'Comments <span class="n">0</span>'; fab.onclick = function () { showPanel(!panel.classList.contains('show')); };
    (cfg.mount ? document.querySelector(cfg.mount) : document.body).appendChild(fab);
    if (cfg.mount) fab.style.position = 'static';
    panel = document.createElement('div'); panel.className = 'rhl-panel';
    panel.innerHTML = '<div class="hd"><b>Comments</b><span class="c"></span><button class="x" aria-label="Close">\u00d7</button></div><div class="bd"></div>' +
      '<div class="ft"><button class="rhl-b go" data-a="copy">Copy comments for my agent</button><button class="rhl-b" data-a="clear">Clear</button></div>';
    document.body.appendChild(panel);
    panel.querySelector('.x').onclick = function () { showPanel(false); };
    panel.querySelector('.ft').onclick = function (e) {
      var a = e.target.getAttribute('data-a');
      if (a === 'copy') copy();
      if (a === 'clear' && list.length && window.confirm('Delete every comment on this page?')) { list = []; ranges = {}; persist(); }
    };
    panel.querySelector('.bd').onclick = function (e) {
      var del = e.target.closest('[data-del]'); if (del) { var id = del.getAttribute('data-del'); list = list.filter(function (x) { return x.id !== id; }); delete ranges[id]; persist(); return; }
      var it = e.target.closest('[data-go]'); if (it) jump(it.getAttribute('data-go'));
    };

    // a finished selection inside a target shows the Comment button over it
    document.addEventListener('mouseup', function (e) {
      if (e.target === flt || (pop && pop.contains(e.target)) || panel.contains(e.target)) return;
      setTimeout(function () {
        var sel = window.getSelection(), txt = sel ? sel.toString().trim() : '';
        if (!txt || !sel.rangeCount) { flt.style.display = 'none'; pending = null; return; }
        var r = sel.getRangeAt(0), node = r.commonAncestorContainer, el = node.nodeType === 1 ? node : node.parentElement;
        var t = el && el.closest('[data-hl-id]');
        if (!t || el.closest('textarea,input,[contenteditable="true"]')) { flt.style.display = 'none'; pending = null; return; }
        var pre = document.createRange(); pre.setStart(t, 0); pre.setEnd(r.startContainer, r.startOffset);
        var before = pre.toString(), quote = r.toString(), full = t.textContent, nth = 0, from = 0, i;
        while ((i = full.indexOf(quote, from)) >= 0 && i < before.length) { nth++; from = i + 1; }
        pending = { range: r.cloneRange(), target: t.getAttribute('data-hl-id'), label: t.getAttribute('data-hl-label') || t.getAttribute('data-hl-id'), quote: quote, nth: nth };
        var rect = r.getBoundingClientRect();
        flt.style.left = (window.scrollX + rect.left + rect.width / 2) + 'px';
        flt.style.top = (window.scrollY + rect.top - 42) + 'px';
        flt.style.display = 'block';
      }, 0);
    });
    // a click on a highlight (with nothing selected) opens it for editing
    document.addEventListener('click', function (e) {
      if (pop && !pop.contains(e.target) && e.target !== flt) closePop(true);
      var sel = window.getSelection(); if (sel && sel.toString().trim()) return;
      if (!e.target.closest || !e.target.closest('[data-hl-id]') || e.target.closest('button,a,textarea,input')) return;
      for (var i = 0; i < list.length; i++) {
        var r = ranges[list[i].id]; if (!r || !isOpen(list[i])) continue;
        var rects = r.getClientRects();
        for (var k = 0; k < rects.length; k++) {
          var q = rects[k];
          if (e.clientX >= q.left && e.clientX <= q.right && e.clientY >= q.top && e.clientY <= q.bottom) { editBox(list[i].id, e.clientX, e.clientY, false); return; }
        }
      }
    });
    document.addEventListener('keydown', function (e) {
      var t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' && pending) { e.preventDefault(); addFromPending(); return; }
      if (e.key === cfg.hotkey) showPanel(!panel.classList.contains('show'));
      if (e.key === 'Escape') { showPanel(false); flt.style.display = 'none'; pending = null; }
    });
  }

  window.RoboHighlight = {
    init: function (opts) {
      cfg = Object.assign({ key: 'robo-highlights', title: 'this page', source: '', product: '', hotkey: 'h', mount: null, store: null, onChange: null }, opts || {});
      build();
      var load = cfg.store && cfg.store.load ? Promise.resolve(cfg.store.load()) : Promise.resolve((function () { try { return JSON.parse(lstore.get(cfg.key)); } catch (e) { return []; } })());
      return load.then(function (v) { list = Array.isArray(v) ? v : []; resolve(); paint(); renderPanel(); if (cfg.onChange) cfg.onChange(list.slice()); return window.RoboHighlight; });
    },
    refresh: function () { resolve(); paint(); renderPanel(); },
    list: function () { return list.slice(); },
    count: function (prefix) { return list.filter(function (c) { return isOpen(c) && (!prefix || c.target.indexOf(prefix) === 0); }).length; },
    text: exportText,
    markApplied: markApplied,
    panel: function (on) { showPanel(on !== false); }
  };
})();
