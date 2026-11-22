/* usage.js - measures what your agents did and cost, from Claude Code's own session logs.
   Reads ~/.claude/projects/**.jsonl on this computer only. Calls no model, sends nothing anywhere,
   and stores only counts and names (never prompt text) in data/usage-cache.json.

   Approach adapted from Jay E's RUBRIC Agentic OS v2 (MIT): a skill run starts where the log writes
   "Base directory for this skill" (or a /command) and lasts until the next skill or prompt; a routine
   run is a session that starts with a <scheduled-task> prompt; every model call counts once by id.
   This is our own implementation with extras: per-model split, rolling 5h / 7d windows, per-session
   context size + prompt-cache state, hour-by-day heat, and an mtime/size cache so a refresh only
   re-reads files that changed. Dollar figures are API-equivalent estimates, not a subscription bill. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const HOME = os.homedir();
const PROJECTS = path.join(HOME, '.claude', 'projects');
const CACHE = path.join(__dirname, 'data', 'usage-cache.json');
const VERSION = 4;
const CACHE_TTL_MS = 60 * 60 * 1000; // prompt cache stays warm about an hour after the last call

// USD per million tokens, standard API rates (first match wins; unknown model = no $ figure).
const RATES = [
  [/opus-5-5/, { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 }],
  [/sonnet-5-5/, { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 }],
  [/haiku-5-5/, { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 }],
  [/opus-5/, { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 }],
  [/haiku-4-5/, { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 }],
  [/opus/, { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 }],
  [/sonnet/, { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }],
  [/haiku/, { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 }],
];
function costOf(model, u) {
  const hit = RATES.find(([re]) => re.test(String(model)));
  if (!hit) return 0;
  const r = hit[1];
  return ((u.input_tokens || 0) * r.input + (u.output_tokens || 0) * r.output +
    (u.cache_read_input_tokens || 0) * r.cacheRead + (u.cache_creation_input_tokens || 0) * r.cacheWrite) / 1e6;
}
const shortModel = m => String(m || '').replace(/^claude-/, '').replace(/-\d{8}$/, '') || 'unknown';

const tsOf = line => { const m = /"timestamp":"([^"]+)"/.exec(line); return m ? Date.parse(m[1]) : NaN; };
const SKILL_LOAD = /^Base directory for this skill: (.+)/;

/* Summarise one log file into compact arrays. msgs rows: [id, t, tokens, usd, runIndex, model, ctx, tools[]] */
function summarize(file, kind) {
  const text = fs.readFileSync(file, 'utf8');
  const s = { v: VERSION, kind, first: 0, last: 0, task: null, runs: [], msgs: [] };
  const byId = new Map();
  let run = -1, started = false, i = 0;
  const boundary = ms => { if (run >= 0) s.runs[run].end = ms; run = -1; };
  const startRun = (name, ms, cmd) => { if (run >= 0) s.runs[run].end = ms; s.runs.push({ s: name, t: ms, end: ms, cmd: cmd ? 1 : 0 }); run = s.runs.length - 1; };
  while (i < text.length) {
    let j = text.indexOf('\n', i); if (j < 0) j = text.length;
    const line = text.slice(i, j); i = j + 1;
    if (line.length < 20) continue;
    const isA = line.includes('"type":"assistant"'), isU = !isA && line.includes('"type":"user"');
    if (!isA && !isU) continue;
    const ms = tsOf(line); if (!(ms > 0)) continue;
    if (!s.first || ms < s.first) s.first = ms;
    if (ms > s.last) s.last = ms;
    if (isU) {
      const interesting = line.includes('Base directory for this skill') || line.includes('<command-name>') || line.includes('<scheduled-task');
      if (!interesting) {
        if (!line.includes('"isMeta":true') && !line.includes('"tool_result"')) { started = true; if (kind === 'main') boundary(ms); }
        continue;
      }
      let u; try { u = JSON.parse(line); } catch { continue; }
      const c = u.message && u.message.content;
      const texts = typeof c === 'string' ? [c] : Array.isArray(c) ? c.filter(x => x && x.type === 'text').map(x => x.text) : [];
      if (Array.isArray(c) && c.some(x => x && x.type === 'tool_result')) continue;
      for (const t of texts) {
        const load = SKILL_LOAD.exec(t);
        if (load) { startRun(path.basename(load[1].trim().replace(/[\\/]+$/, '')), ms, false); continue; }
        const task = /<scheduled-task name="([^"]+)"/.exec(t);
        if (task && !started && kind === 'main') s.task = task[1];
        const cmd = /<command-name>\/?([^<\s]+)<\/command-name>/.exec(t);
        if (!u.isMeta && kind === 'main') boundary(ms);
        if (cmd) startRun(cmd[1], ms, true);
      }
      started = true;
      continue;
    }
    let a; try { a = JSON.parse(line); } catch { continue; }
    const m = a.message || {}; if (!m.id) continue;
    let e = byId.get(m.id);
    if (!e) {
      const u = m.usage, ok = u && m.model && m.model !== '<synthetic>';
      const ctx = ok ? (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0) : 0;
      const tok = ok ? ctx + (u.output_tokens || 0) : 0;
      e = [m.id, ms, tok, ok ? costOf(m.model, u) : 0, run, ok ? shortModel(m.model) : '', ctx, [], ok ? (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.output_tokens || 0) : 0];   // [8] = tokens that were not cache re-reads
      byId.set(m.id, e); s.msgs.push(e);
      if (run >= 0) s.runs[run].end = ms;
    }
    for (const b of Array.isArray(m.content) ? m.content : []) {
      if (!b || b.type !== 'tool_use') continue;
      const name = b.name || '';
      if (name.startsWith('mcp__')) { const parts = name.split('__'); e[7].push('m:' + parts[1]); }
      else if ((name === 'Bash' || name === 'PowerShell') && b.input && b.input.command) {
        // keep only command names, never the full command (it can contain values you typed)
        const cmd = String(b.input.command);
        // drop heredoc bodies and quoted text first, then ignore shell and JS keywords: only real command names count
        const bare = cmd.replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?\n\s*\1\b/g, ' ').replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, '""');
        for (const mm of bare.matchAll(/(?:^|[;&|(\n]|&&|\|\|)\s*(?:sudo\s+|npx\s+)?([A-Za-z][A-Za-z0-9._-]{0,30})(?=\s|$)/g)) { const w = mm[1].toLowerCase(); if (!NOT_CMD.has(w)) e[7].push('w:' + w); }
      } else if (name) e[7].push('t:' + name);
    }
  }
  if (run >= 0 && kind === 'main') s.runs[run].end = Math.max(s.runs[run].end, s.last);
  for (const e of s.msgs) if (!e[7].length) e.length = 7;
  return s;
}

