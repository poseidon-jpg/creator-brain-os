/* qa.js - an outside judge that runs inside the page. Nothing here runs until you call it.
   __qa.all()            audit every view: contrast, overlap, overflow, keyboard reach, tap targets
   __qa.contrast()       WCAG contrast of every visible text node in the current view
   __qa.overlap()        cards and controls that collide or spill past the viewport
   __qa.keyboard()       clickable things the keyboard cannot reach
   __qa.targets()        controls smaller than 28 px */
'use strict';
(() => {
  const BG = [7, 8, 11];
  const parse = s => { const m = (s || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1]; };
  const over = (top, under) => { const a = top[3]; return [top[0] * a + under[0] * (1 - a), top[1] * a + under[1] * (1 - a), top[2] * a + under[2] * (1 - a)]; };
  const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
  const ratio = (a, b) => { const x = lum(a), y = lum(b), hi = Math.max(x, y), lo = Math.min(x, y); return (hi + .05) / (lo + .05); };
  const sel = e => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; else if (e.className && typeof e.className === 'string') s += '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.'); return s; };

  function bgOf(el) {
    const chain = []; for (let n = el; n && n.nodeType === 1; n = n.parentElement) chain.push(n);
    let c = BG.slice();
    for (let i = chain.length - 1; i >= 0; i--) {
      const cs = getComputedStyle(chain[i]), col = parse(cs.backgroundColor);
      if (col && col[3] > 0) c = over(col, c);
      if (/gradient/.test(cs.backgroundImage) && !(col && col[3] > 0)) { const g = cs.backgroundImage.match(/rgba?\([^)]+\)/g) || [], first = g.length ? parse(g[0]) : null, last = g.length ? parse(g[g.length - 1]) : null; if (first && first[3] > .9) c = over(first, c); else c = over([255, 255, 255, .04], c); if (last && last[3] > .9 && first && first[3] > .9) { const m = [(first[0] + last[0]) / 2, (first[1] + last[1]) / 2, (first[2] + last[2]) / 2, 1]; c = m; } }
    }
    return c;
  }
  function opacityOf(el) { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= +getComputedStyle(n).opacity; return o; }

  function reveal(on) {
    let st = document.getElementById('qa-reveal');
    if (on && !st) { st = document.createElement('style'); st.id = 'qa-reveal'; st.textContent = '*{content-visibility:visible!important;animation:none!important}'; document.head.appendChild(st); }
    if (!on && st) st.remove();
  }
  const scrolls = e => { for (let n = e.parentElement; n && n !== document.body; n = n.parentElement) { const o = getComputedStyle(n).overflowX; if ((o === 'auto' || o === 'scroll') && n.scrollWidth > n.clientWidth) return true; } return false; };
  const root = () => document.querySelector('.view.on') || document.body;
  const visible = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };

  function contrast(scope) {
    reveal(true);
    const out = [], seen = new Set(); let total = 0;
    const w = document.createTreeWalker(scope || root(), NodeFilter.SHOW_TEXT);
    for (let n; (n = w.nextNode());) {
      const t = n.nodeValue.trim(); if (!t || t.length < 2) continue;
      const e = n.parentElement; if (!e || seen.has(e) || /^(SCRIPT|STYLE|SVG|CANVAS)$/i.test(e.tagName) || e.closest('svg')) continue;
      if (!visible(e)) continue; seen.add(e); total++;
      const cs = getComputedStyle(e), fg = parse(cs.color); if (!fg) continue;
      const bg = bgOf(e), op = opacityOf(e), f = over([fg[0], fg[1], fg[2], fg[3] * op], bg);
      const size = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700, large = size >= 24 || (size >= 18.66 && bold);
      const r = ratio(f, bg), need = large ? 3 : 4.5;
      if (r < need) out.push({ el: sel(e), text: t.slice(0, 40), ratio: +r.toFixed(2), need, size });
    }
    reveal(false);
    out.sort((a, b) => a.ratio - b.ratio);
    return { total, fail: out.length, worst: out.slice(0, 12) };
  }

  function overlap() {
    reveal(true);
    const r = root(), out = [], vw = document.documentElement.clientWidth;
    const cards = [...r.querySelectorAll('.card,.apptile,.acard,.skill,.reco')].filter(visible);
    const R = cards.map(c => [c, c.getBoundingClientRect()]);
    for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
      const [a, A] = R[i], [b, B] = R[j]; if (a.contains(b) || b.contains(a)) continue;
      const ox = Math.min(A.right, B.right) - Math.max(A.left, B.left), oy = Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top);
      if (ox > 3 && oy > 3) out.push({ a: sel(a), b: sel(b), ox: Math.round(ox), oy: Math.round(oy) });
    }
    const spill = [...r.querySelectorAll('*')].filter(e => { if (!visible(e)) return false; const b = e.getBoundingClientRect(); return b.right > vw + 2 && !e.closest('.pods,.drawer,.toast,.tip,svg') && !scrolls(e); }).slice(0, 8).map(e => ({ el: sel(e), right: Math.round(e.getBoundingClientRect().right), vw }));
    const clip = [...r.querySelectorAll('h2,h3,b,.btn,.pill,.chip,.tag')].filter(e => visible(e) && e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow === 'visible').slice(0, 8).map(e => ({ el: sel(e), text: e.textContent.trim().slice(0, 30) }));
    const hscroll = document.documentElement.scrollWidth > vw + 1;
    reveal(false);
    return { cards: cards.length, overlaps: out.length, overlapList: out.slice(0, 8), spill, clip, hscroll };
  }

  function keyboard() {
    reveal(true);
    const r = document.body, out = [];
    r.querySelectorAll('*').forEach(e => {
      if (!visible(e) || e.closest('.sphere,.pods,[aria-hidden=true]')) return;
      const natural = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/.test(e.tagName) || e.hasAttribute('tabindex');
      if (natural) return;
      if (typeof e.onclick === 'function' || getComputedStyle(e).cursor === 'pointer') { if (e.closest('a,button,[tabindex]') || e.querySelector('button,a,input,select,textarea,summary')) return; out.push({ el: sel(e), text: e.textContent.trim().slice(0, 30) }); }
    });
    reveal(false);
    return { unreachable: out.length, list: out.slice(0, 12) };
  }

  function targets() {
    const out = [];
    document.querySelectorAll('.view.on a,.view.on button,.rail a,.topbar button').forEach(e => { if (!visible(e) || getComputedStyle(e).display === 'inline') return; const b = e.getBoundingClientRect(); if (Math.min(b.width, b.height) < 28 && !e.closest('.sphere,.pods')) out.push({ el: sel(e), w: Math.round(b.width), h: Math.round(b.height), text: e.textContent.trim().slice(0, 20) }); });
    return { small: out.length, list: out.slice(0, 10) };
  }

  function svgText() {   // chart labels shrink with the chart: measure the size you actually see
    const out = []; (document.querySelector('.view.on') || document).querySelectorAll('svg text').forEach(t => {
      if (!visible(t)) return; const m = t.getScreenCTM(), fs = parseFloat(getComputedStyle(t).fontSize) * (m ? m.a : 1);
      if (fs < 8.5) out.push({ text: t.textContent.slice(0, 20), px: +fs.toFixed(1) });
    }); return { tiny: out.length, list: out.slice(0, 6) };
  }

  function names() {
    const out = [];
    document.querySelectorAll('.view.on a,.view.on button,.rail a,.topbar button,.view.on input,.view.on select,.view.on textarea,[role=button]').forEach(e => {
      if (!visible(e) || e.closest('.sphere,.pods')) return;
      const n = (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || e.getAttribute('placeholder') || '').trim();
      if (!n && !(e.labels && e.labels.length)) out.push({ el: sel(e) });
    });
    return { unnamed: out.length, list: out.slice(0, 8) };
  }

  async function settle() {   // wait for entrance animations so nothing is measured mid-fade
    for (let i = 0; i < 40; i++) { const run = document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getTiming().iterations !== Infinity); if (!run.length) return; await new Promise(r => setTimeout(r, 100)); }
  }

  async function all(views) {
    const list = views || (window.OSX ? window.OSX.NAV.map(n => n[0]) : []), res = {};
    for (const v of list) {
      location.hash = '#/' + v; await new Promise(r => setTimeout(r, 500)); await settle();
      const c = contrast(), o = overlap(), k = keyboard(), t = targets(), nm = names(), sv = svgText();
      res[v] = { textNodes: c.total, contrastFail: c.fail, worst: c.worst.slice(0, 3), overlaps: o.overlaps, spill: o.spill.length, clipped: o.clip.length, hscroll: o.hscroll, kbdUnreachable: k.unreachable, kbdSample: k.list.slice(0, 3), smallTargets: t.small, unnamed: nm.unnamed, tinySvg: sv.tiny };
    }
    const sum = Object.values(res).reduce((a, r) => ({ text: a.text + r.textNodes, fail: a.fail + r.contrastFail, ov: a.ov + r.overlaps, sp: a.sp + r.spill, kb: a.kb + r.kbdUnreachable, tg: a.tg + r.smallTargets, nm: a.nm + r.unnamed, sv: a.sv + r.tinySvg }), { text: 0, fail: 0, ov: 0, sp: 0, kb: 0, tg: 0, nm: 0, sv: 0 });
    return { summary: sum, width: innerWidth, views: res };
  }

  window.__qa = { svgText, settle, contrast, overlap, keyboard, targets, names, all };
})();
