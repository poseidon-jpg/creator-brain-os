#!/usr/bin/env node
// Teleprompter: a small local app that shows your scripts on your phone and your computer, kept on the same line.
// No npm packages. Run it with: node server.mjs   (Node 18 or newer)
//
// Pages:   /           the phone page (open it on your phone, same wifi)
//          /desktop    the desktop page (open it on this computer)
// Scripts: every .md file in the scripts/ folder next to this file.
//
// Settings (optional environment variables):
//   PORT=50013          the port to listen on
//   HOST=0.0.0.0        0.0.0.0 lets your phone on the same wifi reach it; HOST=127.0.0.1 keeps it on this computer only
//   SCRIPTS_DIR=...     read scripts from another folder

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const SCRIPTS = path.resolve(process.env.SCRIPTS_DIR || path.join(ROOT, 'scripts'));
const PORT = Number(process.env.PORT) || 50013;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = 1024 * 1024;   // 1 MB cap on request bodies
const MAX_WS = 64 * 1024;       // 64 KB cap on one sync message (they are about 150 bytes)

fs.mkdirSync(SCRIPTS, { recursive: true });

// ---- who may connect: this computer and devices on your own network only ----
function isLocalAddress(raw) {
  const a = String(raw || '').replace(/^::ffff:/, '');
  if (a === '::1' || a.startsWith('127.')) return true;
  if (a.startsWith('10.') || a.startsWith('192.168.') || a.startsWith('169.254.')) return true;
  const m = a.match(/^(\d+)\.(\d+)\./);
  if (m) {
    const x = +m[1], y = +m[2];
    if (x === 172 && y >= 16 && y <= 31) return true;   // 172.16.0.0/12
    if (x === 100 && y >= 64 && y <= 127) return true;  // 100.64.0.0/10 (Tailscale and other private overlays)
    return false;
  }
  const low = a.toLowerCase();
  return low.startsWith('fe80:') || low.startsWith('fc') || low.startsWith('fd');  // IPv6 link-local and private
}
// A request that says where it came from (Origin) must come from this app's own pages, so another website open in
// your browser cannot drive the teleprompter.
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch (e) { return false; }
}

// ---- scripts ----
const okName = f => typeof f === 'string' && /^[\w.\- ]+\.md$/.test(f) && !f.includes('..');
function scriptPath(f) {
  if (!okName(f)) return null;
  const full = path.resolve(SCRIPTS, f);
  return full.startsWith(SCRIPTS + path.sep) ? full : null;
}
function listScripts() {
  try {
    return fs.readdirSync(SCRIPTS).filter(okName).map(f => {
      let mtime = 0; try { mtime = fs.statSync(path.join(SCRIPTS, f)).mtimeMs; } catch (e) {}
      return { file: f, name: f.replace(/\.md$/, ''), mtime };
    }).sort((a, b) => b.mtime - a.mtime);   // newest first
  } catch (e) { return []; }
}
const rev = f => { const p = scriptPath(f); if (!p) return 0; try { return fs.statSync(p).mtimeMs; } catch (e) { return 0; } };

// "live" = the script your agent asked the screens to open. seq goes up on every request, so asking for the same
// script twice still brings it back to the front.
const live = { file: null, seq: 0 };

// ---- addresses to open on a phone ----
function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family !== 'IPv4' && i.family !== 4) continue;
      if (i.internal) continue;
      if (!isLocalAddress(i.address) || i.address.startsWith('169.254.')) continue;
      out.push({ name, address: i.address });
    }
  }
  // home wifi addresses (192.168.x) first, then 10.x and 172.x, then overlay networks
  const rank = a => a.startsWith('192.168.') ? 0 : a.startsWith('10.') ? 1 : a.startsWith('172.') ? 2 : 3;
  return out.sort((a, b) => rank(a.address) - rank(b.address));
}
function links() {
  const phone = HOST === '127.0.0.1' || HOST === 'localhost' ? [] : lanAddresses().map(a => ({ network: a.name, url: `http://${a.address}:${PORT}/` }));
  return { desktop: `http://localhost:${PORT}/desktop`, phoneOnThisComputer: `http://localhost:${PORT}/`, phone };
}

