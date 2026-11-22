#!/usr/bin/env node
// add-inspo.mjs - save YouTube videos to your Inspos wall, and search the wall later.
//
// Usage:
//   node add-inspo.mjs "<youtube link or id>" ["<another link>" ...]   add or refresh videos
//   node add-inspo.mjs "<youtube link>" --note "why you saved it"      add one video with a note
//   node add-inspo.mjs --remove "<youtube link or id>"                 take one video off the wall
//   node add-inspo.mjs --list [words]                                  print the wall, one short entry per video
//                                                                       (words: videos matching any of them, best first)
//
// The snapshot (views, how long ago it was published) is frozen at the moment you save it.
// Saving the same video again refreshes the snapshot, keeps its note, and moves it to the top.
//
// How it reads a video: yt-dlp first if it is installed (it keeps working when YouTube changes
// its page), otherwise YouTube's public watch page directly. So Node.js 18+ is the only must-have.
//
// Settings (all optional, set as environment variables):
//   INSPOS_FILE      where the wall's data lives      default: <your home folder>/inspos/inspos.json
//   YTDLP_PATH       full path to yt-dlp              default: yt-dlp on your PATH, then "python -m yt_dlp"
//   INSPO_THUMBS_DIR also keep a full-size copy of each thumbnail in this folder (off unless set)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const INSPOS_FILE = path.resolve(process.env.INSPOS_FILE || path.join(os.homedir(), 'inspos', 'inspos.json'));
const THUMBS_DIR = process.env.INSPO_THUMBS_DIR ? path.resolve(process.env.INSPO_THUMBS_DIR) : '';
const DESCRIPTION_CHARS = 600; // enough of the description to search by topic, small enough to keep the file light
const MAX_TAGS = 20;

function extractId(input) {
  const s = String(input || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:v=|\/shorts\/|youtu\.be\/|\/embed\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function shortNumber(n) {
  n = Number(n);
  if (!isFinite(n) || n < 0) return '';
  const trim = x => x.replace(/\.0$/, '');
  if (n < 1000) return String(n);
  if (n < 1e6) { const k = n / 1000; return (k < 10 ? trim(k.toFixed(1)) : String(Math.round(k))) + 'K'; }
  if (n < 1e9) return trim((n / 1e6).toFixed(1)) + 'M';
  return trim((n / 1e9).toFixed(1)) + 'B';
}

function agoText(yyyymmdd) {
  if (!/^\d{8}$/.test(yyyymmdd || '')) return '';
  const up = new Date(+yyyymmdd.slice(0, 4), +yyyymmdd.slice(4, 6) - 1, +yyyymmdd.slice(6, 8));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - up) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return '1d ago';
  if (days < 7) return days + 'd ago';
  if (days < 14) return '1w ago';
  if (days < 30) return Math.floor(days / 7) + 'w ago';
  if (days < 60) return '1mo ago';
  if (days < 365) return Math.floor(days / 30) + 'mo ago';
  return Math.floor(days / 365) + 'y ago';
}

function durText(sec) {
  sec = Math.round(Number(sec) || 0);
  if (!sec) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = x => String(x).padStart(2, '0');
  return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
}

function cleanText(s, max) {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, '') + '...' : t;
}

// ---------- reading a video: yt-dlp ----------
// Returns null when yt-dlp is not installed, so the caller can fall back to the watch page.
// A real yt-dlp error (private video, no internet) stops with that error.
function readWithYtDlp(id) {
  const args = [
    '--skip-download', '--no-warnings', '--no-playlist',
    '--print', '%(.{title,view_count,upload_date,channel,duration,channel_follower_count,tags,description})j',
    'https://www.youtube.com/watch?v=' + id
  ];
  const tries = [];
  if (process.env.YTDLP_PATH) tries.push([process.env.YTDLP_PATH, args]);
  tries.push(['yt-dlp', args]);
  for (const py of ['python3', 'python', 'py']) tries.push([py, ['-m', 'yt_dlp', ...args]]);
  for (const [cmd, a] of tries) {
    let out;
    try {
      out = execFileSync(cmd, a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000, windowsHide: true });
    } catch (e) {
      // ENOENT = no such program. 9009 / "Python was not found" = the Windows Store python placeholder.
      const notFound = e.code === 'ENOENT' || e.status === 9009 ||
        /No module named yt_dlp|Python was not found/i.test(String(e.stderr || ''));
      if (notFound) continue;
      const msg = String(e.stderr || e.message || e).trim().split(/\r?\n/).pop();
      throw new Error('yt-dlp could not read this video: ' + msg);
    }
    const j = JSON.parse(out.trim().split(/\r?\n/).pop());
    return {
      title: j.title, channel: j.channel, views: j.view_count, upload: j.upload_date,
      duration: j.duration, subscribers: j.channel_follower_count, tags: j.tags, description: j.description,
      via: 'yt-dlp'
    };
  }
  return null;
}

