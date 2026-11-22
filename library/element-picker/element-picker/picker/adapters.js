/* Element Picker: adapters.
   This file knows how to read a page. picker.js (the screen) never touches the page directly.

   1. EP.loadPage     loads the page in a same-origin frame and catches GSAP and CSS animations as early as it can
   2. EP.makeClock    a small hold on the page's requestAnimationFrame, so a paused page stays paused
   3. EP.detectTime   how the picker moves time: renderAt(t), the GSAP timeline, CSS / Web Animations, or live only
   4. EP.makeDom      DOM mode: finds elements with the browser's own hit testing, outlines them, solos them
   5. EP.makeApi      Element API mode: a canvas page that describes its own elements through window.SM
   6. EP.makeRegion   Region mode: you drag a rectangle, the picker crops it from the page's canvases

   Nothing here edits a page file. The only things added to the page are run-time marks (two style tags and one
   attribute) and they are removed when you leave solo. */
(function () {
  'use strict';
  const EP = (window.EP = window.EP || {});
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ri = (v) => Math.round(v);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isThen = (v) => !!v && typeof v.then === 'function';
  const fmt2 = (v) => (+v).toFixed(2);
  EP.util = { clamp, ri, r3, sleep, isThen, fmt2, SVG_NS };

  // =====================================================================================================
  // 1. load the page
  // =====================================================================================================
  // GSAP removes a tween from the global timeline as soon as it finishes, and a finished CSS animation can drop out of
  // document.getAnimations(). Both would then be impossible to scrub back. So while the page loads we poll every few
  // milliseconds, tell GSAP to keep finished tweens, and remember every animation we see.
  EP.loadPage = async function (iframe, url, relPath) {
    // ask the server whether the file exists, so a typo gives a clear message instead of a blank frame
    try {
      const r = await fetch('/__picker/api/exists?path=' + encodeURIComponent(relPath || ''), { cache: 'no-store' });
      const d = await r.json();
      if (!d.ok) { const err = new Error('The page was not found in the video folder'); err.code = 404; throw err; }
    } catch (e) {
      if (e && e.code === 404) throw e;
      /* no server to ask (the picker was opened from a file): the load below reports it */
    }
    return new Promise((resolve, reject) => {
      const early = { anims: new Set(), gsap: false };
      const expected = new URL(url, location.href).pathname;
      const t0 = performance.now();
      let timer = 0;
      const peek = () => {
        let w, d;
        try { w = iframe.contentWindow; d = w && w.document; } catch (e) { clearInterval(timer); return reject(e); }
        if (!w || !d || w.location.pathname !== expected) return;
        try {
          if (!early.gsap && w.gsap && w.gsap.globalTimeline) { early.gsap = true; w.gsap.globalTimeline.autoRemoveChildren = false; }
          if (d.readyState !== 'loading' && d.getAnimations) for (const a of d.getAnimations()) early.anims.add(a);
        } catch (e) { /* the page is still starting up */ }
        if (d.readyState === 'complete') { clearInterval(timer); resolve({ win: w, doc: d, early }); }
        else if (performance.now() - t0 > 30000) { clearInterval(timer); reject(new Error('The page took too long to load')); }
      };
      timer = setInterval(peek, 6);
      iframe.src = url;
    });
  };

  // wait for the page's own "ready" promise (fonts, images) and for an element API that starts later
  EP.settle = async function (page) {
    const w = page.win;
    try { if (isThen(w.ready)) await Promise.race([w.ready, sleep(15000)]); } catch (e) { /* the page's own error shows in its console */ }
    if (w.SM && w.SM.ready === false) for (let i = 0; i < 100 && !w.SM.ready; i++) await sleep(50);
    await sleep(120);
  };

  // =====================================================================================================
  // 2. a hold on the page's animation frames
  // =====================================================================================================
  // After this runs the page's requestAnimationFrame goes through us. hold() stops the page's own loop where it is,
  // release() lets it run again (the page's clock is shifted by the time it was held, so it does not jump).
  EP.makeClock = function (w) {
    const realRaf = w.requestAnimationFrame.bind(w);
    const realCaf = w.cancelAnimationFrame.bind(w);
    const perf = w.performance;
    const realNow = perf.now.bind(perf);
    const realDate = w.Date.now.bind(w.Date);
    const q = new Map();
    let id = 1; let held = false; let pump = 0; let skew = 0; let heldAt = 0; let heldAtDate = 0;
    const hooks = [];
    const rethrow = (e) => { w.setTimeout(() => { throw e; }, 0); };
    function runQueue(ts) {
      const cbs = [...q.values()];
      q.clear();
      for (const cb of cbs) { try { cb(ts - skew); } catch (e) { rethrow(e); } }
      for (const h of hooks) { try { h(); } catch (e) { /* ignore */ } }
    }
    function pumpFrame(ts) { pump = 0; runQueue(ts); if (q.size && !held) schedule(); }
    function schedule() { if (!held && !pump) pump = realRaf(pumpFrame); }
    w.requestAnimationFrame = (cb) => { const n = id++; q.set(n, cb); schedule(); return n; };
    w.cancelAnimationFrame = (n) => { q.delete(n); };
    const api = {
      held: () => held,
      hold() { if (held) return; held = true; heldAt = realNow(); heldAtDate = realDate(); if (pump) { realCaf(pump); pump = 0; } },
      release() { if (!held) return; skew += realNow() - heldAt; held = false; if (q.size) schedule(); },
      // run the queued frame callbacks once, right now, even while held (used to re-draw a live page before reading it)
      stepNow() { runQueue(held ? heldAt : realNow()); },
      onFrame(fn) { hooks.push(fn); },
      // let the page see a clock that stops while it is held
      shiftTime() {
        try { perf.now = () => (held ? heldAt : realNow()) - skew; } catch (e) { /* read only */ }
        try { w.Date.now = () => (held ? heldAtDate : realDate()) - skew; } catch (e) { /* read only */ }
      },
    };
    return api;
  };

  // =====================================================================================================
  // 3. time control, tried in this order
  // =====================================================================================================
  EP.detectTime = async function (page, opts) {
    opts = opts || {};
    const { win: w, doc: d, early, clock } = page;
    const fps = isFinite(+w.FPS) && +w.FPS >= 1 && +w.FPS <= 240 ? +w.FPS : 30;
    const fallbackDur = opts.dur && opts.dur > 0 ? opts.dur : 10;
    const pauseAnims = () => { try { for (const a of d.getAnimations()) a.pause(); } catch (e) { /* ignore */ } };
    const playAnims = () => { try { for (const a of d.getAnimations()) a.play(); } catch (e) { /* ignore */ } };

    // 1. the page's own renderAt(t) and DURATION (the contract the sample videos use). A page with an element API may give
    //    window.SM.render(t) instead of window.renderAt(t).
    const drawFn = typeof w.renderAt === 'function' ? (t) => w.renderAt(t) : w.SM && typeof w.SM.render === 'function' ? (t) => w.SM.render(t) : null;
    if (drawFn) {
      const name = typeof w.renderAt === 'function' ? 'window.renderAt(t)' : 'window.SM.render(t)';
      const dur = +w.DURATION;
      const known = isFinite(dur) && dur > 0;
      const D = known ? dur : fallbackDur;
      return {
        kind: 'renderAt', label: 'renderAt(t)', fps, duration: D, canSeek: true,
        why: known
          ? 'The page has ' + name + ' and window.DURATION (' + fmt2(D) + ' s). The picker asks the page to draw each frame, so scrubbing is exact.'
          : 'The page has ' + name + ' but no window.DURATION, so the picker assumes ' + D + ' s. Add ?dur=SECONDS to the address to change it.',
        seek: drawFn,
        stop() { clock.hold(); },
      };
    }

    // 2. the GSAP global timeline
    const g = w.gsap;
    if (g && g.globalTimeline && typeof g.globalTimeline.getChildren === 'function') {
      const kids = g.globalTimeline.getChildren(false, true, true);
      if (kids.length) {
        let D = 0;
        for (const c of kids) { const e = c.startTime() + c.duration(); if (isFinite(e) && e > D) D = e; }
        if (!(D > 0) || D > 3600) D = fallbackDur;
        D = r3(D);
        const seek = (t) => {
          for (const c of g.globalTimeline.getChildren(false, true, true)) {
            try { c.pause(); c.totalTime((t - c.startTime()) * (c.timeScale() || 1), false); } catch (e) { /* skip one tween */ }
          }
        };
        return {
          kind: 'gsap', label: 'GSAP timeline', fps, duration: D, canSeek: true,
          why: 'The page uses GSAP (version ' + (g.version || '?') + '). The picker pauses the global timeline and seeks it, over its first ' + fmt2(D) + ' s.',
          seek,
          stop() { try { g.globalTimeline.pause(); } catch (e) { /* ignore */ } seek(0); clock.hold(); },
        };
      }
    }

    // 3. every CSS animation, CSS transition and Web Animation on the page
    const seen = new Set(early && early.anims ? early.anims : []);
    const list = () => {
      try { for (const a of d.getAnimations()) seen.add(a); } catch (e) { /* ignore */ }
      return [...seen].filter((a) => a.effect && a.playState !== 'idle');
    };
    let D = 0;
    for (const a of list()) {
      try {
        const ct = a.effect.getComputedTiming();
        const end = Number.isFinite(ct.endTime) ? ct.endTime : (+ct.delay || 0) + (+ct.duration || 0);
        if (end > D && end < 3600000) D = end;
      } catch (e) { /* ignore */ }
    }
    if (D > 0) {
      const dur = r3(D / 1000);
      const seek = (t) => { for (const a of list()) { try { a.pause(); a.currentTime = t * 1000; } catch (e) { /* ignore */ } } };
      return {
        kind: 'waapi', label: 'CSS animations', fps, duration: dur, canSeek: true,
        why: 'The page runs CSS or Web Animations (' + list().length + ' of them). The picker pauses them all and sets their time, over ' + fmt2(dur) + ' s. Animations driven by timers or by your own script are not covered.',
        seek,
        stop() { clock.hold(); },
      };
    }

    // 4. nothing to control
    clock.shiftTime();
    return {
      kind: 'live', label: 'Live only', fps, duration: null, canSeek: false,
      why: 'The page has no renderAt(t), no GSAP timeline and no CSS animation the picker can control, so it plays on its own clock. Scrubbing is off. Pause holds the picture where it can.',
      hold() { clock.hold(); pauseAnims(); },
      release() { clock.release(); playAnims(); },
      stop() { /* a live page keeps running until you press pause */ },
    };
  };

  // =====================================================================================================
  // shared helpers for reading a page's DOM
  // =====================================================================================================
  const SKIP = new Set(['script', 'style', 'link', 'meta', 'noscript', 'template', 'title', 'head', 'base', 'br', 'wbr', 'defs', 'clippath', 'mask', 'filter',
    'lineargradient', 'radialgradient', 'pattern', 'symbol', 'marker', 'stop', 'metadata', 'desc', 'fegaussianblur', 'feoffset', 'feblend', 'fecolormatrix',
    'femerge', 'femergenode', 'feflood', 'fecomposite', 'feturbulence', 'fedisplacementmap', 'animate', 'animatetransform', 'set', 'source', 'track']);
  const PAINT_TAGS = new Set(['img', 'video', 'canvas', 'picture', 'input', 'textarea', 'select', 'button', 'iframe', 'object', 'embed']);
  const SVG_SHAPES = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'text', 'tspan', 'textpath', 'image', 'use']);
  const isClear = (c) => !c || c === 'transparent' || /^rgba\([^)]*,\s*0\)$/.test(c) || /\/\s*0(\.0+)?\)$/.test(c);
  const hasOwnText = (el) => { for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim()) return true; return false; };
  const cleanClass = (c) => !c.startsWith('__pk') && c.length < 48;

  // =====================================================================================================
  // 4. DOM mode
  // =====================================================================================================
  EP.makeDom = function (ctx) {
    const w = ctx.win;
    const doc = ctx.doc;
    const cs = (el, pseudo) => w.getComputedStyle(el, pseudo || null);
    const size = () => ctx.size();
    let allStyle = null; // makes pointer-events: none elements hit-testable, only while we ask
    let soloStyle = null;
    let soloEl = null;

    function ensureStyles() {
      if (allStyle && allStyle.isConnected) return;
      allStyle = doc.createElement('style');
      allStyle.id = '__pk_hit_style';
      allStyle.media = 'not all';
      allStyle.textContent = '*{pointer-events:auto!important}';
      (doc.head || doc.documentElement).appendChild(allStyle);
    }

    const ignored = (el) => {
      if (!el || el.nodeType !== 1) return true;
      if (el === doc.documentElement || el === doc.body) return true;
      const tag = el.localName.toLowerCase();
      if (SKIP.has(tag)) return true;
      return el.id === '__pk_hit_style' || el.id === '__pk_solo_style';
    };
    const rectOf = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    };
    function effOpacity(el) {
      let o = 1;
      for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        const v = parseFloat(cs(n).opacity);
        if (!isNaN(v)) o *= v;
        if (o < 0.02) return o;
      }
      return o;
    }

    // does this element draw anything itself (fill, picture, text, border, shadow, a ::before / ::after)?
    function paints(el, s) {
      s = s || cs(el);
      const tag = el.localName.toLowerCase();
      if (el.namespaceURI === SVG_NS) {
        if (tag === 'svg' || tag === 'g' || tag === 'a' || tag === 'switch') return false;
        if (tag === 'foreignobject') return false;
        if (SVG_SHAPES.has(tag)) return s.fill !== 'none' || (s.stroke !== 'none' && parseFloat(s.strokeWidth) > 0);
        return false;
      }
      if (PAINT_TAGS.has(tag)) return true;
      if (!isClear(s.backgroundColor) || s.backgroundImage !== 'none') return true;
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        if (parseFloat(s['border' + side + 'Width']) > 0 && s['border' + side + 'Style'] !== 'none' && !isClear(s['border' + side + 'Color'])) return true;
      }
      if (s.boxShadow !== 'none') return true;
      if (hasOwnText(el) && !isClear(s.color) && parseFloat(s.fontSize) > 0) return true;
      for (const p of ['::before', '::after']) {
        const pc = cs(el, p);
        if (pc.content && pc.content !== 'none' && pc.content !== 'normal' && pc.display !== 'none') return true;
      }
      return false;
    }

    // the part of the element's box that is really visible: cut to the frame and to every ancestor that clips it
    const clipsOverflow = (s) => /(hidden|clip|scroll|auto)/.test(s.overflowX) || /(hidden|clip|scroll|auto)/.test(s.overflowY);
    const makesBlock = (s, forFixed) => s.transform !== 'none' || s.filter !== 'none' || s.perspective !== 'none' ||
      /(transform|filter|perspective)/.test(s.willChange) || /(paint|layout|strict|content)/.test(s.contain) || (!forFixed && s.position !== 'static');
    function visibleRect(el) {
      const r = rectOf(el);
      let x0 = r.x; let y0 = r.y; let x1 = r.x + r.w; let y1 = r.y + r.h;
      const sz = size();
      x0 = Math.max(x0, 0); y0 = Math.max(y0, 0); x1 = Math.min(x1, sz.w); y1 = Math.min(y1, sz.h);
      let pos = cs(el).position;
      for (let a = el.parentElement; a && a !== doc.documentElement && a !== doc.body; a = a.parentElement) {
        const s = cs(a);
        if (pos === 'absolute' && !makesBlock(s, false)) continue; // an ancestor that is not its containing block does not clip it
        if (pos === 'fixed' && !makesBlock(s, true)) continue;
        if (clipsOverflow(s)) {
          const ar = a.getBoundingClientRect();
          x0 = Math.max(x0, ar.left); y0 = Math.max(y0, ar.top); x1 = Math.min(x1, ar.right); y1 = Math.min(y1, ar.bottom);
          if (x1 <= x0 || y1 <= y0) return null;
        }
        pos = s.position;
      }
      if (x1 - x0 < 0.5 || y1 - y0 < 0.5) return null;
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    function isShown(el) {
      if (!el || !el.isConnected) return false;
      const s = cs(el);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
      if (effOpacity(el) < 0.02) return false;
      return !!visibleRect(el);
    }

    // ---------- names ----------
    const shortText = (el, n) => {
      // innerText keeps a gap between a title and the line under it; SVG elements only have textContent
      let t = (typeof el.innerText === 'string' && el.innerText ? el.innerText : el.textContent || '').replace(/\s+/g, ' ').trim();
      if (el.localName === 'img') t = el.getAttribute('alt') || (el.getAttribute('src') || '').split('/').pop().split('?')[0];
      return t.length > n ? t.slice(0, n - 1) + '…' : t;
    };
    function nameParts(el) {
      const tag = el.localName;
      const id = el.getAttribute('id');
      const cls = [...el.classList].filter(cleanClass);
      const base = id ? tag + '#' + id : cls.length ? tag + '.' + cls[0] : tag;
      return { tag, id, cls, base };
    }
    const childEls = (el) => [...el.children].filter((c) => !ignored(c));
    function kindOf(el, s) {
      const tag = el.localName.toLowerCase();
      const r = rectOf(el);
      const sz = size();
      const share = (r.w * r.h) / (sz.w * sz.h);
      if (['img', 'picture', 'video', 'canvas'].includes(tag) || (el.namespaceURI === SVG_NS && tag === 'image')) return 'Image';
      if (el.namespaceURI === SVG_NS && ['text', 'tspan', 'textpath'].includes(tag)) return 'Text';
      if (el.namespaceURI === SVG_NS && tag === 'svg') return share > 0.6 ? 'Background' : 'Shape';
      if (el.namespaceURI === SVG_NS && SVG_SHAPES.has(tag)) return 'Shape';
      if (hasOwnText(el) && !childEls(el).length) return 'Text';
      if (share >= 0.6 && paints(el, s)) return 'Background';
      if (childEls(el).length >= 2) return 'Layout';
      return 'Shape';
    }

    // ---------- selectors and snippets ----------
    function selectorOf(el) {
      const esc = (s) => (w.CSS && w.CSS.escape ? w.CSS.escape(s) : String(s).replace(/[^\w-]/g, '\\$&'));
      const unique = (sel) => { try { const n = doc.querySelectorAll(sel); return n.length === 1 && n[0] === el; } catch (e) { return false; } };
      if (el.id && unique('#' + esc(el.id))) return '#' + esc(el.id);
      const parts = [];
      for (let cur = el; cur && cur.nodeType === 1 && cur !== doc.documentElement; cur = cur.parentElement) {
        let part;
        if (cur.id && doc.querySelectorAll('#' + esc(cur.id)).length === 1) {
          parts.unshift('#' + esc(cur.id));
          const sel = parts.join(' > ');
          if (unique(sel)) return sel;
          break;
        }
        part = cur.localName;
        const cls = [...cur.classList].filter(cleanClass).slice(0, 2);
        if (cls.length) part += cls.map((c) => '.' + esc(c)).join('');
        const par = cur.parentElement;
        if (par) {
          const same = [...par.children].filter((c) => { try { return c.matches(part); } catch (e) { return false; } });
          if (same.length > 1) part += ':nth-child(' + ([...par.children].indexOf(cur) + 1) + ')';
        }
        parts.unshift(part);
        const sel = parts.join(' > ');
        if (unique(sel)) return sel;
      }
      // last resort: a full path of positions, which is always exact
      const path = [];
      for (let cur = el; cur && cur !== doc.documentElement; cur = cur.parentElement) {
        const par = cur.parentElement;
        path.unshift(cur.localName + (par ? ':nth-child(' + ([...par.children].indexOf(cur) + 1) + ')' : ''));
      }
      return path.join(' > ');
    }
    function snippetOf(el, maxChars, maxDepth) {
      maxChars = maxChars || 1500;
      maxDepth = maxDepth == null ? 3 : maxDepth;
      let used = 0;
      const lines = [];
      const attrs = (e) => {
        let s = '';
        for (const a of e.attributes) {
          if (a.name.startsWith('data-pk')) continue;
          let v = a.value;
          if (a.name === 'class') { v = v.split(/\s+/).filter((c) => c && cleanClass(c)).join(' '); if (!v) continue; }
          if (v.length > 140) v = v.slice(0, 137) + '...';
          s += ' ' + a.name + '="' + v.replace(/"/g, '&quot;') + '"';
        }
        return s;
      };
      const push = (line) => { used += line.length + 1; lines.push(line); };
      const walk = (e, depth) => {
        const pad = '  '.repeat(depth);
        const tag = e.localName;
        const kids = [...e.childNodes].filter((n) => (n.nodeType === 1 && !ignored(n)) || (n.nodeType === 3 && n.nodeValue.trim()));
        if (!kids.length) { push(pad + '<' + tag + attrs(e) + (e.namespaceURI === SVG_NS ? '/>' : '></' + tag + '>')); return; }
        if (kids.length === 1 && kids[0].nodeType === 3) {
          let t = kids[0].nodeValue.replace(/\s+/g, ' ').trim();
          if (t.length > 90) t = t.slice(0, 87) + '...';
          push(pad + '<' + tag + attrs(e) + '>' + t.replace(/</g, '&lt;') + '</' + tag + '>');
          return;
        }
        push(pad + '<' + tag + attrs(e) + '>');
        if (depth >= maxDepth) push(pad + '  <!-- ' + kids.length + ' more inside -->');
        else {
          let shown = 0;
          for (const k of kids) {
            if (used > maxChars || shown >= 12) { push(pad + '  <!-- ' + (kids.length - shown) + ' more -->'); break; }
            shown++;
            if (k.nodeType === 3) { let t = k.nodeValue.replace(/\s+/g, ' ').trim(); if (t.length > 90) t = t.slice(0, 87) + '...'; push(pad + '  ' + t.replace(/</g, '&lt;')); } else walk(k, depth + 1);
          }
        }
        push(pad + '</' + tag + '>');
      };
      walk(el, 0);
      return lines.join('\n');
    }
    function cssSummary(el) {
      const s = cs(el);
      const out = {};
      for (const k of ['color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight', 'opacity', 'transform', 'zIndex', 'position']) {
        const v = s[k];
        if (v && v !== 'none' && v !== 'normal' && v !== 'auto' && !(k === 'backgroundColor' && isClear(v)) && !(k === 'opacity' && v === '1') && !(k === 'position' && v === 'static')) out[k] = v;
      }
      return out;
    }

    // ---------- hit testing ----------
    // While hit() runs, the page's pointer-events rules are switched off (the style tag is on), so elementsFromPoint lists every
    // element under a point, in paint order, including click-through overlays. The style is on once per hit(), not once per query,
    // because each switch makes the browser restyle the whole page.
    const filtered = (list) => list.filter((el) => !ignored(el));
    function allAt(x, y) {
      try { return filtered(doc.elementsFromPoint(x, y)); } catch (e) { return []; }
    }
    function naturalAt(x, y) { // what the page itself would let a click reach
      allStyle.media = 'not all';
      try { return filtered(doc.elementsFromPoint(x, y)); } catch (e) { return []; } finally { allStyle.media = 'all'; }
    }
    function pickable(el) {
      const s = cs(el);
      if (s.visibility !== 'visible' || s.display === 'none') return false;
      if (!paints(el, s)) return false;
      if (effOpacity(el) < 0.02) return false;
      return !!visibleRect(el);
    }
    function hitOnce(x, y) {
      const sz = size();
      let natural = null;
      let overlay = null;
      for (const el of allAt(x, y)) {
        if (!pickable(el)) continue;
        const r = rectOf(el);
        // a big element that only shows up when pointer-events is forced on is an overlay the page made click-through (grain, vignette)
        if (r.w * r.h >= 0.6 * sz.w * sz.h) {
          natural = natural || new Set(naturalAt(x, y));
          if (!natural.has(el)) { if (!overlay) overlay = el; continue; }
        }
        return el;
      }
      return overlay;
    }
    function hit(x, y, tol) {
      ensureStyles();
      allStyle.media = 'all';
      try {
        let best = hitOnce(x, y);
        const sz = size();
        const big = (el) => { const r = rectOf(el); return r.w * r.h > 0.2 * sz.w * sz.h; };
        // thin lines are hard to hit: when we landed on something big, look a few pixels around for a small painted element
        if (tol && (!best || big(best))) {
          search:
          for (const r of [0.4, 0.8, 1.2]) {
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7]]) {
              const c = hitOnce(x + dx * tol * r, y + dy * tol * r);
              if (c && !big(c)) { best = c; break search; }
            }
          }
        }
        return best;
      } finally { allStyle.media = 'not all'; }
    }

    // ---------- outlines ----------
    const rectPath = (r) => 'M' + r.x.toFixed(1) + ' ' + r.y.toFixed(1) + 'h' + r.w.toFixed(1) + 'v' + r.h.toFixed(1) + 'h' + (-r.w).toFixed(1) + 'Z';
    function outlineOf(el) {
      const r = rectOf(el);
      const v = visibleRect(el) || r;
      let fill = rectPath(v);
      let clip = '';
      // an SVG shape that is rotated or skewed gets its true four-corner outline
      if (el.namespaceURI === SVG_NS && el.getBBox && el.getScreenCTM && el.localName.toLowerCase() !== 'svg') {
        try {
          const bb = el.getBBox();
          const m = el.getScreenCTM();
          if (bb && m && (bb.width || bb.height)) {
            const pts = [[bb.x, bb.y], [bb.x + bb.width, bb.y], [bb.x + bb.width, bb.y + bb.height], [bb.x, bb.y + bb.height]]
              .map((p) => [m.a * p[0] + m.c * p[1] + m.e, m.b * p[0] + m.d * p[1] + m.f]);
            if (Math.abs(m.b) > 1e-4 || Math.abs(m.c) > 1e-4) { fill = 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z'; return { fill, line: '', clip }; }
          }
        } catch (e) { /* fall back to the box */ }
      }
      if (v.x !== r.x || v.y !== r.y || v.w !== r.w || v.h !== r.h) clip = rectPath(r); // the clipped-away part, dotted
      return { fill, line: '', clip };
    }

    // ---------- the adapter ----------
    const adapter = {
      id: 'dom',
      hasSolo: true,
      hasBlur: false,
      layers: () => [],
      setup() { ensureStyles(); },
      // how many things this page has that the DOM mode can pick
      stats() {
        const all = doc.body ? doc.body.querySelectorAll('*') : [];
        let content = 0; let canvases = 0; let canvasArea = 0; let textish = 0;
        const lim = Math.min(all.length, 4000);
        for (let i = 0; i < lim; i++) {
          const el = all[i];
          if (ignored(el)) continue;
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          if (el.localName.toLowerCase() === 'canvas') { canvases++; canvasArea += r.width * r.height; continue; }
          if (paints(el)) { content++; if (hasOwnText(el)) textish++; }
        }
        return { content, canvases, canvasArea, textish, total: all.length };
      },
      pick: (x, y, tol) => hit(x, y, tol),
      alive: (el) => !!el && el.isConnected,
      same: (a, b) => a === b,
      chain(el) {
        const out = [];
        for (let n = el; n && n !== doc.documentElement && n !== doc.body; n = n.parentElement) if (!ignored(n)) out.unshift(n);
        return out;
      },
      crumbName(el) {
        const p = nameParts(el);
        return p.base;
      },
      info(el, _t, opts) {
        if (!el || !el.isConnected) return null;
        const s = cs(el);
        const parts = nameParts(el);
        const text = shortText(el, 26);
        const kids = childEls(el);
        const group = kids.length >= 2 || (!paints(el, s) && kids.length >= 1);
        const members = group ? el.querySelectorAll('*').length : 0;
        const shown = isShown(el);
        const o = {
          ref: el,
          name: parts.base + (text ? ' "' + text + '"' : ''),
          cat: kindOf(el, s),
          group,
          members,
          what: 'A ' + parts.tag + ' element' + (parts.cls.length ? ' with class ' + parts.cls.slice(0, 3).join(', ') : '') + (group ? ', ' + members + ' elements inside' : '') + '.',
          bounds: (() => { const r = rectOf(el); return { x: ri(r.x), y: ri(r.y), w: ri(r.w), h: ri(r.h) }; })(),
          shown,
          outline: outlineOf(el),
        };
        if (opts && opts.full) { o.selector = selectorOf(el); o.key = o.selector; o.tag = parts.tag; o.text = shortText(el, 80); o.classes = parts.cls; }
        return o;
      },
      visibleAt: (el) => isShown(el),
      outline: outlineOf,
      selectorOf,
      snippetOf,
      cssSummary,
      locate(rec) {
        if (!rec || !rec.selector) return null;
        try { return doc.querySelector(rec.selector); } catch (e) { return null; }
      },
      // the pieces a pick record needs that only this adapter knows
      record(el) {
        const parts = nameParts(el);
        const text = shortText(el, 80);
        return { selector: selectorOf(el), snippet: snippetOf(el), tag: parts.tag, classes: parts.cls, text, css: cssSummary(el), element: selectorOf(el) };
      },
      codeFacts(el) {
        const sel = selectorOf(el);
        return { whereL: 'Selector', where: '<code title="' + sel.replace(/"/g, '&quot;') + '">' + sel.replace(/</g, '&lt;') + '</code>', extraL: 'Tag', extra: nameParts(el).tag };
      },
      // a picture of the element, only where it is cheap: an image or a canvas that is on screen
      thumb(el) {
        try {
          const tag = el.localName.toLowerCase();
          if (tag !== 'img' && tag !== 'canvas') return null;
          const r = rectOf(el);
          if (r.w < 2 || r.h < 2) return null;
          const sc = Math.min(1, 320 / Math.max(r.w, r.h));
          const c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(r.w * sc)); c.height = Math.max(1, Math.round(r.h * sc));
          c.getContext('2d').drawImage(el, 0, 0, c.width, c.height);
          return c.toDataURL('image/png');
        } catch (e) { return null; }
      },
      // ---- solo: hide everything except the picked element, with a run-time style (the page files are not touched) ----
      solo(el, stage) {
        adapter.unsolo();
        if (!el) return;
        soloEl = el;
        el.setAttribute('data-pk-in', '1');
        soloStyle = doc.createElement('style');
        soloStyle.id = '__pk_solo_style';
        (doc.head || doc.documentElement).appendChild(soloStyle);
        adapter.setStage(stage);
        doc.documentElement.classList.add('__pk-solo');
      },
      setStage(stage) {
        if (!soloStyle) return;
        const bg = EP.STAGES[stage] || EP.STAGES.grey;
        soloStyle.textContent =
          'html.__pk-solo{background:' + bg + '!important}' +
          'html.__pk-solo body{background:none!important}' +
          'html.__pk-solo :not([data-pk-in]):not([data-pk-in] *){visibility:hidden!important}' +
          'html.__pk-solo [data-pk-in]{visibility:visible!important}';
      },
      unsolo() {
        if (soloEl) soloEl.removeAttribute('data-pk-in');
        soloEl = null;
        if (soloStyle) { soloStyle.remove(); soloStyle = null; }
        doc.documentElement.classList.remove('__pk-solo');
      },
      destroy() { adapter.unsolo(); if (allStyle) { allStyle.remove(); allStyle = null; } },
    };
    return adapter;
  };

  EP.STAGES = {
    grey: 'repeating-conic-gradient(#6c6962 0 25%, #75726a 0 50%) 0 0 / 48px 48px',
    ink: '#141413',
    paper: '#ECE7DC',
  };

  // =====================================================================================================
  // 5. Element API mode (window.SM, written by the page itself; see the README for the contract)
  // =====================================================================================================
  EP.hasApi = (w) => !!(w.SM && typeof w.SM.elementsAt === 'function' && typeof w.SM.hit === 'function' && (typeof w.SM.render === 'function' || typeof w.renderAt === 'function'));

  EP.makeApi = function (ctx) {
    const SM = ctx.win.SM;
    const META = SM.meta || {};
    const SEP = '\u0001';
    const lastName = {};
    let spans = null;
    const listAt = (t) => SM.elementsAt(t) || [];
    const poly = (pts) => 'M' + pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
    const circ = (cx, cy, r) => 'M' + (cx - r).toFixed(1) + ' ' + cy.toFixed(1) + 'a' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 1 0 ' + (2 * r).toFixed(1) + ' 0a' + r.toFixed(1) + ' ' + r.toFixed(1) + ' 0 1 0 ' + (-2 * r).toFixed(1) + ' 0Z';
    function pathsOf(e, list) {
      let fill = '';
      let line = '';
      const one = (el) => {
        for (const it of el.items || []) {
          if (it.k === 'poly') fill += poly(it.pts);
          else if (it.k === 'rect') {
            const full = it.w >= (SM.W || 1920) - 20 && it.h >= (SM.H || 1080) - 20;
            const m = full ? 8 : 3;
            fill += 'M' + (it.x + m) + ' ' + (it.y + m) + 'h' + Math.max(1, it.w - 2 * m) + 'v' + Math.max(1, it.h - 2 * m) + 'h' + -Math.max(1, it.w - 2 * m) + 'Z';
          } else if (it.k === 'disc') fill += circ(it.cx, it.cy, it.r);
          else if (it.k === 'ring') line += circ(it.cx, it.cy, it.r);
          else if (it.k === 'line') line += 'M' + it.pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
        }
        for (const h of el.holes || []) fill += poly(h);
      };
      if (e.group) { for (const id of e.members || []) { const m = list.find((x) => x.id === id); if (m) one(m); } } else one(e);
      if (!fill && !line) { const b = e.bounds; fill = 'M' + b.x + ' ' + b.y + 'h' + b.w + 'v' + b.h + 'h' + -b.w + 'Z'; }
      return { fill, line, clip: '' };
    }
    const chainOf = (id) => { const out = []; for (let c = id; c && out.length < 12; c = META[c] && META[c].parent) out.unshift(c); return out; };
    const elKey = (e) => (e.look ? e.id + ':' + e.look : e.id);

    const adapter = {
      id: 'api',
      hasSolo: typeof SM.renderSolo === 'function',
      hasBlur: typeof SM.renderSolo === 'function',
      hasThumb: typeof SM.thumb === 'function',
      setup() { if (typeof SM.measure === 'function') { try { spans = SM.measure(); } catch (e) { spans = null; } } },
      stats() { const t = ctx.time(); return { content: listAt(t).length }; },
      size: () => ({ w: SM.W || 1920, h: SM.H || 1080 }),
      acts: () => (Array.isArray(SM.acts) ? SM.acts : []),
      layers() {
        const out = [];
        for (const id of Object.keys(META)) {
          const m = META[id];
          if (m && m.name && ((m.members && m.members.length) || m.hover === false)) out.push({ ref: id, label: m.name });
        }
        return out;
      },
      // draw one frame (sync): the whole page, or only the soloed element
      draw(t, soloRef, opts) {
        if (soloRef && adapter.hasSolo) SM.renderSolo(t, soloRef, { blur: !!opts.blur, bg: opts.stage });
        else if (typeof SM.render === 'function') SM.render(t);
        else return ctx.win.renderAt(t);
        return null;
      },
      pick: (x, y, tol, t) => { const h = SM.hit(t, x, y, tol); return h ? h.id : null; },
      alive: (id) => !!id,
      same: (a, b) => a === b,
      chain: chainOf,
      crumbName(id, t) {
        const e = listAt(t).find((x) => x.id === id);
        if (e) { lastName[id] = e.name; return e.name; }
        return (META[id] && META[id].name) || lastName[id] || id;
      },
      info(id, t) {
        const list = listAt(t);
        const e = list.find((x) => x.id === id);
        if (!e) {
          const m = META[id] || {};
          return { ref: id, gone: true, shown: false, name: m.name || lastName[id] || id, cat: m.cat || 'Shape', group: !!m.members, members: m.members ? m.members.length : 0, what: m.what || '', bounds: null, outline: null, key: id };
        }
        lastName[id] = e.name;
        const m = META[id] || {};
        return {
          ref: id, shown: true, key: elKey(e), name: e.name, cat: e.cat || m.cat || 'Shape', group: !!e.group, members: e.members ? e.members.length : 0,
          what: e.what || m.what || '', bounds: { x: e.bounds.x, y: e.bounds.y, w: e.bounds.w, h: e.bounds.h }, outline: pathsOf(e, list), look: e.look || null, element: e,
        };
      },
      // when the element, and this look of it, is on screen (from SM.measure)
      span(id, name) {
        if (!spans) return null;
        return { id: spans[id] || null, look: name ? spans[id + SEP + name] || null : null };
      },
      visibleAt: (id, t) => listAt(t).some((e) => e.id === id),
      locate: (rec) => (rec && rec.elementId && (META[rec.elementId] || listAt(0).some((e) => e.id === rec.elementId)) ? rec.elementId : null),
      record(id, t, inf) {
        const m = META[id] || {};
        return {
          elementId: id, element: inf.key, draw: m.fn || '', assets: m.assets || [], look: inf.look || null,
          members: inf.group && inf.element ? (inf.element.members || []).slice() : null,
          selector: 'window.SM element "' + id + '"' + (inf.look ? ' (look: ' + inf.look + ')' : ''),
        };
      },
      codeFacts(id) {
        const m = META[id] || {};
        const as = m.assets || [];
        return { whereL: 'Code', where: m.fn ? '<span title="The draw function in the page">' + String(m.fn).replace(/</g, '&lt;') + '</span>' : '<span class="more">not listed</span>', extraL: 'Assets', extra: as.length ? as.slice(0, 2).map((a) => String(a).split('/').pop().replace(/</g, '&lt;')).join(', ') + (as.length > 2 ? ' <span class="more">+' + (as.length - 2) + '</span>' : '') : '<span class="more">none (drawn in code)</span>' };
      },
      thumb(id, t, bounds) {
        if (!adapter.hasThumb) return null;
        try { const r = SM.thumb(t, [id], { bounds }); return r && r.url ? r.url : null; } catch (e) { return null; }
      },
      solo() { /* drawing is done by draw() */ },
      setStage() {},
      unsolo() {},
      destroy() {},
    };
    return adapter;
  };

  // =====================================================================================================
  // 6. Region mode (a canvas or WebGL page with no element API and no DOM content)
  // =====================================================================================================
  EP.makeRegion = function (ctx) {
    const w = ctx.win;
    const doc = ctx.doc;
    const cs = (el) => w.getComputedStyle(el);
    let scratch = null;
    const canvases = () => {
      const out = [];
      for (const cv of doc.querySelectorAll('canvas')) {
        const s = cs(cv);
        if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) <= 0.01) continue;
        const r = cv.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        out.push({ cv, r, s });
      }
      return out;
    };
    // all visible canvases painted onto one sheet the size of the page, in page order, over the page background
    function compose() {
      const sz = ctx.size();
      const k = Math.min(1, 4096 / Math.max(sz.w, sz.h));
      if (!scratch) scratch = document.createElement('canvas');
      scratch.width = Math.max(1, Math.round(sz.w * k));
      scratch.height = Math.max(1, Math.round(sz.h * k));
      const g = scratch.getContext('2d', { willReadFrequently: false });
      g.setTransform(k, 0, 0, k, 0, 0);
      g.clearRect(0, 0, sz.w, sz.h);
      for (const el of [doc.body, doc.documentElement]) {
        const bc = el && cs(el).backgroundColor;
        if (bc && !isClear(bc)) { g.fillStyle = bc; g.fillRect(0, 0, sz.w, sz.h); break; }
      }
      let drawn = 0;
      for (const c of canvases()) {
        try {
          g.globalAlpha = parseFloat(c.s.opacity) || 1;
          g.drawImage(c.cv, c.r.left, c.r.top, c.r.width, c.r.height);
          drawn++;
        } catch (e) { /* a tainted canvas can not be read */ }
      }
      g.globalAlpha = 1;
      return { canvas: scratch, k, drawn };
    }
    function crop(reg, maxSide) {
      const { canvas, k } = compose();
      const sx = clamp(Math.round(reg.x * k), 0, canvas.width - 1);
      const sy = clamp(Math.round(reg.y * k), 0, canvas.height - 1);
      const sw = clamp(Math.round(reg.w * k), 1, canvas.width - sx);
      const sh = clamp(Math.round(reg.h * k), 1, canvas.height - sy);
      const sc = maxSide ? Math.min(1, maxSide / Math.max(sw, sh)) : 1;
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(sw * sc));
      out.height = Math.max(1, Math.round(sh * sc));
      const g = out.getContext('2d', { willReadFrequently: true });
      g.imageSmoothingQuality = 'high';
      g.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
      return out;
    }
    // how much is in the crop: lets the picker warn about an empty region
    function stats(out) {
      try {
        const g = out.getContext('2d');
        const d = g.getImageData(0, 0, out.width, out.height).data;
        let opaque = 0; let lo = 255; let hi = 0;
        const step = Math.max(1, Math.floor(d.length / 4 / 4000)) * 4;
        for (let i = 0; i < d.length; i += step) {
          if (d[i + 3] > 8) opaque++;
          const l = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (l < lo) lo = l;
          if (l > hi) hi = l;
        }
        return { transparent: opaque === 0, flat: hi - lo < 3 };
      } catch (e) { return { transparent: false, flat: false }; }
    }
    const adapter = {
      id: 'region',
      hasSolo: true,
      hasBlur: false,
      layers: () => [],
      setup() {},
      stats() { const c = canvases(); return { canvases: c.length, canvasArea: c.reduce((a, b) => a + b.r.width * b.r.height, 0) }; },
      canvasCount: () => canvases().length,
      alive: (r) => !!r,
      same: (a, b) => !!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h,
      chain: (r) => [r],
      crumbName: () => 'Region',
      info(r, t) {
        if (!r) return null;
        const sz = ctx.size();
        const rect = { x: ri(r.x), y: ri(r.y), w: ri(r.w), h: ri(r.h) };
        // the same box at another time is a different picture, so the time is part of the identity of a region pick
        return {
          ref: r, shown: true, key: 'region:' + rect.x + ',' + rect.y + ',' + rect.w + ',' + rect.h + '@' + (+t || 0).toFixed(3), name: 'Region ' + rect.w + ' x ' + rect.h, cat: 'Region', group: false, members: 0,
          what: 'A rectangle you drew, cut from the page’s canvases at the current time.', bounds: rect,
          outline: { fill: 'M' + rect.x + ' ' + rect.y + 'h' + rect.w + 'v' + rect.h + 'h' + -rect.w + 'Z', line: '', clip: '' }, size: sz,
        };
      },
      codeFacts(r) { return { whereL: 'Region', where: ri(r.x) + ', ' + ri(r.y) + '  ' + ri(r.w) + ' x ' + ri(r.h), extraL: 'Canvases', extra: String(canvases().length) }; },
      record(r, t, inf) { return { selector: 'region ' + inf.bounds.x + ',' + inf.bounds.y + ' ' + inf.bounds.w + 'x' + inf.bounds.h, element: inf.key, snippet: '', tag: 'region' }; },
      // call right after the page drew the frame you want (the picker does that for you)
      thumb(r) {
        const out = crop(r, 480);
        return { url: out.toDataURL('image/png'), stats: stats(out) };
      },
      pngBlob(r) {
        return new Promise((ok) => crop(r, 0).toBlob((b) => ok(b), 'image/png'));
      },
      // solo: the stage colour with only the region's pixels on it
      paintSolo(target, r, stage) {
        const sz = ctx.size();
        if (target.width !== sz.w || target.height !== sz.h) { target.width = sz.w; target.height = sz.h; }
        const g = target.getContext('2d');
        g.clearRect(0, 0, sz.w, sz.h);
        if (stage === 'grey') {
          for (let y = 0; y < sz.h; y += 24) for (let x = 0; x < sz.w; x += 24) { g.fillStyle = ((x / 24 + y / 24) & 1) ? '#75726a' : '#6c6962'; g.fillRect(x, y, 24, 24); }
        } else { g.fillStyle = stage === 'ink' ? '#141413' : '#ECE7DC'; g.fillRect(0, 0, sz.w, sz.h); }
        const { canvas, k } = compose();
        g.drawImage(canvas, r.x * k, r.y * k, r.w * k, r.h * k, r.x, r.y, r.w, r.h);
      },
      locate: () => null,
      solo() {}, setStage() {}, unsolo() {}, destroy() {},
    };
    return adapter;
  };
})();
