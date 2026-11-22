// RUBRIC Recos: ways to make your agent setup better, sorted by ARMS (Apps, Routines, Memory, Skills).
// You skip what you don't want, mark what's done, and add picks to the agent cart.
//
// The recos:    data/recos.js    (written by your agent when it runs /recos, read on every page load)
// Your choices: data/state.json  (written only by this app: skipped, done, comments)
// A skipped id stays hidden after a reload and after recos.js is rewritten, because the skip lives in state.json.
//
// Node 18+ and Node built-ins only. No npm install. Start it:  node server.mjs   then open http://localhost:50013
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error('\n  RUBRIC Recos needs Node.js 18 or newer. You are running ' + process.version + '\n'); process.exit(1); }

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ===== CONFIG: the one place that names a folder, a port or an address. =====
const CONFIG = {
  port: Number(process.argv[2]) || Number(process.env.RECOS_PORT) || 50013,
  host: '127.0.0.1',                                                   // this computer only, never your network
  dataDir: process.env.RECOS_DATA || path.join(HERE, 'data'),          // recos.js and state.json
  // The Agentic OS runs "Apply all comments" and is where the Home button goes. Set it to '' to hide both.
  agenticOs: process.env.AGENTIC_OS ?? 'http://localhost:50000',
  token: process.env.RUBRIC_TOKEN || '',                               // optional: when set, every /api call must send it
};
// ===== end of CONFIG =====

const RECOS = path.join(CONFIG.dataDir, 'recos.js');
const STATE = path.join(CONFIG.dataDir, 'state.json');
const FEATURES = path.join(HERE, 'features');   // the cart, comments, Apply and Home buttons, served at /features/
const ASSETS = path.join(HERE, 'assets');       // fonts and the banner, served at /assets/
const MAX_BODY = 1_000_000;                     // 1 MB cap on anything posted to the app
const EMPTY_RECOS = 'window.RECOS = { built: "", footer: "", letters: { A: { name: "Apps" }, R: { name: "Routines" }, M: { name: "Memory" }, S: { name: "Skills" } }, items: [] };\n';

const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
function writeAtomic(f, text) { const tmp = f + '.tmp'; fs.writeFileSync(tmp, text); fs.renameSync(tmp, f); }
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type + '; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain' };

// ---------- your choices ----------
const emptyState = () => ({ skipped: {}, done: {}, comments: [] });
const readState = () => Object.assign(emptyState(), readJSON(STATE) || {});
function saveState(s) {
  fs.mkdirSync(CONFIG.dataDir, { recursive: true });
  s.saved = new Date().toISOString();
  writeAtomic(STATE, JSON.stringify(s, null, 1) + '\n');
  return s;
}
const okId = id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,59}$/i.test(id);
// a skip or done mark is one id on or off, so two tabs never fight: each change reads the file fresh, then writes
function mark(field, id, on) {
  const s = readState();
  if (on) s[field][id] = new Date().toISOString(); else delete s[field][id];
  return saveState(s);
}

// ---------- helpers ----------
function serveFile(res, file) {
  let st; try { st = fs.statSync(file); } catch (e) { return send(res, 404, { error: 'not found' }); }
  if (!st.isFile()) return send(res, 404, { error: 'not found' });
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': type + (/^text|json/.test(type) ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(file).pipe(res);
}
// path traversal guard: the resolved file must sit inside base, never beside it
function inside(base, rel) {
  const root = path.resolve(base), f = path.resolve(root, rel);
  return f === root || f.startsWith(root + path.sep) ? f : null;
}
class TooBig extends Error {}
function body(req) {
  return new Promise((ok, no) => {
    let s = '', size = 0, done = false;
    req.on('data', d => { if (done) return; size += d.length; if (size > MAX_BODY) { done = true; no(new TooBig()); return; } s += d; });
    req.on('end', () => { if (done) return; try { ok(JSON.parse(s || '{}')); } catch (e) { no(e); } });
  });
}
// only pages served from this computer by name: blocks a website that points its own domain at 127.0.0.1 (DNS rebinding)
function okHost(req) {
  const h = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}
// the page settings, written into the page so it starts with them. JSON with < escaped, so no data can close the tag.
function pageConfig() {
  const c = JSON.stringify({ agenticOs: CONFIG.agenticOs, recosFile: RECOS.split(path.sep).join('/'), tokenRequired: !!CONFIG.token }).replace(/</g, '\\u003c');
  return '<script>window.RECOS_CONFIG = ' + c + ';</script>';
}

// ---------- routes ----------
const server = http.createServer(async (req, res) => {
  if (!okHost(req)) return send(res, 403, { error: 'open the app at http://localhost:' + CONFIG.port });
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { return send(res, 400, { error: 'bad address' }); }
  try {
    if (p === '/__health') return send(res, 200, { ok: true, app: 'rubric-recos', port: CONFIG.port });
    if (p === '/' || p === '/index.html') {   // read on every request, so a page fix needs no restart
      return send(res, 200, fs.readFileSync(path.join(HERE, 'index.html'), 'utf8').replace('<!--RECOS_CONFIG-->', pageConfig()), 'text/html');
    }
    if (p === '/recos.js') return fs.existsSync(RECOS) ? serveFile(res, RECOS) : send(res, 200, EMPTY_RECOS, 'text/javascript');
    if (p.startsWith('/features/')) { const f = inside(FEATURES, p.slice(10)); return f ? serveFile(res, f) : send(res, 404, { error: 'not found' }); }
    if (p.startsWith('/assets/')) { const f = inside(ASSETS, p.slice(8)); return f ? serveFile(res, f) : send(res, 404, { error: 'not found' }); }

    if (p.startsWith('/api/')) {
      if (CONFIG.token && req.headers['x-rubric-token'] !== CONFIG.token) return send(res, 401, { error: 'token required' });
      // every write must be JSON: a plain form on another website cannot send that without the browser asking first, and this app never says yes
      if (req.method !== 'GET' && !/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) return send(res, 415, { error: 'send JSON' });
      if (p === '/api/state' && req.method === 'GET') return send(res, 200, readState());
      if ((p === '/api/skip' || p === '/api/done') && req.method === 'POST') {
        const b = await body(req);
        if (!okId(b.id)) return send(res, 400, { error: 'bad id' });
        const s = p === '/api/skip' ? mark('skipped', b.id, !b.undo) : mark('done', b.id, b.on !== false);
        return send(res, 200, s);
      }
      if (p === '/api/comments' && req.method === 'PUT') {
        const b = await body(req);
        if (!Array.isArray(b.comments)) return send(res, 400, { error: 'comments must be a list' });
        const s = readState(); s.comments = b.comments;
        return send(res, 200, saveState(s));
      }
    }
    send(res, 404, { error: 'not found' });
  } catch (e) {
    if (e instanceof TooBig) { send(res, 413, { error: 'too big (1 MB max)' }); req.destroy(); return; }
    if (e instanceof SyntaxError) return send(res, 400, { error: 'bad JSON' });
    send(res, 500, { error: String(e.message || e) });
  }
});
server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.error('\n  Port ' + CONFIG.port + ' is in use. Start on another one:  node server.mjs 50113\n'); process.exit(1); }
  throw e;
});
server.listen(CONFIG.port, CONFIG.host, () => console.log(`RUBRIC Recos on http://localhost:${CONFIG.port}/  (data in ${CONFIG.dataDir})`));
