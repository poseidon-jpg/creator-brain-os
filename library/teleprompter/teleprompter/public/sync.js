/* Teleprompter sync: the phone and the desktop view stay on the same line at the same speed, so you can switch
   between looking at either one mid-take. One engine, loaded by both pages (index.html and desktop.html).

   - Position is layout-free: A = block index + how far through that block the reading line sits. Both pages render the
     same markdown, so block i is the same paragraph on every screen, whatever its width or font size.
   - Whoever was touched last leads (play, pause, speed, a scroll, a new script). It sends its state over the app's
     WebSocket (/api/sync in server.mjs); the server numbers every message and relays it, and every page follows the newest sender.
   - Followers play at the same speed and ease toward the leader's line, so they never drift and never jump.
   - Speed 1 = 20 px a second of the phone's text. The desktop view lays its text out
     at the phone's width and font size, scaled up, so its lines break the same way and the same speed reads the same words.

   Page hooks (o): role 'phone' | 'desk', root() the text element, topOf(el) block top in page px, getY() / setY(y) / addY(dy)
   the reading line's page y, viewH(), scale() page px per phone px, file(), loadFile(f), onPlaying(b), onSpeed(v),
   onStatus(S), and for the phone layout() -> {w, fs}; for the desktop onLayout(layout). */
