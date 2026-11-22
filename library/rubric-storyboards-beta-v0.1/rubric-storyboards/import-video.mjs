#!/usr/bin/env node
/**
 * RUBRIC Storyboards (beta) · import a finished video as a board of stills.
 *
 * Makes (or refreshes) a project in projects/<id>/ from an MP4 and a shot list: copies the video in as video.mp4,
 * pulls one still per shot into board/ with ffmpeg, and writes project.json with kind "video", the video's facts and
 * the board. Comments already made on the board are kept, because each panel keeps its id (the shot's "id", or its
 * title as a slug) when a time or a still changes. Needs ffmpeg and ffprobe.
 *
 *   node import-video.mjs <spec.json>
 *
 * spec.json: { "id": "my-video", "title": "My video", "request": "what it is for", "video": "C:/path/to/video.mp4",
 *              "width": 1280, "shots": [ { "t": 0.6, "title": "Logo lands", "caption": "one line" }, ... ] }
 * The spec is saved beside the project as import.json, so a re-run after changing a time is:
 *   node import-video.mjs projects/<id>/import.json
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CONFIG } from './config.mjs';

const DATA = CONFIG.projectsDir;
const specFile = process.argv[2];
if (!specFile) { console.error('usage: node import-video.mjs <spec.json>'); process.exit(1); }
const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
for (const k of ['id', 'title', 'video', 'shots']) if (!spec[k]) { console.error(`spec is missing "${k}"`); process.exit(1); }
if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(spec.id) || spec.id.includes('..')) {
  console.error('the id becomes a folder name: use letters, digits, dot, dash or underscore'); process.exit(1);
}
for (const tool of ['ffmpeg', 'ffprobe']) {
  try { execFileSync(tool, ['-version'], { stdio: 'ignore' }); } catch { console.error(`${tool} was not found. Install ffmpeg (https://ffmpeg.org/download.html) first.`); process.exit(1); }
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'shot';
const noDash = s => String(s ?? '').replace(/\s*[\u2014]\s*/g, ' - ').replace(/\u2013/g, '-');
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
function writeJSON(f, v) { const tmp = `${f}.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(v, null, 1)); fs.renameSync(tmp, f); }

const dir = `${DATA}/${spec.id}`;
fs.mkdirSync(`${dir}/board`, { recursive: true });

// 1. the video, copied in once (again only when the source changed)
const src = path.resolve(path.dirname(specFile), spec.video).replace(/\\/g, '/');
const dst = `${dir}/video.mp4`;
const srcStat = fs.statSync(src);
if (path.resolve(src) !== path.resolve(dst) && (!fs.existsSync(dst) || fs.statSync(dst).size !== srcStat.size)) {
  fs.copyFileSync(src, dst);
  console.log(`copied the video (${(srcStat.size / 1e6).toFixed(1)} MB)`);
}

// 2. its facts
const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height,r_frame_rate:format=duration', '-of', 'json', dst]).toString());
const vs = probe.streams.find(s => s.codec_type === 'video');
const [fn, fd] = String(vs.r_frame_rate || '60/1').split('/').map(Number);
const duration = +Number(probe.format.duration).toFixed(3);
const width = vs.width, height = vs.height, fps = +(fn / (fd || 1)).toFixed(3);
const audio = probe.streams.some(s => s.codec_type === 'audio');
const r = width / height;
const aspect = Math.abs(r - 16 / 9) < 0.02 ? '16:9' : Math.abs(r - 9 / 16) < 0.02 ? '9:16' : Math.abs(r - 1) < 0.02 ? '1:1' : '16:9';

// 3. one still per shot
const shots = [...spec.shots].sort((a, b) => a.t - b.t);
const ids = new Set();
const board = shots.map((s, i) => {
  let id = s.id || slug(s.title);
  while (ids.has(id)) id += '-x';
  ids.add(id);
  const t = +Math.min(Math.max(0, Number(s.t) || 0), duration - 1 / fps).toFixed(3);
  const file = `board/${String(i + 1).padStart(2, '0')}-${slug(s.title)}.jpg`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(t), '-i', dst, '-frames:v', '1',
    '-vf', `scale=${Number(spec.width) || 1280}:-2:flags=lanczos`, '-q:v', '2', `${dir}/${file}`]);
  return { id, file, t, title: noDash(s.title), caption: noDash(s.caption) };
});
const keep = new Set(board.map(b => path.basename(b.file)));
for (const f of fs.readdirSync(`${dir}/board`)) if (!keep.has(f)) fs.unlinkSync(`${dir}/board/${f}`);
console.log(`pulled ${board.length} stills`);

// 4. the project, keeping what the app added (created date, a rename, comments)
const now = new Date().toISOString();
const old = readJSON(`${dir}/project.json`, null);
const p = {
  id: spec.id, kind: 'video',
  title: old?.renamed && old.title ? old.title : noDash(spec.title),
  request: noDash(spec.request || ''),
  duration, aspect,
  created: old?.created || now, updated: now,
  video: { file: 'video.mp4', source: path.basename(src), duration, width, height, fps, audio, bytes: fs.statSync(dst).size },
  board,
  wireframes: old?.wireframes || [], finals: old?.finals || [], job: null, lastJob: old?.lastJob || null,
  renamed: old?.renamed ?? true,
};
writeJSON(`${dir}/project.json`, p);
if (!fs.existsSync(`${dir}/comments.json`)) writeJSON(`${dir}/comments.json`, []);
if (path.resolve(specFile) !== path.resolve(`${dir}/import.json`)) writeJSON(`${dir}/import.json`, { ...spec, video: src });
console.log(`project ${spec.id}: ${duration}s ${width}x${height} ${fps} fps${audio ? ' with sound' : ''}, http://127.0.0.1:${CONFIG.port}/#${spec.id}`);
