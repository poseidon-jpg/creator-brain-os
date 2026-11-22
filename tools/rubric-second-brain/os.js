/* os.js - the Command Center's data layer.
   Turns one workspace scan into everything the OS home page shows:
   departments + projects, activity heatmap, skills, memory, routines, apps,
   "what's next" signals, and the Claude-synced calendar/inbox snapshot.
   Every number here comes from disk - nothing is invented. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const DAY = 86400000;
const DATA_DIR = path.join(__dirname, 'data');
const RUNS_FILE = path.join(DATA_DIR, 'runs.json');
const SNAPSHOT_FILE = path.join(DATA_DIR, 'snapshot.json');

function loadJSON(p, fb) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; } }

// ---------- frontmatter (SKILL.md / memory files) ----------
function frontmatter(txt) {
  txt = String(txt).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');   // Windows line endings and BOMs
  const m = /^---\n([\s\S]*?)\n---/.exec(txt);
  const out = {};
  if (!m) return out;
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    let v = kv[2];
    if (/^[>|][+-]?$/.test(v.trim())) {   // YAML block scalar: the text is on the indented lines below
      const body = [];
      while (i + 1 < lines.length && (/^\s+\S/.test(lines[i + 1]) || !lines[i + 1].trim())) body.push(lines[++i].trim());
      v = body.filter(Boolean).join(' ');
    }
    out[kv[1]] = v.replace(/^["']|["']$/g, '');
  }
  return out;
}

// ---------- claude CLI detection (powers the Run buttons) ----------
let claudeBin;
function findClaude() {
  if (claudeBin !== undefined) return claudeBin;
  const home = process.env.HOME || '';
  const candidates = [
    path.join(home, '.local/bin/claude'), path.join(home, '.claude/local/claude'),
    '/opt/homebrew/bin/claude', '/usr/local/bin/claude',
  ];
  claudeBin = candidates.find(c => { try { return fs.statSync(c).isFile(); } catch { return false; } }) || null;
  if (!claudeBin) {
    const r = spawnSync('/bin/zsh', ['-lc', 'command -v claude'], { encoding: 'utf8', timeout: 4000 });
    const p = (r.stdout || '').trim();
    if (p && fs.existsSync(p)) claudeBin = p;
  }
  return claudeBin;
}

// ---------- build the OS model from a scan ----------
function buildOS(scanResult, ROOT, WS) {
  const { cfg, model } = scanResult;
  const dep = cfg.dep;
  const now = Date.now();
  const files = model.files;
  const rules = (dep.pathRules || []).slice().sort((a, b) => b.prefix.length - a.prefix.length);
  const deptOf = rel => { for (const r of rules) if (rel.startsWith(r.prefix)) return r.dept; return dep.default; };
  const skillDirs = (WS.skillDirs || []).map(d => d.replace(/\/+$/, '') + '/');
  const isSkill = rel => skillDirs.some(d => rel.startsWith(d));
  const isTool = rel => rel.startsWith('tools/');

  // departments
  const D = {};
  for (const d of dep.departments) D[d.key] = { ...d, files: 0, bytes: 0, md: 0, last: 0, week: 0, projects: {}, recent: [] };
  // project = the folder one level below the department's path rule (e.g. business/lucky-hit/vsl-system)
  const projectOf = (rel, dk) => {
    const rule = rules.find(r => rel.startsWith(r.prefix));
    if (!rule) return null;
    const rest = rel.slice(rule.prefix.length).split('/');
    return rest.length > 1 ? rule.prefix + rest[0] : null;
  };

  // activity: per-day counts for the last 182 days (26 weeks), per department
  const DAYS = 182;
  const startDay = Math.floor((now - (DAYS - 1) * DAY) / DAY);
  const activity = Array.from({ length: DAYS }, () => ({ total: 0, by: {} }));
  const recentAll = [];

  for (const f of files) {
    if (isSkill(f.rel) || isTool(f.rel) || f.rel.includes('/.git/')) continue;
    const dk = deptOf(f.rel);
    const d = D[dk]; if (!d) continue;
    d.files++; d.bytes += f.size; if (f.ext === '.md') d.md++;
    if (f.mtime > d.last) d.last = f.mtime;
    if (now - f.mtime < 7 * DAY) d.week++;
    const pj = projectOf(f.rel, dk);
    if (pj) {
      const P = d.projects[pj] || (d.projects[pj] = { path: pj, name: pj.split('/').pop(), files: 0, bytes: 0, last: 0, week: 0 });
      P.files++; P.bytes += f.size; if (f.mtime > P.last) P.last = f.mtime; if (now - f.mtime < 7 * DAY) P.week++;
    }
    const di = Math.floor(f.mtime / DAY) - startDay;
    if (di >= 0 && di < DAYS) { const a = activity[di]; a.total++; a.by[dk] = (a.by[dk] || 0) + 1; }
    if (now - f.mtime < 30 * DAY && !/node_modules|\.venv|__pycache__/.test(f.rel)) recentAll.push(f);
  }
  // empty project folders still count as projects ("not started")
  for (const r of rules) {
    const abs = path.join(ROOT, r.prefix);
    let ents = []; try { ents = fs.readdirSync(abs, { withFileTypes: true }); } catch { }
    for (const e of ents) {
      if (!e.isDirectory() || e.name.startsWith('.') || e.name.startsWith('_')) continue;
      const pj = r.prefix + e.name;
      if (rules.some(r2 => r2.prefix.length > r.prefix.length && (pj + '/').startsWith(r2.prefix))) continue; // owned by a more specific department
      const d = D[r.dept];
      if (d && !d.projects[pj]) d.projects[pj] = { path: pj, name: e.name, files: 0, bytes: 0, last: 0, week: 0 };
    }
  }
  recentAll.sort((a, b) => b.mtime - a.mtime);
  const recent = recentAll.slice(0, 40).map(f => ({ path: f.rel, name: f.name, ext: f.ext, mtime: f.mtime, size: f.size, dept: deptOf(f.rel) }));
  for (const f of recent) if (D[f.dept] && D[f.dept].recent.length < 4) D[f.dept].recent.push(f);

  // weekly sparkline per department (last 12 weeks)
  for (const d of Object.values(D)) {
    d.spark = Array.from({ length: 12 }, (_, w) => {
      let s = 0; for (let i = 0; i < 7; i++) { const a = activity[DAYS - 84 + w * 7 + i]; if (a) s += a.by[d.key] || 0; } return s;
    });
  }

  // skills
  const skills = [];
  const seenSkill = new Set();
  for (const sd of WS.skillDirs || []) {
    const abs = path.join(ROOT, sd);
    let ents = []; try { ents = fs.readdirSync(abs, { withFileTypes: true }); } catch { }
    for (const e of ents) {
      const full = path.join(abs, e.name);
      let isDir = e.isDirectory(); if (e.isSymbolicLink()) { try { isDir = fs.statSync(full).isDirectory(); } catch { } }
      if (!isDir || seenSkill.has(e.name)) continue;
      const sk = path.join(full, 'SKILL.md');
      if (!fs.existsSync(sk)) continue;
      seenSkill.add(e.name);
      const txt = fs.readFileSync(sk, 'utf8').slice(0, 6000);
      const fm = frontmatter(txt);
      const st = fs.statSync(sk);
      skills.push({
        name: fm.name || e.name, dir: e.name, path: sd.replace(/\/+$/, '') + '/' + e.name + '/SKILL.md',
        desc: (fm.description || '').slice(0, 280), scope: sd.includes('global') ? 'global' : 'hub', mtime: st.mtimeMs,
        family: /hyperframes|video|caption|motion|slideshow|talking|explainer|launch|remotion|figma|media/.test(e.name) || /hyperframes/i.test(fm.description || '') ? 'video' : 'core',
      });
    }
  }
  skills.sort((a, b) => (a.family === b.family ? a.name.localeCompare(b.name) : a.family === 'core' ? -1 : 1));

  // memory
  const memDir = path.join(ROOT, WS.memoryDir || 'memory');
  const memory = [];
  let memEnts = []; try { memEnts = fs.readdirSync(memDir); } catch { }
  for (const name of memEnts) {
    if (!name.endsWith('.md') || name === (WS.memoryIndex || 'MEMORY.md')) continue;
    const full = path.join(memDir, name);
    const txt = fs.readFileSync(full, 'utf8');
    const fm = frontmatter(txt);
    const body = txt.replace(/^---[\s\S]*?---\s*/, '').split('\n').filter(l => l.trim() && !l.startsWith('*Saved')).join(' ').trim();
    memory.push({ file: (WS.memoryDir || 'memory') + '/' + name, name: fm.name || name, type: fm.type || (fm.metadata ? '' : '') || name.split('_')[0], fact: body.slice(0, 400), mtime: fs.statSync(full).mtimeMs });
  }
  memory.sort((a, b) => b.mtime - a.mtime);

  // what's next: signals, not opinions - each one names its evidence
  const next = [];
  const allProjects = Object.values(D).flatMap(d => Object.values(d.projects).map(p => ({ ...p, dept: d.key, deptLabel: d.label, color: d.color })));
  const onHold = memory.filter(m => /on hold/i.test(m.fact));
  for (const m of onHold) next.push({ kind: 'decide', title: 'Decision pending', text: m.fact.split('.')[0], evidence: m.file });
  const notStarted = allProjects.filter(p => p.files === 0);
  if (notStarted.length) next.push({ kind: 'start', title: notStarted.length + ' lanes not started', text: notStarted.map(p => p.name).join(' · '), evidence: notStarted.map(p => p.path).join(', '), paths: notStarted.map(p => p.path) });
  const hot = allProjects.filter(p => p.week > 0).sort((a, b) => b.week - a.week).slice(0, 2);
  for (const p of hot) next.push({ kind: 'momentum', title: 'Momentum: ' + p.name, text: p.week + ' files changed this week', evidence: p.path, path: p.path, color: p.color });
  const stale = allProjects.filter(p => p.files > 0 && now - p.last > 21 * DAY).sort((a, b) => a.last - b.last).slice(0, 3);
  for (const p of stale) next.push({ kind: 'stale', title: 'Gone quiet: ' + p.name, text: 'untouched for ' + Math.round((now - p.last) / DAY) + ' days', evidence: p.path, path: p.path, color: p.color });

  // streak: consecutive days (ending today or yesterday) with any activity
  let streak = 0;
  for (let i = DAYS - 1; i >= 0; i--) { if (activity[i].total > 0) streak++; else if (i === DAYS - 1) continue; else break; }

  const runs = loadJSON(RUNS_FILE, []);
  const snapshot = loadJSON(SNAPSHOT_FILE, null);

  // quarantine library: skills staged from the classroom, reviewed before install
  const libRoot = path.join(ROOT, 'tools', 'skills-library');
  const library = [];
  try {
    for (const e of fs.readdirSync(libRoot, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('_') || e.name.startsWith('.')) continue;
      const q = path.join(libRoot, e.name, 'QUARANTINE.md');
      const sk = path.join(libRoot, e.name, 'SKILL.md');
      const m = fs.existsSync(q) ? /Status:\s*(.+)/.exec(fs.readFileSync(q, 'utf8')) : null;
      const fm = fs.existsSync(sk) ? frontmatter(fs.readFileSync(sk, 'utf8').slice(0, 4000)) : {};
      library.push({ name: e.name, status: m ? m[1].split(/[,.]/)[0].trim() : 'unreviewed', desc: (fm.description || '').slice(0, 200), path: 'tools/skills-library/' + e.name });
    }
  } catch { }
  library.sort((x, y) => x.name.localeCompare(y.name));

  return {
    generatedAt: now,
    root: path.basename(ROOT),
    totals: {
      files: files.length, dirs: model.dirs.size, md: files.filter(f => f.ext === '.md').length,
      week: Object.values(D).reduce((s, d) => s + d.week, 0), streak, skills: skills.length, memory: memory.length,
      apps: cfg.apps.length, routines: cfg.routines.length, projects: allProjects.length,
    },
    departments: dep.departments.map(d => {
      const x = D[d.key];
      return { key: d.key, label: d.label, color: d.color, icon: d.icon, files: x.files, bytes: x.bytes, md: x.md, last: x.last, week: x.week, spark: x.spark, recent: x.recent,
        projects: Object.values(x.projects).sort((a, b) => b.last - a.last) };
    }),
    activity: { startDay, days: activity.map(a => [a.total, a.by]) },
    recent: recent.slice(0, 14),
    skills, library, memory, next,
    routines: cfg.routines, apps: cfg.apps,
    runner: { claude: !!findClaude() },
    runs: runs.slice(-12).reverse(),
    snapshot,
  };
}