(function () {
  'use strict';
  const PX = 20;
  const ID = Math.random().toString(36).slice(2, 10);

  // The blocks a position is measured in: every top-level block, with lists and quotes opened up into their items.
  function blocksOf(root) {
    const out = [];
    for (const el of root.children) {
      if (/^(UL|OL|BLOCKQUOTE)$/.test(el.tagName) && el.children.length) out.push(...el.children);
      else out.push(el);
    }
    return out;
  }
  // Slot i runs from block i's top to block i+1's top (the gap below it included); the last slot ends at the last block's bottom.
  function slotH(T, i) { return Math.max(1, (i + 1 < T.length ? T[i + 1] : T.end) - T[i]); }
  function toA(y, T) {
    if (!T.length) return 0;
    if (y < T[0]) return (y - T[0]) / slotH(T, 0);
    let lo = 0, hi = T.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (T[m] <= y) lo = m; else hi = m - 1; }
    return lo + (y - T[lo]) / slotH(T, lo);
  }
  function toY(A, T) {
    if (!T.length) return 0;
    if (A < 0) return T[0] + A * slotH(T, 0);
    const i = Math.min(T.length - 1, Math.floor(A));
    return T[i] + (A - i) * slotH(T, i);
  }

  window.TPSync = function (o) {
    const S = { id: ID, playing: false, speed: o.speed || 1, enabled: o.enabled !== false, online: false, peers: { phone: 0, desk: 0 } };
    let ws = null, retry = 0, lastSeq = 0, leader = null, lead = null, loading = false;
    let T = null, lastSent = 0, sendT = null, sendClaim = false, lastFrame = 0, lastMoved = 0, lastLayout = '';
    let myClaim = false;   // this page claimed the lead and the server has not echoed it yet
    const rate = () => PX * S.speed * (o.scale ? o.scale() : 1);
    const isLeader = () => leader === ID;
    const status = () => o.onStatus && o.onStatus(S);

    function tops() {
      if (T) return T;
      const B = blocksOf(o.root());
      T = B.map(o.topOf);
      const last = B[B.length - 1];
      T.end = last ? o.topOf(last) + last.offsetHeight : 0;
      return T;
    }
    if (window.ResizeObserver) new ResizeObserver(() => { T = null; }).observe(o.root());
    window.addEventListener('resize', () => { T = null; });

    // ---- sending ----
    // claim: a user action on this page, which takes the lead; otherwise a routine update, which the server only
    // relays while this page still leads (so an update that crossed someone else's pause never undoes it)
    function send(claim) {
      if (!S.enabled || !ws || ws.readyState !== 1 || !o.file()) return;
      if (claim) myClaim = true;
      ws.send(JSON.stringify({ type: 'state', claim: !!claim, file: o.file(), A: +toA(o.getY(), tops()).toFixed(5), playing: S.playing, speed: S.speed }));
      lastSent = performance.now();
    }
    function queueSend(ms, claim) {
      if (claim) { sendClaim = true; myClaim = true; }
      if (sendT) return;
      sendT = setTimeout(() => { const c = sendClaim; sendT = null; sendClaim = false; send(c); }, Math.max(0, ms - (performance.now() - lastSent)));
    }
    function sendLayout() {
      if (!o.layout || !ws || ws.readyState !== 1) return;
      const l = o.layout(), k = JSON.stringify(l);
      if (k === lastLayout) return;
      lastLayout = k; ws.send(JSON.stringify({ type: 'layout', layout: l }));
    }

    // ---- local actions: each one makes this page the leader ----
    S.claim = () => { leader = ID; lead = null; send(true); };
    S.play = b => { S.playing = !!b; o.onPlaying(S.playing); S.claim(); };
    S.setSpeed = v => { S.speed = v; leader = ID; lead = null; queueSend(80, true); };
    S.stop = () => { S.playing = false; o.onPlaying(false); };                 // local only (a script loaded here by itself)
    S.moved = () => { leader = ID; lead = null; lastMoved = performance.now(); queueSend(100, true); };
    S.scrolled = () => { if (isLeader() && (!S.playing || performance.now() - lastMoved < 1500)) queueSend(120, false); };
    S.relayout = () => { T = null; };
    S.layoutChanged = () => sendLayout();
    // run a layout change (font, width, zoom) without losing the line
    S.keepPlace = fn => {
      const A = o.file() ? toA(o.getY(), tops()) : null;
      fn(); T = null;
      if (A !== null) o.setY(toY(A, tops()));
      if (isLeader()) queueSend(120, false);
    };
    S.setEnabled = b => {
      S.enabled = !!b;
      if (S.enabled) { leader = ID; if (!ws) connect(); else send(true); }
      else if (ws) { const w = ws; ws = null; w.onclose = null; w.close(); S.online = false; }
      status();
    };

    // ---- following ----
    function follow(m, age) {
      lead = { A: m.A, playing: !!m.playing, file: m.file, recv: performance.now() - age };
      if (m.speed && m.speed !== S.speed) { S.speed = m.speed; o.onSpeed && o.onSpeed(S.speed); }
      if (lead.playing !== S.playing) { S.playing = lead.playing; o.onPlaying(S.playing); }
    }
    function onMsg(m) {
      if (m.type === 'peers') { S.peers = m.peers; status(); return; }
      if (m.type === 'layout') { o.onLayout && S.keepPlace(() => o.onLayout(m.layout)); return; }
      if (m.type === 'init') {
        lastSeq = m.seq || 0;
        if (m.layout && o.onLayout) S.keepPlace(() => o.onLayout(m.layout));
        const L = m.last;
        if (L && L.from !== ID && leader === null) {
          leader = L.from;
          const stale = L.age > 5000;                                        // a player that went quiet has stopped
          follow(stale ? Object.assign({}, L, { playing: false }) : L, stale ? 0 : L.age);
        }
        ws.send(JSON.stringify({ type: 'hello' }));
        if (isLeader()) send(true);
        return;
      }
      if (m.type === 'hello') {
        // a page just opened or woke up: give it the line if this page leads, if it was the leader, or if nobody leads yet
        if (m.from !== ID && o.file() && (isLeader() || leader === m.from || leader === null)) send(true);
        return;
      }
      if (m.type === 'state') {
        if (m.seq <= lastSeq) return;
        lastSeq = m.seq;
        if (m.from === ID) { leader = ID; if (m.claim) myClaim = false; return; }
        if (!m.claim && myClaim) return;                 // our own claim is on its way; this one is older news
        leader = m.from; myClaim = false;
        follow(m, 0);
      }
    }

    function frame(now) {
      requestAnimationFrame(frame);
      const dt = lastFrame ? Math.min(0.1, (now - lastFrame) / 1000) : 0;
      lastFrame = now;
      if (S.enabled && !isLeader() && lead && lead.file) {
        if (lead.file !== o.file()) {
          if (!loading) { loading = true; Promise.resolve(o.loadFile(lead.file)).catch(() => {}).then(() => { loading = false; T = null; }); }
          return;
        }
        if (loading) return;
        const target = toY(lead.A, tops()) + (lead.playing ? rate() * (now - lead.recv) / 1000 : 0);
        const e = target - o.getY();
        if (Math.abs(e) > 2 * o.viewH()) { o.setY(target); return; }            // a new script or a big jump: go straight there
        const dy = (S.playing ? rate() * dt : 0) + e * (1 - Math.exp(-dt / (lead.playing ? 0.35 : 0.12)));
        if (Math.abs(dy) > 0.001) o.addY(dy);
        return;
      }
      if (!o.file()) return;
      if (S.playing) o.addY(rate() * dt);
      if (S.enabled && isLeader() && S.playing && now - lastSent > 300) send(false);
    }
    requestAnimationFrame(frame);

    // ---- the link ----
    function connect() {
      if (!S.enabled) return;
      try { ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/api/sync?role=' + o.role + '&id=' + ID); }
      catch (e) { ws = null; setTimeout(connect, 3000); return; }
      ws.onopen = () => { retry = 0; S.online = true; lastLayout = ''; sendLayout(); status(); };
      ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } onMsg(m); };
      ws.onclose = () => { ws = null; S.online = false; S.peers = { phone: 0, desk: 0 }; status(); setTimeout(connect, Math.min(5000, 1000 * ++retry)); };
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      lastFrame = 0; T = null;
      if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'hello' }));
    });
    connect();
    S.toA = y => toA(y, tops()); S.toY = A => toY(A, tops());
    return S;
  };
})();