function listLogs() {
  let projects; try { projects = fs.readdirSync(PROJECTS); } catch { return null; }
  const files = [];
  for (const proj of projects) {
    const dir = path.join(PROJECTS, proj); let list;
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of list) {
      if (e.isFile() && e.name.endsWith('.jsonl')) files.push({ file: path.join(dir, e.name), kind: 'main', session: e.name.slice(0, -6), proj });
      if (e.isDirectory()) {
        const sub = path.join(dir, e.name, 'subagents');
        try { for (const f of fs.readdirSync(sub)) if (f.endsWith('.jsonl')) files.push({ file: path.join(sub, f), kind: 'sub', session: e.name, proj }); } catch { }
      }
    }
  }
  return files;
}

const dayKey = ms => { const d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function compute(days = 30, opts = {}) {
  const t0 = Date.now();
  const files = listLogs();
  if (!files) return null;
  const now = Date.now(), cutoff = now - days * 864e5;
  let cache = { v: VERSION, files: {} };
  try { const c = JSON.parse(fs.readFileSync(CACHE, 'utf8')); if (c.v === VERSION) cache = c; } catch { }
  const next = { v: VERSION, files: {} }, summaries = [];
  let parsed = 0;
  for (const f of files) {
    let st; try { st = fs.statSync(f.file); } catch { continue; }
    if (st.mtimeMs < cutoff) continue;
    const hit = cache.files[f.file];
    let s;
    if (hit && hit.size === st.size && hit.mtime === st.mtimeMs) s = hit.s;
    else { try { s = summarize(f.file, f.kind); parsed++; } catch { continue; } }
    next.files[f.file] = { size: st.size, mtime: st.mtimeMs, s };
    summaries.push({ ...f, s });
  }
  try { fs.mkdirSync(path.dirname(CACHE), { recursive: true }); fs.writeFileSync(CACHE, JSON.stringify(next)); } catch { }

  summaries.sort((a, b) => (a.s.first || 0) - (b.s.first || 0));
  const seen = new Set();
  const dayTotals = {}, hourHeat = {}, models = {}, tools = {}, mcp = {}, cmds = {};
  const win = { h5: { tok: 0, usd: 0, calls: 0, fresh: 0 }, d7: { tok: 0, usd: 0, calls: 0, fresh: 0 }, d30: { tok: 0, usd: 0, calls: 0, fresh: 0 } };
  const runs = new Map(), sessions = [], mainBySession = new Map();
  for (const x of summaries) if (x.kind === 'main') mainBySession.set(x.proj + '/' + x.session, x);

  for (const x of summaries) {
    const local = x.s.runs.map(r => {
      const key = r.s + '|' + r.t;
      if (!runs.has(key)) runs.set(key, { ...r, tok: 0, usd: 0, sub: 0, kind: x.kind, proj: x.proj, session: x.session, models: {} });
      else { const m = runs.get(key); if (r.end > m.end) m.end = r.end; if (r.cmd) m.cmd = 1; } // /command line + skill-load line = one run
      return runs.get(key);
    });
    x.tok = 0; x.usd = 0; x.headTok = 0; x.headUsd = 0; x.calls = 0;
    let lastMsg = null;
    for (const e of x.s.msgs) {
      const [id, ms, tok, usd, ri, model, ctx, tl, fresh] = e;
      if (seen.has(id)) continue; seen.add(id);
      if (ms < cutoff) continue;
      const d = dayKey(ms);
      const dt = dayTotals[d] || (dayTotals[d] = { tok: 0, usd: 0, calls: 0 }); dt.tok += tok; dt.usd += usd; dt.calls++;
      const hk = d + 'T' + new Date(ms).getHours();
      hourHeat[hk] = (hourHeat[hk] || 0) + tok;
      const md = models[model || 'unknown'] || (models[model || 'unknown'] = { tok: 0, usd: 0, calls: 0 }); md.tok += tok; md.usd += usd; md.calls++;
      for (const w of [['d30', 0], ['d7', 7 * 864e5], ['h5', 5 * 36e5]]) {
        if (!w[1] || ms >= now - w[1]) { win[w[0]].tok += tok; win[w[0]].fresh += fresh || 0; win[w[0]].usd += usd; win[w[0]].calls++; }
      }
      x.tok += tok; x.usd += usd; x.calls++;
      if (ri >= 0 && local[ri]) { local[ri].tok += tok; local[ri].usd += usd; const mm = local[ri].models; mm[model] = (mm[model] || 0) + 1; }
      else { x.headTok += tok; x.headUsd += usd; }
      for (const k of tl || []) {
        const kind = k[0], name = k.slice(2);
        const bucket = kind === 'm' ? mcp : kind === 'w' ? cmds : tools;
        const b = bucket[name] || (bucket[name] = { n: 0, last: 0, days: {} }); b.n++; if (ms > b.last) b.last = ms; b.days[d] = (b.days[d] || 0) + 1;
      }
      if (!lastMsg || ms > lastMsg.t) lastMsg = { t: ms, ctx, model, usd };
    }
    if (x.kind === 'main' && lastMsg) {
      sessions.push({ id: x.session.slice(0, 8), proj: x.proj.replace(/^-Users-[^-]+-?/, '').replace(/-/g, '/') || 'home', last: lastMsg.t, first: x.s.first, ctx: lastMsg.ctx, model: lastMsg.model, tok: x.tok, usd: x.usd, calls: x.calls, task: x.s.task || null });
    }
  }
  let out_dbg = null;
  // subagent cost joins the run that spawned it
  const runList = [...runs.values()];
  for (const x of summaries.filter(x => x.kind === 'sub')) {
    const parent = mainBySession.get(x.proj + '/' + x.session); if (!parent) continue;
    const at = x.s.first;
    const owner = runList.filter(r => r.kind === 'main' && r.proj === x.proj && r.session === x.session && r.t <= at + 1000 && at <= r.end + 5000).sort((a, b) => a.t - b.t).pop();
    if (opts.debug) (out_dbg = out_dbg || []).push({ session: x.session.slice(0, 8), first: at, headTok: x.headTok, tok: x.tok, owner: owner ? owner.s + '@' + owner.t : null, mains: runList.filter(r => r.kind === 'main' && r.session === x.session).map(r => r.s + '@' + r.t + '-' + r.end) });
    if (owner) { owner.tok += x.headTok; owner.usd += x.headUsd; owner.sub++; }
    if (parent.s.task) { parent.subTok = (parent.subTok || 0) + x.tok; parent.subUsd = (parent.subUsd || 0) + x.usd; }
  }

  // roll runs up per skill
  const skills = {};
  for (const r of runList.filter(r => r.t >= cutoff)) {
    const k = r.s;
    const s = skills[k] || (skills[k] = { name: k, runs: 0, cmdRuns: 0, tok: 0, usd: 0, sub: 0, last: 0, d7: 0, models: {} });
    s.runs++; if (r.cmd) s.cmdRuns++; s.tok += r.tok; s.usd += r.usd; s.sub += r.sub; if (r.t > s.last) s.last = r.t;
    if (r.t >= now - 7 * 864e5) s.d7++;
    for (const [m, n] of Object.entries(r.models)) s.models[m] = (s.models[m] || 0) + n;
  }
  const routines = {};
  for (const x of summaries.filter(x => x.kind === 'main' && x.s.task && x.s.first >= cutoff)) {
    const k = x.s.task;
    const r = routines[k] || (routines[k] = { name: k, runs: 0, tok: 0, usd: 0, last: 0 });
    r.runs++; r.tok += x.tok + (x.subTok || 0); r.usd += x.usd + (x.subUsd || 0); if (x.s.first > r.last) r.last = x.s.first;
  }
  sessions.sort((a, b) => b.last - a.last);
  const out = {
    _dbg: opts.debug ? out_dbg : undefined,
    _runs: opts.debug ? runList.filter(r => r.t >= cutoff).map(r => ({ name: r.s, t: r.t, tok: r.tok, usd: r.usd, sub: r.sub, kind: r.kind })) : undefined,
    generatedAt: now, days, files: summaries.length, filesParsed: parsed, ms: Date.now() - t0,
    windows: win, dayTotals, hourHeat, models,
    skills: Object.values(skills).sort((a, b) => b.usd - a.usd),
    routines: Object.values(routines),
    sessions: sessions.slice(0, 12).map(s => ({ ...s, warm: now - s.last < CACHE_TTL_MS, coldInMs: Math.max(0, CACHE_TTL_MS - (now - s.last)) })),
    mcp: Object.fromEntries(Object.entries(mcp).map(([k, v]) => [k, { n: v.n, last: v.last, days: v.days }])),
    tools: Object.entries(tools).sort((a, b) => b[1].n - a[1].n).slice(0, 14).map(([k, v]) => ({ name: k, n: v.n })),
    cmds: Object.entries(cmds).sort((a, b) => b[1].n - a[1].n).slice(0, 14).map(([k, v]) => ({ name: k, n: v.n })),
    note: 'API-equivalent estimate at standard rates. Not your subscription bill.',
  };
  return out;
}

const NOT_CMD = new Set(['for', 'if', 'then', 'else', 'elif', 'fi', 'do', 'done', 'while', 'until', 'case', 'esac', 'in', 'function', 'select', 'const', 'let', 'var', 'return', 'import', 'from', 'export', 'try', 'catch', 'new', 'await', 'async', 'print', 'def', 'class']);
module.exports = { compute, costOf, RATES, summarize };

if (require.main === module) {
  const r = compute(Number(process.argv[2]) || 30);
  if (!r) { console.log('no session logs found'); process.exit(0); }
  console.log(JSON.stringify({ files: r.files, parsed: r.filesParsed, ms: r.ms, windows: r.windows, models: r.models, skills: r.skills.slice(0, 8), routines: r.routines, sessions: r.sessions.slice(0, 3) }, null, 1));
}
