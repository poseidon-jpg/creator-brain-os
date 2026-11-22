const http = require('http');
const fs = require('fs');
const path = require('path');

// Load .env (lightweight, no deps)
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = value;
    }
  }
} catch { /* .env is optional */ }

const PORT = parseInt(process.env.PORT || '5050', 10);
const HOST = '127.0.0.1';
const BASE_DIR = __dirname;

// Load config
let config = { brandName: 'My Docs', docsRoot: './docs' };
try {
  const cfgPath = path.join(BASE_DIR, 'config.json');
  if (fs.existsSync(cfgPath)) config = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
} catch (e) { console.error('Failed to load config.json, using defaults'); }

const DOCS_ROOT = path.resolve(BASE_DIR, config.docsRoot || './docs');
const COMMENTS_DIR = path.join(BASE_DIR, 'data', 'comments');
const TRASH_DIR = path.join(BASE_DIR, 'data', '.trash');

// Ensure directories exist
if (!fs.existsSync(DOCS_ROOT)) fs.mkdirSync(DOCS_ROOT, { recursive: true });
if (!fs.existsSync(COMMENTS_DIR)) fs.mkdirSync(COMMENTS_DIR, { recursive: true });
if (!fs.existsSync(TRASH_DIR)) fs.mkdirSync(TRASH_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.md': 'text/plain', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.gif': 'image/gif', '.txt': 'text/plain',
  '.zip': 'application/zip'
};

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const MAX_BODY = 1_000_000;

function readBody(req, res) {
  return new Promise((resolve, reject) => {
    let body = '';
    let aborted = false;
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_BODY) {
        aborted = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        req.destroy();
      }
    });
    req.on('end', () => { if (!aborted) resolve(body); });
    req.on('error', () => { if (!aborted) reject(new Error('Request error')); });
  });
}

// --- Comment helpers ---

function commentsFileForPath(docPath) {
  const sanitized = docPath.replace(/\//g, '--');
  return path.join(COMMENTS_DIR, sanitized + '.json');
}

function loadComments(docPath) {
  const file = commentsFileForPath(docPath);
  if (!fs.existsSync(file)) return { comments: [] };
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { comments: [] }; }
}

function saveComments(docPath, data) {
  fs.writeFileSync(commentsFileForPath(docPath), JSON.stringify(data, null, 2));
}

// --- Security: path traversal guard ---

function safePath(root, userPath) {
  const full = path.join(root, userPath || '');
  if (!full.startsWith(root)) return null;
  if ((userPath || '').includes('..')) return null;
  return full;
}

