// Instagram, TikTok, X and LinkedIn tables for the outlier database, plus the scoring and the ranking query.
// They sit beside the YouTube tables in the same file and never touch them: every statement here
// is CREATE TABLE IF NOT EXISTS, so the YouTube scan keeps working exactly as before.
//
// An "outlier" here means the same thing as on YouTube:
//   multiplier = views / median views of that account's earlier posts
// LinkedIn shows no view counts, so there the `views` column holds engagement (reactions + comments + reposts)
// and the multiplier is engagement against the account's normal engagement.

export const PLATFORMS = ['instagram', 'tiktok', 'x', 'linkedin'];
export const METRIC = { instagram: 'views', tiktok: 'views', x: 'views', linkedin: 'engagement' };
// How an account is shown: @name, or a LinkedIn path such as in/name, which has no @ form.
export const accountLabel = (platform, handle) => (platform === 'linkedin' ? handle : `@${handle}`);

// Guards in that platform's own unit. A LinkedIn post with 100 reactions and comments did well, so the view-sized
// floors would hide every LinkedIn outlier. The follower ratio is off there too: engagement sits far below 0.5%
// of followers even on a creator's best post.
const GUARDS = {
  linkedin: { minViews: 100, minBaseline: 20, minBaselineRatio: 0 },
};

import { openDb, DB_PATH } from './db.mjs';

export function openSocialDb(file = DB_PATH) {
  const db = openDb(file);   // creates the YouTube tables if the file is new, never alters them
  db.exec(`
    CREATE TABLE IF NOT EXISTS social_accounts (
      platform     TEXT,
      handle       TEXT,
      display_name TEXT,
      followers    INTEGER,
      provider     TEXT,
      checked_at   TEXT,
      PRIMARY KEY (platform, handle)
    );

    -- Video posts and reels only. Photo posts have no views, so they are never stored.
    CREATE TABLE IF NOT EXISTS social_posts (
      platform   TEXT,
      post_id    TEXT,
      handle     TEXT,
      url        TEXT,
      caption    TEXT,
      posted_at  TEXT,
      duration_s INTEGER,
      views      INTEGER,
      likes      INTEGER,
      comments   INTEGER,
      thumb      TEXT,
      baseline   INTEGER,
      multiplier REAL,
      sample     INTEGER,
      confidence TEXT,
      provider   TEXT,
      first_seen TEXT,
      last_seen  TEXT,
      PRIMARY KEY (platform, post_id)
    );

    -- Every time a post is re-seen we log its views, so growth over weeks is visible.
    CREATE TABLE IF NOT EXISTS social_history (
      platform   TEXT,
      post_id    TEXT,
      seen_at    TEXT,
      views      INTEGER,
      multiplier REAL
    );

    -- One row per scan, with what it cost.
    CREATE TABLE IF NOT EXISTS social_scans (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      ran_at        TEXT,
      platform      TEXT,
      provider      TEXT,
      accounts      INTEGER,
      posts         INTEGER,
      requests      INTEGER,
      est_cost_usd  REAL,
      cost_usd      REAL,
      note          TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sp_handle ON social_posts(platform, handle);
    CREATE INDEX IF NOT EXISTS idx_sp_mult   ON social_posts(multiplier DESC);
    CREATE INDEX IF NOT EXISTS idx_sp_posted ON social_posts(posted_at DESC);
  `);
  return db;
}

const nowIso = () => new Date().toISOString();

export function getAccount(db, platform, handle) {
  return db.prepare('SELECT * FROM social_accounts WHERE platform = ? AND handle = ?').get(platform, handle);
}

export function saveAccount(db, a) {
  db.prepare(`
    INSERT INTO social_accounts (platform, handle, display_name, followers, provider, checked_at)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(platform, handle) DO UPDATE SET
      display_name = COALESCE(excluded.display_name, display_name),
      followers    = COALESCE(excluded.followers, followers),
      provider     = excluded.provider,
      checked_at   = excluded.checked_at
  `).run(a.platform, a.handle, a.display_name ?? null, a.followers ?? null, a.provider, nowIso());
}

export function savePosts(db, platform, handle, provider, posts) {
  const find = db.prepare('SELECT first_seen FROM social_posts WHERE platform = ? AND post_id = ?');
  const stmt = db.prepare(`
    INSERT INTO social_posts (platform, post_id, handle, url, caption, posted_at, duration_s, views, likes,
                              comments, thumb, provider, first_seen, last_seen)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(platform, post_id) DO UPDATE SET
      url = excluded.url, caption = COALESCE(NULLIF(excluded.caption, ''), caption),
      views = excluded.views, likes = excluded.likes, comments = excluded.comments,
      thumb = COALESCE(excluded.thumb, thumb), provider = excluded.provider, last_seen = excluded.last_seen
  `);
  let fresh = 0;
  for (const p of posts) {
    const had = find.get(platform, p.id);
    stmt.run(platform, p.id, handle, p.url, p.caption || '', p.posted_at, p.duration_s ?? null, p.views,
      p.likes ?? null, p.comments ?? null, p.thumb ?? null, provider, had?.first_seen ?? nowIso(), nowIso());
    if (!had) fresh++;
  }
  return fresh;
}

