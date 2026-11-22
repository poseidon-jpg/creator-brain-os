#!/usr/bin/env node
// YouTube outlier scanner - finds videos beating their own channel's baseline.
//
//   multiplier = video views / median views of that channel's earlier uploads of the same kind
//                (a Short against the channel's Shorts, a long video against its long videos)
//   vph        = views / hours since publish
//
// Both numbers are ours, computed from public YouTube Data API v3 data. They are not official
// YouTube metrics. Same idea as vidIQ's outlier score, built on the free quota.
//
// Two ways in, used together by default:
//   keyword search   a keyword set from keywords.json (each keyword is one of 100 free searches a day)
//   peer channels    the "youtube" list in the peers file (no searches, about 3 units a channel)
//
// Usage (from the folder in RUN_FROM, paths.mjs):
//   node scan.mjs                          # default keyword set + peer channels, last 14 days, top 10 (board shows 30)
//   node scan.mjs --set coding --days 30
//   node scan.mjs --keywords "ai agents,mcp server"
//   node scan.mjs --channels @handle,@other   # only these channels, no keyword search
//   node scan.mjs --peers-only             # only the peers file's channels, no keyword search
//   node scan.mjs --shorts                 # a Shorts run: the "shorts" keyword set + peer channels, Shorts only
//   node scan.mjs --format long            # or all; default: long from search, both kinds from peers
//   node scan.mjs --report-only            # rebuild the results page from the database, 0 quota, and open it
//   add --no-open to any of these to write the page without opening it (OPEN_PAGE in paths.mjs turns opening off for good)

import './quiet.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  openDb, upsertVideo, getChannel, saveChannel, saveUploads, getUploads,
  logScan, markReported, dbStats, flagPodcast, DB_PATH,
  getChannelByHandle, setChannelHandle, knownShort, setUploadShort,
} from './db.mjs';
import { buildReport, boardRows as allBoardRows } from './board.mjs';
import { isPodcast } from './podcast.mjs';
import { getKey, ENV_FILES, PEERS_FILE } from './paths.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
// Two separate daily buckets (developers.google.com/youtube/v3/determine_quota_cost): search.list has
// its own 100 calls a day at 1 unit each, and every other method shares 10,000 units a day.
const DAILY_SEARCHES = 100;
const DAILY_UNITS = 10000;
const READ_COST = 1;
// A Short is a vertical or square video of 3 minutes or less (YouTube's own rule). The API has no Shorts
// field, but asking videos.list for part=player with a maxWidth returns the embed size, so the shape comes
// free with the same call. Over 3 minutes is never a Short. When the shape is unknown, 60 seconds or less counts.
const SHORT_MAX_S = 180;
const SHORT_GUESS_S = 60;
const VIDEO_PARTS = { part: 'snippet,statistics,contentDetails,player', maxWidth: 400 };
// Keyword search returns Shorts from #viral spam channels that beat their tiny normals by 100x, so keyword
// search covers long videos unless --format says otherwise. Peer channels were picked by the user: both kinds.
const SEARCH_FORMAT = 'long';
const PEER_FORMAT = 'all';
// A Shorts run asks keyword search for Shorts on purpose, so the spam is held back two other ways: a Short found
// by search needs a channel of at least this many subscribers (the spam channels sit at a few hundred to a few
// thousand), and a title or description stacking two or more catch-all hashtags is dropped.
const SHORTS_SEARCH_MIN_SUBS = 10000;
const CATCH_ALL_TAGS = /#(viral|viralvideo|viralshorts|fyp|foryou|foryoupage|trending|trend|explore|storytelling|shortsfeed|shortvideo|ytshorts|tiktok)\b/gi;
const spammy = (v) => (`${v.title} ${(v.description || '').slice(0, 300)}`.match(CATCH_ALL_TAGS) || []).length >= 2;

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = (name, fallback = null) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (argv[i + 1] === undefined || argv[i + 1].startsWith('--') ? true : argv[i + 1]);
};
const has = (name) => argv.includes(`--${name}`);
const num = (name, fallback) => { const v = flag(name); return v === null || v === true ? fallback : Number(v); };