// ---------- reading a video: YouTube's public watch page (no install needed) ----------
// Cut the JSON object that follows a marker like "ytInitialData = " out of the page.
function jsonAfter(html, marker) {
  for (let at = html.indexOf(marker); at !== -1; at = html.indexOf(marker, at + 1)) {
    const start = at + marker.length;
    if (html[start] !== '{') continue;
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < html.length; i++) {
      const c = html[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try { return JSON.parse(html.slice(start, i + 1)); } catch (_) { break; }
      }
    }
  }
  return null;
}

// First value stored under `key` anywhere inside obj. YouTube moves these objects around,
// so searching by name survives page changes better than a fixed path.
function find(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 40) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  for (const v of Object.values(obj)) {
    const r = find(v, key, depth + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

const text = t => !t ? '' : t.simpleText || t.content || (Array.isArray(t.runs) ? t.runs.map(r => r.text).join('') : '');

// "12.3K subscribers" -> 12300, "1,234 views" -> 1234 (YouTube rounds subscribers, so close, not exact)
function parseCount(s) {
  const m = String(s || '').replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
  if (!m) return 0;
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(m[2] || '').toUpperCase()] || 1;
  return Math.round(parseFloat(m[1]) * mult);
}

// "Apr 23, 2005" or "Premiered Oct 1, 2026" -> "20050423", '' when it is relative ("3 hours ago")
function parseDateText(s) {
  const t = Date.parse(String(s || '').replace(/^(Premiered|Streamed live on|Streamed live|Published on)\s*/i, ''));
  if (isNaN(t)) return '';
  const d = new Date(t);
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

async function fetchWatchPage(id) {
  let res;
  try {
    res = await fetch('https://www.youtube.com/watch?v=' + id + '&hl=en&gl=US', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'SOCS=CAI; CONSENT=YES+1' // skips the cookie-consent page some countries get
      },
      signal: AbortSignal.timeout(30000)
    });
  } catch (e) {
    throw new Error('Could not reach YouTube: ' + ((e && e.message) || e) + '. Check your internet connection.');
  }
  if (!res.ok) throw new Error('YouTube answered ' + res.status + ' for this video.');
  return res.text();
}

async function readWatchPage(id) {
  const html = await fetchWatchPage(id);
  // Two blocks of data sit in the page. The player block has the exact numbers, but YouTube
  // sometimes holds it back behind a "confirm you're not a bot" check. The page block is
  // almost always there, so it fills whatever the player block left out.
  const player = jsonAfter(html, 'ytInitialPlayerResponse = ') || {};
  const page = jsonAfter(html, 'ytInitialData = ') || {};
  const d = player.videoDetails && player.videoDetails.videoId === id ? player.videoDetails : {};
  const micro = find(player, 'playerMicroformatRenderer') || {};
  const primary = find(page, 'videoPrimaryInfoRenderer') || {};
  const owner = find(page, 'videoOwnerRenderer') || {};
  const secondary = find(page, 'videoSecondaryInfoRenderer') || {};

  const title = d.title || text(primary.title);
  if (!title) {
    const why = player.playabilityStatus && player.playabilityStatus.reason;
    throw new Error('Could not read this video from its YouTube page' + (why ? ' (' + why + ')' : '') +
      '. It may be private or removed. Installing yt-dlp ("pip install yt-dlp") gives a more reliable read.');
  }
  const vc = primary.viewCount || {};
  const viewText = text(vc.videoViewCountRenderer ? vc.videoViewCountRenderer.viewCount : vc);
  return {
    title,
    channel: d.author || text(owner.title),
    views: d.viewCount || parseCount(viewText),
    upload: String(micro.publishDate || micro.uploadDate || '').slice(0, 10).replace(/-/g, '') || parseDateText(text(primary.dateText)),
    duration: d.lengthSeconds || 0,
    subscribers: parseCount(text(owner.subscriberCountText)),
    tags: d.keywords || [],
    description: d.shortDescription || text(secondary.attributedDescription) || text(secondary.description),
    via: 'the YouTube page'
  };
}

