// SQLite store for the YouTube outlier scanner. One file (DB_PATH in paths.mjs), grows every scan.
// Caching every channel's uploads locally is what makes repeat scans nearly free on quota.

// node:sqlite is stable enough on Node 24 but still emits an ExperimentalWarning. Mute just that one.
const origEmit = process.emit;
process.emit = function (name, data, ...rest) {
  if (name === 'warning' && data && data.name === 'ExperimentalWarning' && /SQLite/i.test(data.message || '')) return false;
  return origEmit.call(process, name, data, ...rest);
};

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { DB_PATH } from './paths.mjs';

// Loaded lazily, not as a static import: ESM hoists static imports above the mute above,
// so node:sqlite would print its ExperimentalWarning before the mute is installed.
const require = createRequire(import.meta.url);

export { DB_PATH };

function loadSqlite() {
  try { return require('node:sqlite'); } catch {
    throw new Error(`This needs Node.js 22.13 or newer for its built-in SQLite (you have ${process.version}). Update from nodejs.org, then run it again.`);
  }
}

export function openDb(file = DB_PATH) {
  const { DatabaseSync } = loadSqlite();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    -- Another scan or reader may hold the file for a moment; wait up to 30 seconds instead of failing.
    PRAGMA busy_timeout = 30000;

    CREATE TABLE IF NOT EXISTS videos (
      video_id      TEXT PRIMARY KEY,
      title         TEXT,
      channel_id    TEXT,
      channel_title TEXT,
      published_at  TEXT,
      duration_s    INTEGER,
      is_short      INTEGER,
      views         INTEGER,
      likes         INTEGER,
      comments      INTEGER,
      baseline      INTEGER,
      multiplier    REAL,
      vph           REAL,
      subs          INTEGER,
      sub_mult      REAL,
      confidence    TEXT,
      keyword       TEXT,
      thumb         TEXT,
      first_seen    TEXT,
      last_seen     TEXT,
      times_reported INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS channels (
      channel_id       TEXT PRIMARY KEY,
      title            TEXT,
      subs             INTEGER,
      video_count      INTEGER,
      uploads_playlist TEXT,
      checked_at       TEXT
    );

    -- Cached upload stats per channel. Baselines are computed from here, no API call needed.
    CREATE TABLE IF NOT EXISTS channel_uploads (
      video_id     TEXT PRIMARY KEY,
      channel_id   TEXT,
      published_at TEXT,
      views        INTEGER,
      duration_s   INTEGER,
      title        TEXT,
      fetched_at   TEXT
    );

    -- Every time we re-see a video we log its views, so growth over weeks is visible.
    CREATE TABLE IF NOT EXISTS history (
      video_id   TEXT,
      seen_at    TEXT,
      views      INTEGER,
      multiplier REAL
    );

    CREATE TABLE IF NOT EXISTS scans (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      ran_at     TEXT,
      keywords   TEXT,
      days       INTEGER,
      quota_used INTEGER,
      candidates INTEGER,
      kept       INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_up_channel ON channel_uploads(channel_id);
    CREATE INDEX IF NOT EXISTS idx_vid_mult   ON videos(multiplier DESC);
    CREATE INDEX IF NOT EXISTS idx_vid_pub    ON videos(published_at DESC);
  `);
  // Migrations for databases created by an earlier version.
  const cols = db.prepare('PRAGMA table_info(videos)').all().map(c => c.name);
  if (!cols.includes('lang')) db.exec('ALTER TABLE videos ADD COLUMN lang TEXT');
  if (!cols.includes('podcast')) db.exec('ALTER TABLE videos ADD COLUMN podcast INTEGER DEFAULT 0');
  const upCols = db.prepare('PRAGMA table_info(channel_uploads)').all().map(c => c.name);
  if (!upCols.includes('is_short')) db.exec('ALTER TABLE channel_uploads ADD COLUMN is_short INTEGER');
  const chCols = db.prepare('PRAGMA table_info(channels)').all().map(c => c.name);
  if (!chCols.includes('handle')) db.exec('ALTER TABLE channels ADD COLUMN handle TEXT');
  const scCols = db.prepare('PRAGMA table_info(scans)').all().map(c => c.name);
  if (!scCols.includes('searches')) db.exec('ALTER TABLE scans ADD COLUMN searches INTEGER');
  return db;
}

// A peer channel named by its @handle, so a repeat scan skips the lookup call.
export function getChannelByHandle(db, handle) {
  return db.prepare('SELECT * FROM channels WHERE LOWER(handle) = ?').get(String(handle).toLowerCase());
}

export function setChannelHandle(db, channelId, handle) {
  db.prepare('UPDATE channels SET handle = ? WHERE channel_id = ?').run(handle, channelId);
}

// Short or long for an upload already in the cache (null when never decided), so it is checked once only.
export function knownShort(db, videoId) {
  const r = db.prepare('SELECT is_short FROM channel_uploads WHERE video_id = ?').get(videoId);
  return r ? r.is_short : null;
}

export function setUploadShort(db, videoId, isShort) {
  db.prepare('UPDATE channel_uploads SET is_short = ? WHERE video_id = ?').run(isShort, videoId);
}

// Podcasts are dropped before scoring, so a row saved before that rule is flagged here instead.
export function flagPodcast(db, id) {
  db.prepare('UPDATE videos SET podcast = 1 WHERE video_id = ?').run(id);
}

const nowIso = () => new Date().toISOString();

export function upsertVideo(db, v) {
  const existing = db.prepare('SELECT video_id, first_seen FROM videos WHERE video_id = ?').get(v.video_id);
  db.prepare(`
    INSERT INTO videos (video_id,title,channel_id,channel_title,published_at,duration_s,is_short,
                        views,likes,comments,baseline,multiplier,vph,subs,sub_mult,confidence,
                        keyword,thumb,lang,first_seen,last_seen)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(video_id) DO UPDATE SET
      is_short=excluded.is_short, views=excluded.views, likes=excluded.likes, comments=excluded.comments,
      baseline=excluded.baseline, multiplier=excluded.multiplier, vph=excluded.vph,
      subs=excluded.subs, sub_mult=excluded.sub_mult, confidence=excluded.confidence,
      last_seen=excluded.last_seen
  `).run(
    v.video_id, v.title, v.channel_id, v.channel_title, v.published_at, v.duration_s, v.is_short ? 1 : 0,
    v.views, v.likes, v.comments, v.baseline, v.multiplier, v.vph, v.subs, v.sub_mult, v.confidence,
    v.keyword, v.thumb, v.lang || '', existing?.first_seen ?? nowIso(), nowIso(),
  );
  db.prepare('INSERT INTO history (video_id, seen_at, views, multiplier) VALUES (?,?,?,?)')
    .run(v.video_id, nowIso(), v.views, v.multiplier);
  return !existing; // true when this is the first time we have ever seen it
}

export function getChannel(db, id) {
  return db.prepare('SELECT * FROM channels WHERE channel_id = ?').get(id);
}

export function saveChannel(db, c) {
  db.prepare(`
    INSERT INTO channels (channel_id,title,subs,video_count,uploads_playlist,checked_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(channel_id) DO UPDATE SET
      title=excluded.title, subs=excluded.subs, video_count=excluded.video_count,
      uploads_playlist=excluded.uploads_playlist, checked_at=excluded.checked_at
  `).run(c.channel_id, c.title, c.subs, c.video_count, c.uploads_playlist, nowIso());
}

export function saveUploads(db, channelId, uploads) {
  const stmt = db.prepare(`
    INSERT INTO channel_uploads (video_id,channel_id,published_at,views,duration_s,title,is_short,fetched_at)
    VALUES (?,?,?,?,?,?,?,?)
    ON CONFLICT(video_id) DO UPDATE SET views=excluded.views, fetched_at=excluded.fetched_at,
      is_short=COALESCE(excluded.is_short, is_short)
  `);
  for (const u of uploads) {
    stmt.run(u.video_id, channelId, u.published_at, u.views, u.duration_s, u.title, u.is_short ?? null, nowIso());
  }
}

export function getUploads(db, channelId) {
  return db.prepare('SELECT * FROM channel_uploads WHERE channel_id = ? ORDER BY published_at DESC').all(channelId);
}

export function logScan(db, s) {
  db.prepare('INSERT INTO scans (ran_at,keywords,days,quota_used,candidates,kept,searches) VALUES (?,?,?,?,?,?,?)')
    .run(nowIso(), s.keywords, s.days, s.quota_used, s.candidates, s.kept, s.searches ?? null);
}

export function markReported(db, ids) {
  const stmt = db.prepare('UPDATE videos SET times_reported = times_reported + 1 WHERE video_id = ?');
  for (const id of ids) stmt.run(id);
}

// Pull the leaderboard straight from the database, no API calls.
// format: 'all' (default), 'long' or 'short'. Peer channels (keyword 'peer @handle') skip the
// subscriber caps, because the user picked them on purpose.
export function topOutliers(db, opts = {}) {
  const {
    days = 30, top = 10, minMult = 2, minViews = 1000,
    minBaseline = 500, maxSubs = 3_000_000, minSubs = 0,
    minBaselineRatio = 0.005, minConfidence = 'ok',
    newOnly = false, format = 'all', excludeChannels = [],
  } = opts;
  const shortClause = format === 'short' ? 'AND is_short = 1' : format === 'long' ? 'AND is_short = 0' : '';
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const allowed = { low: ['low', 'ok', 'high'], ok: ['ok', 'high'], high: ['high'] }[minConfidence] || ['ok', 'high'];
  const banned = excludeChannels.map(s => String(s).trim().toLowerCase());
  const banClause = banned.length ? `AND LOWER(TRIM(channel_title)) NOT IN (${banned.map(() => '?').join(',')})` : '';
  return db.prepare(`
    SELECT * FROM videos
    WHERE published_at >= ?
      AND multiplier >= ?  AND views >= ?
      AND baseline >= ?
      AND (keyword LIKE 'peer %' OR (subs <= ? AND subs >= ?))
      AND (subs = 0 OR CAST(baseline AS REAL) / subs >= ?)
      AND confidence IN (${allowed.map(() => '?').join(',')})
      ${banClause}
      AND COALESCE(podcast, 0) = 0
      ${shortClause}
      AND (? = 0 OR times_reported = 0)
    ORDER BY multiplier DESC
    LIMIT ?
  `).all(since, minMult, minViews, minBaseline, maxSubs, minSubs, minBaselineRatio,
         ...allowed, ...banned, newOnly ? 1 : 0, top);
}

export function dbStats(db) {
  const one = (q) => db.prepare(q).get();
  return {
    videos: one('SELECT COUNT(*) n FROM videos').n,
    channels: one('SELECT COUNT(*) n FROM channels').n,
    uploads: one('SELECT COUNT(*) n FROM channel_uploads').n,
    scans: one('SELECT COUNT(*) n FROM scans').n,
    history: one('SELECT COUNT(*) n FROM history').n,
  };
}
