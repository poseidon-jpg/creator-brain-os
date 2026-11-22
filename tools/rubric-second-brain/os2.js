/* os2.js - the v2 panels' data: artifacts inbox, edit timeline, /note backlog, scheduled tasks,
   connector use and rule-based suggestions. Everything is read from files on this computer.
   Nothing here calls a model or the network. Ideas adapted from Jay E's RUBRIC Agentic OS v2 (MIT). */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const DAY = 864e5;
const ART_EXT = new Set(['.html', '.htm', '.pdf', '.pptx', '.key', '.docx', '.xlsx', '.csv']);
const SKIP = /(^|\/)(node_modules|\.git|\.venv|venv|__pycache__|\.cache|data|baked)(\/|$)|^tools\/(skills-library|rubric-second-brain)|^creative\/video\/rubric-elements-library\/(assets|examples|library)|\/examples\/|\.backup-/;

function deptOfFactory(scanResult) {
  const rules = (scanResult.cfg.dep.pathRules || []).slice().sort((a, b) => b.prefix.length - a.prefix.length);
  const dflt = scanResult.cfg.dep.default;
  return rel => { for (const r of rules) if (rel.startsWith(r.prefix)) return r.dept; return dflt; };
}

/* artifacts: documents you can open (reports, decks, pages) made or touched in the last 90 days */
function artifacts(scanResult) {
  const deptOf = deptOfFactory(scanResult), now = Date.now();
  const out = [];
  for (const f of scanResult.model.files) {
    if (!ART_EXT.has(f.ext) || SKIP.test(f.rel) || now - f.mtime > 90 * DAY || f.size < 600) continue;
    out.push({ path: f.rel, name: f.name, ext: f.ext.slice(1), size: f.size, mtime: f.mtime, dept: deptOf(f.rel) });
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return { total: out.length, items: out.slice(0, 120) };
}

/* timeline: what changed, newest first, grouped by kind */
function timeline(scanResult, WS) {
  const deptOf = deptOfFactory(scanResult), now = Date.now();
  const skillDirs = (WS.skillDirs || []).map(d => d.replace(/\/+$/, '') + '/');
  const rows = [];
  for (const f of scanResult.model.files) {
    if (now - f.mtime > 14 * DAY || SKIP.test(f.rel) || f.name === '.DS_Store') continue;
    const isSkill = skillDirs.some(d => f.rel.startsWith(d));
    const kind = isSkill ? 'skill' : f.rel.startsWith('memory/') ? 'memory' : f.rel.startsWith('feedback/') ? 'feedback' : ART_EXT.has(f.ext) ? 'artifact' : 'file';
    let label = f.name;
    if (isSkill) { const parts = f.rel.split('/'); label = parts[parts.findIndex(x => x === 'global-skills' || x === 'skills') + 1] || f.name; }
    rows.push({ t: f.mtime, kind, label, path: f.rel, dept: deptOf(f.rel) });
  }
  rows.sort((a, b) => b.t - a.t);
  // collapse bursts: the same kind+label within 10 minutes becomes one row with a count
  const merged = [];
  for (const r of rows) {
    const prev = merged[merged.length - 1];
    if (prev && prev.kind === r.kind && prev.label === r.label && prev.t - r.t < 10 * 60e3) { prev.n++; continue; }
    merged.push({ ...r, n: 1 });
  }
  return merged.slice(0, 80);
}

/* /note backlog: feedback/<name>.md, one file per skill or product; lines start with "- " */
function backlog(ROOT) {
  const dir = path.join(ROOT, 'feedback');
  const files = [];
  let list = []; try { list = fs.readdirSync(dir); } catch { }
  for (const name of list) {
    if (!name.endsWith('.md')) continue;
    let txt = ''; try { txt = fs.readFileSync(path.join(dir, name), 'utf8'); } catch { continue; }
    const m = /^##\s*Inbox\s*$/im.exec(txt);
    const body = m ? txt.slice(m.index + m[0].length).split(/^##\s/m)[0] : txt;
    const items = body.split('\n').filter(l => /^\s*-\s+\S/.test(l)).map(l => l.replace(/^\s*-\s+/, '').slice(0, 220));
    files.push({ file: 'feedback/' + name, name: name.replace(/\.md$/, ''), pending: items.length, items: items.slice(0, 5), mtime: fs.statSync(path.join(dir, name)).mtimeMs });
  }
  files.sort((a, b) => b.pending - a.pending);
  return { total: files.reduce((s, f) => s + f.pending, 0), files };
}

/* scheduled tasks from the Claude desktop app + ~/.claude/scheduled-tasks. Empty array when there are none. */
function scheduledTasks() {
  const HOME = os.homedir(), found = new Map();
  const bases = [path.join(HOME, 'Library', 'Application Support', 'Claude'), path.join(HOME, '.config', 'Claude')];
  const visit = (dir, depth) => {
    let list; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const p = path.join(dir, e.name);
      if (e.isFile() && e.name === 'scheduled-tasks.json') {
        try { const d = JSON.parse(fs.readFileSync(p, 'utf8')); for (const t of d.scheduledTasks || []) if (t && t.id) found.set(t.id, t); } catch { }
      } else if (e.isDirectory() && depth < 4 && /claude-code-sessions|local-agent-mode-sessions|^[0-9a-f-]{20,}$/.test(e.name)) visit(p, depth + 1);
    }
  };
  for (const b of bases) { visit(path.join(b, 'claude-code-sessions'), 0); visit(path.join(b, 'local-agent-mode-sessions'), 0); }
  const tasksDir = path.join(HOME, '.claude', 'scheduled-tasks');
  let folders = []; try { folders = fs.readdirSync(tasksDir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name); } catch { }
  const ids = new Set([...folders, ...found.keys()]);
  return [...ids].sort().map(id => {
    const t = found.get(id) || {};
    const cron = typeof t.cronExpression === 'string' && t.cronExpression.trim().split(/\s+/).length === 5 ? t.cronExpression.trim() : null;
    return { id, name: String(t.displayName || id).replace(/[-_]+/g, ' '), cron, once: Number.isFinite(+t.fireAt) && +t.fireAt > 0 ? +t.fireAt : null, enabled: t.enabled !== false, status: !found.has(id) ? 'on demand' : t.enabled === false ? 'paused' : (cron || t.fireAt) ? 'active' : 'on demand' };
  });
}

/* suggestions: rules over real numbers. Each one names its evidence and says what it would cost or save. */
function suggestions(usage, tasks, backlogInfo) {
  const out = [];
  if (usage) {
    const d7 = usage.windows.d7, models = usage.models;
    const total = Object.values(models).reduce((s, m) => s + m.usd, 0) || 1;
    const top = Object.entries(models).sort((a, b) => b[1].usd - a[1].usd)[0];
    if (top && top[1].usd / total > 0.45) out.push({ kind: 'cost', title: `${top[0]} is ${Math.round(top[1].usd / total * 100)}% of spend`, text: `Over the last 30 days ${top[0]} cost $${top[1].usd.toFixed(2)} of $${total.toFixed(2)} (API-equivalent). Skills with a fixed procedure rarely need it.`, evidence: usage.files + ' session logs' });
    const cold = (usage.sessions || []).filter(s => !s.warm && s.ctx > 150000).slice(0, 1)[0];
    if (cold) out.push({ kind: 'cache', title: 'A big chat went cold', text: `Session ${cold.id} holds ~${Math.round(cold.ctx / 1000)}k tokens of context. Replying now re-reads all of it at full price. Compact or start fresh instead.`, evidence: 'prompt-cache window ~1 hour' });
    const big = (usage.skills || []).filter(s => s.runs >= 1 && s.usd / s.runs > 4).slice(0, 1)[0];
    if (big) out.push({ kind: 'skill', title: `/${big.name} averages $${(big.usd / big.runs).toFixed(2)} a run`, text: `${big.runs} runs, ${big.sub} subagents. Worth reading the skill for steps that could run on a cheaper model or be skipped.`, evidence: 'session logs, API-equivalent' });
  }
  if (!tasks.length) out.push({ kind: 'routine', title: 'No scheduled routines yet', text: 'Start with one passive routine: a weekly check that only pings you when something needs you (a weekly trend watch on your product categories). Passive routines add no daily review load.', evidence: '0 scheduled tasks found' });
  if (backlogInfo && backlogInfo.total) out.push({ kind: 'backlog', title: `${backlogInfo.total} parked notes waiting`, text: 'Apply them in one batch when your usage is about to reset.', evidence: 'feedback/' });
  return out;
}

module.exports = { artifacts, timeline, backlog, scheduledTasks, suggestions };