// ---------- the wall file ----------
function readStore() {
  if (!fs.existsSync(INSPOS_FILE)) return { inspos: [] };
  let store;
  try { store = JSON.parse(fs.readFileSync(INSPOS_FILE, 'utf8')); }
  catch (e) { throw new Error('Your wall file is not valid JSON: ' + INSPOS_FILE + ' (' + e.message + '). Fix or move it, then try again.'); }
  if (!Array.isArray(store.inspos)) store.inspos = [];
  return store;
}

// Write to a temp file first, then swap it in, so a page reading the file never sees half a file.
function writeStore(store) {
  fs.mkdirSync(path.dirname(INSPOS_FILE), { recursive: true });
  const tmp = INSPOS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, INSPOS_FILE);
}

async function saveThumb(id, video) {
  if (!THUMBS_DIR) return '';
  fs.mkdirSync(THUMBS_DIR, { recursive: true });
  const existing = fs.readdirSync(THUMBS_DIR).find(f => f.startsWith('youtube_' + id + '_') && /\.jpg$/i.test(f));
  if (existing) return path.join(THUMBS_DIR, existing);
  for (const quality of ['maxresdefault', 'sddefault', 'hqdefault']) {
    try {
      const r = await fetch('https://i.ytimg.com/vi/' + id + '/' + quality + '.jpg', { signal: AbortSignal.timeout(30000) });
      if (!r.ok) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 3000) continue; // YouTube sometimes answers with a tiny grey placeholder
      const dest = path.join(THUMBS_DIR, 'youtube_' + id + '_' + quality + '.jpg');
      fs.writeFileSync(dest, buf);
      fs.writeFileSync(dest.replace(/\.jpg$/i, '.json'), JSON.stringify({
        source: 'inspo', video_id: id, title: video.title, channel: video.channel,
        url: video.url, quality, captured: video.capturedAt
      }, null, 2));
      return dest;
    } catch (_) { /* try the next size */ }
  }
  return '';
}

// ---------- commands ----------
async function add(input, note) {
  const id = extractId(input);
  if (!id) throw new Error('Could not find a YouTube video id in: ' + input);

  const raw = readWithYtDlp(id) || await readWatchPage(id);
  const upload = /^\d{8}$/.test(String(raw.upload || '')) ? String(raw.upload) : '';
  const fresh = {
    id,
    url: 'https://www.youtube.com/watch?v=' + id,
    title: raw.title && raw.title !== 'NA' ? raw.title : id,
    channel: raw.channel && raw.channel !== 'NA' ? raw.channel : '',
    subscribers: Number(raw.subscribers) || 0,
    views: Number(raw.views) || 0,
    viewsText: shortNumber(Number(raw.views) || 0),
    published: upload ? upload.slice(0, 4) + '-' + upload.slice(4, 6) + '-' + upload.slice(6, 8) : '',
    ago: agoText(upload),
    duration: durText(raw.duration),
    tags: (Array.isArray(raw.tags) ? raw.tags : []).slice(0, MAX_TAGS),
    description: cleanText(raw.description, DESCRIPTION_CHARS),
    capturedAt: new Date().toISOString()
  };

  const store = readStore();
  const prev = store.inspos.find(v => v.id === id) || {};
  // Keep anything the user added to the old card (a note, their own fields), refresh the rest.
  const video = { ...prev, ...fresh };
  if (note) video.note = note;
  store.inspos = store.inspos.filter(v => v.id !== id); // one card per video
  store.inspos.unshift(video);                          // newest first
  writeStore(store);

  const thumb = await saveThumb(id, video);
  const subs = video.subscribers ? ' (' + shortNumber(video.subscribers) + ' subs)' : '';
  console.log('Added: ' + video.title);
  console.log('  ' + [video.viewsText + ' views', video.ago, video.duration, video.channel + subs].filter(s => s && s.trim()).join('  ·  '));
  console.log('  ' + video.url);
  if (video.note) console.log('  note: ' + video.note);
  console.log('  saved to: ' + INSPOS_FILE + '  (read with ' + raw.via + ')');
  if (thumb) console.log('  thumbnail copy: ' + thumb);
}

