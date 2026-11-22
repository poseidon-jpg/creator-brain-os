/* RoboCart - the "add to cart for my agent" feature. One file, no dependencies, works from file:// and http.

   Use:
     <script src="agent-cart.js"></script>
     <script>RoboCart.init({ key:'my-page-cart', header:'Idea cart', from:'My page', intro:'For the agent: ...' });</script>
   Options worth knowing: mount (a selector to put the Cart button in, e.g. a header), hotkey ('c' by default, false if the
   page uses c), enrich (it => extra lines added at copy time).
   Add buttons: any element with data-cart-add and data-cart-item='{"id":"x","title":"...","lines":{"Link":"..."}}'.
     The button toggles the item in and out and gets the class "in-cart" while it is in.
   Or from code: RoboCart.add(item) / remove(id) / toggle(item) / has(id) / items() / clear() / open() / close() / text().
   An item: { id, title, lines: { Label: value, ... }, note }   (note is what you type in the drawer)

   The copy text keeps the idea-cart shape, so the existing paste-back readers still work:
     <header>: N picks, in my order.
     <intro>
     1. <title>
        From: <from>
        <Label>: <value>
        My note: <note>
   Theme: reads --bg, --card, --text, --muted, --accent, --line from the page (dark defaults if missing). */
(function () {
  'use strict';
  if (window.RoboCart) return;
  var cfg = null, items = [], memory = {}, dragId = null;
  var store = {
    get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return memory[k] == null ? null : memory[k]; } },
    set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) { memory[k] = v; } }
  };
  var CSS = '' +
    '.rcart-fab{position:fixed;right:18px;bottom:18px;z-index:9000;display:inline-flex;align-items:center;gap:8px;padding:10px 14px;border:0;border-radius:8px;' +
      'background:var(--card,#24221c);color:var(--text,#e8e2d2);font:600 14px Outfit,system-ui,sans-serif;cursor:pointer;box-shadow:5px 5px 0 var(--shadow,#000);transition:transform .15s,box-shadow .15s}' +
    '.rcart-fab:hover{transform:translate(-2px,-2px);box-shadow:7px 7px 0 var(--accent,#ff6b1a)}' +
    '.rcart-fab .rcart-n{min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:var(--accent,#ff6b1a);color:#fff;font-size:12px;line-height:20px;text-align:center}' +
    '.rcart-fab[data-n="0"] .rcart-n{background:var(--line,#3a372f);color:var(--muted,#8d8775)}' +
    '.rcart-back{position:fixed;inset:0;z-index:9001;background:rgba(0,0,0,.45);display:none}.rcart-back.show{display:block}' +
    '.rcart{position:fixed;top:0;right:0;bottom:0;z-index:9002;width:min(440px,100vw);display:flex;flex-direction:column;background:var(--bg,#131311);color:var(--text,#e8e2d2);' +
      'font:400 15px/1.45 Outfit,system-ui,sans-serif;box-shadow:-8px 0 0 var(--shadow,#000);transform:translateX(105%);transition:transform .22s ease}' +
    '.rcart.show{transform:none}' +
    '.rcart-hd{display:flex;align-items:center;gap:10px;padding:18px 18px 6px}.rcart-hd b{font-weight:600;font-size:19px;letter-spacing:-.3px}' +
    '.rcart-hd span{color:var(--muted,#8d8775);font-size:13px}.rcart-x{margin-left:auto;border:0;background:transparent;color:var(--muted,#8d8775);font-size:24px;cursor:pointer;width:34px;height:34px;border-radius:8px}' +
    '.rcart-x:hover{color:var(--text,#e8e2d2)}' +
    '.rcart-list{flex:1;overflow-y:auto;padding:6px 18px 10px}' +
    '.rcart-empty{color:var(--muted,#8d8775);padding:14px 0}' +
    '.rcart-it{background:var(--card,#24221c);border-radius:8px;padding:10px 12px 10px 10px;margin:0 0 10px;display:grid;grid-template-columns:22px 1fr 28px;gap:4px 8px;align-items:start}' +
    '.rcart-it.drag{opacity:.4}.rcart-it.over{box-shadow:0 -3px 0 var(--accent,#ff6b1a)}' +
    '.rcart-grip{cursor:grab;color:var(--muted,#8d8775);font-size:15px;line-height:1.4;user-select:none;text-align:center}' +
    '.rcart-t{font-weight:500;line-height:1.3}.rcart-t i{font-style:normal;color:var(--accent,#ff6b1a);font-weight:600;margin-right:6px}' +
    '.rcart-l{grid-column:2/4;color:var(--muted,#8d8775);font-size:12.5px;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}' +
    '.rcart-rm{border:0;background:transparent;color:var(--muted,#8d8775);font-size:18px;cursor:pointer;border-radius:6px}.rcart-rm:hover{color:var(--accent,#ff6b1a)}' +
    '.rcart-note{grid-column:2/4;width:100%;min-height:34px;resize:vertical;font:400 13px Outfit,system-ui,sans-serif;color:var(--text,#e8e2d2);background:var(--well,#1a1915);' +
      'border:2px solid transparent;border-radius:6px;padding:6px 8px;outline:none;box-shadow:3px 3px 0 rgba(255,107,26,0);transition:box-shadow .3s}' +
    '.rcart-note:focus{box-shadow:3px 3px 0 var(--accent,#ff6b1a)}' +
    '.rcart-ft{display:flex;flex-wrap:wrap;gap:8px;padding:12px 18px 18px;border-top:1px solid var(--line,#3a372f)}' +
    '.rcart-btn{font:600 14px Outfit,system-ui,sans-serif;padding:9px 14px;border-radius:8px;border:0;cursor:pointer;background:var(--card,#24221c);color:var(--text,#e8e2d2);transition:transform .15s,box-shadow .15s}' +
    '.rcart-btn:hover{transform:translate(-2px,-2px);box-shadow:5px 5px 0 var(--shadow,#000)}.rcart-btn:active{transform:translate(1px,1px);box-shadow:none}' +
    '.rcart-btn.go{background:var(--accent,#ff6b1a);color:#fff}' +
    '.rcart-toast{position:fixed;left:50%;bottom:24px;z-index:9003;transform:translateX(-50%);background:var(--accent,#ff6b1a);color:#fff;font:600 14px Outfit,system-ui,sans-serif;padding:9px 16px;border-radius:8px;opacity:0;transition:opacity .2s;pointer-events:none}' +
    '.rcart-toast.show{opacity:1}' +
    'body:has(.rcart.show) .rap-dock{visibility:hidden}' +   /* the Apply all comments corner sits over the drawer footer, so it steps aside while the drawer is open */
    ':where([data-cart-add]){cursor:pointer}:where([data-cart-add].in-cart){color:var(--accent,#ff6b1a)}';   /* zero specificity: the page's own button style wins */

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function load() { try { var v = JSON.parse(store.get(cfg.key)); items = Array.isArray(v) ? v.filter(function (i) { return i && i.id && i.title; }) : []; } catch (e) { items = []; } }
  function save() { store.set(cfg.key, JSON.stringify(items)); paint(); if (cfg.onChange) cfg.onChange(items.slice()); }
  function find(id) { for (var i = 0; i < items.length; i++) if (items[i].id === id) return i; return -1; }
  function parseItem(el) { try { return JSON.parse(el.getAttribute('data-cart-item')); } catch (e) { return null; } }

  var fab, back, panel, list, toastEl, toastT;
  function build() {
    var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    if (cfg.button !== false) {
      fab = document.createElement('button'); fab.className = 'rcart-fab'; fab.type = 'button';
      fab.innerHTML = esc(cfg.name) + ' <span class="rcart-n">0</span>';
      fab.title = cfg.name + (cfg.hotkey ? ' (key ' + cfg.hotkey + ')' : '');
      fab.onclick = function () { open(); };
      (cfg.mount ? document.querySelector(cfg.mount) : document.body).appendChild(fab);
      if (cfg.mount) fab.style.position = 'static';
    }
    back = document.createElement('div'); back.className = 'rcart-back'; back.onclick = close; document.body.appendChild(back);
    panel = document.createElement('aside'); panel.className = 'rcart'; panel.setAttribute('aria-label', cfg.name);
    panel.innerHTML = '<div class="rcart-hd"><b>' + esc(cfg.name) + '</b><span class="rcart-c"></span><button class="rcart-x" aria-label="Close">×</button></div>' +
      '<div class="rcart-list"></div>' +
      '<div class="rcart-ft"><button class="rcart-btn go" data-a="copy">Copy for my agent</button><button class="rcart-btn" data-a="md">Download .md</button><button class="rcart-btn" data-a="clear">Clear</button></div>';
    document.body.appendChild(panel);
    list = panel.querySelector('.rcart-list');
    panel.querySelector('.rcart-x').onclick = close;
    panel.querySelector('.rcart-ft').onclick = function (e) {
      var a = e.target.getAttribute('data-a');
      if (a === 'copy') copy();
      if (a === 'md') download();
      if (a === 'clear' && items.length && confirm('Empty the ' + cfg.name.toLowerCase() + '?')) { items = []; save(); renderList(); }
    };
    list.addEventListener('input', function (e) {
      if (!e.target.classList.contains('rcart-note')) return;
      var i = find(e.target.getAttribute('data-id')); if (i < 0) return;
      items[i].note = e.target.value; store.set(cfg.key, JSON.stringify(items));
    });
    list.addEventListener('click', function (e) {
      var rm = e.target.closest('.rcart-rm'); if (!rm) return;
      remove(rm.getAttribute('data-id')); renderList();
    });
    // drag to reorder: the item follows the pointer's slot and the new order saves on drop
    list.addEventListener('dragstart', function (e) { var it = e.target.closest('.rcart-it'); if (!it) return; dragId = it.getAttribute('data-id'); it.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; });
    list.addEventListener('dragover', function (e) {
      var it = e.target.closest('.rcart-it'); if (!it || !dragId) return; e.preventDefault();
      list.querySelectorAll('.over').forEach(function (n) { n.classList.remove('over'); }); it.classList.add('over');
    });
    list.addEventListener('drop', function (e) {
      var it = e.target.closest('.rcart-it'); if (!it || !dragId) return; e.preventDefault();
      var from = find(dragId), to = find(it.getAttribute('data-id')); if (from < 0 || to < 0) return;
      var moved = items.splice(from, 1)[0]; items.splice(to, 0, moved); save(); renderList();
    });
    list.addEventListener('dragend', function () { dragId = null; renderList(); });
    toastEl = document.createElement('div'); toastEl.className = 'rcart-toast'; document.body.appendChild(toastEl);

    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cart-add]'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      var it = parseItem(b); if (it) toggle(it);
    }, true);
    document.addEventListener('keydown', function (e) {
      var t = e.target, typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (cfg.hotkey && e.key === cfg.hotkey) { panel.classList.contains('show') ? close() : open(); }
      if (e.key === 'Escape' && panel.classList.contains('show')) close();
    });
    window.addEventListener('storage', function (e) { if (e.key === cfg.key) { load(); paint(); renderList(); } });
  }

  function renderList() {
    if (!list) return;
    panel.querySelector('.rcart-c').textContent = items.length + (items.length === 1 ? ' pick' : ' picks');
    if (!items.length) { list.innerHTML = '<div class="rcart-empty">' + esc(cfg.empty) + '</div>'; return; }
    list.innerHTML = items.map(function (it, i) {
      var lines = Object.keys(it.lines || {}).filter(function (k) { return it.lines[k]; }).map(function (k) { return k + ': ' + it.lines[k]; }).join('\n');
      return '<div class="rcart-it" draggable="true" data-id="' + esc(it.id) + '"><span class="rcart-grip" title="Drag to reorder">≡</span>' +
        '<div class="rcart-t"><i>' + (i + 1) + '</i>' + esc(it.title) + '</div>' +
        '<button class="rcart-rm" data-id="' + esc(it.id) + '" aria-label="Remove">×</button>' +
        (lines ? '<div class="rcart-l">' + esc(lines) + '</div>' : '') +
        '<textarea class="rcart-note" data-id="' + esc(it.id) + '" placeholder="Your note for the agent">' + esc(it.note || '') + '</textarea></div>';
    }).join('');
  }
  function paint() {
    if (fab) { fab.setAttribute('data-n', items.length); fab.querySelector('.rcart-n').textContent = items.length; }
    document.querySelectorAll('[data-cart-add]').forEach(function (b) {
      var it = parseItem(b), inn = !!(it && find(it.id) >= 0);
      b.classList.toggle('in-cart', inn);
      var on = b.getAttribute('data-cart-label-on'), off = b.getAttribute('data-cart-label-off');
      if (on && off) b.textContent = inn ? on : off;
      b.setAttribute('aria-pressed', inn ? 'true' : 'false');
    });
  }
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 1600); }

  function text() {
    var n = items.length;
    var out = [cfg.header + ': ' + n + (n === 1 ? ' pick' : ' picks') + ', in my order.'];
    if (cfg.intro) out.push(cfg.intro);
    items.forEach(function (it, i) {
      var b = [(i + 1) + '. ' + it.title];
      if (cfg.from && !(it.lines && it.lines.From)) b.push('   From: ' + cfg.from);
      var lines = Object.assign({}, it.lines || {}, cfg.enrich ? (cfg.enrich(it) || {}) : {});   // enrich adds live lines at copy time (current comments, say)
      Object.keys(lines).forEach(function (k) { if (lines[k]) b.push('   ' + k + ': ' + String(lines[k]).replace(/\n/g, '\n      ')); });
      if (it.note) b.push('   My note: ' + it.note.replace(/\n/g, ' '));
      out.push(b.join('\n'));
    });
    return out.join('\n\n') + '\n';
  }
  function copy() {
    if (!items.length) { toast('The cart is empty'); return; }
    var t = text(), done = function () { toast('Copied ' + items.length + (items.length === 1 ? ' pick' : ' picks') + ' for your agent'); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).then(done, function () { fallback(t); done(); });
    else { fallback(t); done(); }
  }
  function fallback(t) { var ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }
  function download() {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text()], { type: 'text/markdown' }));
    a.download = cfg.key + '.md'; document.body.appendChild(a); a.click(); a.remove();
  }

  function add(it) { if (!it || !it.id || find(it.id) >= 0) return; items.push({ id: it.id, title: it.title, lines: it.lines || {}, note: it.note || '' }); save(); renderList(); toast('Added to ' + cfg.name.toLowerCase()); }
  function remove(id) { var i = find(id); if (i < 0) return; items.splice(i, 1); save(); }
  function toggle(it) { if (find(it.id) >= 0) { remove(it.id); renderList(); toast('Removed'); } else add(it); }
  function open() { renderList(); panel.classList.add('show'); back.classList.add('show'); }
  function close() { panel.classList.remove('show'); back.classList.remove('show'); }

  window.RoboCart = {
    init: function (opts) {
      cfg = Object.assign({ key: 'robo-cart-v1', name: 'Cart', header: 'Cart', intro: 'For the agent: work through these picks in my order, using my notes.', from: '', empty: 'Nothing in the cart yet. Use the add buttons on the page.', button: true, mount: null, onChange: null, enrich: null, hotkey: 'c' }, opts || {});   // hotkey: false when the page already uses c
      load(); build(); paint(); renderList();
      return window.RoboCart;
    },
    add: add, remove: function (id) { remove(id); renderList(); }, toggle: toggle,
    has: function (id) { return find(id) >= 0; }, items: function () { return items.slice(); },
    clear: function () { items = []; save(); renderList(); }, open: open, close: close, text: text, copy: copy, refresh: paint
  };
})();