const OPTS = {
  shorts: has('shorts'),                   // a Shorts run: format short, the "shorts" keyword set unless one is named
  set: flag('set', null),
  keywords: flag('keywords', null),
  channels: flag('channels', null),
  peersOnly: has('peers-only'),
  format: flag('format', null),            // all | long | short; unset = SEARCH_FORMAT and PEER_FORMAT
  days: num('days', 14),                   // fresh ideas only, unless a wider window is asked for
  top: num('top', 10),                     // rows printed in the terminal table
  boardTop: num('board-top', 30),          // rows on the sortable board, so there is something to rank
  minMult: num('min-mult', 2),
  minViews: num('min-views', 1000),
  minAgeHours: num('min-age-hours', 24),   // a video needs time before a multiplier means anything
  minBaseline: num('min-baseline', 500),   // a tiny baseline turns noise into a fake 400x
  // Brand channels (HackerRank, Arduino, dev-tool accounts) post many tiny product clips, so their
  // median sits near zero and any real video looks like 900x. Real creators land 2% to 50% here.
  minBaselineRatio: num('min-baseline-ratio', 0.005),
  minConfidence: flag('min-confidence', 'ok'),  // low | ok | high
  maxSubs: num('max-subs', 3_000_000),     // keeps CNN-sized general channels out of a keyword search
  minSubs: num('min-subs', 0),
  lang: flag('lang', 'en'),                // 'any' to switch the language filter off
  budget: num('budget', 3000),             // units this run may spend on non-search calls, of 10,000/day
  searches: num('searches', 50),           // search.list calls this run may make, of 100/day (leaves room for a second run)
  refreshDays: num('refresh-days', 7),     // how stale a cached channel may get
  perKeyword: num('per-keyword', 40),      // candidates pulled per search
  newOnly: has('new-only'),
  reportOnly: has('report-only'),
  noReport: has('no-report'),
  noOpen: has('no-open'),                  // write the results page but don't open it in the browser
  region: flag('region', null),
};
if (OPTS.shorts) OPTS.format = 'short';
if (OPTS.format !== null && !['all', 'long', 'short'].includes(OPTS.format)) {
  console.error('--format must be all, long or short');
  process.exit(1);
}

// ---------- api ----------
function readKey() {
  const key = getKey('YOUTUBE_API_KEY');
  if (!key) throw new Error(`YOUTUBE_API_KEY is not set. Add the line YOUTUBE_API_KEY=your-key to ${ENV_FILES[0]}, or set it as an environment variable. It is free: see the setup steps.`);
  return key;
}

let quotaUsed = 0;      // units from the shared 10,000/day bucket
let searchesUsed = 0;   // calls from search.list's own 100/day bucket
function makeApi(key) {
  return async function api(resource, params) {
    const isSearch = resource === 'search';
    if (isSearch && searchesUsed + 1 > OPTS.searches) throw new Error('SEARCH_QUOTA_BUDGET_HIT');
    if (!isSearch && quotaUsed + READ_COST > OPTS.budget) throw new Error('QUOTA_BUDGET_HIT');
    const url = new URL(`https://www.googleapis.com/youtube/v3/${resource}`);
    for (const [k, v] of Object.entries({ ...params, key })) url.searchParams.set(k, v);
    const res = await fetch(url);
    if (isSearch) searchesUsed += 1; else quotaUsed += READ_COST;
    if (!res.ok) {
      const body = await res.text();
      // An empty search bucket leaves the 10,000 units untouched, so the name says which one ran out.
      if (res.status === 403 && /quota/i.test(body)) throw new Error(isSearch ? 'SEARCH_QUOTA_EXCEEDED' : 'QUOTA_EXCEEDED');
      if (res.status === 400 && /API key not valid/i.test(body)) throw new Error('KEY_INVALID: YouTube says the API key is not valid. Check YOUTUBE_API_KEY, and that "YouTube Data API v3" is turned on for its project.');
      throw new Error(`${resource} ${res.status}: ${body.slice(0, 200)}`);
    }
    return res.json();
  };
}