// ---- http ----
const PAGES = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/index.html': ['index.html', 'text/html; charset=utf-8'],
  '/desktop': ['desktop.html', 'text/html; charset=utf-8'],
  '/desktop/': ['desktop.html', 'text/html; charset=utf-8'],
  '/sync.js': ['sync.js', 'application/javascript; charset=utf-8'],
  '/md.js': ['md.js', 'application/javascript; charset=utf-8'],
};
function send(res, code, type, body) {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(body);
}
const json = (res, obj, code = 200) => send(res, code, 'application/json; charset=utf-8', JSON.stringify(obj));
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const parts = [];
    req.on('data', c => { size += c.length; if (size > MAX_BODY) { reject(new Error('too big')); req.destroy(); } else parts.push(c); });
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (!isLocalAddress(req.socket.remoteAddress)) { send(res, 403, 'text/plain', 'Only devices on your own network can open this teleprompter.'); return; }
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch (e) { send(res, 400, 'text/plain', 'Bad request'); return; }
  const p = url.pathname;

  if (req.method === 'GET' && PAGES[p]) {
    const [file, type] = PAGES[p];
    try { send(res, 200, type, fs.readFileSync(path.join(PUBLIC, file))); } catch (e) { send(res, 404, 'text/plain', 'Not found'); }
    return;
  }
  if (req.method === 'GET' && p === '/api/scripts') { json(res, listScripts()); return; }
  if (req.method === 'GET' && p.startsWith('/scripts/')) {
    let name; try { name = decodeURIComponent(p.slice('/scripts/'.length)); } catch (e) { name = ''; }
    const full = scriptPath(name);
    if (!full) { send(res, 400, 'text/plain', 'Bad script name'); return; }
    try { send(res, 200, 'text/plain; charset=utf-8', fs.readFileSync(full, 'utf8')); } catch (e) { send(res, 404, 'text/plain', 'Script not found'); }
    return;
  }
  if (p === '/api/live' && (req.method === 'GET' || req.method === 'POST')) {
    if (req.method === 'POST') {
      if (!sameOrigin(req)) { send(res, 403, 'text/plain', 'Forbidden'); return; }
      let body;
      try { body = JSON.parse(await readBody(req)); } catch (e) { json(res, { ok: false, error: 'Send JSON like {"file": "my-script.md"}' }, 400); return; }
      if (!okName(body.file) || !rev(body.file)) { json(res, { ok: false, error: 'No script with that name in scripts/' }, 404); return; }
      live.file = body.file; live.seq++;
    }
    const cur = url.searchParams.get('f');
    json(res, { ok: true, live: live.file, liveSeq: live.seq, liveRev: live.file ? rev(live.file) : 0, curRev: cur ? rev(cur) : 0 });
    return;
  }
  if (req.method === 'GET' && p === '/api/info') {
    json(res, { app: 'teleprompter', port: PORT, scripts: listScripts().length, links: links() });
    return;
  }
  send(res, 404, 'text/plain', 'Not found');
});

// ---- a tiny WebSocket server (no packages): just enough for the pages to stay in sync ----
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
function frame(op, payload) {
  const len = payload.length;
  let head;
  if (len < 126) head = Buffer.from([0x80 | op, len]);
  else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | op; head[1] = 126; head.writeUInt16BE(len, 2); }
  else { head = Buffer.alloc(10); head[0] = 0x80 | op; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
  return Buffer.concat([head, payload]);
}
function acceptSocket(req, socket, onOpen) {
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket') { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const ws = {
    open: true, onmessage: null, onclose: null,
    send(text) { if (ws.open && !socket.destroyed) socket.write(frame(0x1, Buffer.from(text, 'utf8'))); },
    ping() { if (ws.open && !socket.destroyed) socket.write(frame(0x9, Buffer.alloc(0))); },
    close() { if (!ws.open) return; ws.open = false; try { socket.end(frame(0x8, Buffer.alloc(0))); } catch (e) {} },
  };
  let buf = Buffer.alloc(0), parts = [], partsLen = 0;
  const kill = () => { if (ws.open) { ws.open = false; } socket.destroy(); };
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; const big = buf.readBigUInt64BE(2); if (big > BigInt(MAX_WS)) return kill(); len = Number(big); off = 10; }
      if (!masked || len > MAX_WS) return kill();             // browsers always mask; nothing we expect is this big
      if (buf.length < off + 4 + len) return;                 // wait for the rest of the frame
      const mask = buf.subarray(off, off + 4);
      const data = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < len; i++) data[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (op === 0x8) { ws.close(); return; }                 // close
      if (op === 0x9) { if (ws.open) socket.write(frame(0xA, data)); continue; }  // ping -> pong
      if (op === 0xA) continue;                               // pong
      if (op === 0x1 || op === 0x0) {                         // text (and its continuation frames)
        parts.push(data); partsLen += len;
        if (partsLen > MAX_WS) return kill();
        if (fin) { const text = Buffer.concat(parts).toString('utf8'); parts = []; partsLen = 0; if (ws.onmessage) ws.onmessage(text); }
      }
    }
  });
  let closed = false;
  const done = () => { if (closed) return; closed = true; ws.open = false; if (ws.onclose) ws.onclose(); };
  socket.on('close', done);
  socket.on('end', done);
  socket.on('error', () => {});
  onOpen(ws);
}

