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
const MAX_BODY = 1_000_000;
const HOST = '127.0.0.1';
const CONFIG_FILE = path.join(__dirname, 'config.json');
const DATA_FILE = path.join(__dirname, 'data', 'backlog.json');

// Helpers
const loadConfig = () => JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

// Compute the current week label (Mon-Sun) - matches client-side getSprintForOffset
const currentSprintLabel = (offset = 0) => {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMon + (offset * 7));
  monday.setHours(0, 0, 0, 0);
  const jan1 = new Date(monday.getFullYear(), 0, 1);
  const days = Math.floor((monday - jan1) / 86400000);
  const wk = Math.ceil((days + jan1.getDay() + 1) / 7);
  return 'Wk' + wk;
};

// Resolve sprint placeholders so sample data follows the calendar:
//   "$CURRENT" -> this week, "$NEXT" -> next week, "$PREV" -> last week
const resolveSprintPlaceholders = (data) => {
  if (!data || !Array.isArray(data.tasks)) return data;
  for (const t of data.tasks) {
    if (t.sprint === '$CURRENT') t.sprint = currentSprintLabel(0);
    else if (t.sprint === '$NEXT') t.sprint = currentSprintLabel(1);
    else if (t.sprint === '$PREV') t.sprint = currentSprintLabel(-1);
  }
  return data;
};

const loadData = () => resolveSprintPlaceholders(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
const saveData = (data) => {
  data.meta.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};
const today = () => new Date().toISOString().slice(0, 10);
const sendJSON = (res, obj, status = 200) => {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
};
const readBody = (req, res) => new Promise((resolve, reject) => {
  let data = '';
  let aborted = false;
  req.on('data', chunk => {
    data += chunk;
    if (data.length > MAX_BODY) {
      aborted = true;
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Payload too large' }));
      req.destroy();
    }
  });
  req.on('end', () => { if (!aborted) resolve(data); });
  req.on('error', (e) => { if (!aborted) reject(e); });
});

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  // Optional auth token
  if (process.env.RUBRIC_TOKEN && pathname.startsWith('/api/')) {
    if (req.headers['x-rubric-token'] !== process.env.RUBRIC_TOKEN) {
      sendJSON(res, { error: 'Unauthorized' }, 401);
      return;
    }
  }

  // GET /api/config
  if (pathname === '/api/sprint/config' && req.method === 'GET') {
    try {
      sendJSON(res, loadConfig());
    } catch (e) {
      sendJSON(res, { error: 'Could not read config' }, 500);
    }
    return;
  }

  // GET /api/tasks
  if (pathname === '/api/sprint/tasks' && req.method === 'GET') {
    try {
      sendJSON(res, loadData());
    } catch (e) {
      sendJSON(res, { error: 'Could not read data' }, 500);
    }
    return;
  }

  // POST /api/tasks - CRUD
  if (pathname === '/api/sprint/tasks' && req.method === 'POST') {
    try {
      const body = JSON.parse(await readBody(req, res));
      const config = loadConfig();
      const epicPrefixes = {};
      for (const [name, prefix] of Object.entries(config.epics || {})) {
        epicPrefixes[name] = prefix;
      }

      // CREATE - no _action
      if (!body._action) {
        const db = loadData();
        const prefix = epicPrefixes[body.epic] || Object.values(epicPrefixes)[0] || 'X';

        // Sync counter with actual max ID to prevent duplicates
        const existingMax = db.tasks
          .filter(t => t.id && t.id.startsWith(prefix + '-'))
          .reduce((max, t) => Math.max(max, parseInt(t.id.split('-')[1]) || 0), 0);
        db.meta.counters[prefix] = Math.max(db.meta.counters[prefix] || 0, existingMax) + 1;
        const num = String(db.meta.counters[prefix]).padStart(4, '0');

        // Final duplicate check
        if (db.tasks.some(t => t.id === `${prefix}-${num}`)) {
          sendJSON(res, { error: 'Duplicate ID generated, please retry' }, 409);
          return;
        }

        const task = {
          id: `${prefix}-${num}`,
          epic: body.epic || Object.keys(epicPrefixes)[0] || 'General',
          theme: body.theme || '',
          project: body.project || '',
          task: body.task || '',
          description: body.description || '',
          status: body.status || 'Todo',
          assignee: body.assignee || config.assignees?.[0] || '',
          priority: body.priority || 'Mid',
          effort: body.effort || 'M',
          quarter: body.quarter || '',
          tags: body.tags || [],
          notes: body.notes || [],
          sprint: body.sprint || '',
          created: today(),
          updated: today(),
          completed: null
        };

        db.tasks.push(task);
        saveData(db);
        sendJSON(res, { success: true, task }, 201);
        return;
      }

      // UPDATE
      if (body._action === 'update' && body.id) {
        const db = loadData();
        const idx = db.tasks.findIndex(t => t.id === body.id);
        if (idx === -1) { sendJSON(res, { error: 'Task not found' }, 404); return; }

        const allowed = ['epic', 'theme', 'project', 'task', 'description', 'status', 'assignee', 'priority', 'effort', 'quarter', 'tags', 'notes', 'sprint'];
        const updates = body.updates || body;
        for (const key of allowed) {
          if (updates[key] !== undefined) db.tasks[idx][key] = updates[key];
        }
        db.tasks[idx].updated = today();
        if (updates.status === 'Done') {
          db.tasks[idx].completed = today();
        }
        saveData(db);
        sendJSON(res, { success: true, task: db.tasks[idx] });
        return;
      }

      // DELETE
      if (body._action === 'delete' && body.id) {
        const db = loadData();
        db.tasks = db.tasks.filter(t => t.id !== body.id);
        saveData(db);
        sendJSON(res, { success: true });
        return;
      }

      // ADD NOTE
      if (body._action === 'add_note' && body.id && body.note) {
        const db = loadData();
        const task = db.tasks.find(t => t.id === body.id);
        if (!task) { sendJSON(res, { error: 'Task not found' }, 404); return; }
        if (!task.notes) task.notes = [];
        task.notes.push({ text: body.note, by: body.by || 'Agent', at: new Date().toISOString() });
        task.updated = today();
        saveData(db);
        sendJSON(res, { success: true, task });
        return;
      }

      sendJSON(res, { error: 'Unknown action' }, 400);
    } catch (e) {
      sendJSON(res, { error: e.message }, 400);
    }
    return;
  }

  // Static files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  const fullPath = path.join(__dirname, filePath);

  // Security: prevent directory traversal
  const resolvedFull = path.resolve(fullPath);
  const rootDir = path.resolve(__dirname);
  if (resolvedFull !== rootDir && !resolvedFull.startsWith(rootDir + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      const ext = path.extname(fullPath);
      const contentType = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(fullPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  } catch (e) {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`RUBRIC Sprint & Backlog running at http://${HOST}:${PORT}`);
});