// ---------- helpers ----------
const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n));
const list = (s) => String(s).split(',').map(t => t.trim()).filter(Boolean);

function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

function toVideo(v, keyword) {
  return {
    video_id: v.id,
    title: v.snippet.title,
    channel_id: v.snippet.channelId,
    channel_title: v.snippet.channelTitle,
    published_at: v.snippet.publishedAt,
    duration_s: parseDuration(v.contentDetails?.duration),
    is_short: null,
    views: +v.statistics?.viewCount || 0,
    likes: +v.statistics?.likeCount || 0,
    comments: +v.statistics?.commentCount || 0,
    thumb: v.snippet.thumbnails?.medium?.url || '',
    keyword,
    lang: v.snippet.defaultAudioLanguage || v.snippet.defaultLanguage || '',
    description: v.snippet.description || '',
    shape: shapeOf(v),
  };
}

// Height over width of the embed (VIDEO_PARTS asks for it): 1.78 for a vertical video, 0.56 for a wide one.
const shapeOf = (v) => (v.player?.embedWidth && v.player?.embedHeight ? v.player.embedHeight / v.player.embedWidth : null);
const guessShort = (v) => (v.duration_s > 0 && v.duration_s <= SHORT_GUESS_S ? 1 : 0);

// Sets is_short on each item (1 Short, 0 long). Stored answers are reused. Items with no shape yet (rows and
// uploads saved by an older scan) get one videos call per 50 when an api is passed (1 unit), else the guess.
async function classify(db, items, api = null) {
  const unsure = [];
  for (const v of items) {
    if (v.is_short === 0 || v.is_short === 1) continue;
    const d = v.duration_s || 0;
    if (d <= 0 || d > SHORT_MAX_S) { v.is_short = 0; continue; }   // 0 seconds = a live stream or premiere
    if (v.shape) { v.is_short = v.shape >= 1 ? 1 : 0; continue; }
    const known = knownShort(db, v.video_id);
    if (known === 0 || known === 1) { v.is_short = known; continue; }
    unsure.push(v);
  }
  if (api) {
    for (const ids of chunk(unsure.map(v => v.video_id), 50)) {
      try {
        const r = await api('videos', { part: 'player', maxWidth: 400, id: ids.join(',') });
        const shapes = new Map((r.items || []).map(x => [x.id, shapeOf(x)]));
        for (const v of unsure) if (shapes.get(v.video_id)) v.shape = shapes.get(v.video_id);
      } catch (e) { if (/QUOTA/.test(e.message)) break; }
    }
  }
  for (const v of unsure) v.is_short = v.shape ? (v.shape >= 1 ? 1 : 0) : guessShort(v);
}

// Baseline = median views of the channel's uploads of the same kind published BEFORE this video.
// Comparing only against older videos is fairer: they have had at least as long to earn views.
// Shorts and long videos earn views at very different rates, so each is measured against its own kind.
const kindOf = (u) => (u.is_short === 0 || u.is_short === 1 ? u.is_short : guessShort(u));
function baselineFor(uploads, cand) {
  const same = uploads.filter(u => u.video_id !== cand.video_id && u.duration_s > 0 && kindOf(u) === cand.is_short);
  let pool = same
    .filter(u => u.published_at < cand.published_at)
    .sort((a, b) => b.published_at.localeCompare(a.published_at))
    .slice(0, 30);
  if (pool.length < 5) pool = same.slice(0, 30);            // young channel: use whatever exists
  if (pool.length < 3) return null;                         // too thin to mean anything
  const confidence = pool.length >= 10 ? 'high' : pool.length >= 5 ? 'ok' : 'low';
  return { baseline: median(pool.map(u => u.views)), sample: pool.length, confidence };
}

