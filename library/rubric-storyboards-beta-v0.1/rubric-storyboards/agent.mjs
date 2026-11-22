#!/usr/bin/env node
/**
 * RUBRIC Storyboards (beta) · your agent, run headless.
 *
 * AGENT_CMD in env.local is the one command that runs your agent once, with no one at the keyboard. The app sends the
 * prompt on standard input and runs the command in a fresh, empty work folder. Two steps use it:
 *   wireframe  your agent prints the storyboard as JSON (it needs no tools and should change no files)
 *   final      your agent writes index.html (and anything beside it) into its work folder, without asking first
 *
 * Placeholders the app fills in for each run:
 *   {model}       the model picked in the app, from WIREFRAME_MODELS or FINAL_MODELS
 *   {effort}      the effort picked in the app: low, medium, high, xhigh or max
 *   {step}        wireframe or final
 *   {mcp_config}  the path of an MCP config file holding the optional image tool (IMAGE_TOOL=on and a budget picked)
 * A placeholder that is empty for a run is left out, with the flag right before it: "--model {model}" disappears
 * when there is no model to pass, so your agent uses its own default.
 *
 *   node agent.mjs check     prints the exact command each step would run, and runs nothing
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CONFIG, HAS_ENV_FILE } from './config.mjs';

export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
const PLACEHOLDER = /\{(model|effort|step|mcp_config)\}/g;

/** Splits a command line into words. Single or double quotes group words; backslashes stay as typed (Windows paths). */
export function splitCommand(s) {
  const out = [];
  let cur = '', quote = null, started = false;
  for (const c of String(s)) {
    if (quote) { if (c === quote) quote = null; else cur += c; continue; }
    if (c === '"' || c === "'") { quote = c; started = true; continue; }
    if (/\s/.test(c)) { if (cur || started) out.push(cur); cur = ''; started = false; continue; }
    cur += c;
  }
  if (quote) throw new Error('AGENT_CMD has a quote that is never closed');
  if (cur || started) out.push(cur);
  return out;
}

