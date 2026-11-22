#!/usr/bin/env node
/**
 * RUBRIC Storyboards (beta) · a local app for planning a video as a storyboard and reviewing it with pinned comments.
 *
 *   Board    a project can carry `board` panels: one still per shot (id, file, t, title, caption, and optional start,
 *            end, animate, bullets, clip, answers). The page shows them as a grid; a click pins a comment on a still
 *            (a comments.json entry with target "board", the panel id, and x, y in % of the still).
 *            A pitch (kind "board", no finals, no video) is a plan before anything is produced. Its shot times move
 *            with PATCH /api/projects/<id>/timing. make-pitch.mjs makes one from a spec and a folder of images.
 *            import-video.mjs makes a project from a finished MP4 (kind "video"), which the page plays in a <video>.
 *            An overall comment (about the whole video) is target "video" with no panel and t, x, y all null.
 *   Step 1   a request becomes a wireframe storyboard: your agent returns JSON that the page plays as a grey-box
 *            animatic. Comment on it and revise it as often as you like.
 *   Step 2   the storyboard and the comments become the final video: your agent writes index.html to the seek/render
 *            contract in prompts.mjs. The page plays and scrubs it through window.__reel; export.py makes the MP4.
 *
 * Projects live in projects/<id>/ (project.json, comments.json, board/, wireframe-vN.json, final-vN/, logs/), so your
 * agent can read the comments straight from disk. Your agent runs through AGENT_CMD in env.local (see agent.mjs).
 *
 *   node server.mjs [port]
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { CONFIG, HERE, HAS_ENV_FILE, VERSION } from './config.mjs';
import { EFFORTS, agentStatus, imageToolStatus, prepareRun, spawnAgent, stopTree, splitCommand, safeEnv,
  extractStoryboard, resultMeta, readProgressLine } from './agent.mjs';
import { wireframePrompt, finalPrompt } from './prompts.mjs';

const [NODE_MAJOR] = process.versions.node.split('.').map(Number);
if (NODE_MAJOR < 18) {
  console.error(`\n  RUBRIC Storyboards needs Node.js 18 or newer. You are running ${process.version}\n`);
  process.exit(1);
}

const PORT = Number(process.argv[2]) || CONFIG.port;
const DATA = CONFIG.projectsDir;
const WORK = CONFIG.workDir;
fs.mkdirSync(DATA, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

const MODELS = CONFIG.models;
const SIZES = { '16:9': [1920, 1080], '9:16': [1080, 1920], '1:1': [1080, 1080] };
const MB = 1024 * 1024;

/* ------------------------------------------------------------------ helpers */

