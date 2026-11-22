import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Node version check ---
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error('\n  Requires Node.js 18+. You are running ' + process.version + '\n');
  process.exit(1);
}

// --- Config ---
const PORT = parseInt(process.env.PORT || '5050', 10);
const GEN_DIR = path.resolve(process.env.GEN_DIR || path.join(__dirname, 'generations'));

// --- Load .env (lightweight, no deps) ---
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+)\s*$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// --- MIME types ---
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime'
};

function mime(fp) { return MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream'; }
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// --- Path safety ---
function safePath(base, requested) {
  const resolvedBase = path.resolve(base);
  const resolved = path.resolve(base, requested);
  if (resolved !== resolvedBase && !resolved.startsWith(resolvedBase + path.sep)) return null;
  return resolved;
}

// --- Body size cap (1MB) ---
const MAX_BODY = 1_000_000;

// --- Server ---
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    // ---- Optional auth token ----
    if (process.env.RUBRIC_TOKEN && pathname.startsWith('/api/')) {
      if (req.headers['x-rubric-token'] !== process.env.RUBRIC_TOKEN) {
        json(res, { error: 'Unauthorized' }, 401);
        return;
      }
    }

    // ---- API: List generations ----
    if (pathname === '/api/generations' && req.method === 'GET') {
      const mediaRe = /\.(png|jpg|jpeg|webp|svg|gif|mp4|webm|mov)$/i;
      const videoRe = /\.(mp4|webm|mov)$/i;
      const items = [];

      // Main generations folder
      if (fs.existsSync(GEN_DIR)) {
        for (const f of fs.readdirSync(GEN_DIR)) {
          const fp = path.join(GEN_DIR, f);
          if (!mediaRe.test(f) || !fs.statSync(fp).isFile()) continue;
          items.push({ name: f, modified: fs.statSync(fp).mtimeMs, type: 'gen', media: videoRe.test(f) ? 'video' : 'image', path: fp.replace(/\\/g, '/') });
        }
      }

      // Refs subfolder
      const refsDir = path.join(GEN_DIR, 'refs');
      if (fs.existsSync(refsDir)) {
        for (const f of fs.readdirSync(refsDir)) {
          const fp = path.join(refsDir, f);
          if (!mediaRe.test(f) || !fs.statSync(fp).isFile()) continue;
          items.push({ name: f, modified: fs.statSync(fp).mtimeMs, type: 'ref', media: videoRe.test(f) ? 'video' : 'image', path: fp.replace(/\\/g, '/') });
        }
      }

      // Sort + starred
      const params = url.searchParams;
      const sortOrder = params.get('sort') === 'oldest' ? -1 : 1;
      items.sort((a, b) => sortOrder * (b.modified - a.modified));

      const starredFile = path.join(__dirname, 'data', 'generation-starred.json');
      const starred = fs.existsSync(starredFile) ? JSON.parse(fs.readFileSync(starredFile, 'utf8')) : [];
      const starredSet = new Set(starred);
      items.forEach(i => { i.starred = starredSet.has(i.name); });

      // Filter
      let filtered = items;
      const typeFilter = params.get('type');
      const mediaFilter = params.get('media');
      if (typeFilter) filtered = filtered.filter(i => i.type === typeFilter);
      if (mediaFilter) filtered = filtered.filter(i => i.media === mediaFilter);
      const q = params.get('q');
      if (q) { const ql = q.toLowerCase(); filtered = filtered.filter(i => i.name.toLowerCase().includes(ql)); }
      if (params.get('starred') === '1') filtered = filtered.filter(i => i.starred);

      // Starred items float to top
      filtered.sort((a, b) => {
        const starDiff = (b.starred ? 1 : 0) - (a.starred ? 1 : 0);
        if (starDiff !== 0) return starDiff;
        return sortOrder * (b.modified - a.modified);
      });

      const page = parseInt(params.get('page')) || 1;
      const limit = parseInt(params.get('limit')) || 30;
      const total = filtered.length;
      const start = (page - 1) * limit;
      const paged = filtered.slice(start, start + limit);
      json(res, { items: paged, total, page, limit, hasMore: start + limit < total });
      return;
    }

    // ---- API: Star/unstar ----
    if (pathname === '/api/generations/star' && req.method === 'POST') {
      let body = '';
      let aborted = false;
      req.on('data', c => {
        body += c;
        if (body.length > MAX_BODY) { aborted = true; res.writeHead(413); res.end('Payload too large'); req.destroy(); }
      });
      req.on('end', () => {
        if (aborted) return;
        try {
          const { name, starred } = JSON.parse(body);
          const starredFile = path.join(__dirname, 'data', 'generation-starred.json');
          let list = fs.existsSync(starredFile) ? JSON.parse(fs.readFileSync(starredFile, 'utf8')) : [];
          if (starred && !list.includes(name)) list.push(name);
          else if (!starred) list = list.filter(n => n !== name);
          fs.writeFileSync(starredFile, JSON.stringify(list, null, 2));
          json(res, { ok: true });
        } catch (e) { json(res, { error: e.message }, 500); }
      });
      return;
    }

    // ---- API: Delete generation ----
    if (pathname === '/api/generations/delete' && req.method === 'POST') {
      let body = '';
      let aborted = false;
      req.on('data', c => {
        body += c;
        if (body.length > MAX_BODY) { aborted = true; res.writeHead(413); res.end('Payload too large'); req.destroy(); }
      });
      req.on('end', () => {
        if (aborted) return;
        try {
          const { filePath } = JSON.parse(body);
          const resolved = path.resolve(filePath.replace(/\//g, path.sep));
          const genBase = path.resolve(GEN_DIR);
          if (resolved !== genBase && !resolved.startsWith(genBase + path.sep)) { json(res, { error: 'Invalid path' }, 403); return; }
          if (fs.existsSync(resolved)) { fs.unlinkSync(resolved); json(res, { ok: true }); }
          else { json(res, { error: 'File not found' }, 404); }
        } catch (e) { json(res, { error: e.message }, 500); }
      });
      return;
    }

    // ---- API: Upload reference image ----
    if (pathname === '/api/generations/refs' && req.method === 'POST') {
      const refsDir = path.join(GEN_DIR, 'refs');
      if (!fs.existsSync(refsDir)) fs.mkdirSync(refsDir, { recursive: true });
      const contentType = req.headers['content-type'] || '';
      if (!contentType.includes('multipart/form-data')) { json(res, { error: 'Expected multipart/form-data' }, 400); return; }
      const boundary = '--' + contentType.split('boundary=')[1];
      const chunks = [];
      let size = 0;
      let aborted = false;
      req.on('data', c => {
        size += c.length;
        if (size > MAX_BODY) { aborted = true; res.writeHead(413); res.end('Payload too large'); req.destroy(); return; }
        chunks.push(c);
      });
      req.on('end', () => {
        if (aborted) return;
        try {
          const buf = Buffer.concat(chunks);
          const parts = buf.toString('binary').split(boundary).filter(p => p.includes('filename='));
          const saved = [];
          for (const part of parts) {
            const headerEnd = part.indexOf('\r\n\r\n');
            if (headerEnd === -1) continue;
            const headers = part.slice(0, headerEnd);
            const filenameMatch = headers.match(/filename="([^"]+)"/);
            if (!filenameMatch) continue;
            const filename = filenameMatch[1].replace(/[^a-zA-Z0-9_.\-]/g, '_');
            const bodyStart = headerEnd + 4;
            const bodyEnd = part.lastIndexOf('\r\n');
            const fileBody = Buffer.from(part.slice(bodyStart, bodyEnd), 'binary');
            const filePath = path.join(refsDir, filename);
            fs.writeFileSync(filePath, fileBody);
            saved.push({ name: filename, path: filePath.replace(/\\/g, '/') });
          }
          json(res, { ok: true, files: saved });
        } catch (e) { json(res, { error: e.message }, 500); }
      });
      return;
    }

    // ---- API: Styles ----
    if (pathname === '/api/generation-styles' && req.method === 'GET') {
      const stylesFile = path.join(__dirname, 'data', 'generation-styles.json');
      if (!fs.existsSync(stylesFile)) { json(res, []); return; }
      json(res, JSON.parse(fs.readFileSync(stylesFile, 'utf8')));
      return;
    }

    // ---- API: Models ----
    if (pathname === '/api/generation-models' && req.method === 'GET') {
      const modelsFile = path.join(__dirname, 'data', 'generation-models.json');
      if (!fs.existsSync(modelsFile)) { json(res, []); return; }
      json(res, JSON.parse(fs.readFileSync(modelsFile, 'utf8')));
      return;
    }

    // ---- Static: serve generation files ----
    if (pathname.startsWith('/generations/styles/')) {
      const fileName = pathname.slice('/generations/styles/'.length);
      const fp = safePath(path.join(GEN_DIR, 'styles'), fileName);
      if (!fp || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mime(fp), 'Cache-Control': 'public, max-age=3600' });
      res.end(fs.readFileSync(fp));
      return;
    }
    if (pathname.startsWith('/generations/refs/')) {
      const fileName = pathname.slice('/generations/refs/'.length);
      const fp = safePath(path.join(GEN_DIR, 'refs'), fileName);
      if (!fp || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mime(fp), 'Cache-Control': 'public, max-age=3600' });
      res.end(fs.readFileSync(fp));
      return;
    }
    if (pathname.startsWith('/generations/')) {
      const fileName = pathname.slice('/generations/'.length);
      const fp = safePath(GEN_DIR, fileName);
      if (!fp || !fs.existsSync(fp) || !fs.statSync(fp).isFile()) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mime(fp), 'Cache-Control': 'public, max-age=3600' });
      res.end(fs.readFileSync(fp));
      return;
    }

    // ---- Serve index.html ----
    if (pathname === '/' || pathname === '/index.html') {
      const indexPath = path.join(__dirname, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fs.readFileSync(indexPath, 'utf8'));
      return;
    }

    res.writeHead(404);
    res.end('Not found');

  } catch (e) {
    console.error('Server error:', e);
    res.writeHead(500);
    res.end('Internal server error');
  }
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('\n  Port ' + PORT + ' is in use. Set PORT=XXXX in .env\n');
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  RUBRIC Generations`);
  console.log(`  http://localhost:${PORT}\n`);
  console.log(`  Generations folder: ${GEN_DIR}`);
  console.log(`  Styles: ${fs.existsSync(path.join(__dirname, 'data', 'generation-styles.json')) ? 'loaded' : 'none'}`);
  console.log(`  Models: ${fs.existsSync(path.join(__dirname, 'data', 'generation-models.json')) ? 'loaded' : 'none'}\n`);
});
