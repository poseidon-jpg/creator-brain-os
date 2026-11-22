#!/usr/bin/env node
// Inspo bridge - a tiny local server between the browser extension and the inspo helper script.
//
//   POST /api/inspo   {"url": "<youtube link>"}  runs skills/inspo/scripts/add-inspo.mjs on that video
//   GET  /api/health                             {"ok": true} so you can check it is running
//   GET  /                                       the Inspos page (page/inspos.html)
//   GET  /inspos.json                            your saved inspos (what the page shows)
//
// Start:  node server.mjs        (Node.js 18+, no npm install needed)
// Settings live in env.local next to this file (copy env.example). Every setting is optional.
//
// Security: listens on 127.0.0.1 only, so nothing outside this computer can reach it.
// It sends no CORS headers, and it refuses POSTs that come from a web page, so a website
// you visit cannot add videos behind your back. Only the extension (or a terminal) can.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error('\n  Needs Node.js 18 or newer. You have ' + process.version + '\n');
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

const PORT = parseInt(process.env.PORT || '5299', 10);
const HELPER = path.resolve(HERE, process.env.INSPO_HELPER || '../skills/inspo/scripts/add-inspo.mjs');
const PAGE = path.resolve(HERE, process.env.INSPO_PAGE || '../page/inspos.html');
const INSPOS_FILE = path.resolve(process.env.INSPOS_FILE || path.join(os.homedir(), 'inspos', 'inspos.json'));
const MAX_BODY = 10 * 1024; // a request is one link, so 10 KB is plenty

function extractId(input) {
  const s = String(input || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}
const json = (res, code, obj) => send(res, code, 'application/json; charset=utf-8', JSON.stringify(obj));

// Allow the extension (chrome-extension://...) and tools with no Origin (curl, scripts).
// Refuse anything sent from a web page.
function originAllowed(req) {
  const o = req.headers.origin;
  if (!o) return true;
  return /^(chrome|moz|safari-web)-extension:\/\//.test(o) || o === 'http://127.0.0.1:' + PORT || o === 'http://localhost:' + PORT;
}

function runHelper(videoUrl) {
  return new Promise((resolve, reject) => {
    // The id was checked to be 11 safe characters, and no shell is used, so nothing can be injected.
    execFile(process.execPath, [HELPER, videoUrl], {
      timeout: 2 * 60 * 1000,
      env: { ...process.env, INSPOS_FILE },
      windowsHide: true
    }, (err, stdout, stderr) => {
      if (err) return reject(new Error((String(stderr || '').trim().split(/\r?\n/).pop()) || err.message));
      resolve(String(stdout));
    });
  });
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');

  if (req.method === 'POST' && u.pathname === '/api/inspo') {
    if (!originAllowed(req)) return json(res, 403, { error: 'Requests from web pages are not allowed.' });
    let body = '';
    let size = 0;
    let tooBig = false;
    req.on('data', chunk => {
      if (tooBig) return;
      size += chunk.length;
      if (size > MAX_BODY) { tooBig = true; body = ''; json(res, 413, { error: 'Body too large.' }); return; }
      body += chunk;
    });
    req.on('end', async () => {
      if (tooBig) return;
      let data = {};
      try { data = JSON.parse(body || '{}'); } catch (_) { return json(res, 400, { error: 'Body must be JSON like {"url": "<youtube link>"}' }); }
      const id = extractId(data.url);
      if (!id) return json(res, 400, { error: 'No YouTube video id in that link.' });
      try {
        const out = await runHelper('https://www.youtube.com/watch?v=' + id);
        const lines = out.trim().split(/\r?\n/);
        console.log('  saved ' + id);
        json(res, 200, { ok: true, title: (lines[0] || '').replace(/^Added:\s*/, ''), detail: (lines[1] || '').trim() });
      } catch (e) {
        console.error('  failed ' + id + ': ' + e.message);
        json(res, 500, { error: e.message });
      }
    });
    return;
  }

  if (req.method === 'GET' && u.pathname === '/api/health') {
    return json(res, 200, { ok: true, helperFound: fs.existsSync(HELPER), insposFile: INSPOS_FILE });
  }

  if (req.method === 'GET' && (u.pathname === '/' || u.pathname === '/inspos.html')) {
    if (!fs.existsSync(PAGE)) return send(res, 404, 'text/plain; charset=utf-8', 'Page not found at ' + PAGE + '. Set INSPO_PAGE in env.local.');
    return send(res, 200, 'text/html; charset=utf-8', fs.readFileSync(PAGE));
  }

  if (req.method === 'GET' && u.pathname === '/inspos.json') {
    if (!fs.existsSync(INSPOS_FILE)) return json(res, 404, { error: 'No inspos saved yet.' });
    return send(res, 200, 'application/json; charset=utf-8', fs.readFileSync(INSPOS_FILE));
  }

  send(res, 404, 'text/plain; charset=utf-8', 'Not found');
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error('\n  Port ' + PORT + ' is already in use. Set PORT=<another number> in env.local,');
    console.error('  and change BRIDGE at the top of the extension\'s background.js to match.\n');
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Inspo bridge on http://127.0.0.1:' + PORT);
  console.log('  helper: ' + HELPER + (fs.existsSync(HELPER) ? '' : '   (NOT FOUND - set INSPO_HELPER in env.local)'));
  console.log('  data:   ' + INSPOS_FILE);
});