const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
function writeJSON(f, v) {
  const tmp = `${f}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(v, null, 1));
  fs.renameSync(tmp, f);
}

/** A project id is its folder name: letters, digits, dot, dash and underscore, never "..". */
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
const validId = id => typeof id === 'string' && ID_RE.test(id) && !id.includes('..');
const pdir = id => `${DATA}/${id}`;
function loadProject(id) {
  if (!validId(id)) return null;
  const p = readJSON(`${pdir(id)}/project.json`, null);
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  p.id = id;   // the folder decides where it saves, whatever the file says
  if (!Array.isArray(p.wireframes)) p.wireframes = [];
  if (!Array.isArray(p.finals)) p.finals = [];
  if (!p.updated) p.updated = p.created || new Date(0).toISOString();
  return p;
}
function saveProject(p) { p.updated = new Date().toISOString(); writeJSON(`${pdir(p.id)}/project.json`, p); }
const loadComments = id => { const c = readJSON(`${pdir(id)}/comments.json`, []); return Array.isArray(c) ? c : []; };
const saveComments = (id, c) => writeJSON(`${pdir(id)}/comments.json`, c);
const latestWireframe = p => p.wireframes[p.wireframes.length - 1] || null;
const latestFinal = p => p.finals[p.finals.length - 1] || null;
const openComments = (id, target, v) => loadComments(id).filter(c => c.target === target && c.v === v && c.status === 'open').sort((a, b) => a.t - b.t);

function copyDir(from, to, skip = () => false) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (skip(e.name)) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (e.isDirectory()) copyDir(a, b, skip); else if (e.isFile()) fs.copyFileSync(a, b);
  }
}

/** Files a run has written so far (two levels deep), newest last, for the progress line. */
function listFiles(dir, skip) {
  const out = [];
  const walk = (d, rel, depth) => {
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (depth < 1) walk(path.join(d, e.name), r, depth + 1); }
      else if (!skip.has(r)) { try { out.push([r, fs.statSync(path.join(d, e.name)).mtimeMs]); } catch { /* gone */ } }
    }
  };
  walk(dir, '', 0);
  return out.sort((a, b) => a[1] - b[1]).map(x => x[0]);
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);

/** The storyboard's on-screen words keep to plain hyphens: em and en dashes a model writes become " - " and "-". */
function dashFree(v) {
  if (typeof v === 'string') return v.replace(/\s*\u2014\s*/g, ' - ').replace(/\u2013/g, '-');
  if (Array.isArray(v)) return v.map(dashFree);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dashFree(x)]));
  return v;
}

/** Make whatever the agent returned safe to play: contiguous scenes, elements inside their scene. */
function normalize(sb, p) {
  sb = dashFree(sb);
  const duration = p.duration;
  const scenes = (Array.isArray(sb.scenes) ? sb.scenes : []).filter(s => s && typeof s === 'object')
    .sort((a, b) => num(a.start, 0) - num(b.start, 0)).slice(0, 80);
  if (!scenes.length) throw new Error('the storyboard came back with no scenes');
  let t = 0;
  scenes.forEach((s, i) => {
    s.id = `s${i + 1}`;
    s.name = String(s.name || `Scene ${i + 1}`).slice(0, 60);
    s.start = +t.toFixed(3);
    let end = num(s.end, s.start + duration / scenes.length);
    if (i === scenes.length - 1) end = duration;
    s.end = +clamp(end, s.start + 0.2, duration).toFixed(3);
    t = s.end;
    const len = s.end - s.start;
    s.camera = String(s.camera || 'static');
    s.transition = String(s.transition || 'cut');
    s.bg = String(s.bg || 'dark');
    s.idea = String(s.idea || '');
    s.sfx = s.sfx ? String(s.sfx) : '';
    s.elements = (Array.isArray(s.elements) ? s.elements : []).filter(e => e && typeof e === 'object').slice(0, 12).map(e => ({
      kind: String(e.kind || 'shape'),
      label: String(e.label ?? ''),
      shape: String(e.shape || 'rect'),
      x: clamp(num(e.x, 50), -20, 120), y: clamp(num(e.y, 50), -20, 120),
      w: clamp(num(e.w, 20), 1, 140), h: clamp(num(e.h, 10), 1, 140),
      accent: !!e.accent,
      enter: String(e.enter || 'fade'),
      enter_at: clamp(num(e.enter_at, 0), 0, Math.max(0, len - 0.05)),
      exit: String(e.exit || 'none'),
      exit_at: e.exit && e.exit !== 'none' ? clamp(num(e.exit_at, len - 0.3), 0, len) : null,
      move: String(e.move || 'none'),
    }));
  });
  return {
    title: String(sb.title || p.title), logline: String(sb.logline || ''), duration, aspect: p.aspect,
    bpm: clamp(num(sb.bpm, 120), 60, 200), look: String(sb.look || ''), sound: String(sb.sound || ''), scenes,
  };
}

/** The model a run uses: one from that step's list, or none (your agent's own default) when the list is empty. */
function pickModel(step, want) {
  const list = MODELS[step];
  if (!list.length || !agentStatus().usesModel) return '';
  return list.some(m => m[0] === want) ? want : list[0][0];
}
const modelName = id => [...MODELS.wireframe, ...MODELS.final].find(m => m[0] === id)?.[1] || id || '';

/* ------------------------------------------------------------------ jobs */

const running = new Map(); // project id -> child process

/**
 * One run of your agent for a project. The prompt goes in on standard input; `collect` keeps the whole output for
 * the wireframe's JSON; `watch` lists the files the run writes, for the progress line.
 */
function runAgent(p, job, { cwd, prompt, vals, watch, onDone, cleanup }) {
  const id = p.id;
  const logDir = `${pdir(id)}/logs`;
  fs.mkdirSync(logDir, { recursive: true });
  const run = prepareRun(vals);
  if (CONFIG.dryRun) {
    const file = `logs/${job.id}.dry-run.txt`;
    fs.writeFileSync(`${pdir(id)}/${file}`, ['Dry run (AGENT_DRY_RUN is on in env.local): nothing ran.', '',
      `Command: ${run.line}`, `Folder: ${cwd}`, '', 'Prompt (sent on standard input):', '', prompt, ''].join('\n'));
    p.job = null;
    p.lastJob = { kind: job.kind, model: job.model, effort: job.effort, ended: new Date().toISOString(), ok: false, dry: true,
      error: `dry run: nothing ran. The command and the prompt are in ${file}` };
    saveProject(p);
    if (cleanup) cleanup();
    return;
  }
  const log = fs.createWriteStream(`${logDir}/${job.id}.log`);
  log.write(`$ ${run.line}\n(in ${cwd})\n\n`);
  const child = spawnAgent(run, cwd);
  running.set(id, child);
  p.job = { ...job, status: 'running', started: new Date().toISOString(), progress: { thinking: 0, tools: 0, last: '', files: [] } };
  saveProject(p);

  let out = '', err = '', buf = '', lastSave = 0, timedOut = false, finished = false, dropLine = false;
  const progress = p.job.progress;
  const flush = () => {
    const now = Date.now();
    if (now - lastSave < 1500) return;
    lastSave = now;
    const cur = loadProject(id);
    if (cur?.job) { cur.job.progress = progress; saveProject(cur); }
  };
  const skip = new Set(['storyboard.json']);
  const watcher = watch ? setInterval(() => { progress.files = listFiles(cwd, skip).slice(-12); flush(); }, 2000) : null;
  const timer = setTimeout(() => { timedOut = true; stopTree(child); }, CONFIG.timeoutMs);

  child.stdout.on('data', d => {
    const s = d.toString();
    log.write(s);
    // keep the end of the output: an agent that prints JSON events puts its result (cost, errors, final text) last
    out += s;
    if (out.length > 8 * MB) out = out.slice(-6 * MB);
    buf += s;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      if (!dropLine) readProgressLine(buf.slice(0, nl), progress);
      dropLine = false;
      buf = buf.slice(nl + 1);
    }
    // one huge line (an event carrying a whole file) is skipped for the progress line, never read in pieces
    if (buf.length > 2 * MB) { buf = ''; dropLine = true; }
    flush();
  });
  child.stderr.on('data', d => { log.write(d); if (err.length < 20000) err += d; });
  child.stdin.on('error', () => {});

  const finish = (code, spawnError) => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    if (watcher) clearInterval(watcher);
    log.end();
    running.delete(id);
    const cur = loadProject(id) || p;
    const seconds = Math.round((Date.now() - Date.parse(cur.job?.started || Date.now())) / 1000);
    let error = null, meta = { cost: null, turns: null };
    try {
      if (cur.job?.cancelled) throw new Error('cancelled');
      if (timedOut) throw new Error(`stopped after ${CONFIG.timeoutMs / 60000} minutes (AGENT_TIMEOUT_MINUTES in env.local)`);
      if (spawnError) throw new Error(`your agent did not start: ${spawnError.message}`);
      if (code !== 0) throw new Error(`your agent stopped with exit code ${code}: ${(err || out).trim().slice(-400) || 'no output'} (full output in logs/${job.id}.log)`);
      meta = resultMeta(out);
      if (meta.isError) throw new Error(`your agent reported an error: ${meta.text.slice(0, 300)}`);
      onDone(cur, { out, ...meta }, seconds);
    } catch (e) { error = e.message; }
    const fresh = loadProject(id) || cur;
    fresh.lastJob = { kind: job.kind, model: job.model, effort: job.effort, ended: new Date().toISOString(), ok: !error, error,
      seconds, cost: meta.cost ?? null, turns: meta.turns ?? null };
    fresh.job = null;
    saveProject(fresh);
    if (cleanup) cleanup();
  };
  child.on('error', e => finish(null, e));
  child.on('close', code => finish(code, null));
  child.stdin.end(prompt);
}

function startWireframe(p, { model, effort, revise }) {
  const current = revise ? latestWireframe(p) : null;
  const sb = current ? readJSON(`${pdir(p.id)}/${current.file}`, null) : null;
  const comments = current ? openComments(p.id, 'wf', current.v) : [];
  if (revise && !comments.length) throw new Error('add a comment on the wireframe first, then revise');
  const s = agentStatus();
  const job = { id: `wf-${Date.now()}`, kind: revise ? 'revise-wireframe' : 'wireframe', model: model || null, effort: s.usesEffort ? effort : null };
  // an empty folder of its own, so the run sees nothing but the prompt; removed when it ends
  const cwd = `${WORK}/${p.id}-wf-${Date.now()}`;
  fs.mkdirSync(cwd, { recursive: true });
  runAgent(p, job, {
    cwd, watch: false,
    prompt: wireframePrompt({ request: p.request, duration: p.duration, aspect: p.aspect, current: sb, comments }),
    vals: { step: 'wireframe', model, effort: s.usesEffort ? effort : '', mcp_config: '' },
    cleanup: () => { try { fs.rmSync(cwd, { recursive: true, force: true }); } catch { /* temp folder */ } },
    onDone(cur, res, seconds) {
      const raw = extractStoryboard(res.out);
      if (!raw) throw new Error(`your agent did not return the storyboard as JSON (see logs/${job.id}.log)`);
      const clean = normalize(raw, cur);
      const v = cur.wireframes.length + 1;
      const file = `wireframe-v${v}.json`;
      writeJSON(`${pdir(cur.id)}/${file}`, clean);
      cur.wireframes.push({ v, file, created: new Date().toISOString(), model: job.model, effort: job.effort, cost: res.cost, seconds,
        from: current?.v ?? null, applied: comments.map(c => c.id) });
      if (!cur.renamed) cur.title = clean.title.slice(0, 120);
      saveProject(cur);
      if (comments.length) {
        const all = loadComments(cur.id);
        for (const c of all) if (comments.some(x => x.id === c.id)) { c.status = 'applied'; c.appliedIn = `wireframe v${v}`; }
        saveComments(cur.id, all);
      }
    },
  });
}

function startFinal(p, { model, effort, imageBudget, revise }) {
  const wf = latestWireframe(p);
  if (!wf) throw new Error('make a wireframe first');
  const prev = latestFinal(p);
  if (revise && !prev) throw new Error('there is no final video to revise yet');
  const sb = readJSON(`${pdir(p.id)}/${wf.file}`, null);
  if (!sb) throw new Error(`the wireframe file ${wf.file} is missing`);
  const wfComments = revise ? [] : openComments(p.id, 'wf', wf.v);
  const finalComments = revise ? openComments(p.id, 'final', prev.v) : [];
  if (revise && !finalComments.length) throw new Error('add a comment on the final video first, then revise');
  const v = p.finals.length + 1;
  const dir = `${WORK}/${p.id}-final-v${v}-${Date.now()}`;
  if (revise) copyDir(`${pdir(p.id)}/${prev.dir}`, dir, n => n === 'export.mp4' || n.endsWith('.mp4.video.mp4'));
  else fs.mkdirSync(dir, { recursive: true });
  writeJSON(`${dir}/storyboard.json`, sb);
  const [width, height] = SIZES[p.aspect] || SIZES['16:9'];
  const budget = imageToolStatus().available ? Math.max(0, Math.min(25, Number(imageBudget) || 0)) : 0;
  let mcpConfig = '';
  if (budget > 0) {
    // a standard MCP config file your agent loads through {mcp_config}; the key stays in env.local (gen-mcp.mjs reads it)
    mcpConfig = `${dir}.mcp.json`;
    writeJSON(mcpConfig, { mcpServers: { imagegen: { type: 'stdio', command: process.execPath, args: [`${HERE}/gen-mcp.mjs`], env: {
      GEN_WORKDIR: dir, GEN_LEDGER: `${pdir(p.id)}/final-v${v}-images.json`, GEN_BUDGET_USD: String(budget) } } } });
  }
  const s = agentStatus();
  const job = { id: `final-${Date.now()}`, kind: revise ? 'revise-final' : 'final', model: model || null, effort: s.usesEffort ? effort : null,
    imageBudget: budget, workdir: dir };
  runAgent(p, job, {
    cwd: dir, watch: true,
    prompt: finalPrompt({ request: p.request, sb, width, height, wfComments, finalComments, revising: revise, imageBudget: budget }),
    vals: { step: 'final', model, effort: s.usesEffort ? effort : '', mcp_config: mcpConfig },
    onDone(cur, res, seconds) {
      if (!fs.existsSync(`${dir}/index.html`)) throw new Error(`the run finished without writing index.html in its folder (${dir})`);
      const out = `final-v${v}`;
      copyDir(dir, `${pdir(cur.id)}/${out}`);
      const ledger = readJSON(`${pdir(cur.id)}/final-v${v}-images.json`, null);
      cur.finals.push({ v, dir: out, created: new Date().toISOString(), model: job.model, effort: job.effort, cost: res.cost, seconds,
        turns: res.turns, fromWireframe: wf.v, from: revise ? prev.v : null, imageBudget: budget, imageSpent: ledger?.spent ?? 0,
        said: String(res.text || '').slice(0, 4000), export: null });
      saveProject(cur);
      const used = [...wfComments, ...finalComments];
      if (used.length) {
        const all = loadComments(cur.id);
        for (const c of all) if (used.some(x => x.id === c.id)) { c.status = 'applied'; c.appliedIn = `final v${v}`; }
        saveComments(cur.id, all);
      }
    },
  });
}

function startExport(p, v) {
  const f = p.finals.find(x => x.v === v);
  if (!f) throw new Error(`no final v${v}`);
  if (!/^[\w.-]+$/.test(String(f.dir))) throw new Error(`final v${v} has an unexpected folder name`);
  const url = `http://127.0.0.1:${PORT}/p/${encodeURIComponent(p.id)}/${f.dir}/index.html`;
  const out = `${pdir(p.id)}/${f.dir}/export.mp4`;
  const py = splitCommand(CONFIG.python);
  const job = { id: `export-${Date.now()}`, kind: 'export', model: null, effort: null, v };
  const child = spawn(py[0], [...py.slice(1), `${HERE}/export.py`, url, out], { windowsHide: true, env: safeEnv() });
  running.set(p.id, child);
  p.job = { ...job, status: 'running', started: new Date().toISOString(), progress: { thinking: 0, tools: 0, last: 'starting the browser', files: [] } };
  saveProject(p);
  let err = '', lastSave = 0, finished = false;
  child.stdout.on('data', d => {
    const lines = d.toString().trim().split(/\r?\n/);
    const last = lines[lines.length - 1];
    if (Date.now() - lastSave > 1000) { lastSave = Date.now(); const cur = loadProject(p.id); if (cur?.job) { cur.job.progress.last = last.slice(0, 140); saveProject(cur); } }
  });
  child.stderr.on('data', d => { if (err.length < 20000) err += d; });
  const finish = (code, spawnError) => {
    if (finished) return;
    finished = true;
    running.delete(p.id);
    const cur = loadProject(p.id) || p;
    const seconds = Math.round((Date.now() - Date.parse(cur.job?.started || Date.now())) / 1000);
    const ok = !spawnError && code === 0 && fs.existsSync(out) && !cur.job?.cancelled;
    if (ok) { const fin = cur.finals.find(x => x.v === v); if (fin) fin.export = { file: `${f.dir}/export.mp4`, created: new Date().toISOString(), seconds, bytes: fs.statSync(out).size }; }
    const why = spawnError ? `could not start Python ("${CONFIG.python}"): ${spawnError.message}. Set PYTHON in env.local.`
      : cur.job?.cancelled ? 'cancelled' : err.trim().split('\n').slice(-3).join(' ').slice(0, 400) || `exit ${code}`;
    cur.lastJob = { kind: 'export', ended: new Date().toISOString(), ok, error: ok ? null : why, seconds };
    cur.job = null;
    saveProject(cur);
  };
  child.on('error', e => finish(null, e));
  child.on('close', code => finish(code, null));
}