// --- Server ---

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  try {

    // --- Optional auth token ---
    if (process.env.RUBRIC_TOKEN && pathname.startsWith('/api/')) {
      if (req.headers['x-rubric-token'] !== process.env.RUBRIC_TOKEN) {
        sendJSON(res, { error: 'Unauthorized' }, 401);
        return;
      }
    }

    // --- Serve index.html ---
    if (pathname === '/' || pathname === '/index.html') {
      const html = fs.readFileSync(path.join(BASE_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    // --- Serve config.json ---
    if (pathname === '/config.json' && req.method === 'GET') {
      const cfgPath = path.join(BASE_DIR, 'config.json');
      if (fs.existsSync(cfgPath)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(fs.readFileSync(cfgPath));
      } else {
        sendJSON(res, config);
      }
      return;
    }

    // --- Doc Comments API ---

    // GET /api/doc-comments/summary?path=... (plain text for agents)
    if (pathname === '/api/doc-comments/summary' && req.method === 'GET') {
      const docPath = url.searchParams.get('path');
      if (!docPath) { res.writeHead(400); res.end('Missing path parameter'); return; }
      const data = loadComments(docPath);
      const unresolved = data.comments.filter(c => !c.resolved);
      if (unresolved.length === 0) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`No comments on ${docPath}`);
        return;
      }
      let summary = `Comments on ${docPath}:\n`;
      for (const c of unresolved) {
        const line = c.lineStart ? `Line ${c.lineStart}` : 'Inline';
        summary += `${line}: "${c.selection}" → "${c.comment}"\n`;
      }
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(summary.trim());
      return;
    }

    // GET /api/doc-comments?path=...
    if (pathname === '/api/doc-comments' && req.method === 'GET') {
      const docPath = url.searchParams.get('path');
      if (!docPath) { sendJSON(res, { error: 'Missing path parameter' }, 400); return; }
      sendJSON(res, loadComments(docPath));
      return;
    }

    // POST /api/doc-comments - add a comment
    if (pathname === '/api/doc-comments' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req, res));
      if (!body.path || !body.comment) { sendJSON(res, { error: 'Missing path or comment' }, 400); return; }
      const data = loadComments(body.path);
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const comment = {
        id,
        selection: body.selection || '',
        lineStart: body.lineStart || null,
        lineEnd: body.lineEnd || null,
        comment: body.comment,
        createdAt: new Date().toISOString(),
        resolved: false
      };
      data.comments.push(comment);
      saveComments(body.path, data);
      sendJSON(res, { success: true, comment }, 201);
      return;
    }

    // PUT /api/doc-comments/:id - update a comment
    const putMatch = pathname.match(/^\/api\/doc-comments\/([^/]+)$/);
    if (putMatch && req.method === 'PUT') {
      const commentId = putMatch[1];
      const body = JSON.parse(await readBody(req, res));
      const files = fs.readdirSync(COMMENTS_DIR).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(COMMENTS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const idx = data.comments.findIndex(c => c.id === commentId);
        if (idx !== -1) {
          if (body.resolved !== undefined) data.comments[idx].resolved = body.resolved;
          if (body.comment !== undefined) data.comments[idx].comment = body.comment;
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          sendJSON(res, { success: true, comment: data.comments[idx] });
          return;
        }
      }
      sendJSON(res, { error: 'Comment not found' }, 404);
      return;
    }

    // DELETE /api/doc-comments/:id - remove a comment
    const delMatch = pathname.match(/^\/api\/doc-comments\/([^/]+)$/);
    if (delMatch && req.method === 'DELETE') {
      const commentId = delMatch[1];
      const files = fs.readdirSync(COMMENTS_DIR).filter(f => f.endsWith('.json'));
      for (const file of files) {
        const filePath = path.join(COMMENTS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const idx = data.comments.findIndex(c => c.id === commentId);
        if (idx !== -1) {
          data.comments.splice(idx, 1);
          fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
          sendJSON(res, { success: true });
          return;
        }
      }
      sendJSON(res, { error: 'Comment not found' }, 404);
      return;
    }

    // --- Docs Download ---
    if (pathname === '/api/docs/download' && req.method === 'GET') {
      const filePath = url.searchParams.get('path');
      if (!filePath) { res.writeHead(400); res.end('Missing path'); return; }
      const full = safePath(DOCS_ROOT, filePath);
      if (!full) { res.writeHead(403); res.end('Access denied'); return; }
      try {
        const data = fs.readFileSync(full);
        res.writeHead(200, {
          'Content-Type': getMimeType(full),
          'Content-Disposition': 'attachment; filename="' + path.basename(full) + '"',
          'Content-Length': data.length
        });
        res.end(data);
      } catch (e) { res.writeHead(404); res.end('File not found'); }
      return;
    }

    // --- Docs API ---
    if (pathname === '/api/docs' && req.method === 'POST') {
      const body = JSON.parse(await readBody(req, res));

      // List directory
      if (body._action === 'list') {
        const dir = safePath(DOCS_ROOT, body.path || '');
        if (!dir) { sendJSON(res, { error: 'Access denied' }, 403); return; }
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          const items = entries.filter(e => !e.name.startsWith('.')).map(e => {
            const full = path.join(dir, e.name);
            const stat = fs.statSync(full);
            let preview = '';
            if (e.isFile() && e.name.endsWith('.md')) {
              try { preview = fs.readFileSync(full, 'utf8').slice(0, 200); } catch (ex) {}
            }
            return {
              name: e.name,
              type: e.isDirectory() ? 'folder' : 'file',
              size: stat.size,
              modified: stat.mtime.toISOString(),
              preview
            };
          }).sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
          sendJSON(res, { path: body.path || '', items });
        } catch (e) { sendJSON(res, { error: 'Could not read directory' }, 500); }
        return;
      }

      // Read file
      if (body._action === 'read') {
        const file = safePath(DOCS_ROOT, body.path || '');
        if (!file) { sendJSON(res, { error: 'Access denied' }, 403); return; }
        try {
          const content = fs.readFileSync(file, 'utf8');
          const stat = fs.statSync(file);
          sendJSON(res, { path: body.path, content, modified: stat.mtime.toISOString() });
        } catch (e) { sendJSON(res, { error: 'Could not read file' }, 500); }
        return;
      }

      // Write/save file
      if (body._action === 'write') {
        const file = safePath(DOCS_ROOT, body.path || '');
        if (!file) { sendJSON(res, { error: 'Access denied' }, 403); return; }
        try {
          fs.writeFileSync(file, body.content || '');
          sendJSON(res, { success: true });
        } catch (e) { sendJSON(res, { error: 'Could not write file' }, 500); }
        return;
      }

      // Create file
      if (body._action === 'create') {
        const file = safePath(DOCS_ROOT, body.path || '');
        if (!file) { sendJSON(res, { error: 'Access denied' }, 403); return; }
        try {
          if (fs.existsSync(file)) { sendJSON(res, { error: 'File exists' }, 409); return; }
          fs.writeFileSync(file, body.content || '# ' + path.basename(file, '.md') + '\n');
          sendJSON(res, { success: true }, 201);
        } catch (e) { sendJSON(res, { error: 'Could not create file' }, 500); }
        return;
      }

      // Create folder
      if (body._action === 'mkdir') {
        const dir = safePath(DOCS_ROOT, body.path || '');
        if (!dir) { sendJSON(res, { error: 'Access denied' }, 403); return; }
        try {
          fs.mkdirSync(dir, { recursive: true });
          sendJSON(res, { success: true }, 201);
        } catch (e) { sendJSON(res, { error: 'Could not create folder' }, 500); }
        return;
      }

      // Rename
      if (body._action === 'rename') {
        const from = safePath(DOCS_ROOT, body.from || '');
        const to = safePath(DOCS_ROOT, body.to || '');
        if (!from || !to) { sendJSON(res, { error: 'Access denied' }, 403); return; }
        try {
          fs.renameSync(from, to);
          sendJSON(res, { success: true });
        } catch (e) { sendJSON(res, { error: 'Could not rename' }, 500); }
        return;
      }

      // Delete (move to trash)
      if (body._action === 'delete') {
        const target = safePath(DOCS_ROOT, body.path || '');
        if (!target) { sendJSON(res, { error: 'Access denied' }, 403); return; }
        try {
          const trashName = Date.now() + '-' + path.basename(target);
          fs.renameSync(target, path.join(TRASH_DIR, trashName));
          sendJSON(res, { success: true });
        } catch (e) { sendJSON(res, { error: 'Could not delete' }, 500); }
        return;
      }

      // Tree (recursive)
      if (body._action === 'tree') {
        function buildTree(dir, rel) {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          return entries.filter(e => !e.name.startsWith('.')).map(e => {
            const full = path.join(dir, e.name);
            const relPath = rel ? rel + '/' + e.name : e.name;
            if (e.isDirectory()) {
              return { name: e.name, path: relPath, type: 'folder', children: buildTree(full, relPath) };
            }
            return { name: e.name, path: relPath, type: 'file' };
          }).sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
        }
        try {
          sendJSON(res, { tree: buildTree(DOCS_ROOT, '') });
        } catch (e) { sendJSON(res, { error: 'Could not build tree' }, 500); }
        return;
      }

      sendJSON(res, { error: 'Unknown docs action' }, 400);
      return;
    }

    // --- 404 ---
    res.writeHead(404);
    res.end('Not found');

  } catch (e) {
    console.error('Server error:', e);
    res.writeHead(500);
    res.end('Internal server error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Rubric Docs running at http://${HOST}:${PORT}`);
  console.log(`Docs root: ${DOCS_ROOT}`);
});
