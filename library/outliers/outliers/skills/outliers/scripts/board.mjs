// Builds the outliers results page: YouTube, TikTok, Instagram, X and LinkedIn hits on one page.
// The page is the shared results design in assets/results.html (the same one /latest uses); fill.mjs puts the data,
// the bundled fonts and the taste count inside. The data also lands beside the page as outliers-results.json.
// Both scanners call buildReport after a scan, so the page always shows everything in the database.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { topOutliers } from './db.mjs';
import { socialOutliers, PLATFORMS, accountLabel } from './social-db.mjs';
import { BOARD_FILE, IDEAS_FILE, RING_SIDECAR, LOCALE, PEERS_FILE, TASTE_FILE, OPEN_PAGE, DB_PATH, getKey } from './paths.mjs';
import { plain, clip, captionTitle } from './text.mjs';
import { fillPage, openPage } from './fill.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export { BOARD_FILE, IDEAS_FILE };
export const RESULTS_JSON = path.join(path.dirname(BOARD_FILE), 'outliers-results.json');

// YouTube multipliers run far higher than the other platforms', so each platform gets its own share
// of the page instead of one list that would be all YouTube.
const SOCIAL_PER_PLATFORM = 15;
const LABEL = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram', x: 'X', linkedin: 'LinkedIn' };

function loadJson(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return {}; } }

// The rows the page shows: everything in the window, every platform, long videos and Shorts. A run's
// own focus (--shorts, one platform) shows in the terminal; the page's filters narrow the view.
// Row keys: a YouTube video id, or "<platform>:<id>".
export function boardRows(db, opts = {}) {
  const cfg = loadJson(path.join(HERE, 'keywords.json'));
  const mine = (cfg._own_channel || '').toLowerCase();
  const excludeChannels = [...(cfg.exclude_channels || []), ...(cfg.podcast_channels || [])];
  const top = Math.max(opts.top || 10, opts.boardTop || 30);
  const yt = topOutliers(db, { ...opts, format: 'all', top, excludeChannels })
    .filter(r => !(mine && String(r.channel_title || '').toLowerCase().includes(mine)))
    .map(r => ({
      ...r, platform: 'youtube', title: plain(r.title), channel_title: plain(r.channel_title),
      url: r.is_short ? `https://www.youtube.com/shorts/${r.video_id}` : `https://www.youtube.com/watch?v=${r.video_id}`,
    }));
  const social = [];
  if (hasTable(db, 'social_posts')) {
    for (const platform of PLATFORMS) {
      for (const r of socialOutliers(db, { platform, days: opts.days || 14, minMult: opts.minMult || 2, limit: SOCIAL_PER_PLATFORM })) {
        const hours = Math.max((Date.now() - new Date(r.posted_at).getTime()) / 36e5, 1);
        const who = accountLabel(platform, r.handle);
        social.push({
          video_id: `${platform}:${r.post_id}`, platform, url: r.url,
          title: clip(captionTitle(r.caption), 160) || `Post by ${who}`, channel_title: who,
          published_at: r.posted_at, views: r.views, vph: Math.round(r.views / hours),
          subs: r.followers || 0, sub_mult: r.followers ? +(r.views / r.followers).toFixed(2) : 0,
          multiplier: r.multiplier, baseline: r.baseline, confidence: r.confidence, thumb: r.thumb || '',
          is_short: platform === 'tiktok' || platform === 'instagram' ? 1 : null, metric: r.metric,
        });
      }
    }
  }
  return [...yt, ...social].sort((a, b) => b.multiplier - a.multiplier);
}

