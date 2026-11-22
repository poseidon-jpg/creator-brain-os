/* os-fx.js - the polish layer. Everything here is progressive: if it fails, the OS still works.
   Rules: transform and opacity only, one rAF per interaction, nothing animates while the tab is hidden,
   and reduced-motion turns the motion off. */
'use strict';
(() => {
  const X = window.OSX, S = X.S, $ = X.$;
  const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- card spotlight: a soft light that follows the pointer, one card at a time ---- */
  let raf = 0, tgt = null, px = 0, py = 0;
  document.addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('.card'); if (!c || reduce()) return;
    tgt = c; px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; const r = tgt.getBoundingClientRect(); tgt.style.setProperty('--mx', (px - r.left).toFixed(0) + 'px'); tgt.style.setProperty('--my', (py - r.top).toFixed(0) + 'px'); });
  }, { passive: true });

  /* ---- numbers count up the first time a view draws ---- */
  const easeOut = t => 1 - Math.pow(1 - t, 4);
  function countUp(root) {
    if (reduce() || root.dataset.fx) return; root.dataset.fx = '1';
    const list = root.querySelectorAll('.kpi b,.rc-stats b,.stat b,.gauge .mid b,.big,.hero .n,.dept .n');
    const jobs = [];
    list.forEach(e => {
      const tn = [...e.childNodes].find(n => n.nodeType === 3 && /\d/.test(n.nodeValue)); if (!tn) return;
      const m = tn.nodeValue.match(/^(\D*?)(\d[\d,]*\.?\d*)([\s\S]*)$/); if (!m) return;
      const val = parseFloat(m[2].replace(/,/g, '')); if (!(val > 0)) return;
      const dec = (m[2].split('.')[1] || '').length, comma = m[2].includes(',');
      jobs.push({ tn, pre: m[1], suf: m[3], val, dec, comma, final: tn.nodeValue });
    });
    if (!jobs.length) return;
    const t0 = performance.now(), D = 800;
    const step = t => {
      const k = Math.min(1, (t - t0) / D), v = easeOut(k);
      for (const j of jobs) { const n = j.val * v; j.tn.nodeValue = k >= 1 ? j.final : j.pre + (j.comma ? n.toLocaleString('en-US', { minimumFractionDigits: j.dec, maximumFractionDigits: j.dec }) : n.toFixed(j.dec)) + j.suf; }
      if (k < 1 && !document.hidden) requestAnimationFrame(step); else for (const j of jobs) j.tn.nodeValue = j.final;
    };
    requestAnimationFrame(step);
  }

  /* ---- staggered entrance: children of each grid rise in sequence (CSS reads --i) ---- */
  function stagger(root) {
    root.querySelectorAll(':scope > .grid > *').forEach((c, i) => c.style.setProperty('--i', Math.min(i, 12)));
    root.querySelectorAll(':scope > .grid > .rc-body > *').forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8)));
  }
  /* Entrance motion is only a brief class on the view. A timer removes it after the animation window, so if a
     tab is hidden or animations never run, everything still ends up fully visible (never a blank page). */
  function run(v) { if (!v) return; v.classList.add('fx-run'); clearTimeout(v._fxt); v._fxt = setTimeout(() => v.classList.remove('fx-run'), 1500); }
  X.fx = root => { try { stagger(root); countUp(root); run(root); } catch (e) { /* polish must never break a view */ } };

  /* ---- rail indicator that glides, ambient hue per view, topbar elevation ---- */
  const HUE = { home: 'orange', recos: 'orange', usage: 'blue', skills: 'orange', routines: 'violet', artifacts: 'blue', timeline: 'green', apps: 'violet', memory: 'green' };
  const rail = $('#rail'), ind = document.createElement('i'); ind.className = 'rail-ind'; ind.setAttribute('aria-hidden', 'true'); rail.appendChild(ind);
  ['blue', 'violet', 'green'].forEach(h => { const g = document.createElement('div'); g.className = 'glow g-' + h; g.setAttribute('aria-hidden', 'true'); document.body.insertBefore(g, document.body.firstChild); });
  X.afterView = name => {
    run($('#v-' + name));
    const n = rail.querySelector('.nav.on'); if (n) { ind.style.transform = `translateY(${n.offsetTop + (n.offsetHeight - 26) / 2}px)`; ind.style.opacity = 1; }
    document.body.dataset.hue = HUE[name] || 'orange';
    if (X.renderHud && S.OS) X.renderHud();
  };
  addEventListener('resize', () => X.afterView && X.afterView(S.view));
  const stage = $('#stage'), top = document.querySelector('.topbar'); let st = 0;
  stage.addEventListener('scroll', () => { if (st) return; st = requestAnimationFrame(() => { st = 0; top.classList.toggle('lifted', stage.scrollTop > 4); }); }, { passive: true });
})();
