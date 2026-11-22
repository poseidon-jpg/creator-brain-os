// Launcher for the micro apps in tools/micro-apps. Allowlist only: nothing outside this table can be started.
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const APPS = {
  'rubric-recos': { label: 'RUBRIC Recos', port: 50013, env: { AGENTIC_OS: '' } },
  'rubric-carousels': { label: 'RUBRIC Carousels', port: 50009, env: {} },
  'rubric-editor': { label: 'RUBRIC Editor', port: 50002, env: {}, flag: '--port' },
};
const children = new Map();

const dirOf = (root, id) => path.join(root, 'tools', 'micro-apps', id);
function ping(port) {
  return new Promise(ok => {
    const r = http.get({ host: '127.0.0.1', port, path: '/', timeout: 700 }, res => { res.resume(); ok(true); });
    r.on('timeout', () => { r.destroy(); ok(false); });
    r.on('error', () => ok(false));
  });
}
async function list(root) {
  return Promise.all(Object.entries(APPS).map(async ([id, a]) => {
    const installed = fs.existsSync(path.join(dirOf(root, id), 'server.mjs'));
    return { id, label: a.label, port: a.port, url: `http://localhost:${a.port}/`, installed, running: installed ? await ping(a.port) : false };
  }));
}
async function start(root, id) {
  const a = Object.hasOwn(APPS, id) ? APPS[id] : null;
  if (!a) return { error: 'unknown app' };
  const dir = dirOf(root, id);
  if (!fs.existsSync(path.join(dir, 'server.mjs'))) return { error: 'not installed' };
  if (await ping(a.port)) return { ok: true, url: `http://localhost:${a.port}/`, already: true };
  const env = { ...process.env, ...a.env }; delete env.PORT;   // the hub's own PORT must never leak into an app
  const p = spawn(process.execPath, a.flag ? ['server.mjs', a.flag, String(a.port)] : ['server.mjs', String(a.port)], { cwd: dir, detached: true, stdio: 'ignore', env });
  p.unref(); children.set(id, p);
  for (let i = 0; i < 12; i++) { await new Promise(r => setTimeout(r, 250)); if (await ping(a.port)) return { ok: true, url: `http://localhost:${a.port}/` }; }
  return { error: 'started but not answering yet; try Open again in a moment' };
}
function stop(id) {
  const p = children.get(id);
  if (!p || p.exitCode !== null || p.killed) { children.delete(id); return { error: 'only apps started from here can be stopped here' }; }
  try { p.kill(); } catch { }
  children.delete(id);
  return { ok: true };
}
process.on('exit', () => children.forEach(p => { try { process.kill(p.pid); } catch { } }));
module.exports = { list, start, stop };