// ---------- skill runs (headless claude -p when available) ----------
function runSkill(ROOT, { skill, args, model, effort }) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const prompt = ('/' + skill + ' ' + (args || '')).trim();
  const bin = findClaude();
  const cliArgs = ['-p', prompt];
  if (model) cliArgs.push('--model', model);
  const command = 'cd "' + ROOT + '" && claude ' + cliArgs.map(a => /\s|"/.test(a) ? JSON.stringify(a) : a).join(' ');
  if (!bin) return { mode: 'copy', command, prompt };
  const runs = loadJSON(RUNS_FILE, []);
  const id = Date.now().toString(36);
  const logFile = path.join(DATA_DIR, 'run-' + id + '.log');
  const rec = { id, skill, prompt, model: model || 'default', started: Date.now(), status: 'running', log: path.relative(ROOT, logFile) };
  runs.push(rec);
  fs.writeFileSync(RUNS_FILE, JSON.stringify(runs.slice(-200), null, 2));
  const out = fs.openSync(logFile, 'a');
  const child = spawn(bin, cliArgs, { cwd: ROOT, stdio: ['ignore', out, out] });
  child.on('exit', code => {
    const all = loadJSON(RUNS_FILE, []);
    const r = all.find(x => x.id === id);
    if (r) { r.status = code === 0 ? 'done' : 'failed'; r.code = code; r.ended = Date.now(); }
    fs.writeFileSync(RUNS_FILE, JSON.stringify(all.slice(-200), null, 2));
  });
  return { mode: 'run', run: rec };
}

module.exports = { buildOS, runSkill, findClaude, SNAPSHOT_FILE };
