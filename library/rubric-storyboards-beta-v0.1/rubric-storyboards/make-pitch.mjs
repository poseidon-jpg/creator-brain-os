#!/usr/bin/env node
/**
 * RUBRIC Storyboards (beta) · make a pitch: a board of planned stills, one per shot, before anything is produced.
 *
 *   node make-pitch.mjs <spec.json> [--reset-times]
 *
 * Copies each shot's image into projects/<id>/board/ and writes projects/<id>/project.json (kind "board"). The stills
 * can come from anywhere: frames you rendered from an HTML mock-up, screenshots, sketches, generated images.
 *
 * spec.json (image paths are relative to the spec file):
 *   { "id": "my-pitch", "title": "Pitch - My video", "aspect": "16:9",
 *     "request": "the treatment: one 'Label: text' line each, shown as bullets in the Brief",
 *     "briefBullets": [ { "label": "Goal", "text": "one short sentence" } ],          (optional, shown instead of request)
 *     "shots": [ { "id": "open", "title": "Open", "image": "frames/01.jpg", "length": 4, "t": 2,
 *                  "caption": "what we see", "animate": "what moves and how",
 *                  "bullets": [ { "label": "See", "text": "one short sentence" } ] } ] }
 * Each shot takes "length" (seconds) or "end"; shots run back to back from 0. "t" is where the still sits inside its
 * shot (default: the middle). "id" keeps comments attached to a shot across re-runs (default: the title as a slug).
 * A re-run keeps comments.json, and keeps the shot times you dragged in the app when the shots are the same,
 * unless you add --reset-times.
 */
import fs from 'node:fs';
import path from 'node:path';
import { CONFIG } from './config.mjs';

const args = process.argv.slice(2);
const RESET = args.includes('--reset-times');
const specFile = args.find(a => !a.startsWith('--'));
if (!specFile) { console.error('usage: node make-pitch.mjs <spec.json> [--reset-times]'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
const specDir = path.dirname(path.resolve(specFile));
const fail = msg => { console.error(`make-pitch: ${msg}`); process.exit(1); };

if (!spec.id || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(spec.id) || spec.id.includes('..')) fail('"id" becomes a folder name: use letters, digits, dot, dash or underscore');
if (!spec.title) fail('the spec needs a "title"');
if (!Array.isArray(spec.shots) || !spec.shots.length) fail('the spec needs "shots", one per still');
const SIZES = { '16:9': true, '9:16': true, '1:1': true };
const aspect = SIZES[spec.aspect] ? spec.aspect : '16:9';

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'shot';
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
function writeJSON(f, v) { const tmp = `${f}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(v, null, 1)); fs.renameSync(tmp, f); }
const r3 = v => Math.round(v * 1000) / 1000;
const bullets = list => (Array.isArray(list) ? list : [])
  .map(b => (Array.isArray(b) ? { label: String(b[0] ?? ''), text: String(b[1] ?? '') } : { label: String(b?.label ?? ''), text: String(b?.text ?? '') }))
  .filter(b => b.label || b.text);

const dir = `${CONFIG.projectsDir}/${spec.id}`;
fs.mkdirSync(`${dir}/board`, { recursive: true });
const old = readJSON(`${dir}/project.json`, null);

// 1. the shots: ids, times back to back from 0, and each image copied into board/
const ids = new Set();
let at = 0;
const board = spec.shots.map((s, i) => {
  if (!s || !s.title) fail(`shot ${i + 1} needs a "title"`);
  if (!s.image) fail(`shot ${i + 1} ("${s.title}") needs an "image"`);
  let id = String(s.id || slug(s.title));
  while (ids.has(id)) id += '-x';
  ids.add(id);
  const src = path.resolve(specDir, s.image);
  if (!fs.existsSync(src)) fail(`shot ${i + 1}: image not found: ${src}`);
  const ext = path.extname(src).toLowerCase();
  if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) fail(`shot ${i + 1}: use a .jpg, .png or .webp image`);
  const file = `board/${String(i + 1).padStart(2, '0')}-${slug(s.title)}${ext === '.jpeg' ? '.jpg' : ext}`;
  fs.copyFileSync(src, `${dir}/${file}`);
  const start = at;
  const end = s.end != null ? Number(s.end) : start + (Number(s.length) || 3);
  if (!(end - start >= 0.5)) fail(`shot ${i + 1} ("${s.title}") has to be at least 0.5 s long`);
  at = end;
  const t = s.t != null ? Number(s.t) : start + (end - start) / 2;
  const b = { id, file, t: r3(Math.min(Math.max(t, start), Math.max(start, end - 0.1))), start: r3(start), end: r3(end), title: String(s.title) };
  if (s.caption) b.caption = String(s.caption);
  if (s.animate) b.animate = String(s.animate);
  const bl = bullets(s.bullets);
  if (bl.length) b.bullets = bl;
  return b;
});
if (at > 600) fail('a pitch can be at most 600 s long');
const keep = new Set(board.map(b => path.basename(b.file)));
for (const f of fs.readdirSync(`${dir}/board`)) if (!keep.has(f)) fs.unlinkSync(`${dir}/board/${f}`);

// 2. the times you dragged in the app win, as long as the shots are the same ones in the same order
const was = Array.isArray(old?.board) ? old.board : [];
const sameShots = was.length === board.length && was.every((b, i) => b.id === board[i].id && b.start != null && b.end != null);
const keptTimes = !RESET && sameShots;
if (keptTimes) board.forEach((b, i) => { b.start = was[i].start; b.end = was[i].end; b.t = was[i].t; });

// 3. the project
const now = new Date().toISOString();
const project = {
  id: spec.id, kind: 'board', title: String(spec.title), request: String(spec.request || ''),
  ...(bullets(spec.briefBullets).length ? { briefBullets: bullets(spec.briefBullets) } : {}),
  duration: keptTimes ? board[board.length - 1].end : r3(at), aspect, fps: Number(spec.fps) || 60,
  ...(spec.source ? { source: String(spec.source) } : {}), captionLines: Number(spec.captionLines) || 3,
  created: old?.created || now, updated: now, board, wireframes: [], finals: [], job: null, lastJob: null, renamed: true,
};
writeJSON(`${dir}/project.json`, project);
if (!fs.existsSync(`${dir}/comments.json`)) writeJSON(`${dir}/comments.json`, []);
console.log(`pitch ${spec.id}: ${board.length} shots, ${project.duration} s${keptTimes ? ' (your dragged times kept)' : ''}`);
console.log(`open http://127.0.0.1:${CONFIG.port}/#${spec.id}`);