function remove(input) {
  const id = extractId(input);
  if (!id) throw new Error('Could not find a YouTube video id in: ' + input);
  const store = readStore();
  const before = store.inspos.length;
  store.inspos = store.inspos.filter(v => v.id !== id);
  if (store.inspos.length === before) { console.log('Not on the wall: ' + id); return; }
  writeStore(store);
  console.log('Removed: ' + id);
}

function localDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// One short entry per video, so an agent can read the whole wall at once.
// With words: videos matching any of them, the most matches first (newest first on a tie).
function list(words) {
  const store = readStore();
  if (!store.inspos.length) {
    console.log('The wall is empty (' + (fs.existsSync(INSPOS_FILE) ? 'no videos in ' : 'no file yet at ') + INSPOS_FILE + ').');
    console.log('Save a video first: node add-inspo.mjs "<youtube link>". If the wall lives somewhere else, set INSPOS_FILE to its path.');
    return;
  }
  const want = words.map(w => w.toLowerCase()).filter(Boolean);
  const rows = store.inspos
    .map((v, order) => {
      const hay = [v.title, v.channel, v.note, v.description, ...(v.tags || [])].join(' ').toLowerCase();
      return { v, order, hits: want.filter(w => hay.includes(w)).length };
    })
    .filter(r => !want.length || r.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.order - b.order)
    .map(r => r.v);
  console.log(rows.length + ' of ' + store.inspos.length + ' videos' + (want.length ? ' match any of "' + want.join(' ') + '"' : '') + '  (' + INSPOS_FILE + ')');
  rows.forEach((v, i) => {
    const subs = v.subscribers ? ' (' + shortNumber(v.subscribers) + ' subs)' : '';
    console.log('');
    console.log((i + 1) + '. ' + v.title);
    console.log('   ' + [(v.channel || '') + subs, (v.viewsText || shortNumber(v.views)) + ' views', v.ago, v.duration,
      'saved ' + localDate(v.capturedAt)].filter(s => s && s.trim()).join('  ·  '));
    if (v.note) console.log('   note: ' + v.note);
    if (v.tags && v.tags.length) console.log('   tags: ' + v.tags.slice(0, 8).join(', '));
    if (v.description) console.log('   about: ' + cleanText(v.description, 160));
    console.log('   ' + v.url);
  });
}

const args = process.argv.slice(2);
const usage = 'Usage:\n' +
  '  node add-inspo.mjs "<youtube link>" ["<another link>" ...]\n' +
  '  node add-inspo.mjs "<youtube link>" --note "why you saved it"\n' +
  '  node add-inspo.mjs --remove "<youtube link>"\n' +
  '  node add-inspo.mjs --list [words]';
try {
  if (!args.length) { console.error(usage); process.exit(1); }
  if (args[0] === '--remove') {
    if (!args[1]) throw new Error('Give the link to remove.\n' + usage);
    remove(args[1]);
  } else if (args[0] === '--list') {
    list(args.slice(1).join(' ').split(/\s+/));
  } else {
    const n = args.indexOf('--note');
    const note = n !== -1 ? cleanText(args[n + 1], 500) : '';
    if (n !== -1 && !note) throw new Error('--note needs some text after it.\n' + usage);
    const links = args.filter((a, i) => n === -1 || (i !== n && i !== n + 1));
    if (note && links.length > 1) throw new Error('--note works with one link at a time.');
    // Several links in one call is fine. One bad link does not stop the others.
    let failed = 0;
    for (const link of links) {
      if (links.length > 1) console.log('');
      try { await add(link, note); }
      catch (e) { failed++; console.error('Failed: ' + link + '\n  ' + String((e && e.message) || e)); }
    }
    if (failed) process.exit(1);
  }
} catch (e) {
  console.error(String((e && e.message) || e));
  process.exit(1);
}
