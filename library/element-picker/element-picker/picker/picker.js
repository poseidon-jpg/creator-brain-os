/* Element Picker: the screen.
   Loads any HTML or JS video in a same-origin frame (adapters.js reads it), lets you pause or scrub it, hover to outline an
   element, click to select it, solo it, and save picks. Three modes: DOM, Element API (window.SM) and Region. */
(function () {
  'use strict';
  const EP = window.EP;
  const { clamp, ri, r3, sleep, isThen, fmt2 } = EP.util;
  const $ = (id) => document.getElementById(id);
  const UIKEY = 'element-picker-ui';
  const SEP = '\u0001';
  const CATS = ['Text', 'Shape', 'Image', 'Background', 'Layout', 'Effect', 'Region', 'Other'];
  const DEFAULT_CAT = { Letter: 'Text', Group: 'Layout' };
  const MODE_NAME = { api: 'Element API', dom: 'DOM', region: 'Region' };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DASH = String.fromCharCode(8212); // the long dash is never kept in text the picker writes
  const clean = (s) => String(s == null ? '' : s).split(DASH).join(' - ').replace(/[ \t]+/g, ' ').trim();
  const fmt = (t) => t.toFixed(2);
  const readJSON = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const HTTP = /^https?:$/.test(location.protocol);

  // ---------- the address: ?page=<path in the video folder>[&size=1920x1080][&dur=5][&t=2.5][&mode=dom|api|region] ----------
  const params = new URLSearchParams(location.search);
  function cleanPage(p) {
    if (!p) return null;
    const s = p.trim().replace(/^\/+/, '');
    const pathOnly = s.split('?')[0].split('#')[0];
    if (!s || /^[a-z][a-z0-9+.-]*:/i.test(s) || s.includes('\\') || pathOnly.split('/').includes('..') || /^__picker(\/|$)/.test(s)) return false;
    return s;
  }
  const PAGE = cleanPage(params.get('page'));
  const NS = 'element-picker:' + (PAGE || '');
  const THUMBS = NS + ':thumbs';
  const DIRTY = NS + ':dirty';
  const STATE_URL = '/api/state/' + encodeURIComponent(PAGE || 'none');

  const prefs = Object.assign({ speed: 1, loop: true, pick: false, stage: 'grey', blur: true }, readJSON(UIKEY, {}));
  const savePrefs = () => { try { localStorage.setItem(UIKEY, JSON.stringify(prefs)); } catch (e) { /* private mode */ } };

  // ---------- saving: this browser first, then serve.py writes picks.json ----------
  let dirty = {};
  let diskOK = false;
  let flushing = false;
  let retry = 0;
  const writeDirty = () => { try { localStorage.setItem(DIRTY, JSON.stringify(dirty)); } catch (e) { /* ignore */ } };
  const store = (k, v) => {
    try { localStorage.setItem(k, v); } catch (e) { toast('Browser storage is full: picks not saved'); return false; }
    dirty[k] = true;
    writeDirty();
    return true;
  };
  function mergeDisk(keys) {
    let changed = false;
    for (const k of [NS, THUMBS]) {
      if (dirty[k]) continue;
      const cur = localStorage.getItem(k);
      if (keys[k] != null) { if (cur !== keys[k]) { localStorage.setItem(k, keys[k]); changed = true; } }
      else if (cur != null) { localStorage.removeItem(k); changed = true; }
    }
    return changed;
  }
  async function flush() {
    if (!HTTP || flushing || !PAGE) return;
    flushing = true;
    clearTimeout(retry);
    try {
      if (!diskOK) {
        const r = await fetch(STATE_URL, { cache: 'no-store' });
        if (!r.ok) throw new Error('state ' + r.status);
        const st = await r.json();
        diskOK = true;
        if (mergeDisk(st.keys || {})) { loadPicks(); renderPicks(); }
      }
      const keys = Object.keys(dirty);
      if (keys.length) {
        setSave('saving');
        const set = {};
        keys.forEach((k) => { set[k] = localStorage.getItem(k); });
        const r = await fetch(STATE_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ set }) });
        if (!r.ok) throw new Error('save ' + r.status);
        await r.json();
        keys.forEach((k) => { if (localStorage.getItem(k) === set[k]) delete dirty[k]; });
        writeDirty();
      }
      flushing = false;
      if (Object.keys(dirty).length) return flush();
      setSave('saved');
    } catch (e) {
      flushing = false;
      setSave('offline');
      retry = setTimeout(flush, 4000);
    }
  }
  async function connectDisk() {
    if (!HTTP) { setSave('browser'); return; }
    dirty = readJSON(DIRTY, {}) || {};
    try {
      const r = await fetch(STATE_URL, { cache: 'no-store' });
      if (!r.ok) throw new Error('state ' + r.status);
      const st = await r.json();
      diskOK = true;
      mergeDisk(st.keys || {});
      setSave(Object.keys(dirty).length ? 'saving' : 'saved');
      if (Object.keys(dirty).length) flush();
    } catch (e) {
      setSave('offline');
      retry = setTimeout(flush, 4000);
    }
    addEventListener('pagehide', () => {
      const keys = Object.keys(dirty);
      if (!keys.length || !diskOK || !navigator.sendBeacon) return;
      const set = {};
      keys.forEach((k) => { set[k] = localStorage.getItem(k); });
      const body = JSON.stringify({ set });
      if (body.length < 60000) navigator.sendBeacon(STATE_URL, new Blob([body], { type: 'text/plain' }));
    });
  }
  function setSave(state) {
    const el = $('saveState');
    el.className = 'saved ' + ({ saved: 'ok', saving: 'busy', offline: 'bad' }[state] || '');
    $('saveTxt').textContent = { loading: 'Loading', saved: 'Saved to picks.json', saving: 'Saving', offline: 'Server offline, kept here', browser: 'This browser only' }[state];
    el.title = state === 'saved' || state === 'saving' ? 'Your picks are written to picks.json next to serve.py' : state === 'browser' ? 'Open the picker through serve.py to save picks to a file' : 'Saves as soon as serve.py is back';
    api.save = state;
  }

  // ---------- pixel sprites ----------
  function pix(rows, px) {
    const h = rows.length; const w = rows[0].length;
    let s = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="' + w * px + '" height="' + h * px + '" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">';
    rows.forEach((r, y) => [...r].forEach((c, x) => { if (c === '#') s += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>'; }));
    return s + '</svg>';
  }
  const ICO = {
    play: pix(['#......', '###....', '#####..', '#######', '#####..', '###....', '#......'], 2),
    pause: pix(['##.##', '##.##', '##.##', '##.##', '##.##', '##.##', '##.##'], 2),
    back: pix(['#....#', '#...##', '#..###', '#.####', '#..###', '#...##', '#....#'], 2),
    fwd: pix(['#....#', '##...#', '###..#', '####.#', '###..#', '##...#', '#....#'], 2),
    pick: pix(['#......', '##.....', '#.#....', '#..#...', '#...#..', '#....#.', '#..###.', '#.#....', '##.....'], 2),
    x: pix(['#...#', '.#.#.', '..#..', '.#.#.', '#...#'], 2),
  };

  // ---------- state ----------
  let page = null; // { win, doc, early, clock }
  let tc = null; // the time control
  let adapters = {};
  let ad = null;
  let mode = null;
  let PW = 1920;
  let PH = 1080;
  let DUR = 5;
  let FPS = 30;
  let ready = false;
  let fresh = true;
  const clock = { playing: false, t: 0, base: 0, perf0: 0, stopAt: null };
  let raf = 0;
  let sel = null; // { ref, crumbs: [ref], segs: [[a,b]] | null, name }
  let solo = false;
  let mouse = null;
  let picks = [];
  let thumbs = {};
  const drafts = {};
  let dragRect = null;
  let lastHoverAt = 0;
  let selTag = null;
  let regionNote = '';
  const api = (window.__picker = { ready: false });

  const size = () => ({ w: PW, h: PH });
  const live = () => !!tc && !tc.canSeek;
  const scale = () => $('frame').clientWidth / PW;
  const hoverLive = () => prefs.pick || !clock.playing;

  // =====================================================================================================
  // boot
  // =====================================================================================================
  async function boot() {
    themeInit();
    buildStatic();
    setSave('loading');
    layout();
    window.addEventListener('resize', layout);
    if (document.fonts) document.fonts.ready.then(layout);
    if (PAGE === null || PAGE === false) return showChooser(PAGE === false);
    $('pageName').textContent = PAGE;
    document.title = 'Element Picker - ' + PAGE;
    await connectDisk();
    loadPicks();
    renderPicks();
    const iframe = $('reel');
    iframe.setAttribute('scrolling', 'no');
    iframe.style.width = PW + 'px';
    iframe.style.height = PH + 'px';
    const [pp, qq] = PAGE.split('?');
    const url = '/' + pp.split('/').map(encodeURIComponent).join('/') + (qq ? '?' + qq : '') + (params.get('nocapture') ? '' : (qq ? '&' : '?') + 'capture');
    try {
      page = await EP.loadPage(iframe, url, pp);
    } catch (e) {
      return failLoad(e);
    }
    page.clock = EP.makeClock(page.win);
    await EP.settle(page);
    try {
      await attach();
    } catch (e) {
      console.error(e);
      return failLoad(e);
    }
    ready = true;
    layout();
    $('loading').classList.add('gone');
    api.ready = true;
    renderAt(clock.t);
  }

  async function showChooser(bad) {
    $('chooser').hidden = false;
    $('loading').classList.add('gone');
    setSave(HTTP ? 'saved' : 'browser');
    if (bad) $('chooserMsg').textContent = 'That page address is not allowed. Use a path inside the video folder, for example ?page=my-video/index.html';
    try {
      const r = await fetch('/__picker/api/pages', { cache: 'no-store' });
      const d = await r.json();
      const ul = $('chooserList');
      if (!d.pages.length) { $('chooserMsg').innerHTML = 'No .html pages were found in the video folder. Put your page there, then reload.'; return; }
      const ti = d.titles || {};
      ul.innerHTML = d.pages.map((p) => '<li><a href="?page=' + encodeURIComponent(p).replace(/%2F/g, '/') + '">' + esc(p) + (ti[p] ? ' <span class="t">' + esc(ti[p]) + '</span>' : '') + '</a></li>').join('');
    } catch (e) {
      $('chooserMsg').innerHTML = 'Open the picker through <code>python serve.py</code> so it can list your pages.';
    }
  }

  function failLoad(e) {
    const m = $('loadMsg');
    $('loading').classList.add('bad');
    $('loading').classList.remove('gone');
    if (e && e.code === 404) m.innerHTML = 'The page <b>' + esc(PAGE) + '</b> was not found in the video folder. Check the path after <code>?page=</code>.';
    else if (!HTTP) m.innerHTML = 'Open the picker through <code>python serve.py</code> so it can reach the page.';
    else m.textContent = (e && e.message) || 'The page did not load.';
    setSave(HTTP ? 'saved' : 'browser');
  }

  // read the page: size, time control, and which modes are possible
  async function attach() {
    const w = page.win;
    const doc = page.doc;
    FPS = 30;
    tc = await EP.detectTime(page, { dur: +params.get('dur') || 0 });
    FPS = tc.fps || 30;
    DUR = tc.duration || 0;
    const hasApi = EP.hasApi(w);
    // the page's size
    const q = (params.get('size') || '').match(/^(\d{3,5})x(\d{3,5})$/);
    if (q) { PW = +q[1]; PH = +q[2]; } else if (hasApi && w.SM.W && w.SM.H) { PW = +w.SM.W; PH = +w.SM.H; } else detectSize(w, doc);
    applyPageSize(false);
    const ctx = { win: w, doc, size, time: () => clock.t };
    adapters = { dom: EP.makeDom(ctx), region: EP.makeRegion(ctx) };
    if (hasApi) adapters.api = EP.makeApi(ctx);
    adapters.dom.setup();
    if (adapters.api) adapters.api.setup();
    api.stats = { dom: adapters.dom.stats(), region: adapters.region.stats(), hasApi };
    const forced = params.get('mode');
    const first = chooseMode(forced);
    // time starts near the end, where most things have arrived
    const t0 = parseFloat(params.get('t'));
    if (tc.canSeek) {
      clock.t = clamp(isFinite(t0) ? t0 : Math.round(DUR * 0.85 * FPS) / FPS, 0, DUR);
      if (tc.stop) tc.stop();
      const r = tc.seek(clock.t); if (isThen(r)) await r;
    } else {
      clock.t = 0;
      clock.playing = true;
    }
    timeUI();
    buildModes();
    setMode(first, forced && forced === first ? 'You chose this mode in the address.' : '');
    playUI();
    if (live()) startLiveTick();
  }

  // a page with a fixed body size (a vertical reel, for example) sets the frame; everything else is 1920 x 1080
  function detectSize(w, doc) {
    const b = doc.body;
    const cv = [...doc.querySelectorAll('canvas')].filter((c) => { const r = c.getBoundingClientRect(); return r.width >= 400 && r.height >= 300; });
    if (cv.length === 1) {
      const r = cv[0].getBoundingClientRect();
      if (Math.abs(r.left) < 2 && Math.abs(r.top) < 2) { PW = ri(r.width); PH = ri(r.height); return; }
    }
    if (b) {
      const r = b.getBoundingClientRect();
      const ov = w.getComputedStyle(b).overflow + w.getComputedStyle(doc.documentElement).overflow;
      if (/hidden|clip/.test(ov) && r.width >= 200 && r.height >= 200 && Math.abs(r.left) < 2 && Math.abs(r.top) < 2 && r.width <= 8000 && r.height <= 8000) { PW = ri(r.width); PH = ri(r.height); return; }
    }
    PW = 1920; PH = 1080;
  }
  function applyPageSize(redraw) {
    const f = $('reel');
    f.style.width = PW + 'px';
    f.style.height = PH + 'px';
    $('ov').setAttribute('viewBox', '0 0 ' + PW + ' ' + PH);
    $('sizeW').value = PW;
    $('sizeH').value = PH;
    layout();
    if (redraw && ready) renderAt(clock.t);
  }

  function chooseMode(forced) {
    const avail = availability();
    if (forced && avail[forced]) return forced;
    if (avail.api) return 'api';
    const d = adapters.dom.stats();
    const c = adapters.region.stats();
    if (d.content >= 3) return 'dom';
    if (c.canvases && c.canvasArea >= 0.25 * PW * PH) return 'region';
    if (d.content >= 1) return 'dom';
    if (c.canvases) return 'region';
    return 'dom';
  }
  function availability() {
    return { api: !!adapters.api, dom: !!(page && page.doc.body), region: !!(adapters.region && adapters.region.canvasCount() > 0) };
  }
  function buildModes() {
    const av = availability();
    document.querySelectorAll('#modes button').forEach((b) => {
      const m = b.dataset.mode;
      b.disabled = !av[m];
      b.title = av[m] ? '' : { api: 'This page does not expose window.SM (the element API)', dom: 'The page has no body', region: 'This page has no canvas to cut a region from' }[m];
    });
  }
  function modeReason(m, extra) {
    const d = adapters.dom.stats();
    const c = adapters.region.stats();
    let s = '';
    if (m === 'api') s = 'The page exposes window.SM (the element API), so it tells the picker what is on screen. You get exact outlines, thumbnails and when each element is visible.';
    else if (m === 'dom') {
      s = 'The page is built from web page elements (' + d.content + ' that draw something). The picker finds them with the browser’s own hit testing and edits nothing in the page.';
      if (c.canvases) s += ' It also has ' + c.canvases + ' canvas' + (c.canvases > 1 ? 'es' : '') + ', which count as one element each. Switch to Region to cut part of a canvas.';
    } else {
      s = 'The page draws into a canvas' + (d.content ? '' : ' and has no web page elements') + ', so there are no elements to read. Drag a rectangle on the frame to cut a region.';
    }
    return (extra ? extra + ' ' : '') + s;
  }

  function setMode(m, extra) {
    if (!adapters[m]) return;
    if (ad) ad.unsolo();
    solo = false;
    mode = m;
    ad = adapters[m];
    sel = null;
    dragRect = null;
    $('dragBox').classList.remove('on');
    $('modeBadge').textContent = MODE_NAME[m];
    $('modeWhy').textContent = modeReason(m, extra);
    document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
    $('inspSteps').innerHTML = m === 'region'
      ? '<li>Scrub to a frame you like.</li><li>Drag a rectangle on the frame.</li><li>Save it to keep a PNG cut and its box.</li>'
      : '<li>Pause it (or turn on Pick).</li><li>Hover the frame to outline an element.</li><li>Click it, then Solo or Save.</li>';
    $('blurBtn').hidden = !ad.hasBlur;
    $('bSolo').hidden = !ad.hasSolo;
    buildLayers();
    buildTimeline();
    applyStage();
    applySolo();
    fillInspector();
    $('hit').classList.toggle('aim', m === 'region' || hoverLive());
    api.mode = m;
    if (ready) renderAt(clock.t);
    else frameUI();
  }

  // =====================================================================================================
  // time: our own clock drives the page through tc.seek(t); a live page just runs
  // =====================================================================================================
  let seekBusy = false;
  let slowPage = false; // a frame took over a second to draw: scanning every frame (to find when an element is on screen) would freeze the picker
  async function frame(tt) {
    const f0 = performance.now();
    if (ad && ad.draw) { const r = ad.draw(tt, solo && sel ? sel.ref : null, { blur: prefs.blur, stage: prefs.stage }); if (isThen(r)) await r; }
    else if (tc.canSeek) { const r = tc.seek(tt); if (isThen(r)) await r; }
    if (performance.now() - f0 > 1200) slowPage = true;
    if (mode === 'region') paintRegionSolo();
    frameUI();
  }
  async function pump() {
    if (seekBusy) return;
    seekBusy = true;
    try {
      for (let guard = 0; guard < 40; guard++) {
        const tt = clock.t;
        try { await frame(tt); } catch (e) { console.error(e); break; }
        if (clock.t === tt) break;
      }
    } finally { seekBusy = false; }
  }
  function renderAt(t) {
    if (tc && tc.canSeek) clock.t = clamp(t, 0, DUR);
    if (!ready) return Promise.resolve();
    if (live()) { frameUI(); return Promise.resolve(); }
    return pump();
  }
  // read the page once its current frame has settled, for the same task (WebGL buffers are only valid until the task ends)
  async function withFrame(fn) {
    if (tc.canSeek) {
      if (ad && ad.draw) { const r = ad.draw(clock.t, null, { blur: false, stage: prefs.stage }); if (isThen(r)) await r; }
      else { const r = tc.seek(clock.t); if (isThen(r)) await r; }
      return fn();
    }
    page.clock.stepNow();
    return fn();
  }
  function now() {
    if (!clock.playing) return clock.t;
    return clock.base + ((performance.now() - clock.perf0) / 1000) * prefs.speed;
  }
  function play(from) {
    if (!ready) return;
    if (live()) { tc.release(); clock.playing = true; playUI(); startLiveTick(); return; }
    if (from == null) from = fresh || clock.t >= DUR - 0.01 ? 0 : clock.t;
    fresh = false;
    clock.base = from;
    clock.t = from;
    clock.playing = true;
    clock.stopAt = null;
    clock.perf0 = performance.now();
    playUI();
    if (!raf) raf = requestAnimationFrame(tick);
  }
  function pause(at) {
    if (live()) {
      tc.hold();
      clock.playing = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      playUI();
      frameUI();
      return;
    }
    const t = at != null ? at : now();
    clock.playing = false;
    clock.stopAt = null;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    playUI();
    renderAt(t).then(() => ensureSpan());
  }
  const toggle = () => (clock.playing ? pause() : play());
  function tick() {
    raf = 0;
    if (!clock.playing) return;
    const t = now();
    const end = clock.stopAt != null ? clock.stopAt : DUR;
    if (t >= end) {
      if (clock.stopAt != null) return pause(clock.stopAt);
      if (prefs.loop) return play(0);
      return pause(DUR);
    }
    renderAt(t);
    raf = requestAnimationFrame(tick);
  }
  function startLiveTick() {
    if (raf) return;
    const loop = () => { raf = 0; if (!clock.playing || !live()) return; if (prefs.pick) updateBoxes(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
  }
  function rebase() {
    if (!clock.playing || live()) return;
    const t = now();
    clock.base = t;
    clock.perf0 = performance.now();
  }
  function step(n) {
    if (!ready || live()) return;
    if (clock.playing) pause();
    fresh = false;
    renderAt(Math.round(clock.t * FPS) / FPS + n / FPS);
  }
  function replay() {
    if (!sel || !ready || live()) return;
    const sp = curSpan();
    if (!sp) return toast('No time range for this one yet');
    const a = Math.max(0, sp[0] - 0.12);
    const b = Math.min(DUR, sp[0] + Math.max(0.8, Math.min(2.2, sp[1] - sp[0])));
    fresh = false;
    play(a);
    clock.stopAt = b;
  }

  // =====================================================================================================
  // selection and solo
  // =====================================================================================================
  const curInfo = (full) => (sel ? ad.info(sel.ref, clock.t, full ? { full: true } : undefined) : null);
  function select(ref, crumbs) {
    sel = ref ? { ref, crumbs: crumbs || ad.chain(ref), segs: null } : null;
    if (solo && !sel) solo = false;
    applySolo();
    if (ready) { if (mode === 'region') paintRegionSolo(); else if (!ad.draw) { /* DOM solo is a style, nothing to redraw */ } else renderAt(clock.t); }
    fillInspector();
    frameUI();
    markCurrentPick();
    if (sel) ensureSpan();
  }
  function selSummary() {
    const inf = curInfo(true);
    return { id: mode === 'api' ? sel.ref : null, name: inf ? inf.name : '', key: inf ? inf.key : null, selector: inf && inf.selector, bounds: inf && inf.bounds, mode };
  }
  function setSolo(on) {
    solo = !!on && !!sel && ad.hasSolo;
    applySolo();
    if (ready) { if (mode === 'region') paintRegionSolo(); else if (ad.draw) renderAt(clock.t); }
    fillInspector();
    frameUI();
  }
  function applySolo() {
    const on = solo && sel;
    $('soloChip').classList.toggle('on', !!on);
    $('blurBtn').classList.toggle('on', !!prefs.blur);
    $('soloCv').classList.toggle('on', !!on && mode === 'region');
    if (on) { const inf = curInfo(); $('soloName').textContent = inf ? inf.name : ''; }
    if (mode === 'dom') { if (on) ad.solo(sel.ref, prefs.stage); else ad.unsolo(); }
  }
  function applyStage() {
    document.querySelectorAll('#stageSw button').forEach((b) => b.classList.toggle('on', b.dataset.stage === prefs.stage));
    if (mode === 'dom') ad.setStage(prefs.stage);
  }
  function paintRegionSolo() {
    const cv = $('soloCv');
    if (!(solo && sel && mode === 'region')) { cv.classList.remove('on'); return; }
    ad.paintSolo(cv, sel.ref, prefs.stage);
    cv.classList.add('on');
  }
  function pickLayer(ref) {
    if (!ready) return;
    const here = ad.visibleAt && ad.visibleAt(ref, clock.t);
    if (!here && ad.span) {
      const sp = ad.span(ref, null);
      const seg = sp && sp.id && sp.id[0];
      if (seg) {
        if (clock.playing) pause();
        fresh = false;
        renderAt((seg[0] + seg[1]) / 2).then(() => select(ref));
        toast('Jumped to ' + fmt((seg[0] + seg[1]) / 2) + ' s, where ' + ad.crumbName(ref, (seg[0] + seg[1]) / 2) + ' is on screen');
        return;
      }
    }
    select(ref);
  }

  // when the selected element is on screen: from the page (Element API) or by sampling the page at each frame (DOM)
  function curSpan() {
    if (!sel) return null;
    const t = clock.t;
    const nearest = (segs) => {
      if (!segs || !segs.length) return null;
      let best = segs[0]; let bd = Infinity;
      for (const s of segs) { const d = t < s[0] ? s[0] - t : t > s[1] ? t - s[1] : 0; if (d < bd) { bd = d; best = s; } }
      return best;
    };
    if (mode === 'api') {
      const inf = curInfo();
      const sp = ad.span(sel.ref, inf && !inf.gone && inf.look ? inf.name : null);
      if (!sp) return null;
      return nearest(sp.look ? [].concat(sp.look) : sp.id);
    }
    return nearest(sel.segs);
  }
  async function ensureSpan() {
    if (!sel || mode !== 'dom' || !tc.canSeek || clock.playing || sel.segs || sel.measuring || sel.slow) return;
    const s = sel;
    s.measuring = true;
    $('iSpan').textContent = 'Finding when it is on screen...';
    const keepT = clock.t;
    try {
      // one frame is timed first: a page that draws slowly (3D, heavy canvas) gets fewer samples, or none, so the picker never freezes
      const a0 = performance.now();
      let r = tc.seek(0); if (isThen(r)) await r;
      const per = Math.max(1, performance.now() - a0);
      if (per > 700 || slowPage) s.slow = true;
      else {
        const n = clamp(Math.floor(2500 / per), 12, Math.min(Math.ceil(DUR * FPS), 180));
        const stepT = DUR / n;
        const out = [];
        let open = null;
        let lastOn = 0;
        let stopped = false;
        for (let i = 0; i <= n; i++) {
          if (sel !== s || clock.playing) { stopped = true; break; } // you moved on: stop scanning
          const tt = Math.min(DUR, i * stepT);
          const q0 = performance.now();
          r = tc.seek(tt); if (isThen(r)) await r;
          if (performance.now() - q0 > 1200) { slowPage = true; s.slow = true; stopped = true; break; } // some frames are heavy: give up, once
          const on = ad.visibleAt(s.ref, tt);
          if (on) { if (open === null) open = tt; lastOn = tt; } else if (open !== null) { out.push([r3(open), r3(lastOn)]); open = null; }
        }
        if (open !== null) out.push([r3(open), r3(lastOn)]);
        if (!stopped) s.segs = out;
      }
    } catch (e) { s.segs = []; console.error(e); }
    try { const r = tc.seek(keepT); if (isThen(r)) await r; } catch (e) { /* ignore */ }
    s.measuring = false;
    if (sel === s) { fillInspector(); frameUI(); }
  }

  // =====================================================================================================
  // frame UI: time, playhead, outlines
  // =====================================================================================================
  function frameUI() {
    if (!ready && !ad) return;
    const t = clock.t;
    if (!live()) {
      const tn = $('timeNow');
      if (tn) tn.textContent = fmt(t);
      $('tlHead').style.left = (DUR ? (t / DUR) * 100 : 0) + '%';
      const acts = ad && ad.acts ? ad.acts() : [];
      if (acts.length) {
        let a = acts[0];
        for (const x of acts) if (t >= x.from) a = x;
        document.querySelectorAll('#tlSegs .tl-seg').forEach((d, i) => d.classList.toggle('cur', acts[i] === a));
      }
    }
    updateBoxes();
    if (sel) {
      const inf = curInfo();
      const gone = !inf || inf.shown === false;
      if (!inf || inf.name !== sel.shownName || gone !== sel.shownGone) fillInspector();
      else if (inf.bounds) $('iBounds').textContent = boundsText(inf.bounds);
      markCurrentPick();
    }
  }
  const boundsText = (b) => 'x ' + b.x + '  y ' + b.y + '  w ' + b.w + '  h ' + b.h;

  function setPaths(prefix, o) {
    const f = $(prefix + 'Fill');
    const l = $(prefix + 'Line');
    const c = $(prefix + 'Clip');
    const set = (el, d) => { if (!el) return; el.toggleAttribute('hidden', !d); if (d) el.setAttribute('d', d); };
    set(f, o && o.fill);
    set(l, o && o.line);
    set(c, o && o.clip);
    if (l) l.style.strokeWidth = '9px';
  }
  function updateBoxes() {
    if (!ready || !ad) return;
    const k = scale();
    const se = sel ? curInfo() : null;
    const seShown = se && se.shown !== false && se.bounds ? se : null;
    setPaths('ovSel', seShown && seShown.outline);
    place($('boxSel'), $('tagSel'), seShown, true);
    let hv = null;
    if (mode !== 'region' && mouse && hoverLive()) {
      const tnow = performance.now();
      if (!clock.playing || tnow - lastHoverAt > 80) {
        lastHoverAt = tnow;
        const ref = ad.pick(mouse.x / k, mouse.y / k, 5 / k, clock.t);
        hv = ref ? ad.info(ref, clock.t) : null;
        updateBoxes.hv = hv;
      } else hv = updateBoxes.hv || null;
    } else updateBoxes.hv = null;
    const same = hv && sel && ad.same(hv.ref, sel.ref);
    const show = hv && !same && hv.shown !== false && hv.bounds ? hv : null;
    setPaths('ovHover', show && show.outline ? { fill: show.outline.fill, line: show.outline.line, clip: '' } : null);
    place(null, $('tagHover'), show, false);
    api.hover = hv ? { id: typeof hv.ref === 'string' ? hv.ref : null, name: hv.name, key: hv.key, cat: hv.cat, bounds: hv.bounds } : null;
    $('hit').classList.toggle('aim', mode === 'region' || hoverLive());
    $('frame').classList.toggle('aiming', !!prefs.pick);
  }
  function place(boxEl, tagEl, inf, isSel) {
    if (!inf) {
      if (boxEl) boxEl.classList.remove('on');
      tagEl.classList.remove('on');
      return;
    }
    const k = scale();
    const b = inf.bounds;
    const r = { left: b.x * k, top: b.y * k, width: b.w * k, height: b.h * k, right: (b.x + b.w) * k, bottom: (b.y + b.h) * k };
    const wide = inf.group || (b.w >= PW - 20 && b.h >= PH - 20);
    if (boxEl) {
      boxEl.classList.add('on');
      boxEl.classList.toggle('layer', wide);
      boxEl.style.transform = 'translate(' + r.left + 'px, ' + r.top + 'px)';
      boxEl.style.width = r.width + 'px';
      boxEl.style.height = r.height + 'px';
    }
    const html = '<b>' + esc(inf.cat) + '</b>' + esc(inf.name);
    if (tagEl.__html !== html) { tagEl.__html = html; tagEl.innerHTML = html; }
    tagEl.classList.add('on');
    const fw = $('frame').clientWidth;
    const fh = $('frame').clientHeight;
    const tw = tagEl.offsetWidth;
    const th = tagEl.offsetHeight;
    let x = r.left;
    let y = r.top - th - 8;
    if (r.width >= fw - 4 && r.height >= fh - 4) { x = 18; y = isSel ? fh - th - 18 : 18; }
    else if (y < 8) { y = r.bottom + 8 + th < fh - 8 ? r.bottom + 8 : r.top + 8; if (y === r.top + 8) x = r.left + 8; }
    if (isSel && solo && x < 520 && y < 64) y = r.bottom + 8 + th < fh - 8 ? r.bottom + 8 : 64;
    x = Math.round(clamp(x, 8, Math.max(8, fw - tw - 8)));
    y = Math.round(clamp(y, 8, Math.max(8, fh - th - 8)));
    if (isSel) selTag = { x, y, w: tw, h: th };
    else if (selTag && $('tagSel').classList.contains('on') && x < selTag.x + selTag.w + 6 && x + tw + 6 > selTag.x && y < selTag.y + selTag.h + 6 && y + th + 6 > selTag.y) {
      y = selTag.y - th - 6 >= 8 ? selTag.y - th - 6 : Math.min(fh - th - 8, selTag.y + selTag.h + 6);
    }
    tagEl.style.transform = 'translate(' + x + 'px, ' + y + 'px)';
  }

  // =====================================================================================================
  // inspector
  // =====================================================================================================
  function fillInspector() {
    document.querySelectorAll('#wholes button').forEach((b) => b.classList.toggle('on', !!sel && mode === 'api' && sel.ref === b.dataset.ref));
    const has = !!sel && ready;
    $('inspEmpty').hidden = has;
    $('inspBody').hidden = !has;
    $('tlSpan').classList.toggle('on', has && !!curSpan());
    if (!has) return;
    const inf = curInfo(true);
    sel.shownName = inf ? inf.name : null;
    sel.shownGone = !inf || inf.shown === false;
    const name = inf ? inf.name : '(gone)';
    if (mode === 'api') {
      const acts = ad.acts();
      let a = acts[0];
      for (const x of acts) if (clock.t >= x.from) a = x;
      $('iScene').textContent = a ? 'Act ' + a.num + ' · ' + a.name : 'Element API';
    } else $('iScene').textContent = mode === 'dom' ? 'DOM element' : 'Region';
    $('iKind').textContent = inf ? inf.cat + (inf.group ? ' · group of ' + inf.members : mode === 'region' ? '' : ' · exact element') : '';
    $('iKind').classList.toggle('grp', !!(inf && inf.group));
    $('iName').textContent = name;
    $('iWhat').textContent = inf ? inf.what : '';
    const cr = $('iCrumbs');
    cr.innerHTML = '';
    const chain = sel.crumbs || [];
    const idx = Math.max(0, chain.findIndex((r) => ad.same(r, sel.ref)));
    const from = Math.max(0, Math.min(idx - 3, chain.length - 7));
    const shown = chain.slice(from, from + 7);
    if (from > 0) { const s = document.createElement('span'); s.className = 'sep'; s.textContent = '…'; cr.appendChild(s); }
    shown.forEach((r, i) => {
      if (i || from > 0) { const s = document.createElement('span'); s.className = 'sep'; s.textContent = '›'; cr.appendChild(s); }
      const b = document.createElement('button');
      const nm = ad.crumbName(r, clock.t);
      b.textContent = nm;
      b.title = nm;
      b.classList.toggle('on', ad.same(r, sel.ref));
      b.addEventListener('click', () => { sel.ref = r; sel.segs = null; applySolo(); fillInspector(); frameUI(); markCurrentPick(); ensureSpan(); if (mode === 'api') renderAt(clock.t); });
      cr.appendChild(b);
    });
    cr.hidden = chain.length < 2;
    // when it is on screen
    const sp = curSpan();
    let txt;
    if (mode === 'region') txt = 'cut at the current time';
    else if (sel.measuring) txt = 'Finding when it is on screen...';
    else if (live()) txt = 'live page: no timeline';
    else txt = sp ? fmt(sp[0]) + ' - ' + fmt(sp[1]) + ' s' : (sel.slow ? 'not measured (this page draws slowly)' : mode === 'dom' && !sel.segs ? 'not measured yet' : 'not measured');
    if (mode === 'api' && sp) {
      const inf2 = curInfo();
      const whole = ad.span(sel.ref, null);
      const id = whole && whole.id ? [].concat(whole.id).reduce((best, s) => (best && Math.abs((best[0] + best[1]) / 2 - clock.t) < Math.abs((s[0] + s[1]) / 2 - clock.t) ? best : s), null) : null;
      if (id && (Math.abs(id[0] - sp[0]) > 0.005 || Math.abs(id[1] - sp[1]) > 0.005) && inf2 && !inf2.gone) txt += ' <span class="more">· as ' + esc(inf2.name) + ', lives ' + fmt(id[0]) + ' - ' + fmt(id[1]) + '</span>';
    }
    $('iSpan').innerHTML = txt;
    $('iBounds').textContent = inf && inf.bounds && inf.shown !== false ? boundsText(inf.bounds) : 'not on screen at this time';
    const cf = ad.codeFacts ? ad.codeFacts(sel.ref) : null;
    if (cf) { $('iWhereL').textContent = cf.whereL; $('iWhere').innerHTML = cf.where; $('iExtraL').textContent = cf.extraL; $('iExtra').innerHTML = cf.extra; $('iWhere').title = inf && inf.selector ? inf.selector : ''; }
    const key = inf ? inf.key : null;
    const existing = key ? picks.find((p) => p.element === key) : null;
    $('cat').value = existing ? existing.category : DEFAULT_CAT[inf && inf.cat] || (inf && CATS.includes(inf.cat) ? inf.cat : 'Other');
    $('note').value = existing ? existing.note : (key && drafts[key]) || '';
    $('bSave').textContent = existing ? 'Update pick' : 'Save pick';
    $('bSave').disabled = !inf || inf.shown === false;
    $('bSolo').classList.toggle('on', solo);
    $('bReplay').hidden = !(tc.canSeek && mode !== 'region');
    $('bReplay').disabled = !sp;
    $('bPng').hidden = mode !== 'region';
    const sg = $('tlSpan');
    if (sp && DUR) { sg.style.left = (sp[0] / DUR) * 100 + '%'; sg.style.width = Math.max(0.4, ((sp[1] - sp[0]) / DUR) * 100) + '%'; }
  }

  // =====================================================================================================
  // picks
  // =====================================================================================================
  function loadPicks() {
    const d = readJSON(NS, null);
    picks = d && Array.isArray(d.picks) ? d.picks : [];
    thumbs = readJSON(THUMBS, {}) || {};
  }
  function persist() {
    Object.keys(thumbs).forEach((id) => { if (!picks.some((p) => p.id === id)) delete thumbs[id]; });
    const payload = { version: 1, tool: 'Element Picker', page: PAGE, updated: new Date().toISOString(), picks };
    const ok = store(NS, JSON.stringify(payload)) && store(THUMBS, JSON.stringify(thumbs));
    if (ok) flush();
  }
  async function savePick() {
    const inf = sel && ready ? curInfo(true) : null;
    if (!inf || inf.shown === false) return toast('Scrub to where it is on screen, then save');
    const key = inf.key;
    const existing = picks.find((p) => p.element === key);
    const extra = ad.record(sel.ref, clock.t, inf);
    const sp = curSpan();
    let thumb = null;
    let note = '';
    if (mode === 'region') {
      const th = await withFrame(() => ad.thumb(sel.ref));
      if (th) { thumb = th.url; if (th.stats && th.stats.transparent) note = 'Nothing is drawn in that region at this time (it is transparent).'; }
      await frame(clock.t);
    } else if (mode === 'api') {
      thumb = ad.thumb(sel.ref, clock.t, inf.bounds);
      await frame(clock.t);
    } else thumb = ad.thumb(sel.ref);
    const rec = Object.assign({
      id: existing ? existing.id : 'p' + Date.now().toString(36),
      mode,
      page: PAGE,
      name: inf.name,
      kind: inf.cat,
      category: $('cat').value,
      note: clean($('note').value),
      t: tc.canSeek ? r3(clock.t) : null,
      range: sp ? sp.map(r3) : null,
      box: { x: inf.bounds.x, y: inf.bounds.y, w: inf.bounds.w, h: inf.bounds.h },
      stage: { w: PW, h: PH },
      timeControl: tc.kind,
      created: existing ? existing.created : new Date().toISOString(),
    }, extra);
    if (mode === 'dom') { rec.element = key; }
    if (thumb) thumbs[rec.id] = thumb; else delete thumbs[rec.id];
    if (existing) picks[picks.indexOf(existing)] = rec; else picks.push(rec);
    delete drafts[key];
    persist();
    renderPicks(existing ? null : rec.id);
    fillInspector();
    toast(note || (existing ? 'Pick updated' : 'Saved: ' + rec.name));
    api.lastSaved = rec.id;
  }
  function removePick(id) {
    const i = picks.findIndex((p) => p.id === id);
    if (i < 0) return;
    const gone = picks.splice(i, 1)[0];
    const th = thumbs[id];
    persist();
    renderPicks();
    fillInspector();
    toast('Removed ' + gone.name, 'Undo', () => {
      picks.splice(Math.min(i, picks.length), 0, gone);
      if (th) thumbs[id] = th;
      persist();
      renderPicks();
      fillInspector();
    });
  }
  function whereSvg(p) {
    const w = (p.stage && p.stage.w) || PW; const h = (p.stage && p.stage.h) || PH;
    const b = p.box || { x: 0, y: 0, w: 0, h: 0 };
    return '<svg class="where" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect width="' + w + '" height="' + h + '" fill="#1c1a16"/><rect x="' + b.x + '" y="' + b.y + '" width="' + Math.max(b.w, w / 60) + '" height="' + Math.max(b.h, h / 60) + '" fill="#ff6b1a" opacity=".9"/></svg>';
  }
  function renderPicks(newId) {
    const list = $('pkList');
    list.innerHTML = '';
    picks.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'pk' + (p.id === newId ? ' enter' : '');
      li.dataset.id = p.id;
      const th = thumbs[p.id];
      const when = p.range ? fmt(p.range[0]) + '-' + fmt(p.range[1]) + ' s' : p.t != null ? 'at ' + fmt(p.t) + ' s' : 'live';
      const where = p.selector ? p.selector : '';
      li.innerHTML =
        '<div class="pk-thumb">' + (th ? '<img src="' + th + '" alt="">' : whereSvg(p)) + '<span class="pk-n">' + (i + 1) + '</span></div>' +
        '<div class="pk-body"><div class="pk-name" title="' + esc(p.name) + '">' + esc(p.name) + '</div>' +
        '<div class="pk-meta" title="' + esc(p.kind) + ' · ' + esc(MODE_NAME[p.mode] || p.mode) + ' mode · category ' + esc(p.category) + '">' + when + '<span class="pk-cat kind">' + esc(MODE_NAME[p.mode] || p.mode) + '</span><span class="pk-cat">' + esc(p.category) + '</span></div>' +
        '<div class="pk-files" title="' + esc(where) + '">' + esc(where) + '</div>' +
        (p.note ? '<div class="pk-note" title="' + esc(p.note) + '"><b>Why:</b> ' + esc(p.note) + '</div>' : '') +
        '</div><button class="pk-x" title="Remove this pick" data-rm="' + esc(p.id) + '">' + ICO.x + '</button>';
      list.appendChild(li);
    });
    $('pkEmpty').hidden = picks.length > 0;
    list.hidden = !picks.length;
    $('pkCount').textContent = picks.length;
    $('copyLbl').textContent = 'Copy ' + picks.length + ' pick' + (picks.length === 1 ? '' : 's') + ' for your agent';
    const tp = $('tlPicks');
    tp.innerHTML = '';
    if (DUR) picks.forEach((p) => {
      if (p.t == null) return;
      const d = document.createElement('div');
      d.className = 'tl-pick';
      d.style.left = (p.t / DUR) * 100 + '%';
      tp.appendChild(d);
    });
    api.count = picks.length;
    markCurrentPick();
  }
  // the key of the selected element: a DOM selector or a region box never changes while it is selected, so it is cached
  const curKey = () => {
    if (!sel || !ready) return null;
    if (mode === 'dom' && sel.key) return sel.key;
    const inf = curInfo(true);
    if (inf && mode === 'dom') sel.key = inf.key;
    return inf ? inf.key : null;
  };
  function markCurrentPick() {
    const k = curKey();
    document.querySelectorAll('#pkList .pk').forEach((li) => {
      const p = picks.find((x) => x.id === li.dataset.id);
      li.classList.toggle('cur', !!(p && k && p.element === k));
    });
  }
  function jumpTo(p) {
    if (clock.playing) pause();
    fresh = false;
    if (p.mode !== mode) {
      if (!adapters[p.mode]) return toast('That pick was made in ' + MODE_NAME[p.mode] + ' mode, which this page does not offer');
      setMode(p.mode);
    }
    const go = () => {
      if (p.mode === 'region') { select({ x: p.box.x, y: p.box.y, w: p.box.w, h: p.box.h }); return; }
      const ref = ad.locate(p);
      if (!ref) return toast('That element is not in the page any more');
      select(ref);
    };
    if (tc.canSeek && p.t != null) renderAt(p.t).then(go); else go();
  }

  // drag to reorder: the card follows the pointer, the others slide, the new order saves on drop
  let justDragged = false;
  function initDrag() {
    const list = $('pkList');
    list.addEventListener('pointerdown', (e) => {
      const card = e.target.closest('.pk');
      if (!card || e.button !== 0 || e.target.closest('button, a')) return;
      const y0 = e.clientY;
      let grab = 0; let dragging = false; let lastY = y0; let auto = 0;
      const follow = (y) => {
        const others = [...list.children].filter((c) => c !== card);
        let before = null;
        for (const o of others) { const r = o.getBoundingClientRect(); if (y < r.top + r.height / 2) { before = o; break; } }
        if (card.nextElementSibling !== before) flip(list, card, () => list.insertBefore(card, before));
        card.style.transform = 'none';
        const nat = card.getBoundingClientRect().top;
        card.style.transform = 'translateY(' + (y - grab - nat) + 'px)';
      };
      const scroller = () => {
        if (!dragging) return;
        const r = list.getBoundingClientRect();
        let d = 0;
        if (lastY < r.top + 40) d = -Math.ceil((r.top + 40 - lastY) / 3);
        else if (lastY > r.bottom - 40) d = Math.ceil((lastY - (r.bottom - 40)) / 3);
        if (d) { list.scrollTop += d; follow(lastY); }
        auto = requestAnimationFrame(scroller);
      };
      const move = (ev) => {
        lastY = ev.clientY;
        if (!dragging) {
          if (Math.abs(ev.clientY - y0) < 5) return;
          dragging = true;
          grab = y0 - card.getBoundingClientRect().top;
          card.classList.add('dragging');
          auto = requestAnimationFrame(scroller);
        }
        follow(ev.clientY);
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        cancelAnimationFrame(auto);
        if (!dragging) return;
        dragging = false;
        card.classList.remove('dragging');
        card.style.transform = '';
        const order = [...list.children].map((li) => li.dataset.id);
        const before = picks.map((p) => p.id).join();
        picks.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
        justDragged = true;
        setTimeout(() => { justDragged = false; }, 50);
        if (picks.map((p) => p.id).join() !== before) { persist(); renderPicks(); }
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }
  function flip(list, skip, change) {
    const items = [...list.children].filter((c) => c !== skip);
    const before = new Map(items.map((c) => [c, c.getBoundingClientRect().top]));
    change();
    for (const c of items) {
      const dy = before.get(c) - c.getBoundingClientRect().top;
      if (!dy) continue;
      c.style.transition = 'none';
      c.style.transform = 'translateY(' + dy + 'px)';
      requestAnimationFrame(() => { c.style.transition = 'transform .18s ease'; c.style.transform = ''; });
    }
  }

  // =====================================================================================================
  // hand-off: Copy for your agent (a clean list plus draft entries)
  // =====================================================================================================
  const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function entryFor(p, used) {
    let key = slug((PAGE || 'page').replace(/\.html?$/i, '') + '-' + p.name).slice(0, 64).replace(/-$/, '');
    for (let n = 2; used.has(key); n++) key = key.replace(/-\d+$/, '') + '-' + n;
    used.add(key);
    const e = {
      key,
      name: p.name,
      category: p.category,
      page: p.page,
      mode: p.mode,
      description: clean(p.kind + ' picked in ' + (MODE_NAME[p.mode] || p.mode) + ' mode' + (p.range ? ', on screen ' + p.range[0] + '-' + p.range[1] + ' s' : '') + (p.note ? '. Why it was kept: ' + p.note : '')),
      time: p.t,
      range: p.range,
      box: p.box,
      stage: p.stage,
      selector: p.selector || null,
    };
    if (p.mode === 'dom') { e.snippet = p.snippet; e.tag = p.tag; e.text = p.text; e.css = p.css; e.how = 'document.querySelector(' + JSON.stringify(p.selector) + ') in ' + p.page + '. Solo it by hiding everything outside that element (visibility), at time ' + p.t + ' s.'; }
    if (p.mode === 'api') { e.elementId = p.elementId; e.draw = p.draw; e.assets = p.assets; e.members = p.members; e.how = 'window.SM.renderSolo(' + p.t + ', [' + JSON.stringify(p.elementId) + '], { blur: false, bg: \'none\' }) draws only this element; window.SM.elementsAt(' + p.t + ') gives its outline.'; }
    if (p.mode === 'region') e.how = 'Draw the page at ' + p.t + ' s, then crop its canvases to this box. A PNG thumbnail is in picks.json under the ":thumbs" key.';
    return e;
  }
  function exportText() {
    const n = picks.length;
    const L = [];
    L.push('Element Picker: ' + n + ' pick' + (n === 1 ? '' : 's') + ' from ' + PAGE);
    L.push('Page: ' + PAGE + ' (inside the video folder that serve.py serves) · stage ' + PW + ' x ' + PH + ' px · time control: ' + (tc ? tc.label : '?') + (DUR ? ' (' + fmt2(DUR) + ' s)' : ''));
    L.push('Saved in picks.json next to serve.py: keys["' + NS + '"] is a JSON string, and its .picks list is in your order.');
    L.push('Each pick has a mode. dom: a CSS selector and an HTML snippet. api: an element id from window.SM. region: a rectangle cut from the canvases (its PNG thumbnail is under the ":thumbs" key).');
    L.push('');
    if (!n) L.push('(no picks yet)');
    picks.forEach((p, i) => {
      L.push((i + 1) + '. ' + p.name + ' [' + p.category + ']');
      L.push('   ' + (MODE_NAME[p.mode] || p.mode) + ' mode · ' + p.kind + (p.selector ? ' · ' + p.selector : ''));
      L.push('   ' + (p.range ? 'On screen ' + p.range[0] + '-' + p.range[1] + ' s · ' : '') + (p.t != null ? 'picked at ' + p.t + ' s · ' : '') + 'box x ' + p.box.x + ' y ' + p.box.y + ' w ' + p.box.w + ' h ' + p.box.h);
      if (p.draw) L.push('   Drawn by: ' + p.draw);
      L.push('   Why: ' + (p.note || '(no note)'));
      if (p.snippet) { L.push('   Snippet:'); p.snippet.split('\n').forEach((ln) => L.push('     ' + ln)); }
      L.push('');
    });
    if (n) {
      const used = new Set();
      L.push('Draft entries (one JSON object per pick):');
      L.push('```json');
      L.push(JSON.stringify(picks.map((p) => entryFor(p, used)), null, 2));
      L.push('```');
    }
    return L.join('\n').split(DASH).join(' - ');
  }
  async function copyForAgent() {
    const text = exportText();
    api.lastCopy = text;
    try {
      await navigator.clipboard.writeText(text);
      toast(picks.length ? 'Copied ' + picks.length + ' pick' + (picks.length === 1 ? '' : 's') + ' for your agent' : 'Copied. No picks yet');
    } catch (e) {
      $('copyText').value = text;
      $('copyModal').classList.add('on');
      $('copyText').focus();
      $('copyText').select();
    }
  }

  // =====================================================================================================
  // chrome: toast, theme, layout, controls
  // =====================================================================================================
  function toast(msg, btn, fn) {
    $('toastMsg').textContent = msg;
    const b = $('toastBtn');
    b.hidden = !btn;
    b.textContent = btn || '';
    b.onclick = fn ? () => { fn(); $('toast').classList.remove('on'); } : null;
    $('toast').classList.add('on');
    clearTimeout(toast.h);
    toast.h = setTimeout(() => $('toast').classList.remove('on'), btn ? 5000 : 2200);
  }
  function themeInit() {
    const root = document.documentElement;
    $('themeToggle').addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('element-picker-theme', next); } catch (e) { /* ignore */ }
      root.setAttribute('data-theme', next);
      root.style.colorScheme = next;
    });
  }
  // The picture is as big as fits. The boxes under it (mode, time, transport) keep a readable width even when the picture is tall and narrow.
  function layout() {
    const col = $('stagecol');
    const w0 = col.clientWidth;
    const hAvail = col.clientHeight;
    let pw = w0;
    let w = w0;
    for (let i = 0; i < 3; i++) {
      $('player').style.width = pw + 'px';
      const h0 = hAvail - ($('transport').offsetHeight + $('strip').offsetHeight + 24);
      w = w0;
      if ((w * PH) / PW > h0) w = (Math.max(180, h0) * PW) / PH;
      w = Math.floor(w);
      pw = Math.min(w0, Math.max(w, 620));
    }
    const h = Math.round((w * PH) / PW);
    $('player').style.width = pw + 'px';
    $('frame').style.width = w + 'px';
    $('frame').style.height = h + 'px';
    $('reel').style.transform = 'scale(' + w / PW + ')';
    if (ready) requestAnimationFrame(updateBoxes);
  }
  function playUI() {
    $('bPlay').innerHTML = clock.playing ? ICO.pause : ICO.play;
    $('bPlay').title = clock.playing ? 'Pause (Space)' : 'Play (Space)';
    api.playing = clock.playing;
    if (ad) updateBoxes();
  }
  function speedUI() { document.querySelectorAll('#speed button').forEach((b) => b.classList.toggle('on', +b.dataset.v === prefs.speed)); }
  function loopUI() { $('bLoop').classList.toggle('on', prefs.loop); }
  function pickUI() { $('bPick').classList.toggle('on', prefs.pick); if (ad) updateBoxes(); }
  function timeUI() {
    const lv = live();
    $('timeBadge').textContent = tc.label;
    $('timeWhy').textContent = tc.why;
    $('time').innerHTML = lv ? '<b id="timeNow" style="font-weight:600">live</b> <span></span>' : '<b id="timeNow" style="font-weight:600">' + fmt(clock.t) + '</b> <span>/ ' + fmt2(DUR) + '</span>';
    $('tl').classList.toggle('off', lv);
    $('tl').title = lv ? 'This page has no timeline the picker can control' : '';
    $('tlHead').hidden = lv;
    $('bBack').disabled = lv;
    $('bFwd').disabled = lv;
    document.querySelectorAll('#speed button').forEach((b) => { b.disabled = lv; });
    $('bLoop').disabled = lv;
    $('bPlay').title = lv ? 'Pause / play the live page (Space)' : 'Play / pause (Space)';
  }
  function buildTimeline() {
    const segs = $('tlSegs');
    segs.innerHTML = '';
    const acts = ad && ad.acts ? ad.acts() : [];
    if (!acts.length || !DUR) return;
    const SHORT = acts.map((a) => String(a.name).split(/[\s-]/)[0].slice(0, 8));
    acts.forEach((a, i) => {
      const d = document.createElement('div');
      d.className = 'tl-seg';
      d.style.left = 'calc(' + (a.from / DUR) * 100 + '% + 1px)';
      d.style.width = 'calc(' + ((a.to - a.from) / DUR) * 100 + '% - 2px)';
      d.innerHTML = '<span>' + esc(a.num) + ' ' + esc(SHORT[i]) + '</span>';
      segs.appendChild(d);
    });
  }
  function buildLayers() {
    const box = $('wholes');
    box.querySelectorAll('button').forEach((b) => b.remove());
    const ls = ad && ad.layers ? ad.layers() : [];
    box.hidden = !ls.length;
    ls.forEach((l) => {
      const b = document.createElement('button');
      b.textContent = l.label;
      b.dataset.ref = l.ref;
      b.addEventListener('click', () => pickLayer(l.ref));
      box.appendChild(b);
    });
  }

  function buildStatic() {
    $('bPlay').innerHTML = ICO.play;
    $('bBack').innerHTML = ICO.back;
    $('bFwd').innerHTML = ICO.fwd;
    $('icoPick').innerHTML = ICO.pick;
    $('soloX').innerHTML = ICO.x;
    $('time').innerHTML = '<b id="timeNow" style="font-weight:600">0.00</b> <span>/ 0.00</span>';
    $('cat').innerHTML = CATS.map((c) => '<option>' + esc(c) + '</option>').join('');
    document.querySelectorAll('#stageSw button').forEach((b) => { b.style.background = EP.STAGES[b.dataset.stage]; });
    $('modeBadge').textContent = 'Loading';
    speedUI();
    loopUI();
    pickUI();
    initDrag();
    wire();
  }

  // drag a rectangle (Region mode)
  function wireRegion() {
    const hit = $('hit');
    let start = null;
    const toPage = (e) => { const r = hit.getBoundingClientRect(); const k = scale(); return { x: clamp((e.clientX - r.left) / k, 0, PW), y: clamp((e.clientY - r.top) / k, 0, PH) }; };
    const show = (a, b) => {
      const k = scale();
      const x = Math.min(a.x, b.x); const y = Math.min(a.y, b.y); const w = Math.abs(a.x - b.x); const h = Math.abs(a.y - b.y);
      const d = $('dragBox');
      d.style.left = x * k + 'px'; d.style.top = y * k + 'px'; d.style.width = w * k + 'px'; d.style.height = h * k + 'px';
      d.classList.add('on');
      return { x: ri(x), y: ri(y), w: ri(w), h: ri(h) };
    };
    hit.addEventListener('pointerdown', (e) => {
      if (mode !== 'region' || !ready || e.button !== 0) return;
      start = toPage(e);
      dragRect = null;
      hit.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    hit.addEventListener('pointermove', (e) => {
      if (mode !== 'region' || !start) return;
      dragRect = show(start, toPage(e));
    });
    const end = (e) => {
      if (mode !== 'region' || !start) return;
      const r = dragRect;
      start = null;
      $('dragBox').classList.remove('on');
      dragRect = null;
      if (r && r.w >= 4 && r.h >= 4) { select({ x: r.x, y: r.y, w: Math.max(1, Math.min(r.w, PW - r.x)), h: Math.max(1, Math.min(r.h, PH - r.y)) }); } else if (e.type === 'pointerup') select(null);
    };
    hit.addEventListener('pointerup', end);
    hit.addEventListener('pointercancel', end);
  }

  function wire() {
    $('bPlay').addEventListener('click', toggle);
    $('bBack').addEventListener('click', () => step(-1));
    $('bFwd').addEventListener('click', () => step(1));
    const tl = $('tl');
    const tlT = (e) => { const r = tl.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1) * DUR; };
    tl.addEventListener('pointerdown', (e) => {
      if (!ready || e.button !== 0 || live()) return;
      e.preventDefault();
      tl.setPointerCapture(e.pointerId);
      const was = clock.playing;
      if (was) { clock.playing = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
      fresh = false;
      clock.stopAt = null;
      renderAt(tlT(e));
      const move = (ev) => renderAt(tlT(ev));
      const up = () => {
        tl.removeEventListener('pointermove', move);
        tl.removeEventListener('pointerup', up);
        tl.removeEventListener('pointercancel', up);
        if (was) play(clock.t); else { playUI(); ensureSpan(); }
      };
      tl.addEventListener('pointermove', move);
      tl.addEventListener('pointerup', up);
      tl.addEventListener('pointercancel', up);
    });
    tl.addEventListener('pointermove', (e) => {
      if (!ready || live()) return;
      const t = tlT(e);
      const tip = $('tlTip');
      const acts = ad && ad.acts ? ad.acts() : [];
      let a = null;
      for (const x of acts) if (t >= x.from) a = x;
      tip.innerHTML = '<b>' + fmt(t) + '</b>' + (a ? esc(a.num + ' ' + a.name) : '');
      tip.style.left = (t / DUR) * 100 + '%';
      tip.classList.add('on');
    });
    tl.addEventListener('pointerleave', () => $('tlTip').classList.remove('on'));
    document.querySelectorAll('#speed button').forEach((b) => b.addEventListener('click', () => { prefs.speed = +b.dataset.v; savePrefs(); speedUI(); rebase(); }));
    $('bLoop').addEventListener('click', () => { prefs.loop = !prefs.loop; savePrefs(); loopUI(); });
    $('sizeW').addEventListener('change', () => { PW = clamp(+$('sizeW').value || PW, 100, 8000); applyPageSize(true); });
    $('sizeH').addEventListener('change', () => { PH = clamp(+$('sizeH').value || PH, 100, 8000); applyPageSize(true); });
    document.querySelectorAll('#modes button').forEach((b) => b.addEventListener('click', () => { if (!b.disabled && b.dataset.mode !== mode) setMode(b.dataset.mode, 'You chose this mode.'); }));
    // frame
    const hit = $('hit');
    // mouse moves are batched to one outline update per screen frame (finding the element under the mouse is the costly part)
    let boxRaf = 0;
    const scheduleBoxes = () => { if (boxRaf) return; boxRaf = requestAnimationFrame(() => { boxRaf = 0; updateBoxes(); }); };
    hit.addEventListener('pointermove', (e) => {
      const r = hit.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (!clock.playing || live()) scheduleBoxes();
    });
    hit.addEventListener('pointerleave', () => { mouse = null; scheduleBoxes(); });
    hit.addEventListener('click', (e) => {
      if (!ready || mode === 'region') return;
      const r = hit.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (!hoverLive()) return pause();
      const k = scale();
      const ref = ad.pick(mouse.x / k, mouse.y / k, 5 / k, clock.t);
      select(ref || null);
    });
    wireRegion();
    $('bPick').addEventListener('click', togglePick);
    $('bCopy').addEventListener('click', copyForAgent);
    $('bSolo').addEventListener('click', () => setSolo(!solo));
    $('soloX').addEventListener('click', () => setSolo(false));
    $('blurBtn').addEventListener('click', toggleBlur);
    $('bReplay').addEventListener('click', replay);
    $('bSave').addEventListener('click', savePick);
    $('bPng').addEventListener('click', async () => {
      if (!sel || mode !== 'region') return;
      const blob = await withFrame(() => ad.pngBlob(sel.ref));
      await frame(clock.t);
      if (!blob) return toast('Could not make the PNG');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'region-' + ri(sel.ref.w) + 'x' + ri(sel.ref.h) + '-at-' + ri(sel.ref.x) + '-' + ri(sel.ref.y) + '.png';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
    $('note').addEventListener('input', () => { const k = curKey(); if (k) drafts[k] = $('note').value; });
    document.querySelectorAll('#stageSw button').forEach((b) => b.addEventListener('click', () => {
      prefs.stage = b.dataset.stage;
      savePrefs();
      applyStage();
      if (ready) { if (mode === 'region') paintRegionSolo(); else if (ad.draw) renderAt(clock.t); }
    }));
    $('pkList').addEventListener('click', (e) => {
      if (justDragged) return;
      const rm = e.target.closest('[data-rm]');
      if (rm) return removePick(rm.dataset.rm);
      const li = e.target.closest('.pk');
      const p = li && picks.find((x) => x.id === li.dataset.id);
      if (p && ready) jumpTo(p);
    });
    $('copyClose').addEventListener('click', () => $('copyModal').classList.remove('on'));
    document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); });
    window.addEventListener('keydown', (e) => {
      const tag = e.target && e.target.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') {
        if (e.key === 'Escape') e.target.blur();
        if (e.key === 'Enter' && tag === 'TEXTAREA' && !e.shiftKey) { e.preventDefault(); savePick(); }
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (e.key === ' ') { e.preventDefault(); toggle(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(e.shiftKey ? -FPS : -1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(e.shiftKey ? FPS : 1); }
      else if (k === 'p') togglePick();
      else if (k === 's') setSolo(!solo);
      else if (k === 'b') toggleBlur();
      else if (k === 'r') replay();
      else if (k === 'l') $('bLoop').click();
      else if (e.key === 'Escape') {
        if ($('copyModal').classList.contains('on')) $('copyModal').classList.remove('on');
        else if (solo) setSolo(false);
        else select(null);
      }
    });
  }
  function togglePick() { prefs.pick = !prefs.pick; savePrefs(); pickUI(); }
  function toggleBlur() {
    if (!ad || !ad.hasBlur) return;
    prefs.blur = !prefs.blur;
    savePrefs();
    applySolo();
    if (ready && ad.draw) renderAt(clock.t);
  }

  // hooks for the headless checks
  Object.defineProperty(api, 'selected', { get: () => (sel && ready ? selSummary() : null) });
  Object.assign(api, {
    time: () => clock.t,
    seek: (t) => { if (clock.playing) pause(); fresh = false; return renderAt(t); },
    picks: () => picks,
    exportText,
    stagePoint: (x, y) => { const fr = $('frame').getBoundingClientRect(); const k = scale(); return { x: fr.left + x * k, y: fr.top + y * k }; },
    isSolo: () => solo,
    settled: async () => { for (let i = 0; i < 100 && seekBusy; i++) await sleep(10); await sleep(20); },
    info: () => ({ mode, time: tc && tc.kind, duration: DUR, fps: FPS, size: { w: PW, h: PH }, canSeek: tc && tc.canSeek, avail: availability() }),
    setMode,
    page: () => page,
    adapter: () => ad,
    tc: () => tc,
    pickAt: (x, y) => { const r = ad.pick(x, y, 5 / scale(), clock.t); return r ? ad.info(r, clock.t, { full: true }) : null; },
    selectAt: (x, y) => { const r = ad.pick(x, y, 5 / scale(), clock.t); select(r || null); return !!r; },
    crumbs: () => (sel ? sel.crumbs.map((r) => ad.crumbName(r, clock.t)) : []),
    span: () => curSpan(),
    play, pause,
    withFrame,
  });

  boot();
})();