const hasTable = (db, name) => !!(db && db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
const ymd = (d) => d.toISOString().slice(0, 10);

// What was scanned in the window, what wasn't and why, and today's YouTube quota, read from the scan logs.
function runSources(db, days, rows) {
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const today = new Date().toDateString();
  const searched = [], notSearched = [];
  let quota = null;
  const ytScans = hasTable(db, 'scans') ? db.prepare('SELECT * FROM scans WHERE ran_at >= ? ORDER BY ran_at').all(since) : [];
  if (ytScans.length) {
    const last = ytScans[ytScans.length - 1];
    const refs = String(last.keywords || '').split(',').map(s => s.trim()).filter(Boolean);
    const peers = refs.filter(s => s.startsWith('peer ')).length;
    const kws = refs.length - peers;
    searched.push({ source: 'YouTube', platform: 'youtube', note: [kws ? `${kws} keyword searches` : '', peers ? `${peers} peer channels` : ''].filter(Boolean).join(', ') || 'scanned' });
    const todays = ytScans.filter(s => new Date(s.ran_at).toDateString() === today);
    if (todays.length) {
      quota = {
        searches: todays.reduce((a, s) => a + (s.searches ?? String(s.keywords || '').split(',').filter(k => k.trim() && !k.trim().startsWith('peer ')).length), 0),
        searchesCap: 100,
        units: todays.reduce((a, s) => a + (s.quota_used || 0), 0),
        unitsCap: 10000,
      };
    }
  } else if (rows.some(r => r.platform === 'youtube')) searched.push({ source: 'YouTube', platform: 'youtube', note: 'from earlier scans' });
  else notSearched.push({ source: 'YouTube', platform: 'youtube', why: 'not scanned in this window' });

  const social = hasTable(db, 'social_scans')
    ? db.prepare('SELECT platform, MAX(accounts) accounts, SUM(COALESCE(cost_usd, 0)) cost, MAX(ran_at) last FROM social_scans WHERE ran_at >= ? GROUP BY platform').all(since) : [];
  const peersFile = loadJson(PEERS_FILE);
  const paidKey = getKey('APIFY_API_TOKEN') || getKey('SCRAPECREATORS_API_KEY');
  let cost = 0;
  for (const p of PLATFORMS) {
    const s = social.find(x => x.platform === p);
    if (s) { searched.push({ source: LABEL[p] || p, platform: p, note: `${s.accounts} accounts` }); cost += s.cost || 0; continue; }
    const why = (p === 'instagram' || p === 'linkedin') && !paidKey ? 'needs a paid scraper key'
      : !(peersFile[p] || []).length ? 'no accounts in your peers file' : 'not scanned in this window';
    notSearched.push({ source: LABEL[p] || p, platform: p, why });
  }
  if (quota && social.length) quota.costUsd = +cost.toFixed(2);
  return { searched, notSearched, quota };
}

// The board rows as a results JSON for the shared page.
export function resultsData(rows, opts = {}) {
  const cfg = loadJson(path.join(HERE, 'keywords.json'));
  const ideas = loadJson(IDEAS_FILE);
  const days = opts.days || 14;
  const now = new Date();
  const items = rows.map((r, i) => {
    const yt = r.platform === 'youtube';
    const idea = ideas[r.video_id] || {};
    const peer = String(r.keyword || '').startsWith('peer ');
    return {
      id: r.video_id, rank: i + 1, platform: r.platform,
      format: yt ? (r.is_short ? 'short' : 'long') : (r.is_short ? 'short' : 'post'),
      title: r.title, channel: r.channel_title, url: r.url,
      videoId: yt ? r.video_id : null,
      thumb: yt ? `https://i.ytimg.com/vi/${r.video_id}/hqdefault.jpg` : (r.thumb || null),
      views: r.views, normal: r.baseline, multiplier: r.multiplier, vph: r.vph, subs: r.subs,
      published: r.published_at, confidence: r.confidence, metric: r.metric || 'views',
      foundBy: yt ? (peer ? 'A peer channel you watch' : r.keyword ? `YouTube search: "${r.keyword}"` : 'YouTube search') : 'A peer account you watch',
      angle: idea.angle || '', idea: idea.idea || '', fit: idea.fit || '',
    };
  });
  const sets = cfg.sets || {};
  const keywordList = [...new Set(Object.values(sets).flat())];
  const { searched, notSearched, quota } = opts.db ? runSources(opts.db, days, rows) : { searched: [], notSearched: [], quota: null };
  return {
    kind: 'outliers',
    headline: { text: 'Niche OUTLIERS', doto: 'OUTLIERS' },
    run: {
      id: `outliers-${ymd(now)}`,
      skill: '/outliers',
      topic: cfg._niche || (keywordList.length ? keywordList.slice(0, 4).join(', ') : 'Your niche'),
      window: { days, from: ymd(new Date(now - days * 864e5)), to: ymd(now) },
      ranAt: now.toISOString(),
      ...(LOCALE ? { locale: LOCALE } : {}),
      searched, notSearched,
      minMultiplier: opts.minMult || 2,
      ...(quota ? { quota } : {}),
      notes: [
        keywordList.length ? `Keyword sets: ${Object.entries(sets).map(([k, v]) => `${k} (${v.join(', ')})`).join('; ')}.` : '',
        "A Short is scored against the channel's other Shorts, a long video against its long videos, a post against the account's earlier posts.",
        opts.reportOnly ? 'Rebuilt from the saved database, so this rebuild spent no quota.' : '',
      ].filter(Boolean),
      rawFile: DB_PATH,
    },
    items,
  };
}

export function buildReport(rows, opts = {}) {
  const data = resultsData(rows, opts);
  fs.mkdirSync(path.dirname(BOARD_FILE), { recursive: true });
  const { warnings } = fillPage(data, BOARD_FILE, { tasteFile: TASTE_FILE });   // adds run.taste, so the JSON is written after
  fs.writeFileSync(RESULTS_JSON, JSON.stringify(data, null, 2) + '\n', 'utf8');
  for (const w of warnings) console.warn('page warning: ' + w);

  // Keep the bookmark pointing at the live file, where the workspace has one.
  if (RING_SIDECAR) {
    fs.mkdirSync(path.dirname(RING_SIDECAR), { recursive: true });
    fs.writeFileSync(RING_SIDECAR, JSON.stringify({
      title: 'Niche Outliers',
      icon: 'chart',
      kind: 'dashboard',
      created: new Date().toISOString(),
      note: 'Outliers results page: YouTube, TikTok, X, Instagram and LinkedIn posts beating their normal. Search, filter, add to the idea cart, copy for the agent',
      src: BOARD_FILE,
      svg: "<path d=\"M6 42h36\"/><path d=\"M13 42V32M22 42v-7M31 42v-9\"/><path d=\"M40 42V12\"/><path d=\"M35 18l5-6 5 6\"/>",
    }, null, 2), 'utf8');
  }

  if (opts.open && OPEN_PAGE && openPage(BOARD_FILE)) console.log('Opened the results page in your browser.');
  return BOARD_FILE;
}
