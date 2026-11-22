/* os-views.js - the eight views of Brain OS v2 and the file-sphere. Data comes from os-core.js. */
'use strict';
(() => {
  const X = window.OSX, { $, el, esc, fmt, money, bytes, ago, dur, svg, S, api, post, store, deptBy, toast, tip, copy, reveal, openFile, show, hideAll, openRun, go } = X;
  const MCP_LABEL = { '8f9d050c': 'Google Calendar', '0adc9bc9': 'Gmail', '708797a3': 'TinyFish', '4f922ccb': 'Google Docs', '71fbfe99': 'Google Sheets', '06bcd69b': 'Google Slides', '0552ea5e': 'Google Drive', '1a59c906': 'Claude Docs', '6f616b42': 'Visualize', 'claude-in-chrome': 'Claude in Chrome', 'computer-use': 'Computer use', 'Claude_Browser': 'Built-in browser', 'ccd_turn': 'Desktop: task list', 'ccd_session': 'Desktop: sessions', 'ccd_view': 'Desktop: view', 'terminal': 'Terminal', 'scheduled-tasks': 'Scheduled tasks', 'mcp-registry': 'Connector registry' };
  const mcpLabel = k => MCP_LABEL[k] || MCP_LABEL[String(k).slice(0, 8)] || k;
  const APP_SERVER = { 'app:gmail-connector': '0adc9bc9', 'app:gcal': '8f9d050c', 'app:gdrive': '0552ea5e', 'app:gdocs': '4f922ccb', 'app:gsheets': '71fbfe99', 'app:gslides': '06bcd69b', 'app:tinyfish': '708797a3', 'app:chrome': 'claude-in-chrome' };
  const dayKey = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const usageOfSkill = s => (S.U && S.U.skills.find(u => u.name === s.name || u.name === s.dir)) || null;
  const mcpCalls = (U, key, days) => { const cut = dayKey(Date.now() - days * 864e5); let n = 0, last = 0; if (U && U.mcp) for (const [k, m] of Object.entries(U.mcp)) { if (k !== key && !k.startsWith(key + '-')) continue; for (const [d, c] of Object.entries(m.days)) if (d >= cut) n += c; if (m.last > last) last = m.last; } return { n, last }; };
  const register = (name, v) => { S.views[name] = v; };
  const cachePct = w => (w && w.tok && w.fresh != null ? Math.round(100 * (1 - w.fresh / w.tok)) + '% re-reads of cached context' : '');
  const empty = (t) => `<div class="empty">${t}</div>`;

  /* ---------- charts ---------- */
  function gauge(pct, big, small, color, size = 124) {
    const r = 52, C = 2 * Math.PI * r, p = Math.max(0, Math.min(1, pct || 0));
    return `<div class="gauge" style="width:${size}px;height:${size}px"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="${r}"/><circle class="fg" cx="60" cy="60" r="${r}" stroke="${color}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - p)).toFixed(1)}"/></svg><div class="mid"><b class="num">${big}</b><span>${small}</span></div></div>`;
  }
  function areaChart(rows, color) {
    const W = innerWidth < 860 ? 380 : 640, H = 190, pl = 36, pr = 8, pt = 10, pb = 22, n = rows.length;
    const max = Math.max(0.01, ...rows.map(r => r.v)) * 1.12, x = i => pl + (n <= 1 ? 0 : i / (n - 1)) * (W - pl - pr), y = v => pt + (1 - v / max) * (H - pt - pb);
    const pts = rows.map((r, i) => [x(i), y(r.v)]);
    let d = ''; pts.forEach((p, i) => { if (!i) d = `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`; else { const q = pts[i - 1], cx = (q[0] + p[0]) / 2; d += ` C${cx.toFixed(1)} ${q[1].toFixed(1)} ${cx.toFixed(1)} ${p[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`; } });
    const gl = [0, .5, 1].map(f => { const yy = pt + f * (H - pt - pb); return `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}"/><text class="ax" x="${pl - 6}" y="${yy + 3}" text-anchor="end">${money(max * (1 - f))}</text>`; }).join('');
    const lab = rows.map((r, i) => i % Math.ceil(n / 6) === 0 ? `<text class="ax" x="${x(i)}" y="${H - 5}" text-anchor="middle">${esc(r.label)}</text>` : '').join('');
    const pk = rows.reduce((b, r, i) => r.v > rows[b].v ? i : b, 0), ppx = x(pk), ppy = y(rows[pk].v), anc = ppx > W * 0.72 ? 'end' : ppx < W * 0.2 ? 'start' : 'middle';
    const note = rows[pk].v > 0 ? `<circle cx="${ppx.toFixed(1)}" cy="${ppy.toFixed(1)}" r="4" fill="${color}" stroke="#07080b" stroke-width="2"/><text class="an" x="${ppx.toFixed(1)}" y="${Math.max(11, ppy - 11).toFixed(1)}" text-anchor="${anc}">${money(rows[pk].v)} peak · ${esc(rows[pk].label)}</text>` : '';
    const id = 'g' + Math.random().toString(36).slice(2, 7);
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" data-n="${n}" data-pl="${pl}" data-pr="${pr}" data-w="${W}"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".38"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>${gl}<path d="${d} L${x(n - 1).toFixed(1)} ${H - pb} L${x(0).toFixed(1)} ${H - pb}Z" fill="url(#${id})"/><path class="draw" pathLength="1" d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>${note}<line class="mk" y1="${pt}" y2="${H - pb}" stroke="${color}" stroke-opacity=".5" stroke-dasharray="3 4" style="display:none"/><circle class="mc" r="4.5" fill="${color}" stroke="#07080b" stroke-width="2" style="display:none"/>${lab}</svg>`;
  }
  function wireArea(root, rows, fmtTip, color) {
    const svgEl = root.querySelector('svg.chart'); if (!svgEl) return;
    const n = rows.length, pl = +svgEl.dataset.pl, pr = +svgEl.dataset.pr, W = +svgEl.dataset.w, mk = svgEl.querySelector('.mk'), mc = svgEl.querySelector('.mc');
    const max = Math.max(0.01, ...rows.map(r => r.v)) * 1.12, H = 190, pt = 10, pb = 22;
    svgEl.addEventListener('mousemove', e => {
      const b = svgEl.getBoundingClientRect(), vx = (e.clientX - b.left) / b.width * W;
      const i = Math.max(0, Math.min(n - 1, Math.round((vx - pl) / (W - pl - pr) * (n - 1))));
      const xx = pl + (n <= 1 ? 0 : i / (n - 1)) * (W - pl - pr), yy = pt + (1 - rows[i].v / max) * (H - pt - pb);
      mk.setAttribute('x1', xx); mk.setAttribute('x2', xx); mk.style.display = ''; mc.setAttribute('cx', xx); mc.setAttribute('cy', yy); mc.style.display = '';
      tip(e, fmtTip(rows[i]));
    });
    svgEl.addEventListener('mouseleave', () => { mk.style.display = 'none'; mc.style.display = 'none'; tip(); });
  }
  function spark(vals, color) {
    const W = 200, H = 34, max = Math.max(1, ...vals), step = W / Math.max(1, vals.length - 1);
    const pts = vals.map((v, i) => [i * step, H - 3 - (v / max) * (H - 8)]);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' '), id = 's' + Math.random().toString(36).slice(2, 7);
    return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".35"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs><path d="${d} L${W} ${H} L0 ${H}Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.8" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>`;
  }
  function bars(rows, color) {
    const max = Math.max(1e-9, ...rows.map(r => r.v));
    return `<div class="bars">${rows.map(r => `<div class="bar-row"><span title="${esc(r.name)}" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.label || r.name)}</span><div class="tr"><i style="width:${Math.max(2, r.v / max * 100).toFixed(1)}%;--c:${r.color || color || 'var(--accent)'}"></i></div><span class="v">${esc(r.text)}</span></div>`).join('')}</div>`;
  }
  function drawHeat(cv, cells, cols, rows, color, label) {
    const DPR = Math.min(2, devicePixelRatio || 1), w = cv.clientWidth || 600, gap = 2, cw = (w - gap * (cols - 1)) / cols, ch = Math.min(cw, 13), h = rows * ch + (rows - 1) * gap;
    cv.width = w * DPR; cv.height = h * DPR; cv.style.height = h + 'px';
    const c = cv.getContext('2d'); c.setTransform(DPR, 0, 0, DPR, 0, 0);
    const max = Math.max(1, ...cells.map(x => x.v));
    for (const k of cells) {
      const a = k.v ? 0.16 + 0.84 * Math.sqrt(k.v / max) : 0.045;
      c.fillStyle = k.v ? `rgba(${color},${a.toFixed(3)})` : 'rgba(255,255,255,.045)';
      c.beginPath(); c.roundRect ? c.roundRect(k.c * (cw + gap), k.r * (ch + gap), cw, ch, 3) : c.rect(k.c * (cw + gap), k.r * (ch + gap), cw, ch); c.fill();
    }
    cv.onmousemove = e => { const b = cv.getBoundingClientRect(), c2 = Math.floor((e.clientX - b.left) / (cw + gap)), r2 = Math.floor((e.clientY - b.top) / (ch + gap)); const k = cells.find(z => z.c === c2 && z.r === r2); tip(e, k ? label(k) : ''); };
    cv.onmouseleave = () => tip();
  }

  /* ---------- shared pieces ---------- */
  function skillCard(s) {
    const u = usageOfSkill(s), c = el('div', 'skill');
    c.innerHTML = `<div class="meta"><span>${s.family === 'video' ? 'Video' : s.scope === 'global' ? 'Global' : 'Hub'}</span><span>${u ? u.runs + ' run' + (u.runs > 1 ? 's' : '') : 'not run yet'}</span></div><div class="nm" title="/${esc(s.name)}">/${esc(s.name)}</div><p>${esc(s.desc || 'No description.')}</p>
      <div class="foot"><button class="icon-btn run" aria-label="Run ${esc(s.name)}">${svg('play')}</button><button class="icon-btn" aria-label="Open ${esc(s.name)}">${svg('file')}</button><span class="usage num">${u ? money(u.usd) + ' · ' + ago(u.last) : ''}</span></div>`;
    const [run, open] = c.querySelectorAll('button'); run.onclick = () => openRun(s); open.onclick = () => reveal(s.path);
    return c;
  }
  function captureCard() {
    const c = el('div', 'card'); c.innerHTML = `<div class="card-h"><h3>${svg('memory')}Capture to memory</h3><kbd>C</kbd></div><textarea class="cap-text" rows="3" placeholder="A decision, a price, a person, an idea… saved as one fact."></textarea>
      <div style="display:flex;gap:8px;margin-top:10px;align-items:center"><div class="seg cap-type" style="flex:1"><button data-v="project" class="on">Project</button><button data-v="user">Me</button><button data-v="feedback">Rule</button><button data-v="reference">Link</button></div><button class="btn sm primary cap-save">Save</button></div>`;
    let type = 'project';
    c.querySelector('.cap-type').onclick = e => { const b = e.target.closest('button'); if (!b) return; type = b.dataset.v; c.querySelectorAll('.cap-type button').forEach(x => x.classList.toggle('on', x === b)); };
    const save = async () => { const t = c.querySelector('.cap-text'), fact = t.value.trim(); if (!fact) { t.focus(); return; } try { const r = await post('/api/capture', { fact, type }); t.value = ''; toast('Saved to memory · ' + r.file); X.loadAll(true); } catch (e) { toast(e.message, 'var(--bad)'); } };
    c.querySelector('.cap-save').onclick = save; c.querySelector('.cap-text').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save(); });
    return c;
  }
  const sugRow = (s, onClick) => { const b = el('button', 'sig k-' + s.kind, `<span class="ic">${svg(s.kind)}</span><div style="min-width:0"><b>${esc(s.title)}</b><span>${esc(s.text)}</span></div>`); b.title = 'Evidence: ' + (s.evidence || ''); b.onclick = onClick; return b; };
  const sugGo = k => ({ cost: 'usage', cache: 'usage', skill: 'usage', routine: 'routines', backlog: 'memory' }[k] || 'home');

  /* ---------- department drawer ---------- */
  function openDrawer(key) {
    const OS = S.OS, d = OS.departments.find(x => x.key === key); if (!d) return; const maxF = Math.max(1, ...d.projects.map(p => p.files));
    $('#dr-h').innerHTML = `<span class="dept-ic" style="--c:${d.color};width:42px;height:42px">${svg(d.icon)}</span><div style="flex:1"><div class="label">Department</div><h3 style="font:700 20px var(--sans);letter-spacing:-.02em;margin-top:4px">${esc(d.label)}</h3></div><button class="icon-btn" data-close aria-label="Close">✕</button>`;
    $('#dr-b').innerHTML = `<div class="kpis" style="grid-template-columns:repeat(3,1fr);border:1px solid var(--line);border-radius:14px;margin-bottom:18px"><div class="kpi"><b class="num">${fmt(d.files)}</b><span>Files</span></div><div class="kpi"><b class="num">${d.week}</b><span>This week</span></div><div class="kpi"><b>${esc(d.last ? ago(d.last) : '—')}</b><span>Last touch</span></div></div>
      ${spark(d.spark, d.color)}<div style="display:flex;justify-content:space-between;color:var(--faint);font:500 11px var(--mono);margin:-4px 0 18px"><span>12 WEEKS AGO</span><span>THIS WEEK</span></div>
      <div class="label" style="margin-bottom:10px">Projects</div>
      ${d.projects.length ? d.projects.map(p => `<div class="proj" style="--c:${d.color}"><span class="dept-ic" style="--c:${d.color};width:30px;height:30px">${svg('folder')}</span><div class="pn"><b>${esc(p.name)}</b><span>${p.files ? fmt(p.files) + ' files · ' + bytes(p.bytes) + ' · ' + ago(p.last) : 'empty · ready to start'}</span><div class="bar"><i style="width:${(p.files / maxF * 100).toFixed(1)}%"></i></div></div><button class="btn sm" data-reveal="${esc(p.path)}">Open</button></div>`).join('') : empty('No project folders yet.')}
      <div class="label" style="margin:20px 0 10px">Recently touched</div>
      ${d.recent.length ? d.recent.map(f => `<div class="row" data-reveal="${esc(f.path)}"><span class="ic" style="color:${d.color}">${svg('file')}</span><div class="tx"><b>${esc(f.name)}</b><span>${esc(f.path)}</span></div><time>${ago(f.mtime)}</time></div>`).join('') : empty('Nothing in the last 30 days.')}`;
    $('#dr-b').querySelectorAll('[data-reveal]').forEach(b => b.onclick = () => reveal(b.dataset.reveal));
    show('#drawer'); if (S.views.home.focus) S.views.home.focus(key, true);
  }
  S.openDrawer = openDrawer;

  /* ---------- sphere ---------- */
  const Sphere = (() => {
    let host = null, cv, ctx, podsEl, W = 0, H = 0, DPR = 1, N = 0, X0, Y0, Z0, ranges = [], cols = [], centers = {}, order = [], halo = null;
    let rotY = 0.6, rotX = -0.3, vY = 0.0022, spinning = true, running = false, raf = 0, focusKey = null, q = 1, ema = 8, fr = 0, drag = null, last = 0, visible = true, nSkills = 0, t = 0;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; if (reduce) spinning = false;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
    const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
    cv = document.createElement('canvas'); ctx = cv.getContext('2d', { alpha: true }); podsEl = el('div', 'pods');
    let SX, SY, SB;
    function resize() { if (!host) return; const r = host.getBoundingClientRect(); if (r.width < 10 || r.height < 10) return; DPR = Math.min(1.75, devicePixelRatio || 1); W = r.width; H = r.height; cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); ctx.setTransform(DPR, 0, 0, DPR, 0, 0); halo = null; }
    new ResizeObserver(resize).observe(document.documentElement);
    // one shared observer: re-renders create a new host, and a stale observer must never override the live one
    const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting; sync(); });
    function mount(h) { host = h; host.innerHTML = ''; host.append(cv, podsEl); resize(); bind(); io.disconnect(); visible = true; io.observe(host); sync(); }
    function load(OS) {
      seed = 7; const ds = OS.departments, n = ds.length, GA = Math.PI * (3 - Math.sqrt(5)), total = ds.reduce((s, d) => s + d.files, 0) || 1, CAP = 3600;
      const xs = [], ys = [], zs = []; ranges = []; cols = []; centers = {};
      ds.forEach((d, i) => {
        const y = 1 - (i + 0.5) / n * 2, rr = Math.sqrt(1 - y * y), th = i * GA + 0.4, c = norm([Math.cos(th) * rr, y * 0.82, Math.sin(th) * rr]); centers[d.key] = c;
        const count = d.files ? Math.max(90, Math.round(CAP * Math.sqrt(d.files / total) * 0.58)) : 30, spread = 0.2 + Math.min(0.42, Math.sqrt(count) / 62), start = xs.length;
        for (let k = 0; k < count; k++) { const p = norm([c[0] + gauss() * spread, c[1] + gauss() * spread, c[2] + gauss() * spread]), rad = 1 + (rnd() - 0.5) * 0.05; xs.push(p[0] * rad); ys.push(p[1] * rad); zs.push(p[2] * rad); }
        ranges.push([start, xs.length, d.key, !d.files]); const [r, g, b] = hexRgb(d.color); cols.push([0, 1, 2].map(bk => `rgba(${r},${g},${b},${[0.2, 0.52, 0.95][bk] * (d.files ? 1 : 0.5)})`));
      });
      N = xs.length; X0 = Float32Array.from(xs); Y0 = Float32Array.from(ys); Z0 = Float32Array.from(zs); SX = new Float32Array(N); SY = new Float32Array(N); SB = new Uint8Array(N);
      nSkills = OS.skills.length; order = ds.map(d => d.key);
      podsEl.innerHTML = '';
      for (const d of ds) { const p = el('button', 'pod', `<i></i>${esc(d.label)}<small class="num">${fmt(d.files)}</small>`); p.style.setProperty('--c', d.color); p.dataset.k = d.key; p.onmouseenter = () => focus(d.key); p.onmouseleave = () => focus(null); p.onclick = e => { e.stopPropagation(); openDrawer(d.key); }; podsEl.appendChild(p); }
    }
    function focus(k, lock) { if (lock !== undefined) focus._lock = !!k && lock; if (focus._lock && !lock) return; focusKey = k; podsEl.querySelectorAll('.pod').forEach(p => p.classList.toggle('on', p.dataset.k === k)); }
    function bind() {
      if (host._b) return; host._b = 1;
      host.addEventListener('pointerdown', e => { if (e.target.closest('.pod,.btn')) return; drag = { x: e.clientX, y: e.clientY }; host.setPointerCapture(e.pointerId); });
      host.addEventListener('pointermove', e => { if (!drag) return; rotY += (e.clientX - drag.x) * 0.006; rotX = Math.max(-1.1, Math.min(1.1, rotX + (e.clientY - drag.y) * 0.006)); vY = (e.clientX - drag.x) * 0.003; drag = { x: e.clientX, y: e.clientY }; });
      host.addEventListener('pointerup', () => { drag = null; });
      host.addEventListener('dblclick', e => { if (!e.target.closest('.pod')) location.href = '/brain'; });
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(50, now - last); last = now; t += dt * 0.001;
      ema += (dt - ema) * 0.05; if (++fr % 45 === 0) { if (ema > 15) q = Math.max(0.25, q * 0.82); else if (ema < 9 && q < 1) q = Math.min(1, q * 1.08); }
      if (!drag) { if (spinning) rotY += vY * dt / 16; vY += ((spinning ? 0.0022 : 0) - vY) * 0.03; }
      draw();
    }
    function draw() {
      if (!W || !N) return;
      const R = Math.min(W * 0.34, H * 0.36), cx = W / 2, cy = H / 2 + 22, cyw = Math.cos(rotY), syw = Math.sin(rotY), cxw = Math.cos(rotX), sxw = Math.sin(rotX);
      ctx.clearRect(0, 0, W, H);
      if (!halo) { halo = document.createElement('canvas'); const hs = Math.ceil(R * 3.4); halo.width = halo.height = hs; const hc = halo.getContext('2d'), g = hc.createRadialGradient(hs / 2, hs / 2, R * 0.15, hs / 2, hs / 2, hs / 2); g.addColorStop(0, 'rgba(255,140,70,.16)'); g.addColorStop(0.45, 'rgba(120,90,255,.055)'); g.addColorStop(1, 'rgba(0,0,0,0)'); hc.fillStyle = g; hc.fillRect(0, 0, hs, hs); }
      ctx.drawImage(halo, cx - halo.width / 2, cy - halo.height / 2);
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(170,185,225,.055)';
      for (let k = -2; k <= 2; k++) { const yy = k / 3, rr = Math.sqrt(1 - yy * yy); ctx.beginPath(); ctx.ellipse(cx, cy - yy * cxw * R, rr * R, Math.abs(rr * sxw) * R + 0.0001, 0, 0, 7); ctx.stroke(); }
      const act = ranges.map(r => r[0] + Math.floor((r[1] - r[0]) * q));
      for (let g = 0; g < ranges.length; g++) {
        const [s0] = ranges[g], e0 = act[g];
        for (let i = s0; i < e0; i++) {
          const x1 = X0[i] * cyw + Z0[i] * syw, z1 = -X0[i] * syw + Z0[i] * cyw, y2 = Y0[i] * cxw - z1 * sxw, z2 = Y0[i] * sxw + z1 * cxw;
          SX[i] = cx + x1 * R; SY[i] = cy - y2 * R; SB[i] = z2 > 0.25 ? 2 : z2 > -0.25 ? 1 : 0;
        }
      }
      const dim = focusKey ? 0.2 : 1;
      for (let b = 0; b < 3; b++) {
        const sz = b === 2 ? 2.3 : b === 1 ? 1.7 : 1.2;
        for (let g = 0; g < ranges.length; g++) {
          const [s0, , key] = ranges[g], e0 = act[g], f = focusKey ? (key === focusKey ? 1 : dim) : 1; ctx.globalAlpha = f; ctx.fillStyle = cols[g][b];
          const s = key === focusKey ? sz * 1.3 : sz;
          for (let i = s0; i < e0; i++) if (SB[i] === b) ctx.fillRect(SX[i] - s / 2, SY[i] - s / 2, s, s);
        }
      }
      ctx.globalAlpha = 1;
      // skills orbit
      const tilt = 0.28; ctx.strokeStyle = 'rgba(255,122,47,.18)'; ctx.setLineDash([2, 6]); ctx.beginPath(); ctx.ellipse(cx, cy, R * 1.28, R * 1.28 * tilt, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#ff7a2f';
      for (let i = 0; i < nSkills; i++) { const a = i / nSkills * Math.PI * 2 + t * 0.12, s = Math.sin(a); ctx.globalAlpha = 0.35 + (s + 1) * 0.3; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * R * 1.28, cy + s * R * 1.28 * tilt, 1.8 + (s + 1) * 1.1, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      // pods follow their continent (transform only, no layout)
      const placed = [];
      podsEl.querySelectorAll('.pod').forEach(p => {
        const c = centers[p.dataset.k]; if (!c) return;
        const x1 = c[0] * cyw + c[2] * syw, z1 = -c[0] * syw + c[2] * cyw, y2 = c[1] * cxw - z1 * sxw, z2 = c[1] * sxw + z1 * cxw;
        let px = cx + x1 * R * 1.1, py = cy - y2 * R * 1.1; const w = p.offsetWidth || 120, h = p.offsetHeight || 30;
        for (let it = 0; it < 5; it++) for (const o of placed) if (Math.abs(px - o[0]) < (w + o[2]) / 2 + 6 && Math.abs(py - o[1]) < (h + o[3]) / 2 + 4) py += (py >= o[1] ? 1 : -1) * 8;
        px = Math.max(w / 2 + 8, Math.min(W - w / 2 - 8, px)); py = Math.max(90 + h / 2, Math.min(H - 44, py)); placed.push([px, py, w, h]);
        p.style.transform = `translate(${px.toFixed(1)}px,${py.toFixed(1)}px) translate(-50%,-50%)`; p.style.opacity = (focusKey === p.dataset.k ? 1 : 0.74 + Math.max(0, z2 + 0.3) * 0.26).toFixed(2); p.style.zIndex = z2 > 0 ? 3 : 2;
      });
    }
    function sync() { const want = running && visible && !document.hidden; if (want && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } else if (!want && raf) { cancelAnimationFrame(raf); raf = 0; } }
    document.addEventListener('visibilitychange', sync);
    return { mount, load, focus, start() { running = true; sync(); }, stop() { running = false; sync(); }, toggle() { spinning = !spinning; return spinning; }, quality: () => +q.toFixed(2) };
  })();

  /* ================= HOME ================= */
  register('home', {
    render(root) {
      const OS = S.OS, U = S.U, X2 = S.X, h = new Date().getHours(), greet = (h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + '.';
      const T = OS.totals;
      root.innerHTML = '';
      const g = el('div', 'grid g12'); root.appendChild(g);
      // hero
      const hero = el('section', 'card hero c8');
      hero.innerHTML = `<div class="hero-top"><div><h2>${esc(greet)}</h2><p>${fmt(T.files)} files across ${OS.departments.length} departments, ${T.projects} projects, ${T.skills} skills. Every dot is a real file.</p></div><div style="display:flex;gap:8px"><button class="btn sm" id="btn-spin">Pause</button><a class="btn sm" href="/brain">Open map →</a></div></div>
        <div class="sphere-wrap"><div class="sphere" id="sphere-host"></div><div class="hint">DRAG TO SPIN · CLICK A DEPARTMENT · DOUBLE-CLICK FOR THE MAP</div></div>
        <div class="kpis">${[[fmt(T.files), 'Files'], [T.projects, 'Projects'], [T.skills, 'Skills'], [T.memory, 'Memories'], [T.week, 'Changed 7d'], [T.streak + 'd', 'Streak']].map(([v, l]) => `<div class="kpi"><b class="num">${esc(v)}</b><span>${l}</span></div>`).join('')}</div>`;
      g.appendChild(hero);
      // right column
      const col = el('div', 'c4'); col.style.cssText = 'display:grid;gap:16px;align-content:start';
      const now = el('section', 'card');
      const bud = store.get('budget', { h5: 0, d7: 0 }), c = U && U.sessions && U.sessions[0];
      now.innerHTML = `<div class="card-h"><h3>${svg('cache')}Right now</h3><span class="chip" id="home-date"></span></div>` + (U ? `<div class="gauges">${gauge(bud.h5 ? U.windows.h5.usd / bud.h5 : 0, money(U.windows.h5.usd), '5 hours', 'var(--accent)', 108)}${gauge(bud.d7 ? U.windows.d7.usd / bud.d7 : 0, money(U.windows.d7.usd), '7 days', '#6aa8ff', 108)}<div style="min-width:130px;flex:1">${c ? `<div class="label" style="margin-bottom:8px">Current chat</div><div class="num" style="font:650 22px var(--sans)">${fmt(c.ctx)}<small class="muted" style="font:500 12px var(--sans)"> / 1M</small></div><div class="meter" style="margin:9px 0"><i style="width:${Math.min(100, c.ctx / 10000).toFixed(1)}%;background:${c.ctx > 800000 ? 'var(--bad)' : c.ctx > 500000 ? 'var(--warn)' : 'var(--good)'}"></i></div><span class="pill ${c.warm ? 'good' : 'warn'}" id="home-cache">${c.warm ? 'cache warm ' + dur(c.coldInMs - (Date.now() - S.fetchedAt)) : 'cache cold'}</span>` : ''}</div></div>${!bud.h5 && !bud.d7 ? `<div class="empty" style="margin-top:10px">Rings fill once you set a budget in <a href="#/usage" style="color:var(--accent2)">Usage</a>.</div>` : ''}` : empty('No session logs found yet.'));
      col.appendChild(now);
      col.prepend(X.todayCard());
      g.appendChild(col);
      // departments
      const dg = el('section', 'c12'); dg.style.cssText = 'display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));grid-column:span 12';
      OS.departments.forEach(d => {
        const b = el('button', 'card dept hover', `<div class="dept-h"><span class="dept-ic">${svg(d.icon)}</span><div style="min-width:0"><h3>${esc(d.label)}</h3><div class="muted" style="font:500 11px var(--mono)">${d.last ? 'touched ' + ago(d.last) : 'not started'}</div></div></div><div class="n num">${fmt(d.files)}<span class="muted" style="font:500 12px var(--sans);margin-left:6px">files</span></div><div class="muted" style="font:500 11px var(--mono)">${d.week} this week · ${bytes(d.bytes)}</div>${spark(d.spark, d.color)}<div class="chips">${d.projects.length ? d.projects.slice(0, 4).map(p => `<span class="tag ${p.files ? '' : 'dash'}">${esc(p.name)}</span>`).join('') : '<span class="tag dash">no projects yet</span>'}</div>`);
        b.style.setProperty('--c', d.color); b.onclick = () => openDrawer(d.key); b.onmouseenter = () => Sphere.focus(d.key); b.onmouseleave = () => Sphere.focus(null); dg.appendChild(b);
      });
      g.appendChild(dg);
      // skills + capture
      const sk = el('section', 'card c8'); sk.innerHTML = `<div class="card-h"><h3>${svg('skills')}Skills deck</h3><a class="btn sm ghost" href="#/skills">All ${OS.skills.length} →</a></div><div class="skills" id="home-skills"></div>`;
      const top = OS.skills.slice().sort((a, b) => ((usageOfSkill(b) || { usd: 0 }).usd) - ((usageOfSkill(a) || { usd: 0 }).usd) || a.name.localeCompare(b.name)).slice(0, 6);
      top.forEach(s => sk.querySelector('#home-skills').appendChild(skillCard(s))); g.appendChild(sk);
      const side = el('div', 'c4'); side.style.cssText = 'display:grid;gap:16px;align-content:start'; side.appendChild(captureCard());
      const inbox = el('section', 'card'); const sn = OS.snapshot;
      inbox.innerHTML = `<div class="card-h"><h3>${svg('mail')}Inbox &amp; calendar</h3><span class="chip">${sn ? 'synced ' + ago(Date.parse(sn.syncedAt)) : 'not synced'}</span></div>` + (sn ? `<div class="big num" style="font-size:34px">${esc(sn.inbox?.unreadLabel || sn.inbox?.unreadEstimate || 0)}<small>unread</small></div>${(sn.inbox?.threads || []).filter(t => t.attention).slice(0, 3).map(t => `<a class="row" href="${esc(t.url)}" target="_blank" rel="noopener"><span class="ic" style="color:var(--bad)">${svg('stale')}</span><div class="tx"><b>${esc(t.from)}</b><span>${esc(t.note || t.subject)}</span></div></a>`).join('')}` : `<div class="empty">Calendar and inbox come from your Google connectors. Run <span class="mono" style="color:var(--accent2)">/sync-os</span> in Claude to fill this.</div><button class="btn sm" id="copy-sync" style="margin-top:8px">Copy /sync-os</button>`);
      side.appendChild(inbox); g.appendChild(side);
      const cs = inbox.querySelector('#copy-sync'); if (cs) cs.onclick = async () => { await copy('/sync-os'); toast('Copied /sync-os'); };
      // hero wiring
      Sphere.mount(hero.querySelector('#sphere-host')); Sphere.load(OS);
      hero.querySelector('#btn-spin').onclick = e => { e.target.textContent = Sphere.toggle() ? 'Pause' : 'Spin'; };
      const dd = new Date(); root.querySelector('#home-date').textContent = dd.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    },
    enter() { Sphere.start(); }, leave() { Sphere.stop(); }, focus: Sphere.focus,
    tick() { const U = S.U, c = U && U.sessions && U.sessions[0], n = $('#home-cache'); if (c && n) { const left = c.coldInMs - (Date.now() - S.fetchedAt); n.textContent = left > 0 ? 'cache warm ' + dur(left) : 'cache cold'; } },
  });

  /* ================= USAGE ================= */
  register('usage', {
    render(root) {
      const U = S.U; root.innerHTML = '';
      if (!U) { root.innerHTML = `<div class="card">${empty('No Claude Code session logs found on this computer, so there is nothing to measure yet.')}</div>`; return; }
      const bud = store.get('budget', { h5: 0, d7: 0 }), g = el('div', 'grid g12'); root.appendChild(g);
      const lim = el('section', 'card c8');
      lim.innerHTML = `<div class="card-h"><h3>${svg('usage')}Spend &amp; limits</h3><span class="chip" title="${esc(U.note)}">API-equivalent, not a bill</span></div>
        <div class="gauges">${gauge(bud.h5 ? U.windows.h5.usd / bud.h5 : 0, money(U.windows.h5.usd), 'last 5h', 'var(--accent)')}${gauge(bud.d7 ? U.windows.d7.usd / bud.d7 : 0, money(U.windows.d7.usd), 'last 7d', '#6aa8ff')}
        <div style="flex:1;min-width:230px;display:grid;gap:14px"><div style="display:flex;gap:28px;flex-wrap:wrap"><div class="stat"><b class="num">${fmt(U.windows.h5.tok)}</b><span>tokens · 5h</span><em class="sub">${cachePct(U.windows.h5)}</em></div><div class="stat"><b class="num">${fmt(U.windows.d7.tok)}</b><span>tokens · 7d</span><em class="sub">${cachePct(U.windows.d7)}</em></div><div class="stat"><b class="num">${fmt(U.windows.d30.calls)}</b><span>model calls · 30d</span></div></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:end"><label style="flex:1;min-width:120px"><div class="label" style="margin-bottom:6px">5h budget $</div><input type="text" inputmode="decimal" id="bud-h5" value="${bud.h5 || ''}" placeholder="e.g. 8"></label><label style="flex:1;min-width:120px"><div class="label" style="margin-bottom:6px">7d budget $</div><input type="text" inputmode="decimal" id="bud-d7" value="${bud.d7 || ''}" placeholder="e.g. 60"></label></div></div></div>`;
      g.appendChild(lim);
      const ctx = el('section', 'card c4'); ctx.innerHTML = `<div class="card-h"><h3>${svg('cache')}Context &amp; cache</h3><span class="chip">${U.sessions.length} recent chats</span></div><div id="ctx-list"></div><div class="muted" style="font-size:12px;margin-top:10px">A chat's prompt cache stays warm about an hour after its last message. Replying to a cold, large chat re-reads everything at full price.</div>`;
      const cl = ctx.querySelector('#ctx-list');
      for (const s of U.sessions.slice(0, 6)) { const left = s.coldInMs - (Date.now() - S.fetchedAt), col = s.ctx > 800000 ? 'var(--bad)' : s.ctx > 500000 ? 'var(--warn)' : 'var(--good)'; cl.insertAdjacentHTML('beforeend', `<div class="ctx-row" data-cold="${s.coldInMs}"><div><div class="nm">${esc(s.id)}</div><div class="faint" style="font:500 11px var(--mono)">${esc(s.model || '')}</div></div><div><div class="meter"><i style="width:${Math.min(100, s.ctx / 10000).toFixed(1)}%;background:${col}"></i></div><div class="faint num" style="font:500 11px var(--mono);margin-top:5px">${fmt(s.ctx)} of 1M · ${money(s.usd)}</div></div><span class="pill ${left > 0 ? 'good' : ''}" data-w>${left > 0 ? 'warm ' + dur(left) : 'cold'}</span></div>`); }
      g.appendChild(ctx);
      // daily spend
      const days = Object.keys(U.dayTotals).sort(), rows = []; const first = days.length ? Math.round((Date.now() - Date.parse(days[0] + 'T12:00:00')) / 864e5) : 6, span = Math.max(5, Math.min(29, first + 2)); for (let i = span; i >= 0; i--) { const k = dayKey(Date.now() - i * 864e5), d = U.dayTotals[k]; rows.push({ k, label: k.slice(5).replace('-', '/'), v: d ? d.usd : 0, tok: d ? d.tok : 0, calls: d ? d.calls : 0 }); }
      const daily = el('section', 'card c8'); daily.innerHTML = `<div class="card-h"><h3>${svg('cost')}Spend by day · ${rows.length} days</h3><span class="chip"><b class="num">${money(U.windows.d30.usd)}</b> total</span></div>${areaChart(rows, '#ff7a2f')}`;
      g.appendChild(daily); wireArea(daily, rows, r => `<b>${r.k}</b><span>${money(r.v)} · ${fmt(r.tok)} tokens · ${r.calls} calls</span>`, '#ff7a2f');
      const mt = Object.entries(U.models).filter(([k]) => k !== 'unknown').sort((a, b) => b[1].usd - a[1].usd), mc = { 'opus-5-5': '#ff7a2f', 'sonnet-5-5': '#6aa8ff', 'haiku-5-5': '#3ddc97' };
      const mod = el('section', 'card c4'); mod.innerHTML = `<div class="card-h"><h3>${svg('brain')}Models</h3></div>${bars(mt.map(([k, v]) => ({ name: k, v: v.usd, text: money(v.usd), color: mc[k] || '#b166ff' })))}<div class="muted" style="font-size:12px;margin-top:12px">${mt.map(([k, v]) => `${esc(k)}: ${fmt(v.tok)} tokens, ${v.calls} calls`).join('<br>')}</div>`; g.appendChild(mod);
      // heat
      const heat = el('section', 'card c6 heat'); heat.innerHTML = `<div class="card-h"><h3>${svg('timeline')}When you work · tokens by hour</h3></div><canvas style="height:358px"></canvas><div style="display:flex;justify-content:space-between;color:var(--faint);font:500 10px var(--mono);margin-top:7px"><span>30 DAYS AGO</span><span>TODAY</span></div>`; g.appendChild(heat);
      // connectors
      const cn = Object.entries(U.mcp).map(([k, v]) => ({ name: k, label: mcpLabel(k), n: mcpCalls(U, k, 30).n })).filter(x => x.n).sort((a, b) => b.n - a.n);
      const conn = el('section', 'card c6'); conn.innerHTML = `<div class="card-h"><h3>${svg('plug')}Connectors &amp; apps · calls 30d</h3></div>${cn.length ? bars(cn.map(x => ({ name: x.name, label: x.label, v: x.n, text: x.n + ' calls', color: '#6aa8ff' }))) : empty('No connector calls in the logs yet.')}`; g.appendChild(conn);
      // skills table
      const sk = el('section', 'card c12'); sk.innerHTML = `<div class="card-h"><h3>${svg('skills')}Skills: runs, cost and routing</h3><span class="chip">${U.skills.length} measured · ${S.OS.skills.length} installed</span></div><div style="overflow:auto"><table class="tbl" id="sk-tbl"><thead><tr><th data-k="name">Skill</th><th class="r" data-k="runs">Runs</th><th class="r" data-k="usd">API $</th><th class="r" data-k="avg">$ / run</th><th class="r" data-k="tok">Tokens</th><th class="r" data-k="sub">Subagents</th><th data-k="last">Last</th><th>Routing hint</th></tr></thead><tbody></tbody></table></div>${U.skills.length ? '' : empty('No skill runs in the logs yet.')}`;
      g.appendChild(sk);
      let sortK = 'usd', dir = -1;
      const hint = s => { const top = Object.entries(s.models).sort((a, b) => b[1] - a[1])[0], avg = s.usd / s.runs; if (s.runs < 3) return `<span class="faint">needs 3+ runs</span>`; if (top && /opus/.test(top[0]) && avg < 0.6) return `<span class="pill info">try Sonnet or Haiku</span>`; if (avg > 4) return `<span class="pill warn">heavy: review steps</span>`; return `<span class="faint">fine</span>`; };
      const drawT = () => { const rows2 = U.skills.map(s => ({ ...s, avg: s.runs ? s.usd / s.runs : 0 })).sort((a, b) => (typeof a[sortK] === 'string' ? a[sortK].localeCompare(b[sortK]) : a[sortK] - b[sortK]) * dir); sk.querySelector('tbody').innerHTML = rows2.map(s => `<tr><td class="nm">/${esc(s.name)}</td><td class="r num">${s.runs}</td><td class="r num">${money(s.usd)}</td><td class="r num">${money(s.avg)}</td><td class="r num">${fmt(s.tok)}</td><td class="r num">${s.sub}</td><td class="muted">${ago(s.last)}</td><td>${hint(s)}</td></tr>`).join(''); };
      sk.querySelectorAll('th[data-k]').forEach(th => th.onclick = () => { const k = th.dataset.k; dir = sortK === k ? -dir : -1; sortK = k; drawT(); }); drawT();
      const tl = el('section', 'card c6'); tl.innerHTML = `<div class="card-h"><h3>${svg('api')}Tools your agent used · 30d</h3></div>${bars(U.tools.slice(0, 10).map(x => ({ name: x.name, v: x.n, text: String(x.n), color: '#b166ff' })))}`; g.appendChild(tl);
      const cm = el('section', 'card c6'); cm.innerHTML = `<div class="card-h"><h3>${svg('routines')}Shell commands it ran · 30d</h3></div>${bars(U.cmds.slice(0, 10).map(x => ({ name: x.name, v: x.n, text: String(x.n), color: '#3ddc97' })))}<div class="muted" style="font-size:12px;margin-top:12px">Only command names are kept, never the full command.</div>`; g.appendChild(cm);
      // wiring
      const cells = []; const nowD = new Date(); for (let c = 0; c < 30; c++) for (let r = 0; r < 24; r++) { const dk = dayKey(Date.now() - (29 - c) * 864e5); cells.push({ c, r, dk, v: U.hourHeat[dk + 'T' + r] || 0 }); }
      requestAnimationFrame(() => drawHeat(heat.querySelector('canvas'), cells, 30, 24, '255,122,47', k => `<b>${k.dk} · ${String(k.r).padStart(2, '0')}:00</b><span>${k.v ? fmt(k.v) + ' tokens' : 'idle'}</span>`));
      const sb = () => { const v = id => Math.max(0, parseFloat(String(root.querySelector(id).value).replace(',', '.')) || 0); store.set('budget', { h5: v('#bud-h5'), d7: v('#bud-d7') }); S.dirty.add('usage'); S.dirty.add('home'); };
      ['#bud-h5', '#bud-d7'].forEach(id => root.querySelector(id).addEventListener('change', () => { sb(); S.views.usage.render(root); toast('Budget saved'); }));
    },
    tick() { const U = S.U; document.querySelectorAll('#v-usage .ctx-row').forEach(r => { const left = (+r.dataset.cold) - (Date.now() - S.fetchedAt), w = r.querySelector('[data-w]'); if (w) { w.textContent = left > 0 ? 'warm ' + dur(left) : 'cold'; w.className = 'pill ' + (left > 0 ? 'good' : ''); } }); },
  });

  /* ================= SKILLS ================= */
  register('skills', {
    render(root) {
      const OS = S.OS; root.innerHTML = '';
      const f = { q: '', sort: 'usage', scope: 'all' };
      const bar = el('div', 'filters'); bar.innerHTML = `<input type="text" placeholder="Filter skills…" id="sk-q"><div class="seg" id="sk-scope"><button data-v="all" class="on">All</button><button data-v="hub">Hub</button><button data-v="global">Global</button><button data-v="video">Video</button></div><div class="seg" id="sk-sort"><button data-v="usage" class="on">Most used</button><button data-v="name">A–Z</button><button data-v="recent">Recent</button></div><span class="chip" id="sk-n"></span>`;
      root.appendChild(bar);
      const grid = el('div', 'skills'); root.appendChild(grid);
      const draw = () => {
        let list = OS.skills.filter(s => (f.scope === 'all' || (f.scope === 'video' ? s.family === 'video' : s.scope === f.scope)) && (!f.q || (s.name + ' ' + s.desc).toLowerCase().includes(f.q)));
        const u = s => usageOfSkill(s) || { usd: 0, runs: 0, last: 0 };
        list = list.sort((a, b) => f.sort === 'name' ? a.name.localeCompare(b.name) : f.sort === 'recent' ? (u(b).last || b.mtime) - (u(a).last || a.mtime) : (u(b).usd - u(a).usd) || (u(b).runs - u(a).runs) || a.name.localeCompare(b.name));
        grid.innerHTML = ''; list.forEach(s => grid.appendChild(skillCard(s))); bar.querySelector('#sk-n').textContent = list.length + ' of ' + OS.skills.length;
      };
      bar.querySelector('#sk-q').oninput = e => { f.q = e.target.value.toLowerCase(); draw(); };
      for (const id of ['sk-scope', 'sk-sort']) bar.querySelector('#' + id).onclick = e => { const b = e.target.closest('button'); if (!b) return; f[id === 'sk-scope' ? 'scope' : 'sort'] = b.dataset.v; bar.querySelectorAll('#' + id + ' button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
      draw();
      const lib = OS.library || [];
      if (lib.length) { const c = el('section', 'card'); c.style.marginTop = '18px'; c.innerHTML = `<div class="card-h"><h3>${svg('folder')}Staged for review · ${lib.length}</h3><span class="chip">not installed</span></div><div class="chips">${lib.map(x => `<button class="tag" data-p="${esc(x.path)}" title="${esc(x.desc)}">${esc(x.name)}</button>`).join('')}</div>`; c.querySelectorAll('[data-p]').forEach(b => b.onclick = () => reveal(b.dataset.p)); root.appendChild(c); }
    },
  });

  /* ================= ROUTINES ================= */
  const IDEAS = [
    { kind: 'Passive', title: 'Weekly spend guard', cost: 'about 1 short run a week', text: 'Reads your own usage figures and only pings you when the last 7 days run over your budget or a chat passes 800k tokens. Silent otherwise.', prompt: 'Create a weekly scheduled task. It reads http://localhost:5210/api/usage on my computer and notifies me only if the last-7-days API-equivalent spend is above my budget (ask me for the number) or any chat context is above 800,000 tokens. If nothing is over, it stays silent. Keep the run short and cap it at about $0.05 per run.' },
    { kind: 'Passive', title: 'Winning-video watch', cost: 'weekly web search', text: 'Once a week, checks what is trending in your TikTok Shop product categories and only alerts you when a new format or product is taking off.', prompt: 'Create a weekly scheduled task that uses /latest on my TikTok Shop niche (see memory for my categories) and writes the top 5 new formats or products to memory/inbox/weekly-trends.md. Only notify me when something is new.' },
    { kind: 'Active', title: 'Friday improvement review', cost: 'about one session a week', text: 'Looks back over the week’s sessions, spots jobs you keep doing by hand and parks suggestions in feedback/ for you to accept or skip.', prompt: 'Every Friday morning, look back over my last 7 days of Claude Code sessions. Find jobs I keep repeating by hand and propose routines or skill improvements. Park each as a line in feedback/routines.md using /note, apply nothing, and tell me how many are pending.' },
    { kind: 'Active', title: 'Morning sync', cost: 'a few connector calls', text: 'Refreshes the inbox and calendar panel every weekday so the Command Center is fresh when you open it.', prompt: 'Every weekday at 7:30am run /sync-os so the Inbox and calendar panel of my Command Center is fresh. Keep the run short.' },
  ];
  const cronDays = c => { if (!c) return null; const dow = c.split(/\s+/)[4]; if (dow === '*' || !dow) return [0, 1, 2, 3, 4, 5, 6]; const out = new Set(); for (const part of dow.split(',')) { const m = /^(\d)-(\d)$/.exec(part); if (m) for (let i = +m[1]; i <= +m[2]; i++) out.add(i % 7); else if (/^\d$/.test(part)) out.add(+part % 7); } return [...out]; };
  register('routines', {
    render(root) {
      const X2 = S.X, U = S.U, tasks = X2 ? X2.tasks : []; root.innerHTML = ''; const g = el('div', 'grid g12'); root.appendChild(g);
      const wk = el('section', 'card c12'), today = new Date().getDay(), names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      wk.innerHTML = `<div class="card-h"><h3>${svg('routines')}This week</h3><span class="chip">${tasks.length} scheduled · ${tasks.filter(t => t.status === 'active').length} active</span></div><div class="weekgrid">${names.map((n, i) => `<div class="day ${i === today ? 'today' : ''}"><h4>${n}</h4>${tasks.filter(t => t.status === 'active' && (cronDays(t.cron) || []).includes(i)).map(t => { const m = (t.cron || '').split(/\s+/); return `<div class="tag" style="display:block;margin-bottom:5px;white-space:normal" title="${esc(t.name)}">${String(m[1] || '*').padStart(2, '0')}:${String(m[0] || '0').padStart(2, '0')} ${esc(t.name)}</div>`; }).join('')}</div>`).join('')}</div>${tasks.length ? '' : empty('No scheduled routines on this computer yet. The four ideas below are tuned to your setup. Each one copies a prompt you paste into Claude.')}`;
      g.appendChild(wk);
      const ideas = el('section', 'c12'); ideas.style.cssText = 'display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));grid-column:span 12';
      IDEAS.forEach(i => { const c = el('div', 'idea', `<div style="display:flex;justify-content:space-between;align-items:center"><span class="pill ${i.kind === 'Passive' ? 'good' : 'info'}">${i.kind}</span><span class="faint" style="font:500 11px var(--mono)">${esc(i.cost)}</span></div><b>${esc(i.title)}</b><p>${esc(i.text)}</p><button class="btn sm">${svg('copy')}Copy prompt</button>`); c.querySelector('button').onclick = async () => { await copy(i.prompt); toast('Copied. Paste it into Claude.'); }; ideas.appendChild(c); });
      g.appendChild(ideas);
      const how = el('section', 'card c6'); how.innerHTML = `<div class="card-h"><h3>${svg('info')}Passive or active?</h3></div><p class="muted" style="font-size:13px">An <b style="color:var(--ink)">active</b> routine hands you something to review every run. A <b style="color:var(--ink)">passive</b> one runs quietly and only speaks up when it finds something. With many routines, mostly passive ones keep your review load small.</p>`; g.appendChild(how);
      const runs = (U && U.routines) || [];
      const rr = el('section', 'card c6'); rr.innerHTML = `<div class="card-h"><h3>${svg('cost')}Routine runs in the logs</h3></div>${runs.length ? `<table class="tbl"><thead><tr><th>Routine</th><th class="r">Runs</th><th class="r">API $</th><th>Last</th></tr></thead><tbody>${runs.map(r => `<tr><td class="nm">${esc(r.name)}</td><td class="r num">${r.runs}</td><td class="r num">${money(r.usd)}</td><td class="muted">${ago(r.last)}</td></tr>`).join('')}</tbody></table>` : empty('No scheduled runs seen yet. Once you create a routine, its runs, tokens and cost show here, and you can ask Claude to cap any that cost too much.')}`; g.appendChild(rr);
    },
  });

  /* ================= ARTIFACTS ================= */
  register('artifacts', {
    render(root) {
      const A = S.X ? S.X.artifacts : { items: [], total: 0 }; root.innerHTML = '';
      const f = { q: '', t: 'all', d: 'all', n: 60 };
      const TYPES = { all: null, pages: ['html', 'htm'], docs: ['pdf', 'docx'], decks: ['pptx', 'key'], data: ['csv', 'xlsx'] };
      const bar = el('div', 'filters'); bar.innerHTML = `<input type="text" id="a-q" placeholder="Search ${A.total} artifacts…"><div class="seg" id="a-t">${Object.keys(TYPES).map((k, i) => `<button data-v="${k}" class="${i ? '' : 'on'}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div><div class="seg" id="a-d"><button data-v="all" class="on">All depts</button>${S.OS.departments.map(d => `<button data-v="${d.key}">${esc(d.label.split(' ')[0])}</button>`).join('')}</div><span class="chip" id="a-n"></span>`;
      root.appendChild(bar); const grid = el('div', 'agrid'); root.appendChild(grid); const more = el('button', 'btn', 'Show more'); more.style.cssText = 'margin:18px auto 0;display:none'; root.appendChild(more);
      const draw = () => {
        const list = A.items.filter(a => (!f.q || (a.name + ' ' + a.path).toLowerCase().includes(f.q)) && (!TYPES[f.t] || TYPES[f.t].includes(a.ext)) && (f.d === 'all' || a.dept === f.d));
        grid.innerHTML = ''; list.slice(0, f.n).forEach(a => { const d = deptBy(a.dept), c = el('div', 'acard', `<div class="badge" style="--c:${d.color}">${esc(a.ext.toUpperCase())}</div><div style="min-width:0;flex:1"><div style="font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${esc(a.name)}">${esc(a.name)}</div><div class="faint" style="font:500 11px var(--mono);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:3px 0 8px">${esc(a.path)}</div><div style="display:flex;gap:8px;align-items:center"><span class="tag" style="color:${d.color}">${esc(d.label)}</span><span class="faint" style="font:500 11px var(--mono)">${bytes(a.size)} · ${ago(a.mtime)}</span></div></div>`); c.onclick = () => openFile(a.path); c.oncontextmenu = e => { e.preventDefault(); reveal(a.path); }; c.title = 'Click to open · right-click to show in Finder'; grid.appendChild(c); });
        if (!list.length) grid.innerHTML = empty('No artifacts match.'); bar.querySelector('#a-n').textContent = list.length + ' shown'; more.style.display = list.length > f.n ? '' : 'none';
      };
      bar.querySelector('#a-q').oninput = e => { f.q = e.target.value.toLowerCase(); f.n = 60; draw(); };
      for (const id of ['a-t', 'a-d']) bar.querySelector('#' + id).onclick = e => { const b = e.target.closest('button'); if (!b) return; f[id === 'a-t' ? 't' : 'd'] = b.dataset.v; f.n = 60; bar.querySelectorAll('#' + id + ' button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
      more.onclick = () => { f.n += 60; draw(); }; draw();
    },
  });

  /* ================= TIMELINE ================= */
  register('timeline', {
    render(root) {
      const OS = S.OS, T = S.X ? S.X.timeline : []; root.innerHTML = ''; const g = el('div', 'grid g12'); root.appendChild(g);
      const act = el('section', 'card c12 heat'); act.innerHTML = `<div class="card-h"><h3>${svg('timeline')}File activity · 26 weeks</h3><span class="chip" id="act-sum"></span></div><canvas style="height:103px"></canvas><div id="act-leg" class="chips" style="margin-top:12px"></div>`; g.appendChild(act);
      const A = OS.activity, first = new Date(A.startDay * 864e5).getUTCDay(), cells = []; let total = 0, active = 0;
      A.days.forEach(([n, by], i) => { total += n; if (n) active++; const idx = i + first; cells.push({ c: Math.floor(idx / 7), r: idx % 7, v: n, dk: new Date((A.startDay + i) * 864e5).toISOString().slice(0, 10), by }); });
      act.querySelector('#act-sum').textContent = fmt(total) + ' changes · ' + active + ' active days';
      act.querySelector('#act-leg').innerHTML = OS.departments.map(d => `<span class="tag"><i style="display:inline-block;width:8px;height:8px;border-radius:3px;background:${d.color};margin-right:6px"></i>${esc(d.label)}</span>`).join('');
      requestAnimationFrame(() => drawHeat(act.querySelector('canvas'), cells, Math.ceil((A.days.length + first) / 7), 7, '255,122,47', k => `<b>${k.dk}</b><span>${k.v ? k.v + ' files changed · ' + Object.entries(k.by).sort((a, b) => b[1] - a[1]).map(([x, v]) => esc(deptBy(x).label) + ' ' + v).join(', ') : 'no changes'}</span>`));
      const lst = el('section', 'card c12'); lst.innerHTML = `<div class="card-h"><h3>${svg('start')}What changed · last 14 days</h3><div class="seg" id="tl-k">${['all', 'skill', 'memory', 'artifact', 'file'].map((k, i) => `<button data-v="${k}" class="${i ? '' : 'on'}">${k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div></div><div id="tl-body"></div>`; g.appendChild(lst);
      let kind = 'all'; const IC = { skill: 'skills', memory: 'book', feedback: 'note', artifact: 'artifacts', file: 'file' };
      const draw = () => {
        const rows = T.filter(r => kind === 'all' || r.kind === kind), body = lst.querySelector('#tl-body'); let day = '', html = '';
        for (const r of rows) { const dk = new Date(r.t).toDateString(), lab = dk === new Date().toDateString() ? 'Today' : dk === new Date(Date.now() - 864e5).toDateString() ? 'Yesterday' : new Date(r.t).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }); if (lab !== day) { html += `<div class="tl-day">${lab}</div>`; day = lab; } const d = deptBy(r.dept); html += `<div class="row" data-p="${esc(r.path)}"><span class="ic" style="color:${d.color}">${svg(IC[r.kind] || 'file')}</span><div class="tx"><b>${esc(r.label)}${r.n > 1 ? ` <span class="faint">×${r.n}</span>` : ''}</b><span>${esc(r.path)}</span></div><span class="tag">${esc(r.kind)}</span><time>${new Date(r.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</time></div>`; }
        body.innerHTML = html || empty('Nothing here.'); body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => reveal(b.dataset.p));
      };
      lst.querySelector('#tl-k').onclick = e => { const b = e.target.closest('button'); if (!b) return; kind = b.dataset.v; lst.querySelectorAll('#tl-k button').forEach(x => x.classList.toggle('on', x === b)); draw(); }; draw();
    },
  });

  /* ================= APPS ================= */
  const MICRO = [
    { id: 'rubric-editor-new', label: 'RUBRIC Editor', desc: 'Review your agent’s first cut of a video in the browser and send comments back.' },
    { id: 'rubric-scripts', label: 'RUBRIC Scripts', desc: 'Review short-video scripts and pick hooks before recording.' },
    { id: 'rubric-recos', label: 'RUBRIC Recos', desc: 'Weekly suggestions to improve your setup, accepted as a cart.' },
    { id: 'rubric-carousels', label: 'RUBRIC Carousels', desc: 'Review Instagram carousels your agent made.' },
    { id: 'element-picker', label: 'Element Picker', desc: 'Pick animated elements out of any web page.' },
    { id: 'teleprompter', label: 'Teleprompter', desc: 'Read scripts on your phone or screen while recording.' },
    { id: 'robo-capture', label: 'Robo Capture', desc: 'Chrome extension that grabs the code of a page section you like.' },
  ];
  register('apps', {
    render(root) {
      const OS = S.OS, U = S.U; root.innerHTML = ''; const g = el('div', 'grid g12'); root.appendChild(g);
      const ap = el('section', 'card c12'); ap.innerHTML = `<div class="card-h"><h3>${svg('plug')}Connected apps</h3><span class="chip">${OS.apps.length} wired</span></div><div class="apps" id="app-grid"></div><div class="muted" style="font-size:12px;margin-top:14px">Calls come from your session logs over 30 days. “Unused” is a candidate to retire: it still costs context to load even when it is never called.</div>`;
      const gr = ap.querySelector('#app-grid');
      OS.apps.forEach(a => {
        const key = APP_SERVER[a.id], m = key ? mcpCalls(U, key, 30) : null, cli = a.id === 'app:gh' && U ? (U.cmds.find(c => c.name === 'gh') || { n: 0 }).n : null;
        const n = m ? m.n : cli, status = n == null ? 'not measured' : n > 0 ? n + (n === 1 ? ' call' : ' calls') : 'unused 30d';
        const path = (window.BRAIN_ICON_PATHS || {})[a.id], ic = (window.BRAIN_ICONS || {})[a.id];
        const inner = path ? `<svg viewBox="0 0 24 24" fill="#e7eaf3"><path d="${path}"/></svg>` : ic ? ic.replace(/#888/g, '#e7eaf3').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ') : svg('api');
        gr.appendChild(el('div', 'apptile', `<span class="ai">${inner}</span><div style="min-width:0;flex:1"><div style="font-weight:600;font-size:13.5px">${esc(a.label)}</div><div class="faint" style="font:500 11px var(--mono)">${esc(a.kind.toUpperCase())}${m && m.last ? ' · ' + ago(m.last) : ''}</div></div><span class="pill ${n == null ? '' : n > 0 ? 'good' : 'warn'}">${status}</span>`));
      });
      g.appendChild(ap);
      const seen = U ? Object.keys(U.mcp).filter(k => !Object.values(APP_SERVER).some(v => k === v || k.startsWith(v + '-'))).map(k => ({ k, label: mcpLabel(k), n: mcpCalls(U, k, 30).n })).filter(x => x.n) : [];
      if (seen.length) { const c = el('section', 'card c12'); c.innerHTML = `<div class="card-h"><h3>${svg('api')}Also used by your agent</h3></div><div class="chips">${seen.map(x => `<span class="tag">${esc(x.label)} · ${x.n}</span>`).join('')}</div>`; g.appendChild(c); }
      const mi = el('section', 'card c12'); const lib = new Set((OS.library || []).map(x => x.name));
      mi.innerHTML = `<div class="card-h"><h3>${svg('apps')}Micro apps</h3><span class="chip">small tools that replace chat for one big job</span></div><div class="apps" id="micro"></div>`;
      const mhost = mi.querySelector('#micro'), APPID = { 'rubric-editor-new': 'rubric-editor' };
      const draw = live => {
        mhost.innerHTML = '';
        MICRO.forEach(m => {
          const lv = live[APPID[m.id] || m.id], have = lib.has(m.id);
          const c = el('div', 'apptile', `<span class="ai">${svg(lv ? 'apps' : 'folder')}</span><div style="min-width:0;flex:1"><div style="font-weight:600;font-size:13.5px">${esc(m.label)}</div><div class="muted" style="font-size:12px">${esc(m.desc)}</div></div>`);
          const b = el('button', 'btn sm' + (lv && lv.running ? ' primary' : ''), lv && lv.installed ? (lv.running ? 'Open ↗' : 'Launch ▶') : have ? 'Setup prompt' : 'Not downloaded');
          if (!lv || !lv.installed) { b.disabled = !have; b.style.opacity = have ? 1 : .5; b.onclick = async () => { await copy(`I'm giving you a resource called ${m.label}. It's staged in tools/skills-library/${m.id}/ in my hub. Read its README, tell me in plain language how it would fit my setup, vet its scripts first, and ask me a few questions before you install it.`); toast('Copied. Paste into Claude.'); }; }
          else b.onclick = async () => {
            if (lv.running) { window.open(lv.url, '_blank', 'noopener'); return; }
            b.disabled = true; b.textContent = 'Starting…';
            try { const r = await (await fetch('/api/micro/start', { method: 'POST', headers: { 'content-type': 'application/json', 'x-brain-os': '1' }, body: JSON.stringify({ id: lv.id }) })).json(); if (r.error) throw new Error(r.error); window.open(r.url, '_blank', 'noopener'); load(); } catch (e) { toast(e.message); b.disabled = false; b.textContent = 'Launch ▶'; }
          };
          c.appendChild(b); mhost.appendChild(c);
        });
      };
      const load = () => fetch('/api/micro').then(r => r.json()).then(a => draw(Object.fromEntries(a.map(x => [x.id, x])))).catch(() => draw({}));
      draw({}); load();
      g.appendChild(mi);
    },
  });

  /* ================= MEMORY ================= */
  register('memory', {
    render(root) {
      const OS = S.OS, X2 = S.X; root.innerHTML = ''; const g = el('div', 'grid g12'); root.appendChild(g);
      const left = el('div', 'c5'); left.style.cssText = 'display:grid;gap:16px;align-content:start'; left.appendChild(captureCard());
      const rc = el('section', 'card'); rc.innerHTML = `<div class="card-h"><h3>${svg('ask')}Ask your brain</h3><span class="chip">0 tokens</span></div><input type="text" id="rc-q" placeholder="e.g. what commission did we get on the blender?"><div id="rc-a" style="margin-top:12px"></div>`; left.appendChild(rc);
      const bl = el('section', 'card'), B = X2 ? X2.backlog : { total: 0, files: [] };
      bl.innerHTML = `<div class="card-h"><h3>${svg('note')}Parked notes</h3><span class="chip">${B.total} pending</span></div>${B.files.length ? B.files.map(f => `<div class="note-item" style="cursor:pointer" data-p="${esc(f.file)}"><b>${esc(f.name)}</b> <span class="faint">· ${f.pending}</span>${f.items.slice(0, 2).map(i => `<div class="muted" style="margin-top:4px">${esc(i)}</div>`).join('')}</div>`).join('') : empty('Nothing parked. Use <span class="mono" style="color:var(--accent2)">/note</span> in Claude to park feedback for a skill without losing your place. Nothing is applied until you say so.')}`;
      bl.querySelectorAll('[data-p]').forEach(b => b.onclick = () => reveal(b.dataset.p)); left.appendChild(bl); g.appendChild(left);
      const right = el('section', 'card c7'); right.innerHTML = `<div class="card-h"><h3>${svg('memory')}Memory</h3><span class="chip">${OS.memory.length} facts</span></div><div id="mem-list" style="max-height:640px;overflow:auto"></div>`;
      const ml = right.querySelector('#mem-list'); OS.memory.forEach(m => { const r = el('div', 'note-item', `<div class="label" style="color:var(--accent);margin-bottom:5px">${esc(m.type)} · ${ago(m.mtime)}</div>${esc(m.fact)}`); r.style.cursor = 'pointer'; r.onclick = () => reveal(m.file); r.title = m.file; ml.appendChild(r); }); if (!OS.memory.length) ml.innerHTML = empty('No memories yet.'); g.appendChild(right);
      let t = null; rc.querySelector('#rc-q').addEventListener('input', e => { clearTimeout(t); const q = e.target.value.trim(); if (q.length < 3) { rc.querySelector('#rc-a').innerHTML = ''; return; } t = setTimeout(async () => { try { const r = await api('/api/recall?q=' + encodeURIComponent(q)); rc.querySelector('#rc-a').innerHTML = (r.hits || []).length ? r.hits.map(h => `<div class="answer" style="margin:0 0 8px"><div class="src">${esc(h.file)}</div>${esc((h.slice || '').replace(/^---[\s\S]*?---\s*/, '').replace(/\*Saved [^*]*\*/g, '').trim().slice(0, 600))}</div>`).join('') : empty('No stored fact matched.'); } catch { } }, 180); });
    },
  });

  document.getElementById('perfhud');
  // boot is called by the last view file (os-recos.js)
})();
