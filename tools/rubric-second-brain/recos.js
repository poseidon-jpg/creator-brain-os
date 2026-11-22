/* recos.js - reads the RUBRIC Recos data (written by /recos) and keeps the same skip/done state file the
   standalone app uses, so the OS view and the app on port 50013 always agree. Also keeps weekly history so
   the OS can say what changed. Local files only, no network. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dirOf = root => path.join(root, 'tools', 'micro-apps', 'rubric-recos', 'data');
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const writeAtomic = (f, text) => { const tmp = f + '.tmp'; fs.writeFileSync(tmp, text); fs.renameSync(tmp, f); };
const okId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/i.test(id);

/* The file is JavaScript (the agent writes it). Run it in a context with no host objects, take it out as JSON text,
   then rebuild every field as a plain string, number or list so a bad file cannot crash or inject into the page. */
const str = (v, max) => (typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '').slice(0, max);
function readRecos(root) {
  const f = path.join(dirOf(root), 'recos.js');
  let src, json; try { src = fs.readFileSync(f, 'utf8'); } catch { return null; }
  if (src.length > 400000) return null;
  try {
    const ctx = vm.createContext(Object.create(null), { microtaskMode: 'afterEvaluate' });   // promise jobs count against the timeout too
    vm.runInContext('var window = {};\n' + src + '\n;', ctx, { timeout: 300, filename: 'recos.js' });
    json = vm.runInContext('JSON.stringify(window.RECOS)', ctx, { timeout: 300 });
  } catch { return null; }
  let R; try { R = JSON.parse(json); } catch { return null; }
  if (!R || !Array.isArray(R.items)) return null;
  const letters = {}; for (const L of ['A', 'R', 'M', 'S']) letters[L] = { name: str(R.letters && R.letters[L] && R.letters[L].name, 40) || L };
  const lvl = v => (['low', 'mid', 'high'].includes(v) ? v : '');
  const seen = new Set(), items = [];
  for (const it of R.items.slice(0, 60)) {
    if (!it || typeof it !== 'object' || !okId(it.id) || seen.has(it.id) || !letters[it.letter] || !str(it.title, 200)) continue;
    seen.add(it.id);
    items.push({
      id: it.id, letter: it.letter, pri: lvl(it.pri), rank: Number.isFinite(+it.rank) ? Math.max(0, Math.min(99, Math.round(+it.rank))) : 0, effort: lvl(it.effort), saves: lvl(it.saves),
      savesNote: str(it.savesNote, 300), title: str(it.title, 200), benefit: str(it.benefit, 800), action: str(it.action, 600), source: str(it.source, 800),
      touches: Array.isArray(it.touches) ? it.touches.slice(0, 5).map(t => str(t, 120)) : [], svg: str(it.svg, 2000),
    });
  }
  return { built: str(R.built, 40), footer: str(R.footer, 300), letters, items };
}
const readState = root => Object.assign({ skipped: {}, done: {}, comments: [] }, readJSON(path.join(dirOf(root), 'state.json')) || {});
function saveState(root, s) {
  const d = dirOf(root); fs.mkdirSync(d, { recursive: true });
  s.saved = new Date().toISOString();
  writeAtomic(path.join(d, 'state.json'), JSON.stringify(s, null, 1) + '\n');
  return s;
}
function mark(root, field, id, on) {
  if (!okId(id)) throw new Error('bad id');
  const s = readState(root);
  if (on) { s[field][id] = new Date().toISOString(); delete s[field === 'done' ? 'skipped' : 'done'][id]; }   // one state at a time
  else delete s[field][id];
  return saveState(root, s);
}

/* ---- weekly history: one small snapshot per day at most, enough to say "what changed since last week" ---- */
const histFile = root => path.join(root, 'tools', 'rubric-second-brain', 'data', 'history.json');
function readHistory(root) { const h = readJSON(histFile(root)); return Array.isArray(h) ? h : []; }
function snapshot(root, usage, recos) {
  const h = readHistory(root), now = Date.now(), last = h[h.length - 1];
  if (last && now - last.t < 20 * 3600e3) return h;
  const st = readState(root);
  h.push({
    t: now,
    d7usd: usage ? +usage.windows.d7.usd.toFixed(2) : null,
    d7tok: usage ? usage.windows.d7.tok : null,
    recos: recos ? recos.items.map(i => i.id) : [],
    done: Object.keys(st.done), skipped: Object.keys(st.skipped),
  });
  try { fs.mkdirSync(path.dirname(histFile(root)), { recursive: true }); writeAtomic(histFile(root), JSON.stringify(h.slice(-120))); } catch { }
  return h;
}
/* compare now with the newest snapshot that is at least ~5 days old (else the oldest one) */
function delta(root, recos) {
  const h = readHistory(root); if (!h.length || !recos) return null;
  const cut = Date.now() - 5 * 864e5;
  const base = [...h].reverse().find(x => x.t <= cut) || h[0];
  if (Date.now() - base.t < 3600e3) return null;
  const now = new Set(recos.items.map(i => i.id)), was = new Set(base.recos || []);
  return { since: base.t, added: [...now].filter(i => !was.has(i)), resolved: [...was].filter(i => !now.has(i)), d7usd: base.d7usd };
}

function get(root) {
  const R = readRecos(root); if (!R) return { error: 'no recos yet', installed: fs.existsSync(dirOf(root)) };
  return { ...R, state: readState(root), delta: delta(root, R) };
}
module.exports = { get, mark, snapshot, readHistory, readRecos, readState };