// YouTube's relevanceLanguage is only a hint, so filter for real.
// Trust the uploader's declared audio language first, then fall back to script detection.
const NON_LATIN = /[Ѐ-ӿ֐-׿؀-ۿऀ-ॿ฀-๿ᄀ-ᇿ぀-ヿ㐀-鿿가-힯]/;
function isEnglish(v) {
  const declared = (v.lang || '').toLowerCase();
  if (declared) return declared.startsWith('en');
  return !NON_LATIN.test(`${v.title} ${v.description || ''}`.slice(0, 400));
}

// The keyword search matches loosely, so require the video itself to mention something in the lane.
// Whole words only: as a bare substring, "ai" matches "again", "detail" and "maintain", which let farming and
// exam-tip Shorts through.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function inNiche(v, terms) {
  if (!terms.length) return true;
  const hay = `${v.title} ${(v.description || '').slice(0, 500)}`.toLowerCase();
  return terms.some(t => new RegExp(`(^|[^a-z0-9])${escapeRe(t)}($|[^a-z0-9])`).test(hay));
}

function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(HERE, 'keywords.json'), 'utf8'));
}

// Keyword search runs unless the run names channels or asks for peers only.
function loadKeywords(cfg) {
  if ((OPTS.channels && OPTS.channels !== true) || OPTS.peersOnly) return [];
  if (OPTS.keywords && OPTS.keywords !== true) return list(OPTS.keywords);
  const name = OPTS.set || (OPTS.shorts && cfg.sets?.shorts ? 'shorts' : 'default');
  const set = cfg.sets?.[name];
  if (!set) throw new Error(`Unknown set "${name}". Available: ${Object.keys(cfg.sets || {}).join(', ')}`);
  return set;
}

