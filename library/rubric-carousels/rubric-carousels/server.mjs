// RUBRIC Carousels: review every Instagram carousel at once. One row per carousel, its cards in a horizontal strip.
// Open a card big, pin comments on it, approve it, pick the cover, drag cards into a new order, and add cards or whole
// carousels to a cart for your agent. Port 50009 by default.
//
// A carousel is a folder inside carousels/:   deck.js + index.html   (index.html is the card engine, copied from template/)
// Its snapshots:                              export/manifest.json + card and thumb images   (tools/export-cards.mjs)
// Your review:                                review.json   (written only by this app: cover pick, approvals, order, comments)
// Where it stands on Instagram (optional):    status.json   ({ "status": "draft" | "ready" | "scheduled" | "live", "at", "url" })
//
// Node built-ins only. No npm install. Start it:  node server.mjs   then open http://localhost:50009
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) { console.error('\n  RUBRIC Carousels needs Node.js 18 or newer. You are running ' + process.version + '\n'); process.exit(1); }

const HERE = path.dirname(fileURLToPath(import.meta.url));

// optional settings file: env.local (copy env.example). Real environment variables win over it.
const LOCAL = {};
try {
  for (const line of fs.readFileSync(path.join(HERE, 'env.local'), 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && m[2] !== '') LOCAL[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch (e) {}
const setting = k => process.env[k] || LOCAL[k] || '';

// ===== CONFIG: the one place that names a folder, a port or an address. =====
const CONFIG = {
  port: Number(process.argv[2]) || Number(setting('CAROUSELS_PORT')) || 50009,
  host: '127.0.0.1',                                                            // this computer only
  carouselsDir: path.resolve(HERE, setting('CAROUSELS_DIR') || 'carousels'),     // every subfolder with deck.js + index.html is a carousel (folders starting with _ are skipped)
  features: path.join(HERE, 'features'),                                         // the cart, click-to-comment, sidebar and Apply button, served at /features/
  assets: path.join(HERE, 'assets'),                                             // fonts and images for the app pages, served at /assets/
  exporter: path.join(HERE, 'tools', 'export-cards.mjs'),                        // makes the snapshots ("Refresh snapshots")
  osAddress: setting('CAROUSELS_OS_ADDRESS') || 'http://localhost:50000',        // the Agentic OS that runs "Apply all comments"; if nothing answers, the button copies instead
  token: setting('RUBRIC_TOKEN'),                                                // optional shared secret for every /api call
  maxBody: 1_000_000,                                                            // 1 MB cap on request bodies
};
// ===== end of CONFIG =====
const HOME_ORDER = path.join(CONFIG.carouselsDir, '_home.json');   // the homepage's drag order (slugs), saved by the app
const STATUSES = ['draft', 'ready', 'scheduled', 'live'];
fs.mkdirSync(CONFIG.carouselsDir, { recursive: true });

const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };
const isDir = f => { try { return fs.statSync(f).isDirectory(); } catch (e) { return false; } };   // statSync follows symlinks
const slash = p => String(p).replace(/\\/g, '/');
function writeAtomic(f, text) { const tmp = f + '.tmp'; fs.writeFileSync(tmp, text); fs.renameSync(tmp, f); }
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type + (/^text|json|javascript/.test(type) ? '; charset=utf-8' : ''), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

// can this computer make snapshots? The exporter needs Playwright (or playwright-core plus an installed Chrome).
function canExport() {
  const req = createRequire(path.join(HERE, 'package.json'));
  for (const m of ['playwright', 'playwright-core']) { try { req.resolve(m); return true; } catch (e) {} }
  return false;
}

// ---------- carousels ----------
function runs() {
  const dirs = [];
  try { for (const name of fs.readdirSync(CONFIG.carouselsDir)) { const d = path.join(CONFIG.carouselsDir, name); if (!name.startsWith('_') && !name.startsWith('.') && isDir(d)) dirs.push(d); } } catch (e) {}
  return dirs.filter(d => fs.existsSync(path.join(d, 'deck.js')) && fs.existsSync(path.join(d, 'index.html')));
}
const runBySlug = slug => runs().find(d => path.basename(d) === slug) || null;
const reviewFile = dir => path.join(dir, 'review.json');
const emptyReview = () => ({ version: 0, cover: null, order: null, approved: {}, comments: [] });
const readReview = dir => Object.assign(emptyReview(), readJSON(reviewFile(dir)) || {});

// where a carousel stands on Instagram: status.json in its folder, written by you or your agent. No file = Draft.
function statusOf(dir) {
  const s = readJSON(path.join(dir, 'status.json')) || {};
  const state = STATUSES.includes(String(s.status || '').toLowerCase()) ? String(s.status).toLowerCase() : 'draft';
  const url = /^https?:\/\//i.test(String(s.url || '')) ? String(s.url) : null;   // only web links, never javascript: or file:
  return { state, at: typeof s.at === 'string' ? s.at : null, url };
}
const created = {};
// the folder's own birth time: deck.js is rewritten on every edit, so its date moves
const bornAt = dir => created[dir] || (created[dir] = (() => { try { const s = fs.statSync(dir); return s.birthtimeMs || s.ctimeMs; } catch (e) { return 0; } })());

function summary(dir) {
  const slug = path.basename(dir), m = readJSON(path.join(dir, 'export', 'manifest.json')), r = readReview(dir);
  const kw = m && (m.keyword || (/Comment\s+"([A-Z0-9]+)"/.exec(m.caption || '') || [])[1]);
  return { slug, folder: slash(dir), manifest: m, exported: !!m, exportedAt: m && m.exportedAt, review: r,
    keyword: kw || null, created: bornAt(dir), post: statusOf(dir),
    updated: Math.max(mtime(path.join(dir, 'deck.js')), mtime(reviewFile(dir)), mtime(path.join(dir, 'export', 'manifest.json'))),
    stale: !!m && mtime(path.join(dir, 'deck.js')) > Date.parse(m.exportedAt || 0) };
}

// ---------- snapshots (the exporter runs in the background, one per carousel at a time) ----------
const jobs = {};
function startExport(slug, dir) {
  if (jobs[slug] && jobs[slug].running) return jobs[slug];
  if (!canExport()) return (jobs[slug] = { running: false, ok: false, error: 'Snapshots need Playwright. In this folder run: npm install playwright-core (uses your installed Chrome), then try again.' });
  const job = jobs[slug] = { running: true, started: Date.now(), log: '', ok: null };
  let p;
  try { p = spawn(process.execPath, [CONFIG.exporter, dir], { windowsHide: true, cwd: HERE }); }
  catch (e) { Object.assign(job, { running: false, ok: false, error: String(e.message || e) }); return job; }
  const add = d => { job.log = (job.log + d.toString()).slice(-2000); };
  p.stdout.on('data', add); p.stderr.on('data', add);
  p.on('error', e => { Object.assign(job, { running: false, ok: false, error: String(e.message || e) }); });
  p.on('close', code => { job.running = false; job.ok = code === 0; job.ended = Date.now(); if (code !== 0) job.error = job.log.trim().split('\n').slice(-2).join(' ').slice(0, 300) || 'The exporter stopped with code ' + code; });
  return job;
}

// ---------- static files, with byte ranges so videos seek ----------
function serveFile(req, res, file) {
  let st; try { st = fs.statSync(file); } catch (e) { return send(res, 404, { error: 'not found' }); }
  if (!st.isFile()) return send(res, 404, { error: 'not found' });
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range && type === 'video/mp4') {
    const start = range[1] ? +range[1] : 0, end = range[2] ? Math.min(+range[2], st.size - 1) : st.size - 1;
    if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type + (/^text|javascript/.test(type) ? '; charset=utf-8' : ''), 'Content-Length': st.size, 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
    'Cache-Control': /\.(jpg|png|mp4)$/i.test(file) && slash(file).includes('/export/') ? 'no-cache' : 'no-store' });
  fs.createReadStream(file).pipe(res);
}
// a path inside base, or null: path.resolve plus a prefix check that ends at a folder boundary
function inside(base, rel) {
  const root = path.resolve(base), f = path.resolve(root, rel);
  return f === root || f.startsWith(root + path.sep) ? f : null;
}
function body(req) {
  return new Promise((ok, no) => {
    let s = '', size = 0;
    const onData = d => { size += d.length; if (size > CONFIG.maxBody) { const e = new Error('too large'); e.code = 413; req.removeListener('data', onData); req.resume(); no(e); return; } s += d; };   // over the cap: answer 413 and drain the rest unread
    req.on('data', onData);
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch (e) { e.code = 400; no(e); } });
    req.on('error', no);
  });
}
// the app pages, with the optional token handed to the page (same origin only)
function page(name) {
  let html = fs.readFileSync(path.join(HERE, name), 'utf8');
  if (CONFIG.token) html = html.replace('<head>', '<head><script>window.RUBRIC_TOKEN=' + JSON.stringify(CONFIG.token).replace(/</g, '\\u003c') + ';</script>');
  return html;
}

