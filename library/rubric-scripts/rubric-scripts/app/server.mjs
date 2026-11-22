// RUBRIC Scripts: a small app you run on your own computer to review short-video scripts.
// Node only, no npm install. Start it from this folder:  node server.mjs [port]
//
// Your agent writes the scripts to data/scripts.json. Everything you do in the app (hook picks, highlights and
// comments, edits, notes, the card order) saves to data/state.json, so your agent can read it straight from disk.
//
//   GET  /                 the homepage (every script)
//   GET  /s/<id>           one script
//   GET  /api/data         { scripts, state, problems }
//   POST /api/state        { rev, state }  -> { ok, rev }   (409 + the newer state when another tab saved first)
//   GET  /api/health       { ok, port, scripts }

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- CONFIG: change these here, or with the environment variables named beside them ----------
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.argv[2] || process.env.RUBRIC_SCRIPTS_PORT) || 50011;           // RUBRIC_SCRIPTS_PORT
const DATA = path.resolve(process.env.RUBRIC_SCRIPTS_DATA || path.join(HERE, 'data'));       // RUBRIC_SCRIPTS_DATA
// ---------- END CONFIG ----------

const PUBLIC = path.join(HERE, 'public');
const SCRIPTS = path.join(DATA, 'scripts.json');
const STATE = path.join(DATA, 'state.json');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

const readJson = (f, fallback) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return fallback; } };
const emptyState = () => ({ rev: 0, order: [], note: '', tone: true, items: {} });

// The scripts file is written by an agent, so the app tidies a slightly odd file instead of breaking, and lists what it fixed.
function loadScripts() {
  const problems = [];
  if (!fs.existsSync(SCRIPTS)) return { scripts: [], problems: ['No data/scripts.json yet. Ask your agent to run /rubricscripts.'] };
  const raw = readJson(SCRIPTS, null);
  if (!raw || !Array.isArray(raw.scripts)) return { scripts: [], problems: ['data/scripts.json is not valid JSON with a "scripts" list. Run: node check.mjs'] };
  const seen = new Set();
  const scripts = raw.scripts.filter(s => s && typeof s === 'object').map((s, i) => {
    let id = String(s.id || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'script-' + (i + 1);
    if (seen.has(id)) { problems.push('Two scripts share the id "' + id + '"; the second one shows as ' + id + '-' + (i + 1)); id = id + '-' + (i + 1); }
    seen.add(id);
    const hooks = (Array.isArray(s.hooks) ? s.hooks : []).filter(h => h && h.text).slice(0, 5)
      .map((h, j) => ({ id: String(h.id || 'h' + (j + 1)).toLowerCase(), note: String(h.note || ''), text: String(h.text) }));
    if (!hooks.length) problems.push('"' + id + '" has no hooks');
    return {
      id, keyword: String(s.keyword || '').toUpperCase(), title: String(s.title || id), tags: Array.isArray(s.tags) ? s.tags.map(String) : [],
      icon: String(s.icon || ''), created: s.created || null, updated: s.updated || s.created || null,
      hooks, hook: hooks.some(h => h.id === s.hook) ? s.hook : (hooks[0] || {}).id || null,
      body: String(s.body || ''), caption: String(s.caption || '').replace(/^\s*comment\s+["'“][^\n]*\n+/i, ''),
      references: (Array.isArray(s.references) ? s.references : []).filter(r => r && (r.url || r.note || r.label))
        .map(r => ({ label: String(r.label || ''), url: String(r.url || ''), note: String(r.note || '') })),
      video: s.video || null,
      channels: Array.isArray(s.channels) && s.channels.length ? s.channels.map(String) : ['tiktok', 'instagram', 'threads', 'youtube-shorts']
    };
  });
  return { scripts, problems };
}

function loadState() {
  const st = readJson(STATE, null);
  return st && typeof st === 'object' ? Object.assign(emptyState(), st) : emptyState();
}
function saveState(st) {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(STATE + '.tmp', JSON.stringify(st, null, 1));
  fs.renameSync(STATE + '.tmp', STATE);
}

const send = (res, code, type, body) => { res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' }); res.end(body); };
const json = (res, obj, code = 200) => send(res, code, 'application/json', JSON.stringify(obj));
function readBody(req) {
  return new Promise((ok, bad) => { let s = ''; req.on('data', c => { s += c; if (s.length > 1e6) req.destroy(); }); req.on('end', () => ok(s)); req.on('error', bad); });
}
function sendFile(res, f) {
  let st; try { st = fs.statSync(f); } catch (e) { return send(res, 404, 'text/plain', 'not found'); }
  if (!st.isFile()) return send(res, 404, 'text/plain', 'not found');
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Content-Length': st.size });
  fs.createReadStream(f).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = decodeURIComponent(u.pathname);
  // only this app's own pages may write (a page on another website cannot post to your localhost)
  const origin = req.headers.origin;
  if (req.method === 'POST' && origin && origin !== 'http://' + req.headers.host) return json(res, { ok: false, message: 'origin not allowed' }, 403);
  try {
    if (p === '/api/health') return json(res, { ok: true, port: PORT, data: DATA, scripts: loadScripts().scripts.length });
    if (p === '/api/data' && req.method === 'GET') { const d = loadScripts(); return json(res, { scripts: d.scripts, problems: d.problems, state: loadState() }); }
    if (p === '/api/state' && req.method === 'POST') {
      const inp = JSON.parse(await readBody(req) || '{}'), cur = loadState();
      if (!inp.state || typeof inp.state !== 'object') return json(res, { ok: false, message: 'no state sent' }, 400);
      if (Number(inp.rev) !== Number(cur.rev)) return json(res, { ok: false, stale: true, rev: cur.rev, state: cur }, 409);
      const next = Object.assign(emptyState(), inp.state, { rev: cur.rev + 1, updated: new Date().toISOString() });
      saveState(next);
      return json(res, { ok: true, rev: next.rev });
    }
    if (p === '/' || p === '/index.html') return sendFile(res, path.join(PUBLIC, 'index.html'));
    if (/^\/s\/[\w-]+\/?$/.test(p)) return sendFile(res, path.join(PUBLIC, 'script.html'));
    const f = path.normalize(path.join(PUBLIC, p));
    if (!f.startsWith(PUBLIC + path.sep)) return send(res, 404, 'text/plain', 'not found');
    return sendFile(res, f);
  } catch (e) {
    console.error(new Date().toISOString(), p, e);
    return json(res, { ok: false, message: String(e && e.message || e) }, 500);
  }
});
server.listen(PORT, '127.0.0.1', () => console.log('RUBRIC Scripts on http://localhost:' + PORT + '  (data: ' + DATA + ')'));