// "@name", "name", a channel link, or a channel id (UC...). Returns { id } or { handle }.
function parseChannel(s) {
  let t = String(s).trim().replace(/^https?:\/\/(www\.|m\.)?youtube\.com\//i, '');
  if (/^channel\//i.test(t)) t = t.split('/')[1] || '';
  t = t.split(/[/?#]/)[0];
  if (/^UC[\w-]{22}$/.test(t)) return { id: t, label: t };
  const handle = '@' + t.replace(/^@/, '');
  return handle.length > 1 ? { handle, label: handle } : null;
}

function loadPeerChannels() {
  if (OPTS.channels && OPTS.channels !== true) return list(OPTS.channels).map(parseChannel).filter(Boolean);
  let peers;
  try { peers = JSON.parse(fs.readFileSync(PEERS_FILE, 'utf8')); } catch {
    if (OPTS.peersOnly) throw new Error(`Peers file not found: ${PEERS_FILE}. Add a "youtube" list of channel handles to it, or pass --channels @a,@b.`);
    return [];
  }
  const refs = (peers.youtube || []).map(parseChannel).filter(Boolean);
  if (OPTS.peersOnly && !refs.length) throw new Error(`The peers file has no "youtube" channels: ${PEERS_FILE}`);
  return refs;
}

// ---------- main ----------
async function main() {
  const db = openDb();
  const cfg = loadConfig();
  OPTS.excludeChannels = [...(cfg.exclude_channels || []), ...(cfg.podcast_channels || [])];

  if (OPTS.reportOnly) {
    await remeasureWindow(db);
    const rows = boardRows(db, cfg);
    const out = buildReport(rows, { ...OPTS, quotaUsed: 0, keywords: loadKeywords(cfg), peers: loadPeerChannels().length, stats: dbStats(db), db, open: !OPTS.noOpen });
    markReported(db, rows.map(r => r.video_id));
    printTable(rows.slice(0, OPTS.top));
    console.log(`\nPage: ${out}\nDatabase: ${DB_PATH} (${JSON.stringify(dbStats(db))})`);
    db.close();
    return;
  }

  const keywords = loadKeywords(cfg);
  const peerRefs = loadPeerChannels();
  const api = makeApi(readKey());
  const mine = (cfg._own_channel || '').toLowerCase();
  const nicheTerms = (cfg.niche_terms || []).map(t => t.toLowerCase());
  const excluded = new Set((cfg.exclude_channels || []).map(t => t.trim().toLowerCase()));
  const publishedAfter = new Date(Date.now() - OPTS.days * 864e5).toISOString();
  const maxAge = Date.now() - OPTS.minAgeHours * 36e5;
  const staleBefore = new Date(Date.now() - OPTS.refreshDays * 864e5).toISOString();

  console.log(`Scanning ${keywords.length} keywords and ${peerRefs.length} peer channels, last ${OPTS.days} days, cap ${OPTS.searches} searches (of ${DAILY_SEARCHES}/day) and ${OPTS.budget} units (of ${DAILY_UNITS}/day).`);

  // 1. Candidates from keyword search
  const candidateIds = new Map(); // videoId -> keyword that found it
  for (const kw of keywords) {
    try {
      const r = await api('search', {
        part: 'snippet', q: kw, type: 'video', order: 'viewCount',
        publishedAfter, maxResults: Math.min(OPTS.perKeyword, 50),
        relevanceLanguage: 'en', ...(OPTS.region && OPTS.region !== true ? { regionCode: OPTS.region } : {}),
        // "short" is YouTube's under-4-minutes filter: it brings back Shorts instead of long videos.
        ...(OPTS.format === 'short' ? { videoDuration: 'short' } : {}),
      });
      for (const item of r.items || []) {
        const id = item.id?.videoId;
        if (id && !candidateIds.has(id)) candidateIds.set(id, kw);
      }
      process.stdout.write(`  ${kw}: ${r.items?.length || 0}\n`);
    } catch (e) {
      if (/QUOTA|KEY_INVALID/.test(e.message)) { console.log(`  stopped early: ${e.message}`); if (/KEY_INVALID/.test(e.message)) throw e; break; }
      console.log(`  ${kw}: failed (${e.message})`);
    }
  }
  if (keywords.length) console.log(`Search candidates: ${candidateIds.size} (searches ${searchesUsed})`);

  // 2. Real stats for the search candidates
  const searched = [];
  for (const ids of chunk([...candidateIds.keys()], 50)) {
    try {
      const r = await api('videos', { ...VIDEO_PARTS, id: ids.join(',') });
      for (const v of r.items || []) searched.push(toVideo(v, candidateIds.get(v.id)));
    } catch (e) { if (/QUOTA/.test(e.message)) break; throw e; }
  }

  // 3. Peer channels: the latest 50 uploads of each, with fresh stats every run (recent views move fast).
  //    They become candidates and the channel's baseline in one go, and spend no searches.
  const channelInfo = new Map();
  const peerVideos = [];
  const peerProblems = [];
  for (const ref of peerRefs) {
    try {
      let info = ref.id ? getChannel(db, ref.id) : getChannelByHandle(db, ref.handle);
      if (!info || !info.uploads_playlist || !(info.checked_at > staleBefore)) {
        const r = await api('channels', { part: 'snippet,statistics,contentDetails', ...(ref.id ? { id: ref.id } : { forHandle: ref.handle }) });
        const item = r.items?.[0];
        if (!item) { peerProblems.push(`${ref.label}: no channel found with that handle`); continue; }
        info = {
          channel_id: item.id, title: item.snippet.title,
          subs: +item.statistics.subscriberCount || 0, video_count: +item.statistics.videoCount || 0,
          uploads_playlist: item.contentDetails?.relatedPlaylists?.uploads,
        };
        saveChannel(db, info);
        if (ref.handle) setChannelHandle(db, item.id, ref.handle);
      }
      const pl = await api('playlistItems', { part: 'contentDetails', playlistId: info.uploads_playlist, maxResults: 50 });
      const upIds = (pl.items || []).map(i => i.contentDetails.videoId).filter(Boolean);
      const vids = [];
      for (const ids of chunk(upIds, 50)) {
        const r = await api('videos', { ...VIDEO_PARTS, id: ids.join(',') });
        for (const v of r.items || []) vids.push(toVideo(v, `peer ${ref.label}`));
      }
      await classify(db, vids);
      saveUploads(db, info.channel_id, vids);
      channelInfo.set(info.channel_id, info);
      peerVideos.push(...vids.filter(v => v.published_at >= publishedAfter));
    } catch (e) {
      if (/QUOTA/.test(e.message)) { console.log(`  stopped early: ${e.message}`); break; }
      if (/KEY_INVALID/.test(e.message)) throw e;
      peerProblems.push(`${ref.label}: ${e.message}`);
    }
  }
  if (peerRefs.length) console.log(`Peer channels: ${channelInfo.size} of ${peerRefs.length} read, ${peerVideos.length} uploads in the window`);
  for (const p of peerProblems) console.log(`  problem - ${p}`);

  // 4. Prefilter before spending quota on channel baselines. Peer videos skip the language, niche,
  //    skip-list and podcast filters: those clean up keyword search, and the user picked these channels.
  const drops = { views: 0, tooNew: 0, format: 0, lang: 0, offNiche: 0, mine: 0, excluded: 0, podcast: 0, spam: 0, smallShorts: 0 };
  const peerIds = new Set(peerVideos.map(v => v.video_id));
  const pre = [...peerVideos, ...searched.filter(v => !peerIds.has(v.video_id))].filter(c => {
    const peer = c.keyword.startsWith('peer ');
    if (isMine(c.channel_title, mine)) return (drops.mine++, false);
    if (!peer && excluded.has(c.channel_title.trim().toLowerCase())) return (drops.excluded++, false);
    if (!peer && isPodcast(c, cfg)) { flagPodcast(db, c.video_id); return (drops.podcast++, false); }
    if (c.views < OPTS.minViews) return (drops.views++, false);
    if (new Date(c.published_at).getTime() > maxAge) return (drops.tooNew++, false);
    if (!peer && OPTS.lang === 'en' && !isEnglish(c)) return (drops.lang++, false);
    if (!peer && !inNiche(c, nicheTerms)) return (drops.offNiche++, false);
    if (!peer && spammy(c)) return (drops.spam++, false);
    return true;
  });
  await classify(db, pre, api);
  const fits = (c) => {
    const want = OPTS.format || (c.keyword.startsWith('peer ') ? PEER_FORMAT : SEARCH_FORMAT);
    return want === 'all' || (want === 'short') === (c.is_short === 1);
  };
  const worth = pre.filter(c => fits(c) || (drops.format++, false));
  const channelIds = [...new Set(worth.map(c => c.channel_id))];
  console.log(`Worth checking: ${worth.length} videos across ${channelIds.length} channels`);
  console.log(`  filtered out - podcasts ${drops.podcast}, skipped channels ${drops.excluded}, language ${drops.lang}, off-niche ${drops.offNiche}, hashtag spam ${drops.spam}, format ${drops.format}, low views ${drops.views}, too new ${drops.tooNew}`);

  // 5. Channel baselines for search finds - cached, so a repeat scan costs almost nothing
  let fetched = 0, cached = 0;
  for (const chId of channelIds) {
    if (channelInfo.has(chId)) continue;   // a peer channel, read fresh above
    const known = getChannel(db, chId);
    if (known && known.checked_at > staleBefore) {
      channelInfo.set(chId, known);
      cached++;
      continue;
    }
    try {
      const ch = await api('channels', { part: 'snippet,statistics,contentDetails', id: chId });
      const item = ch.items?.[0];
      if (!item) continue;
      const uploadsPl = item.contentDetails?.relatedPlaylists?.uploads;
      const info = {
        channel_id: chId, title: item.snippet.title,
        subs: +item.statistics.subscriberCount || 0,
        video_count: +item.statistics.videoCount || 0,
        uploads_playlist: uploadsPl,
      };
      if (uploadsPl) {
        const pl = await api('playlistItems', { part: 'contentDetails', playlistId: uploadsPl, maxResults: 50 });
        const upIds = (pl.items || []).map(i => i.contentDetails.videoId).filter(Boolean);
        const uploads = [];
        for (const ids of chunk(upIds, 50)) {
          const r = await api('videos', { ...VIDEO_PARTS, id: ids.join(',') });
          for (const v of r.items || []) uploads.push(toVideo(v, ''));
        }
        await classify(db, uploads);
        saveUploads(db, chId, uploads);
      }
      saveChannel(db, info);
      channelInfo.set(chId, info);
      fetched++;
    } catch (e) {
      if (/QUOTA/.test(e.message)) { console.log(`  stopped early: ${e.message}`); break; }
      console.log(`  channel ${chId}: ${e.message}`);
    }
  }
  console.log(`Channels: ${fetched} fetched, ${cached} from cache (units ${quotaUsed})`);

  // Uploads cached before Shorts were told apart have no answer yet: settle them once, then store it.
  for (const chId of channelIds) {
    const unsure = getUploads(db, chId).filter(u => u.is_short == null);
    if (!unsure.length) continue;
    await classify(db, unsure, api);
    for (const u of unsure) setUploadShort(db, u.video_id, u.is_short);
  }

  // 6. Score everything
  let kept = 0, brandNew = 0;
  const found = [];
  for (const c of worth) {
    const info = channelInfo.get(c.channel_id);
    if (!info) continue;
    const peer = c.keyword.startsWith('peer ');
    if (!peer && (info.subs > OPTS.maxSubs || info.subs < OPTS.minSubs)) continue;
    if (!peer && c.is_short === 1 && info.subs < SHORTS_SEARCH_MIN_SUBS) { drops.smallShorts++; continue; }
    if (!peer && excluded.has(String(info.title || '').trim().toLowerCase())) continue;
    const base = baselineFor(getUploads(db, c.channel_id), c);
    if (!base || base.baseline < OPTS.minBaseline) continue;   // dividing by a tiny median fakes huge multipliers
    if (info.subs && base.baseline / info.subs < OPTS.minBaselineRatio) continue;   // brand account, not a creator
    const hours = Math.max((Date.now() - new Date(c.published_at).getTime()) / 36e5, 1);
    const row = {
      ...c,
      baseline: base.baseline,
      confidence: base.confidence,
      multiplier: +(c.views / base.baseline).toFixed(2),
      vph: Math.round(c.views / hours),
      subs: info.subs,
      sub_mult: info.subs ? +(c.views / info.subs).toFixed(2) : 0,
    };
    if (upsertVideo(db, row)) brandNew++;
    if (row.multiplier >= OPTS.minMult) { kept++; found.push(row); }
  }
  await remeasureWindow(db, api);

  logScan(db, { keywords: [...keywords, ...peerRefs.map(r => `peer ${r.label}`)].join(', '), days: OPTS.days, quota_used: quotaUsed, candidates: searched.length + peerVideos.length, kept, searches: searchesUsed });

  // 7. Report: this run's finds in the terminal, everything in the window on the board
  const rows = boardRows(db, cfg);
  if (drops.smallShorts) console.log(`  Shorts from channels under ${SHORTS_SEARCH_MIN_SUBS.toLocaleString('en-US')} subscribers left out: ${drops.smallShorts}`);
  console.log(`\nThis run: ${found.length} outliers at ${OPTS.minMult}x or more. The results page holds ${rows.length} from the last ${OPTS.days} days.`);
  const fresh = new Map(found.map(r => [r.video_id, r]));
  for (const r of rows) if (fresh.has(r.video_id)) fresh.set(r.video_id, r);   // board rows carry the re-measured numbers
  printTable([...fresh.values()].sort((a, b) => b.multiplier - a.multiplier).slice(0, OPTS.top));
  const stats = dbStats(db);
  let out = null;
  if (!OPTS.noReport) {
    out = buildReport(rows, { ...OPTS, quotaUsed, searchesUsed, keywords, peers: peerRefs.length, stats, db, open: !OPTS.noOpen });
    markReported(db, rows.map(r => r.video_id));
  }
  console.log(`\nNew to the database this run: ${brandNew} videos`);
  console.log(`Quota used: ${searchesUsed} of ${DAILY_SEARCHES} daily searches, ${quotaUsed} of ${DAILY_UNITS} daily units`);
  if (out) console.log(`Page: ${out}`);
  console.log(`Database: ${DB_PATH} - ${stats.videos} videos, ${stats.channels} channels, ${stats.uploads} cached uploads`);
  db.close();
}

// A channel title often carries extra words ("Name | Brand"), so an exact match would let your own videos through.
function isMine(title, mine) {
  return !!mine && String(title || '').toLowerCase().includes(mine);
}

const boardRows = (db) => allBoardRows(db, OPTS);

// A row stored by an earlier scan keeps the multiplier it got then. Re-measure every row in the window against
// the cached uploads with today's rule (Shorts against Shorts), so the board never mixes two rules. Views stay
// as last seen. With an api it settles any video whose kind is still unknown (1 unit per 50, once each);
// --report-only passes none, so it spends nothing and leaves unknown ones to the next full scan.
async function remeasureWindow(db, api = null) {
  const since = new Date(Date.now() - OPTS.days * 864e5).toISOString();
  const rows = db.prepare('SELECT video_id, channel_id, published_at, duration_s, is_short, views, title FROM videos WHERE published_at >= ?').all(since);
  for (const r of rows) if (r.duration_s > 0 && r.duration_s <= SHORT_MAX_S) r.is_short = null;   // a scan before the shape check may have guessed
  await classify(db, rows, api);
  const upd = db.prepare('UPDATE videos SET is_short = ?, baseline = ?, multiplier = ?, confidence = ? WHERE video_id = ?');
  const settled = new Set();
  for (const r of rows) {
    if (api && !settled.has(r.channel_id)) {
      settled.add(r.channel_id);
      const unsure = getUploads(db, r.channel_id).filter(u => u.is_short == null);
      if (unsure.length) { await classify(db, unsure, api); for (const u of unsure) setUploadShort(db, u.video_id, u.is_short); }
    }
    const base = baselineFor(getUploads(db, r.channel_id), r);
    if (!base || !base.baseline) { upd.run(r.is_short, 0, 0, 'low', r.video_id); continue; }   // too thin now: drops off the board
    upd.run(r.is_short, base.baseline, +(r.views / base.baseline).toFixed(2), base.confidence, r.video_id);
  }
}

const kindLabel = (r) => (r.platform && r.platform !== 'youtube' ? r.platform : r.is_short ? 'yt short' : 'yt long');

function printTable(rows) {
  if (!rows.length) { console.log('\nNo outliers matched. Try --days 60 or --min-mult 1.5'); return; }
  console.log(`\n  MULT     VPH     VIEWS     SUBS  KIND       CONF  CHANNEL                  TITLE`);
  for (const r of rows) {
    console.log(
      `${(r.multiplier + 'x').padStart(6)} ${String(r.vph).padStart(7)} ${String(r.views).padStart(9)} ` +
      `${String(r.subs).padStart(8)}  ${kindLabel(r).padEnd(9)}  ${(r.confidence || '').padEnd(4)}  ${String(r.channel_title).slice(0, 22).padEnd(23)} ${String(r.title).slice(0, 52)}`,
    );
  }
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