// ---------- routes ----------
const server = http.createServer(async (req, res) => {
  let u, p;
  try { u = new URL(req.url, 'http://x'); p = decodeURIComponent(u.pathname); } catch (e) { return send(res, 400, { error: 'bad address' }); }
  try {
    // DNS rebinding guard: only answer requests addressed to this computer by name
    const host = String(req.headers.host || '').replace(/:\d+$/, '').toLowerCase();
    if (host && !['localhost', '127.0.0.1', '[::1]'].includes(host)) return send(res, 403, { error: 'unknown host' });

    if (p.startsWith('/api/')) {
      // API calls from another website are refused: no CORS headers are ever sent, and a foreign Origin gets 403
      const origin = req.headers.origin;
      if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return send(res, 403, { error: 'other sites cannot use this API' });
      if (origin && new URL(origin).port !== String(CONFIG.port)) return send(res, 403, { error: 'other pages cannot use this API' });
      if (CONFIG.token && req.headers['x-rubric-token'] !== CONFIG.token) return send(res, 401, { error: 'missing or wrong x-rubric-token' });
      if (['PUT', 'POST'].includes(req.method) && !/^application\/json/i.test(String(req.headers['content-type'] || '')))
        return send(res, 415, { error: 'send JSON' });
    }

    if (p === '/__health') return send(res, 200, { ok: true, app: 'rubric-carousels', port: CONFIG.port });
    if (p === '/' || p === '/home.html') return send(res, 200, page('home.html'), 'text/html');   // the homepage: one card per carousel
    if (p === '/review' || p === '/index.html') return send(res, 200, page('index.html'), 'text/html');   // review rows; ?c=<slug> shows one
    if (p.startsWith('/features/')) { const f = inside(CONFIG.features, p.slice(10)); return f ? serveFile(req, res, f) : send(res, 404, {}); }
    if (p.startsWith('/assets/')) { const f = inside(CONFIG.assets, p.slice(8)); return f ? serveFile(req, res, f) : send(res, 404, {}); }

    if (p === '/api/info') return send(res, 200, { app: 'rubric-carousels', kitFolder: slash(HERE), carouselsFolder: slash(CONFIG.carouselsDir),
      exporter: slash(CONFIG.exporter), canExport: canExport(), osAddress: CONFIG.osAddress });
    if (p === '/api/carousels') return send(res, 200, runs().map(summary).sort((a, b) => b.updated - a.updated));
    if (p === '/api/home-order') {
      if (req.method === 'PUT') {
        const next = await body(req);
        const order = Array.isArray(next.order) ? next.order.filter(s => typeof s === 'string').slice(0, 5000) : [];
        writeAtomic(HOME_ORDER, JSON.stringify({ order, saved: new Date().toISOString() }, null, 1) + '\n');
        return send(res, 200, { order });
      }
      return send(res, 200, readJSON(HOME_ORDER) || { order: [] });
    }

    let m = /^\/c\/([^/]+)\/(.+)$/.exec(p);
    if (m) { const dir = runBySlug(m[1]); const f = dir && inside(dir, m[2]); return f ? serveFile(req, res, f) : send(res, 404, { error: 'not found' }); }

    m = /^\/api\/review\/([^/]+)$/.exec(p);
    if (m) {
      const dir = runBySlug(m[1]); if (!dir) return send(res, 404, { error: 'no such carousel' });
      if (req.method === 'GET') return send(res, 200, readReview(dir));
      if (req.method === 'PUT') {
        const next = await body(req), cur = readReview(dir);
        if (next.version !== cur.version) return send(res, 409, cur);   // another tab saved first: the page reloads this one
        const keep = { version: cur.version + 1, cover: typeof next.cover === 'string' ? next.cover : null,
          order: Array.isArray(next.order) ? next.order.filter(Number.isInteger) : null,
          approved: next.approved && typeof next.approved === 'object' && !Array.isArray(next.approved) ? next.approved : {},
          comments: Array.isArray(next.comments) ? next.comments.filter(c => c && typeof c === 'object') : [],
          saved: new Date().toISOString() };
        writeAtomic(reviewFile(dir), JSON.stringify(keep, null, 1) + '\n');
        return send(res, 200, keep);
      }
      return send(res, 405, { error: 'GET or PUT' });
    }

    m = /^\/api\/export\/([^/]+)$/.exec(p);
    if (m) {
      const dir = runBySlug(m[1]); if (!dir) return send(res, 404, { error: 'no such carousel' });
      if (req.method === 'POST') return send(res, 200, startExport(m[1], dir));
      return send(res, 200, jobs[m[1]] || { running: false });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, e.code === 413 ? 413 : e.code === 400 ? 400 : 500, { error: e.code === 413 ? 'request too large (1 MB max)' : String(e.message || e) }); }
});
server.on('error', e => {
  if (e.code === 'EADDRINUSE') { console.error('\n  Port ' + CONFIG.port + ' is in use. Start on another one: node server.mjs 50019 (or set CAROUSELS_PORT in env.local)\n'); process.exit(1); }
  throw e;
});
server.listen(CONFIG.port, CONFIG.host, () => console.log(`RUBRIC Carousels on http://localhost:${CONFIG.port}/  (carousels folder: ${slash(CONFIG.carouselsDir)})`));
