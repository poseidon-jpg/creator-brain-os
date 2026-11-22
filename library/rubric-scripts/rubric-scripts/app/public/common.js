// RUBRIC Scripts: what both pages share. Theme, the store (scripts + your saved work), and small helpers.
(function () {
  const root = document.documentElement;
  const local = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private window: the page still works */ } }
  };

  // ---------- theme: dark first, the toggle flips to paper, the choice is remembered on this computer ----------
  function applyTheme(t) { root.setAttribute('data-theme', t); root.style.colorScheme = t; }
  applyTheme(local.get('robo-theme') || 'dark');
  function wireTheme(btn) {
    if (!btn) return;
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      local.set('robo-theme', next); applyTheme(next); btn.blur();
    });
  }

  // ---------- helpers ----------
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const words = t => (String(t || '').match(/[A-Za-z0-9'’$%.-]+/g) || []).filter(w => /[A-Za-z0-9]/.test(w)).length;
  const secs = w => Math.max(1, Math.round(w / 3.8));          // about 3.8 spoken words a second, a fast short-video pace
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const ms = d => (d ? (typeof d === 'number' ? d : Date.parse(d)) || 0 : 0);
  const day = d => { const t = ms(d); if (!t) return '-'; const x = new Date(t); return x.getDate() + ' ' + MON[x.getMonth()]; };
  const ago = d => {
    const t = ms(d); if (!t) return '-'; const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' h ago';
    return Math.round(h / 24) < 7 ? Math.round(h / 24) + ' d ago' : day(t);
  };
  // the script's drawing comes from data/scripts.json; keep it to drawing tags only
  const cleanSvg = s => String(s || '').replace(/<\/?(script|foreignObject|iframe|style)[^>]*>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '').replace(/javascript:/gi, '');
  const art = (s, size) => '<svg class="art" viewBox="0 0 48 48" width="' + size + '" height="' + size + '" aria-hidden="true">' +
    (cleanSvg(s.icon) || '<path d="M14 8h14l8 8v24H14z"/><path class="a" d="M18 22h14"/><path d="M18 29h14M18 35h9"/>') + '</svg>';

  // ---------- the store: GET /api/data once, then every change saves the whole state with the version it was based on ----------
  const Store = {
    scripts: [], state: null, problems: [], status: '', listeners: [],
    on(fn) { this.listeners.push(fn); },
    emit(kind) { this.listeners.forEach(fn => { try { fn(kind); } catch (e) { console.error(e); } }); },
    async load() {
      const r = await fetch('/api/data', { cache: 'no-store' });
      const d = await r.json();
      this.scripts = d.scripts || []; this.problems = d.problems || []; this.state = d.state;
      this.tidy();
      return this;
    },
    tidy() {
      const st = this.state; st.items = st.items || {}; st.order = Array.isArray(st.order) ? st.order : [];
      if (st.tone == null) st.tone = true;
      const ids = this.scripts.map(s => s.id);
      st.order = st.order.filter(id => ids.includes(id)).concat(ids.filter(id => !st.order.includes(id)));
    },
    item(id) {
      const it = (this.state.items[id] = this.state.items[id] || {});
      it.comments = it.comments || []; it.edits = it.edits || {}; it.refs = it.refs || []; if (it.note == null) it.note = '';
      return it;
    },
    ordered() { const by = new Map(this.scripts.map(s => [s.id, s])); return this.state.order.map(id => by.get(id)).filter(Boolean); },
    byId(id) { return this.scripts.find(s => s.id === id); },
    hookId(s) { const it = this.state.items[s.id]; const h = it && it.hook; return s.hooks.some(x => x.id === h) ? h : s.hook; },
    hookText(s, hid) { const it = this.state.items[s.id], e = it && it.edits && it.edits.hooks && it.edits.hooks[hid]; const h = s.hooks.find(x => x.id === hid); return e != null ? e : (h ? h.text : ''); },
    body(s) { const it = this.state.items[s.id]; return it && it.edits && it.edits.body != null ? it.edits.body : s.body; },
    caption(s) { const it = this.state.items[s.id]; return it && it.edits && it.edits.caption != null ? it.edits.caption : s.caption; },
    edited(s) { const it = this.state.items[s.id]; return it && it.touched ? Math.max(ms(s.updated), it.touched) : ms(s.updated); },
    openComments(s) { const it = this.state.items[s.id]; return it && it.comments ? it.comments.filter(c => !c.applied) : []; },
    touch(id) { this.item(id).touched = Date.now(); },
    timer: 0, saving: false, again: false,
    save() { clearTimeout(this.timer); this.setStatus('Saving'); this.timer = setTimeout(() => this.flush(), 350); },
    async flush() {
      if (this.saving) { this.again = true; return; }
      this.saving = true;
      try {
        const r = await fetch('/api/state', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rev: this.state.rev, state: this.state }) });
        const d = await r.json();
        if (r.status === 409) {
          // another tab (or your agent) saved first: take the newer state from disk, so nothing newer is overwritten
          this.state = d.state; this.tidy(); this.setStatus('Updated from disk'); this.emit('reload');
          toast('Someone saved this first, so the page now shows the newer version. Make your last change again.');
        } else if (d.ok) { this.state.rev = d.rev; this.setStatus('Saved'); }
        else this.setStatus('Not saved');
      } catch (e) { this.setStatus('Offline, not saved'); }
      this.saving = false;
      if (this.again) { this.again = false; this.flush(); }
    },
    setStatus(t) { this.status = t; const el = document.getElementById('saveState'); if (el) { el.textContent = t; clearTimeout(this.st); if (t === 'Saved') this.st = setTimeout(() => { el.textContent = ''; }, 1600); } },
    // pick up what the agent wrote while you were away (new scripts, applied comments), unless a save is waiting
    async refresh() {
      if (this.saving || this.timer && this.status === 'Saving') return false;
      try {
        const r = await fetch('/api/data', { cache: 'no-store' }); const d = await r.json();
        const changed = JSON.stringify(d.scripts) !== JSON.stringify(this.scripts) || (d.state && d.state.rev !== this.state.rev);
        if (!changed) return false;
        this.scripts = d.scripts || []; this.problems = d.problems || []; this.state = d.state; this.tidy(); this.emit('reload'); return true;
      } catch (e) { return false; }
    }
  };

  function toast(msg, t) {
    let el = document.getElementById('toast');
    if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, t || 3200);
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } ta.remove(); return ok;
    }
  }

  // ---------- the hand-off to the agent: comments, notes and edits, plus the /tone instruction (on by default) ----------
  function exportText(scripts, scope) {
    const st = Store.state, d = new Date(), pad = n => (n < 10 ? '0' : '') + n, out = [], body = [];
    let count = 0;
    scripts.forEach(s => {
      const it = st.items[s.id] || {}, cm = (it.comments || []).filter(c => !c.applied), e = it.edits || {};
      const editedHooks = Object.keys(e.hooks || {}), note = (it.note || '').trim(), refs = it.refs || [];
      const has = cm.length || note || editedHooks.length || e.body != null || e.caption != null || refs.length;
      if (!has && scope !== 'one') return;
      const n = Store.state.order.indexOf(s.id) + 1, hid = Store.hookId(s);
      body.push('## ' + n + '. ' + s.title + ' (' + s.keyword + '), hook ' + hid.toUpperCase() + ' chosen');
      if (note) body.push('- Note: ' + note.replace(/\n+/g, ' / '));
      (it.comments || []).forEach((c, i) => { if (!c.applied) body.push('- Comment ' + (i + 1) + ' [' + c.where + '] on "' + c.quote.replace(/\s+/g, ' ') + '": ' + (c.note || '(no text)')); });
      refs.forEach(r => body.push('- Reference added: ' + [r.label, r.url, r.note].filter(Boolean).join(', ')));
      editedHooks.forEach(h => body.push('', '### Edited hook ' + h.toUpperCase(), '', e.hooks[h]));
      if (e.body != null) body.push('', '### Edited script', '', e.body);
      if (e.caption != null) body.push('', '### Edited caption', '', e.caption);
      if (!has) body.push('- No comments, notes or edits yet.');
      count += cm.length + (note ? 1 : 0) + editedHooks.length + (e.body != null ? 1 : 0) + (e.caption != null ? 1 : 0) + refs.length;
      body.push('');
    });
    out.push('# RUBRIC Scripts comments, ' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + (scope === 'one' && scripts[0] ? ', ' + scripts[0].keyword : ', all scripts'), '');
    out.push(st.tone
      ? 'For my agent: apply each comment to its script in data/scripts.json and mark it applied. Then fold what these comments teach about how I talk into my /tone skill, so my next scripts sound more like me.'
      : 'For my agent: apply each comment to its script in data/scripts.json and mark it applied. Leave my /tone skill as it is this time.', '');
    if ((st.note || '').trim()) { out.push('## Across all scripts', '', st.note.trim(), ''); count++; }
    out.push(...body);
    if (!count && scope !== 'one') out.push('(no comments, notes or edits yet)');
    return { text: out.join('\n').split(String.fromCharCode(0x2014)).join(' - '), count };   // never hand a long dash to the agent
  }

  window.RS = { local, esc, words, secs, day, ago, ms, art, Store, toast, copyText, exportText, wireTheme };
})();
