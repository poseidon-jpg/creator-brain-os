// Checks for RUBRIC Recos. Node built-ins only. Prints one line per check and exits 1 if anything fails.
//
//   node check.mjs          checks data/recos.js, then starts its own copy of the server on a spare port with a
//                           throwaway data folder and tests every route. Your real recos and choices are never touched.
//   node check.mjs --data   checks data/recos.js only. The /recos skill runs this after it writes the file.
//   node check.mjs --data path/to/recos.js   checks another recos file.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
let failed = 0;
const ok = (cond, label) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + label); if (!cond) failed++; };
const warn = label => console.log('WARN  ' + label);

// ---------- 1. the recos file ----------
function checkRecos(file) {
  let R;
  try {
    const sandbox = { window: {} };
    vm.runInNewContext(fs.readFileSync(file, 'utf8'), sandbox, { timeout: 1000 });
    R = sandbox.window.RECOS;
  } catch (e) { ok(false, `${file} runs as JavaScript (${e.message})`); return; }
  ok(R && typeof R === 'object', 'recos.js sets window.RECOS');
  if (!R) return;
  ok(Array.isArray(R.items), 'window.RECOS.items is a list');
  ok(R.letters && ['A', 'R', 'M', 'S'].every(k => R.letters[k] && R.letters[k].name), 'letters has A, R, M and S, each with a name');
  const items = Array.isArray(R.items) ? R.items : [];
  const LV = ['low', 'mid', 'high'], ids = new Set(), bad = [];
  const say = (it, why) => bad.push(`${it && it.id ? it.id : '(no id)'}: ${why}`);
  const text = v => typeof v === 'string' && v.trim().length > 0;
  for (const it of items) {
    if (!it || typeof it !== 'object') { bad.push('an item is not an object'); continue; }
    if (typeof it.id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,59}$/i.test(it.id)) say(it, 'id must be letters, numbers and dashes, 60 at most');
    else if (ids.has(it.id)) say(it, 'id is used twice'); else ids.add(it.id);
    if (!['A', 'R', 'M', 'S'].includes(it.letter)) say(it, 'letter must be A, R, M or S');
    if (!LV.includes(it.pri)) say(it, 'pri must be low, mid or high');
    if (!LV.includes(it.effort)) say(it, 'effort must be low, mid or high');
    if (it.pri === 'high' && typeof it.rank !== 'number') say(it, 'a high-priority reco needs a rank number');
    if (it.saves !== undefined && !LV.includes(it.saves)) say(it, 'saves must be low, mid or high, or left out');
    if (it.saves && !text(it.savesNote)) say(it, 'saves needs a one-line savesNote');
    if (it.touches !== undefined && (!Array.isArray(it.touches) || it.touches.length > 3 || !it.touches.every(text))) say(it, 'touches must be a list of 3 names at most');
    for (const f of ['title', 'benefit', 'action']) if (!text(it[f])) say(it, f + ' is missing');
    if (it.svg !== undefined && typeof it.svg !== 'string') say(it, 'svg must be a string');
    if (/\u2014/.test(JSON.stringify(it))) say(it, 'has an em dash; use " - " or a comma');
  }
  ok(bad.length === 0, `${items.length} recos match the shape` + (bad.length ? ':\n        ' + bad.join('\n        ') : ''));
  if (items.length && !items.some(it => it.pri === 'high')) warn('no reco is high priority, so the Priority group will be empty');
}

const dataOnly = process.argv[2] === '--data';
const recosFile = path.resolve(dataOnly && process.argv[3] ? process.argv[3] : path.join(HERE, 'data', 'recos.js'));
console.log('Checking ' + recosFile);
checkRecos(recosFile);
if (dataOnly) process.exit(failed ? 1 : 0);

// ---------- 2. the server, on a spare port with a throwaway data folder ----------
const PORT = 50093, BASE = `http://127.0.0.1:${PORT}`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rubric-recos-check-'));
fs.writeFileSync(path.join(TMP, 'recos.js'), 'window.RECOS = { built: "check", letters: { A: { name: "Apps" }, R: { name: "Routines" }, M: { name: "Memory" }, S: { name: "Skills" } }, items: [' +
  '{ id: "a-check", letter: "A", pri: "high", rank: 1, effort: "low", title: "Check reco", benefit: "b", action: "a" }] };\n');
const srv = spawn(process.execPath, [path.join(HERE, 'server.mjs'), String(PORT)], { env: { ...process.env, RECOS_DATA: TMP, RUBRIC_TOKEN: '' }, stdio: 'ignore' });
const req = (p, opt = {}) => fetch(BASE + p, opt);
const json = (method, p, data, type = 'application/json') => req(p, { method, headers: { 'Content-Type': type }, body: typeof data === 'string' ? data : JSON.stringify(data) });
try {
  for (let n = 0; n < 40; n++) { try { if ((await req('/__health')).ok) break; } catch (e) {} await new Promise(r => setTimeout(r, 150)); }
  const page = await (await req('/')).text();
  ok(/RUBRIC/.test(page) && /window\.RECOS_CONFIG = /.test(page), 'the page serves with its settings');
  ok(/a-check/.test(await (await req('/recos.js')).text()), 'recos.js serves from the data folder');
  ok((await req('/features/agent-cart.js')).ok && (await req('/assets/fonts/outfit-latin.woff2')).ok, 'features and fonts serve from this folder');
  ok((await req('/features/..%2fserver.mjs')).status === 404 && (await req('/assets/..%2f..%2fserver.mjs')).status === 404, 'a path outside the folder is refused');
  let r = await json('POST', '/api/skip', { id: 'a-check' });
  ok(r.ok && (await r.json()).skipped['a-check'], 'Skip saves');
  const saved = JSON.parse(fs.readFileSync(path.join(TMP, 'state.json'), 'utf8'));
  ok(saved.skipped['a-check'], 'the skip is in state.json');
  r = await json('POST', '/api/skip', { id: 'a-check', undo: true });
  ok(r.ok && !(await r.json()).skipped['a-check'], 'Undo brings it back');
  r = await json('POST', '/api/done', { id: 'a-check', on: true });
  ok(r.ok && (await r.json()).done['a-check'], 'Done saves');
  r = await json('PUT', '/api/comments', { comments: [{ id: 'c1', text: 'hi' }] });
  ok(r.ok && (await r.json()).comments.length === 1, 'comments save');
  ok((await json('POST', '/api/skip', { id: '../evil' })).status === 400, 'a bad id is refused');
  ok((await json('POST', '/api/skip', JSON.stringify({ id: 'a-check' }), 'text/plain')).status === 415, 'a write that is not JSON is refused (blocks other websites)');
  ok((await json('PUT', '/api/comments', JSON.stringify({ comments: ['x'.repeat(1_100_000)] }))).status === 413, 'a body over 1 MB is refused');
  ok(!(await req('/api/state')).headers.get('access-control-allow-origin'), 'no CORS header');
  const hostStatus = await new Promise(res => http.get({ host: '127.0.0.1', port: PORT, path: '/', headers: { Host: 'evil.example' } }, r2 => { r2.resume(); res(r2.statusCode); }).on('error', () => res(0)));
  ok(hostStatus === 403, 'a request for another host name is refused');
} catch (e) { ok(false, 'the server answered (' + e.message + ')'); }
finally { srv.kill(); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} }
console.log(failed ? `\n${failed} check(s) failed.` : '\nAll checks passed.');
process.exit(failed ? 1 : 0);
