#!/usr/bin/env node
// The best outliers across every platform, straight from the database. Never calls a paid service: scanning
// is a separate step (scan.mjs for YouTube, scan-social.mjs for Instagram, TikTok, X and LinkedIn).
// Other tools read the --json output (an ideas board, for one), so its shape is fixed:
//   { generated, windowDays, items: [ { platform, id, url, title, author, followers, posted, views,
//                                       multiplier, baseline, thumb } ] }   sorted by multiplier, biggest first
// --platform all means the platforms measured in views (YouTube, Instagram, TikTok, X). LinkedIn is measured in
// engagement, so its `views` field would hold reactions + comments + reposts; it is only listed when named,
// alone or in a list (--platform linkedin, or --platform x,linkedin).
//
// Usage:
//   node top.mjs [--days 7] [--limit 20] [--platform youtube|instagram|tiktok|x|linkedin|all|a,b] [--min-mult 2] [--json]
//   extras: --per-platform N (cap each platform before merging, so one platform cannot crowd out the others)
//           --format all|long|short (YouTube only, default all: Shorts are scored against the channel's Shorts)
//           --db FILE (read a different database)

import './quiet.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb, topOutliers, DB_PATH } from './db.mjs';
import { socialOutliers, PLATFORMS, METRIC, accountLabel } from './social-db.mjs';
import { plain, clip, captionTitle } from './text.mjs';

// =====================================================================================================
// DEFAULTS - change these to make it yours.
// =====================================================================================================
const DEFAULTS = {
  dbFile: DB_PATH,        // the one database all three platforms share
  days: 7,                // a week: ideas you can still ride
  limit: 20,
  minMult: 2,
  keywordsFile: path.join(path.dirname(fileURLToPath(import.meta.url)), 'keywords.json'),  // own channel + skipped channels
};
// =====================================================================================================

const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1] === undefined || argv[i + 1].startsWith('--') ? true : argv[i + 1]);
};
const num = (name, fallback) => { const v = flag(name); return v === null || v === true ? fallback : Number(v); };

const KNOWN = ['youtube', ...PLATFORMS];
const platform = String(flag('platform', 'all'));
const wanted = platform === 'all' ? KNOWN.filter(p => p === 'youtube' || METRIC[p] === 'views') : platform.split(',').map(s => s.trim());
if (!wanted.length || wanted.some(p => !KNOWN.includes(p))) {
  console.error(`--platform must be one of ${KNOWN.join(', ')}, a comma list of them, or all`);
  process.exit(1);
}
const days = num('days', DEFAULTS.days);
const limit = num('limit', DEFAULTS.limit);
const minMult = num('min-mult', DEFAULTS.minMult);
const perPlatform = num('per-platform', 0);
const format = flag('format', 'all');
const asJson = argv.includes('--json');
const dbFile = flag('db', DEFAULTS.dbFile);

// Titles, channel names and captions come from other people, so they pass through text.mjs first.
const firstLine = captionTitle;

function youtubeItems(db) {
  let cfg = {};
  try { cfg = JSON.parse(fs.readFileSync(DEFAULTS.keywordsFile, 'utf8')); } catch { /* no config: no extra filters */ }
  const mine = (cfg._own_channel || '').toLowerCase();
  const excludeChannels = [...(cfg.exclude_channels || []), ...(cfg.podcast_channels || [])];
  // Same defaults as the YouTube board: guards on baseline, confidence, brand accounts, podcasts, skipped channels.
  return topOutliers(db, { days, top: 500, minMult, excludeChannels, format })
    .filter(r => !(mine && String(r.channel_title || '').toLowerCase().includes(mine)))
    .map(r => ({
      platform: 'youtube', id: r.video_id,
      url: r.is_short ? `https://www.youtube.com/shorts/${r.video_id}` : `https://www.youtube.com/watch?v=${r.video_id}`,
      title: clip(r.title, 140), author: plain(r.channel_title), followers: r.subs > 0 ? r.subs : null,
      posted: String(r.published_at).slice(0, 10), views: r.views, multiplier: r.multiplier, baseline: r.baseline,
      thumb: r.thumb || null,
    }));
}

function socialItems(db, which) {
  const has = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'social_posts'").get();
  if (!has) return [];   // no social platform scanned yet: nothing to show, not an error
  return socialOutliers(db, { platform: which, days, minMult, limit: 500 }).map(r => ({
    platform: r.platform, id: r.post_id, url: r.url, title: clip(firstLine(r.caption), 140) || `No caption (post by ${accountLabel(r.platform, r.handle)})`,
    author: plain(accountLabel(r.platform, r.handle)), followers: r.followers > 0 ? r.followers : null, posted: String(r.posted_at).slice(0, 10),
    views: r.views, multiplier: r.multiplier, baseline: r.baseline, thumb: r.thumb || null,
  }));
}

function main() {
  let items = [];
  if (fs.existsSync(dbFile)) {
    const db = openDb(dbFile);
    const parts = [];
    for (const p of wanted) parts.push(p === 'youtube' ? youtubeItems(db) : socialItems(db, p));
    db.close();
    for (const p of parts) {
      p.sort((a, b) => b.multiplier - a.multiplier);
      items.push(...(perPlatform > 0 ? p.slice(0, perPlatform) : p));
    }
  } else {
    console.error(`warning: database not found at ${dbFile}`);
  }
  items.sort((a, b) => b.multiplier - a.multiplier);
  items = items.slice(0, limit);

  if (asJson) {
    process.stdout.write(JSON.stringify({ generated: new Date().toISOString(), windowDays: days, items }, null, 2) + '\n');
    return;
  }
  if (!items.length) { console.log(`No outliers in the last ${days} days (platform: ${platform}, min ${minMult}x).`); return; }
  console.log(`  MULT      VIEWS  PLATFORM   AUTHOR                    TITLE`);
  if (items.some(r => METRIC[r.platform] === 'engagement')) console.log('  (LinkedIn rows count engagement - reactions + comments + reposts - not views)');
  for (const r of items) {
    console.log(`${(r.multiplier + 'x').padStart(6)} ${String(r.views).padStart(10)}  ${r.platform.padEnd(9)}  ${String(r.author).slice(0, 24).padEnd(24)}  ${r.title.slice(0, 60)}`);
  }
}

main();
