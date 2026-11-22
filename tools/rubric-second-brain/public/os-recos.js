/* os-recos.js - the Recos view (native, same data and state file as the standalone RUBRIC Recos app)
   and the Today briefing card that ranks what deserves attention first. */
'use strict';
(() => {
  const X = window.OSX, { el, esc, fmt, ago, svg, S, store, toast, copy, go, dur, money } = X;
  const PIL = { A: '#6aa8ff', R: '#c08bff', M: '#3ddc97', S: '#ff7a2f' };
  const LV = { low: 1, mid: 2, high: 3 };
  const R = () => (S.R && !S.R.error ? S.R : null);
  const st = () => (R() ? R().state : { skipped: {}, done: {} });
  const isOpen = it => !st().skipped[it.id] && !st().done[it.id];
  const openItems = () => (R() ? R().items.filter(isOpen) : []);
  const getCart = () => new Set(store.get('cart', []));
  const setCart = s => store.set('cart', [...s]);
  let filt = 'ALL', hidden = false;
  const busy = new Set(), srcOpen = new Set();
  const mark = (path, body) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-brain-os': '1' }, body: JSON.stringify(body) }).then(r => r.json()).then(j => { if (j.error) throw new Error(j.error); return j; });

  /* ---- the agent writes the little drawings; only plain shapes get through ---- */
  const NS = 'http://www.w3.org/2000/svg';
  const OKT = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'g']);
  const OKA = new Set(['d', 'cx', 'cy', 'r', 'x', 'y', 'width', 'height', 'rx', 'ry', 'x1', 'y1', 'x2', 'y2', 'points', 'class']);
  function safeSvg(str) {
    try {
      const doc = new DOMParser().parseFromString('<svg xmlns="' + NS + '">' + String(str || '') + '</svg>', 'image/svg+xml');
      if (doc.querySelector('parsererror')) return '';
      const out = document.createElementNS(NS, 'svg');
      out.setAttribute('viewBox', '0 0 48 48'); out.setAttribute('aria-hidden', 'true');
      const walk = (src, dst) => { for (const c of src.children) { const t = c.localName; if (!OKT.has(t)) continue; const n = document.createElementNS(NS, t); for (const a of c.attributes) if (OKA.has(a.name)) n.setAttribute(a.name, a.value); dst.appendChild(n); if (t === 'g') walk(c, n); } };
      walk(doc.documentElement, out); return out.outerHTML;
    } catch { return ''; }
  }

  /* ---- rail badge: open high-priority recos ---- */
  X.badges = () => {
    const n = openItems().filter(i => i.pri === 'high').length, a = document.querySelector('.nav[data-v="recos"]'); if (!a) return;
    let b = a.querySelector('.nb'); if (!n) { if (b) b.remove(); return; }
    if (!b) { b = el('i', 'nb'); a.appendChild(b); } b.textContent = n; a.setAttribute('aria-label', 'Recos, ' + n + ' high priority');
  };

  const pips = (label, lvl, cls) => `<span class="pips ${cls || ''}" title="${esc(label)}: ${esc(lvl)}"><b>${esc(label)}</b>${[1, 2, 3].map(i => `<i class="${i <= (LV[lvl] || 0) ? 'on' : ''}"></i>`).join('')}</span>`;

  function cardEl(it, afterChange) {
    const r = R(), c = PIL[it.letter] || '#9aa0b4', done = !!st().done[it.id], skipped = !!st().skipped[it.id], inCart = getCart().has(it.id);
    const name = (r.letters[it.letter] || {}).name || it.letter;
    const b = el('article', 'card rc' + (done ? ' is-done' : '') + (skipped ? ' is-skip' : '')); b.style.setProperty('--c', c); b.dataset.id = it.id;
    b.innerHTML = `<div class="rc-top"><span class="rc-ic">${safeSvg(it.svg)}</span><div class="rc-meta"><span class="rc-pil">${esc(name)}</span>${it.rank ? `<span class="rc-rank num">#${esc(it.rank)}</span>` : ''}</div></div>
      <h3>${esc(it.title)}</h3><p class="rc-b">${esc(it.benefit)}</p>
      <div class="rc-do"><span class="label">What I can do</span><p>${esc(it.action)}</p></div>
      <div class="rc-chips">${pips('Effort', it.effort)}${it.pri ? `<span class="pill ${it.pri === 'high' ? 'warn' : ''}">${esc(it.pri)} priority</span>` : ''}${it.saves ? pips('Token savings', it.saves, 'good') : ''}</div>
      ${(it.touches || []).length ? `<div class="chips">${it.touches.map(t => `<span class="tag mono">${esc(t)}</span>`).join('')}</div>` : ''}
      <details class="rc-src"><summary>Evidence</summary><p>${esc(it.source || 'No source recorded.')}</p>${it.savesNote ? `<p class="muted">${esc(it.savesNote)}</p>` : ''}</details>
      <div class="rc-act"></div>`;
    const act = b.querySelector('.rc-act'), det = b.querySelector('.rc-src');
    if (srcOpen.has(it.id)) det.open = true; det.addEventListener('toggle', () => { det.open ? srcOpen.add(it.id) : srcOpen.delete(it.id); });
    // one request per card at a time, so a quick Done then Skip can never leave a reco in both states
    const guard = fn => async () => { if (busy.has(it.id)) return; busy.add(it.id); b.classList.add('busy'); try { await fn(); } finally { busy.delete(it.id); b.classList.remove('busy'); } };
    const btn = (label, cls, fn, title) => { const x = el('button', 'btn sm ' + (cls || ''), label); if (title) x.title = title; x.onclick = guard(fn); act.appendChild(x); return x; };
    if (done || skipped) {
      btn(done ? 'Done · undo' : 'Skipped · undo', '', async () => { try { const s = done ? await mark('/api/recos/done', { id: it.id, on: false }) : await mark('/api/recos/skip', { id: it.id, undo: true }); r.state = s; afterChange(); } catch (e) { toast(e.message, 'var(--bad)'); } });
    } else {
      btn(inCart ? '✓ In cart' : 'Add to cart', inCart ? 'primary' : '', () => { const s = getCart(); s.has(it.id) ? s.delete(it.id) : s.add(it.id); setCart(s); afterChange(); });
      btn('Done', '', async () => { try { r.state = await mark('/api/recos/done', { id: it.id, on: true }); const s = getCart(); s.delete(it.id); setCart(s); toast('Marked done'); afterChange(); } catch (e) { toast(e.message, 'var(--bad)'); } }, 'Mark this as handled');
      btn('Skip', 'ghost', async () => { try { r.state = await mark('/api/recos/skip', { id: it.id }); const s = getCart(); s.delete(it.id); setCart(s); toast('Skipped. It stays hidden after a refresh.'); afterChange(); } catch (e) { toast(e.message, 'var(--bad)'); } }, 'Hide it for good');
    }
    return b;
  }

  /* ---- cart tray: one prompt you paste into Claude ---- */
  function cartPrompt() {
    const r = R(), ids = [...getCart()], items = ids.map(id => r.items.find(i => i.id === id)).filter(Boolean);
    return `From RUBRIC Recos in my Command Center, do these ${items.length} recos (my picks). For each one: confirm the evidence first, make the change, then tell me exactly what changed. Ask me before anything that deletes, disconnects or sends.\n\n` +
      items.map((i, n) => `${n + 1}. [${(r.letters[i.letter] || {}).name}] ${i.title}\n   Why: ${i.benefit}\n   Do: ${i.action}\n   Touches: ${(i.touches || []).join(', ') || 'n/a'}\n   Evidence: ${i.source || 'n/a'}`).join('\n\n') +
      `\n\nWhen finished, tell me which ids to mark done: ${items.map(i => i.id).join(', ')}.`;
  }
  let tray = null;
  function renderTray() {
    if (!tray) { tray = el('div', 'cart-tray'); tray.setAttribute('role', 'region'); tray.setAttribute('aria-label', 'Recos cart'); document.body.appendChild(tray); }
    const r = R(), n = r ? [...getCart()].filter(id => r.items.some(i => i.id === id)).length : 0;
    const on = n > 0 && X.S.view === 'recos'; tray.classList.toggle('on', on);
    if (!on) return;
    tray.innerHTML = `<span class="ct-n num">${n}</span><span>in cart</span><button class="btn sm primary" id="ct-copy">Copy prompt for Claude</button><button class="btn sm ghost" id="ct-clear">Clear</button>`;
    tray.querySelector('#ct-copy').onclick = async () => { await copy(cartPrompt()); toast('Copied. Paste it into Claude; it asks before anything destructive.'); };
    tray.querySelector('#ct-clear').onclick = () => { setCart(new Set()); redraw(); };
  }
  let redraw = () => { };

  /* ---- the view ---- */
  S.views.recos = {
    render(root) {
      root.innerHTML = ''; const r = R();
      if (!r) {
        const c = el('section', 'card empty-card');
        c.innerHTML = `<div class="ec-ic">${svg('reco')}</div><h3>No recos yet</h3><p class="muted">Recos are ways to make your setup better, from your own logs, skills and memory. Run <span class="mono" style="color:var(--accent2)">/recos</span> in Claude once and they appear here.</p><button class="btn sm primary" id="rc-copy">Copy /recos</button>`;
        c.querySelector('#rc-copy').onclick = async () => { await copy('/recos'); toast('Copied /recos'); }; root.appendChild(c); return;
      }
            const g = el('div', 'grid g12'); root.appendChild(g);
      const head = el('section', 'card c12 rc-head'), body = el('div', 'c12 rc-body');
      g.appendChild(head); g.appendChild(body);
      const draw = () => {
        const open = openItems(), nDone = Object.keys(st().done).filter(i => r.items.some(x => x.id === i)).length, nSkip = Object.keys(st().skipped).filter(i => r.items.some(x => x.id === i)).length;
        const letters = Object.keys(r.letters), cnt = L => open.filter(i => i.letter === L).length;
        const sv = { high: 0, mid: 0, low: 0 }; open.forEach(i => { if (i.saves) sv[i.saves]++; });
        const d = r.delta;
        head.innerHTML = `<div class="card-h"><h3>${svg('reco')}Recos</h3><span class="chip">built ${esc(r.built || 'unknown')}</span></div>
          <div class="rc-stats"><div class="stat"><b class="num">${open.length}</b><span>Open</span></div><div class="stat"><b class="num">${open.filter(i => i.pri === 'high').length}</b><span>High priority</span></div><div class="stat"><b class="num">${nDone}</b><span>Done</span></div><div class="stat"><b class="num">${nSkip}</b><span>Skipped</span></div>
          <div class="rc-sv"><span class="label">Token savings on the table</span><div class="rc-svrow">${['high', 'mid', 'low'].map(k => `<span class="pill ${k === 'high' ? 'good' : ''}"><b class="num">${sv[k]}</b> ${k}</span>`).join('')}</div></div></div>
          <div class="rc-bar"><div class="seg" role="tablist" aria-label="Filter by pillar"><button role="tab" aria-selected="${filt === 'ALL'}" class="${filt === 'ALL' ? 'on' : ''}" data-f="ALL">All ${open.length}</button>${letters.map(L => `<button role="tab" aria-selected="${filt === L}" class="${filt === L ? 'on' : ''}" data-f="${esc(L)}" style="--c:${PIL[L]}"><i class="sw"></i>${esc(r.letters[L].name)} ${cnt(L)}</button>`).join('')}</div>
          ${d ? `<span class="chip" title="Compared with the snapshot from ${esc(new Date(d.since).toLocaleDateString())}">↑ ${d.added.length} new · ✓ ${d.resolved.length} resolved since ${esc(new Date(d.since).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</span>` : `<span class="chip">first snapshot taken, changes show from next week</span>`}
          <span class="rc-sp"></span><button class="btn sm" id="rc-run" title="Copies /recos to paste into Claude">${svg('copy')}Refresh with /recos</button><button class="btn sm ghost" id="rc-app">Standalone app ↗</button></div>`;
        head.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { filt = b.dataset.f; draw(); });
        head.querySelector('#rc-run').onclick = async () => { await copy('/recos'); toast('Copied /recos. A Friday routine also refreshes this weekly.'); };
        head.querySelector('#rc-app').onclick = async () => { try { const j = await mark('/api/micro/start', { id: 'rubric-recos' }); window.open(j.url, '_blank', 'noopener'); } catch (e) { toast(e.message, 'var(--bad)'); } };
        body.innerHTML = '';
        const show = open.filter(i => filt === 'ALL' || i.letter === filt);
        const pri = show.filter(i => i.pri === 'high').sort((a, b) => (a.rank || 99) - (b.rank || 99)), rest = show.filter(i => i.pri !== 'high');
        const sect = (title, items, big) => { if (!items.length) return; body.appendChild(el('div', 'rc-sec', `<span class="label">${esc(title)}</span><span class="muted num">${items.length}</span>`)); const grid = el('div', 'rc-grid' + (big ? ' wide' : '')); items.forEach(i => grid.appendChild(cardEl(i, afterChange))); body.appendChild(grid); };
        sect('Priority', pri, true); sect(pri.length ? 'More' : 'Recos', rest, false);
        if (!show.length) body.appendChild(el('div', 'empty', open.length ? 'Nothing in this pillar.' : 'All handled. Run /recos for a fresh look.'));
        const hid = r.items.filter(i => !isOpen(i) && (filt === 'ALL' || i.letter === filt));
        if (hid.length) {
          const t = el('button', 'btn sm ghost rc-toggle', (hidden ? 'Hide' : 'Show') + ' done and skipped (' + hid.length + ')'); t.onclick = () => { hidden = !hidden; draw(); }; body.appendChild(t);
          if (hidden) { const grid = el('div', 'rc-grid'); hid.forEach(i => grid.appendChild(cardEl(i, afterChange))); body.appendChild(grid); }
        }
        X.actionable(root); renderTray();
      };
      const afterChange = () => {
        X.badges(); const stg = document.querySelector('#stage'), y = stg.scrollTop, a = document.activeElement, host = a && a.closest && a.closest('.rc-act');
        const keep = host ? { id: host.closest('.rc').dataset.id, i: [...host.children].indexOf(a) } : null;
        draw(); stg.scrollTop = y; if (S.views.home) S.dirty.add('home');
        if (keep) {
          const c = document.querySelector('.rc[data-id="' + keep.id + '"]');
          if (c) { const bs = c.querySelectorAll('.rc-act .btn'), t = bs[Math.min(keep.i, bs.length - 1)] || bs[0]; if (t) t.focus({ preventScroll: true }); }
          else { head.setAttribute('tabindex', '-1'); head.focus({ preventScroll: true }); }   // the card left the list: park focus on the header, never on a different card's button
        }
      };
      redraw = draw; draw();
    },
    sticky: true, refresh() { redraw(); },
    enter() {
      renderTray(); const id = store.get('focusReco', null); if (!id) return; store.set('focusReco', null);
      setTimeout(() => { const c = document.querySelector('.rc[data-id="' + id + '"]'); if (c) { c.scrollIntoView({ block: 'center', behavior: 'smooth' }); c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 1500); } }, 120);
    }, leave() { if (tray) tray.classList.remove('on'); },
  };

  /* ---- Today: the one list that says what deserves you now ---- */
  X.todayCard = function () {
    const U = S.U, X2 = S.X, OS = S.OS, bud = store.get('budget', { h5: 0, d7: 0 }), c = U && U.sessions && U.sessions[0], items = [];
    if (c && c.ctx > 800000) items.push({ score: 95, kind: 'cache', title: 'This chat is near its 1M limit', text: `${fmt(c.ctx)} tokens are re-read on every reply. Start a fresh chat from a short handoff note.`, evidence: 'session logs', go: () => go('usage') });
    if (U && bud.h5 && U.windows.h5.usd > bud.h5 * 0.9) items.push({ score: 90, kind: 'cost', title: '5-hour spend is at ' + Math.round(U.windows.h5.usd / bud.h5 * 100) + '% of your limit', text: `${money(U.windows.h5.usd)} of ${money(bud.h5)} (API-equivalent).`, evidence: 'budget in Usage', go: () => go('usage') });
    if (U && bud.d7 && U.windows.d7.usd > bud.d7 * 0.9) items.push({ score: 88, kind: 'cost', title: '7-day spend is at ' + Math.round(U.windows.d7.usd / bud.d7 * 100) + '% of your limit', text: `${money(U.windows.d7.usd)} of ${money(bud.d7)} (API-equivalent).`, evidence: 'budget in Usage', go: () => go('usage') });
    const W = { cache: 30, cost: 50, skill: 45, backlog: 40, routine: 30 }, GO = { cost: 'usage', cache: 'usage', skill: 'usage', routine: 'routines', backlog: 'memory' };
    for (const s of (X2 ? X2.suggestions : [])) items.push({ ...s, score: W[s.kind] || 25, go: () => go(GO[s.kind] || 'home') });
    openItems().filter(i => i.pri === 'high').forEach(i => items.push({ score: 66 - (i.rank || 5) * 2, kind: 'reco', title: i.title, text: i.benefit.split('. ')[0] + '.', evidence: i.source, go: () => { store.set('focusReco', i.id); go('recos'); } }));
    for (const s of OS.next.slice(0, 3)) items.push({ ...s, score: 20, go: () => s.path ? X.reveal(s.path) : go('timeline') });
    items.sort((a, b) => b.score - a.score);
    const sec = el('section', 'card today'), top = items.slice(0, 6);
    sec.innerHTML = `<div class="card-h"><h3>${svg('start')}Today</h3><span class="chip">${items.length} to look at</span></div><div class="td-list"></div>`;
    const list = sec.querySelector('.td-list');
    top.forEach(s => {
      const sev = s.score >= 80 ? 'bad' : s.score >= 55 ? 'warn' : 'ok';
      const b = el('button', 'td-row', `<i class="dot ${sev === 'bad' ? 'bad' : sev === 'warn' ? 'warn' : ''}"></i><div style="min-width:0"><b>${esc(s.title)}</b><span>${esc(s.text)}</span></div><span class="td-go" aria-hidden="true">${svg('start')}</span>`);
      b.title = 'Evidence: ' + (s.evidence || ''); b.onclick = s.go; list.appendChild(b);
    });
    if (!top.length) list.innerHTML = '<div class="empty">All clear. Nothing needs you.</div>';
    return sec;
  };
  ['skills', 'artifacts', 'timeline'].forEach(k => { if (S.views[k]) S.views[k].sticky = true; });   // they hold filters: never rebuilt under you
  X.boot();
})();
