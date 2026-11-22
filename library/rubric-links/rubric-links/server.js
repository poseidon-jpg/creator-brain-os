import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Node 18+ check
const [major] = process.versions.node.split('.').map(Number);
if (major < 18) {
  console.error(`Node.js 18+ required (current: ${process.version})`);
  process.exit(1);
}

// .env loader (zero deps)
try {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const envPath = join(__dirname, '.env');
  const envContent = await readFile(envPath, 'utf-8').catch(() => '');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
} catch {
  // .env is optional
}

const PORT = parseInt(process.env.PORT || '5050', 10);
const HOST = '127.0.0.1';
const __dirname = dirname(fileURLToPath(import.meta.url));

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    // Optional auth token
    if (process.env.RUBRIC_TOKEN && req.url && req.url.startsWith('/api/')) {
      if (req.headers['x-rubric-token'] !== process.env.RUBRIC_TOKEN) {
        res.writeHead(401, { 'Content-Type': 'text/plain' });
        res.end('Unauthorized');
        return;
      }
    }
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      const html = await readFile(join(__dirname, 'index.html'), 'utf-8');
      res.writeHead(200, { 'Content-Type': MIME_TYPES['.html'] });
      res.end(html);
    } else if (req.method === 'GET' && req.url === '/api/links') {
      const data = await readFile(join(__dirname, 'data', 'links.json'), 'utf-8');
      res.writeHead(200, { 'Content-Type': MIME_TYPES['.json'] });
      res.end(data);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  } catch (err) {
    console.error(`Error handling ${req.url}:`, err.message);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Set a different port via PORT env var.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, HOST, () => {
  console.log(`RUBRIC Links running at http://${HOST}:${PORT}`);
});