// ---- sync: the phone and the desktop page stay on the same line ----
// Each open page joins here. The page someone last touched sends its state (script, position as block + fraction,
// playing, speed); the server numbers it and relays it to all, and every page follows the newest sender. The phone
// also reports its text width and font size, so the desktop page can break its lines in the same places. The last
// state is kept so a page that opens late starts on the right line.
const tp = { seq: 0, last: null, layout: null, leader: null, clients: new Set() };
function broadcast(msg, except) {
  const raw = JSON.stringify(msg);
  tp.clients.forEach(c => { if (c !== except) c.send(raw); });
}
function peers() {
  const count = { phone: 0, desk: 0 };
  tp.clients.forEach(c => { count[c.tp.role]++; });
  broadcast({ type: 'peers', peers: count });
}
function join(ws, req) {
  const q = new URL(req.url, 'http://localhost').searchParams;
  ws.tp = { id: String(q.get('id') || '').slice(0, 24), role: q.get('role') === 'desk' ? 'desk' : 'phone' };
  tp.clients.add(ws);
  const last = tp.last && Object.assign({}, tp.last, { age: Date.now() - tp.last.st });
  ws.send(JSON.stringify({ type: 'init', seq: tp.seq, last, layout: tp.layout }));
  peers();
  ws.onmessage = raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (m.type === 'state') {
      const A = Number(m.A), speed = Number(m.speed);
      if (!isFinite(A) || !(speed >= 0.1 && speed <= 5)) return;
      if (m.claim) tp.leader = ws.tp.id;               // a user action on that page: it leads now
      else if (ws.tp.id !== tp.leader) return;          // a routine update from a page that no longer leads
      tp.last = { type: 'state', claim: !!m.claim, from: ws.tp.id, seq: ++tp.seq, st: Date.now(), file: okName(m.file) ? m.file : null, A, playing: !!m.playing, speed };
      broadcast(tp.last);
    } else if (m.type === 'layout' && m.layout) {
      const w = Number(m.layout.w), fs = Number(m.layout.fs);
      if (!(w >= 100 && w <= 3000 && fs >= 10 && fs <= 200)) return;
      tp.layout = { w: Math.round(w), fs: Math.round(fs) };
      broadcast({ type: 'layout', layout: tp.layout });
    } else if (m.type === 'hello') {
      broadcast({ type: 'hello', from: ws.tp.id }, ws);
    }
  };
  ws.onclose = () => { tp.clients.delete(ws); peers(); };
}
server.on('upgrade', (req, socket) => {
  const p = (req.url || '').split('?')[0];
  if (p !== '/api/sync' || !isLocalAddress(req.socket.remoteAddress) || !sameOrigin(req)) { socket.destroy(); return; }
  acceptSocket(req, socket, ws => join(ws, req));
});
// keep phone links alive through sleeping wifi radios
setInterval(() => tp.clients.forEach(c => { try { c.ping(); } catch (e) {} }), 25000).unref();

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. The teleprompter may already be running: open http://localhost:${PORT}/desktop`);
    console.error('To use another port, run it with PORT=50014 (or any free number).');
  } else console.error('Could not start:', e.message);
  process.exit(1);
});
server.listen(PORT, HOST, () => {
  const l = links();
  console.log('Teleprompter is running.');
  console.log('  Desktop page (this computer): ' + l.desktop);
  if (l.phone.length) {
    console.log('  Phone page (same wifi):        ' + l.phone[0].url);
    l.phone.slice(1).forEach(x => console.log('  Other network (' + x.network + '): ' + x.url));
  } else console.log('  Phone page: not reachable from other devices (HOST=' + HOST + '). Open ' + l.phoneOnThisComputer + ' here.');
  console.log('  Scripts folder: ' + SCRIPTS);
});