// a job that was running when the app stopped can't be resumed
for (const d of fs.readdirSync(DATA)) {
  const p = loadProject(d);
  if (p?.job) { p.lastJob = { kind: p.job.kind, ended: new Date().toISOString(), ok: false, error: 'interrupted: the app restarted while it ran' }; p.job = null; saveProject(p); }
}

/* ------------------------------------------------------------------ http */

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.glb': 'model/gltf-binary', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8' };

const BASE_HEADERS = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
function send(res, code, body, type = 'application/json; charset=utf-8') {
  res.writeHead(code, { ...BASE_HEADERS, 'Content-Type': type });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
function sendFile(req, res, file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return send(res, 404, { error: 'not found' });
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const size = fs.statSync(file).size;
  const range = req.headers.range && /bytes=(\d*)-(\d*)/.exec(req.headers.range);
  if (range && (type.startsWith('video/') || type.startsWith('audio/')) && size > 0) {
    const start = range[1] ? +range[1] : 0, end = Math.min(range[2] ? +range[2] : size - 1, size - 1);
    if (start >= size || start > end) { res.writeHead(416, { ...BASE_HEADERS, 'Content-Range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...BASE_HEADERS, 'Content-Type': type, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes', 'Content-Length': end - start + 1 });
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...BASE_HEADERS, 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes' });
  fs.createReadStream(file).pipe(res);
}
function sendApp(res) {
  let html = fs.readFileSync(`${HERE}/app.html`, 'utf8');
  if (CONFIG.token) html = html.replace('</head>', `<script>window.RUBRIC_TOKEN=${JSON.stringify(CONFIG.token).replace(/</g, '\\u003c')};</script></head>`);
  send(res, 200, html, 'text/html; charset=utf-8');
}

/** The JSON body, capped at 1 MB. Resolves to null once it has already answered 413. */
function body(req, res) {
  return new Promise(resolve => {
    const tooBig = () => {
      res.writeHead(413, { ...BASE_HEADERS, 'Content-Type': 'application/json; charset=utf-8', Connection: 'close' });
      res.end(JSON.stringify({ error: 'request too large (limit 1 MB)' }), () => req.destroy());
      resolve(null);
    };
    if (Number(req.headers['content-length'] || 0) > MB) return tooBig();
    const chunks = [];
    let size = 0, over = false;
    req.on('data', d => { if (over) return; size += d.length; if (size > MB) { over = true; return tooBig(); } chunks.push(d); });
    req.on('end', () => { if (over) return; try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { resolve({}); } });
    req.on('error', () => { if (!over) { over = true; resolve(null); } });
  });
}

function summary(p) {
  const wf = latestWireframe(p), fin = latestFinal(p);
  const open = loadComments(p.id).filter(c => c.status === 'open').length;
  // kind "board": a board of stills (a pitch, or real frames from a video built as HTML, with its finals); no wireframe step
  return { id: p.id, title: String(p.title || p.id), duration: p.duration, aspect: p.aspect, created: p.created, updated: p.updated,
    kind: p.kind === 'video' || p.kind === 'board' ? p.kind : 'wireframe', shots: Array.isArray(p.board) ? p.board.length : 0,
    from: p.from || null, wireframe: wf?.v ?? 0, final: fin?.v ?? 0, exported: !!fin?.export,
    job: p.job ? { kind: p.job.kind, started: p.job.started } : null, open };
}

function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').split('-').slice(0, 5).join('-') || 'video'; }

/** A pitch: a board of planned stills, nothing produced yet. Only a pitch's shot times can move; a video's come from the video. */
const isPitch = p => p.kind === 'board' && !(p.finals || []).length && !p.video;
const MIN_SHOT = 0.5, MAX_LENGTH = 600;
/** New shot times for a pitch, [{id, start, end, t?}] for every shot in board order: contiguous from 0, each at least
    MIN_SHOT long. Returns the error to show, or null once the board and the duration are updated (t kept inside its shot). */
function retime(p, list) {
  const B = Array.isArray(p.board) ? p.board : [];
  if (!Array.isArray(list) || list.length !== B.length) return `send the times for all ${B.length} shots`;
  const byId = new Map(list.filter(x => x && typeof x === 'object').map(x => [x.id, x]));
  if (byId.size !== B.length || B.some(b => !byId.has(b.id))) return 'the shot ids do not match this board';
  const r3 = v => Math.round(v * 1000) / 1000;
  const next = [];
  let prev = 0;
  for (const [i, b] of B.entries()) {
    const x = byId.get(b.id), start = Number(x.start), end = Number(x.end);
    if (!isFinite(start) || !isFinite(end)) return `shot ${i + 1} needs a start and an end in seconds`;
    if (Math.abs(start - prev) > 1e-6) return `shot ${i + 1} has to start where ${i ? `shot ${i} ends (${r3(prev)} s)` : 'the video starts (0 s)'}`;
    if (end - start < MIN_SHOT - 1e-6) return `shot ${i + 1} has to be at least ${MIN_SHOT} s long`;
    const t = x.t == null ? b.t : Number(x.t);
    if (!isFinite(t)) return `shot ${i + 1} has a still time that is not a number`;
    next.push({ start: r3(start), end: r3(end), t });
    prev = end;
  }
  if (prev > MAX_LENGTH) return `the video can be at most ${MAX_LENGTH} s long`;
  B.forEach((b, i) => {
    const n = next[i];
    b.start = n.start; b.end = n.end;
    b.t = +clamp(n.t, n.start, Math.max(n.start, n.end - 0.1)).toFixed(3);
  });
  p.duration = r3(prev);
  return null;
}

/* who may call: this computer only, through this app's own address */
const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const OWN_ORIGINS = new Set([`http://127.0.0.1:${PORT}`, `http://localhost:${PORT}`]);
const originOk = req => !req.headers.origin || OWN_ORIGINS.has(req.headers.origin);
function tokenOk(req) {
  if (!CONFIG.token) return true;
  const got = Buffer.from(String(req.headers['x-rubric-token'] || '')), want = Buffer.from(CONFIG.token);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
const COMMENT_ID = /^[A-Za-z0-9_-]{1,40}$/;
const isoOr = (v, d) => (typeof v === 'string' && v.length <= 40 && !isNaN(Date.parse(v)) ? v : d);

const server = http.createServer(async (req, res) => {
  try {
    if (!ALLOWED_HOSTS.has(String(req.headers.host || '').toLowerCase())) return send(res, 403, { error: 'unknown host' });
    const url = new URL(req.url, 'http://127.0.0.1');
    let parts;
    try { parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent); } catch { return send(res, 400, { error: 'bad address' }); }

    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) return sendApp(res);
    if (req.method === 'GET' && url.pathname === '/player.js') return sendFile(req, res, `${HERE}/player.js`);

    // a project's own files (stills, clips, the video, finals): read only, never outside the project's folder
    if (parts[0] === 'p' && parts[1] && req.method === 'GET') {
      if (!validId(parts[1]) || !fs.existsSync(pdir(parts[1]))) return send(res, 404, { error: 'no such project' });
      const root = path.resolve(pdir(parts[1]));
      const file = path.resolve(root, parts.slice(2).join('/') || 'index.html');
      if (!(file === root || file.startsWith(root + path.sep))) return send(res, 403, { error: 'outside the project' });
      return sendFile(req, res, file);
    }

    if (parts[0] !== 'api') return send(res, 404, { error: 'not found' });
    if (!originOk(req)) return send(res, 403, { error: 'origin not allowed' });
    if (!tokenOk(req)) return send(res, 401, { error: 'missing or wrong x-rubric-token (see RUBRIC_TOKEN in env.local)' });
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !/^application\/json\b/i.test(String(req.headers['content-type'] || ''))) {
      return send(res, 415, { error: 'send JSON (Content-Type: application/json)' });
    }

    if (parts[1] === 'meta') {
      return send(res, 200, { version: VERSION, projectsDir: DATA, models: MODELS, efforts: EFFORTS, agent: agentStatus(),
        images: imageToolStatus(), python: CONFIG.python });
    }

    if (parts[1] === 'projects' && !parts[2]) {
      if (req.method === 'GET') {
        const list = fs.readdirSync(DATA).map(loadProject).filter(Boolean).map(summary).sort((a, b) => String(b.updated).localeCompare(String(a.updated)));
        return send(res, 200, list);
      }
      if (req.method === 'POST') {
        const b = await body(req, res);
        if (!b) return;
        const request = String(b.request || '').trim().slice(0, 4000);
        if (!request) return send(res, 400, { error: 'describe the video first' });
        if (!agentStatus().configured) return send(res, 400, { error: 'connect your agent first: set AGENT_CMD in env.local (see the README), then restart the app' });
        const duration = clamp(Number(b.duration) || 15, 3, 120);
        const aspect = SIZES[b.aspect] ? b.aspect : '16:9';
        const d = new Date();
        const id = `${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${slugify(request)}-${crypto.randomBytes(2).toString('hex')}`;
        fs.mkdirSync(pdir(id), { recursive: true });
        const p = { id, title: request.split(/\s+/).slice(0, 7).join(' '), request, duration, aspect, created: d.toISOString(), updated: d.toISOString(),
          wireframes: [], finals: [], job: null, lastJob: null, renamed: false };
        saveProject(p);
        saveComments(id, []);
        try {
          startWireframe(p, { model: pickModel('wireframe', b.model), effort: EFFORTS.includes(b.effort) ? b.effort : 'low', revise: false });
        } catch (e) {
          const cur = loadProject(id) || p;
          cur.lastJob = { kind: 'wireframe', ended: new Date().toISOString(), ok: false, error: e.message };
          saveProject(cur);
        }
        return send(res, 200, summary(loadProject(id)));
      }
    }

    if (parts[1] === 'projects' && parts[2]) {
      const p = loadProject(parts[2]);
      if (!p) return send(res, 404, { error: 'no such project' });
      const busy = () => { if (running.has(p.id) || p.job) throw Object.assign(new Error('something is already running for this video'), { code: 409 }); };
      const what = parts[3];

      if (!what && req.method === 'GET') return send(res, 200, { project: p, comments: loadComments(p.id) });
      // a write reads the project again once the request body is in, so two quick saves never undo each other
      const fresh = () => loadProject(p.id) || p;
      if (!what && req.method === 'PATCH') {
        const b = await body(req, res);
        if (!b) return;
        const cur = fresh();
        if (b.title) { cur.title = String(b.title).slice(0, 120); cur.renamed = true; }
        saveProject(cur);
        return send(res, 200, { project: cur });
      }
      // a pitch's shot times, dragged on the timeline: [{id, start, end, t?}] (or { shots: [...] }), written atomically
      if (what === 'timing' && req.method === 'PATCH') {
        if (!isPitch(p)) return send(res, 409, { error: 'only a pitch has shot times to move; this video\'s times come from a real video' });
        const b = await body(req, res);
        if (!b) return;
        const cur = fresh();
        const err = retime(cur, Array.isArray(b) ? b : b.shots);
        if (err) return send(res, 400, { error: err });
        saveProject(cur);
        return send(res, 200, { project: cur });
      }
      if (what === 'wireframe' && req.method === 'GET') {
        const v = Number(parts[4]) || latestWireframe(p)?.v;
        const w = p.wireframes.find(x => x.v === v);
        return w ? send(res, 200, readJSON(`${pdir(p.id)}/${w.file}`, null)) : send(res, 404, { error: 'no wireframe yet' });
      }
      if (what === 'wireframe' && req.method === 'POST') {
        busy();
        const b = await body(req, res);
        if (!b) return;
        startWireframe(p, { model: pickModel('wireframe', b.model), effort: EFFORTS.includes(b.effort) ? b.effort : 'low', revise: true });
        return send(res, 200, { ok: true });
      }
      if (what === 'final' && req.method === 'POST') {
        busy();
        const b = await body(req, res);
        if (!b) return;
        startFinal(p, { model: pickModel('final', b.model), effort: EFFORTS.includes(b.effort) ? b.effort : 'high', imageBudget: b.imageBudget, revise: !!b.revise });
        return send(res, 200, { ok: true });
      }
      if (what === 'export' && req.method === 'POST') {
        busy();
        const b = await body(req, res);
        if (!b) return;
        startExport(p, Number(b.v) || latestFinal(p)?.v);
        return send(res, 200, { ok: true });
      }
      if (what === 'cancel' && req.method === 'POST') {
        const child = running.get(p.id);
        if (p.job) { p.job.cancelled = true; saveProject(p); }
        if (child) stopTree(child);
        else if (p.job) { p.lastJob = { kind: p.job.kind, ended: new Date().toISOString(), ok: false, error: 'cancelled' }; p.job = null; saveProject(p); }
        return send(res, 200, { ok: true });
      }
      if (what === 'comments') {
        // the body first, then the comments file, so a save never writes back a list older than the last one
        const b = req.method === 'POST' || req.method === 'PUT' ? await body(req, res) : {};
        if (!b) return;
        const all = loadComments(p.id);
        const touch = () => saveProject(fresh());
        if (req.method === 'POST' && !parts[4]) {
          // wf and final comments belong to a version; board comments to a still (panel), video comments to the video
          const target = ['wf', 'final', 'board', 'video'].includes(b.target) ? b.target : 'wf';
          const panel = target === 'board' ? (p.board || []).find(x => x.id === b.panel) : null;
          if (target === 'board' && !panel) return send(res, 400, { error: 'no such panel on the board' });
          // an overall comment is about the whole video: target "video" with no time and no spot (t, x, y null)
          const overall = target === 'video' && (b.overall === true || (Object.prototype.hasOwnProperty.call(b, 't') && b.t === null));
          // an id comes back only when undo puts a deleted comment back; anything else gets a fresh one
          const id = typeof b.id === 'string' && COMMENT_ID.test(b.id) && !all.some(x => x.id === b.id) ? b.id : crypto.randomBytes(4).toString('hex');
          const c = { id, target, ...(panel ? { panel: panel.id } : {}),
            v: target === 'board' || target === 'video' ? null : Number(b.v) || 1,
            t: overall ? null : +clamp(Number(b.t ?? panel?.t) || 0, 0, p.duration).toFixed(3),
            x: overall || b.x == null ? null : +clamp(Number(b.x) || 0, 0, 100).toFixed(1),
            y: overall || b.y == null ? null : +clamp(Number(b.y) || 0, 0, 100).toFixed(1), text: String(b.text || '').slice(0, 4000),
            created: isoOr(b.created, new Date().toISOString()),
            status: b.status === 'applied' ? 'applied' : 'open', appliedIn: typeof b.appliedIn === 'string' ? b.appliedIn.slice(0, 160) : null,
            // a comment your agent wrote while playing the reviewer carries simulated + author, so it never passes as yours
            ...(b.simulated ? { simulated: true, author: String(b.author || 'Agent as reviewer').slice(0, 60) } : {}),
            // where it was applied, as "<project id>#<panel id>", so the app can link to the answer
            ...(b.appliedRef ? { appliedRef: String(b.appliedRef).slice(0, 160) } : {}) };
          all.push(c);
          saveComments(p.id, all);
          touch();
          return send(res, 200, c);
        }
        const c = all.find(x => x.id === parts[4]);
        if (!c) return send(res, 404, { error: 'no such comment' });
        if (req.method === 'PUT') {
          if (typeof b.text === 'string') c.text = b.text.slice(0, 4000);
          if (b.t != null && c.t !== null) c.t = +clamp(Number(b.t) || 0, 0, p.duration).toFixed(3);   // an overall comment stays timeless
          if (b.status === 'open' || b.status === 'applied') c.status = b.status;
          if (typeof b.appliedIn === 'string') c.appliedIn = b.appliedIn.slice(0, 160) || null;
          saveComments(p.id, all);
          touch();
          return send(res, 200, c);
        }
        if (req.method === 'DELETE') {
          saveComments(p.id, all.filter(x => x.id !== c.id));
          touch();
          return send(res, 200, { ok: true });
        }
      }
    }
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    if (res.headersSent) return;
    return send(res, e.code === 409 ? 409 : 500, { error: e.message });
  }
});

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use. Set PORT in env.local (or run: node server.mjs <another port>)\n`);
    process.exit(1);
  }
  throw e;
});

server.listen(PORT, '127.0.0.1', () => {
  const a = agentStatus();
  const agent = a.error ? `AGENT_CMD problem: ${a.error}` : a.configured ? `connected${a.dryRun ? ' (dry run: nothing will run)' : ''}` : 'not connected (boards and comments work; set AGENT_CMD in env.local for the wireframe and final steps)';
  console.log(`\n  RUBRIC Storyboards (beta) v${VERSION} on http://127.0.0.1:${PORT}/`);
  console.log(`  projects: ${DATA}`);
  console.log(`  your agent: ${agent}`);
  if (!HAS_ENV_FILE) console.log('  env.local: not found, using the defaults (copy env.example to env.local to change them)');
  console.log('');
});
