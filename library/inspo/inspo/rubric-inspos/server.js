// RUBRIC Inspos - serves the Inspos wall and its small API.
// Runs on its own (node server.js, then open http://127.0.0.1:5059) or as a tab inside the
// RUBRIC console, which starts this server for you and forwards /api/inspos to it.
//
//   GET  /             the page
//   GET  /api/inspos   your saved videos, or two examples until you save your first one
//   POST /api/inspos   {"inspos":[...]} replace all  |  a video object: add to the top  |  {"delete":"<id>"}
//
// Security: binds 127.0.0.1 only, sends no CORS headers, caps request bodies at 1 MB,
// optional RUBRIC_TOKEN shared secret, reads and writes one JSON file, makes no outside calls.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error('\n  Requires Node.js 18+. You are running ' + process.version + '\n');
  process.exit(1);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));

// env.local loader (zero dependencies). Real environment variables win over the file.
try {
  const text = fs.readFileSync(path.join(HERE, 'env.local'), 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (v && !process.env[k]) process.env[k] = v;
  }
} catch (_) { /* env.local is optional */ }

const PORT = parseInt(process.env.PORT || '5059', 10);
const INSPOS_FILE = path.resolve(process.env.INSPOS_FILE || path.join(os.homedir(), 'inspos', 'inspos.json'));
const EXAMPLES_FILE = path.join(HERE, 'data', 'example-inspos.json');
const MAX_BODY = 1_000_000;
const VALID_ID = /^[A-Za-z0-9_-]{11}$/;

function sendJSON(res, obj, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

function readStore() {
  if (!fs.existsSync(INSPOS_FILE)) return { inspos: [] };
  const s = JSON.parse(fs.readFileSync(INSPOS_FILE, 'utf8'));
  if (!Array.isArray(s.inspos)) s.inspos = [];
  return s;
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(INSPOS_FILE), { recursive: true });
  const tmp = INSPOS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, INSPOS_FILE);
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;

  if (process.env.RUBRIC_TOKEN && pathname.startsWith('/api/')) {
    if (req.headers['x-rubric-token'] !== process.env.RUBRIC_TOKEN) return sendJSON(res, { error: 'Unauthorized' }, 401);
  }

  try {
    if (req.method === 'GET' && (pathname === '/' || pathname === '/index.html')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(HERE, 'index.html')));
    }

    if (pathname === '/api/inspos' && req.method === 'GET') {
      // Until the first video is saved, show the examples so the tab is never empty.
      if (!fs.existsSync(INSPOS_FILE)) {
        const ex = fs.existsSync(EXAMPLES_FILE) ? JSON.parse(fs.readFileSync(EXAMPLES_FILE, 'utf8')) : { inspos: [] };
        return sendJSON(res, { ...ex, examplesOnly: true });
      }
      return sendJSON(res, readStore());
    }

    if (pathname === '/api/inspos' && req.method === 'POST') {
      let body = '';
      let size = 0;
      let tooBig = false;
      req.on('data', c => {
        if (tooBig) return;
        size += c.length;
        if (size > MAX_BODY) { tooBig = true; body = ''; sendJSON(res, { error: 'Body too large (1 MB max)' }, 413); return; }
        body += c;
      });
      req.on('end', () => {
        if (tooBig) return;
        try {
          const data = JSON.parse(body);
          if (data && Array.isArray(data.inspos)) {               // replace everything
            writeStore({ inspos: data.inspos.filter(v => v && VALID_ID.test(v.id || '')) });
            return sendJSON(res, { ok: true });
          }
          if (data && VALID_ID.test(data.id || '') && data.title) { // add one video to the top
            const store = readStore();
            store.inspos = store.inspos.filter(v => v.id !== data.id);
            store.inspos.unshift(data);
            writeStore(store);
            return sendJSON(res, { ok: true, id: data.id });
          }
          if (data && data.delete) {                             // remove one video
            const store = readStore();
            store.inspos = store.inspos.filter(v => v.id !== data.delete);
            writeStore(store);
            return sendJSON(res, { ok: true });
          }
          sendJSON(res, { error: 'Body must be {inspos:[...]} (replace), a video object with id and title (add), or {delete:"<id>"}' }, 400);
        } catch (e) { sendJSON(res, { error: e.message }, 400); }
      });
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (e) {
    console.error('Error on ' + pathname + ': ' + e.message);
    sendJSON(res, { error: e.message }, 500);
  }
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error('\n  Port ' + PORT + ' is in use. Set PORT=XXXX in env.local (and "port" in manifest.json)\n');
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('RUBRIC Inspos running at http://127.0.0.1:' + PORT);
  console.log('  data: ' + INSPOS_FILE + (fs.existsSync(INSPOS_FILE) ? '' : '  (not created yet, showing examples)'));
});