// ---------- scoring ----------

export function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

// Same rule as the YouTube scanner: the baseline is the median views of the account's posts published
// BEFORE this one (they have had at least as long to earn views). A young account with fewer than 5 earlier
// posts uses whatever exists, and fewer than 3 posts in total means no baseline at all.
// `posts` must be sorted newest first.
export function baselineFor(posts, cand, window = 30) {
  const others = posts.filter(p => p.post_id !== cand.post_id);
  let pool = others.filter(p => p.posted_at < cand.posted_at).slice(0, window);
  if (pool.length < 5) pool = others.slice(0, window);
  if (pool.length < 3) return null;
  const confidence = pool.length >= 10 ? 'high' : pool.length >= 5 ? 'ok' : 'low';
  return { baseline: median(pool.map(p => p.views || 0)), sample: pool.length, confidence };
}

// Recompute every stored post of one account against the account's stored history.
// Because history is kept between scans, baselines get better the longer the scans keep running.
export function rescoreAccount(db, platform, handle) {
  const posts = db.prepare(
    'SELECT post_id, posted_at, views FROM social_posts WHERE platform = ? AND handle = ? ORDER BY posted_at DESC',
  ).all(platform, handle);
  const upd = db.prepare(
    'UPDATE social_posts SET baseline = ?, multiplier = ?, sample = ?, confidence = ? WHERE platform = ? AND post_id = ?',
  );
  const hist = db.prepare('INSERT INTO social_history (platform, post_id, seen_at, views, multiplier) VALUES (?,?,?,?,?)');
  for (const p of posts) {
    const b = baselineFor(posts, p);
    if (!b) { upd.run(null, null, null, null, platform, p.post_id); continue; }
    const mult = b.baseline > 0 ? +((p.views || 0) / b.baseline).toFixed(2) : null;
    upd.run(b.baseline, mult, b.sample, b.confidence, platform, p.post_id);
    hist.run(platform, p.post_id, nowIso(), p.views || 0, mult);
  }
  return posts.length;
}

// ---------- ranking ----------

// The same guards the YouTube side uses, so a 20x here means what a 20x means there:
//   minViews, minBaseline (a tiny median fakes a huge multiplier), minConfidence (needs 5+ earlier posts),
//   minBaselineRatio (brand accounts whose median sits near zero; only checked when followers are known),
//   minAgeHours (a post needs a day before its multiplier means anything). LinkedIn uses its own floors (GUARDS).
// Not carried over: the English-only and niche-word filters and the max-subs cap. Those exist to clean up
// keyword search results, and here the user picks the accounts.
// platform: one name, or null for every platform (each ranked with its own guards, then merged).
export function socialOutliers(db, opts = {}) {
  if (!opts.platform) {
    return PLATFORMS.flatMap(p => socialOutliers(db, { ...opts, platform: p }))
      .sort((a, b) => b.multiplier - a.multiplier).slice(0, opts.limit || 50);
  }
  const {
    platform, days = 14, minMult = 2, minViews = 1000, minBaseline = 500,
    minBaselineRatio = 0.005, minConfidence = 'ok', minAgeHours = 24, limit = 50,
  } = { ...opts, ...(GUARDS[opts.platform] || {}) };
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const newest = new Date(Date.now() - minAgeHours * 36e5).toISOString();
  const allowed = { low: ['low', 'ok', 'high'], ok: ['ok', 'high'], high: ['high'] }[minConfidence] || ['ok', 'high'];
  return db.prepare(`
    SELECT p.*, a.followers AS followers, a.display_name AS display_name
    FROM social_posts p
    LEFT JOIN social_accounts a ON a.platform = p.platform AND a.handle = p.handle
    WHERE p.posted_at >= ? AND p.posted_at <= ?
      AND p.platform = ?
      AND p.multiplier IS NOT NULL AND p.multiplier >= ?
      AND p.views >= ? AND p.baseline >= ?
      AND p.confidence IN (${allowed.map(() => '?').join(',')})
      AND (a.followers IS NULL OR a.followers = 0 OR CAST(p.baseline AS REAL) / a.followers >= ?)
    ORDER BY p.multiplier DESC
    LIMIT ?
  `).all(since, newest, platform, minMult, minViews, minBaseline, ...allowed, minBaselineRatio, limit)
    .map(r => ({ ...r, metric: METRIC[platform] }));
}

export function socialStats(db) {
  const one = (q) => db.prepare(q).get();
  return {
    accounts: one('SELECT COUNT(*) n FROM social_accounts').n,
    posts: one('SELECT COUNT(*) n FROM social_posts').n,
    scans: one('SELECT COUNT(*) n FROM social_scans').n,
  };
}

export function logSocialScan(db, s) {
  db.prepare(`
    INSERT INTO social_scans (ran_at, platform, provider, accounts, posts, requests, est_cost_usd, cost_usd, note)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(nowIso(), s.platform, s.provider, s.accounts, s.posts, s.requests, s.est_cost_usd, s.cost_usd, s.note || '');
}