/** Quotes one word for the shell the command runs in (cmd.exe on Windows, sh elsewhere). */
function quoteArg(a) {
  if (process.platform === 'win32') {
    if (a === '') return '""';
    if (!/[\s"&|<>^()%!,;=]/.test(a)) return a;
    return '"' + a.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"';
  }
  if (a === '') return "''";
  if (/^[\w@%+=:,./-]+$/.test(a)) return a;
  return "'" + a.replace(/'/g, `'\\''`) + "'";
}

/** The words of AGENT_CMD with the placeholders filled in (empty ones dropped with the flag before them). */
export function buildArgv(cmd, vals) {
  const words = splitCommand(cmd);
  if (!words.length) throw new Error('AGENT_CMD is empty');
  const argv = [];
  for (const w of words) {
    const names = [...w.matchAll(PLACEHOLDER)].map(m => m[1]);
    if (names.length && names.some(n => !vals[n])) {
      // "--model {model}" with no model: drop both words. "--model={model}" is one word and goes on its own.
      if (!w.startsWith('-') && argv.length > 1 && /^-{1,2}[^=\s]+$/.test(argv[argv.length - 1])) argv.pop();
      continue;
    }
    argv.push(w.replace(PLACEHOLDER, (_, n) => String(vals[n])));
  }
  return argv;
}

/** What the app can do with the AGENT_CMD it has. */
export function agentStatus() {
  const cmd = CONFIG.agentCmd;
  let error = null;
  try { if (cmd) splitCommand(cmd); } catch (e) { error = e.message; }
  return {
    configured: !!cmd && !error, error, dryRun: CONFIG.dryRun,
    usesModel: /\{model\}/.test(cmd), usesEffort: /\{effort\}/.test(cmd), usesMcp: /\{mcp_config\}/.test(cmd),
  };
}

/** The image tool can run only when it is switched on, has a key, and AGENT_CMD passes {mcp_config} to your agent. */
export function imageToolStatus() {
  const s = agentStatus();
  const why = !CONFIG.imageTool ? 'off (IMAGE_TOOL in env.local)' : !CONFIG.falKey ? 'needs FAL_KEY in env.local'
    : !s.usesMcp ? 'needs {mcp_config} in AGENT_CMD' : null;
  return { available: !why, why };
}

/** The app's environment without its own secrets: FAL_KEY is read from env.local by the image tool alone. */
export function safeEnv() {
  const env = { ...process.env };
  delete env.FAL_KEY;
  delete env.RUBRIC_TOKEN;
  return env;
}

/** The environment your agent runs with: safeEnv(), minus anything named in AGENT_ENV_UNSET ("NAME" or "PREFIX*"). */
function agentEnv(extra) {
  const env = safeEnv();
  for (const pat of CONFIG.envUnset) {
    const prefix = pat.endsWith('*') ? pat.slice(0, -1) : null;
    for (const k of Object.keys(env)) if (prefix !== null ? k.startsWith(prefix) : k === pat) delete env[k];
  }
  return { ...env, ...extra };
}

/** Everything needed to start one run: the words, the command line as the shell gets it, and the environment. */
export function prepareRun(vals) {
  const s = agentStatus();
  if (!CONFIG.agentCmd) throw new Error('connect your agent first: set AGENT_CMD in env.local (see the README), then restart the app');
  if (s.error) throw new Error(s.error);
  const argv = buildArgv(CONFIG.agentCmd, vals);
  return { argv, line: argv.map(quoteArg).join(' '), env: agentEnv() };
}

/** Starts your agent through the shell (so .cmd and .bat launchers work on Windows too). */
export function spawnAgent(run, cwd) {
  return spawn(run.line, { cwd, env: run.env, shell: true, windowsHide: true, detached: process.platform !== 'win32' });
}

/** Stops a run and everything it started. */
export function stopTree(child) {
  try {
    if (process.platform === 'win32' && child.pid) spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else if (child.pid) process.kill(-child.pid, 'SIGTERM');
  } catch { try { child.kill(); } catch { /* already gone */ } }
}

/* ---------------------------------------------------------------- reading what your agent printed */

const tryParse = s => { try { return JSON.parse(s); } catch { return undefined; } };
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** The JSON values in the output: the whole output as one value, or one per line (an event stream). */
function jsonValues(out) {
  const whole = tryParse(String(out).trim());
  if (whole !== undefined) return [whole];
  return String(out).split(/\r?\n/).map(l => tryParse(l.trim())).filter(isObj);
}

/** Cost, turns and errors, when your agent ends with a JSON result (an object with a cost, an error flag or type "result"). */
export function resultMeta(out) {
  const r = jsonValues(out).reverse().find(v => isObj(v) && ('total_cost_usd' in v || 'is_error' in v || v.type === 'result'));
  const tail = String(out).trim().slice(-4000);
  if (!r) return { cost: null, turns: null, isError: false, text: tail };
  return {
    cost: typeof r.total_cost_usd === 'number' ? r.total_cost_usd : typeof r.cost_usd === 'number' ? r.cost_usd : null,
    turns: typeof r.num_turns === 'number' ? r.num_turns : null,
    isError: r.is_error === true,
    text: typeof r.result === 'string' ? r.result : tail,
  };
}

function storyboardIn(v, depth = 0) {
  if (!isObj(v) || depth > 3) return null;
  if (Array.isArray(v.scenes)) return v;
  if (isObj(v.structured_output) && Array.isArray(v.structured_output.scenes)) return v.structured_output;
  for (const k of ['result', 'output', 'text', 'content', 'response', 'message']) {
    if (typeof v[k] === 'string') { const sb = storyboardInText(v[k], depth + 1); if (sb) return sb; }
    else if (isObj(v[k])) { const sb = storyboardIn(v[k], depth + 1); if (sb) return sb; }
  }
  return null;
}

function storyboardInText(s, depth = 0) {
  s = String(s);
  for (const m of s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) { const sb = storyboardIn(tryParse(m[1].trim()), depth + 1); if (sb) return sb; }
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) return storyboardIn(tryParse(s.slice(a, b + 1)), depth + 1);
  return null;
}

/** The storyboard your agent returned: a JSON object with "scenes", as plain text, in a code fence, or inside a JSON envelope. */
export function extractStoryboard(out) {
  for (const v of jsonValues(out).reverse()) { const sb = storyboardIn(v); if (sb) return sb; }
  return storyboardInText(out);
}

/** Progress from one line of output: a tool call when your agent prints JSON events, otherwise the line itself. */
export function readProgressLine(line, progress) {
  const t = String(line).trim();
  if (!t) return;
  const j = tryParse(t);
  if (isObj(j)) {
    const blocks = Array.isArray(j.message?.content) ? j.message.content : [];
    for (const b of blocks) {
      if (!isObj(b) || b.type !== 'tool_use') continue;
      progress.tools++;
      const i = isObj(b.input) ? b.input : {};
      const target = i.file_path || i.path || i.pattern || i.url || i.query || '';
      progress.last = `${String(b.name || 'tool').split('__').pop()} ${path.basename(String(target))}`.trim().slice(0, 140);
    }
    return;
  }
  progress.last = t.slice(0, 140);
}

/* ---------------------------------------------------------------- node agent.mjs check */

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  const [cmd] = process.argv.slice(2);
  if (cmd !== 'check') {
    console.log('usage: node agent.mjs check     (prints the command each step would run; runs nothing)');
    process.exit(cmd ? 1 : 0);
  }
  const s = agentStatus();
  console.log(`\n  env.local: ${HAS_ENV_FILE ? 'found' : 'not found (copy env.example to env.local)'}`);
  if (!CONFIG.agentCmd) {
    console.log('  AGENT_CMD: not set. Boards, comments and shot times work; the wireframe and final steps stay off.\n');
    process.exit(0);
  }
  if (s.error) { console.log(`  AGENT_CMD: ${s.error}\n`); process.exit(1); }
  const pick = step => CONFIG.models[step][0]?.[0] || '';
  const sample = (step, effort) => ({ step, model: pick(step), effort: s.usesEffort ? effort : '', mcp_config: '' });
  console.log(`  AGENT_CMD: ${CONFIG.agentCmd}`);
  console.log(`  models: wireframe ${CONFIG.models.wireframe.map(m => m[0]).join(', ') || "(your agent's default)"}; final ${CONFIG.models.final.map(m => m[0]).join(', ') || "(your agent's default)"}`);
  console.log(`  dry run: ${CONFIG.dryRun ? 'on (AGENT_DRY_RUN): the app writes the command and prompt to the project logs and runs nothing' : 'off'}`);
  console.log(`  timeout: ${CONFIG.timeoutMs / 60000} minutes; AGENT_ENV_UNSET: ${CONFIG.envUnset.join(', ') || '(none)'}`);
  const img = imageToolStatus();
  console.log(`  image tool: ${img.available ? 'available' : img.why}`);
  for (const [step, effort] of [['wireframe', 'low'], ['final', 'high']]) {
    const run = prepareRun(sample(step, effort));
    console.log(`\n  ${step} step runs (prompt on standard input, in a fresh folder under ${CONFIG.workDir}):\n    ${run.line}`);
  }
  if (img.available) {
    const run = prepareRun({ ...sample('final', 'high'), mcp_config: `${CONFIG.workDir}/<run>.mcp.json` });
    console.log(`\n  final step with an image budget:\n    ${run.line}`);
  }
  console.log('\n  Nothing was run.\n');
  if (!fs.existsSync(CONFIG.projectsDir)) console.log(`  (the projects folder ${CONFIG.projectsDir} is made on first start)\n`);
}
